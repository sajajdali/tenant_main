<?php

declare(strict_types=1);

namespace App\Support;

class SmsTemplateRegistry
{
    /**
     * @return array<string, array{title:string, default_enabled:bool, default_body:string}>
     */
    public static function definitions(): array
    {
        return [
            'adminBooking' => [
                'title' => 'ثبت نوبت توسط مدیر',
                'default_enabled' => true,
                'default_body' => "سلام {{customer_name}} عزیز،\nنوبت شما برای {{service_name}} در {{appointment_date}} ساعت {{appointment_time}} ثبت شد.\nجزئیات: {{appointment_url}}\nلغو ۱۱",
            ],
            'userBooking' => [
                'title' => 'ثبت نوبت توسط کاربر',
                'default_enabled' => true,
                'default_body' => "سلام {{customer_name}} عزیز\nنوبت شما در {{business_name}} برای {{appointment_date}} ساعت {{appointment_time}} با موفقیت ثبت شد.\nجزئیات: {{appointment_url}}\nلغو۱۱",
            ],
            'cancellation' => [
                'title' => 'لغو نوبت',
                'default_enabled' => true,
                'default_body' => "سلام {{customer_name}}\nنوبت شما در {{appointment_date}} ساعت {{appointment_time}} لغو شد.\nدر صورت نیاز به هماهنگی با {{business_phone}} تماس بگیرید.\nلغو۱۱",
            ],
            'appointmentChange' => [
                'title' => 'تغییر ساعت یا روز نوبت',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nنوبت شما به روز {{appointment_date}} ساعت {{appointment_time}} تغییر پیدا کرد\nبا تشکر از شما\nجزئیات نوبت : {{appointment_url}}\nلغو۱۱",
            ],
            'reminder' => [
                'title' => 'یادآوری نوبت — ۲۴ ساعت قبل',
                'default_enabled' => true,
                'default_body' => "سلام {{customer_name}} عزیز،\nنوبت شما برای فردا {{appointment_date}} ساعت {{appointment_time}} ثبت شده است.\nفراموش نکنی.\nجزئیات: {{appointment_url}}\nلغو۱۱",
            ],
            'reminderThreeHours' => [
                'title' => 'یادآوری نوبت — ۳ ساعت قبل',
                'default_enabled' => true,
                'default_body' => "سلام {{customer_name}} عزیز،\nحدود ۳ ساعت تا نوبت شما برای {{service_name}} در تاریخ {{appointment_date}} ساعت {{appointment_time}} باقی مانده است.\nجزئیات: {{appointment_url}}\nلغو۱۱",
            ],
            'loginOtp' => [
                'title' => 'ورود به سیستم',
                'default_enabled' => true,
                'default_body' => "به سامانه {{business_name}} خوش آمدید\nکد ورود شما {{code}}\n{{web_otp}}",
            ],
            'customerFeedback' => [
                'title' => 'نظرسنجی و رضایت مشتری',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nممنون میشم با شرکت در نظر سنجی به بهبود عملکرد ما کمک کنید\n{{feedback_url}}\nبا تشکر {{business_name}}\nلغو۱۱",
            ],
            'appointmentReopened' => [
                'title' => 'اطلاع رسانی از باز شدن نوبت ها',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nنوبت‌دهی {{business_name}} دوباره فعال شد.\nبرای رزرو نوبت از لینک زیر وارد شوید:\n{{booking_url}}\nلغو۱۱",
            ],
        ];
    }

