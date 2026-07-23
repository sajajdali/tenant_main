<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\OpenAiSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AiSettingsController extends Controller
{
    public function edit(): View
    {
        return view('admin.ai-settings.edit', [
            'aiSettings' => OpenAiSettings::public(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'enabled' => ['nullable', 'boolean'],
            'api_key' => ['nullable', 'string', 'max:500'],
            'model' => ['required', 'string', 'max:255'],
            'model_version' => ['nullable', 'string', 'max:255'],
            'base_url' => ['nullable', 'url', 'max:255'],
            'timeout_seconds' => ['nullable', 'integer', 'min:10', 'max:600'],
            'temperature' => ['nullable', 'numeric', 'min:0', 'max:2'],
            'proxy_enabled' => ['nullable', 'boolean'],
            'proxy_url' => ['nullable', 'string', 'max:255'],
            'system_prompt' => ['nullable', 'string', 'max:20000'],
            'model_display_names' => ['nullable', 'string', 'max:10000'],
            'nutrition_token_unit_price_toman' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'nutrition_initial_token_grant' => ['nullable', 'integer', 'min:0', 'max:100000000'],
        ]);

        $current = OpenAiSettings::get();

        OpenAiSettings::put(OpenAiSettings::persistable([
            'enabled' => (bool) ($validated['enabled'] ?? false),
            'api_key' => trim((string) ($validated['api_key'] ?? '')),
            'model' => $validated['model'],
            'model_version' => $validated['model_version'] ?? '',
            'base_url' => $validated['base_url'] ?? OpenAiSettings::defaults()['base_url'],
            'timeout_seconds' => (int) ($validated['timeout_seconds'] ?? OpenAiSettings::defaults()['timeout_seconds']),
            'temperature' => (float) ($validated['temperature'] ?? OpenAiSettings::defaults()['temperature']),
            'proxy_enabled' => (bool) ($validated['proxy_enabled'] ?? false),
            'proxy_url' => $validated['proxy_url'] ?? '',
            'system_prompt' => $validated['system_prompt'] ?? '',
            'model_display_names' => OpenAiSettings::parseModelDisplayNamesText($validated['model_display_names'] ?? ''),
            'nutrition_token_unit_price_toman' => (int) ($validated['nutrition_token_unit_price_toman'] ?? OpenAiSettings::defaults()['nutrition_token_unit_price_toman']),
            'nutrition_initial_token_grant' => (int) ($validated['nutrition_initial_token_grant'] ?? OpenAiSettings::defaults()['nutrition_initial_token_grant']),
        ], (string) ($current['api_key'] ?? '')));

        return redirect()
            ->route('admin.ai-settings.edit')
            ->with('success', 'تنظیمات AI ذخیره شد.');
    }
}
