<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\AudienceType;
use App\Domain\Tenant\Models\Domain;
use App\Domain\Landing\Models\AudienceCheckoutSetting;
use App\Domain\Landing\Models\DomainTldPrice;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Domain\Tenant\Models\FeatureModule;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantSubscriptionRenewal;
use App\Domain\Tenant\Models\TenantSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Domain\Tenant\Models\UserNotification;
use App\Domain\Booking\Models\Appointment;
use App\Domain\Booking\Models\Barber;
use App\Domain\Store\Models\StoreOrder;
use App\Domain\Store\Models\StoreProductReview;
use App\Domain\Tenant\Models\TenantFeatureModule;
use App\Domain\Tenant\Models\NutritionTokenLedger;
use App\Domain\Tenant\Models\NutritionTokenWallet;
use App\Domain\Tenant\Models\PaymentSetting;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Domain\Support\Models\SupportTicket;
use App\Http\Controllers\Controller;
use App\Models\AdminActionLog;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\ReferralService;
use App\Services\SalesTrackingService;
use App\Services\CustomerClubService;
use App\Services\NutritionTokenService;
use App\Services\TenantProvisioningService;
use App\Services\TenantFeatureModuleManager;
use App\Services\TenantStorageService;
use App\Services\UserNotificationRealtimeService;
use App\Services\VipFeatureService;
use App\Support\DomainTldCatalog;
use App\Support\OpenAiSettings;
use App\Support\TenantPaymentGateways;
use App\Support\TenantStorageSettings;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\View\View;
use Illuminate\Validation\Rule;

class TenantManagementController extends Controller
{
    public function __construct(
        private readonly TenantProvisioningService $tenantProvisioningService,
        private readonly TenantStorageService $tenantStorageService,
        private readonly ReferralService $referralService,
        private readonly SalesTrackingService $salesTracking,
        private readonly VipFeatureService $vipFeatureService,
        private readonly CustomerClubService $customerClubService,
        private readonly UserNotificationRealtimeService $notificationRealtime,
        private readonly TenantFeatureModuleManager $tenantFeatureModules,
    )
    {
    }

    public function index(): View
    {
        return view('admin.tenants.index', [
            'tenants' => Tenant::query()->with(['domains', 'owner', 'subscriptionPackage', 'audienceType'])->latest()->paginate(10),
            'packages' => SubscriptionPackage::query()->where('is_active', true)->orderBy('sort_order')->orderBy('duration_days')->orderByRaw('CASE WHEN user_limit IS NULL THEN 999999 ELSE user_limit END')->get(),
            'panelAccessHistory' => AdminActionLog::tableExists()
                ? AdminActionLog::query()
                    ->with(['actor', 'tenant'])
                    ->whereIn('action_type', ['tenant_panel_locked', 'tenant_panel_unlocked'])
                    ->latest('occurred_at')
                    ->limit(20)
                    ->get()
                : new EloquentCollection(),
            'sandboxHistory' => AdminActionLog::tableExists()
                ? AdminActionLog::query()
                    ->with(['actor', 'tenant'])
                    ->where('action_type', 'tenant_sandbox_modes_updated')
                    ->latest('occurred_at')
                    ->limit(20)
                    ->get()
                : new EloquentCollection(),
            'historyLoggingAvailable' => AdminActionLog::tableExists(),
        ]);
    }

