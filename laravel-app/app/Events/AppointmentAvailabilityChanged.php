<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AppointmentAvailabilityChanged implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $barberId,
        public readonly string $date,
        public readonly string $action,
        public readonly string $appointmentId,
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new Channel($this->channelName()),
        ];
    }

    public function broadcastAs(): string
    {
        return 'appointment.availability.changed';
    }

    public function broadcastWith(): array
    {
        return [
            'tenantId' => $this->tenantId,
            'barberId' => $this->barberId,
            'date' => $this->date,
            'action' => $this->action,
            'appointmentId' => $this->appointmentId,
        ];
    }

    private function channelName(): string
    {
        return sprintf(
            'tenant.%s.barber.%s.date.%s',
            $this->tenantId,
            $this->barberId,
            $this->date,
        );
    }
}
