<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Tenant\Models\SmsOutbound;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Services\Sms\SmsDispatchService;
use App\Support\SmsQueue;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendSmsOutboundJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly string $tenantId,
        public readonly int $outboundId,
        public readonly bool $allowNegativeBalance = false,
        public readonly string $queueName = SmsQueue::TRANSACTIONAL,
    ) {
        $this->onQueue($this->queueName);
    }

    public function handle(SmsDispatchService $dispatch): void
    {
        $tenant = Tenant::query()->find($this->tenantId);

        if (! $tenant) {
            return;
        }

        $tenant->run(function () use ($dispatch): void {
            $outbound = SmsOutbound::query()->find($this->outboundId);

            if (! $outbound || $outbound->status !== 'pending') {
                return;
            }

            $setting = SmsSetting::query()->first();

            if (! $setting) {
                $outbound->update([
                    'status' => 'failed',
                    'error_message' => 'تنظیمات پیامک این سامانه یافت نشد.',
                ]);

                return;
            }

            $dispatch->sendOutbound($outbound, $setting, [
                'provider' => $outbound->provider,
                'sender' => $outbound->sender,
                'allow_negative_balance' => $this->allowNegativeBalance,
            ]);
        });
    }
}
