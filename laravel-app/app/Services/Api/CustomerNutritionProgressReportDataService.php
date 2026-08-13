<?php

declare(strict_types=1);

namespace App\Services\Api;

use App\Domain\Tenant\Models\NutritionProfile;
use App\Domain\Tenant\Models\TenantUser;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CustomerNutritionProgressReportDataService
{
    public const PERIODS = ['all', '6m', '4m', '3m'];

    public function payload(TenantUser $user, string $period = 'all'): array
    {
        $profile = Schema::hasTable('nutrition_profiles')
            ? NutritionProfile::query()->where('user_id', $user->id)->first()
            : null;
        $weights = $this->weightLogs($user);
        $periodWeights = $this->weightsForPeriod($weights, $period);
        $prescriptions = $this->prescriptions($user, $weights);
        $activeDiet = collect($prescriptions)->first(fn (array $item): bool => $item['isActive']);
        $exercise = $this->exerciseSummary($user);
        $summary = $this->summary($profile, $weights, $prescriptions);

        return [
            'context' => [
                'hasActiveDiet' => $activeDiet !== null,
                'activePrescriptionId' => $activeDiet['id'] ?? null,
                'dietHref' => $activeDiet !== null
                    ? '/nutrition/my-diets/'.$activeDiet['id']
                    : '/nutrition/diet-requests/preview',
            ],
            'summary' => $summary,
            'projection' => $this->projection($summary, $profile, $prescriptions),
            'weightChart' => [
                'selectedPeriod' => $period,
                'periods' => [
                    ['key' => 'all', 'label' => 'کل دوره'],
                    ['key' => '6m', 'label' => '۶ ماه'],
                    ['key' => '4m', 'label' => '۴ ماه'],
                    ['key' => '3m', 'label' => '۳ ماه'],
                ],
                'available' => $periodWeights->isNotEmpty(),
                'reason' => $periodWeights->isNotEmpty() ? null : 'no_weight_logs_in_period',
                'range' => [
                    'from' => $periodWeights->first()['recordedOn'] ?? null,
                    'to' => $periodWeights->last()['recordedOn'] ?? null,
                ],
                'points' => $periodWeights->values()->all(),
                'targetWeightKg' => $summary['targetWeightKg'],
                'statistics' => $this->chartStatistics($weights, $periodWeights),
            ],
            'activity' => $exercise,
            'dietAdherence' => $this->dietAdherence($user),
            'prescriptions' => $prescriptions,
            'bmi' => $this->bmi($profile, $summary),
            'insights' => $this->insights($prescriptions, $summary, $exercise),
            'actions' => $this->actions($prescriptions),
            'nullables' => [
                'profile' => $profile === null ? 'no_profile' : null,
                'weightHistory' => $weights->isEmpty() ? 'no_weight_logs' : null,
                'targetWeightKg' => $summary['targetWeightKg'] === null ? 'no_target_weight' : null,
                'bmi' => $profile?->height_cm ? null : 'no_height' ,
            ],
        ];
    }

    private function weightLogs(TenantUser $user): Collection
    {
        if (! Schema::hasTable('nutrition_weight_logs')) {
            return collect();
        }

        // One point per day keeps the chart stable when a user registers several weights in a day.
        return DB::table('nutrition_weight_logs')
            ->where('user_id', $user->id)
            ->whereNotNull('recorded_on')
            ->orderBy('recorded_on')
            ->orderBy('recorded_at')
            ->orderBy('id')
            ->get()
            ->map(fn (object $log): array => [
                'id' => (string) $log->id,
                'recordedOn' => (string) $log->recorded_on,
                'recordedAt' => $log->recorded_at,
                'weightKg' => (float) $log->weight_kg,
                'source' => (string) $log->source,
                'prescriptionId' => $log->nutrition_diet_prescription_id ? (string) $log->nutrition_diet_prescription_id : null,
            ])
            ->groupBy('recordedOn')
            ->map(fn (Collection $sameDay): array => $sameDay->last())
            ->values();
    }

    private function weightsForPeriod(Collection $weights, string $period): Collection
    {
        if ($period === 'all') {
            return $weights;
        }

        $months = (int) rtrim($period, 'm');
        $from = Carbon::now('Asia/Tehran')->startOfDay()->subMonthsNoOverflow($months)->toDateString();

        return $weights->filter(fn (array $point): bool => $point['recordedOn'] >= $from)->values();
    }

    private function summary(?NutritionProfile $profile, Collection $weights, array $prescriptions): array
    {
        $first = $weights->first();
        $last = $weights->last();
        $start = $first['weightKg'] ?? null;
        $current = $last['weightKg'] ?? ($profile?->weight_kg !== null ? (float) $profile->weight_kg : null);
        $target = $profile?->target_weight_kg ?? $profile?->recommended_target_weight_kg;

        if ($target === null && $prescriptions !== []) {
            $target = $prescriptions[0]['targetWeightKg'];
        }

        $target = $target !== null ? (float) $target : null;
        $change = $start !== null && $current !== null ? round($start - $current, 2) : null;
        $completion = null;

        if ($start !== null && $current !== null && $target !== null) {
            $distance = abs($start - $target);
            $completion = $distance === 0.0 ? 100.0 : round(min(100, max(0, (abs($start - $target) - abs($current - $target)) / $distance * 100)), 1);
        }

        return [
            'available' => $start !== null && $current !== null,
            'reason' => $start !== null && $current !== null ? null : 'insufficient_weight_history',
            'goal' => $profile?->diet_goal,
            'startWeightKg' => $start,
            'startWeightRecordedOn' => $first['recordedOn'] ?? null,
            'currentWeightKg' => $current,
            'currentWeightRecordedOn' => $last['recordedOn'] ?? null,
            'targetWeightKg' => $target,
            'weightChangeKg' => $change,
            'direction' => $change === null ? null : ($change > 0 ? 'lost' : ($change < 0 ? 'gained' : 'unchanged')),
            'completionPercentage' => $completion,
            'remainingToTargetKg' => $current !== null && $target !== null ? round(abs($current - $target), 2) : null,
            'averageWeeklyChangeKg' => $this->averageWeeklyChange($weights),
        ];
    }

    private function averageWeeklyChange(Collection $weights): ?float
    {
        $first = $weights->first();
        $last = $weights->last();
        if ($first === null || $last === null || $first['recordedOn'] === $last['recordedOn']) {
            return null;
        }

        $days = max(1, Carbon::parse($first['recordedOn'])->diffInDays(Carbon::parse($last['recordedOn'])));

        return round((($first['weightKg'] - $last['weightKg']) / $days) * 7, 2);
    }

    private function projection(array $summary, ?NutritionProfile $profile, array $prescriptions): array
    {
        $weekly = $summary['averageWeeklyChangeKg'];
        if ($weekly === null || $weekly === 0.0) {
            $weekly = $profile?->weekly_weight_change_kg !== null ? (float) $profile->weekly_weight_change_kg : null;
        }
        if ($weekly === null || $weekly === 0.0 || $summary['remainingToTargetKg'] === null || $summary['targetWeightKg'] === null) {
            return ['available' => false, 'reason' => 'insufficient_projection_data', 'estimatedTargetDate' => null, 'weeklyChangeKg' => $weekly, 'message' => null];
        }

        $goalDirection = ($summary['currentWeightKg'] ?? 0) > $summary['targetWeightKg'] ? 1 : -1;
        if (($weekly > 0 ? 1 : -1) !== $goalDirection) {
            return ['available' => false, 'reason' => 'weight_trend_moves_away_from_target', 'estimatedTargetDate' => null, 'weeklyChangeKg' => $weekly, 'message' => null];
        }

        $weeks = $summary['remainingToTargetKg'] / abs($weekly);
        return [
            'available' => true,
            'reason' => null,
            'estimatedTargetDate' => Carbon::now('Asia/Tehran')->addDays((int) ceil($weeks * 7))->toDateString(),
            'weeklyChangeKg' => $weekly,
            'message' => null,
        ];
    }

    private function chartStatistics(Collection $allWeights, Collection $periodWeights): array
    {
        $monthAgo = Carbon::now('Asia/Tehran')->subDays(30)->toDateString();
        $last30 = $allWeights->filter(fn (array $point): bool => $point['recordedOn'] >= $monthAgo)->values();
        $last30Change = $last30->count() > 1 ? round($last30->first()['weightKg'] - $last30->last()['weightKg'], 2) : null;
        $monthly = $allWeights->groupBy(fn (array $point): string => substr($point['recordedOn'], 0, 7))
            ->map(fn (Collection $points): ?float => $points->count() > 1 ? round($points->first()['weightKg'] - $points->last()['weightKg'], 2) : null)
            ->filter(fn (?float $change): bool => $change !== null);

        return [
            'last30DaysChangeKg' => $last30Change,
            'bestMonth' => $monthly->isNotEmpty() ? ['month' => (string) $monthly->sortDesc()->keys()->first(), 'weightChangeKg' => $monthly->max()] : null,
            'periodChangeKg' => $periodWeights->count() > 1 ? round($periodWeights->first()['weightKg'] - $periodWeights->last()['weightKg'], 2) : null,
            'measurementCount' => $periodWeights->count(),
        ];
    }

    private function exerciseSummary(TenantUser $user): array
    {
        if (! Schema::hasTable('exercise_logs')) {
            return ['available' => false, 'reason' => 'exercise_logs_not_available', 'sessionCount' => 0, 'totalDurationMinutes' => 0, 'caloriesBurned' => 0];
        }

        $totals = DB::table('exercise_logs')->where('user_id', $user->id)
            ->selectRaw('COUNT(*) as session_count, COALESCE(SUM(duration_minutes), 0) as duration_minutes, COALESCE(SUM(calories_burned), 0) as calories_burned')
            ->first();

        return ['available' => (int) $totals->session_count > 0, 'reason' => (int) $totals->session_count > 0 ? null : 'no_exercise_logs', 'sessionCount' => (int) $totals->session_count, 'totalDurationMinutes' => (int) $totals->duration_minutes, 'caloriesBurned' => (int) $totals->calories_burned];
    }

    private function dietAdherence(TenantUser $user): array
    {
        if (! Schema::hasTable('nutrition_meal_logs')) {
            return ['available' => false, 'reason' => 'meal_logs_not_available', 'percentage' => null, 'loggedMealCount' => 0, 'loggedDayCount' => 0];
        }

        $logs = DB::table('nutrition_meal_logs')->where('user_id', $user->id)->where('status', 'eaten')->get(['consumed_date']);
        return ['available' => false, 'reason' => 'scheduled_meal_total_not_recorded', 'percentage' => null, 'loggedMealCount' => $logs->count(), 'loggedDayCount' => $logs->pluck('consumed_date')->filter()->unique()->count()];
    }

    private function prescriptions(TenantUser $user, Collection $weights): array
    {
        if (! Schema::hasTable('nutrition_diet_prescriptions')) {
            return [];
        }

        $query = DB::table('nutrition_diet_prescriptions as prescription');
        if (Schema::hasTable('nutrition_diet_requests')) {
            $query->leftJoin('nutrition_diet_requests as request', 'request.id', '=', 'prescription.nutrition_diet_request_id');
        }

        return $query
            ->where('prescription.user_id', $user->id)
            ->whereNotNull('prescription.published_at')
            ->orderByDesc('prescription.started_at')
            ->orderByDesc('prescription.id')
            ->get(array_merge(
                ['prescription.id', 'prescription.status', 'prescription.delivery_channel', 'prescription.current_weight_kg', 'prescription.target_weight_kg', 'prescription.started_at', 'prescription.ends_at', 'prescription.is_current'],
                Schema::hasTable('nutrition_diet_requests') ? ['request.diet_template_name'] : [DB::raw('NULL as diet_template_name')],
            ))
            ->map(function (object $item) use ($weights): array {
                $start = $item->started_at ? (string) $item->started_at : null;
                $end = $item->ends_at ? (string) $item->ends_at : Carbon::now('Asia/Tehran')->toDateString();
                $today = Carbon::now('Asia/Tehran')->toDateString();
                $points = $weights->filter(fn (array $point): bool => ($start === null || $point['recordedOn'] >= $start) && $point['recordedOn'] <= $end)->values();
                $change = $points->count() > 1 ? round($points->first()['weightKg'] - $points->last()['weightKg'], 2) : null;
                return [
                    'id' => (string) $item->id,
                    'title' => $item->diet_template_name ?: 'رژیم دریافتی',
                    'status' => (string) $item->status,
                    'deliveryChannel' => (string) $item->delivery_channel,
                    'startedAt' => $start,
                    'endsAt' => $item->ends_at ? (string) $item->ends_at : null,
                    'isCurrent' => (bool) $item->is_current,
                    'isActive' => (bool) $item->is_current
                        && $start !== null
                        && $start <= $today
                        && ($item->ends_at === null || (string) $item->ends_at >= $today),
                    'startWeightKg' => $points->first()['weightKg'] ?? ($item->current_weight_kg !== null ? (float) $item->current_weight_kg : null),
                    'endWeightKg' => $points->last()['weightKg'] ?? null,
                    'targetWeightKg' => $item->target_weight_kg !== null ? (float) $item->target_weight_kg : null,
                    'weightChangeKg' => $change,
                    'measurementCount' => $points->count(),
                ];
            })->values()->all();
    }

    private function bmi(?NutritionProfile $profile, array $summary): array
    {
        $height = $profile?->height_cm ? (float) $profile->height_cm : null;
        return [
            'available' => $height !== null && $height > 0,
            'reason' => $height !== null && $height > 0 ? null : 'no_height',
            'heightCm' => $height,
            'start' => $this->bmiValue($summary['startWeightKg'], $height),
            'current' => $this->bmiValue($summary['currentWeightKg'], $height),
            'target' => $this->bmiValue($summary['targetWeightKg'], $height),
        ];
    }

    private function bmiValue(?float $weight, ?float $heightCm): ?array
    {
        if ($weight === null || $heightCm === null || $heightCm <= 0) {
            return null;
        }
        $value = round($weight / (($heightCm / 100) ** 2), 1);
        return ['value' => $value, 'category' => match (true) { $value < 18.5 => 'underweight', $value < 25 => 'normal', $value < 30 => 'overweight', default => 'obesity' }];
    }

    private function insights(array $prescriptions, array $summary, array $exercise): array
    {
        $effective = collect($prescriptions)->filter(fn (array $item): bool => $item['weightChangeKg'] !== null)->sortByDesc('weightChangeKg')->first();
        return [
            ['key' => 'most_effective_diet', 'available' => $effective !== null, 'reason' => $effective === null ? 'insufficient_prescription_weight_history' : null, 'prescriptionId' => $effective['id'] ?? null, 'weightChangeKg' => $effective['weightChangeKg'] ?? null],
            ['key' => 'heart_health', 'available' => false, 'reason' => 'no_health_measurements'],
            ['key' => 'daily_calorie_goal', 'available' => false, 'reason' => 'daily_goal_adherence_not_calculated'],
            ['key' => 'consistency', 'available' => $summary['averageWeeklyChangeKg'] !== null, 'reason' => $summary['averageWeeklyChangeKg'] === null ? 'insufficient_weight_history' : null, 'averageWeeklyChangeKg' => $summary['averageWeeklyChangeKg']],
            ['key' => 'exercise', 'available' => $exercise['available'], 'reason' => $exercise['reason'], 'caloriesBurned' => $exercise['caloriesBurned']],
        ];
    }

    private function actions(array $prescriptions): array
    {
        $current = collect($prescriptions)->first(fn (array $item): bool => $item['isCurrent']);
        return [
            'viewCurrentDiet' => $current === null ? null : ['prescriptionId' => $current['id'], 'href' => '/nutrition/my-diets/' . $current['id']],
            'getNewDiet' => ['href' => '/nutrition/diet-requests/preview'],
        ];
    }
}
