<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Events\SupportTicketUpdated;
use App\Domain\Support\Models\SupportTicket;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\SupportTicketService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;

class SupportTicketController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $this->authorizeActor($request);

        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);

        $query = SupportTicket::query()
            ->where('tenant_id', (string) tenant('id'))
            ->where('requester_tenant_user_id', $actor->id)
            ->orderByDesc('last_message_at')
            ->orderByDesc('created_at');

        $page = $query->paginate($perPage);

        $statsBase = SupportTicket::query()
            ->where('tenant_id', (string) tenant('id'))
            ->where('requester_tenant_user_id', $actor->id);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => collect($page->items())->map(fn (SupportTicket $ticket) => $this->transformTicket($ticket))->values(),
                'currentPage' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
                'stats' => [
                    'total' => (clone $statsBase)->count(),
                    'open' => (clone $statsBase)->where('status', 'waiting_admin')->count(),
                    'answered' => (clone $statsBase)->where('status', 'waiting_requester')->count(),
                    'closed' => (clone $statsBase)->where('status', 'closed')->count(),
                    'unread' => (clone $statsBase)->where('requester_unread_count', '>', 0)->count(),
                ],
            ],
        ]);
    }

    public function store(Request $request, SupportTicketService $ticketService): JsonResponse
    {
        $actor = $this->authorizeActor($request);
        $tenant = $this->tenant();

        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $attachments = $this->validatedAttachments($request);

        $ticket = $ticketService->createByTenantUser(
            $tenant,
            $actor,
            $validated['subject'],
            $validated['body'],
            $attachments,
        );
        event(new SupportTicketUpdated((string) tenant('id'), $this->transformTicket($ticket), 'created'));

        return response()->json([
            'success' => true,
            'message' => __('tenant.support_tickets.created'),
            'data' => $this->transformTicket($ticket),
        ]);
    }

    public function show(Request $request, SupportTicket $ticket, SupportTicketService $ticketService): JsonResponse
    {
        $actor = $this->authorizeActor($request);
        $this->authorizeTicket($ticket, $actor);

        $ticket->load('messages.attachments');
        $ticketService->markSeenByTenantUser($ticket);
        $ticket->refresh()->load('messages.attachments');

        return response()->json([
            'success' => true,
            'data' => [
                'ticket' => $this->transformTicket($ticket),
                'messages' => $ticket->messages
                    ->sortBy('created_at')
                    ->values()
                    ->map(fn ($message) => $this->transformMessage($message))
                    ->all(),
            ],
        ]);
    }

    public function reply(Request $request, SupportTicket $ticket, SupportTicketService $ticketService): JsonResponse
    {
        $actor = $this->authorizeActor($request);
        $this->authorizeTicket($ticket, $actor);

        abort_if($ticket->status === 'closed', 422, __('tenant.support_tickets.closed_for_reply'));

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $attachments = $this->validatedAttachments($request);

        $ticket = $ticketService->replyByTenantUser(
            $ticket,
            $actor,
            $validated['body'],
            $attachments,
        );
        event(new SupportTicketUpdated((string) tenant('id'), $this->transformTicket($ticket), 'replied_by_requester'));

        return response()->json([
            'success' => true,
            'message' => __('tenant.support_tickets.reply_saved'),
            'data' => [
                'ticket' => $this->transformTicket($ticket),
                'messages' => $ticket->messages
                    ->sortBy('created_at')
                    ->values()
                    ->map(fn ($message) => $this->transformMessage($message))
                    ->all(),
            ],
        ]);
    }

    public function close(Request $request, SupportTicket $ticket, SupportTicketService $ticketService): JsonResponse
    {
        $actor = $this->authorizeActor($request);
        $this->authorizeTicket($ticket, $actor);

        if ($ticket->status === 'closed') {
            return response()->json([
                'success' => false,
                'message' => __('tenant.support_tickets.already_closed'),
                'data' => $this->transformTicket($ticket),
            ], 422);
        }

        $ticket = $ticketService->closeByTenantUser($ticket, $actor);
        event(new SupportTicketUpdated((string) tenant('id'), $this->transformTicket($ticket), 'closed_by_requester'));

        return response()->json([
            'success' => true,
            'message' => __('tenant.support_tickets.closed'),
            'data' => $this->transformTicket($ticket),
        ]);
    }

    public function markSeen(Request $request, SupportTicket $ticket, SupportTicketService $ticketService): JsonResponse
    {
        $actor = $this->authorizeActor($request);
        $this->authorizeTicket($ticket, $actor);

        $ticketService->markSeenByTenantUser($ticket);
        $ticket->refresh();
        event(new SupportTicketUpdated((string) tenant('id'), $this->transformTicket($ticket), 'seen_by_requester'));

        return response()->json([
            'success' => true,
            'data' => $this->transformTicket($ticket),
        ]);
    }

    private function authorizeActor(Request $request): TenantUser
    {
        /** @var TenantUser|null $actor */
        $actor = $request->user('tenant_web');

        abort_unless(in_array($actor?->role, ['admin', 'barber'], true), 403, __('tenant.support_tickets.actor_not_allowed'));

        if ($actor->role === 'barber') {
            $barber = \App\Domain\Booking\Models\Barber::query()->where('user_id', $actor->id)->first();
            abort_if(! $barber || ! $barber->can_access_panel, 403, __('authorization.professional_panel_blocked'));
        }

        return $actor;
    }

    private function authorizeTicket(SupportTicket $ticket, TenantUser $actor): void
    {
        abort_if($ticket->tenant_id !== (string) tenant('id'), 404);
        abort_if((int) $ticket->requester_tenant_user_id !== (int) $actor->id, 403, __('tenant.support_tickets.own_tickets_only'));
    }

    private function tenant(): Tenant
    {
        /** @var Tenant $tenant */
        $tenant = tenant();

        return $tenant;
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

    private function transformMessage($message): array
    {
        return [
            'id' => (string) $message->id,
            'senderType' => $message->sender_type,
            'senderName' => $message->sender_name,
            'senderRole' => $message->sender_role,
            'body' => $message->body,
            'createdAt' => $message->created_at?->toISOString(),
            'attachments' => $message->attachments->map(fn ($attachment) => [
                'id' => (string) $attachment->id,
                'url' => $attachment->url,
                'originalName' => $attachment->original_name,
                'mimeType' => $attachment->mime_type,
                'size' => (int) $attachment->size,
            ])->values()->all(),
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
            [
                'attachments.max' => __('tenant.support_tickets.validation.attachments_max'),
                'attachments.*.image' => __('tenant.support_tickets.validation.attachment_image'),
                'attachments.*.max' => __('tenant.support_tickets.validation.attachment_size'),
            ],
        )->validate();

        return $files;
    }
}
