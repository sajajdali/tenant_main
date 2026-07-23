<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Support\TenantAudienceScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NutritionAiPromptPresetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $items = DB::table('nutrition_ai_prompt_presets')
            ->orderByDesc('is_active')
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(fn (object $item): array => $this->transformItem($item))->values()->all(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $id = DB::table('nutrition_ai_prompt_presets')->insertGetId([
            'title' => trim((string) $validated['title']),
            'body' => trim((string) $validated['body']),
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'created_by_user_id' => $request->user('tenant_web')?->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $item = DB::table('nutrition_ai_prompt_presets')->where('id', $id)->first();

        return response()->json([
            'success' => true,
            'message' => __('tenant.nutrition.prompt_preset_created'),
            'data' => [
                'item' => $this->transformItem($item),
            ],
        ]);
    }

    public function update(Request $request, string $presetId): JsonResponse
    {
        $this->ensureAdmin($request);

        abort_unless(DB::table('nutrition_ai_prompt_presets')->where('id', $presetId)->exists(), 404);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        DB::table('nutrition_ai_prompt_presets')
            ->where('id', $presetId)
            ->update([
                'title' => trim((string) $validated['title']),
                'body' => trim((string) $validated['body']),
                'sort_order' => (int) ($validated['sort_order'] ?? 0),
                'is_active' => (bool) ($validated['is_active'] ?? true),
                'updated_at' => now(),
            ]);

        $item = DB::table('nutrition_ai_prompt_presets')->where('id', $presetId)->first();

        return response()->json([
            'success' => true,
            'message' => __('tenant.nutrition.prompt_preset_updated'),
            'data' => [
                'item' => $this->transformItem($item),
            ],
        ]);
    }

    public function destroy(Request $request, string $presetId): JsonResponse
    {
        $this->ensureAdmin($request);

        abort_unless(DB::table('nutrition_ai_prompt_presets')->where('id', $presetId)->exists(), 404);
        DB::table('nutrition_ai_prompt_presets')->where('id', $presetId)->delete();

        return response()->json([
            'success' => true,
            'message' => __('tenant.nutrition.prompt_preset_deleted'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function transformItem(?object $item): array
    {
        return [
            'id' => (string) ($item?->id ?? ''),
            'title' => (string) ($item?->title ?? ''),
            'body' => (string) ($item?->body ?? ''),
            'sortOrder' => (int) ($item?->sort_order ?? 0),
            'isActive' => (bool) ($item?->is_active ?? false),
            'createdAt' => filled($item?->created_at) ? (string) $item->created_at : null,
        ];
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
    }
}
