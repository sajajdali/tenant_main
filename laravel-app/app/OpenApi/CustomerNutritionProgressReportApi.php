<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Nutrition Progress Report', description: 'Nutrition progress report for the customer app')]
#[OA\Get(
    path: '/api/v1/app/nutrition/progress-report',
    operationId: 'customerNutritionProgressReport',
    description: 'داده کامل صفحه گزارش پیشرفت را برمی گرداند: خلاصه وزن، پیش بینی هدف، نمودار وزن، ورزش، پایبندی، تاریخچه رژیم، BMI، نکته های گزارش و اکشن ها. period فقط داده نمودار و آمار همان نمودار را محدود می کند؛ summary همیشه کل تاریخچه وزن کاربر است. هیچ عدد ساختگی برنمی گردد: آرایه های بدون داده []، مقدار ناموجود null و هر بخش بدون داده available=false همراه reason دارد.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Progress Report'],
    parameters: [
        new OA\Parameter(name: 'period', in: 'query', required: false, description: 'بازه نمودار. all برای کل دوره است. با تغییر تب نمودار، endpoint را با مقدار جدید دوباره صدا بزنید.', schema: new OA\Schema(type: 'string', enum: ['all', '6m', '4m', '3m'], default: 'all'), example: '6m'),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Progress report', content: new OA\JsonContent(ref: '#/components/schemas/NutritionProgressReportResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Invalid period'),
        new OA\Response(response: 423, description: 'Nutrition access locked'),
    ],
)]
#[OA\Schema(
    schema: 'NutritionProgressReportResponse',
    required: ['success', 'data', 'meta'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
        new OA\Property(property: 'meta', type: 'object'),
        new OA\Property(
            property: 'data', type: 'object',
            required: ['context', 'summary', 'projection', 'weightChart', 'activity', 'dietAdherence', 'prescriptions', 'bmi', 'insights', 'actions', 'nullables'],
            properties: [
                new OA\Property(property: 'context', ref: '#/components/schemas/NutritionProgressContext'),
                new OA\Property(property: 'summary', ref: '#/components/schemas/NutritionProgressSummary'),
                new OA\Property(property: 'projection', ref: '#/components/schemas/NutritionProgressProjection'),
                new OA\Property(property: 'weightChart', ref: '#/components/schemas/NutritionProgressWeightChart'),
                new OA\Property(property: 'activity', ref: '#/components/schemas/NutritionProgressActivity'),
                new OA\Property(property: 'dietAdherence', ref: '#/components/schemas/NutritionProgressDietAdherence'),
                new OA\Property(property: 'prescriptions', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionProgressPrescription')),
                new OA\Property(property: 'bmi', ref: '#/components/schemas/NutritionProgressBmi'),
                new OA\Property(property: 'insights', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionProgressInsight')),
                new OA\Property(property: 'actions', ref: '#/components/schemas/NutritionProgressActions'),
                new OA\Property(property: 'nullables', type: 'object'),
            ],
        ),
    ],
)]
#[OA\Schema(schema: 'NutritionProgressContext', required: ['hasActiveDiet', 'activePrescriptionId', 'dietHref'], properties: [new OA\Property(property: 'hasActiveDiet', type: 'boolean'), new OA\Property(property: 'activePrescriptionId', type: 'string', nullable: true), new OA\Property(property: 'dietHref', type: 'string')])]
#[OA\Schema(schema: 'NutritionProgressSummary', required: ['available', 'reason', 'goal', 'startWeightKg', 'currentWeightKg', 'targetWeightKg', 'weightChangeKg', 'completionPercentage', 'remainingToTargetKg', 'averageWeeklyChangeKg'], properties: [
    new OA\Property(property: 'available', type: 'boolean'), new OA\Property(property: 'reason', type: 'string', nullable: true), new OA\Property(property: 'goal', type: 'string', nullable: true), new OA\Property(property: 'startWeightKg', type: 'number', nullable: true), new OA\Property(property: 'startWeightRecordedOn', type: 'string', format: 'date', nullable: true), new OA\Property(property: 'currentWeightKg', type: 'number', nullable: true), new OA\Property(property: 'currentWeightRecordedOn', type: 'string', format: 'date', nullable: true), new OA\Property(property: 'targetWeightKg', type: 'number', nullable: true), new OA\Property(property: 'weightChangeKg', type: 'number', nullable: true, description: 'مثبت یعنی کاهش وزن، منفی یعنی افزایش وزن.'), new OA\Property(property: 'direction', type: 'string', nullable: true, enum: ['lost', 'gained', 'unchanged']), new OA\Property(property: 'completionPercentage', type: 'number', nullable: true), new OA\Property(property: 'remainingToTargetKg', type: 'number', nullable: true), new OA\Property(property: 'averageWeeklyChangeKg', type: 'number', nullable: true),
])]
#[OA\Schema(schema: 'NutritionProgressProjection', required: ['available', 'reason', 'estimatedTargetDate', 'weeklyChangeKg', 'message'], properties: [new OA\Property(property: 'available', type: 'boolean'), new OA\Property(property: 'reason', type: 'string', nullable: true), new OA\Property(property: 'estimatedTargetDate', type: 'string', format: 'date', nullable: true), new OA\Property(property: 'weeklyChangeKg', type: 'number', nullable: true), new OA\Property(property: 'message', type: 'string', nullable: true)])]
#[OA\Schema(schema: 'NutritionProgressWeightChart', required: ['selectedPeriod', 'periods', 'available', 'reason', 'range', 'points', 'targetWeightKg', 'statistics'], properties: [new OA\Property(property: 'selectedPeriod', type: 'string', enum: ['all', '6m', '4m', '3m']), new OA\Property(property: 'periods', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionProgressPeriod')), new OA\Property(property: 'available', type: 'boolean'), new OA\Property(property: 'reason', type: 'string', nullable: true), new OA\Property(property: 'range', ref: '#/components/schemas/NutritionProgressDateRange'), new OA\Property(property: 'points', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionProgressWeightPoint')), new OA\Property(property: 'targetWeightKg', type: 'number', nullable: true), new OA\Property(property: 'statistics', ref: '#/components/schemas/NutritionProgressWeightStatistics')])]
#[OA\Schema(schema: 'NutritionProgressPeriod', required: ['key', 'label'], properties: [new OA\Property(property: 'key', type: 'string', enum: ['all', '6m', '4m', '3m']), new OA\Property(property: 'label', type: 'string')])]
#[OA\Schema(schema: 'NutritionProgressDateRange', required: ['from', 'to'], properties: [new OA\Property(property: 'from', type: 'string', format: 'date', nullable: true), new OA\Property(property: 'to', type: 'string', format: 'date', nullable: true)])]
#[OA\Schema(schema: 'NutritionProgressWeightPoint', required: ['id', 'recordedOn', 'recordedAt', 'weightKg', 'source', 'prescriptionId'], properties: [new OA\Property(property: 'id', type: 'string'), new OA\Property(property: 'recordedOn', type: 'string', format: 'date'), new OA\Property(property: 'recordedAt', type: 'string', nullable: true), new OA\Property(property: 'weightKg', type: 'number'), new OA\Property(property: 'source', type: 'string', enum: ['profile', 'diet_request', 'manual', 'prescription_checkin']), new OA\Property(property: 'prescriptionId', type: 'string', nullable: true)])]
#[OA\Schema(schema: 'NutritionProgressWeightStatistics', required: ['last30DaysChangeKg', 'bestMonth', 'periodChangeKg', 'measurementCount'], properties: [new OA\Property(property: 'last30DaysChangeKg', type: 'number', nullable: true), new OA\Property(property: 'bestMonth', type: 'object', nullable: true, properties: [new OA\Property(property: 'month', type: 'string', example: '2026-08'), new OA\Property(property: 'weightChangeKg', type: 'number')]), new OA\Property(property: 'periodChangeKg', type: 'number', nullable: true), new OA\Property(property: 'measurementCount', type: 'integer')])]
#[OA\Schema(schema: 'NutritionProgressActivity', required: ['available', 'reason', 'sessionCount', 'totalDurationMinutes', 'caloriesBurned'], properties: [new OA\Property(property: 'available', type: 'boolean'), new OA\Property(property: 'reason', type: 'string', nullable: true), new OA\Property(property: 'sessionCount', type: 'integer'), new OA\Property(property: 'totalDurationMinutes', type: 'integer'), new OA\Property(property: 'caloriesBurned', type: 'integer')])]
#[OA\Schema(schema: 'NutritionProgressDietAdherence', required: ['available', 'reason', 'percentage', 'loggedMealCount', 'loggedDayCount'], properties: [new OA\Property(property: 'available', type: 'boolean'), new OA\Property(property: 'reason', type: 'string', nullable: true), new OA\Property(property: 'percentage', type: 'number', nullable: true), new OA\Property(property: 'loggedMealCount', type: 'integer'), new OA\Property(property: 'loggedDayCount', type: 'integer')])]
#[OA\Schema(schema: 'NutritionProgressPrescription', required: ['id', 'title', 'status', 'deliveryChannel', 'startedAt', 'endsAt', 'isCurrent', 'isActive', 'startWeightKg', 'endWeightKg', 'targetWeightKg', 'weightChangeKg', 'measurementCount'], properties: [new OA\Property(property: 'id', type: 'string'), new OA\Property(property: 'title', type: 'string'), new OA\Property(property: 'status', type: 'string'), new OA\Property(property: 'deliveryChannel', type: 'string'), new OA\Property(property: 'startedAt', type: 'string', format: 'date', nullable: true), new OA\Property(property: 'endsAt', type: 'string', format: 'date', nullable: true), new OA\Property(property: 'isCurrent', type: 'boolean'), new OA\Property(property: 'isActive', type: 'boolean', description: 'فقط اگر رژیم فعلی، منتشرشده و در بازه تاریخ شروع/پایان امروز باشد true است.'), new OA\Property(property: 'startWeightKg', type: 'number', nullable: true), new OA\Property(property: 'endWeightKg', type: 'number', nullable: true), new OA\Property(property: 'targetWeightKg', type: 'number', nullable: true), new OA\Property(property: 'weightChangeKg', type: 'number', nullable: true), new OA\Property(property: 'measurementCount', type: 'integer')])]
#[OA\Schema(schema: 'NutritionProgressBmi', required: ['available', 'reason', 'heightCm', 'start', 'current', 'target'], properties: [new OA\Property(property: 'available', type: 'boolean'), new OA\Property(property: 'reason', type: 'string', nullable: true), new OA\Property(property: 'heightCm', type: 'number', nullable: true), new OA\Property(property: 'start', ref: '#/components/schemas/NutritionProgressBmiValue', nullable: true), new OA\Property(property: 'current', ref: '#/components/schemas/NutritionProgressBmiValue', nullable: true), new OA\Property(property: 'target', ref: '#/components/schemas/NutritionProgressBmiValue', nullable: true)])]
#[OA\Schema(schema: 'NutritionProgressBmiValue', required: ['value', 'category'], properties: [new OA\Property(property: 'value', type: 'number'), new OA\Property(property: 'category', type: 'string', enum: ['underweight', 'normal', 'overweight', 'obesity'])])]
#[OA\Schema(schema: 'NutritionProgressInsight', required: ['key', 'available', 'reason'], properties: [new OA\Property(property: 'key', type: 'string', enum: ['most_effective_diet', 'heart_health', 'daily_calorie_goal', 'consistency', 'exercise']), new OA\Property(property: 'available', type: 'boolean'), new OA\Property(property: 'reason', type: 'string', nullable: true), new OA\Property(property: 'prescriptionId', type: 'string', nullable: true), new OA\Property(property: 'weightChangeKg', type: 'number', nullable: true), new OA\Property(property: 'averageWeeklyChangeKg', type: 'number', nullable: true), new OA\Property(property: 'caloriesBurned', type: 'integer', nullable: true)])]
#[OA\Schema(schema: 'NutritionProgressActions', required: ['viewCurrentDiet', 'getNewDiet'], properties: [new OA\Property(property: 'viewCurrentDiet', type: 'object', nullable: true, properties: [new OA\Property(property: 'prescriptionId', type: 'string'), new OA\Property(property: 'href', type: 'string')]), new OA\Property(property: 'getNewDiet', type: 'object', required: ['href'], properties: [new OA\Property(property: 'href', type: 'string')])])]
final class CustomerNutritionProgressReportApi {}
