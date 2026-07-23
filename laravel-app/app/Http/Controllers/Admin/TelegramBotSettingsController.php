<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class TelegramBotSettingsController extends Controller
{
    public function edit(): View
    {
        $settings = SystemSetting::getValue('telegram_bot', []);

        return view('admin.telegram-bot-settings.edit', [
            'settings' => [
                'socks_enabled' => (bool) ($settings['socks_enabled'] ?? false),
                'socks_address' => (string) ($settings['socks_address'] ?? ''),
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'socks_enabled' => ['nullable', 'boolean'],
            'socks_address' => ['nullable', 'string', 'max:255', 'required_if:socks_enabled,1'],
        ], [
            'socks_address.required_if' => 'وقتی SOCKS فعال است، آدرس آن را وارد کنید.',
        ]);

        SystemSetting::putValue('telegram_bot', [
            'socks_enabled' => (bool) ($validated['socks_enabled'] ?? false),
            'socks_address' => trim((string) ($validated['socks_address'] ?? '')),
        ]);

        return redirect()
            ->route('admin.telegram-bot-settings.edit')
            ->with('success', 'تنظیمات ربات تلگرام ذخیره شد.');
    }
}
