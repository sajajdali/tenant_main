<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\NutritionExercise;
use App\Models\TenantNutritionExercise;

class NutritionExerciseCaloriesService
{
    public function estimate(
        NutritionExercise|TenantNutritionExercise $exercise,
        float $weightKg,
        int $durationMinutes,
        string $intensity = 'moderate',
        ?float $distanceKm = null,
        ?float $speedKmh = null,
    ): int {
        $durationHours = max($durationMinutes, 1) / 60;
        $resolvedSpeed = $speedKmh;

        if (($resolvedSpeed === null || $resolvedSpeed <= 0) && $distanceKm !== null && $distanceKm > 0 && $durationMinutes > 0) {
            $resolvedSpeed = ($distanceKm / $durationMinutes) * 60;
        }

        $met = $this->resolveMet($exercise, $intensity, $resolvedSpeed);

        return max(1, (int) round($met * max($weightKg, 1) * $durationHours));
    }

    private function resolveMet(NutritionExercise|TenantNutritionExercise $exercise, string $intensity, ?float $speedKmh): float
    {
        $normalizedIntensity = match (trim(mb_strtolower($intensity))) {
            'light', 'low', 'سبک' => 'light',
            'vigorous', 'high', 'heavy', 'شدید' => 'vigorous',
            default => 'moderate',
        };

        $speedMet = $this->resolveSpeedBasedMet((string) $exercise->slug, $speedKmh);
        if ($speedMet !== null) {
            return $speedMet;
        }

        $met = match ($normalizedIntensity) {
            'light' => (float) ($exercise->met_light ?? 0),
            'vigorous' => (float) ($exercise->met_vigorous ?? 0),
            default => (float) ($exercise->met_moderate ?? 0),
        };

        if ($met > 0) {
            return $met;
        }

        return max(1.5, (float) ($exercise->met_moderate ?? $exercise->met_light ?? $exercise->met_vigorous ?? 4.0));
    }

    private function resolveSpeedBasedMet(string $slug, ?float $speedKmh): ?float
    {
        if ($speedKmh === null || $speedKmh <= 0) {
            return null;
        }

        if (str_contains($slug, 'running') || str_contains($slug, 'jogging')) {
            return match (true) {
                $speedKmh < 6 => 4.5,
                $speedKmh < 8 => 7.0,
                $speedKmh < 9.5 => 8.3,
                $speedKmh < 10.8 => 9.8,
                $speedKmh < 12.2 => 11.0,
                $speedKmh < 14 => 11.8,
                default => 12.8,
            };
        }

        if (str_contains($slug, 'cycling') || str_contains($slug, 'biking') || str_contains($slug, 'spinning')) {
            return match (true) {
                $speedKmh < 16 => 4.0,
                $speedKmh < 19 => 6.8,
                $speedKmh < 22 => 8.0,
                $speedKmh < 25 => 10.0,
                $speedKmh < 30 => 12.0,
                default => 15.8,
            };
        }

        if (str_contains($slug, 'walking') || str_contains($slug, 'hiking')) {
            return match (true) {
                $speedKmh < 3.5 => 2.5,
                $speedKmh < 5 => 3.5,
                $speedKmh < 6.5 => 4.3,
                default => 6.0,
            };
        }

        return null;
    }
}
