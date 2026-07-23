<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Stancl\Tenancy\Database\Models\Domain as BaseDomain;

class Domain extends BaseDomain
{
    protected $fillable = [
        'domain',
        'tenant_id',
    ];
}
