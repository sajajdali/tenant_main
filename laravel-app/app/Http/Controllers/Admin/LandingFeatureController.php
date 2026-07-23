<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Landing\Models\LandingFeature;
use App\Domain\Landing\Models\LandingSite;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class LandingFeatureController extends Controller
{
    public function index(LandingSite $landingSite): View
    {
        return view('admin.landing-features.index', ['landingSite' => $landingSite, 'features' => $landingSite->features()->get()]);
    }

    public function create(LandingSite $landingSite): View
    {
        return view('admin.landing-features.form', ['landingSite' => $landingSite, 'feature' => new LandingFeature(['status' => 'active', 'sort_order' => ($landingSite->features()->max('sort_order') ?? 0) + 10])]);
    }

    public function store(Request $request, LandingSite $landingSite): RedirectResponse
    {
        $feature = new LandingFeature(['landing_site_id' => $landingSite->id]);
        $this->save($request, $landingSite, $feature);
        return redirect()->route('admin.landing-sites.features.index', $landingSite)->with('success', 'صفحه امکان ایجاد شد.');
    }

    public function edit(LandingSite $landingSite, LandingFeature $feature): View
    {
        $this->guard($landingSite, $feature);
        return view('admin.landing-features.form', compact('landingSite', 'feature'));
    }

    public function update(Request $request, LandingSite $landingSite, LandingFeature $feature): RedirectResponse
    {
        $this->guard($landingSite, $feature);
        $this->save($request, $landingSite, $feature);
        return redirect()->route('admin.landing-sites.features.index', $landingSite)->with('success', 'صفحه امکان ذخیره شد.');
    }

    public function destroy(LandingSite $landingSite, LandingFeature $feature): RedirectResponse
    {
        $this->guard($landingSite, $feature);
        $feature->delete();
        return back()->with('success', 'صفحه امکان حذف شد.');
    }

    private function save(Request $request, LandingSite $site, LandingFeature $feature): void
    {
        $data = $request->validate([
            'slug' => ['required', 'alpha_dash', 'max:120', Rule::unique('central.landing_features', 'slug')->where('landing_site_id', $site->id)->ignore($feature->id)],
            'title' => ['required', 'string', 'max:255'], 'badge_text' => ['nullable', 'string', 'max:255'],
            'short_description' => ['nullable', 'string', 'max:1000'], 'description' => ['nullable', 'string', 'max:10000'],
            'status' => ['required', Rule::in(['active', 'inactive'])], 'is_primary' => ['nullable', 'boolean'], 'sort_order' => ['required', 'integer', 'min:0'],
            'video_url' => ['nullable', 'string', 'max:2000'], 'video_file' => ['nullable', 'file', 'mimes:mp4,mov,webm,m4v,avi', 'max:102400'],
            'cover_url' => ['nullable', 'string', 'max:2000'], 'cover_file' => ['nullable', 'image', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'image_url' => ['nullable', 'string', 'max:2000'], 'image_file' => ['nullable', 'image', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'benefits' => ['nullable', 'array', 'max:20'], 'benefits.*' => ['nullable', 'string', 'max:1000'],
            'seo_title' => ['nullable', 'string', 'max:255'], 'seo_description' => ['nullable', 'string', 'max:1000'],
        ]);
        foreach ([['video_file','video','video_url','video_path'], ['cover_file','feature-covers','cover_url','cover_path'], ['image_file','feature-images','image_url','image_path']] as [$input,$folder,$urlKey,$pathKey]) {
            if (($file = $request->file($input)) instanceof UploadedFile) {
                $path = $file->store("landing/$folder", 'media_public');
                $data[$pathKey] = $path; $data[$urlKey] = '/storage/'.ltrim($path, '/');
            } else $data[$pathKey] = $feature->{$pathKey};
        }
        $data['landing_site_id'] = $site->id;
        $data['is_primary'] = (bool) ($data['is_primary'] ?? false);
        $data['benefits_json'] = array_values(array_filter(array_map(fn ($v) => trim((string) $v), $data['benefits'] ?? [])));
        $data['seo_json'] = ['title' => trim((string) ($data['seo_title'] ?? '')), 'description' => trim((string) ($data['seo_description'] ?? ''))];
        unset($data['video_file'], $data['cover_file'], $data['image_file'], $data['benefits'], $data['seo_title'], $data['seo_description']);
        $feature->fill($data)->save();
    }

    private function guard(LandingSite $site, LandingFeature $feature): void
    {
        abort_unless((int) $feature->landing_site_id === (int) $site->id, 404);
    }
}
