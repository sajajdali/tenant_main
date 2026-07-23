<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Events\OnlineChatConversationUpdated;
use App\Domain\Tenant\Models\OnlineChatConversation;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\OnlineChatService;
use App\Services\TelegramUserNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;

class OnlineChatAdminController extends Controller
{
    public function index(Request $request, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->authorizePanelActor($actor);
        $service->abortUnlessModuleActive();

        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
        ]);

        $items = $service->listAdminConversations(trim((string) ($validated['search'] ?? '')));

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(fn (OnlineChatConversation $conversation): array => $service->buildConversationPayload($conversation))->values()->all(),
                'stats' => [
                    'total' => $items->count(),
                    'open' => $items->where('status', 'open')->count(),
                    'closed' => $items->where('status', 'closed')->count(),
                    'unread' => $items->where('admin_unread_count', '>', 0)->count(),
                ],
            ],
        ]);
    }

    public function show(Request $request, OnlineChatConversation $conversation, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->authorizePanelActor($actor);
        $service->abortUnlessModuleActive();
        $validated = $request->validate([
            'before_message_id' => ['nullable', 'integer', 'min:1'],
        ]);
        $beforeMessageId = isset($validated['before_message_id']) ? (int) $validated['before_message_id'] : null;

        $conversation = $service->getAdminConversation($conversation);
        $conversation = $service->markSeenByAdmin($conversation);
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

    public function sendMessage(Request $request, OnlineChatConversation $conversation, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->authorizePanelActor($actor);
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

        $conversation = $service->sendMessageFromPanel($conversation, $actor, $body, $attachments);
        $messagesPayload = $service->buildMessagesPayload($conversation);

        event(new OnlineChatConversationUpdated(
            (string) tenant('id'),
            (string) $conversation->customer_user_id,
            $service->buildConversationPayload($conversation),
            'message_sent_by_admin',
        ));

        $customer = $conversation->customer()->first();
        if ($customer) {
            app(TelegramUserNotificationService::class)->adminChatMessage($customer, $body, count($attachments));
        }

        return response()->json([
            'success' => true,
            'message' => __('tenant.online_chat.admin_reply_sent'),
            'data' => [
                'conversation' => $service->buildConversationPayload($conversation),
                'messages' => $messagesPayload['items'],
                'messagesMeta' => $messagesPayload['meta'],
            ],
        ]);
    }

    public function markSeen(Request $request, OnlineChatConversation $conversation, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->authorizePanelActor($actor);
        $service->abortUnlessModuleActive();

        $conversation = $service->markSeenByAdmin($conversation);

        event(new OnlineChatConversationUpdated(
            (string) tenant('id'),
            (string) $conversation->customer_user_id,
            $service->buildConversationPayload($conversation),
            'seen_by_admin',
        ));

        return response()->json([
            'success' => true,
            'data' => [
                'conversation' => $service->buildConversationPayload($conversation),
            ],
        ]);
    }

    public function close(Request $request, OnlineChatConversation $conversation, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->authorizePanelActor($actor);
        $service->abortUnlessModuleActive();

        $conversation = $service->closeConversation($conversation);

        event(new OnlineChatConversationUpdated(
            (string) tenant('id'),
            (string) $conversation->customer_user_id,
            $service->buildConversationPayload($conversation),
            'closed_by_admin',
        ));

        return response()->json([
            'success' => true,
            'message' => __('tenant.online_chat.closed'),
            'data' => [
                'conversation' => $service->buildConversationPayload($conversation),
            ],
        ]);
    }

    public function reopen(Request $request, OnlineChatConversation $conversation, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->authorizePanelActor($actor);
        $service->abortUnlessModuleActive();

        $conversation = $service->reopenConversation($conversation);

        event(new OnlineChatConversationUpdated(
            (string) tenant('id'),
            (string) $conversation->customer_user_id,
            $service->buildConversationPayload($conversation),
            'reopened_by_admin',
        ));

        return response()->json([
            'success' => true,
            'message' => __('tenant.online_chat.reopened'),
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
