<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\AudienceType;
use App\Http\Controllers\Controller;
use App\Models\HelpTopic;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class HelpTopicController extends Controller
{
    public function index(Request $request): View
    {
        $search = trim((string) $request->query('q', ''));

        return view('admin.help-topics.index', [
            'topics' => HelpTopic::query()
                ->with('audienceType:id,name,slug')
                ->when($search !== '', fn ($query) => $query->where(function ($query) use ($search): void {
                    $query
                        ->where('title', 'like', "%{$search}%")
                        ->orWhere('topic_key', 'like', "%{$search}%")
                        ->orWhere('module_key', 'like', "%{$search}%");
                }))
                ->orderBy('sort_order')
                ->orderBy('title')
                ->paginate(20)
                ->withQueryString(),
            'search' => $search,
        ]);
    }

    public function create(): View
    {
        return view('admin.help-topics.form', [
            'topic' => new HelpTopic([
                'is_active' => true,
                'show_in_help_center' => true,
                'show_in_page_header' => true,
                'sort_order' => 0,
            ]),
            'audiences' => $this->audienceOptions(),
            'isEdit' => false,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $payload = $this->validatePayload($request);

        DB::connection('central')->transaction(function () use ($payload): void {
            HelpTopic::query()->create($payload);
        });

        return redirect()->route('admin.help-topics.index')->with('success', 'آموزش با موفقیت ذخیره شد.');
    }

    public function edit(HelpTopic $helpTopic): View
    {
        return view('admin.help-topics.form', [
            'topic' => $helpTopic->load('audienceType:id,name,slug'),
            'audiences' => $this->audienceOptions(),
            'isEdit' => true,
        ]);
    }

    public function update(Request $request, HelpTopic $helpTopic): RedirectResponse
    {
        $payload = $this->validatePayload($request, $helpTopic);

        DB::connection('central')->transaction(function () use ($helpTopic, $payload): void {
            $helpTopic->update($payload);
        });

        return redirect()->route('admin.help-topics.index')->with('success', 'آموزش به‌روزرسانی شد.');
    }

    public function destroy(HelpTopic $helpTopic): RedirectResponse
    {
        DB::connection('central')->transaction(function () use ($helpTopic): void {
            $this->deleteStoredFile($helpTopic->video_path);
            $this->deleteStoredFile($helpTopic->cover_image_path);
            $helpTopic->delete();
        });

        return redirect()->route('admin.help-topics.index')->with('success', 'آموزش حذف شد.');
    }

    private function validatePayload(Request $request, ?HelpTopic $topic = null): array
    {
        $validated = $request->validate([
            'audience_type_id' => ['nullable', 'integer', 'exists:audience_types,id'],
            'module_key' => ['nullable', 'string', 'max:120'],
            'topic_key' => [
                'required',
                'string',
                'max:180',
                'regex:/^[A-Za-z0-9_\/:.-]+$/',
                Rule::unique('help_topics', 'topic_key')
                    ->where(fn ($query) => $query->where('audience_type_id', $request->input('audience_type_id') ?: null))
                    ->ignore($topic?->id),
            ],
            'title' => ['required', 'string', 'max:255'],
            'summary' => ['nullable', 'string', 'max:2000'],
            'body' => ['nullable', 'string'],
            'video_url' => ['nullable', 'url', 'max:1000'],
            'video_file' => ['nullable', 'file', 'mimetypes:video/mp4,video/webm,video/quicktime,video/x-m4v', 'max:512000'],
            'cover_image' => ['nullable', 'image', 'max:8192'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'show_in_help_center' => ['nullable', 'boolean'],
            'show_in_page_header' => ['nullable', 'boolean'],
        ]);

        $payload = [
            'audience_type_id' => filled($validated['audience_type_id'] ?? null) ? (int) $validated['audience_type_id'] : null,
            'module_key' => trim((string) ($validated['module_key'] ?? '')) ?: null,
            'topic_key' => trim((string) $validated['topic_key']),
            'title' => $validated['title'],
            'summary' => $validated['summary'] ?? null,
            'body' => $validated['body'] ?? null,
            'video_url' => trim((string) ($validated['video_url'] ?? '')) ?: null,
            'video_path' => $topic?->video_path,
            'cover_image_path' => $topic?->cover_image_path,
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? false),
            'show_in_help_center' => (bool) ($validated['show_in_help_center'] ?? false),
            'show_in_page_header' => (bool) ($validated['show_in_page_header'] ?? false),
            'meta_json' => [],
        ];

        if ($request->hasFile('video_file')) {
            $this->deleteStoredFile($topic?->video_path);
            $payload['video_path'] = $request->file('video_file')->store('help-topics/videos', 'public');
        }

        if ($request->hasFile('cover_image')) {
            $this->deleteStoredFile($topic?->cover_image_path);
            $payload['cover_image_path'] = $request->file('cover_image')->store('help-topics/covers', 'public');
        }

        return $payload;
    }

    private function audienceOptions()
    {
        return AudienceType::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'business_label']);
    }

    private function deleteStoredFile(?string $path): void
    {
        if (filled($path)) {
            Storage::disk('public')->delete($path);
        }
    }
}
