<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Events\SmsCampaignUpdated;
use App\Domain\Tenant\Models\SmsCampaign;
use App\Domain\Tenant\Models\SmsCampaignRecipient;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Jobs\SendSmsCampaignJob;
use App\Services\Sms\SmsDispatchService;
use App\Services\SmsCampaignAudienceService;
use App\Support\SmsPricing;
use App\Support\SmsQueue;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

class PrepareSmsCampaignJob implements ShouldQueue
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

    public function handle(SmsCampaignAudienceService $audienceService, SmsDispatchService $dispatch): void
    {
        $tenant = Tenant::query()->find($this->tenantId);

        if (! $tenant) {
            return;
        }

        $tenant->run(function () use ($audienceService, $dispatch): void {
            /** @var SmsCampaign|null $campaign */
            $campaign = SmsCampaign::query()->find($this->campaignId);

            if (! $campaign || $campaign->status !== 'queued') {
                return;
            }

            $smsSetting = SmsSetting::query()->first();

            if (! $smsSetting || ! $smsSetting->enabled || ! $smsSetting->provider) {
                $campaign->update([
                    'status' => 'failed',
                    'last_error' => 'سرویس پیامک برای این سامانه فعال یا پیکربندی نشده است.',
                ]);
                event(new SmsCampaignUpdated($this->tenantId, $this->transformCampaign($campaign->fresh())));

                return;
            }

            $campaign->update([
                'status' => 'draft',
                'last_error' => null,
                'started_at' => null,
                'finished_at' => null,
                'cancelled_at' => null,
                'sent_count' => 0,
                'success_count' => 0,
                'failed_count' => 0,
                'cancelled_count' => 0,
                'spent_total_price' => 0,
            ]);
            event(new SmsCampaignUpdated($this->tenantId, $this->transformCampaign($campaign->fresh())));

            $filters = is_array($campaign->filters) ? $campaign->filters : [];
            $recipients = $audienceService->recipients($filters);
            $provider = (string) $smsSetting->provider;
            $sender = (string) ($smsSetting->credentials['sender'] ?? '');

            DB::transaction(function () use ($campaign, $recipients, $dispatch, $provider, $sender): void {
                SmsCampaignRecipient::query()->where('campaign_id', $campaign->id)->delete();
                \App\Domain\Tenant\Models\SmsOutbound::query()->where('campaign_id', $campaign->id)->delete();

                $now = now();
                $recipientRows = [];
                $totalEstimatedPrice = 0;

                foreach ($recipients as $recipient) {
                    $renderedMessage = $this->renderMessage(
                        (string) $campaign->message,
                        $recipient['customer_name'] ?? null,
                    );
                    $pricing = SmsPricing::analyze($renderedMessage);
                    $totalEstimatedPrice += (int) $pricing['total_price'];

                    $recipientRows[] = [
                        'campaign_id' => $campaign->id,
                        'customer_phone' => $recipient['customer_phone'],
                        'customer_name' => $recipient['customer_name'] ?? null,
                        'last_barber_id' => $recipient['last_barber_id'] ?? null,
                        'last_barber_name' => $recipient['last_barber_name'] ?? null,
                        'last_service_id' => $recipient['last_service_id'] ?? null,
                        'last_service_name' => $recipient['last_service_name'] ?? null,
                        'last_appointment_at' => $recipient['last_appointment_at'] ?? null,
                        'first_appointment_at' => $recipient['first_appointment_at'] ?? null,
                        'appointments_count' => $recipient['appointments_count'] ?? 0,
                        'message_encoding' => $pricing['encoding'],
                        'message_parts_count' => $pricing['parts_count'],
                        'unit_price' => $pricing['unit_price'],
                        'status' => 'pending',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];

                    $dispatch->queue([
                        'campaign_id' => $campaign->id,
                        'type' => 'campaign',
                        'template_key' => $filters['preset'] ?? null,
                        'provider' => $provider,
                        'sender' => $sender,
                        'recipient_mobile' => $recipient['customer_phone'],
                        'recipient_name' => $recipient['customer_name'] ?? null,
                        'message' => $renderedMessage,
                        'status' => 'pending',
                    ]);
                }

                foreach (array_chunk($recipientRows, 500) as $chunk) {
                    SmsCampaignRecipient::query()->insert($chunk);
                }

                $campaign->update([
                    'status' => 'queued',
                    'recipients_count' => count($recipientRows),
                    'estimated_total_price' => $totalEstimatedPrice,
                ]);
            });

            $campaign->refresh();
            event(new SmsCampaignUpdated($this->tenantId, $this->transformCampaign($campaign)));
            SendSmsCampaignJob::dispatch($this->tenantId, $campaign->id);
        });
    }

    private function renderMessage(string $message, ?string $customerName): string
    {
        $name = trim((string) ($customerName ?? ''));

        return str_replace('{{customer_name}}', $name !== '' ? $name : 'مشتری عزیز', $message);
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
        ];
    }
}
