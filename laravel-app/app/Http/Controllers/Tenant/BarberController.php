<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Booking\Models\Barber;
use App\Domain\Tenant\Models\TenantUser;
use App\Events\AppointmentAvailabilityChanged;
use App\Http\Controllers\Controller;
use App\Support\InputNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BarberController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user('tenant_web');
        $query = Barber::query()->with('user')->orderBy('sort_order')->orderByDesc('created_at');

        if ($actor?->role === 'admin') {
            // Admin sees all barbers.
        } elseif ($actor?->role === 'barber') {
            $query->where('user_id', $actor->id);
        } else {
            $query->where('is_active', true);
        }

        return response()->json([
            'success' => true,
            'data' => $query->get()->map(fn (Barber $barber) => $this->transform($barber)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $this->ensureProfessionalSlotAvailable();

        $request->merge([
            'mobile' => InputNormalizer::mobile($request->input('mobile')),
        ]);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'mobile' => ['required', 'regex:/^09\d{9}$/'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:professionals,slug'],
            'api_code' => ['nullable', 'string', 'max:64'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'can_access_panel' => ['nullable', 'boolean'],
        ], [
            'name.required' => __('tenant.barbers.validation.name_required'),
            'mobile.required' => __('tenant.barbers.validation.mobile_required'),
            'mobile.regex' => __('tenant.barbers.validation.mobile_format'),
        ]);

        $tenantUser = $this->resolveTenantUserForProfessional($validated);

        $barber = Barber::query()->create([
            'user_id' => $tenantUser->id,
            'name' => $validated['name'],
            'slug' => $validated['slug'] ?? Str::slug($validated['name']) . '-' . Str::lower(Str::random(6)),
            'api_code' => trim((string) ($validated['api_code'] ?? '')) ?: null,
            'sort_order' => $validated['sort_order'] ?? ((int) Barber::query()->max('sort_order') + 10),
            'is_active' => $validated['is_active'] ?? true,
            'can_access_panel' => $validated['can_access_panel'] ?? true,
            'settings' => [
                'active_ranges' => [],
                'disabled_dates' => [],
                'blocked_time_ranges' => [],
                'booking_lead_mode' => 'today',
                'booking_lead_hours' => 2,
                'booking_lead_days' => 1,
                'booking_horizon_mode' => 'days',
                'booking_max_days' => 30,
                'booking_max_date' => '',
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.barbers.created'),
            'data' => $this->transform($barber->load('user')),
        ], 201);
    }

    public function update(Request $request, Barber $barber): JsonResponse
    {
        $actor = $request->user('tenant_web');
        $isAdmin = $actor?->role === 'admin';
        $isOwnerBarber = $actor?->role === 'barber' && (int) $barber->user_id === (int) $actor->id;

        abort_unless($isAdmin || $isOwnerBarber, 403);
        abort_if($isOwnerBarber && ! $barber->can_access_panel, 403, __('authorization.professional_panel_blocked'));

        $request->merge([
            'mobile' => InputNormalizer::mobile($request->input('mobile')),
        ]);

        $validated = $request->validate([
            'name' => [$isAdmin ? 'required' : 'nullable', 'string', 'max:255'],
            'mobile' => [$isAdmin ? 'required' : 'nullable', 'regex:/^09\d{9}$/'],
            'api_code' => [$isAdmin ? 'nullable' : 'prohibited', 'string', 'max:64'],
            'sort_order' => [$isAdmin ? 'nullable' : 'prohibited', 'integer', 'min:0'],
            'is_active' => [$isAdmin ? 'required' : 'nullable', 'boolean'],
            'can_access_panel' => [$isAdmin ? 'nullable' : 'prohibited', 'boolean'],
            'activeRanges' => ['nullable', 'array'],
            'disabledDates' => ['nullable', 'array'],
            'blockedTimeRanges' => ['nullable', 'array'],
            'blockedTimeRanges.*.id' => ['nullable', 'string', 'max:64'],
            'blockedTimeRanges.*.date' => ['required_with:blockedTimeRanges', 'date_format:Y-m-d'],
            'blockedTimeRanges.*.start' => ['required_with:blockedTimeRanges', 'date_format:H:i'],
            'blockedTimeRanges.*.end' => ['required_with:blockedTimeRanges', 'date_format:H:i'],
            'blockedTimeRanges.*.reason' => ['nullable', 'string', 'max:120'],
            'bookingLeadMode' => ['nullable', 'in:today,days'],
            'bookingLeadHours' => ['nullable', 'integer', 'min:0'],
            'bookingLeadDays' => ['nullable', 'integer', 'min:1'],
            'bookingHorizonMode' => ['nullable', 'in:days,date'],
            'bookingMaxDays' => ['nullable', 'integer', 'min:0'],
            'bookingMaxDate' => ['nullable', 'string'],
        ], [
            'name.required' => __('tenant.barbers.validation.name_required'),
            'mobile.required' => __('tenant.barbers.validation.mobile_required'),
            'mobile.regex' => __('tenant.barbers.validation.mobile_format'),
        ]);

        $tenantUser = $barber->user;
        if ($isAdmin) {
            $tenantUser = $this->resolveTenantUserForProfessional($validated, $barber);
        }

        $previousBlockedTimeRanges = $this->normalizeBlockedTimeRanges(
            (array) (($barber->settings ?? [])['blocked_time_ranges'] ?? []),
        );
        $blockedTimeRanges = $this->normalizeBlockedTimeRanges($validated['blockedTimeRanges'] ?? []);

        $barber->update([
            'user_id' => $isAdmin ? $tenantUser?->id : $barber->user_id,
            'name' => $isAdmin ? $validated['name'] : $barber->name,
            'api_code' => $isAdmin ? (trim((string) ($validated['api_code'] ?? '')) ?: null) : $barber->api_code,
            'sort_order' => $isAdmin ? ($validated['sort_order'] ?? $barber->sort_order) : $barber->sort_order,
            'is_active' => $isAdmin ? $validated['is_active'] : $barber->is_active,
            'can_access_panel' => $isAdmin ? ($validated['can_access_panel'] ?? $barber->can_access_panel) : $barber->can_access_panel,
            'settings' => [
                'active_ranges' => $validated['activeRanges'] ?? [],
                'disabled_dates' => $validated['disabledDates'] ?? [],
                'blocked_time_ranges' => $blockedTimeRanges,
                'booking_lead_mode' => $validated['bookingLeadMode'] ?? 'today',
                'booking_lead_hours' => $validated['bookingLeadHours'] ?? 2,
                'booking_lead_days' => $validated['bookingLeadDays'] ?? 1,
                'booking_horizon_mode' => $validated['bookingHorizonMode'] ?? 'days',
                'booking_max_days' => $validated['bookingMaxDays'] ?? 30,
                'booking_max_date' => $validated['bookingMaxDate'] ?? '',
            ],
        ]);

        if ($previousBlockedTimeRanges !== $blockedTimeRanges) {
            collect([...$previousBlockedTimeRanges, ...$blockedTimeRanges])
                ->pluck('date')
                ->filter()
                ->unique()
                ->each(fn (string $date) => event(new AppointmentAvailabilityChanged(
                    (string) tenant('id'),
                    (string) $barber->id,
                    $date,
                    'availability_block_updated',
                    'availability-block',
                )));
        }

        return response()->json([
            'success' => true,
            'message' => __('tenant.barbers.updated'),
            'data' => $this->transform($barber->fresh('user')),
        ]);
    }

    public function destroy(Request $request, Barber $barber): JsonResponse
    {
        $this->ensureAdmin($request);

        $tenantUser = $barber->user;

        $barber->services()->delete();
        $barber->delete();

        if ($tenantUser && $this->shouldDeleteProfessionalUser($tenantUser)) {
            $tenantUser->delete();
        }

        return response()->json([
            'success' => true,
            'message' => __('tenant.barbers.deleted'),
            'data' => true,
        ]);
    }

    private function resolveTenantUserForProfessional(array $validated, ?Barber $currentBarber = null): TenantUser
    {
        $mobile = (string) $validated['mobile'];
        $name = trim((string) $validated['name']);
        $isActive = (bool) ($validated['is_active'] ?? true);

        $tenantUser = TenantUser::query()->where('mobile', $mobile)->first();

        if (! $tenantUser) {
            $tenantUser = TenantUser::query()->create([
                'name' => $name,
                'mobile' => $mobile,
                'password' => Hash::make('1234'),
                'role' => 'barber',
                'is_active' => $isActive,
                'can_book' => true,
            ]);

            $tenantUser->syncRoles(['barber']);

            return $tenantUser;
        }

        $professionalUsingUser = Barber::query()
            ->where('user_id', $tenantUser->id)
            ->when($currentBarber, fn ($query) => $query->whereKeyNot($currentBarber->id))
            ->exists();

        if ($professionalUsingUser) {
            throw ValidationException::withMessages([
                'mobile' => __('tenant.barbers.validation.mobile_already_assigned'),
            ]);
        }

        $updates = [
            'name' => $name !== '' ? $name : $tenantUser->name,
            'can_book' => true,
        ];

        if ($tenantUser->role !== 'admin') {
            $updates['is_active'] = $isActive;
            $updates['role'] = 'barber';
        }

        $tenantUser->forceFill($updates)->save();

        if ($tenantUser->role !== 'admin') {
            $tenantUser->syncRoles(['barber']);
        }

        return $tenantUser;
    }

    private function shouldDeleteProfessionalUser(TenantUser $tenantUser): bool
    {
        if ($tenantUser->role !== 'barber') {
            return false;
        }

        if ($tenantUser->central_user_id !== null) {
            return false;
        }

        return ! Barber::query()->where('user_id', $tenantUser->id)->exists();
    }

    private function transform(Barber $barber): array
    {
        $settings = $barber->settings ?? [];

        return [
            'id' => (string) $barber->id,
            'name' => $barber->name,
            'apiCode' => $barber->api_code,
            'mobile' => $barber->user?->mobile,
            'userId' => $barber->user_id ? (string) $barber->user_id : null,
            'sortOrder' => (int) $barber->sort_order,
            'isActive' => (bool) $barber->is_active,
            'canAccessPanel' => (bool) $barber->can_access_panel,
            'createdAt' => $barber->created_at?->toISOString(),
            'activeRanges' => $settings['active_ranges'] ?? [],
            'disabledDates' => $settings['disabled_dates'] ?? [],
            'blockedTimeRanges' => $settings['blocked_time_ranges'] ?? [],
            'bookingLeadMode' => $settings['booking_lead_mode'] ?? 'today',
            'bookingLeadHours' => (int) ($settings['booking_lead_hours'] ?? 2),
            'bookingLeadDays' => (int) ($settings['booking_lead_days'] ?? 1),
            'bookingHorizonMode' => $settings['booking_horizon_mode'] ?? 'days',
            'bookingMaxDays' => (int) ($settings['booking_max_days'] ?? 30),
            'bookingMaxDate' => $settings['booking_max_date'] ?? '',
        ];
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403);
    }

    /**
     * @param  array<int, array<string, mixed>>  $ranges
     * @return array<int, array{id: string, date: string, start: string, end: string, reason: string}>
     */
    private function normalizeBlockedTimeRanges(array $ranges): array
    {
        return collect($ranges)
            ->filter(fn ($range) => is_array($range))
            ->map(function (array $range): array {
                $start = (string) ($range['start'] ?? '');
                $end = (string) ($range['end'] ?? '');

                if ($start >= $end) {
                    throw ValidationException::withMessages([
                        'blockedTimeRanges' => __('tenant.barbers.validation.blocked_range_order'),
                    ]);
                }

                return [
                    'id' => trim((string) ($range['id'] ?? '')) ?: (string) Str::uuid(),
                    'date' => (string) ($range['date'] ?? ''),
                    'start' => $start,
                    'end' => $end,
                    'reason' => trim((string) ($range['reason'] ?? '')),
                ];
            })
            ->sortBy(fn (array $range) => "{$range['date']} {$range['start']}")
            ->values()
            ->all();
    }

    private function ensureProfessionalSlotAvailable(): void
    {
        $tenant = tenant()->loadMissing(['subscriptionPackage', 'audienceType']);
        $package = $tenant->subscriptionPackage;
        $userLimit = $package?->user_limit;

        if ($package === null || $userLimit === null) {
            return;
        }

        $professionalCount = Barber::query()->count();
        if ($professionalCount < (int) $userLimit) {
            return;
        }

        $label = $tenant->audienceType?->singular_label ?: __('tenant.barbers.professional_fallback');
        $formattedLimit = number_format((int) $userLimit);

        throw ValidationException::withMessages([
            'limit' => __('tenant.barbers.validation.package_limit', [
                'limit' => $formattedLimit,
                'professional' => $label,
            ]),
        ]);
    }
}
