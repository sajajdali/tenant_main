<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Support\TenantAudienceScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class NutritionDietFileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $search = trim((string) $request->query('q', ''));

        $fileCounts = DB::table('nutrition_diet_files')
            ->select([
                'nutrition_diet_file_group_id',
                DB::raw('COUNT(*) as files_count'),
            ])
            ->groupBy('nutrition_diet_file_group_id');

        $groups = DB::table('nutrition_diet_file_groups')
            ->leftJoinSub($fileCounts, 'nutrition_diet_file_counts', function ($join): void {
                $join->on('nutrition_diet_file_counts.nutrition_diet_file_group_id', '=', 'nutrition_diet_file_groups.id');
            })
            ->select([
                'nutrition_diet_file_groups.*',
                DB::raw('COALESCE(nutrition_diet_file_counts.files_count, 0) as files_count'),
            ])
            ->orderBy('nutrition_diet_file_groups.sort_order')
            ->orderBy('nutrition_diet_file_groups.name')
            ->get();

        $items = DB::table('nutrition_diet_files')
            ->leftJoin('nutrition_diet_file_groups', 'nutrition_diet_file_groups.id', '=', 'nutrition_diet_files.nutrition_diet_file_group_id')
            ->select([
                'nutrition_diet_files.*',
                DB::raw('COALESCE(nutrition_diet_file_groups.name, nutrition_diet_files.group_name_snapshot) as group_name'),
            ])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($inner) use ($search): void {
                        $inner->where('nutrition_diet_files.title', 'like', '%' . $search . '%')
                            ->orWhere('nutrition_diet_files.description', 'like', '%' . $search . '%')
                            ->orWhere('nutrition_diet_file_groups.name', 'like', '%' . $search . '%')
                            ->orWhere('nutrition_diet_files.group_name_snapshot', 'like', '%' . $search . '%')
                            ->orWhere('nutrition_diet_files.file_name', 'like', '%' . $search . '%');
                });
            })
            ->orderByDesc('nutrition_diet_files.is_active')
            ->orderByDesc('nutrition_diet_files.id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'filters' => [
                    'q' => $search,
                ],
                'groups' => $groups->map(fn (object $group): array => $this->transformGroup($group))->values()->all(),
                'items' => $items->map(fn (object $item): array => $this->transformFile($item))->values()->all(),
            ],
        ]);
    }

    public function storeGroup(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $id = DB::table('nutrition_diet_file_groups')->insertGetId([
            'name' => trim((string) $validated['name']),
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'created_by_user_id' => $request->user('tenant_web')?->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $group = DB::table('nutrition_diet_file_groups')
            ->where('id', $id)
            ->first();

        return response()->json([
            'success' => true,
            'message' => __('tenant.nutrition.diet_file_category_saved'),
            'data' => [
                'group' => $this->transformGroup($group),
            ],
        ]);
    }

    public function destroyGroup(Request $request, string $groupId): JsonResponse
    {
        $this->ensureAdmin($request);

        $group = DB::table('nutrition_diet_file_groups')->where('id', $groupId)->first();
        abort_unless($group, 404);

        DB::transaction(function () use ($group, $groupId): void {
            DB::table('nutrition_diet_files')
                ->where('nutrition_diet_file_group_id', $groupId)
                ->update([
                    'nutrition_diet_file_group_id' => null,
                    'group_name_snapshot' => (string) $group->name,
                    'updated_at' => now(),
                ]);

            DB::table('nutrition_diet_file_groups')->where('id', $groupId)->delete();
        });

        return response()->json([
            'success' => true,
            'message' => __('tenant.nutrition.diet_file_category_deleted'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'nutrition_diet_file_group_id' => ['nullable', 'integer', 'exists:nutrition_diet_file_groups,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'calories' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'is_active' => ['nullable', 'boolean'],
            'file' => ['required', 'file', 'mimes:pdf,png,jpg,jpeg,webp,doc,docx', 'max:30720'],
        ]);

        /** @var UploadedFile $file */
        $file = $validated['file'];
        $path = $file->store('nutrition/diet-files', 'media_public');
        $this->recordTenantMediaFile($path, (int) $file->getSize());

        $groupId = $validated['nutrition_diet_file_group_id'] ?? null;

        $id = DB::table('nutrition_diet_files')->insertGetId([
            'nutrition_diet_file_group_id' => $groupId,
            'group_name_snapshot' => $this->resolveGroupName($groupId),
            'title' => trim((string) $validated['title']),
            'description' => $this->nullableTrim($validated['description'] ?? null),
            'calories' => isset($validated['calories']) ? (int) $validated['calories'] : null,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'mime_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'created_by_user_id' => $request->user('tenant_web')?->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $item = $this->findFileRow($id);

        return response()->json([
            'success' => true,
            'message' => __('tenant.nutrition.diet_file_created'),
            'data' => [
                'item' => $this->transformFile($item),
            ],
        ]);
    }

    public function update(Request $request, string $dietFileId): JsonResponse
    {
        $this->ensureAdmin($request);

        $fileRow = DB::table('nutrition_diet_files')->where('id', $dietFileId)->first();
        abort_unless($fileRow, 404);

        $validated = $request->validate([
            'nutrition_diet_file_group_id' => ['nullable', 'integer', 'exists:nutrition_diet_file_groups,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'calories' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'is_active' => ['nullable', 'boolean'],
            'file' => ['nullable', 'file', 'mimes:pdf,png,jpg,jpeg,webp,doc,docx', 'max:30720'],
        ]);

        $nextPath = (string) $fileRow->file_path;
        $nextName = (string) $fileRow->file_name;
        $nextMime = $fileRow->mime_type;
        $nextSize = $fileRow->file_size;

        if (($validated['file'] ?? null) instanceof UploadedFile) {
            /** @var UploadedFile $file */
            $file = $validated['file'];
            $nextPath = $file->store('nutrition/diet-files', 'media_public');
            $nextName = $file->getClientOriginalName();
            $nextMime = $file->getClientMimeType();
            $nextSize = $file->getSize();
            $this->deletePhysicalFile((string) $fileRow->file_path);
            $this->recordTenantMediaFile($nextPath, (int) $nextSize);
        }

        $groupId = $validated['nutrition_diet_file_group_id'] ?? null;

        DB::table('nutrition_diet_files')
            ->where('id', $dietFileId)
            ->update([
                'nutrition_diet_file_group_id' => $groupId,
                'group_name_snapshot' => $this->resolveGroupName($groupId),
                'title' => trim((string) $validated['title']),
                'description' => $this->nullableTrim($validated['description'] ?? null),
                'calories' => isset($validated['calories']) ? (int) $validated['calories'] : null,
                'file_name' => $nextName,
                'file_path' => $nextPath,
                'mime_type' => $nextMime,
                'file_size' => $nextSize,
                'is_active' => (bool) ($validated['is_active'] ?? true),
                'updated_at' => now(),
            ]);

        $fresh = $this->findFileRow($dietFileId);

        return response()->json([
            'success' => true,
            'message' => __('tenant.nutrition.diet_file_updated'),
            'data' => [
                'item' => $this->transformFile($fresh),
            ],
        ]);
    }

    public function destroy(Request $request, string $dietFileId): JsonResponse
    {
        $this->ensureAdmin($request);

        $fileRow = DB::table('nutrition_diet_files')->where('id', $dietFileId)->first();
        abort_unless($fileRow, 404);

        DB::table('nutrition_diet_files')->where('id', $dietFileId)->delete();
        $this->deletePhysicalFile((string) $fileRow->file_path);

        return response()->json([
            'success' => true,
            'message' => __('tenant.nutrition.diet_file_deleted'),
        ]);
    }

    private function findFileRow(string|int $dietFileId): ?object
    {
        return DB::table('nutrition_diet_files')
            ->leftJoin('nutrition_diet_file_groups', 'nutrition_diet_file_groups.id', '=', 'nutrition_diet_files.nutrition_diet_file_group_id')
            ->select([
                'nutrition_diet_files.*',
                DB::raw('COALESCE(nutrition_diet_file_groups.name, nutrition_diet_files.group_name_snapshot) as group_name'),
            ])
            ->where('nutrition_diet_files.id', $dietFileId)
            ->first();
    }

    private function transformGroup(?object $group): ?array
    {
        if (! $group) {
            return null;
        }

        return [
            'id' => (string) $group->id,
            'name' => (string) $group->name,
            'sortOrder' => (int) ($group->sort_order ?? 0),
            'isActive' => (bool) ($group->is_active ?? true),
            'filesCount' => isset($group->files_count) ? (int) $group->files_count : 0,
        ];
    }

    private function transformFile(?object $item): ?array
    {
        if (! $item) {
            return null;
        }

        return [
            'id' => (string) $item->id,
            'title' => (string) $item->title,
            'description' => $item->description,
            'calories' => $item->calories !== null ? (int) $item->calories : null,
            'groupId' => $item->nutrition_diet_file_group_id ? (string) $item->nutrition_diet_file_group_id : null,
            'groupName' => $item->group_name,
            'fileName' => (string) $item->file_name,
            'fileUrl' => $this->tenantMediaUrl((string) $item->file_path),
            'mimeType' => $item->mime_type,
            'fileSize' => $item->file_size !== null ? (int) $item->file_size : null,
            'isActive' => (bool) ($item->is_active ?? true),
            'createdAt' => filled($item->created_at) ? (string) $item->created_at : null,
        ];
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

    private function resolveGroupName(mixed $groupId): ?string
    {
        if (empty($groupId)) {
            return null;
        }

        $name = DB::table('nutrition_diet_file_groups')
            ->where('id', (int) $groupId)
            ->value('name');

        return $name !== null ? (string) $name : null;
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
    }
};
