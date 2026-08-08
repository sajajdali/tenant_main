<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\NutritionPackage;
use App\Domain\Tenant\Models\NutritionDietTemplate;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class NutritionPackageController extends Controller
{
    private const APPLICABLE_GOALS = [
        'lose-weight',
        'gain-weight',
        'maintain-weight',
    ];

    private const VISUAL_STYLES = [
        'normal',
        'gold',
        'vip',
    ];

    private const FIRST_DIET_TEMPLATE_MODES = [
        'default',
        'custom',
        'disabled',
    ];

    private const FEATURE_ICONS = [
        'clipboard',
        'user',
        'target',
        'chart',
        'headphones',
        'utensils',
        'camera',
        'apple',
        'shield',
        'sparkles',
    ];

    public function publicIndex(): JsonResponse
    {
        $goal = trim((string) request()->query('goal', ''));

        $items = NutritionPackage::query()
            ->with(['children.children', 'firstDietTemplate'])
            ->where('is_active', true)
            ->get();

        $tree = $this->buildPackageTree($items, $goal);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $tree,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $items = NutritionPackage::query()
            ->with(['children.children', 'firstDietTemplate'])
            ->whereNull('parent_id')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $parentOptions = NutritionPackage::query()
            ->orderBy('depth')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (NutritionPackage $item) => [
                'id' => (string) $item->id,
                'name' => $item->name,
                'depth' => (int) $item->depth,
                'label' => str_repeat('— ', (int) $item->depth) . $item->name,
                'canHaveChild' => (int) $item->depth < 2,
            ])
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(fn (NutritionPackage $item) => $this->transformPackage($item))->values()->all(),
                'parentOptions' => $parentOptions,
                'goalOptions' => $this->goalOptions()
                    ->map(fn (string $label, string $value) => [
                        'value' => $value,
                        'label' => $label,
                    ])
                    ->values()
                    ->all(),
                'dietTemplateOptions' => $this->dietTemplateOptions(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        [$validated, $parent, $depth] = $this->validatePackage($request);

        $imagePath = isset($validated['image']) && $validated['image'] instanceof UploadedFile
            ? $validated['image']->store('nutrition/packages', 'media_public')
            : null;
        if ($imagePath !== null) {
            $this->recordTenantMediaFile($imagePath, (int) $validated['image']->getSize());
        }

        $package = NutritionPackage::query()->create([
            'parent_id' => $parent?->id,
            'depth' => $depth,
            'name' => trim((string) $validated['name']),
            'short_title' => $this->normalizeShortText($validated['short_title'] ?? null),
            'subtitle' => $this->normalizeShortText($validated['subtitle'] ?? null),
            'slug' => $this->uniqueSlug((string) ($validated['slug'] ?? $validated['name'])),
            'description' => $this->normalizeDescription($validated['description'] ?? null),
            'features' => $this->normalizeFeatures($validated['features'] ?? []),
            'image_path' => $imagePath,
            'online_diet_count' => (int) $validated['online_diet_count'],
            'offline_diet_count' => (int) $validated['offline_diet_count'],
            'duration_days' => (int) $validated['duration_days'],
            'price_amount' => (int) $validated['price_amount'],
            'discounted_price_amount' => $this->normalizeDiscountedPrice($validated['discounted_price_amount'] ?? null, (int) $validated['price_amount']),
            'cafebazaar_product_id' => $this->normalizeBazaarProductId($validated['cafebazaar_product_id'] ?? null),
            'badge_title' => $this->normalizeBadgeTitle($validated['badge_title'] ?? null),
            'is_recommended' => (bool) ($validated['is_recommended'] ?? false),
            'visual_style' => $this->normalizeVisualStyle($validated['visual_style'] ?? 'normal'),
            'action_label' => $this->normalizeShortText($validated['action_label'] ?? null),
            'first_diet_template_mode' => $this->normalizeFirstDietTemplateMode($validated['first_diet_template_mode'] ?? 'default'),
            'first_diet_template_id' => $this->normalizeFirstDietTemplateMode($validated['first_diet_template_mode'] ?? 'default') === 'custom'
                ? ($validated['first_diet_template_id'] ?? null)
                : null,
            'first_diet_template_ids' => $this->normalizeFirstDietTemplateMode($validated['first_diet_template_mode'] ?? 'default') === 'custom'
                ? $this->normalizeGoalTemplateIds($validated['first_diet_template_ids'] ?? [], $validated['first_diet_template_id'] ?? null)
                : null,
            'applicable_goals' => array_values($validated['applicable_goals']),
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'پکیج تغذیه ذخیره شد.',
            'data' => $this->transformPackage($package),
        ]);
    }

    public function update(Request $request, NutritionPackage $nutritionPackage): JsonResponse
    {
        $this->ensureAdmin($request);

        [$validated, $parent, $depth] = $this->validatePackage($request, $nutritionPackage);

        if ((bool) ($validated['remove_image'] ?? false)) {
            $this->deletePhysicalFile($nutritionPackage->image_path);
            $nutritionPackage->image_path = null;
        }

        if (isset($validated['image']) && $validated['image'] instanceof UploadedFile) {
            $this->deletePhysicalFile($nutritionPackage->image_path);
            $nutritionPackage->image_path = $validated['image']->store('nutrition/packages', 'media_public');
            $this->recordTenantMediaFile($nutritionPackage->image_path, (int) $validated['image']->getSize());
        }

        $nutritionPackage->update([
            'parent_id' => $parent?->id,
            'depth' => $depth,
            'name' => trim((string) $validated['name']),
            'short_title' => $this->normalizeShortText($validated['short_title'] ?? null),
            'subtitle' => $this->normalizeShortText($validated['subtitle'] ?? null),
            'slug' => $this->uniqueSlug((string) ($validated['slug'] ?? $validated['name']), (int) $nutritionPackage->id),
            'description' => $this->normalizeDescription($validated['description'] ?? null),
            'features' => $this->normalizeFeatures($validated['features'] ?? []),
            'image_path' => $nutritionPackage->image_path,
            'online_diet_count' => (int) $validated['online_diet_count'],
            'offline_diet_count' => (int) $validated['offline_diet_count'],
            'duration_days' => (int) $validated['duration_days'],
            'price_amount' => (int) $validated['price_amount'],
            'discounted_price_amount' => $this->normalizeDiscountedPrice($validated['discounted_price_amount'] ?? null, (int) $validated['price_amount']),
            'cafebazaar_product_id' => $this->normalizeBazaarProductId($validated['cafebazaar_product_id'] ?? null),
            'badge_title' => $this->normalizeBadgeTitle($validated['badge_title'] ?? null),
            'is_recommended' => (bool) ($validated['is_recommended'] ?? false),
            'visual_style' => $this->normalizeVisualStyle($validated['visual_style'] ?? 'normal'),
            'action_label' => $this->normalizeShortText($validated['action_label'] ?? null),
            'first_diet_template_mode' => $this->normalizeFirstDietTemplateMode($validated['first_diet_template_mode'] ?? 'default'),
            'first_diet_template_id' => $this->normalizeFirstDietTemplateMode($validated['first_diet_template_mode'] ?? 'default') === 'custom'
                ? ($validated['first_diet_template_id'] ?? null)
                : null,
            'first_diet_template_ids' => $this->normalizeFirstDietTemplateMode($validated['first_diet_template_mode'] ?? 'default') === 'custom'
                ? $this->normalizeGoalTemplateIds($validated['first_diet_template_ids'] ?? [], $validated['first_diet_template_id'] ?? null)
                : null,
            'applicable_goals' => array_values($validated['applicable_goals']),
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) $validated['is_active'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'پکیج تغذیه به‌روزرسانی شد.',
            'data' => $this->transformPackage($nutritionPackage->fresh()),
        ]);
    }

    public function destroy(Request $request, NutritionPackage $nutritionPackage): JsonResponse
    {
        $this->ensureAdmin($request);

        abort_if(
            $nutritionPackage->children()->exists(),
            422,
            'این پکیج زیرمجموعه دارد. ابتدا زیرمجموعه‌های آن را حذف یا جابه‌جا کنید.'
        );

        $this->deletePhysicalFile($nutritionPackage->image_path);
        $nutritionPackage->delete();

        return response()->json([
            'success' => true,
            'message' => 'پکیج تغذیه حذف شد.',
        ]);
    }

    private function validatePackage(Request $request, ?NutritionPackage $package = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'short_title' => ['nullable', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'features' => ['nullable', 'array', 'max:12'],
            'features.*.icon' => ['nullable', 'string', 'in:' . implode(',', self::FEATURE_ICONS)],
            'features.*.text' => ['nullable', 'string', 'max:255'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'parent_id' => ['nullable', 'integer', 'exists:nutrition_packages,id'],
            'online_diet_count' => ['required', 'integer', 'min:0'],
            'offline_diet_count' => ['required', 'integer', 'min:0'],
            'duration_days' => ['required', 'integer', 'min:1'],
            'price_amount' => ['required', 'integer', 'min:0'],
            'discounted_price_amount' => ['nullable', 'integer', 'min:0'],
            'cafebazaar_product_id' => ['nullable', 'string', 'max:191'],
            'badge_title' => ['nullable', 'string', 'max:80'],
            'is_recommended' => ['nullable', 'boolean'],
            'visual_style' => ['nullable', 'string', 'in:' . implode(',', self::VISUAL_STYLES)],
            'action_label' => ['nullable', 'string', 'max:80'],
            'first_diet_template_mode' => ['nullable', 'string', 'in:' . implode(',', self::FIRST_DIET_TEMPLATE_MODES)],
            'first_diet_template_id' => ['nullable', 'integer', 'exists:nutrition_diet_templates,id'],
            'first_diet_template_ids' => ['nullable', 'array'],
            'first_diet_template_ids.lose-weight' => ['nullable', 'integer', 'exists:nutrition_diet_templates,id'],
            'first_diet_template_ids.gain-weight' => ['nullable', 'integer', 'exists:nutrition_diet_templates,id'],
            'first_diet_template_ids.maintain-weight' => ['nullable', 'integer', 'exists:nutrition_diet_templates,id'],
            'applicable_goals' => ['required', 'array', 'min:1'],
            'applicable_goals.*' => ['string', 'in:' . implode(',', self::APPLICABLE_GOALS)],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => [$package ? 'required' : 'nullable', 'boolean'],
            'remove_image' => ['nullable', 'boolean'],
        ], [
            'name.required' => 'نام پکیج را وارد کنید.',
            'online_diet_count.required' => 'تعداد رژیم آنلاین را مشخص کنید.',
            'offline_diet_count.required' => 'تعداد رژیم اختصاصی را مشخص کنید.',
            'duration_days.required' => 'مدت پکیج را وارد کنید.',
            'price_amount.required' => 'قیمت پکیج را وارد کنید.',
            'applicable_goals.required' => 'حداقل یک هدف را برای نمایش این پکیج انتخاب کنید.',
        ]);

        $parent = null;
        $depth = 0;

        if (! empty($validated['parent_id'])) {
            /** @var NutritionPackage|null $parent */
            $parent = NutritionPackage::query()->find((int) $validated['parent_id']);

            abort_if(! $parent, 422, 'والد انتخاب‌شده معتبر نیست.');
            abort_if($package && $parent->id === $package->id, 422, 'یک پکیج نمی‌تواند والد خودش باشد.');
            abort_if($package && $parent->parent_id === $package->id, 422, 'این جابه‌جایی باعث حلقه در ساختار پکیج‌ها می‌شود.');
            abort_if((int) $parent->depth >= 2, 422, 'حداکثر عمق زیرمجموعه برای پکیج‌های تغذیه دو مرحله است.');

            $depth = (int) $parent->depth + 1;
        }

        if (($validated['first_diet_template_mode'] ?? 'default') === 'custom') {
            $templateIds = $this->normalizeGoalTemplateIds($validated['first_diet_template_ids'] ?? [], $validated['first_diet_template_id'] ?? null);
            if (count($templateIds) < count(self::APPLICABLE_GOALS)) {
                abort(422, 'برای رژیم اول اختصاصی این پکیج، الگوی هر هدف را جدا انتخاب کنید.');
            }
        }

        return [$validated, $parent, $depth];
    }

    private function transformPackage(NutritionPackage $item): array
    {
        $item->loadMissing(['children.children']);
        $item->loadMissing(['firstDietTemplate']);
        $goals = collect($item->applicable_goals ?? [])->filter()->values()->all();

        return [
            'id' => (string) $item->id,
            'parentId' => $item->parent_id ? (string) $item->parent_id : null,
            'depth' => (int) $item->depth,
            'name' => $item->name,
            'shortTitle' => $item->short_title,
            'subtitle' => $item->subtitle,
            'slug' => $item->slug,
            'description' => $item->description,
            'features' => $this->normalizeFeatures($item->features ?? []),
            'imageUrl' => $this->tenantMediaUrl($item->image_path),
            'onlineDietCount' => (int) $item->online_diet_count,
            'offlineDietCount' => (int) $item->offline_diet_count,
            'durationDays' => (int) $item->duration_days,
            'priceAmount' => (int) $item->price_amount,
            'discountedPriceAmount' => $item->discounted_price_amount !== null ? (int) $item->discounted_price_amount : null,
            'cafebazaarProductId' => $item->cafebazaar_product_id,
            'badgeTitle' => $item->badge_title,
            'isRecommended' => (bool) $item->is_recommended,
            'visualStyle' => $this->normalizeVisualStyle($item->visual_style ?? 'normal'),
            'actionLabel' => $item->action_label,
            'firstDietTemplateMode' => $this->normalizeFirstDietTemplateMode($item->first_diet_template_mode ?? 'default'),
            'firstDietTemplateId' => $item->first_diet_template_id ? (string) $item->first_diet_template_id : null,
            'firstDietTemplateIds' => collect($this->normalizeGoalTemplateIds($item->first_diet_template_ids ?? [], $item->first_diet_template_id))
                ->map(fn (int $templateId): string => (string) $templateId)
                ->all(),
            'firstDietTemplateName' => $item->firstDietTemplate?->name,
            'applicableGoals' => $goals,
            'applicableGoalLabels' => collect($goals)
                ->map(fn (string $goal) => $this->goalOptions()->get($goal, $goal))
                ->values()
                ->all(),
            'sortOrder' => (int) $item->sort_order,
            'isActive' => (bool) $item->is_active,
            'children' => $item->children
                ->sortBy(['sort_order', 'name'])
                ->map(fn (NutritionPackage $child) => $this->transformPackage($child))
                ->values()
                ->all(),
            'createdAt' => $item->created_at?->toISOString(),
        ];
    }

    private function buildPackageTree($items, string $goal): array
    {
        $roots = $items
            ->filter(fn (NutritionPackage $item) => $item->parent_id === null)
            ->sortBy(['sort_order', 'name'])
            ->values();

        return $roots
            ->map(fn (NutritionPackage $item) => $this->transformPackageForGoal($item, $goal))
            ->filter()
            ->values()
            ->all();
    }

    private function transformPackageForGoal(NutritionPackage $item, string $goal): ?array
    {
        $children = $item->children
            ->sortBy(['sort_order', 'name'])
            ->map(fn (NutritionPackage $child) => $this->transformPackageForGoal($child, $goal))
            ->filter()
            ->values()
            ->all();

        $goals = collect($item->applicable_goals ?? [])->filter()->values()->all();
        $matchesGoal = $goal === '' || $goals === [] || in_array($goal, $goals, true);

        if (! $matchesGoal && count($children) === 0) {
            return null;
        }

        $payload = $this->transformPackage($item);
        $payload['children'] = $children;

        return $payload;
    }

    private function uniqueSlug(string $value, ?int $ignoreId = null): string
    {
        $base = Str::slug(trim($value) !== '' ? $value : 'nutrition-package');
        $slug = $base !== '' ? $base : 'nutrition-package';
        $counter = 1;

        while (
            NutritionPackage::query()
                ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
                ->where('slug', $slug)
                ->exists()
        ) {
            $slug = $base . '-' . $counter;
            $counter++;
        }

        return $slug;
    }

    private function normalizeDiscountedPrice(null|int|string $value, int $priceAmount): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $discounted = (int) $value;

        if ($discounted <= 0 || $discounted >= $priceAmount) {
            return null;
        }

        return $discounted;
    }

    private function normalizeBadgeTitle(null|string $value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    private function normalizeBazaarProductId(null|string $value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    private function normalizeShortText(null|string $value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    private function normalizeVisualStyle(null|string $value): string
    {
        $normalized = trim((string) $value);

        return in_array($normalized, self::VISUAL_STYLES, true) ? $normalized : 'normal';
    }

    private function normalizeFirstDietTemplateMode(null|string $value): string
    {
        $normalized = trim((string) $value);

        return in_array($normalized, self::FIRST_DIET_TEMPLATE_MODES, true) ? $normalized : 'default';
    }

    private function normalizeGoalTemplateIds(mixed $value, mixed $legacyTemplateId = null): array
    {
        $items = is_array($value) ? $value : [];
        $legacy = is_numeric($legacyTemplateId) && (int) $legacyTemplateId > 0 ? (int) $legacyTemplateId : null;

        return collect(self::APPLICABLE_GOALS)
            ->mapWithKeys(function (string $goal) use ($items, $legacy): array {
                $templateId = $items[$goal] ?? $legacy;

                return [$goal => is_numeric($templateId) && (int) $templateId > 0 ? (int) $templateId : null];
            })
            ->filter(fn (?int $templateId): bool => $templateId !== null)
            ->all();
    }

    private function normalizeFeatures(array $features): array
    {
        return collect($features)
            ->map(function ($feature): ?array {
                if (! is_array($feature)) {
                    return null;
                }

                $text = trim((string) ($feature['text'] ?? ''));
                if ($text === '') {
                    return null;
                }

                $icon = trim((string) ($feature['icon'] ?? 'clipboard'));

                return [
                    'icon' => in_array($icon, self::FEATURE_ICONS, true) ? $icon : 'clipboard',
                    'text' => $text,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function normalizeDescription(null|string $value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    private function deletePhysicalFile(?string $path): void
    {
        $this->deleteTenantMediaFile($path);
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
    }

    private function goalOptions()
    {
        return collect([
            'lose-weight' => 'کاهش وزن',
            'gain-weight' => 'افزایش وزن',
            'maintain-weight' => 'تثبیت وزن',
        ]);
    }

    private function dietTemplateOptions(): array
    {
        return NutritionDietTemplate::query()
            ->where('is_active', true)
            ->orderBy('depth')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'depth'])
            ->map(fn (NutritionDietTemplate $item): array => [
                'value' => (string) $item->id,
                'label' => str_repeat('— ', (int) $item->depth) . $item->name,
            ])
            ->values()
            ->all();
    }
}
