<?php

declare(strict_types=1);

namespace App\Exports\Tenant;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;

class DailyReportExport implements FromCollection, ShouldAutoSize, WithHeadings
{
    public function __construct(
        private readonly Collection $rows,
        private readonly string $professionalLabel = 'آرایشگر',
    )
    {
    }

    public function collection(): Collection
    {
        return $this->rows;
    }

    public function headings(): array
    {
        return [
            'ساعت نوبت',
            'نام و نام خانوادگی',
            'موبایل',
            'بخش',
            $this->professionalLabel,
            'توضیحات',
            'وضعیت',
            'نوع ثبت',
        ];
    }
}
