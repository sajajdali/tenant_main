<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Events\SmsCampaignUpdated;
use App\Domain\Tenant\Models\SmsCampaign;
use App\Domain\Tenant\Models\SmsCampaignRecipient;
use App\Domain\Tenant\Models\SmsOutbound;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Jobs\SendSmsCampaignJob;
use App\Services\Sms\SmsDispatchService;
use App\Services\SmsCampaignAudienceService;
use App\Support\SmsGatewaySettings;
use App\Support\SmsPricing;
use App\Support\TenantSandboxMode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class SmsCampaignController extends Controller
{
    public function __construct(
        private readonly SmsDispatchService $dispatch,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $page = SmsCampaign::query()
            ->with('creator:id,name,mobile')
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => collect($page->items())->map(fn (SmsCampaign $campaign) => $this->transformCampaign($campaign))->values(),
                'currentPage' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function preview(Request $request, SmsCampaignAudienceService $audienceService): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'message' => ['nullable', 'string', 'max:900'],
        ]);

        $filters = $this->validatedFilters($request);
        $preview = $audienceService->preview($filters, 10);
        $pricing = SmsPricing::analyze($this->renderCampaignMessage((string) $request->input('message', ''), 'مشتری عزیز'), (int) $preview['total']);

        return response()->json([
            'success' => true,
            'data' => [
                'filters' => $filters,
                'total' => $preview['total'],
                'samples' => $preview['samples'],
                'pricing' => [
                    'encoding' => $pricing['encoding'],
                    'charactersCount' => $pricing['characters_count'],
                    'partsCount' => $pricing['parts_count'],
                    'unitPrice' => $pricing['unit_price'],
                    'totalPrice' => $pricing['total_price'],
                ],
            ],
        ]);
    }

    public function store(Request $request, SmsCampaignAudienceService $audienceService): JsonResponse
    {
        /** @var TenantUser $actor */
        $actor = $this->authorizeAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:900'],
        ]);

        $filters = $this->validatedFilters($request);
        $smsSetting = SmsSetting::query()->first();

        if (
            ! $smsSetting?->enabled
            || ! $smsSetting->provider
            || (! TenantSandboxMode::smsEnabled(null, SmsGatewaySettings::sandboxEnabled()) && blank(SmsGatewaySettings::kavenegarApiKey()))
            || ($smsSetting->provider === 'kavenegar' && blank($smsSetting->credentials['sender'] ?? ''))
        ) {
            return response()->json([
                'success' => false,
                'message' => 'قبل از ثبت کمپین، سرویس پیامک را در تنظیمات عمومی فعال و کامل کنید.',
                'data' => [],
            ], 422);
        }

        $preview = $audienceService->preview($filters, 10);

        if (($preview['total'] ?? 0) === 0) {
            return response()->json([
                'success' => false,
                'message' => 'هیچ گیرنده‌ای برای این کمپین پیدا نشد.',
                'data' => [],
            ], 422);
        }

        $pricing = SmsPricing::analyze($this->renderCampaignMessage($validated['message'], 'مشتری عزیز'), (int) $preview['total']);

        $campaign = DB::transaction(function () use ($validated, $filters, $actor, $pricing, $preview) {
            return SmsCampaign::query()->create([
                'name' => $validated['name'],
                'preset_key' => $filters['preset'],
                'status' => 'pending_review',
                'message' => $validated['message'],
                'message_encoding' => $pricing['encoding'],
                'message_characters_count' => $pricing['characters_count'],
                'message_parts_count' => $pricing['parts_count'],
                'unit_price' => $pricing['unit_price'],
                'estimated_total_price' => $pricing['total_price'],
                'spent_total_price' => 0,
                'filters' => $filters,
                'created_by_user_id' => $actor->id,
                'recipients_count' => (int) ($preview['total'] ?? 0),
            ]);
        });

        $campaign->load('creator:id,name,mobile');
        event(new SmsCampaignUpdated((string) tenant('id'), $this->transformCampaign($campaign)));

        return response()->json([
            'success' => true,
            'message' => 'کمپین پیامکی ثبت شد و در انتظار تایید مدیریت قرار گرفت.',
            'data' => $this->transformCampaign($campaign),
        ]);
    }

    public function update(Request $request, SmsCampaign $campaign, SmsCampaignAudienceService $audienceService): JsonResponse
    {
        /** @var TenantUser $actor */
        $actor = $this->authorizeAdmin($request);

        if (! in_array($campaign->status, ['pending_review', 'rejected', 'draft'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'فقط کمپین‌های در انتظار تایید یا ردشده قابل ویرایش هستند.',
                'data' => $this->transformCampaign($campaign->load('creator:id,name,mobile')),
            ], 422);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:900'],
        ]);

        $filters = $this->validatedFilters($request);
        $preview = $audienceService->preview($filters, 10);

        if (($preview['total'] ?? 0) === 0) {
            return response()->json([
                'success' => false,
                'message' => 'هیچ گیرنده‌ای برای این کمپین پیدا نشد.',
                'data' => [],
            ], 422);
        }

        $pricing = SmsPricing::analyze($this->renderCampaignMessage($validated['message'], 'مشتری عزیز'), (int) $preview['total']);

        DB::transaction(function () use ($campaign, $validated, $filters, $actor, $pricing, $preview): void {
            $campaign->update([
                'name' => $validated['name'],
                'preset_key' => $filters['preset'],
                'status' => 'pending_review',
                'message' => $validated['message'],
                'message_encoding' => $pricing['encoding'],
                'message_characters_count' => $pricing['characters_count'],
                'message_parts_count' => $pricing['parts_count'],
                'unit_price' => $pricing['unit_price'],
                'estimated_total_price' => $pricing['total_price'],
                'spent_total_price' => 0,
                'filters' => $filters,
                'created_by_user_id' => $actor->id,
                'recipients_count' => (int) ($preview['total'] ?? 0),
                'sent_count' => 0,
                'success_count' => 0,
                'failed_count' => 0,
                'cancelled_count' => 0,
                'started_at' => null,
                'finished_at' => null,
                'cancelled_at' => null,
                'last_error' => null,
            ]);
            SmsCampaignRecipient::query()->where('campaign_id', $campaign->id)->delete();
            SmsOutbound::query()->where('campaign_id', $campaign->id)->delete();
        });

        $campaign->refresh()->load('creator:id,name,mobile');
        event(new SmsCampaignUpdated((string) tenant('id'), $this->transformCampaign($campaign)));

        return response()->json([
            'success' => true,
            'message' => 'کمپین ویرایش شد و دوباره در صف بررسی مدیریت قرار گرفت.',
            'data' => $this->transformCampaign($campaign),
        ]);
    }

    public function show(Request $request, SmsCampaign $campaign): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $campaign->load('creator:id,name,mobile');

        $recipientsPage = $campaign->recipients()
            ->orderBy('id')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'campaign' => $this->transformCampaign($campaign),
                'recipients' => [
                    'items' => $recipientsPage->getCollection()->map(fn (SmsCampaignRecipient $recipient) => $this->transformRecipient($recipient))->values(),
                    'currentPage' => $recipientsPage->currentPage(),
                    'lastPage' => $recipientsPage->lastPage(),
                    'perPage' => $recipientsPage->perPage(),
                    'total' => $recipientsPage->total(),
                ],
            ],
        ]);
    }

    public function cancel(Request $request, SmsCampaign $campaign): JsonResponse
    {
        $this->authorizeAdmin($request);

        if (in_array($campaign->status, ['completed', 'cancelled'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'این کمپین دیگر قابل توقف نیست.',
                'data' => $this->transformCampaign($campaign->load('creator:id,name,mobile')),
            ], 422);
        }

        DB::transaction(function () use ($campaign) {
            $campaign->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'finished_at' => now(),
            ]);

            SmsCampaignRecipient::query()
                ->where('campaign_id', $campaign->id)
                ->where('status', 'pending')
                ->update([
                    'status' => 'cancelled',
                    'updated_at' => now(),
                ]);

            SmsOutbound::query()
                ->where('campaign_id', $campaign->id)
                ->where('status', 'pending')
                ->update([
                    'status' => 'cancelled',
                    'updated_at' => now(),
                ]);

            $stats = SmsOutbound::query()
                ->where('campaign_id', $campaign->id)
                ->selectRaw("
                    COUNT(*) as recipients_count,
                    SUM(CASE WHEN status IN ('sent', 'failed', 'cancelled') THEN 1 ELSE 0 END) as sent_count,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as success_count,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
                    SUM(CASE WHEN status = 'sent' THEN total_price ELSE 0 END) as spent_total_price
                ")
                ->first();

            $campaign->update([
                'recipients_count' => (int) ($stats?->recipients_count ?? 0),
                'sent_count' => (int) ($stats?->sent_count ?? 0),
                'success_count' => (int) ($stats?->success_count ?? 0),
                'failed_count' => (int) ($stats?->failed_count ?? 0),
                'cancelled_count' => (int) ($stats?->cancelled_count ?? 0),
                'spent_total_price' => (int) ($stats?->spent_total_price ?? 0),
            ]);
        });

        $campaign->refresh()->load('creator:id,name,mobile');
        event(new SmsCampaignUpdated((string) tenant('id'), $this->transformCampaign($campaign)));

        return response()->json([
            'success' => true,
            'message' => 'ارسال باقی‌مانده این کمپین متوقف شد.',
            'data' => $this->transformCampaign($campaign),
        ]);
    }

    private function validatedFilters(Request $request): array
    {
        $request->merge([
            'professional_id' => $request->input('professional_id', $request->input('barber_id')),
        ]);

        $validated = $request->validate([
            'preset' => ['required', 'in:' . implode(',', SmsCampaignAudienceService::PRESETS)],
            'professional_id' => ['nullable', 'integer', 'exists:professionals,id'],
            'service_id' => ['nullable', 'integer', 'exists:services,id'],
            'inactive_months' => ['nullable', 'integer', 'min:1', 'max:24'],
            'new_customer_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'loyal_min_appointments' => ['nullable', 'integer', 'min:2', 'max:100'],
            'min_store_total_amount' => ['nullable', 'integer', 'min:1'],
            'nutrition_session_number' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        if (in_array($validated['preset'], ['by_barber', 'inactive_service_customers'], true) && empty($validated['professional_id'])) {
            abort(422, 'برای این نوع کمپین باید آرایشگر را انتخاب کنید.');
        }

        if (in_array($validated['preset'], ['by_service', 'inactive_service_customers'], true) && empty($validated['service_id'])) {
            abort(422, 'برای این نوع کمپین باید بخش را انتخاب کنید.');
        }

        if (in_array($validated['preset'], ['inactive_customers', 'inactive_service_customers', 'at_risk_customers'], true) && empty($validated['inactive_months'])) {
            abort(422, 'تعداد ماه‌های غیرفعال را وارد کنید.');
        }

        if ($validated['preset'] === 'high_value_store_customers' && empty($validated['min_store_total_amount'])) {
            abort(422, 'حداقل مبلغ خرید را وارد کنید.');
        }

        if ($validated['preset'] === 'nutrition_session_number' && empty($validated['nutrition_session_number'])) {
            abort(422, 'شماره جلسه رژیم را وارد کنید.');
        }

        return Arr::whereNotNull([
            'preset' => $validated['preset'],
            'barber_id' => $validated['professional_id'] ?? null,
            'professional_id' => $validated['professional_id'] ?? null,
            'service_id' => $validated['service_id'] ?? null,
            'inactive_months' => $validated['inactive_months'] ?? null,
            'new_customer_days' => $validated['new_customer_days'] ?? null,
            'loyal_min_appointments' => $validated['loyal_min_appointments'] ?? null,
            'min_store_total_amount' => $validated['min_store_total_amount'] ?? null,
            'nutrition_session_number' => $validated['nutrition_session_number'] ?? null,
        ]);
    }

    private function authorizeAdmin(Request $request): TenantUser
    {
        /** @var TenantUser|null $actor */
        $actor = $request->user('tenant_web');

        abort_unless($actor?->role === 'admin', 403, __('authorization.admin_section'));

        return $actor;
    }

    private function transformCampaign(SmsCampaign $campaign): array
    {
        return [
            'id' => (string) $campaign->id,
            'name' => $campaign->name,
            'presetKey' => $campaign->preset_key,
            'status' => $campaign->status,
            'message' => $campaign->message,
            'messageEncoding' => $campaign->message_encoding,
            'messageCharactersCount' => (int) $campaign->message_characters_count,
            'messagePartsCount' => (int) $campaign->message_parts_count,
            'unitPrice' => (int) $campaign->unit_price,
            'estimatedTotalPrice' => (int) $campaign->estimated_total_price,
            'spentTotalPrice' => (int) $campaign->spent_total_price,
            'filters' => $campaign->filters ?? [],
            'recipientsCount' => (int) $campaign->recipients_count,
            'sentCount' => (int) $campaign->sent_count,
            'successCount' => (int) $campaign->success_count,
            'failedCount' => (int) $campaign->failed_count,
            'cancelledCount' => (int) $campaign->cancelled_count,
            'createdAt' => $campaign->created_at?->toISOString(),
            'startedAt' => $campaign->started_at?->toISOString(),
            'finishedAt' => $campaign->finished_at?->toISOString(),
            'cancelledAt' => $campaign->cancelled_at?->toISOString(),
            'lastError' => $campaign->last_error,
            'approvalStatus' => match ($campaign->status) {
                'pending_review' => 'pending_review',
                'rejected' => 'rejected',
                default => 'approved',
            },
            'rejectionReason' => $campaign->status === 'rejected' ? $campaign->last_error : null,
            'createdByName' => $campaign->creator?->name,
            'createdByPhone' => $campaign->creator?->mobile,
        ];
    }

    private function transformRecipient(SmsCampaignRecipient $recipient): array
    {
        return [
            'id' => (string) $recipient->id,
            'customerPhone' => $recipient->customer_phone,
            'customerName' => $recipient->customer_name,
            'lastBarberName' => $recipient->last_barber_name,
            'lastServiceName' => $recipient->last_service_name,
            'lastAppointmentAt' => $recipient->last_appointment_at?->toDateString(),
            'firstAppointmentAt' => $recipient->first_appointment_at?->toDateString(),
            'appointmentsCount' => (int) $recipient->appointments_count,
            'messageEncoding' => $recipient->message_encoding,
            'messagePartsCount' => (int) $recipient->message_parts_count,
            'unitPrice' => (int) $recipient->unit_price,
            'status' => $recipient->status,
            'providerMessageId' => $recipient->provider_message_id,
            'errorMessage' => $recipient->error_message,
            'sentAt' => $recipient->sent_at?->toISOString(),
        ];
    }

    private function renderCampaignMessage(string $message, ?string $customerName): string
    {
        $name = trim((string) ($customerName ?? ''));

        return str_replace('{{customer_name}}', $name !== '' ? $name : 'مشتری عزیز', $message);
    }
}
