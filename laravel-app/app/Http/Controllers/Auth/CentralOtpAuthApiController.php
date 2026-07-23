<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\Auth\OtpLoginService;
use App\Support\SmsGatewaySettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CentralOtpAuthApiController extends Controller
{
    public function __construct(private readonly OtpLoginService $otpLoginService)
    {
    }

    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mobile' => ['required', 'string', 'max:20'],
        ]);

        $result = $this->otpLoginService->sendForCentral($validated['mobile']);

        if (! $result['ok']) {
            return response()->json([
                'success' => false,
                'message' => $result['message'],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => __('api.auth.otp_sent'),
            'data' => [
                'remaining_seconds' => $result['remaining_seconds'],
                'code_hint' => SmsGatewaySettings::sandboxEnabled() ? ($result['code'] ?? null) : null,
            ],
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mobile' => ['required', 'string', 'max:20'],
            'code' => ['required', 'string', 'size:4'],
            'remember' => ['nullable', 'boolean'],
        ]);

        $user = $this->otpLoginService->verifyForCentral($validated['mobile'], $validated['code']);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => __('api.auth.otp_invalid'),
            ], 422);
        }

        Auth::login($user, (bool) ($validated['remember'] ?? false));
        $request->session()->regenerate();

        return response()->json([
            'success' => true,
            'message' => __('api.auth.login_success'),
            'data' => [
                'redirect' => route('admin.dashboard'),
            ],
        ]);
    }
}
