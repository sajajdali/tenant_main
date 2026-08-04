<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\CustomLandingAttribution;
use App\Domain\Tenant\Models\CustomLandingCommission;
use App\Domain\Tenant\Models\CustomLandingPartner;
use App\Domain\Tenant\Models\CustomLandingSettlement;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\NutritionPackageOrder;
use App\Domain\Tenant\Models\TenantUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class CustomLandingService
{
    public const SESSION_TOKEN_KEY = 'custom_landing_partner_token';
    public const DIRECT_TOKEN = 'direct';
    private const SETTINGS_KEY = 'custom_landing';

    public function captureToken(Request $request, string $token): CustomLandingPartner
    {
        abort_unless($this->tablesReady(['custom_landing_partners']), 404);

        $partner = CustomLandingPartner::query()->where('public_token', $token)->where('status', 'active')->firstOrFail();
        $request->session()->put(self::SESSION_TOKEN_KEY, $partner->public_token);

        return $partner;
    }

    public function attributeSessionUser(Request $request, TenantUser $user): ?CustomLandingAttribution
    {
        if (! $this->tablesReady(['custom_landing_partners', 'custom_landing_attributions'])) {
            $request->session()->forget(self::SESSION_TOKEN_KEY);

            return null;
        }

        $token = (string) $request->session()->pull(self::SESSION_TOKEN_KEY, self::DIRECT_TOKEN);

        $partner = $token === self::DIRECT_TOKEN
            ? $this->directPartner()
            : CustomLandingPartner::query()->where('public_token', $token)->where('status', 'active')->first();
        if (! $partner) return null;

        return CustomLandingAttribution::query()->firstOrCreate(
            ['tenant_user_id' => $user->id],
            ['custom_landing_partner_id' => $partner->id, 'public_token_snapshot' => $partner->public_token, 'landed_at' => now(), 'registered_at' => now()],
        );
    }

    public function createPartner(array $payload, ?TenantUser $actor): CustomLandingPartner
    {
        return CustomLandingPartner::query()->create([
            ...$payload,
            'mobile' => $this->mobile($payload['mobile']),
            'public_token' => $this->uniquePublicToken(),
            'created_by_user_id' => $actor?->id,
        ]);
    }

    public function updatePartner(CustomLandingPartner $partner, array $payload): CustomLandingPartner
    {
        if ($this->isDirectPartner($partner)) {
            $payload['name'] = 'بدون معرف';
            $payload['mobile'] = '00000000000';
            $payload['status'] = 'active';
            $payload['first_payment_percent'] = 0;
            $payload['recurring_payment_percent'] = 0;
        }

        $partner->update([...$payload, 'mobile' => $this->mobile($payload['mobile'])]);
        return $partner->fresh();
    }

    public function overview(): array
    {
        abort_unless($this->tablesReady(), 503, 'ماژول لندینگ اختصاصی هنوز برای این سایت نصب نشده است.');

        $this->directPartner();
        $credited = (int) CustomLandingCommission::query()->where('status', 'credited')->sum('commission_amount');
        $reversed = (int) CustomLandingCommission::query()->where('status', 'reversed')->sum('commission_amount');
        $settled = (int) CustomLandingSettlement::query()->sum('amount');

        return [
            'stats' => ['partners' => CustomLandingPartner::query()->where('status', 'active')->count(), 'attributions' => CustomLandingAttribution::query()->count(), 'firstPayments' => CustomLandingCommission::query()->where('payment_kind', 'first_payment')->where('status', 'credited')->count(), 'creditedAmount' => $credited, 'settledAmount' => $settled, 'availableAmount' => max(0, $credited - $reversed - $settled)],
            'partners' => CustomLandingPartner::query()->withCount('attributions')->withSum(['commissions as credited_amount' => fn ($query) => $query->where('status', 'credited')], 'commission_amount')->withSum('settlements as settled_amount', 'amount')->orderByRaw('public_token = ? desc', [self::DIRECT_TOKEN])->latest()->get()->map(fn (CustomLandingPartner $partner) => $this->partnerData($partner))->values(),
            'commissions' => CustomLandingCommission::query()->with(['partner:id,name', 'user:id,name,mobile'])->latest('paid_at')->limit(20)->get()->map(fn (CustomLandingCommission $item) => $this->commissionData($item))->values(),
            'settlements' => CustomLandingSettlement::query()->with('partner:id,name')->latest('paid_at')->limit(20)->get()->map(fn (CustomLandingSettlement $item) => $this->settlementData($item))->values(),
            'settings' => $this->settings(),
        ];
    }

    public function settings(): array
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];
        $settings = is_array($rules[self::SETTINGS_KEY] ?? null) ? $rules[self::SETTINGS_KEY] : [];
        $hasSavedSettings = array_key_exists(self::SETTINGS_KEY, $rules) && is_array($rules[self::SETTINGS_KEY] ?? null);

        return [
            'title' => (string) ($settings['title'] ?? ($hasSavedSettings ? '' : 'لندینگ اختصاصی رژیم')),
            'headline' => (string) ($settings['headline'] ?? ($hasSavedSettings ? '' : 'شروع دریافت رژیم اختصاصی')),
            'description' => (string) ($settings['description'] ?? ($hasSavedSettings ? '' : 'برای مشاهده اپلیکیشن و شروع مسیر رژیم، شماره تماس خود را وارد کنید.')),
            'buttonLabel' => (string) ($settings['button_label'] ?? 'ورود به اپلیکیشن'),
            'autoTokenEnabled' => (bool) ($settings['auto_token_enabled'] ?? false),
            'redirectHomeEnabled' => (bool) ($settings['redirect_home_enabled'] ?? false),
            'logoUrl' => $this->logoUrl($settings),
            'appViewUrl' => (string) ($settings['app_view_url'] ?? url('/nutrition')),
            'webAppUrl' => (string) ($settings['web_app_url'] ?? url('/nutrition')),
            'androidUrl' => (string) ($settings['android_url'] ?? url('/nutrition?platform=android')),
            'iosUrl' => (string) ($settings['ios_url'] ?? ''),
        ];
    }

    public function updateSettings(array $payload): array
    {
        $general = GeneralSetting::query()->firstOrCreate([], ['booking_rules' => []]);
        $rules = $general->booking_rules ?? [];
        $current = is_array($rules[self::SETTINGS_KEY] ?? null) ? $rules[self::SETTINGS_KEY] : [];
        $rules[self::SETTINGS_KEY] = [
            ...$current,
            'title' => trim((string) ($payload['title'] ?? '')),
            'headline' => trim((string) ($payload['headline'] ?? '')),
            'description' => trim((string) ($payload['description'] ?? '')),
            'button_label' => trim((string) ($payload['button_label'] ?? 'ورود به اپلیکیشن')),
            'auto_token_enabled' => (bool) ($payload['auto_token_enabled'] ?? false),
            'redirect_home_enabled' => (bool) ($payload['redirect_home_enabled'] ?? false),
            'app_view_url' => trim((string) ($payload['app_view_url'] ?? '')),
            'web_app_url' => trim((string) ($payload['web_app_url'] ?? '')),
            'android_url' => trim((string) ($payload['android_url'] ?? '')),
            'ios_url' => trim((string) ($payload['ios_url'] ?? '')),
        ];
        $general->update(['booking_rules' => $rules]);

        return $this->settings();
    }

    public function homeRedirectPartner(): ?CustomLandingPartner
    {
        if (! $this->tablesReady(['custom_landing_partners'])) {
            return null;
        }

        $settings = $this->settings();
        if (! (bool) ($settings['redirectHomeEnabled'] ?? false)) {
            return null;
        }

        return $this->directPartner();
    }

    public function currentLogoPath(): ?string
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];
        $settings = is_array($rules[self::SETTINGS_KEY] ?? null) ? $rules[self::SETTINGS_KEY] : [];
        $path = ltrim((string) ($settings['logo_path'] ?? ''), '/');

        return $path !== '' ? $path : null;
    }

    public function updateLogoPath(?string $path): array
    {
        $general = GeneralSetting::query()->firstOrCreate([], ['booking_rules' => []]);
        $rules = $general->booking_rules ?? [];
        $current = is_array($rules[self::SETTINGS_KEY] ?? null) ? $rules[self::SETTINGS_KEY] : [];

        $current['logo_path'] = $path ? ltrim($path, '/') : '';
        $current['logo_url'] = '';

        $rules[self::SETTINGS_KEY] = $current;
        $general->update(['booking_rules' => $rules]);

        return $this->settings();
    }

    public function partnerDashboard(CustomLandingPartner $partner, string $search = ''): array
    {
        $partner->loadCount('attributions')
            ->loadSum(['commissions as credited_amount' => fn ($query) => $query->where('status', 'credited')], 'commission_amount')
            ->loadSum(['commissions as first_payment_amount' => fn ($query) => $query->where('status', 'credited')->where('payment_kind', 'first_payment')], 'commission_amount')
            ->loadSum(['commissions as recurring_payment_amount' => fn ($query) => $query->where('status', 'credited')->where('payment_kind', 'recurring_payment')], 'commission_amount')
            ->loadSum('settlements as settled_amount', 'amount');

        $search = trim($this->mobile($search) ?: $search);
        $userFilter = function ($query) use ($search): void {
            if ($search === '') return;
            $query->where(function ($inner) use ($search): void {
                $inner->where('name', 'like', "%{$search}%")->orWhere('mobile', 'like', "%{$search}%");
            });
        };

        $credited = (int) ($partner->credited_amount ?? 0);
        $settled = (int) ($partner->settled_amount ?? 0);
        $reversed = (int) $partner->commissions()->where('status', 'reversed')->sum('commission_amount');
        $dietUsers = (int) $partner->commissions()->where('status', 'credited')->distinct('tenant_user_id')->count('tenant_user_id');

        return [
            'partner' => $this->partnerData($partner),
            'stats' => [
                'availableAmount' => max(0, $credited - $reversed - $settled),
                'totalIncome' => $credited,
                'firstPaymentIncome' => (int) ($partner->first_payment_amount ?? 0),
                'recurringPaymentIncome' => (int) ($partner->recurring_payment_amount ?? 0),
                'referredUsers' => (int) ($partner->attributions_count ?? 0),
                'dietUsers' => $dietUsers,
                'settledAmount' => $settled,
                'reversedAmount' => $reversed,
            ],
            'users' => CustomLandingAttribution::query()
                ->with('user:id,name,mobile,created_at')
                ->where('custom_landing_partner_id', $partner->id)
                ->whereHas('user', $userFilter)
                ->latest('registered_at')
                ->limit(30)
                ->get()
                ->map(fn (CustomLandingAttribution $item) => $this->attributionData($item))
                ->values(),
            'commissions' => CustomLandingCommission::query()
                ->with(['partner:id,name', 'user:id,name,mobile'])
                ->where('custom_landing_partner_id', $partner->id)
                ->when($search !== '', fn ($query) => $query->whereHas('user', $userFilter))
                ->latest('paid_at')
                ->limit(30)
                ->get()
                ->map(fn (CustomLandingCommission $item) => $this->commissionData($item))
                ->values(),
            'settlements' => CustomLandingSettlement::query()
                ->with('partner:id,name')
                ->where('custom_landing_partner_id', $partner->id)
                ->when($search !== '', fn ($query) => $query->where(fn ($inner) => $inner->where('payment_reference', 'like', "%{$search}%")->orWhere('note', 'like', "%{$search}%")))
                ->latest('paid_at')
                ->limit(30)
                ->get()
                ->map(fn (CustomLandingSettlement $item) => $this->settlementData($item))
                ->values(),
        ];
    }

    public function settle(CustomLandingPartner $partner, array $payload, TenantUser $actor): CustomLandingSettlement
    {
        $available = $this->availableFor($partner);
        if ((int) $payload['amount'] > $available) throw ValidationException::withMessages(['amount' => 'مبلغ تسویه از موجودی قابل پرداخت بیشتر است.']);
        return CustomLandingSettlement::query()->create([...$payload, 'custom_landing_partner_id' => $partner->id, 'recorded_by_user_id' => $actor->id]);
    }

    public function recordNutritionPackagePayment(NutritionPackageOrder $order): ?CustomLandingCommission
    {
        if ($order->status !== 'paid') return null;
        if (! $this->tablesReady(['custom_landing_partners', 'custom_landing_attributions', 'custom_landing_commissions'])) return null;

        return DB::transaction(function () use ($order): ?CustomLandingCommission {
            $attribution = CustomLandingAttribution::query()->with('partner')->lockForUpdate()->where('tenant_user_id', $order->user_id)->first();
            if (! $attribution || ! $attribution->partner || $attribution->partner->status !== 'active') return null;
            $exists = CustomLandingCommission::query()->where('source_type', 'nutrition_package_order')->where('source_id', (string) $order->id)->exists();
            if ($exists) return null;
            $isFirst = ! CustomLandingCommission::query()->where('tenant_user_id', $order->user_id)->where('status', 'credited')->exists();
            $percent = (float) ($isFirst ? $attribution->partner->first_payment_percent : $attribution->partner->recurring_payment_percent);
            $amount = (int) $order->payable_amount;
            $commission = CustomLandingCommission::query()->create(['custom_landing_partner_id' => $attribution->custom_landing_partner_id, 'tenant_user_id' => $order->user_id, 'source_type' => 'nutrition_package_order', 'source_id' => (string) $order->id, 'payment_kind' => $isFirst ? 'first_payment' : 'recurring_payment', 'gross_amount' => $amount, 'commission_percent_snapshot' => $percent, 'commission_amount' => (int) round($amount * $percent / 100), 'status' => 'credited', 'paid_at' => $order->paid_at ?? now()]);
            if ($isFirst && $attribution->first_paid_at === null) $attribution->update(['first_paid_at' => $commission->paid_at]);
            return $commission;
        });
    }

    public function availableFor(CustomLandingPartner $partner): int
    {
        $credits = (int) $partner->commissions()->where('status', 'credited')->sum('commission_amount');
        $reversed = (int) $partner->commissions()->where('status', 'reversed')->sum('commission_amount');
        return max(0, $credits - $reversed - (int) $partner->settlements()->sum('amount'));
    }

    public function reverseCommission(CustomLandingCommission $commission, ?string $note = null): void
    {
        if ($commission->status === 'reversed') return;
        $commission->update(['status' => 'reversed', 'reversed_at' => now(), 'reversal_note' => $note ?: 'حذف توسط مدیر']);
    }

    public function destroyAttribution(CustomLandingAttribution $attribution): void
    {
        DB::transaction(function () use ($attribution): void {
            CustomLandingCommission::query()
                ->where('custom_landing_partner_id', $attribution->custom_landing_partner_id)
                ->where('tenant_user_id', $attribution->tenant_user_id)
                ->where('status', 'credited')
                ->update(['status' => 'reversed', 'reversed_at' => now(), 'reversal_note' => 'حذف کاربر معرفی شده توسط مدیر']);

            $attribution->delete();
        });
    }

    public function deletePartnerWithData(CustomLandingPartner $partner): void
    {
        if ($this->isDirectPartner($partner)) {
            throw ValidationException::withMessages(['partner' => 'گروه بدون معرف قابل حذف نیست.']);
        }

        DB::transaction(function () use ($partner): void {
            CustomLandingSettlement::query()->where('custom_landing_partner_id', $partner->id)->delete();
            CustomLandingCommission::query()->where('custom_landing_partner_id', $partner->id)->delete();
            CustomLandingAttribution::query()->where('custom_landing_partner_id', $partner->id)->delete();
            $partner->forceDelete();
        });
    }

    public function partnerData(CustomLandingPartner $partner): array
    {
        $credited = (int) ($partner->credited_amount ?? $partner->commissions()->where('status', 'credited')->sum('commission_amount'));
        $settled = (int) ($partner->settled_amount ?? $partner->settlements()->sum('amount'));
        $reversed = (int) ($partner->reversed_amount ?? $partner->commissions()->where('status', 'reversed')->sum('commission_amount'));
        $isDirect = $this->isDirectPartner($partner);
        return ['id' => (string) $partner->id, 'name' => $partner->name, 'mobile' => $partner->mobile, 'status' => $partner->status, 'publicToken' => $partner->public_token, 'url' => $isDirect ? '' : url('/join/'.$partner->public_token), 'isDirect' => $isDirect, 'firstPaymentPercent' => (float) $partner->first_payment_percent, 'recurringPaymentPercent' => (float) $partner->recurring_payment_percent, 'attributionsCount' => (int) ($partner->attributions_count ?? $partner->attributions()->count()), 'creditedAmount' => $credited, 'settledAmount' => $settled, 'availableAmount' => max(0, $credited - $reversed - $settled), 'notes' => $partner->notes];
    }

    private function attributionData(CustomLandingAttribution $item): array { return ['id' => (string) $item->id, 'userId' => (string) $item->tenant_user_id, 'name' => $item->user?->name, 'mobile' => $item->user?->mobile, 'registeredAt' => $item->registered_at?->toIso8601String(), 'firstPaidAt' => $item->first_paid_at?->toIso8601String()]; }
    private function commissionData(CustomLandingCommission $item): array { return ['id' => (string) $item->id, 'partnerName' => $item->partner?->name, 'userName' => $item->user?->name, 'userMobile' => $item->user?->mobile, 'paymentKind' => $item->payment_kind, 'grossAmount' => (int) $item->gross_amount, 'percent' => (float) $item->commission_percent_snapshot, 'amount' => (int) $item->commission_amount, 'status' => $item->status, 'paidAt' => $item->paid_at?->toIso8601String(), 'reversalNote' => $item->reversal_note]; }
    private function settlementData(CustomLandingSettlement $item): array { return ['id' => (string) $item->id, 'partnerName' => $item->partner?->name, 'amount' => (int) $item->amount, 'paymentMethod' => $item->payment_method, 'paymentReference' => $item->payment_reference, 'paidAt' => $item->paid_at?->toIso8601String(), 'note' => $item->note]; }
    private function mobile(string $mobile): string { return preg_replace('/\D+/', '', $mobile) ?? ''; }

    private function logoUrl(array $settings): string
    {
        $path = ltrim((string) ($settings['logo_path'] ?? ''), '/');
        if ($path !== '') {
            return tenant() ? tenant_asset($path) : Storage::disk('media_public')->url($path);
        }

        return (string) ($settings['logo_url'] ?? '');
    }

    private function uniquePublicToken(): string
    {
        $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

        for ($attempt = 0; $attempt < 50; $attempt++) {
            $token = collect(range(1, 4))
                ->map(fn () => $alphabet[random_int(0, strlen($alphabet) - 1)])
                ->implode('');

            if (! CustomLandingPartner::withTrashed()->where('public_token', $token)->exists()) {
                return $token;
            }
        }

        throw ValidationException::withMessages(['public_token' => 'امکان ساخت کد اختصاصی یکتا وجود ندارد. دوباره تلاش کنید.']);
    }

    public function directPartner(): CustomLandingPartner
    {
        abort_unless($this->tablesReady(['custom_landing_partners']), 503, 'ماژول لندینگ اختصاصی هنوز برای این سایت نصب نشده است.');

        /** @var CustomLandingPartner $partner */
        $partner = CustomLandingPartner::withTrashed()->firstOrCreate(
            ['public_token' => self::DIRECT_TOKEN],
            [
                'name' => 'بدون معرف',
                'mobile' => '00000000000',
                'status' => 'active',
                'first_payment_percent' => 0,
                'recurring_payment_percent' => 0,
                'notes' => 'کاربرانی که بدون لینک معرف وارد لندینگ شده‌اند.',
            ],
        );

        if ($partner->trashed()) {
            $partner->restore();
        }

        $updates = [];
        if ($partner->name !== 'بدون معرف') $updates['name'] = 'بدون معرف';
        if ($partner->status !== 'active') $updates['status'] = 'active';
        if ($updates !== []) $partner->update($updates);

        return $partner->fresh();
    }

    private function isDirectPartner(CustomLandingPartner $partner): bool
    {
        return $partner->public_token === self::DIRECT_TOKEN;
    }

    /**
     * @param array<int, string> $tables
     */
    private function tablesReady(array $tables = [
        'custom_landing_partners',
        'custom_landing_attributions',
        'custom_landing_commissions',
        'custom_landing_settlements',
    ]): bool
    {
        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                return false;
            }
        }

        return true;
    }
}
