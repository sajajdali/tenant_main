<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Landing\Models\LandingSite;
use App\Domain\Landing\Models\LandingSiteDomain;
use App\Domain\Tenant\Models\AudienceType;
use App\Http\Controllers\Controller;
use App\Support\LandingSectionRegistry;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class LandingSiteController extends Controller
{
    public function index(): View
    {
        return view('admin.landing-sites.index', [
            'landingSites' => LandingSite::query()
                ->with(['audienceType', 'domains', 'createdBy'])
                ->withCount(['pages', 'orders'])
                ->latest('id')
                ->paginate(12),
        ]);
    }

    public function create(): View
    {
        return view('admin.landing-sites.form', [
            'landingSite' => new LandingSite([
                'status' => 'draft',
                'theme_mode' => 'dark',
                'is_active' => true,
                'is_default' => false,
            ]),
            'audiences' => AudienceType::query()
                ->where('is_active', true)
                ->whereDoesntHave('landingSite')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
            'domainValues' => [
                'primary' => '',
                'additional' => '',
            ],
            'seoValues' => [
                'title' => '',
                'description' => '',
            ],
            'isEdit' => false,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validatePayload($request);

        DB::transaction(function () use ($request, $validated): void {
            $landingSite = LandingSite::query()->create([
                'audience_type_id' => $validated['audience_type_id'],
                'created_by_user_id' => $request->user()->id,
                'updated_by_user_id' => $request->user()->id,
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'status' => $validated['status'],
                'theme_mode' => $validated['theme_mode'],
                'is_active' => $validated['is_active'],
                'is_default' => $validated['is_default'],
                'seo_json' => $validated['seo_json'],
                'appearance_json' => [
                    'themeMode' => $validated['theme_mode'],
                ],
                'settings_json' => [
                    'primaryDomain' => $validated['primary_domain'],
                ],
            ]);

            $this->syncDomains($landingSite, $validated['domains'], $validated['primary_domain']);
            $this->seedDefaultPagesIfMissing($landingSite);
        });

        return redirect()
            ->route('admin.landing-sites.index')
            ->with('success', 'لندینگ با دامنه‌های اولیه با موفقیت ساخته شد.');
    }

    public function show(LandingSite $landingSite): View
    {
        $landingSite->load([
            'audienceType',
            'domains',
            'pages',
            'createdBy',
            'updatedBy',
            'orders.customer',
            'contactSubmissions',
        ]);

        return view('admin.landing-sites.show', [
            'landingSite' => $landingSite,
            'latestOrders' => $landingSite->orders()
                ->with('customer')
                ->latest('id')
                ->limit(8)
                ->get(),
            'latestContactSubmissions' => $landingSite->contactSubmissions()
                ->latest('submitted_at')
                ->latest('id')
                ->limit(6)
                ->get(),
        ]);
    }

    public function edit(LandingSite $landingSite): View
    {
        $landingSite->load('domains');

        $primaryDomain = $landingSite->domains->firstWhere('is_primary', true)?->domain
            ?? $landingSite->domains->first()?->domain
            ?? '';

        $additionalDomains = $landingSite->domains
            ->where('domain', '!==', $primaryDomain)
            ->pluck('domain')
            ->implode(PHP_EOL);

        return view('admin.landing-sites.form', [
            'landingSite' => $landingSite,
            'audiences' => AudienceType::query()
                ->where('is_active', true)
                ->where(function ($query) use ($landingSite): void {
                    $query->whereDoesntHave('landingSite')
                        ->orWhere('id', $landingSite->audience_type_id);
                })
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
            'domainValues' => [
                'primary' => $primaryDomain,
                'additional' => $additionalDomains,
            ],
            'seoValues' => [
                'title' => (string) data_get($landingSite->seo_json, 'title', ''),
                'description' => (string) data_get($landingSite->seo_json, 'description', ''),
            ],
            'isEdit' => true,
        ]);
    }

    public function update(Request $request, LandingSite $landingSite): RedirectResponse
    {
        $validated = $this->validatePayload($request, $landingSite);

        DB::transaction(function () use ($request, $validated, $landingSite): void {
            $landingSite->update([
                'audience_type_id' => $validated['audience_type_id'],
                'updated_by_user_id' => $request->user()->id,
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'status' => $validated['status'],
                'theme_mode' => $validated['theme_mode'],
                'is_active' => $validated['is_active'],
                'is_default' => $validated['is_default'],
                'seo_json' => $validated['seo_json'],
                'appearance_json' => array_merge($landingSite->appearance_json ?? [], [
                    'themeMode' => $validated['theme_mode'],
                ]),
                'settings_json' => array_merge($landingSite->settings_json ?? [], [
                    'primaryDomain' => $validated['primary_domain'],
                ]),
            ]);

            $this->syncDomains($landingSite, $validated['domains'], $validated['primary_domain']);
            $this->seedDefaultPagesIfMissing($landingSite);
        });

        return redirect()
            ->route('admin.landing-sites.show', $landingSite)
            ->with('success', 'اطلاعات لندینگ به‌روزرسانی شد.');
    }

    public function destroy(LandingSite $landingSite): RedirectResponse
    {
        DB::transaction(function () use ($landingSite): void {
            $landingSite->domains()->delete();
            $landingSite->forceDelete();
        });

        return redirect()
            ->route('admin.landing-sites.index')
            ->with('success', 'لندینگ حذف شد.');
    }

    private function validatePayload(Request $request, ?LandingSite $landingSite = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('landing_sites', 'slug')->ignore($landingSite?->id),
            ],
            'audience_type_id' => [
                'required',
                'integer',
                Rule::exists('audience_types', 'id'),
                Rule::unique('landing_sites', 'audience_type_id')->ignore($landingSite?->id),
            ],
            'status' => ['required', 'string', Rule::in(['draft', 'published', 'archived'])],
            'theme_mode' => ['required', 'string', Rule::in(['dark', 'light'])],
            'primary_domain' => ['required', 'string', 'max:255'],
            'additional_domains' => ['nullable', 'string'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        $domains = $this->extractDomains(
            (string) $validated['primary_domain'],
            (string) ($validated['additional_domains'] ?? '')
        );

        if ($domains === []) {
            throw ValidationException::withMessages([
                'primary_domain' => 'حداقل یک دامنه معتبر وارد کنید.',
            ]);
        }

        $this->ensureDomainsAreUnique($domains, $landingSite);

        return [
            'name' => trim($validated['name']),
            'slug' => $validated['slug'] ? Str::slug((string) $validated['slug']) : Str::slug((string) $validated['name']),
            'audience_type_id' => (int) $validated['audience_type_id'],
            'status' => $validated['status'],
            'theme_mode' => $validated['theme_mode'],
            'primary_domain' => $this->normalizeDomain((string) $validated['primary_domain']),
            'domains' => $domains,
            'seo_json' => [
                'title' => trim((string) ($validated['seo_title'] ?? '')),
                'description' => trim((string) ($validated['seo_description'] ?? '')),
            ],
            'is_active' => (bool) ($validated['is_active'] ?? false),
            'is_default' => (bool) ($validated['is_default'] ?? false),
        ];
    }

    private function extractDomains(string $primaryDomain, string $additionalDomains): array
    {
        $domainLines = collect([$primaryDomain])
            ->merge(preg_split('/\r\n|\r|\n/', $additionalDomains) ?: [])
            ->map(fn (string $domain): string => $this->normalizeDomain($domain))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return $domainLines;
    }

    private function ensureDomainsAreUnique(array $domains, ?LandingSite $landingSite = null): void
    {
        $query = LandingSiteDomain::query()->whereIn('domain', $domains);

        if ($landingSite) {
            $query->where('landing_site_id', '!=', $landingSite->id);
        }

        $existing = $query->pluck('domain')->all();

        if ($existing !== []) {
            throw ValidationException::withMessages([
                'primary_domain' => 'این دامنه قبلا برای یک لندینگ دیگر ثبت شده است: '.implode(' ، ', $existing),
            ]);
        }
    }

    private function syncDomains(LandingSite $landingSite, array $domains, string $primaryDomain): void
    {
        $primaryDomain = $this->normalizeDomain($primaryDomain);

        $landingSite->domains()
            ->whereNotIn('domain', $domains)
            ->delete();

        foreach ($domains as $domain) {
            $landingSite->domains()->updateOrCreate(
                ['domain' => $domain],
                [
                    'is_primary' => $domain === $primaryDomain,
                    'status' => 'active',
                ],
            );
        }

        $landingSite->domains()
            ->where('domain', '!=', $primaryDomain)
            ->update(['is_primary' => false]);
    }

    private function seedDefaultPagesIfMissing(LandingSite $landingSite): void
    {
        $pages = collect([
            ['name' => 'صفحه اصلی', 'slug' => 'home', 'page_key' => 'home', 'sort_order' => 10],
            ['name' => 'پلن‌ها', 'slug' => 'plans', 'page_key' => 'plans', 'sort_order' => 20],
            ['name' => 'سوالات متداول', 'slug' => 'faq', 'page_key' => 'faq', 'sort_order' => 30],
            ['name' => 'تماس با ما', 'slug' => 'contact', 'page_key' => 'contact', 'sort_order' => 40],
        ]);

        foreach ($pages as $page) {
            $landingSite->pages()->firstOrCreate(
                ['page_key' => $page['page_key']],
                [
                    ...$page,
                    'status' => 'draft',
                    'seo_json' => [],
                    'settings_json' => [],
                ],
            );
        }

        $homePage = $landingSite->pages()->where('page_key', 'home')->first();

        if (! $homePage || $homePage->sections()->exists()) {
            return;
        }

        foreach (LandingSectionRegistry::homeSections() as $section) {
            $homePage->sections()->create([
                'section_key' => $section['section_key'],
                'section_type' => $section['section_type'],
                'name' => $section['name'],
                'status' => 'active',
                'sort_order' => $section['sort_order'],
                'content_json' => $section['content_json'],
                'settings_json' => [],
            ]);
        }
    }

    private function normalizeDomain(string $domain): string
    {
        $normalized = mb_strtolower(trim($domain));
        $normalized = preg_replace('#^https?://#', '', $normalized) ?? $normalized;
        $normalized = strtok($normalized, '/?:#') ?: $normalized;

        return trim($normalized, '. ');
    }
}
