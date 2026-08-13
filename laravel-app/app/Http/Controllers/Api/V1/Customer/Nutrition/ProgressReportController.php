<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Customer\Nutrition;

use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\Api\CustomerNutritionProgressReportDataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProgressReportController extends Controller
{
    public function __construct(private readonly CustomerNutritionProgressReportDataService $progressReport) {}

    public function show(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = $request->user();
        abort_unless($user, 401);

        if (! $user->can_book) {
            return response()->json(['success' => false, 'message' => 'دسترسی شما به بخش رژیم بسته است. لطفاً با پشتیبانی تماس بگیرید.', 'errors' => []], 423);
        }

        $validated = $request->validate([
            'period' => ['nullable', 'string', Rule::in(CustomerNutritionProgressReportDataService::PERIODS)],
        ]);

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => $this->progressReport->payload($user, $validated['period'] ?? 'all'),
            'meta' => [],
        ]);
    }
}
