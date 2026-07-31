<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\CustomLandingAttribution;
use App\Domain\Tenant\Models\CustomLandingCommission;
use App\Domain\Tenant\Models\CustomLandingPartner;
use App\Domain\Tenant\Models\CustomLandingSettlement;
use App\Domain\Tenant\Models\NutritionPackageOrder;
use App\Domain\Tenant\Models\TenantUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomLandingService
{
    public const SESSION_TOKEN_KEY = 'custom_landing_partner_token';

    public function captureToken(Request $request, string $token): CustomLandingPartner
    {
        $partner = CustomLandingPartner::query()->where('public_token', $token)->where('status', 'active')->firstOrFail();
        $request->session()->put(self::SESSION_TOKEN_KEY, $partner->public_token);

        return $partner;
    }

    public function attributeSessionUser(Request $request, TenantUser $user): ?CustomLandingAttribution
    {
        $token = (string) $request->session()->pull(self::SESSION_TOKEN_KEY, '');
        if ($token === '') return null;

        $partner = CustomLandingPartner::query()->where('public_token', $token)->where('status', 'active')->first();
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
            'public_token' => Str::upper(Str::random(10)),
            'created_by_user_id' => $actor?->id,
        ]);
    }

    public function updatePartner(CustomLandingPartner $partner, array $payload): CustomLandingPartner
    {
        $partner->update([...$payload, 'mobile' => $this->mobile($payload['mobile'])]);
        return $partner->fresh();
    }

    public function overview(): array
    {
        $credited = (int) CustomLandingCommission::query()->where('status', 'credited')->sum('commission_amount');
        $reversed = (int) CustomLandingCommission::query()->where('status', 'reversed')->sum('commission_amount');
        $settled = (int) CustomLandingSettlement::query()->sum('amount');

        return [
            'stats' => ['partners' => CustomLandingPartner::query()->where('status', 'active')->count(), 'attributions' => CustomLandingAttribution::query()->count(), 'firstPayments' => CustomLandingCommission::query()->where('payment_kind', 'first_payment')->where('status', 'credited')->count(), 'creditedAmount' => $credited, 'settledAmount' => $settled, 'availableAmount' => max(0, $credited - $reversed - $settled)],
            'partners' => CustomLandingPartner::query()->withCount('attributions')->withSum(['commissions as credited_amount' => fn ($query) => $query->where('status', 'credited')], 'commission_amount')->withSum('settlements as settled_amount', 'amount')->latest()->get()->map(fn (CustomLandingPartner $partner) => $this->partnerData($partner))->values(),
            'commissions' => CustomLandingCommission::query()->with(['partner:id,name', 'user:id,name,mobile'])->latest('paid_at')->limit(20)->get()->map(fn (CustomLandingCommission $item) => $this->commissionData($item))->values(),
            'settlements' => CustomLandingSettlement::query()->with('partner:id,name')->latest('paid_at')->limit(20)->get()->map(fn (CustomLandingSettlement $item) => $this->settlementData($item))->values(),
        ];
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

    public function partnerData(CustomLandingPartner $partner): array
    {
        $credited = (int) ($partner->credited_amount ?? $partner->commissions()->where('status', 'credited')->sum('commission_amount'));
        $settled = (int) ($partner->settled_amount ?? $partner->settlements()->sum('amount'));
        $reversed = (int) ($partner->reversed_amount ?? $partner->commissions()->where('status', 'reversed')->sum('commission_amount'));
        return ['id' => (string) $partner->id, 'name' => $partner->name, 'mobile' => $partner->mobile, 'status' => $partner->status, 'publicToken' => $partner->public_token, 'url' => url('/join/'.$partner->public_token), 'firstPaymentPercent' => (float) $partner->first_payment_percent, 'recurringPaymentPercent' => (float) $partner->recurring_payment_percent, 'attributionsCount' => (int) ($partner->attributions_count ?? $partner->attributions()->count()), 'creditedAmount' => $credited, 'settledAmount' => $settled, 'availableAmount' => max(0, $credited - $reversed - $settled), 'notes' => $partner->notes];
    }

    private function attributionData(CustomLandingAttribution $item): array { return ['id' => (string) $item->id, 'userId' => (string) $item->tenant_user_id, 'name' => $item->user?->name, 'mobile' => $item->user?->mobile, 'registeredAt' => $item->registered_at?->toIso8601String(), 'firstPaidAt' => $item->first_paid_at?->toIso8601String()]; }
    private function commissionData(CustomLandingCommission $item): array { return ['id' => (string) $item->id, 'partnerName' => $item->partner?->name, 'userName' => $item->user?->name, 'userMobile' => $item->user?->mobile, 'paymentKind' => $item->payment_kind, 'grossAmount' => (int) $item->gross_amount, 'percent' => (float) $item->commission_percent_snapshot, 'amount' => (int) $item->commission_amount, 'status' => $item->status, 'paidAt' => $item->paid_at?->toIso8601String(), 'reversalNote' => $item->reversal_note]; }
    private function settlementData(CustomLandingSettlement $item): array { return ['id' => (string) $item->id, 'partnerName' => $item->partner?->name, 'amount' => (int) $item->amount, 'paymentMethod' => $item->payment_method, 'paymentReference' => $item->payment_reference, 'paidAt' => $item->paid_at?->toIso8601String(), 'note' => $item->note]; }
    private function mobile(string $mobile): string { return preg_replace('/\D+/', '', $mobile) ?? ''; }
}
