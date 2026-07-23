<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Services\TelegramBookingBotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TelegramBotWebhookController extends Controller
{
    public function __construct(
        private readonly TelegramBookingBotService $botService,
    ) {}

    public function __invoke(Request $request, string $channel = 'telegram'): JsonResponse
    {
        $this->botService->handle($request->all(), $channel);

        return response()->json(['ok' => true]);
    }
}
