<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Booking\Models\AppointmentPayment;
use App\Http\Controllers\Controller;
use App\Services\AppointmentPaymentService;
use App\Support\InputNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class BookingPaymentController extends Controller
{
    public function __construct(private readonly AppointmentPaymentService $paymentService)
    {
    }

    public function checkout(Request $request): JsonResponse
    {
        $actor = $request->user('tenant_web');
        abort_unless($actor, 401, __('authorization.login_required'));

        $request->merge([
            'userPhone' => InputNormalizer::mobile($request->input('userPhone')),
        ]);

        $validated = $request->validate([
            'barberId' => ['required', 'integer', 'exists:professionals,id'],
            'sectionId' => ['required', 'integer', 'exists:services,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'startTime' => ['required', 'date_format:H:i'],
            'endTime' => ['required', 'date_format:H:i'],
            'userName' => ['required', 'string', 'max:255'],
            'userPhone' => ['required', 'regex:/^09\d{9}$/'],
            'notes' => ['nullable', 'string'],
            'sendSms' => ['nullable', 'boolean'],
            'isForSomeoneElse' => ['nullable', 'boolean'],
            'gateway' => ['nullable', 'string'],
        ], [
            'userPhone.regex' => __('payment.appointment.phone_regex'),
        ]);

        $result = $this->paymentService->initiate(
            $actor,
            $validated,
            request()->getSchemeAndHttpHost().route('tenant.booking-payments.callback', ['payment' => '__PAYMENT__'], false)
        );

        return response()->json([
            'success' => true,
            'data' => [
                'mode' => $result['mode'],
                'payment' => $this->serializePayment($result['payment']),
                'appointmentId' => isset($result['appointment']) ? (string) $result['appointment']->id : null,
                'redirectForm' => $result['redirectForm'] ?? null,
                'paymentUrl' => $result['paymentUrl'] ?? null,
            ],
            'message' => match ($result['mode']) {
                'sandbox' => __('payment.appointment.sandbox_success'),
                'wallet' => __('payment.appointment.wallet_success'),
                default => __('payment.appointment.gateway_ready'),
            },
        ]);
    }

    public function callback(Request $request, AppointmentPayment $payment): RedirectResponse
    {
        if ((string) $payment->gateway !== 'maliart' && $request->has('Status') && strtoupper((string) $request->query('Status')) !== 'OK') {
            $cancelledMessage = __('payment.common.user_cancelled');
            $this->paymentService->markCancelled($payment, $cancelledMessage);

            return redirect('/?bookingPayment=failed&message='.urlencode($cancelledMessage));
        }

        try {
            $this->paymentService->verify($payment);

            return redirect('/?bookingPayment=success');
        } catch (\Throwable $exception) {
            return redirect('/?bookingPayment=failed&message='.urlencode($exception->getMessage()));
        }
    }

    private function serializePayment(AppointmentPayment $payment): array
    {
        return [
            'id' => (string) $payment->id,
            'invoiceNumber' => $payment->invoice_number,
            'gateway' => $payment->gateway,
            'status' => $payment->status,
            'amount' => (int) $payment->amount,
            'sandboxMode' => (bool) $payment->sandbox_mode,
            'totalAmount' => (int) ($payment->meta['total_amount'] ?? $payment->amount),
            'walletUsedAmount' => (int) ($payment->meta['wallet_used_amount'] ?? 0),
            'payableAmount' => (int) ($payment->meta['payable_amount'] ?? $payment->amount),
        ];
    }
}
