<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Store\Models\StoreOrder;
use App\Domain\Tenant\Models\CustomerClubLedgerEntry;
use App\Domain\Tenant\Models\CustomerClubMemberAccount;
use App\Domain\Tenant\Models\CustomerClubReward;
use App\Domain\Tenant\Models\CustomerClubRewardRedemption;
use App\Domain\Tenant\Models\CustomerClubSetting;
use App\Domain\Tenant\Models\CustomerClubTier;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantFeatureModule;
use App\Domain\Tenant\Models\TenantUser;
use App\Domain\Tenant\Models\UserNotification;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomerClubService
{
    public const MODULE_SLUG = 'customer-club';

    public function __construct(
        private readonly UserNotificationRealtimeService $notificationRealtime,
    ) {
    }

    public function isActiveForTenant(?Tenant $tenant = null): bool
    {
        $resolvedTenant = $tenant ?? tenant();

        if (! $resolvedTenant instanceof Tenant) {
            return false;
        }

        return TenantFeatureModule::query()
            ->where('tenant_id', $resolvedTenant->id)
            ->where('status', 'active')
            ->where(function ($query): void {
                $query->whereNull('expires_at')
                    ->orWhereDate('expires_at', '>=', now()->toDateString());
            })
            ->whereHas('featureModule', fn ($query) => $query->where('slug', self::MODULE_SLUG))
            ->exists();
    }

    public function syncCurrentTenantState(?Tenant $tenant = null): bool
    {
        return $this->isActiveForTenant($tenant);
    }

    public function syncTenantState(Tenant $tenant): bool
    {
        return $this->isActiveForTenant($tenant);
    }

    public function publicStatusForTenant(?Tenant $tenant = null): array
    {
        $moduleActive = $this->isActiveForTenant($tenant);
        $settingsEnabled = (bool) (CustomerClubSetting::query()->value('is_enabled') ?? true);

        return [
            'moduleActive' => $moduleActive,
            'isEnabled' => $settingsEnabled,
            'isPublicActive' => $moduleActive && $settingsEnabled,
        ];
    }

    public function adminOverview(): array
    {
        $this->ensureBootstrapped();

        return [
            'moduleActive' => $this->isActiveForTenant(),
            'settings' => $this->serializeSettings($this->settingsModel()),
            'stats' => [
                'membersCount' => (int) CustomerClubMemberAccount::query()->count(),
                'pointsBalance' => (int) CustomerClubMemberAccount::query()->sum('points_balance'),
                'walletBalance' => (int) CustomerClubMemberAccount::query()->sum('wallet_balance'),
                'redemptionsCount' => (int) CustomerClubRewardRedemption::query()->count(),
                'ledgerEntriesCount' => (int) CustomerClubLedgerEntry::query()->count(),
            ],
            'tiers' => CustomerClubTier::query()
                ->orderBy('sort_order')
                ->orderBy('minimum_points')
                ->get()
                ->map(fn (CustomerClubTier $tier): array => $this->serializeTier($tier))
                ->values()
                ->all(),
            'rewards' => CustomerClubReward::query()
                ->orderBy('sort_order')
                ->orderBy('cost_points')
                ->get()
                ->map(fn (CustomerClubReward $reward): array => $this->serializeReward($reward))
                ->values()
                ->all(),
            'recentLedger' => CustomerClubLedgerEntry::query()
                ->with(['user:id,name,mobile'])
                ->latest('occurred_at')
                ->latest('id')
                ->limit(12)
                ->get()
                ->map(fn (CustomerClubLedgerEntry $entry): array => $this->serializeLedgerEntry($entry))
                ->values()
                ->all(),
        ];
    }

    public function updateSettings(array $validated): array
    {
        $this->ensureBootstrapped();

        $setting = $this->settingsModel();
        $setting->fill($validated);
        $setting->save();

        return $this->serializeSettings($setting->fresh());
    }

    public function listMembers(string $search = '', int $perPage = 15): LengthAwarePaginator
    {
        $this->ensureBootstrapped();

        return TenantUser::query()
            ->from('users as tenant_users')
            ->leftJoin('customer_club_member_accounts as accounts', 'accounts.user_id', '=', 'tenant_users.id')
            ->leftJoin('customer_club_tiers as tiers', 'tiers.id', '=', 'accounts.current_tier_id')
            ->where('tenant_users.role', 'customer')
            ->where('tenant_users.is_active', true)
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($inner) use ($search): void {
                    $inner->where('tenant_users.name', 'like', "%{$search}%")
                        ->orWhere('tenant_users.mobile', 'like', "%{$search}%");
                });
            })
            ->selectRaw('
                tenant_users.id,
                tenant_users.name,
                tenant_users.mobile,
                tenant_users.email,
                tenant_users.is_vip,
                tenant_users.created_at as registered_at,
                COALESCE(accounts.points_balance, 0) as points_balance,
                COALESCE(accounts.wallet_balance, 0) as wallet_balance,
                COALESCE(accounts.lifetime_points_earned, 0) as lifetime_points_earned,
                COALESCE(accounts.lifetime_wallet_earned, 0) as lifetime_wallet_earned,
                accounts.joined_at,
                accounts.last_activity_at,
                tiers.title as tier_title,
                tiers.badge_color as tier_badge_color
            ')
            ->orderByDesc('accounts.last_activity_at')
            ->orderByDesc('tenant_users.created_at')
            ->paginate($perPage);
    }

    public function mySummary(TenantUser $user): array
    {
        $this->ensureBootstrapped();

        $settings = $this->settingsModel();
        $moduleActive = $this->isActiveForTenant() && (bool) $settings->is_enabled;
        $account = $this->findMemberAccount($user);

        return [
            'moduleActive' => $moduleActive,
            'settings' => [
                'showWalletToCustomer' => (bool) $settings->show_wallet_to_customer,
                'showPointsToCustomer' => (bool) $settings->show_points_to_customer,
                'showTierToCustomer' => (bool) $settings->show_tier_to_customer,
                'rewardsEnabled' => (bool) $settings->rewards_enabled,
            ],
            'account' => $this->serializeMemberAccount($account, $user),
            'rewards' => $moduleActive
                ? CustomerClubReward::query()
                    ->where('is_active', true)
                    ->where(function ($query): void {
                        $query->whereNull('starts_at')
                            ->orWhere('starts_at', '<=', now());
                    })
                    ->where(function ($query): void {
                        $query->whereNull('ends_at')
                            ->orWhere('ends_at', '>=', now());
                    })
                    ->orderBy('sort_order')
                    ->orderBy('cost_points')
                    ->get()
                    ->map(fn (CustomerClubReward $reward): array => $this->serializeReward($reward, $account))
                    ->values()
                    ->all()
                : [],
            'recentLedger' => $account
                ? $account->ledgerEntries()
                    ->latest('occurred_at')
                    ->latest('id')
                    ->limit(10)
                    ->get()
                    ->map(fn (CustomerClubLedgerEntry $entry): array => $this->serializeLedgerEntry($entry))
                    ->values()
                    ->all()
                : [],
            'recentRedemptions' => $account
                ? $account->redemptions()
                    ->with('reward:id,title,reward_type')
                    ->latest('redeemed_at')
                    ->latest('id')
                    ->limit(10)
                    ->get()
                    ->map(fn (CustomerClubRewardRedemption $redemption): array => $this->serializeRedemption($redemption))
                    ->values()
                    ->all()
                : [],
        ];
    }

    public function upsertTier(?CustomerClubTier $tier, array $validated): array
    {
        $this->ensureBootstrapped();

        $record = $tier ?? new CustomerClubTier();
        $record->fill([
            'title' => $validated['title'],
            'slug' => $this->makeUniqueSlug($validated['slug'] ?? null, $validated['title'], CustomerClubTier::class, $tier?->id),
            'badge_color' => $validated['badge_color'] ?? 'slate',
            'icon' => $validated['icon'] ?? null,
            'minimum_points' => (int) ($validated['minimum_points'] ?? 0),
            'minimum_wallet' => (int) ($validated['minimum_wallet'] ?? 0),
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'benefits' => collect($validated['benefits'] ?? [])
                ->map(fn ($item) => trim((string) $item))
                ->filter()
                ->values()
                ->all(),
            'metadata' => is_array($validated['metadata'] ?? null) ? $validated['metadata'] : null,
        ]);
        $record->save();

        $this->recalculateAllTiers();

        return $this->serializeTier($record->fresh());
    }

    public function deleteTier(CustomerClubTier $tier): void
    {
        $tier->delete();
        $this->recalculateAllTiers();
    }

    public function upsertReward(?CustomerClubReward $reward, array $validated): array
    {
        $this->ensureBootstrapped();

        $record = $reward ?? new CustomerClubReward();
        $record->fill([
            'title' => $validated['title'],
            'slug' => $this->makeUniqueSlug($validated['slug'] ?? null, $validated['title'], CustomerClubReward::class, $reward?->id),
            'reward_type' => $validated['reward_type'],
            'cost_points' => (int) ($validated['cost_points'] ?? 0),
            'wallet_amount' => (int) ($validated['wallet_amount'] ?? 0),
            'bonus_points' => (int) ($validated['bonus_points'] ?? 0),
            'vip_days' => (int) ($validated['vip_days'] ?? 0),
            'per_user_limit' => (int) ($validated['per_user_limit'] ?? 1),
            'total_limit' => $validated['total_limit'] !== null ? (int) $validated['total_limit'] : null,
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'starts_at' => $validated['starts_at'] ?? null,
            'ends_at' => $validated['ends_at'] ?? null,
            'description' => $validated['description'] ?? null,
            'metadata' => is_array($validated['metadata'] ?? null) ? $validated['metadata'] : null,
        ]);
        $record->save();

        return $this->serializeReward($record->fresh());
    }

    public function deleteReward(CustomerClubReward $reward): void
    {
        $reward->delete();
    }

    public function manualAdjust(TenantUser $actor, TenantUser $target, array $validated): array
    {
        $this->ensureBootstrapped();
        $settings = $this->settingsModel();

        if (! $settings->manual_adjustments_enabled) {
            throw ValidationException::withMessages([
                'adjustment' => __('tenant.customer_club.validation.manual_adjustments_disabled'),
            ]);
        }

        /** @var CustomerClubMemberAccount $account */
        $account = DB::transaction(function () use ($actor, $target, $validated): CustomerClubMemberAccount {
            $account = $this->ensureMemberAccount($target, true);
            $account = CustomerClubMemberAccount::query()->lockForUpdate()->findOrFail($account->id);

            $pointsDelta = (int) $validated['points_delta'];
            $walletDelta = (int) $validated['wallet_delta'];
            $nextPoints = (int) $account->points_balance + $pointsDelta;
            $nextWallet = (int) $account->wallet_balance + $walletDelta;

            if ($nextPoints < 0) {
                throw ValidationException::withMessages([
                    'points_delta' => __('tenant.customer_club.validation.points_overdrawn'),
                ]);
            }

            if ($nextWallet < 0) {
                throw ValidationException::withMessages([
                    'wallet_delta' => __('tenant.customer_club.validation.wallet_overdrawn'),
                ]);
            }

            $account->points_balance = $nextPoints;
            $account->wallet_balance = $nextWallet;
            $account->lifetime_points_earned += max(0, $pointsDelta);
            $account->lifetime_points_spent += max(0, -1 * $pointsDelta);
            $account->lifetime_wallet_earned += max(0, $walletDelta);
            $account->lifetime_wallet_spent += max(0, -1 * $walletDelta);
            $account->last_activity_at = now();
            $account->save();

            CustomerClubLedgerEntry::query()->create([
                'member_account_id' => $account->id,
                'user_id' => $target->id,
                'entry_type' => 'manual_adjustment',
                'source_type' => 'admin_user',
                'source_id' => (string) $actor->id,
                'points_delta' => $pointsDelta,
                'wallet_delta' => $walletDelta,
                'points_balance_after' => $account->points_balance,
                'wallet_balance_after' => $account->wallet_balance,
                'title' => trim((string) $validated['title']),
                'description' => $validated['description'] ?? null,
                'meta_json' => [
                    'actor_name' => $actor->name,
                    'actor_mobile' => $actor->mobile,
                ],
                'occurred_at' => now(),
            ]);

            return $account;
        });

        $this->refreshTier($account);

        return $this->serializeMemberAccount($account->fresh(['currentTier', 'user']), $target->fresh());
    }

    public function redeemReward(TenantUser $user, CustomerClubReward $reward): array
    {
        $this->ensureBootstrapped();

        if (! $this->isActiveForTenant()) {
            throw ValidationException::withMessages([
                'reward' => __('tenant.customer_club.validation.inactive'),
            ]);
        }

        if (! $reward->is_active) {
            throw ValidationException::withMessages([
                'reward' => __('tenant.customer_club.validation.reward_inactive'),
            ]);
        }

        if ($reward->starts_at && $reward->starts_at->isFuture()) {
            throw ValidationException::withMessages([
                'reward' => __('tenant.customer_club.validation.reward_not_started'),
            ]);
        }

        if ($reward->ends_at && $reward->ends_at->isPast()) {
            throw ValidationException::withMessages([
                'reward' => __('tenant.customer_club.validation.reward_expired'),
            ]);
        }

        /** @var array{account: CustomerClubMemberAccount, redemption: CustomerClubRewardRedemption} $result */
        $result = DB::transaction(function () use ($user, $reward): array {
            $account = $this->ensureMemberAccount($user, true);
            $account = CustomerClubMemberAccount::query()->lockForUpdate()->findOrFail($account->id);
            $reward = CustomerClubReward::query()->lockForUpdate()->findOrFail($reward->id);

            if ((int) $account->points_balance < (int) $reward->cost_points) {
                throw ValidationException::withMessages([
                    'reward' => __('tenant.customer_club.validation.insufficient_points'),
                ]);
            }

            $redemptionsQuery = CustomerClubRewardRedemption::query()
                ->where('reward_id', $reward->id);

            if ($reward->total_limit !== null && $redemptionsQuery->count() >= (int) $reward->total_limit) {
                throw ValidationException::withMessages([
                    'reward' => __('tenant.customer_club.validation.reward_capacity_reached'),
                ]);
            }

            $userRedemptions = (clone $redemptionsQuery)->where('user_id', $user->id)->count();
            if ($userRedemptions >= (int) $reward->per_user_limit) {
                throw ValidationException::withMessages([
                    'reward' => __('tenant.customer_club.validation.reward_user_limit_reached'),
                ]);
            }

            if ($reward->reward_type === 'vip_access' && (bool) $user->is_vip) {
                throw ValidationException::withMessages([
                    'reward' => __('tenant.customer_club.validation.already_vip'),
                ]);
            }

            if ($reward->reward_type === 'vip_access' && ! app(VipFeatureService::class)->syncCurrentTenantState(tenant())) {
                throw ValidationException::withMessages([
                    'reward' => __('tenant.customer_club.validation.vip_module_required'),
                ]);
            }

            $account->points_balance = max(0, (int) $account->points_balance - (int) $reward->cost_points);
            $account->lifetime_points_spent += (int) $reward->cost_points;
            $account->last_activity_at = now();
            $account->save();

            CustomerClubLedgerEntry::query()->create([
                'member_account_id' => $account->id,
                'user_id' => $user->id,
                'entry_type' => 'reward_redeem',
                'source_type' => 'reward',
                'source_id' => (string) $reward->id,
                'points_delta' => -1 * (int) $reward->cost_points,
                'wallet_delta' => 0,
                'points_balance_after' => (int) $account->points_balance,
                'wallet_balance_after' => (int) $account->wallet_balance,
                'title' => __('tenant.customer_club.ledger.reward_redeem', ['reward' => $reward->title]),
                'description' => $reward->description,
                'occurred_at' => now(),
            ]);

            $issuedCode = null;

            if ($reward->reward_type === 'wallet_credit' && (int) $reward->wallet_amount > 0) {
                $account->wallet_balance += (int) $reward->wallet_amount;
                $account->lifetime_wallet_earned += (int) $reward->wallet_amount;
                $account->save();

                CustomerClubLedgerEntry::query()->create([
                    'member_account_id' => $account->id,
                    'user_id' => $user->id,
                    'entry_type' => 'reward_wallet_credit',
                    'source_type' => 'reward',
                    'source_id' => (string) $reward->id,
                    'points_delta' => 0,
                    'wallet_delta' => (int) $reward->wallet_amount,
                    'points_balance_after' => (int) $account->points_balance,
                    'wallet_balance_after' => (int) $account->wallet_balance,
                    'title' => __('tenant.customer_club.ledger.reward_wallet_credit', ['reward' => $reward->title]),
                    'description' => $reward->description,
                    'occurred_at' => now(),
                ]);

                $this->createEarningNotification(
                    $user,
                    0,
                    (int) $reward->wallet_amount,
                    __('tenant.customer_club.ledger.reward_wallet_credit', ['reward' => $reward->title]),
                    $reward->description,
                );
            }

            if ($reward->reward_type === 'bonus_points' && (int) $reward->bonus_points > 0) {
                $account->points_balance += (int) $reward->bonus_points;
                $account->lifetime_points_earned += (int) $reward->bonus_points;
                $account->save();

                CustomerClubLedgerEntry::query()->create([
                    'member_account_id' => $account->id,
                    'user_id' => $user->id,
                    'entry_type' => 'reward_bonus_points',
                    'source_type' => 'reward',
                    'source_id' => (string) $reward->id,
                    'points_delta' => (int) $reward->bonus_points,
                    'wallet_delta' => 0,
                    'points_balance_after' => (int) $account->points_balance,
                    'wallet_balance_after' => (int) $account->wallet_balance,
                    'title' => __('tenant.customer_club.ledger.reward_bonus_points', ['reward' => $reward->title]),
                    'description' => $reward->description,
                    'occurred_at' => now(),
                ]);

                $this->createEarningNotification(
                    $user,
                    (int) $reward->bonus_points,
                    0,
                    __('tenant.customer_club.ledger.reward_bonus_points', ['reward' => $reward->title]),
                    $reward->description,
                );
            }

            if ($reward->reward_type === 'vip_access') {
                $user->forceFill(['is_vip' => true])->save();
                $issuedCode = 'VIP-'.Str::upper(Str::random(8));
            }

            $redemption = CustomerClubRewardRedemption::query()->create([
                'member_account_id' => $account->id,
                'user_id' => $user->id,
                'reward_id' => $reward->id,
                'status' => 'redeemed',
                'cost_points' => (int) $reward->cost_points,
                'wallet_amount' => (int) $reward->wallet_amount,
                'issued_code' => $issuedCode,
                'redeemed_at' => now(),
                'expires_at' => $reward->reward_type === 'vip_access' && (int) $reward->vip_days > 0
                    ? now()->addDays((int) $reward->vip_days)
                    : null,
                'redeemed_by_user_id' => $user->id,
                'meta_json' => [
                    'reward_type' => $reward->reward_type,
                ],
            ]);

            return [
                'account' => $account,
                'redemption' => $redemption,
            ];
        });

        $this->refreshTier($result['account']);

        return [
            'account' => $this->serializeMemberAccount($result['account']->fresh(['currentTier', 'user']), $user->fresh()),
            'redemption' => $this->serializeRedemption($result['redemption']->fresh('reward')),
        ];
    }

    public function applyWelcomeBonus(TenantUser $user): void
    {
        if ($user->role !== 'customer' || ! $this->isActiveForTenant()) {
            return;
        }

        $this->ensureBootstrapped();
        $settings = $this->settingsModel();

        if (! $settings->welcome_bonus_enabled) {
            return;
        }

        $hasExisting = CustomerClubLedgerEntry::query()
            ->where('entry_type', 'welcome_bonus')
            ->where('source_type', 'user')
            ->where('source_id', (string) $user->id)
            ->exists();

        if ($hasExisting) {
            return;
        }

        $this->applyBalanceDelta(
            $user,
            'welcome_bonus',
            'user',
            (string) $user->id,
            (int) $settings->welcome_bonus_points,
            (int) $settings->welcome_bonus_wallet,
            __('tenant.customer_club.ledger.welcome_bonus'),
            __('tenant.customer_club.ledger.welcome_bonus_description'),
        );

        $this->applyBirthdayBonus($user);
    }

    public function applyBirthdayBonus(TenantUser $user): void
    {
        if ($user->role !== 'customer' || ! $this->isActiveForTenant() || ! $user->birth_date) {
            return;
        }

        $this->ensureBootstrapped();
        $settings = $this->settingsModel();

        if (! $settings->birthday_bonus_enabled) {
            return;
        }

        $today = now();

        if ($user->birth_date->format('m-d') !== $today->format('m-d')) {
            return;
        }

        $sourceId = $user->id.'-'.$today->format('Y');
        $hasExisting = CustomerClubLedgerEntry::query()
            ->where('entry_type', 'birthday_bonus')
            ->where('source_type', 'user')
            ->where('source_id', $sourceId)
            ->exists();

        if ($hasExisting) {
            return;
        }

        $this->applyBalanceDelta(
            $user,
            'birthday_bonus',
            'user',
            $sourceId,
            (int) $settings->birthday_bonus_points,
            (int) $settings->birthday_bonus_wallet,
            __('tenant.customer_club.ledger.birthday_bonus'),
            __('tenant.customer_club.ledger.birthday_bonus_description'),
        );
    }

    public function awardAppointment(Appointment $appointment): void
    {
        if (! $this->isActiveForTenant()) {
            return;
        }

        $this->ensureBootstrapped();
        $settings = $this->settingsModel();

        if (! $settings->appointment_points_enabled && ! $settings->appointment_wallet_enabled) {
            return;
        }

        $targetUser = $this->resolveAppointmentUser($appointment);
        if (! $targetUser || $targetUser->role !== 'customer') {
            return;
        }

        $amount = (int) $appointment->price_amount;
        $points = 0;
        $wallet = 0;

        if ($settings->appointment_points_enabled) {
            $points += (int) $settings->appointment_fixed_points;
            if ((int) $settings->appointment_points_per_100k > 0) {
                $points += (int) floor($amount / 100000) * (int) $settings->appointment_points_per_100k;
            }
        }

        if ($settings->appointment_wallet_enabled) {
            $wallet += (int) $settings->appointment_fixed_wallet;
        }

        if ($points === 0 && $wallet === 0) {
            return;
        }

        $this->applyBalanceDelta(
            $targetUser,
            'appointment_earn',
            'appointment',
            (string) $appointment->id,
            $points,
            $wallet,
            __('tenant.customer_club.ledger.appointment_earn'),
            __('tenant.customer_club.ledger.appointment_earn_description'),
        );
    }

    public function reverseAppointmentAward(Appointment $appointment, ?string $reason = null): void
    {
        $ledger = CustomerClubLedgerEntry::query()
            ->where('entry_type', 'appointment_earn')
            ->where('source_type', 'appointment')
            ->where('source_id', (string) $appointment->id)
            ->first();

        if (! $ledger) {
            return;
        }

        $alreadyReversed = CustomerClubLedgerEntry::query()
            ->where('entry_type', 'appointment_earn_reversal')
            ->where('source_type', 'appointment')
            ->where('source_id', (string) $appointment->id)
            ->exists();

        if ($alreadyReversed) {
            return;
        }

        $targetUser = $this->resolveAppointmentUser($appointment);
        if (! $targetUser || $targetUser->role !== 'customer') {
            return;
        }

        DB::transaction(function () use ($targetUser, $appointment, $ledger, $reason): void {
            $account = $this->ensureMemberAccount($targetUser, true);
            $account = CustomerClubMemberAccount::query()->lockForUpdate()->findOrFail($account->id);

            $pointsToRevoke = max(0, (int) $ledger->points_delta);
            $walletToRevoke = max(0, (int) $ledger->wallet_delta);

            $account->points_balance -= $pointsToRevoke;
            $account->wallet_balance -= $walletToRevoke;
            $account->lifetime_points_earned = max(0, (int) $account->lifetime_points_earned - $pointsToRevoke);
            $account->lifetime_wallet_earned = max(0, (int) $account->lifetime_wallet_earned - $walletToRevoke);
            $account->last_activity_at = now();
            $account->save();

            CustomerClubLedgerEntry::query()->create([
                'member_account_id' => $account->id,
                'user_id' => $targetUser->id,
                'entry_type' => 'appointment_earn_reversal',
                'source_type' => 'appointment',
                'source_id' => (string) $appointment->id,
                'points_delta' => -1 * $pointsToRevoke,
                'wallet_delta' => -1 * $walletToRevoke,
                'points_balance_after' => (int) $account->points_balance,
                'wallet_balance_after' => (int) $account->wallet_balance,
                'title' => __('tenant.customer_club.ledger.appointment_reversal'),
                'description' => $reason ?: __('tenant.customer_club.ledger.appointment_reversal_description'),
                'meta_json' => [
                    'reversed_from_entry_id' => $ledger->id,
                ],
                'occurred_at' => now(),
            ]);

            $this->refreshTier($account);
        });
    }

    public function reinstateAppointmentAward(Appointment $appointment, ?string $reason = null): void
    {
        $earnLedger = CustomerClubLedgerEntry::query()
            ->where('entry_type', 'appointment_earn')
            ->where('source_type', 'appointment')
            ->where('source_id', (string) $appointment->id)
            ->first();

        $reversalLedger = CustomerClubLedgerEntry::query()
            ->where('entry_type', 'appointment_earn_reversal')
            ->where('source_type', 'appointment')
            ->where('source_id', (string) $appointment->id)
            ->latest('id')
            ->first();

        if (! $earnLedger || ! $reversalLedger) {
            return;
        }

        $alreadyRestored = CustomerClubLedgerEntry::query()
            ->where('entry_type', 'appointment_earn_restored')
            ->where('source_type', 'appointment')
            ->where('source_id', (string) $appointment->id)
            ->exists();

        if ($alreadyRestored) {
            return;
        }

        $targetUser = $this->resolveAppointmentUser($appointment);
        if (! $targetUser || $targetUser->role !== 'customer') {
            return;
        }

        DB::transaction(function () use ($targetUser, $appointment, $earnLedger, $reversalLedger, $reason): void {
            $account = $this->ensureMemberAccount($targetUser, true);
            $account = CustomerClubMemberAccount::query()->lockForUpdate()->findOrFail($account->id);

            $pointsToRestore = max(0, (int) $earnLedger->points_delta);
            $walletToRestore = max(0, (int) $earnLedger->wallet_delta);

            $account->points_balance += $pointsToRestore;
            $account->wallet_balance += $walletToRestore;
            $account->lifetime_points_earned += $pointsToRestore;
            $account->lifetime_wallet_earned += $walletToRestore;
            $account->last_activity_at = now();
            $account->save();

            CustomerClubLedgerEntry::query()->create([
                'member_account_id' => $account->id,
                'user_id' => $targetUser->id,
                'entry_type' => 'appointment_earn_restored',
                'source_type' => 'appointment',
                'source_id' => (string) $appointment->id,
                'points_delta' => $pointsToRestore,
                'wallet_delta' => $walletToRestore,
                'points_balance_after' => (int) $account->points_balance,
                'wallet_balance_after' => (int) $account->wallet_balance,
                'title' => __('tenant.customer_club.ledger.appointment_restored'),
                'description' => $reason ?: __('tenant.customer_club.ledger.appointment_restored_description'),
                'meta_json' => [
                    'restored_from_entry_id' => $reversalLedger->id,
                ],
                'occurred_at' => now(),
            ]);

            $this->createEarningNotification(
                $targetUser,
                $pointsToRestore,
                $walletToRestore,
                __('tenant.customer_club.ledger.appointment_benefits_restored'),
                $reason ?: __('tenant.customer_club.ledger.appointment_benefits_restored_description'),
            );

            $this->refreshTier($account);
        });
    }

    public function awardStoreOrder(StoreOrder $order): void
    {
        if (! $this->isActiveForTenant()) {
            return;
        }

        $this->ensureBootstrapped();
        $settings = $this->settingsModel();

        if (! $settings->store_points_enabled && ! $settings->store_wallet_enabled) {
            return;
        }

        $targetUser = $this->resolveStoreOrderUser($order);
        if (! $targetUser || $targetUser->role !== 'customer') {
            return;
        }

        $amount = (int) $order->total_amount;
        $points = 0;
        $wallet = 0;

        if ($settings->store_points_enabled) {
            $points += (int) $settings->store_fixed_points;
            if ((int) $settings->store_points_per_100k > 0) {
                $points += (int) floor($amount / 100000) * (int) $settings->store_points_per_100k;
            }
        }

        if ($settings->store_wallet_enabled && (int) $settings->store_wallet_percent > 0) {
            $wallet += (int) floor($amount * ((int) $settings->store_wallet_percent / 100));
        }

        if ($points === 0 && $wallet === 0) {
            return;
        }

        $this->applyBalanceDelta(
            $targetUser,
            'store_order_earn',
            'store_order',
            (string) $order->id,
            $points,
            $wallet,
            __('tenant.customer_club.ledger.store_order_earn'),
            __('tenant.customer_club.ledger.store_order_earn_description'),
        );
    }

    public function awardCustomEarning(
        TenantUser $user,
        string $entryType,
        string $sourceType,
        string $sourceId,
        int $pointsDelta,
        int $walletDelta,
        string $title,
        ?string $description = null,
    ): void {
        if ($user->role !== 'customer' || ! $this->isActiveForTenant()) {
            return;
        }

        $this->ensureBootstrapped();
        $this->applyBalanceDelta($user, $entryType, $sourceType, $sourceId, $pointsDelta, $walletDelta, $title, $description);
    }

    public function availableWalletBalance(TenantUser $user): int
    {
        if ($user->role !== 'customer' || ! $this->isActiveForTenant()) {
            return 0;
        }

        $this->ensureBootstrapped();
        $settings = $this->settingsModel();

        if (! $settings->wallet_enabled) {
            return 0;
        }

        return (int) ($this->findMemberAccount($user)?->wallet_balance ?? 0);
    }

    public function reserveWalletForAppointmentPayment(TenantUser $user, int $requestedAmount, string $paymentId): int
    {
        if ($requestedAmount <= 0 || $user->role !== 'customer' || ! $this->isActiveForTenant()) {
            return 0;
        }

        $this->ensureBootstrapped();
        $settings = $this->settingsModel();

        if (! $settings->wallet_enabled) {
            return 0;
        }

        $existingReservation = $this->reservedWalletAmountForPayment($paymentId);
        if ($existingReservation > 0) {
            return $existingReservation;
        }

        $account = $this->ensureMemberAccount($user, true);
        $account = CustomerClubMemberAccount::query()->lockForUpdate()->findOrFail($account->id);

        $reserveAmount = min((int) $account->wallet_balance, $requestedAmount);

        if ($reserveAmount <= 0) {
            return 0;
        }

        $account->wallet_balance -= $reserveAmount;
        $account->lifetime_wallet_spent += $reserveAmount;
        $account->last_activity_at = now();
        $account->save();

        CustomerClubLedgerEntry::query()->create([
            'member_account_id' => $account->id,
            'user_id' => $user->id,
            'entry_type' => 'appointment_payment_wallet_reserved',
            'source_type' => 'appointment_payment',
            'source_id' => $paymentId,
            'points_delta' => 0,
            'wallet_delta' => -1 * $reserveAmount,
            'points_balance_after' => (int) $account->points_balance,
            'wallet_balance_after' => (int) $account->wallet_balance,
            'title' => __('tenant.customer_club.ledger.appointment_wallet_reserved'),
            'description' => __('tenant.customer_club.ledger.appointment_wallet_reserved_description'),
            'occurred_at' => now(),
        ]);

        $this->refreshTier($account);

        return $reserveAmount;
    }

    public function releaseWalletReservationForAppointmentPayment(TenantUser $user, string $paymentId, ?string $reason = null): int
    {
        $reservedAmount = $this->reservedWalletAmountForPayment($paymentId);

        if ($reservedAmount <= 0) {
            return 0;
        }

        $alreadyReleased = CustomerClubLedgerEntry::query()
            ->where('entry_type', 'appointment_payment_wallet_released')
            ->where('source_type', 'appointment_payment')
            ->where('source_id', $paymentId)
            ->exists();

        if ($alreadyReleased) {
            return 0;
        }

        $account = $this->ensureMemberAccount($user, true);
        $account = CustomerClubMemberAccount::query()->lockForUpdate()->findOrFail($account->id);

        $account->wallet_balance += $reservedAmount;
        $account->lifetime_wallet_spent = max(0, (int) $account->lifetime_wallet_spent - $reservedAmount);
        $account->last_activity_at = now();
        $account->save();

        CustomerClubLedgerEntry::query()->create([
            'member_account_id' => $account->id,
            'user_id' => $user->id,
            'entry_type' => 'appointment_payment_wallet_released',
            'source_type' => 'appointment_payment',
            'source_id' => $paymentId,
            'points_delta' => 0,
            'wallet_delta' => $reservedAmount,
            'points_balance_after' => (int) $account->points_balance,
            'wallet_balance_after' => (int) $account->wallet_balance,
            'title' => __('tenant.customer_club.ledger.appointment_wallet_released'),
            'description' => $reason ?: __('tenant.customer_club.ledger.appointment_wallet_released_description'),
            'occurred_at' => now(),
        ]);

        $this->refreshTier($account);

        return $reservedAmount;
    }

    private function applyBalanceDelta(
        TenantUser $user,
        string $entryType,
        string $sourceType,
        string $sourceId,
        int $pointsDelta,
        int $walletDelta,
        string $title,
        ?string $description = null,
    ): void {
        if ($pointsDelta === 0 && $walletDelta === 0) {
            return;
        }

        DB::transaction(function () use ($user, $entryType, $sourceType, $sourceId, $pointsDelta, $walletDelta, $title, $description): void {
            $existing = CustomerClubLedgerEntry::query()
                ->where('entry_type', $entryType)
                ->where('source_type', $sourceType)
                ->where('source_id', $sourceId)
                ->exists();

            if ($existing) {
                return;
            }

            $account = $this->ensureMemberAccount($user, true);
            $account = CustomerClubMemberAccount::query()->lockForUpdate()->findOrFail($account->id);

            $account->points_balance += $pointsDelta;
            $account->wallet_balance += $walletDelta;
            $account->lifetime_points_earned += max(0, $pointsDelta);
            $account->lifetime_wallet_earned += max(0, $walletDelta);
            $account->last_activity_at = now();
            $account->save();

            CustomerClubLedgerEntry::query()->create([
                'member_account_id' => $account->id,
                'user_id' => $user->id,
                'entry_type' => $entryType,
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'points_delta' => $pointsDelta,
                'wallet_delta' => $walletDelta,
                'points_balance_after' => (int) $account->points_balance,
                'wallet_balance_after' => (int) $account->wallet_balance,
                'title' => $title,
                'description' => $description,
                'occurred_at' => now(),
            ]);

            $this->createEarningNotification($user, $pointsDelta, $walletDelta, $title, $description);
            $this->refreshTier($account);
        });
    }

    private function createEarningNotification(
        TenantUser $user,
        int $pointsDelta,
        int $walletDelta,
        string $title,
        ?string $description = null,
    ): void {
        if ($pointsDelta <= 0 && $walletDelta <= 0) {
            return;
        }

        $parts = [];

        if ($pointsDelta > 0) {
            $parts[] = __('tenant.customer_club.notification.points_unit', [
                'points' => number_format($pointsDelta),
            ]);
        }

        if ($walletDelta > 0) {
            $parts[] = __('tenant.customer_club.notification.wallet_unit', [
                'amount' => number_format($walletDelta),
            ]);
        }

        $message = __('tenant.customer_club.notification.earned', [
            'items' => implode(__('tenant.customer_club.notification.separator'), $parts),
        ]);

        if ($description) {
            $message .= ' '.$description;
        }

        UserNotification::query()->create([
            'tenant_user_id' => $user->id,
            'recipient_mobile' => $user->mobile,
            'recipient_name' => $user->name,
            'recipient_role' => $user->role,
            'title' => __('tenant.customer_club.notification.title'),
            'message' => $message,
            'sender_name' => __('tenant.customer_club.notification.sender_name'),
            'target_type' => 'customer_club',
            'meta' => [
                'customer_club' => [
                    'points_delta' => $pointsDelta,
                    'wallet_delta' => $walletDelta,
                    'reason_title' => $title,
                ],
            ],
            'is_read' => false,
        ]);

        $this->notificationRealtime->broadcastInboxUpdated([$user->id]);
    }

    private function reservedWalletAmountForPayment(string $paymentId): int
    {
        return (int) abs((int) CustomerClubLedgerEntry::query()
            ->where('entry_type', 'appointment_payment_wallet_reserved')
            ->where('source_type', 'appointment_payment')
            ->where('source_id', $paymentId)
            ->sum('wallet_delta'));
    }

    private function ensureBootstrapped(): void
    {
        $this->settingsModel();

        if (CustomerClubTier::query()->count() === 0) {
            foreach ($this->defaultTiers() as $index => $tier) {
                CustomerClubTier::query()->create([
                    'title' => $tier['title'],
                    'slug' => $tier['slug'],
                    'badge_color' => $tier['badge_color'],
                    'icon' => $tier['icon'],
                    'minimum_points' => $tier['minimum_points'],
                    'minimum_wallet' => 0,
                    'sort_order' => $index + 1,
                    'is_active' => true,
                    'benefits' => $tier['benefits'],
                ]);
            }
        }

        if (CustomerClubReward::query()->count() === 0) {
            foreach ($this->defaultRewards() as $index => $reward) {
                CustomerClubReward::query()->create([
                    'title' => $reward['title'],
                    'slug' => $reward['slug'],
                    'reward_type' => $reward['reward_type'],
                    'cost_points' => $reward['cost_points'],
                    'wallet_amount' => $reward['wallet_amount'] ?? 0,
                    'bonus_points' => $reward['bonus_points'] ?? 0,
                    'vip_days' => $reward['vip_days'] ?? 0,
                    'per_user_limit' => $reward['per_user_limit'] ?? 1,
                    'sort_order' => $index + 1,
                    'is_active' => true,
                    'description' => $reward['description'],
                ]);
            }
        }
    }

    private function settingsModel(): CustomerClubSetting
    {
        return CustomerClubSetting::query()->firstOrCreate([], [
            'is_enabled' => true,
            'points_enabled' => true,
            'wallet_enabled' => true,
            'tiers_enabled' => true,
            'rewards_enabled' => true,
            'auto_tier_upgrade_enabled' => true,
            'appointment_points_enabled' => true,
            'appointment_fixed_points' => 10,
            'appointment_points_per_100k' => 0,
            'appointment_wallet_enabled' => false,
            'appointment_fixed_wallet' => 0,
            'store_points_enabled' => true,
            'store_fixed_points' => 0,
            'store_points_per_100k' => 5,
            'store_wallet_enabled' => true,
            'store_wallet_percent' => 3,
            'welcome_bonus_enabled' => false,
            'welcome_bonus_points' => 0,
            'welcome_bonus_wallet' => 0,
            'birthday_bonus_enabled' => false,
            'birthday_bonus_points' => 0,
            'birthday_bonus_wallet' => 0,
            'manual_adjustments_enabled' => true,
            'allow_negative_wallet' => false,
            'show_wallet_to_customer' => true,
            'show_points_to_customer' => true,
            'show_tier_to_customer' => true,
            'nutrition_rewards_enabled' => false,
            'nutrition_daily_food_log_enabled' => false,
            'nutrition_daily_food_log_points' => 0,
            'nutrition_per_meal_log_enabled' => false,
            'nutrition_per_meal_log_points' => 0,
            'nutrition_daily_water_log_enabled' => false,
            'nutrition_daily_water_log_points' => 0,
            'nutrition_weight_loss_reward_enabled' => false,
            'nutrition_weight_loss_reward_points' => 0,
            'nutrition_online_diet_request_reward_enabled' => false,
            'nutrition_online_diet_request_reward_points' => 0,
        ]);
    }

    private function ensureMemberAccount(TenantUser $user, bool $withLock = false): CustomerClubMemberAccount
    {
        $query = CustomerClubMemberAccount::query();

        if ($withLock) {
            $query->lockForUpdate();
        }

        $account = $query->firstOrCreate(
            ['user_id' => $user->id],
            [
                'joined_at' => now(),
                'last_activity_at' => now(),
            ],
        );

        if ($account->current_tier_id === null) {
            $this->refreshTier($account);
        }

        return $account;
    }

    private function findMemberAccount(TenantUser $user): ?CustomerClubMemberAccount
    {
        return CustomerClubMemberAccount::query()
            ->with('currentTier')
            ->where('user_id', $user->id)
            ->first();
    }

    private function refreshTier(CustomerClubMemberAccount $account): void
    {
        $settings = $this->settingsModel();

        if (! $settings->tiers_enabled || ! $settings->auto_tier_upgrade_enabled) {
            return;
        }

        $tier = CustomerClubTier::query()
            ->where('is_active', true)
            ->where('minimum_points', '<=', (int) $account->points_balance)
            ->where('minimum_wallet', '<=', (int) $account->wallet_balance)
            ->orderByDesc('minimum_points')
            ->orderByDesc('minimum_wallet')
            ->orderByDesc('sort_order')
            ->first();

        if ((int) ($account->current_tier_id ?? 0) !== (int) ($tier?->id ?? 0)) {
            $account->current_tier_id = $tier?->id;
            $account->save();
        }
    }

    private function recalculateAllTiers(): void
    {
        CustomerClubMemberAccount::query()->get()->each(function (CustomerClubMemberAccount $account): void {
            $this->refreshTier($account);
        });
    }

    private function resolveAppointmentUser(Appointment $appointment): ?TenantUser
    {
        $userId = (int) ($appointment->meta['tenant_customer_user_id'] ?? 0);

        if ($userId > 0) {
            return TenantUser::query()->find($userId);
        }

        return TenantUser::query()
            ->where('role', 'customer')
            ->where('mobile', (string) $appointment->customer_phone_snapshot)
            ->first();
    }

    private function resolveStoreOrderUser(StoreOrder $order): ?TenantUser
    {
        $creator = TenantUser::query()->find($order->created_by_user_id);

        if ($creator?->role === 'customer') {
            return $creator;
        }

        return TenantUser::query()
            ->where('role', 'customer')
            ->where('mobile', (string) $order->customer_phone)
            ->first();
    }

    private function makeUniqueSlug(?string $slug, string $title, string $modelClass, ?int $ignoreId = null): string
    {
        $base = trim((string) $slug) !== ''
            ? Str::slug((string) $slug)
            : Str::slug($title);

        if ($base === '') {
            $base = 'club-'.Str::lower(Str::random(8));
        }

        $candidate = $base;
        $suffix = 2;

        while ($modelClass::query()
            ->when($ignoreId !== null, fn ($query) => $query->whereKeyNot($ignoreId))
            ->where('slug', $candidate)
            ->exists()) {
            $candidate = $base.'-'.$suffix;
            $suffix += 1;
        }

        return $candidate;
    }

    private function serializeSettings(CustomerClubSetting $setting): array
    {
        return [
            'isEnabled' => (bool) $setting->is_enabled,
            'pointsEnabled' => (bool) $setting->points_enabled,
            'walletEnabled' => (bool) $setting->wallet_enabled,
            'tiersEnabled' => (bool) $setting->tiers_enabled,
            'rewardsEnabled' => (bool) $setting->rewards_enabled,
            'autoTierUpgradeEnabled' => (bool) $setting->auto_tier_upgrade_enabled,
            'appointmentPointsEnabled' => (bool) $setting->appointment_points_enabled,
            'appointmentFixedPoints' => (int) $setting->appointment_fixed_points,
            'appointmentPointsPer100k' => (int) $setting->appointment_points_per_100k,
            'appointmentWalletEnabled' => (bool) $setting->appointment_wallet_enabled,
            'appointmentFixedWallet' => (int) $setting->appointment_fixed_wallet,
            'storePointsEnabled' => (bool) $setting->store_points_enabled,
            'storeFixedPoints' => (int) $setting->store_fixed_points,
            'storePointsPer100k' => (int) $setting->store_points_per_100k,
            'storeWalletEnabled' => (bool) $setting->store_wallet_enabled,
            'storeWalletPercent' => (int) $setting->store_wallet_percent,
            'welcomeBonusEnabled' => (bool) $setting->welcome_bonus_enabled,
            'welcomeBonusPoints' => (int) $setting->welcome_bonus_points,
            'welcomeBonusWallet' => (int) $setting->welcome_bonus_wallet,
            'birthdayBonusEnabled' => (bool) $setting->birthday_bonus_enabled,
            'birthdayBonusPoints' => (int) $setting->birthday_bonus_points,
            'birthdayBonusWallet' => (int) $setting->birthday_bonus_wallet,
            'manualAdjustmentsEnabled' => (bool) $setting->manual_adjustments_enabled,
            'showWalletToCustomer' => (bool) $setting->show_wallet_to_customer,
            'showPointsToCustomer' => (bool) $setting->show_points_to_customer,
            'showTierToCustomer' => (bool) $setting->show_tier_to_customer,
            'nutritionRewardsEnabled' => (bool) $setting->nutrition_rewards_enabled,
            'nutritionDailyFoodLogEnabled' => (bool) $setting->nutrition_daily_food_log_enabled,
            'nutritionDailyFoodLogPoints' => (int) $setting->nutrition_daily_food_log_points,
            'nutritionPerMealLogEnabled' => (bool) $setting->nutrition_per_meal_log_enabled,
            'nutritionPerMealLogPoints' => (int) $setting->nutrition_per_meal_log_points,
            'nutritionDailyWaterLogEnabled' => (bool) $setting->nutrition_daily_water_log_enabled,
            'nutritionDailyWaterLogPoints' => (int) $setting->nutrition_daily_water_log_points,
            'nutritionWeightLossRewardEnabled' => (bool) $setting->nutrition_weight_loss_reward_enabled,
            'nutritionWeightLossRewardPoints' => (int) $setting->nutrition_weight_loss_reward_points,
            'nutritionOnlineDietRequestRewardEnabled' => (bool) $setting->nutrition_online_diet_request_reward_enabled,
            'nutritionOnlineDietRequestRewardPoints' => (int) $setting->nutrition_online_diet_request_reward_points,
        ];
    }

    private function serializeTier(CustomerClubTier $tier): array
    {
        return [
            'id' => (string) $tier->id,
            'title' => $tier->title,
            'slug' => $tier->slug,
            'badgeColor' => $tier->badge_color,
            'icon' => $tier->icon,
            'minimumPoints' => (int) $tier->minimum_points,
            'minimumWallet' => (int) $tier->minimum_wallet,
            'sortOrder' => (int) $tier->sort_order,
            'isActive' => (bool) $tier->is_active,
            'benefits' => $tier->benefits ?? [],
        ];
    }

    private function serializeReward(CustomerClubReward $reward, ?CustomerClubMemberAccount $account = null): array
    {
        return [
            'id' => (string) $reward->id,
            'title' => $reward->title,
            'slug' => $reward->slug,
            'rewardType' => $reward->reward_type,
            'costPoints' => (int) $reward->cost_points,
            'walletAmount' => (int) $reward->wallet_amount,
            'bonusPoints' => (int) $reward->bonus_points,
            'vipDays' => (int) $reward->vip_days,
            'perUserLimit' => (int) $reward->per_user_limit,
            'totalLimit' => $reward->total_limit !== null ? (int) $reward->total_limit : null,
            'sortOrder' => (int) $reward->sort_order,
            'isActive' => (bool) $reward->is_active,
            'startsAt' => $reward->starts_at?->toIso8601String(),
            'endsAt' => $reward->ends_at?->toIso8601String(),
            'description' => $reward->description,
            'canRedeem' => $account ? (int) $account->points_balance >= (int) $reward->cost_points : false,
        ];
    }

    private function serializeLedgerEntry(CustomerClubLedgerEntry $entry): array
    {
        return [
            'id' => (string) $entry->id,
            'entryType' => $entry->entry_type,
            'sourceType' => $entry->source_type,
            'sourceId' => $entry->source_id,
            'pointsDelta' => (int) $entry->points_delta,
            'walletDelta' => (int) $entry->wallet_delta,
            'pointsBalanceAfter' => (int) $entry->points_balance_after,
            'walletBalanceAfter' => (int) $entry->wallet_balance_after,
            'title' => $entry->title,
            'description' => $entry->description,
            'occurredAt' => $entry->occurred_at?->toIso8601String(),
            'user' => $entry->relationLoaded('user') && $entry->user
                ? [
                    'id' => (string) $entry->user->id,
                    'name' => $entry->user->name,
                    'mobile' => $entry->user->mobile,
                ]
                : null,
        ];
    }

    private function serializeMemberAccount(?CustomerClubMemberAccount $account, TenantUser $user): array
    {
        return [
            'userId' => (string) $user->id,
            'name' => $user->name,
            'mobile' => $user->mobile,
            'isVip' => (bool) $user->is_vip,
            'pointsBalance' => (int) ($account?->points_balance ?? 0),
            'walletBalance' => (int) ($account?->wallet_balance ?? 0),
            'lifetimePointsEarned' => (int) ($account?->lifetime_points_earned ?? 0),
            'lifetimeWalletEarned' => (int) ($account?->lifetime_wallet_earned ?? 0),
            'joinedAt' => $account?->joined_at?->toIso8601String(),
            'lastActivityAt' => $account?->last_activity_at?->toIso8601String(),
            'currentTier' => $account?->currentTier
                ? [
                    'id' => (string) $account->currentTier->id,
                    'title' => $account->currentTier->title,
                    'badgeColor' => $account->currentTier->badge_color,
                ]
                : null,
        ];
    }

    private function serializeRedemption(CustomerClubRewardRedemption $redemption): array
    {
        return [
            'id' => (string) $redemption->id,
            'status' => $redemption->status,
            'costPoints' => (int) $redemption->cost_points,
            'walletAmount' => (int) $redemption->wallet_amount,
            'issuedCode' => $redemption->issued_code,
            'redeemedAt' => $redemption->redeemed_at?->toIso8601String(),
            'expiresAt' => $redemption->expires_at?->toIso8601String(),
            'reward' => $redemption->reward
                ? [
                    'id' => (string) $redemption->reward->id,
                    'title' => $redemption->reward->title,
                    'rewardType' => $redemption->reward->reward_type,
                ]
                : null,
        ];
    }

    private function defaultTiers(): array
    {
        return [
            [
                'title' => __('tenant.customer_club.default_tiers.bronze.title'),
                'slug' => 'bronze',
                'badge_color' => 'amber',
                'icon' => 'medal',
                'minimum_points' => 0,
                'benefits' => [__('tenant.customer_club.default_tiers.bronze.benefit')],
            ],
            [
                'title' => __('tenant.customer_club.default_tiers.silver.title'),
                'slug' => 'silver',
                'badge_color' => 'slate',
                'icon' => 'sparkles',
                'minimum_points' => 150,
                'benefits' => [__('tenant.customer_club.default_tiers.silver.benefit')],
            ],
            [
                'title' => __('tenant.customer_club.default_tiers.gold.title'),
                'slug' => 'gold',
                'badge_color' => 'yellow',
                'icon' => 'crown',
                'minimum_points' => 400,
                'benefits' => [__('tenant.customer_club.default_tiers.gold.benefit')],
            ],
            [
                'title' => __('tenant.customer_club.default_tiers.diamond.title'),
                'slug' => 'diamond',
                'badge_color' => 'cyan',
                'icon' => 'gem',
                'minimum_points' => 900,
                'benefits' => [__('tenant.customer_club.default_tiers.diamond.benefit')],
            ],
        ];
    }

    private function defaultRewards(): array
    {
        return [
            [
                'title' => __('tenant.customer_club.default_rewards.wallet_50k.title'),
                'slug' => 'wallet-50k',
                'reward_type' => 'wallet_credit',
                'cost_points' => 120,
                'wallet_amount' => 50000,
                'description' => __('tenant.customer_club.default_rewards.wallet_50k.description'),
            ],
            [
                'title' => __('tenant.customer_club.default_rewards.wallet_200k.title'),
                'slug' => 'wallet-200k',
                'reward_type' => 'wallet_credit',
                'cost_points' => 420,
                'wallet_amount' => 200000,
                'description' => __('tenant.customer_club.default_rewards.wallet_200k.description'),
            ],
            [
                'title' => __('tenant.customer_club.default_rewards.vip_gift.title'),
                'slug' => 'vip-gift',
                'reward_type' => 'vip_access',
                'cost_points' => 600,
                'vip_days' => 30,
                'description' => __('tenant.customer_club.default_rewards.vip_gift.description'),
            ],
        ];
    }
}
