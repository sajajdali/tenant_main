<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Landing\Models\AudienceCheckoutSetting;
use App\Domain\Tenant\Models\AudienceType;
use App\Http\Controllers\Controller;
use App\Support\AudienceSpecializedCourseSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\View\View;

class AudienceTypeController extends Controller
{
    public function index(): View
    {
        return view('admin.audience-types.index', [
            'audiences' => AudienceType::query()
                ->with('checkoutSetting')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->paginate(15),
        ]);
    }

    public function create(): View
    {
        $currentFeatures = config('audience-features.current');
        $specialFeatures = config('audience-features.special');
        $nutritionFeatures = config('audience-features.nutrition');
        $futureFeatures = config('audience-features.future');
        $defaultFutureFeatures = collect($futureFeatures)
            ->filter(fn (array $feature): bool => empty($feature['scopes']))
            ->keys()
            ->values()
            ->all();
        $defaultNutritionFeatures = collect($nutritionFeatures)->keys()->values()->all();

        return view('admin.audience-types.form', [
            'audience' => new AudienceType([
                'is_active' => true,
                'enabled_features' => array_keys($currentFeatures),
                'future_features' => array_values(array_merge(array_keys($specialFeatures), $defaultFutureFeatures)),
                'nutrition_features' => $defaultNutritionFeatures,
                'specialized_course_settings' => AudienceSpecializedCourseSettings::defaultsFor(),
            ]),
            'checkoutSetting' => new AudienceCheckoutSetting([
                'setup_fee_amount' => 0,
                'setup_fee_label' => 'هزینه نصب و راه‌اندازی',
                'currency' => 'IRR',
                'is_active' => true,
            ]),
            'currentFeatures' => $currentFeatures,
            'specialFeatures' => $specialFeatures,
            'nutritionFeatures' => $nutritionFeatures,
            'futureFeatures' => $futureFeatures,
            'specializedCourseSettings' => AudienceSpecializedCourseSettings::defaultsFor(),
            'isEdit' => false,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        [$audiencePayload, $checkoutPayload] = $this->validatePayload($request);

        $audience = AudienceType::query()->create($audiencePayload);
        $audience->checkoutSetting()->updateOrCreate(
            ['audience_type_id' => $audience->id],
            $checkoutPayload,
        );

        return redirect()->route('admin.audience-types.index')->with('success', 'طیف کاری ذخیره شد.');
    }

    public function edit(AudienceType $audienceType): View
    {
        $currentFeatures = config('audience-features.current');
        $specialFeatures = config('audience-features.special');
        $nutritionFeatures = config('audience-features.nutrition');
        $futureFeatures = config('audience-features.future');

        return view('admin.audience-types.form', [
            'audience' => $audienceType,
            'checkoutSetting' => $audienceType->checkoutSetting ?? new AudienceCheckoutSetting([
                'setup_fee_amount' => 0,
                'setup_fee_label' => 'هزینه نصب و راه‌اندازی',
                'currency' => 'IRR',
                'is_active' => true,
            ]),
            'currentFeatures' => $currentFeatures,
            'specialFeatures' => $specialFeatures,
            'nutritionFeatures' => $nutritionFeatures,
            'futureFeatures' => $futureFeatures,
            'specializedCourseSettings' => AudienceSpecializedCourseSettings::normalize(
                $audienceType->specialized_course_settings,
                $audienceType->slug,
            ),
            'isEdit' => true,
        ]);
    }

    public function update(Request $request, AudienceType $audienceType): RedirectResponse
    {
        [$audiencePayload, $checkoutPayload] = $this->validatePayload($request, $audienceType);

        $audienceType->update($audiencePayload);
        $audienceType->checkoutSetting()->updateOrCreate(
            ['audience_type_id' => $audienceType->id],
            $checkoutPayload,
        );

        return redirect()->route('admin.audience-types.index')->with('success', 'طیف کاری به‌روزرسانی شد.');
    }

    public function destroy(AudienceType $audienceType): RedirectResponse
    {
        $audienceType->delete();

        return redirect()->route('admin.audience-types.index')->with('success', 'طیف کاری حذف شد.');
    }

    private function validatePayload(Request $request, ?AudienceType $audience = null): array
    {
        $currentFeatureKeys = array_keys(config('audience-features.current'));
        $nutritionFeatureKeys = array_keys(config('audience-features.nutrition'));
        $futureFeatureKeys = array_values(array_merge(
            array_keys(config('audience-features.special')),
            array_keys(config('audience-features.future')),
        ));

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:audience_types,slug,' . ($audience?->id ?? 'NULL') . ',id'],
            'singular_label' => ['required', 'string', 'max:255'],
            'plural_label' => ['required', 'string', 'max:255'],
            'business_label' => ['required', 'string', 'max:255'],
            'enabled_features' => ['nullable', 'array'],
            'enabled_features.*' => ['string', 'in:' . implode(',', $currentFeatureKeys)],
            'nutrition_features' => ['nullable', 'array'],
            'nutrition_features.*' => ['string', 'in:' . implode(',', $nutritionFeatureKeys)],
            'future_features' => ['nullable', 'array'],
            'future_features.*' => ['string', 'in:' . implode(',', $futureFeatureKeys)],
            'specialized_course_settings' => ['nullable', 'array'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'setup_fee_amount' => ['nullable', 'integer', 'min:0'],
            'setup_fee_label' => ['nullable', 'string', 'max:255'],
        ]);

        return [[
            'name' => $validated['name'],
            'slug' => $validated['slug'] ?: Str::slug($validated['name']),
            'singular_label' => $validated['singular_label'],
            'plural_label' => $validated['plural_label'],
            'business_label' => $validated['business_label'],
            'enabled_features' => array_values($validated['enabled_features'] ?? []),
            'nutrition_features' => array_values($validated['nutrition_features'] ?? []),
            'future_features' => array_values($validated['future_features'] ?? []),
            'specialized_course_settings' => AudienceSpecializedCourseSettings::normalize(
                $validated['specialized_course_settings'] ?? [],
                $validated['slug'] ?: Str::slug($validated['name']),
            ),
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active' => (bool) ($validated['is_active'] ?? false),
        ], [
            'setup_fee_amount' => (int) ($validated['setup_fee_amount'] ?? 0),
            'setup_fee_label' => trim((string) ($validated['setup_fee_label'] ?? '')) ?: 'هزینه نصب و راه‌اندازی',
            'currency' => 'IRR',
            'is_active' => true,
        ]];
    }
}
