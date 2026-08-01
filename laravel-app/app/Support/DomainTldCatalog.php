<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Landing\Models\DomainTldPrice;
use Illuminate\Support\Collection;

class DomainTldCatalog
{
    /**
     * @return array<int, array{tld:string,label:string,register_price_amount:int,renew_price_amount:int,transfer_price_amount:int,is_active:bool}>
     */
    public static function defaults(): array
    {
        return [
            ['tld' => '.ir', 'label' => 'دامنه ملی ایران', 'register_price_amount' => 89000, 'renew_price_amount' => 89000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.com', 'label' => 'دامنه بین‌المللی عمومی', 'register_price_amount' => 1800000, 'renew_price_amount' => 1800000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.net', 'label' => 'دامنه شبکه و عمومی', 'register_price_amount' => 1650000, 'renew_price_amount' => 1650000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.org', 'label' => 'دامنه سازمانی', 'register_price_amount' => 1600000, 'renew_price_amount' => 1600000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.co', 'label' => 'دامنه تجاری کوتاه', 'register_price_amount' => 1900000, 'renew_price_amount' => 1900000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.info', 'label' => 'دامنه اطلاع‌رسانی', 'register_price_amount' => 1400000, 'renew_price_amount' => 1400000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.biz', 'label' => 'دامنه کسب‌وکار', 'register_price_amount' => 1500000, 'renew_price_amount' => 1500000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.me', 'label' => 'دامنه شخصی', 'register_price_amount' => 2100000, 'renew_price_amount' => 2100000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.cc', 'label' => 'دامنه کوتاه عمومی', 'register_price_amount' => 1700000, 'renew_price_amount' => 1700000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.tv', 'label' => 'دامنه رسانه و ویدیو', 'register_price_amount' => 2400000, 'renew_price_amount' => 2400000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.shop', 'label' => 'دامنه فروشگاهی', 'register_price_amount' => 2200000, 'renew_price_amount' => 2200000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.store', 'label' => 'دامنه فروشگاه', 'register_price_amount' => 2350000, 'renew_price_amount' => 2350000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.online', 'label' => 'دامنه آنلاین', 'register_price_amount' => 1550000, 'renew_price_amount' => 1550000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.site', 'label' => 'دامنه سایت عمومی', 'register_price_amount' => 1500000, 'renew_price_amount' => 1500000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.app', 'label' => 'دامنه اپلیکیشن', 'register_price_amount' => 2300000, 'renew_price_amount' => 2300000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.blog', 'label' => 'دامنه وبلاگ', 'register_price_amount' => 1600000, 'renew_price_amount' => 1600000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.pro', 'label' => 'دامنه حرفه‌ای', 'register_price_amount' => 1750000, 'renew_price_amount' => 1750000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.xyz', 'label' => 'دامنه عمومی اقتصادی', 'register_price_amount' => 1300000, 'renew_price_amount' => 1300000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.io', 'label' => 'دامنه استارتاپی', 'register_price_amount' => 3200000, 'renew_price_amount' => 3200000, 'transfer_price_amount' => 0, 'is_active' => true],
            ['tld' => '.dev', 'label' => 'دامنه توسعه‌دهندگان', 'register_price_amount' => 2100000, 'renew_price_amount' => 2100000, 'transfer_price_amount' => 0, 'is_active' => true],
        ];
    }

    public static function ensureSeeded(): void
    {
        foreach (self::defaults() as $item) {
            $record = DomainTldPrice::query()->firstOrNew(['tld' => $item['tld']]);

            if (! $record->exists) {
                $record->fill([
                    'register_price_amount' => $item['register_price_amount'],
                    'renew_price_amount' => $item['renew_price_amount'],
                    'transfer_price_amount' => $item['transfer_price_amount'],
                    'currency' => 'IRT',
                    'is_active' => $item['is_active'],
                    'meta_json' => ['label' => $item['label']],
                ]);
                $record->save();
                continue;
            }

            $meta = is_array($record->meta_json) ? $record->meta_json : [];

            if (! isset($meta['label'])) {
                $meta['label'] = $item['label'];
                $record->meta_json = $meta;
                $record->save();
            }
        }
    }

    /**
     * @return \Illuminate\Support\Collection<int, array{tld:string,label:string,registerAmount:int,renewAmount:int,transferAmount:int,isActive:bool}>
     */
    public static function options(): Collection
    {
        self::ensureSeeded();

        return DomainTldPrice::query()
            ->orderByRaw("CASE WHEN tld = '.ir' THEN 0 ELSE 1 END")
            ->orderBy('tld')
            ->get()
            ->map(fn (DomainTldPrice $item): array => [
                'tld' => (string) $item->tld,
                'label' => trim((string) ($item->meta_json['label'] ?? '')) ?: (string) $item->tld,
                'registerAmount' => (int) $item->register_price_amount,
                'renewAmount' => (int) $item->renew_price_amount,
                'transferAmount' => (int) $item->transfer_price_amount,
                'isActive' => (bool) $item->is_active,
            ])
            ->values();
    }
}
