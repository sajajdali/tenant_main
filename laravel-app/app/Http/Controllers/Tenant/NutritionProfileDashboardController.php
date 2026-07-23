<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\Api\CustomerNutritionProfileDataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NutritionProfileDashboardController extends Controller
{
    public function __construct(
        private readonly CustomerNutritionProfileDataService $profileData,
    ) {}

    public function show(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = $request->user('tenant_web');
        abort_unless($user, 401);

        if (! $user->can_book) {
            return response()->json([
                'success' => false,
                'message' => __('tenant.nutrition.profile_access_blocked'),
                'errors' => [],
            ], 423);
        }

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => $this->profileData->payload($user),
            'meta' => [],
        ]);
    }
}
