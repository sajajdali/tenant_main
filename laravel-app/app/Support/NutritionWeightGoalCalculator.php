<?php

declare(strict_types=1);

namespace App\Support;

final class NutritionWeightGoalCalculator
{
    private static function roundToHalf(float $value): float
    {
        return round($value * 2) / 2;
    }

    /**
     * @return array{
     *   healthy_min_weight_kg: float,
     *   healthy_max_weight_kg: float,
     *   ideal_weight_kg: float,
     *   recommended_target_weight_kg: float
     * }
     */
    public static function metrics(
        int $heightCm,
        string $gender,
        float $currentWeightKg,
        string $dietGoal,
    ): array {
        $heightMeters = $heightCm / 100;
        $healthyMin = round(18.5 * $heightMeters * $heightMeters, 2);
        $healthyMax = round(24.9 * $heightMeters * $heightMeters, 2);

        $heightInches = $heightCm / 2.54;
        $inchesOverFiveFeet = max($heightInches - 60, 0);
        $devineIdeal = $gender === 'male'
            ? 50 + (2.3 * $inchesOverFiveFeet)
            : 45.5 + (2.3 * $inchesOverFiveFeet);

        $idealWeight = self::roundToHalf(min(max($devineIdeal, $healthyMin), $healthyMax));
        $healthWeight = self::roundToHalf(($healthyMin + $healthyMax) / 2);

        $recommendedTarget = match ($dietGoal) {
            'lose-weight' => $currentWeightKg > $healthyMax
                ? $healthyMax
                : max($healthyMin, min($currentWeightKg, $healthyMax)),
            'gain-weight' => $currentWeightKg < $healthyMin
                ? $healthyMin
                : min($healthyMax, max($currentWeightKg, $healthyMin)),
            default => min($healthyMax, max($currentWeightKg, $healthyMin)),
        };

        return [
            'healthy_min_weight_kg' => $healthyMin,
            'healthy_max_weight_kg' => $healthyMax,
            'ideal_weight_kg' => $idealWeight,
            'recommended_target_weight_kg' => self::roundToHalf($recommendedTarget ?: $healthWeight),
        ];
    }
}
