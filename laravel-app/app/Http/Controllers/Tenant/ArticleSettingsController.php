<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\ArticleCategory;
use App\Domain\Tenant\Models\ArticleTag;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class ArticleSettingsController extends Controller
{
    public function showSettings(): JsonResponse
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];

        return response()->json([
            'success' => true,
            'data' => self::settingsFromRules($rules),
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'showInMenu' => ['required', 'boolean'],
        ]);

        $general = $this->generalSettings();
        $rules = $general->booking_rules ?? [];
        $articlesPage = is_array($rules['articles_page'] ?? null) ? $rules['articles_page'] : [];

        $articlesPage['enabled'] = (bool) $validated['enabled'];
        $articlesPage['show_in_menu'] = (bool) $validated['showInMenu'];
        $rules['articles_page'] = $articlesPage;

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.articles.settings_saved'),
            'data' => self::settingsFromRules($rules),
        ]);
    }

    public function listTags(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'items' => self::tagItems(),
            ],
        ]);
    }

    public function listCategories(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'items' => self::categoryItems(),
                'tree' => self::categoryTree(),
            ],
        ]);
    }

    public function storeTag(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:160'],
        ]);

        $tag = ArticleTag::query()->create([
            'name' => trim((string) $validated['name']),
            'slug' => $this->normalizeSlug(
                trim((string) ($validated['slug'] ?? '')) !== ''
                    ? (string) $validated['slug']
                    : (string) $validated['name'],
                ArticleTag::query()->pluck('slug')->all(),
            ),
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.articles.tag_created'),
            'data' => $this->normalizeTagRecord($tag),
        ]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:160'],
            'parentId' => ['nullable', 'integer', 'exists:articles_categories,id'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
            'isActive' => ['nullable', 'boolean'],
        ]);

        $category = ArticleCategory::query()->create([
            'name' => trim((string) $validated['name']),
            'slug' => $this->normalizeSlug(
                trim((string) ($validated['slug'] ?? '')) !== ''
                    ? (string) $validated['slug']
                    : (string) $validated['name'],
                ArticleCategory::query()->pluck('slug')->all(),
            ),
            'parent_id' => isset($validated['parentId']) ? (int) $validated['parentId'] : null,
            'sort_order' => isset($validated['sortOrder']) ? max(0, (int) $validated['sortOrder']) : 0,
            'is_active' => array_key_exists('isActive', $validated) ? (bool) $validated['isActive'] : true,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.articles.category_created'),
            'data' => self::transformCategory($category->fresh('parent')),
        ]);
    }

    public function updateTag(Request $request, string $tagId): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:160'],
        ]);

        $tag = ArticleTag::query()->findOrFail($tagId);

        $otherSlugs = ArticleTag::query()
            ->whereKeyNot($tagId)
            ->pluck('slug')
            ->all();

        $tag->update([
            'name' => trim((string) $validated['name']),
            'slug' => $this->normalizeSlug(
                trim((string) ($validated['slug'] ?? '')) !== ''
                    ? (string) $validated['slug']
                    : (string) $validated['name'],
                $otherSlugs,
            ),
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.articles.tag_updated'),
            'data' => $this->normalizeTagRecord($tag->fresh()),
        ]);
    }

    public function updateCategory(Request $request, string $categoryId): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:160'],
            'parentId' => ['nullable', 'integer', 'exists:articles_categories,id'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
            'isActive' => ['nullable', 'boolean'],
        ]);

        $category = ArticleCategory::query()->with('parent')->findOrFail($categoryId);
        $parentId = isset($validated['parentId']) ? (int) $validated['parentId'] : null;

        abort_if($parentId !== null && $parentId === (int) $category->getKey(), 422, __('tenant.articles.category_self_parent'));

        $descendantIds = $this->descendantIds((int) $category->getKey());
        abort_if($parentId !== null && in_array($parentId, $descendantIds, true), 422, __('tenant.articles.category_descendant_parent'));

        $otherSlugs = ArticleCategory::query()
            ->whereKeyNot($categoryId)
            ->pluck('slug')
            ->all();

        $category->update([
            'name' => trim((string) $validated['name']),
            'slug' => $this->normalizeSlug(
                trim((string) ($validated['slug'] ?? '')) !== ''
                    ? (string) $validated['slug']
                    : (string) $validated['name'],
                $otherSlugs,
            ),
            'parent_id' => $parentId,
            'sort_order' => isset($validated['sortOrder']) ? max(0, (int) $validated['sortOrder']) : 0,
            'is_active' => array_key_exists('isActive', $validated) ? (bool) $validated['isActive'] : true,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.articles.category_updated'),
            'data' => self::transformCategory($category->fresh('parent')),
        ]);
    }

    public function destroyTag(Request $request, string $tagId): JsonResponse
    {
        $this->authorizeAdmin($request);

        ArticleTag::query()->findOrFail($tagId)->delete();

        return response()->json([
            'success' => true,
            'message' => __('tenant.articles.tag_deleted'),
            'data' => [
                'id' => $tagId,
            ],
        ]);
    }

    public function destroyCategory(Request $request, string $categoryId): JsonResponse
    {
        $this->authorizeAdmin($request);

        $category = ArticleCategory::query()->findOrFail($categoryId);

        ArticleCategory::query()
            ->where('parent_id', $category->getKey())
            ->update([
                'parent_id' => $category->parent_id,
            ]);

        $category->delete();

        return response()->json([
            'success' => true,
            'message' => __('tenant.articles.category_deleted'),
            'data' => [
                'id' => $categoryId,
            ],
        ]);
    }

    public static function settingsFromRules(array $rules): array
    {
        $settings = is_array($rules['articles_page'] ?? null) ? $rules['articles_page'] : [];

        return [
            'enabled' => (bool) ($settings['enabled'] ?? false),
            'showInMenu' => (bool) ($settings['show_in_menu'] ?? false),
        ];
    }

    public static function tagItems(): array
    {
        return ArticleTag::query()
            ->latest('id')
            ->get()
            ->map(fn (ArticleTag $item) => self::normalizeTagRecord($item))
            ->values()
            ->all();
    }

    public static function categoryItems(): array
    {
        return ArticleCategory::query()
            ->with('parent')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (ArticleCategory $item) => self::transformCategory($item))
            ->values()
            ->all();
    }

    public static function categoryTree(): array
    {
        $categories = ArticleCategory::query()
            ->with('parent')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return self::buildCategoryTree($categories);
    }

    public static function tagsFromRules(array $rules): array
    {
        return self::tagItems();
    }

    public static function categoriesFromRules(array $rules): array
    {
        return self::categoryTree();
    }

    private static function normalizeTagRecord(mixed $item): array
    {
        if ($item instanceof ArticleTag) {
            return [
                'id' => (string) $item->getKey(),
                'name' => trim((string) $item->name),
                'slug' => trim((string) $item->slug),
                'createdAt' => $item->created_at?->toIso8601String(),
            ];
        }

        $record = is_array($item) ? $item : [];

        return [
            'id' => (string) ($record['id'] ?? ''),
            'name' => trim((string) ($record['name'] ?? '')),
            'slug' => trim((string) ($record['slug'] ?? '')),
            'createdAt' => isset($record['created_at']) ? (string) $record['created_at'] : null,
        ];
    }

    private static function transformCategory(ArticleCategory $item, array $children = []): array
    {
        return [
            'id' => (string) $item->getKey(),
            'name' => trim((string) $item->name),
            'slug' => trim((string) $item->slug),
            'parentId' => $item->parent_id !== null ? (string) $item->parent_id : null,
            'parentName' => $item->parent?->name,
            'sortOrder' => (int) $item->sort_order,
            'isActive' => (bool) $item->is_active,
            'createdAt' => $item->created_at?->toIso8601String(),
            'children' => $children,
        ];
    }

    private static function buildCategoryTree(Collection $categories, ?int $parentId = null): array
    {
        return $categories
            ->filter(fn (ArticleCategory $item) => $item->parent_id === $parentId)
            ->map(function (ArticleCategory $item) use ($categories) {
                return self::transformCategory($item, self::buildCategoryTree($categories, (int) $item->getKey()));
            })
            ->values()
            ->all();
    }

    private function generalSettings(): GeneralSetting
    {
        return GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
    }

    private function normalizeSlug(string $value, array $existingSlugs = []): string
    {
        $slug = trim(mb_strtolower($value, 'UTF-8'));
        $slug = preg_replace('/[^\pL\pN]+/u', '-', $slug) ?? '';
        $slug = trim($slug, '-');

        if ($slug === '') {
            $slug = 'tag';
        }

        return $this->ensureUniqueSlug($slug, collect($existingSlugs));
    }

    private function ensureUniqueSlug(string $slug, Collection $existingSlugs): string
    {
        if (! $existingSlugs->contains($slug)) {
            return $slug;
        }

        $counter = 2;
        $candidate = $slug . '-' . $counter;

        while ($existingSlugs->contains($candidate)) {
            $counter++;
            $candidate = $slug . '-' . $counter;
        }

        return $candidate;
    }

    private function descendantIds(int $categoryId): array
    {
        $categories = ArticleCategory::query()->get(['id', 'parent_id']);
        $queue = [$categoryId];
        $descendants = [];

        while ($queue !== []) {
            $current = array_shift($queue);

            foreach ($categories as $category) {
                if ((int) $category->parent_id !== (int) $current) {
                    continue;
                }

                $childId = (int) $category->id;

                if (in_array($childId, $descendants, true)) {
                    continue;
                }

                $descendants[] = $childId;
                $queue[] = $childId;
            }
        }

        return $descendants;
    }
}
