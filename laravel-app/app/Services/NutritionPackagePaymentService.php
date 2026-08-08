<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\NutritionPackage;
use App\Domain\Tenant\Models\NutritionPackageOrder;
use App\Domain\Tenant\Models\NutritionProfile;
use App\Domain\Tenant\Models\NutritionPackageSubscription;
use App\Domain\Tenant\Models\PaymentSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\Payments\TenantMaliartGateway;
use App\Support\TenantPaymentGateways;
use App\Support\TenantSandboxMode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Shetabit\Multipay\Exceptions\InvalidPaymentException;
use Shetabit\Multipay\Invoice;
use Shetabit\Payment\Facade\Payment;

class NutritionPackagePaymentService
{
    public function __construct(
        private readonly NutritionDiscountCodeService $discountCodes,
        private readonly TenantMaliartGateway $maliart,
        private readonly TenantFeatureModuleManager $featureModules,
        private readonly CustomLandingService $customLanding,
    ) {
    }

    public function settings(): array
    {
        $payment = PaymentSetting::query()->first();
        $general = GeneralSetting::query()->first();
        $credentials = $payment?->credentials ?? [];
        $meta = $payment?->meta ?? [];
        $bookingRules = $general?->booking_rules ?? [];
        $gateways = TenantPaymentGateways::normalized($credentials['gateways'] ?? []);
        $enabledGateways = TenantPaymentGateways::configuredEnabled($gateways);

        if ($this->maliart->enabled()) {
            return [
                'enabled' => true, 'provider' => 'maliart', 'sandbox_enabled' => false,
                'gateways' => [], 'enabled_gateways' => ['maliart'], 'card_note' => '', 'maliart_enabled' => true,
            ];
        }

        return [
            'enabled' => (bool) ($payment?->enabled ?? false),
            'provider' => $payment?->provider ?: ($enabledGateways[0] ?? null),
            'sandbox_enabled' => TenantSandboxMode::paymentEnabled(null, (bool) ($meta['sandbox_enabled'] ?? false)),
            'gateways' => $gateways,
            'enabled_gateways' => $enabledGateways,
            'card_note' => (string) ($bookingRules['management_panel_note'] ?? ''),
            'maliart_enabled' => false,
            'cafebazaar_enabled' => (bool) data_get($meta, 'cafebazaar_iap.enabled', false),
        ];
    }

    public function preview(NutritionPackage $package, ?string $discountCode = null): array
    {
        $package = $this->ensurePurchasablePackage($package);
        $settings = $this->settings();
        $discount = $this->discountCodes->resolve($discountCode, $package);
        $baseAmount = (int) $discount['baseAmount'];

        return [
            'package' => $this->serializePackage($package),
            'amount' => $baseAmount,
            'discountAmount' => (int) $discount['discountAmount'],
            'payableAmount' => (int) $discount['payableAmount'],
            'discountCode' => $discount['code'],
            'settings' => [
                'enabled' => (bool) $settings['enabled'],
                'sandboxEnabled' => (bool) $settings['sandbox_enabled'],
                'provider' => $settings['provider'],
                'enabledGateways' => $settings['enabled_gateways'],
                'maliartEnabled' => (bool) ($settings['maliart_enabled'] ?? false),
                'cafebazaarEnabled' => (bool) ($settings['cafebazaar_enabled'] ?? false),
                'cafebazaarRoute' => '/api/v1/app/nutrition/iap/cafebazaar',
                'gatewayOptions' => collect(TenantPaymentGateways::definitions())
                    ->map(fn (array $item, string $key): array => [
                        'key' => $key,
                        'label' => (string) ($item['label'] ?? $key),
                    ])
                    ->values()
                    ->all(),
            ],
        ];
    }

