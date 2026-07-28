<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Booking\Models\AppointmentPayment;
use App\Domain\Booking\Models\Barber;
use App\Domain\Booking\Models\Service;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Events\AppointmentAvailabilityChanged;
use App\Exports\Tenant\DailyReportExport;
use App\Http\Controllers\Controller;
use App\Services\AppointmentCacheService;
use App\Services\AppointmentReminderService;
use App\Services\AppointmentSmsService;
use App\Services\CustomerClubService;
use App\Services\CustomerFeedbackService;
use App\Services\TelegramUserNotificationService;
use App\Services\TenantAppointmentBookingService;
use App\Support\AppointmentPublicLink;
use App\Support\CustomerFeedbackPublicLink;
use App\Support\InputNormalizer;
use App\Support\ServiceScheduleResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class AppointmentController extends Controller
{
    private const CUSTOMER_CANCELLATION_LOCK_MESSAGE = 'امکان کنسل کردن این نوبت را ندارید و نوبت شما نهایی شده است';

    private ?int $customerCancellationCutoffHoursCache = null;

    public function __construct(
        private readonly AppointmentCacheService $cacheService,
        private readonly TenantAppointmentBookingService $bookingService,
        private readonly AppointmentSmsService $appointmentSmsService,
        private readonly AppointmentReminderService $appointmentReminderService,
        private readonly CustomerClubService $customerClubService,
        private readonly CustomerFeedbackService $customerFeedbackService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user('tenant_web');

        $request->merge([
            'professional_id' => $request->input('professional_id', $request->input('barber_id')),
        ]);

        $validated = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'professional_id' => ['nullable', 'integer', 'exists:professionals,id'],
        ]);

        $items = $this->cacheService->rememberDayList(
            (string) tenant('id'),
            $validated['date'],
            isset($validated['professional_id']) ? (int) $validated['professional_id'] : null,
            function () use ($validated) {
                $appointments = Appointment::query()
                    ->with(['barber:id,name', 'service:id,name', 'creator:id,name,mobile', 'customerFeedbackInvitation:id,appointment_id,token,status,responded_at'])
                    ->where('appointment_date', $validated['date'])
                    ->when(isset($validated['professional_id']), fn ($query) => $query->where('professional_id', $validated['professional_id']))
                    ->whereIn('status', ['booked', 'completed', 'no_show'])
                    ->orderBy('start_time')
                    ->get()
                    ->map(fn (Appointment $appointment) => $this->transform($appointment));

                $pendingPayments = AppointmentPayment::query()
                    ->with(['service:id,name'])
                    ->where('appointment_date', $validated['date'])
                    ->when(isset($validated['professional_id']), fn ($query) => $query->where('professional_id', $validated['professional_id']))
                    ->where('status', 'pending')
                    ->where('expires_at', '>', now())
                    ->orderBy('start_time')
                    ->get()
                    ->map(fn (AppointmentPayment $payment) => $this->transformPendingPayment($payment));

                return $appointments
                    ->concat($pendingPayments)
                    ->sortBy('startTime')
                    ->values()
                    ->all();
            }
        );

        $actorBarber = $actor?->role === 'barber' ? $this->resolveActorBarber($actor) : null;
        $visibleItems = collect($items)
            ->map(fn (array $item) => $this->sanitizeDayListItem($item, $actor, $actorBarber))
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'data' => $visibleItems,
        ]);
    }

    public function mine(Request $request): JsonResponse
    {
        $actor = $request->user('tenant_web');

        if (! $actor) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'scope' => ['nullable', 'in:upcoming,past'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $scope = $validated['scope'] ?? 'upcoming';
        $perPage = (int) ($validated['per_page'] ?? 10);
        $today = now()->toDateString();
        $currentTime = now()->format('H:i:s');

        $query = Appointment::query()
            ->with(['barber:id,name', 'service:id,name', 'creator:id,name,mobile', 'customerFeedbackInvitation:id,appointment_id,token,status,responded_at'])
            ->where(function ($query) use ($actor) {
                $query
                    ->where('customer_phone_snapshot', $actor->mobile)
                    ->orWhere('meta->tenant_customer_user_id', (int) $actor->id);
            });

        if ($scope === 'upcoming') {
            $query->whereIn('status', ['booked', 'pending_payment']);
            $query->where(function ($query) use ($today, $currentTime) {
                $query
                    ->where('appointment_date', '>', $today)
                    ->orWhere(function ($subQuery) use ($today, $currentTime) {
                        $subQuery
                            ->where('appointment_date', $today)
                            ->where('start_time', '>=', $currentTime);
                    });
            })->orderBy('appointment_date')->orderBy('start_time');
        } else {
            $query->whereIn('status', ['completed', 'no_show', 'cancelled']);
            $query->where(function ($query) use ($today, $currentTime) {
                $query
                    ->where('appointment_date', '<', $today)
                    ->orWhere(function ($subQuery) use ($today, $currentTime) {
                        $subQuery
                            ->where('appointment_date', $today)
                            ->where('start_time', '<', $currentTime);
                    });
            })->orderByDesc('appointment_date')->orderByDesc('start_time');
        }

        $page = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $page->getCollection()->map(fn (Appointment $appointment) => $this->transform($appointment))->values(),
                'currentPage' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function recentBookings(Request $request): JsonResponse
    {
        $actorBarber = $this->ensureStaff($request);

        $validated = $request->validate([
            'after' => ['nullable', 'date'],
        ]);

        $after = isset($validated['after'])
            ? now()->parse($validated['after'])->subSeconds(3)
            : now()->subSeconds(20);

        $items = Appointment::query()
            ->with(['barber:id,name', 'service:id,name', 'creator:id,name,mobile,role'])
            ->where('status', 'booked')
            ->where('created_at', '>=', $after)
            ->whereHas('creator', fn ($query) => $query->whereNotIn('role', ['admin', 'barber']))
            ->when($actorBarber, fn ($query) => $query->where('professional_id', $actorBarber->id))
            ->orderBy('created_at')
            ->orderBy('id')
            ->limit(25)
            ->get()
            ->map(fn (Appointment $appointment) => $this->transform($appointment))
            ->values();

        return response()->json([
            'success' => true,
            'data' => $items,
        ]);
    }

    public function latestBookings(Request $request): JsonResponse
    {
        $actorBarber = $this->ensureStaff($request);

        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'name' => ['nullable', 'string', 'max:120'],
            'mobile' => ['nullable', 'string', 'max:40'],
            'status' => ['nullable', 'in:confirmed,pending,cancelled'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 15);

        $page = Appointment::query()
            ->with(['barber:id,name', 'service:id,name', 'creator:id,name,mobile,role', 'customerFeedbackInvitation:id,appointment_id,token,status,responded_at'])
            ->when($actorBarber, fn ($query) => $query->where('professional_id', $actorBarber->id))
            ->when(isset($validated['date']), fn ($query) => $query->whereDate('appointment_date', $validated['date']))
            ->when(trim((string) ($validated['name'] ?? '')) !== '', function ($query) use ($validated) {
                $name = trim((string) $validated['name']);

                $query->where('customer_name_snapshot', 'like', "%{$name}%");
            })
            ->when(trim((string) ($validated['mobile'] ?? '')) !== '', function ($query) use ($validated) {
                $mobile = InputNormalizer::mobile(trim((string) $validated['mobile'])) ?: trim((string) $validated['mobile']);

                $query->where('customer_phone_snapshot', 'like', "%{$mobile}%");
            })
            ->when(($validated['status'] ?? null) === 'confirmed', fn ($query) => $query->whereIn('status', ['booked', 'completed', 'no_show']))
            ->when(($validated['status'] ?? null) === 'pending', fn ($query) => $query->where('status', 'pending_payment'))
            ->when(($validated['status'] ?? null) === 'cancelled', fn ($query) => $query->where('status', 'cancelled'))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $page->getCollection()->map(fn (Appointment $appointment) => $this->transform($appointment))->values(),
                'currentPage' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function transientAlerts(Request $request): JsonResponse
    {
        $actorBarber = $this->ensureStaff($request);

        $validated = $request->validate([
            'after' => ['nullable', 'date'],
        ]);

        $after = isset($validated['after'])
            ? now()->parse($validated['after'])->subSeconds(3)
            : now()->subSeconds(20);

        $cacheKey = sprintf('tenant:%s:appointment-booking-alerts', (string) tenant('id'));
        $alerts = Cache::get($cacheKey, []);

        if (! is_array($alerts)) {
            $alerts = [];
        }

        $items = collect($alerts)
            ->filter(fn ($item) => is_array($item) && is_array($item['appointment'] ?? null))
            ->filter(function (array $item) use ($after, $actorBarber): bool {
                $createdAt = isset($item['createdAt']) ? now()->parse((string) $item['createdAt']) : null;

                if (! $createdAt || $createdAt->lt($after)) {
                    return false;
                }

                if ($actorBarber) {
                    return (string) ($item['appointment']['barberId'] ?? '') === (string) $actorBarber->id;
                }

                return true;
            })
            ->sortBy(fn (array $item) => (string) ($item['createdAt'] ?? ''))
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'data' => $items,
        ]);
    }

    public function exportDailyReport(Request $request): BinaryFileResponse
    {
        $actorBarber = $this->ensureStaff($request);

        $request->merge([
            'professional_id' => $request->input('professional_id', $request->input('barber_id')),
        ]);

        $validated = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'professional_id' => ['nullable', 'integer', 'exists:professionals,id'],
        ], [
            'date.required' => 'تاریخ گزارش را انتخاب کنید.',
            'date.date_format' => 'فرمت تاریخ گزارش معتبر نیست.',
            'professional_id.required' => 'آرایشگر را انتخاب کنید.',
        ]);

        $barber = $actorBarber;

        if (! $barber) {
            abort_unless(isset($validated['professional_id']), 422, 'آرایشگر را انتخاب کنید.');
            $barber = Barber::query()->findOrFail($validated['professional_id']);
        }

        $statusLabels = [
            'completed' => 'آمده',
            'no_show' => 'نیامده',
            'booked' => 'نامشخص',
        ];

        $rows = Appointment::query()
            ->with(['barber:id,name', 'service:id,name'])
            ->where('appointment_date', $validated['date'])
            ->where('professional_id', $barber->id)
            ->whereIn('status', ['booked', 'completed', 'no_show'])
            ->orderBy('start_time')
            ->get()
            ->map(function (Appointment $appointment) use ($statusLabels, $barber) {
                return [
                    substr((string) $appointment->start_time, 0, 5),
                    $appointment->customer_name_snapshot,
                    $appointment->customer_phone_snapshot,
                    $appointment->service_name_snapshot ?: $appointment->service?->name,
                    $appointment->professional_name_snapshot ?: $barber->name,
                    $appointment->notes,
                    $statusLabels[$appointment->status] ?? 'نامشخص',
                    (bool) ($appointment->meta['off_queue_booking'] ?? false) ? 'خارج از صف' : 'عادی',
                ];
            });

        $audience = tenant()->loadMissing('audienceType')->audienceType;
        $professionalLabel = $audience?->singular_label ?: 'آرایشگر';
        $safeBarber = preg_replace('/[^\p{Arabic}\p{L}\p{N}\-_]+/u', '-', $barber->name) ?: 'barber';
        $fileName = sprintf('daily-report-%s-%s.xlsx', $validated['date'], $safeBarber);

        return Excel::download(new DailyReportExport($rows, $professionalLabel), $fileName);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantUser = $request->user('tenant_web');
        if (! $tenantUser) {
            return response()->json([
                'success' => false,
                'message' => 'برای ثبت نوبت ابتدا وارد حساب کاربری شوید.',
            ], 401);
        }

        $bookingRules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $audience = tenant()->loadMissing('audienceType:id,slug')->audienceType;
        $appointmentBookingDisabled = in_array($audience?->slug, ['nutritionists', 'nutrition-doctors'], true)
            && (bool) ($bookingRules['appointment_booking_disabled'] ?? false);
        $bookingClosedForUsers = (bool) ($bookingRules['booking_closed_enabled'] ?? false);
        $isStaff = in_array($tenantUser->role, ['admin', 'barber'], true);

        if ($appointmentBookingDisabled) {
            return response()->json([
                'success' => false,
                'message' => 'نوبت‌دهی برای این مجموعه غیرفعال است و فقط بخش رژیم در دسترس است.',
            ], 423);
        }

        if (! $isStaff && ! $tenantUser->can_book) {
            return response()->json([
                'success' => false,
                'message' => 'هم اکنون نوبت‌دهی برای حساب شما غیر فعال است.',
            ], 423);
        }

        if ($bookingClosedForUsers && ! $isStaff) {
            return response()->json([
                'success' => false,
                'message' => 'هم اکنون نوبت دهی برای کاربران سایت غیر فعال است.',
            ], 423);
        }

        $request->merge([
            'userPhone' => InputNormalizer::mobile($request->input('userPhone')),
            'originalUserPhone' => InputNormalizer::mobile($request->input('originalUserPhone')),
        ]);

        $validated = $request->validate([
            'barberId' => ['required', 'integer', 'exists:professionals,id'],
            'sectionId' => ['required', 'integer', 'exists:services,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'startTime' => ['required', 'date_format:H:i'],
            'endTime' => ['required', 'date_format:H:i'],
            'userName' => ['required', 'string', 'max:255'],
            'userPhone' => ['required', InputNormalizer::mobileRule()],
            'originalUserPhone' => ['nullable', InputNormalizer::mobileRule()],
            'notes' => ['nullable', 'string'],
            'sendSms' => ['nullable', 'boolean'],
            'isForSomeoneElse' => ['nullable', 'boolean'],
            'offQueueBooking' => ['nullable', 'boolean'],
        ], [
            'userPhone.regex' => __('api.auth.mobile_regex'),
        ]);

        $appointment = $this->bookingService->book($tenantUser, $validated);

        return response()->json([
            'success' => true,
            'message' => 'نوبت با موفقیت ثبت شد.',
            'data' => $this->transform($appointment->load(['barber:id,name', 'service:id,name', 'creator:id,name,mobile', 'customerFeedbackInvitation:id,appointment_id,token,status,responded_at'])),
        ], 201);
    }

    public function show(Request $request, Appointment $appointment): JsonResponse
    {
        $actorBarber = $this->ensureStaff($request);

        if ($actorBarber) {
            abort_unless((int) $appointment->professional_id === (int) $actorBarber->id, 403, 'شما فقط به نوبت‌های خودتان دسترسی دارید.');
        }

        return response()->json([
            'success' => true,
            'data' => $this->transform($appointment->load(['barber:id,name,user_id,can_access_panel', 'service:id,name,professional_id,duration_minutes,price,settings', 'creator:id,name,mobile,role', 'customerFeedbackInvitation:id,appointment_id,token,status,responded_at'])),
        ]);
    }

    public function changeTime(Request $request, Appointment $appointment): JsonResponse
    {
        $actorBarber = $this->ensureStaff($request);

        if ($actorBarber) {
            abort_unless((int) $appointment->professional_id === (int) $actorBarber->id, 403, 'شما فقط می‌توانید ساعت نوبت‌های خودتان را تغییر دهید.');
        }

        $validated = $request->validate([
            'startTime' => ['required', 'date_format:H:i'],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'sendSms' => ['nullable', 'boolean'],
        ]);

        abort_unless($appointment->status === 'booked', 422, 'فقط نوبت‌های فعال قابل تغییر ساعت هستند.');

        $previousDate = $appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date');
        abort_if($previousDate < now()->toDateString(), 422, 'امکان تغییر ساعت نوبت‌های گذشته وجود ندارد.');

        $date = $validated['date'] ?? $previousDate;
        abort_if($date < now()->toDateString(), 422, 'امکان انتقال نوبت به روز گذشته وجود ندارد.');

        $service = Service::query()->findOrFail($appointment->service_id);
        $settings = $service->settings ?? [];
        $schedule = ServiceScheduleResolver::resolve($service, $date);

        $startsAt = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$validated['startTime']}");
        $endsAt = (clone $startsAt)->addMinutes((int) $appointment->duration_minutes ?: (int) $service->duration_minutes);
        $sectionStartsAt = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$schedule['start_hour']}");
        $sectionEndsAt = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$schedule['end_hour']}");

        abort_if(
            $startsAt->lt($sectionStartsAt) || $endsAt->gt($sectionEndsAt),
            422,
            'ساعت انتخاب‌شده خارج از بازه این بخش است.'
        );

        $checkConflicts = (bool) ($settings['check_conflicts'] ?? true);
        $isOffQueueBooking = (bool) ($appointment->meta['off_queue_booking'] ?? false);

        if (! $isOffQueueBooking) {
            $barber = Barber::query()->findOrFail($appointment->professional_id);
            $blockedTimeRanges = $barber->settings['blocked_time_ranges'] ?? [];

            if ($this->overlapsProfessionalBlock($startsAt, $endsAt, $date, is_array($blockedTimeRanges) ? $blockedTimeRanges : [])) {
                throw ValidationException::withMessages([
                    'startTime' => 'این بازه توسط آرایشگر بسته شده است.',
                ]);
            }
        }

        $quickBlockedSlots = is_array($settings['quick_blocked_slots'] ?? null) ? $settings['quick_blocked_slots'] : [];
        if (! $isOffQueueBooking && $this->overlapsQuickBlockedSlots($startsAt, $endsAt, $date, $quickBlockedSlots)) {
            throw ValidationException::withMessages([
                'startTime' => 'این ساعت بسته شده است.',
            ]);
        }

        if ($checkConflicts && ! $isOffQueueBooking) {
            $hasBookedOverlap = Appointment::query()
                ->whereKeyNot($appointment->id)
                ->where('professional_id', $appointment->professional_id)
                ->where('appointment_date', $date)
                ->where('status', 'booked')
                ->where('starts_at', '<', $endsAt)
                ->where('ends_at', '>', $startsAt)
                ->exists();

            $hasPendingPaymentOverlap = AppointmentPayment::query()
                ->where('professional_id', $appointment->professional_id)
                ->where('appointment_date', $date)
                ->where('status', 'pending')
                ->where('expires_at', '>', now())
                ->where('start_time', '<', $endsAt->format('H:i:s'))
                ->where('end_time', '>', $startsAt->format('H:i:s'))
                ->exists();

            if ($hasBookedOverlap || $hasPendingPaymentOverlap) {
                throw ValidationException::withMessages([
                    'startTime' => 'این ساعت با نوبت دیگری تداخل دارد.',
                ]);
            }
        }

        $previousTime = substr((string) $appointment->start_time, 0, 5);
        $this->cacheService->forgetForAppointment((string) tenant('id'), $appointment);

        $appointment->update([
            'appointment_date' => $date,
            'start_time' => $startsAt->format('H:i'),
            'end_time' => $endsAt->format('H:i'),
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            ...$this->appointmentReminderService->rescheduleAttributes($appointment, $startsAt),
        ]);

        $freshAppointment = $appointment->fresh(['barber:id,name', 'service:id,name', 'creator:id,name,mobile,role', 'customerFeedbackInvitation:id,appointment_id,token,status,responded_at']);
        $this->cacheService->forgetForAppointment((string) tenant('id'), $freshAppointment);

        event(new AppointmentAvailabilityChanged(
            tenant('id'),
            (string) $freshAppointment->professional_id,
            $date,
            'updated',
            (string) $freshAppointment->id,
        ));

        if ($date !== $previousDate) {
            event(new AppointmentAvailabilityChanged(
                tenant('id'),
                (string) $freshAppointment->professional_id,
                $previousDate,
                'updated',
                (string) $freshAppointment->id,
            ));
        }

        if ((bool) ($validated['sendSms'] ?? false)) {
            $this->appointmentSmsService->sendAppointmentChange($freshAppointment);
        }

        app(TelegramUserNotificationService::class)->appointmentChanged($freshAppointment, $previousDate, $previousTime);

        $newTime = substr((string) $freshAppointment->start_time, 0, 5);
        $message = $date === $previousDate
            ? "ساعت نوبت از {$previousTime} به {$newTime} تغییر کرد."
            : "نوبت از {$previousDate} ساعت {$previousTime} به {$date} ساعت {$newTime} منتقل شد.";

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $this->transform($freshAppointment),
        ]);
    }

    public function cancel(Request $request, Appointment $appointment): JsonResponse
    {
        $actor = $request->user('tenant_web');

        if (! $actor) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        if (! $this->canActorCancel($appointment, $actor)) {
            return response()->json(['success' => false, 'message' => 'عدم دسترسی.'], 403);
        }

        if ($this->isCustomerCancellationLocked($appointment, $actor)) {
            return response()->json([
                'success' => false,
                'message' => self::CUSTOMER_CANCELLATION_LOCK_MESSAGE,
            ], 422);
        }

        $validated = $request->validate([
            'sendSms' => ['nullable', 'boolean'],
        ]);

        $shouldSendCancellationSms = $actor->role === 'admin'
            ? (bool) ($validated['sendSms'] ?? false)
            : true;

        $appointment->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            ...$this->appointmentReminderService->releaseLockAttributes(),
        ]);

        $this->customerClubService->reverseAppointmentAward(
            $appointment->fresh(),
            'به دلیل لغو نوبت، امتیاز و اعتبار باشگاه مشتریان این نوبت از حساب شما برگشت داده شد.',
        );

        $this->cacheService->forgetForAppointment((string) tenant('id'), $appointment);
        event(new AppointmentAvailabilityChanged(
            tenant('id'),
            (string) $appointment->barber_id,
            $appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date'),
            'cancelled',
            (string) $appointment->id,
        ));

        if ($shouldSendCancellationSms) {
            $this->appointmentSmsService->sendCancellation($appointment->fresh());
        }

        if (in_array($actor->role, ['admin', 'barber'], true)) {
            app(TelegramUserNotificationService::class)->appointmentCancelled($appointment->fresh() ?? $appointment);
        }

        return response()->json([
            'success' => true,
            'message' => 'نوبت لغو شد.',
            'data' => true,
        ]);
    }

    public function publicShow(Request $request, string $code): JsonResponse
    {
        $appointment = Appointment::query()
            ->with(['barber:id,name', 'service:id,name', 'creator:id,name,mobile,role'])
            ->where('public_code', $code)
            ->firstOrFail();

        $actor = $request->user('tenant_web');
        $location = $this->contactLocationPayload();
        $canCancel = $actor ? $this->canActorCancel($appointment, $actor) : false;
        $cancellationLocked = $actor ? $this->isCustomerCancellationLocked($appointment, $actor) : false;

        return response()->json([
            'success' => true,
            'data' => [
                'id' => (string) $appointment->id,
                'publicCode' => (string) $appointment->public_code,
                'publicUrl' => AppointmentPublicLink::publicUrl($appointment),
                'customerName' => (string) $appointment->customer_name_snapshot,
                'barberName' => $appointment->professional_name_snapshot ?: $appointment->barber?->name,
                'sectionName' => $appointment->service_name_snapshot ?: $appointment->service?->name,
                'date' => $appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date'),
                'startTime' => substr((string) $appointment->start_time, 0, 5),
                'endTime' => substr((string) $appointment->end_time, 0, 5),
                'status' => $appointment->status,
                'statusLabel' => $this->statusLabel($appointment->status),
                'priceAmount' => (int) $appointment->price_amount,
                'durationMinutes' => (int) $appointment->duration_minutes,
                'bookedAt' => $appointment->created_at?->toISOString(),
                'canCancel' => $canCancel && $appointment->status === 'booked' && ! $cancellationLocked,
                'customerCancellationCutoffHours' => $this->customerCancellationCutoffHours(),
                'cancellationLockedAt' => $this->customerCancellationLockedAt($appointment)?->toISOString(),
                'cancellationLockMessage' => $cancellationLocked ? self::CUSTOMER_CANCELLATION_LOCK_MESSAGE : null,
                'requiresLoginForCancel' => $actor === null,
                'managerNotes' => $actor?->role === 'admin' ? $appointment->notes : null,
                'location' => $location,
            ],
        ]);
    }

    public function bulkCancel(Request $request): JsonResponse
    {
        $actorBarber = $this->ensureStaff($request);

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:appointments,id'],
            'sendSms' => ['nullable', 'boolean'],
        ]);

        $appointments = Appointment::query()->whereIn('id', $validated['ids'])->get();

        if ($actorBarber) {
            abort_unless($appointments->every(fn (Appointment $appointment) => (int) $appointment->professional_id === (int) $actorBarber->id), 403, 'شما فقط می‌توانید نوبت‌های آرایشگر خودتان را لغو کنید.');
        }

        foreach ($appointments as $appointment) {
            $appointment->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                ...$this->appointmentReminderService->releaseLockAttributes(),
            ]);
            $this->customerClubService->reverseAppointmentAward(
                $appointment->fresh(),
                'به دلیل لغو نوبت، امتیاز و اعتبار باشگاه مشتریان این نوبت از حساب شما برگشت داده شد.',
            );
            $this->cacheService->forgetForAppointment((string) tenant('id'), $appointment);
            event(new AppointmentAvailabilityChanged(
                tenant('id'),
                (string) $appointment->barber_id,
                $appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date'),
                'cancelled',
                (string) $appointment->id,
            ));

            if ((bool) ($validated['sendSms'] ?? false)) {
                $this->appointmentSmsService->sendCancellation($appointment->fresh());
            }
        }

        $count = $appointments->count();

        return response()->json([
            'success' => true,
            'data' => [
                'cancelledCount' => $count,
                'smsSentCount' => ($validated['sendSms'] ?? false) ? $count : 0,
            ],
        ]);
    }

    public function updateAttendance(Request $request, Appointment $appointment): JsonResponse
    {
        $actorBarber = $this->ensureStaff($request);

        if ($actorBarber) {
            abort_unless((int) $appointment->professional_id === (int) $actorBarber->id, 403, 'شما فقط می‌توانید وضعیت نوبت‌های آرایشگر خودتان را تغییر دهید.');
        }

        $validated = $request->validate([
            'status' => ['required', 'in:booked,completed,no_show'],
            'block_customer_booking' => ['nullable', 'boolean'],
        ]);

        abort_if($appointment->status === 'cancelled', 422, 'نوبت لغوشده قابل تغییر وضعیت نیست.');

        $customerBookingBlocked = false;

        if (
            $validated['status'] === 'no_show'
            && (bool) ($validated['block_customer_booking'] ?? false)
        ) {
            $normalizedMobile = InputNormalizer::mobile((string) $appointment->customer_phone_snapshot);

            abort_unless(
                InputNormalizer::isValidMobile($normalizedMobile),
                422,
                'شماره موبایل مشتری معتبر نیست و امکان بستن دسترسی او وجود ندارد.'
            );

            $tenantUser = TenantUser::query()->firstOrCreate(
                ['mobile' => $normalizedMobile],
                [
                    'name' => $appointment->customer_name_snapshot,
                    'role' => 'customer',
                    'is_active' => true,
                    'can_book' => true,
                ],
            );

            abort_if(
                in_array($tenantUser->role, ['admin', 'barber'], true),
                422,
                'بستن دسترسی این نوع کاربر مجاز نیست.'
            );

            $tenantUser->update([
                'name' => $tenantUser->name ?: $appointment->customer_name_snapshot,
                'can_book' => false,
            ]);

            $customerBookingBlocked = true;
        }

        $previousStatus = $appointment->status;

        $appointment->update([
            'status' => $validated['status'],
            'completed_at' => $validated['status'] === 'completed' ? now() : null,
            ...($validated['status'] === 'booked' ? [] : $this->appointmentReminderService->releaseLockAttributes()),
        ]);

        $this->customerFeedbackService->syncInvitationForAppointment($appointment->fresh());

        if ($validated['status'] === 'no_show') {
            $this->customerClubService->reverseAppointmentAward(
                $appointment->fresh(),
                'به دلیل ثبت وضعیت مراجعه‌نکرده، امتیاز و اعتبار باشگاه مشتریان این نوبت از حساب شما برگشت داده شد.',
            );
        } elseif ($previousStatus === 'no_show' && in_array($validated['status'], ['booked', 'completed'], true)) {
            $this->customerClubService->reinstateAppointmentAward(
                $appointment->fresh(),
                'با اصلاح وضعیت نوبت، امتیاز و اعتبار باشگاه مشتریان این نوبت دوباره به حساب شما برگشت.',
            );
        }

        $this->cacheService->forgetForAppointment((string) tenant('id'), $appointment);

        return response()->json([
            'success' => true,
            'message' => $customerBookingBlocked
                ? 'وضعیت نوبت به‌روزرسانی شد و دسترسی رزرو کاربر بسته شد.'
                : 'وضعیت نوبت به‌روزرسانی شد.',
            'data' => $this->transform($appointment->load(['barber:id,name', 'service:id,name', 'creator:id,name,mobile', 'customerFeedbackInvitation:id,appointment_id,token,status,responded_at'])),
        ]);
    }

    private function transform(Appointment $appointment): array
    {
        $tenantCustomerUserId = data_get($appointment->meta, 'tenant_customer_user_id');
        $invitation = $appointment->relationLoaded('customerFeedbackInvitation')
            ? $appointment->customerFeedbackInvitation
            : $appointment->customerFeedbackInvitation()->first();

        $feedbackUrl = null;
        $feedbackStatus = null;

        if ($this->customerFeedbackService->isModuleActive() && $invitation?->token) {
            $feedbackUrl = CustomerFeedbackPublicLink::publicUrl($appointment);
            $feedbackStatus = $invitation->responded_at ? 'responded' : (string) $invitation->status;
        }

        return [
            'id' => (string) $appointment->id,
            'userId' => $tenantCustomerUserId !== null ? (string) $tenantCustomerUserId : '',
            'userPhone' => $appointment->customer_phone_snapshot,
            'userName' => $appointment->customer_name_snapshot,
            'bookedByUserId' => $appointment->created_by_user_id ? (string) $appointment->created_by_user_id : null,
            'bookedByPhone' => $appointment->booked_by_phone_snapshot ?: $appointment->creator?->mobile,
            'bookedByName' => $appointment->booked_by_name_snapshot ?: $appointment->creator?->name,
            'bookedByRole' => $appointment->creator?->role,
            'barberId' => (string) $appointment->professional_id,
            'barberName' => $appointment->professional_name_snapshot ?: $appointment->barber?->name,
            'sectionId' => (string) $appointment->service_id,
            'sectionName' => $appointment->service_name_snapshot ?: $appointment->service?->name,
            'date' => $appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date'),
            'startTime' => substr((string) $appointment->start_time, 0, 5),
            'endTime' => substr((string) $appointment->end_time, 0, 5),
            'status' => $appointment->status,
            'notes' => $appointment->notes,
            'sendSms' => (bool) ($appointment->meta['send_sms'] ?? false),
            'publicCode' => $appointment->public_code,
            'publicUrl' => AppointmentPublicLink::publicUrl($appointment),
            'feedbackUrl' => $feedbackUrl,
            'feedbackStatus' => $feedbackStatus,
            'createdAt' => $appointment->created_at?->toISOString(),
            'isForSomeoneElse' => (bool) ($appointment->meta['is_for_someone_else'] ?? false),
            'isOffQueue' => (bool) ($appointment->meta['off_queue_booking'] ?? false),
            'customerCancellationCutoffHours' => $this->customerCancellationCutoffHours(),
            'cancellationLockedAt' => $this->customerCancellationLockedAt($appointment)?->toISOString(),
            'cancellationLockMessage' => self::CUSTOMER_CANCELLATION_LOCK_MESSAGE,
        ];
    }

    private function transformPendingPayment(AppointmentPayment $payment): array
    {
        return [
            'id' => 'payment-'.$payment->id,
            'userId' => '',
            'userPhone' => $payment->customer_phone_snapshot,
            'userName' => $payment->customer_name_snapshot,
            'bookedByUserId' => $payment->created_by_user_id ? (string) $payment->created_by_user_id : null,
            'bookedByPhone' => $payment->booked_by_phone_snapshot,
            'bookedByName' => $payment->booked_by_name_snapshot,
            'bookedByRole' => null,
            'barberId' => (string) $payment->professional_id,
            'barberName' => null,
            'sectionId' => (string) $payment->service_id,
            'sectionName' => $payment->service?->name,
            'date' => $payment->appointment_date?->toDateString() ?? (string) $payment->getRawOriginal('appointment_date'),
            'startTime' => substr((string) $payment->start_time, 0, 5),
            'endTime' => substr((string) $payment->end_time, 0, 5),
            'status' => 'pending_payment',
            'notes' => $payment->notes,
            'sendSms' => (bool) ($payment->meta['send_sms'] ?? false),
            'publicCode' => null,
            'publicUrl' => null,
            'feedbackUrl' => null,
            'feedbackStatus' => null,
            'createdAt' => $payment->created_at?->toISOString(),
            'isForSomeoneElse' => (bool) ($payment->meta['is_for_someone_else'] ?? false),
            'isOffQueue' => false,
        ];
    }

    private function canActorCancel(Appointment $appointment, TenantUser $actor): bool
    {
        if ($actor->role === 'admin') {
            return true;
        }

        if ($actor->role === 'barber') {
            $actorBarber = $this->resolveActorBarber($actor);

            if (! $actorBarber || (int) $appointment->professional_id !== (int) $actorBarber->id) {
                return false;
            }

            if (! $actorBarber->can_access_panel) {
                return false;
            }

            return true;
        }

        return $this->isActorBookedCustomer($appointment, $actor);
    }

    private function isCustomerCancellationLocked(Appointment $appointment, TenantUser $actor): bool
    {
        if ($actor->role !== 'customer' || ! $this->isActorBookedCustomer($appointment, $actor)) {
            return false;
        }

        if ($appointment->status !== 'booked') {
            return false;
        }

        $lockedAt = $this->customerCancellationLockedAt($appointment);

        return $lockedAt !== null && now()->gte($lockedAt);
    }

    private function customerCancellationLockedAt(Appointment $appointment): ?Carbon
    {
        $startsAt = $appointment->starts_at;

        if (! $startsAt && $appointment->appointment_date && $appointment->start_time) {
            $date = $appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date');
            $time = strlen((string) $appointment->start_time) >= 8
                ? substr((string) $appointment->start_time, 0, 8)
                : substr((string) $appointment->start_time, 0, 5).':00';
            $startsAt = Carbon::createFromFormat('Y-m-d H:i:s', "{$date} {$time}");
        }

        if (! $startsAt) {
            return null;
        }

        return $startsAt->copy()->subHours($this->customerCancellationCutoffHours());
    }

    private function customerCancellationCutoffHours(): int
    {
        if ($this->customerCancellationCutoffHoursCache !== null) {
            return $this->customerCancellationCutoffHoursCache;
        }

        $bookingRules = GeneralSetting::query()->first()?->booking_rules ?? [];

        return $this->customerCancellationCutoffHoursCache = max(1, (int) ($bookingRules['customer_cancellation_cutoff_hours'] ?? 2));
    }

    private function isActorBookedCustomer(Appointment $appointment, TenantUser $actor): bool
    {
        if ($appointment->created_by_user_id !== null && (int) $appointment->created_by_user_id === (int) $actor->id) {
            return true;
        }

        $tenantCustomerUserId = data_get($appointment->meta, 'tenant_customer_user_id');

        if ($tenantCustomerUserId !== null && (int) $tenantCustomerUserId === (int) $actor->id) {
            return true;
        }

        $actorMobile = InputNormalizer::mobile((string) $actor->mobile);
        $customerMobile = InputNormalizer::mobile((string) $appointment->customer_phone_snapshot);

        return $actorMobile !== '' && $actorMobile === $customerMobile;
    }

    private function sanitizeDayListItem(array $item, ?TenantUser $actor, ?Barber $actorBarber): array
    {
        $isAdmin = $actor?->role === 'admin';
        $isAuthorizedBarber = $actor?->role === 'barber'
            && $actorBarber?->can_access_panel
            && (int) ($item['barberId'] ?? 0) === (int) $actorBarber->id;
        $actorMobile = InputNormalizer::mobile((string) ($actor?->mobile ?? ''));
        $itemCustomerMobile = InputNormalizer::mobile((string) ($item['userPhone'] ?? ''));
        $itemBookedByMobile = InputNormalizer::mobile((string) ($item['bookedByPhone'] ?? ''));
        $isBookedCustomer = $actor
            && $actor->role === 'customer'
            && $actorMobile !== ''
            && (
                $actorMobile === $itemCustomerMobile
                || $actorMobile === $itemBookedByMobile
                || (string) ($item['bookedByUserId'] ?? '') === (string) $actor->id
            );

        if ($isAdmin || $isAuthorizedBarber || $isBookedCustomer) {
            return $item;
        }

        return array_replace($item, [
            'userId' => '',
            'userPhone' => '',
            'userName' => '',
            'bookedByUserId' => null,
            'bookedByPhone' => null,
            'bookedByName' => null,
            'bookedByRole' => null,
            'notes' => null,
            'sendSms' => false,
            'publicCode' => null,
            'publicUrl' => null,
            'feedbackUrl' => null,
            'feedbackStatus' => null,
            'isForSomeoneElse' => false,
        ]);
    }

    private function contactLocationPayload(): ?array
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $contactPage = is_array($rules['contact_page'] ?? null) ? $rules['contact_page'] : [];
        $location = is_array($contactPage['location'] ?? null) ? $contactPage['location'] : [];

        if (! (bool) ($location['enabled'] ?? false)) {
            return null;
        }

        $address = trim((string) ($location['address'] ?? ''));
        $latitude = isset($location['latitude']) ? (float) $location['latitude'] : null;
        $longitude = isset($location['longitude']) ? (float) $location['longitude'] : null;

        if ($address === '' && ($latitude === null || $longitude === null)) {
            return null;
        }

        return [
            'address' => $address !== '' ? $address : null,
            'provinceName' => trim((string) ($location['province_name'] ?? '')) ?: null,
            'cityName' => trim((string) ($location['city_name'] ?? '')) ?: null,
            'latitude' => $latitude,
            'longitude' => $longitude,
        ];
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            'booked' => 'ثبت شده',
            'completed' => 'انجام شده',
            'no_show' => 'مراجعه نکرده',
            'cancelled' => 'لغو شده',
            'pending_payment' => 'در انتظار پرداخت',
            default => 'نامشخص',
        };
    }

    /**
     * @param  array<int, array<string, mixed>>  $blocks
     */
    private function overlapsProfessionalBlock(Carbon $start, Carbon $end, string $date, array $blocks): bool
    {
        foreach ($blocks as $block) {
            if (
                ! is_array($block)
                || ($block['date'] ?? null) !== $date
                || empty($block['start'])
                || empty($block['end'])
            ) {
                continue;
            }

            $blockStart = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$block['start']}");
            $blockEnd = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$block['end']}");

            if ($start->lt($blockEnd) && $end->gt($blockStart)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<int, array<string, mixed>>  $slots
     */
    private function overlapsQuickBlockedSlots(Carbon $start, Carbon $end, string $date, array $slots): bool
    {
        foreach ($slots as $slot) {
            if (
                ! is_array($slot)
                || (string) ($slot['date'] ?? '') !== $date
                || empty($slot['start'])
                || empty($slot['end'])
            ) {
                continue;
            }

            $blockedStart = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$slot['start']}");
            $blockedEnd = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$slot['end']}");

            if ($start->lt($blockedEnd) && $end->gt($blockedStart)) {
                return true;
            }
        }

        return false;
    }

    private function ensureStaff(Request $request): ?Barber
    {
        $actor = $request->user('tenant_web');
        abort_unless(in_array($actor?->role, ['admin', 'barber'], true), 403, __('authorization.admin_or_barber_action'));

        if ($actor?->role === 'barber') {
            $barber = $this->resolveActorBarber($actor);
            abort_unless($barber, 403, __('authorization.professional_profile_missing'));
            abort_if(! $barber->can_access_panel, 403, __('authorization.professional_panel_blocked'));

            return $barber;
        }

        return null;
    }

    private function resolveActorBarber(?TenantUser $actor): ?Barber
    {
        if (! $actor || $actor->role !== 'barber') {
            return null;
        }

        return Barber::query()->where('user_id', $actor->id)->first();
    }
}
