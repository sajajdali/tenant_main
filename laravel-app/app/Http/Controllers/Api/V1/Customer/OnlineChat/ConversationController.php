<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Customer\OnlineChat;

use App\Domain\Tenant\Models\TenantUser;
use App\Events\OnlineChatConversationUpdated;
use App\Http\Controllers\Controller;
use App\Services\AdminMessagingBotNotificationService;
use App\Services\OnlineChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class ConversationController extends Controller
{
    private const ATTACHMENT_ROUTE = 'tenant.api.app.online-chat.attachments.show';

    public function show(Request $request, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->abortUnlessModuleActive();

        $validated = $request->validate([
            'before_message_id' => ['nullable', 'integer', 'min:1'],
        ]);
        $beforeMessageId = isset($validated['before_message_id']) ? (int) $validated['before_message_id'] : null;

        $conversation = $service->getConversationForCustomer($actor);

        if (! $conversation) {
            return $this->ok([
                'conversation' => null,
                'messages' => [],
                'messagesMeta' => [
                    'hasOlder' => false,
                    'oldestMessageId' => null,
                ],
            ]);
        }

        $service->markSeenByCustomer($conversation);
        $conversation = $service->getConversationForCustomer($actor);
        $messagesPayload = $service->buildMessagesPayload($conversation, $beforeMessageId, attachmentRouteName: self::ATTACHMENT_ROUTE);

        return $this->ok([
            'conversation' => $service->buildConversationPayload($conversation),
            'messages' => $messagesPayload['items'],
            'messagesMeta' => $messagesPayload['meta'],
        ]);
    }

    public function summary(Request $request, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->abortUnlessModuleActive();

        $conversation = $service->getConversationForCustomer($actor);

        return $this->ok([
            'conversation' => $conversation ? $service->buildConversationPayload($conversation) : null,
        ]);
    }

    public function sendMessage(Request $request, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->abortUnlessModuleActive();

        $validated = $request->validate([
            'body' => ['nullable', 'string', 'max:5000'],
        ]);

        $attachments = $this->validatedAttachments($request);
        $body = trim((string) ($validated['body'] ?? ''));

        if ($body === '' && $attachments === []) {
            return response()->json([
                'success' => false,
                'message' => 'متن پیام یا فایل پیوست را وارد کنید.',
                'errors' => [],
            ], 422);
        }

        $conversation = $service->sendMessageFromCustomer($actor, $body, $attachments);
        $messagesPayload = $service->buildMessagesPayload($conversation, attachmentRouteName: self::ATTACHMENT_ROUTE);

        event(new OnlineChatConversationUpdated(
            (string) tenant('id'),
            (string) $actor->id,
            $service->buildConversationPayload($conversation),
            'message_sent_by_customer',
        ));

        try {
            app(AdminMessagingBotNotificationService::class)->customerChatMessage($conversation, $actor, $body, count($attachments));
        } catch (\Throwable $exception) {
            Log::warning('Sending admin messaging bot chat notification failed.', [
                'conversation_id' => $conversation->id,
                'tenant_id' => tenant('id'),
                'tenant_user_id' => $actor->id,
                'error' => $exception->getMessage(),
            ]);
        }

        return $this->ok([
            'conversation' => $service->buildConversationPayload($conversation),
            'messages' => $messagesPayload['items'],
            'messagesMeta' => $messagesPayload['meta'],
        ], 'پیام شما ارسال شد.');
    }

    public function markSeen(Request $request, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->abortUnlessModuleActive();

        $conversation = $service->getConversationForCustomer($actor);

        if (! $conversation) {
            return $this->ok([
                'conversation' => null,
            ]);
        }

        $conversation = $service->markSeenByCustomer($conversation);

        event(new OnlineChatConversationUpdated(
            (string) tenant('id'),
            (string) $actor->id,
            $service->buildConversationPayload($conversation),
            'seen_by_customer',
        ));

        return $this->ok([
            'conversation' => $service->buildConversationPayload($conversation),
        ]);
    }

    private function actor(Request $request): TenantUser
    {
        /** @var TenantUser|null $actor */
        $actor = $request->user();

        abort_unless($actor, 401);

        return $actor;
    }

    /**
     * @return array<int, UploadedFile>
     */
    private function validatedAttachments(Request $request): array
    {
        $files = $request->file('attachments', []);

        if ($files instanceof UploadedFile) {
            $files = [$files];
        }

        $files = array_values(array_filter(is_array($files) ? $files : []));

        Validator::make(
            ['attachments' => $files],
            [
                'attachments' => ['nullable', 'array', 'max:5'],
                'attachments.*' => ['file', 'max:10240', 'mimes:jpg,jpeg,png,webp,gif'],
            ],
            [
                'attachments.max' => 'حداکثر ۵ عکس می‌توانید ارسال کنید.',
                'attachments.*.max' => 'حداکثر حجم هر عکس ۱۰ مگابایت است.',
                'attachments.*.mimes' => 'فقط فرمت‌های تصویری jpg, jpeg, png, webp و gif مجاز هستند.',
            ],
        )->validate();

        return $files;
    }

    private function ok(array $data, ?string $message = null): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => [],
        ]);
    }
}