    /**
     * @return array<string, array{title:string, default_enabled:bool, default_body:string}>
     */
    public static function nutritionDefinitions(): array
    {
        return [
            'afterAiPrescription' => [
                'title' => 'پس از تجویز رژیم',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nرژیم شما تجویز و آماده استفاده است.\nلطفا به پروفایل خود مراجعه کنید.\n{{panel_url}}\n{{business_name}}\nلغو11",
            ],
            'afterAiApproval' => [
                'title' => 'پس از تایید و ارسال رژیم تجویز شده',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nرژیم شما بعد از تایید کارشناس در پنل شما قرار خواهد گرفت..\nپس از تایید یک پیامک به شما ارسال میشود\n{{business_name}}\nلغو11",
            ],
            'expertAfterDietRequest' => [
                'title' => 'پیامک به کارشناس پس از درخواست رژیم',
                'default_enabled' => false,
                'default_body' => "کارشناس گرامی\n{{customer_name}} درخواست رژیم {{diet_title}} ثبت کرده است و نیاز به تایید دستی دارد.\nبرای بررسی وارد پنل شوید:\n{{panel_url}}\n{{business_name}}\nلغو۱۱",
            ],
            'dietEndingTomorrow' => [
                'title' => '۱ روز مانده به اتمام رژیم',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nفردا رژیم شما تمام می‌شود.\nلطفاً فردا وزن جدیدتان را ثبت کنید تا رژیم جدید برای شما تجویز شود.\n{{business_name}}\nلغو۱۱",
            ],
            'dietEndsToday' => [
                'title' => 'روز اتمام رژیم',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nامروز آخرین روز رژیم شماست.\nلطفاً وزن جدیدتان را ثبت کنید تا برنامه بعدی برای شما آماده شود.\n{{business_name}}\nلغو۱۱",
            ],
            'mealLogInactiveThreeDaysFirst' => [
                'title' => 'اولین پیامک ۳ روز ثبت نشدن غذای کاربر رژیم',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\n۳ روز هست که هیچ غذایی ثبت نکردی.\nرژیمت رو کامل رعایت می‌کنی؟\nاگه مشکلی داری حتما با ما در ارتباط باش.\n{{business_name}}\nلغو۱۱",
            ],
            'mealLogInactiveThreeDaysSecond' => [
                'title' => 'دومین پیامک ۳ روز ثبت نشدن غذای کاربر رژیم',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nچند روزه غذایی ثبت نکردی و هنوز رژیمت فعاله.\nاگه رعایت رژیم برات سخت شده یا سوالی داری، حتما با ما در ارتباط باش.\n{{business_name}}\nلغو۱۱",
            ],
            'dietExpiredNoRequestDay1' => [
                'title' => 'یک روز از اتمام رژیم گذشته و درخواست جدید ثبت نشده',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nاز پایان رژیم شما یک روز گذشته و هنوز درخواست رژیم جدید ثبت نشده است.\nبرای ادامه مسیر، لطفاً وزن جدیدتان را ثبت کنید.\n{{business_name}}\nلغو۱۱",
            ],
            'packageFinished' => [
                'title' => 'اتمام پکیج کاربر',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nپکیج شما به پایان رسیده است.\nبرای ادامه دریافت رژیم و پشتیبانی، پکیج جدید تهیه کنید.\n{{purchase_url}}\nلغو۱۱",
            ],
            'packageFinishedWeek1' => [
                'title' => 'یک هفته از اتمام پکیج گذشته و خریدی انجام نشده',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nیک هفته از پایان پکیج شما گذشته است.\nاگر هنوز قصد ادامه دارید، از این لینک پکیج جدید تهیه کنید:\n{{purchase_url}}\nلغو۱۱",
            ],
            'packageFinishedDay15' => [
                'title' => 'پانزده روز از اتمام پکیج گذشته و خریدی انجام نشده',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\n۱۵ روز از پایان پکیج شما گذشته است.\nبرای بازگشت به برنامه و شروع دوباره، پکیج جدیدتان را از این لینک تهیه کنید:\n{{purchase_url}}\nلغو۱۱",
            ],
            'afterPackagePurchase' => [
                'title' => 'پس از خرید پکیج',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nخرید پکیج شما با موفقیت انجام شد.\nاز همراهی شما ممنونیم و به‌زودی مراحل بعدی داخل پنل برای شما فعال می‌شود.\n{{business_name}}\nلغو۱۱",
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $templates
     * @return array<string, array<string, mixed>>
     */
    public static function normalizeCollection(array $templates): array
    {
        return static::normalizeCollectionFromDefinitions($templates, static::definitions());
    }

    /**
     * @param  array<string, mixed>  $templates
     * @return array<string, array<string, mixed>>
     */
    public static function normalizeNutritionCollection(array $templates): array
    {
        return static::normalizeCollectionFromDefinitions($templates, static::nutritionDefinitions());
    }

    /**
     * @param  array<string, mixed>  $incoming
     * @param  array<string, mixed>  $existing
     * @return array<string, array<string, mixed>>
     */
    public static function buildForPersistence(array $incoming, array $existing): array
    {
        return static::buildForPersistenceFromDefinitions($incoming, $existing, static::definitions(), false);
    }

    /**
     * @param  array<string, mixed>  $incoming
     * @param  array<string, mixed>  $existing
     * @return array<string, array<string, mixed>>
     */
    public static function buildNutritionForPersistence(array $incoming, array $existing): array
    {
        return static::buildForPersistenceFromDefinitions($incoming, $existing, static::nutritionDefinitions(), true);
    }

    /**
     * @param  array<string, mixed>  $templates
     * @return array<string, mixed>|null
     */
    public static function approvedTemplate(array $templates, string $key): ?array
    {
        $template = static::normalizeCollection($templates)[$key] ?? null;

        if (! $template && array_key_exists($key, static::nutritionDefinitions())) {
            return static::approvedNutritionTemplate($templates, $key);
        }

        if (! $template) {
            return null;
        }

        $approvedBody = trim((string) ($template['approved_body'] ?? ''));
        $approvedEnabled = (bool) ($template['approved_enabled'] ?? false);

        if ($approvedBody === '' || ! $approvedEnabled) {
            return null;
        }

        return [
            ...$template,
            'body' => $approvedBody,
            'enabled' => $approvedEnabled,
        ];
    }

    /**
     * @param  array<string, mixed>  $templates
     * @return array<string, mixed>|null
     */
    public static function approvedNutritionTemplate(array $templates, string $key): ?array
    {
        $template = static::normalizeNutritionCollection($templates)[$key] ?? null;

        if (! $template) {
            return null;
        }

        $approvedBody = trim((string) ($template['approved_body'] ?? ''));
        $approvedEnabled = (bool) ($template['approved_enabled'] ?? false);

        if ($approvedBody === '' || ! $approvedEnabled) {
            return null;
        }

        return [
            ...$template,
            'body' => $approvedBody,
            'enabled' => $approvedEnabled,
        ];
    }

    /**
     * @param  array<string, mixed>  $template
     * @return array<string, mixed>
     */
    public static function normalizeTemplate(string $key, array $template): array
    {
        $definition = static::definitions()[$key] ?? static::nutritionDefinitions()[$key] ?? [
            'title' => $key,
            'default_enabled' => false,
            'default_body' => '',
        ];

        $body = trim((string) ($template['body'] ?? $definition['default_body']));
        $enabled = (bool) ($template['enabled'] ?? $definition['default_enabled']);
        $hasApprovalMetadata = array_key_exists('approval_status', $template)
            || array_key_exists('approved_body', $template)
            || array_key_exists('approved_enabled', $template)
            || array_key_exists('submitted_at', $template)
            || array_key_exists('reviewed_at', $template);
        $isPristineDefaultTemplate = $body !== ''
            && $body === (string) $definition['default_body']
            && ! $hasApprovalMetadata;
        $approvalStatus = (string) ($template['approval_status'] ?? ($isPristineDefaultTemplate
            ? 'approved'
            : ($body !== '' ? 'pending_review' : 'draft')));
        $approvedBody = trim((string) ($template['approved_body'] ?? ($isPristineDefaultTemplate ? $body : '')));
        $approvedEnabled = (bool) ($template['approved_enabled'] ?? ($isPristineDefaultTemplate ? $enabled : false));

        return [
            'key' => $key,
            'title' => (string) $definition['title'],
            'enabled' => $enabled,
            'body' => $body,
            'approval_status' => in_array($approvalStatus, ['draft', 'pending_review', 'approved', 'rejected'], true) ? $approvalStatus : 'draft',
            'approved_body' => $approvedBody,
            'approved_enabled' => $approvedEnabled,
            'rejection_reason' => trim((string) ($template['rejection_reason'] ?? '')) ?: null,
            'submitted_at' => $template['submitted_at'] ?? ($isPristineDefaultTemplate ? now()->toISOString() : null),
            'reviewed_at' => $template['reviewed_at'] ?? ($isPristineDefaultTemplate ? now()->toISOString() : null),
        ];
    }

    /**
     * @param  array<string, mixed>  $templates
     * @param  array<string, array{title:string, default_enabled:bool, default_body:string}>  $definitions
     * @return array<string, array<string, mixed>>
     */
    private static function normalizeCollectionFromDefinitions(array $templates, array $definitions): array
    {
        $normalized = [];

        foreach ($definitions as $key => $definition) {
            $normalized[$key] = static::normalizeTemplate($key, is_array($templates[$key] ?? null) ? $templates[$key] : []);
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $incoming
     * @param  array<string, mixed>  $existing
     * @param  array<string, array{title:string, default_enabled:bool, default_body:string}>  $definitions
     * @return array<string, array<string, mixed>>
     */
    private static function buildForPersistenceFromDefinitions(array $incoming, array $existing, array $definitions, bool $approveChanges): array
    {
        $existing = static::normalizeCollectionFromDefinitions($existing, $definitions);
        $result = [];

        foreach ($definitions as $key => $definition) {
            $current = $existing[$key];
            $nextEnabled = (bool) data_get($incoming, "{$key}.enabled", $current['enabled']);
            $nextBody = trim((string) data_get($incoming, "{$key}.body", $current['body']));
            $hasChanged = $nextEnabled !== (bool) $current['enabled'] || $nextBody !== (string) $current['body'];

            if (! $hasChanged) {
                $result[$key] = $current;

                continue;
            }

            $result[$key] = [
                ...$current,
                'enabled' => $nextEnabled,
                'body' => $nextBody,
                'approval_status' => $nextBody === '' ? 'draft' : ($approveChanges ? 'approved' : 'pending_review'),
                'approved_body' => $nextBody === '' ? '' : ($approveChanges ? $nextBody : (string) ($current['approved_body'] ?? '')),
                'approved_enabled' => $nextBody !== '' && $approveChanges ? $nextEnabled : (bool) ($approveChanges ? false : ($current['approved_enabled'] ?? false)),
                'rejection_reason' => null,
                'submitted_at' => $nextBody === '' ? null : now()->toISOString(),
                'reviewed_at' => $nextBody === '' ? null : ($approveChanges ? now()->toISOString() : null),
            ];
        }

        return $result;
    }
}
