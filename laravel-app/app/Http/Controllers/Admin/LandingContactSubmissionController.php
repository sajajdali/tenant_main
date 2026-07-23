<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Landing\Models\LandingSite;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\View\View;

class LandingContactSubmissionController extends Controller
{
    public function index(Request $request, LandingSite $landingSite): View
    {
        $query = trim((string) $request->get('q', ''));

        $submissions = $landingSite->contactSubmissions()
            ->when($query !== '', function ($builder) use ($query): void {
                $builder->where(function ($inner) use ($query): void {
                    $inner->where('full_name', 'like', "%{$query}%")
                        ->orWhere('mobile', 'like', "%{$query}%")
                        ->orWhere('email', 'like', "%{$query}%")
                        ->orWhere('message', 'like', "%{$query}%");
                });
            })
            ->latest('submitted_at')
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        return view('admin.landing-contact-submissions.index', [
            'landingSite' => $landingSite,
            'submissions' => $submissions,
            'query' => $query,
        ]);
    }
}
