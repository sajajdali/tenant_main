<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\AppointmentPayment;
use App\Domain\Booking\Models\Barber;
use App\Domain\Tenant\Models\PaymentSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\Payments\TenantMaliartGateway;
use App\Support\TenantSandboxMode;
use App\Support\TenantPaymentGateways;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Shetabit\Multipay\Exceptions\InvalidPaymentException;
use Shetabit\Multipay\Invoice;
use Shetabit\Payment\Facade\Payment;

class AppointmentPaymentService
{
    public function __construct(
        private readonly TenantAppointmentBookingService $bookingService,
        private readonly CustomerClubService $customerClubService,
        private readonly TenantMaliartGateway $maliart,
    )
    {
    }

    public function settings(): array
    {
        $payment = PaymentSetting::query()->first();
        $credentials = $payment?->credentials ?? [];
        $meta = $payment?->meta ?? [];
        $gateways = TenantPaymentGateways::normalized($credentials['gateways'] ?? []);
        $enabledGateways = TenantPaymentGateways::configuredEnabled($gateways);

        if ($this->maliart->enabled()) {
            return [
                'enabled' => true,
                'provider' => 'maliart',
                'sandbox_enabled' => false,
                'enamad_code' => '',
                'gateways' => [],
                'enabled_gateways' => ['maliart'],
                'maliart_enabled' => true,
            ];
        }

        return [
            'enabled' => (bool) ($payment?->enabled ?? false),
            'provider' => $payment?->provider ?: ($enabledGateways[0] ?? null),
            'sandbox_enabled' => TenantSandboxMode::paymentEnabled(null, (bool) ($meta['sandbox_enabled'] ?? false)),
            'enamad_code' => (string) ($meta['enamad_code'] ?? ''),
            'gateways' => $gateways,
            'enabled_gateways' => $enabledGateways,
            'maliart_enabled' => false,
        ];
    }

