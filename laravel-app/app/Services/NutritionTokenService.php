<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\NutritionMealReplacementSuggestion;
use App\Domain\Tenant\Models\NutritionTokenLedger;
use App\Domain\Tenant\Models\NutritionTokenWallet;
use App\Domain\Tenant\Models\TenantUser;
use App\Support\OpenAiSettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class NutritionTokenService
{
    public const DEFAULT_AI_DIET_REQUEST_COST = 3500;
    public const DEFAULT_AI_QUESTION_COST = 250;

    public function wallet(): NutritionTokenWallet
    {
        return NutritionTokenWallet::query()->firstOrCreate(
            ['id' => 1],
            [
                'balance_tokens' => 0,
                'purchased_tokens' => 0,
                'used_tokens' => 0,
                'settings_json' => [
                    'ai_diet_request_cost' => self::DEFAULT_AI_DIET_REQUEST_COST,
                    'ai_question_cost' => self::DEFAULT_AI_QUESTION_COST,
                ],
            ],
        );
    }

    public function tokenCost(string $key): int
    {
        $wallet = $this->wallet();
        $settings = is_array($wallet->settings_json) ? $wallet->settings_json : [];

        return match ($key) {
            'ai_question_cost' => max(0, (int) ($settings['ai_question_cost'] ?? self::DEFAULT_AI_QUESTION_COST)),
            default => max(0, (int) ($settings['ai_diet_request_cost'] ?? self::DEFAULT_AI_DIET_REQUEST_COST)),
        };
    }

    public function creditTokens(
        int $amount,
        ?TenantUser $actor = null,
        string $reasonTitle = 'خرید توکن',
        string $eventType = 'topup',
        array $meta = [],
        ?string $reasonCode = null,
    ): NutritionTokenLedger {
        if ($amount <= 0) {
            throw new RuntimeException('مقدار توکن برای افزایش باید بیشتر از صفر باشد.');
        }

        $ledger = DB::transaction(function () use ($actor, $amount, $reasonTitle, $eventType, $meta, $reasonCode): NutritionTokenLedger {
            $wallet = NutritionTokenWallet::query()->lockForUpdate()->firstOrCreate(['id' => 1]);
            $balanceAfter = (int) $wallet->balance_tokens + $amount;

            $wallet->forceFill([
                'balance_tokens' => $balanceAfter,
                'purchased_tokens' => (int) $wallet->purchased_tokens + $amount,
            ])->save();

            return NutritionTokenLedger::query()->create([
                'nutrition_token_wallet_id' => $wallet->id,
                'actor_user_id' => $actor?->id,
                'subject_user_id' => null,
                'nutrition_diet_request_id' => null,
                'tokens_amount' => $amount,
                'direction' => 'credit',
                'event_type' => $eventType,
                'balance_after' => $balanceAfter,
                'reason_title' => $reasonTitle,
                'reason_code' => $reasonCode,
                'meta_json' => $meta,
                'occurred_at' => now(),
            ]);
        });

        $this->syncTokenAlertState((int) $ledger->balance_after);

        return $ledger;
    }

    public function debitTokensManually(
        int $amount,
        ?TenantUser $actor = null,
        string $reasonTitle = 'کاهش دستی اعتبار توکن',
        array $meta = [],
    ): NutritionTokenLedger {
        return $this->debitTokens(
            amount: $amount,
            actor: $actor,
            subject: null,
            eventType: 'topup',
            reasonTitle: $reasonTitle,
            reasonCode: 'manual_debit',
            dietRequest: null,
            meta: $meta,
        );
    }

    public function debitForDietRequest(NutritionDietRequest $request, ?TenantUser $actor = null): ?NutritionTokenLedger
    {
        if ($request->request_type !== 'ai') {
            return null;
        }

        $existing = NutritionTokenLedger::query()
            ->where('event_type', 'diet_request_ai')
            ->where('nutrition_diet_request_id', $request->id)
            ->latest('id')
            ->first();

        if ($existing) {
            return $existing;
        }

        $cost = $this->tokenCost('ai_diet_request_cost');
        if ($cost <= 0) {
            return null;
        }

        return $this->debitTokens(
            amount: $cost,
            actor: $actor,
            subject: $request->user,
            eventType: 'diet_request_ai',
            reasonTitle: 'مصرف توکن برای تولید رژیم آنلاین',
            reasonCode: 'diet_request_ai',
            dietRequest: $request,
            meta: [
                'request_type' => $request->request_type,
                'diet_template_name' => $request->diet_template_name,
            ],
        );
    }

    public function debitForAiQuestion(TenantUser $subject, ?TenantUser $actor = null, array $meta = []): NutritionTokenLedger
    {
        $cost = $this->tokenCost('ai_question_cost');

        return $this->debitTokens(
            amount: $cost,
            actor: $actor,
            subject: $subject,
            eventType: 'ai_question',
            reasonTitle: 'مصرف توکن برای سوال از AI',
            reasonCode: 'ai_question',
            dietRequest: null,
            meta: $meta,
        );
    }

    public function dashboardPayload(): array
    {
        return $this->dashboardPayloadForSearch();
    }

    public function dashboardPayloadForSearch(string $search = ''): array
    {
        $wallet = $this->wallet();
        $this->syncTokenAlertState((int) $wallet->balance_tokens);
        $today = now()->toDateString();
        $filteredQuery = $this->applySearch(NutritionTokenLedger::query(), $search);

        $newOffline = NutritionDietRequest::query()
            ->where('request_type', 'expert')
            ->whereIn('status', ['sent', 'in_progress'])
            ->count();

        $prescribedToday = NutritionDietRequest::query()
            ->whereDate('created_at', $today)
            ->count();

        $recentEntries = (clone $filteredQuery)
            ->with(['subject:id,name,mobile', 'actor:id,name,mobile', 'dietRequest:id,diet_template_name'])
            ->latest('id')
            ->limit(12)
            ->get();

        $byUsers = (clone $filteredQuery)
            ->selectRaw('subject_user_id, SUM(CASE WHEN direction = "debit" THEN tokens_amount ELSE 0 END) as consumed_tokens, COUNT(*) as entries_count')
            ->whereNotNull('subject_user_id')
            ->groupBy('subject_user_id')
            ->orderByDesc('consumed_tokens')
            ->with('subject:id,name,mobile')
            ->limit(20)
            ->get();

        return [
            'stats' => [
                'newOfflineRequests' => (int) $newOffline,
                'prescribedToday' => (int) $prescribedToday,
                'currentTokens' => (int) $wallet->balance_tokens,
                'usedTokens' => (int) $wallet->used_tokens,
                'purchasedTokens' => (int) $wallet->purchased_tokens,
                'aiDietRequestCost' => $this->tokenCost('ai_diet_request_cost'),
                'aiQuestionCost' => $this->tokenCost('ai_question_cost'),
                'tokenUnitPriceToman' => OpenAiSettings::nutritionTokenUnitPriceToman(),
            ],
            'filters' => [
                'q' => trim($search),
            ],
            'recentEntries' => $recentEntries->map(fn (NutritionTokenLedger $entry): array => $this->serializeLedger($entry))->values()->all(),
            'byUsers' => $byUsers->map(function (NutritionTokenLedger $entry): array {
                return [
                    'userId' => $entry->subject_user_id ? (string) $entry->subject_user_id : null,
                    'name' => $entry->subject?->name,
                    'mobile' => $entry->subject?->mobile,
                    'consumedTokens' => (int) $entry->consumed_tokens,
                    'entriesCount' => (int) $entry->entries_count,
                ];
            })->values()->all(),
        ];
    }

    public function historyPayload(string $search = '', int $perPage = 25): array
    {
        $search = trim($search);
        $baseQuery = $this->applySearch(NutritionTokenLedger::query(), $search);

        $items = (clone $baseQuery)
            ->with(['subject:id,name,mobile', 'actor:id,name,mobile', 'dietRequest:id,diet_template_name'])
            ->latest('id')
            ->paginate(max(1, min($perPage, 100)));

        $stats = (clone $baseQuery)
            ->toBase()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN direction = 'debit' THEN tokens_amount ELSE 0 END) as consumed_tokens")
            ->selectRaw("SUM(CASE WHEN direction = 'credit' THEN tokens_amount ELSE 0 END) as charged_tokens")
            ->first();

        return [
            'stats' => [
                'total' => (int) ($stats->total ?? 0),
                'consumedTokens' => (int) ($stats->consumed_tokens ?? 0),
                'chargedTokens' => (int) ($stats->charged_tokens ?? 0),
            ],
            'filters' => [
                'q' => $search,
            ],
            'items' => $items->getCollection()->map(fn (NutritionTokenLedger $entry): array => $this->serializeLedger($entry))->values()->all(),
            'page' => $items->currentPage(),
            'perPage' => $items->perPage(),
            'total' => $items->total(),
            'lastPage' => $items->lastPage(),
        ];
    }

    public function serializeLedger(NutritionTokenLedger $entry): array
    {
        $meta = is_array($entry->meta_json) ? $entry->meta_json : [];
        $model = trim((string) data_get($meta, 'model', ''));

        if ($model !== '') {
            $meta['model_raw'] = $model;
            $meta['model'] = OpenAiSettings::modelDisplayName($model);
            $meta['model_display_name'] = $meta['model'];
        }

        $operationType = (string) data_get($entry->meta_json, 'operation_type', '');
        $eventTypeLabel = match (true) {
            $entry->event_type === 'diet_request_ai' && $operationType === 'diet_revision' => 'ویرایش رژیم با AI',
            $entry->event_type === 'diet_request_ai' && $operationType === 'meal_replacement' => 'جایگزینی غذا با AI',
            $entry->event_type === 'diet_request_ai' && $operationType === 'manual_meal_nutrition' => 'محاسبه غذای خارج از برنامه با AI',
            $entry->event_type === 'diet_request_ai' => 'تولید رژیم با AI',
            $entry->event_type === 'ai_question' => 'سوال از AI',
            $entry->event_type === 'topup' && $entry->reason_code === 'initial_tenant_grant' => 'اعتبار اولیه سایت تغذیه',
            $entry->event_type === 'topup' && $entry->reason_code === 'manual_credit' => 'افزایش دستی اعتبار',
            $entry->event_type === 'topup' && $entry->reason_code === 'manual_debit' => 'کاهش دستی اعتبار',
            $entry->event_type === 'topup' => 'خرید توکن',
            default => $entry->event_type,
        };

        return [
            'id' => (string) $entry->id,
            'tokensAmount' => (int) $entry->tokens_amount,
            'direction' => $entry->direction,
            'directionLabel' => $entry->direction === 'credit' ? 'افزایش موجودی' : 'مصرف موجودی',
            'eventType' => $entry->event_type,
            'eventTypeLabel' => $eventTypeLabel,
            'balanceAfter' => (int) $entry->balance_after,
            'reasonTitle' => $entry->reason_title,
            'reasonCode' => $entry->reason_code,
            'occurredAt' => $entry->occurred_at?->toIso8601String(),
            'subjectUser' => $entry->relationLoaded('subject') && $entry->subject ? [
                'id' => (string) $entry->subject->id,
                'name' => $entry->subject->name,
                'mobile' => $entry->subject->mobile,
            ] : null,
            'actorUser' => $entry->relationLoaded('actor') && $entry->actor ? [
                'id' => (string) $entry->actor->id,
                'name' => $entry->actor->name,
                'mobile' => $entry->actor->mobile,
            ] : null,
            'dietRequest' => $entry->relationLoaded('dietRequest') && $entry->dietRequest ? [
                'id' => (string) $entry->dietRequest->id,
                'dietTemplateName' => $entry->dietRequest->diet_template_name,
            ] : null,
            'summary' => $this->ledgerSummary($entry, $eventTypeLabel),
            'meta' => $meta,
        ];
    }

    private function ledgerSummary(NutritionTokenLedger $entry, string $eventTypeLabel): string
    {
        $subjectName = $entry->subject?->name ?: 'کاربر بدون نام';
        $amount = number_format((int) $entry->tokens_amount);
        $dietName = (string) data_get($entry->meta_json, 'diet_template_name', $entry->dietRequest?->diet_template_name ?? '');
        $model = OpenAiSettings::modelDisplayName(trim((string) data_get($entry->meta_json, 'model', '')));
        $promptTokens = max(0, (int) data_get($entry->meta_json, 'usage.prompt_tokens', 0));
        $completionTokens = max(0, (int) data_get($entry->meta_json, 'usage.completion_tokens', 0));
        $slotTitle = trim((string) data_get($entry->meta_json, 'slot_title', ''));
        $modelText = $model !== '' ? " با مدل {$model}" : '';
        $usageText = ($promptTokens > 0 || $completionTokens > 0)
            ? " (prompt: {$promptTokens} / completion: {$completionTokens})"
            : '';

        if ($entry->event_type === 'diet_request_ai' && (string) $entry->reason_code === 'meal_replacement_ai') {
            return trim("برای {$eventTypeLabel} {$subjectName}" . ($slotTitle !== '' ? " - {$slotTitle}" : '') . "{$modelText} {$amount} توکن{$usageText}");
        }

        if ($entry->event_type === 'diet_request_ai' && (string) $entry->reason_code === 'manual_meal_nutrition_ai') {
            $foodTitle = trim((string) data_get($entry->meta_json, 'food_title', ''));
            return trim("برای {$eventTypeLabel} {$subjectName}" . ($slotTitle !== '' ? " - {$slotTitle}" : '') . ($foodTitle !== '' ? " - {$foodTitle}" : '') . "{$modelText} {$amount} توکن{$usageText}");
        }

        if ($entry->event_type === 'diet_request_ai') {
            return trim("برای {$eventTypeLabel} {$subjectName}" . ($dietName !== '' ? " - {$dietName}" : '') . "{$modelText} {$amount} توکن{$usageText}");
        }

        if ($entry->event_type === 'ai_question') {
            return "برای سوال AI {$subjectName} {$amount} توکن";
        }

        if ($entry->event_type === 'topup') {
            if ($entry->reason_code === 'manual_debit') {
                return "کاهش دستی موجودی {$amount} توکن";
            }

            return "{$eventTypeLabel} {$amount} توکن";
        }

        return "{$eventTypeLabel} - {$amount} توکن";
    }

    public function debitForDietGeneration(
        NutritionDietRequest $request,
        ?TenantUser $actor = null,
        array $usage = [],
        array $meta = [],
    ): ?NutritionTokenLedger {
        if ($request->request_type !== 'ai') {
            return null;
        }

        $amount = $this->usageTotalTokens($usage);
        if ($amount <= 0) {
            $amount = $this->tokenCost('ai_diet_request_cost');
        }
        if ($amount <= 0) {
            return null;
        }

        $operationType = (string) ($meta['operation_type'] ?? 'diet_generation');
        $reasonTitle = $operationType === 'diet_revision'
            ? 'مصرف واقعی توکن برای ویرایش رژیم با AI'
            : 'مصرف واقعی توکن برای تولید رژیم آنلاین';
        $reasonCode = $operationType === 'diet_revision'
            ? 'diet_request_ai_revision'
            : 'diet_request_ai_generation';

        return $this->debitTokens(
            amount: $amount,
            actor: $actor,
            subject: $request->user,
            eventType: 'diet_request_ai',
            reasonTitle: $reasonTitle,
            reasonCode: $reasonCode,
            dietRequest: $request,
            meta: array_merge([
                'operation_type' => $operationType,
                'request_type' => $request->request_type,
                'diet_template_name' => $request->diet_template_name,
                'usage' => [
                    'prompt_tokens' => max(0, (int) ($usage['promptTokens'] ?? 0)),
                    'completion_tokens' => max(0, (int) ($usage['completionTokens'] ?? 0)),
                    'total_tokens' => $amount,
                ],
            ], $meta),
        );
    }

    public function debitForMealReplacementSuggestion(
        NutritionMealReplacementSuggestion $suggestion,
        ?TenantUser $actor = null,
        array $usage = [],
        array $meta = [],
    ): ?NutritionTokenLedger {
        $amount = $this->usageTotalTokens($usage);
        if ($amount <= 0) {
            return null;
        }

        $subject = TenantUser::query()->find($suggestion->user_id);
        $dietRequest = $suggestion->nutrition_diet_request_id
            ? NutritionDietRequest::query()->find($suggestion->nutrition_diet_request_id)
            : null;

        return $this->debitTokens(
            amount: $amount,
            actor: $actor,
            subject: $subject,
            eventType: 'diet_request_ai',
            reasonTitle: 'مصرف واقعی توکن برای جایگزینی غذا با AI',
            reasonCode: 'meal_replacement_ai',
            dietRequest: $dietRequest,
            meta: array_merge([
                'operation_type' => 'meal_replacement',
                'slot_title' => $suggestion->slot_title,
                'meal_slot_key' => $suggestion->meal_slot_key,
                'source_type' => $suggestion->source_type,
                'suggestion_id' => $suggestion->id,
                'day_number' => $suggestion->day_number,
                'meal_index' => $suggestion->meal_index,
                'diet_template_name' => $dietRequest?->diet_template_name,
                'usage' => [
                    'prompt_tokens' => max(0, (int) ($usage['promptTokens'] ?? 0)),
                    'completion_tokens' => max(0, (int) ($usage['completionTokens'] ?? 0)),
                    'total_tokens' => $amount,
                ],
            ], $meta),
        );
    }

    public function debitForManualMealNutrition(
        NutritionDietRequest $request,
        ?TenantUser $actor = null,
        array $usage = [],
        array $meta = [],
    ): ?NutritionTokenLedger {
        if ($request->request_type !== 'ai') {
            return null;
        }

        $amount = $this->usageTotalTokens($usage);
        if ($amount <= 0) {
            return null;
        }

        return $this->debitTokens(
            amount: $amount,
            actor: $actor,
            subject: $request->user,
            eventType: 'diet_request_ai',
            reasonTitle: 'مصرف واقعی توکن برای محاسبه غذای خارج از برنامه با AI',
            reasonCode: 'manual_meal_nutrition_ai',
            dietRequest: $request,
            meta: array_merge([
                'operation_type' => 'manual_meal_nutrition',
                'request_type' => $request->request_type,
                'diet_template_name' => $request->diet_template_name,
                'usage' => [
                    'prompt_tokens' => max(0, (int) ($usage['promptTokens'] ?? 0)),
                    'completion_tokens' => max(0, (int) ($usage['completionTokens'] ?? 0)),
                    'total_tokens' => $amount,
                ],
            ], $meta),
        );
    }

    private function usageTotalTokens(array $usage): int
    {
        return max(0, (int) ($usage['totalTokens'] ?? 0));
    }

    private function applySearch(Builder $query, string $search): Builder
    {
        $search = trim($search);

        if ($search === '') {
            return $query;
        }

        $query->where(function (Builder $builder) use ($search): void {
            $builder->where('reason_title', 'like', '%' . $search . '%')
                ->orWhere('event_type', 'like', '%' . $search . '%')
                ->orWhere('reason_code', 'like', '%' . $search . '%')
                ->orWhereHas('subject', function (Builder $subjectQuery) use ($search): void {
                    $subjectQuery->where('name', 'like', '%' . $search . '%')
                        ->orWhere('mobile', 'like', '%' . $search . '%');
                })
                ->orWhereHas('actor', function (Builder $actorQuery) use ($search): void {
                    $actorQuery->where('name', 'like', '%' . $search . '%')
                        ->orWhere('mobile', 'like', '%' . $search . '%');
                })
                ->orWhereHas('dietRequest', function (Builder $requestQuery) use ($search): void {
                    $requestQuery->where('diet_template_name', 'like', '%' . $search . '%');
                })
                ->orWhereRaw('JSON_UNQUOTE(JSON_EXTRACT(meta_json, "$.slot_title")) like ?', ['%' . $search . '%']);
        });

        return $query;
    }

    private function debitTokens(
        int $amount,
        ?TenantUser $actor,
        ?TenantUser $subject,
        string $eventType,
        string $reasonTitle,
        ?string $reasonCode,
        ?NutritionDietRequest $dietRequest,
        array $meta = [],
    ): NutritionTokenLedger {
        if ($amount <= 0) {
            throw new RuntimeException('مقدار مصرف توکن معتبر نیست.');
        }

        $ledger = DB::transaction(function () use ($actor, $subject, $eventType, $reasonTitle, $reasonCode, $dietRequest, $meta, $amount): NutritionTokenLedger {
            $wallet = NutritionTokenWallet::query()->lockForUpdate()->firstOrCreate(['id' => 1]);
            $balanceBefore = (int) $wallet->balance_tokens;
            if ($balanceBefore < $amount) {
                throw new RuntimeException('موجودی توکن شما کافی نیست.');
            }

            $balanceAfter = $balanceBefore - $amount;
            $wallet->forceFill([
                'balance_tokens' => $balanceAfter,
                'used_tokens' => (int) $wallet->used_tokens + $amount,
            ])->save();

            return NutritionTokenLedger::query()->create([
                'nutrition_token_wallet_id' => $wallet->id,
                'actor_user_id' => $actor?->id,
                'subject_user_id' => $subject?->id,
                'nutrition_diet_request_id' => $dietRequest?->id,
                'tokens_amount' => $amount,
                'direction' => 'debit',
                'event_type' => $eventType,
                'balance_after' => $balanceAfter,
                'reason_title' => $reasonTitle,
                'reason_code' => $reasonCode,
                'meta_json' => $meta,
                'occurred_at' => now(),
            ]);
        });

        $this->syncTokenAlertState((int) $ledger->balance_after);

        return $ledger;
    }

    private function syncTokenAlertState(int $balance): void
    {
        try {
            app(NutritionTokenAlertService::class)->sendIfNeeded($balance);
        } catch (Throwable) {
            // Token usage must not fail if a notification SMS cannot be prepared.
        }
    }
}
