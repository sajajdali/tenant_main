<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\TenantUser;
use App\Domain\Tenant\Models\UserNotification;
use App\Http\Controllers\Controller;
use App\Services\UserNotificationRealtimeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class UserNotificationController extends Controller
{
    public function __construct(
        private readonly UserNotificationRealtimeService $notificationRealtime,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $actor = $this->actor($request);

        $validated = $request->validate([
            'status' => ['nullable', 'in:all,unread'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $status = (string) ($validated['status'] ?? 'all');
        $perPage = (int) ($validated['per_page'] ?? 10);

        $query = UserNotification::query()
            ->where('tenant_user_id', $actor->id)
            ->when($status === 'unread', fn ($builder) => $builder->where('is_read', false))
            ->latest('id');

        $page = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $page->getCollection()->map(fn (UserNotification $item) => $this->transform($item))->values(),
                'currentPage' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $actor = $this->actor($request);

        return response()->json([
            'success' => true,
            'data' => [
                'count' => UserNotification::query()
                    ->where('tenant_user_id', $actor->id)
                    ->where('is_read', false)
                    ->count(),
            ],
        ]);
    }

    public function show(Request $request, string $notification): JsonResponse
    {
        $actor = $this->actor($request);
        $notification = $this->findActorNotification($actor, $notification);

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => $this->transform($notification),
        ]);
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        $actor = $this->actor($request);
        $notification = $this->findActorNotification($actor, $notification);

        if (! $notification->is_read) {
            $notification->forceFill([
                'is_read' => true,
                'read_at' => Carbon::now(),
            ])->save();

            $this->notificationRealtime->broadcastInboxUpdated([$actor->id]);
        }

        return response()->json([
            'success' => true,
            'message' => __('tenant.notifications.marked_read'),
            'data' => $this->transform($notification->fresh() ?? $notification),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $actor = $this->actor($request);
        $now = Carbon::now();

        $updated = UserNotification::query()
            ->where('tenant_user_id', $actor->id)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => $now,
                'updated_at' => $now,
            ]);

        if ($updated > 0) {
            $this->notificationRealtime->broadcastInboxUpdated([$actor->id]);
        }

        return response()->json([
            'success' => true,
            'message' => __('tenant.notifications.all_marked_read'),
            'data' => [
                'updated' => $updated,
            ],
        ]);
    }

    private function actor(Request $request): TenantUser
    {
        /** @var TenantUser|null $actor */
        $actor = $request->user('sanctum') ?? $request->user('tenant_web');
        abort_unless($actor !== null, 401, 'Unauthenticated.');

        return $actor;
    }

    private function findActorNotification(TenantUser $actor, string $notificationId): UserNotification
    {
        abort_unless(ctype_digit($notificationId) && (int) $notificationId > 0, 404, 'Notification not found.');

        /** @var UserNotification|null $notification */
        $notification = UserNotification::query()
            ->whereKey((int) $notificationId)
            ->where('tenant_user_id', $actor->id)
            ->first();

        abort_unless($notification !== null, 404, 'Notification not found.');

        return $notification;
    }

    private function transform(UserNotification $notification): array
    {
        $meta = is_array($notification->meta) ? $notification->meta : [];

        return [
            'id' => (string) $notification->id,
            'title' => (string) $notification->title,
            'message' => (string) $notification->message,
            'recipientRole' => $notification->recipient_role,
            'targetType' => (string) $notification->target_type,
            'senderName' => $notification->sender_name,
            'isRead' => (bool) $notification->is_read,
            'readAt' => $notification->read_at?->toISOString(),
            'createdAt' => $notification->created_at?->toISOString(),
            'meta' => [
                'audienceName' => isset($meta['audience_name']) ? (string) $meta['audience_name'] : null,
                'audienceSlug' => isset($meta['audience_slug']) ? (string) $meta['audience_slug'] : null,
                'customerClub' => isset($meta['customer_club']) && is_array($meta['customer_club'])
                    ? [
                        'pointsDelta' => (int) ($meta['customer_club']['points_delta'] ?? 0),
                        'walletDelta' => (int) ($meta['customer_club']['wallet_delta'] ?? 0),
                        'reasonTitle' => isset($meta['customer_club']['reason_title']) ? (string) $meta['customer_club']['reason_title'] : null,
                    ]
                    : null,
            ],
        ];
    }
}
