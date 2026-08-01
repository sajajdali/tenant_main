<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Landing\Models\LandingPage;
use App\Domain\Landing\Models\LandingPageSection;
use App\Domain\Landing\Models\LandingSite;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Http\Controllers\Controller;
use App\Support\LandingSectionRegistry;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class LandingSectionController extends Controller
{
    public function index(LandingSite $landingSite): View
    {
        $homePage = $this->resolveHomePage($landingSite);
        $this->seedDefaultSectionsIfMissing($homePage);
        $homePage->load('sections');

        return view('admin.landing-sections.index', [
            'landingSite' => $landingSite,
            'homePage' => $homePage,
            'sections' => $homePage->sections()->orderBy('sort_order')->get(),
        ]);
    }

    public function edit(LandingSite $landingSite, LandingPageSection $section): View
    {
        abort_unless((int) $section->landingPage?->landing_site_id === (int) $landingSite->id, 404);

        return view('admin.landing-sections.form', [
            'landingSite' => $landingSite,
            'section' => $section->load('landingPage'),
            'registry' => LandingSectionRegistry::homeSectionByKey($section->section_key),
            'isSlider' => $section->section_key === 'slider',
            'isPainPoints' => $section->section_key === 'pain_points',
            'isVideoIntro' => $section->section_key === 'video_intro',
            'isBeforeAfter' => $section->section_key === 'before_after',
            'isGalleryShowcase' => $section->section_key === 'gallery_showcase',
            'isFeatureGrid' => $section->section_key === 'feature_grid',
            'isProcessSteps' => $section->section_key === 'process_steps',
            'isPlans' => $section->section_key === 'plans',
            'isFaq' => $section->section_key === 'faq',
            'isFooterCta' => $section->section_key === 'footer_cta',
            'sliderContent' => array_merge(
                LandingSectionRegistry::sliderDefaultContent(),
                $section->content_json ?? []
            ),
            'painPointsContent' => array_merge(
                LandingSectionRegistry::painPointsDefaultContent(),
                $section->content_json ?? []
            ),
            'videoIntroContent' => array_merge(
                LandingSectionRegistry::videoIntroDefaultContent(),
                $section->content_json ?? []
            ),
            'beforeAfterContent' => array_merge(
                LandingSectionRegistry::beforeAfterDefaultContent(),
                $section->content_json ?? []
            ),
            'galleryShowcaseContent' => array_merge(
                LandingSectionRegistry::galleryShowcaseDefaultContent(),
                $section->content_json ?? []
            ),
            'featureGridContent' => array_merge(
                LandingSectionRegistry::featureGridDefaultContent(),
                $section->content_json ?? []
            ),
            'processStepsContent' => array_merge(
                LandingSectionRegistry::processStepsDefaultContent(),
                $section->content_json ?? []
            ),
            'plansContent' => array_merge(
                LandingSectionRegistry::plansDefaultContent(),
                $section->content_json ?? []
            ),
            'packageOptions' => SubscriptionPackage::query()
                ->with('audiencePrices')
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('duration_days')
                ->orderByRaw('CASE WHEN user_limit IS NULL THEN 999999 ELSE user_limit END')
                ->get()
                ->map(function (SubscriptionPackage $package) use ($landingSite): array {
                    $pricing = $package->pricingFor($landingSite->audience_type_id);

                    return [
                        'id' => (string) $package->id,
                        'label' => __('admin.landing_sections.package_option_label', [
                            'name' => $package->name,
                            'days' => number_format((int) $package->duration_days),
                            'limit' => $package->userLimitLabel(),
                            'amount' => number_format((int) $pricing['payableAmount']),
                        ]),
                    ];
                })
                ->values()
                ->all(),
            'faqContent' => array_merge(
                LandingSectionRegistry::faqDefaultContent(),
                $section->content_json ?? []
            ),
            'footerCtaContent' => array_merge(
                LandingSectionRegistry::footerCtaDefaultContent(),
                $section->content_json ?? []
            ),
        ]);
    }

    public function update(Request $request, LandingSite $landingSite, LandingPageSection $section): RedirectResponse
    {
        abort_unless((int) $section->landingPage?->landing_site_id === (int) $landingSite->id, 404);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'status' => ['required', 'string', Rule::in(['active', 'inactive'])],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'badge_text' => ['nullable', 'string', 'max:255'],
            'title_line_1' => ['nullable', 'string', 'max:255'],
            'title_highlight' => ['nullable', 'string', 'max:255'],
            'title_line_3' => ['nullable', 'string', 'max:255'],
            'typing_prefix' => ['nullable', 'string', 'max:255'],
            'typing_items' => ['nullable', 'array', 'max:20'],
            'typing_items.*' => ['nullable', 'string', 'max:500'],
            'typing_final_text' => ['nullable', 'string', 'max:500'],
            'hero_image_url' => ['nullable', 'string', 'max:2000'],
            'hero_image_file' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'description' => ['nullable', 'string', 'max:2000'],
            'feature_chip_1' => ['nullable', 'string', 'max:255'],
            'feature_chip_2' => ['nullable', 'string', 'max:255'],
            'feature_chip_3' => ['nullable', 'string', 'max:255'],
            'primary_cta_text' => ['nullable', 'string', 'max:255'],
            'secondary_cta_text' => ['nullable', 'string', 'max:255'],
            'side_title' => ['nullable', 'string', 'max:255'],
            'side_description' => ['nullable', 'string', 'max:1000'],
            'side_bullet_1' => ['nullable', 'string', 'max:255'],
            'side_bullet_2' => ['nullable', 'string', 'max:255'],
            'side_bullet_3' => ['nullable', 'string', 'max:255'],
            'side_bullet_4' => ['nullable', 'string', 'max:255'],
            'side_bullet_5' => ['nullable', 'string', 'max:255'],
            'side_bullet_6' => ['nullable', 'string', 'max:255'],
            'side_bullet_7' => ['nullable', 'string', 'max:255'],
            'pain_point_1' => ['nullable', 'string', 'max:255'],
            'pain_point_2' => ['nullable', 'string', 'max:255'],
            'pain_point_3' => ['nullable', 'string', 'max:255'],
            'pain_point_4' => ['nullable', 'string', 'max:255'],
            'pain_point_5' => ['nullable', 'string', 'max:255'],
            'pain_point_6' => ['nullable', 'string', 'max:255'],
            'pain_point_7' => ['nullable', 'string', 'max:255'],
            'pain_point_8' => ['nullable', 'string', 'max:255'],
            'section_title' => ['nullable', 'string', 'max:255'],
            'section_description' => ['nullable', 'string', 'max:2000'],
            'button_label' => ['nullable', 'string', 'max:255'],
            'button_url' => ['nullable', 'string', 'max:2000'],
            'modal_title' => ['nullable', 'string', 'max:255'],
            'modal_description' => ['nullable', 'string', 'max:1000'],
            'demo_modal_title' => ['nullable', 'string', 'max:255'],
            'demo_modal_description' => ['nullable', 'string', 'max:1000'],
            'video_url' => ['nullable', 'string', 'max:2000'],
            'demo_links' => ['nullable', 'array'],
            'demo_links.*.title' => ['nullable', 'string', 'max:255'],
            'demo_links.*.description' => ['nullable', 'string', 'max:500'],
            'demo_links.*.url' => ['nullable', 'string', 'max:2000'],
            'demo_links.*.icon' => ['nullable', 'string', Rule::in(['external', 'scissors', 'sparkles'])],
            'video_file' => ['nullable', 'file', 'mimetypes:video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-msvideo,application/octet-stream', 'mimes:mp4,mov,webm,m4v,avi', 'max:61440'],
            'cover_url' => ['nullable', 'string', 'max:2000'],
            'cover_file' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'image_url' => ['nullable', 'string', 'max:2000'],
            'image_file' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'stats_title' => ['nullable', 'string', 'max:255'],
            'stats_description' => ['nullable', 'string', 'max:1000'],
            'view_all_label' => ['nullable', 'string', 'max:255'],
            'full_page_button_label' => ['nullable', 'string', 'max:255'],
            'copyright_text' => ['nullable', 'string', 'max:500'],
            'cards' => ['nullable', 'array'],
            'cards.*.package_id' => ['nullable', 'integer', 'exists:central.subscription_packages,id'],
            'cards.*.title' => ['nullable', 'string', 'max:255'],
            'cards.*.description' => ['nullable', 'string', 'max:1000'],
            'cards.*.badge_text' => ['nullable', 'string', 'max:255'],
            'cards.*.button_text' => ['nullable', 'string', 'max:255'],
            'cards.*.button_variant' => ['nullable', 'string', Rule::in(['default', 'outline'])],
            'cards.*.featured' => ['nullable', 'boolean'],
            'cards.*.show_on_home' => ['nullable', 'boolean'],
            'cards.*.feature_1' => ['nullable', 'string', 'max:255'],
            'cards.*.feature_2' => ['nullable', 'string', 'max:255'],
            'cards.*.feature_3' => ['nullable', 'string', 'max:255'],
            'faq_items' => ['nullable', 'array'],
            'faq_items.*.question' => ['nullable', 'string', 'max:1000'],
            'faq_items.*.answer' => ['nullable', 'string', 'max:5000'],
            'faq_items.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'faq_items.*.show_on_home' => ['nullable', 'boolean'],
            'items' => ['nullable', 'array'],
            'items.*.title' => ['nullable', 'string', 'max:255'],
            'items.*.short' => ['nullable', 'string', 'max:500'],
            'items.*.detail' => ['nullable', 'string', 'max:3000'],
            'items.*.url' => ['nullable', 'string', 'max:2000'],
            'items.*.is_primary' => ['nullable', 'boolean'],
            'items.*.label' => ['nullable', 'string', 'max:255'],
            'items.*.value' => ['nullable', 'string', 'max:255'],
            'items.*.image_1' => ['nullable', 'string', 'max:2000'],
            'items.*.image_2' => ['nullable', 'string', 'max:2000'],
            'items.*.image_3' => ['nullable', 'string', 'max:2000'],
            'items.*.image_4' => ['nullable', 'string', 'max:2000'],
            'items.*.image_5' => ['nullable', 'string', 'max:2000'],
            'items.*.image_file_1' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'items.*.image_file_2' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'items.*.image_file_3' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'items.*.image_file_4' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'items.*.image_file_5' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
        ]);

        $contentJson = $section->content_json ?? [];

        if ($section->section_key === 'slider') {
            $heroImageUrl = trim((string) ($validated['hero_image_url'] ?? ''));
            $heroImagePath = (string) ($contentJson['heroImagePath'] ?? '');
            if ($request->hasFile('hero_image_file')) {
                $this->deletePhysicalFile($heroImagePath !== '' ? $heroImagePath : null);
                $storedPath = $request->file('hero_image_file')->store('landing/hero', 'media_public');
                $heroImagePath = $storedPath;
                $heroImageUrl = '/storage/' . ltrim($storedPath, '/');
            }

            $contentJson = array_merge($contentJson, [
                'badgeText' => trim((string) ($validated['badge_text'] ?? '')),
                'titleLine1' => trim((string) ($validated['title_line_1'] ?? '')),
                'typingPrefix' => trim((string) ($validated['typing_prefix'] ?? '')),
                'typingItems' => collect($validated['typing_items'] ?? [])->map(fn ($item) => trim((string) $item))->filter()->values()->all(),
                'typingFinalText' => trim((string) ($validated['typing_final_text'] ?? '')),
                'heroImageUrl' => $heroImageUrl,
                'heroImagePath' => $heroImagePath,
                'secondaryCtaText' => trim((string) ($validated['secondary_cta_text'] ?? '')),
            ]);
        } elseif ($section->section_key === 'pain_points') {
            $contentJson = [
                'items' => array_values(array_filter([
                    trim((string) ($validated['pain_point_1'] ?? '')),
                    trim((string) ($validated['pain_point_2'] ?? '')),
                    trim((string) ($validated['pain_point_3'] ?? '')),
                    trim((string) ($validated['pain_point_4'] ?? '')),
                    trim((string) ($validated['pain_point_5'] ?? '')),
                    trim((string) ($validated['pain_point_6'] ?? '')),
                    trim((string) ($validated['pain_point_7'] ?? '')),
                    trim((string) ($validated['pain_point_8'] ?? '')),
                ])),
            ];
        } elseif ($section->section_key === 'video_intro') {
            $videoUrl = trim((string) ($validated['video_url'] ?? ''));
            $videoPath = (string) (($contentJson['videoPath'] ?? ''));

            if ($request->hasFile('video_file')) {
                $this->deletePhysicalFile($videoPath !== '' ? $videoPath : null);
                /** @var UploadedFile $videoFile */
                $videoFile = $request->file('video_file');
                $storedPath = $videoFile->store('landing/videos', 'media_public');
                $videoPath = $storedPath;
                $videoUrl = '/storage/' . ltrim($storedPath, '/');
            }

            $coverUrl = trim((string) ($validated['cover_url'] ?? ''));
            $coverPath = (string) ($contentJson['coverPath'] ?? '');
            if ($request->hasFile('cover_file')) {
                $this->deletePhysicalFile($coverPath !== '' ? $coverPath : null);
                $storedPath = $request->file('cover_file')->store('landing/video-covers', 'media_public');
                $coverPath = $storedPath;
                $coverUrl = '/storage/' . ltrim($storedPath, '/');
            }

            $contentJson = [
                'title' => trim((string) ($validated['section_title'] ?? '')),
                'description' => trim((string) ($validated['section_description'] ?? '')),
                'buttonLabel' => trim((string) ($validated['button_label'] ?? '')),
                'modalTitle' => trim((string) ($validated['modal_title'] ?? '')),
                'modalDescription' => trim((string) ($validated['modal_description'] ?? '')),
                'demoModalTitle' => trim((string) ($validated['demo_modal_title'] ?? '')),
                'demoModalDescription' => trim((string) ($validated['demo_modal_description'] ?? '')),
                'videoUrl' => $videoUrl,
                'videoPath' => $videoPath,
                'coverUrl' => $coverUrl,
                'coverPath' => $coverPath,
                'demoLinks' => collect($validated['demo_links'] ?? [])
                    ->map(fn (array $item): array => [
                        'title' => trim((string) ($item['title'] ?? '')),
                        'description' => trim((string) ($item['description'] ?? '')),
                        'url' => trim((string) ($item['url'] ?? '')),
                        'icon' => in_array(($item['icon'] ?? ''), ['external', 'scissors', 'sparkles'], true) ? (string) $item['icon'] : 'external',
                    ])
                    ->filter(fn (array $item): bool => $item['title'] !== '' || $item['url'] !== '')
                    ->values()
                    ->all(),
            ];
        } elseif ($section->section_key === 'before_after') {
            $contentJson = [
                'sectionTitle' => trim((string) ($validated['section_title'] ?? '')),
                'items' => collect($validated['items'] ?? [])
                    ->map(fn (array $item): array => [
                        'title' => trim((string) ($item['title'] ?? '')),
                        'description' => trim((string) ($item['detail'] ?? '')),
                    ])
                    ->filter(fn (array $item): bool => $item['title'] !== '' || $item['description'] !== '')
                    ->values()
                    ->all(),
            ];
        } elseif ($section->section_key === 'gallery_showcase') {
            $imageUrl = trim((string) ($validated['image_url'] ?? ''));
            $imagePath = (string) (($contentJson['imagePath'] ?? ''));

            if ($request->hasFile('image_file')) {
                $this->deletePhysicalFile($imagePath !== '' ? $imagePath : null);
                /** @var UploadedFile $imageFile */
                $imageFile = $request->file('image_file');
                $storedPath = $imageFile->store('landing/gallery', 'media_public');
                $imagePath = $storedPath;
                $imageUrl = '/storage/' . ltrim($storedPath, '/');
            }

            $contentJson = [
                'title' => trim((string) ($validated['section_title'] ?? '')),
                'description' => trim((string) ($validated['section_description'] ?? '')),
                'imageUrl' => $imageUrl,
                'imagePath' => $imagePath,
                'buttonLabel' => trim((string) ($validated['button_label'] ?? '')),
                'buttonUrl' => trim((string) ($validated['button_url'] ?? '')),
                'statsTitle' => trim((string) ($validated['stats_title'] ?? '')),
                'statsDescription' => trim((string) ($validated['stats_description'] ?? '')),
                'stats' => collect($validated['items'] ?? [])
                    ->map(fn (array $item): array => [
                        'label' => trim((string) ($item['label'] ?? '')),
                        'value' => trim((string) ($item['value'] ?? '')),
                    ])
                    ->filter(fn (array $item): bool => $item['label'] !== '' || $item['value'] !== '')
                    ->values()
                    ->all(),
            ];
        } elseif ($section->section_key === 'feature_grid') {
            $existingItems = collect((array) ($contentJson['items'] ?? []));
            $featureItems = collect($validated['items'] ?? [])
                ->values()
                ->map(function (array $item, int $index) use ($request, $existingItems): array {
                    $existingItem = (array) $existingItems->get($index, []);
                    $existingImageUrls = array_values(array_filter((array) ($existingItem['imageUrls'] ?? [])));
                    $imageUrls = [];

                    for ($slot = 1; $slot <= 5; $slot++) {
                        $uploadedFile = $request->file("items.$index.image_file_$slot");
                        if ($uploadedFile instanceof UploadedFile) {
                            $storedPath = $uploadedFile->store('landing/features', 'media_public');
                            $imageUrls[] = '/storage/' . ltrim($storedPath, '/');
                            continue;
                        }

                        $manualUrl = trim((string) ($item["image_$slot"] ?? ''));
                        if ($manualUrl !== '') {
                            $imageUrls[] = $manualUrl;
                            continue;
                        }

                        $existingUrl = trim((string) ($existingImageUrls[$slot - 1] ?? ''));
                        if ($existingUrl !== '') $imageUrls[] = $existingUrl;
                    }

                    return [
                        'title' => trim((string) ($item['title'] ?? '')),
                        'short' => trim((string) ($item['short'] ?? '')),
                        'detail' => trim((string) ($item['detail'] ?? '')),
                        'url' => trim((string) ($item['url'] ?? '')),
                        'isPrimary' => (bool) ($item['is_primary'] ?? false),
                        'imageUrls' => array_values(array_filter($imageUrls)),
                    ];
                })
                ->filter(fn (array $item): bool => $item['title'] !== '' || $item['short'] !== '' || $item['detail'] !== '')
                ->values();

            $primaryIndexes = $featureItems->keys()->filter(fn (int $index): bool => $featureItems[$index]['isPrimary'])->take(3)->values();
            if ($primaryIndexes->count() < 3) {
                $featureItems->keys()->reject(fn (int $index): bool => $primaryIndexes->contains($index))->take(3 - $primaryIndexes->count())->each(fn (int $index) => $primaryIndexes->push($index));
            }
            $featureItems = $featureItems->map(function (array $item, int $index) use ($primaryIndexes): array {
                $item['isPrimary'] = $primaryIndexes->contains($index);
                return $item;
            });

            $contentJson = [
                'title' => trim((string) ($validated['section_title'] ?? '')),
                'description' => trim((string) ($validated['section_description'] ?? '')),
                'viewAllLabel' => trim((string) ($validated['view_all_label'] ?? '')),
                'items' => $featureItems->all(),
            ];
        } elseif ($section->section_key === 'process_steps') {
            $contentJson = [
                'items' => collect($validated['items'] ?? [])
                    ->take(3)
                    ->map(fn (array $item): array => [
                        'title' => trim((string) ($item['title'] ?? '')),
                        'description' => trim((string) ($item['detail'] ?? '')),
                    ])
                    ->filter(fn (array $item): bool => $item['title'] !== '' || $item['description'] !== '')
                    ->values()
                    ->all(),
            ];
        } elseif ($section->section_key === 'plans') {
            $contentJson = [
                'title' => trim((string) ($validated['section_title'] ?? '')),
                'description' => trim((string) ($validated['section_description'] ?? '')),
                'fullPageButtonLabel' => trim((string) ($validated['full_page_button_label'] ?? '')),
                'cards' => collect($validated['cards'] ?? [])
                    ->take(3)
                    ->map(fn (array $card): array => [
                        'packageId' => isset($card['package_id']) && $card['package_id'] !== '' ? (string) $card['package_id'] : '',
                        'title' => trim((string) ($card['title'] ?? '')),
                        'description' => trim((string) ($card['description'] ?? '')),
                        'badgeText' => trim((string) ($card['badge_text'] ?? '')),
                        'buttonText' => trim((string) ($card['button_text'] ?? '')),
                        'buttonVariant' => trim((string) ($card['button_variant'] ?? 'default')) === 'outline' ? 'outline' : 'default',
                        'featured' => (bool) ($card['featured'] ?? false),
                        'showOnHome' => (bool) ($card['show_on_home'] ?? false),
                        'features' => array_values(array_filter([
                            trim((string) ($card['feature_1'] ?? '')),
                            trim((string) ($card['feature_2'] ?? '')),
                            trim((string) ($card['feature_3'] ?? '')),
                        ])),
                    ])
                    ->values()
                    ->all(),
            ];
            $recommendedFound = false;
            foreach ($contentJson['cards'] as &$card) {
                if (! $card['showOnHome']) {
                    $card['featured'] = false;
                    continue;
                }
                if ($card['featured'] && ! $recommendedFound) {
                    $recommendedFound = true;
                } elseif ($card['featured']) {
                    $card['featured'] = false;
                }
            }
            unset($card);
        } elseif ($section->section_key === 'faq') {
            $contentJson = [
                'title' => trim((string) ($validated['section_title'] ?? '')),
                'description' => trim((string) ($validated['section_description'] ?? '')),
                'items' => collect($validated['faq_items'] ?? [])
                    ->map(fn (array $item): array => [
                        'question' => trim((string) ($item['question'] ?? '')),
                        'answer' => trim((string) ($item['answer'] ?? '')),
                        'sortOrder' => (int) ($item['sort_order'] ?? 0),
                        'showOnHome' => (bool) ($item['show_on_home'] ?? false),
                    ])
                    ->filter(fn (array $item): bool => $item['question'] !== '' || $item['answer'] !== '')
                    ->sortBy('sortOrder')
                    ->values()
                    ->all(),
            ];
        } elseif ($section->section_key === 'footer_cta') {
            $contentJson = [
                'title' => trim((string) ($validated['section_title'] ?? '')),
                'buttonText' => trim((string) ($validated['button_label'] ?? '')),
                'buttonUrl' => trim((string) ($validated['button_url'] ?? '')),
                'copyrightText' => trim((string) ($validated['copyright_text'] ?? '')),
            ];
        }

        $section->update([
            'name' => trim((string) $validated['name']),
            'status' => $validated['status'],
            'sort_order' => (int) ($validated['sort_order'] ?? $section->sort_order ?? 0),
            'content_json' => $contentJson,
        ]);

        return redirect()
            ->route('admin.landing-sites.sections.index', $landingSite)
            ->with('success', 'اطلاعات سکشن به‌روزرسانی شد.');
    }

    public function updateOrder(Request $request, LandingSite $landingSite): RedirectResponse
    {
        $homePage = $this->resolveHomePage($landingSite);

        $validated = $request->validate([
            'sections' => ['required', 'array'],
            'sections.*.id' => ['required', 'integer'],
            'sections.*.name' => ['required', 'string', 'max:255'],
            'sections.*.status' => ['required', 'string', Rule::in(['active', 'inactive'])],
            'sections.*.sort_order' => ['required', 'integer', 'min:0'],
        ]);

        DB::transaction(function () use ($validated, $homePage): void {
            foreach ($validated['sections'] as $item) {
                $section = $homePage->sections()->findOrFail($item['id']);
                $section->update([
                    'name' => trim((string) $item['name']),
                    'status' => $item['status'],
                    'sort_order' => (int) $item['sort_order'],
                ]);
            }
        });

        return redirect()
            ->route('admin.landing-sites.sections.index', $landingSite)
            ->with('success', 'ترتیب، نام و وضعیت سکشن‌ها ذخیره شد.');
    }

    private function resolveHomePage(LandingSite $landingSite): LandingPage
    {
        return $landingSite->pages()->where('page_key', 'home')->firstOrFail();
    }

    private function seedDefaultSectionsIfMissing(LandingPage $homePage): void
    {
        if ($homePage->sections()->exists()) {
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

    private function deletePhysicalFile(?string $path): void
    {
        if (! $path) {
            return;
        }

        $fullPath = base_path('storage/app/public/' . ltrim($path, '/'));
        if (is_file($fullPath)) {
            @unlink($fullPath);
        }
    }
}
