<?php

declare(strict_types=1);

namespace App\Support\Concerns;

use App\Support\TenantAudienceScope;

trait ChecksNutritionAudience
{
    private function isNutritionAudience(): bool
    {
        return TenantAudienceScope::currentTenantUsesNutrition();
    }
}
