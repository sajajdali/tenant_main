<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\SmsOutbound;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\Sms\SmsDispatchService;
use App\Support\SmsGatewaySettings;
use App\Support\SmsQueue;
use App\Support\SmsSenderRegistry;
use App\Support\TenantSandboxMode;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SmsOutboundController extends Controller
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
            'search' => ['nullable', 'string', 'max:255'],
        ]);

        $query = SmsOutbound::query();
        $search = trim((string) ($validated['search'] ?? ''));

        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('recipient_mobile', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%");
            });
        }

        $paginator = $query
            ->latest('id')
            ->paginate((int) ($validated['per_page'] ?? 20));

        $todayStart = now()->startOfDay();
        $todayEnd = now()->endOfDay();
        $yesterdayStart = now()->subDay()->startOfDay();
        $yesterdayEnd = now()->subDay()->endOfDay();
        $weekStart = now()->startOfWeek(CarbonInterface::SATURDAY)->startOfDay();
        $weekEnd = now()->endOfWeek(CarbonInterface::FRIDAY)->endOfDay();
        $sentQuery = SmsOutbound::query()->whereNotNull('sent_at');

        return response()->json([
            'success' => true,
            'data' => [
                'items' => collect($paginator->items())->map(fn (SmsOutbound $outbound) => $this->transformOutbound($outbound))->values(),
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'search' => $search,
                'stats' => [
                    'totalSent' => (clone $sentQuery)->count(),
                    'sentToday' => (clone $sentQuery)->whereBetween('sent_at', [$todayStart, $todayEnd])->count(),
                    'sentYesterday' => (clone $sentQuery)->whereBetween('sent_at', [$yesterdayStart, $yesterdayEnd])->count(),
                    'sentThisWeek' => (clone $sentQuery)->whereBetween('sent_at', [$weekStart, $weekEnd])->count(),
                ],
            ],
        ]);
    }

    public function sendSingle(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'mobile' => ['required', 'string', 'max:20'],
            'name' => ['nullable', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:900'],
            'sender' => ['nullable', 'string', 'max:50'],
        ]);

        $smsSetting = $this->resolveSmsSetting();
        $sender = $this->resolveSender($validated['sender'] ?? null, $smsSetting);

        $outbound = $this->dispatch->dispatchQueued($smsSetting, [
            'type' => 'manual',
            'sender' => $sender,
            'recipient_mobile' => (string) $validated['mobile'],
            'recipient_name' => $validated['name'] ?? null,
            'message' => (string) $validated['message'],
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.sms_outbound.queued'),
            'data' => [
                'item' => $this->transformOutbound($outbound),
            ],
        ]);
    }

    public function sendBulk(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'recipients' => ['required', 'array', 'min:1', 'max:200'],
            'recipients.*.mobile' => ['required', 'string', 'max:20'],
            'recipients.*.name' => ['nullable', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:900'],
            'sender' => ['nullable', 'string', 'max:50'],
        ]);

        $smsSetting = $this->resolveSmsSetting();
        $sender = $this->resolveSender($validated['sender'] ?? null, $smsSetting);

        $payloads = array_map(fn (array $recipient): array => [
            'recipient_mobile' => (string) $recipient['mobile'],
            'recipient_name' => $recipient['name'] ?? null,
        ], $validated['recipients']);

        $items = [];

        foreach ($payloads as $payload) {
            $items[] = $this->transformOutbound($this->dispatch->dispatchQueued($smsSetting, [
                'type' => 'manual',
                'sender' => $sender,
                'recipient_mobile' => $payload['recipient_mobile'],
                'recipient_name' => $payload['recipient_name'] ?? null,
                'message' => (string) $validated['message'],
                'queue' => SmsQueue::CAMPAIGN,
            ]));
        }

        return response()->json([
            'success' => true,
            'message' => __('tenant.sms_outbound.bulk_queued'),
            'data' => [
                'sentCount' => 0,
                'failedCount' => 0,
                'queuedCount' => count($items),
                'items' => $items,
            ],
        ]);
    }

    private function resolveSmsSetting(): SmsSetting
    {
        $smsSetting = SmsSetting::query()->first();

        if (
            ! $smsSetting?->enabled
            || ! $smsSetting->provider
            || (! TenantSandboxMode::smsEnabled(null, SmsGatewaySettings::sandboxEnabled()) && blank(SmsGatewaySettings::kavenegarApiKey()))
        ) {
            throw ValidationException::withMessages([
                'sms' => __('tenant.sms_outbound.service_unavailable'),
            ]);
        }

        return $smsSetting;
    }

    private function resolveSender(?string $requestedSender, SmsSetting $smsSetting): string
    {
        $requestedSender = trim((string) $requestedSender);
        $availableSenders = SmsSenderRegistry::numbers()->all();
        $selectedSender = $requestedSender !== '' ? $requestedSender : (string) ($smsSetting->credentials['sender'] ?? '');

        if ($selectedSender === '') {
            throw ValidationException::withMessages([
                'sender' => __('tenant.sms_outbound.sender_required'),
            ]);
        }

        if (! empty($availableSenders) && ! in_array($selectedSender, $availableSenders, true)) {
            throw ValidationException::withMessages([
                'sender' => __('tenant.sms_outbound.sender_invalid'),
            ]);
        }

        return $selectedSender;
    }

    private function authorizeAdmin(Request $request): TenantUser
    {
        /** @var TenantUser|null $actor */
        $actor = $request->user('tenant_web');
        abort_unless($actor?->role === 'admin', 403, __('authorization.admin_section'));

        return $actor;
    }

    private function transformOutbound(SmsOutbound $outbound): array
    {
        return [
            'id' => (string) $outbound->id,
            'campaignId' => $outbound->campaign_id !== null ? (string) $outbound->campaign_id : null,
            'type' => $outbound->type,
            'templateKey' => $outbound->template_key,
            'provider' => $outbound->provider,
            'sender' => $outbound->sender,
            'recipientMobile' => $outbound->recipient_mobile,
            'recipientName' => $outbound->recipient_name,
            'message' => $outbound->message,
            'messageEncoding' => $outbound->message_encoding,
            'partsCount' => (int) $outbound->parts_count,
            'unitPrice' => (int) $outbound->unit_price,
            'totalPrice' => (int) $outbound->total_price,
            'status' => $outbound->status,
            'providerMessageId' => $outbound->provider_message_id,
            'errorMessage' => $outbound->error_message,
            'sentAt' => $outbound->sent_at?->toISOString(),
            'createdAt' => $outbound->created_at?->toISOString(),
        ];
    }
}