    public function checkout(TenantUser $user, NutritionPackage $package, ?string $gateway = null, ?string $discountCode = null, string $callbackUrlTemplate = '', bool $replaceActiveSubscription = false): array
    {
        $package = $this->ensurePurchasablePackage($package);
        $activeSubscription = $this->activeSubscriptionForUser($user);
        $remainingDays = $activeSubscription?->ends_at
            ? max(0, (int) now()->startOfDay()->diffInDays($activeSubscription->ends_at->copy()->startOfDay(), false))
            : 0;

        if ($remainingDays > 10 && ! $replaceActiveSubscription) {
            throw ValidationException::withMessages([
                'replace_active_subscription' => __('tenant.nutrition.active_package_replacement_confirmation_required'),
            ]);
        }

        $preview = $this->preview($package, $discountCode);
        $settings = $this->settings();

        $isFreeCheckout = (int) $preview['payableAmount'] <= 0;

        if (! $isFreeCheckout && ! $settings['enabled'] && ! $settings['sandbox_enabled']) {
            throw ValidationException::withMessages([
                'payment' => 'پرداخت آنلاین برای این سامانه فعال نیست.',
            ]);
        }

        /** @var array{order:NutritionPackageOrder, package:NutritionPackage} $created */
        $created = DB::transaction(function () use ($user, $package, $preview, $settings, $gateway, $isFreeCheckout, $activeSubscription, $remainingDays, $replaceActiveSubscription) {
            $selectedGateway = $isFreeCheckout ? 'free' : $this->resolveGatewaySelection($settings, (string) $gateway);
            $discountSnapshot = is_array($preview['discountCode'] ?? null) ? $preview['discountCode'] : null;

            $order = NutritionPackageOrder::query()->create([
                'user_id' => $user->id,
                'nutrition_package_id' => $package->id,
                'nutrition_discount_code_id' => isset($discountSnapshot['id']) ? (int) $discountSnapshot['id'] : null,
                'invoice_number' => $this->makeInvoiceNumber(),
                'status' => 'pending',
                'gateway' => $isFreeCheckout ? 'free' : ($settings['sandbox_enabled'] ? 'sandbox' : $selectedGateway),
                'sandbox_mode' => ! $isFreeCheckout && (bool) $settings['sandbox_enabled'],
                'amount' => (int) $preview['amount'],
                'discount_amount' => (int) $preview['discountAmount'],
                'payable_amount' => (int) $preview['payableAmount'],
                'discount_code' => $discountSnapshot['code'] ?? null,
                'discount_code_snapshot' => $discountSnapshot,
                'meta_json' => [
                    'package' => $preview['package'],
                    'replacement_confirmation' => [
                        'confirmed' => $replaceActiveSubscription,
                        'active_subscription_id' => $activeSubscription?->id,
                        'remaining_days_at_checkout' => $remainingDays,
                    ],
                ],
                'expires_at' => now()->addMinutes(30),
            ]);

            return ['order' => $order->fresh(), 'package' => $package];
        });

        $order = $created['order'];

        if ($isFreeCheckout) {
            $paid = $this->markSuccessful($order, 'FREE-'.$order->invoice_number);

            return [
                'mode' => 'free',
                'order' => $this->serializeOrder($paid->fresh(['package', 'subscription', 'discountCode'])),
                'subscription' => $this->serializeSubscription($paid->subscription),
            ];
        }

        if ($settings['sandbox_enabled']) {
            $paid = $this->markSuccessful($order, 'sandbox-'.Str::upper(Str::random(10)));

            return [
                'mode' => 'sandbox',
                'order' => $this->serializeOrder($paid->fresh(['package', 'subscription', 'discountCode'])),
                'subscription' => $this->serializeSubscription($paid->subscription),
            ];
        }

        $callbackUrl = str_replace(['{order}', '__ORDER__'], (string) $order->id, $callbackUrlTemplate);

        if ((string) $order->gateway === 'maliart') {
            $remote = $this->maliart->start(
                (string) $order->invoice_number,
                (int) $order->payable_amount,
                'nutrition_package',
                __('payment.nutrition_package.gateway_description', ['package' => $package->name]),
                $callbackUrl,
                (string) $user->name,
                (string) $user->mobile,
            );
            $order->update(['transaction_id' => $remote['paymentId']]);

            return [
                'mode' => 'gateway',
                'order' => $this->serializeOrder($order->fresh(['package', 'subscription', 'discountCode'])),
                'paymentUrl' => $remote['paymentUrl'],
                'redirectForm' => null,
            ];
        }
        $invoice = (new Invoice())
            ->amount((int) $order->payable_amount)
            ->detail('description', 'خرید پکیج رژیم '.$package->name)
            ->detail('mobile', (string) $user->mobile);

        $paymentManager = Payment::via((string) $order->gateway)
            ->config(TenantPaymentGateways::driverConfig((string) $order->gateway, $settings['gateways'][(string) $order->gateway], $callbackUrl))
            ->callbackUrl($callbackUrl);

        $paymentManager->purchase($invoice, function ($driver, $transactionId) use ($order): void {
            $order->update([
                'transaction_id' => (string) $transactionId,
            ]);
        });

        return [
            'mode' => 'gateway',
            'order' => $this->serializeOrder($order->fresh(['package', 'subscription', 'discountCode'])),
            'redirectForm' => $paymentManager->pay()->jsonSerialize(),
        ];
    }

