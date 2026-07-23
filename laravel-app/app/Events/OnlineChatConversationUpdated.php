<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OnlineChatConversationUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $customerUserId,
        public readonly array $conversation,
        public readonly string $action,
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new Channel(sprintf('tenant.%s.online-chat.admin', $this->tenantId)),
            new Channel(sprintf('tenant.%s.online-chat.user.%s', $this->tenantId, $this->customerUserId)),
        ];
    }

    public function broadcastAs(): string
    {
        return 'online-chat.conversation.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation' => $this->conversation,
            'action' => $this->action,
        ];
    }
}
