<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SupportTicketUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly string $tenantId,
        public readonly array $ticket,
        public readonly string $action,
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new Channel(sprintf('tenant.%s.support-tickets', $this->tenantId)),
        ];
    }

    public function broadcastAs(): string
    {
        return 'support-ticket.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'ticket' => $this->ticket,
            'action' => $this->action,
        ];
    }
}
