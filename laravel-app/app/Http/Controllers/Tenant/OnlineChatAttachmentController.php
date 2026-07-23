<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\OnlineChatAttachment;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\OnlineChatService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class OnlineChatAttachmentController extends Controller
{
    public function __invoke(Request $request, OnlineChatAttachment $attachment, OnlineChatService $service): BinaryFileResponse
    {
        /** @var TenantUser|null $actor */
        $actor = $request->user('tenant_web') ?? $request->user();

        abort_if(! $actor, 401);

        $conversation = $attachment->message?->conversation;
        abort_if(! $conversation, 404);

        $canAccess = (int) $conversation->customer_user_id === (int) $actor->id;

        if (! $canAccess) {
            try {
                $service->authorizePanelActor($actor);
                $canAccess = true;
            } catch (\Symfony\Component\HttpKernel\Exception\HttpException) {
                $canAccess = false;
            }
        }

        abort_unless($canAccess, 403);

        $disk = $attachment->disk ?: 'public';
        $path = Storage::disk($disk)->path($attachment->path);

        abort_unless(is_file($path), 404);

        return response()->file($path, [
            'Content-Type' => $attachment->mime_type ?: mime_content_type($path) ?: 'application/octet-stream',
            'Cache-Control' => 'private, max-age=31536000',
        ]);
    }
}
