<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class TenantSeoController extends Controller
{
    public function robots(Request $request): Response
    {
        $lines = [
            'User-agent: *',
            'Allow: /',
            'Sitemap: ' . rtrim($request->getSchemeAndHttpHost(), '/') . '/sitemap.xml',
        ];

        return response(implode("\n", $lines) . "\n", 200, [
            'Content-Type' => 'text/plain; charset=UTF-8',
        ]);
    }

    public function sitemap(Request $request): Response
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];
        $about = $rules['about_page'] ?? [];
        $seo = $about['seo'] ?? [];
        $contact = $rules['contact_page'] ?? [];
        $baseUrl = rtrim($request->getSchemeAndHttpHost(), '/');

        $urls = [
            [
                'loc' => $baseUrl . '/',
                'priority' => '1.0',
            ],
        ];

        if (
            (bool) ($about['enabled'] ?? false)
            && (bool) ($seo['enabled'] ?? false)
            && ((bool) ($seo['indexable'] ?? true))
        ) {
            $urls[] = [
                'loc' => $baseUrl . '/about',
                'priority' => '0.8',
            ];
        }

        if ((bool) ($contact['enabled'] ?? false)) {
            $urls[] = [
                'loc' => $baseUrl . '/contact',
                'priority' => '0.7',
            ];
        }

        $xml = view('tenant.sitemap', [
            'urls' => $urls,
        ])->render();

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
        ]);
    }
}
