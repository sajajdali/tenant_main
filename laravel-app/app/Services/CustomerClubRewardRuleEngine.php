<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\CustomerClubRewardRule;
use App\Domain\Tenant\Models\CustomerClubRewardRuleAward;
use App\Domain\Tenant\Models\CustomerClubRewardRuleReview;
use App\Domain\Tenant\Models\TenantUser;
use Illuminate\Support\Facades\DB;

class CustomerClubRewardRuleEngine
{
    public function __construct(private readonly CustomerClubService $customerClub) {}

    /**
     * @param  array<string, mixed>  $context
     */
    public function handle(string $eventType, TenantUser $user, string $sourceType, string $sourceId, array $context = []): void
    {
        if (! $this->customerClub->isActiveForTenant() || $user->role !== 'customer') {
            return;
        }

        CustomerClubRewardRule::query()
            ->where('event_type', $eventType)
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>=', now()))
            ->orderBy('priority')
            ->orderBy('id')
            ->each(function (CustomerClubRewardRule $rule) use ($user, $sourceType, $sourceId, $context): void {
                $awardSourceId = $this->awardSourceId($rule, $sourceId, $context);

                if (! $this->matchesScope($rule, $context) || ! $this->matchesConditions($rule, $user, $context) || ! $this->withinLimit($rule, $user, $sourceType, $awardSourceId)) {
                    return;
                }

                $this->createAward($rule, $user, $sourceType, $awardSourceId, $context);
            });
    }

    /** @param array<string, mixed> $context */
    private function matchesScope(CustomerClubRewardRule $rule, array $context): bool
    {
        if ($rule->scope_type === 'all' || empty($rule->scope_ids)) {
            return true;
        }

        $contextValue = $context[$rule->scope_type.'_id'] ?? null;

        return $contextValue !== null && in_array((string) $contextValue, array_map('strval', $rule->scope_ids), true);
    }

    /** @param array<string, mixed> $context */
    private function matchesConditions(CustomerClubRewardRule $rule, TenantUser $user, array $context): bool
    {
        $conditions = $rule->conditions_json ?? [];

        if (isset($conditions['minimum_meal_logs'])) {
            $prescriptionId = (int) ($context['nutrition_diet_prescription_id'] ?? 0);
            if ($prescriptionId <= 0) {
                return false;
            }

            $logs = DB::table('nutrition_meal_logs')
                ->where('user_id', $user->id)
                ->where('nutrition_diet_prescription_id', $prescriptionId)
                ->when((bool) ($conditions['only_scheduled_meals'] ?? false), fn ($query) => $query->where('consumption_type', 'scheduled'))
                ->count();

            if ($logs < (int) $conditions['minimum_meal_logs']) {
                return false;
            }
        }

        if (isset($conditions['minimum_weight_loss_kg'])) {
            $startWeight = isset($context['start_weight_kg']) ? (float) $context['start_weight_kg'] : null;
            $currentWeight = isset($context['current_weight_kg']) ? (float) $context['current_weight_kg'] : null;

            if ($startWeight === null || $currentWeight === null || $startWeight - $currentWeight < (float) $conditions['minimum_weight_loss_kg']) {
                return false;
            }
        }

        return true;
    }

