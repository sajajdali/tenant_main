<?php

declare(strict_types=1);

namespace App\Events;

use App\Domain\Tenant\Models\NutritionDietRequest;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NutritionDietRequestUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $tenantUserId,
        public readonly array $dietRequest,
    ) {
    }

    public static function fromRequest(string $tenantId, NutritionDietRequest $request): self
    {
        return new self(
            tenantId: $tenantId,
            tenantUserId: (string) $request->user_id,
            dietRequest: [
                'id' => (string) $request->id,
                'status' => (string) $request->status,
                'aiGenerationStatus' => (string) $request->ai_generation_status,
                'aiGenerationError' => $request->ai_generation_error,
                'aiGeneratedAt' => $request->ai_generated_at?->toIso8601String(),
                'updatedAt' => $request->updated_at?->toIso8601String(),
            ],
        );
    }

    public function broadcastOn(): array
    {
        return [
            new Channel(sprintf('tenant.%s.user.%s.nutrition', $this->tenantId, $this->tenantUserId)),
        ];
    }

    public function broadcastAs(): string
    {
        return 'nutrition.diet-request.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'tenantUserId' => $this->tenantUserId,
            'dietRequest' => $this->dietRequest,
        ];
    }
}
