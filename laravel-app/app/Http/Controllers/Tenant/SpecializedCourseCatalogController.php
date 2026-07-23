<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Services\SpecializedCourseCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SpecializedCourseCatalogController extends Controller
{
    public function __construct(
        private readonly SpecializedCourseCatalogService $catalog,
    ) {
    }

    public function home(Request $request): JsonResponse
    {
        $actor = auth('tenant_web')->user();
        abort_unless($actor && in_array($actor->role, ['admin', 'barber'], true), 403);

        return response()->json([
            'success' => true,
            'data' => $this->catalog->home(
                tenant()->loadMissing('audienceType'),
                $actor,
                $request->query('discount_code'),
            ),
        ]);
    }
}