    public function verify(NutritionPackageOrder $order): NutritionPackageOrder
    {
        if ($order->status === 'paid') {
            return $order->fresh(['package', 'subscription', 'discountCode']);
        }

        if ((string) $order->gateway === 'maliart') {
            $reference = $this->maliart->verify((string) $order->transaction_id, (string) $order->invoice_number, (int) $order->payable_amount);

            return $this->markSuccessful($order, $reference)->fresh(['package', 'subscription', 'discountCode']);
        }

        $settings = $this->settings();
        $gateway = (string) $order->gateway;
        $gatewaySettings = $settings['gateways'][$gateway] ?? null;

        if (! $gatewaySettings) {
            throw ValidationException::withMessages([
                'payment' => 'تنظیمات درگاه پرداخت یافت نشد.',
            ]);
        }

        try {
            $receipt = Payment::via($gateway)
                ->config(TenantPaymentGateways::driverConfig($gateway, $gatewaySettings, ''))
                ->amount((int) $order->payable_amount)
                ->transactionId((string) $order->transaction_id)
                ->verify();
        } catch (InvalidPaymentException $exception) {
            $order->update([
                'status' => 'failed',
                'failure_reason' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        return $this->markSuccessful($order, (string) $receipt->getReferenceId())->fresh(['package', 'subscription', 'discountCode']);
    }

    public function userOrders(TenantUser $user, int $perPage = 20)
    {
        return NutritionPackageOrder::query()
            ->with(['package', 'subscription', 'discountCode'])
            ->where('user_id', $user->id)
            ->latest('id')
            ->paginate($perPage);
    }

    public function adminOrders(array $filters = [], int $perPage = 20)
    {
        $q = trim((string) ($filters['q'] ?? ''));
        $user = trim((string) ($filters['user'] ?? ''));
        $mobile = trim((string) ($filters['mobile'] ?? ''));
        $dateFrom = trim((string) ($filters['date_from'] ?? ''));
        $dateTo = trim((string) ($filters['date_to'] ?? ''));

        return NutritionPackageSubscription::query()
            ->with(['user', 'package', 'order.discountCode'])
            ->when($q !== '', function ($query) use ($q): void {
                $query->where(function ($query) use ($q): void {
                    $query->whereHas('user', function ($query) use ($q): void {
                        $query->where('name', 'like', "%{$q}%")
                            ->orWhere('mobile', 'like', "%{$q}%");
                    })
                        ->orWhereHas('package', function ($query) use ($q): void {
                            $query->where('name', 'like', "%{$q}%");
                        })
                        ->orWhereHas('order', function ($query) use ($q): void {
                            $query->where('invoice_number', 'like', "%{$q}%")
                                ->orWhere('transaction_id', 'like', "%{$q}%")
                                ->orWhere('reference_id', 'like', "%{$q}%")
                                ->orWhere('gateway', 'like', "%{$q}%");
                        });
                });
            })
            ->when($user !== '', function ($query) use ($user): void {
                $query->whereHas('user', fn ($query) => $query->where('name', 'like', "%{$user}%"));
            })
            ->when($mobile !== '', function ($query) use ($mobile): void {
                $query->whereHas('user', fn ($query) => $query->where('mobile', 'like', "%{$mobile}%"));
            })
            ->when($dateFrom !== '', fn ($query) => $query->whereDate('created_at', '>=', $dateFrom))
            ->when($dateTo !== '', fn ($query) => $query->whereDate('created_at', '<=', $dateTo))
            ->latest('id')
            ->paginate(max(1, min(100, $perPage)))
            ->through(fn (NutritionPackageSubscription $subscription): array => $this->serializePurchasedPackage($subscription));
    }

    public function activeSubscriptionForUser(TenantUser $user): ?NutritionPackageSubscription
    {
        return NutritionPackageSubscription::query()
            ->with(['package', 'order'])
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->where(function ($query): void {
                $query->whereNull('ends_at')
                    ->orWhereDate('ends_at', '>=', now()->toDateString());
            })
            ->latest('id')
            ->first();
    }

    public function serializeOrder(?NutritionPackageOrder $order): ?array
    {
        if (! $order) {
            return null;
        }

        return [
            'id' => (string) $order->id,
            'invoiceNumber' => $order->invoice_number,
            'status' => $order->status,
            'gateway' => $order->gateway,
            'sandboxMode' => (bool) $order->sandbox_mode,
            'amount' => (int) $order->amount,
            'discountAmount' => (int) $order->discount_amount,
            'payableAmount' => (int) $order->payable_amount,
            'referenceId' => $order->reference_id,
            'transactionId' => $order->transaction_id,
            'discountCode' => $order->discount_code,
            'discountCodeSnapshot' => $order->discount_code_snapshot,
            'metaJson' => $order->meta_json,
            'failureReason' => $order->failure_reason,
            'createdAt' => $order->created_at?->toIso8601String(),
            'paidAt' => $order->paid_at?->toIso8601String(),
            'expiresAt' => $order->expires_at?->toIso8601String(),
            'package' => $order->relationLoaded('package') ? $this->serializePackage($order->package) : null,
            'subscription' => $order->relationLoaded('subscription') ? $this->serializeSubscription($order->subscription) : null,
            'user' => $order->relationLoaded('user') && $order->user ? [
                'id' => (string) $order->user->id,
                'name' => $order->user->name,
                'mobile' => $order->user->mobile,
            ] : null,
        ];
    }

    public function serializeSubscription(?NutritionPackageSubscription $subscription): ?array
    {
        if (! $subscription) {
            return null;
        }

        return [
            'id' => (string) $subscription->id,
            'status' => $subscription->status,
            'startsAt' => $subscription->starts_at?->toDateString(),
            'endsAt' => $subscription->ends_at?->toDateString(),
            'onlineDietTotal' => (int) $subscription->online_diet_total,
            'onlineDietUsed' => (int) $subscription->online_diet_used,
            'offlineDietTotal' => (int) $subscription->offline_diet_total,
            'offlineDietUsed' => (int) $subscription->offline_diet_used,
            'onlineDietRemaining' => max(0, (int) $subscription->online_diet_total - (int) $subscription->online_diet_used),
            'offlineDietRemaining' => max(0, (int) $subscription->offline_diet_total - (int) $subscription->offline_diet_used),
            'priceAmount' => (int) $subscription->price_amount,
            'payableAmount' => (int) $subscription->payable_amount,
            'package' => $subscription->relationLoaded('package') && $subscription->package ? $this->serializePackage($subscription->package) : null,
        ];
    }

    public function serializePurchasedPackage(NutritionPackageSubscription $subscription): array
    {
        /** @var NutritionPackageOrder|null $order */
        $order = $subscription->relationLoaded('order') ? $subscription->order : null;
        $isManualGrant = ! $order;

        return [
            'id' => (string) ($order?->id ?? 'subscription-'.$subscription->id),
            'invoiceNumber' => $order?->invoice_number ?? 'SUB-'.$subscription->id,
            'status' => $isManualGrant ? 'manual' : $order->status,
            'gateway' => $order?->gateway ?? 'manual',
            'gatewayLabel' => $this->gatewayLabel($order?->gateway ?? 'manual'),
            'paymentChannel' => (string) ($order?->gateway ?? 'manual') === 'cafebazaar' ? 'in_app_purchase' : 'direct_gateway',
            'paymentChannelLabel' => (string) ($order?->gateway ?? 'manual') === 'cafebazaar' ? 'پرداخت درون‌برنامه‌ای بازار' : 'درگاه مستقیم/وب',
            'sandboxMode' => (bool) ($order?->sandbox_mode ?? false),
            'amount' => (int) ($order?->amount ?? $subscription->price_amount),
            'discountAmount' => (int) ($order?->discount_amount ?? max(0, $subscription->price_amount - $subscription->payable_amount)),
            'payableAmount' => (int) ($order?->payable_amount ?? $subscription->payable_amount),
            'referenceId' => $order?->reference_id,
            'transactionId' => $order?->transaction_id,
            'discountCode' => $order?->discount_code,
            'discountCodeSnapshot' => $order?->discount_code_snapshot,
            'metaJson' => [
                'subscription' => $subscription->meta_json,
                'payment' => $order?->meta_json,
            ],
            'failureReason' => $order?->failure_reason,
            'createdAt' => $subscription->created_at?->toIso8601String(),
            'paidAt' => $order?->paid_at?->toIso8601String(),
            'expiresAt' => $order?->expires_at?->toIso8601String(),
            'package' => $subscription->relationLoaded('package') && $subscription->package ? $this->serializePackage($subscription->package) : null,
            'subscription' => $this->serializeSubscription($subscription),
            'user' => $subscription->relationLoaded('user') && $subscription->user ? [
                'id' => (string) $subscription->user->id,
                'name' => $subscription->user->name,
                'mobile' => $subscription->user->mobile,
            ] : null,
        ];
    }

    public function markSuccessful(NutritionPackageOrder $order, string $referenceId): NutritionPackageOrder
    {
        return DB::transaction(function () use ($order, $referenceId): NutritionPackageOrder {
            $locked = NutritionPackageOrder::query()->with('package')->lockForUpdate()->findOrFail($order->id);

            if ($locked->status === 'paid') {
                return $locked;
            }

            TenantUser::query()->lockForUpdate()->findOrFail($locked->user_id);

            $locked->update([
                'status' => 'paid',
                'reference_id' => $referenceId,
                'paid_at' => now(),
                'failure_reason' => null,
            ]);

            NutritionPackageSubscription::query()
                ->where('user_id', $locked->user_id)
                ->where('status', 'active')
                ->update(['status' => 'expired']);

            $package = $locked->package()->firstOrFail();

            $subscription = NutritionPackageSubscription::query()->create([
                'user_id' => $locked->user_id,
                'nutrition_package_id' => $package->id,
                'nutrition_package_order_id' => $locked->id,
                'status' => 'active',
                'starts_at' => now()->toDateString(),
                'ends_at' => now()->addDays((int) $package->duration_days)->toDateString(),
                'online_diet_total' => (int) $package->online_diet_count,
                'online_diet_used' => 0,
                'offline_diet_total' => (int) $package->offline_diet_count,
                'offline_diet_used' => 0,
                'price_amount' => (int) $locked->amount,
                'payable_amount' => (int) $locked->payable_amount,
                'meta_json' => [
                    'discount_code' => $locked->discount_code,
                ],
            ]);

            NutritionProfile::query()
                ->where('user_id', $locked->user_id)
                ->update([
                    'selected_nutrition_package_id' => $package->id,
                    'package_selected_at' => now(),
                ]);

            if ($this->featureModules->isActive(tenant(), 'custom-landing')) {
                $this->customLanding->recordNutritionPackagePayment($locked->fresh());
            }

            $locked->subscription()->save($subscription);

            return $locked->fresh(['package', 'subscription', 'discountCode']);
        });
    }

    private function ensurePurchasablePackage(NutritionPackage $package): NutritionPackage
    {
        $package->loadMissing('children');

        if (! $package->is_active) {
            throw ValidationException::withMessages([
                'package' => 'این پکیج در حال حاضر غیرفعال است.',
            ]);
        }

        if ($package->children()->exists()) {
            throw ValidationException::withMessages([
                'package' => 'ابتدا یکی از زیرمجموعه‌های این پکیج را انتخاب کنید.',
            ]);
        }

        return $package;
    }

    private function resolveGatewaySelection(array $settings, string $selected): string
    {
        if (($settings['maliart_enabled'] ?? false) === true) {
            return 'maliart';
        }

        if ($settings['sandbox_enabled']) {
            return 'sandbox';
        }

        if (! $settings['enabled']) {
            throw ValidationException::withMessages([
                'payment' => 'پرداخت آنلاین برای این سامانه فعال نیست.',
            ]);
        }

        if ($selected !== '' && in_array($selected, $settings['enabled_gateways'], true)) {
            return $selected;
        }

        $fallback = (string) ($settings['provider'] ?? ($settings['enabled_gateways'][0] ?? ''));

        if ($fallback === '' || ! in_array($fallback, $settings['enabled_gateways'], true)) {
            throw ValidationException::withMessages([
                'gateway' => 'هیچ درگاه فعالی برای پرداخت آنلاین پیدا نشد.',
            ]);
        }

        return $fallback;
    }

    private function serializePackage(NutritionPackage $package): array
    {
        return [
            'id' => (string) $package->id,
            'name' => $package->name,
            'slug' => $package->slug,
            'description' => $package->description,
            'imageUrl' => $this->tenantMediaUrl($package->image_path),
            'onlineDietCount' => (int) $package->online_diet_count,
            'offlineDietCount' => (int) $package->offline_diet_count,
            'durationDays' => (int) $package->duration_days,
            'priceAmount' => (int) $package->price_amount,
            'discountedPriceAmount' => $package->discounted_price_amount !== null ? (int) $package->discounted_price_amount : null,
            'cafebazaarProductId' => $package->cafebazaar_product_id,
        ];
    }

    private function tenantMediaUrl(?string $path): ?string
    {
        $relativePath = ltrim((string) $path, '/');

        if ($relativePath === '') {
            return null;
        }

        return tenant() ? tenant_asset($relativePath) : Storage::disk('media_public')->url($relativePath);
    }

    private function makeInvoiceNumber(): string
    {
        return 'NPK-' . now()->format('Ymd') . '-' . Str::upper(Str::random(6));
    }

    private function gatewayLabel(?string $gateway): string
    {
        return match ((string) $gateway) {
            'cafebazaar' => 'کافه‌بازار',
            'maliart' => 'درگاه مستقیم',
            'sandbox' => 'سندباکس',
            'free' => 'رایگان',
            'manual' => 'ثبت دستی',
            '' => '—',
            default => (string) $gateway,
        };
    }
}
