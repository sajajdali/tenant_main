<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\ReferralLead;
use App\Http\Controllers\Controller;
use App\Services\ReferralService;
use App\Support\InputNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReferralController extends Controller
{
    public function __construct(private readonly ReferralService $service)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $actor = $this->abortUnlessTenantAdmin($request);
        $perPage = min(20, max(5, (int) $request->integer('per_page', 10)));

        $query = ReferralLead::query()
            ->where('referrer_tenant_id', tenant('id'))
            ->latest('id');

        $page = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => [
                    'total' => ReferralLead::query()->where('referrer_tenant_id', tenant('id'))->count(),
                    'pending' => ReferralLead::query()->where('referrer_tenant_id', tenant('id'))->where('status', 'pending')->count(),
                    'rewarded' => ReferralLead::query()->where('referrer_tenant_id', tenant('id'))->where('status', 'rewarded')->count(),
                    'rewardDays' => (int) ReferralLead::query()->where('referrer_tenant_id', tenant('id'))->sum('reward_duration_days'),
                ],
                'items' => collect($page->items())->map(fn (ReferralLead $lead) => $this->serializeLead($lead))->values(),
                'currentPage' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
                'actorName' => $actor->name,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $this->abortUnlessTenantAdmin($request);

        $validated = $request->validate([
            'mobile' => ['required', 'string'],
        ]);

        $lead = $this->service->createLead(tenant(), $actor, $validated['mobile']);

        return response()->json([
            'success' => true,
            'message' => __('tenant.referral.saved'),
            'data' => $this->serializeLead($lead),
        ], 201);
    }

    private function serializeLead(ReferralLead $lead): array
    {
        return [
            'id' => (string) $lead->id,
            'mobile' => InputNormalizer::mobile((string) $lead->referred_mobile) ?? $lead->referred_mobile,
            'status' => $lead->status,
            'rewardDurationDays' => $lead->reward_duration_days ? (int) $lead->reward_duration_days : null,
            'purchasedDurationDays' => $lead->purchased_duration_days ? (int) $lead->purchased_duration_days : null,
            'previousSupportEndsAt' => $lead->reward_previous_support_ends_at?->toDateString(),
            'newSupportEndsAt' => $lead->reward_new_support_ends_at?->toDateString(),
            'convertedAt' => $lead->converted_at?->toIso8601String(),
            'rewardedAt' => $lead->rewarded_at?->toIso8601String(),
            'createdAt' => $lead->created_at?->toIso8601String(),
        ];
    }

    private function abortUnlessTenantAdmin(Request $request)
    {
        $user = $request->user('tenant_web');
        abort_unless($user?->role === 'admin', 403, __('authorization.primary_admin_section'));

        return $user;
    }
}
