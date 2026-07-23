<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\CustomerClubReward;
use App\Domain\Tenant\Models\CustomerClubTier;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\CustomerClubService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomerClubController extends Controller
{
    public function __construct(private readonly CustomerClubService $service)
    {
    }

    public function adminOverview(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        return response()->json([
            'success' => true,
            'data' => $this->service->adminOverview(),
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        $validated = $request->validate($this->settingsRules());

        return response()->json([
            'success' => true,
            'data' => $this->service->updateSettings($validated),
            'message' => 'تنظیمات باشگاه مشتریان ذخیره شد.',
        ]);
    }

    public function members(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $page = $this->service->listMembers(
            trim((string) ($validated['search'] ?? '')),
            (int) ($validated['per_page'] ?? 12),
        );

        return response()->json([
            'success' => true,
            'data' => [
                'items' => collect($page->items())->map(fn ($row) => [
                    'userId' => (string) $row->id,
                    'name' => $row->name,
                    'mobile' => $row->mobile,
                    'email' => $row->email,
                    'isVip' => (bool) $row->is_vip,
                    'pointsBalance' => (int) $row->points_balance,
                    'walletBalance' => (int) $row->wallet_balance,
                    'lifetimePointsEarned' => (int) $row->lifetime_points_earned,
                    'lifetimeWalletEarned' => (int) $row->lifetime_wallet_earned,
                    'joinedAt' => $row->joined_at,
                    'lastActivityAt' => $row->last_activity_at,
                    'registeredAt' => $row->registered_at,
                    'currentTier' => $row->tier_title ? [
                        'title' => $row->tier_title,
                        'badgeColor' => $row->tier_badge_color,
                    ] : null,
                ])->values(),
                'currentPage' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function adjustMember(Request $request, TenantUser $user): JsonResponse
    {
        $actor = $this->abortUnlessTenantAdmin($request);
        abort_if($user->role !== 'customer', 422, 'فقط مشتریان عادی می‌توانند عضو باشگاه مشتریان باشند.');

        $validated = $request->validate([
            'points_delta' => ['required', 'integer', 'min:-10000000', 'max:10000000'],
            'wallet_delta' => ['required', 'integer', 'min:-1000000000', 'max:1000000000'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->service->manualAdjust($actor, $user, $validated),
            'message' => 'تغییرات دستی برای مشتری ثبت شد.',
        ]);
    }

    public function storeTier(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);
        $validated = $request->validate($this->tierRules());

        return response()->json([
            'success' => true,
            'data' => $this->service->upsertTier(null, $validated),
            'message' => 'سطح جدید ذخیره شد.',
        ]);
    }

    public function updateTier(Request $request, CustomerClubTier $tier): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);
        $validated = $request->validate($this->tierRules($tier));

        return response()->json([
            'success' => true,
            'data' => $this->service->upsertTier($tier, $validated),
            'message' => 'سطح باشگاه مشتریان به‌روزرسانی شد.',
        ]);
    }

    public function destroyTier(Request $request, CustomerClubTier $tier): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);
        $this->service->deleteTier($tier);

        return response()->json([
            'success' => true,
            'data' => true,
            'message' => 'سطح باشگاه مشتریان حذف شد.',
        ]);
    }

    public function storeReward(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);
        $validated = $request->validate($this->rewardRules());

        return response()->json([
            'success' => true,
            'data' => $this->service->upsertReward(null, $validated),
            'message' => 'جایزه جدید ذخیره شد.',
        ]);
    }

    public function updateReward(Request $request, CustomerClubReward $reward): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);
        $validated = $request->validate($this->rewardRules($reward));

        return response()->json([
            'success' => true,
            'data' => $this->service->upsertReward($reward, $validated),
            'message' => 'جایزه باشگاه مشتریان به‌روزرسانی شد.',
        ]);
    }

    public function destroyReward(Request $request, CustomerClubReward $reward): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);
        $this->service->deleteReward($reward);

        return response()->json([
            'success' => true,
            'data' => true,
            'message' => 'جایزه باشگاه مشتریان حذف شد.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user('tenant_web');
        abort_unless($user, 401, 'برای مشاهده باشگاه مشتریان ابتدا وارد حساب شوید.');

        return response()->json([
            'success' => true,
            'data' => $this->service->mySummary($user),
        ]);
    }

    public function redeemReward(Request $request, CustomerClubReward $reward): JsonResponse
    {
        $user = $request->user('tenant_web');
        abort_unless($user, 401, 'برای دریافت جایزه ابتدا وارد حساب شوید.');

        return response()->json([
            'success' => true,
            'data' => $this->service->redeemReward($user, $reward),
            'message' => 'جایزه با موفقیت برای شما ثبت شد.',
        ]);
    }

    private function abortUnlessTenantAdmin(Request $request): TenantUser
    {
        $user = $request->user('tenant_web');
        abort_unless($user?->role === 'admin', 403, __('authorization.primary_system_admin_section'));

        return $user;
    }

    private function settingsRules(): array
    {
        return [
            'is_enabled' => ['required', 'boolean'],
            'points_enabled' => ['required', 'boolean'],
            'wallet_enabled' => ['required', 'boolean'],
            'tiers_enabled' => ['required', 'boolean'],
            'rewards_enabled' => ['required', 'boolean'],
            'auto_tier_upgrade_enabled' => ['required', 'boolean'],
            'appointment_points_enabled' => ['required', 'boolean'],
            'appointment_fixed_points' => ['required', 'integer', 'min:0', 'max:1000000'],
            'appointment_points_per_100k' => ['required', 'integer', 'min:0', 'max:100000'],
            'appointment_wallet_enabled' => ['required', 'boolean'],
            'appointment_fixed_wallet' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'store_points_enabled' => ['required', 'boolean'],
            'store_fixed_points' => ['required', 'integer', 'min:0', 'max:1000000'],
            'store_points_per_100k' => ['required', 'integer', 'min:0', 'max:100000'],
            'store_wallet_enabled' => ['required', 'boolean'],
            'store_wallet_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'welcome_bonus_enabled' => ['required', 'boolean'],
            'welcome_bonus_points' => ['required', 'integer', 'min:0', 'max:1000000'],
            'welcome_bonus_wallet' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'birthday_bonus_enabled' => ['required', 'boolean'],
            'birthday_bonus_points' => ['required', 'integer', 'min:0', 'max:1000000'],
            'birthday_bonus_wallet' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'manual_adjustments_enabled' => ['required', 'boolean'],
            'show_wallet_to_customer' => ['required', 'boolean'],
            'show_points_to_customer' => ['required', 'boolean'],
            'show_tier_to_customer' => ['required', 'boolean'],
            'nutrition_rewards_enabled' => ['required', 'boolean'],
            'nutrition_daily_food_log_enabled' => ['required', 'boolean'],
            'nutrition_daily_food_log_points' => ['required', 'integer', 'min:0', 'max:1000000'],
            'nutrition_per_meal_log_enabled' => ['required', 'boolean'],
            'nutrition_per_meal_log_points' => ['required', 'integer', 'min:0', 'max:1000000'],
            'nutrition_daily_water_log_enabled' => ['required', 'boolean'],
            'nutrition_daily_water_log_points' => ['required', 'integer', 'min:0', 'max:1000000'],
            'nutrition_weight_loss_reward_enabled' => ['required', 'boolean'],
            'nutrition_weight_loss_reward_points' => ['required', 'integer', 'min:0', 'max:1000000'],
            'nutrition_online_diet_request_reward_enabled' => ['required', 'boolean'],
            'nutrition_online_diet_request_reward_points' => ['required', 'integer', 'min:0', 'max:1000000'],
        ];
    }

    private function tierRules(?CustomerClubTier $tier = null): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'slug' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('customer_club_tiers', 'slug')->ignore($tier?->id),
            ],
            'badge_color' => ['nullable', 'string', 'max:30'],
            'icon' => ['nullable', 'string', 'max:30'],
            'minimum_points' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'minimum_wallet' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'is_active' => ['required', 'boolean'],
            'benefits' => ['nullable', 'array'],
            'benefits.*' => ['nullable', 'string', 'max:255'],
        ];
    }

    private function rewardRules(?CustomerClubReward $reward = null): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'slug' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('customer_club_rewards', 'slug')->ignore($reward?->id),
            ],
            'reward_type' => ['required', Rule::in(['wallet_credit', 'bonus_points', 'vip_access'])],
            'cost_points' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'wallet_amount' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            'bonus_points' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            'vip_days' => ['nullable', 'integer', 'min:0', 'max:3650'],
            'per_user_limit' => ['required', 'integer', 'min:1', 'max:10000'],
            'total_limit' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'is_active' => ['required', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'description' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
