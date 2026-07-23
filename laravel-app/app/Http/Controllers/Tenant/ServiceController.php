<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Booking\Models\Barber;
use App\Domain\Booking\Models\Service;
use App\Events\AppointmentAvailabilityChanged;
use App\Http\Controllers\Controller;
use App\Services\VipFeatureService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class ServiceController extends Controller
{
    public function __construct(
        private readonly VipFeatureService $vipFeatureService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $vipFeatureActive = $this->vipFeatureService->syncCurrentTenantState(tenant());
        $query = Service::query()->orderBy('sort_order')->orderByDesc('created_at');
        $actor = $request->user('tenant_web');
        $requestedProfessionalId = $request->query('professional_id') ?: $request->query('barber_id');

        if ($requestedProfessionalId) {
            $query->where('professional_id', $requestedProfessionalId);
        } elseif ($actor?->role === 'barber') {
            $barber = Barber::query()->where('user_id', $actor->id)->first();
            $query->where('professional_id', $barber?->id ?? 0);
        }

        return response()->json([
            'success' => true,
            'data' => $query->get()->map(fn (Service $service) => $this->transform($service, $vipFeatureActive)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $vipFeatureActive = $this->vipFeatureService->syncCurrentTenantState(tenant());

        $request->merge([
            'professional_id' => $request->input('professional_id', $request->input('barber_id')),
        ]);

        $validated = $request->validate([
            'professional_id' => ['required', 'integer', 'exists:professionals,id'],
            'name' => ['required', 'string', 'max:255'],
            'api_code' => ['nullable', 'string', 'max:64'],
            'start_hour' => ['required', 'date_format:H:i'],
            'end_hour' => ['required', 'date_format:H:i'],
            'rest_breaks' => ['nullable', 'array'],
            'rest_breaks.*.start' => ['required_with:rest_breaks', 'date_format:H:i'],
            'rest_breaks.*.end' => ['required_with:rest_breaks', 'date_format:H:i'],
            'rest_breaks.*.scope' => ['nullable', 'in:all,weekdays,dates'],
            'rest_breaks.*.weekdays' => ['nullable', 'array'],
            'rest_breaks.*.weekdays.*' => ['integer', 'between:0,6'],
            'rest_breaks.*.dates' => ['nullable', 'array'],
            'rest_breaks.*.dates.*' => ['date_format:Y-m-d'],
            'vip_breaks' => ['nullable', 'array'],
            'vip_breaks.*.start' => ['required_with:vip_breaks', 'date_format:H:i'],
            'vip_breaks.*.end' => ['required_with:vip_breaks', 'date_format:H:i'],
            'vip_breaks.*.scope' => ['nullable', 'in:all,weekdays,dates'],
            'vip_breaks.*.weekdays' => ['nullable', 'array'],
            'vip_breaks.*.weekdays.*' => ['integer', 'between:0,6'],
            'vip_breaks.*.dates' => ['nullable', 'array'],
            'vip_breaks.*.dates.*' => ['date_format:Y-m-d'],
            'schedule_overrides' => ['nullable', 'array'],
            'schedule_overrides.*.scope' => ['required_with:schedule_overrides', 'in:weekdays,dates'],
            'schedule_overrides.*.weekdays' => ['nullable', 'array'],
            'schedule_overrides.*.weekdays.*' => ['integer', 'between:0,6'],
            'schedule_overrides.*.dates' => ['nullable', 'array'],
            'schedule_overrides.*.dates.*' => ['date_format:Y-m-d'],
            'schedule_overrides.*.start_hour' => ['required_with:schedule_overrides', 'date_format:H:i'],
            'schedule_overrides.*.end_hour' => ['required_with:schedule_overrides', 'date_format:H:i'],
            'schedule_overrides.*.slot_duration_minutes' => ['required_with:schedule_overrides', 'integer', 'min:5'],
            'quick_blocked_slots' => ['nullable', 'array'],
            'quick_blocked_slots.*.id' => ['nullable', 'string', 'max:80'],
            'quick_blocked_slots.*.date' => ['required_with:quick_blocked_slots', 'date_format:Y-m-d'],
            'quick_blocked_slots.*.start' => ['required_with:quick_blocked_slots', 'date_format:H:i'],
            'quick_blocked_slots.*.end' => ['required_with:quick_blocked_slots', 'date_format:H:i'],
            'quick_blocked_slots.*.reason' => ['nullable', 'string', 'max:120'],
            'slot_duration_minutes' => ['required', 'integer', 'min:5'],
            'duration_display_text' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'price' => ['nullable', 'integer', 'min:0'],
            'check_conflicts' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'work_days' => ['nullable', 'array'],
            'work_days.*' => ['integer', 'between:0,6'],
            'disabled_dates' => ['nullable', 'array'],
            'disabled_dates.*' => ['string'],
            'disabled_date_ranges' => ['nullable', 'array'],
        ], [
            'professional_id.required' => __('tenant.services.validation.professional_required'),
            'name.required' => __('tenant.services.validation.name_required'),
            'start_hour.required' => __('tenant.services.validation.start_hour_required'),
            'end_hour.required' => __('tenant.services.validation.end_hour_required'),
            'slot_duration_minutes.required' => __('tenant.services.validation.duration_required'),
        ]);

        $barber = Barber::query()->findOrFail($validated['professional_id']);
        $this->ensureCanManageBarber($request, $barber);
        $validated['rest_breaks'] = $this->normalizeRestBreaks(
            $validated['rest_breaks'] ?? [],
            $validated['start_hour'],
            $validated['end_hour'],
            __('tenant.services.break_label'),
        );
        $validated['vip_breaks'] = $this->normalizeVipBreaks(
            $validated['vip_breaks'] ?? [],
            $validated['rest_breaks'],
            $validated['start_hour'],
            $validated['end_hour'],
            $vipFeatureActive,
        );
        $validated['schedule_overrides'] = $this->normalizeScheduleOverrides($validated['schedule_overrides'] ?? []);
        $validated['quick_blocked_slots'] = $this->normalizeQuickBlockedSlots($validated['quick_blocked_slots'] ?? []);

        $service = Service::query()->create([
            'professional_id' => $validated['professional_id'],
            'name' => $validated['name'],
            'slug' => Str::slug($validated['name']) . '-' . Str::lower(Str::random(6)),
            'api_code' => trim((string) ($validated['api_code'] ?? '')) ?: null,
            'sort_order' => $validated['sort_order'] ?? ((int) Service::query()->where('professional_id', $validated['professional_id'])->max('sort_order') + 10),
            'price' => $validated['price'] ?? 0,
            'duration_minutes' => $validated['slot_duration_minutes'],
            'duration_display_text' => trim((string) ($validated['duration_display_text'] ?? '')) ?: null,
            'buffer_minutes' => 0,
            'is_active' => $validated['is_active'] ?? true,
            'settings' => [
                'start_hour' => $validated['start_hour'],
                'end_hour' => $validated['end_hour'],
                'rest_breaks' => $validated['rest_breaks'],
                'vip_breaks' => $validated['vip_breaks'],
                'schedule_overrides' => $validated['schedule_overrides'],
                'quick_blocked_slots' => $validated['quick_blocked_slots'],
                'duration_display_text' => trim((string) ($validated['duration_display_text'] ?? '')) ?: null,
                'check_conflicts' => $validated['check_conflicts'] ?? true,
                'work_days' => $validated['work_days'] ?? [0, 1, 2, 3, 4, 6],
                'disabled_dates' => $validated['disabled_dates'] ?? [],
                'disabled_date_ranges' => $validated['disabled_date_ranges'] ?? [],
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.services.created'),
            'data' => $this->transform($service, $vipFeatureActive),
        ], 201);
    }

    public function update(Request $request, Service $service): JsonResponse
    {
        $vipFeatureActive = $this->vipFeatureService->syncCurrentTenantState(tenant());
        $this->ensureCanManageBarber($request, $service->barber);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'api_code' => ['nullable', 'string', 'max:64'],
            'start_hour' => ['required', 'date_format:H:i'],
            'end_hour' => ['required', 'date_format:H:i'],
            'rest_breaks' => ['nullable', 'array'],
            'rest_breaks.*.start' => ['required_with:rest_breaks', 'date_format:H:i'],
            'rest_breaks.*.end' => ['required_with:rest_breaks', 'date_format:H:i'],
            'rest_breaks.*.scope' => ['nullable', 'in:all,weekdays,dates'],
            'rest_breaks.*.weekdays' => ['nullable', 'array'],
            'rest_breaks.*.weekdays.*' => ['integer', 'between:0,6'],
            'rest_breaks.*.dates' => ['nullable', 'array'],
            'rest_breaks.*.dates.*' => ['date_format:Y-m-d'],
            'vip_breaks' => ['nullable', 'array'],
            'vip_breaks.*.start' => ['required_with:vip_breaks', 'date_format:H:i'],
            'vip_breaks.*.end' => ['required_with:vip_breaks', 'date_format:H:i'],
            'vip_breaks.*.scope' => ['nullable', 'in:all,weekdays,dates'],
            'vip_breaks.*.weekdays' => ['nullable', 'array'],
            'vip_breaks.*.weekdays.*' => ['integer', 'between:0,6'],
            'vip_breaks.*.dates' => ['nullable', 'array'],
            'vip_breaks.*.dates.*' => ['date_format:Y-m-d'],
            'schedule_overrides' => ['nullable', 'array'],
            'schedule_overrides.*.scope' => ['required_with:schedule_overrides', 'in:weekdays,dates'],
            'schedule_overrides.*.weekdays' => ['nullable', 'array'],
            'schedule_overrides.*.weekdays.*' => ['integer', 'between:0,6'],
            'schedule_overrides.*.dates' => ['nullable', 'array'],
            'schedule_overrides.*.dates.*' => ['date_format:Y-m-d'],
            'schedule_overrides.*.start_hour' => ['required_with:schedule_overrides', 'date_format:H:i'],
            'schedule_overrides.*.end_hour' => ['required_with:schedule_overrides', 'date_format:H:i'],
            'schedule_overrides.*.slot_duration_minutes' => ['required_with:schedule_overrides', 'integer', 'min:5'],
            'quick_blocked_slots' => ['nullable', 'array'],
            'quick_blocked_slots.*.id' => ['nullable', 'string', 'max:80'],
            'quick_blocked_slots.*.date' => ['required_with:quick_blocked_slots', 'date_format:Y-m-d'],
            'quick_blocked_slots.*.start' => ['required_with:quick_blocked_slots', 'date_format:H:i'],
            'quick_blocked_slots.*.end' => ['required_with:quick_blocked_slots', 'date_format:H:i'],
            'quick_blocked_slots.*.reason' => ['nullable', 'string', 'max:120'],
            'slot_duration_minutes' => ['required', 'integer', 'min:5'],
            'duration_display_text' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'price' => ['nullable', 'integer', 'min:0'],
            'check_conflicts' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'work_days' => ['nullable', 'array'],
            'work_days.*' => ['integer', 'between:0,6'],
            'disabled_dates' => ['nullable', 'array'],
            'disabled_dates.*' => ['string'],
            'disabled_date_ranges' => ['nullable', 'array'],
        ], [
            'name.required' => __('tenant.services.validation.name_required'),
            'start_hour.required' => __('tenant.services.validation.start_hour_required'),
            'end_hour.required' => __('tenant.services.validation.end_hour_required'),
            'slot_duration_minutes.required' => __('tenant.services.validation.duration_required'),
        ]);
        $validated['rest_breaks'] = $this->normalizeRestBreaks(
            $validated['rest_breaks'] ?? [],
            $validated['start_hour'],
            $validated['end_hour'],
            __('tenant.services.break_label'),
        );
        $validated['vip_breaks'] = $this->normalizeVipBreaks(
            $validated['vip_breaks'] ?? [],
            $validated['rest_breaks'],
            $validated['start_hour'],
            $validated['end_hour'],
            $vipFeatureActive,
        );
        $validated['schedule_overrides'] = $this->normalizeScheduleOverrides($validated['schedule_overrides'] ?? []);
        $validated['quick_blocked_slots'] = $this->normalizeQuickBlockedSlots($validated['quick_blocked_slots'] ?? []);
        $previousQuickBlockedSlots = $this->normalizeQuickBlockedSlots(
            is_array($service->settings['quick_blocked_slots'] ?? null) ? $service->settings['quick_blocked_slots'] : [],
        );

        $service->update([
            'name' => $validated['name'],
            'api_code' => trim((string) ($validated['api_code'] ?? '')) ?: null,
            'sort_order' => $validated['sort_order'] ?? $service->sort_order,
            'price' => $validated['price'] ?? 0,
            'duration_minutes' => $validated['slot_duration_minutes'],
            'duration_display_text' => trim((string) ($validated['duration_display_text'] ?? '')) ?: null,
            'is_active' => $validated['is_active'] ?? true,
            'settings' => [
                'start_hour' => $validated['start_hour'],
                'end_hour' => $validated['end_hour'],
                'rest_breaks' => $validated['rest_breaks'],
                'vip_breaks' => $validated['vip_breaks'],
                'schedule_overrides' => $validated['schedule_overrides'],
                'quick_blocked_slots' => $validated['quick_blocked_slots'],
                'duration_display_text' => trim((string) ($validated['duration_display_text'] ?? '')) ?: null,
                'check_conflicts' => $validated['check_conflicts'] ?? true,
                'work_days' => $validated['work_days'] ?? [0, 1, 2, 3, 4, 6],
                'disabled_dates' => $validated['disabled_dates'] ?? [],
                'disabled_date_ranges' => $validated['disabled_date_ranges'] ?? [],
            ],
        ]);

        $this->dispatchQuickBlockedSlotChanges($service->fresh(), $previousQuickBlockedSlots, $validated['quick_blocked_slots']);

        return response()->json([
            'success' => true,
            'message' => __('tenant.services.updated'),
            'data' => $this->transform($service->fresh(), $vipFeatureActive),
        ]);
    }

    public function destroy(Request $request, Service $service): JsonResponse
    {
        $this->ensureCanManageBarber($request, $service->barber);
        $service->delete();

        return response()->json([
            'success' => true,
            'message' => __('tenant.services.deleted'),
            'data' => true,
        ]);
    }

    private function transform(Service $service, bool $vipFeatureActive): array
    {
        $settings = $service->settings ?? [];
        $durationDisplayText = trim((string) ($service->duration_display_text ?? $settings['duration_display_text'] ?? ''));

        return [
            'id' => (string) $service->id,
            'name' => $service->name,
            'apiCode' => $service->api_code,
            'barberId' => (string) $service->professional_id,
            'sortOrder' => (int) $service->sort_order,
            'startHour' => $settings['start_hour'] ?? '09:00',
            'endHour' => $settings['end_hour'] ?? '21:00',
            'restBreaks' => $settings['rest_breaks'] ?? [],
            'vipBreaks' => $vipFeatureActive ? ($settings['vip_breaks'] ?? []) : [],
            'scheduleOverrides' => collect($settings['schedule_overrides'] ?? [])->map(fn (array $override) => [
                'scope' => $override['scope'] ?? 'weekdays',
                'weekdays' => $override['weekdays'] ?? [],
                'dates' => $override['dates'] ?? [],
                'startHour' => $override['start_hour'] ?? '09:00',
                'endHour' => $override['end_hour'] ?? '21:00',
                'slotDurationMinutes' => (int) ($override['duration_minutes'] ?? 30),
            ])->values()->all(),
            'quickBlockedSlots' => collect($settings['quick_blocked_slots'] ?? [])->map(fn (array $slot) => [
                'id' => (string) ($slot['id'] ?? ''),
                'date' => (string) ($slot['date'] ?? ''),
                'start' => (string) ($slot['start'] ?? ''),
                'end' => (string) ($slot['end'] ?? ''),
                'reason' => isset($slot['reason']) ? (string) $slot['reason'] : null,
            ])->filter(fn (array $slot) => $slot['date'] !== '' && $slot['start'] !== '' && $slot['end'] !== '')->values()->all(),
            'slotDurationMinutes' => (int) $service->duration_minutes,
            'durationDisplayText' => $durationDisplayText !== '' ? $durationDisplayText : null,
            'price' => (int) $service->price,
            'checkConflicts' => (bool) ($settings['check_conflicts'] ?? true),
            'isActive' => (bool) $service->is_active,
            'workDays' => $settings['work_days'] ?? [0, 1, 2, 3, 4, 6],
            'disabledDates' => $settings['disabled_dates'] ?? [],
            'disabledDateRanges' => $settings['disabled_date_ranges'] ?? [],
            'createdAt' => $service->created_at?->toISOString(),
        ];
    }

    private function ensureCanManageBarber(Request $request, ?Barber $barber): void
    {
        $actor = $request->user('tenant_web');

        abort_if(! $barber, 404);

        if ($actor?->role === 'admin') {
            return;
        }

        abort_unless($actor?->role === 'barber' && (int) $barber->user_id === (int) $actor->id, 403);
        abort_if(! $barber->can_access_panel, 403, __('authorization.professional_panel_blocked'));
    }

    /**
     * @param array<int, array<string, mixed>> $restBreaks
     * @return array<int, array{start: string, end: string, scope: string, weekdays: array<int, int>, dates: array<int, string>}>
     */
    private function normalizeRestBreaks(array $restBreaks, string $startHour, string $endHour, string $label): array
    {
        $sectionStart = Carbon::createFromFormat('H:i', $startHour);
        $sectionEnd = Carbon::createFromFormat('H:i', $endHour);

        if ($sectionStart->greaterThanOrEqualTo($sectionEnd)) {
            abort(422, __('tenant.services.validation.end_after_start'));
        }

        $normalized = collect($restBreaks)
            ->filter(fn ($break) => is_array($break))
            ->map(function (array $break) use ($label) {
                $breakStart = Carbon::createFromFormat('H:i', (string) ($break['start'] ?? ''));
                $breakEnd = Carbon::createFromFormat('H:i', (string) ($break['end'] ?? ''));
                $scope = in_array(($break['scope'] ?? 'all'), ['all', 'weekdays', 'dates'], true)
                    ? (string) ($break['scope'] ?? 'all')
                    : 'all';
                $weekdays = collect($break['weekdays'] ?? [])
                    ->map(fn ($day) => (int) $day)
                    ->filter(fn (int $day) => $day >= 0 && $day <= 6)
                    ->unique()
                    ->sort()
                    ->values()
                    ->all();
                $dates = collect($break['dates'] ?? [])
                    ->map(fn ($date) => (string) $date)
                    ->filter(fn (string $date) => preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1)
                    ->unique()
                    ->sort()
                    ->values()
                    ->all();

                if ($breakStart->greaterThanOrEqualTo($breakEnd)) {
                    abort(422, __('tenant.services.validation.range_end_after_start', ['label' => $label]));
                }

                if ($scope === 'weekdays' && $weekdays === []) {
                    abort(422, __('tenant.services.validation.weekday_required', ['label' => $label]));
                }

                if ($scope === 'dates' && $dates === []) {
                    abort(422, __('tenant.services.validation.date_required', ['label' => $label]));
                }

                return [
                    'start' => $breakStart->format('H:i'),
                    'end' => $breakEnd->format('H:i'),
                    'scope' => $scope,
                    'weekdays' => $scope === 'weekdays' ? $weekdays : [],
                    'dates' => $scope === 'dates' ? $dates : [],
                ];
            })
            ->sortBy(fn (array $break) => "{$break['start']} {$break['end']} {$break['scope']}")
            ->values()
            ->all();

        $this->assertScopedBreaksDoNotOverlapOnActiveDates(
            $normalized,
            __('tenant.services.validation.ranges_overlap', ['label' => $label]),
        );

        return $normalized;
    }

    private function normalizeVipBreaks(array $vipBreaks, array $restBreaks, string $startHour, string $endHour, bool $vipFeatureActive): array
    {
        if (! $vipFeatureActive) {
            abort_if($vipBreaks !== [], 422, __('tenant.services.validation.vip_module_inactive'));

            return [];
        }

        $sectionStart = Carbon::createFromFormat('H:i', $startHour);
        $sectionEnd = Carbon::createFromFormat('H:i', $endHour);
        $normalized = collect($vipBreaks)
            ->map(function (array $break) {
                $breakStart = Carbon::createFromFormat('H:i', (string) ($break['start'] ?? ''));
                $breakEnd = Carbon::createFromFormat('H:i', (string) ($break['end'] ?? ''));
                $scope = in_array(($break['scope'] ?? 'all'), ['all', 'weekdays', 'dates'], true)
                    ? (string) ($break['scope'] ?? 'all')
                    : 'all';
                $weekdays = collect($break['weekdays'] ?? [])
                    ->map(fn ($day) => (int) $day)
                    ->filter(fn (int $day) => $day >= 0 && $day <= 6)
                    ->unique()
                    ->sort()
                    ->values()
                    ->all();
                $dates = collect($break['dates'] ?? [])
                    ->map(fn ($date) => (string) $date)
                    ->filter(fn (string $date) => preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1)
                    ->unique()
                    ->sort()
                    ->values()
                    ->all();

                if ($scope === 'weekdays' && $weekdays === []) {
                    abort(422, __('tenant.services.validation.vip_weekday_required'));
                }

                if ($scope === 'dates' && $dates === []) {
                    abort(422, __('tenant.services.validation.vip_date_required'));
                }

                return [
                    'start' => $breakStart->format('H:i'),
                    'end' => $breakEnd->format('H:i'),
                    'scope' => $scope,
                    'weekdays' => $scope === 'weekdays' ? $weekdays : [],
                    'dates' => $scope === 'dates' ? $dates : [],
                ];
            })
            ->sortBy(fn (array $break) => "{$break['start']} {$break['end']} {$break['scope']}")
            ->values()
            ->all();

        foreach ($normalized as $vipBreak) {
            $vipStart = Carbon::createFromFormat('H:i', $vipBreak['start']);
            $vipEnd = Carbon::createFromFormat('H:i', $vipBreak['end']);

            if ($vipStart->greaterThanOrEqualTo($vipEnd)) {
                abort(422, __('tenant.services.validation.vip_end_after_start'));
            }

            if ($vipStart->lt($sectionStart) || $vipEnd->gt($sectionEnd)) {
                abort(422, __('tenant.services.validation.vip_inside_working_hours'));
            }
        }

        $this->assertScopedBreaksDoNotOverlapOnActiveDates(
            $normalized,
            __('tenant.services.validation.vip_ranges_overlap'),
        );

        foreach ($normalized as $vipBreak) {
            foreach ($restBreaks as $restBreak) {
                if (
                    $vipBreak['start'] < $restBreak['end']
                    && $vipBreak['end'] > $restBreak['start']
                    && $this->breakScopesOverlap($vipBreak, $restBreak)
                ) {
                    abort(422, __('tenant.services.validation.vip_break_overlap'));
                }
            }
        }

        return $normalized;
    }

    /**
     * @param  array<int, array<string, mixed>>  $overrides
     * @return array<int, array{scope: string, weekdays: array<int, int>, dates: array<int, string>, start_hour: string, end_hour: string, duration_minutes: int}>
     */
    private function normalizeScheduleOverrides(array $overrides): array
    {
        $normalized = collect($overrides)
            ->filter(fn ($override) => is_array($override))
            ->map(function (array $override): array {
                $scope = in_array(($override['scope'] ?? ''), ['weekdays', 'dates'], true)
                    ? (string) $override['scope']
                    : '';
                $weekdays = collect($override['weekdays'] ?? [])
                    ->map(fn ($day) => (int) $day)
                    ->filter(fn (int $day) => $day >= 0 && $day <= 6)
                    ->unique()
                    ->sort()
                    ->values()
                    ->all();
                $dates = collect($override['dates'] ?? [])
                    ->map(fn ($date) => (string) $date)
                    ->filter(fn (string $date) => preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1)
                    ->unique()
                    ->sort()
                    ->values()
                    ->all();
                $startHour = Carbon::createFromFormat('H:i', (string) ($override['start_hour'] ?? ''))->format('H:i');
                $endHour = Carbon::createFromFormat('H:i', (string) ($override['end_hour'] ?? ''))->format('H:i');
                $duration = max(5, (int) ($override['slot_duration_minutes'] ?? $override['duration_minutes'] ?? 0));

                if ($scope === '') {
                    abort(422, __('tenant.services.validation.override_scope_invalid'));
                }

                if ($scope === 'weekdays' && $weekdays === []) {
                    abort(422, __('tenant.services.validation.override_weekday_required'));
                }

                if ($scope === 'dates' && $dates === []) {
                    abort(422, __('tenant.services.validation.override_date_required'));
                }

                if ($startHour >= $endHour) {
                    abort(422, __('tenant.services.validation.override_end_after_start'));
                }

                return [
                    'scope' => $scope,
                    'weekdays' => $scope === 'weekdays' ? $weekdays : [],
                    'dates' => $scope === 'dates' ? $dates : [],
                    'start_hour' => $startHour,
                    'end_hour' => $endHour,
                    'duration_minutes' => $duration,
                ];
            })
            ->sortBy(fn (array $override) => "{$override['scope']} {$override['start_hour']} {$override['end_hour']}")
            ->values()
            ->all();

        $seenWeekdays = [];
        $seenDates = [];

        foreach ($normalized as $override) {
            if ($override['scope'] === 'weekdays') {
                foreach ($override['weekdays'] as $weekday) {
                    if (in_array($weekday, $seenWeekdays, true)) {
                        abort(422, __('tenant.services.validation.override_weekday_unique'));
                    }

                    $seenWeekdays[] = $weekday;
                }
            }

            if ($override['scope'] === 'dates') {
                foreach ($override['dates'] as $date) {
                    if (in_array($date, $seenDates, true)) {
                        abort(422, __('tenant.services.validation.override_date_unique'));
                    }

                    $seenDates[] = $date;
                }
            }
        }

        return $normalized;
    }

    /**
     * @param  array<int, array<string, mixed>>  $slots
     * @return array<int, array{id: string, date: string, start: string, end: string, reason: string}>
     */
    private function normalizeQuickBlockedSlots(array $slots): array
    {
        return collect($slots)
            ->filter(fn ($slot) => is_array($slot))
            ->map(function (array $slot): array {
                $date = Carbon::createFromFormat('Y-m-d', (string) ($slot['date'] ?? ''))->toDateString();
                $start = Carbon::createFromFormat('H:i', (string) ($slot['start'] ?? ''))->format('H:i');
                $end = Carbon::createFromFormat('H:i', (string) ($slot['end'] ?? ''))->format('H:i');
                $id = trim((string) ($slot['id'] ?? ''));

                if ($start >= $end) {
                    abort(422, __('tenant.services.validation.blocked_end_after_start'));
                }

                return [
                    'id' => $id !== '' ? $id : 'quick-'.$date.'-'.str_replace(':', '', $start).'-'.Str::lower(Str::random(6)),
                    'date' => $date,
                    'start' => $start,
                    'end' => $end,
                    'reason' => trim((string) ($slot['reason'] ?? '')),
                ];
            })
            ->unique(fn (array $slot) => "{$slot['date']} {$slot['start']} {$slot['end']}")
            ->sortBy(fn (array $slot) => "{$slot['date']} {$slot['start']} {$slot['end']}")
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $previousSlots
     * @param  array<int, array<string, mixed>>  $nextSlots
     */
    private function dispatchQuickBlockedSlotChanges(Service $service, array $previousSlots, array $nextSlots): void
    {
        if ($previousSlots === $nextSlots) {
            return;
        }

        collect([...$previousSlots, ...$nextSlots])
            ->pluck('date')
            ->filter()
            ->unique()
            ->each(fn (string $date) => event(new AppointmentAvailabilityChanged(
                tenant('id'),
                (string) $service->professional_id,
                $date,
                'updated',
                (string) $service->id,
            )));
    }

    /**
     * @param  array<int, array{start: string, end: string, scope: string, weekdays: array<int, int>, dates: array<int, string>}>  $breaks
     */
    private function assertScopedBreaksDoNotOverlapOnActiveDates(array $breaks, string $message): void
    {
        foreach ($breaks as $index => $break) {
            foreach (array_slice($breaks, $index + 1) as $nextBreak) {
                $timeOverlaps = $break['start'] < $nextBreak['end'] && $break['end'] > $nextBreak['start'];

                if ($timeOverlaps && $this->breakScopesOverlap($break, $nextBreak)) {
                    abort(422, $message);
                }
            }
        }
    }

    /**
     * @param  array{scope: string, weekdays: array<int, int>, dates: array<int, string>}  $first
     * @param  array{scope: string, weekdays: array<int, int>, dates: array<int, string>}  $second
     */
    private function breakScopesOverlap(array $first, array $second): bool
    {
        if ($first['scope'] === 'all' || $second['scope'] === 'all') {
            return true;
        }

        if ($first['scope'] === 'weekdays' && $second['scope'] === 'weekdays') {
            return array_intersect($first['weekdays'], $second['weekdays']) !== [];
        }

        if ($first['scope'] === 'dates' && $second['scope'] === 'dates') {
            return array_intersect($first['dates'], $second['dates']) !== [];
        }

        $weekdayBreak = $first['scope'] === 'weekdays' ? $first : $second;
        $dateBreak = $first['scope'] === 'dates' ? $first : $second;

        foreach ($dateBreak['dates'] as $date) {
            if (in_array(Carbon::createFromFormat('Y-m-d', $date)->dayOfWeek, $weekdayBreak['weekdays'], true)) {
                return true;
            }
        }

        return false;
    }
}