    public function create(): View
    {
        $selectedAudienceId = old('audience_type_id');
        DomainTldCatalog::ensureSeeded();
        $defaultStorageQuotaGb = $this->defaultStorageQuotaGb();

        return view('admin.tenants.form', [
            'tenant' => new Tenant([
                'status' => 'active',
                'domain_management_mode' => 'platform_managed',
                'managed_domain_tld' => '.ir',
            ]),
            'databaseName' => '',
            'primaryDomain' => null,
            'owners' => User::query()->whereIn('role', ['barber', 'admin'])->orderBy('name')->get(),
            'packages' => SubscriptionPackage::query()->where('is_active', true)->orderBy('sort_order')->orderBy('duration_days')->orderByRaw('CASE WHEN user_limit IS NULL THEN 999999 ELSE user_limit END')->get(),
            'audiences' => AudienceType::query()->with('checkoutSetting')->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'tldOptions' => DomainTldCatalog::options(),
            'defaultDomainRenewAmount' => $this->defaultDomainRenewAmount('.ir'),
            'storageQuotaOptions' => TenantStorageSettings::quotaGbOptions(),
            'defaultStorageQuotaGb' => $defaultStorageQuotaGb,
            'selectedStorageQuotaGb' => $defaultStorageQuotaGb,
            'nutritionInitialTokenDefault' => OpenAiSettings::nutritionInitialTokenGrant(),
            'featureModules' => FeatureModule::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'selectedFeatureModuleIds' => collect(old('feature_module_ids', []))->map(fn ($id) => (string) $id)->all(),
            'isEdit' => false,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validatePayload($request);

        $slug = $validated['slug'] ?: Str::slug($validated['name']);

        $tenant = Tenant::create([
            'name' => $validated['name'],
            'slug' => $slug,
            'database' => $validated['database'] ?: "tenant_{$slug}",
            'status' => $validated['status'],
            'owner_user_id' => $validated['owner_user_id'],
            'subscription_package_id' => $validated['subscription_package_id'],
            'audience_type_id' => $validated['audience_type_id'],
            'support_ends_at' => $validated['support_ends_at'],
            ...$validated['domain_attributes'],
            'payment_overrides' => [
                'maliart_enabled' => $request->user()?->role === 'admin'
                    && (bool) ($validated['maliart_payment_enabled'] ?? false),
            ],
        ]);

        $tenant->createDomain($validated['domain']);
        $this->tenantProvisioningService->provisionUsersAndRoles($tenant->fresh(['owner']));
        $this->tenantProvisioningService->provisionStorageSettings($tenant, (int) $validated['storage_quota_gb']);
        $this->tenantProvisioningService->provisionDefaultSmsSettings($tenant);
        $this->tenantProvisioningService->applyPackageSmsCreditGift(
            $tenant,
            $tenant->fresh('subscriptionPackage')->subscriptionPackage,
            [
                'source_type' => 'manual_tenant_sms_gift',
                'source_id' => (string) $tenant->id,
                'tenant_id' => (string) $tenant->id,
                'title' => 'هزینه شارژ هدیه پیامک برای ایجاد دستی سامانه',
                'occurred_at' => $tenant->created_at ?? now(),
                'meta' => [
                    'created_via' => 'admin_tenant_management',
                ],
            ],
        );
        $this->grantInitialNutritionTokens($tenant->fresh(['audienceType']), (int) ($validated['nutrition_initial_tokens'] ?? 0), $request->user());
        $this->salesTracking->trackTenantSetupCommission($tenant->fresh(['owner', 'audienceType.checkoutSetting']), $tenant->owner);
        $this->referralService->applyRewardForPurchasedTenant($tenant->fresh(['owner', 'subscriptionPackage']));
        $activationErrors = $this->activateSelectedFeatureModules($tenant, $validated['feature_module_ids'], $request);

        $redirect = redirect()
            ->route('admin.tenants.index')
            ->with('success', 'سامانه نوبت‌دهی و دامنه با موفقیت ایجاد شدند.');

        if ($activationErrors !== []) {
            $redirect->with('error', 'سامانه ساخته شد، اما نصب بعضی ماژول‌ها خطا داشت: '.implode(' | ', $activationErrors));
        }

        return $redirect;
    }

    public function edit(Tenant $tenant): View
    {
        $selectedAudienceId = old('audience_type_id', $tenant->audience_type_id);
        DomainTldCatalog::ensureSeeded();
        $defaultStorageQuotaGb = $this->defaultStorageQuotaGb();
        $selectedStorageQuotaGb = $this->tenantStorageQuotaGb($tenant) ?? $defaultStorageQuotaGb;

        return view('admin.tenants.form', [
            'tenant' => $tenant->load(['domains', 'subscriptionRenewals.subscriptionPackage', 'subscriptionRenewals.renewedBy']),
            'databaseName' => (string) ($tenant->getAttributes()['database'] ?? ''),
            'primaryDomain' => $tenant->domains->first(),
            'owners' => User::query()->whereIn('role', ['barber', 'admin'])->orderBy('name')->get(),
            'packages' => SubscriptionPackage::query()->where('is_active', true)->orderBy('sort_order')->orderBy('duration_days')->orderByRaw('CASE WHEN user_limit IS NULL THEN 999999 ELSE user_limit END')->get(),
            'audiences' => AudienceType::query()->with('checkoutSetting')->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'tldOptions' => DomainTldCatalog::options(),
            'defaultDomainRenewAmount' => $this->defaultDomainRenewAmount((string) ($tenant->managed_domain_tld ?: '.ir')),
            'storageQuotaOptions' => TenantStorageSettings::quotaGbOptions(),
            'defaultStorageQuotaGb' => $defaultStorageQuotaGb,
            'selectedStorageQuotaGb' => $selectedStorageQuotaGb,
            'nutritionInitialTokenDefault' => OpenAiSettings::nutritionInitialTokenGrant(),
            'featureModules' => FeatureModule::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'selectedFeatureModuleIds' => $tenant->featureModules()->pluck('feature_module_id')->map(fn ($id) => (string) $id)->all(),
            'isEdit' => true,
        ]);
    }

    public function show(Tenant $tenant): View
    {
        $tenant->load(['domains', 'owner', 'subscriptionPackage', 'audienceType', 'subscriptionRenewals.subscriptionPackage', 'subscriptionRenewals.renewedBy']);
        $isNutritionTenant = $this->isNutritionAudienceSlug($tenant->audienceType?->slug);

        $metrics = $tenant->run(function (): array {
            $today = now()->toDateString();
            $yesterday = now()->subDay()->toDateString();
            $startOfMonth = now()->startOfMonth()->toDateString();

            $storePaidStatuses = ['paid', 'processing', 'shipped', 'delivered'];
            $storeOpenStatuses = ['pending_payment', 'awaiting_card_transfer', 'placed', 'processing'];

            return [
                'customers_count' => TenantUser::query()->where('role', 'customer')->count(),
                'operators_count' => Barber::query()->count(),
                'appointments_total' => Appointment::query()->count(),
                'appointments_month' => Appointment::query()->whereDate('appointment_date', '>=', $startOfMonth)->count(),
                'appointments_today' => Appointment::query()->whereDate('appointment_date', $today)->count(),
                'appointments_yesterday' => Appointment::query()->whereDate('appointment_date', $yesterday)->count(),
                'amount_total' => (int) Appointment::query()
                    ->whereIn('status', ['booked', 'completed', 'no_show'])
                    ->sum('price_amount'),
                'store_orders_total' => StoreOrder::query()->count(),
                'store_orders_open' => StoreOrder::query()->whereIn('status', $storeOpenStatuses)->count(),
                'store_orders_paid' => StoreOrder::query()->whereIn('status', $storePaidStatuses)->count(),
                'store_sales_total' => (int) StoreOrder::query()->whereIn('status', $storePaidStatuses)->sum('total_amount'),
                'store_reviews_total' => StoreProductReview::query()->count(),
                'store_reviews_approved' => StoreProductReview::query()->where('is_approved', true)->count(),
                'store_reviews_pending' => StoreProductReview::query()->where('is_approved', false)->count(),
                'latest_store_orders' => StoreOrder::query()
                    ->latest('id')
                    ->limit(10)
                    ->get(['id', 'order_number', 'status', 'customer_name', 'customer_phone', 'total_amount', 'payment_method', 'created_at'])
                    ->map(fn (StoreOrder $order): array => [
                        'order_number' => (string) $order->order_number,
                        'status' => (string) $order->status,
                        'customer_name' => (string) $order->customer_name,
                        'customer_phone' => (string) $order->customer_phone,
                        'payment_method' => (string) $order->payment_method,
                        'total_amount' => (int) $order->total_amount,
                        'created_at' => optional($order->created_at)?->toDateTimeString(),
                    ])
                    ->values()
                    ->all(),
                'latest_store_reviews' => StoreProductReview::query()
                    ->with('product:id,title')
                    ->latest('id')
                    ->limit(10)
                    ->get()
                    ->map(fn (StoreProductReview $review): array => [
                        'product_title' => (string) ($review->product?->title ?? 'محصول حذف‌شده'),
                        'reviewer_name' => (string) $review->reviewer_name,
                        'rating' => (int) $review->rating,
                        'is_approved' => (bool) $review->is_approved,
                        'created_at' => optional($review->created_at)?->toDateTimeString(),
                    ])
                    ->values()
                    ->all(),
                'notifications_total' => UserNotification::query()->count(),
                'notifications_unread' => UserNotification::query()->where('is_read', false)->count(),
                'latest_notifications' => UserNotification::query()
                    ->latest('id')
                    ->limit(10)
                    ->get(['id', 'title', 'recipient_name', 'recipient_mobile', 'recipient_role', 'is_read', 'created_at'])
                    ->map(fn (UserNotification $notification): array => [
                        'id' => (string) $notification->id,
                        'title' => (string) $notification->title,
                        'recipient_name' => (string) ($notification->recipient_name ?? 'کاربر'),
                        'recipient_mobile' => (string) ($notification->recipient_mobile ?? '—'),
                        'recipient_role' => (string) ($notification->recipient_role ?? 'customer'),
                        'is_read' => (bool) $notification->is_read,
                        'created_at' => optional($notification->created_at)?->toDateTimeString(),
                    ])
                    ->values()
                    ->all(),
            ];
        });

        $tenantModules = TenantFeatureModule::query()
            ->with('featureModule')
            ->where('tenant_id', $tenant->id)
            ->orderBy('expires_at')
            ->get();
        $activeModules = $tenantModules->where('status', 'active')->values();
        $availableFeatureModules = FeatureModule::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $paymentHistory = TenantSubscriptionPayment::query()
            ->with('subscriptionPackage')
            ->where('tenant_id', $tenant->id)
            ->latest('id')
            ->limit(20)
            ->get();

        $supportPaymentsStats = TenantSubscriptionPayment::query()
            ->where('tenant_id', $tenant->id)
            ->where('payment_type', 'support_renewal')
            ->selectRaw('COUNT(*) as total_count')
            ->selectRaw('SUM(CASE WHEN status = "paid" THEN payable_amount ELSE 0 END) as paid_total')
            ->first();
        $storageUsage = $this->tenantStorageService->usage($tenant);
        $nutritionTokenSummary = $isNutritionTenant ? $this->nutritionTokenSummary($tenant) : null;
        $usesCentralMaliart = $tenant->usesCentralMaliartGateway();
        $tenantPaymentGatewayReport = $tenant->run(function (): array {
            $payment = PaymentSetting::query()->first();
            $credentials = $payment?->credentials ?? [];
            $gateways = TenantPaymentGateways::normalized($credentials['gateways'] ?? []);
            $enabledGatewayKeys = (bool) ($payment?->enabled ?? false)
                ? TenantPaymentGateways::configuredEnabled($gateways)
                : [];
            $definitions = TenantPaymentGateways::definitions();

            return [
                'payment_enabled' => (bool) ($payment?->enabled ?? false),
                'provider' => (string) ($payment?->provider ?? ''),
                'enabled_gateway_keys' => $enabledGatewayKeys,
                'enabled_gateway_labels' => collect($enabledGatewayKeys)
                    ->map(fn (string $gateway): string => (string) ($definitions[$gateway]['label'] ?? $gateway))
                    ->values()
                    ->all(),
            ];
        });

        $paymentGatewayReport = [
            ...$tenantPaymentGatewayReport,
            'central_maliart_enabled' => $usesCentralMaliart,
            'effective_gateway_label' => $usesCentralMaliart
                ? 'درگاه مستقیم مرکزی'
                : (implode('، ', $tenantPaymentGatewayReport['enabled_gateway_labels']) ?: 'درگاه فعالی ثبت نشده است'),
        ];

        $primaryDomain = $tenant->domains->first()?->domain;
        $impersonationUrl = null;

        if ($primaryDomain && $tenant->owner_user_id) {
            $signedPath = URL::temporarySignedRoute(
                'tenant.admin.impersonate',
                now()->addMinutes(10),
                [
                    'tenant' => (string) $tenant->id,
                    'central_user' => (int) $tenant->owner_user_id,
                    'redirect' => '/panel',
                ],
                absolute: false,
            );

            $impersonationUrl = request()->getScheme().'://'.$primaryDomain.$signedPath;
        }

        return view('admin.tenants.show', [
            'tenant' => $tenant,
            'metrics' => array_merge($metrics, [
                'support_tickets_count' => SupportTicket::query()->where('tenant_id', $tenant->id)->count(),
            ]),
            'impersonationUrl' => $impersonationUrl,
            'activeModules' => $activeModules,
            'tenantModules' => $tenantModules,
            'availableFeatureModules' => $availableFeatureModules,
            'paymentHistory' => $paymentHistory,
            'supportPaymentsStats' => $supportPaymentsStats,
            'storageUsage' => $storageUsage,
            'nutritionTokenSummary' => $nutritionTokenSummary,
            'paymentGatewayReport' => $paymentGatewayReport,
            'moduleRemovalHistory' => AdminActionLog::tableExists()
                ? AdminActionLog::query()
                    ->with(['actor', 'tenant'])
                    ->where('tenant_id', $tenant->id)
                    ->whereIn('action_type', ['tenant_feature_module_activated', 'tenant_feature_module_deactivated', 'tenant_feature_module_removed'])
                    ->latest('occurred_at')
                    ->limit(20)
                    ->get()
                : new EloquentCollection(),
            'historyLoggingAvailable' => AdminActionLog::tableExists(),
        ]);
    }

    public function adjustNutritionTokens(Request $request, Tenant $tenant): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);
        $tenant->loadMissing('audienceType');
        abort_unless($this->isNutritionAudienceSlug($tenant->audienceType?->slug), 404);

        $validated = $request->validate([
            'direction' => ['required', Rule::in(['credit', 'debit'])],
            'amount' => ['required', 'integer', 'min:1', 'max:100000000'],
            'reason' => ['required', 'string', 'min:3', 'max:1000'],
        ], [
            'direction.required' => 'نوع افزایش یا کاهش اعتبار را انتخاب کنید.',
            'amount.required' => 'مقدار توکن را وارد کنید.',
            'reason.required' => 'دلیل این تغییر را وارد کنید.',
        ]);

        $amount = (int) $validated['amount'];
        $direction = (string) $validated['direction'];
        $reason = trim((string) $validated['reason']);
        $actor = $request->user();

        try {
            $tenant->run(function () use ($tenant, $actor, $amount, $direction, $reason): void {
                abort_unless(Schema::hasTable('nutrition_token_wallets') && Schema::hasTable('nutrition_token_ledgers'), 422, 'جدول کیف پول توکن برای این سایت آماده نیست.');

                $service = app(NutritionTokenService::class);
                $meta = [
                    'source' => 'central_admin_manual_adjustment',
                    'tenant_id' => (string) $tenant->id,
                    'tenant_name' => $tenant->name,
                    'central_actor_id' => $actor?->id,
                    'central_actor_name' => $actor?->name,
                    'central_actor_email' => $actor?->email,
                    'reason' => $reason,
                ];

                if ($direction === 'credit') {
                    $service->creditTokens(
                        amount: $amount,
                        actor: null,
                        reasonTitle: 'افزایش دستی اعتبار توکن توسط مدیر کل',
                        eventType: 'topup',
                        meta: $meta,
                        reasonCode: 'manual_credit',
                    );

                    return;
                }

                $service->debitTokensManually(
                    amount: $amount,
                    actor: null,
                    reasonTitle: 'کاهش دستی اعتبار توکن توسط مدیر کل',
                    meta: $meta,
                );
            });
        } catch (\Throwable $exception) {
            return back()
                ->withInput()
                ->with('error', $exception->getMessage());
        }

        if (AdminActionLog::tableExists()) {
            AdminActionLog::query()->create([
                'action_type' => 'tenant_nutrition_tokens_adjusted',
                'actor_user_id' => $actor?->id,
                'tenant_id' => $tenant->id,
                'title' => ($direction === 'credit' ? 'افزایش' : 'کاهش').' اعتبار توکن '.$tenant->name,
                'reason' => $reason,
                'meta_json' => [
                    'tenant_name' => $tenant->name,
                    'direction' => $direction,
                    'amount' => $amount,
                ],
                'occurred_at' => now(),
            ]);
        }

        return redirect()
            ->route('admin.tenants.show', $tenant)
            ->with('success', 'تغییر اعتبار توکن با موفقیت ثبت شد.');
    }

