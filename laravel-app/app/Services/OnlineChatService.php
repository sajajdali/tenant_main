<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Barber;
use App\Domain\Tenant\Models\FeatureModule;
use App\Domain\Tenant\Models\OnlineChatAttachment;
use App\Domain\Tenant\Models\OnlineChatConversation;
use App\Domain\Tenant\Models\OnlineChatMessage;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantFeatureModule;
use App\Domain\Tenant\Models\TenantUser;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class OnlineChatService
{
    public const MODULE_SLUG = 'online-chat';
    public const MESSAGES_PAGE_SIZE = 20;

    public function isModuleActive(?Tenant $tenant = null): bool
    {
        $tenant ??= tenant();

        if (! $tenant) {
            return false;
        }

        $moduleId = FeatureModule::query()
            ->where('slug', self::MODULE_SLUG)
            ->value('id');

        if (! $moduleId) {
            return false;
        }

        return TenantFeatureModule::query()
            ->where('tenant_id', $tenant->id)
            ->where('feature_module_id', $moduleId)
            ->where('status', 'active')
            ->where(function ($query): void {
                $query->whereNull('expires_at')
                    ->orWhereDate('expires_at', '>=', now()->toDateString());
            })
            ->exists();
    }

    public function abortUnlessModuleActive(?Tenant $tenant = null): void
    {
        if (! $this->isModuleActive($tenant)) {
            throw new HttpResponseException(response()->json([
                'success' => false,
                'message' => 'ماژول چت آنلاین برای این سامانه فعال نیست.',
            ], 403));
        }
    }

    public function authorizePanelActor(TenantUser $actor): void
    {
        if ($actor->role === 'admin') {
            return;
        }

        if ($actor->role !== 'barber') {
            abort(403, 'شما به مدیریت چت آنلاین دسترسی ندارید.');
        }

        $barber = Barber::query()
            ->where('user_id', $actor->id)
            ->first();

        abort_if(! $barber || ! $barber->can_access_panel, 403, 'دسترسی پنل این کاربر مسدود شده است.');
    }

    public function getConversationForCustomer(TenantUser $customer): ?OnlineChatConversation
    {
        return OnlineChatConversation::query()
            ->with([
                'customer:id,name,mobile,role,is_vip',
                'assignedTo:id,name,mobile,role',
            ])
            ->where('customer_user_id', $customer->id)
            ->first();
    }

    public function listAdminConversations(string $search = ''): \Illuminate\Support\Collection
    {
        return OnlineChatConversation::query()
            ->with([
                'customer:id,name,mobile,role,is_vip',
                'assignedTo:id,name,mobile,role',
            ])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($conversationQuery) use ($search): void {
                    $conversationQuery
                        ->where('last_message_preview', 'like', "%{$search}%")
                        ->orWhereHas('customer', function ($customerQuery) use ($search): void {
                            $customerQuery
                                ->where('name', 'like', "%{$search}%")
                                ->orWhere('mobile', 'like', "%{$search}%");
                        });
                });
            })
            ->orderByDesc('last_message_at')
            ->orderByDesc('updated_at')
            ->get();
    }

    public function getAdminConversation(OnlineChatConversation $conversation): OnlineChatConversation
    {
        return $conversation->load([
            'customer:id,name,mobile,role,is_vip',
            'assignedTo:id,name,mobile,role',
        ]);
    }

    public function markSeenByCustomer(OnlineChatConversation $conversation): OnlineChatConversation
    {
        if ((int) $conversation->customer_unread_count === 0) {
            return $conversation->fresh(['customer:id,name,mobile,role,is_vip', 'assignedTo:id,name,mobile,role']);
        }

        $conversation->forceFill([
            'customer_unread_count' => 0,
            'customer_last_seen_at' => now(),
        ])->save();

        return $conversation->fresh(['customer:id,name,mobile,role,is_vip', 'assignedTo:id,name,mobile,role']);
    }

    public function markSeenByAdmin(OnlineChatConversation $conversation): OnlineChatConversation
    {
        if ((int) $conversation->admin_unread_count === 0) {
            return $conversation->fresh(['customer:id,name,mobile,role,is_vip', 'assignedTo:id,name,mobile,role']);
        }

        $conversation->forceFill([
            'admin_unread_count' => 0,
            'admin_last_seen_at' => now(),
        ])->save();

        return $conversation->fresh(['customer:id,name,mobile,role,is_vip', 'assignedTo:id,name,mobile,role']);
    }

    public function closeConversation(OnlineChatConversation $conversation): OnlineChatConversation
    {
        $conversation->forceFill([
            'status' => 'closed',
            'closed_at' => now(),
        ])->save();

        return $conversation->fresh(['customer:id,name,mobile,role,is_vip', 'assignedTo:id,name,mobile,role']);
    }

    public function reopenConversation(OnlineChatConversation $conversation): OnlineChatConversation
    {
        $conversation->forceFill([
            'status' => 'open',
            'closed_at' => null,
        ])->save();

        return $conversation->fresh(['customer:id,name,mobile,role,is_vip', 'assignedTo:id,name,mobile,role']);
    }

    public function sendMessageFromCustomer(TenantUser $customer, string $body, array $files = []): OnlineChatConversation
    {
        return DB::transaction(function () use ($customer, $body, $files): OnlineChatConversation {
            $conversation = OnlineChatConversation::query()->firstOrCreate(
                ['customer_user_id' => $customer->id],
                [
                    'status' => 'open',
                    'customer_last_seen_at' => now(),
                ],
            );

            $message = $conversation->messages()->create([
                'sender_user_id' => $customer->id,
                'sender_type' => 'customer',
                'sender_name' => $customer->name ?: $customer->mobile,
                'sender_role' => $customer->role,
                'body' => $body !== '' ? $body : null,
            ]);

            $attachmentsCount = $this->storeAttachments($message, $files);

            $message->forceFill([
                'attachments_count' => $attachmentsCount,
            ])->save();

            $conversation->forceFill([
                'status' => 'open',
                'assigned_to_user_id' => $conversation->assigned_to_user_id,
                'last_message_preview' => $this->buildPreview($body, $attachmentsCount),
                'last_message_sender_role' => $customer->role,
                'last_message_at' => $message->created_at,
                'admin_unread_count' => $conversation->admin_unread_count + 1,
                'customer_unread_count' => 0,
                'customer_last_seen_at' => now(),
                'closed_at' => null,
            ])->save();

            return $conversation->fresh(['customer:id,name,mobile,role,is_vip', 'assignedTo:id,name,mobile,role']);
        });
    }

    public function sendMessageFromPanel(OnlineChatConversation $conversation, TenantUser $actor, string $body, array $files = []): OnlineChatConversation
    {
        return DB::transaction(function () use ($conversation, $actor, $body, $files): OnlineChatConversation {
            $message = $conversation->messages()->create([
                'sender_user_id' => $actor->id,
                'sender_type' => 'panel_user',
                'sender_name' => $actor->name ?: $actor->mobile,
                'sender_role' => $actor->role,
                'body' => $body !== '' ? $body : null,
            ]);

            $attachmentsCount = $this->storeAttachments($message, $files);

            $message->forceFill([
                'attachments_count' => $attachmentsCount,
            ])->save();

            $conversation->forceFill([
                'status' => 'open',
                'assigned_to_user_id' => $actor->id,
                'last_message_preview' => $this->buildPreview($body, $attachmentsCount),
                'last_message_sender_role' => $actor->role,
                'last_message_at' => $message->created_at,
                'customer_unread_count' => $conversation->customer_unread_count + 1,
                'admin_unread_count' => 0,
                'admin_last_seen_at' => now(),
                'closed_at' => null,
            ])->save();

            return $conversation->fresh(['customer:id,name,mobile,role,is_vip', 'assignedTo:id,name,mobile,role']);
        });
    }

    public function buildConversationPayload(OnlineChatConversation $conversation): array
    {
        $conversation->loadMissing([
            'customer:id,name,mobile,role,is_vip',
            'assignedTo:id,name,mobile,role',
        ]);

        return [
            'id' => (string) $conversation->id,
            'status' => $conversation->status,
            'lastMessagePreview' => $conversation->last_message_preview,
            'lastMessageSenderRole' => $conversation->last_message_sender_role,
            'lastMessageAt' => $conversation->last_message_at?->toISOString(),
            'customerUnreadCount' => (int) $conversation->customer_unread_count,
            'adminUnreadCount' => (int) $conversation->admin_unread_count,
            'createdAt' => $conversation->created_at?->toISOString(),
            'closedAt' => $conversation->closed_at?->toISOString(),
            'customer' => $conversation->customer ? [
                'id' => (string) $conversation->customer->id,
                'name' => $conversation->customer->name,
                'mobile' => $conversation->customer->mobile,
                'role' => $conversation->customer->role,
                'isVip' => (bool) $conversation->customer->is_vip,
            ] : null,
            'assignedTo' => $conversation->assignedTo ? [
                'id' => (string) $conversation->assignedTo->id,
                'name' => $conversation->assignedTo->name,
                'mobile' => $conversation->assignedTo->mobile,
                'role' => $conversation->assignedTo->role,
            ] : null,
        ];
    }

    public function buildMessagesPayload(
        OnlineChatConversation $conversation,
        ?int $beforeMessageId = null,
        int $limit = self::MESSAGES_PAGE_SIZE,
        string $attachmentRouteName = 'tenant.online-chat.attachments.show',
    ): array
    {
        $messages = $conversation->messages()
            ->with('attachments')
            ->when($beforeMessageId, fn ($query) => $query->where('id', '<', $beforeMessageId))
            ->orderByDesc('id')
            ->limit(max(1, $limit) + 1)
            ->get();

        $hasOlder = $messages->count() > $limit;
        $pageItems = ($hasOlder ? $messages->take($limit) : $messages)
            ->sortBy('id')
            ->values();

        return [
            'items' => $pageItems
                ->map(fn (OnlineChatMessage $message): array => $this->transformMessage($message, $attachmentRouteName))
                ->all(),
            'meta' => [
                'hasOlder' => $hasOlder,
                'oldestMessageId' => $pageItems->first()?->id ? (string) $pageItems->first()->id : null,
            ],
        ];
    }

    private function transformMessage(OnlineChatMessage $message, string $attachmentRouteName): array
    {
        return [
            'id' => (string) $message->id,
            'senderType' => $message->sender_type,
            'senderName' => $message->sender_name,
            'senderRole' => $message->sender_role,
            'body' => $message->body,
            'attachmentsCount' => (int) $message->attachments_count,
            'createdAt' => $message->created_at?->toISOString(),
            'attachments' => $message->attachments->map(fn (OnlineChatAttachment $attachment): array => [
                'id' => (string) $attachment->id,
                'url' => route($attachmentRouteName, ['attachment' => $attachment->id], false),
                'originalName' => $attachment->original_name,
                'mimeType' => $attachment->mime_type,
                'size' => (int) $attachment->size,
            ])->values()->all(),
        ];
    }

    private function buildPreview(string $body, int $attachmentsCount): string
    {
        $body = trim($body);

        if ($body !== '') {
            return mb_substr($body, 0, 120);
        }

        if ($attachmentsCount > 1) {
            return sprintf('%d فایل پیوست شد', $attachmentsCount);
        }

        if ($attachmentsCount === 1) {
            return 'یک فایل پیوست شد';
        }

        return 'پیام جدید';
    }

    private function storeAttachments(OnlineChatMessage $message, array $files): int
    {
        $stored = 0;

        /** @var UploadedFile $file */
        foreach ($files as $file) {
            $path = $file->store('online-chat', 'public');
            app(TenantStorageService::class)->recordStoredPath('public', $path, (int) $file->getSize());

            $message->attachments()->create([
                'disk' => 'public',
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'size' => $file->getSize(),
            ]);

            $stored++;
        }

        return $stored;
    }
}
