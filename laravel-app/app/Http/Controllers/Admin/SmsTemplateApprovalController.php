<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Http\Controllers\Controller;
use App\Services\TenantAdminNotificationService;
use App\Services\TenantAdminSmsNotificationService;
use App\Support\SmsTemplateRegistry;
use App\Support\StoreSmsTemplateRegistry;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SmsTemplateApprovalController extends Controller
{
    public function index(Request $request): View
    {
        $status = trim((string) $request->query('status', 'pending_review'));
        $query = trim((string) $request->query('q', ''));
        $items = [];

        $tenants = Tenant::query()
            ->with('domains')
            ->when($query !== '', function ($builder) use ($query) {
                $builder->where(function ($nested) use ($query) {
                    $nested
                        ->where('name', 'like', "%{$query}%")
                        ->orWhere('id', 'like', "%{$query}%")
                        ->orWhereHas('domains', fn ($domainQuery) => $domainQuery->where('domain', 'like', "%{$query}%"));
                });
            })
            ->latest()
            ->get();

        foreach ($tenants as $tenant) {
            $templates = $tenant->run(function (): array {
                $smsSetting = SmsSetting::query()->first();

                return SmsTemplateRegistry::normalizeCollection(
                    is_array($smsSetting?->templates['v2'] ?? null) ? $smsSetting->templates['v2'] : [],
                );
            });

            foreach ($templates as $template) {
                if ($status !== '' && $status !== 'all' && $template['approval_status'] !== $status) {
                    continue;
                }

                $items[] = [
                    'tenant' => $tenant,
                    'template' => $template,
                    'domain' => $tenant->domains->first()?->domain,
                    'source' => 'booking',
                ];
            }

            $storeTemplates = $tenant->run(function (): array {
                $general = GeneralSetting::query()->first();
                $rules = $general?->booking_rules ?? [];
                $storePage = is_array($rules['store_page'] ?? null) ? $rules['store_page'] : [];
                $storeSms = is_array($storePage['sms'] ?? null) ? $storePage['sms'] : [];

                return StoreSmsTemplateRegistry::normalizeCollection(
                    is_array($storeSms['templates_v2'] ?? null) ? $storeSms['templates_v2'] : [],
                );
            });

            foreach ($storeTemplates as $template) {
                if ($status !== '' && $status !== 'all' && $template['approval_status'] !== $status) {
                    continue;
                }

                $items[] = [
                    'tenant' => $tenant,
                    'template' => $template,
                    'domain' => $tenant->domains->first()?->domain,
                    'source' => 'store',
                ];
            }
        }

        return view('admin.sms-templates.index', [
            'items' => $items,
            'status' => $status,
            'query' => $query,
        ]);
    }

    public function update(Request $request, Tenant $tenant, string $templateKey, TenantAdminNotificationService $notifications, TenantAdminSmsNotificationService $smsNotifications): RedirectResponse
    {
        $validated = $request->validate([
            'action' => ['required', 'in:approve,reject'],
            'reason' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', 'string', 'max:50'],
            'q' => ['nullable', 'string', 'max:255'],
            'source' => ['nullable', 'in:booking,store'],
        ]);

        if ($validated['action'] === 'reject' && blank($validated['reason'] ?? '')) {
            return back()->withErrors(['reason' => 'برای رد کردن قالب، دلیل رد را وارد کنید.']);
        }

        $templateTitle = null;

        $tenant->run(function () use ($templateKey, $validated, &$templateTitle): void {
            if (($validated['source'] ?? 'booking') === 'store') {
                $general = GeneralSetting::query()->firstOrCreate([], [
                    'timezone' => 'Asia/Tehran',
                    'currency' => 'IRR',
                    'booking_rules' => [],
                ]);

                $rules = $general->booking_rules ?? [];
                $storePage = is_array($rules['store_page'] ?? null) ? $rules['store_page'] : [];
                $storeSms = is_array($storePage['sms'] ?? null) ? $storePage['sms'] : [];
                $templates = StoreSmsTemplateRegistry::normalizeCollection(
                    is_array($storeSms['templates_v2'] ?? null) ? $storeSms['templates_v2'] : [],
                );

                abort_unless(isset($templates[$templateKey]), 404);

                $templateTitle = (string) ($templates[$templateKey]['title'] ?? $templateKey);
                $templates[$templateKey] = $this->reviewTemplate($templates[$templateKey], $validated);
                $storeSms['templates_v2'] = $templates;
                $legacyMap = [
                    'afterOrder' => 'template_after_order',
                    'afterApproval' => 'template_after_approval',
                    'afterShippingCode' => 'template_after_shipping_code',
                    'afterRejection' => 'template_after_rejection',
                ];

                foreach ($legacyMap as $key => $legacyField) {
                    $storeSms[$legacyField] = (string) ($templates[$key]['body'] ?? '');
                }

                $storePage['sms'] = $storeSms;
                $rules['store_page'] = $storePage;
                $general->update(['booking_rules' => $rules]);

                return;
            }

            $smsSetting = SmsSetting::query()->firstOrCreate([], [
                'enabled' => false,
                'provider' => null,
                'credentials' => [],
                'templates' => [],
            ]);

            $templates = SmsTemplateRegistry::normalizeCollection(
                is_array($smsSetting->templates['v2'] ?? null) ? $smsSetting->templates['v2'] : [],
            );

            abort_unless(isset($templates[$templateKey]), 404);

            $templateTitle = (string) ($templates[$templateKey]['title'] ?? $templateKey);
            $templates[$templateKey] = $this->reviewTemplate($templates[$templateKey], $validated);

            $allTemplates = $smsSetting->templates ?? [];
            $allTemplates['v2'] = $templates;

            $smsSetting->update([
                'templates' => $allTemplates,
            ]);
        });

        $notifications->notify($tenant, $validated['action'] === 'approve' ? 'sms_template_approved' : 'sms_template_rejected', [
            'template_title' => $templateTitle ?: $templateKey,
            'reason' => trim((string) ($validated['reason'] ?? '')) ?: 'بدون توضیح',
            'sender_name' => $request->user()?->name ?: 'سامانه',
            'sender_central_user_id' => $request->user()?->id,
        ]);

        if ($validated['action'] === 'reject') {
            $smsNotifications->notify($tenant, 'sms_template_rejected', [
                'template_title' => $templateTitle ?: $templateKey,
                'reason' => trim((string) ($validated['reason'] ?? '')) ?: 'بدون توضیح',
            ]);
        }

        return redirect()
            ->route('admin.sms-templates.index', [
                'status' => $validated['status'] ?? 'pending_review',
                'q' => $validated['q'] ?? null,
            ])
            ->with('success', $validated['action'] === 'approve' ? 'قالب پیامک تایید شد.' : 'قالب پیامک رد شد.');
    }

    /**
     * @param  array<string, mixed>  $template
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function reviewTemplate(array $template, array $validated): array
    {
        if ($validated['action'] === 'approve') {
            return [
                ...$template,
                'approval_status' => 'approved',
                'approved_body' => $template['body'],
                'approved_enabled' => (bool) $template['enabled'],
                'rejection_reason' => null,
                'reviewed_at' => now()->toISOString(),
            ];
        }

        return [
            ...$template,
            'approval_status' => 'rejected',
            'rejection_reason' => trim((string) ($validated['reason'] ?? '')),
            'reviewed_at' => now()->toISOString(),
        ];
    }
}
