<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Tenant\Models\CookingRecipe;
use App\Http\Controllers\Tenant\CookingRecipeController;
use Database\Seeders\Tenant\Modules\CookingRecipesSeeder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class CookingRecipesModuleTest extends TestCase
{
    public function test_module_migration_and_seeder_are_excluded_from_default_tenant_installation(): void
    {
        $definition = config('tenant_modules.modules.cooking-recipes');
        $defaultTenantMigrations = File::glob(database_path('migrations/tenant/*_*.php'));

        $this->assertSame(
            database_path('migrations/tenant/modules/cooking-recipes'),
            $definition['migration_path'],
        );
        $this->assertSame(CookingRecipesSeeder::class, $definition['seeder']);
        $this->assertNotContains(
            database_path('migrations/tenant/modules/cooking-recipes/2026_06_20_000000_create_cooking_recipes_table.php'),
            $defaultTenantMigrations,
        );
        $this->assertStringNotContainsString(
            'CookingRecipesSeeder',
            File::get(database_path('seeders/DatabaseSeeder.php')),
        );
    }

    public function test_csv_seeder_imports_every_recipe_and_is_idempotent(): void
    {
        $previousConnection = DB::getDefaultConnection();
        config([
            'database.connections.cooking_recipes_test' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => true,
            ],
        ]);
        DB::purge('cooking_recipes_test');
        DB::setDefaultConnection('cooking_recipes_test');

        try {
            $migration = require database_path('migrations/tenant/modules/cooking-recipes/2026_06_20_000000_create_cooking_recipes_table.php');
            $migration->up();

            $seeder = new CookingRecipesSeeder();
            $seeder->run();
            $seeder->run();

            $this->assertSame(570, CookingRecipe::query()->count());
            $this->assertSame(570, CookingRecipe::query()->distinct()->count('slug'));
            $this->assertSame(558, CookingRecipe::query()->whereNotNull('nutrition')->count());
            $this->assertSame(559, CookingRecipe::query()->whereNotNull('micronutrients')->count());
            $this->assertSame(0, CookingRecipe::query()->where('ingredients_json', '[]')->count());
            $this->assertCount(5, CookingRecipe::query()->where('title', 'کوکو پاستا')->firstOrFail()->instructions_json);
            $this->assertSame(2, CookingRecipe::query()->where('title', 'جوجه کباب تابه ای')->count());

            $recoveredNutritionRow = CookingRecipe::query()
                ->where('title', 'سیب زمینی ادویه ای بخارپزشده')
                ->firstOrFail();
            $this->assertNull($recoveredNutritionRow->nutrition);
            $this->assertNotNull($recoveredNutritionRow->micronutrients);

            $controller = new CookingRecipeController();
            $listRequest = Request::create('/api/v1/cooking-recipes/admin', 'GET', ['page' => 2]);
            $listRequest->setUserResolver(fn () => (object) ['role' => 'admin']);
            $listPayload = $controller->adminIndex($listRequest)->getData(true)['data'];
            $this->assertCount(20, $listPayload['items']);
            $this->assertSame(2, $listPayload['pagination']['page']);
            $this->assertSame(570, $listPayload['pagination']['total']);

            $searchRequest = Request::create('/api/v1/cooking-recipes/admin', 'GET', ['search' => 'پیتزا باگت']);
            $searchRequest->setUserResolver(fn () => (object) ['role' => 'admin']);
            $searchPayload = $controller->adminIndex($searchRequest)->getData(true)['data'];
            $this->assertSame(1, $searchPayload['pagination']['total']);

            $recipe = CookingRecipe::query()->where('title', 'پیتزا باگت')->firstOrFail();
            $updateRequest = Request::create('/api/v1/cooking-recipes/admin/'.$recipe->id, 'PUT', [
                'title' => 'پیتزا باگت ویژه',
                'description' => 'نسخه ویرایش‌شده',
                'servings' => 3,
                'ingredientsJson' => $recipe->ingredients_json,
                'instructionsJson' => $recipe->instructions_json,
                'nutrition' => $recipe->nutrition,
                'micronutrients' => $recipe->micronutrients,
                'isPublished' => true,
                'isActive' => false,
                'sortOrder' => 42,
                'flags' => ['important', 'popular'],
            ]);
            $updateRequest->setUserResolver(fn () => (object) ['role' => 'admin']);
            $updatedPayload = $controller->adminUpdate($updateRequest, $recipe)->getData(true)['data'];
            $this->assertSame('پیتزا باگت ویژه', $updatedPayload['title']);
            $this->assertFalse($updatedPayload['isActive']);
            $this->assertSame(42, $updatedPayload['sortOrder']);
            $this->assertSame(['important', 'popular'], $updatedPayload['flags']);

            $seeder->run();
            $recipe->refresh();
            $this->assertFalse($recipe->is_active);
            $this->assertSame(42, $recipe->sort_order);
            $this->assertSame(['important', 'popular'], $recipe->flags);

            $publicRecipe = CookingRecipe::query()->where('title', 'کوکو پاستا')->firstOrFail();
            $publicRecipe->update(['flags' => ['popular', 'frequent']]);
            $publicPayload = $controller->index(Request::create('/api/v1/cooking-recipes', 'GET', ['search' => 'کوکو']))->getData(true)['data'];
            $this->assertCount(10, $publicPayload['latest']);
            $this->assertSame('کوکو', $publicPayload['query']);
            $this->assertSame($publicPayload['searchResults'], $publicPayload['items']);
            $this->assertSame('کوکو پاستا', $publicPayload['searchResults'][0]['title']);
            $this->assertSame('کوکو پاستا', $publicPayload['popular'][0]['title']);
            $this->assertSame('کوکو پاستا', $publicPayload['frequent'][0]['title']);
            $this->assertStringContainsString('/booking-app/nutrition-hero.jpg', $publicPayload['popular'][0]['imageUrl']);

            $detailRecipe = CookingRecipe::query()->where('title', 'حلیم')->firstOrFail();
            $detailPayload = $controller->show($detailRecipe->slug)->getData(true)['data']['item'];
            $this->assertSame('حلیم', $detailPayload['title']);
            $this->assertSame(7, $detailPayload['stats']['servings']);
            $this->assertSame(5, $detailPayload['stats']['ingredientsCount']);
            $this->assertSame(4, $detailPayload['stats']['stepsCount']);
            $this->assertSame(2070.36, $detailPayload['stats']['caloriesKcal']);
            $this->assertSame('گندم پوست کنده', $detailPayload['ingredientItems'][0]['name']);
            $this->assertSame('3000 g (3 کیلوگرم)', $detailPayload['ingredientItems'][0]['amount']);
            $this->assertFalse($detailPayload['ingredientItems'][0]['checked']);
            $this->assertSame(1, $detailPayload['instructionSteps'][0]['position']);
            $this->assertStringContainsString('گندم را از شب قبل خیس کنید', $detailPayload['instructionSteps'][0]['text']);
            $this->assertSame(94.73, $detailPayload['nutritionPerServing']['protein_g']);
            $this->assertSame(14492.5, $detailPayload['nutritionTotal']['calories_kcal']);
            $this->assertSame($detailRecipe->metadata['source_url'], $detailPayload['source']['url']);
            $this->assertStringContainsString('/booking-app/nutrition-hero.jpg', $detailPayload['imageUrl']);
        } finally {
            DB::purge('cooking_recipes_test');
            DB::setDefaultConnection($previousConnection);
        }
    }
}
