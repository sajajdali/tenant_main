<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Tenant\Models\Tenant;
use App\Services\CustomerFeedbackService;
use Illuminate\Console\Command;

class SendCustomerFeedbackInvitations extends Command
{
    protected $signature = 'feedback:send-invitations';

    protected $description = 'Send due customer feedback invitations for tenants.';

    public function handle(CustomerFeedbackService $service): int
    {
        $sent = 0;

        Tenant::query()->orderBy('id')->chunk(100, function ($tenants) use (&$sent, $service): void {
            foreach ($tenants as $tenant) {
                $tenant->run(function () use (&$sent, $service): void {
                    $sent += $service->processDueInvitations();
                });
            }
        });

        $this->info("Customer feedback invitations processed. Sent: {$sent}");

        return self::SUCCESS;
    }
}
