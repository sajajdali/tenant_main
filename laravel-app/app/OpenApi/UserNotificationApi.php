<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Tag(name: 'User Notifications', description: 'Customer notification inbox APIs')]
#[OA\Get(
    path: '/api/v1/app/notifications',
    operationId: 'userNotificationsIndex',
    description: 'لیست اعلان های کاربر واردشده برای صفحه /notifications را برمی گرداند. با status=unread فقط اعلان های خوانده نشده برمی گردند.',
    security: [['bearerAuth' => []]],
    tags: ['User Notifications'],
    parameters: [
        new OA\Parameter(
            name: 'status',
            description: 'فیلتر وضعیت اعلان ها.',
            in: 'query',
            required: false,
            schema: new OA\Schema(type: 'string', enum: ['all', 'unread'], default: 'all'),
            example: 'all',
        ),
        new OA\Parameter(
            name: 'page',
            description: 'شماره صفحه.',
            in: 'query',
            required: false,
            schema: new OA\Schema(type: 'integer', minimum: 1, default: 1),
            example: 1,
        ),
        new OA\Parameter(
            name: 'per_page',
            description: 'تعداد اعلان در هر صفحه. حداکثر ۵۰.',
            in: 'query',
            required: false,
            schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 50, default: 10),
            example: 30,
        ),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Paginated notifications', content: new OA\JsonContent(ref: '#/components/schemas/UserNotificationListResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/notifications/unread-count',
    operationId: 'userNotificationsUnreadCount',
    description: 'تعداد اعلان های خوانده نشده کاربر جاری را برای badge زنگ اعلان ها برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['User Notifications'],
    responses: [
        new OA\Response(response: 200, description: 'Unread notifications count', content: new OA\JsonContent(ref: '#/components/schemas/UserNotificationUnreadCountResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/notifications/{notification}',
    operationId: 'userNotificationsShow',
    description: 'جزئیات یک اعلان متعلق به کاربر جاری را برای صفحه/مودال جزئیات اعلان برمی گرداند. مسیر دقیق اپلیکیشن GET /api/v1/app/notifications/{notification} است. این endpoint به تنهایی اعلان را خوانده شده نمی کند؛ بعد از باز شدن موفق، Flutter باید در صورت نیاز POST /api/v1/app/notifications/{notification}/read را صدا بزند. اگر ۴۰۴ برگشت یعنی یا route cache سرور قدیمی است، یا اعلان با این شناسه در دیتابیس همین tenant وجود ندارد.',
    security: [['bearerAuth' => []]],
    tags: ['User Notifications'],
    parameters: [
        new OA\Parameter(
            name: 'notification',
            description: 'شناسه اعلان',
            in: 'path',
            required: true,
            schema: new OA\Schema(type: 'integer', minimum: 1),
            example: 120,
        ),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Notification details', content: new OA\JsonContent(ref: '#/components/schemas/UserNotificationItemResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 403, description: 'Notification belongs to another user'),
        new OA\Response(response: 404, description: 'Notification not found'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/notifications/{notification}/read',
    operationId: 'userNotificationsMarkRead',
    description: 'یک اعلان متعلق به کاربر جاری را خوانده شده می کند. اگر اعلان از قبل خوانده شده باشد، همان آیتم فعلی برمی گردد.',
    security: [['bearerAuth' => []]],
    tags: ['User Notifications'],
    parameters: [
        new OA\Parameter(
            name: 'notification',
            description: 'شناسه اعلان',
            in: 'path',
            required: true,
            schema: new OA\Schema(type: 'integer', minimum: 1),
            example: 120,
        ),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Notification marked as read', content: new OA\JsonContent(ref: '#/components/schemas/UserNotificationItemResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 403, description: 'Notification belongs to another user'),
        new OA\Response(response: 404, description: 'Notification not found'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/notifications/read-all',
    operationId: 'userNotificationsMarkAllRead',
    description: 'همه اعلان های خوانده نشده کاربر جاری را خوانده شده می کند و تعداد ردیف های تغییرکرده را برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['User Notifications'],
    responses: [
        new OA\Response(response: 200, description: 'All notifications marked as read', content: new OA\JsonContent(ref: '#/components/schemas/UserNotificationMarkAllReadResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Schema(
    schema: 'UserNotificationListResponse',
    required: ['success', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
        new OA\Property(
            property: 'data',
            ref: '#/components/schemas/UserNotificationPagination',
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'UserNotificationUnreadCountResponse',
    required: ['success', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(
            property: 'data',
            required: ['count'],
            properties: [
                new OA\Property(property: 'count', type: 'integer', example: 4),
            ],
            type: 'object',
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'UserNotificationItemResponse',
    required: ['success', 'message', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', example: 'اعلان خوانده شد.'),
        new OA\Property(property: 'data', ref: '#/components/schemas/UserNotification'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'UserNotificationMarkAllReadResponse',
    required: ['success', 'message', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', example: 'همه اعلان‌ها خوانده شدند.'),
        new OA\Property(
            property: 'data',
            required: ['updated'],
            properties: [
                new OA\Property(property: 'updated', type: 'integer', example: 3),
            ],
            type: 'object',
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'UserNotificationPagination',
    required: ['items', 'currentPage', 'lastPage', 'perPage', 'total'],
    properties: [
        new OA\Property(property: 'items', type: 'array', items: new OA\Items(ref: '#/components/schemas/UserNotification')),
        new OA\Property(property: 'currentPage', type: 'integer', example: 1),
        new OA\Property(property: 'lastPage', type: 'integer', example: 2),
        new OA\Property(property: 'perPage', type: 'integer', example: 30),
        new OA\Property(property: 'total', type: 'integer', example: 45),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'UserNotification',
    required: ['id', 'title', 'message', 'targetType', 'isRead', 'meta'],
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '120'),
        new OA\Property(property: 'title', type: 'string', example: 'رژیم شما آماده شد'),
        new OA\Property(property: 'message', type: 'string', example: 'رژیم اختصاصی شما توسط کارشناس تایید و آماده مشاهده است.'),
        new OA\Property(property: 'recipientRole', type: 'string', nullable: true, example: 'customer'),
        new OA\Property(property: 'targetType', type: 'string', example: 'nutrition_diet'),
        new OA\Property(property: 'senderName', type: 'string', nullable: true, example: 'مدیریت'),
        new OA\Property(property: 'isRead', type: 'boolean', example: false),
        new OA\Property(property: 'readAt', type: 'string', nullable: true, format: 'date-time'),
        new OA\Property(property: 'createdAt', type: 'string', nullable: true, format: 'date-time'),
        new OA\Property(property: 'meta', ref: '#/components/schemas/UserNotificationMeta'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'UserNotificationMeta',
    properties: [
        new OA\Property(property: 'audienceName', type: 'string', nullable: true, example: 'متخصصین تغذیه'),
        new OA\Property(property: 'audienceSlug', type: 'string', nullable: true, example: 'nutritionists'),
        new OA\Property(property: 'customerClub', ref: '#/components/schemas/UserNotificationCustomerClubMeta', nullable: true),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'UserNotificationCustomerClubMeta',
    properties: [
        new OA\Property(property: 'pointsDelta', type: 'integer', example: 10),
        new OA\Property(property: 'walletDelta', type: 'integer', example: 0),
        new OA\Property(property: 'reasonTitle', type: 'string', nullable: true, example: 'ثبت وعده غذایی'),
    ],
    type: 'object',
)]
final class UserNotificationApi
{
}
