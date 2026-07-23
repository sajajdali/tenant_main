<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Support\Models\SupportTicket;
use App\Domain\Support\Models\SupportTicketAttachment;
use App\Domain\Support\Models\SupportTicketMessage;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantUser;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class SupportTicketService
{
    public function createByTenantUser(Tenant $tenant, TenantUser $actor, string $subject, string $body, array $files = []): SupportTicket
    {
        return DB::connection('central')->transaction(function () use ($tenant, $actor, $subject, $body, $files) {
            $ticket = SupportTicket::query()->create([
                'tenant_id' => (string) $tenant->id,
                'tenant_name' => $tenant->name,
                'tenant_domain' => $tenant->domains()->value('domain'),
                'requester_tenant_user_id' => $actor->id,
                'requester_name' => $actor->name,
                'requester_mobile' => $actor->mobile,
                'requester_role' => $actor->role,
                'subject' => $subject,
                'status' => 'waiting_admin',
                'messages_count' => 1,
                'admin_unread_count' => 1,
                'requester_unread_count' => 0,
                'last_message_at' => now(),
                'requester_last_seen_at' => now(),
            ]);

            $message = $ticket->messages()->create([
                'sender_type' => 'tenant_user',
                'sender_tenant_user_id' => $actor->id,
                'sender_name' => $actor->name,
                'sender_role' => $actor->role,
                'body' => $body,
            ]);

            $this->storeAttachments($message, $files);

            return $ticket->load('messages.attachments');
        });
    }

    public function replyByTenantUser(SupportTicket $ticket, TenantUser $actor, string $body, array $files = []): SupportTicket
    {
        return DB::connection('central')->transaction(function () use ($ticket, $actor, $body, $files) {
            $message = $ticket->messages()->create([
                'sender_type' => 'tenant_user',
                'sender_tenant_user_id' => $actor->id,
                'sender_name' => $actor->name,
                'sender_role' => $actor->role,
                'body' => $body,
            ]);

            $this->storeAttachments($message, $files);

            $ticket->update([
                'status' => 'waiting_admin',
                'messages_count' => $ticket->messages_count + 1,
                'admin_unread_count' => $ticket->admin_unread_count + 1,
                'requester_unread_count' => 0,
                'last_message_at' => now(),
                'requester_last_seen_at' => now(),
                'closed_at' => null,
                'closed_by_central_user_id' => null,
                'closed_by_requester_tenant_user_id' => null,
            ]);

            return $ticket->fresh(['messages.attachments']);
        });
    }

    public function markSeenByTenantUser(SupportTicket $ticket): void
    {
        $ticket->update([
            'requester_unread_count' => 0,
            'requester_last_seen_at' => now(),
        ]);
    }

    public function closeByTenantUser(SupportTicket $ticket, TenantUser $actor): SupportTicket
    {
        $ticket->update([
            'status' => 'closed',
            'closed_at' => now(),
            'closed_by_requester_tenant_user_id' => $actor->id,
        ]);

        return $ticket->fresh(['messages.attachments']);
    }

    public function replyByCentralAdmin(SupportTicket $ticket, User $admin, string $body, array $files = []): SupportTicket
    {
        return DB::connection('central')->transaction(function () use ($ticket, $admin, $body, $files) {
            $message = $ticket->messages()->create([
                'sender_type' => 'central_admin',
                'sender_central_user_id' => $admin->id,
                'sender_name' => $admin->name,
                'sender_role' => $admin->role,
                'body' => $body,
            ]);

            $this->storeAttachments($message, $files);

            $ticket->update([
                'status' => 'waiting_requester',
                'messages_count' => $ticket->messages_count + 1,
                'requester_unread_count' => $ticket->requester_unread_count + 1,
                'admin_unread_count' => 0,
                'last_message_at' => now(),
                'admin_last_seen_at' => now(),
                'closed_at' => null,
                'closed_by_central_user_id' => null,
                'closed_by_requester_tenant_user_id' => null,
            ]);

            return $ticket->fresh(['messages.attachments']);
        });
    }

    public function markSeenByAdmin(SupportTicket $ticket): void
    {
        $ticket->update([
            'admin_unread_count' => 0,
            'admin_last_seen_at' => now(),
        ]);
    }

    public function closeByCentralAdmin(SupportTicket $ticket, User $admin): SupportTicket
    {
        $ticket->update([
            'status' => 'closed',
            'closed_at' => now(),
            'closed_by_central_user_id' => $admin->id,
        ]);

        return $ticket->fresh(['messages.attachments']);
    }

    private function storeAttachments(SupportTicketMessage $message, array $files): void
    {
        /** @var UploadedFile $file */
        foreach ($files as $file) {
            $path = $file->store('support-tickets', 'support_public');

            $message->attachments()->create([
                'disk' => 'support_public',
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'size' => $file->getSize(),
            ]);
        }
    }
}
