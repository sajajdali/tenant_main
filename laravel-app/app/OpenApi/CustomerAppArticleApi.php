<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Customer App Articles', description: 'اخبار، مقالات و نظرات اپلیکیشن کاربر')]
#[OA\Get(
    path: '/api/v1/app/articles',
    operationId: 'customerAppArticlesIndex',
    description: 'لیست صفحه بندی شده اخبار و مقالات منتشر شده tenant را برمی گرداند. فیلتر category و tag می تواند id یا slug باشد.',
    tags: ['Customer App Articles'],
    parameters: [
        new OA\Parameter(name: 'q', in: 'query', required: false, schema: new OA\Schema(type: 'string', maxLength: 160), example: 'رژیم'),
        new OA\Parameter(name: 'category', in: 'query', required: false, schema: new OA\Schema(type: 'string', maxLength: 160), example: 'nutrition-news'),
        new OA\Parameter(name: 'tag', in: 'query', required: false, schema: new OA\Schema(type: 'string', maxLength: 160), example: 'healthy-food'),
        new OA\Parameter(name: 'page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', minimum: 1), example: 1),
        new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 24), example: 10),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Articles list', content: new OA\JsonContent(ref: '#/components/schemas/CustomerAppArticleListResponse')),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/articles/{id}',
    operationId: 'customerAppArticlesShow',
    description: 'جزئیات یک خبر یا مقاله منتشر شده را به همراه مطالب مرتبط و خلاصه نظرات برمی گرداند. با هر مشاهده، viewCount یک واحد افزایش می یابد.',
    tags: ['Customer App Articles'],
    parameters: [
        new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string'), example: '12'),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Article detail', content: new OA\JsonContent(ref: '#/components/schemas/CustomerAppArticleDetailResponse')),
        new OA\Response(response: 404, description: 'Article not found'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/articles/{slug}/comments',
    operationId: 'customerAppArticleCommentsIndex',
    description: 'لیست نظرهای تایید شده یک خبر یا مقاله را برمی گرداند.',
    tags: ['Customer App Articles'],
    parameters: [
        new OA\Parameter(name: 'slug', in: 'path', required: true, schema: new OA\Schema(type: 'string'), example: 'healthy-breakfast'),
        new OA\Parameter(name: 'page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', minimum: 1), example: 1),
        new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 50), example: 20),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Approved comments list', content: new OA\JsonContent(ref: '#/components/schemas/CustomerAppArticleCommentsResponse')),
        new OA\Response(response: 404, description: 'Article not found'),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/articles/{slug}/comments',
    operationId: 'customerAppArticleCommentsStore',
    description: 'ثبت نظر برای خبر یا مقاله. نظر با status=pending ذخیره می شود و فقط پس از تایید در لیست عمومی نمایش داده خواهد شد.',
    security: [['bearerAuth' => []]],
    tags: ['Customer App Articles'],
    parameters: [
        new OA\Parameter(name: 'slug', in: 'path', required: true, schema: new OA\Schema(type: 'string'), example: 'healthy-breakfast'),
    ],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['body'],
            properties: [
                new OA\Property(property: 'body', type: 'string', minLength: 2, maxLength: 2000, example: 'مطلب کاربردی و خوبی بود.'),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 201, description: 'Comment submitted', content: new OA\JsonContent(ref: '#/components/schemas/CustomerAppArticleCommentStoreResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 404, description: 'Article not found'),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Schema(
    schema: 'CustomerAppArticle',
    required: ['id', 'title', 'slug', 'authorName', 'tags'],
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '12'),
        new OA\Property(property: 'category', ref: '#/components/schemas/CustomerAppArticleCategory', nullable: true),
        new OA\Property(property: 'title', type: 'string', example: 'صبحانه سالم برای شروع روز'),
        new OA\Property(property: 'slug', type: 'string', example: 'healthy-breakfast'),
        new OA\Property(property: 'excerpt', type: 'string', nullable: true, example: 'چند پیشنهاد ساده برای صبحانه مقوی و سبک.'),
        new OA\Property(property: 'content', description: 'در لیست مقدار null است و فقط در show پر می شود.', type: 'string', nullable: true, example: '<p>...</p>'),
        new OA\Property(property: 'keyPoints', description: 'نکته‌های کلیدی خبر؛ بین ۰ تا ۱۰ مورد.', type: 'array', items: new OA\Items(type: 'string'), example: ['مصرف پروتئین کافی به حفظ عضله کمک می‌کند.', 'نوشیدن آب کافی متابولیسم را پشتیبانی می‌کند.']),
        new OA\Property(property: 'authorName', type: 'string', example: 'تیم تحریریه'),
        new OA\Property(property: 'imageUrl', type: 'string', nullable: true, example: 'https://tenant.example/storage/articles/posts/image.webp'),
        new OA\Property(property: 'isFeatured', type: 'boolean', example: false),
        new OA\Property(property: 'showInFeaturedSlider', type: 'boolean', example: true),
        new OA\Property(property: 'isImportant', type: 'boolean', example: false),
        new OA\Property(property: 'publishedAt', type: 'string', format: 'date-time', nullable: true, example: '2026-06-16T10:30:00+03:30'),
        new OA\Property(property: 'publishedAtJalali', type: 'string', nullable: true, example: '۲۶ خرداد ۱۴۰۵'),
        new OA\Property(property: 'readingTimeMinutes', type: 'integer', example: 4),
        new OA\Property(property: 'readingTimeLabel', type: 'string', example: '۴ دقیقه مطالعه'),
        new OA\Property(property: 'viewCount', type: 'integer', example: 42),
        new OA\Property(property: 'tags', type: 'array', items: new OA\Items(ref: '#/components/schemas/CustomerAppArticleTag')),
        new OA\Property(property: 'createdAt', type: 'string', format: 'date-time', nullable: true, example: '2026-06-15T10:30:00+03:30'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'CustomerAppArticleCategory',
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '3'),
        new OA\Property(property: 'name', type: 'string', example: 'اخبار تغذیه'),
        new OA\Property(property: 'slug', type: 'string', example: 'nutrition-news'),
        new OA\Property(property: 'parentId', type: 'string', nullable: true, example: null),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'CustomerAppArticleTag',
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '5'),
        new OA\Property(property: 'name', type: 'string', example: 'غذای سالم'),
        new OA\Property(property: 'slug', type: 'string', example: 'healthy-food'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'CustomerAppArticleComment',
    required: ['id', 'body', 'status'],
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '18'),
        new OA\Property(property: 'authorName', type: 'string', nullable: true, example: 'سارا احمدی'),
        new OA\Property(property: 'body', type: 'string', example: 'مطلب کاربردی و خوبی بود.'),
        new OA\Property(property: 'status', type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'approved'),
        new OA\Property(property: 'approvedAt', type: 'string', format: 'date-time', nullable: true, example: '2026-06-16T11:00:00+03:30'),
        new OA\Property(property: 'createdAt', type: 'string', format: 'date-time', nullable: true, example: '2026-06-16T10:45:00+03:30'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'CustomerAppArticlePaginationMeta',
    properties: [
        new OA\Property(property: 'currentPage', type: 'integer', example: 1),
        new OA\Property(property: 'lastPage', type: 'integer', example: 3),
        new OA\Property(property: 'perPage', type: 'integer', example: 10),
        new OA\Property(property: 'total', type: 'integer', example: 26),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'CustomerAppArticleListResponse',
    required: ['success', 'data', 'meta'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
        new OA\Property(
            property: 'data',
            properties: [
                new OA\Property(property: 'items', type: 'array', items: new OA\Items(ref: '#/components/schemas/CustomerAppArticle')),
                new OA\Property(property: 'heroArticle', description: 'کارت بزرگ بالای صفحه لیست خبرها.', ref: '#/components/schemas/CustomerAppArticle', nullable: true),
                new OA\Property(property: 'featured', type: 'array', items: new OA\Items(ref: '#/components/schemas/CustomerAppArticle')),
                new OA\Property(property: 'latestNews', description: 'آخرین اخبار منتشر شده، مستقل از فیلتر صفحه‌بندی.', type: 'array', items: new OA\Items(ref: '#/components/schemas/CustomerAppArticle')),
                new OA\Property(property: 'featuredNews', description: 'اخبار ویژه، مهم یا انتخاب‌شده برای اسلایدر.', type: 'array', items: new OA\Items(ref: '#/components/schemas/CustomerAppArticle')),
                new OA\Property(property: 'categories', type: 'array', items: new OA\Items(type: 'object')),
                new OA\Property(property: 'categoryList', description: 'همان لیست دسته‌بندی‌ها برای مصرف مستقیم کلاینت.', type: 'array', items: new OA\Items(type: 'object')),
                new OA\Property(property: 'tags', type: 'array', items: new OA\Items(type: 'object')),
            ],
            type: 'object',
        ),
        new OA\Property(property: 'meta', ref: '#/components/schemas/CustomerAppArticlePaginationMeta'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'CustomerAppArticleDetailResponse',
    required: ['success', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
        new OA\Property(
            property: 'data',
            properties: [
                new OA\Property(property: 'item', ref: '#/components/schemas/CustomerAppArticle'),
                new OA\Property(property: 'related', type: 'array', items: new OA\Items(ref: '#/components/schemas/CustomerAppArticle')),
                new OA\Property(property: 'nextArticle', description: 'مقاله بعدی بر اساس ترتیب لیست اخبار؛ اگر وجود نداشته باشد null است.', ref: '#/components/schemas/CustomerAppArticle', nullable: true),
                new OA\Property(
                    property: 'commentsSummary',
                    properties: [
                        new OA\Property(property: 'approvedCount', type: 'integer', example: 4),
                    ],
                    type: 'object',
                ),
            ],
            type: 'object',
        ),
        new OA\Property(property: 'meta', type: 'object'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'CustomerAppArticleCommentsResponse',
    required: ['success', 'data', 'meta'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
        new OA\Property(
            property: 'data',
            properties: [
                new OA\Property(property: 'items', type: 'array', items: new OA\Items(ref: '#/components/schemas/CustomerAppArticleComment')),
            ],
            type: 'object',
        ),
        new OA\Property(property: 'meta', ref: '#/components/schemas/CustomerAppArticlePaginationMeta'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'CustomerAppArticleCommentStoreResponse',
    required: ['success', 'message', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', example: 'نظر شما ثبت شد و پس از تایید نمایش داده می‌شود.'),
        new OA\Property(
            property: 'data',
            properties: [
                new OA\Property(property: 'comment', ref: '#/components/schemas/CustomerAppArticleComment'),
            ],
            type: 'object',
        ),
        new OA\Property(property: 'meta', type: 'object'),
    ],
    type: 'object',
)]
final class CustomerAppArticleApi {}
