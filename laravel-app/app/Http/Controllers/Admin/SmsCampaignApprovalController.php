<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\SmsCampaign;
use App\Domain\Tenant\Models\Tenant;
use App\Http\Controllers\Controller;
use App\Jobs\PrepareSmsCampaignJob;
use App\Services\TenantAdminNotificationService;
use App\Services\TenantAdminSmsNotificationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SmsCampaignApprovalController extends Controller
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
            $campaigns = $tenant->run(function () use ($status): array {
                return SmsCampaign::query()
                    ->when($status !== '' && $status !== 'all', fn ($builder) => $builder->where('status', $status))
                    ->orderByDesc('created_at')
                    ->get()
                    ->map(fn (SmsCampaign $campaign): array => [
                        'id' => (string) $campaign->id,
                        'name' => $campaign->name,
                        'status' => $campaign->status,
                        'message' => $campaign->message,
                        'preset_key' => $campaign->preset_key,
                        'estimated_total_price' => (int) $campaign->estimated_total_price,
                        'recipients_count' => (int) $campaign->recipients_count,
                        'last_error' => $campaign->last_error,
                        'created_at' => $campaign->created_at?->toDateTimeString(),
                    ])
                    ->all();
            });

            foreach ($campaigns as $campaign) {
                $items[] = [
                    'tenant' => $tenant,
                    'campaign' => $campaign,
                    'domain' => $tenant->domains->first()?->domain,
                ];
            }
        }

        return view('admin.sms-campaigns.index', [
            'items' => $items,
            'status' => $status,
            'query' => $query,
        ]);
    }

    public function update(Request $request, Tenant $tenant, string $campaignId, TenantAdminNotificationService $notifications, TenantAdminSmsNotificationService $smsNotifications): RedirectResponse
    {
        $validated = $request->validate([
            'action' => ['required', 'in:approve,reject'],
            'reason' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', 'string', 'max:50'],
            'q' => ['nullable', 'string', 'max:255'],
        ]);

        if ($validated['action'] === 'reject' && blank($validated['reason'] ?? '')) {
            return back()->withErrors(['reason' => 'برای رد کردن کمپین، دلیل رد را وارد کنید.']);
        }

        $campaignName = null;

        $tenant->run(function () use ($campaignId, $validated, $tenant, &$campaignName): void {
            /** @var SmsCampaign $campaign */
            $campaign = SmsCampaign::query()->findOrFail((int) $campaignId);
            $campaignName = $campaign->name;

            if ($validated['action'] === 'approve') {
                $campaign->update([
                    'status' => 'queued',
                    'last_error' => null,
                ]);

                PrepareSmsCampaignJob::dispatch((string) $tenant->id, (int) $campaign->id);

                return;
            }

            $campaign->update([
                'status' => 'rejected',
                'last_error' => trim((string) ($validated['reason'] ?? '')),
            ]);
        });

        $notifications->notify($tenant, $validated['action'] === 'approve' ? 'sms_campaign_approved' : 'sms_campaign_rejected', [
            'campaign_name' => $campaignName ?: $campaignId,
            'reason' => trim((string) ($validated['reason'] ?? '')) ?: 'بدون توضیح',
            'sender_name' => $request->user()?->name ?: 'سامانه',
            'sender_central_user_id' => $request->user()?->id,
        ]);

        if ($validated['action'] === 'reject') {
            $smsNotifications->notify($tenant, 'sms_campaign_rejected', [
                'campaign_name' => $campaignName ?: $campaignId,
                'reason' => trim((string) ($validated['reason'] ?? '')) ?: 'بدون توضیح',
            ]);
        }

        return redirect()
            ->route('admin.sms-campaigns.index', [
                'status' => $validated['status'] ?? 'pending_review',
                'q' => $validated['q'] ?? null,
            ])
            ->with('success', $validated['action'] === 'approve' ? 'کمپین تایید شد و وارد صف ارسال شد.' : 'کمپین رد شد.');
    }
}
