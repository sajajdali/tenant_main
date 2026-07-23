<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\ArticleCategory;
use App\Domain\Tenant\Models\ArticlePost;
use App\Domain\Tenant\Models\ArticleTag;
use App\Http\Controllers\Controller;
use App\Support\JalaliDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class ArticlePostController extends Controller
{
    public function publicIndex(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:160'],
            'category' => ['nullable', 'string', 'max:160'],
            'tag' => ['nullable', 'string', 'max:160'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:24'],
        ]);

        $search = trim((string) ($validated['q'] ?? ''));
        $categoryFilter = trim((string) ($validated['category'] ?? ''));
        $tagFilter = trim((string) ($validated['tag'] ?? ''));
        $perPage = (int) ($validated['per_page'] ?? 6);
        $selectedCategory = $categoryFilter !== '' ? $this->resolveCategoryFilter($categoryFilter) : null;
        $selectedTag = $tagFilter !== '' ? $this->resolveTagFilter($tagFilter) : null;

        $page = ArticlePost::query()
            ->with(['category', 'tags'])
            ->where('is_active', true)
            ->whereNotNull('published_at')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($subQuery) use ($search) {
                    $subQuery
                        ->where('title', 'like', '%' . $search . '%')
                        ->orWhere('excerpt', 'like', '%' . $search . '%')
                        ->orWhere('content', 'like', '%' . $search . '%')
                        ->orWhere('author_name', 'like', '%' . $search . '%')
                        ->orWhereHas('tags', fn ($tagQuery) => $tagQuery->where('name', 'like', '%' . $search . '%'));
                });
            })
            ->when($selectedCategory instanceof ArticleCategory, fn ($query) => $query->whereIn('article_category_id', $this->categoryFilterIds((int) $selectedCategory->getKey())))
            ->when($categoryFilter !== '' && ! $selectedCategory, fn ($query) => $query->whereRaw('1 = 0'))
            ->when($selectedTag instanceof ArticleTag, fn ($query) => $query->whereHas('tags', fn ($tagQuery) => $tagQuery->whereKey($selectedTag->getKey())))
            ->when($tagFilter !== '' && ! $selectedTag, fn ($query) => $query->whereRaw('1 = 0'))
            ->orderByDesc('sort_order')
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        $items = ArticlePost::query()
            ->with(['category', 'tags'])
            ->where('is_active', true)
            ->whereNotNull('published_at')
            ->orderByDesc('sort_order')
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->get();

        $latestNews = ArticlePost::query()
            ->with(['category', 'tags'])
            ->where('is_active', true)
            ->whereNotNull('published_at')
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit(6)
            ->get()
            ->map(fn (ArticlePost $item) => $this->transformPost($item))
            ->values()
            ->all();
        $featured = $items->first(fn (ArticlePost $item) => $item->is_featured) ?? $items->first();
        $important = $items->first(fn (ArticlePost $item) => $item->is_important);
        $featuredNews = $items
            ->filter(fn (ArticlePost $item) => $item->is_featured || $item->is_important || $item->show_in_featured_slider)
            ->take(6)
            ->values()
            ->map(fn (ArticlePost $item) => $this->transformPost($item))
            ->all();
        $sliderItems = $items
            ->filter(fn (ArticlePost $item) => $item->show_in_featured_slider)
            ->take(5)
            ->values()
            ->map(fn (ArticlePost $item) => $this->transformPost($item))
            ->all();
        $popularItems = ArticlePost::query()
            ->with(['category', 'tags'])
            ->where('is_active', true)
            ->whereNotNull('published_at')
            ->orderByDesc('view_count')
            ->orderByDesc('published_at')
            ->limit(4)
            ->get()
            ->map(fn (ArticlePost $item) => $this->transformPost($item))
            ->values()
            ->all();
        $categories = ArticleSettingsController::categoryTree();
        $tags = ArticleSettingsController::tagItems();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $page->getCollection()->map(fn (ArticlePost $item) => $this->transformPost($item))->values()->all(),
                'currentPage' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
                'query' => $search !== '' ? $search : null,
                'activeCategory' => $selectedCategory ? $this->transformCategoryFilter($selectedCategory) : null,
                'activeTag' => $selectedTag ? $this->transformTagFilter($selectedTag) : null,
                'featured' => $featured ? $this->transformPost($featured) : null,
                'heroArticle' => $featured ? $this->transformPost($featured) : null,
                'important' => $important ? $this->transformPost($important) : null,
                'latestNews' => $latestNews,
                'featuredNews' => $featuredNews,
                'slider' => $sliderItems,
                'popular' => $popularItems,
                'categories' => $categories,
                'categoryList' => $categories,
                'tags' => $tags,
            ],
        ]);
    }

    public function publicShow(string $articleId): JsonResponse
    {
        $post = ArticlePost::query()
            ->with(['category', 'tags'])
            ->whereKey($articleId)
            ->where('is_active', true)
            ->whereNotNull('published_at')
            ->firstOrFail();

        $post->increment('view_count');
        $post->refresh()->loadMissing(['category', 'tags']);

        $related = ArticlePost::query()
            ->with(['category', 'tags'])
            ->where('is_active', true)
            ->where('id', '!=', $post->id)
            ->when($post->article_category_id !== null, fn ($query) => $query->where('article_category_id', $post->article_category_id))
            ->orderByDesc('sort_order')
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit(3)
            ->get();

        if ($related->count() < 3) {
            $existingIds = $related->pluck('id')->push($post->id)->all();
            $fallback = ArticlePost::query()
                ->with(['category', 'tags'])
                ->where('is_active', true)
                ->whereNotIn('id', $existingIds)
                ->orderByDesc('sort_order')
                ->orderByDesc('published_at')
                ->orderByDesc('id')
                ->limit(3 - $related->count())
                ->get();
            $related = $related->concat($fallback);
        }

        $nextArticle = $this->nextPublicPost($post);

        return response()->json([
            'success' => true,
            'data' => [
                'item' => $this->transformPost($post),
                'related' => $related->map(fn (ArticlePost $item) => $this->transformPost($item))->values()->all(),
                'nextArticle' => $nextArticle ? $this->transformPost($nextArticle) : null,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $items = ArticlePost::query()
            ->with(['category', 'tags'])
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->get();

        $featured = $items->first(fn (ArticlePost $item) => $item->is_featured);
        $important = $items->first(fn (ArticlePost $item) => $item->is_important);
        $sliderItems = $items
            ->filter(fn (ArticlePost $item) => $item->show_in_featured_slider)
            ->take(5)
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(fn (ArticlePost $item) => $this->transformPost($item))->values()->all(),
                'stats' => [
                    'total' => $items->count(),
                    'published' => $items->filter(fn (ArticlePost $item) => $item->is_active)->count(),
                    'featuredTitle' => $featured?->title,
                    'importantTitle' => $important?->title,
                    'sliderCount' => $sliderItems->count(),
                ],
                'tagOptions' => ArticleSettingsController::tagItems(),
                'categoryOptions' => ArticleSettingsController::categoryItems(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $this->validatePayload($request);

        $post = DB::transaction(function () use ($validated, $request) {
            $post = new ArticlePost();
            $this->fillPost($post, $validated, $request, false);
            $post->save();
            $this->syncTags($post, $validated['tag_ids'] ?? []);
            $this->syncExclusiveFlags($post);

            return $post;
        });

        return response()->json([
            'success' => true,
            'message' => 'خبر یا مقاله جدید ذخیره شد.',
            'data' => $this->transformPost($post->fresh(['category', 'tags'])),
        ]);
    }

    public function update(Request $request, string $postId): JsonResponse
    {
        $this->authorizeAdmin($request);

        $post = ArticlePost::query()->with(['category', 'tags'])->findOrFail($postId);
        $validated = $this->validatePayload($request, (int) $post->id);

        DB::transaction(function () use ($post, $validated, $request) {
            $this->fillPost($post, $validated, $request, true);
            $post->save();
            $this->syncTags($post, $validated['tag_ids'] ?? []);
            $this->syncExclusiveFlags($post);
        });

        return response()->json([
            'success' => true,
            'message' => 'خبر یا مقاله ویرایش شد.',
            'data' => $this->transformPost($post->fresh(['category', 'tags'])),
        ]);
    }

    public function destroy(Request $request, string $postId): JsonResponse
    {
        $this->authorizeAdmin($request);

        $post = ArticlePost::query()->findOrFail($postId);
        $this->deletePhysicalFile($post->image_path);
        $post->tags()->detach();
        $post->delete();

        return response()->json([
            'success' => true,
            'message' => 'خبر یا مقاله حذف شد.',
            'data' => [
                'id' => $postId,
            ],
        ]);
    }

    private function validatePayload(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'article_category_id' => ['nullable', 'integer', 'exists:articles_categories,id'],
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:articles_posts,slug' . ($ignoreId ? ',' . $ignoreId : '')],
            'excerpt' => ['nullable', 'string', 'max:1500'],
            'content' => ['nullable', 'string', 'max:50000'],
            'key_points' => ['nullable', 'array', 'max:10'],
            'key_points.*' => ['nullable', 'string', 'max:300'],
            'author_name' => ['required', 'string', 'max:160'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'remove_image' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['required', 'boolean'],
            'is_featured' => ['required', 'boolean'],
            'show_in_featured_slider' => ['required', 'boolean'],
            'is_important' => ['required', 'boolean'],
            'published_at' => ['nullable', 'date'],
            'tag_ids' => ['nullable', 'array'],
            'tag_ids.*' => ['integer', 'exists:articles_tags,id'],
        ], [
            'title.required' => 'عنوان خبر را وارد کنید.',
            'author_name.required' => 'نام نویسنده را وارد کنید.',
        ]);
    }

    private function fillPost(ArticlePost $post, array $validated, Request $request, bool $isUpdate): void
    {
        if ($isUpdate && (bool) ($validated['remove_image'] ?? false)) {
            $this->deletePhysicalFile($post->image_path);
            $post->image_path = null;
        }

        /** @var UploadedFile|null $image */
        $image = $request->file('image');
        if ($image instanceof UploadedFile) {
            $this->deletePhysicalFile($post->image_path);
            $post->image_path = $image->store('articles/posts', 'media_public');
            $this->recordTenantMediaFile($post->image_path, (int) $image->getSize());
        }

        $post->article_category_id = isset($validated['article_category_id']) ? (int) $validated['article_category_id'] : null;
        $post->title = trim((string) $validated['title']);
        $post->slug = $this->uniqueSlug((string) ($validated['slug'] ?? $validated['title']), $isUpdate ? (int) $post->id : null);
        $post->excerpt = trim((string) ($validated['excerpt'] ?? '')) ?: null;
        $post->content = trim((string) ($validated['content'] ?? '')) ?: null;
        $post->key_points = $this->normalizeKeyPoints($validated['key_points'] ?? []);
        $post->author_name = trim((string) $validated['author_name']);
        $post->sort_order = (int) ($validated['sort_order'] ?? 0);
        $post->is_active = (bool) $validated['is_active'];
        $post->is_featured = (bool) $validated['is_featured'];
        $post->show_in_featured_slider = (bool) $validated['show_in_featured_slider'];
        $post->is_important = (bool) $validated['is_important'];
        $post->published_at = !empty($validated['published_at']) ? $validated['published_at'] : now();
        $post->view_count = $post->exists ? (int) $post->view_count : 0;
    }

    private function syncTags(ArticlePost $post, array $tagIds): void
    {
        $post->tags()->sync(
            collect($tagIds)
                ->map(fn ($item) => (int) $item)
                ->unique()
                ->values()
                ->all()
        );
    }

    private function syncExclusiveFlags(ArticlePost $post): void
    {
        if ($post->is_featured) {
            ArticlePost::query()
                ->whereKeyNot($post->getKey())
                ->where('is_featured', true)
                ->update(['is_featured' => false]);
        }

        if ($post->is_important) {
            ArticlePost::query()
                ->whereKeyNot($post->getKey())
                ->where('is_important', true)
                ->update(['is_important' => false]);
        }
    }

    private function nextPublicPost(ArticlePost $post): ?ArticlePost
    {
        return ArticlePost::query()
            ->with(['category', 'tags'])
            ->where('is_active', true)
            ->whereNotNull('published_at')
            ->whereKeyNot($post->getKey())
            ->where(function ($query) use ($post): void {
                $query
                    ->where('sort_order', '<', (int) $post->sort_order)
                    ->orWhere(function ($nested) use ($post): void {
                        $nested
                            ->where('sort_order', (int) $post->sort_order)
                            ->where('published_at', '<', $post->published_at);
                    })
                    ->orWhere(function ($nested) use ($post): void {
                        $nested
                            ->where('sort_order', (int) $post->sort_order)
                            ->where('published_at', $post->published_at)
                            ->where('id', '<', $post->id);
                    });
            })
            ->orderByDesc('sort_order')
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->first();
    }

    private function transformPost(ArticlePost $post): array
    {
        $post->loadMissing(['category', 'tags']);
        $readingTimeMinutes = $this->readingTimeMinutes($post);

        return [
            'id' => (string) $post->id,
            'categoryId' => $post->article_category_id ? (string) $post->article_category_id : null,
            'categoryName' => $post->category?->name,
            'categorySlug' => $post->category?->slug,
            'title' => $post->title,
            'slug' => $post->slug,
            'excerpt' => $post->excerpt,
            'content' => $post->content,
            'keyPoints' => $this->normalizeKeyPoints($post->key_points ?? []),
            'authorName' => $post->author_name,
            'imageUrl' => $this->tenantMediaUrl($post->image_path),
            'sortOrder' => (int) $post->sort_order,
            'isActive' => (bool) $post->is_active,
            'isFeatured' => (bool) $post->is_featured,
            'showInFeaturedSlider' => (bool) $post->show_in_featured_slider,
            'isImportant' => (bool) $post->is_important,
            'publishedAt' => $post->published_at?->toIso8601String(),
            'publishedAtJalali' => $post->published_at ? JalaliDate::format($post->published_at) : null,
            'readingTimeMinutes' => $readingTimeMinutes,
            'readingTimeLabel' => JalaliDate::toPersianDigits((string) $readingTimeMinutes).' دقیقه مطالعه',
            'viewCount' => (int) $post->view_count,
            'tagIds' => $post->tags->map(fn (ArticleTag $tag) => (string) $tag->id)->values()->all(),
            'tags' => $post->tags->map(fn (ArticleTag $tag) => [
                'id' => (string) $tag->id,
                'name' => $tag->name,
                'slug' => $tag->slug,
            ])->values()->all(),
            'createdAt' => $post->created_at?->toIso8601String(),
        ];
    }

    private function readingTimeMinutes(ArticlePost $post): int
    {
        $text = trim(strip_tags((string) ($post->content ?: $post->excerpt ?: $post->title)));
        $wordCount = $text === '' ? 0 : str_word_count(preg_replace('/[^\pL\pN\s]+/u', ' ', $text) ?? '', 0, "اآبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیيئءأةكۀ");

        return max(1, (int) ceil($wordCount / 180));
    }

    private function normalizeKeyPoints(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return collect($value)
            ->map(fn ($item) => trim((string) $item))
            ->filter(fn ($item) => $item !== '')
            ->unique()
            ->take(10)
            ->values()
            ->all();
    }

    private function resolveCategoryFilter(string $value): ?ArticleCategory
    {
        return ArticleCategory::query()
            ->where('slug', $value)
            ->orWhere('id', $value)
            ->first();
    }

    private function resolveTagFilter(string $value): ?ArticleTag
    {
        return ArticleTag::query()
            ->where('slug', $value)
            ->orWhere('id', $value)
            ->first();
    }

    private function categoryFilterIds(int $categoryId): array
    {
        $categories = ArticleCategory::query()->get(['id', 'parent_id']);
        $queue = [$categoryId];
        $descendants = [$categoryId];

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

    private function transformCategoryFilter(ArticleCategory $category): array
    {
        return [
            'id' => (string) $category->getKey(),
            'name' => trim((string) $category->name),
            'slug' => trim((string) $category->slug),
            'parentId' => $category->parent_id !== null ? (string) $category->parent_id : null,
        ];
    }

    private function transformTagFilter(ArticleTag $tag): array
    {
        return [
            'id' => (string) $tag->getKey(),
            'name' => trim((string) $tag->name),
            'slug' => trim((string) $tag->slug),
        ];
    }

    private function uniqueSlug(string $value, ?int $ignoreId = null): string
    {
        $slug = trim(mb_strtolower($value, 'UTF-8'));
        $slug = preg_replace('/[^\pL\pN]+/u', '-', $slug) ?? '';
        $slug = trim($slug, '-');

        if ($slug === '') {
            $slug = 'article';
        }

        $baseSlug = $slug;
        $counter = 2;

        while (
            ArticlePost::query()
                ->when($ignoreId !== null, fn ($query) => $query->where('id', '!=', $ignoreId))
                ->where('slug', $slug)
                ->exists()
        ) {
            $slug = $baseSlug . '-' . $counter;
            $counter++;
        }

        return $slug;
    }

    private function deletePhysicalFile(?string $path): void
    {
        $this->deleteTenantMediaFile($path);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
    }
}
