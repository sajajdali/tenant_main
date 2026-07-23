<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Services\Api\CustomerAppHomeDataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppHomeController extends Controller
{
    public function __construct(
        private readonly CustomerAppHomeDataService $homeData,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => null,
            'data' => $this->homeData->payload(
                $request->query('domain') !== null ? (string) $request->query('domain') : null,
                $request->getScheme(),
            ),
            'meta' => [],
        ]);
    }
}
