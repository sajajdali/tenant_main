<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Services\TenantNutritionExerciseLibraryService;
use App\Support\TenantAudienceScope;
use Illuminate\Http\JsonResponse;

class NutritionExerciseCatalogController extends Controller
{
    public function __construct(
        private readonly TenantNutritionExerciseLibraryService $library,
    ) {
    }

    public function index(): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);

        return response()->json([
            'success' => true,
            'data' => [
                'groups' => $this->library->catalogGroups(),
            ],
        ]);
    }
}
