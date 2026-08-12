<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Nutrition Exercises', description: 'Customer diet exercise catalog, logging, and calorie burn APIs')]
#[OA\Get(
    path: '/api/v1/app/nutrition/exercises',
    operationId: 'nutritionExercisesIndex',
    description: 'لیست گروه بندی شده ورزش های قابل ثبت در صفحه /nutrition/my-diet/exercises را برمی گرداند. گروه ها از کتابخانه مرکزی و override/custom های tenant ادغام می شوند. exercise_ref ارسالی در exercise-log دقیقا همان id هر exercise در این پاسخ است، مثل central-12 یا tenant-5. فیلدهای supportsIntensity، supportsDistance و supportsSpeed تعیین می کنند کدام ورودی های فرم برای آن ورزش معنی دار هستند.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Exercises'],
    responses: [
        new OA\Response(response: 200, description: 'Exercise catalog', content: new OA\JsonContent(ref: '#/components/schemas/NutritionExerciseCatalogResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 404, description: 'Nutrition audience is not active for tenant'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/nutrition/prescriptions/current/exercise-log',
    operationId: 'nutritionExercisesStoreLog',
    description: 'ثبت ورزش برای رژیم فعلی و تاریخ انتخاب شده در صفحه /nutrition/my-diet/exercises?date=YYYY-MM-DD. exercise_ref باید از GET /api/v1/nutrition/exercises بیاید. کالری سوزانده شده در سرور محاسبه و در caloriesBurned برمی گردد: ابتدا MET بر اساس شدت یا سرعت resolve می شود؛ اگر speed_kmh ارسال نشود ولی distance_km وجود داشته باشد، سرعت از distance/duration محاسبه می شود؛ سپس calories = MET * weight_kg * duration_hours. برای daily_prescription فقط روز جاری قابل ثبت است. پاسخ نسخه تازه را برای آپدیت کالری سوزانده شده و درصدهای روز برمی گرداند. بعد از response موفق، اپ Flutter باید به جای toast ساده یک modal موفقیت نمایش دهد: «ورزش شما با موفقیت ثبت شد» و با دکمه تأیید بسته شود.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Exercises'],
    requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(ref: '#/components/schemas/NutritionExerciseLogStoreRequest')),
    responses: [
        new OA\Response(response: 200, description: 'Exercise log saved', content: new OA\JsonContent(ref: '#/components/schemas/NutritionPrescriptionMutationResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 404, description: 'Current prescription or exercise not found'),
        new OA\Response(response: 422, description: 'Validation error or daily prescription date is not today'),
        new OA\Response(response: 503, description: 'Exercise migration is missing'),
    ],
)]
#[OA\Delete(
    path: '/api/v1/app/nutrition/prescriptions/current/exercise-log/{exerciseLogId}',
    operationId: 'nutritionExercisesDeleteLog',
    description: 'حذف ثبت ورزش. اگر ثبت متعلق به رژیم روزانه فعلی باشد محدودیت فقط روز جاری اعمال می شود. پاسخ نسخه تازه را برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Exercises'],
    parameters: [
        new OA\Parameter(name: 'exerciseLogId', in: 'path', required: true, schema: new OA\Schema(type: 'integer', minimum: 1), example: 303),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Exercise log deleted', content: new OA\JsonContent(ref: '#/components/schemas/NutritionPrescriptionMutationResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 404, description: 'Current prescription or exercise log not found'),
        new OA\Response(response: 422, description: 'Daily prescription date is not today'),
        new OA\Response(response: 503, description: 'Exercise migration is missing'),
    ],
)]
#[OA\Schema(
    schema: 'NutritionExerciseLog',
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '303'),
        new OA\Property(property: 'consumedDate', type: 'string', format: 'date', example: '2026-06-16'),
        new OA\Property(property: 'exerciseId', type: 'string', nullable: true, example: 'central-12'),
        new OA\Property(property: 'title', type: 'string', example: 'پیاده روی'),
        new OA\Property(property: 'groupTitle', type: 'string', nullable: true, example: 'هوازی'),
        new OA\Property(property: 'iconKey', type: 'string', nullable: true, example: 'walking'),
        new OA\Property(property: 'intensity', type: 'string', enum: ['light', 'moderate', 'vigorous'], example: 'moderate'),
        new OA\Property(property: 'durationMinutes', type: 'integer', example: 40),
        new OA\Property(property: 'distanceKm', type: 'number', nullable: true, format: 'float', example: 3.2),
        new OA\Property(property: 'speedKmh', type: 'number', nullable: true, format: 'float', example: 4.8),
        new OA\Property(property: 'weightKg', type: 'number', nullable: true, format: 'float', example: 86.5),
        new OA\Property(property: 'caloriesBurned', type: 'integer', example: 180),
        new OA\Property(property: 'notes', type: 'string', nullable: true),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionExerciseCatalogResponse',
    required: ['success', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(
            property: 'data',
            required: ['groups'],
            properties: [
                new OA\Property(property: 'groups', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionExerciseGroup')),
            ],
            type: 'object',
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionExerciseGroup',
    required: ['id', 'title', 'slug', 'sortOrder', 'isActive', 'exercisesCount', 'exercises'],
    properties: [
        new OA\Property(property: 'id', description: 'شناسه قابل ارجاع گروه با prefix central یا tenant.', type: 'string', example: 'central-1'),
        new OA\Property(property: 'source', type: 'string', enum: ['central', 'tenant'], example: 'central'),
        new OA\Property(property: 'centralId', type: 'string', nullable: true, example: '1'),
        new OA\Property(property: 'tenantId', type: 'string', nullable: true, example: null),
        new OA\Property(property: 'isCustom', type: 'boolean', example: false),
        new OA\Property(property: 'isOverride', type: 'boolean', example: false),
        new OA\Property(property: 'title', type: 'string', example: 'هوازی'),
        new OA\Property(property: 'slug', type: 'string', example: 'cardio'),
        new OA\Property(property: 'description', type: 'string', nullable: true, example: 'فعالیت های هوازی و چربی سوز'),
        new OA\Property(property: 'iconKey', type: 'string', nullable: true, example: 'heart-pulse'),
        new OA\Property(property: 'accentColor', type: 'string', nullable: true, example: '#10b981'),
        new OA\Property(property: 'softColor', type: 'string', nullable: true, example: '#d1fae5'),
        new OA\Property(property: 'sortOrder', type: 'integer', example: 10),
        new OA\Property(property: 'isActive', type: 'boolean', example: true),
        new OA\Property(property: 'exercisesCount', type: 'integer', example: 8),
        new OA\Property(property: 'exercises', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionExerciseCatalogItem')),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionExerciseCatalogItem',
    required: ['id', 'groupId', 'title', 'slug', 'supportsIntensity', 'supportsDistance', 'supportsSpeed', 'defaultIntensity', 'sortOrder', 'isActive'],
    properties: [
        new OA\Property(property: 'id', description: 'این مقدار همان exercise_ref برای ثبت ورزش است.', type: 'string', example: 'central-12'),
        new OA\Property(property: 'source', type: 'string', enum: ['central', 'tenant'], example: 'central'),
        new OA\Property(property: 'centralId', type: 'string', nullable: true, example: '12'),
        new OA\Property(property: 'tenantId', type: 'string', nullable: true, example: null),
        new OA\Property(property: 'isCustom', type: 'boolean', example: false),
        new OA\Property(property: 'isOverride', type: 'boolean', example: false),
        new OA\Property(property: 'groupId', type: 'string', example: 'central-1'),
        new OA\Property(property: 'groupTitle', type: 'string', nullable: true, example: 'هوازی'),
        new OA\Property(property: 'title', type: 'string', example: 'پیاده روی'),
        new OA\Property(property: 'slug', type: 'string', example: 'walking'),
        new OA\Property(property: 'description', type: 'string', nullable: true, example: 'پیاده روی آرام تا تند'),
        new OA\Property(property: 'iconKey', type: 'string', nullable: true, example: 'walking'),
        new OA\Property(property: 'badgeText', type: 'string', nullable: true, example: 'هوازی'),
        new OA\Property(property: 'searchTerms', type: 'string', nullable: true, example: 'پیاده روی راه رفتن walking'),
        new OA\Property(property: 'supportsIntensity', type: 'boolean', example: true),
        new OA\Property(property: 'supportsDistance', type: 'boolean', example: true),
        new OA\Property(property: 'supportsSpeed', type: 'boolean', example: true),
        new OA\Property(property: 'defaultIntensity', type: 'string', enum: ['light', 'moderate', 'vigorous'], example: 'moderate'),
        new OA\Property(property: 'metLight', type: 'number', nullable: true, format: 'float', example: 2.5),
        new OA\Property(property: 'metModerate', type: 'number', nullable: true, format: 'float', example: 3.5),
        new OA\Property(property: 'metVigorous', type: 'number', nullable: true, format: 'float', example: 6),
        new OA\Property(property: 'sortOrder', type: 'integer', example: 10),
        new OA\Property(property: 'isActive', type: 'boolean', example: true),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionExerciseLogStoreRequest',
    required: ['consumed_date', 'exercise_ref', 'duration_minutes', 'intensity', 'weight_kg'],
    properties: [
        new OA\Property(property: 'consumed_date', type: 'string', format: 'date', example: '2026-06-16'),
        new OA\Property(property: 'exercise_ref', description: 'id ورزش از GET /api/v1/nutrition/exercises، مثل central-12 یا tenant-5.', type: 'string', example: 'central-12'),
        new OA\Property(property: 'duration_minutes', type: 'integer', minimum: 1, maximum: 1440, example: 40),
        new OA\Property(property: 'intensity', type: 'string', enum: ['light', 'moderate', 'vigorous'], example: 'moderate'),
        new OA\Property(property: 'distance_km', description: 'برای ورزش هایی که supportsDistance=true دارند. اگر speed_kmh خالی باشد، سرعت از این مقدار و duration_minutes محاسبه می شود.', type: 'number', nullable: true, format: 'float', minimum: 0, maximum: 1000, example: 3.2),
        new OA\Property(property: 'speed_kmh', description: 'برای ورزش هایی که supportsSpeed=true دارند و در ورزش های running/cycling/walking می تواند MET را بر اساس سرعت override کند.', type: 'number', nullable: true, format: 'float', minimum: 0, maximum: 100, example: 4.8),
        new OA\Property(property: 'weight_kg', description: 'وزن کاربر برای فرمول کالری: MET * weight_kg * duration_hours.', type: 'number', format: 'float', minimum: 20, maximum: 400, example: 86.5),
        new OA\Property(property: 'notes', type: 'string', nullable: true),
    ],
    type: 'object',
)]
final class CustomerNutritionExerciseApi
{
}
