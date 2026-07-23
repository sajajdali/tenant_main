<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;

class ArticleTag extends Model
{
    protected $table = 'articles_tags';

    protected $fillable = [
        'name',
        'slug',
    ];
}