    public function update(Request $request, Tenant $tenant): RedirectResponse
    {
        $primaryDomain = $tenant->domains()->first();
        $validated = $this->validatePayload($request, $tenant, $primaryDomain);

        $slug = $validated['slug'] ?: Str::slug($validated['name']);

        $tenant->update([
            'name' => $validated['name'],
            'slug' => $slug,
            'database' => $validated['database'] ?: "tenant_{$slug}",
            'status' => $validated['status'],
            'owner_user_id' => $validated['owner_user_id'],
            'subscription_package_id' => $validated['subscription_package_id'],
            'audience_type_id' => $validated['audience_type_id'],
            'support_ends_at' => $validated['support_ends_at'],
            ...$validated['domain_attributes'],
            'payment_overrides' => [
                'maliart_enabled' => $request->user()?->role === 'admin'
                    ? (bool) ($validated['maliart_payment_enabled'] ?? false)
                    : (bool) data_get($tenant->getAttribute('payment_overrides'), 'maliart_enabled', false),
            ],
        ]);

        if ($primaryDomain) {
            $primaryDomain->update(['domain' => $validated['domain']]);
        } else {
            $tenant->createDomain($validated['domain']);
        }

        $this->tenantProvisioningService->provisionUsersAndRoles($tenant->fresh(['owner']));
        $this->tenantProvisioningService->provisionStorageSettings($tenant, (int) $validated['storage_quota_gb']);

        return redirect()
            ->route('admin.tenants.index')
            ->with('success', 'سامانه نوبت‌دهی با موفقیت ویرایش شد.');
    }

