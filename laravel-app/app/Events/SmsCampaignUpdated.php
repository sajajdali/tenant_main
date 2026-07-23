<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SmsCampaignUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly string $tenantId,
        public readonly array $campaign,
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new Channel(sprintf('tenant.%s.sms-campaigns', $this->tenantId)),
        ];
    }

    public function broadcastAs(): string
    {
        return 'sms-campaign.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'campaign' => $this->campaign,
        ];
    }
}
