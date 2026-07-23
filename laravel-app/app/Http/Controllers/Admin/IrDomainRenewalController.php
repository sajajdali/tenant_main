<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Landing\Models\AudienceCheckoutSetting;
use App\Domain\Landing\Models\DomainTldPrice;
use App\Domain\Tenant\Models\AudienceType;
use App\Domain\Tenant\Models\Tenant;
use App\Http\Controllers\Controller;
use App\Support\DomainTldCatalog;
use App\Support\TenantManagedDomain;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class IrDomainRenewalController extends Controller
{
    public function index(Request $request): View
    {
        abort_unless($request->user()?->role === 'admin', 403);
        DomainTldCatalog::ensureSeeded();

        $dueOptions = ['month', '15days', '7days', '1day', 'expired', 'active', 'unregistered'];
        $filters = [
            'due' => in_array((string) $request->query('due', ''), $dueOptions, true) ? (string) $request->query('due', '') : '',
            'audience_type_id' => (string) $request->query('audience_type_id', ''),
            'tld' => trim((string) $request->query('tld', '')),
            'q' => trim((string) $request->query('q', '')),
        ];

        $baseQuery = Tenant::query()
            ->with(['domains', 'owner', 'audienceType.checkoutSetting']);

        $this->applySharedFilters($baseQuery, $filters);

        $summaryBaseQuery = clone $baseQuery;
        $listQuery = clone $baseQuery;

        $this->applyDueFilter($listQuery, $filters['due']);

        return view('admin.ir-domain-renewals.index', [
            'tenants' => $listQuery
                ->orderByRaw('CASE WHEN ir_domain_renews_at IS NULL THEN 1 ELSE 0 END')
                ->orderBy('ir_domain_renews_at')
                ->paginate(20)
                ->withQueryString(),
            'audiences' => AudienceType::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
            'tldOptions' => DomainTldPrice::query()
                ->where('is_active', true)
                ->orderByRaw("CASE WHEN tld = '.ir' THEN 0 ELSE 1 END")
                ->orderBy('tld')
                ->get(),
            'filters' => $filters,
            'summary' => $this->summary($summaryBaseQuery),
            'defaultIrRenewAmount' => $this->defaultRenewAmount('.ir'),
        ]);
    }

    public function update(Request $request, Tenant $tenant): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $validated = $request->validate([
            'mode' => ['nullable', 'in:register,renew,disable'],
            'managed_domain_registered' => ['nullable', 'boolean'],
            'managed_domain_tld' => ['nullable', 'string', 'max:20', 'exists:central.domain_tld_prices,tld'],
            'managed_domain_renews_at' => ['nullable', 'date'],
            'managed_domain_amount' => ['nullable', 'integer', 'min:0'],
        ]);

        $mode = (string) ($validated['mode'] ?? 'renew');
        $tld = trim((string) ($validated['managed_domain_tld'] ?? ($tenant->managed_domain_tld ?: '.ir')));
        $registered = $mode === 'disable' ? false : (bool) ($validated['managed_domain_registered'] ?? true);

        if (! $registered) {
            $tenant->update([
                'domain_management_mode' => 'platform_managed',
                'managed_domain_tld' => $tld !== '' ? $tld : null,
                'managed_domain_registered' => false,
                'managed_domain_registered_at' => null,
                'managed_domain_last_paid_at' => null,
                'managed_domain_renews_at' => null,
                'managed_domain_amount' => null,
                'ir_domain_registered' => false,
                'ir_domain_registered_at' => null,
                'ir_domain_last_paid_at' => null,
                'ir_domain_renews_at' => null,
                'ir_domain_amount' => null,
            ]);

            return back()->with('success', 'وضعیت تمدید دامنه این سامانه پاک شد.');
        }

        $existingRenewDate = $tenant->managed_domain_renews_at?->copy() ?? $tenant->ir_domain_renews_at?->copy();
        $nextRenewDate = isset($validated['managed_domain_renews_at']) && $validated['managed_domain_renews_at']
            ? Carbon::parse((string) $validated['managed_domain_renews_at'])->toDateString()
            : ($mode === 'renew'
                ? (($existingRenewDate?->isFuture() ? $existingRenewDate : now())->copy()->addYear()->toDateString())
                : ($existingRenewDate?->toDateString() ?? now()->addYear()->toDateString()));

        $renewAmount = array_key_exists('managed_domain_amount', $validated) && $validated['managed_domain_amount'] !== null
            ? (int) $validated['managed_domain_amount']
            : ($tenant->managed_domain_amount ?? $this->defaultRenewAmount($tld));

        $payload = [
            'domain_management_mode' => 'platform_managed',
            'managed_domain_tld' => $tld,
            'managed_domain_registered' => true,
            'managed_domain_registered_at' => $tenant->managed_domain_registered_at?->toDateString() ?? now()->toDateString(),
            'managed_domain_last_paid_at' => now()->toDateString(),
            'managed_domain_renews_at' => $nextRenewDate,
            'managed_domain_amount' => $renewAmount,
        ];

        if ($tld === '.ir') {
            $payload = array_merge($payload, [
                'ir_domain_registered' => true,
                'ir_domain_registered_at' => $tenant->ir_domain_registered_at?->toDateString() ?? now()->toDateString(),
                'ir_domain_last_paid_at' => now()->toDateString(),
                'ir_domain_renews_at' => $nextRenewDate,
                'ir_domain_amount' => $renewAmount,
            ]);
        } else {
            $payload = array_merge($payload, [
                'ir_domain_registered' => false,
                'ir_domain_registered_at' => null,
                'ir_domain_last_paid_at' => null,
                'ir_domain_renews_at' => null,
                'ir_domain_amount' => null,
            ]);
        }

        $tenant->update($payload);

        $label = trim((string) (DomainTldPrice::query()->where('tld', $tld)->value('meta_json->label') ?? '')) ?: "دامنه {$tld}";

        return back()->with('success', $mode === 'register'
            ? "ثبت {$label} برای سامانه انجام شد و سررسید سال بعد ذخیره شد."
            : "تمدید {$label} با موفقیت ثبت شد.");
    }

    private function applySharedFilters($query, array $filters): void
    {
        if ($filters['audience_type_id'] !== '') {
            $query->where('audience_type_id', (int) $filters['audience_type_id']);
        }

        if ($filters['tld'] !== '') {
            $query->where(function ($tldQuery) use ($filters): void {
                $tldQuery->where('managed_domain_tld', $filters['tld']);

                if ($filters['tld'] === '.ir') {
                    $tldQuery->orWhere(function ($legacyQuery): void {
                        $legacyQuery
                            ->whereNull('managed_domain_tld')
                            ->where('ir_domain_registered', true);
                    });
                }
            });
        }

        if ($filters['q'] !== '') {
            $term = '%' . str_replace(' ', '%', $filters['q']) . '%';

            $query->where(function ($searchQuery) use ($term): void {
                $searchQuery
                    ->where('name', 'like', $term)
                    ->orWhere('id', 'like', $term)
                    ->orWhere('slug', 'like', $term)
                    ->orWhereHas('owner', function ($ownerQuery) use ($term): void {
                        $ownerQuery
                            ->where('name', 'like', $term)
                            ->orWhere('mobile', 'like', $term);
                    })
                    ->orWhereHas('domains', function ($domainQuery) use ($term): void {
                        $domainQuery->where('domain', 'like', $term);
                    });
            });
        }
    }

    private function applyDueFilter($query, string $due): void
    {
        $today = now()->toDateString();

        match ($due) {
            'month' => $query->where('managed_domain_registered', true)->whereBetween('managed_domain_renews_at', [$today, now()->addDays(30)->toDateString()]),
            '15days' => $query->where('managed_domain_registered', true)->whereBetween('managed_domain_renews_at', [$today, now()->addDays(15)->toDateString()]),
            '7days' => $query->where('managed_domain_registered', true)->whereBetween('managed_domain_renews_at', [$today, now()->addDays(7)->toDateString()]),
            '1day' => $query->where('managed_domain_registered', true)->whereBetween('managed_domain_renews_at', [$today, now()->addDay()->toDateString()]),
            'expired' => $query->where('managed_domain_registered', true)->whereDate('managed_domain_renews_at', '<', $today),
            'active' => $query->where('managed_domain_registered', true)->whereDate('managed_domain_renews_at', '>', now()->addDays(30)->toDateString()),
            'unregistered' => $query->where('managed_domain_registered', false),
            default => $query->where('managed_domain_registered', true),
        };
    }

    private function summary($baseQuery): array
    {
        $today = now()->toDateString();

        $registeredBase = (clone $baseQuery)->where('managed_domain_registered', true);

        return [
            'registered' => (clone $registeredBase)->count(),
            'month' => (clone $registeredBase)->whereBetween('managed_domain_renews_at', [$today, now()->addDays(30)->toDateString()])->count(),
            '15days' => (clone $registeredBase)->whereBetween('managed_domain_renews_at', [$today, now()->addDays(15)->toDateString()])->count(),
            '7days' => (clone $registeredBase)->whereBetween('managed_domain_renews_at', [$today, now()->addDays(7)->toDateString()])->count(),
            '1day' => (clone $registeredBase)->whereBetween('managed_domain_renews_at', [$today, now()->addDay()->toDateString()])->count(),
            'expired' => (clone $registeredBase)->whereDate('managed_domain_renews_at', '<', $today)->count(),
            'unregistered' => (clone $baseQuery)->where('managed_domain_registered', false)->count(),
        ];
    }

    private function defaultRenewAmount(string $tld = '.ir', ?Tenant $tenant = null): int
    {
        $audienceTypeId = $tenant?->audience_type_id;

        if ($audienceTypeId !== null) {
            $audienceSetupAmount = (int) (AudienceCheckoutSetting::query()
                ->where('audience_type_id', $audienceTypeId)
                ->value('setup_fee_amount') ?? 0);

            if ($audienceSetupAmount > 0) {
                return $audienceSetupAmount;
            }
        }

        return (int) (DomainTldPrice::query()
            ->where('tld', $tld)
            ->where('is_active', true)
            ->value('renew_price_amount') ?? 0);
    }
}