    public function updatePanelAccess(Request $request, Tenant $tenant): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $validated = $request->validate([
            'panel_access_locked' => ['required', 'boolean'],
            'panel_access_message' => ['nullable', 'string', 'max:2000'],
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ], [
            'reason.required' => 'دلیل این تغییر را وارد کنید.',
        ]);

        $shouldLock = (bool) $validated['panel_access_locked'];
        $customMessage = trim((string) ($validated['panel_access_message'] ?? ''));

        DB::connection('central')->transaction(function () use ($tenant, $request, $shouldLock, $customMessage, $validated): void {
            /** @var Tenant $lockedTenant */
            $lockedTenant = Tenant::query()->lockForUpdate()->findOrFail($tenant->id);
            $previousLocked = $lockedTenant->isPanelAccessLocked();
            $previousMessage = trim($lockedTenant->panelAccessMessage());

            $lockedTenant->setAttribute('panel_access_locked', $shouldLock);
            $lockedTenant->setAttribute('panel_access_message', $shouldLock ? $customMessage : null);
            $lockedTenant->setAttribute('panel_access_locked_at', $shouldLock ? now()->toIso8601String() : null);
            $lockedTenant->setAttribute('panel_access_locked_by_user_id', $shouldLock ? $request->user()?->id : null);
            $lockedTenant->setAttribute('panel_access_last_changed_at', now()->toIso8601String());
            $lockedTenant->setAttribute('panel_access_last_changed_by_user_id', $request->user()?->id);
            $lockedTenant->save();

            if (AdminActionLog::tableExists()) {
                AdminActionLog::query()->create([
                    'action_type' => $shouldLock ? 'tenant_panel_locked' : 'tenant_panel_unlocked',
                    'actor_user_id' => $request->user()?->id,
                    'tenant_id' => $lockedTenant->id,
                    'title' => ($shouldLock ? 'بستن' : 'باز کردن').' دسترسی پنل '.$lockedTenant->name,
                    'reason' => $validated['reason'],
                    'meta_json' => [
                        'tenant_name' => $lockedTenant->name,
                        'previous_panel_access_locked' => $previousLocked,
                        'new_panel_access_locked' => $shouldLock,
                        'previous_panel_access_message' => $previousMessage !== '' ? $previousMessage : null,
                        'new_panel_access_message' => $customMessage !== '' ? $customMessage : null,
                    ],
                    'occurred_at' => now(),
                ]);
            }
        });

