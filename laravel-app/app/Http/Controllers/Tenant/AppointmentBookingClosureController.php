<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\AppointmentBookingClosure;
use App\Domain\Tenant\Models\AppointmentReopenNotificationRequest;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\SmsCampaign;
use App\Domain\Tenant\Models\SmsCampaignRecipient;
use App\Domain\Tenant\Models\SmsOutbound;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Events\SmsCampaignUpdated;
use App\Http\Controllers\Controller;
use App\Jobs\SendSmsCampaignJob;
use App\Services\Sms\SmsDispatchService;
use App\Support\SmsGatewaySettings;
use App\Support\SmsPricing;
use App\Support\SmsTemplateRegistry;
use App\Support\TenantSandboxMode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AppointmentBookingClosureController extends Controller
{
    public function __construct(
        private readonly SmsDispatchService $dispatch,
    ) {
    }

    public function show(Request $request): JsonResponse
    {
        $user = $request->user('tenant_web');
        $isAdmin = $user?->role === 'admin';
        $activeClosure = $this->activeClosureFromRules();
        $selectedClosureId = $isAdmin ? (int) $request->query('closureId', 0) : 0;
        $selectedClosure = $selectedClosureId > 0
            ? AppointmentBookingClosure::query()
                ->with('smsCampaign')
                ->find($selectedClosureId)
            : null;
        $latestClosure = $isAdmin
            ? (
                $selectedClosureId > 0
                    ? $selectedClosure
                    : ($activeClosure ?: AppointmentBookingClosure::query()
                        ->with('smsCampaign')
                        ->latest('id')
                        ->first())
            )
            : $activeClosure;

        return response()->json([
            'success' => true,
            'data' => $this->payload(
                $latestClosure,
                $user,
                $isAdmin,
                (int) $request->query('historyPage', 1),
            ),
        ]);
    }

    public function close(Request $request): JsonResponse
    {
        $actor = $this->authorizeAdmin($request);

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'notifyOptInEnabled' => ['nullable', 'boolean'],
        ], [
            'message.required' => 'متن نمایش داده‌شده بعد از بستن نوبت‌دهی را وارد کنید.',
        ]);

        $message = trim((string) $validated['message']);

        $closure = DB::transaction(function () use ($actor, $message, $validated): AppointmentBookingClosure {
            $general = $this->generalSettings();
            $rules = $general->booking_rules ?? [];
            $existingOpenClosure = AppointmentBookingClosure::query()
                ->whereNull('opened_at')
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if ($existingOpenClosure) {
                $existingOpenClosure->update([
                    'closed_message' => $message,
                    'notify_opt_in_enabled' => (bool) ($validated['notifyOptInEnabled'] ?? false),
                ]);
                $closure = $existingOpenClosure;
            } else {
                $closure = AppointmentBookingClosure::query()->create([
                    'closed_message' => $message,
                    'notify_opt_in_enabled' => (bool) ($validated['notifyOptInEnabled'] ?? false),
                    'closed_by_user_id' => $actor->id,
                    'closed_at' => now(),
                ]);
            }

            $rules['booking_closed_enabled'] = true;
            $rules['booking_closed_text'] = $message;
            $rules['booking_reopen_notifications_enabled'] = (bool) ($validated['notifyOptInEnabled'] ?? false);
            $rules['active_booking_closure_id'] = (int) $closure->id;

            $general->update(['booking_rules' => $rules]);

            return $closure->fresh();
        });

        return response()->json([
            'success' => true,
            'message' => 'نوبت‌دهی بسته شد.',
            'data' => $this->payload($closure, $actor, true),
        ]);
    }

    public function open(Request $request): JsonResponse
    {
        $actor = $this->authorizeAdmin($request);

        $closure = DB::transaction(function () use ($actor): ?AppointmentBookingClosure {
            $general = $this->generalSettings();
            $rules = $general->booking_rules ?? [];
            $closure = $this->activeClosureFromRules(lock: true);

            if ($closure && ! $closure->opened_at) {
                $closure->update([
                    'opened_by_user_id' => $actor->id,
                    'opened_at' => now(),
                ]);
            }

            $rules['booking_closed_enabled'] = false;
            $rules['booking_closed_text'] = (string) ($rules['booking_closed_text'] ?? '');
            $rules['booking_reopen_notifications_enabled'] = false;
            unset($rules['active_booking_closure_id']);

            $general->update(['booking_rules' => $rules]);

            return $closure?->fresh();
        });

        return response()->json([
            'success' => true,
            'message' => 'نوبت‌دهی باز شد. در صورت نیاز می‌توانید پیامک اطلاع‌رسانی را ارسال کنید.',
            'data' => $this->payload($closure, $actor, true),
        ]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = $request->user('tenant_web');

        if (! $user || in_array($user->role, ['admin', 'barber'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'برای فعال‌سازی اطلاع‌رسانی، ابتدا با حساب کاربری مشتری وارد شوید.',
            ], 401);
        }

        $closure = $this->activeClosureFromRules();

        if (! $closure || ! $closure->notify_opt_in_enabled) {
            return response()->json([
                'success' => false,
                'message' => 'در حال حاضر ثبت اطلاع‌رسانی برای باز شدن نوبت‌دهی فعال نیست.',
            ], 422);
        }

        $mobile = trim((string) $user->mobile);

        if ($mobile === '') {
            return response()->json([
                'success' => false,
                'message' => 'شماره موبایل حساب شما معتبر نیست.',
            ], 422);
        }

        AppointmentReopenNotificationRequest::query()->updateOrCreate(
            [
                'closure_id' => $closure->id,
                'mobile' => $mobile,
            ],
            [
                'user_id' => $user->id,
                'name' => trim((string) $user->name) ?: null,
                'status' => 'pending',
                'error_message' => null,
            ],
        );

        return response()->json([
            'success' => true,
            'message' => 'اطلاع‌رسانی باز شدن نوبت‌دهی برای شما فعال شد.',
            'data' => $this->payload($closure, $user, false),
        ]);
    }

    public function startNotifications(Request $request): JsonResponse
    {
        $actor = $this->authorizeAdmin($request);
        $closure = $this->closureForNotification((int) $request->input('closureId', 0));

        if (! $closure) {
            return response()->json([
                'success' => false,
                'message' => 'چرخه‌ای برای ارسال اطلاع‌رسانی پیدا نشد.',
                'data' => $this->payload(null, $actor, true),
            ], 404);
        }

        $smsSetting = SmsSetting::query()->first();

        if (! $this->smsIsConfigured($smsSetting)) {
            return response()->json([
                'success' => false,
                'message' => 'قبل از ارسال، سرویس پیامک را از بخش تنظیمات پیامک فعال و کامل کنید.',
                'data' => $this->payload($closure, $actor, true),
            ], 422);
        }

        $campaign = DB::transaction(function () use ($closure, $smsSetting, $actor): ?SmsCampaign {
            $closure->refresh();
            $campaign = $closure->sms_campaign_id ? SmsCampaign::query()->lockForUpdate()->find($closure->sms_campaign_id) : null;

            if ($campaign && in_array($campaign->status, ['queued', 'sending'], true)) {
                return $campaign;
            }

            if ($campaign && $campaign->status === 'completed') {
                return $campaign;
            }

            if (! $campaign || in_array($campaign->status, ['cancelled', 'failed', 'rejected'], true)) {
                $campaign = $this->createNotificationCampaign($closure, $smsSetting, $actor);
            } else {
                $campaign->update([
                    'status' => 'queued',
                    'last_error' => null,
                    'finished_at' => null,
                    'cancelled_at' => null,
                ]);
            }

            $closure->update(['sms_campaign_id' => $campaign->id]);

            return $campaign->fresh();
        });

        if (! $campaign) {
            return response()->json([
                'success' => false,
                'message' => 'هیچ کاربری برای اطلاع‌رسانی ثبت نشده است.',
                'data' => $this->payload($closure->fresh(), $actor, true),
            ], 422);
        }

        if ($campaign->status === 'completed') {
            return response()->json([
                'success' => false,
                'message' => 'ارسال اطلاع‌رسانی این چرخه قبلاً کامل شده است.',
                'data' => $this->payload($closure->fresh(), $actor, true),
            ], 422);
        }

        SendSmsCampaignJob::dispatch((string) tenant('id'), (int) $campaign->id);
        event(new SmsCampaignUpdated((string) tenant('id'), $this->transformCampaign($campaign->fresh())));

        return response()->json([
            'success' => true,
            'message' => 'ارسال پیامک اطلاع‌رسانی شروع شد.',
            'data' => $this->payload($closure->fresh(), $actor, true),
        ]);
    }

    public function pauseNotifications(Request $request): JsonResponse
    {
        $actor = $this->authorizeAdmin($request);
        $closure = $this->closureForNotification((int) $request->input('closureId', 0));
        $campaign = $closure?->sms_campaign_id ? SmsCampaign::query()->find($closure->sms_campaign_id) : null;

        if (! $closure || ! $campaign || ! in_array($campaign->status, ['queued', 'sending'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'ارسال فعالی برای توقف پیدا نشد.',
                'data' => $this->payload($closure, $actor, true),
            ], 422);
        }

        $campaign->update([
            'status' => 'paused',
            'last_error' => 'ارسال توسط مدیر متوقف شد.',
        ]);
        event(new SmsCampaignUpdated((string) tenant('id'), $this->transformCampaign($campaign->fresh())));

        return response()->json([
            'success' => true,
            'message' => 'ارسال پیامک متوقف شد و هر زمان بخواهید قابل ادامه است.',
            'data' => $this->payload($closure->fresh(), $actor, true),
        ]);
    }

    private function createNotificationCampaign(AppointmentBookingClosure $closure, SmsSetting $smsSetting, TenantUser $actor): ?SmsCampaign
    {
        $requests = $closure->notificationRequests()
            ->where(function ($query): void {
                $query
                    ->whereNull('sms_outbound_id')
                    ->orWhereHas('smsOutbound', function ($outboundQuery): void {
                        $outboundQuery->whereIn('status', ['pending', 'failed', 'cancelled']);
                    });
            })
            ->orderBy('id')
            ->get();

        if ($requests->isEmpty()) {
            return null;
        }

        $template = $this->notificationTemplate($smsSetting);
        $provider = (string) $smsSetting->provider;
        $sender = (string) ($smsSetting->credentials['sender'] ?? '');
        $sampleMessage = $this->renderNotificationMessage((string) ($template['body'] ?? ''), 'مشتری عزیز');
        $samplePricing = SmsPricing::analyze($sampleMessage, $requests->count());

        $campaign = SmsCampaign::query()->create([
            'name' => 'اطلاع رسانی باز شدن نوبت ها',
            'preset_key' => 'appointment_reopen_notification',
            'status' => 'queued',
            'message' => (string) ($template['body'] ?? ''),
            'message_encoding' => $samplePricing['encoding'],
            'message_characters_count' => $samplePricing['characters_count'],
            'message_parts_count' => $samplePricing['parts_count'],
            'unit_price' => $samplePricing['unit_price'],
            'estimated_total_price' => 0,
            'spent_total_price' => 0,
            'filters' => [
                'preset' => 'appointment_reopen_notification',
                'closure_id' => (int) $closure->id,
            ],
            'created_by_user_id' => $actor->id,
            'recipients_count' => $requests->count(),
        ]);

        $now = now();
        $recipientRows = [];
        $estimatedTotal = 0;

        foreach ($requests as $request) {
            $message = $this->renderNotificationMessage((string) ($template['body'] ?? ''), $request->name ?: 'مشتری عزیز');
            $pricing = SmsPricing::analyze($message);
            $estimatedTotal += (int) $pricing['total_price'];

            $outbound = $this->dispatch->queue([
                'campaign_id' => $campaign->id,
                'type' => 'appointment_reopen_notification',
                'template_key' => 'appointmentReopened',
                'provider' => $provider,
                'sender' => $sender,
                'recipient_mobile' => $request->mobile,
                'recipient_name' => $request->name,
                'message' => $message,
                'status' => 'pending',
            ]);

            $recipientRows[] = [
                'campaign_id' => $campaign->id,
                'customer_phone' => $request->mobile,
                'customer_name' => $request->name,
                'message_encoding' => $pricing['encoding'],
                'message_parts_count' => $pricing['parts_count'],
                'unit_price' => $pricing['unit_price'],
                'status' => 'pending',
                'created_at' => $now,
                'updated_at' => $now,
            ];

            $request->update([
                'sms_campaign_id' => $campaign->id,
                'sms_outbound_id' => $outbound->id,
                'status' => 'queued',
                'error_message' => null,
            ]);
        }

        foreach (array_chunk($recipientRows, 500) as $chunk) {
            SmsCampaignRecipient::query()->insert($chunk);
        }

        $campaign->update([
            'estimated_total_price' => $estimatedTotal,
        ]);

        return $campaign->fresh();
    }

    private function payload(?AppointmentBookingClosure $closure, ?TenantUser $user, bool $includeAdminData = false, int $historyPage = 1): array
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];
        $activeClosure = $this->activeClosureFromRules();
        $closure?->loadMissing('smsCampaign');
        $campaign = $closure?->smsCampaign;
        $userRequest = null;
        $history = $includeAdminData ? $this->closureHistory($historyPage) : [
            'items' => [],
            'pagination' => $this->emptyHistoryPagination(),
        ];

        if ($activeClosure && $user && ! in_array($user->role, ['admin', 'barber'], true)) {
            $userRequest = AppointmentReopenNotificationRequest::query()
                ->where('closure_id', $activeClosure->id)
                ->where('mobile', $user->mobile)
                ->first();
        }

        return [
            'isClosed' => (bool) ($rules['booking_closed_enabled'] ?? false),
            'closedMessage' => (string) ($rules['booking_closed_text'] ?? ''),
            'notifyOptInEnabled' => (bool) ($rules['booking_reopen_notifications_enabled'] ?? false),
            'activeClosureId' => $activeClosure ? (string) $activeClosure->id : null,
            'userSubscribed' => $userRequest !== null,
            'closure' => $closure ? $this->transformClosure($closure) : null,
            'notificationStats' => $includeAdminData ? $this->notificationStats($closure) : $this->emptyNotificationStats(),
            'campaign' => $includeAdminData && $campaign ? $this->transformCampaign($campaign) : null,
            'history' => $history['items'],
            'historyPagination' => $history['pagination'],
        ];
    }

    private function emptyNotificationStats(): array
    {
        return [
            'requested' => 0,
            'queued' => 0,
            'sent' => 0,
            'failed' => 0,
            'pending' => 0,
            'cancelled' => 0,
            'estimatedTotalPrice' => 0,
            'spentTotalPrice' => 0,
            'creditBalance' => 0,
        ];
    }

    private function transformClosure(AppointmentBookingClosure $closure): array
    {
        return [
            'id' => (string) $closure->id,
            'closedMessage' => $closure->closed_message,
            'notifyOptInEnabled' => (bool) $closure->notify_opt_in_enabled,
            'smsCampaignId' => $closure->sms_campaign_id ? (string) $closure->sms_campaign_id : null,
            'closedAt' => $closure->closed_at?->toISOString(),
            'openedAt' => $closure->opened_at?->toISOString(),
        ];
    }

    private function emptyHistoryPagination(): array
    {
        return [
            'currentPage' => 1,
            'perPage' => 20,
            'lastPage' => 1,
            'total' => 0,
            'from' => 0,
            'to' => 0,
        ];
    }

    private function closureHistory(int $page = 1): array
    {
        $perPage = 20;
        $page = max(1, $page);
        $total = AppointmentBookingClosure::query()->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);

        $paginator = AppointmentBookingClosure::query()
            ->with('smsCampaign')
            ->latest('id')
            ->paginate($perPage, ['*'], 'historyPage', $page);
        $closures = $paginator->getCollection();

        if ($closures->isEmpty()) {
            return [
                'items' => [],
                'pagination' => [
                    'currentPage' => $paginator->currentPage(),
                    'perPage' => $paginator->perPage(),
                    'lastPage' => $paginator->lastPage(),
                    'total' => $paginator->total(),
                    'from' => 0,
                    'to' => 0,
                ],
            ];
        }

        $closureIds = $closures->pluck('id')->all();
        $campaignIds = $closures
            ->pluck('sms_campaign_id')
            ->filter()
            ->values()
            ->all();
        $creditBalance = $this->smsCreditBalance();

        $requestCounts = AppointmentReopenNotificationRequest::query()
            ->whereIn('closure_id', $closureIds)
            ->select('closure_id', DB::raw('COUNT(*) as total'))
            ->groupBy('closure_id')
            ->pluck('total', 'closure_id');

        $outboundStats = empty($campaignIds)
            ? collect()
            : SmsOutbound::query()
                ->whereIn('campaign_id', $campaignIds)
                ->selectRaw("
                    campaign_id,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
                ")
                ->groupBy('campaign_id')
                ->get()
                ->keyBy('campaign_id');

        $items = $closures
            ->map(function (AppointmentBookingClosure $closure) use ($creditBalance, $outboundStats, $requestCounts): array {
                $campaign = $closure->smsCampaign;
                $requested = (int) ($requestCounts[$closure->id] ?? 0);
                $campaignStats = $campaign ? $outboundStats->get($campaign->id) : null;
                $stats = $campaign
                    ? [
                        'requested' => $requested,
                        'queued' => (int) ($campaignStats?->total ?? 0),
                        'sent' => (int) ($campaignStats?->sent_count ?? 0),
                        'failed' => (int) ($campaignStats?->failed_count ?? 0),
                        'pending' => (int) ($campaignStats?->pending_count ?? 0),
                        'cancelled' => (int) ($campaignStats?->cancelled_count ?? 0),
                        'estimatedTotalPrice' => (int) $campaign->estimated_total_price,
                        'spentTotalPrice' => (int) $campaign->spent_total_price,
                        'creditBalance' => $creditBalance,
                    ]
                    : [
                        'requested' => $requested,
                        'queued' => 0,
                        'sent' => 0,
                        'failed' => 0,
                        'pending' => $requested,
                        'cancelled' => 0,
                        'estimatedTotalPrice' => 0,
                        'spentTotalPrice' => 0,
                        'creditBalance' => $creditBalance,
                    ];

                return [
                    ...$this->transformClosure($closure),
                    'notificationStats' => $stats,
                    'campaign' => $campaign ? $this->transformCampaign($campaign) : null,
                ];
            })
            ->values()
            ->all();

        return [
            'items' => $items,
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'lastPage' => $paginator->lastPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem() ?? 0,
                'to' => $paginator->lastItem() ?? 0,
            ],
        ];
    }

    private function notificationStats(?AppointmentBookingClosure $closure): array
    {
        if (! $closure) {
            return [
                'requested' => 0,
                'queued' => 0,
                'sent' => 0,
                'failed' => 0,
                'pending' => 0,
                'cancelled' => 0,
                'estimatedTotalPrice' => 0,
                'spentTotalPrice' => 0,
                'creditBalance' => $this->smsCreditBalance(),
            ];
        }

        $requested = $closure->notificationRequests()->count();
        $campaign = $closure->sms_campaign_id ? SmsCampaign::query()->find($closure->sms_campaign_id) : null;

        if (! $campaign) {
            return [
                'requested' => $requested,
                'queued' => 0,
                'sent' => 0,
                'failed' => 0,
                'pending' => $requested,
                'cancelled' => 0,
                'estimatedTotalPrice' => 0,
                'spentTotalPrice' => 0,
                'creditBalance' => $this->smsCreditBalance(),
            ];
        }

        $outboundStats = SmsOutbound::query()
            ->where('campaign_id', $campaign->id)
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
            ")
            ->first();

        return [
            'requested' => $requested,
            'queued' => (int) ($outboundStats?->total ?? 0),
            'sent' => (int) ($outboundStats?->sent_count ?? 0),
            'failed' => (int) ($outboundStats?->failed_count ?? 0),
            'pending' => (int) ($outboundStats?->pending_count ?? 0),
            'cancelled' => (int) ($outboundStats?->cancelled_count ?? 0),
            'estimatedTotalPrice' => (int) $campaign->estimated_total_price,
            'spentTotalPrice' => (int) $campaign->spent_total_price,
            'creditBalance' => $this->smsCreditBalance(),
        ];
    }

    private function transformCampaign(SmsCampaign $campaign): array
    {
        return [
            'id' => (string) $campaign->id,
            'name' => $campaign->name,
            'status' => $campaign->status,
            'message' => $campaign->message,
            'estimatedTotalPrice' => (int) $campaign->estimated_total_price,
            'spentTotalPrice' => (int) $campaign->spent_total_price,
            'recipientsCount' => (int) $campaign->recipients_count,
            'sentCount' => (int) $campaign->sent_count,
            'successCount' => (int) $campaign->success_count,
            'failedCount' => (int) $campaign->failed_count,
            'cancelledCount' => (int) $campaign->cancelled_count,
            'startedAt' => $campaign->started_at?->toISOString(),
            'finishedAt' => $campaign->finished_at?->toISOString(),
            'cancelledAt' => $campaign->cancelled_at?->toISOString(),
            'lastError' => $campaign->last_error,
        ];
    }

    private function notificationTemplate(SmsSetting $smsSetting): array
    {
        $templates = is_array($smsSetting->templates['v2'] ?? null) ? $smsSetting->templates['v2'] : [];
        $template = SmsTemplateRegistry::approvedTemplate($templates, 'appointmentReopened');

        if (! $template || ! (bool) ($template['enabled'] ?? false)) {
            abort(422, 'قالب پیامک «اطلاع‌رسانی از باز شدن نوبت‌ها» فعال یا تایید نشده است.');
        }

        return $template;
    }

    private function renderNotificationMessage(string $body, string $customerName): string
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $appearance = is_array($rules['appearance'] ?? null) ? $rules['appearance'] : [];
        $businessName = trim((string) ($appearance['store_name'] ?? '')) ?: (string) (tenant()?->name ?? 'مجموعه');

        return strtr($body, [
            '{{customer_name}}' => $customerName,
            '{{business_name}}' => $businessName,
            '{{booking_url}}' => url('/booking'),
        ]);
    }

    private function smsIsConfigured(?SmsSetting $smsSetting): bool
    {
        return $smsSetting?->enabled
            && filled($smsSetting->provider)
            && (
                TenantSandboxMode::smsEnabled(null, SmsGatewaySettings::sandboxEnabled())
                || filled(SmsGatewaySettings::kavenegarApiKey())
            )
            && ($smsSetting->provider !== 'kavenegar' || filled($smsSetting->credentials['sender'] ?? ''));
    }

    private function smsCreditBalance(): int
    {
        $templates = SmsSetting::query()->first()?->templates ?? [];
        $stats = is_array($templates['stats'] ?? null) ? $templates['stats'] : [];

        return (int) data_get($stats, 'creditBalance', 0);
    }

    private function activeClosureFromRules(bool $lock = false): ?AppointmentBookingClosure
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];

        if (! (bool) ($rules['booking_closed_enabled'] ?? false)) {
            return null;
        }

        $id = (int) ($rules['active_booking_closure_id'] ?? 0);
        $query = AppointmentBookingClosure::query()->whereNull('opened_at');

        if ($lock) {
            $query->lockForUpdate();
        }

        if ($id > 0) {
            $closure = (clone $query)->find($id);

            if ($closure) {
                return $closure;
            }
        }

        return $query->latest('id')->first();
    }

    private function closureForNotification(int $id): ?AppointmentBookingClosure
    {
        if ($id > 0) {
            return AppointmentBookingClosure::query()->find($id);
        }

        return AppointmentBookingClosure::query()
            ->whereNotNull('opened_at')
            ->latest('id')
            ->first()
            ?: AppointmentBookingClosure::query()->latest('id')->first();
    }

    private function generalSettings(): GeneralSetting
    {
        return GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);
    }

    private function authorizeAdmin(Request $request): TenantUser
    {
        /** @var TenantUser|null $actor */
        $actor = $request->user('tenant_web');

        abort_unless($actor?->role === 'admin', 403, __('authorization.admin_section'));

        return $actor;
    }
}
