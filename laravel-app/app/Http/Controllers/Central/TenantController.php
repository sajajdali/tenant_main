<?php

declare(strict_types=1);

namespace App\Http\Controllers\Central;

use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\FeatureModule;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Http\Controllers\Controller;
use App\Http\Resources\Central\TenantResource;
use App\Services\TenantFeatureModuleManager;
use App\Services\TenantProvisioningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TenantController extends Controller
{
    public function __construct(
        private readonly TenantProvisioningService $tenantProvisioningService,
        private readonly TenantFeatureModuleManager $tenantFeatureModules,
    )
    {
    }

    public function index()
    {
        return TenantResource::collection(Tenant::query()->with('domains')->latest()->paginate());
    }

    public function store(Request $request): TenantResource
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:tenants,slug'],
            'database' => ['nullable', 'string', 'max:255', 'unique:tenants,database'],
            'domain' => ['required', 'string', 'max:255', 'unique:domains,domain'],
            'status' => ['nullable', 'in:active,inactive'],
            'owner_user_id' => ['required', 'integer', 'exists:users,id'],
            'subscription_package_id' => ['nullable', 'integer', 'exists:subscription_packages,id'],
            'feature_module_ids' => ['nullable', 'array'],
            'feature_module_ids.*' => ['integer', 'exists:feature_modules,id'],
        ]);

        $slug = $validated['slug'] ?? Str::slug($validated['name']);
        $tenant = Tenant::create([
            'name' => $validated['name'],
            'slug' => $slug,
            'database' => $validated['database'] ?? "tenant_{$slug}",
            'status' => $validated['status'] ?? 'active',
            'owner_user_id' => $validated['owner_user_id'],
            'subscription_package_id' => $validated['subscription_package_id'] ?? null,
        ]);

        $tenant->createDomain($validated['domain']);
        $this->tenantProvisioningService->provisionUsersAndRoles($tenant->fresh(['owner']));
        $this->tenantProvisioningService->provisionDefaultSmsSettings($tenant);
        $this->tenantProvisioningService->applyPackageSmsCreditGift(
            $tenant,
            isset($validated['subscription_package_id']) ? SubscriptionPackage::query()->find($validated['subscription_package_id']) : null,
            [
                'source_type' => 'manual_tenant_sms_gift',
                'source_id' => (string) $tenant->id,
                'tenant_id' => (string) $tenant->id,
                'title' => 'هزینه شارژ هدیه پیامک برای ایجاد دستی سامانه',
                'occurred_at' => $tenant->created_at ?? now(),
                'meta' => [
                    'created_via' => 'central_api',
                ],
            ],
        );
        $featureModules = FeatureModule::query()
            ->whereIn('id', collect($validated['feature_module_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->values())
            ->get();

        foreach ($featureModules as $featureModule) {
            $this->tenantFeatureModules->activate($tenant, $featureModule, [
                'source' => 'central_api',
            ]);
        }

        return new TenantResource($tenant->load('domains'));
    }

    public function show(Tenant $tenant): TenantResource
    {
        return new TenantResource($tenant->load('domains'));
    }

    public function update(Request $request, Tenant $tenant): TenantResource
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', 'unique:tenants,slug,' . $tenant->id . ',id'],
            'database' => ['sometimes', 'string', 'max:255', 'unique:tenants,database,' . $tenant->id . ',id'],
            'status' => ['sometimes', 'in:active,inactive'],
            'owner_user_id' => ['sometimes', 'integer', 'exists:users,id'],
        ]);

        $tenant->update($validated);
        $this->tenantProvisioningService->provisionUsersAndRoles($tenant->fresh(['owner']));

        return new TenantResource($tenant->fresh('domains'));
    }

    public function attachDomain(Request $request, Tenant $tenant): JsonResponse
    {
        $validated = $request->validate([
            'domain' => ['required', 'string', 'max:255', 'unique:domains,domain'],
        ]);

        $domain = $tenant->createDomain($validated['domain']);

        return response()->json([
            'data' => [
                'id' => $domain->id,
                'domain' => $domain->domain,
            ],
        ], 201);
    }
}
