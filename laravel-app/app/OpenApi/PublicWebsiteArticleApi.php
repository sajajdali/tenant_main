<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Public Website Articles', description: 'لیست و جزئیات اخبار و مقالات عمومی سایت')]
#[OA\Get(
    path: '/api/v1/articles/public-posts',
    operationId: 'publicWebsiteArticlesIndex',
    description: 'لیست صفحه‌بندی‌شده اخبار و مقالات منتشرشده سایت را برای صفحه عمومی اخبار برمی‌گرداند.',
    tags: ['Public Website Articles'],
    parameters: [
        new OA\Parameter(name: 'q', in: 'query', required: false, schema: new OA\Schema(type: 'string', maxLength: 160), example: 'رژیم'),
        new OA\Parameter(name: 'category', in: 'query', required: false, schema: new OA\Schema(type: 'string', maxLength: 160), example: 'nutrition-news'),
        new OA\Parameter(name: 'tag', in: 'query', required: false, schema: new OA\Schema(type: 'string', maxLength: 160), example: 'healthy-food'),
        new OA\Parameter(name: 'page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', minimum: 1), example: 1),
        new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 24), example: 6),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Articles list', content: new OA\JsonContent(ref: '#/components/schemas/PublicWebsiteArticleListResponse')),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Get(
    path: '/api/v1/articles/public-posts/{id}',
    operationId: 'publicWebsiteArticlesShow',
    description: 'جزئیات یک خبر یا مقاله منتشرشده را به همراه مطالب مرتبط برمی‌گرداند و تعداد بازدید را افزایش می‌دهد.',
    tags: ['Public Website Articles'],
    parameters: [
        new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string'), example: '12'),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Article detail', content: new OA\JsonContent(ref: '#/components/schemas/PublicWebsiteArticleDetailResponse')),
        new OA\Response(response: 404, description: 'Article not found'),
    ],
)]
#[OA\Schema(
    schema: 'PublicWebsiteArticle',
    required: ['id', 'title', 'slug', 'authorName', 'tags'],
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '12'),
        new OA\Property(property: 'categoryId', type: 'string', nullable: true, example: '3'),
        new OA\Property(property: 'categoryName', type: 'string', nullable: true, example: 'اخبار تغذیه'),
        new OA\Property(property: 'categorySlug', type: 'string', nullable: true, example: 'nutrition-news'),
        new OA\Property(property: 'title', type: 'string', example: 'صبحانه سالم برای شروع روز'),
        new OA\Property(property: 'slug', type: 'string', example: 'healthy-breakfast'),
        new OA\Property(property: 'excerpt', type: 'string', nullable: true, example: 'چند پیشنهاد ساده برای صبحانه مقوی و سبک.'),
        new OA\Property(property: 'content', type: 'string', nullable: true, example: '<p>...</p>'),
        new OA\Property(property: 'keyPoints', description: 'نکته‌های کلیدی خبر؛ بین ۰ تا ۱۰ مورد.', type: 'array', items: new OA\Items(type: 'string'), example: ['مصرف پروتئین کافی به حفظ عضله کمک می‌کند.', 'نوشیدن آب کافی متابولیسم را پشتیبانی می‌کند.']),
        new OA\Property(property: 'authorName', type: 'string', example: 'تیم تحریریه'),
        new OA\Property(property: 'imageUrl', type: 'string', nullable: true, example: 'https://tenant.example/storage/articles/posts/image.webp'),
        new OA\Property(property: 'sortOrder', type: 'integer', example: 0),
        new OA\Property(property: 'isActive', type: 'boolean', example: true),
        new OA\Property(property: 'isFeatured', type: 'boolean', example: false),
        new OA\Property(property: 'showInFeaturedSlider', type: 'boolean', example: true),
        new OA\Property(property: 'isImportant', type: 'boolean', example: false),
        new OA\Property(property: 'publishedAt', type: 'string', format: 'date-time', nullable: true, example: '2026-06-16T10:30:00+03:30'),
        new OA\Property(property: 'publishedAtJalali', type: 'string', nullable: true, example: '۲۶ خرداد ۱۴۰۵'),
        new OA\Property(property: 'readingTimeMinutes', type: 'integer', example: 4),
        new OA\Property(property: 'readingTimeLabel', type: 'string', example: '۴ دقیقه مطالعه'),
        new OA\Property(property: 'viewCount', type: 'integer', example: 42),
        new OA\Property(property: 'tagIds', type: 'array', items: new OA\Items(type: 'string'), example: ['5']),
        new OA\Property(property: 'tags', type: 'array', items: new OA\Items(ref: '#/components/schemas/PublicWebsiteArticleTag')),
        new OA\Property(property: 'createdAt', type: 'string', format: 'date-time', nullable: true, example: '2026-06-15T10:30:00+03:30'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'PublicWebsiteArticleTag',
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '5'),
        new OA\Property(property: 'name', type: 'string', example: 'غذای سالم'),
        new OA\Property(property: 'slug', type: 'string', example: 'healthy-food'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'PublicWebsiteArticleFilter',
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '3'),
        new OA\Property(property: 'name', type: 'string', example: 'اخبار تغذیه'),
        new OA\Property(property: 'slug', type: 'string', example: 'nutrition-news'),
        new OA\Property(property: 'parentId', type: 'string', nullable: true, example: null),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'PublicWebsiteArticleListResponse',
    required: ['success', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(
            property: 'data',
            properties: [
                new OA\Property(property: 'items', type: 'array', items: new OA\Items(ref: '#/components/schemas/PublicWebsiteArticle')),
                new OA\Property(property: 'currentPage', type: 'integer', example: 1),
                new OA\Property(property: 'lastPage', type: 'integer', example: 3),
                new OA\Property(property: 'perPage', type: 'integer', example: 6),
                new OA\Property(property: 'total', type: 'integer', example: 26),
                new OA\Property(property: 'query', type: 'string', nullable: true, example: 'رژیم'),
                new OA\Property(property: 'activeCategory', ref: '#/components/schemas/PublicWebsiteArticleFilter', nullable: true),
                new OA\Property(property: 'activeTag', ref: '#/components/schemas/PublicWebsiteArticleFilter', nullable: true),
                new OA\Property(property: 'featured', ref: '#/components/schemas/PublicWebsiteArticle', nullable: true),
                new OA\Property(property: 'heroArticle', description: 'کارت بزرگ بالای صفحه لیست خبرها.', ref: '#/components/schemas/PublicWebsiteArticle', nullable: true),
                new OA\Property(property: 'important', ref: '#/components/schemas/PublicWebsiteArticle', nullable: true),
                new OA\Property(property: 'latestNews', description: 'آخرین اخبار منتشر شده، مستقل از فیلتر صفحه‌بندی.', type: 'array', items: new OA\Items(ref: '#/components/schemas/PublicWebsiteArticle')),
                new OA\Property(property: 'featuredNews', description: 'اخبار ویژه، مهم یا انتخاب‌شده برای اسلایدر.', type: 'array', items: new OA\Items(ref: '#/components/schemas/PublicWebsiteArticle')),
                new OA\Property(property: 'slider', type: 'array', items: new OA\Items(ref: '#/components/schemas/PublicWebsiteArticle')),
                new OA\Property(property: 'popular', type: 'array', items: new OA\Items(ref: '#/components/schemas/PublicWebsiteArticle')),
                new OA\Property(property: 'categories', type: 'array', items: new OA\Items(type: 'object')),
                new OA\Property(property: 'categoryList', description: 'همان لیست دسته‌بندی‌ها برای مصرف مستقیم کلاینت.', type: 'array', items: new OA\Items(type: 'object')),
                new OA\Property(property: 'tags', type: 'array', items: new OA\Items(type: 'object')),
            ],
            type: 'object',
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'PublicWebsiteArticleDetailResponse',
    required: ['success', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(
            property: 'data',
            properties: [
                new OA\Property(property: 'item', ref: '#/components/schemas/PublicWebsiteArticle'),
                new OA\Property(property: 'related', type: 'array', items: new OA\Items(ref: '#/components/schemas/PublicWebsiteArticle')),
                new OA\Property(property: 'nextArticle', description: 'مقاله بعدی بر اساس ترتیب لیست اخبار؛ اگر وجود نداشته باشد null است.', ref: '#/components/schemas/PublicWebsiteArticle', nullable: true),
            ],
            type: 'object',
        ),
    ],
    type: 'object',
)]
final class PublicWebsiteArticleApi {}
