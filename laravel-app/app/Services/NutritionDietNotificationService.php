<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Domain\Tenant\Models\UserNotification;
use App\Services\Sms\SmsDispatchService;
use App\Support\SmsTemplateRegistry;

class NutritionDietNotificationService
{
    public function __construct(
        private readonly UserNotificationRealtimeService $notificationRealtime,
        private readonly SmsDispatchService $smsDispatch,
    ) {
    }

    public function notifyUserPrescriptionReady(NutritionDietRequest $request, NutritionDietPrescription $prescription, bool $afterManualApproval = false): void
    {
        $user = TenantUser::query()->find($request->user_id);

        if (! $user) {
            return;
        }

        $title = $afterManualApproval
            ? 'رژیم شما بعد از تایید کارشناس آماده مشاهده است'
            : 'رژیم شما تجویز و آماده استفاده است';
        $message = $afterManualApproval
            ? sprintf(
                'رژیم "%s" بعد از تایید کارشناس در پنل شما قرار گرفت و الان می‌توانید آن را مشاهده و استفاده کنید.',
                $request->diet_template_name ?: 'نسخه جدید'
            )
            : sprintf(
                'رژیم "%s" برای شما آماده شد و الان می‌توانید از بخش پروفایل آن را مشاهده و استفاده کنید.',
                $request->diet_template_name ?: 'نسخه جدید'
            );

        $this->insertNotification(
            $user,
            'nutrition_diet',
            $title,
            $message,
            [
                'source' => 'nutrition_ai',
                'status' => $afterManualApproval ? 'approved' : 'generated',
                'diet_request_id' => $request->id,
                'prescription_id' => $prescription->id,
            ],
        );

        $this->sendUserPrescriptionSms($user, $afterManualApproval ? 'afterAiApproval' : 'afterAiPrescription');
    }

    public function notifyUserExpertPrescriptionReady(NutritionDietRequest $request, NutritionDietPrescription $prescription): void
    {
        $user = TenantUser::query()->find($request->user_id);

        if (! $user) {
            return;
        }

        $this->insertNotification(
            $user,
            'nutrition_diet',
            'رژیم شما توسط کارشناس ارسال شد',
            sprintf(
                'رژیم اختصاصی شما%s در پروفایل تغذیه قرار گرفت و الان می‌توانید آن را مشاهده و استفاده کنید.',
                $request->diet_template_name ? ' با عنوان "' . $request->diet_template_name . '"' : ''
            ),
            [
                'source' => 'nutrition_expert',
                'status' => 'published',
                'diet_request_id' => $request->id,
                'prescription_id' => $prescription->id,
            ],
        );

        $this->sendUserPrescriptionSms($user, 'afterAiPrescription');
    }

    public function notifyAdminsPrescriptionGenerated(NutritionDietRequest $request, NutritionDietPrescription $prescription, bool $needsManualApproval = false): void
    {
        $admins = $this->admins();

        foreach ($admins as $admin) {
            $this->insertNotification(
                $admin,
                'nutrition_diet',
                $needsManualApproval ? 'رژیم کاربر منتظر تایید ارسال است' : 'رژیم کاربر توسط AI تجویز شد',
                $needsManualApproval
                    ? sprintf(
                        'رژیم "%s" برای %s توسط AI ساخته شد و قبل از ارسال به کاربر باید تایید مدیریتی بخورد.',
                        $request->diet_template_name ?: 'نسخه جدید',
                        $request->user?->name ?: 'کاربر'
                    )
                    : sprintf(
                        'رژیم "%s" برای %s با موفقیت توسط AI تجویز شد.',
                        $request->diet_template_name ?: 'نسخه جدید',
                        $request->user?->name ?: 'کاربر'
                    ),
                [
                    'source' => 'nutrition_ai',
                    'status' => $needsManualApproval ? 'waiting_for_approval' : 'generated',
                    'diet_request_id' => $request->id,
                    'prescription_id' => $prescription->id,
                    'user_id' => $request->user_id,
                ],
            );
        }
    }

    public function notifyAdminsPrescriptionFailed(NutritionDietRequest $request, string $error): void
    {
        $admins = $this->admins();

        foreach ($admins as $admin) {
            $this->insertNotification(
                $admin,
                'nutrition_diet',
                'تجویز رژیم با AI ناموفق بود',
                sprintf(
                    'تولید رژیم "%s" برای %s با خطا مواجه شد. علت: %s',
                    $request->diet_template_name ?: 'نسخه جدید',
                    $request->user?->name ?: 'کاربر',
                    $error
                ),
                [
                    'source' => 'nutrition_ai',
                    'status' => 'failed',
                    'diet_request_id' => $request->id,
                    'user_id' => $request->user_id,
                ],
            );
        }
    }

    /**
     * @return \Illuminate\Support\Collection<int, TenantUser>
     */
    private function admins()
    {
        return TenantUser::query()
            ->where('role', 'admin')
            ->where('is_active', true)
            ->orderBy('id')
            ->get(['id', 'name', 'mobile', 'role']);
    }

    /**
     * @param array<string, mixed> $meta
     */
    private function insertNotification(TenantUser $recipient, string $targetType, string $title, string $message, array $meta = []): void
    {
        UserNotification::query()->create([
            'tenant_user_id' => $recipient->id,
            'recipient_mobile' => $recipient->mobile,
            'recipient_name' => $recipient->name,
            'recipient_role' => $recipient->role,
            'title' => $title,
            'message' => $message,
            'sender_name' => 'سامانه',
            'target_type' => $targetType,
            'meta' => $meta,
            'is_read' => false,
        ]);

        $this->notificationRealtime->broadcastInboxUpdated([$recipient->id]);
    }

    private function sendUserPrescriptionSms(TenantUser $user, string $templateKey): void
    {
        if (trim((string) $user->mobile) === '') {
            return;
        }

        $smsSetting = SmsSetting::query()->first();

        if (! $smsSetting || ! (bool) $smsSetting->enabled || trim((string) $smsSetting->provider) === '') {
            return;
        }

        $templates = is_array($smsSetting->templates['nutrition_v2'] ?? null) ? $smsSetting->templates['nutrition_v2'] : [];
        $template = SmsTemplateRegistry::approvedNutritionTemplate($templates, $templateKey);
        $nutritionEnabled = (bool) ($smsSetting->templates['nutrition_enabled'] ?? false);

        if (! $nutritionEnabled || ! $template || ! (bool) ($template['enabled'] ?? false)) {
            return;
        }

        $message = strtr((string) ($template['body'] ?? ''), [
            '{{customer_name}}' => trim((string) ($user->name ?? 'کاربر')),
            '{{business_name}}' => $this->businessName(),
            '{{panel_url}}' => url('/nutrition'),
            '{{purchase_url}}' => url('/nutrition/packages'),
        ]);

        if (trim($message) === '') {
            return;
        }

        $this->smsDispatch->dispatchQueued($smsSetting, [
            'type' => 'nutrition_diet',
            'template_key' => $templateKey,
            'recipient_mobile' => (string) $user->mobile,
            'recipient_name' => (string) ($user->name ?? ''),
            'message' => $message,
        ]);
    }

    private function businessName(): string
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $appearance = is_array($rules['appearance'] ?? null) ? $rules['appearance'] : [];
        $storeName = trim((string) ($appearance['store_name'] ?? ''));

        return $storeName !== '' ? $storeName : (string) (tenant()?->name ?? 'مجموعه');
    }
}
