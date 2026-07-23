<?php

declare(strict_types=1);

use App\Domain\Tenant\Models\GeneralSetting;
use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('articles_tags')) {
            Schema::create('articles_tags', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 120);
                $table->string('slug', 160)->unique();
                $table->timestamps();
            });
        }

        $generalSetting = GeneralSetting::query()->first();

        if (! $generalSetting) {
            return;
        }

        $rules = is_array($generalSetting->booking_rules) ? $generalSetting->booking_rules : [];
        $articlesPage = is_array($rules['articles_page'] ?? null) ? $rules['articles_page'] : [];
        $legacyTags = $articlesPage['tags'] ?? null;

        if (is_array($legacyTags) && $legacyTags !== []) {
            $existingSlugs = DB::table('articles_tags')->pluck('slug')->map(fn ($slug) => (string) $slug)->all();

            foreach ($legacyTags as $legacyTag) {
                if (! is_array($legacyTag)) {
                    continue;
                }

                $name = trim((string) ($legacyTag['name'] ?? ''));
                $rawSlug = trim((string) ($legacyTag['slug'] ?? ''));

                if ($name === '' && $rawSlug === '') {
                    continue;
                }

                $slug = $this->ensureUniqueSlug(
                    $this->normalizeSlug($rawSlug !== '' ? $rawSlug : $name),
                    $existingSlugs,
                );

                $timestamp = $this->normalizeTimestamp($legacyTag['created_at'] ?? null);

                DB::table('articles_tags')->insert([
                    'name' => $name !== '' ? $name : $slug,
                    'slug' => $slug,
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ]);

                $existingSlugs[] = $slug;
            }
        }

        if (array_key_exists('tags', $articlesPage)) {
            unset($articlesPage['tags']);
            $rules['articles_page'] = $articlesPage;

            $generalSetting->update([
                'booking_rules' => $rules,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('articles_tags');
    }

    private function normalizeSlug(string $value): string
    {
        $slug = trim(mb_strtolower($value, 'UTF-8'));
        $slug = preg_replace('/[^\pL\pN]+/u', '-', $slug) ?? '';
        $slug = trim($slug, '-');

        return $slug !== '' ? $slug : 'tag';
    }

    private function ensureUniqueSlug(string $slug, array $existingSlugs): string
    {
        if (! in_array($slug, $existingSlugs, true)) {
            return $slug;
        }

        $counter = 2;

        while (in_array($slug . '-' . $counter, $existingSlugs, true)) {
            $counter++;
        }

        return $slug . '-' . $counter;
    }

    private function normalizeTimestamp(mixed $value): string
    {
        if (! is_string($value) || trim($value) === '') {
            return now()->toDateTimeString();
        }

        try {
            return CarbonImmutable::parse($value)->toDateTimeString();
        } catch (\Throwable) {
            return now()->toDateTimeString();
        }
    }
};
