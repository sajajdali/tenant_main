<?php

declare(strict_types=1);

namespace App\Events;

use App\Domain\Tenant\Models\NutritionMealReplacementSuggestion;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NutritionMealReplacementSuggestionUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $tenantUserId,
        public readonly array $suggestion,
    ) {
    }

    public static function fromSuggestion(string $tenantId, NutritionMealReplacementSuggestion $suggestion): self
    {
        return new self(
            tenantId: $tenantId,
            tenantUserId: (string) $suggestion->user_id,
            suggestion: [
                'id' => (string) $suggestion->id,
                'status' => (string) $suggestion->status,
                'errorMessage' => $suggestion->error_message,
                'sourceType' => (string) $suggestion->source_type,
                'mealSlotKey' => (string) $suggestion->meal_slot_key,
                'dayNumber' => $suggestion->day_number !== null ? (int) $suggestion->day_number : null,
                'mealIndex' => $suggestion->meal_index !== null ? (int) $suggestion->meal_index : null,
                'requestedAt' => $suggestion->requested_at?->toIso8601String(),
                'generatedAt' => $suggestion->generated_at?->toIso8601String(),
                'cancelledAt' => $suggestion->cancelled_at?->toIso8601String(),
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
        return 'nutrition.meal-replacement-suggestion.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'tenantUserId' => $this->tenantUserId,
            'suggestion' => $this->suggestion,
        ];
    }
}
