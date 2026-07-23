<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\AudienceType;
use App\Domain\Tenant\Models\FeatureModule;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\View\View;

class FeatureModuleController extends Controller
{
    public function index(): View
    {
        return view('admin.feature-modules.index', [
            'modules' => FeatureModule::query()
                ->withCount('audiencePrices')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->paginate(15),
        ]);
    }

    public function create(): View
    {
        return view('admin.feature-modules.form', [
            'featureModule' => new FeatureModule(['is_active' => true]),
            'audiences' => AudienceType::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'isEdit' => false,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validatePayload($request);

        DB::transaction(function () use ($validated): void {
            $module = FeatureModule::query()->create(collect($validated)->except('audience_overrides')->all());
            $module->audiencePrices()->createMany($validated['audience_overrides']);
        });

        return redirect()->route('admin.feature-modules.index')->with('success', 'ماژول ویژه ذخیره شد.');
    }

    public function edit(FeatureModule $featureModule): View
    {
        return view('admin.feature-modules.form', [
            'featureModule' => $featureModule->load('audiencePrices'),
            'audiences' => AudienceType::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'isEdit' => true,
        ]);
    }

    public function update(Request $request, FeatureModule $featureModule): RedirectResponse
    {
        $validated = $this->validatePayload($request, $featureModule);

        DB::transaction(function () use ($featureModule, $validated): void {
            $featureModule->update(collect($validated)->except('audience_overrides')->all());
            $featureModule->audiencePrices()->delete();
            $featureModule->audiencePrices()->createMany($validated['audience_overrides']);
        });

        return redirect()->route('admin.feature-modules.index')->with('success', 'ماژول ویژه به‌روزرسانی شد.');
    }

    public function destroy(FeatureModule $featureModule): RedirectResponse
    {
        $featureModule->delete();

        return redirect()->route('admin.feature-modules.index')->with('success', 'ماژول ویژه حذف شد.');
    }

    private function validatePayload(Request $request, ?FeatureModule $featureModule = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:feature_modules,slug,' . ($featureModule?->id ?? 'NULL') . ',id'],
            'description' => ['nullable', 'string'],
            'monthly_price_amount' => ['required', 'integer', 'min:0'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'audience_overrides' => ['nullable', 'array'],
            'audience_overrides.*.audience_type_id' => ['required', 'integer', 'exists:audience_types,id'],
            'audience_overrides.*.monthly_price_amount' => ['nullable', 'integer', 'min:0'],
        ]);

        $overrides = collect($validated['audience_overrides'] ?? [])
            ->map(function (array $item): ?array {
                $monthlyPriceAmount = $item['monthly_price_amount'] ?? null;

                if ($monthlyPriceAmount === null || $monthlyPriceAmount === '') {
                    return null;
                }

                return [
                    'audience_type_id' => (int) $item['audience_type_id'],
                    'monthly_price_amount' => (int) $monthlyPriceAmount,
                ];
            })
            ->filter()
            ->unique('audience_type_id')
            ->values()
            ->all();

        return [
            'name' => $validated['name'],
            'slug' => $validated['slug'] ?: Str::slug($validated['name']),
            'description' => $validated['description'] ?? null,
            'monthly_price_amount' => (int) $validated['monthly_price_amount'],
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? false),
            'metadata' => [
                'cta_note' => 'این ماژول نیاز به فعال‌سازی و پرداخت هزینه جداگانه دارد.',
            ],
            'audience_overrides' => $overrides,
        ];
    }
}
