<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Events\SupportTicketUpdated;
use App\Domain\Support\Models\SupportTicket;
use App\Domain\Tenant\Models\Tenant;
use App\Http\Controllers\Controller;
use App\Services\SupportTicketService;
use App\Services\TenantAdminNotificationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Illuminate\View\View;

class SupportTicketController extends Controller
{
    public function index(Request $request): View
    {
        $status = $request->string('status')->toString();

        $tickets = SupportTicket::query()
            ->when($status !== '', fn ($query) => $query->where('status', $status))
            ->orderByRaw('CASE WHEN admin_unread_count > 0 THEN 0 ELSE 1 END')
            ->orderByDesc('last_message_at')
            ->orderByDesc('created_at')
            ->paginate(12)
            ->withQueryString();

        return view('admin.support-tickets.index', [
            'tickets' => $tickets,
            'status' => $status,
            'stats' => [
                'total' => SupportTicket::query()->count(),
                'waiting_admin' => SupportTicket::query()->where('status', 'waiting_admin')->count(),
                'waiting_requester' => SupportTicket::query()->where('status', 'waiting_requester')->count(),
                'closed' => SupportTicket::query()->where('status', 'closed')->count(),
                'unread' => SupportTicket::query()->where('admin_unread_count', '>', 0)->count(),
            ],
        ]);
    }

    public function show(SupportTicket $ticket, SupportTicketService $ticketService): View
    {
        $ticketService->markSeenByAdmin($ticket);
        $ticket->refresh()->load('messages.attachments');

        return view('admin.support-tickets.show', [
            'ticket' => $ticket,
            'messages' => $ticket->messages->sortBy('created_at')->values(),
        ]);
    }

    public function reply(Request $request, SupportTicket $ticket, SupportTicketService $ticketService, TenantAdminNotificationService $notifications): RedirectResponse
    {
        abort_if($ticket->status === 'closed', 422, 'این تیکت بسته شده و قابل پاسخ نیست.');

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $attachments = $this->validatedAttachments($request);

        $ticketService->replyByCentralAdmin(
            $ticket,
            $request->user(),
            $validated['body'],
            $attachments,
        );
        $ticket->refresh();
        event(new SupportTicketUpdated($ticket->tenant_id, $this->transformTicket($ticket), 'replied_by_admin'));

        $tenant = Tenant::query()->find($ticket->tenant_id);

        if ($tenant) {
            $notifications->notify($tenant, 'support_ticket_reply', [
                'ticket_subject' => $ticket->subject,
                'sender_central_user_id' => $request->user()?->id,
                'sender_name' => $request->user()?->name ?: 'پشتیبانی سامانه',
            ]);
        }

        return redirect()
            ->route('admin.support-tickets.show', $ticket)
            ->with('success', 'پاسخ تیکت ثبت شد.');
    }

    public function close(Request $request, SupportTicket $ticket, SupportTicketService $ticketService): RedirectResponse
    {
        if ($ticket->status !== 'closed') {
            $ticketService->closeByCentralAdmin($ticket, $request->user());
            $ticket->refresh();
            event(new SupportTicketUpdated($ticket->tenant_id, $this->transformTicket($ticket), 'closed_by_admin'));
        }

        return redirect()
            ->route('admin.support-tickets.show', $ticket)
            ->with('success', 'تیکت بسته شد.');
    }

    private function transformTicket(SupportTicket $ticket): array
    {
        return [
            'id' => (string) $ticket->id,
            'subject' => $ticket->subject,
            'status' => $ticket->status,
            'messagesCount' => (int) $ticket->messages_count,
            'requesterUnreadCount' => (int) $ticket->requester_unread_count,
            'adminUnreadCount' => (int) $ticket->admin_unread_count,
            'lastMessageAt' => $ticket->last_message_at?->toISOString(),
            'createdAt' => $ticket->created_at?->toISOString(),
            'closedAt' => $ticket->closed_at?->toISOString(),
        ];
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
                'attachments.*' => ['file', 'image', 'max:5120'],
            ],
        )->validate();

        return $files;
    }
}
