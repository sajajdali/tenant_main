<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Landing\Models\DomainTldPrice;
use App\Http\Controllers\Controller;
use App\Support\DomainTldCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class DomainTldPriceController extends Controller
{
    public function index(Request $request): View
    {
        abort_unless($request->user()?->role === 'admin', 403);

        DomainTldCatalog::ensureSeeded();

        return view('admin.domain-tld-prices.index', [
            'items' => DomainTldPrice::query()
                ->orderByRaw("CASE WHEN tld = '.ir' THEN 0 ELSE 1 END")
                ->orderBy('tld')
                ->get(),
        ]);
    }

    public function update(Request $request, DomainTldPrice $domainTldPrice): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:120'],
            'register_price_amount' => ['required', 'integer', 'min:0'],
            'renew_price_amount' => ['required', 'integer', 'min:0'],
            'transfer_price_amount' => ['required', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $meta = is_array($domainTldPrice->meta_json) ? $domainTldPrice->meta_json : [];
        $meta['label'] = trim((string) ($validated['label'] ?? '')) ?: $domainTldPrice->tld;

        $domainTldPrice->update([
            'register_price_amount' => (int) $validated['register_price_amount'],
            'renew_price_amount' => (int) $validated['renew_price_amount'],
            'transfer_price_amount' => (int) $validated['transfer_price_amount'],
            'is_active' => (bool) ($validated['is_active'] ?? false),
            'meta_json' => $meta,
        ]);

        return back()->with('success', 'قیمت این پسوند با موفقیت به‌روزرسانی شد.');
    }
}