    private function withinLimit(CustomerClubRewardRule $rule, TenantUser $user, string $sourceType, string $sourceId): bool
    {
        if ($rule->per_user_limit === null) {
            return true;
        }

        $awards = CustomerClubRewardRuleAward::query()->where('rule_id', $rule->id)->where('user_id', $user->id);

        if ($rule->limit_period === 'source') {
            $awards->where('source_type', $sourceType)->where('source_id', $sourceId);
        } elseif ($rule->limit_period === 'day') {
            $awards->whereDate('created_at', now()->toDateString());
        } elseif ($rule->limit_period === 'month') {
            $awards->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()]);
        }

        return $awards->count() < $rule->per_user_limit;
    }

    /** @param array<string, mixed> $context */
    private function awardSourceId(CustomerClubRewardRule $rule, string $sourceId, array $context): string
    {
        if (isset(($rule->conditions_json ?? [])['minimum_meal_logs']) && isset($context['nutrition_diet_prescription_id'])) {
            return (string) $context['nutrition_diet_prescription_id'];
        }

        return $sourceId;
    }

    /** @param array<string, mixed> $context */
    private function createAward(CustomerClubRewardRule $rule, TenantUser $user, string $sourceType, string $sourceId, array $context): void
    {
        DB::transaction(function () use ($rule, $user, $sourceType, $sourceId, $context): void {
            $award = CustomerClubRewardRuleAward::query()->firstOrCreate([
                'rule_id' => $rule->id,
                'user_id' => $user->id,
                'source_type' => $sourceType,
                'source_id' => $sourceId,
            ], [
                'status' => $rule->award_timing === 'manual_review' ? 'pending_review' : 'awarded',
                'reward_amount' => $rule->reward_amount,
                'context_json' => $context,
                'awarded_at' => $rule->award_timing === 'manual_review' ? null : now(),
            ]);

            if (! $award->wasRecentlyCreated) {
                return;
            }

            if ($rule->award_timing === 'manual_review') {
                CustomerClubRewardRuleReview::query()->create(['award_id' => $award->id]);

                return;
            }

            $ledger = $this->customerClub->awardCustomEarning(
                $user,
                'reward_rule_earn',
                'reward_rule:'.$sourceType,
                $rule->id.':'.$sourceId,
                $rule->reward_type === 'points' ? $rule->reward_amount : 0,
                $rule->reward_type === 'wallet_credit' ? $rule->reward_amount : 0,
                $rule->title,
                null,
            );

            $award->update(['ledger_entry_id' => $ledger?->id]);
        });
    }

    public function review(CustomerClubRewardRuleReview $review, TenantUser $reviewer, bool $approved, ?string $note = null): void
    {
        DB::transaction(function () use ($review, $reviewer, $approved, $note): void {
            $review = CustomerClubRewardRuleReview::query()->lockForUpdate()->with(['award.rule', 'award.user'])->findOrFail($review->id);
            if ($review->status !== 'pending' || ! $review->award || ! $review->award->rule || ! $review->award->user) {
                return;
            }

            $review->update([
                'status' => $approved ? 'approved' : 'rejected',
                'reviewed_by_user_id' => $reviewer->id,
                'reviewed_at' => now(),
                'note' => $note,
            ]);

            if (! $approved) {
                $review->award->update(['status' => 'rejected']);

                return;
            }

            $rule = $review->award->rule;
            $ledger = $this->customerClub->awardCustomEarning(
                $review->award->user,
                'reward_rule_review_earn',
                'reward_rule_review:'.$review->award->source_type,
                $rule->id.':'.$review->award->id,
                $rule->reward_type === 'points' ? $review->award->reward_amount : 0,
                $rule->reward_type === 'wallet_credit' ? $review->award->reward_amount : 0,
                $rule->title,
                $note,
            );

            $review->award->update([
                'status' => 'awarded',
                'ledger_entry_id' => $ledger?->id,
                'awarded_at' => now(),
            ]);
        });
    }

    /** Reverse rule awards created for a paid source that was later cancelled. */
    public function reverseForSource(string $eventType, string $sourceType, string $sourceId): void
    {
        CustomerClubRewardRuleAward::query()
            ->where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->where('status', 'awarded')
            ->with(['rule', 'user'])
            ->each(function (CustomerClubRewardRuleAward $award) use ($eventType): void {
                if ($award->rule?->event_type !== $eventType || ! $award->user) {
                    return;
                }

                // The ledger contains the original balance mutation. Marking
                // this award reversed prevents any future duplicate reversal;
                // balance reversal is performed by the customer-club service.
                $this->customerClub->reverseRuleAward($award);
                $award->update(['status' => 'reversed']);
            });
    }
}
