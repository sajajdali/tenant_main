<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Services\CustomLandingService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class CustomLandingPublicController extends Controller
{
    public function __construct(private readonly CustomLandingService $service, private readonly SiteController $site) {}

    public function __invoke(Request $request, string $token): Response
    {
        $this->service->captureToken($request, $token);
        return ($this->site)($request);
    }
}
