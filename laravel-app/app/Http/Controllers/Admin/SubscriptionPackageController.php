<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\AudienceType;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Domain\Tenant\Models\SubscriptionPackageAudiencePrice;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\View\View;

class SubscriptionPackageController extends Controller
{
    public function index(): View
    {
        $matrixPackages = SubscriptionPackage::query()
            ->orderBy('duration_days')
            ->orderByRaw('CASE WHEN user_limit IS NULL THEN 999999 ELSE user_limit END')
            ->get()
            ->groupBy(fn (SubscriptionPackage $package) => (int) $package->duration_days);

        return view('admin.subscription-packages.index', [
            'packages' => SubscriptionPackage::query()
                ->withCount('audiencePrices')
                ->orderBy('sort_order')
                ->orderBy('duration_days')
                ->orderByRaw('CASE WHEN user_limit IS NULL THEN 999999 ELSE user_limit END')
                ->paginate(15),
            'matrixPackages' => $matrixPackages,
            'matrixUserLimits' => $this->matrixUserLimits(),
        ]);
    }

    public function updateMatrix(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'matrix' => ['required', 'array'],
            'matrix.*.price_amount' => ['required', 'integer', 'min:0'],
            'matrix.*.discounted_price_amount' => ['nullable', 'integer', 'min:0'],
            'matrix.*.sms_credit_gift_amount' => ['nullable', 'integer', 'min:0'],
            'matrix.*.is_active' => ['nullable', 'boolean'],
        ]);

        DB::transaction(function () use ($validated): void {
            foreach ($validated['matrix'] as $packageId => $item) {
                $package = SubscriptionPackage::query()->find($packageId);
                if (! $package) {
                    continue;
                }

                $priceAmount = (int) ($item['price_amount'] ?? 0);
                $discounted = $item['discounted_price_amount'] ?? null;
                $discountedAmount = ($discounted === null || $discounted === '')
                    ? null
                    : (int) $discounted;
                $smsCreditGiftAmount = max(0, (int) ($item['sms_credit_gift_amount'] ?? 0));

                if ($discountedAmount !== null && $discountedAmount > $priceAmount) {
                    abort(422, 'مبلغ پس از تخفیف نمی‌تواند بیشتر از مبلغ اصلی باشد.');
                }

                $package->update([
                    'price_amount' => $priceAmount,
                    'discounted_price_amount' => $discountedAmount,
                    'sms_credit_gift_amount' => $smsCreditGiftAmount,
                    'is_active' => (bool) ($item['is_active'] ?? false),
                ]);
            }
        });

        return redirect()->route('admin.subscription-packages.index')->with('success', 'ماتریس قیمت بسته‌ها با موفقیت ذخیره شد.');
    }

    public function create(): View
    {
        return view('admin.subscription-packages.form', [
            'package' => new SubscriptionPackage(['is_active' => true]),
            'audiences' => AudienceType::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'isEdit' => false,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validatePayload($request);

        DB::transaction(function () use ($validated): void {
            $package = SubscriptionPackage::query()->create(collect($validated)->except('audience_overrides')->all());
            $package->audiencePrices()->createMany($validated['audience_overrides']);
            $this->normalizeLandingRecommendations($package, $validated['audience_overrides']);
        });

        return redirect()->route('admin.subscription-packages.index')->with('success', 'بسته زمانی ذخیره شد.');
    }

    public function edit(SubscriptionPackage $subscriptionPackage): View
    {
        return view('admin.subscription-packages.form', [
            'package' => $subscriptionPackage->load('audiencePrices'),
            'audiences' => AudienceType::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'isEdit' => true,
        ]);
    }

    public function update(Request $request, SubscriptionPackage $subscriptionPackage): RedirectResponse
    {
        $validated = $this->validatePayload($request, $subscriptionPackage);

        DB::transaction(function () use ($subscriptionPackage, $validated): void {
            $subscriptionPackage->update(collect($validated)->except('audience_overrides')->all());
            $subscriptionPackage->audiencePrices()->delete();
            $subscriptionPackage->audiencePrices()->createMany($validated['audience_overrides']);
            $this->normalizeLandingRecommendations($subscriptionPackage, $validated['audience_overrides']);
        });

        return redirect()->route('admin.subscription-packages.index')->with('success', 'بسته زمانی به‌روزرسانی شد.');
    }

    public function destroy(SubscriptionPackage $subscriptionPackage): RedirectResponse
    {
        $subscriptionPackage->delete();

        return redirect()->route('admin.subscription-packages.index')->with('success', 'بسته زمانی حذف شد.');
    }

    private function validatePayload(Request $request, ?SubscriptionPackage $package = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:subscription_packages,slug,' . ($package?->id ?? 'NULL') . ',id'],
            'duration_days' => ['required', 'integer', 'min:1', 'max:3650'],
            'user_limit' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'price_amount' => ['required', 'integer', 'min:0'],
            'discounted_price_amount' => ['nullable', 'integer', 'min:0', 'lte:price_amount'],
            'sms_credit_gift_amount' => ['nullable', 'integer', 'min:0'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'audience_overrides' => ['nullable', 'array'],
            'audience_overrides.*.audience_type_id' => ['required', 'integer', 'exists:audience_types,id'],
            'audience_overrides.*.price_amount' => ['nullable', 'integer', 'min:0'],
            'audience_overrides.*.discounted_price_amount' => ['nullable', 'integer', 'min:0'],
            'audience_overrides.*.show_on_landing_home' => ['nullable', 'boolean'],
            'audience_overrides.*.is_landing_recommended' => ['nullable', 'boolean'],
            'audience_overrides.*.landing_sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $overrides = collect($validated['audience_overrides'] ?? [])
            ->map(function (array $item) use ($validated): ?array {
                $priceAmount = $item['price_amount'] ?? null;
                $discountedPriceAmount = $item['discounted_price_amount'] ?? null;
                $showOnLandingHome = (bool) ($item['show_on_landing_home'] ?? false);
                $isLandingRecommended = $showOnLandingHome && (bool) ($item['is_landing_recommended'] ?? false);

                if (($priceAmount === null || $priceAmount === '') && ! $showOnLandingHome) {
                    return null;
                }

                $priceAmount = ($priceAmount === null || $priceAmount === '') ? (int) $validated['price_amount'] : (int) $priceAmount;
                $discountedPriceAmount = ($discountedPriceAmount === null || $discountedPriceAmount === '')
                    ? null
                    : (int) $discountedPriceAmount;

                if ($discountedPriceAmount !== null && $discountedPriceAmount > $priceAmount) {
                    abort(422, 'مبلغ پس از تخفیف هر طیف باید از مبلغ اصلی آن کمتر یا مساوی باشد.');
                }

                return [
                    'audience_type_id' => (int) $item['audience_type_id'],
                    'price_amount' => $priceAmount,
                    'discounted_price_amount' => $discountedPriceAmount,
                    'show_on_landing_home' => $showOnLandingHome,
                    'is_landing_recommended' => $isLandingRecommended,
                    'landing_sort_order' => (int) ($item['landing_sort_order'] ?? 0),
                ];
            })
            ->filter()
            ->unique('audience_type_id')
            ->values()
            ->all();

        foreach ($overrides as $override) {
            if (! $override['show_on_landing_home']) continue;
            $alreadySelected = SubscriptionPackageAudiencePrice::query()
                ->where('audience_type_id', $override['audience_type_id'])
                ->where('show_on_landing_home', true)
                ->when($package?->id, fn ($query, $id) => $query->where('subscription_package_id', '!=', $id))
                ->count();
            abort_if($alreadySelected >= 3, 422, 'برای هر طیف حداکثر سه پلن را می‌توان در لندینگ نمایش داد.');
        }

        return [
            'name' => $validated['name'],
            'slug' => $validated['slug'] ?: Str::slug($validated['name']),
            'duration_days' => $validated['duration_days'],
            'user_limit' => $validated['user_limit'] ?? null,
            'price_amount' => $validated['price_amount'],
            'discounted_price_amount' => $validated['discounted_price_amount'] ?? null,
            'sms_credit_gift_amount' => (int) ($validated['sms_credit_gift_amount'] ?? 0),
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active' => (bool) ($validated['is_active'] ?? false),
            'audience_overrides' => $overrides,
        ];
    }

    private function matrixUserLimits(): array
    {
        return [1, 2, 3, 5, 10, null];
    }

    private function normalizeLandingRecommendations(SubscriptionPackage $package, array $overrides): void
    {
        foreach ($overrides as $override) {
            if (! ($override['is_landing_recommended'] ?? false)) continue;
            SubscriptionPackageAudiencePrice::query()
                ->where('audience_type_id', $override['audience_type_id'])
                ->where('subscription_package_id', '!=', $package->id)
                ->update(['is_landing_recommended' => false]);
        }
    }
}
