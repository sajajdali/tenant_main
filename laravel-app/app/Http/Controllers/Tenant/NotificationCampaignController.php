<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\NotificationCampaign;
use App\Domain\Tenant\Models\NotificationCampaignRecipient;
use App\Domain\Tenant\Models\TenantUser;
use App\Domain\Tenant\Models\UserNotification;
use App\Http\Controllers\Controller;
use App\Services\NotificationCampaignAudienceService;
use App\Services\TelegramUserNotificationService;
use App\Services\UserNotificationRealtimeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class NotificationCampaignController extends Controller
{
    public function __construct(
        private readonly UserNotificationRealtimeService $notificationRealtime,
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
        $page = NotificationCampaign::query()
            ->with('creator:id,name,mobile')
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => collect($page->items())->map(fn (NotificationCampaign $campaign) => $this->transformCampaign($campaign))->values(),
                'currentPage' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function preview(Request $request, NotificationCampaignAudienceService $audienceService): JsonResponse
    {
        $this->authorizeAdmin($request);

        $filters = $this->validatedFilters($request);
        $preview = $audienceService->preview($filters, 10);

        return response()->json([
            'success' => true,
            'data' => [
                'filters' => $filters,
                'total' => $preview['total'],
                'samples' => $preview['samples'],
            ],
        ]);
    }

    public function store(Request $request, NotificationCampaignAudienceService $audienceService): JsonResponse
    {
        $actor = $this->authorizeAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:180'],
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $filters = $this->validatedFilters($request);
        $recipients = $audienceService->recipients($filters);

        if ($recipients->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => __('tenant.notification_campaign.no_recipients'),
                'data' => [],
            ], 422);
        }

        $campaign = DB::transaction(function () use ($validated, $filters, $recipients, $actor) {
            $campaign = NotificationCampaign::query()->create([
                'name' => $validated['name'],
                'preset_key' => $filters['preset'],
                'status' => 'sending',
                'title' => $validated['title'],
                'message' => $validated['message'],
                'filters' => $filters,
                'created_by_user_id' => $actor->id,
                'recipients_count' => $recipients->count(),
                'started_at' => now(),
            ]);

            $now = now();
            $recipientRows = $recipients->map(fn (array $recipient) => [
                'campaign_id' => $campaign->id,
                'tenant_user_id' => $recipient['tenant_user_id'] ?? null,
                'recipient_phone' => $recipient['customer_phone'],
                'recipient_name' => $recipient['customer_name'] ?? null,
                'recipient_role' => $recipient['user_role'] ?? null,
                'appointments_count' => $recipient['appointments_count'] ?? 0,
                'last_appointment_at' => $recipient['last_appointment_at'] ?? null,
                'store_orders_count' => $recipient['store_orders_count'] ?? 0,
                'store_paid_orders_count' => $recipient['store_paid_orders_count'] ?? 0,
                'store_total_amount' => $recipient['store_total_amount'] ?? 0,
                'status' => 'sent',
                'sent_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();

            $notificationRows = $recipients->map(fn (array $recipient) => [
                'tenant_user_id' => $recipient['tenant_user_id'] ?? null,
                'recipient_mobile' => $recipient['customer_phone'],
                'recipient_name' => $recipient['customer_name'] ?? null,
                'recipient_role' => $recipient['user_role'] ?? null,
                'title' => $validated['title'],
                'message' => $validated['message'],
                'sender_central_user_id' => null,
                'sender_name' => $actor->name ?: $actor->mobile,
                'target_type' => 'campaign',
                'meta' => json_encode([
                    'source' => 'tenant_admin',
                    'campaign_id' => $campaign->id,
                    'campaign_name' => $validated['name'],
                    'preset' => $filters['preset'],
                    'filters' => $filters,
                ], JSON_UNESCAPED_UNICODE),
                'is_read' => false,
                'read_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();

            foreach (array_chunk($recipientRows, 500) as $chunk) {
                NotificationCampaignRecipient::query()->insert($chunk);
            }

            foreach (array_chunk($notificationRows, 500) as $chunk) {
                UserNotification::query()->insert($chunk);
            }

            $this->notificationRealtime->broadcastInboxUpdated(
                $recipients->pluck('tenant_user_id')->all(),
            );

            $campaign->update([
                'status' => 'completed',
                'success_count' => count($recipientRows),
                'failed_count' => 0,
                'finished_at' => $now,
            ]);

            return $campaign;
        });

        $campaign->load('creator:id,name,mobile');
        $telegram = app(TelegramUserNotificationService::class);
        $telegramText = $validated['title']."\n\n".$validated['message'];

        $recipients
            ->pluck('customer_phone')
            ->filter()
            ->unique()
            ->each(fn (string $mobile) => $telegram->notifyMobile($mobile, $telegramText));

        return response()->json([
            'success' => true,
            'message' => __('tenant.notification_campaign.sent'),
            'data' => $this->transformCampaign($campaign),
        ]);
    }

    public function show(Request $request, NotificationCampaign $campaign): JsonResponse
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
                    'items' => $recipientsPage->getCollection()->map(fn (NotificationCampaignRecipient $recipient) => $this->transformRecipient($recipient))->values(),
                    'currentPage' => $recipientsPage->currentPage(),
                    'lastPage' => $recipientsPage->lastPage(),
                    'perPage' => $recipientsPage->perPage(),
                    'total' => $recipientsPage->total(),
                ],
            ],
        ]);
    }

    private function validatedFilters(Request $request): array
    {
        $request->merge([
            'professional_id' => $request->input('professional_id', $request->input('barber_id')),
        ]);

        $validated = $request->validate([
            'preset' => ['required', 'in:' . implode(',', NotificationCampaignAudienceService::PRESETS)],
            'role' => ['nullable', 'in:admin,barber,customer'],
            'professional_id' => ['nullable', 'integer', 'exists:professionals,id'],
            'service_id' => ['nullable', 'integer', 'exists:services,id'],
            'inactive_months' => ['nullable', 'integer', 'min:1', 'max:24'],
            'new_customer_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'loyal_min_appointments' => ['nullable', 'integer', 'min:2', 'max:100'],
            'min_appointments' => ['nullable', 'integer', 'min:1', 'max:500'],
            'min_store_total_amount' => ['nullable', 'integer', 'min:1'],
            'nutrition_session_number' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        if (in_array($validated['preset'], ['by_barber', 'inactive_service_customers'], true) && empty($validated['professional_id'])) {
            abort(422, __('tenant.notification_campaign.validation.professional_required'));
        }

        if (in_array($validated['preset'], ['by_service', 'inactive_service_customers'], true) && empty($validated['service_id'])) {
            abort(422, __('tenant.notification_campaign.validation.service_required'));
        }

        if (in_array($validated['preset'], ['inactive_customers', 'inactive_service_customers', 'at_risk_customers'], true) && empty($validated['inactive_months'])) {
            abort(422, __('tenant.notification_campaign.validation.inactive_months_required'));
        }

        if ($validated['preset'] === 'new_customers' && empty($validated['new_customer_days'])) {
            abort(422, __('tenant.notification_campaign.validation.new_customer_days_required'));
        }

        if ($validated['preset'] === 'loyal_customers' && empty($validated['loyal_min_appointments'])) {
            abort(422, __('tenant.notification_campaign.validation.loyal_min_appointments_required'));
        }

        if ($validated['preset'] === 'appointments_count_at_least' && empty($validated['min_appointments'])) {
            abort(422, __('tenant.notification_campaign.validation.min_appointments_required'));
        }

        if ($validated['preset'] === 'high_value_store_customers' && empty($validated['min_store_total_amount'])) {
            abort(422, __('tenant.notification_campaign.validation.min_store_total_amount_required'));
        }

        if ($validated['preset'] === 'nutrition_session_number' && empty($validated['nutrition_session_number'])) {
            abort(422, __('tenant.notification_campaign.validation.nutrition_session_number_required'));
        }

        return Arr::whereNotNull([
            'preset' => $validated['preset'],
            'role' => $validated['role'] ?? null,
            'barber_id' => $validated['professional_id'] ?? null,
            'professional_id' => $validated['professional_id'] ?? null,
            'service_id' => $validated['service_id'] ?? null,
            'inactive_months' => $validated['inactive_months'] ?? null,
            'new_customer_days' => $validated['new_customer_days'] ?? null,
            'loyal_min_appointments' => $validated['loyal_min_appointments'] ?? null,
            'min_appointments' => $validated['min_appointments'] ?? null,
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

    private function transformCampaign(NotificationCampaign $campaign): array
    {
        return [
            'id' => (string) $campaign->id,
            'name' => $campaign->name,
            'presetKey' => $campaign->preset_key,
            'status' => $campaign->status,
            'title' => $campaign->title,
            'message' => $campaign->message,
            'filters' => $campaign->filters ?? [],
            'recipientsCount' => (int) $campaign->recipients_count,
            'successCount' => (int) $campaign->success_count,
            'failedCount' => (int) $campaign->failed_count,
            'cancelledCount' => (int) $campaign->cancelled_count,
            'createdAt' => $campaign->created_at?->toISOString(),
            'startedAt' => $campaign->started_at?->toISOString(),
            'finishedAt' => $campaign->finished_at?->toISOString(),
            'cancelledAt' => $campaign->cancelled_at?->toISOString(),
            'lastError' => $campaign->last_error,
            'createdByName' => $campaign->creator?->name,
            'createdByPhone' => $campaign->creator?->mobile,
        ];
    }

    private function transformRecipient(NotificationCampaignRecipient $recipient): array
    {
        return [
            'id' => (string) $recipient->id,
            'tenantUserId' => $recipient->tenant_user_id ? (string) $recipient->tenant_user_id : null,
            'recipientPhone' => $recipient->recipient_phone,
            'recipientName' => $recipient->recipient_name,
            'recipientRole' => $recipient->recipient_role,
            'appointmentsCount' => (int) $recipient->appointments_count,
            'lastAppointmentAt' => $recipient->last_appointment_at?->toDateString(),
            'storeOrdersCount' => (int) $recipient->store_orders_count,
            'storePaidOrdersCount' => (int) $recipient->store_paid_orders_count,
            'storeTotalAmount' => (int) $recipient->store_total_amount,
            'status' => $recipient->status,
            'errorMessage' => $recipient->error_message,
            'sentAt' => $recipient->sent_at?->toISOString(),
        ];
    }
}
