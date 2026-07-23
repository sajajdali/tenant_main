<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Online Chat', description: 'Customer app online chat')]
#[OA\Get(
    path: '/api/v1/app/online-chat/conversation',
    operationId: 'customerAppOnlineChatConversation',
    description: 'مکالمه چت آنلاین کاربر را همراه با آخرین پیام‌ها برمی‌گرداند. برای pagination پیام‌های قدیمی‌تر before_message_id ارسال شود.',
    security: [['bearerAuth' => []]],
    tags: ['Online Chat'],
    parameters: [
        new OA\Parameter(
            name: 'before_message_id',
            description: 'شناسه قدیمی‌ترین پیام فعلی برای دریافت پیام‌های قبل از آن',
            in: 'query',
            required: false,
            schema: new OA\Schema(type: 'integer', minimum: 1, example: 120),
        ),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Conversation details', content: new OA\JsonContent(ref: '#/components/schemas/CustomerAppOnlineChatConversationResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 403, description: 'Online chat module is not active'),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/online-chat/conversation/summary',
    operationId: 'customerAppOnlineChatSummary',
    description: 'خلاصه مکالمه و شمارنده پیام‌های خوانده‌نشده کاربر را برمی‌گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Online Chat'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Conversation summary',
            content: new OA\JsonContent(
                required: ['success', 'data', 'meta'],
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        required: ['conversation'],
                        properties: [
                            new OA\Property(property: 'conversation', ref: '#/components/schemas/CustomerAppOnlineChatConversation', nullable: true),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object', example: []),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 403, description: 'Online chat module is not active'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/online-chat/messages',
    operationId: 'customerAppOnlineChatSendMessage',
    description: 'ارسال پیام جدید توسط کاربر. body یا حداقل یک attachment الزامی است. حداکثر ۵ عکس با حجم هرکدام ۱۰MB مجاز است.',
    security: [['bearerAuth' => []]],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\MediaType(
            mediaType: 'multipart/form-data',
            schema: new OA\Schema(
                properties: [
                    new OA\Property(property: 'body', type: 'string', nullable: true, maxLength: 5000, example: 'سلام، برای پیگیری رژیم سوال داشتم.'),
                    new OA\Property(
                        property: 'attachments[]',
                        description: 'فایل‌های تصویری jpg, jpeg, png, webp, gif',
                        type: 'array',
                        maxItems: 5,
                        items: new OA\Items(type: 'string', format: 'binary'),
                    ),
                ],
                type: 'object',
            ),
        ),
    ),
    tags: ['Online Chat'],
    responses: [
        new OA\Response(response: 200, description: 'Message sent', content: new OA\JsonContent(ref: '#/components/schemas/CustomerAppOnlineChatConversationResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 403, description: 'Online chat module is not active'),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/online-chat/conversation/seen',
    operationId: 'customerAppOnlineChatMarkSeen',
    description: 'پیام‌های مکالمه کاربر را خوانده‌شده می‌کند.',
    security: [['bearerAuth' => []]],
    tags: ['Online Chat'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Conversation marked as seen',
            content: new OA\JsonContent(
                required: ['success', 'data', 'meta'],
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        required: ['conversation'],
                        properties: [
                            new OA\Property(property: 'conversation', ref: '#/components/schemas/CustomerAppOnlineChatConversation', nullable: true),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object', example: []),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 403, description: 'Online chat module is not active'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/online-chat/attachments/{attachment}',
    operationId: 'customerAppOnlineChatAttachment',
    description: 'دریافت فایل پیوست چت. فقط صاحب مکالمه یا کاربر مجاز پنل به فایل دسترسی دارد.',
    security: [['bearerAuth' => []]],
    tags: ['Online Chat'],
    parameters: [
        new OA\Parameter(
            name: 'attachment',
            in: 'path',
            required: true,
            schema: new OA\Schema(type: 'integer', example: 15),
        ),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Attachment file'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 403, description: 'Forbidden'),
        new OA\Response(response: 404, description: 'Not found'),
    ],
)]
#[OA\Schema(
    schema: 'CustomerAppOnlineChatConversationResponse',
    required: ['success', 'data', 'meta'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
        new OA\Property(
            property: 'data',
            required: ['conversation', 'messages', 'messagesMeta'],
            properties: [
                new OA\Property(property: 'conversation', ref: '#/components/schemas/CustomerAppOnlineChatConversation', nullable: true),
                new OA\Property(
                    property: 'messages',
                    type: 'array',
                    items: new OA\Items(ref: '#/components/schemas/CustomerAppOnlineChatMessage'),
                ),
                new OA\Property(
                    property: 'messagesMeta',
                    required: ['hasOlder', 'oldestMessageId'],
                    properties: [
                        new OA\Property(property: 'hasOlder', type: 'boolean', example: false),
                        new OA\Property(property: 'oldestMessageId', type: 'string', nullable: true, example: '101'),
                    ],
                    type: 'object',
                ),
            ],
            type: 'object',
        ),
        new OA\Property(property: 'meta', type: 'object', example: []),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'CustomerAppOnlineChatConversation',
    required: ['id', 'status', 'customerUnreadCount', 'adminUnreadCount'],
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '9'),
        new OA\Property(property: 'status', type: 'string', enum: ['open', 'closed'], example: 'open'),
        new OA\Property(property: 'lastMessagePreview', type: 'string', nullable: true, example: 'سلام، سوال داشتم.'),
        new OA\Property(property: 'lastMessageSenderRole', type: 'string', nullable: true, example: 'customer'),
        new OA\Property(property: 'lastMessageAt', type: 'string', nullable: true, format: 'date-time'),
        new OA\Property(property: 'customerUnreadCount', type: 'integer', example: 0),
        new OA\Property(property: 'adminUnreadCount', type: 'integer', example: 1),
        new OA\Property(property: 'createdAt', type: 'string', nullable: true, format: 'date-time'),
        new OA\Property(property: 'closedAt', type: 'string', nullable: true, format: 'date-time'),
        new OA\Property(property: 'customer', type: 'object', nullable: true),
        new OA\Property(property: 'assignedTo', type: 'object', nullable: true),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'CustomerAppOnlineChatMessage',
    required: ['id', 'senderType', 'attachmentsCount', 'attachments'],
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '120'),
        new OA\Property(property: 'senderType', type: 'string', enum: ['customer', 'panel_user', 'system'], example: 'customer'),
        new OA\Property(property: 'senderName', type: 'string', nullable: true, example: 'سجاد احمدی'),
        new OA\Property(property: 'senderRole', type: 'string', nullable: true, example: 'customer'),
        new OA\Property(property: 'body', type: 'string', nullable: true, example: 'سلام'),
        new OA\Property(property: 'attachmentsCount', type: 'integer', example: 1),
        new OA\Property(property: 'createdAt', type: 'string', nullable: true, format: 'date-time'),
        new OA\Property(
            property: 'attachments',
            type: 'array',
            items: new OA\Items(ref: '#/components/schemas/CustomerAppOnlineChatAttachment'),
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'CustomerAppOnlineChatAttachment',
    required: ['id', 'url', 'originalName', 'size'],
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '15'),
        new OA\Property(property: 'url', type: 'string', example: '/api/v1/app/online-chat/attachments/15'),
        new OA\Property(property: 'originalName', type: 'string', example: 'photo.jpg'),
        new OA\Property(property: 'mimeType', type: 'string', nullable: true, example: 'image/jpeg'),
        new OA\Property(property: 'size', type: 'integer', example: 245760),
    ],
    type: 'object',
)]
final class CustomerAppOnlineChatApi
{
}
