<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\NutritionDietTemplate;
use App\Http\Controllers\Controller;
use App\Support\TenantAudienceScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class NutritionAudioGuidanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $templates = NutritionDietTemplate::query()
            ->orderBy('depth')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'depth']);

        $items = DB::table('nutrition_audio_guidance_assets')
            ->leftJoin('nutrition_diet_templates', 'nutrition_diet_templates.id', '=', 'nutrition_audio_guidance_assets.nutrition_diet_template_id')
            ->select([
                'nutrition_audio_guidance_assets.*',
                'nutrition_diet_templates.name as template_name',
            ])
            ->orderByDesc('nutrition_audio_guidance_assets.is_active')
            ->orderBy('nutrition_audio_guidance_assets.sort_order')
            ->orderByDesc('nutrition_audio_guidance_assets.id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'templates' => $templates->map(fn (NutritionDietTemplate $template): array => [
                    'id' => (string) $template->id,
                    'name' => $template->name,
                    'label' => str_repeat('— ', max(0, (int) $template->depth)) . $template->name,
                ])->values()->all(),
                'items' => $items->map(fn (object $item): array => $this->transformAsset($item))->values()->all(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'nutrition_diet_template_id' => ['nullable', 'integer', 'exists:nutrition_diet_templates,id'],
            'session_number' => ['nullable', 'integer', 'min:1', 'max:120'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
            'audio' => ['required', 'file', 'mimetypes:audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/webm,audio/ogg,audio/mp4,audio/x-m4a,video/mp4', 'max:20480'],
        ]);

        /** @var UploadedFile $audio */
        $audio = $validated['audio'];
        $path = $audio->store('nutrition/audio-guidance', 'media_public');
        $this->recordTenantMediaFile($path, (int) $audio->getSize());

        $id = DB::table('nutrition_audio_guidance_assets')->insertGetId([
            'nutrition_diet_template_id' => $validated['nutrition_diet_template_id'] ?? null,
            'session_number' => $validated['session_number'] ?? null,
            'title' => trim((string) $validated['title']),
            'description' => $this->nullableTrim($validated['description'] ?? null),
            'file_path' => $path,
            'duration_seconds' => null,
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'created_by_user_id' => $request->user('tenant_web')?->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $asset = DB::table('nutrition_audio_guidance_assets')
            ->leftJoin('nutrition_diet_templates', 'nutrition_diet_templates.id', '=', 'nutrition_audio_guidance_assets.nutrition_diet_template_id')
            ->select([
                'nutrition_audio_guidance_assets.*',
                'nutrition_diet_templates.name as template_name',
            ])
            ->where('nutrition_audio_guidance_assets.id', $id)
            ->first();

        return response()->json([
            'success' => true,
            'message' => __('tenant.nutrition.audio_created'),
            'data' => [
                'item' => $this->transformAsset($asset),
            ],
        ]);
    }

    public function update(Request $request, string $assetId): JsonResponse
    {
        $this->ensureAdmin($request);

        $asset = DB::table('nutrition_audio_guidance_assets')->where('id', $assetId)->first();
        abort_unless($asset, 404);

        $validated = $request->validate([
            'nutrition_diet_template_id' => ['nullable', 'integer', 'exists:nutrition_diet_templates,id'],
            'session_number' => ['nullable', 'integer', 'min:1', 'max:120'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
            'audio' => ['nullable', 'file', 'mimetypes:audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/webm,audio/ogg,audio/mp4,audio/x-m4a,video/mp4', 'max:20480'],
        ]);

        $nextPath = $asset->file_path;

        if (($validated['audio'] ?? null) instanceof UploadedFile) {
            /** @var UploadedFile $audio */
            $audio = $validated['audio'];
            $nextPath = $audio->store('nutrition/audio-guidance', 'media_public');
            $this->deletePhysicalFile((string) $asset->file_path);
            $this->recordTenantMediaFile($nextPath, (int) $audio->getSize());
        }

        DB::table('nutrition_audio_guidance_assets')
            ->where('id', $assetId)
            ->update([
                'nutrition_diet_template_id' => $validated['nutrition_diet_template_id'] ?? null,
                'session_number' => $validated['session_number'] ?? null,
                'title' => trim((string) $validated['title']),
                'description' => $this->nullableTrim($validated['description'] ?? null),
                'file_path' => $nextPath,
                'sort_order' => (int) ($validated['sort_order'] ?? 0),
                'is_active' => (bool) ($validated['is_active'] ?? true),
                'updated_at' => now(),
            ]);

        $fresh = DB::table('nutrition_audio_guidance_assets')
            ->leftJoin('nutrition_diet_templates', 'nutrition_diet_templates.id', '=', 'nutrition_audio_guidance_assets.nutrition_diet_template_id')
            ->select([
                'nutrition_audio_guidance_assets.*',
                'nutrition_diet_templates.name as template_name',
            ])
            ->where('nutrition_audio_guidance_assets.id', $assetId)
            ->first();

        return response()->json([
            'success' => true,
            'message' => __('tenant.nutrition.audio_updated'),
            'data' => [
                'item' => $this->transformAsset($fresh),
            ],
        ]);
    }

    public function destroy(Request $request, string $assetId): JsonResponse
    {
        $this->ensureAdmin($request);

        $asset = DB::table('nutrition_audio_guidance_assets')->where('id', $assetId)->first();
        abort_unless($asset, 404);

        DB::table('nutrition_audio_guidance_assets')->where('id', $assetId)->delete();
        $this->deletePhysicalFile((string) $asset->file_path);

        return response()->json([
            'success' => true,
            'message' => __('tenant.nutrition.audio_deleted'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function transformAsset(object $item): array
    {
        return [
            'id' => (string) $item->id,
            'title' => (string) $item->title,
            'description' => $item->description,
            'templateId' => $item->nutrition_diet_template_id ? (string) $item->nutrition_diet_template_id : null,
            'templateName' => $item->template_name,
            'sessionNumber' => $item->session_number !== null ? (int) $item->session_number : null,
            'sortOrder' => (int) ($item->sort_order ?? 0),
            'isActive' => (bool) $item->is_active,
            'fileUrl' => $this->tenantMediaUrl((string) $item->file_path),
            'filePath' => (string) $item->file_path,
            'durationSeconds' => $item->duration_seconds !== null ? (int) $item->duration_seconds : null,
            'scopeLabel' => $this->scopeLabel($item->template_name, $item->session_number),
            'createdAt' => filled($item->created_at) ? (string) $item->created_at : null,
        ];
    }

    private function scopeLabel(?string $templateName, ?int $sessionNumber): string
    {
        $dietLabel = filled($templateName)
            ? __('tenant.nutrition.audio_scope_diet', ['diet' => $templateName])
            : __('tenant.nutrition.audio_scope_all_diets');
        $sessionLabel = $sessionNumber
            ? __('tenant.nutrition.audio_scope_session', ['number' => number_format($sessionNumber)])
            : __('tenant.nutrition.audio_scope_all_sessions');

        return __('tenant.nutrition.audio_scope', ['diet' => $dietLabel, 'session' => $sessionLabel]);
    }

    private function deletePhysicalFile(string $relativePath): void
    {
        $this->deleteTenantMediaFile($relativePath);
    }

    private function nullableTrim(mixed $value): ?string
    {
        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
    }
}
