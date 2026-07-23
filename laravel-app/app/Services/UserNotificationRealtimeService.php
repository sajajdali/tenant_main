<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\UserNotification;
use App\Events\UserNotificationInboxUpdated;

class UserNotificationRealtimeService
{
    /**
     * @param array<int|string|null> $tenantUserIds
     */
    public function broadcastInboxUpdated(array $tenantUserIds): void
    {
        $tenantId = tenant('id');

        if (! $tenantId) {
            return;
        }

        $ids = collect($tenantUserIds)
            ->filter(fn ($id): bool => $id !== null && $id !== '')
            ->map(fn ($id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return;
        }

        $counts = UserNotification::query()
            ->selectRaw('tenant_user_id, COUNT(*) as unread_count')
            ->whereIn('tenant_user_id', $ids->all())
            ->where('is_read', false)
            ->groupBy('tenant_user_id')
            ->pluck('unread_count', 'tenant_user_id');

        foreach ($ids as $tenantUserId) {
            event(new UserNotificationInboxUpdated(
                tenantId: (string) $tenantId,
                tenantUserId: (string) $tenantUserId,
                unreadCount: (int) ($counts[$tenantUserId] ?? 0),
            ));
        }
    }
}
