<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Public Cooking Recipes', description: 'لیست دستور پخت برای اپلیکیشن و صفحه غذاها')]
#[OA\Get(
    path: '/api/v1/cooking-recipes',
    operationId: 'publicCookingRecipesIndex',
    description: 'داده صفحه لیست دستور پخت را برمی گرداند. بخش غذاهای پرمصرف از flag=frequent، غذاهای پرطرفدار از flag=popular و آخرین غذاها از جدیدترین دستورهای فعال و منتشرشده ساخته می شود. هر بخش حداکثر ۱۰ آیتم دارد و اگر دستور تصویر اختصاصی نداشته باشد imageUrl تصویر پیش فرض را برمی گرداند.',
    tags: ['Public Cooking Recipes'],
    parameters: [
        new OA\Parameter(name: 'search', in: 'query', required: false, schema: new OA\Schema(type: 'string', maxLength: 100), example: 'حلیم'),
        new OA\Parameter(name: 'q', description: 'Alias اختیاری برای search.', in: 'query', required: false, schema: new OA\Schema(type: 'string', maxLength: 100), example: 'عدسی'),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Cooking recipe sections', content: new OA\JsonContent(ref: '#/components/schemas/PublicCookingRecipeListResponse')),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Get(
    path: '/api/v1/cooking-recipes/{idOrSlug}',
    operationId: 'publicCookingRecipesShow',
    description: 'جزئیات یک دستور پخت فعال و منتشرشده را برای صفحه مشاهده دستور پخت برمی گرداند. خروجی شامل تصویر با fallback، مواد اولیه آماده نمایش، مراحل شماره دار، ارزش غذایی هر وعده، ارزش غذایی کل، ریزمغذی ها، تغذیه مواد و منبع داده است. مقادیر فاقد ستون مستقل مثل امتیاز، سختی یا زمان فقط اگر در metadata ذخیره شده باشند پر می شوند.',
    tags: ['Public Cooking Recipes'],
    parameters: [
        new OA\Parameter(name: 'idOrSlug', in: 'path', required: true, schema: new OA\Schema(type: 'string'), example: 'halim-8cc60d4f0e6c'),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Cooking recipe detail', content: new OA\JsonContent(ref: '#/components/schemas/PublicCookingRecipeDetailResponse')),
        new OA\Response(response: 404, description: 'Recipe not found'),
    ],
)]
#[OA\Schema(
    schema: 'PublicCookingRecipe',
    required: ['id', 'title', 'slug', 'servings', 'ingredientsJson', 'instructionsJson', 'isPublished', 'isActive', 'sortOrder', 'flags', 'imageUrl'],
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '24'),
        new OA\Property(property: 'title', type: 'string', example: 'حلیم'),
        new OA\Property(property: 'slug', type: 'string', example: 'halim-8cc60d4f0e6c'),
        new OA\Property(property: 'description', type: 'string', nullable: true, example: 'صبحانه گرم و مقوی از گندم و گوشت'),
        new OA\Property(property: 'servings', type: 'integer', example: 4),
        new OA\Property(property: 'ingredients', type: 'string', nullable: true, example: "گندم پوست کنده\nگوشت"),
        new OA\Property(property: 'ingredientsJson', type: 'array', items: new OA\Items(type: 'string'), example: ['گندم پوست کنده', 'گوشت', 'دارچین']),
        new OA\Property(property: 'instructions', type: 'string', nullable: true, example: "۱. گندم را بپزید.\n۲. گوشت را اضافه کنید."),
        new OA\Property(property: 'instructionsJson', type: 'array', items: new OA\Items(type: 'string'), example: ['گندم را بپزید.', 'گوشت را اضافه کنید.']),
        new OA\Property(property: 'nutrition', type: 'object', nullable: true, example: ['perServing' => ['calories_kcal' => 365]]),
        new OA\Property(property: 'micronutrients', type: 'object', nullable: true, example: ['iron_mg' => 2.4]),
        new OA\Property(property: 'isPublished', type: 'boolean', example: true),
        new OA\Property(property: 'isActive', type: 'boolean', example: true),
        new OA\Property(property: 'sortOrder', type: 'integer', example: 12),
        new OA\Property(property: 'flags', type: 'array', items: new OA\Items(type: 'string', enum: ['important', 'popular', 'frequent', 'low_calorie', 'vegan', 'affordable']), example: ['popular']),
        new OA\Property(property: 'imageUrl', description: 'تصویر دستور؛ اگر metadata.image_url/imageUrl خالی باشد تصویر پیش فرض برمی گردد.', type: 'string', example: 'https://tenant.example/booking-app/nutrition-hero.jpg'),
        new OA\Property(property: 'createdAt', type: 'string', format: 'date-time', nullable: true, example: '2026-07-06T10:30:00+03:30'),
        new OA\Property(property: 'updatedAt', type: 'string', format: 'date-time', nullable: true, example: '2026-07-06T10:30:00+03:30'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'PublicCookingRecipeIngredientItem',
    required: ['position', 'text', 'name', 'checked'],
    properties: [
        new OA\Property(property: 'position', type: 'integer', example: 1),
        new OA\Property(property: 'text', type: 'string', example: 'گندم پوست کنده 3 کیلوگرم'),
        new OA\Property(property: 'name', type: 'string', example: 'گندم پوست کنده'),
        new OA\Property(property: 'amount', type: 'string', nullable: true, example: '3000 g (3 کیلوگرم)'),
        new OA\Property(property: 'checked', description: 'برای checkbox کلاینت همیشه false ارسال می شود.', type: 'boolean', example: false),
        new OA\Property(property: 'nutrition', description: 'داده تغذیه همین ماده، اگر در nutrition.ingredients موجود باشد.', type: 'object', nullable: true, example: ['calories_kcal' => 10200, 'protein_g' => 411]),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'PublicCookingRecipeInstructionStep',
    required: ['position', 'text'],
    properties: [
        new OA\Property(property: 'position', type: 'integer', example: 1),
        new OA\Property(property: 'text', type: 'string', example: 'گندم را از شب قبل خیس کنید.'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'PublicCookingRecipeDetail',
    allOf: [
        new OA\Schema(ref: '#/components/schemas/PublicCookingRecipe'),
        new OA\Schema(
            properties: [
                new OA\Property(
                    property: 'stats',
                    properties: [
                        new OA\Property(property: 'servings', type: 'integer', example: 7),
                        new OA\Property(property: 'ingredientsCount', type: 'integer', example: 5),
                        new OA\Property(property: 'stepsCount', type: 'integer', example: 4),
                        new OA\Property(property: 'caloriesKcal', type: 'number', nullable: true, example: 2070.36),
                        new OA\Property(property: 'proteinG', type: 'number', nullable: true, example: 94.73),
                        new OA\Property(property: 'carbsG', type: 'number', nullable: true, example: 308.59),
                        new OA\Property(property: 'fatG', type: 'number', nullable: true, example: 68.21),
                        new OA\Property(property: 'fiberG', type: 'number', nullable: true, example: 52.29),
                        new OA\Property(property: 'sugarG', type: 'number', nullable: true, example: 1.74),
                        new OA\Property(property: 'sodiumMg', type: 'number', nullable: true, example: 2148.5),
                        new OA\Property(property: 'cholesterolMg', type: 'number', nullable: true, example: 205.36),
                        new OA\Property(property: 'prepMinutes', type: 'integer', nullable: true, example: null),
                        new OA\Property(property: 'cookMinutes', type: 'integer', nullable: true, example: null),
                        new OA\Property(property: 'difficulty', type: 'string', nullable: true, example: null),
                        new OA\Property(property: 'rating', type: 'number', nullable: true, example: null),
                    ],
                    type: 'object',
                ),
                new OA\Property(property: 'ingredientItems', type: 'array', items: new OA\Items(ref: '#/components/schemas/PublicCookingRecipeIngredientItem')),
                new OA\Property(property: 'instructionSteps', type: 'array', items: new OA\Items(ref: '#/components/schemas/PublicCookingRecipeInstructionStep')),
                new OA\Property(property: 'nutritionPerServing', description: 'ارزش غذایی هر وعده برای کارت های کالری، پروتئین، چربی، فیبر و ...', type: 'object', example: ['calories_kcal' => 2070.36, 'protein_g' => 94.73, 'fat_g' => 68.21, 'fiber_g' => 52.29]),
                new OA\Property(property: 'nutritionTotal', description: 'ارزش غذایی کل دستور پخت.', type: 'object', example: ['calories_kcal' => 14492.5, 'protein_g' => 663.13]),
                new OA\Property(property: 'nutritionIngredients', description: 'داده تغذیه تفکیکی مواد اولیه، اگر در منبع موجود باشد.', type: 'array', items: new OA\Items(type: 'object')),
                new OA\Property(
                    property: 'source',
                    properties: [
                        new OA\Property(property: 'url', type: 'string', nullable: true, example: 'https://chibepazam.ir/حلیم/'),
                        new OA\Property(property: 'scrapedAt', type: 'string', nullable: true, example: '2026-06-17T17:34:22.796Z'),
                    ],
                    type: 'object',
                ),
            ],
            type: 'object',
        ),
    ],
)]
#[OA\Schema(
    schema: 'PublicCookingRecipeListResponse',
    required: ['success', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(
            property: 'data',
            required: ['items', 'popular', 'frequent', 'latest', 'searchResults', 'query'],
            properties: [
                new OA\Property(property: 'items', description: 'وقتی search خالی است برابر latest است؛ وقتی search ارسال شود، برابر searchResults است تا لیست سرچ مثل آخرین غذاها رندر شود.', type: 'array', maxItems: 10, items: new OA\Items(ref: '#/components/schemas/PublicCookingRecipe')),
                new OA\Property(property: 'popular', description: 'غذاهای پرطرفدار؛ فقط دستورهایی که تیک popular دارند.', type: 'array', maxItems: 10, items: new OA\Items(ref: '#/components/schemas/PublicCookingRecipe')),
                new OA\Property(property: 'frequent', description: 'غذاهای پرمصرف؛ فقط دستورهایی که تیک frequent دارند.', type: 'array', maxItems: 10, items: new OA\Items(ref: '#/components/schemas/PublicCookingRecipe')),
                new OA\Property(property: 'latest', description: 'آخرین غذاها برای بخش پایین صفحه.', type: 'array', maxItems: 10, items: new OA\Items(ref: '#/components/schemas/PublicCookingRecipe')),
                new OA\Property(property: 'searchResults', description: 'نتایج سرچ با همان کارت/لیست آخرین غذاها؛ اگر search خالی باشد آرایه خالی است.', type: 'array', maxItems: 10, items: new OA\Items(ref: '#/components/schemas/PublicCookingRecipe')),
                new OA\Property(property: 'query', type: 'string', nullable: true, example: 'حلیم'),
            ],
            type: 'object',
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'PublicCookingRecipeDetailResponse',
    required: ['success', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(
            property: 'data',
            required: ['item'],
            properties: [
                new OA\Property(property: 'item', ref: '#/components/schemas/PublicCookingRecipeDetail'),
            ],
            type: 'object',
        ),
    ],
    type: 'object',
)]
final class PublicCookingRecipeApi {}
