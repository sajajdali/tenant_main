<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Events\SmsCampaignUpdated;
use App\Domain\Tenant\Models\SmsCampaign;
use App\Domain\Tenant\Models\SmsCampaignRecipient;
use App\Domain\Tenant\Models\SmsOutbound;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Services\Sms\SmsCreditService;
use App\Services\Sms\SmsDispatchService;
use App\Support\SmsQueue;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

class SendSmsCampaignJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly string $tenantId,
        public readonly int $campaignId,
    ) {
        $this->onQueue(SmsQueue::CAMPAIGN);
    }

    public function handle(SmsDispatchService $dispatch, SmsCreditService $credits): void
    {
        $tenant = Tenant::query()->find($this->tenantId);

        if (! $tenant) {
            return;
        }

        $tenant->run(function () use ($dispatch, $credits): void {
            /** @var SmsCampaign|null $campaign */
            $campaign = SmsCampaign::query()->find($this->campaignId);

            if (! $campaign || in_array($campaign->status, ['cancelled', 'completed', 'pending_review', 'rejected', 'draft', 'paused'], true)) {
                return;
            }

            if ($campaign->status !== 'queued') {
                return;
            }

            $setting = SmsSetting::query()->first();

            if (! $setting || ! $setting->enabled || ! $setting->provider) {
                $campaign->update([
                    'status' => 'failed',
                    'last_error' => 'سرویس پیامک برای این آرایشگاه فعال یا پیکربندی نشده است.',
                    'finished_at' => now(),
                ]);
                $campaign->refresh();
                event(new SmsCampaignUpdated($this->tenantId, $this->transformCampaign($campaign)));

                return;
            }

            $campaign->update([
                'status' => 'sending',
                'started_at' => $campaign->started_at ?? now(),
                'last_error' => null,
            ]);
            $campaign->refresh();
            event(new SmsCampaignUpdated($this->tenantId, $this->transformCampaign($campaign)));

            while (true) {
                $campaign->refresh();

                if ($campaign->status === 'paused') {
                    $this->refreshStats($campaign);
                    $campaign->refresh();
                    event(new SmsCampaignUpdated($this->tenantId, $this->transformCampaign($campaign)));

                    return;
                }

                if ($campaign->status === 'cancelled') {
                    SmsCampaignRecipient::query()
                        ->where('campaign_id', $campaign->id)
                        ->where('status', 'pending')
                        ->update([
                            'status' => 'cancelled',
                            'updated_at' => now(),
                        ]);

                    SmsOutbound::query()
                        ->where('campaign_id', $campaign->id)
                        ->where('status', 'pending')
                        ->update([
                            'status' => 'cancelled',
                            'updated_at' => now(),
                        ]);

                    $this->refreshStats($campaign);
                    $campaign->update(['finished_at' => now()]);
                    $campaign->refresh();
                    event(new SmsCampaignUpdated($this->tenantId, $this->transformCampaign($campaign)));

                    return;
                }

                $batch = SmsOutbound::query()
                    ->where('campaign_id', $campaign->id)
                    ->where('status', 'pending')
                    ->orderBy('id')
                    ->limit(50)
                    ->get();

                if ($batch->isEmpty()) {
                    $this->refreshStats($campaign);
                    $campaign->refresh();

                    $campaign->update([
                        'status' => $campaign->status === 'cancelled' ? 'cancelled' : 'completed',
                        'finished_at' => now(),
                    ]);

                    $campaign->refresh();
                    event(new SmsCampaignUpdated($this->tenantId, $this->transformCampaign($campaign)));

                    return;
                }

                foreach ($batch as $outbound) {
                    $campaign->refresh();

                    if ($campaign->status === 'paused') {
                        $this->refreshStats($campaign);
                        $campaign->refresh();
                        event(new SmsCampaignUpdated($this->tenantId, $this->transformCampaign($campaign)));

                        return;
                    }

                    if ($campaign->status === 'cancelled') {
                        break;
                    }

                    $setting->refresh();

                    if ($credits->balance($setting) < (int) $outbound->total_price) {
                        $this->pauseCampaignForExhaustedCredit($campaign);
                        $campaign->refresh();
                        event(new SmsCampaignUpdated($this->tenantId, $this->transformCampaign($campaign)));

                        return;
                    }

                    try {
                        $result = $dispatch->sendOutbound($outbound, $setting);
                        $outbound = $result['outbound'] ?? $outbound->fresh();

                        if (($result['ok'] ?? false) === false && $this->isCreditExhaustedMessage((string) ($result['message'] ?? ''))) {
                            $this->pauseCampaignForExhaustedCredit($campaign);
                            $campaign->refresh();
                            event(new SmsCampaignUpdated($this->tenantId, $this->transformCampaign($campaign)));

                            return;
                        }

                        SmsCampaignRecipient::query()
                            ->where('campaign_id', $campaign->id)
                            ->where('customer_phone', $outbound->recipient_mobile)
                            ->where('status', 'pending')
                            ->limit(1)
                            ->update([
                                'status' => $outbound->status,
                                'provider_message_id' => $outbound->provider_message_id,
                                'error_message' => $outbound->error_message,
                                'sent_at' => $outbound->sent_at,
                                'updated_at' => now(),
                            ]);
                    } catch (Throwable $exception) {
                        $outbound->update([
                            'status' => 'failed',
                            'error_message' => $exception->getMessage(),
                        ]);

                        if ($this->isCreditExhaustedMessage($exception->getMessage())) {
                            $this->pauseCampaignForExhaustedCredit($campaign);
                            $campaign->refresh();
                            event(new SmsCampaignUpdated($this->tenantId, $this->transformCampaign($campaign)));

                            return;
                        }

                        SmsCampaignRecipient::query()
                            ->where('campaign_id', $campaign->id)
                            ->where('customer_phone', $outbound->recipient_mobile)
                            ->where('status', 'pending')
                            ->limit(1)
                            ->update([
                                'status' => 'failed',
                                'error_message' => $exception->getMessage(),
                                'updated_at' => now(),
                            ]);
                    }
                }

                $this->refreshStats($campaign);
                $campaign->refresh();
                event(new SmsCampaignUpdated($this->tenantId, $this->transformCampaign($campaign)));
            }
        });
    }

    private function refreshStats(SmsCampaign $campaign): void
    {
        $stats = SmsOutbound::query()
            ->where('campaign_id', $campaign->id)
            ->selectRaw("
                COUNT(*) as recipients_count,
                SUM(CASE WHEN status IN ('sent', 'failed', 'cancelled') THEN 1 ELSE 0 END) as sent_count,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
                SUM(CASE WHEN status = 'sent' THEN total_price ELSE 0 END) as spent_total_price
            ")
            ->first();

        $campaign->update([
            'recipients_count' => (int) ($stats?->recipients_count ?? 0),
            'sent_count' => (int) ($stats?->sent_count ?? 0),
            'success_count' => (int) ($stats?->success_count ?? 0),
            'failed_count' => (int) ($stats?->failed_count ?? 0),
            'cancelled_count' => (int) ($stats?->cancelled_count ?? 0),
            'spent_total_price' => (int) ($stats?->spent_total_price ?? 0),
        ]);
    }

    private function pauseCampaignForExhaustedCredit(SmsCampaign $campaign): void
    {
        $message = 'شارژ پرتال پیامک شما تمام شد.';

        $this->refreshStats($campaign);

        $campaign->update([
            'status' => 'paused',
            'last_error' => $message,
            'finished_at' => now(),
        ]);
    }

    private function isCreditExhaustedMessage(string $message): bool
    {
        $normalized = trim($message);

        return $normalized === 'شارژ پیامک کافی نیست.' || $normalized === 'شارژ پرتال پیامک شما تمام شد.';
    }

    private function transformCampaign(SmsCampaign $campaign): array
    {
        return [
            'id' => (string) $campaign->id,
            'name' => $campaign->name,
            'presetKey' => $campaign->preset_key,
            'status' => $campaign->status,
            'message' => $campaign->message,
            'messageEncoding' => $campaign->message_encoding,
            'messageCharactersCount' => (int) $campaign->message_characters_count,
            'messagePartsCount' => (int) $campaign->message_parts_count,
            'unitPrice' => (int) $campaign->unit_price,
            'estimatedTotalPrice' => (int) $campaign->estimated_total_price,
            'spentTotalPrice' => (int) $campaign->spent_total_price,
            'filters' => $campaign->filters ?? [],
            'recipientsCount' => (int) $campaign->recipients_count,
            'sentCount' => (int) $campaign->sent_count,
            'successCount' => (int) $campaign->success_count,
            'failedCount' => (int) $campaign->failed_count,
            'cancelledCount' => (int) $campaign->cancelled_count,
            'createdAt' => $campaign->created_at?->toISOString(),
            'startedAt' => $campaign->started_at?->toISOString(),
            'finishedAt' => $campaign->finished_at?->toISOString(),
            'cancelledAt' => $campaign->cancelled_at?->toISOString(),
            'lastError' => $campaign->last_error,
            'createdByName' => null,
            'createdByPhone' => null,
        ];
    }
}
