<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\CookingRecipe;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CookingRecipeController extends Controller
{
    private const PUBLIC_SECTION_LIMIT = 10;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $search = trim((string) ($validated['search'] ?? $validated['q'] ?? ''));

        $latest = $this->publicRecipeQuery()
            ->latest('created_at')
            ->latest('id')
            ->limit(self::PUBLIC_SECTION_LIMIT)
            ->get();

        $searchResults = $search === ''
            ? collect()
            : $this->publicRecipeQuery()
                ->where(function ($searchQuery) use ($search): void {
                    $this->applySearch($searchQuery, $search);
                })
                ->orderBy('sort_order')
                ->orderBy('title')
                ->limit(self::PUBLIC_SECTION_LIMIT)
                ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $this->serializeCollection($search === '' ? $latest : $searchResults),
                'popular' => $this->serializeCollection($this->publicFlaggedRecipes('popular')),
                'frequent' => $this->serializeCollection($this->publicFlaggedRecipes('frequent')),
                'latest' => $this->serializeCollection($latest),
                'searchResults' => $this->serializeCollection($searchResults),
                'query' => $search === '' ? null : $search,
            ],
        ]);
    }

    public function show(string $recipe): JsonResponse
    {
        $item = $this->publicRecipeQuery()
            ->where(function ($query) use ($recipe): void {
                $query->where('slug', $recipe);

                if (ctype_digit($recipe)) {
                    $query->orWhere('id', (int) $recipe);
                }
            })
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => [
                'item' => $this->serializeDetail($item),
            ],
        ]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['all', 'active', 'inactive'])],
            'flag' => ['nullable', Rule::in(CookingRecipe::FLAGS)],
        ]);
        $search = trim((string) ($validated['search'] ?? ''));
        $status = (string) ($validated['status'] ?? 'all');

        $query = CookingRecipe::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($searchQuery) use ($search): void {
                    $this->applySearch($searchQuery, $search);
                });
            })
            ->when($status === 'active', fn ($query) => $query->where('is_active', true))
            ->when($status === 'inactive', fn ($query) => $query->where('is_active', false))
            ->when(
                isset($validated['flag']),
                fn ($query) => $query->whereJsonContains('flags', $validated['flag']),
            )
            ->orderBy('sort_order')
            ->orderBy('title');
        $paginator = $query->paginate(20, ['*'], 'page', (int) ($validated['page'] ?? 1));

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $paginator->getCollection()
                    ->map(fn (CookingRecipe $recipe): array => $this->serialize($recipe))
                    ->values(),
                'pagination' => [
                    'page' => $paginator->currentPage(),
                    'perPage' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'totalPages' => $paginator->lastPage(),
                ],
            ],
        ]);
    }

    public function adminShow(Request $request, CookingRecipe $cookingRecipe): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json([
            'success' => true,
            'data' => $this->serialize($cookingRecipe),
        ]);
    }

    public function adminUpdate(Request $request, CookingRecipe $cookingRecipe): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'servings' => ['required', 'integer', 'min:1', 'max:65535'],
            'ingredientsJson' => ['required', 'array', 'min:1'],
            'ingredientsJson.*' => ['required', 'string', 'max:1000'],
            'instructionsJson' => ['required', 'array', 'min:1'],
            'instructionsJson.*' => ['required', 'string', 'max:5000'],
            'nutrition' => ['nullable', 'array'],
            'micronutrients' => ['nullable', 'array'],
            'isPublished' => ['required', 'boolean'],
            'isActive' => ['required', 'boolean'],
            'sortOrder' => ['required', 'integer', 'min:0', 'max:4294967295'],
            'flags' => ['nullable', 'array'],
            'flags.*' => ['string', Rule::in(CookingRecipe::FLAGS)],
        ], [], [
            'title' => __('tenant.cooking_recipes.fields.title'),
            'description' => __('tenant.cooking_recipes.fields.description'),
            'servings' => __('tenant.cooking_recipes.fields.servings'),
            'ingredientsJson' => __('tenant.cooking_recipes.fields.ingredients'),
            'instructionsJson' => __('tenant.cooking_recipes.fields.instructions'),
            'sortOrder' => __('tenant.cooking_recipes.fields.sort_order'),
        ]);

        $ingredients = array_values(array_map('trim', $validated['ingredientsJson']));
        $instructions = array_values(array_map('trim', $validated['instructionsJson']));
        $flags = array_values(array_unique($validated['flags'] ?? []));

        $cookingRecipe->update([
            'title' => trim($validated['title']),
            'description' => isset($validated['description']) ? trim($validated['description']) : null,
            'servings' => $validated['servings'],
            'ingredients' => implode(PHP_EOL, $ingredients),
            'ingredients_json' => $ingredients,
            'instructions' => collect($instructions)
                ->map(fn (string $instruction, int $index): string => ($index + 1).'. '.$instruction)
                ->implode(PHP_EOL),
            'instructions_json' => $instructions,
            'nutrition' => $validated['nutrition'] ?? null,
            'micronutrients' => $validated['micronutrients'] ?? null,
            'is_published' => $validated['isPublished'],
            'is_active' => $validated['isActive'],
            'sort_order' => $validated['sortOrder'],
            'flags' => $flags,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.cooking_recipes.updated'),
            'data' => $this->serialize($cookingRecipe->fresh()),
        ]);
    }

    private function serialize(CookingRecipe $recipe): array
    {
        return [
            'id' => (string) $recipe->id,
            'title' => $recipe->title,
            'slug' => $recipe->slug,
            'description' => $recipe->description,
            'servings' => $recipe->servings,
            'ingredients' => $recipe->ingredients,
            'ingredientsJson' => $recipe->ingredients_json ?? [],
            'instructions' => $recipe->instructions,
            'instructionsJson' => $recipe->instructions_json ?? [],
            'nutrition' => $recipe->nutrition,
            'micronutrients' => $recipe->micronutrients,
            'isPublished' => (bool) $recipe->is_published,
            'isActive' => (bool) $recipe->is_active,
            'sortOrder' => (int) $recipe->sort_order,
            'flags' => array_values($recipe->flags ?? []),
            'imageUrl' => $this->imageUrl($recipe),
            'createdAt' => optional($recipe->created_at)?->toISOString(),
            'updatedAt' => optional($recipe->updated_at)?->toISOString(),
        ];
    }

    private function serializeDetail(CookingRecipe $recipe): array
    {
        $base = $this->serialize($recipe);
        $nutrition = $recipe->nutrition ?? [];
        $perServing = is_array($nutrition['perServing'] ?? null) ? $nutrition['perServing'] : [];
        $total = is_array($nutrition['total'] ?? null) ? $nutrition['total'] : [];
        $nutritionIngredients = is_array($nutrition['ingredients'] ?? null) ? $nutrition['ingredients'] : [];
        $ingredients = array_values($recipe->ingredients_json ?? []);
        $instructions = array_values($recipe->instructions_json ?? []);
        $metadata = $recipe->metadata ?? [];

        return array_merge($base, [
            'stats' => [
                'servings' => (int) $recipe->servings,
                'ingredientsCount' => count($ingredients),
                'stepsCount' => count($instructions),
                'caloriesKcal' => $perServing['calories_kcal'] ?? null,
                'proteinG' => $perServing['protein_g'] ?? null,
                'carbsG' => $perServing['carbs_g'] ?? null,
                'fatG' => $perServing['fat_g'] ?? null,
                'fiberG' => $perServing['fiber_g'] ?? null,
                'sugarG' => $perServing['sugar_g'] ?? null,
                'sodiumMg' => $perServing['sodium_mg'] ?? null,
                'cholesterolMg' => $perServing['cholesterol_mg'] ?? null,
                'prepMinutes' => $metadata['prep_minutes'] ?? $metadata['prepMinutes'] ?? null,
                'cookMinutes' => $metadata['cook_minutes'] ?? $metadata['cookMinutes'] ?? null,
                'difficulty' => $metadata['difficulty'] ?? null,
                'rating' => $metadata['rating'] ?? null,
            ],
            'ingredientItems' => $this->ingredientItems($ingredients, $nutritionIngredients),
            'instructionSteps' => array_map(
                static fn (string $text, int $index): array => [
                    'position' => $index + 1,
                    'text' => $text,
                ],
                $instructions,
                array_keys($instructions),
            ),
            'nutritionPerServing' => $perServing,
            'nutritionTotal' => $total,
            'nutritionIngredients' => $nutritionIngredients,
            'source' => [
                'url' => $metadata['source_url'] ?? null,
                'scrapedAt' => $metadata['scraped_at'] ?? null,
            ],
        ]);
    }

    private function publicRecipeQuery()
    {
        return CookingRecipe::query()
            ->where('is_active', true)
            ->where('is_published', true);
    }

    private function publicFlaggedRecipes(string $flag)
    {
        return $this->publicRecipeQuery()
            ->whereJsonContains('flags', $flag)
            ->orderBy('sort_order')
            ->orderBy('title')
            ->limit(self::PUBLIC_SECTION_LIMIT)
            ->get();
    }

    private function applySearch($query, string $search): void
    {
        $query
            ->where('title', 'like', "%{$search}%")
            ->orWhere('description', 'like', "%{$search}%")
            ->orWhere('ingredients', 'like', "%{$search}%");
    }

    private function serializeCollection($recipes): array
    {
        return $recipes
            ->map(fn (CookingRecipe $recipe): array => $this->serialize($recipe))
            ->values()
            ->all();
    }

    private function imageUrl(CookingRecipe $recipe): string
    {
        $metadata = $recipe->metadata ?? [];
        $imageUrl = $metadata['image_url'] ?? $metadata['imageUrl'] ?? null;

        return is_string($imageUrl) && trim($imageUrl) !== ''
            ? trim($imageUrl)
            : asset('booking-app/nutrition-hero.jpg');
    }

    private function ingredientItems(array $ingredients, array $nutritionIngredients): array
    {
        return array_map(function (string $text, int $index) use ($nutritionIngredients): array {
            $nutrition = is_array($nutritionIngredients[$index] ?? null) ? $nutritionIngredients[$index] : [];
            $parsed = $this->parseIngredientText($text);

            return [
                'position' => $index + 1,
                'text' => $text,
                'name' => $nutrition['name'] ?? $parsed['name'],
                'amount' => $nutrition['estimated_amount'] ?? $parsed['amount'],
                'checked' => false,
                'nutrition' => $nutrition === [] ? null : $nutrition,
            ];
        }, $ingredients, array_keys($ingredients));
    }

    private function parseIngredientText(string $text): array
    {
        $parts = preg_split('/\s*(?:=|:|：)\s*/u', $text, 2);

        if (is_array($parts) && count($parts) === 2) {
            return [
                'name' => trim($parts[0]),
                'amount' => trim($parts[1]),
            ];
        }

        return [
            'name' => trim($text),
            'amount' => null,
        ];
    }

    private function authorizeAdmin(Request $request): void
    {
        $actor = $request->user('tenant_web');
        abort_unless($actor?->role === 'admin', 403, __('authorization.primary_admin_section'));
    }
}
