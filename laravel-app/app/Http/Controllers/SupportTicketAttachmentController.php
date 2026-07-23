<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Support\Models\SupportTicketAttachment;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class SupportTicketAttachmentController extends Controller
{
    public function __invoke(string $attachment): BinaryFileResponse
    {
        $attachmentModel = SupportTicketAttachment::query()->findOrFail($attachment);
        $path = $this->resolvePath($attachmentModel);

        abort_unless($path !== null && is_file($path), 404);

        return response()->file($path, [
            'Content-Type' => $attachmentModel->mime_type ?: mime_content_type($path) ?: 'application/octet-stream',
            'Cache-Control' => 'public, max-age=31536000',
        ]);
    }

    private function resolvePath(SupportTicketAttachment $attachment): ?string
    {
        $relativePath = ltrim($attachment->path, '/');

        $centralPath = base_path('storage/app/public/' . $relativePath);
        if (is_file($centralPath)) {
            return $centralPath;
        }

        $ticket = $attachment->message?->ticket;
        if (! $ticket) {
            return null;
        }

        $suffixBase = (string) config('tenancy.filesystem.suffix_base', 'tenant');
        $tenantPath = base_path(sprintf(
            'storage/%s%s/app/public/%s',
            $suffixBase,
            $ticket->tenant_id,
            $relativePath,
        ));

        return is_file($tenantPath) ? $tenantPath : null;
    }
}
