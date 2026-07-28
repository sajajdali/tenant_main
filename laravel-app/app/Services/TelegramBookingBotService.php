<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Booking\Models\Barber;
use App\Domain\Booking\Models\Service;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\NutritionProfile;
use App\Domain\Tenant\Models\TenantUser;
use App\Events\AppointmentAvailabilityChanged;
use App\Models\SystemSetting;
use App\Services\Auth\OtpLoginService;
use App\Support\InputNormalizer;
use App\Support\JalaliDate;
use App\Support\NutritionMedicalConditionSupport;
use App\Support\NutritionWeightGoalCalculator;
use App\Support\SmsGatewaySettings;
use App\Support\TenantSandboxMode;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class TelegramBookingBotService
{
    private const MESSAGE_UNAVAILABLE = 'هم اکنون دسترسی امکان پذیر نمیباشد';

    private const CHANNELS = ['telegram', 'bale'];

    private const DEFAULT_API_BASE_URLS = [
        'telegram' => 'https://api.telegram.org/bot',
        'bale' => 'https://tapi.bale.ai/bot',
    ];

    private const DATE_LIMIT = 20;

    private const LABEL_BOOKING = 'دریافت نوبت';

    private const LABEL_NUTRITION_DIET = 'دریافت رژیم';

    private const LABEL_APPOINTMENTS = 'لیست نوبت های دریافت';

    private const LABEL_CONTACT = 'ارتباط با ما';

    private const LABEL_ABOUT = 'درباره ما';

    private const LABEL_HOME = 'صفحه اصلی';

    private const LABEL_BACK = 'بازگشت';

    private const NUTRITION_STEPS = [
        'goal',
        'gender',
        'activity_mode',
        'activity_level',
        'birth_date',
        'height',
        'weight',
        'completed',
        'target_weight',
        'weekly_rate',
        'medical_conditions',
        'medications',
        'allergies',
        'disliked_foods',
        'done',
    ];

    private string $channel = 'telegram';

    public function __construct(
        private readonly AppointmentAvailabilityService $availability,
        private readonly TenantAppointmentBookingService $bookingService,
        private readonly OtpLoginService $otpLoginService,
        private readonly TenantProvisioningService $tenantProvisioningService,
        private readonly CustomerClubService $customerClubService,
    ) {}

    public function handle(array $update, string $channel = 'telegram'): void
    {
        if (! in_array($channel, self::CHANNELS, true)) {
            return;
        }

        $this->channel = $channel;

        if (! $this->isEnabled()) {
            $this->sendUnavailableResponse($update);

            return;
        }

        $message = $update['message'] ?? $update['edited_message'] ?? null;
        $callback = $update['callback_query'] ?? null;

        if (is_array($callback)) {
            $this->answerCallback((string) ($callback['id'] ?? ''));
            $this->handleCallback($callback);

            return;
        }

        if (is_array($message)) {
            $this->handleMessage($message);
        }
    }

    private function handleMessage(array $message): void
    {
        $chatId = $this->chatIdFromMessage($message);
        if ($chatId === '') {
            return;
        }

        $text = trim((string) ($message['text'] ?? ''));

        if (str_starts_with($text, '/start') || $text === 'شروع') {
            $this->clearFlow($chatId);
            $this->showHome($chatId);

            return;
        }

        if (in_array($text, [self::LABEL_HOME, self::LABEL_BACK, 'خانه', '/home'], true)) {
            $this->clearFlow($chatId);
            $this->showHome($chatId);

            return;
        }

        if (isset($message['contact']) && is_array($message['contact'])) {
            $this->handleContact($chatId, $message);

            return;
        }

        $session = $this->session($chatId);
        $step = (string) ($session['step'] ?? '');

        if ($step === 'awaiting_name' && $text !== '') {
            $this->handleFullName($chatId, $text);

            return;
        }

        if ($step === 'nutrition' && $text !== '') {
            $this->clearFlow($chatId, keepAuth: true);
            $this->sendMessage($chatId, 'بخش دریافت رژیم فعلاً از ربات غیرفعال است.', $this->homeReplyKeyboard());

            return;
        }

        if ($step === 'awaiting_otp' && $text === 'ارسال مجدد کد') {
            $this->resendOtp($chatId, $message);

            return;
        }

        if ($step === 'awaiting_phone' && $text !== '') {
            $this->handleTypedPhone($chatId, $text, $message);

            return;
        }

        if ($step === 'awaiting_otp' && $text !== '') {
            $this->handleOtp($chatId, $text, $message);

            return;
        }

        if ($this->isHomeMenuText($text)) {
            $this->handleMainMenuText($chatId, $this->authenticatedUser($chatId), $text);

            return;
        }

        $this->showHome($chatId);
    }

    private function sendUnavailableResponse(array $update): void
    {
        $message = $update['message'] ?? $update['edited_message'] ?? null;
        $callback = $update['callback_query'] ?? null;

        if (is_array($callback)) {
            $this->answerCallback((string) ($callback['id'] ?? ''));
            $callbackMessage = is_array($callback['message'] ?? null) ? $callback['message'] : [];
            $chatId = $this->chatIdFromMessage($callbackMessage);
            $messageId = isset($callbackMessage['message_id']) ? (int) $callbackMessage['message_id'] : null;

            if ($chatId !== '') {
                $this->sendOrEdit($chatId, self::MESSAGE_UNAVAILABLE, null, $messageId);
            }

            return;
        }

        if (is_array($message)) {
            $chatId = $this->chatIdFromMessage($message);

            if ($chatId !== '') {
                $this->sendMessage($chatId, self::MESSAGE_UNAVAILABLE);
            }
        }
    }

    private function handleCallback(array $callback): void
    {
        $message = is_array($callback['message'] ?? null) ? $callback['message'] : [];
        $chatId = $this->chatIdFromMessage($message);
        $messageId = isset($message['message_id']) ? (int) $message['message_id'] : null;
        $data = (string) ($callback['data'] ?? '');

        if ($chatId === '') {
            return;
        }

        if ($data === 'main') {
            $this->clearFlow($chatId);
            $this->showHome($chatId, $messageId);

            return;
        }

        if ($data === 'auth:phone') {
            $this->askPhone($chatId, $messageId);

            return;
        }

        if ($data === 'auth:resend') {
            $this->resendOtp($chatId, $message, $messageId);

            return;
        }

        if (str_starts_with($data, 'nutrition:')) {
            $this->clearFlow($chatId, keepAuth: true);
            $this->sendOrEdit($chatId, 'بخش دریافت رژیم فعلاً از ربات غیرفعال است.', $this->mainInlineKeyboard(), $messageId);

            return;
        }

        $user = $this->authenticatedUser($chatId);
        if (! $user) {
            $this->askPhone($chatId, $messageId);

            return;
        }

        if ($this->requiresFullName($user) && (
            $data === 'booking:start'
            || $data === 'appointments:list'
            || str_starts_with($data, 'appointments:')
        )) {
            $this->askFullNameForAction($chatId, $user, $data === 'appointments:list' || str_starts_with($data, 'appointments:') ? 'appointments:list' : 'booking:start');

            return;
        }

        if ($data === 'booking:start') {
            $this->startBooking($chatId, $user, $messageId);

            return;
        }

        if ($data === 'appointments:list') {
            $this->showUserAppointments($chatId, $user, $messageId);

            return;
        }

        if (str_starts_with($data, 'appointments:show:')) {
            $this->showAppointmentDetail($chatId, $user, (int) substr($data, strlen('appointments:show:')), $messageId);

            return;
        }

        if (str_starts_with($data, 'appointments:cancel:ask:')) {
            $this->askCancelAppointment($chatId, $user, (int) substr($data, strlen('appointments:cancel:ask:')), $messageId);

            return;
        }

        if (str_starts_with($data, 'appointments:cancel:yes:')) {
            $this->cancelAppointment($chatId, $user, (int) substr($data, strlen('appointments:cancel:yes:')), $messageId);

            return;
        }

        if ($data === 'booking:back:barbers') {
            $this->startBooking($chatId, $user, $messageId);

            return;
        }

        if ($data === 'booking:back:services') {
            $session = $this->session($chatId);
            unset($session['service_id'], $session['date'], $session['start'], $session['end'], $session['active_dates'], $session['date_index']);
            $this->putSession($chatId, $session);
            $this->showServices($chatId, $user, $session, $messageId);

            return;
        }

        if ($data === 'booking:back:times') {
            $session = $this->session($chatId);
            unset($session['start'], $session['end']);
            $this->putSession($chatId, $session);
            $this->showTimes($chatId, $user, $session, $messageId);

            return;
        }

        if (str_starts_with($data, 'booking:barber:')) {
            $session = $this->session($chatId);
            $session['barber_id'] = (int) substr($data, strlen('booking:barber:'));
            unset($session['service_id'], $session['date'], $session['start'], $session['end'], $session['active_dates'], $session['date_index']);
            $this->putSession($chatId, $session);
            $this->showServices($chatId, $user, $session, $messageId);

            return;
        }

        if (str_starts_with($data, 'booking:service:')) {
            $session = $this->session($chatId);
            $session['service_id'] = (int) substr($data, strlen('booking:service:'));
            unset($session['date'], $session['start'], $session['end'], $session['active_dates'], $session['date_index']);
            $this->putSession($chatId, $session);
            $this->showFirstAvailableDay($chatId, $user, $session, $messageId);

            return;
        }

        if ($data === 'booking:date:prev' || $data === 'booking:date:next') {
            $session = $this->session($chatId);
            $dates = $this->activeDatesForSession($session, $user);
            if ($dates === []) {
                $this->sendOrEdit($chatId, 'روز فعالی برای انتخاب پیدا نشد.', $this->mainInlineKeyboard(), $messageId);

                return;
            }

            $currentDate = (string) ($session['date'] ?? '');
            $currentIndex = $currentDate !== '' ? array_search($currentDate, $dates, true) : false;
            $index = $currentIndex === false ? max(0, (int) ($session['date_index'] ?? 0)) : (int) $currentIndex;
            $index += $data === 'booking:date:next' ? 1 : -1;
            $index = max(0, min(count($dates) - 1, $index));
            $session['active_dates'] = $dates;
            $session['date_index'] = $index;
            $session['date'] = $dates[$index] ?? null;
            unset($session['start'], $session['end']);
            $this->putSession($chatId, $session);
            $this->showTimes($chatId, $user, $session, $messageId);

            return;
        }

        if ($data === 'booking:date:list') {
            $session = $this->session($chatId);
            $this->showDateList($chatId, $user, $session, $messageId);

            return;
        }

        if (str_starts_with($data, 'booking:date:pick:')) {
            $date = substr($data, strlen('booking:date:pick:'));
            $session = $this->session($chatId);
            $dates = $this->activeDatesForSession($session, $user);
            $index = array_search($date, $dates, true);
            $session['active_dates'] = $dates;
            $session['date_index'] = $index === false ? 0 : (int) $index;
            $session['date'] = $date;
            unset($session['start'], $session['end']);
            $this->putSession($chatId, $session);
            $this->showTimes($chatId, $user, $session, $messageId);

            return;
        }

        if (str_starts_with($data, 'booking:time:')) {
            [$start, $end] = array_pad(explode('|', substr($data, strlen('booking:time:')), 2), 2, '');
            $session = $this->session($chatId);
            $barber = Barber::query()->find((int) ($session['barber_id'] ?? 0));
            $service = Service::query()->find((int) ($session['service_id'] ?? 0));
            $date = (string) ($session['date'] ?? '');

            $available = false;
            if ($barber && $service && $date !== '') {
                $available = collect($this->availability->availableSlots($barber, $service, $date, $user))
                    ->contains(fn (array $slot) => (string) $slot['start'] === $start && (string) $slot['end'] === $end);
            }

            if (! $available) {
                unset($session['start'], $session['end']);
                $session['notice'] = 'این ساعت دیگر قابل انتخاب نیست. لطفا یک ساعت آزاد دیگر انتخاب کنید.';
                $this->putSession($chatId, $session);
                $this->showTimes($chatId, $user, $session, $messageId);

                return;
            }

            $session['start'] = $start;
            $session['end'] = $end;
            $this->putSession($chatId, $session);
            $this->showConfirm($chatId, $user, $session, $messageId);

            return;
        }

        if ($data === 'booking:confirm') {
            $this->book($chatId, $user, $this->session($chatId), $messageId);
        }
    }

    private function showMainOrAuth(string $chatId, array $message): void
    {
        $user = $this->authenticatedUser($chatId);

        if ($user) {
            $this->showMainMenu($chatId, $user);

            return;
        }

        $this->showHome($chatId);
    }

    private function showHome(string $chatId, ?int $messageId = null): void
    {
        if ($messageId !== null) {
            $this->sendOrEdit($chatId, 'به صفحه اصلی برگشتید.', null, $messageId);
        }

        $user = $this->authenticatedUser($chatId);
        $name = $user?->name ?: 'کاربر عزیز';

        $this->sendMessage(
            $chatId,
            $this->welcomeText($name),
            $this->homeReplyKeyboard(),
            $this->welcomeImageUrl(),
        );
    }

    private function showMainMenu(string $chatId, TenantUser $user, ?int $messageId = null): void
    {
        $this->showHome($chatId, $messageId);
    }

    private function handleMainMenuText(string $chatId, ?TenantUser $user, string $text): void
    {
        if ($text === self::LABEL_BOOKING) {
            if (! $user) {
                $this->askPhoneForAction($chatId, 'booking:start');

                return;
            }

            if ($this->requiresFullName($user)) {
                $this->askFullNameForAction($chatId, $user, 'booking:start');

                return;
            }

            $this->closeReplyKeyboard($chatId);
            $this->startBooking($chatId, $user, null);

            return;
        }

        if ($text === self::LABEL_APPOINTMENTS) {
            if (! $user) {
                $this->askPhoneForAction($chatId, 'appointments:list');

                return;
            }

            if ($this->requiresFullName($user)) {
                $this->askFullNameForAction($chatId, $user, 'appointments:list');

                return;
            }

            $this->closeReplyKeyboard($chatId);
            $this->showUserAppointments($chatId, $user);

            return;
        }

        if ($text === self::LABEL_CONTACT && $this->contactPageEnabled()) {
            $this->showContactPage($chatId);

            return;
        }

        if ($text === self::LABEL_ABOUT && $this->aboutPageEnabled()) {
            $this->showAboutPage($chatId);

            return;
        }

        $this->showHome($chatId);
    }

    private function isHomeMenuText(string $text): bool
    {
        return in_array($text, [
            self::LABEL_BOOKING,
            self::LABEL_APPOINTMENTS,
            self::LABEL_CONTACT,
            self::LABEL_ABOUT,
        ], true);
    }

    private function askPhoneForAction(string $chatId, string $afterAuth): void
    {
        $session = $this->session($chatId);
        $session['after_auth'] = $afterAuth;
        $this->putSession($chatId, $session);

        $this->askPhone($chatId, null, 'برای ادامه، شماره موبایل خودتان را وارد کنید یا با دکمه زیر ارسال کنید.');
    }

    private function askPhone(string $chatId, ?int $messageId = null, string $message = 'شماره موبایل خودتان را وارد کنید یا با دکمه زیر ارسال کنید.'): void
    {
        $session = $this->session($chatId);
        $session['step'] = 'awaiting_phone';
        $this->putSession($chatId, $session);

        $this->sendOrEdit($chatId, $message."\n\nبرای شماره ایران، شماره با 09 ذخیره می‌شود.", [
            'inline_keyboard' => [
                [
                    ['text' => 'راهنمای ارسال شماره', 'callback_data' => 'auth:phone'],
                ],
                [
                    ['text' => self::LABEL_BACK, 'callback_data' => 'main'],
                    ['text' => self::LABEL_HOME, 'callback_data' => 'main'],
                ],
            ],
        ], $messageId);

        $this->sendMessage($chatId, 'اگر می‌خواهید شماره تلگرام را مستقیم بفرستید، از دکمه زیر استفاده کنید.', [
            'keyboard' => [
                [
                    ['text' => 'ارسال شماره موبایل', 'request_contact' => true],
                ],
            ],
            'resize_keyboard' => true,
            'one_time_keyboard' => true,
        ]);
    }

    private function handleContact(string $chatId, array $message): void
    {
        $phone = $this->normalizePhone((string) ($message['contact']['phone_number'] ?? ''));

        if ($phone === '') {
            $this->askPhone($chatId, null, 'شماره موبایل معتبر دریافت نشد. دوباره تلاش کنید.');

            return;
        }

        if (! $this->isValidMobile($phone)) {
            $user = $this->tenantProvisioningService->ensureCustomerExists(tenant(), $phone, $this->displayName($message));
            $this->rememberAuthentication($chatId, $user);
            $afterAuth = (string) ($this->session($chatId)['after_auth'] ?? '');
            $this->sendMessage($chatId, 'ورود شما ثبت شد.', ['remove_keyboard' => true]);
            $this->askFullNameForAction($chatId, $user, $afterAuth);

            return;
        }

        $this->sendOtp($chatId, $phone, $message);
    }

    private function handleTypedPhone(string $chatId, string $text, array $message): void
    {
        $phone = $this->normalizePhone($text);

        if (! $this->isValidMobile($phone)) {
            $this->askPhone($chatId, null, 'برای ورود با کد پیامکی، شماره ایران را با 09 وارد کنید.');

            return;
        }

        $this->sendOtp($chatId, $phone, $message);
    }

    private function sendOtp(string $chatId, string $phone, array $message): void
    {
        $result = $this->otpLoginService->sendForTenant($phone, tenant());

        if (! $result['ok']) {
            $messageText = str_contains((string) $result['message'], 'دوباره تلاش کنید')
                ? 'برای ارسال مجدد کد، حداقل ۱ دقیقه صبر کنید.'
                : (string) $result['message'];

            $this->sendMessage($chatId, $messageText, $this->otpReplyKeyboard());

            return;
        }

        $session = $this->session($chatId);
        $session['step'] = 'awaiting_otp';
        $session['phone'] = $phone;
        $session['name'] = $this->displayName($message);
        $session['otp_sent_at'] = now()->toISOString();
        $this->putSession($chatId, $session);

        $codeHint = tenant()?->demoFixedLoginCode()
            ?? (TenantSandboxMode::smsEnabled(tenant(), SmsGatewaySettings::sandboxEnabled()) ? ($result['code'] ?? null) : null);
        $hint = $codeHint ? "\nکد تست: {$codeHint}" : '';
        $this->sendMessage(
            $chatId,
            "کد ورود برای {$phone} ارسال شد.\nکد ۴ رقمی را همینجا وارد کنید.{$hint}",
            $this->otpReplyKeyboard(),
        );
    }

    private function resendOtp(string $chatId, array $message, ?int $messageId = null): void
    {
        $session = $this->session($chatId);
        $phone = (string) ($session['phone'] ?? '');

        if (! $this->isValidMobile($phone)) {
            $this->askPhone($chatId, $messageId, 'برای ارسال مجدد کد، اول شماره موبایل را وارد کنید.');

            return;
        }

        $sentAt = isset($session['otp_sent_at']) ? Carbon::parse((string) $session['otp_sent_at']) : null;
        $elapsed = $sentAt ? $sentAt->diffInSeconds(now()) : 60;

        if ($elapsed < 60) {
            $this->sendOrEdit(
                $chatId,
                'برای ارسال مجدد کد، حداقل ۱ دقیقه صبر کنید.',
                $this->otpInlineKeyboard(),
                $messageId,
            );

            return;
        }

        $this->sendOtp($chatId, $phone, $message);
    }

    private function handleOtp(string $chatId, string $text, array $message): void
    {
        $session = $this->session($chatId);
        $phone = (string) ($session['phone'] ?? '');
        $code = InputNormalizer::digits($text);

        if (! $this->isValidMobile($phone) || ! preg_match('/^\d{4}$/', $code)) {
            $this->sendMessage($chatId, 'کد ورود باید ۴ رقم باشد.');

            return;
        }

        $user = $this->otpLoginService->verifyForTenant($phone, $code, tenant());

        if (! $user) {
            $this->sendMessage($chatId, 'کد ورود صحیح نیست یا منقضی شده است.');

            return;
        }

        $this->customerClubService->applyWelcomeBonus($user);
        $this->customerClubService->applyBirthdayBonus($user);
        $this->rememberAuthentication($chatId, $user);
        $afterAuth = (string) ($session['after_auth'] ?? '');
        $this->sendMessage($chatId, 'ورود با موفقیت انجام شد.');
        $this->askFullNameForAction($chatId, $user, $afterAuth);
    }

    private function askFullNameForAction(string $chatId, TenantUser $user, string $afterAuth): void
    {
        $session = $this->session($chatId);
        $session['step'] = 'awaiting_name';
        $session['after_auth'] = $afterAuth;
        $session['pending_user_id'] = $user->id;
        $this->putSession($chatId, $session);

        $this->sendMessage(
            $chatId,
            "لطفاً نام و نام خانوادگی خود را وارد کنید.\nمثال: علی رضایی",
            $this->nameReplyKeyboard(),
        );
    }

    private function handleFullName(string $chatId, string $text): void
    {
        if (in_array($text, [self::LABEL_HOME, self::LABEL_BACK, 'خانه', '/home'], true)) {
            $this->clearFlow($chatId, keepAuth: true);
            $this->showHome($chatId);

            return;
        }

        $session = $this->session($chatId);
        $name = $this->normalizeFullName($text);

        if ($name === null) {
            $this->sendMessage($chatId, "نام و نام خانوادگی را کامل وارد کنید.\nمثال: علی رضایی", $this->nameReplyKeyboard());

            return;
        }

        $userId = (int) ($session['pending_user_id'] ?? Cache::get($this->authKey($chatId), 0));
        $user = $userId > 0 ? TenantUser::query()->find($userId) : null;

        if (! $user || ! $user->is_active) {
            $this->clearFlow($chatId, keepAuth: true);
            $this->askPhoneForAction($chatId, (string) ($session['after_auth'] ?? ''));

            return;
        }

        $user->forceFill(['name' => $name])->save();
        $user = $user->fresh() ?? $user;
        $afterAuth = (string) ($session['after_auth'] ?? '');
        $this->clearFlow($chatId, keepAuth: true);
        $this->sendMessage($chatId, 'نام و نام خانوادگی شما ثبت شد.', ['remove_keyboard' => true]);
        $this->continueAfterAuth($chatId, $user, $afterAuth);
    }

    private function continueAfterAuth(string $chatId, TenantUser $user, string $afterAuth): void
    {
        if ($this->requiresFullName($user)) {
            $this->askFullNameForAction($chatId, $user, $afterAuth);

            return;
        }

        if ($afterAuth === 'booking:start') {
            $this->closeReplyKeyboard($chatId);
            $this->startBooking($chatId, $user, null);

            return;
        }

        if ($afterAuth === 'appointments:list') {
            $this->closeReplyKeyboard($chatId);
            $this->showUserAppointments($chatId, $user);

            return;
        }

        $this->showMainMenu($chatId, $user);
    }

    private function requiresFullName(TenantUser $user): bool
    {
        return $this->normalizeFullName((string) ($user->name ?? '')) === null;
    }

    private function normalizeFullName(string $value): ?string
    {
        $name = trim(preg_replace('/\s+/u', ' ', strip_tags($value)) ?? '');

        if (mb_strlen($name) < 3 || mb_strlen($name) > 120) {
            return null;
        }

        $parts = preg_split('/\s+/u', $name, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        if (count($parts) < 2) {
            return null;
        }

        return $name;
    }

    private function startNutritionMembership(string $chatId, TenantUser $user, ?int $messageId): void
    {
        if (! $this->isNutritionAudience()) {
            $this->sendOrEdit($chatId, 'این بخش فقط برای کارشناس تغذیه فعال است.', $this->mainInlineKeyboard(), $messageId);

            return;
        }

        if (! $user->can_book) {
            $this->sendOrEdit($chatId, 'دسترسی شما به بخش رژیم بسته است. لطفاً با پشتیبانی تماس بگیرید.', $this->mainInlineKeyboard(), $messageId);

            return;
        }

        $profile = NutritionProfile::query()->where('user_id', $user->id)->first();
        $session = [
            'step' => 'nutrition',
            'nutrition_step' => 'goal',
            'tenant_user_id' => $user->id,
            'nutrition' => $profile ? [
                'diet_goal' => $profile->diet_goal,
                'gender' => $profile->gender ?? $user->gender,
                'athlete_mode' => $profile->athlete_mode,
                'activity_level' => $profile->activity_level,
                'birth_date' => $profile->birth_date?->format('Y-m-d') ?? $user->birth_date?->format('Y-m-d'),
                'height_cm' => $profile->height_cm,
                'weight_kg' => $profile->weight_kg !== null ? (string) $profile->weight_kg : null,
                'target_weight_kg' => $profile->target_weight_kg !== null ? (string) $profile->target_weight_kg : null,
                'weekly_weight_change_kg' => $profile->weekly_weight_change_kg !== null ? (float) $profile->weekly_weight_change_kg : null,
                'medical_conditions' => $profile->medical_conditions,
                'medications_and_supplements' => $profile->medications_and_supplements,
                'food_allergies' => $profile->food_allergies,
                'disliked_foods' => $profile->disliked_foods,
            ] : [
                'gender' => $user->gender,
                'birth_date' => $user->birth_date?->format('Y-m-d'),
            ],
        ];

        $this->putSession($chatId, $session);
        $this->showNutritionStep($chatId, $user, $session, $messageId);
    }

    private function handleNutritionCallback(string $chatId, TenantUser $user, string $data, ?int $messageId): void
    {
        $session = $this->session($chatId);
        if (($session['step'] ?? '') !== 'nutrition') {
            $this->startNutritionMembership($chatId, $user, $messageId);

            return;
        }

        if ($data === 'nutrition:start') {
            $this->startNutritionMembership($chatId, $user, $messageId);

            return;
        }

        if ($data === 'nutrition:back') {
            $current = (string) ($session['nutrition_step'] ?? 'goal');
            $previous = $this->previousNutritionStep($current);
            if ($previous === null) {
                $this->clearFlow($chatId, keepAuth: true);
                $this->showHome($chatId, $messageId);

                return;
            }

            $session['nutrition_step'] = $previous;
            $this->putSession($chatId, $session);
            $this->showNutritionStep($chatId, $user, $session, $messageId);

            return;
        }

        if ($data === 'nutrition:home') {
            $this->clearFlow($chatId, keepAuth: true);
            $this->showHome($chatId, $messageId);

            return;
        }

        $value = null;
        foreach (['goal', 'gender', 'activity_mode', 'activity_level', 'weekly_rate'] as $prefix) {
            $needle = 'nutrition:'.$prefix.':';
            if (str_starts_with($data, $needle)) {
                $value = substr($data, strlen($needle));
                $this->applyNutritionChoice($chatId, $user, $session, $prefix, $value, $messageId);

                return;
            }
        }

        if ($data === 'nutrition:completed:continue') {
            $session['nutrition_step'] = 'target_weight';
            $this->putSession($chatId, $session);
            $this->showNutritionStep($chatId, $user, $session, $messageId);

            return;
        }

        if ($data === 'nutrition:skip_text') {
            $step = (string) ($session['nutrition_step'] ?? '');
            $field = match ($step) {
                'medical_conditions' => 'medical_conditions',
                'medications' => 'medications_and_supplements',
                'allergies' => 'food_allergies',
                'disliked_foods' => 'disliked_foods',
                default => null,
            };

            if ($field !== null) {
                $nutrition = is_array($session['nutrition'] ?? null) ? $session['nutrition'] : [];
                $nutrition[$field] = '';
                $session['nutrition'] = $nutrition;
                $this->advanceNutritionStep($chatId, $user, $session, $messageId);
            }
        }
    }

    private function applyNutritionChoice(string $chatId, TenantUser $user, array $session, string $choice, string $value, ?int $messageId): void
    {
        $nutrition = is_array($session['nutrition'] ?? null) ? $session['nutrition'] : [];

        if ($choice === 'goal' && in_array($value, ['lose-weight', 'gain-weight', 'maintain-weight'], true)) {
            $nutrition['diet_goal'] = $value;
        } elseif ($choice === 'gender' && in_array($value, ['male', 'female'], true)) {
            $nutrition['gender'] = $value;
            $user->forceFill(['gender' => $value])->save();
        } elseif ($choice === 'activity_mode' && in_array($value, ['athlete', 'non-athlete'], true)) {
            $nutrition['athlete_mode'] = $value;
            unset($nutrition['activity_level']);
        } elseif ($choice === 'activity_level' && in_array($value, ['very-low', 'medium', 'high', 'intense'], true)) {
            $nutrition['activity_level'] = $value;
        } elseif ($choice === 'weekly_rate' && in_array($value, ['0.5', '1', '1.5'], true)) {
            $nutrition['weekly_weight_change_kg'] = (float) $value;
            $this->saveNutritionTargetWeight($user, $nutrition);
        } else {
            $this->showNutritionStep($chatId, $user, $session, $messageId);

            return;
        }

        $session['nutrition'] = $nutrition;
        $this->advanceNutritionStep($chatId, $user, $session, $messageId);
    }

    private function handleNutritionText(string $chatId, string $text): void
    {
        $user = $this->authenticatedUser($chatId);
        if (! $user) {
            $this->askPhoneForAction($chatId, 'nutrition:start');

            return;
        }

        $session = $this->session($chatId);
        $step = (string) ($session['nutrition_step'] ?? 'goal');
        $nutrition = is_array($session['nutrition'] ?? null) ? $session['nutrition'] : [];

        if ($text === self::LABEL_BACK) {
            $previous = $this->previousNutritionStep($step);
            if ($previous === null) {
                $this->clearFlow($chatId, keepAuth: true);
                $this->showHome($chatId);

                return;
            }

            $session['nutrition_step'] = $previous;
            $this->putSession($chatId, $session);
            $this->showNutritionStep($chatId, $user, $session, null);

            return;
        }

        if (in_array($text, [self::LABEL_HOME, 'خانه', '/home'], true)) {
            $this->clearFlow($chatId, keepAuth: true);
            $this->showHome($chatId);

            return;
        }

        if ($step === 'birth_date') {
            $date = $this->normalizeNutritionDate($text);
            if ($date === null) {
                $this->sendMessage($chatId, 'تاریخ تولد را به فرمت 1367-09-10 یا 1988-11-30 وارد کنید.', $this->nutritionBackReplyKeyboard());

                return;
            }

            $nutrition['birth_date'] = $date;
            $user->forceFill(['birth_date' => $date])->save();
        } elseif ($step === 'height') {
            $height = (int) InputNormalizer::digits($text);
            if ($height < 80 || $height > 250) {
                $this->sendMessage($chatId, 'قد باید بین 80 تا 250 سانتی‌متر باشد.', $this->nutritionBackReplyKeyboard());

                return;
            }

            $nutrition['height_cm'] = $height;
        } elseif ($step === 'weight') {
            $weight = $this->normalizeDecimal($text);
            if ($weight === null || $weight < 20 || $weight > 350) {
                $this->sendMessage($chatId, 'وزن باید بین 20 تا 350 کیلوگرم باشد. نمونه: 80 یا 80.50', $this->nutritionBackReplyKeyboard());

                return;
            }

            $nutrition['weight_kg'] = (string) $weight;
            try {
                $this->saveNutritionInitialProfile($user, $nutrition);
            } catch (\Throwable $exception) {
                Log::warning('Messaging bot nutrition profile save failed.', [
                    'tenant_id' => tenant('id'),
                    'channel' => $this->channel,
                    'tenant_user_id' => $user->id,
                    'error' => $exception->getMessage(),
                ]);
                $this->sendMessage($chatId, 'ذخیره اطلاعات اولیه انجام نشد. لطفا مراحل قبلی را بررسی کنید.', $this->nutritionBackReplyKeyboard());

                return;
            }
        } elseif ($step === 'target_weight') {
            $targetWeight = $this->normalizeDecimal($text);
            if ($targetWeight === null || $targetWeight < 20 || $targetWeight > 350) {
                $this->sendMessage($chatId, 'وزن هدف باید بین 20 تا 350 کیلوگرم باشد.', $this->nutritionBackReplyKeyboard());

                return;
            }

            $nutrition['target_weight_kg'] = (string) $targetWeight;
        } elseif (in_array($step, ['medical_conditions', 'medications', 'allergies', 'disliked_foods'], true)) {
            $field = match ($step) {
                'medical_conditions' => 'medical_conditions',
                'medications' => 'medications_and_supplements',
                'allergies' => 'food_allergies',
                'disliked_foods' => 'disliked_foods',
            };
            $nutrition[$field] = trim($text);
            if ($step === 'disliked_foods') {
                $this->saveNutritionPreferences($user, $nutrition);
            }
        } else {
            $this->showNutritionStep($chatId, $user, $session, null);

            return;
        }

        $session['nutrition'] = $nutrition;
        $this->advanceNutritionStep($chatId, $user, $session, null);
    }

    private function advanceNutritionStep(string $chatId, TenantUser $user, array $session, ?int $messageId): void
    {
        $current = (string) ($session['nutrition_step'] ?? 'goal');
        $next = $this->nextNutritionStep($current);
        $session['nutrition_step'] = $next ?? 'done';
        $this->putSession($chatId, $session);
        $this->showNutritionStep($chatId, $user, $session, $messageId);
    }

    private function showNutritionStep(string $chatId, TenantUser $user, array $session, ?int $messageId): void
    {
        $step = (string) ($session['nutrition_step'] ?? 'goal');
        $nutrition = is_array($session['nutrition'] ?? null) ? $session['nutrition'] : [];

        match ($step) {
            'goal' => $this->sendOrEdit($chatId, "منوی اطلاعات اولیه\nمرحله هدف رژیم\n\nهدف شما از رژیم چیست؟", $this->nutritionOptionsKeyboard([
                ['کاهش وزن', 'nutrition:goal:lose-weight'],
                ['افزایش وزن', 'nutrition:goal:gain-weight'],
                ['تثبیت وزن', 'nutrition:goal:maintain-weight'],
            ], false), $messageId),
            'gender' => $this->sendOrEdit($chatId, "منوی اطلاعات اولیه\nمرحله جنسیت و ادامه فرم رژیم\n\nلطفاً جنسیت خود را انتخاب کنید.", $this->nutritionOptionsKeyboard([
                ['زن', 'nutrition:gender:female'],
                ['مرد', 'nutrition:gender:male'],
            ]), $messageId),
            'activity_mode' => $this->sendOrEdit($chatId, "منوی اطلاعات اولیه\nمرحله فعالیت روزانه\n\nمیزان فعالیت شما چقدر است؟", $this->nutritionOptionsKeyboard([
                ['ورزشکار هستم', 'nutrition:activity_mode:athlete'],
                ['ورزشکار نیستم', 'nutrition:activity_mode:non-athlete'],
            ]), $messageId),
            'activity_level' => $this->sendOrEdit($chatId, "منوی اطلاعات اولیه\nمرحله فعالیت روزانه\n\nسطح فعالیت روزانه را انتخاب کنید.", $this->nutritionOptionsKeyboard([
                ['خیلی کم', 'nutrition:activity_level:very-low'],
                ['متوسط', 'nutrition:activity_level:medium'],
                ['زیاد', 'nutrition:activity_level:high'],
                ['شدید', 'nutrition:activity_level:intense'],
            ]), $messageId),
            'birth_date' => $this->sendTextStep($chatId, "منوی اطلاعات اولیه\nمرحله تاریخ تولد\n\nتاریخ تولد را وارد کنید.\nنمونه: 1367-09-10", $messageId),
            'height' => $this->sendTextStep($chatId, "منوی اطلاعات اولیه\nمرحله قد\n\nقد خود را به سانتی‌متر وارد کنید.\nمقدار معمول بین 80 تا 250 است.\nنمونه: 172", $messageId),
            'weight' => $this->sendTextStep($chatId, "منوی اطلاعات اولیه\nمرحله وزن\n\nوزن خود را به کیلوگرم وارد کنید.\nنمونه: 80 یا 80.50", $messageId),
            'completed' => $this->sendOrEdit($chatId, "عضویت اولیه با موفقیت ثبت شد\n\nاطلاعات اولیه شما ذخیره شد. حالا اطلاعات تکمیلی را وارد می‌کنیم تا برنامه رژیم دقیق‌تر و شخصی‌سازی‌شده‌تری برای شما آماده شود.", $this->nutritionOptionsKeyboard([
                ['ادامه', 'nutrition:completed:continue'],
            ]), $messageId),
            'target_weight' => $this->sendTextStep($chatId, $this->nutritionTargetWeightText($nutrition), $messageId),
            'weekly_rate' => $this->sendOrEdit($chatId, $this->nutritionWeeklyRateText($nutrition), $this->nutritionOptionsKeyboard([
                ['هفته‌ای ۰.۵ کیلو', 'nutrition:weekly_rate:0.5'],
                ['هفته‌ای ۱ کیلو', 'nutrition:weekly_rate:1'],
                ['هفته‌ای ۱.۵ کیلو', 'nutrition:weekly_rate:1.5'],
            ]), $messageId),
            'medical_conditions' => $this->sendTextStep($chatId, "سوابق بیماری\nمرحله وضعیت پزشکی\n\nاگر بیماری خاصی دارید، موردبه‌مورد در یک پیام بنویسید. اگر ندارید دکمه «ندارم / رد کردن» را بزنید.", $messageId, true),
            'medications' => $this->sendTextStep($chatId, "دارو یا مکمل مصرفی\n\nاگر دارو یا مکمل مصرف می‌کنید، نام و مقدار را بنویسید. اگر ندارید دکمه «ندارم / رد کردن» را بزنید.", $messageId, true),
            'allergies' => $this->sendTextStep($chatId, "حساسیت غذایی\n\nاگر حساسیت غذایی دارید بنویسید. اگر ندارید دکمه «ندارم / رد کردن» را بزنید.", $messageId, true),
            'disliked_foods' => $this->sendTextStep($chatId, "غذاهای نامطلوب\n\nغذاهایی که دوست ندارید یا نمی‌خواهید در رژیم باشد را بنویسید. اگر موردی ندارید دکمه «ندارم / رد کردن» را بزنید.", $messageId, true),
            default => $this->completeNutritionFlow($chatId, $user, $nutrition, $messageId),
        };
    }

    private function sendTextStep(string $chatId, string $text, ?int $messageId, bool $skippable = false): void
    {
        $this->sendOrEdit($chatId, $text, $skippable ? $this->nutritionSkipKeyboard() : $this->nutritionNavigationKeyboard(), $messageId);
        $this->sendMessage($chatId, 'پاسخ را همینجا به صورت پیام متنی بفرستید.', $this->nutritionBackReplyKeyboard());
    }

    private function completeNutritionFlow(string $chatId, TenantUser $user, array $nutrition, ?int $messageId): void
    {
        $this->saveNutritionPreferences($user, $nutrition);
        $this->clearFlow($chatId, keepAuth: true);
        $this->sendOrEdit(
            $chatId,
            "اطلاعات عضویت و ترجیحات رژیم ثبت شد.\nبرای انتخاب پکیج و ادامه دریافت رژیم، از صفحه عضویت سایت ادامه دهید:\n".url('/nutrition/membership/packages'),
            $this->mainInlineKeyboard(),
            $messageId,
        );
    }

    private function startBooking(string $chatId, TenantUser $user, ?int $messageId): void
    {
        $session = [
            'step' => 'booking',
            'phone' => $user->mobile,
            'name' => $user->name ?: 'کاربر تلگرام',
            'tenant_user_id' => $user->id,
        ];
        $this->putSession($chatId, $session);

        $barbers = $this->availability->activeBarbers();

        if ($barbers === []) {
            $this->sendOrEdit($chatId, 'فعلا مورد فعالی برای نوبت‌دهی تعریف نشده است.', $this->mainInlineKeyboard(), $messageId);

            return;
        }

        if (count($barbers) === 1) {
            $session['barber_id'] = $barbers[0]->id;
            $this->putSession($chatId, $session);
            $this->showServices($chatId, $user, $session, $messageId);

            return;
        }

        $this->sendOrEdit($chatId, 'از کدام آرایشگر می‌خواهید نوبت بگیرید؟', [
            'inline_keyboard' => [
                ...$this->rows($barbers, fn (Barber $barber) => [
                    'text' => $barber->name,
                    'callback_data' => 'booking:barber:'.$barber->id,
                ]),
                [
                    ['text' => self::LABEL_BACK, 'callback_data' => 'main'],
                    ['text' => self::LABEL_HOME, 'callback_data' => 'main'],
                ],
            ],
        ], $messageId);
    }

    private function showServices(string $chatId, TenantUser $user, array $session, ?int $messageId): void
    {
        $services = $this->availability->activeServicesForBarber((int) ($session['barber_id'] ?? 0));

        if ($services === []) {
            $this->sendOrEdit($chatId, 'برای این آرایشگر بخشی فعال نیست.', $this->mainInlineKeyboard(), $messageId);

            return;
        }

        if (count($services) === 1) {
            $session['service_id'] = $services[0]->id;
            $this->putSession($chatId, $session);
            $this->showFirstAvailableDay($chatId, $user, $session, $messageId);

            return;
        }

        $this->sendOrEdit($chatId, 'کدام بخش را انتخاب می‌کنید؟', [
            'inline_keyboard' => [
                ...$this->rows($services, fn (Service $service) => [
                    'text' => $service->name,
                    'callback_data' => 'booking:service:'.$service->id,
                ]),
                [
                    ['text' => self::LABEL_BACK, 'callback_data' => 'booking:back:barbers'],
                    ['text' => self::LABEL_HOME, 'callback_data' => 'main'],
                ],
            ],
        ], $messageId);
    }

    private function showFirstAvailableDay(string $chatId, TenantUser $user, array $session, ?int $messageId): void
    {
        $dates = $this->activeDatesForSession($session, $user);

        if ($dates === []) {
            $this->sendOrEdit($chatId, 'فعلا روز آزادی برای این انتخاب پیدا نشد.', $this->mainInlineKeyboard(), $messageId);

            return;
        }

        $session['active_dates'] = $dates;
        $session['date_index'] = 0;
        $session['date'] = $dates[0];
        $this->putSession($chatId, $session);
        $this->showTimes($chatId, $user, $session, $messageId);
    }

    private function showTimes(string $chatId, TenantUser $user, array $session, ?int $messageId): void
    {
        $barber = Barber::query()->find((int) ($session['barber_id'] ?? 0));
        $service = Service::query()->find((int) ($session['service_id'] ?? 0));
        $date = (string) ($session['date'] ?? '');
        $dates = $this->activeDatesForSession($session, $user);
        $index = $this->dateIndex($date, $dates, (int) ($session['date_index'] ?? 0));

        if (! $barber || ! $service || $date === '') {
            $this->sendOrEdit($chatId, 'انتخاب کامل نیست. لطفا دوباره شروع کنید.', $this->mainInlineKeyboard(), $messageId);

            return;
        }

        if ($dates === []) {
            $this->sendOrEdit($chatId, 'فعلا روز آزادی برای این انتخاب پیدا نشد.', $this->mainInlineKeyboard(), $messageId);

            return;
        }

        if (! in_array($date, $dates, true)) {
            $date = $dates[$index] ?? $dates[0];
        }

        $slots = $this->availability->availableSlots($barber, $service, $date, $user);

        $text = "انتخاب ساعت نوبت\n"
            .'آرایشگر: '.$barber->name."\n"
            .'بخش: '.$service->name."\n"
            .'روز: '.$this->dateLabel($date);

        $notice = trim((string) ($session['notice'] ?? ''));
        if ($notice !== '') {
            $text .= "\n\n".$notice;
            unset($session['notice']);
        }

        if ($slots === []) {
            $text .= "\n\nبرای این روز ساعت آزادی باقی نمانده است.";
        }

        $dateNav = array_filter([
            $index < count($dates) - 1 ? ['text' => 'روز بعد', 'callback_data' => 'booking:date:next'] : null,
            ['text' => 'انتخاب روز دیگر', 'callback_data' => 'booking:date:list'],
            $index > 0 ? ['text' => 'روز قبل', 'callback_data' => 'booking:date:prev'] : null,
        ]);

        $session['active_dates'] = $dates;
        $session['date_index'] = $index;
        $session['date'] = $date;
        $this->putSession($chatId, $session);

        $this->sendOrEdit($chatId, $text, [
            'inline_keyboard' => [
                ...$this->rows($slots, fn (array $slot) => [
                    'text' => JalaliDate::toPersianDigits((string) $slot['start']),
                    'callback_data' => 'booking:time:'.$slot['start'].'|'.$slot['end'],
                ], 3),
                array_values($dateNav),
                [
                    ['text' => self::LABEL_BACK, 'callback_data' => 'booking:back:services'],
                    ['text' => self::LABEL_HOME, 'callback_data' => 'main'],
                ],
            ],
        ], $messageId);
    }

    private function showDateList(string $chatId, TenantUser $user, array $session, ?int $messageId): void
    {
        $dates = $this->activeDatesForSession($session, $user);

        if ($dates === []) {
            $this->sendOrEdit($chatId, 'روز فعالی برای انتخاب پیدا نشد.', $this->mainInlineKeyboard(), $messageId);

            return;
        }

        $this->sendOrEdit($chatId, 'یک روز فعال را انتخاب کنید:', [
            'inline_keyboard' => [
                ...$this->rows($dates, fn (string $date) => [
                    'text' => $this->dateLabel($date),
                    'callback_data' => 'booking:date:pick:'.$date,
                ], 2),
                [
                    ['text' => 'بازگشت به ساعت‌ها', 'callback_data' => 'booking:date:pick:'.(string) ($session['date'] ?? $dates[0])],
                ],
                [
                    ['text' => self::LABEL_HOME, 'callback_data' => 'main'],
                ],
            ],
        ], $messageId);
    }

    private function showConfirm(string $chatId, TenantUser $user, array $session, ?int $messageId): void
    {
        $barber = Barber::query()->find((int) ($session['barber_id'] ?? 0));
        $service = Service::query()->find((int) ($session['service_id'] ?? 0));

        if (! $barber || ! $service) {
            $this->sendOrEdit($chatId, 'انتخاب کامل نیست. لطفا دوباره شروع کنید.', $this->mainInlineKeyboard(), $messageId);

            return;
        }

        $text = "تایید نوبت\n"
            .'آرایشگر: '.$barber->name."\n"
            .'بخش: '.$service->name."\n"
            .'روز: '.$this->dateLabel((string) $session['date'])."\n"
            .'ساعت: '.JalaliDate::toPersianDigits((string) $session['start']);

        $this->sendOrEdit($chatId, $text, [
            'inline_keyboard' => [
                [
                    ['text' => 'تایید و ثبت نوبت', 'callback_data' => 'booking:confirm'],
                ],
                [
                    ['text' => self::LABEL_BACK, 'callback_data' => 'booking:back:times'],
                    ['text' => self::LABEL_HOME, 'callback_data' => 'main'],
                ],
            ],
        ], $messageId);
    }

    private function book(string $chatId, TenantUser $user, array $session, ?int $messageId): void
    {
        try {
            $appointment = $this->bookingService->book($user, [
                'barberId' => (int) $session['barber_id'],
                'sectionId' => (int) $session['service_id'],
                'date' => (string) $session['date'],
                'startTime' => (string) $session['start'],
                'endTime' => (string) $session['end'],
                'userName' => $user->name ?: (string) ($session['name'] ?? 'کاربر تلگرام'),
                'userPhone' => $user->mobile,
                'sendSms' => true,
                'isForSomeoneElse' => false,
            ]);

            $this->clearFlow($chatId, keepAuth: true);
            $this->sendOrEdit(
                $chatId,
                "نوبت شما ثبت شد.\n"
                ."کد نوبت: {$appointment->public_code}\n"
                .'روز: '.$this->dateLabel($appointment->appointment_date?->toDateString() ?? (string) $session['date'])."\n"
                .'ساعت: '.JalaliDate::toPersianDigits(substr((string) $appointment->start_time, 0, 5)),
                $this->mainInlineKeyboard('دریافت نوبت جدید'),
                $messageId,
            );
        } catch (ValidationException $exception) {
            $message = collect($exception->errors())->flatten()->first() ?: 'ثبت نوبت ممکن نشد. لطفا دوباره انتخاب کنید.';
            $this->sendOrEdit($chatId, (string) $message, $this->mainInlineKeyboard('تلاش دوباره'), $messageId);
        } catch (\Throwable $exception) {
            Log::warning('Messaging bot appointment booking failed.', [
                'tenant_id' => tenant('id'),
                'channel' => $this->channel,
                'chat_id' => $chatId,
                'error' => $exception->getMessage(),
            ]);
            $this->sendOrEdit($chatId, 'ثبت نوبت با خطا روبه‌رو شد. لطفا کمی بعد دوباره تلاش کنید.', $this->mainInlineKeyboard(), $messageId);
        }
    }

    /**
     * @return array<int, string>
     */
    private function activeDatesForSession(array $session, TenantUser $user): array
    {
        $barber = Barber::query()->find((int) ($session['barber_id'] ?? 0));
        $service = Service::query()->find((int) ($session['service_id'] ?? 0));

        if (! $barber || ! $service) {
            return [];
        }

        return $this->availability->bookableDates($barber, $service, $user, self::DATE_LIMIT);
    }

    private function authenticatedUser(string $chatId): ?TenantUser
    {
        $userId = Cache::get($this->authKey($chatId));

        if (! $userId) {
            return null;
        }

        $user = TenantUser::query()->find((int) $userId);

        if (! $user || ! $user->is_active) {
            Cache::forget($this->authKey($chatId));

            return null;
        }

        Cache::forever($this->userChatKey((int) $user->id), $chatId);

        return $user;
    }

    private function rememberAuthentication(string $chatId, TenantUser $user): void
    {
        Cache::forever($this->authKey($chatId), $user->id);
        Cache::forever($this->userChatKey((int) $user->id), $chatId);
    }

    private function showUserAppointments(string $chatId, TenantUser $user, ?int $messageId = null): void
    {
        $appointments = $this->futureCancelableAppointments($user)
            ->limit(10)
            ->get();

        if ($appointments->isEmpty()) {
            $this->sendOrEdit($chatId, 'نوبت آینده قابل کنسلی برای شما پیدا نشد.', $this->mainInlineKeyboard(), $messageId);

            return;
        }

        $this->sendOrEdit($chatId, 'نوبت‌های آینده شما:', [
            'inline_keyboard' => [
                ...$this->rows($appointments->all(), fn (Appointment $appointment) => [
                    'text' => $this->appointmentButtonLabel($appointment),
                    'callback_data' => 'appointments:show:'.$appointment->id,
                ]),
                [
                    ['text' => self::LABEL_HOME, 'callback_data' => 'main'],
                ],
            ],
        ], $messageId);
    }

    private function showAppointmentDetail(string $chatId, TenantUser $user, int $appointmentId, ?int $messageId): void
    {
        $appointment = $this->futureCancelableAppointments($user)
            ->whereKey($appointmentId)
            ->first();

        if (! $appointment) {
            $this->sendOrEdit($chatId, 'این نوبت قابل کنسل کردن نیست یا قبلا لغو شده است.', $this->appointmentsInlineKeyboard(), $messageId);

            return;
        }

        $this->sendOrEdit($chatId, $this->appointmentDetailText($appointment), [
            'inline_keyboard' => [
                [
                    ['text' => 'کنسل کردن نوبت', 'callback_data' => 'appointments:cancel:ask:'.$appointment->id],
                ],
                [
                    ['text' => self::LABEL_BACK, 'callback_data' => 'appointments:list'],
                    ['text' => self::LABEL_HOME, 'callback_data' => 'main'],
                ],
            ],
        ], $messageId);
    }

    private function askCancelAppointment(string $chatId, TenantUser $user, int $appointmentId, ?int $messageId): void
    {
        $appointment = $this->futureCancelableAppointments($user)
            ->whereKey($appointmentId)
            ->first();

        if (! $appointment) {
            $this->sendOrEdit($chatId, 'این نوبت قابل کنسل کردن نیست یا قبلا لغو شده است.', $this->appointmentsInlineKeyboard(), $messageId);

            return;
        }

        $this->sendOrEdit($chatId, "آیا از کنسل کردن این نوبت مطمئن هستید؟\n\n".$this->appointmentDetailText($appointment), [
            'inline_keyboard' => [
                [
                    ['text' => 'بله، کنسل شود', 'callback_data' => 'appointments:cancel:yes:'.$appointment->id],
                ],
                [
                    ['text' => 'نه، برگشت', 'callback_data' => 'appointments:show:'.$appointment->id],
                    ['text' => self::LABEL_HOME, 'callback_data' => 'main'],
                ],
            ],
        ], $messageId);
    }

    private function cancelAppointment(string $chatId, TenantUser $user, int $appointmentId, ?int $messageId): void
    {
        $appointment = $this->futureCancelableAppointments($user)
            ->whereKey($appointmentId)
            ->first();

        if (! $appointment) {
            $this->sendOrEdit($chatId, 'این نوبت قابل کنسل کردن نیست یا قبلا لغو شده است.', $this->appointmentsInlineKeyboard(), $messageId);

            return;
        }

        $appointment->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
        ]);

        $fresh = $appointment->fresh() ?? $appointment;
        $this->customerClubService->reverseAppointmentAward(
            $fresh,
            'به دلیل لغو نوبت، امتیاز و اعتبار باشگاه مشتریان این نوبت از حساب شما برگشت داده شد.',
        );

        app(AppointmentCacheService::class)->forgetForAppointment((string) tenant('id'), $appointment);
        event(new AppointmentAvailabilityChanged(
            tenant('id'),
            (string) $appointment->barber_id,
            $appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date'),
            'cancelled',
            (string) $appointment->id,
        ));
        app(AppointmentSmsService::class)->sendCancellation($fresh);

        $this->sendOrEdit($chatId, 'نوبت شما کنسل شد.', $this->appointmentsInlineKeyboard(), $messageId);
    }

    private function futureCancelableAppointments(TenantUser $user): Builder
    {
        return Appointment::query()
            ->where('customer_phone_snapshot', (string) $user->mobile)
            ->where('status', 'booked')
            ->where('starts_at', '>', now())
            ->orderBy('starts_at');
    }

    private function appointmentButtonLabel(Appointment $appointment): string
    {
        return JalaliDate::toPersianDigits(substr((string) $appointment->start_time, 0, 5))
            .' - '.$this->dateLabel($appointment->appointment_date?->toDateString() ?? '')
            .' - '.(string) $appointment->service_name_snapshot;
    }

    private function appointmentDetailText(Appointment $appointment): string
    {
        return "جزئیات نوبت\n"
            .'کد: '.JalaliDate::toPersianDigits((string) $appointment->public_code)."\n"
            .'آرایشگر: '.(string) $appointment->professional_name_snapshot."\n"
            .'بخش: '.(string) $appointment->service_name_snapshot."\n"
            .'روز: '.$this->dateLabel($appointment->appointment_date?->toDateString() ?? '')."\n"
            .'ساعت: '.JalaliDate::toPersianDigits(substr((string) $appointment->start_time, 0, 5));
    }

    private function appointmentsInlineKeyboard(): array
    {
        return [
            'inline_keyboard' => [
                [
                    ['text' => 'نوبت‌های من', 'callback_data' => 'appointments:list'],
                ],
                [
                    ['text' => self::LABEL_HOME, 'callback_data' => 'main'],
                ],
            ],
        ];
    }

    private function showContactPage(string $chatId): void
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $contact = is_array($rules['contact_page'] ?? null) ? $rules['contact_page'] : [];
        $location = is_array($contact['location'] ?? null) ? $contact['location'] : [];
        $lines = ['ارتباط با ما'];

        foreach ((array) ($contact['phones'] ?? []) as $phone) {
            if (! is_array($phone)) {
                continue;
            }

            $title = trim((string) ($phone['title'] ?? ''));
            $number = trim((string) ($phone['number'] ?? ''));

            if ($title !== '' || $number !== '') {
                $lines[] = trim($title.($title !== '' && $number !== '' ? ': ' : '').$number);
            }
        }

        if ((bool) ($location['enabled'] ?? false)) {
            $address = trim((string) ($location['address'] ?? ''));
            $city = trim((string) ($location['city_name'] ?? ''));
            $province = trim((string) ($location['province_name'] ?? ''));

            if ($province !== '' || $city !== '') {
                $lines[] = trim($province.' '.$city);
            }

            if ($address !== '') {
                $lines[] = $address;
            }
        }

        $this->sendMessage($chatId, implode("\n", array_filter($lines)), $this->homeReplyKeyboard());

        $latitude = isset($location['latitude']) ? (float) $location['latitude'] : null;
        $longitude = isset($location['longitude']) ? (float) $location['longitude'] : null;

        if ((bool) ($location['enabled'] ?? false) && $latitude !== null && $longitude !== null) {
            $this->sendLocation($chatId, $latitude, $longitude);
        }
    }

    private function showAboutPage(string $chatId): void
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $about = is_array($rules['about_page'] ?? null) ? $rules['about_page'] : [];
        $title = trim((string) ($about['title'] ?? 'درباره ما'));
        $body = trim(strip_tags((string) ($about['body'] ?? '')));
        $text = $title.($body !== '' ? "\n\n".$body : '');

        $this->sendMessage($chatId, mb_substr($text, 0, 3500), $this->homeReplyKeyboard());
    }

    private function isNutritionAudience(): bool
    {
        $tenant = tenant();
        $tenant?->loadMissing('audienceType:id,slug');

        return in_array((string) ($tenant?->audienceType?->slug ?? ''), ['nutritionists', 'nutrition-doctors'], true);
    }

    private function previousNutritionStep(string $step): ?string
    {
        $index = array_search($step, self::NUTRITION_STEPS, true);

        if ($index === false || $index <= 0) {
            return null;
        }

        return self::NUTRITION_STEPS[$index - 1];
    }

    private function nextNutritionStep(string $step): ?string
    {
        $index = array_search($step, self::NUTRITION_STEPS, true);

        if ($index === false || $index >= count(self::NUTRITION_STEPS) - 1) {
            return null;
        }

        return self::NUTRITION_STEPS[$index + 1];
    }

    private function saveNutritionInitialProfile(TenantUser $user, array &$nutrition): NutritionProfile
    {
        foreach (['diet_goal', 'gender', 'athlete_mode', 'activity_level', 'birth_date', 'height_cm', 'weight_kg'] as $field) {
            if (! isset($nutrition[$field]) || $nutrition[$field] === '') {
                throw new \InvalidArgumentException("Missing nutrition field {$field}");
            }
        }

        $metrics = NutritionWeightGoalCalculator::metrics(
            (int) $nutrition['height_cm'],
            (string) $nutrition['gender'],
            (float) $nutrition['weight_kg'],
            (string) $nutrition['diet_goal'],
        );

        $profile = NutritionProfile::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'diet_goal' => $nutrition['diet_goal'],
                'gender' => $nutrition['gender'],
                'athlete_mode' => $nutrition['athlete_mode'],
                'activity_level' => $nutrition['activity_level'],
                'birth_date' => $nutrition['birth_date'],
                'height_cm' => $nutrition['height_cm'],
                'weight_kg' => $nutrition['weight_kg'],
                'ideal_weight_kg' => $metrics['ideal_weight_kg'],
                'recommended_target_weight_kg' => $metrics['recommended_target_weight_kg'],
                'onboarding_completed_at' => now(),
            ],
        );

        DB::table('nutrition_weight_logs')->insert([
            'user_id' => $user->id,
            'logged_by_user_id' => $user->id,
            'source' => 'profile',
            'recorded_on' => now()->toDateString(),
            'recorded_at' => now(),
            'weight_kg' => $nutrition['weight_kg'],
            'notes' => 'ثبت وزن هنگام تکمیل اطلاعات اولیه تغذیه از ربات پیام‌رسان',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user->forceFill([
            'gender' => $nutrition['gender'],
            'birth_date' => $nutrition['birth_date'],
        ])->save();

        $nutrition['ideal_weight_kg'] = $metrics['ideal_weight_kg'];
        $nutrition['recommended_target_weight_kg'] = $metrics['recommended_target_weight_kg'];
        $nutrition['healthy_min_weight_kg'] = $metrics['healthy_min_weight_kg'] ?? null;
        $nutrition['healthy_max_weight_kg'] = $metrics['healthy_max_weight_kg'] ?? null;

        return $profile;
    }

    private function saveNutritionTargetWeight(TenantUser $user, array $nutrition): void
    {
        $profile = NutritionProfile::query()->where('user_id', $user->id)->first();

        if (! $profile || ! isset($nutrition['target_weight_kg'])) {
            return;
        }

        $profile->forceFill([
            'target_weight_kg' => $nutrition['target_weight_kg'],
            'weekly_weight_change_kg' => $nutrition['weekly_weight_change_kg'] ?? $profile->weekly_weight_change_kg,
        ])->save();
    }

    private function saveNutritionPreferences(TenantUser $user, array $nutrition): void
    {
        $profile = NutritionProfile::query()->where('user_id', $user->id)->first();

        if (! $profile) {
            return;
        }

        $medicalConditionEntries = NutritionMedicalConditionSupport::parseEntries((string) ($nutrition['medical_conditions'] ?? ''));

        $profile->forceFill([
            'medical_conditions' => NutritionMedicalConditionSupport::encodeEntries($medicalConditionEntries),
            'medications_and_supplements' => trim((string) ($nutrition['medications_and_supplements'] ?? '')) ?: null,
            'food_allergies' => trim((string) ($nutrition['food_allergies'] ?? '')) ?: null,
            'disliked_foods' => trim((string) ($nutrition['disliked_foods'] ?? '')) ?: null,
            'preferences_completed_at' => now(),
        ])->save();
    }

    private function nutritionTargetWeightText(array $nutrition): string
    {
        $recommended = isset($nutrition['recommended_target_weight_kg'])
            ? (float) $nutrition['recommended_target_weight_kg']
            : null;
        $ideal = isset($nutrition['ideal_weight_kg']) ? (float) $nutrition['ideal_weight_kg'] : null;
        $suggested = $ideal ?: $recommended;

        return "وزن هدف\n\nوزن هدف خود را به کیلوگرم وارد کنید."
            .($recommended ? "\nوزن سلامت پیشنهادی: ".$this->formatNutritionWeight($recommended).' کیلو' : '')
            .($ideal ? "\nوزن ایده‌آل: ".$this->formatNutritionWeight($ideal).' کیلو' : '')
            .($suggested ? "\nپیشنهاد قابل وارد کردن: ".(string) round($suggested) : '')
            ."\n\nنمونه: 72";
    }

    private function nutritionWeeklyRateText(array $nutrition): string
    {
        $currentWeight = isset($nutrition['weight_kg']) ? (float) $nutrition['weight_kg'] : 0.0;
        $targetWeight = isset($nutrition['target_weight_kg']) ? (float) $nutrition['target_weight_kg'] : $currentWeight;
        $diff = abs($currentWeight - $targetWeight);

        return "برنامه رسیدن به وزن هدف\n\nسرعت پیشنهادی تغییر وزن را انتخاب کنید."
            .($diff > 0 ? "\nاختلاف وزن فعلی و هدف: ".$this->formatNutritionWeight($diff).' کیلو' : "\nشما همین حالا روی وزن هدف قرار دارید.");
    }

    private function formatNutritionWeight(float $value): string
    {
        return JalaliDate::toPersianDigits(rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.'));
    }

    private function normalizeDecimal(string $value): ?float
    {
        $normalized = str_replace(',', '.', InputNormalizer::digits($value));
        $normalized = preg_replace('/[^\d.]+/', '', $normalized) ?? '';

        if ($normalized === '' || substr_count($normalized, '.') > 1) {
            return null;
        }

        return is_numeric($normalized) ? (float) $normalized : null;
    }

    private function normalizeNutritionDate(string $value): ?string
    {
        $normalized = InputNormalizer::digits(trim($value));
        $normalized = str_replace(['/', '.', '_'], '-', $normalized);

        if (! preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/', $normalized, $matches)) {
            return null;
        }

        $year = (int) $matches[1];
        $month = (int) $matches[2];
        $day = (int) $matches[3];

        if ($year >= 1200 && $year <= 1700) {
            $maxDay = $month <= 6 ? 31 : ($month <= 12 ? 30 : 0);
            if ($month < 1 || $month > 12 || $day < 1 || $day > $maxDay) {
                return null;
            }

            $gregorian = $this->jalaliToGregorian($year, $month, $day);

            return sprintf('%04d-%02d-%02d', $gregorian[0], $gregorian[1], $gregorian[2]);
        }

        if (! checkdate($month, $day, $year)) {
            return null;
        }

        return sprintf('%04d-%02d-%02d', $year, $month, $day);
    }

    /**
     * @return array{0: int, 1: int, 2: int}
     */
    private function jalaliToGregorian(int $jy, int $jm, int $jd): array
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
        $months = [0, 31, $this->isGregorianLeap($gy) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        $gm = 1;

        while ($gm <= 12 && $gd > $months[$gm]) {
            $gd -= $months[$gm];
            $gm++;
        }

        return [$gy, $gm, $gd];
    }

    private function isGregorianLeap(int $year): bool
    {
        return ($year % 4 === 0 && $year % 100 !== 0) || $year % 400 === 0;
    }

    private function nutritionOptionsKeyboard(array $options, bool $withBack = true): array
    {
        $rows = collect($options)
            ->map(fn (array $option) => [['text' => $option[0], 'callback_data' => $option[1]]])
            ->values()
            ->all();

        $navigation = [];
        if ($withBack) {
            $navigation[] = ['text' => self::LABEL_BACK, 'callback_data' => 'nutrition:back'];
        }
        $navigation[] = ['text' => self::LABEL_HOME, 'callback_data' => 'nutrition:home'];
        $rows[] = $navigation;

        return ['inline_keyboard' => $rows];
    }

    private function nutritionNavigationKeyboard(): array
    {
        return [
            'inline_keyboard' => [
                [
                    ['text' => self::LABEL_BACK, 'callback_data' => 'nutrition:back'],
                    ['text' => self::LABEL_HOME, 'callback_data' => 'nutrition:home'],
                ],
            ],
        ];
    }

    private function nutritionSkipKeyboard(): array
    {
        return [
            'inline_keyboard' => [
                [
                    ['text' => 'ندارم / رد کردن', 'callback_data' => 'nutrition:skip_text'],
                ],
                [
                    ['text' => self::LABEL_BACK, 'callback_data' => 'nutrition:back'],
                    ['text' => self::LABEL_HOME, 'callback_data' => 'nutrition:home'],
                ],
            ],
        ];
    }

    private function nutritionBackReplyKeyboard(): array
    {
        return [
            'keyboard' => [
                [
                    ['text' => self::LABEL_BACK],
                    ['text' => self::LABEL_HOME],
                ],
            ],
            'resize_keyboard' => true,
            'one_time_keyboard' => false,
        ];
    }

    private function contactPageEnabled(): bool
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $contact = is_array($rules['contact_page'] ?? null) ? $rules['contact_page'] : [];

        return (bool) ($contact['enabled'] ?? false);
    }

    private function aboutPageEnabled(): bool
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $about = is_array($rules['about_page'] ?? null) ? $rules['about_page'] : [];

        return (bool) ($about['enabled'] ?? false);
    }

    private function normalizePhone(string $value): string
    {
        $digits = preg_replace('/\D+/', '', InputNormalizer::digits($value)) ?? '';

        if (str_starts_with($digits, '0098') && strlen($digits) === 14 && str_starts_with(substr($digits, 4), '9')) {
            return '0'.substr($digits, 4);
        }

        if (str_starts_with($digits, '98') && strlen($digits) === 12 && str_starts_with(substr($digits, 2), '9')) {
            return '0'.substr($digits, 2);
        }

        if (str_starts_with($digits, '9') && strlen($digits) === 10) {
            return '0'.$digits;
        }

        return $digits;
    }

    private function isValidMobile(string $phone): bool
    {
        return InputNormalizer::isValidMobile($phone);
    }

    private function chatIdFromMessage(array $message): string
    {
        return (string) data_get($message, 'chat.id', '');
    }

    private function sendMessage(string $chatId, string $text, ?array $replyMarkup = null, ?string $photoUrl = null): ?int
    {
        $token = $this->token();

        if ($token === '') {
            return null;
        }

        $payload = [
            'chat_id' => $chatId,
        ];

        if ($replyMarkup !== null) {
            $payload['reply_markup'] = $replyMarkup;
        }

        if ($photoUrl !== null && trim($photoUrl) !== '') {
            $payload['photo'] = $photoUrl;
            if (mb_strlen($text) <= 1000) {
                $payload['caption'] = $text;
                $response = $this->botHttpClient(10)->post($this->botApiUrl($token, 'sendPhoto'), $payload);
            } else {
                $photoPayload = $payload;
                unset($photoPayload['reply_markup']);
                $this->botHttpClient(10)->post($this->botApiUrl($token, 'sendPhoto'), $photoPayload);
                unset($payload['photo']);
                $payload['text'] = $text;
                $response = $this->botHttpClient(10)->post($this->botApiUrl($token, 'sendMessage'), $payload);
            }
        } else {
            $payload['text'] = $text;
            $response = $this->botHttpClient(10)->post($this->botApiUrl($token, 'sendMessage'), $payload);
        }

        $json = $response->json();

        return isset($json['result']['message_id']) ? (int) $json['result']['message_id'] : null;
    }

    private function closeReplyKeyboard(string $chatId): void
    {
        $this->sendMessage($chatId, 'ادامه را از دکمه‌های همین پیام انتخاب کنید.', [
            'remove_keyboard' => true,
        ]);
    }

    private function sendLocation(string $chatId, float $latitude, float $longitude): void
    {
        $token = $this->token();

        if ($token === '') {
            return;
        }

        $this->botHttpClient(10)->post($this->botApiUrl($token, 'sendLocation'), [
            'chat_id' => $chatId,
            'latitude' => $latitude,
            'longitude' => $longitude,
        ]);
    }

    private function sendOrEdit(string $chatId, string $text, ?array $replyMarkup = null, ?int $messageId = null): ?int
    {
        if ($messageId === null) {
            return $this->sendMessage($chatId, $text, $replyMarkup);
        }

        $token = $this->token();
        if ($token === '') {
            return null;
        }

        $payload = [
            'chat_id' => $chatId,
            'message_id' => $messageId,
            'text' => $text,
        ];

        if ($replyMarkup !== null) {
            $payload['reply_markup'] = $replyMarkup;
        }

        $response = $this->botHttpClient(10)->post($this->botApiUrl($token, 'editMessageText'), $payload);

        if (! (bool) ($response->json('ok') ?? false)) {
            return $this->sendMessage($chatId, $text, $replyMarkup);
        }

        return $messageId;
    }

    private function answerCallback(string $callbackId): void
    {
        if ($callbackId === '' || $this->token() === '') {
            return;
        }

        $this->botHttpClient(5)->post($this->botApiUrl($this->token(), 'answerCallbackQuery'), [
            'callback_query_id' => $callbackId,
        ]);
    }

    private function botHttpClient(int $timeout): PendingRequest
    {
        $client = Http::timeout($timeout);
        $settings = SystemSetting::getValue('telegram_bot', []);
        $socksAddress = trim((string) ($settings['socks_address'] ?? ''));

        if ($this->channel === 'telegram' && (bool) ($settings['socks_enabled'] ?? false) && $socksAddress !== '') {
            $client = $client->withOptions(['proxy' => $socksAddress]);
        }

        return $client;
    }

    private function botApiUrl(string $token, string $method): string
    {
        $settings = $this->channelSettings();
        $baseUrl = rtrim(trim((string) ($settings['api_base_url'] ?? '')), '/');

        if ($baseUrl === '') {
            $baseUrl = self::DEFAULT_API_BASE_URLS[$this->channel];
        }

        return $baseUrl.$token.'/'.$method;
    }

    private function isEnabled(): bool
    {
        $settings = $this->channelSettings();

        return (bool) ($settings['enabled'] ?? false) && $this->token() !== '';
    }

    private function token(): string
    {
        $token = (string) ($this->channelSettings()['token'] ?? '');

        if ($token === '') {
            return '';
        }

        try {
            return Crypt::decryptString($token);
        } catch (\Throwable) {
            return '';
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function channelSettings(): array
    {
        $bookingRules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $bots = is_array($bookingRules['messaging_bots'] ?? null) ? $bookingRules['messaging_bots'] : [];

        return is_array($bots[$this->channel] ?? null) ? $bots[$this->channel] : [];
    }

    private function welcomeText(string $name): string
    {
        $text = trim((string) ($this->channelSettings()['welcome_text'] ?? ''));

        if ($text === '') {
            return "سلام {$name}\nاز منوی پایین انتخاب کنید.";
        }

        return strtr($text, [
            '{{name}}' => $name,
            '{{نام}}' => $name,
        ]);
    }

    private function welcomeImageUrl(): ?string
    {
        $path = trim((string) ($this->channelSettings()['welcome_image_path'] ?? ''));

        if ($path === '') {
            return null;
        }

        return function_exists('tenant_asset') && tenant()
            ? tenant_asset($path)
            : Storage::disk('media_public')->url($path);
    }

    private function session(string $chatId): array
    {
        $session = Cache::get($this->sessionKey($chatId), []);

        return is_array($session) ? $session : [];
    }

    private function putSession(string $chatId, array $session): void
    {
        Cache::put($this->sessionKey($chatId), $session, now()->addHours(2));
    }

    private function clearFlow(string $chatId, bool $keepAuth = false): void
    {
        Cache::forget($this->sessionKey($chatId));

        if (! $keepAuth) {
            return;
        }
    }

    private function sessionKey(string $chatId): string
    {
        return sprintf('tenant:%s:%s-flow:%s', (string) tenant('id'), $this->channel, $chatId);
    }

    private function authKey(string $chatId): string
    {
        return sprintf('tenant:%s:%s-auth:%s', (string) tenant('id'), $this->channel, $chatId);
    }

    private function userChatKey(int $userId): string
    {
        if ($this->channel === 'telegram') {
            return sprintf('tenant:%s:telegram-user-chat:%s', (string) tenant('id'), $userId);
        }

        return sprintf('tenant:%s:%s-user-chat:%s', (string) tenant('id'), $this->channel, $userId);
    }

    private function displayName(array $message): string
    {
        $from = is_array($message['from'] ?? null) ? $message['from'] : [];
        $name = trim((string) ($from['first_name'] ?? '').' '.(string) ($from['last_name'] ?? ''));

        return $name !== '' ? $name : ($this->channel === 'bale' ? 'کاربر بله' : 'کاربر تلگرام');
    }

    private function dateLabel(string $date): string
    {
        if ($date === '') {
            return '—';
        }

        $carbon = Carbon::createFromFormat('Y-m-d', $date);
        $weekdays = [
            0 => 'یکشنبه',
            1 => 'دوشنبه',
            2 => 'سه‌شنبه',
            3 => 'چهارشنبه',
            4 => 'پنجشنبه',
            5 => 'جمعه',
            6 => 'شنبه',
        ];

        return ($weekdays[$carbon->dayOfWeek] ?? '').' '.JalaliDate::format($carbon);
    }

    private function dateIndex(string $date, array $dates, int $fallback): int
    {
        $index = $date !== '' ? array_search($date, $dates, true) : false;

        if ($index === false) {
            return max(0, min(count($dates) - 1, $fallback));
        }

        return (int) $index;
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

    private function homeReplyKeyboard(): array
    {
        $rows = [
            [
                ['text' => self::LABEL_BOOKING],
                ['text' => self::LABEL_HOME],
            ],
            [
                ['text' => self::LABEL_APPOINTMENTS],
                ['text' => self::LABEL_BACK],
            ],
        ];

        $infoRow = [];

        if ($this->contactPageEnabled()) {
            $infoRow[] = ['text' => self::LABEL_CONTACT];
        }

        if ($this->aboutPageEnabled()) {
            $infoRow[] = ['text' => self::LABEL_ABOUT];
        }

        if ($infoRow !== []) {
            $rows[] = $infoRow;
        }

        return [
            'keyboard' => $rows,
            'resize_keyboard' => true,
            'one_time_keyboard' => false,
        ];
    }

    private function otpReplyKeyboard(): array
    {
        return [
            'keyboard' => [
                [
                    ['text' => 'ارسال مجدد کد'],
                    ['text' => self::LABEL_HOME],
                ],
                [
                    ['text' => self::LABEL_BACK],
                ],
            ],
            'resize_keyboard' => true,
            'one_time_keyboard' => false,
        ];
    }

    private function nameReplyKeyboard(): array
    {
        return [
            'keyboard' => [
                [
                    ['text' => self::LABEL_HOME],
                ],
            ],
            'resize_keyboard' => true,
            'one_time_keyboard' => false,
        ];
    }

    private function otpInlineKeyboard(): array
    {
        return [
            'inline_keyboard' => [
                [
                    ['text' => 'ارسال مجدد کد', 'callback_data' => 'auth:resend'],
                ],
                [
                    ['text' => self::LABEL_BACK, 'callback_data' => 'auth:phone'],
                    ['text' => self::LABEL_HOME, 'callback_data' => 'main'],
                ],
            ],
        ];
    }

    private function mainInlineKeyboard(string $label = self::LABEL_HOME): array
    {
        return [
            'inline_keyboard' => [
                [
                    ['text' => $label, 'callback_data' => $label === 'دریافت نوبت جدید' || $label === 'تلاش دوباره' ? 'booking:start' : 'main'],
                ],
            ],
        ];
    }

    /**
     * @template T
     *
     * @param  array<int, T>  $items
     * @param  callable(T): array{text: string, callback_data: string}  $map
     * @return array<int, array<int, array{text: string, callback_data: string}>>
     */
    private function rows(array $items, callable $map, int $columns = 1): array
    {
        return collect($items)
            ->map($map)
            ->chunk($columns)
            ->map(fn ($chunk) => $chunk->values()->all())
            ->values()
            ->all();
    }
}
