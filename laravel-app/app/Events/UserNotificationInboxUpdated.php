<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class UserNotificationInboxUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $tenantUserId,
        public readonly int $unreadCount,
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new Channel(sprintf('tenant.%s.user.%s.notifications', $this->tenantId, $this->tenantUserId)),
        ];
    }

    public function broadcastAs(): string
    {
        return 'user-notification.inbox-updated';
    }

    public function broadcastWith(): array
    {
        return [
            'tenantUserId' => $this->tenantUserId,
            'unreadCount' => $this->unreadCount,
        ];
    }
}
