<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionInAppPurchaseReceipt;
use App\Domain\Tenant\Models\NutritionPackage;
use App\Domain\Tenant\Models\NutritionPackageOrder;
use App\Domain\Tenant\Models\PaymentSetting;
use App\Domain\Tenant\Models\TenantUser;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class NutritionCafeBazaarPurchaseService
{
    public function __construct(
        private readonly NutritionPackagePaymentService $packagePayments,
    ) {
    }

    public function settings(): array
    {
        $meta = PaymentSetting::query()->first()?->meta ?? [];
        $settings = is_array($meta['cafebazaar_iap'] ?? null) ? $meta['cafebazaar_iap'] : [];

        return [
            'enabled' => (bool) ($settings['enabled'] ?? false),
            'public_key_configured' => filled($settings['public_key'] ?? ''),
            'store' => 'cafebazaar',
            'paymentRoute' => '/api/v1/app/nutrition/iap/cafebazaar',
            'consumeRequired' => true,
            'discountSupported' => false,
        ];
    }

    public function publicSettings(): array
    {
        return $this->settings();
    }

    public function createOrder(TenantUser $user, NutritionPackage $package, bool $replaceActiveSubscription = false): NutritionPackageOrder
    {
        $this->ensureEnabled();
        $package = $this->ensurePackageHasBazaarProduct($package);
        $this->ensureReplacementConfirmed($user, $replaceActiveSubscription);

        return DB::transaction(function () use ($user, $package, $replaceActiveSubscription): NutritionPackageOrder {
            $payloadNonce = Str::uuid()->toString();
            $developerPayload = $this->signDeveloperPayload($user, $package, $payloadNonce);

            $order = NutritionPackageOrder::query()->create([
                'user_id' => $user->id,
                'nutrition_package_id' => $package->id,
                'nutrition_discount_code_id' => null,
                'invoice_number' => $this->makeInvoiceNumber(),
                'status' => 'pending',
                'gateway' => 'cafebazaar',
                'sandbox_mode' => false,
                'amount' => 0,
                'discount_amount' => 0,
                'payable_amount' => 0,
                'discount_code' => null,
                'discount_code_snapshot' => null,
                'meta_json' => [
                    'package' => $this->packageSnapshot($package),
                    'in_app_purchase' => [
                        'store' => 'cafebazaar',
                        'product_id' => $package->cafebazaar_product_id,
                        'developer_payload' => $developerPayload,
                        'payload_nonce' => $payloadNonce,
                        'discount_supported' => false,
                        'consume_required' => true,
                    ],
                    'replacement_confirmation' => [
                        'confirmed' => $replaceActiveSubscription,
                    ],
                ],
                'expires_at' => now()->addMinutes(30),
            ]);

            return $order->fresh(['package']);
        });
    }

    public function verifyOrder(TenantUser $user, NutritionPackageOrder $order, array $purchase): array
    {
        $this->ensureEnabled();

        $order = NutritionPackageOrder::query()
            ->with(['package', 'subscription'])
            ->whereKey($order->id)
            ->where('user_id', $user->id)
            ->where('gateway', 'cafebazaar')
            ->firstOrFail();

        if ($order->status === 'paid') {
            return [
                'order' => $order->fresh(['package', 'subscription', 'discountCode']),
                'receipt' => $order->inAppPurchaseReceipts()->latest('id')->first(),
                'consumeRequired' => true,
            ];
        }

        if ($order->expires_at && $order->expires_at->isPast()) {
            $order->update(['status' => 'failed', 'failure_reason' => 'مهلت پرداخت بازار تمام شده است.']);
            throw ValidationException::withMessages(['order' => 'مهلت پرداخت بازار تمام شده است. دوباره سفارش بسازید.']);
        }

        $productId = trim((string) ($purchase['product_id'] ?? ''));
        $purchaseToken = trim((string) ($purchase['purchase_token'] ?? ''));
        $developerPayload = trim((string) ($purchase['developer_payload'] ?? ''));
        $signedData = trim((string) ($purchase['signed_data'] ?? ''));
        $signature = trim((string) ($purchase['signature'] ?? ''));
        $expectedProductId = (string) ($order->package?->cafebazaar_product_id ?? data_get($order->meta_json, 'in_app_purchase.product_id', ''));
        $expectedPayload = (string) data_get($order->meta_json, 'in_app_purchase.developer_payload', '');

        if ($expectedProductId === '' || $productId === '' || $productId !== $expectedProductId) {
            throw ValidationException::withMessages(['product_id' => 'شناسه محصول بازار با پکیج انتخاب‌شده همخوانی ندارد.']);
        }

        if ($purchaseToken === '') {
            throw ValidationException::withMessages(['purchase_token' => 'توکن خرید بازار الزامی است.']);
        }

        if ($expectedPayload === '' || ! hash_equals($expectedPayload, $developerPayload)) {
            throw ValidationException::withMessages(['developer_payload' => 'شناسه امن سفارش بازار معتبر نیست.']);
        }

        $signedPurchase = $this->verifyPurchaseSignature($signedData, $signature);
        $signedProductId = (string) ($signedPurchase['productId'] ?? $signedPurchase['product_id'] ?? '');
        $signedPurchaseToken = (string) ($signedPurchase['purchaseToken'] ?? $signedPurchase['purchase_token'] ?? '');
        $signedDeveloperPayload = (string) ($signedPurchase['developerPayload'] ?? $signedPurchase['developer_payload'] ?? '');

        if ($signedProductId === '' || $signedProductId !== $productId) {
            throw ValidationException::withMessages(['signed_data' => 'شناسه محصول داخل رسید امضاشده با درخواست همخوانی ندارد.']);
        }

        if ($signedPurchaseToken === '' || $signedPurchaseToken !== $purchaseToken) {
            throw ValidationException::withMessages(['signed_data' => 'توکن خرید داخل رسید امضاشده با درخواست همخوانی ندارد.']);
        }

        if ($signedDeveloperPayload !== '' && ! hash_equals($developerPayload, $signedDeveloperPayload)) {
            throw ValidationException::withMessages(['signed_data' => 'شناسه امن داخل رسید امضاشده با سفارش همخوانی ندارد.']);
        }

        $existingReceipt = NutritionInAppPurchaseReceipt::query()
            ->where('purchase_token', $purchaseToken)
            ->first();

        if ($existingReceipt && (int) $existingReceipt->nutrition_package_order_id !== (int) $order->id) {
            throw ValidationException::withMessages(['purchase_token' => 'این توکن خرید قبلا برای سفارش دیگری استفاده شده است.']);
        }

        return DB::transaction(function () use ($user, $order, $purchase, $purchaseToken, $productId, $developerPayload, $existingReceipt): array {
            $receipt = $existingReceipt ?: NutritionInAppPurchaseReceipt::query()->create([
                'user_id' => $user->id,
                'nutrition_package_id' => $order->nutrition_package_id,
                'nutrition_package_order_id' => $order->id,
                'store' => 'cafebazaar',
                'product_id' => $productId,
                'purchase_token' => $purchaseToken,
                'store_order_id' => $purchase['store_order_id'] ?? null,
                'developer_payload' => $developerPayload,
                'status' => 'pending',
                'raw_payload' => $purchase,
                'purchased_at' => $this->parsePurchaseTime($purchase['purchase_time'] ?? null),
            ]);

            $receipt->update([
                'status' => 'verified',
                'raw_payload' => $purchase,
                'verified_at' => now(),
                'failure_reason' => null,
            ]);

            $order->update([
                'transaction_id' => $purchaseToken,
                'reference_id' => $purchase['store_order_id'] ?? $purchaseToken,
            ]);

            $paid = $this->packagePayments->markSuccessful($order, (string) ($purchase['store_order_id'] ?? $purchaseToken));

            $receipt->update([
                'status' => 'granted',
                'granted_at' => now(),
            ]);

            return [
                'order' => $paid->fresh(['package', 'subscription', 'discountCode']),
                'receipt' => $receipt->fresh(),
                'consumeRequired' => true,
            ];
        });
    }

    public function markConsumed(TenantUser $user, string $purchaseToken): ?NutritionInAppPurchaseReceipt
    {
        $receipt = NutritionInAppPurchaseReceipt::query()
            ->where('user_id', $user->id)
            ->where('store', 'cafebazaar')
            ->where('purchase_token', $purchaseToken)
            ->first();

        if (! $receipt) {
            return null;
        }

        $receipt->update([
            'status' => 'consumed',
            'consumed_reported_at' => now(),
        ]);

        return $receipt->fresh();
    }

    private function ensureEnabled(): void
    {
        $settings = $this->settings();

        if (! $settings['enabled']) {
            throw ValidationException::withMessages(['gateway' => 'درگاه پرداخت بازار برای این سامانه فعال نیست.']);
        }

        if (! $settings['public_key_configured']) {
            throw ValidationException::withMessages(['gateway' => 'کلید عمومی بازار برای این سامانه تنظیم نشده است.']);
        }
    }

    private function verifyPurchaseSignature(string $signedData, string $signature): array
    {
        if ($signedData === '' || $signature === '') {
            throw ValidationException::withMessages(['signature' => 'signed_data و signature رسید بازار الزامی است.']);
        }

        $meta = PaymentSetting::query()->first()?->meta ?? [];
        $settings = is_array($meta['cafebazaar_iap'] ?? null) ? $meta['cafebazaar_iap'] : [];
        $publicKey = trim((string) ($settings['public_key'] ?? ''));

        $pem = str_contains($publicKey, 'BEGIN PUBLIC KEY')
            ? $publicKey
            : "-----BEGIN PUBLIC KEY-----\n".chunk_split($publicKey, 64, "\n")."-----END PUBLIC KEY-----\n";

        $verified = openssl_verify($signedData, base64_decode($signature, true) ?: '', $pem, OPENSSL_ALGO_SHA1);

        if ($verified !== 1) {
            throw ValidationException::withMessages(['signature' => 'امضای رسید بازار معتبر نیست.']);
        }

        $decoded = json_decode($signedData, true);

        if (! is_array($decoded)) {
            throw ValidationException::withMessages(['signed_data' => 'ساختار signed_data بازار معتبر نیست.']);
        }

        return $decoded;
    }

    private function ensurePackageHasBazaarProduct(NutritionPackage $package): NutritionPackage
    {
        $package = NutritionPackage::query()->findOrFail($package->id);

        if (! $package->is_active || $package->children()->exists()) {
            throw ValidationException::withMessages(['package' => 'این پکیج برای خرید مستقیم قابل استفاده نیست.']);
        }

        if (blank($package->cafebazaar_product_id)) {
            throw ValidationException::withMessages(['product_id' => 'شناسه محصول بازار برای این پکیج تنظیم نشده است.']);
        }

        return $package;
    }

    private function ensureReplacementConfirmed(TenantUser $user, bool $replaceActiveSubscription): void
    {
        $activeSubscription = $this->packagePayments->activeSubscriptionForUser($user);
        $remainingDays = $activeSubscription?->ends_at
            ? max(0, (int) now()->startOfDay()->diffInDays($activeSubscription->ends_at->copy()->startOfDay(), false))
            : 0;

        if ($remainingDays > 10 && ! $replaceActiveSubscription) {
            throw ValidationException::withMessages([
                'replace_active_subscription' => __('tenant.nutrition.active_package_replacement_confirmation_required'),
            ]);
        }
    }

    private function signDeveloperPayload(TenantUser $user, NutritionPackage $package, string $nonce): string
    {
        $payload = implode('|', [
            tenant('id') ?: 'tenant',
            $user->id,
            $package->id,
            (string) $package->cafebazaar_product_id,
            $nonce,
        ]);

        return base64_encode($payload.'|'.hash_hmac('sha256', $payload, (string) config('app.key')));
    }

    private function parsePurchaseTime(mixed $value): mixed
    {
        if (is_numeric($value)) {
            $timestamp = (int) $value;

            return $timestamp > 9999999999
                ? CarbonImmutable::createFromTimestampMs($timestamp)
                : CarbonImmutable::createFromTimestamp($timestamp);
        }

        return null;
    }

    private function packageSnapshot(NutritionPackage $package): array
    {
        return [
            'id' => (string) $package->id,
            'name' => $package->name,
            'cafebazaarProductId' => $package->cafebazaar_product_id,
            'onlineDietCount' => (int) $package->online_diet_count,
            'offlineDietCount' => (int) $package->offline_diet_count,
            'durationDays' => (int) $package->duration_days,
        ];
    }

    private function makeInvoiceNumber(): string
    {
        return 'NPK-BZR-' . now()->format('Ymd') . '-' . Str::upper(Str::random(6));
    }
}
