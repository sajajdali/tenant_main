<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Booking\Models\Barber;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Domain\Tenant\Models\Tenant;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\SmsTopUpPaymentService;
use App\Services\SupportRenewalPaymentService;
use App\Support\JalaliDate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class UserCreditController extends Controller
{
    public function __construct(
        private readonly SmsTopUpPaymentService $smsTopUpPayments,
        private readonly SupportRenewalPaymentService $supportRenewalPayments,
    ) {
    }

    public function edit(Request $request, User $user): View
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $user->load([
            'ownedTenants.domains',
            'ownedTenants.audienceType',
            'ownedTenants.subscriptionPackage',
        ]);

        return view('admin.users.credit', [
            'user' => $user,
            'tenantOptions' => $this->tenantOptions($user),
        ]);
    }

    public function store(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $validated = $request->validate([
            'tenant_id' => ['required', 'string'],
            'credit_type' => ['required', 'in:sms,package'],
            'payment_status' => ['required', 'in:paid,free'],
            'payment_method' => ['nullable', 'in:card_to_card,online'],
            'sms_amount' => ['nullable', 'integer', 'min:1'],
            'subscription_package_id' => ['nullable', 'integer', 'exists:subscription_packages,id'],
            'apply_sales_commission' => ['nullable', 'boolean'],
            'note' => ['nullable', 'string', 'max:1000'],
        ], [
            'tenant_id.required' => 'سامانه مقصد را انتخاب کنید.',
            'credit_type.required' => 'نوع افزایش اعتبار را انتخاب کنید.',
            'payment_status.required' => 'مشخص کنید کاربر مبلغ را پرداخت کرده است یا خیر.',
            'payment_method.in' => 'روش پرداخت معتبر نیست.',
            'sms_amount.min' => 'مبلغ شارژ پیامک باید بیشتر از صفر باشد.',
            'subscription_package_id.exists' => 'بسته انتخاب‌شده معتبر نیست.',
        ]);

        $tenant = $user->ownedTenants()->with(['audienceType', 'subscriptionPackage'])->find($validated['tenant_id']);
        if (! $tenant) {
            throw ValidationException::withMessages([
                'tenant_id' => 'سامانه انتخاب‌شده به این کاربر تعلق ندارد.',
            ]);
        }

        $countsAsRevenue = $validated['payment_status'] === 'paid';
        $paymentMethod = $countsAsRevenue ? trim((string) ($validated['payment_method'] ?? '')) : '';

        if ($countsAsRevenue && $paymentMethod === '') {
            throw ValidationException::withMessages([
                'payment_method' => 'وقتی مبلغ دریافت شده است، روش پرداخت را هم انتخاب کنید.',
            ]);
        }

        $actor = [
            'id' => (string) $user->id,
            'name' => $user->name,
            'mobile' => $user->mobile,
            'role' => $user->role,
        ];

        $manualOptions = [
            'counts_as_revenue' => $countsAsRevenue,
            'payment_method' => $paymentMethod,
            'note' => $validated['note'] ?? null,
            'registered_by_user_id' => $request->user()?->id,
            'registered_by_name' => $request->user()?->name,
        ];

        if ($validated['credit_type'] === 'sms') {
            $amount = (int) ($validated['sms_amount'] ?? 0);
            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'sms_amount' => 'مبلغ شارژ پیامک را وارد کنید.',
                ]);
            }

            $this->smsTopUpPayments->createManualPayment($tenant, $amount, $actor, $manualOptions);

            return redirect()
                ->route('admin.users.credit.edit', $user)
                ->with('success', $countsAsRevenue
                    ? 'شارژ پیامک با ثبت پرداخت دستی با موفقیت اعمال شد.'
                    : 'شارژ پیامک بدون ثبت درآمد مالی با موفقیت اعمال شد.');
        }

        $packageId = (int) ($validated['subscription_package_id'] ?? 0);
        if ($packageId <= 0) {
            throw ValidationException::withMessages([
                'subscription_package_id' => 'بسته موردنظر را انتخاب کنید.',
            ]);
        }

        $package = SubscriptionPackage::query()
            ->where('is_active', true)
            ->find($packageId);

        if (! $package) {
            throw ValidationException::withMessages([
                'subscription_package_id' => 'بسته انتخاب‌شده فعال نیست یا پیدا نشد.',
            ]);
        }

        $applySalesCommission = $countsAsRevenue && (bool) ($validated['apply_sales_commission'] ?? false);

        $this->supportRenewalPayments->createManualRenewal($tenant, $package, $actor, [
            ...$manualOptions,
            'apply_sales_commission' => $applySalesCommission,
        ]);

        return redirect()
            ->route('admin.users.credit.edit', $user)
            ->with('success', $applySalesCommission
                ? 'بسته کاربر با موفقیت اعمال شد و پورسانت فروش هم ثبت شد.'
                : ($countsAsRevenue
                    ? 'بسته کاربر با ثبت پرداخت دستی با موفقیت اعمال شد.'
                    : 'بسته کاربر بدون ثبت درآمد مالی با موفقیت اعمال شد.'));
    }

    private function tenantOptions(User $user): array
    {
        $packages = SubscriptionPackage::query()
            ->with('audiencePrices')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderByRaw('CASE WHEN user_limit IS NULL THEN 999999 ELSE user_limit END')
            ->orderBy('duration_days')
            ->get();

        return $user->ownedTenants
            ->map(function (Tenant $tenant) use ($packages): array {
                $tenant->loadMissing(['domains', 'audienceType', 'subscriptionPackage']);

                $currentProfessionalCount = (int) $tenant->run(function (): int {
                    return DB::table((new Barber())->getTable())->count();
                });
                $smsBalance = $this->smsTopUpPayments->currentBalance($tenant);
                $pluralLabel = trim((string) ($tenant->audienceType?->plural_label ?? 'کاربر'));
                $currentPackageId = $tenant->subscription_package_id ? (int) $tenant->subscription_package_id : null;

                return [
                    'id' => (string) $tenant->id,
                    'name' => $tenant->name,
                    'domain' => (string) ($tenant->domains->first()?->domain ?? ''),
                    'audienceName' => (string) ($tenant->audienceType?->name ?? 'تعریف نشده'),
                    'pluralLabel' => $pluralLabel,
                    'currentPackageId' => $currentPackageId,
                    'currentPackageName' => (string) ($tenant->subscriptionPackage?->name ?? 'تعریف نشده'),
                    'currentPackageUserLimitLabel' => (string) ($tenant->subscriptionPackage?->userLimitLabel() ?? '—'),
                    'currentSupportEndsAt' => $tenant->support_ends_at ? JalaliDate::format($tenant->support_ends_at) : '—',
                    'currentProfessionalCount' => $currentProfessionalCount,
                    'currentSmsBalance' => $smsBalance,
                    'packages' => $packages->map(function (SubscriptionPackage $package) use ($tenant, $pluralLabel, $currentProfessionalCount): array {
                        $pricing = $package->pricingFor($tenant->audience_type_id);
                        $message = '';
                        $payableAmount = (int) $pricing['payableAmount'];
                        $discountAmount = (int) $pricing['discountAmount'];
                        $available = true;
                        $isUpgrade = false;
                        $includedModulesCount = 0;

                        try {
                            $preview = $this->supportRenewalPayments->preview($tenant, $package, null, null);
                            $payableAmount = (int) ($preview['payableAmount'] ?? $payableAmount);
                            $discountAmount = (int) ($preview['discountAmount'] ?? $discountAmount);
                            $isUpgrade = (bool) ($preview['package']['isUpgrade'] ?? false);
                            $includedModulesCount = collect($preview['featureModules'] ?? [])
                                ->filter(fn (array $item): bool => (bool) ($item['selected'] ?? false))
                                ->count();
                        } catch (ValidationException $exception) {
                            $available = false;
                            $message = (string) collect($exception->errors())->flatten()->first();
                        }

                        return [
                            'id' => (int) $package->id,
                            'name' => $package->name,
                            'userLimit' => $package->user_limit,
                            'userLimitLabel' => $package->userLimitLabel(),
                            'durationDays' => (int) $package->duration_days,
                            'durationLabel' => $this->durationLabel((int) $package->duration_days),
                            'priceAmount' => (int) $pricing['priceAmount'],
                            'payableAmount' => $payableAmount,
                            'discountAmount' => $discountAmount,
                            'available' => $available,
                            'message' => $message,
                            'isUpgrade' => $isUpgrade,
                            'includedModulesCount' => $includedModulesCount,
                            'summary' => $package->user_limit === null
                                ? 'نامحدود '.$pluralLabel
                                : number_format((int) $package->user_limit).' '.$pluralLabel,
                            'blockedBecauseCurrentCount' => $package->user_limit !== null && $currentProfessionalCount > (int) $package->user_limit,
                        ];
                    })->values()->all(),
                ];
            })
            ->values()
            ->all();
    }

    private function durationLabel(int $days): string
    {
        if ($days % 30 === 0) {
            $months = (int) ($days / 30);

            return number_format($months).' ماهه';
        }

        return number_format($days).' روزه';
    }
}
