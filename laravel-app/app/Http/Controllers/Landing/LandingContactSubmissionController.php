<?php

declare(strict_types=1);

namespace App\Http\Controllers\Landing;

use App\Domain\Landing\Models\LandingContactSubmission;
use App\Domain\Landing\Models\LandingSiteDomain;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LandingContactSubmissionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $domain = LandingSiteDomain::query()
            ->with('landingSite.pages')
            ->where('domain', $request->getHost())
            ->where('status', 'active')
            ->first();

        abort_unless($domain !== null && $domain->landingSite !== null, 404);

        $validated = $request->validate([
            'fullName' => ['required', 'string', 'max:255'],
            'mobile' => ['required', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:255'],
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $contactPage = $domain->landingSite->pages->firstWhere('page_key', 'contact');

        $submission = LandingContactSubmission::query()->create([
            'landing_site_id' => $domain->landingSite->id,
            'landing_page_id' => $contactPage?->id,
            'full_name' => trim((string) $validated['fullName']),
            'mobile' => trim((string) $validated['mobile']),
            'email' => filled($validated['email'] ?? null) ? trim((string) $validated['email']) : null,
            'message' => trim((string) $validated['message']),
            'status' => 'new',
            'submitted_at' => now(),
            'meta_json' => [
                'ip' => $request->ip(),
                'userAgent' => (string) $request->userAgent(),
                'referer' => (string) $request->headers->get('referer', ''),
                'host' => $request->getHost(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'درخواست تماس شما ثبت شد و به زودی با شما ارتباط می‌گیریم.',
            'data' => [
                'id' => $submission->id,
            ],
        ]);
    }
}
