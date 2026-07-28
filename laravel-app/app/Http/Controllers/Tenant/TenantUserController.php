<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Booking\Models\Barber;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\TenantProvisioningService;
use App\Services\VipFeatureService;
use App\Support\InputNormalizer;
use App\Support\TenantMembershipProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class TenantUserController extends Controller
{
    public function __construct(
        private readonly TenantProvisioningService $tenantProvisioningService,
        private readonly VipFeatureService $vipFeatureService,
    ) {}

    public function lookup(Request $request): JsonResponse
    {
        $vipFeatureActive = $this->vipFeatureService->syncCurrentTenantState(tenant());

        $request->merge([
            'mobile' => InputNormalizer::mobile($request->input('mobile')),
        ]);

        $validated = $request->validate([
            'mobile' => ['required', InputNormalizer::mobileRule()],
        ], [
            'mobile.required' => 'شماره موبایل را وارد کنید.',
            'mobile.regex' => __('api.auth.mobile_regex'),
        ]);

        $tenantUser = TenantUser::query()
            ->where('mobile', $validated['mobile'])
            ->where('is_active', true)
            ->first();

        $latestAppointment = Appointment::query()
            ->where('customer_phone_snapshot', $validated['mobile'])
            ->latest('id')
            ->first();

        $name = trim((string) ($tenantUser?->name ?: $latestAppointment?->customer_name_snapshot ?: ''));

        $exists = $tenantUser !== null || $latestAppointment !== null;

        return response()->json([
            'success' => true,
            'data' => [
                'exists' => $exists,
                'user' => $exists ? [
                    'id' => $tenantUser?->id ? (string) $tenantUser->id : null,
                    'name' => $name,
                    'phone' => $tenantUser?->mobile ?: $validated['mobile'],
                    'email' => $tenantUser?->email,
                    'role' => $tenantUser?->role ?: 'customer',
                    'canBook' => (bool) ($tenantUser?->can_book ?? true),
                    'isVip' => $vipFeatureActive ? (bool) ($tenantUser?->is_vip ?? false) : false,
                    'gender' => $tenantUser?->gender,
                    'nationalCode' => $tenantUser?->national_code,
                    'birthDate' => optional($tenantUser?->birth_date)->format('Y-m-d'),
                    'provinceId' => $tenantUser?->province_id,
                    'provinceName' => $tenantUser?->province_name,
                    'cityId' => $tenantUser?->city_id,
                    'cityName' => $tenantUser?->city_name,
                    'jobTitle' => $tenantUser?->job_title,
                ] : null,
                'suggestedName' => $exists ? null : ($name !== '' ? $name : null),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $vipFeatureActive = $this->vipFeatureService->syncCurrentTenantState(tenant());
        [$actor, $barber, $allScope] = $this->resolveRequestedBarber($request, true);

        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
            'search' => ['nullable', 'string', 'max:255'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $search = trim((string) ($validated['search'] ?? ''));
        $searchDigits = InputNormalizer::digits($search);
        $appointmentsCountSql = $allScope || ! $barber
            ? '(select count(*) from appointments where appointments.customer_phone_snapshot = latest_appointment.customer_phone_snapshot)'
            : sprintf(
                '(select count(*) from appointments where appointments.professional_id = %d and appointments.customer_phone_snapshot = latest_appointment.customer_phone_snapshot)',
                (int) $barber->id,
            );

        $latestAppointmentIds = Appointment::query()
            ->selectRaw('MAX(id) as latest_appointment_id')
            ->when(! $allScope && $barber, fn ($query) => $query->where('professional_id', $barber->id))
            ->groupBy('customer_phone_snapshot');

        $latestAppointmentSummary = Appointment::query()
            ->fromSub($latestAppointmentIds, 'latest_appointments')
            ->join('appointments as latest_appointment', 'latest_appointment.id', '=', 'latest_appointments.latest_appointment_id')
            ->selectRaw('
                latest_appointment.customer_phone_snapshot as mobile,
                latest_appointment.customer_name_snapshot as appointment_name,
                latest_appointment.created_at as last_appointment_at,
                latest_appointment.booked_by_name_snapshot as booked_by_name,
                latest_appointment.booked_by_phone_snapshot as booked_by_phone,
                latest_appointment.meta as latest_meta,
                '.$appointmentsCountSql.' as appointments_count
            ');

        $registeredCustomersQuery = TenantUser::query()
            ->from('users as tenant_users')
            ->where('tenant_users.role', 'customer')
            ->where('tenant_users.is_active', true)
            ->when(
                $allScope,
                fn ($query) => $query->leftJoinSub($latestAppointmentSummary, 'latest_appointment_summary', 'latest_appointment_summary.mobile', '=', 'tenant_users.mobile'),
                fn ($query) => $query->joinSub($latestAppointmentSummary, 'latest_appointment_summary', 'latest_appointment_summary.mobile', '=', 'tenant_users.mobile'),
            )
            ->selectRaw("
                tenant_users.mobile as mobile,
                COALESCE(NULLIF(TRIM(tenant_users.name), ''), latest_appointment_summary.appointment_name, '') as full_name,
                latest_appointment_summary.last_appointment_at as last_appointment_at,
                latest_appointment_summary.booked_by_name as booked_by_name,
                latest_appointment_summary.booked_by_phone as booked_by_phone,
                latest_appointment_summary.latest_meta as latest_meta,
                COALESCE(latest_appointment_summary.appointments_count, 0) as appointments_count,
                tenant_users.id as tenant_user_id,
                tenant_users.email as email,
                COALESCE(tenant_users.can_book, 1) as can_book,
                COALESCE(tenant_users.is_vip, 0) as is_vip,
                tenant_users.gender as gender,
                tenant_users.national_code as national_code,
                tenant_users.birth_date as birth_date,
                tenant_users.province_id as province_id,
                tenant_users.province_name as province_name,
                tenant_users.city_id as city_id,
                tenant_users.city_name as city_name,
                tenant_users.job_title as job_title,
                tenant_users.nutrition_profile_fixed_message as nutrition_profile_fixed_message,
                tenant_users.created_at as registered_at
            ");

        $appointmentOnlyCustomersQuery = DB::query()
            ->fromSub($latestAppointmentSummary, 'latest_appointment_summary')
            ->leftJoin('users as tenant_users', 'tenant_users.mobile', '=', 'latest_appointment_summary.mobile')
            ->whereNull('tenant_users.id')
            ->selectRaw("
                latest_appointment_summary.mobile as mobile,
                COALESCE(latest_appointment_summary.appointment_name, '') as full_name,
                latest_appointment_summary.last_appointment_at as last_appointment_at,
                latest_appointment_summary.booked_by_name as booked_by_name,
                latest_appointment_summary.booked_by_phone as booked_by_phone,
                latest_appointment_summary.latest_meta as latest_meta,
                COALESCE(latest_appointment_summary.appointments_count, 0) as appointments_count,
                null as tenant_user_id,
                null as email,
                1 as can_book,
                0 as is_vip,
                null as gender,
                null as national_code,
                null as birth_date,
                null as province_id,
                null as province_name,
                null as city_id,
                null as city_name,
                null as job_title,
                null as nutrition_profile_fixed_message,
                null as registered_at
            ");

        $query = DB::query()
            ->fromSub($registeredCustomersQuery->unionAll($appointmentOnlyCustomersQuery), 'customer_rows')
            ->when($search !== '', function ($query) use ($search, $searchDigits) {
                $query->where(function ($subQuery) use ($search, $searchDigits) {
                    $subQuery->where('customer_rows.full_name', 'like', "%{$search}%");

                    if ($searchDigits !== '') {
                        $subQuery->orWhere('customer_rows.mobile', 'like', "%{$searchDigits}%");
                    }
                });
            })
            ->orderByRaw('customer_rows.last_appointment_at IS NULL asc')
            ->orderByDesc('customer_rows.last_appointment_at')
            ->orderByDesc('customer_rows.registered_at');

        $page = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => collect($page->items())->map(fn ($row) => $this->transformUserRow($row, $vipFeatureActive))->values(),
                'currentPage' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
                'selectedBarberId' => $allScope ? '__all__' : (string) $barber?->id,
                'selectedBarberName' => $allScope ? 'همه کاربران' : $barber?->name,
                'actorRole' => $actor?->role,
                'vipFeatureActive' => $vipFeatureActive,
            ],
        ]);
    }

    public function appointments(Request $request, string $mobile): JsonResponse
    {
        [, $barber] = $this->resolveRequestedBarber($request);

        $validated = $request->validate([
            'scope' => ['nullable', 'in:upcoming,past'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $scope = $validated['scope'] ?? 'upcoming';
        $perPage = (int) ($validated['per_page'] ?? 10);
        $today = now()->toDateString();
        $currentTime = now()->format('H:i:s');
        $normalizedMobile = InputNormalizer::mobile($mobile);

        $query = Appointment::query()
            ->with(['barber:id,name', 'service:id,name', 'creator:id,name,mobile'])
            ->where('professional_id', $barber->id)
            ->where('customer_phone_snapshot', $normalizedMobile)
            ->whereIn('status', ['booked', 'completed', 'no_show', 'cancelled']);

        if ($scope === 'upcoming') {
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
                'items' => $page->getCollection()->map(fn (Appointment $appointment) => $this->transformAppointment($appointment))->values(),
                'currentPage' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function updateBookingAccess(Request $request, string $mobile): JsonResponse
    {
        $this->vipFeatureService->syncCurrentTenantState(tenant());
        [, $barber, $allScope] = $this->resolveRequestedBarber($request, true);

        $request->merge([
            'mobile' => InputNormalizer::mobile($mobile),
        ]);

        $validated = $request->validate([
            'mobile' => ['required', InputNormalizer::mobileRule()],
            'can_book' => ['required', 'boolean'],
        ]);

        $latestAppointment = Appointment::query()
            ->when(! $allScope && $barber, fn ($query) => $query->where('professional_id', $barber->id))
            ->where('customer_phone_snapshot', $validated['mobile'])
            ->latest('id')
            ->first();

        $tenantUser = TenantUser::query()->where('mobile', $validated['mobile'])->first();

        abort_if(! $tenantUser && ! $latestAppointment, 404, $allScope ? 'کاربری با این شماره پیدا نشد.' : 'کاربری با این شماره برای این آرایشگر پیدا نشد.');

        $tenantUser = TenantUser::query()->firstOrCreate(
            ['mobile' => $validated['mobile']],
            [
                'name' => $latestAppointment?->customer_name_snapshot,
                'role' => 'customer',
                'is_active' => true,
                'can_book' => true,
                'is_vip' => false,
            ],
        );

        abort_if(in_array($tenantUser->role, ['admin', 'barber'], true), 422, 'بستن دسترسی این نوع کاربر از این بخش مجاز نیست.');

        $tenantUser->update([
            'name' => $tenantUser->name ?: $latestAppointment?->customer_name_snapshot,
            'can_book' => (bool) $validated['can_book'],
        ]);

        return response()->json([
            'success' => true,
            'message' => $tenantUser->can_book ? 'دسترسی رزرو کاربر باز شد.' : 'دسترسی رزرو کاربر بسته شد.',
            'data' => [
                'mobile' => $tenantUser->mobile,
                'canBook' => (bool) $tenantUser->can_book,
            ],
        ]);
    }

    public function updateVipAccess(Request $request, string $mobile): JsonResponse
    {
        $vipFeatureActive = $this->vipFeatureService->syncCurrentTenantState(tenant());
        abort_unless($vipFeatureActive, 422, 'ماژول مشتریان VIP برای این سامانه فعال نیست.');

        [, $barber, $allScope] = $this->resolveRequestedBarber($request, true);

        $request->merge([
            'mobile' => InputNormalizer::mobile($mobile),
        ]);

        $validated = $request->validate([
            'mobile' => ['required', InputNormalizer::mobileRule()],
            'is_vip' => ['required', 'boolean'],
        ]);

        $latestAppointment = Appointment::query()
            ->when(! $allScope && $barber, fn ($query) => $query->where('professional_id', $barber->id))
            ->where('customer_phone_snapshot', $validated['mobile'])
            ->latest('id')
            ->first();

        $tenantUser = TenantUser::query()->where('mobile', $validated['mobile'])->first();

        abort_if(! $tenantUser && ! $latestAppointment, 404, $allScope ? 'کاربری با این شماره پیدا نشد.' : 'کاربری با این شماره برای این آرایشگر پیدا نشد.');

        $tenantUser = TenantUser::query()->firstOrCreate(
            ['mobile' => $validated['mobile']],
            [
                'name' => $latestAppointment?->customer_name_snapshot,
                'role' => 'customer',
                'is_active' => true,
                'can_book' => true,
                'is_vip' => false,
            ],
        );

        abort_if(in_array($tenantUser->role, ['admin', 'barber'], true), 422, 'تغییر وضعیت VIP این نوع کاربر از این بخش مجاز نیست.');

        $tenantUser->update([
            'name' => $tenantUser->name ?: $latestAppointment?->customer_name_snapshot,
            'is_vip' => (bool) $validated['is_vip'],
        ]);

        return response()->json([
            'success' => true,
            'message' => $tenantUser->is_vip ? 'کاربر در لیست VIP قرار گرفت.' : 'وضعیت VIP کاربر برداشته شد.',
            'data' => [
                'mobile' => $tenantUser->mobile,
                'isVip' => (bool) $tenantUser->is_vip,
            ],
        ]);
    }

    public function updateIdentity(Request $request, string $mobile): JsonResponse
    {
        $vipFeatureActive = $this->vipFeatureService->syncCurrentTenantState(tenant());
        [, $barber] = $this->resolveRequestedBarber($request);

        $request->merge([
            'mobile' => InputNormalizer::mobile($mobile),
            'next_mobile' => InputNormalizer::mobile($request->input('mobile')),
            'nationalCode' => InputNormalizer::digits((string) $request->input('nationalCode')),
        ]);

        $validated = $request->validate([
            'mobile' => ['required', InputNormalizer::mobileRule()],
            'name' => ['required', 'string', 'min:3', 'max:255'],
            'next_mobile' => ['required', InputNormalizer::mobileRule()],
            'nutrition_profile_fixed_message' => ['nullable', 'string', 'max:3000'],
        ] + TenantMembershipProfile::validationRules(), [
            'mobile.regex' => 'شماره موبایل فعلی معتبر نیست.',
            'name.required' => 'نام کاربر را وارد کنید.',
            'name.min' => 'نام کاربر باید حداقل ۳ حرف باشد.',
            'next_mobile.required' => 'شماره موبایل را وارد کنید.',
            'next_mobile.regex' => __('api.auth.mobile_regex'),
            'nutrition_profile_fixed_message.max' => 'پیغام ثابت پروفایل نباید بیشتر از ۳۰۰۰ کاراکتر باشد.',
        ] + TenantMembershipProfile::validationMessages() + [
            'email.unique' => 'این ایمیل قبلا برای کاربر دیگری ثبت شده است.',
        ]);

        $latestAppointment = Appointment::query()
            ->where('professional_id', $barber->id)
            ->where('customer_phone_snapshot', $validated['mobile'])
            ->latest('id')
            ->first();

        abort_if(! $latestAppointment, 404, 'کاربری با این شماره برای این آرایشگر پیدا نشد.');

        $currentTenantUser = TenantUser::query()->where('mobile', $validated['mobile'])->first();

        $request->validate([
            'email' => [
                'nullable',
                'email:rfc',
                'max:255',
                Rule::unique('users', 'email')->ignore($currentTenantUser?->id),
            ],
        ], [
            'email.unique' => 'این ایمیل قبلا برای کاربر دیگری ثبت شده است.',
        ]);

        TenantMembershipProfile::assertRequirements(
            $validated,
            $this->tenantProvisioningService->getRegistrationRequirements(tenant()),
        );

        $tenantUser = $this->tenantProvisioningService->syncCustomerIdentity(
            tenant(),
            $validated['mobile'],
            $validated['next_mobile'],
            trim($validated['name']),
            TenantMembershipProfile::prepareAttributes($validated),
        );

        if ($this->supportsNutritionFixedMessage()) {
            $tenantUser->forceFill([
                'nutrition_profile_fixed_message' => trim((string) ($validated['nutrition_profile_fixed_message'] ?? '')) ?: null,
            ])->save();
        }

        $latestUpdatedAppointment = Appointment::query()
            ->where('professional_id', $barber->id)
            ->where('customer_phone_snapshot', $tenantUser->mobile)
            ->latest('created_at')
            ->first();
        [$firstName, $lastName] = $this->splitName((string) $tenantUser->name);

        return response()->json([
            'success' => true,
            'message' => 'اطلاعات کاربر به‌روزرسانی شد.',
            'data' => [
                'id' => (string) $tenantUser->id,
                'firstName' => $firstName,
                'lastName' => $lastName,
                'fullName' => $tenantUser->name,
                'mobile' => $tenantUser->mobile,
                'email' => $tenantUser->email,
                'canBook' => (bool) $tenantUser->can_book,
                'isVip' => $vipFeatureActive ? (bool) $tenantUser->is_vip : false,
                'gender' => $tenantUser->gender,
                'nationalCode' => $tenantUser->national_code,
                'birthDate' => optional($tenantUser->birth_date)->format('Y-m-d'),
                'provinceId' => $tenantUser->province_id,
                'provinceName' => $tenantUser->province_name,
                'cityId' => $tenantUser->city_id,
                'cityName' => $tenantUser->city_name,
                'jobTitle' => $tenantUser->job_title,
                'appointmentsCount' => Appointment::query()
                    ->where('professional_id', $barber->id)
                    ->where('customer_phone_snapshot', $tenantUser->mobile)
                    ->count(),
                'lastAppointmentAt' => $latestUpdatedAppointment?->created_at,
                'isForSomeoneElse' => (bool) ($latestUpdatedAppointment?->meta['is_for_someone_else'] ?? false),
                'bookedByName' => $latestUpdatedAppointment?->booked_by_name_snapshot,
                'bookedByPhone' => $latestUpdatedAppointment?->booked_by_phone_snapshot,
                'nutritionProfileFixedMessage' => $this->supportsNutritionFixedMessage()
                    ? (trim((string) ($tenantUser->nutrition_profile_fixed_message ?? '')) ?: null)
                    : null,
            ],
        ]);
    }

    public function destroy(Request $request, string $mobile): JsonResponse
    {
        /** @var TenantUser|null $actor */
        $actor = $request->user('tenant_web');
        abort_unless($actor?->role === 'admin', 403, 'فقط مدیر سامانه مجاز به حذف کاربر است.');

        $normalizedMobile = InputNormalizer::mobile($mobile);
        abort_unless(InputNormalizer::isValidMobile($normalizedMobile), 422, __('api.auth.mobile_regex'));

        $tenantUser = TenantUser::query()->where('mobile', $normalizedMobile)->first();
        abort_if(
            $tenantUser && in_array($tenantUser->role, ['admin', 'barber'], true),
            422,
            'حذف مدیر یا متخصص از فهرست کاربران مجاز نیست.',
        );

        $hasAppointment = Appointment::query()
            ->where('customer_phone_snapshot', $normalizedMobile)
            ->exists();

        abort_if(! $tenantUser && ! $hasAppointment, 404, 'کاربری با این شماره پیدا نشد.');

        $deletedAppointments = 0;
        $mediaFiles = $this->customerMediaFiles($tenantUser?->id);

        DB::transaction(function () use ($tenantUser, $normalizedMobile, &$deletedAppointments): void {
            $appointmentQuery = Appointment::query()
                ->where('customer_phone_snapshot', $normalizedMobile);

            $deletedAppointments = (clone $appointmentQuery)->count();
            $appointmentQuery->delete();

            Appointment::query()
                ->where('booked_by_phone_snapshot', $normalizedMobile)
                ->update([
                    'created_by_user_id' => null,
                    'booked_by_name_snapshot' => null,
                    'booked_by_phone_snapshot' => null,
                ]);

            $this->deleteCustomerSnapshotRecords($normalizedMobile, $tenantUser?->id);

            if ($tenantUser) {
                $tenantUser->tokens()->delete();
                $tenantUser->delete();
            }
        });

        foreach ($mediaFiles as $mediaFile) {
            try {
                $this->deleteTenantMediaFile($mediaFile['path'], $mediaFile['disk']);
            } catch (\Throwable $exception) {
                report($exception);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'کاربر و تمام اطلاعات مرتبط با او حذف شد.',
            'data' => [
                'mobile' => $normalizedMobile,
                'deletedAppointments' => $deletedAppointments,
            ],
        ]);
    }

    /**
     * @return array<int, array{disk: string, path: string}>
     */
    private function customerMediaFiles(?int $tenantUserId): array
    {
        if ($tenantUserId === null) {
            return [];
        }

        $files = collect();

        if (
            Schema::hasTable('nutrition_meal_logs')
            && Schema::hasColumn('nutrition_meal_logs', 'photo_path')
        ) {
            DB::table('nutrition_meal_logs')
                ->where('user_id', $tenantUserId)
                ->whereNotNull('photo_path')
                ->pluck('photo_path')
                ->each(fn ($path) => $files->push([
                    'disk' => 'media_public',
                    'path' => (string) $path,
                ]));
        }

        if (
            Schema::hasTable('nutrition_diet_prescriptions')
            && Schema::hasColumn('nutrition_diet_prescriptions', 'content_snapshot')
        ) {
            DB::table('nutrition_diet_prescriptions')
                ->where('user_id', $tenantUserId)
                ->whereNotNull('content_snapshot')
                ->pluck('content_snapshot')
                ->each(function ($snapshot) use ($files): void {
                    $content = is_array($snapshot)
                        ? $snapshot
                        : json_decode((string) $snapshot, true);
                    $expertFile = is_array($content) && is_array($content['expert_file'] ?? null)
                        ? $content['expert_file']
                        : null;

                    if (
                        ! $expertFile
                        || ($expertFile['source'] ?? 'upload') !== 'upload'
                        || blank($expertFile['filePath'] ?? null)
                    ) {
                        return;
                    }

                    $files->push([
                        'disk' => 'media_public',
                        'path' => (string) $expertFile['filePath'],
                    ]);
                });
        }

        if (
            Schema::hasTable('online_chat_attachments')
            && Schema::hasTable('online_chat_messages')
            && Schema::hasTable('online_chat_conversations')
        ) {
            DB::table('online_chat_attachments as attachments')
                ->join('online_chat_messages as messages', 'messages.id', '=', 'attachments.message_id')
                ->join('online_chat_conversations as conversations', 'conversations.id', '=', 'messages.conversation_id')
                ->where('conversations.customer_user_id', $tenantUserId)
                ->get(['attachments.disk', 'attachments.path'])
                ->each(fn ($attachment) => $files->push([
                    'disk' => (string) ($attachment->disk ?: 'public'),
                    'path' => (string) $attachment->path,
                ]));
        }

        return $files
            ->filter(fn (array $file): bool => trim($file['path']) !== '')
            ->unique(fn (array $file): string => $file['disk'].'|'.$file['path'])
            ->values()
            ->all();
    }

    private function deleteCustomerSnapshotRecords(string $mobile, ?int $tenantUserId): void
    {
        $this->deleteWhere('manual_finance_entries', 'customer_phone_snapshot', $mobile);
        $this->deleteWhere('store_orders', 'customer_phone', $mobile);
        $this->deleteWhere('sms_campaign_recipients', 'customer_phone', $mobile);
        $this->deleteWhere('sms_blacklists', 'phone', $mobile);
        $this->deleteWhere('notification_campaign_recipients', 'recipient_phone', $mobile);
        $this->deleteWhere('user_notifications', 'recipient_mobile', $mobile);
        $this->deleteWhere('articles_comments', 'author_mobile', $mobile);
        $this->deleteWhere('customer_feedback_invitations', 'customer_mobile', $mobile);

        if ($tenantUserId === null) {
            return;
        }

        $this->deleteWhere('notification_campaign_recipients', 'tenant_user_id', $tenantUserId);
        $this->deleteWhere('user_notifications', 'tenant_user_id', $tenantUserId);
        $this->deleteWhere('store_product_reviews', 'tenant_user_id', $tenantUserId);
        $this->deleteWhere('articles_comments', 'tenant_user_id', $tenantUserId);
    }

    private function deleteWhere(string $table, string $column, string|int $value): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
            return;
        }

        DB::table($table)->where($column, $value)->delete();
    }

    private function resolveRequestedBarber(Request $request, bool $allowAllForAdmin = false): array
    {
        /** @var TenantUser|null $actor */
        $actor = $request->user('tenant_web');

        abort_unless(in_array($actor?->role, ['admin', 'barber'], true), 403, __('authorization.admin_or_barber_section'));

        if ($actor?->role === 'barber') {
            $barber = Barber::query()->where('user_id', $actor->id)->first();
            abort_unless($barber, 403, __('authorization.professional_profile_missing'));
            abort_if(! $barber->can_access_panel, 403, __('authorization.professional_panel_blocked'));

            return [$actor, $barber];
        }

        $request->merge([
            'professional_id' => $request->input('professional_id', $request->input('barber_id')),
        ]);

        if ($allowAllForAdmin && ($request->boolean('all') || $request->input('scope') === 'all')) {
            return [$actor, null, true];
        }

        $validated = $request->validate([
            'professional_id' => ['required', 'integer', 'exists:professionals,id'],
        ], [
            'professional_id.required' => 'آرایشگر را انتخاب کنید.',
        ]);

        $barber = Barber::query()->findOrFail($validated['professional_id']);

        return [$actor, $barber, false];
    }

    private function transformUserRow(object $row, bool $vipFeatureActive): array
    {
        [$firstName, $lastName] = $this->splitName((string) ($row->full_name ?? ''));

        return [
            'id' => $row->tenant_user_id ? (string) $row->tenant_user_id : null,
            'firstName' => $firstName,
            'lastName' => $lastName,
            'fullName' => trim((string) ($row->full_name ?? '')),
            'mobile' => (string) $row->mobile,
            'email' => $row->email ?: null,
            'canBook' => (bool) $row->can_book,
            'isVip' => $vipFeatureActive ? (bool) ($row->is_vip ?? false) : false,
            'gender' => $row->gender ?: null,
            'nationalCode' => $row->national_code ?: null,
            'birthDate' => $row->birth_date ?: null,
            'provinceId' => $row->province_id ? (int) $row->province_id : null,
            'provinceName' => $row->province_name ?: null,
            'cityId' => $row->city_id ? (int) $row->city_id : null,
            'cityName' => $row->city_name ?: null,
            'jobTitle' => $row->job_title ?: null,
            'appointmentsCount' => (int) $row->appointments_count,
            'lastAppointmentAt' => $row->last_appointment_at,
            'isForSomeoneElse' => (bool) (data_get(json_decode((string) ($row->latest_meta ?? '{}'), true), 'is_for_someone_else', false)),
            'bookedByName' => $row->booked_by_name ?: null,
            'bookedByPhone' => $row->booked_by_phone ?: null,
            'nutritionProfileFixedMessage' => $this->supportsNutritionFixedMessage()
                ? ($row->nutrition_profile_fixed_message ?? null)
                : null,
        ];
    }

    private function supportsNutritionFixedMessage(): bool
    {
        $tenant = tenant();
        $tenant->loadMissing('audienceType');

        return in_array((string) ($tenant->audienceType?->slug ?? ''), ['nutritionists', 'nutrition-doctors'], true);
    }

    private function splitName(string $fullName): array
    {
        $normalized = preg_replace('/\s+/u', ' ', trim($fullName)) ?: '';

        if ($normalized === '') {
            return ['', ''];
        }

        $parts = explode(' ', $normalized);

        if (count($parts) === 1) {
            return [$parts[0], ''];
        }

        return [array_shift($parts), implode(' ', $parts)];
    }

    private function transformAppointment(Appointment $appointment): array
    {
        return [
            'id' => (string) $appointment->id,
            'userId' => (string) $appointment->customer_id,
            'userPhone' => $appointment->customer_phone_snapshot,
            'userName' => $appointment->customer_name_snapshot,
            'bookedByUserId' => $appointment->created_by_user_id ? (string) $appointment->created_by_user_id : null,
            'bookedByPhone' => $appointment->booked_by_phone_snapshot ?: $appointment->creator?->mobile,
            'bookedByName' => $appointment->booked_by_name_snapshot ?: $appointment->creator?->name,
            'barberId' => (string) $appointment->professional_id,
            'barberName' => $appointment->professional_name_snapshot ?: $appointment->barber?->name,
            'sectionId' => (string) $appointment->service_id,
            'sectionName' => $appointment->service_name_snapshot ?: $appointment->service?->name,
            'date' => $appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date'),
            'startTime' => substr((string) $appointment->start_time, 0, 5),
            'endTime' => substr((string) $appointment->end_time, 0, 5),
            'status' => $appointment->status === 'cancelled' ? 'cancelled' : 'booked',
            'notes' => $appointment->notes,
            'sendSms' => (bool) ($appointment->meta['send_sms'] ?? false),
            'createdAt' => $appointment->created_at?->toISOString(),
            'isForSomeoneElse' => (bool) ($appointment->meta['is_for_someone_else'] ?? false),
        ];
    }
}
