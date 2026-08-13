<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Booking\Models\Service;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Http\Controllers\Controller;
use App\Support\JalaliDate;
use App\Support\ServiceScheduleResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;

class BusinessResumeController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->payload()]);
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'templateType' => ['nullable', 'in:personal,beauty_salon'],
            'published' => ['required', 'boolean'],
            'sections' => ['required', 'array'],
            'content' => ['required', 'array'],
        ]);

        $general = $this->general();
        $rules = $general->booking_rules ?? [];
        $existing = is_array($rules['business_resume'] ?? null) ? $rules['business_resume'] : [];
        $rules['business_resume'] = [
            'template_type' => $validated['templateType'] ?? ($existing['template_type'] ?? null),
            'published' => (bool) $validated['published'],
            'sections' => $validated['sections'],
            'content' => $validated['content'],
        ];
        $general->update(['booking_rules' => $rules]);

        return response()->json(['success' => true, 'message' => 'رزومه ذخیره شد.', 'data' => $this->payload()]);
    }

    public function upload(Request $request): JsonResponse
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
        $validated = $request->validate(['image' => ['required', 'file', 'image', 'max:6144']]);
        /** @var UploadedFile $image */
        $image = $validated['image'];
        $path = $image->store('business-resume', 'media_public');
        $this->recordTenantMediaFile($path, (int) $image->getSize());

        return response()->json(['success' => true, 'data' => ['path' => $path, 'url' => $this->tenantMediaUrl($path)]]);
    }

    public function publicShow(): JsonResponse
    {
        $payload = $this->payload();
        abort_unless($payload['published'] && $payload['templateType'] !== null, 404);

        return response()->json(['success' => true, 'data' => $payload]);
    }

    private function payload(): array
    {
        $general = $this->general();
        $rules = $general->booking_rules ?? [];
        $resume = is_array($rules['business_resume'] ?? null) ? $rules['business_resume'] : [];

        return [
            'templateType' => $resume['template_type'] ?? null,
            'published' => (bool) ($resume['published'] ?? false),
            'sections' => is_array($resume['sections'] ?? null) ? $resume['sections'] : [],
            'content' => is_array($resume['content'] ?? null) ? $resume['content'] : [],
            'publicUrl' => url('/resume'),
            'businessStatus' => $this->businessStatus((string) ($general->timezone ?: 'Asia/Tehran')),
        ];
    }

    /**
     * Build the public status from the actual booking schedules, rather than a
     * manually entered text. This keeps the resume consistent with booking.
     *
     * @return array{available: bool, isOpen: bool, label: string, opensAt: ?string, closesAt: ?string}
     */
    private function businessStatus(string $timezone): array
    {
        try {
            $now = Carbon::now($timezone);
        } catch (\Throwable) {
            $now = Carbon::now('Asia/Tehran');
        }

        $date = $now->toDateString();
        $ranges = Service::query()
            ->with('professional:id,is_active,settings')
            ->where('is_active', true)
            ->whereHas('professional', fn ($query) => $query->where('is_active', true))
            ->get()
            ->filter(fn (Service $service) => $this->isServiceWorkingToday($service, $date))
            ->map(function (Service $service) use ($date, $timezone): array {
                $schedule = ServiceScheduleResolver::resolve($service, $date);

                return [
                    'start' => Carbon::createFromFormat('Y-m-d H:i', "{$date} {$schedule['start_hour']}", $timezone),
                    'end' => Carbon::createFromFormat('Y-m-d H:i', "{$date} {$schedule['end_hour']}", $timezone),
                ];
            })
            ->filter(fn (array $range) => $range['start']->lt($range['end']))
            ->values();

        if ($ranges->isEmpty()) {
            return [
                'available' => false,
                'isOpen' => false,
                'label' => 'امروز تعطیل است',
                'opensAt' => null,
                'closesAt' => null,
            ];
        }

        $activeRanges = $ranges->filter(fn (array $range) => $now->gte($range['start']) && $now->lt($range['end']));
        $firstStart = $ranges->min('start');
        $nextStart = $ranges
            ->filter(fn (array $range) => $range['start']->gt($now))
            ->min('start');

        if ($activeRanges->isNotEmpty()) {
            $closesAt = $activeRanges->max('end');

            return [
                'available' => true,
                'isOpen' => true,
                'label' => 'هم‌اکنون باز است · تا '.JalaliDate::toPersianDigits($closesAt->format('H:i')),
                'opensAt' => $firstStart->format('H:i'),
                'closesAt' => $closesAt->format('H:i'),
            ];
        }

        return [
            'available' => true,
            'isOpen' => false,
            'label' => $nextStart !== null
                ? 'هم‌اکنون بسته است · امروز از '.JalaliDate::toPersianDigits($nextStart->format('H:i'))
                : 'امروز بسته است',
            'opensAt' => ($nextStart ?? $firstStart)->format('H:i'),
            'closesAt' => null,
        ];
    }

    private function isServiceWorkingToday(Service $service, string $date): bool
    {
        $serviceSettings = $service->settings ?? [];
        $professionalSettings = $service->professional?->settings ?? [];
        $dayOfWeek = Carbon::createFromFormat('Y-m-d', $date)->dayOfWeek;
        $workDays = $serviceSettings['work_days'] ?? [0, 1, 2, 3, 4, 6];

        if (
            ! ServiceScheduleResolver::hasOverrideForDate($service, $date)
            && (! is_array($workDays) || ! in_array($dayOfWeek, array_map('intval', $workDays), true))
        ) {
            return false;
        }

        if (in_array($date, array_map('strval', (array) ($professionalSettings['disabled_dates'] ?? [])), true)) {
            return false;
        }

        if (in_array($date, array_map('strval', (array) ($serviceSettings['disabled_dates'] ?? [])), true)) {
            return false;
        }

        $activeRanges = is_array($professionalSettings['active_ranges'] ?? null) ? $professionalSettings['active_ranges'] : [];

        if ($activeRanges !== [] && ! $this->dateInRanges($date, $activeRanges)) {
            return false;
        }

        $disabledRanges = is_array($serviceSettings['disabled_date_ranges'] ?? null) ? $serviceSettings['disabled_date_ranges'] : [];

        return ! $this->dateInRanges($date, $disabledRanges);
    }

    /** @param array<int, array<string, mixed>> $ranges */
    private function dateInRanges(string $date, array $ranges): bool
    {
        foreach ($ranges as $range) {
            if (! is_array($range)) {
                continue;
            }

            $start = (string) ($range['start'] ?? $range['start_date'] ?? '');
            $end = (string) ($range['end'] ?? $range['end_date'] ?? '');

            if ($start !== '' && $end !== '' && $date >= $start && $date <= $end) {
                return true;
            }
        }

        return false;
    }

    private function general(): GeneralSetting
    {
        return GeneralSetting::query()->firstOrCreate([], ['timezone' => 'Asia/Tehran', 'currency' => 'IRR', 'booking_rules' => []]);
    }
}
