<?php

declare(strict_types=1);

namespace App\Support;

class NutritionMedicalConditionSupport
{
    /**
     * @param mixed $value
     * @return array<int, array{
     *   id: string,
     *   title: string,
     *   status: string,
     *   startedAt: string|null,
     *   endedAt: string|null,
     *   ongoing: bool,
     *   notes: string|null
     * }>
     */
    public static function parseEntries(mixed $value): array
    {
        if (is_array($value)) {
            return self::normalizeEntries($value);
        }

        $text = trim((string) $value);

        if ($text === '') {
            return [];
        }

        $decoded = json_decode($text, true);

        if (is_array($decoded)) {
            return self::normalizeEntries($decoded);
        }

        return [[
            'id' => 'legacy-1',
            'title' => $text,
            'status' => 'current',
            'startedAt' => null,
            'endedAt' => null,
            'ongoing' => true,
            'notes' => null,
        ]];
    }

    /**
     * @param array<int, mixed> $entries
     * @return array<int, array{
     *   id: string,
     *   title: string,
     *   status: string,
     *   startedAt: string|null,
     *   endedAt: string|null,
     *   ongoing: bool,
     *   notes: string|null
     * }>
     */
    public static function normalizeEntries(array $entries): array
    {
        $normalized = [];

        foreach ($entries as $index => $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $title = self::cleanText($entry['title'] ?? null);

            if ($title === null) {
                continue;
            }

            $status = self::normalizeStatus($entry['status'] ?? null);
            $startedAt = self::normalizeDate($entry['startedAt'] ?? $entry['started_at'] ?? null);
            $ongoing = $status === 'past' ? false : self::toBool($entry['ongoing'] ?? ($status === 'current'));
            $endedAt = $ongoing ? null : self::normalizeDate($entry['endedAt'] ?? $entry['ended_at'] ?? null);
            $notes = self::cleanText($entry['notes'] ?? null);

            $normalized[] = [
                'id' => self::cleanText($entry['id'] ?? null) ?? ('condition-' . ($index + 1)),
                'title' => $title,
                'status' => $status,
                'startedAt' => $startedAt,
                'endedAt' => $endedAt,
                'ongoing' => $status === 'past' ? false : $ongoing,
                'notes' => $notes,
            ];
        }

        return array_values($normalized);
    }

    /**
     * @param array<int, mixed> $entries
     */
    public static function encodeEntries(array $entries): ?string
    {
        $normalized = self::normalizeEntries($entries);

        if ($normalized === []) {
            return null;
        }

        return json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: null;
    }

    /**
     * @param array<int, mixed> $entries
     */
    public static function summarizeEntries(array $entries): ?string
    {
        $normalized = self::normalizeEntries($entries);

        if ($normalized === []) {
            return null;
        }

        $parts = array_map(function (array $entry): string {
            $statusLabel = match ($entry['status']) {
                'past' => 'قبلی',
                'temporary' => 'موقت',
                default => 'فعلی',
            };

            $timing = [];

            if ($entry['startedAt']) {
                $timing[] = 'از ' . $entry['startedAt'];
            }

            if ($entry['endedAt']) {
                $timing[] = 'تا ' . $entry['endedAt'];
            } elseif ((bool) $entry['ongoing']) {
                $timing[] = 'ادامه‌دار';
            }

            $notes = $entry['notes'] ? ' - ' . $entry['notes'] : '';
            $timingText = $timing !== [] ? ' (' . implode('، ', $timing) . ')' : '';

            return $entry['title'] . ' [' . $statusLabel . ']' . $timingText . $notes;
        }, $normalized);

        return implode(' | ', $parts);
    }

    private static function cleanText(mixed $value): ?string
    {
        $text = preg_replace('/\s+/u', ' ', trim((string) $value)) ?: '';

        return $text !== '' ? $text : null;
    }

    private static function normalizeDate(mixed $value): ?string
    {
        $text = self::cleanText($value);

        if ($text === null) {
            return null;
        }

        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $text) === 1 ? $text : null;
    }

    private static function normalizeStatus(mixed $value): string
    {
        $status = self::cleanText($value) ?? 'current';

        return in_array($status, ['current', 'past', 'temporary'], true) ? $status : 'current';
    }

    private static function toBool(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        return in_array(strtolower(trim((string) $value)), ['1', 'true', 'yes', 'on'], true);
    }
}
