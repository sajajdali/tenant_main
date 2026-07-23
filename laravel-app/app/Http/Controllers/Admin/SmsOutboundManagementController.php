<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\AudienceType;
use App\Domain\Tenant\Models\SmsOutbound;
use App\Domain\Tenant\Models\Tenant;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SmsOutboundManagementController extends Controller
{
    public function index(Request $request): View
    {
        $audienceTypeId = $request->filled('audience_type_id') ? (int) $request->query('audience_type_id') : null;
        $tenantId = $request->filled('tenant_id') ? (string) $request->query('tenant_id') : null;
        $query = trim((string) $request->query('q', ''));

        $audiences = AudienceType::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $tenants = Tenant::query()
            ->with(['domains', 'audienceType', 'owner'])
            ->when($audienceTypeId !== null, fn ($builder) => $builder->where('audience_type_id', $audienceTypeId))
            ->orderBy('name')
            ->get();

        $selectedTenant = $tenantId !== null
            ? $tenants->firstWhere('id', $tenantId) ?? Tenant::query()->with(['domains', 'audienceType', 'owner'])->find($tenantId)
            : null;

        $messages = null;

        if ($selectedTenant) {
            $messages = $selectedTenant->run(function () use ($query) {
                return SmsOutbound::query()
                    ->when($query !== '', function ($builder) use ($query): void {
                        $builder->where(function ($nested) use ($query): void {
                            $nested
                                ->where('recipient_mobile', 'like', "%{$query}%")
                                ->orWhere('message', 'like', "%{$query}%");
                        });
                    })
                    ->latest('id')
                    ->paginate(20)
                    ->through(fn (SmsOutbound $outbound): array => [
                        'id' => (string) $outbound->id,
                        'recipient_mobile' => (string) $outbound->recipient_mobile,
                        'message' => (string) $outbound->message,
                        'total_price' => (int) $outbound->total_price,
                        'sent_at' => $outbound->sent_at?->toDateTimeString(),
                        'created_at' => $outbound->created_at?->toDateTimeString(),
                    ]);
            });

            $messages->appends([
                'audience_type_id' => $audienceTypeId,
                'tenant_id' => $tenantId,
                'q' => $query,
            ]);
        }

        return view('admin.sms-outbounds.index', [
            'audiences' => $audiences,
            'tenants' => $tenants,
            'selectedAudienceTypeId' => $audienceTypeId,
            'selectedTenant' => $selectedTenant,
            'query' => $query,
            'messages' => $messages,
        ]);
    }
}
