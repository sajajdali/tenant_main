<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Customer\Articles;

use App\Domain\Tenant\Models\ArticleCategory;
use App\Domain\Tenant\Models\ArticleComment;
use App\Domain\Tenant\Models\ArticlePost;
use App\Domain\Tenant\Models\ArticleTag;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\ArticleSettingsController;
use App\Support\JalaliDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArticleController extends Controller
{
    public function index(Request $request): JsonResponse
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
        $selectedCategory = $categoryFilter !== '' ? $this->resolveCategoryFilter($categoryFilter) : null;
        $selectedTag = $tagFilter !== '' ? $this->resolveTagFilter($tagFilter) : null;
        $perPage = (int) ($validated['per_page'] ?? 10);

        $page = $this->publishedPostsQuery()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($subQuery) use ($search): void {
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
            ->paginate($perPage);

        $featuredItems = $this->publishedPostsQuery()
            ->where(function ($query): void {
                $query
                    ->where('is_featured', true)
                    ->orWhere('is_important', true)
                    ->orWhere('show_in_featured_slider', true);
            })
            ->limit(5)
            ->get();
        $heroArticle = $featuredItems->first()
            ?? $this->publishedPostsQuery()->first();
        $latestNews = ArticlePost::query()
            ->with(['category', 'tags'])
            ->where('is_active', true)
            ->whereNotNull('published_at')
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit(6)
            ->get();
        $categories = ArticleSettingsController::categoryTree();
        $tags = ArticleSettingsController::tagItems();

        return $this->ok([
            'items' => $page->getCollection()->map(fn (ArticlePost $post) => $this->transformPost($post))->values()->all(),
            'heroArticle' => $heroArticle ? $this->transformPost($heroArticle) : null,
            'featured' => $featuredItems->map(fn (ArticlePost $post) => $this->transformPost($post))->values()->all(),
            'latestNews' => $latestNews->map(fn (ArticlePost $post) => $this->transformPost($post))->values()->all(),
            'featuredNews' => $featuredItems->map(fn (ArticlePost $post) => $this->transformPost($post))->values()->all(),
            'categories' => $categories,
            'categoryList' => $categories,
            'tags' => $tags,
        ], meta: [
            'currentPage' => $page->currentPage(),
            'lastPage' => $page->lastPage(),
            'perPage' => $page->perPage(),
            'total' => $page->total(),
            'query' => $search !== '' ? $search : null,
            'activeCategory' => $selectedCategory ? $this->transformCategoryFilter($selectedCategory) : null,
            'activeTag' => $selectedTag ? $this->transformTagFilter($selectedTag) : null,
        ]);
    }

    public function show(string $articleId): JsonResponse
    {
        $post = $this->publishedPostsQuery()
            ->whereKey($articleId)
            ->firstOrFail();

        $post->increment('view_count');
        $post->refresh()->loadMissing(['category', 'tags']);

        $related = $this->publishedPostsQuery()
            ->whereKeyNot($post->getKey())
            ->when($post->article_category_id !== null, fn ($query) => $query->where('article_category_id', $post->article_category_id))
            ->limit(3)
            ->get();

        if ($related->count() < 3) {
            $excludedIds = $related->pluck('id')->push($post->id)->all();
            $fallback = $this->publishedPostsQuery()
                ->whereNotIn('id', $excludedIds)
                ->limit(3 - $related->count())
                ->get();
            $related = $related->concat($fallback);
        }

        $nextArticle = $this->nextPublishedPost($post);

        return $this->ok([
            'item' => $this->transformPost($post, includeContent: true),
            'related' => $related->map(fn (ArticlePost $item) => $this->transformPost($item))->values()->all(),
            'nextArticle' => $nextArticle ? $this->transformPost($nextArticle) : null,
            'commentsSummary' => [
                'approvedCount' => $this->approvedCommentsQuery($post)->count(),
            ],
        ]);
    }

    public function comments(Request $request, string $slug): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $post = $this->findPublishedPost($slug);
        $perPage = (int) ($validated['per_page'] ?? 20);
        $page = $this->approvedCommentsQuery($post)->paginate($perPage);

        return $this->ok([
            'items' => $page->getCollection()->map(fn (ArticleComment $comment) => $this->transformComment($comment))->values()->all(),
        ], meta: [
            'currentPage' => $page->currentPage(),
            'lastPage' => $page->lastPage(),
            'perPage' => $page->perPage(),
            'total' => $page->total(),
        ]);
    }

    public function storeComment(Request $request, string $slug): JsonResponse
    {
        $post = $this->findPublishedPost($slug);

        /** @var TenantUser|null $user */
        $user = $request->user();
        abort_unless($user, 401);

        $validated = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:2000'],
        ], [
            'body.required' => 'متن نظر را وارد کنید.',
            'body.min' => 'متن نظر باید حداقل ۲ کاراکتر باشد.',
            'body.max' => 'متن نظر نباید بیشتر از ۲۰۰۰ کاراکتر باشد.',
        ]);

        $comment = ArticleComment::query()->create([
            'article_post_id' => $post->id,
            'tenant_user_id' => $user->id,
            'author_name' => $user->name,
            'author_mobile' => $user->mobile,
            'body' => trim((string) $validated['body']),
            'status' => ArticleComment::STATUS_PENDING,
        ]);

        return $this->ok([
            'comment' => $this->transformComment($comment),
        ], 'نظر شما ثبت شد و پس از تایید نمایش داده می‌شود.', 201);
    }

    private function publishedPostsQuery()
    {
        return ArticlePost::query()
            ->with(['category', 'tags'])
            ->where('is_active', true)
            ->whereNotNull('published_at')
            ->orderByDesc('sort_order')
            ->orderByDesc('published_at')
            ->orderByDesc('id');
    }

    private function nextPublishedPost(ArticlePost $post): ?ArticlePost
    {
        return $this->publishedPostsQuery()
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
            ->first();
    }

    private function findPublishedPost(string $slug): ArticlePost
    {
        return $this->publishedPostsQuery()
            ->where('slug', $slug)
            ->firstOrFail();
    }

    private function approvedCommentsQuery(ArticlePost $post)
    {
        return ArticleComment::query()
            ->where('article_post_id', $post->id)
            ->where('status', ArticleComment::STATUS_APPROVED)
            ->orderByDesc('approved_at')
            ->orderByDesc('id');
    }

    private function transformPost(ArticlePost $post, bool $includeContent = false): array
    {
        $post->loadMissing(['category', 'tags']);
        $readingTimeMinutes = $this->readingTimeMinutes($post);

        return [
            'id' => (string) $post->id,
            'category' => $post->category ? $this->transformCategoryFilter($post->category) : null,
            'title' => $post->title,
            'slug' => $post->slug,
            'excerpt' => $post->excerpt,
            'content' => $includeContent ? $post->content : null,
            'keyPoints' => $this->normalizeKeyPoints($post->key_points ?? []),
            'authorName' => $post->author_name,
            'imageUrl' => $this->tenantMediaUrl($post->image_path),
            'isFeatured' => (bool) $post->is_featured,
            'showInFeaturedSlider' => (bool) $post->show_in_featured_slider,
            'isImportant' => (bool) $post->is_important,
            'publishedAt' => $post->published_at?->toIso8601String(),
            'publishedAtJalali' => $post->published_at ? JalaliDate::format($post->published_at) : null,
            'readingTimeMinutes' => $readingTimeMinutes,
            'readingTimeLabel' => JalaliDate::toPersianDigits((string) $readingTimeMinutes).' دقیقه مطالعه',
            'viewCount' => (int) $post->view_count,
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

    private function transformComment(ArticleComment $comment): array
    {
        return [
            'id' => (string) $comment->id,
            'authorName' => $comment->author_name,
            'body' => $comment->body,
            'status' => $comment->status,
            'approvedAt' => $comment->approved_at?->toIso8601String(),
            'createdAt' => $comment->created_at?->toIso8601String(),
        ];
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

    private function ok(array $data, ?string $message = null, int $status = 200, array $meta = []): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => $meta,
        ], $status);
    }
}
