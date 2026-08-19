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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
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
            'server_api_configured' => filled($settings['package_name'] ?? '')
                && filled($settings['client_id'] ?? '')
                && filled($settings['client_secret'] ?? ''),
            'packageName' => (string) ($settings['package_name'] ?? ''),
            'store' => 'cafebazaar',
            'paymentRoute' => '/api/v1/app/nutrition/iap/cafebazaar',
            'consumeRequired' => false,
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
                        'consume_required' => false,
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
            $receipt = $order->inAppPurchaseReceipts()->latest('id')->first();

            return [
                'order' => $order->fresh(['package', 'subscription', 'discountCode']),
                'receipt' => $receipt,
                'consumeRequired' => false,
                'bazaarValidation' => data_get($receipt?->raw_payload, 'validation', []),
                'bazaarConsume' => data_get($receipt?->raw_payload, 'consume', []),
            ];
        }

        if ($order->expires_at && $order->expires_at->isPast()) {
            $order->update(['status' => 'failed', 'failure_reason' => 'مهلت پرداخت بازار تمام شده است.']);
            throw ValidationException::withMessages(['order' => 'مهلت پرداخت بازار تمام شده است. دوباره سفارش بسازید.']);
        }

        $productId = trim((string) ($purchase['product_id'] ?? ''));
        $purchaseToken = trim((string) ($purchase['purchase_token'] ?? ''));
        $packageName = trim((string) ($purchase['package_name'] ?? ''));
        $expectedProductId = (string) ($order->package?->cafebazaar_product_id ?? data_get($order->meta_json, 'in_app_purchase.product_id', ''));
        $settings = $this->bazaarSettings();

        if ($expectedProductId === '' || $productId === '' || $productId !== $expectedProductId) {
            throw ValidationException::withMessages(['product_id' => 'شناسه محصول بازار با پکیج انتخاب‌شده همخوانی ندارد.']);
        }

        if ($purchaseToken === '') {
            throw ValidationException::withMessages(['purchase_token' => 'توکن خرید بازار الزامی است.']);
        }

        if ($packageName === '' || ! hash_equals((string) $settings['package_name'], $packageName)) {
            throw ValidationException::withMessages(['package_name' => 'نام پکیج ارسالی با پکیج ثبت‌شده برای کافه‌بازار همخوانی ندارد.']);
        }

        $validation = $this->validatePurchaseWithBazaar($settings, $packageName, $productId, $purchaseToken);

        if ((int) ($validation['purchaseState'] ?? -1) !== 0) {
            throw ValidationException::withMessages(['purchase_token' => 'کافه‌بازار این خرید را موفق تایید نکرده است.']);
        }

        if ((int) ($validation['consumptionState'] ?? -1) !== 0) {
            throw ValidationException::withMessages(['purchase_token' => 'این خرید قبلا در کافه‌بازار مصرف شده است.']);
        }

        $existingReceipt = NutritionInAppPurchaseReceipt::query()
            ->where('purchase_token', $purchaseToken)
            ->first();

        if ($existingReceipt && (int) $existingReceipt->nutrition_package_order_id !== (int) $order->id) {
            throw ValidationException::withMessages(['purchase_token' => 'این توکن خرید قبلا برای سفارش دیگری استفاده شده است.']);
        }

        // Consume is deliberately performed by the backend. Flutter must never
        // receive Bazaar API credentials or call the Bazaar server API itself.
        $consume = $this->consumePurchaseWithBazaar($settings, $packageName, $purchaseToken);

        return DB::transaction(function () use ($user, $order, $purchase, $purchaseToken, $productId, $validation, $consume, $existingReceipt): array {
            $receipt = $existingReceipt ?: NutritionInAppPurchaseReceipt::query()->create([
                'user_id' => $user->id,
                'nutrition_package_id' => $order->nutrition_package_id,
                'nutrition_package_order_id' => $order->id,
                'store' => 'cafebazaar',
                'product_id' => $productId,
                'purchase_token' => $purchaseToken,
                'store_order_id' => $purchase['store_order_id'] ?? null,
                'developer_payload' => $validation['developerPayload'] ?? null,
                'status' => 'pending',
                'raw_payload' => ['request' => $purchase, 'validation' => $validation, 'consume' => $consume],
                'purchased_at' => $this->parsePurchaseTime($validation['purchaseTime'] ?? null),
            ]);

            $receipt->update([
                'status' => 'verified',
                'raw_payload' => ['request' => $purchase, 'validation' => $validation, 'consume' => $consume],
                'verified_at' => now(),
                'failure_reason' => null,
            ]);

            $order->update([
                'transaction_id' => $purchaseToken,
                'reference_id' => $purchase['store_order_id'] ?? $purchaseToken,
            ]);

            $paid = $this->packagePayments->markSuccessful($order, (string) ($purchase['store_order_id'] ?? $purchaseToken));

            $receipt->update([
                'status' => 'consumed',
                'granted_at' => now(),
                'consumed_reported_at' => now(),
            ]);

            return [
                'order' => $paid->fresh(['package', 'subscription', 'discountCode']),
                'receipt' => $receipt->fresh(),
                'consumeRequired' => false,
                'bazaarValidation' => $validation,
                'bazaarConsume' => $consume,
            ];
        });
    }

    private function bazaarSettings(): array
    {
        $meta = PaymentSetting::query()->first()?->meta ?? [];

        return is_array($meta['cafebazaar_iap'] ?? null) ? $meta['cafebazaar_iap'] : [];
    }

    private function accessToken(array $settings): string
    {
        $cacheKey = 'cafebazaar:access-token:'.(string) (tenant('id') ?: 'default');

        return Cache::remember($cacheKey, now()->addMinutes(50), function () use ($settings): string {
            $response = Http::asJson()->acceptJson()->timeout(15)->post(
                'https://pardakht.cafebazaar.ir/devapi/v2/auth/token/',
                [
                    'grant_type' => 'client_credentials',
                    'client_id' => (string) $settings['client_id'],
                    'client_secret' => (string) $settings['client_secret'],
                ],
            );

            if (! $response->successful() || blank($response->json('access_token'))) {
                report(new \RuntimeException('Cafe Bazaar access token request failed: HTTP '.$response->status()));
                throw ValidationException::withMessages(['gateway' => 'دریافت دسترسی ارتباط با کافه‌بازار ناموفق بود. تنظیمات و اتصال را بررسی کنید.']);
            }

            return (string) $response->json('access_token');
        });
    }

    private function validatePurchaseWithBazaar(array $settings, string $packageName, string $productId, string $purchaseToken): array
    {
        $response = Http::acceptJson()->withToken($this->accessToken($settings))->timeout(15)->get(
            'https://pardakht.cafebazaar.ir/devapi/v2/api/validate/'.rawurlencode($packageName).'/inapp/'.rawurlencode($productId).'/purchases/'.rawurlencode($purchaseToken).'/',
        );

        return $this->bazaarResponse($response, 'اعتبارسنجی خرید در کافه‌بازار ناموفق بود.');
    }

    private function consumePurchaseWithBazaar(array $settings, string $packageName, string $purchaseToken): array
    {
        $response = Http::asJson()->acceptJson()->withToken($this->accessToken($settings))->timeout(15)->post(
            'https://pardakht.cafebazaar.ir/devapi/v2/api/consume/'.rawurlencode($packageName).'/purchases/',
            ['purchaseToken' => $purchaseToken],
        );

        return $this->bazaarResponse($response, 'مصرف خرید در کافه‌بازار ناموفق بود.');
    }

    private function bazaarResponse(\Illuminate\Http\Client\Response $response, string $defaultMessage): array
    {
        if ($response->successful() && is_array($response->json())) {
            return $response->json();
        }

        $message = match ($response->status()) {
            404 => 'نام پکیج، شناسه محصول یا توکن خرید در کافه‌بازار یافت نشد یا معتبر نیست.',
            401, 403 => 'دسترسی کافه‌بازار معتبر نیست. Client ID و Client Secret را بررسی کنید.',
            default => $defaultMessage,
        };

        report(new \RuntimeException('Cafe Bazaar API failed: HTTP '.$response->status()));
        throw ValidationException::withMessages(['cafebazaar' => $message]);
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

        if (! $settings['server_api_configured']) {
            throw ValidationException::withMessages(['gateway' => 'نام پکیج، Client ID و Client Secret کافه‌بازار باید در تنظیمات پرداخت ثبت شوند.']);
        }
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
