<?php

declare(strict_types=1);

namespace App\Http\Controllers\Landing;

use App\Domain\Landing\Models\LandingCustomer;
use App\Domain\Landing\Models\LandingOrder;
use App\Domain\Landing\Models\LandingOrderPayment;
use App\Domain\Landing\Models\LandingSite;
use App\Domain\Landing\Models\LandingSiteDomain;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Http\Controllers\Controller;
use App\Services\Landing\LandingCheckoutPricingService;
use App\Services\Landing\LandingCustomerService;
use App\Services\Landing\LandingDomainAvailabilityService;
use App\Services\Landing\LandingOrderService;
use App\Services\Landing\LandingOrderPaymentService;
use App\Services\DiscountCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class LandingOrderController extends Controller
{
    public function __construct(
        private readonly LandingCheckoutPricingService $pricing,
        private readonly LandingDomainAvailabilityService $domains,
        private readonly LandingCustomerService $customers,
        private readonly LandingOrderService $orders,
        private readonly LandingOrderPaymentService $payments,
        private readonly DiscountCodeService $discountCodes,
    ) {
    }

    public function preview(Request $request): JsonResponse
    {
        $landingSite = $this->resolveLandingSite($request);
        $customer = $this->resolveCustomerOrFail($request);

        $validated = $request->validate([
            'subscription_package_id' => ['required', 'integer', 'exists:central.subscription_packages,id'],
            'use_own_domain' => ['nullable', 'boolean'],
            'requested_domain' => ['nullable', 'string', 'max:255'],
            'discount_code' => ['nullable', 'string', 'max:80'],
        ]);

        if (blank($customer->first_name) || blank($customer->last_name)) {
            throw ValidationException::withMessages([
                'profile' => 'قبل از ادامه، نام و نام خانوادگی خود را کامل کنید.',
            ]);
        }

        $package = SubscriptionPackage::query()
            ->with('audiencePrices')
            ->where('is_active', true)
            ->customerPurchasable()
            ->findOrFail($validated['subscription_package_id']);

        $useOwnDomain = (bool) ($validated['use_own_domain'] ?? false);
        $requestedDomain = $this->domains->normalizeDomain((string) ($validated['requested_domain'] ?? ''));
        $domainInspection = null;

        if (! $useOwnDomain && $requestedDomain !== '') {
            $domainInspection = $this->domains->inspect($requestedDomain);

            if (! $domainInspection['available']) {
                throw ValidationException::withMessages([
                    'requested_domain' => (string) ($domainInspection['message'] ?? 'امکان ثبت این دامنه وجود ندارد.'),
                ]);
            }
        }

        $quote = $this->pricing->quote(
            $landingSite->audienceType()->firstOrFail(),
            $package,
            $useOwnDomain ? null : $requestedDomain,
            $landingSite,
        );

        if ($useOwnDomain) {
            $quote['domainAmount'] = 0;
            $quote['subtotalAmount'] = (int) $quote['packageAmount'] + (int) $quote['setupAmount'];
            $quote['totalAmount'] = max(0, (int) $quote['subtotalAmount']);
            $quote['domainTld'] = $requestedDomain !== '' ? $this->domains->extractTld($requestedDomain) : null;
        }
        $discount = $this->discountCodes->resolveForLanding(
            $validated['discount_code'] ?? null,
            $landingSite->audienceType()->firstOrFail(),
            (int) $quote['totalAmount'],
        );
        $quote['totalAmount'] = (int) $discount['payableAmount'];

        return response()->json([
            'success' => true,
            'data' => [
                'quote' => [
                    'package' => [
                        'id' => (string) $package->id,
                        'name' => $package->name,
                        'durationDays' => (int) $package->duration_days,
                        'userLimit' => $package->user_limit !== null ? (int) $package->user_limit : null,
                        'userLimitLabel' => $package->userLimitLabel(),
                        'payableAmount' => (int) $quote['packageAmount'],
                    ],
                    'setupFee' => [
                        'label' => (string) $quote['setupLabel'],
                        'amount' => (int) $quote['setupAmount'],
                    ],
                    'smsCreditGift' => [
                        'amount' => (int) ($quote['smsCreditGiftAmount'] ?? 0),
                    ],
                    'domain' => [
                        'name' => $requestedDomain !== '' ? $requestedDomain : null,
                        'tld' => $quote['domainTld'] ?? '.ir',
                        'amount' => (int) $quote['domainAmount'],
                        'usesOwnDomain' => $useOwnDomain,
                        'inspection' => $domainInspection,
                    ],
                    'subtotalAmount' => (int) $quote['subtotalAmount'],
                    'totalAmount' => (int) $quote['totalAmount'],
                    'discountCode' => $discount['code'],
                    'currency' => (string) $quote['currency'],
                    'gatewaySettings' => [
                        'enabled' => (bool) $this->payments->settings()['enabled'],
                        'sandboxEnabled' => (bool) $this->payments->settings()['sandbox_enabled'],
                        'provider' => $this->payments->settings()['provider'],
                        'enabledGateways' => $this->payments->settings()['enabled_gateways'],
                    ],
                ],
            ],
        ]);
    }

    public function checkout(Request $request): JsonResponse
    {
        $landingSite = $this->resolveLandingSite($request);
        $customer = $this->resolveCustomerOrFail($request);

        $validated = $request->validate([
            'subscription_package_id' => ['required', 'integer', 'exists:central.subscription_packages,id'],
            'use_own_domain' => ['nullable', 'boolean'],
            'requested_domain' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'gateway' => ['nullable', 'in:'.implode(',', \App\Support\TenantPaymentGateways::supportedKeys())],
            'discount_code' => ['nullable', 'string', 'max:80'],
        ]);

        if (blank($customer->first_name) || blank($customer->last_name)) {
            throw ValidationException::withMessages([
                'profile' => 'قبل از پرداخت، نام و نام خانوادگی خود را کامل کنید.',
            ]);
        }

        $package = SubscriptionPackage::query()
            ->with('audiencePrices')
            ->where('is_active', true)
            ->customerPurchasable()
            ->findOrFail($validated['subscription_package_id']);

        $pricing = $this->pricing->quote(
            $landingSite->audienceType()->firstOrFail(),
            $package,
            (bool) ($validated['use_own_domain'] ?? false) ? null : ($validated['requested_domain'] ?? null),
            $landingSite,
        );
        if ((bool) ($validated['use_own_domain'] ?? false)) {
            $pricing['domainAmount'] = 0;
            $pricing['subtotalAmount'] = (int) $pricing['packageAmount'] + (int) $pricing['setupAmount'];
            $pricing['totalAmount'] = max(0, (int) $pricing['subtotalAmount']);
        }
        $discount = $this->discountCodes->resolveForLanding(
            $validated['discount_code'] ?? null,
            $landingSite->audienceType()->firstOrFail(),
            (int) $pricing['totalAmount'],
        );
        $callback = $request->getSchemeAndHttpHost().route('landing.orders.payments.callback', ['payment' => '__PAYMENT__'], false);
        $result = $this->payments->createPayment(
            $landingSite,
            $customer,
            $package,
            array_merge($validated, ['discount' => $discount['code'] ? array_merge($discount['code'], ['baseAmount' => $discount['baseAmount'], 'payableAmount' => $discount['payableAmount']]) : null]),
            $callback,
            isset($validated['gateway']) ? (string) $validated['gateway'] : null,
        );

        return response()->json([
            'success' => true,
            'data' => [
                'mode' => $result['mode'],
                'order' => $this->serializeOrder($result['order']),
                'payment' => $this->payments->serializePayment($result['payment']),
                'paymentUrl' => $result['paymentUrl'] ?? null,
                'redirectForm' => $result['redirectForm'] ?? null,
            ],
            'message' => $result['mode'] === 'sandbox'
                ? 'سفارش شما ثبت شد و در حالت تست پرداخت تایید شد.'
                : 'درگاه پرداخت آماده شد.',
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        $landingSite = $this->resolveLandingSite($request);
        $customer = $this->resolveCustomerOrFail($request);
        $perPage = max(1, min(20, (int) $request->integer('perPage', 10)));

        $orders = LandingOrder::query()
            ->where('landing_customer_id', $customer->id)
            ->where('landing_site_id', $landingSite->id)
            ->with(['items', 'payments', 'subscriptionPackage'])
            ->latest('id')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => collect($orders->items())
                    ->map(fn (LandingOrder $order): array => $this->serializeOrder($order))
                    ->values()
                    ->all(),
                'currentPage' => $orders->currentPage(),
                'lastPage' => $orders->lastPage(),
                'perPage' => $orders->perPage(),
                'total' => $orders->total(),
            ],
        ]);
    }

    public function show(Request $request, LandingOrder $order): JsonResponse
    {
        $landingSite = $this->resolveLandingSite($request);
        $customer = $this->resolveCustomerOrFail($request);

        abort_unless(
            (int) $order->landing_customer_id === (int) $customer->id
            && (int) $order->landing_site_id === (int) $landingSite->id,
            404,
        );

        $order->load(['items', 'payments', 'subscriptionPackage']);

        return response()->json([
            'success' => true,
            'data' => $this->serializeOrder($order),
        ]);
    }

    public function complete(Request $request, LandingOrder $order): JsonResponse
    {
        $landingSite = $this->resolveLandingSite($request);
        $customer = $this->resolveCustomerOrFail($request);

        abort_unless(
            (int) $order->landing_customer_id === (int) $customer->id
            && (int) $order->landing_site_id === (int) $landingSite->id,
            404,
        );

        $usesOwnDomain = (bool) data_get($order->meta_json, 'usesOwnDomain', false);
        $requiresDomain = $usesOwnDomain || (int) $order->domain_price_amount > 0;

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:120'],
            'last_name' => ['required', 'string', 'max:120'],
            'requested_domain' => array_filter([
                $requiresDomain ? 'required' : 'nullable',
                'string',
                'max:255',
                'regex:/^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i',
            ]),
            'use_own_domain' => ['nullable', 'boolean'],
            'email' => ['required', 'email', 'max:255', 'unique:central.landing_customers,email,'.$customer->id],
            'province_id' => ['required', 'integer'],
            'province_name' => ['required', 'string', 'max:120'],
            'city_id' => ['required', 'integer'],
            'city_name' => ['required', 'string', 'max:120'],
            'address_line' => ['required', 'string', 'max:4000'],
            'national_code' => ['required', 'digits:10', 'unique:central.landing_customers,national_code,'.$customer->id],
            'gender' => ['required', 'in:male,female'],
        ], [
            'requested_domain.regex' => 'نام دامنه باید فقط با حروف انگلیسی، اعداد، خط تیره و پسوند معتبر وارد شود.',
            'requested_domain.required' => 'وارد کردن نام دامنه الزامی است.',
            'first_name.required' => 'وارد کردن نام الزامی است.',
            'last_name.required' => 'وارد کردن نام خانوادگی الزامی است.',
            'email.required' => 'وارد کردن آدرس ایمیل الزامی است.',
            'email.email' => 'آدرس ایمیل واردشده معتبر نیست.',
            'email.unique' => 'این آدرس ایمیل قبلاً ثبت شده است؛ لطفاً ایمیل دیگری وارد کنید.',
            'province_id.required' => 'انتخاب استان الزامی است.',
            'city_id.required' => 'انتخاب شهر الزامی است.',
            'address_line.required' => 'وارد کردن آدرس محل سکونت الزامی است.',
            'national_code.required' => 'وارد کردن کد ملی الزامی است.',
            'national_code.digits' => 'کد ملی باید دقیقاً ۱۰ رقم باشد.',
            'national_code.unique' => 'این کد ملی قبلاً ثبت شده است.',
            'gender.required' => 'انتخاب جنسیت الزامی است.',
            'gender.in' => 'مقدار انتخاب‌شده برای جنسیت معتبر نیست.',
        ]);

        $usesOwnDomain = (bool) ($validated['use_own_domain'] ?? $usesOwnDomain);
        if (! $usesOwnDomain && filled($validated['requested_domain'] ?? null)) {
            $domainInspection = $this->domains->inspect((string) $validated['requested_domain']);
            if (! $domainInspection['available']) {
                throw ValidationException::withMessages([
                    'requested_domain' => (string) ($domainInspection['message'] ?? 'این دامنه قبلاً ثبت شده است؛ لطفاً دامنه دیگری انتخاب کنید.'),
                ]);
            }
        }

        $customer = $this->customers->updateProfile($customer, $validated);
        $order = $this->orders->completeOrder($order, $customer, $validated);

        $message = 'اطلاعات سفارش شما ثبت شد و برای ادامه فرایند ایجاد سیستم بررسی می‌شود.';

        if (! $usesOwnDomain && filled($validated['requested_domain'] ?? null) && in_array($order->requested_domain_whois_status, ['registered', 'unavailable', 'taken'], true)) {
            $message = 'اطلاعات سفارش شما ثبت شد. اگر دامنه انتخابی قبلا ثبت شده باشد، تیم فروش با شما تماس می‌گیرند.';
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $this->serializeOrder($order),
        ]);
    }

    public function domainAvailability(Request $request, LandingOrder $order): JsonResponse
    {
        $landingSite = $this->resolveLandingSite($request);
        $customer = $this->resolveCustomerOrFail($request);

        abort_unless(
            (int) $order->landing_customer_id === (int) $customer->id
            && (int) $order->landing_site_id === (int) $landingSite->id,
            404,
        );

        $validated = $request->validate([
            'domain' => ['required', 'string', 'max:255'],
        ]);
        $inspection = $this->domains->inspect((string) $validated['domain']);

        return response()->json([
            'success' => true,
            'data' => [
                'domain' => $inspection['domain'] ?? $validated['domain'],
                'available' => (bool) ($inspection['available'] ?? false),
                'status' => (string) ($inspection['status'] ?? 'unknown'),
                'message' => (string) ($inspection['message'] ?? ((bool) ($inspection['available'] ?? false) ? 'این دامنه آزاد و قابل ثبت است.' : 'این دامنه قبلاً ثبت شده است؛ لطفاً دامنه دیگری انتخاب کنید.')),
            ],
        ]);
    }

    public function callback(Request $request, LandingOrderPayment $payment): RedirectResponse
    {
        $payment->loadMissing('order');

        if ((string) $payment->gateway !== 'maliart' && $request->has('Status') && strtoupper((string) $request->query('Status')) !== 'OK') {
            $this->payments->markCancelled($payment, 'پرداخت توسط کاربر لغو شد.');

            return redirect('/landing-preview/orders?status=failed&message='.urlencode('پرداخت توسط کاربر لغو شد.').'&order='.urlencode($payment->order->order_number).'&oid='.urlencode((string) $payment->order->id));
        }

        try {
            $order = $this->payments->verify($payment);
            $payment->refresh();

            return redirect('/landing-preview/orders?status=success&order='.urlencode($order->order_number).'&oid='.urlencode((string) $order->id).'&tracking='.urlencode((string) ($payment->reference_id ?: $payment->invoice_number)));
        } catch (\Throwable $exception) {
            return redirect('/landing-preview/orders?status=failed&message='.urlencode($exception->getMessage()).'&order='.urlencode($payment->order->order_number).'&oid='.urlencode((string) $payment->order->id));
        }
    }

    private function resolveLandingSite(Request $request): LandingSite
    {
        $domain = LandingSiteDomain::query()
            ->with('landingSite.audienceType')
            ->where('domain', $request->getHost())
            ->where('status', 'active')
            ->first();

        abort_unless($domain !== null && $domain->landingSite !== null, 404);

        return $domain->landingSite;
    }

    private function resolveCustomerOrFail(Request $request): LandingCustomer
    {
        $id = $request->session()->get(LandingCustomerAuthController::sessionKey());
        abort_unless($id, 401, 'برای ادامه ابتدا وارد حساب کاربری شوید.');

        $customer = LandingCustomer::query()->find($id);
        abort_unless($customer !== null, 401, 'جلسه شما منقضی شده است.');

        return $customer;
    }

    private function serializeOrder(LandingOrder $order): array
    {
        $order->loadMissing(['items', 'payments', 'subscriptionPackage', 'tenant.domains']);
        $payment = $order->payments->sortByDesc('id')->first();
        $siteDomain = $order->tenant?->domains?->first()?->domain;
        $siteUrl = $siteDomain
            ? (str_ends_with((string) $siteDomain, '.test') ? 'http://' : 'https://').$siteDomain
            : null;

        return [
            'id' => (string) $order->id,
            'orderNumber' => $order->order_number,
            'status' => $order->status,
            'statusLabel' => $this->statusLabel($order->status),
            'requestedDomain' => $order->requested_domain,
            'requestedDomainTld' => $order->requested_domain_tld,
            'usesOwnDomain' => (bool) data_get($order->meta_json, 'usesOwnDomain', false),
            'completionSubmittedAt' => data_get($order->meta_json, 'completionSubmittedAt'),
            'customerFullName' => $order->customer_full_name,
            'customerMobile' => $order->customer_mobile,
            'customerEmail' => $order->customer_email,
            'customerGender' => $order->customer_gender,
            'customerNationalCode' => $order->customer_national_code,
            'customerProvinceName' => $order->customer_province_name,
            'customerCityName' => $order->customer_city_name,
            'customerAddressLine' => $order->customer_address_line,
            'totalAmount' => (int) $order->total_amount,
            'subtotalAmount' => (int) $order->subtotal_amount,
            'setupFeeAmount' => (int) $order->setup_fee_amount,
            'domainPriceAmount' => (int) $order->domain_price_amount,
            'packagePriceAmount' => (int) $order->package_price_amount,
            'currency' => $order->currency,
            'createdAt' => $order->created_at?->toIso8601String(),
            'paidAt' => $payment?->paid_at?->toIso8601String(),
            'provisionedAt' => $order->provisioned_at?->toIso8601String(),
            'siteUrl' => $siteUrl,
            'package' => [
                'id' => (string) $order->subscriptionPackage?->id,
                'name' => $order->subscriptionPackage?->name,
                'durationDays' => $order->duration_days,
                'userLimit' => $order->requested_user_limit,
                'userLimitLabel' => $order->subscriptionPackage?->userLimitLabel(),
            ],
            'items' => $order->items->map(fn ($item): array => [
                'id' => (string) $item->id,
                'title' => $item->title,
                'description' => $item->description,
                'type' => $item->type,
                'quantity' => (int) $item->quantity,
                'unitAmount' => (int) $item->unit_amount,
                'totalAmount' => (int) $item->total_amount,
            ])->values()->all(),
            'payment' => $payment ? $this->payments->serializePayment($payment) : null,
        ];
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            LandingOrder::STATUS_PENDING_PAYMENT => 'در انتظار پرداخت',
            LandingOrder::STATUS_PAID => 'پرداخت شده',
            LandingOrder::STATUS_AWAITING_APPROVAL => 'در انتظار تایید مدیر',
            LandingOrder::STATUS_APPROVED => 'تایید شده',
            LandingOrder::STATUS_PROVISIONING => 'در حال ایجاد سیستم',
            LandingOrder::STATUS_PROVISIONED => 'سیستم ایجاد شد',
            LandingOrder::STATUS_REJECTED => 'رد شده',
            LandingOrder::STATUS_CANCELLED => 'لغو شده',
            default => 'پیش‌نویس',
        };
    }
}
