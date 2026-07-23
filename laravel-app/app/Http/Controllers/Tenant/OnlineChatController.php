<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Events\OnlineChatConversationUpdated;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\AdminMessagingBotNotificationService;
use App\Services\OnlineChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class OnlineChatController extends Controller
{
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
            return response()->json([
                'success' => true,
                'data' => [
                    'conversation' => null,
                    'messages' => [],
                    'messagesMeta' => [
                        'hasOlder' => false,
                        'oldestMessageId' => null,
                    ],
                ],
            ]);
        }

        $service->markSeenByCustomer($conversation);
        $conversation = $service->getConversationForCustomer($actor);

        $messagesPayload = $service->buildMessagesPayload($conversation, $beforeMessageId);

        return response()->json([
            'success' => true,
            'data' => [
                'conversation' => $service->buildConversationPayload($conversation),
                'messages' => $messagesPayload['items'],
                'messagesMeta' => $messagesPayload['meta'],
            ],
        ]);
    }

    public function summary(Request $request, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->abortUnlessModuleActive();

        $conversation = $service->getConversationForCustomer($actor);

        return response()->json([
            'success' => true,
            'data' => [
                'conversation' => $conversation ? $service->buildConversationPayload($conversation) : null,
            ],
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
                'message' => __('tenant.online_chat.message_or_attachment_required'),
            ], 422);
        }

        $conversation = $service->sendMessageFromCustomer($actor, $body, $attachments);
        $messagesPayload = $service->buildMessagesPayload($conversation);

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

        return response()->json([
            'success' => true,
            'message' => __('tenant.online_chat.message_sent'),
            'data' => [
                'conversation' => $service->buildConversationPayload($conversation),
                'messages' => $messagesPayload['items'],
                'messagesMeta' => $messagesPayload['meta'],
            ],
        ]);
    }

    public function markSeen(Request $request, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->abortUnlessModuleActive();

        $conversation = $service->getConversationForCustomer($actor);

        if (! $conversation) {
            return response()->json([
                'success' => true,
                'data' => [
                    'conversation' => null,
                ],
            ]);
        }

        $conversation = $service->markSeenByCustomer($conversation);

        event(new OnlineChatConversationUpdated(
            (string) tenant('id'),
            (string) $actor->id,
            $service->buildConversationPayload($conversation),
            'seen_by_customer',
        ));

        return response()->json([
            'success' => true,
            'data' => [
                'conversation' => $service->buildConversationPayload($conversation),
            ],
        ]);
    }

    private function actor(Request $request): TenantUser
    {
        /** @var TenantUser|null $actor */
        $actor = $request->user('tenant_web');

        abort_if(! $actor, 401);

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
                'attachments.max' => __('tenant.online_chat.validation.attachments_max'),
                'attachments.*.max' => __('tenant.online_chat.validation.attachment_size'),
                'attachments.*.mimes' => __('tenant.online_chat.validation.attachment_type'),
            ],
        )->validate();

        return $files;
    }
}
