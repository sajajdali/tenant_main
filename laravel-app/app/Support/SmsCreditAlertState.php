<?php

declare(strict_types=1);

namespace App\Support;

class SmsCreditAlertState
{
    /**
     * @return array<string, int>
     */
    public static function thresholds(): array
    {
        return [
            'threshold_50000' => 50000,
            'threshold_10000' => 10000,
            'threshold_zero' => 0,
        ];
    }

    /**
     * @param  array<string, mixed>  $state
     * @return array{sent_thresholds: array<string, string>}
     */
    public static function normalize(array $state): array
    {
        $sentThresholds = [];

        foreach (array_keys(static::thresholds()) as $key) {
            $value = trim((string) ($state['sent_thresholds'][$key] ?? ''));

            if ($value !== '') {
                $sentThresholds[$key] = $value;
            }
        }

        return [
            'sent_thresholds' => $sentThresholds,
        ];
    }

    public static function applicableThresholdKey(int $balance): ?string
    {
        if ($balance <= 0) {
            return 'threshold_zero';
        }

        if ($balance <= 10000) {
            return 'threshold_10000';
        }

        if ($balance <= 50000) {
            return 'threshold_50000';
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $state
     * @return array{sent_thresholds: array<string, string>}
     */
    public static function resetForBalance(array $state, int $balance): array
    {
        $normalized = static::normalize($state);
        $sentThresholds = $normalized['sent_thresholds'];

        foreach (static::thresholds() as $key => $threshold) {
            if ($balance > $threshold) {
                unset($sentThresholds[$key]);
            }
        }

        return [
            'sent_thresholds' => $sentThresholds,
        ];
    }

    /**
     * @param  array<string, mixed>  $state
     * @return array{sent_thresholds: array<string, string>}
     */
    public static function markTriggered(array $state, int $balance): array
    {
        $normalized = static::normalize($state);
        $sentThresholds = $normalized['sent_thresholds'];
        $timestamp = now()->toISOString();

        foreach (static::keysSatisfiedByBalance($balance) as $key) {
            $sentThresholds[$key] = $timestamp;
        }

        return [
            'sent_thresholds' => $sentThresholds,
        ];
    }

    /**
     * @param  array<string, mixed>  $state
     */
    public static function alreadySent(array $state, string $key): bool
    {
        $normalized = static::normalize($state);

        return isset($normalized['sent_thresholds'][$key]);
    }

    /**
     * @return array<int, string>
     */
    private static function keysSatisfiedByBalance(int $balance): array
    {
        if ($balance <= 0) {
            return ['threshold_50000', 'threshold_10000', 'threshold_zero'];
        }

        if ($balance <= 10000) {
            return ['threshold_50000', 'threshold_10000'];
        }

        if ($balance <= 50000) {
            return ['threshold_50000'];
        }

        return [];
    }
}