        return redirect()
            ->route('admin.tenants.index')
            ->with('success', $shouldLock ? 'دسترسی پنل سامانه با موفقیت بسته شد.' : 'دسترسی پنل سامانه دوباره باز شد.');
    }

    public function updateSandboxModes(Request $request, Tenant $tenant): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $validated = $request->validate([
            'payment_sandbox_enabled' => ['nullable', 'boolean'],
            'sms_sandbox_enabled' => ['nullable', 'boolean'],
            'fixed_login_code_enabled' => ['nullable', 'boolean'],
            'fixed_login_code' => ['nullable', 'digits:4'],
            'note' => ['nullable', 'string', 'max:2000'],
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ], [
            'reason.required' => 'دلیل این تغییر را وارد کنید.',
            'fixed_login_code.digits' => 'کد ورود ثابت باید ۴ رقم باشد.',
        ]);

        $paymentSandboxEnabled = (bool) ($validated['payment_sandbox_enabled'] ?? false);
        $smsSandboxEnabled = (bool) ($validated['sms_sandbox_enabled'] ?? false);
        $fixedLoginCodeEnabled = (bool) ($validated['fixed_login_code_enabled'] ?? false);
        $fixedLoginCode = $fixedLoginCodeEnabled ? trim((string) ($validated['fixed_login_code'] ?? '')) : null;
        $note = trim((string) ($validated['note'] ?? ''));

        if ($fixedLoginCodeEnabled && ! preg_match('/^\d{4}$/', (string) $fixedLoginCode)) {
            return back()
                ->withErrors(['fixed_login_code' => 'برای فعال کردن ورود دمو، کد ۴ رقمی را وارد کنید.'])
                ->withInput();
        }

        DB::connection('central')->transaction(function () use ($tenant, $request, $paymentSandboxEnabled, $smsSandboxEnabled, $fixedLoginCode, $note, $validated): void {
            /** @var Tenant $lockedTenant */
            $lockedTenant = Tenant::query()->lockForUpdate()->findOrFail($tenant->id);
            $previousPaymentSandbox = $lockedTenant->paymentSandboxOverride();
            $previousSmsSandbox = $lockedTenant->smsSandboxOverride();
            $previousFixedLoginCode = $lockedTenant->demoFixedLoginCode();
            $previousNote = $lockedTenant->sandboxOverrideNote();

            $sandboxOverrides = array_filter([
                'payment_enabled' => $paymentSandboxEnabled ? true : null,
                'sms_enabled' => $smsSandboxEnabled ? true : null,
                'note' => $note !== '' ? $note : null,
                'updated_at' => ($paymentSandboxEnabled || $smsSandboxEnabled || $note !== '') ? now()->toIso8601String() : null,
                'updated_by_user_id' => ($paymentSandboxEnabled || $smsSandboxEnabled || $note !== '') ? $request->user()?->id : null,
            ], static fn ($value) => $value !== null);

            $lockedTenant->setAttribute('sandbox_overrides', $sandboxOverrides !== [] ? $sandboxOverrides : null);
            $lockedTenant->setAttribute('demo_auth', [
                'fixed_login_code' => $fixedLoginCode,
                'updated_at' => now()->toIso8601String(),
                'updated_by_user_id' => $request->user()?->id,
            ]);
            $lockedTenant->save();

            if (AdminActionLog::tableExists()) {
                AdminActionLog::query()->create([
                    'action_type' => 'tenant_sandbox_modes_updated',
                    'actor_user_id' => $request->user()?->id,
                    'tenant_id' => $lockedTenant->id,
                    'title' => 'به‌روزرسانی سندباکس پیامک و پرداخت '.$lockedTenant->name,
                    'reason' => $validated['reason'],
                    'meta_json' => [
                        'tenant_name' => $lockedTenant->name,
                        'previous_payment_sandbox_enabled' => $previousPaymentSandbox,
                        'new_payment_sandbox_enabled' => $paymentSandboxEnabled,
                        'previous_sms_sandbox_enabled' => $previousSmsSandbox,
                        'new_sms_sandbox_enabled' => $smsSandboxEnabled,
                        'previous_fixed_login_code' => $previousFixedLoginCode,
                        'new_fixed_login_code' => $fixedLoginCode,
                        'previous_note' => $previousNote,
                        'new_note' => $note !== '' ? $note : null,
                    ],
                    'occurred_at' => now(),
                ]);
            }
        });

        return redirect()
            ->route('admin.tenants.index')
            ->with('success', 'وضعیت سندباکس پیامک و پرداخت سامانه با موفقیت به‌روزرسانی شد.');
    }

    public function removeFeatureModule(Request $request, Tenant $tenant, TenantFeatureModule $tenantFeatureModule): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);
        abort_unless((string) $tenantFeatureModule->tenant_id === (string) $tenant->id, 404);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ], [
            'reason.required' => 'دلیل حذف ماژول را وارد کنید.',
            'reason.min' => 'دلیل حذف ماژول باید حداقل ۵ کاراکتر باشد.',
        ]);

        $this->tenantFeatureModules->deactivate($tenant, $tenantFeatureModule, [
            'actor_user_id' => $request->user()?->id,
            'reason' => $validated['reason'],
            'source' => 'central_admin',
        ]);

        return redirect()
            ->route('admin.tenants.show', $tenant)
            ->with('success', 'ماژول ویژه با موفقیت غیرفعال شد و داده‌های tenant دست‌نخورده باقی ماند.');
    }

    public function activateFeatureModule(Request $request, Tenant $tenant, FeatureModule $featureModule): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $this->tenantFeatureModules->activate($tenant, $featureModule, [
                'actor_user_id' => $request->user()?->id,
                'reason' => $validated['reason'] ?? null,
                'source' => 'central_admin',
            ]);
        } catch (\Throwable $exception) {
            return back()->with('error', 'فعال‌سازی ماژول ناموفق بود: '.$exception->getMessage());
        }

        return redirect()
            ->route('admin.tenants.show', $tenant)
            ->with('success', 'ماژول ویژه با موفقیت فعال شد.');
    }

    public function renew(Request $request, Tenant $tenant): RedirectResponse
    {
        $validated = $request->validate([
            'subscription_package_id' => ['required', 'integer', 'exists:subscription_packages,id'],
        ]);

        $package = SubscriptionPackage::query()->findOrFail($validated['subscription_package_id']);
        $previousSupportEndsAt = $tenant->support_ends_at;
        $baseDate = $previousSupportEndsAt instanceof Carbon && $previousSupportEndsAt->isFuture()
            ? $previousSupportEndsAt->copy()
            : now();
        $newSupportEndsAt = $baseDate->copy()->addDays((int) $package->duration_days)->toDateString();

        $tenant->update([
            'subscription_package_id' => $package->id,
            'support_ends_at' => $newSupportEndsAt,
            'data' => array_merge($tenant->data ?? [], [
                'support_ends_at' => $newSupportEndsAt,
            ]),
        ]);

        TenantSubscriptionRenewal::query()->create([
            'tenant_id' => $tenant->id,
            'subscription_package_id' => $package->id,
            'renewed_by_user_id' => (int) $request->user()->id,
            'duration_days' => (int) $package->duration_days,
            'previous_support_ends_at' => $previousSupportEndsAt?->toDateString(),
            'new_support_ends_at' => $newSupportEndsAt,
        ]);

        return redirect()
            ->route('admin.tenants.index')
            ->with('success', 'تمدید سامانه با موفقیت ثبت شد.');
    }

    public function impersonate(Request $request, Tenant $tenant): RedirectResponse
    {
        $tenant->load(['domains', 'owner']);

        abort_if(! $tenant->owner_user_id, 422, 'برای این سامانه مدیر تعریف نشده است.');

        $primaryDomain = $tenant->domains->first()?->domain;
        abort_if(! $primaryDomain, 422, 'برای این سامانه دامنه اصلی ثبت نشده است.');

        $signedPath = URL::temporarySignedRoute(
            'tenant.admin.impersonate',
            now()->addMinutes(10),
            [
                'tenant' => (string) $tenant->id,
                'central_user' => (int) $tenant->owner_user_id,
                'redirect' => '/panel',
            ],
            absolute: false,
        );

        return redirect()->away(request()->getScheme().'://'.$primaryDomain.$signedPath);
    }

    public function destroy(Request $request, Tenant $tenant): RedirectResponse
    {
        $primaryDomain = $tenant->domains()->first()?->domain;
        $confirmedDomain = trim((string) $request->input('confirmation_domain', ''));

        if ($primaryDomain === null || $confirmedDomain !== $primaryDomain) {
            return back()
                ->withErrors(['confirmation_domain' => 'برای حذف، باید نام دامنه اصلی را دقیقاً مطابق متن وارد کنید.'])
                ->withInput();
        }

        $tenantName = $tenant->name;
        $tenant->delete();

        return redirect()
            ->route('admin.tenants.index')
            ->with('success', "سامانه نوبت‌دهی {$tenantName} و دیتابیس آن با موفقیت حذف شدند.");
    }

    public function confirmDestroy(Tenant $tenant): View
    {
        $tenant->loadMissing(['domains', 'owner', 'audienceType', 'subscriptionPackage']);

        return view('admin.tenants.delete', [
            'tenant' => $tenant,
            'primaryDomain' => $tenant->domains->first()?->domain,
        ]);
    }

    public function sendNotification(Request $request, Tenant $tenant): RedirectResponse
    {
        $validated = $request->validate([
            'target_type' => ['required', Rule::in(['all', 'single'])],
            'target_mobile' => ['nullable', 'regex:/^09\d{9}$/'],
            'recipient_role' => ['nullable', Rule::in(['all', 'customer', 'barber', 'admin'])],
            'title' => ['required', 'string', 'max:180'],
            'message' => ['required', 'string', 'max:5000'],
        ], [
            'target_type.required' => 'نوع گیرنده را انتخاب کنید.',
            'target_mobile.regex' => 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.',
            'title.required' => 'عنوان پیام الزامی است.',
            'message.required' => 'متن پیام الزامی است.',
        ]);

        $targetType = (string) $validated['target_type'];
        $targetMobile = isset($validated['target_mobile']) ? trim((string) $validated['target_mobile']) : '';
        $recipientRole = (string) ($validated['recipient_role'] ?? 'all');

        if ($targetType === 'single' && $targetMobile === '') {
            return back()
                ->withInput()
                ->with('error', 'برای ارسال به یک کاربر، شماره موبایل الزامی است.');
        }

        $sender = $request->user();
        $title = trim((string) $validated['title']);
        $message = trim((string) $validated['message']);
        $audienceName = $tenant->audienceType?->name;
        $audienceSlug = $tenant->audienceType?->slug;

        $inserted = $tenant->run(function () use ($targetType, $targetMobile, $recipientRole, $title, $message, $sender, $audienceName, $audienceSlug): int {
            $query = TenantUser::query()
                ->where('is_active', true);

            if ($targetType === 'single') {
                $query->where('mobile', $targetMobile);
            } elseif ($recipientRole !== 'all') {
                $query->where('role', $recipientRole);
            }

            $recipients = $query
                ->orderBy('id')
                ->get(['id', 'name', 'mobile', 'role']);

            if ($recipients->isEmpty()) {
                return 0;
            }

            $now = now();
            $rows = $recipients->map(fn (TenantUser $recipient): array => [
                'tenant_user_id' => $recipient->id,
                'recipient_mobile' => $recipient->mobile,
                'recipient_name' => $recipient->name,
                'recipient_role' => $recipient->role,
                'title' => $title,
                'message' => $message,
                'sender_central_user_id' => $sender?->id,
                'sender_name' => $sender?->name,
                'target_type' => $targetType,
                'meta' => json_encode([
                    'source' => 'central_admin',
                    'audience_name' => $audienceName,
                    'audience_slug' => $audienceSlug,
                ], JSON_UNESCAPED_UNICODE),
                'is_read' => false,
                'read_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();

            foreach (array_chunk($rows, 500) as $chunk) {
                UserNotification::query()->insert($chunk);
            }

            $this->notificationRealtime->broadcastInboxUpdated(
                $recipients->pluck('id')->all(),
            );

            return count($rows);
        });

        if ($inserted === 0) {
            return back()
                ->withInput()
                ->with('error', 'کاربری با شرایط انتخاب‌شده پیدا نشد.');
        }

        return back()->with('success', "پیام برای {$inserted} کاربر ارسال شد.");
    }

    private function validatePayload(Request $request, ?Tenant $tenant = null, ?Domain $domain = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:tenants,slug,' . ($tenant?->id ?? 'NULL') . ',id'],
            'database' => ['nullable', 'string', 'max:255', 'unique:tenants,database,' . ($tenant?->id ?? 'NULL') . ',id'],
            'domain' => ['required', 'string', 'max:255', 'unique:domains,domain,' . ($domain?->id ?? 'NULL')],
            'status' => ['required', 'in:active,inactive'],
            'owner_user_id' => ['required', 'integer', 'exists:users,id'],
            'subscription_package_id' => ['required', 'integer', 'exists:subscription_packages,id'],
            'audience_type_id' => ['required', 'integer', 'exists:audience_types,id'],
            'nutrition_initial_tokens' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'domain_management_mode' => ['nullable', Rule::in(['platform_managed', 'self_managed'])],
            'managed_domain_tld' => ['nullable', 'string', 'max:20', 'exists:central.domain_tld_prices,tld'],
            'managed_domain_registered' => ['nullable', 'boolean'],
            'managed_domain_amount' => ['nullable', 'integer', 'min:0'],
            'managed_domain_renews_at' => ['nullable', 'date'],
            'storage_quota_gb' => ['required', 'integer', Rule::in(TenantStorageSettings::quotaGbOptions())],
            'feature_module_ids' => ['nullable', 'array'],
            'feature_module_ids.*' => ['integer', 'exists:feature_modules,id'],
            'maliart_payment_enabled' => ['nullable', 'boolean'],
        ]);

        $package = SubscriptionPackage::query()->findOrFail($validated['subscription_package_id']);
        $audience = AudienceType::query()->find($validated['audience_type_id']);
        $validated['support_ends_at'] = now()->addDays((int) $package->duration_days)->toDateString();
        $validated['domain_attributes'] = $this->resolveDomainAttributes($validated, $tenant);
        $validated['nutrition_initial_tokens'] = $tenant
            ? 0
            : ($this->isNutritionAudienceSlug($audience?->slug)
                ? max(0, (int) ($validated['nutrition_initial_tokens'] ?? OpenAiSettings::nutritionInitialTokenGrant()))
                : 0);
        $validated['feature_module_ids'] = $tenant
            ? []
            : collect($validated['feature_module_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->values()->all();

        return $validated;
    }

    private function activateSelectedFeatureModules(Tenant $tenant, array $featureModuleIds, Request $request): array
    {
        if ($featureModuleIds === []) {
            return [];
        }

        $errors = [];
        $modules = FeatureModule::query()
            ->whereIn('id', $featureModuleIds)
            ->get()
            ->keyBy('id');

        foreach ($featureModuleIds as $featureModuleId) {
            $module = $modules->get($featureModuleId);

            if (! $module) {
                continue;
            }

            try {
                $this->tenantFeatureModules->activate($tenant, $module, [
                    'actor_user_id' => $request->user()?->id,
                    'source' => 'tenant_creation',
                ]);
            } catch (\Throwable $exception) {
                $errors[] = $module->name.': '.$exception->getMessage();
            }
        }

        return $errors;
    }

    private function grantInitialNutritionTokens(Tenant $tenant, int $amount, ?User $actor): void
    {
        if ($amount <= 0 || ! $this->isNutritionAudienceSlug($tenant->audienceType?->slug)) {
            return;
        }

        $configuredDefault = OpenAiSettings::nutritionInitialTokenGrant();

        $tenant->run(function () use ($tenant, $amount, $actor, $configuredDefault): void {
            if (! Schema::hasTable('nutrition_token_wallets') || ! Schema::hasTable('nutrition_token_ledgers')) {
                return;
            }

            $alreadyGranted = NutritionTokenLedger::query()
                ->where('reason_code', 'initial_tenant_grant')
                ->exists();

            if ($alreadyGranted) {
                return;
            }

            app(NutritionTokenService::class)->creditTokens(
                amount: $amount,
                actor: null,
                reasonTitle: 'اعتبار اولیه ساخت سامانه تغذیه',
                eventType: 'topup',
                meta: [
                    'source' => 'tenant_creation',
                    'tenant_id' => (string) $tenant->id,
                    'tenant_name' => $tenant->name,
                    'audience_slug' => $tenant->audienceType?->slug,
                    'audience_name' => $tenant->audienceType?->name,
                    'central_actor_id' => $actor?->id,
                    'central_actor_name' => $actor?->name,
                    'configured_default' => $configuredDefault,
                ],
                reasonCode: 'initial_tenant_grant',
            );
        });
    }

    private function nutritionTokenSummary(Tenant $tenant): ?array
    {
        return $tenant->run(function (): ?array {
            if (! Schema::hasTable('nutrition_token_wallets') || ! Schema::hasTable('nutrition_token_ledgers')) {
                return null;
            }

            $wallet = NutritionTokenWallet::query()->firstOrCreate(['id' => 1]);
            $recentLedgers = NutritionTokenLedger::query()
                ->latest('id')
                ->limit(12)
                ->get()
                ->map(fn (NutritionTokenLedger $ledger): array => [
                    'id' => (int) $ledger->id,
                    'direction' => (string) $ledger->direction,
                    'tokens_amount' => (int) $ledger->tokens_amount,
                    'balance_after' => (int) $ledger->balance_after,
                    'reason_title' => (string) $ledger->reason_title,
                    'reason_code' => (string) $ledger->reason_code,
                    'occurred_at' => optional($ledger->occurred_at ?? $ledger->created_at)->toDateTimeString(),
                    'meta' => is_array($ledger->meta_json) ? $ledger->meta_json : [],
                ])
                ->values()
                ->all();

            return [
                'balanceTokens' => (int) $wallet->balance_tokens,
                'purchasedTokens' => (int) $wallet->purchased_tokens,
                'usedTokens' => (int) $wallet->used_tokens,
                'recentLedgers' => $recentLedgers,
            ];
        });
    }

    private function isNutritionAudienceSlug(?string $slug): bool
    {
        return in_array((string) $slug, ['nutritionists', 'nutrition-doctors'], true);
    }

    private function defaultStorageQuotaGb(): int
    {
        $settings = SystemSetting::getValue('tenant_storage', []);

        return TenantStorageSettings::normalizeQuotaGb($settings['default_quota_gb'] ?? TenantStorageSettings::DEFAULT_QUOTA_GB);
    }

    private function tenantStorageQuotaGb(Tenant $tenant): ?int
    {
        return $tenant->run(function (): ?int {
            if (! Schema::hasTable('tenant_settings')) {
                return null;
            }

            $bytes = (int) TenantSetting::getValue(TenantStorageSettings::KEY_BASE_QUOTA_BYTES, 0);

            if ($bytes <= 0) {
                return null;
            }

            $gb = (int) round($bytes / TenantStorageSettings::BYTES_PER_GB);

            return TenantStorageSettings::normalizeQuotaGb($gb);
        });
    }

    private function resolveDomainAttributes(array $validated, ?Tenant $tenant = null): array
    {
        $mode = (string) ($validated['domain_management_mode'] ?? ($tenant?->domain_management_mode ?: 'platform_managed'));
        $tld = trim((string) ($validated['managed_domain_tld'] ?? ($tenant?->managed_domain_tld ?: $this->extractTldFromDomain((string) ($validated['domain'] ?? '')) ?: '.ir')));
        $isRegistered = $mode === 'platform_managed' && (bool) ($validated['managed_domain_registered'] ?? false);

        if ($mode === 'self_managed') {
            return [
                'domain_management_mode' => 'self_managed',
                'managed_domain_tld' => $tld !== '' ? $tld : null,
                'managed_domain_registered' => false,
                'managed_domain_registered_at' => null,
                'managed_domain_last_paid_at' => null,
                'managed_domain_renews_at' => null,
                'managed_domain_amount' => null,
                'ir_domain_registered' => false,
                'ir_domain_registered_at' => null,
                'ir_domain_last_paid_at' => null,
                'ir_domain_renews_at' => null,
                'ir_domain_amount' => null,
            ];
        }

        if (! $isRegistered) {
            return [
                'domain_management_mode' => 'platform_managed',
                'managed_domain_tld' => $tld !== '' ? $tld : '.ir',
                'managed_domain_registered' => false,
                'managed_domain_registered_at' => null,
                'managed_domain_last_paid_at' => null,
                'managed_domain_renews_at' => null,
                'managed_domain_amount' => null,
                'ir_domain_registered' => false,
                'ir_domain_registered_at' => null,
                'ir_domain_last_paid_at' => null,
                'ir_domain_renews_at' => null,
                'ir_domain_amount' => null,
            ];
        }

        $defaultRenewDate = $tenant?->managed_domain_renews_at?->copy()->toDateString()
            ?? $tenant?->ir_domain_renews_at?->copy()->toDateString()
            ?? now()->addYear()->toDateString();
        $renewsAt = Carbon::parse((string) ($validated['managed_domain_renews_at'] ?? $defaultRenewDate))->toDateString();
        $amount = array_key_exists('managed_domain_amount', $validated) && $validated['managed_domain_amount'] !== null
            ? max(0, (int) $validated['managed_domain_amount'])
            : ($tenant?->managed_domain_amount ?? $this->defaultDomainRenewAmount($tld));

        $base = [
            'domain_management_mode' => 'platform_managed',
            'managed_domain_tld' => $tld !== '' ? $tld : '.ir',
            'managed_domain_registered' => true,
            'managed_domain_registered_at' => $tenant?->managed_domain_registered_at?->toDateString() ?? now()->toDateString(),
            'managed_domain_last_paid_at' => $tenant?->managed_domain_last_paid_at?->toDateString() ?? now()->toDateString(),
            'managed_domain_renews_at' => $renewsAt,
            'managed_domain_amount' => $amount,
        ];

        if ($tld === '.ir') {
            return array_merge($base, [
                'ir_domain_registered' => true,
                'ir_domain_registered_at' => $tenant?->ir_domain_registered_at?->toDateString() ?? now()->toDateString(),
                'ir_domain_last_paid_at' => $tenant?->ir_domain_last_paid_at?->toDateString() ?? now()->toDateString(),
                'ir_domain_renews_at' => $renewsAt,
                'ir_domain_amount' => $amount,
            ]);
        }

        return array_merge($base, [
            'ir_domain_registered' => false,
            'ir_domain_registered_at' => null,
            'ir_domain_last_paid_at' => null,
            'ir_domain_renews_at' => null,
            'ir_domain_amount' => null,
        ]);
    }

    private function defaultDomainRenewAmount(?string $tld = '.ir'): int
    {
        return (int) (DomainTldPrice::query()
            ->where('tld', $tld ?: '.ir')
            ->where('is_active', true)
            ->value('renew_price_amount') ?? 0);
    }

    private function extractTldFromDomain(string $domain): ?string
    {
        $domain = trim($domain);
        if ($domain === '' || ! str_contains($domain, '.')) {
            return null;
        }

        $parts = explode('.', $domain);
        $lastPart = trim((string) end($parts));

        return $lastPart !== '' ? '.'.Str::lower($lastPart) : null;
    }
}
