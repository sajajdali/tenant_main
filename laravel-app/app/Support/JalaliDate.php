<?php

declare(strict_types=1);

namespace App\Support;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Throwable;

class JalaliDate
{
    private const MONTHS = [
        1 => 'فروردین',
        2 => 'اردیبهشت',
        3 => 'خرداد',
        4 => 'تیر',
        5 => 'مرداد',
        6 => 'شهریور',
        7 => 'مهر',
        8 => 'آبان',
        9 => 'آذر',
        10 => 'دی',
        11 => 'بهمن',
        12 => 'اسفند',
    ];

    public static function format(CarbonInterface|string|null $date): string
    {
        $date = self::normalizeDate($date);
        if (! $date) {
            return '—';
        }

        [$jy, $jm, $jd] = self::fromGregorian(
            (int) $date->format('Y'),
            (int) $date->format('n'),
            (int) $date->format('j'),
        );

        return self::toPersianDigits(sprintf('%d %s %d', $jd, self::MONTHS[$jm], $jy));
    }

    public static function formatDateTime(CarbonInterface|string|null $date): string
    {
        $date = self::normalizeDate($date);
        if (! $date) {
            return '—';
        }

        return self::format($date).' - '.self::toPersianDigits($date->format('H:i'));
    }

    public static function toPersianDigits(string $value): string
    {
        return strtr($value, [
            '0' => '۰',
            '1' => '۱',
            '2' => '۲',
            '3' => '۳',
            '4' => '۴',
            '5' => '۵',
            '6' => '۶',
            '7' => '۷',
            '8' => '۸',
            '9' => '۹',
        ]);
    }

    /**
     * @return array{0:int,1:int,2:int}
     */
    public static function fromGregorian(int $gy, int $gm, int $gd): array
    {
        $jdn = self::gregorianToJulianDayNumber($gy, $gm, $gd);
        $gregorian = self::julianDayNumberToGregorian($jdn);
        $jy = $gregorian['year'] - 621;
        $jalali = self::jalaliCalendar($jy);
        $firstFarvardin = self::gregorianToJulianDayNumber($gregorian['year'], 3, $jalali['march']);
        $days = $jdn - $firstFarvardin;

        if ($days >= 0) {
            if ($days <= 185) {
                return [$jy, 1 + intdiv($days, 31), self::positiveMod($days, 31) + 1];
            }

            $days -= 186;
        } else {
            $jy--;
            $days += 179;

            if ($jalali['leap'] === 1) {
                $days++;
            }
        }

        return [$jy, 7 + intdiv($days, 30), self::positiveMod($days, 30) + 1];
    }

    /**
     * @return array{0:int,1:int,2:int}
     */
    public static function toGregorian(int $jy, int $jm, int $jd): array
    {
        $jy += 1595;
        $days = -355668
            + (365 * $jy)
            + (intdiv($jy, 33) * 8)
            + intdiv(($jy % 33) + 3, 4)
            + $jd
            + ($jm < 7 ? (($jm - 1) * 31) : ((($jm - 7) * 30) + 186));

        $gy = 400 * intdiv($days, 146097);
        $days %= 146097;

        if ($days > 36524) {
            $gy += 100 * intdiv(--$days, 36524);
            $days %= 36524;

            if ($days >= 365) {
                $days++;
            }
        }

        $gy += 4 * intdiv($days, 1461);
        $days %= 1461;

        if ($days > 365) {
            $gy += intdiv($days - 1, 365);
            $days = ($days - 1) % 365;
        }

        $gd = $days + 1;
        $months = [0, 31, self::isGregorianLeap($gy) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        $gm = 1;

        while ($gm <= 12 && $gd > $months[$gm]) {
            $gd -= $months[$gm];
            $gm++;
        }

        return [$gy, $gm, $gd];
    }

    public static function isValidJalaliDate(int $jy, int $jm, int $jd): bool
    {
        if ($jy < 1 || $jm < 1 || $jm > 12 || $jd < 1 || $jd > 31) {
            return false;
        }

        [$gy, $gm, $gd] = self::toGregorian($jy, $jm, $jd);
        [$roundTripYear, $roundTripMonth, $roundTripDay] = self::fromGregorian($gy, $gm, $gd);

        return $roundTripYear === $jy && $roundTripMonth === $jm && $roundTripDay === $jd;
    }

    private static function isGregorianLeap(int $year): bool
    {
        return ($year % 4 === 0 && $year % 100 !== 0) || $year % 400 === 0;
    }

    /**
     * @return array{leap:int,year:int,march:int}
     */
    private static function jalaliCalendar(int $jy): array
    {
        $breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
        $gy = $jy + 621;
        $leapJ = -14;
        $jp = $breaks[0];
        $jm = 0;
        $jump = 0;

        for ($i = 1, $count = count($breaks); $i < $count; $i++) {
            $jm = $breaks[$i];
            $jump = $jm - $jp;

            if ($jy < $jm) {
                break;
            }

            $leapJ += intdiv($jump, 33) * 8 + intdiv(self::positiveMod($jump, 33), 4);
            $jp = $jm;
        }

        $n = $jy - $jp;
        $leapJ += intdiv($n, 33) * 8 + intdiv(self::positiveMod($n, 33) + 3, 4);

        if (self::positiveMod($jump, 33) === 4 && $jump - $n === 4) {
            $leapJ++;
        }

        $leapG = intdiv($gy, 4) - intdiv((intdiv($gy, 100) + 1) * 3, 4) - 150;
        $march = 20 + $leapJ - $leapG;

        if ($jump - $n < 6) {
            $n = $n - $jump + intdiv($jump + 4, 33) * 33;
        }

        $leap = self::positiveMod(self::positiveMod($n + 1, 33) - 1, 4);

        return ['leap' => $leap, 'year' => $gy, 'march' => $march];
    }

    private static function gregorianToJulianDayNumber(int $gy, int $gm, int $gd): int
    {
        $days = intdiv(($gy + intdiv($gm - 8, 6) + 100100) * 1461, 4)
            + intdiv(153 * self::positiveMod($gm + 9, 12) + 2, 5)
            + $gd
            - 34840408;

        return $days - intdiv(intdiv($gy + 100100 + intdiv($gm - 8, 6), 100) * 3, 4) + 752;
    }

    /**
     * @return array{year:int,month:int,day:int}
     */
    private static function julianDayNumberToGregorian(int $jdn): array
    {
        $j = 4 * $jdn + 139361631;
        $j += intdiv(intdiv(4 * $jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
        $i = intdiv(self::positiveMod($j, 1461), 4) * 5 + 308;
        $day = intdiv(self::positiveMod($i, 153), 5) + 1;
        $month = self::positiveMod(intdiv($i, 153), 12) + 1;
        $year = intdiv($j, 1461) - 100100 + intdiv(8 - $month, 6);

        return ['year' => $year, 'month' => $month, 'day' => $day];
    }

    private static function positiveMod(int $value, int $divider): int
    {
        return (($value % $divider) + $divider) % $divider;
    }

    private static function normalizeDate(CarbonInterface|string|null $date): ?CarbonInterface
    {
        if ($date instanceof CarbonInterface) {
            return $date;
        }

        if (! is_string($date) || trim($date) === '') {
            return null;
        }

        try {
            return Carbon::parse($date);
        } catch (Throwable) {
            return null;
        }
    }
}