    public function initiate(TenantUser $actor, array $validated, string $callbackUrlTemplate): array
    {
        $settings = $this->settings();

        /** @var AppointmentPayment $payment */
        /** @var int $totalAmount */
        /** @var int $payableAmount */
        /** @var int $walletUsedAmount */
        [$payment, $totalAmount, $payableAmount, $walletUsedAmount] = DB::transaction(function () use ($actor, $validated, $settings) {
            Barber::query()
                ->whereKey($validated['barberId'])
                ->lockForUpdate()
                ->firstOrFail();

            $prepared = $this->bookingService->prepare($actor, $validated);
            $totalAmount = (int) ($prepared['service']->price ?? 0);

            if ($totalAmount <= 0) {
                throw ValidationException::withMessages([
                    'gateway' => __('payment.appointment.service_price_missing'),
                ]);
            }

            $payment = AppointmentPayment::query()->create([
                'created_by_user_id' => $actor->id,
                'professional_id' => $prepared['barber']->id,
                'service_id' => $prepared['service']->id,
                'invoice_number' => $this->makeInvoiceNumber(),
                'gateway' => 'wallet',
                'status' => 'pending',
                'sandbox_mode' => false,
                'amount' => 0,
                'appointment_date' => $validated['date'],
                'start_time' => $validated['startTime'],
                'end_time' => $prepared['endsAt']->format('H:i'),
                'customer_name_snapshot' => $validated['userName'],
                'customer_phone_snapshot' => $validated['userPhone'],
                'booked_by_name_snapshot' => $actor->name,
                'booked_by_phone_snapshot' => $actor->mobile,
                'notes' => $validated['notes'] ?? null,
                'expires_at' => now()->addMinutes(20),
                'meta' => [
                    'send_sms' => (bool) ($validated['sendSms'] ?? false),
                    'is_for_someone_else' => (bool) ($validated['isForSomeoneElse'] ?? false),
                    'total_amount' => $totalAmount,
                ],
            ]);

            $walletUsedAmount = ($settings['maliart_enabled'] ?? false)
                ? 0
                : $this->customerClubService->reserveWalletForAppointmentPayment(
                    $actor,
                    $totalAmount,
                    (string) $payment->id,
                );

            $payableAmount = max(0, $totalAmount - $walletUsedAmount);
            $gateway = $this->resolveGatewaySelection($settings, (string) ($validated['gateway'] ?? ''), $payableAmount);

            $payment->update([
                'gateway' => $gateway,
                'sandbox_mode' => $payableAmount > 0 && (bool) $settings['sandbox_enabled'],
                'amount' => $payableAmount,
                'meta' => array_merge($payment->meta ?? [], [
                    'total_amount' => $totalAmount,
                    'wallet_used_amount' => $walletUsedAmount,
                    'payable_amount' => $payableAmount,
                    'gateway_label' => $gateway === 'maliart' ? __('payment.direct_gateway') : (TenantPaymentGateways::definitions()[$gateway]['label'] ?? $gateway),
                ]),
            ]);

            return [$payment->fresh(), $totalAmount, $payableAmount, $walletUsedAmount];
        });

        if ($payableAmount === 0) {
            $appointment = $this->markSuccessfulAndCreateAppointment($payment, 'wallet-'.Str::upper(Str::random(10)));

            return [
                'mode' => 'wallet',
                'payment' => $payment->fresh(),
                'appointment' => $appointment,
            ];
        }

        if ($settings['sandbox_enabled']) {
            $appointment = $this->markSuccessfulAndCreateAppointment($payment, 'sandbox-'.Str::upper(Str::random(10)));

            return [
                'mode' => 'sandbox',
                'payment' => $payment->fresh(),
                'appointment' => $appointment,
            ];
        }

        $callbackUrl = str_replace(['{payment}', '__PAYMENT__'], (string) $payment->id, $callbackUrlTemplate);

        if ((string) $payment->gateway === 'maliart') {
            try {
                $remote = $this->maliart->start(
                    (string) $payment->invoice_number,
                    $payableAmount,
                    'appointment',
                    __('payment.appointment.invoice_description'),
                    $callbackUrl,
                    (string) $validated['userName'],
                    (string) $validated['userPhone'],
                );
                $payment->update(['transaction_id' => $remote['paymentId']]);
            } catch (\Throwable $exception) {
                $this->releaseWalletReservation($payment, __('payment.appointment.wallet_release_start_failed'));
                $payment->update(['status' => 'failed', 'failure_reason' => $exception->getMessage()]);
                throw $exception;
            }

            return ['mode' => 'gateway', 'payment' => $payment->fresh(), 'paymentUrl' => $remote['paymentUrl'], 'redirectForm' => null];
        }

        $invoice = (new Invoice())
            ->amount($payableAmount)
            ->detail('description', __('payment.appointment.invoice_description'))
            ->detail('mobile', $validated['userPhone']);

        try {
            $paymentManager = Payment::via((string) $payment->gateway)
                ->config(TenantPaymentGateways::driverConfig((string) $payment->gateway, $settings['gateways'][(string) $payment->gateway], $callbackUrl))
                ->callbackUrl($callbackUrl);

            $paymentManager->purchase($invoice, function ($driver, $transactionId) use ($payment): void {
                $payment->update([
                    'transaction_id' => (string) $transactionId,
                ]);
            });

            $redirectForm = $paymentManager->pay()->jsonSerialize();
        } catch (\Throwable $exception) {
            $this->releaseWalletReservation($payment, __('payment.appointment.wallet_release_start_failed'));

            $payment->update([
                'status' => 'failed',
                'failure_reason' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        return [
            'mode' => 'gateway',
            'payment' => $payment->fresh(),
            'redirectForm' => $redirectForm,
        ];
    }

    public function verify(AppointmentPayment $payment): AppointmentPayment
    {
        if ($payment->status === 'paid') {
            return $payment;
        }

        if ((string) $payment->gateway === 'maliart') {
            $reference = $this->maliart->verify((string) $payment->transaction_id, (string) $payment->invoice_number, (int) $payment->amount);
            $this->markSuccessfulAndCreateAppointment($payment, $reference);

            return $payment->fresh();
        }

        $settings = $this->settings();
        $gateway = (string) $payment->gateway;
        $gatewaySettings = $settings['gateways'][$gateway] ?? null;

        if (! $gatewaySettings) {
            throw ValidationException::withMessages([
                'payment' => __('payment.appointment.gateway_settings_missing'),
            ]);
        }

        try {
            $receipt = Payment::via($gateway)
                ->config(TenantPaymentGateways::driverConfig($gateway, $gatewaySettings, ''))
                ->amount((int) $payment->amount)
                ->transactionId((string) $payment->transaction_id)
                ->verify();
        } catch (InvalidPaymentException $exception) {
            $payment->update([
                'status' => 'failed',
                'failure_reason' => $exception->getMessage(),
            ]);
            $this->releaseWalletReservation($payment, __('payment.appointment.wallet_release_payment_failed'));

            throw $exception;
        }

        $this->markSuccessfulAndCreateAppointment($payment, (string) $receipt->getReferenceId());

        return $payment->fresh();
    }

    public function markCancelled(AppointmentPayment $payment, string $message): void
    {
        if ($payment->status === 'paid') {
            return;
        }

        $payment->update([
            'status' => 'cancelled',
            'failure_reason' => $message,
        ]);

        $this->releaseWalletReservation($payment, __('payment.appointment.wallet_release_cancelled'));
    }

    private function markSuccessfulAndCreateAppointment(AppointmentPayment $payment, string $referenceId)
    {
        return DB::transaction(function () use ($payment, $referenceId) {
            /** @var AppointmentPayment $locked */
            $locked = AppointmentPayment::query()->lockForUpdate()->findOrFail($payment->id);

            if ($locked->status === 'paid' && $locked->appointment_id) {
                return $locked->appointment;
            }

            /** @var TenantUser $actor */
            $actor = TenantUser::query()->findOrFail($locked->created_by_user_id);

            try {
                $appointment = $this->bookingService->book($actor, [
                    'barberId' => $locked->professional_id,
                    'sectionId' => $locked->service_id,
                    'date' => $locked->appointment_date?->toDateString() ?? (string) $locked->getRawOriginal('appointment_date'),
                    'startTime' => substr((string) $locked->start_time, 0, 5),
                    'endTime' => substr((string) $locked->end_time, 0, 5),
                    'userName' => $locked->customer_name_snapshot,
                    'userPhone' => $locked->customer_phone_snapshot,
                    'notes' => $locked->notes,
                    'sendSms' => (bool) ($locked->meta['send_sms'] ?? false),
                    'isForSomeoneElse' => (bool) ($locked->meta['is_for_someone_else'] ?? false),
                ], $locked->id);
            } catch (\Throwable $exception) {
                $locked->update([
                    'status' => 'failed',
                    'failure_reason' => $exception->getMessage(),
                ]);

                $this->releaseWalletReservation($locked, __('payment.appointment.wallet_release_booking_failed'));

                throw $exception;
            }

            $locked->update([
                'status' => 'paid',
                'reference_id' => $referenceId,
                'paid_at' => now(),
                'appointment_id' => $appointment->id,
                'failure_reason' => null,
            ]);

            return $appointment;
        });
    }

    private function makeInvoiceNumber(): string
    {
        return 'APT-'.now()->format('YmdHis').'-'.Str::upper(Str::random(6));
    }

    private function resolveGatewaySelection(array $settings, string $gateway, int $payableAmount): string
    {
        $selected = trim($gateway);

        if ($payableAmount <= 0) {
            return 'wallet';
        }

        if (($settings['maliart_enabled'] ?? false) === true) {
            return 'maliart';
        }

        if ($settings['sandbox_enabled']) {
            return $selected !== '' ? $selected : ((string) ($settings['enabled_gateways'][0] ?? 'sandbox'));
        }

        if (! $settings['enabled']) {
            throw ValidationException::withMessages([
                'gateway' => __('payment.appointment.online_disabled'),
            ]);
        }

        if (! in_array($selected, $settings['enabled_gateways'], true)) {
            throw ValidationException::withMessages([
                'gateway' => __('payment.appointment.gateway_required'),
            ]);
        }

        return $selected;
    }

    private function releaseWalletReservation(AppointmentPayment $payment, ?string $reason = null): void
    {
        $walletUsedAmount = (int) ($payment->meta['wallet_used_amount'] ?? 0);

        if ($walletUsedAmount <= 0) {
            return;
        }

        $actor = TenantUser::query()->find($payment->created_by_user_id);

        if (! $actor) {
            return;
        }

        $this->customerClubService->releaseWalletReservationForAppointmentPayment(
            $actor,
            (string) $payment->id,
            $reason,
        );
    }
}
