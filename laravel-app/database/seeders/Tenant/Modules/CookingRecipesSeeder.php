<?php

declare(strict_types=1);

namespace Database\Seeders\Tenant\Modules;

use App\Domain\Tenant\Models\CookingRecipe;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use RuntimeException;

class CookingRecipesSeeder extends Seeder
{
    private const BATCH_SIZE = 100;

    private const EXPECTED_HEADERS = [
        'title',
        'url',
        'servings',
        'ingredients',
        'instructions',
        'nutrition',
        'scrapedAt',
        'ingredients_json',
        'instructions_json',
        'micronutrients',
    ];

    public function run(): void
    {
        $path = database_path('seeders/data/cooking-recipes.csv');
        $handle = fopen($path, 'rb');

        if ($handle === false) {
            throw new RuntimeException("Cooking recipes seed data is not readable: {$path}");
        }

        try {
            $headers = fgetcsv($handle, null, ',', '"', '\\');

            if (! is_array($headers)) {
                throw new RuntimeException('Cooking recipes seed data has no CSV header.');
            }

            $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $headers[0]) ?? (string) $headers[0];

            if ($headers !== self::EXPECTED_HEADERS) {
                throw new RuntimeException('Cooking recipes seed data headers do not match the expected schema.');
            }

            $batch = [];
            $imported = 0;

            while (($row = fgetcsv($handle, null, ',', '"', '\\')) !== false) {
                if ($row === [null] || $row === []) {
                    continue;
                }

                $batch[] = $this->normalizeRow($row, $imported + count($batch) + 1);

                if (count($batch) >= self::BATCH_SIZE) {
                    $this->upsertBatch($batch);
                    $imported += count($batch);
                    $batch = [];
                }
            }

            if ($batch !== []) {
                $this->upsertBatch($batch);
                $imported += count($batch);
            }

            $this->command?->info("Imported {$imported} cooking recipes.");
        } finally {
            fclose($handle);
        }
    }

    /** @param array<int, string|null> $row */
    private function normalizeRow(array $row, int $position): array
    {
        $data = count($row) === count(self::EXPECTED_HEADERS)
            ? array_combine(self::EXPECTED_HEADERS, $row)
            : $this->recoverMalformedRow($row);

        if (! is_array($data)) {
            throw new RuntimeException('Unable to normalize a cooking recipe CSV row.');
        }

        $title = trim((string) ($data['title'] ?? ''));
        $sourceUrl = trim((string) ($data['url'] ?? ''));

        if ($title === '' || $sourceUrl === '') {
            throw new RuntimeException('Every cooking recipe must have a title and source URL.');
        }

        $nutrition = $this->decodeJsonObject($data['nutrition'] ?? null);
        $micronutrients = $this->decodeJsonObject($data['micronutrients'] ?? null)
            ?? (is_array($nutrition['micronutrients_perServing'] ?? null) ? $nutrition['micronutrients_perServing'] : null);
        $ingredientsJson = $this->decodeJsonList($data['ingredients_json'] ?? null)
            ?? $this->lines((string) ($data['ingredients'] ?? ''));
        $instructionsJson = $this->decodeJsonList($data['instructions_json'] ?? null)
            ?? $this->instructionLines((string) ($data['instructions'] ?? ''));
        $now = now();

        return [
            'title' => $title,
            'slug' => $this->slug($title, $sourceUrl),
            'description' => null,
            'servings' => $this->servings((string) ($data['servings'] ?? ''), $nutrition),
            'ingredients' => trim((string) ($data['ingredients'] ?? '')) ?: null,
            'ingredients_json' => $this->encodeJson($ingredientsJson),
            'instructions' => trim((string) ($data['instructions'] ?? '')) ?: null,
            'instructions_json' => $this->encodeJson($instructionsJson),
            'nutrition' => $nutrition === null ? null : $this->encodeJson($nutrition),
            'micronutrients' => $micronutrients === null ? null : $this->encodeJson($micronutrients),
            'is_published' => true,
            'is_active' => true,
            'sort_order' => $position,
            'flags' => $this->encodeJson([]),
            'metadata' => $this->encodeJson([
                'source_url' => $sourceUrl,
                'scraped_at' => trim((string) ($data['scrapedAt'] ?? '')) ?: null,
                'imported_by' => self::class,
            ]),
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    /**
     * Three source rows contain invalid CSV quoting. Their first text fields
     * and trailing structured fields are still recoverable without dropping
     * the recipe or aborting the complete import.
     *
     * @param array<int, string|null> $row
     * @return array<string, string|null>
     */
    private function recoverMalformedRow(array $row): array
    {
        $scrapedAtIndex = null;

        foreach ($row as $index => $value) {
            if (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}T/', $value) === 1) {
                $scrapedAtIndex = $index;
                break;
            }
        }

        if ($scrapedAtIndex === null || $scrapedAtIndex < 6) {
            throw new RuntimeException('Unable to recover malformed cooking recipe CSV row.');
        }

        return [
            'title' => $row[0] ?? null,
            'url' => $row[1] ?? null,
            'servings' => $row[2] ?? null,
            'ingredients' => $row[3] ?? null,
            'instructions' => $row[4] ?? null,
            'nutrition' => $this->isValidJsonObject($row[5] ?? null) ? $row[5] : null,
            'scrapedAt' => $row[$scrapedAtIndex] ?? null,
            'ingredients_json' => $row[$scrapedAtIndex + 1] ?? null,
            'instructions_json' => $row[$scrapedAtIndex + 2] ?? null,
            'micronutrients' => $this->isValidJsonObject($row[array_key_last($row)] ?? null)
                ? $row[array_key_last($row)]
                : null,
        ];
    }

    /** @param array<int, array<string, mixed>> $batch */
    private function upsertBatch(array $batch): void
    {
        CookingRecipe::query()->upsert(
            $batch,
            ['slug'],
            [
                'title',
                'description',
                'servings',
                'ingredients',
                'ingredients_json',
                'instructions',
                'instructions_json',
                'nutrition',
                'micronutrients',
                'metadata',
                'updated_at',
            ],
        );
    }

    /** @return array<string, mixed>|null */
    private function decodeJsonObject(mixed $value): ?array
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        $decoded = json_decode($value, true);

        return json_last_error() === JSON_ERROR_NONE && is_array($decoded) ? $decoded : null;
    }

    /** @return array<int, string>|null */
    private function decodeJsonList(mixed $value): ?array
    {
        $decoded = $this->decodeJsonObject($value);

        if ($decoded === null || ! array_is_list($decoded)) {
            return null;
        }

        return array_values(array_filter(array_map(
            static fn (mixed $item): string => trim((string) $item),
            $decoded,
        ), static fn (string $item): bool => $item !== ''));
    }

    private function isValidJsonObject(mixed $value): bool
    {
        return $this->decodeJsonObject($value) !== null;
    }

    /** @return array<int, string> */
    private function lines(string $value): array
    {
        return array_values(array_filter(array_map(
            static fn (string $line): string => trim($line),
            preg_split('/\R/u', $value) ?: [],
        ), static fn (string $line): bool => $line !== ''));
    }

    /** @return array<int, string> */
    private function instructionLines(string $value): array
    {
        return array_map(
            static fn (string $line): string => preg_replace('/^\s*[0-9۰-۹]+[.\-)،:]?\s*/u', '', $line) ?? $line,
            $this->lines($value),
        );
    }

    /** @param array<string, mixed>|null $nutrition */
    private function servings(string $value, ?array $nutrition): int
    {
        $normalized = strtr($value, [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);
        preg_match_all('/\d+/', $normalized, $matches);
        $numbers = $matches[0] ?? [];
        $servings = $numbers === [] ? (int) ($nutrition['servings'] ?? 1) : (int) end($numbers);

        return max(1, min(65535, $servings));
    }

    private function slug(string $title, string $sourceUrl): string
    {
        $base = Str::slug($title) ?: 'recipe';

        return mb_substr($base, 0, 220).'-'.substr(sha1($sourceUrl), 0, 12);
    }

    private function encodeJson(array $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
}
