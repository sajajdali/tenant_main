<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Booking\Models\Barber;
use App\Domain\CustomerFeedback\Models\CustomerFeedbackInvitation;
use App\Domain\CustomerFeedback\Models\CustomerFeedbackQuestion;
use App\Domain\CustomerFeedback\Models\CustomerFeedbackResponse;
use App\Domain\Tenant\Models\FeatureModule;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantFeatureModule;
use App\Services\Sms\SmsDispatchService;
use App\Support\InputNormalizer;
use App\Support\JalaliDate;
use App\Support\CustomerFeedbackPublicLink;
use App\Support\SmsTemplateRegistry;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class CustomerFeedbackService
{
    public const MODULE_SLUG = 'customer-feedback';

    public function __construct(
        private readonly SmsDispatchService $dispatch,
    ) {
    }

    public function isModuleActive(?Tenant $tenant = null): bool
    {
        $tenant ??= tenant();

        if (! $tenant) {
            return false;
        }

        $moduleId = FeatureModule::query()
            ->where('slug', self::MODULE_SLUG)
            ->value('id');

        if (! $moduleId) {
            return false;
        }

        return TenantFeatureModule::query()
            ->where('tenant_id', $tenant->id)
            ->where('feature_module_id', $moduleId)
            ->where('status', 'active')
            ->where(function ($query): void {
                $query->whereNull('expires_at')
                    ->orWhereDate('expires_at', '>=', now()->toDateString());
            })
            ->exists();
    }

    public function settingsPayload(): array
    {
        $settings = $this->normalizedSettings();

        return [
            ...$settings,
            'moduleActive' => $this->isModuleActive(),
            'purchaseUrl' => '/panel/special-features',
            'smsSettingsUrl' => '/panel/sms-settings/feedback',
            'professionals' => Barber::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Barber $barber): array => [
                    'id' => (string) $barber->id,
                    'name' => $barber->name,
                ])
                ->values()
                ->all(),
            'questions' => $this->questionsPayload(),
        ];
    }

    public function updateSettings(array $validated): array
    {
        $settings = $this->normalizedSettings();
        $professionalIds = collect($validated['professionalIds'] ?? $settings['professionalIds'])
            ->map(fn ($id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();

        $next = [
            'enabled' => (bool) ($validated['enabled'] ?? $settings['enabled']),
            'emoji_labels' => [
                'excellent' => trim((string) Arr::get($validated, 'emojiLabels.excellent', Arr::get($settings, 'emojiLabels.excellent', 'عالی'))),
                'good' => trim((string) Arr::get($validated, 'emojiLabels.good', Arr::get($settings, 'emojiLabels.good', 'خوب'))),
                'average' => trim((string) Arr::get($validated, 'emojiLabels.average', Arr::get($settings, 'emojiLabels.average', 'متوسط'))),
                'bad' => trim((string) Arr::get($validated, 'emojiLabels.bad', Arr::get($settings, 'emojiLabels.bad', 'بد'))),
            ],
            'audience_scope' => (string) ($validated['audienceScope'] ?? $settings['audienceScope']),
            'professional_ids' => $professionalIds,
            'first_send_delay_minutes' => max(1, (int) ($validated['firstSendDelayDays'] ?? $settings['firstSendDelayDays'])) * 1440,
            'trigger_after_completed_count' => max(1, (int) ($validated['triggerAfterCompletedCount'] ?? $settings['triggerAfterCompletedCount'])),
            'max_send_attempts' => 1,
            'max_responses_per_customer' => max(1, (int) ($validated['maxResponsesPerCustomer'] ?? $settings['maxResponsesPerCustomer'])),
            'survey_title' => trim((string) ($validated['surveyTitle'] ?? $settings['surveyTitle'])),
            'intro_text' => trim((string) ($validated['introText'] ?? $settings['introText'])),
            'success_text' => trim((string) ($validated['successText'] ?? $settings['successText'])),
        ];

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $rules['customer_feedback'] = $next;
        $general->update(['booking_rules' => $rules]);

        return $this->settingsPayload();
    }

    public function syncInvitationForAppointment(Appointment $appointment): void
    {
        if (! $this->isModuleActive() || $appointment->status !== 'completed') {
            $this->cancelInvitationForAppointment($appointment);
            return;
        }

        $settings = $this->normalizedSettings();

        if (! $settings['enabled'] || ! $this->appointmentMatchesScope($appointment, $settings)) {
            return;
        }

        $mobile = InputNormalizer::mobile((string) $appointment->customer_phone_snapshot);

        if (! is_string($mobile) || preg_match('/^09\d{9}$/', $mobile) !== 1) {
            return;
        }

        if ($this->customerReachedResponseLimit($mobile, $settings)) {
            return;
        }

        $completedCount = $this->eligibleCompletedAppointmentsCount($appointment, $settings);

        if ($completedCount < 1 || $completedCount % max(1, (int) $settings['triggerAfterCompletedCount']) !== 0) {
            return;
        }

        $completedAt = $appointment->completed_at ?? now();

        CustomerFeedbackInvitation::query()->updateOrCreate(
            ['appointment_id' => $appointment->id],
            [
                'customer_id' => $appointment->customer_id,
                'professional_id' => $appointment->professional_id,
                'token' => CustomerFeedbackInvitation::query()->where('appointment_id', $appointment->id)->value('token') ?: Str::random(40),
                'status' => 'pending',
                'customer_name' => $appointment->customer_name_snapshot,
                'customer_mobile' => $mobile,
                'next_send_at' => $completedAt->copy()->addDays((int) $settings['firstSendDelayDays']),
                'meta' => [
                    'trigger_after_completed_count' => (int) $settings['triggerAfterCompletedCount'],
                    'max_send_attempts' => 1,
                ],
            ],
        );
    }

    public function processDueInvitations(): int
    {
        if (! $this->isModuleActive()) {
            return 0;
        }

        $settings = $this->normalizedSettings();

        if (! $settings['enabled']) {
            return 0;
        }

        $smsSetting = SmsSetting::query()->first();
        $templates = is_array($smsSetting?->templates['v2'] ?? null) ? $smsSetting->templates['v2'] : [];
        $template = SmsTemplateRegistry::approvedTemplate($templates, 'customerFeedback');

        if (! $smsSetting || ! $template || ! (bool) ($template['enabled'] ?? false)) {
            return 0;
        }

        $count = 0;

        CustomerFeedbackInvitation::query()
            ->with(['appointment.barber:id,name', 'appointment.service:id,name'])
            ->where('status', 'pending')
            ->whereNotNull('next_send_at')
            ->where('next_send_at', '<=', now())
            ->orderBy('next_send_at')
            ->chunkById(100, function ($items) use (&$count, $smsSetting, $template, $settings): void {
                foreach ($items as $invitation) {
                    $appointment = $invitation->appointment;

                    if (! $appointment || $appointment->status !== 'completed') {
                        $invitation->update([
                            'status' => 'cancelled',
                            'next_send_at' => null,
                        ]);
                        continue;
                    }

                    $message = $this->renderTemplate((string) ($template['body'] ?? ''), $invitation, $appointment);

                    if (trim($message) === '') {
                        continue;
                    }

                    $this->dispatch->dispatchQueued($smsSetting, [
                        'type' => 'customer_feedback',
                        'template_key' => 'customerFeedback',
                        'recipient_mobile' => (string) $invitation->customer_mobile,
                        'recipient_name' => (string) $invitation->customer_name,
                        'message' => $message,
                    ]);

                    $attempts = (int) $invitation->send_attempts + 1;
                    $invitation->update([
                        'status' => 'sent',
                        'send_attempts' => $attempts,
                        'first_sent_at' => $invitation->first_sent_at ?? now(),
                        'last_sent_at' => now(),
                        'next_send_at' => null,
                    ]);

                    $count++;
                }
            });

        return $count;
    }

    public function publicPayload(string $token): ?array
    {
        $invitation = $this->invitationByPublicIdentifier($token);

        if (! $invitation || ! $invitation->appointment) {
            return null;
        }

        $settings = $this->normalizedSettings();
        $appointment = $invitation->appointment;

        return [
            'token' => $invitation->token,
            'status' => $invitation->response ? 'responded' : $invitation->status,
            'businessName' => $this->businessName(),
            'customerName' => $invitation->customer_name ?: $appointment->customer_name_snapshot,
            'professionalName' => $appointment->professional_name_snapshot ?: $appointment->barber?->name,
            'serviceName' => $appointment->service_name_snapshot ?: $appointment->service?->name,
            'appointmentDate' => JalaliDate::format($appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date')),
            'appointmentTime' => substr((string) $appointment->start_time, 0, 5),
            'surveyTitle' => $settings['surveyTitle'],
            'introText' => $settings['introText'],
            'successText' => $settings['successText'],
            'emojiLabels' => $settings['emojiLabels'],
            'questions' => $this->activeQuestions()->map(fn (CustomerFeedbackQuestion $question): array => [
                'id' => (string) $question->id,
                'title' => $question->title,
                'displayType' => $question->display_type ?: 'emoji',
            ])->values()->all(),
            'submittedAt' => $invitation->responded_at?->toISOString(),
        ];
    }

    public function submitPublicResponse(string $token, array $answers): array
    {
        $invitation = $this->invitationByPublicIdentifier($token, ['appointment', 'response']);

        if (! $invitation || ! $invitation->appointment) {
            return [
                'success' => false,
                'message' => 'لینک نظرسنجی معتبر نیست.',
                'data' => [],
            ];
        }

        if ($invitation->response || $invitation->responded_at) {
            return [
                'success' => false,
                'message' => 'شما قبلا در این نظر سنجی شرکت کرده اید.',
                'data' => $this->publicPayload($token) ?? [],
            ];
        }

        if ($invitation->appointment->status !== 'completed') {
            return [
                'success' => false,
                'message' => 'این نوبت هنوز شرایط ثبت نظر سنجی را ندارد.',
                'data' => [],
            ];
        }

        $questions = $this->activeQuestions()->keyBy(fn (CustomerFeedbackQuestion $question): string => (string) $question->id);
        $normalizedAnswers = collect($answers)
            ->map(function (array $answer) use ($questions): array {
                $questionId = (string) ($answer['questionId'] ?? '');
                /** @var CustomerFeedbackQuestion|null $question */
                $question = $questions->get($questionId);

                if (! $question) {
                    throw new HttpResponseException(response()->json([
                        'success' => false,
                        'message' => 'یکی از سوالات نظرسنجی معتبر نیست.',
                    ], 422));
                }

                $displayType = $question->display_type ?: 'emoji';
                $value = (int) ($answer['value'] ?? 0);
                $choiceKey = isset($answer['choiceKey']) ? trim((string) $answer['choiceKey']) : null;

                if ($displayType === 'star' && ($value < 1 || $value > 5)) {
                    throw new HttpResponseException(response()->json([
                        'success' => false,
                        'message' => 'امتیاز ستاره‌ای یکی از سوالات معتبر نیست.',
                    ], 422));
                }

                if ($displayType === 'emoji' && ! in_array($choiceKey, ['excellent', 'good', 'average', 'bad'], true)) {
                    throw new HttpResponseException(response()->json([
                        'success' => false,
                        'message' => 'گزینه انتخابی یکی از سوالات معتبر نیست.',
                    ], 422));
                }

                $optionLabel = $displayType === 'star'
                    ? sprintf('%d ستاره', $value)
                    : (string) ($this->normalizedSettings()['emojiLabels'][$choiceKey] ?? '');

                return [
                    'questionId' => (int) $question->id,
                    'questionTitle' => $question->title,
                    'displayType' => $displayType,
                    'choiceKey' => $displayType === 'emoji' ? $choiceKey : null,
                    'value' => $displayType === 'star' ? $value : $this->emojiValueForKey((string) $choiceKey),
                    'label' => $optionLabel,
                ];
            })
            ->keyBy(fn (array $answer): string => (string) $answer['questionId']);

        if ($normalizedAnswers->count() !== $questions->count()) {
            return [
                'success' => false,
                'message' => 'همه سوالات نظرسنجی باید پاسخ داده شوند.',
                'data' => [],
            ];
        }

        $firstAnswer = $normalizedAnswers->values()->first();

        CustomerFeedbackResponse::query()->create([
            'invitation_id' => $invitation->id,
            'appointment_id' => $invitation->appointment_id,
            'rating_type' => (string) ($firstAnswer['displayType'] ?? 'emoji'),
            'rating_value' => isset($firstAnswer['value']) ? (int) $firstAnswer['value'] : null,
            'emoji_key' => $firstAnswer['displayType'] === 'emoji' ? (string) ($firstAnswer['choiceKey'] ?? '') : null,
            'comment' => null,
            'answers' => $normalizedAnswers->values()->all(),
        ]);

        $invitation->update([
            'status' => 'responded',
            'responded_at' => now(),
            'next_send_at' => null,
        ]);

        return [
            'success' => true,
            'message' => 'نظر شما با موفقیت ثبت شد.',
            'data' => $this->publicPayload($token) ?? [],
        ];
    }

    public function reportPayload(): array
    {
        $settings = $this->normalizedSettings();
        $responses = CustomerFeedbackResponse::query()
            ->with(['invitation.appointment.barber:id,name', 'invitation.appointment.service:id,name'])
            ->latest()
            ->get();

        $questionStats = $this->activeQuestions()->map(function (CustomerFeedbackQuestion $question) use ($responses, $settings): array {
            $questionId = (int) $question->id;
            $displayType = $question->display_type ?: 'emoji';
            $options = $displayType === 'star'
                ? collect(range(5, 1))->map(fn (int $value): array => [
                    'key' => (string) $value,
                    'label' => sprintf('%d ستاره', $value),
                    'value' => $value,
                ])
                : collect($this->emojiOptions($settings))->map(fn (array $option): array => [
                    'key' => $option['key'],
                    'label' => $option['label'],
                    'value' => $option['value'],
                ]);

            $answerRows = $responses
                ->flatMap(fn (CustomerFeedbackResponse $response) => collect($response->answers ?? []))
                ->filter(fn (array $answer): bool => (int) ($answer['questionId'] ?? 0) === $questionId)
                ->values();

            $totalAnswers = $answerRows->count();

            return [
                'questionId' => (string) $question->id,
                'title' => $question->title,
                'displayType' => $displayType,
                'totalAnswers' => $totalAnswers,
                'options' => $options->map(function (array $option) use ($answerRows, $displayType, $totalAnswers): array {
                    $count = $answerRows->filter(function (array $answer) use ($option, $displayType): bool {
                        if ($displayType === 'star') {
                            return (int) ($answer['value'] ?? 0) === (int) $option['value'];
                        }

                        return (string) ($answer['choiceKey'] ?? '') === (string) $option['key'];
                    })->count();

                    return [
                        'key' => (string) $option['key'],
                        'label' => (string) $option['label'],
                        'count' => $count,
                        'percent' => $totalAnswers > 0 ? (int) round(($count / $totalAnswers) * 100) : 0,
                    ];
                })->values()->all(),
            ];
        })->values()->all();

        $participants = $responses->map(function (CustomerFeedbackResponse $response): array {
            $invitation = $response->invitation;
            $appointment = $invitation?->appointment;

            return [
                'responseId' => (string) $response->id,
                'customerName' => (string) ($invitation?->customer_name ?: $appointment?->customer_name_snapshot ?: 'مشتری'),
                'customerMobile' => (string) ($invitation?->customer_mobile ?: ''),
                'professionalName' => (string) ($appointment?->professional_name_snapshot ?: $appointment?->barber?->name ?: ''),
                'serviceName' => (string) ($appointment?->service_name_snapshot ?: $appointment?->service?->name ?: ''),
                'appointmentDate' => $appointment ? JalaliDate::format($appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date')) : null,
                'respondedAt' => $invitation?->responded_at?->toISOString(),
            ];
        })->values()->all();

        $sentCount = CustomerFeedbackInvitation::query()->whereNotNull('first_sent_at')->count();
        $respondedCount = CustomerFeedbackInvitation::query()->whereNotNull('responded_at')->count();
        $pendingCount = CustomerFeedbackInvitation::query()->whereIn('status', ['pending', 'sent'])->count();

        return [
            'summary' => [
                'sentCount' => $sentCount,
                'respondedCount' => $respondedCount,
                'pendingCount' => $pendingCount,
                'responseRate' => $sentCount > 0 ? (int) round(($respondedCount / $sentCount) * 100) : 0,
            ],
            'questions' => $questionStats,
            'participants' => $participants,
        ];
    }

    public function reportResponsePayload(CustomerFeedbackResponse $response): array
    {
        $response->loadMissing(['invitation.appointment.barber:id,name', 'invitation.appointment.service:id,name']);

        $invitation = $response->invitation;
        $appointment = $invitation?->appointment;

        return [
            'responseId' => (string) $response->id,
            'customerName' => (string) ($invitation?->customer_name ?: $appointment?->customer_name_snapshot ?: 'مشتری'),
            'customerMobile' => (string) ($invitation?->customer_mobile ?: ''),
            'professionalName' => (string) ($appointment?->professional_name_snapshot ?: $appointment?->barber?->name ?: ''),
            'serviceName' => (string) ($appointment?->service_name_snapshot ?: $appointment?->service?->name ?: ''),
            'appointmentDate' => $appointment ? JalaliDate::format($appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date')) : null,
            'appointmentTime' => $appointment ? substr((string) $appointment->start_time, 0, 5) : null,
            'respondedAt' => $invitation?->responded_at?->toISOString(),
            'answers' => collect($response->answers ?? [])->map(fn (array $answer): array => [
                'questionTitle' => (string) ($answer['questionTitle'] ?? ''),
                'displayType' => (string) ($answer['displayType'] ?? 'emoji'),
                'label' => (string) ($answer['label'] ?? ''),
                'value' => (int) ($answer['value'] ?? 0),
            ])->values()->all(),
        ];
    }

    private function cancelInvitationForAppointment(Appointment $appointment): void
    {
        CustomerFeedbackInvitation::query()
            ->where('appointment_id', $appointment->id)
            ->whereNull('responded_at')
            ->update([
                'status' => 'cancelled',
                'next_send_at' => null,
            ]);
    }

    private function eligibleCompletedAppointmentsCount(Appointment $appointment, array $settings): int
    {
        $mobile = InputNormalizer::mobile((string) $appointment->customer_phone_snapshot);

        if (! is_string($mobile)) {
            return 0;
        }

        return Appointment::query()
            ->where('status', 'completed')
            ->where('customer_phone_snapshot', $mobile)
            ->when(
                $settings['audienceScope'] === 'professional' && count($settings['professionalIds']) > 0,
                fn ($query) => $query->whereIn('professional_id', $settings['professionalIds']),
            )
            ->where(function ($query) use ($appointment): void {
                $query->where('completed_at', '<', $appointment->completed_at)
                    ->orWhere(function ($nested) use ($appointment): void {
                        $nested->where('completed_at', $appointment->completed_at)
                            ->where('id', '<=', $appointment->id);
                    });
            })
            ->count();
    }

    private function appointmentMatchesScope(Appointment $appointment, array $settings): bool
    {
        if ($settings['audienceScope'] !== 'professional') {
            return true;
        }

        if (count($settings['professionalIds']) === 0) {
            return false;
        }

        return in_array((int) $appointment->professional_id, $settings['professionalIds'], true);
    }

    private function customerReachedResponseLimit(string $mobile, array $settings): bool
    {
        $limit = max(1, (int) ($settings['maxResponsesPerCustomer'] ?? 1));

        $responsesCount = CustomerFeedbackInvitation::query()
            ->where('customer_mobile', $mobile)
            ->whereNotNull('responded_at')
            ->count();

        return $responsesCount >= $limit;
    }

    private function normalizedSettings(): array
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $stored = is_array($rules['customer_feedback'] ?? null) ? $rules['customer_feedback'] : [];

        return [
            'enabled' => (bool) ($stored['enabled'] ?? false),
            'emojiLabels' => [
                'excellent' => trim((string) ($stored['emoji_labels']['excellent'] ?? 'عالی')),
                'good' => trim((string) ($stored['emoji_labels']['good'] ?? 'خوب')),
                'average' => trim((string) ($stored['emoji_labels']['average'] ?? 'متوسط')),
                'bad' => trim((string) ($stored['emoji_labels']['bad'] ?? 'بد')),
            ],
            'audienceScope' => ($stored['audience_scope'] ?? 'all') === 'professional' ? 'professional' : 'all',
            'professionalIds' => collect($stored['professional_ids'] ?? [])->map(fn ($id): int => (int) $id)->filter()->values()->all(),
            'firstSendDelayDays' => max(1, (int) ceil(((int) ($stored['first_send_delay_minutes'] ?? 1440)) / 1440)),
            'triggerAfterCompletedCount' => max(1, (int) ($stored['trigger_after_completed_count'] ?? 1)),
            'maxResponsesPerCustomer' => max(1, (int) ($stored['max_responses_per_customer'] ?? 1)),
            'surveyTitle' => trim((string) ($stored['survey_title'] ?? 'نظر شما برای ما مهم است')),
            'introText' => trim((string) ($stored['intro_text'] ?? 'از اینکه در نظرسنجی رضایت مشتری شرکت می‌کنید ممنونیم.')),
            'successText' => trim((string) ($stored['success_text'] ?? 'ممنون از وقتی که برای ثبت نظر گذاشتید.')),
        ];
    }

    private function renderTemplate(string $body, CustomerFeedbackInvitation $invitation, Appointment $appointment): string
    {
        return strtr($body, [
            '{{customer_name}}' => (string) ($invitation->customer_name ?: $appointment->customer_name_snapshot),
            '{{business_name}}' => $this->businessName(),
            '{{feedback_url}}' => CustomerFeedbackPublicLink::publicUrl($appointment),
            '{{appointment_date}}' => JalaliDate::format($appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date')),
            '{{appointment_time}}' => substr((string) $appointment->start_time, 0, 5),
            '{{professional_name}}' => (string) ($appointment->professional_name_snapshot ?: $appointment->barber?->name),
            '{{service_name}}' => (string) ($appointment->service_name_snapshot ?: $appointment->service?->name),
        ]);
    }

    private function businessName(): string
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $appearance = is_array($rules['appearance'] ?? null) ? $rules['appearance'] : [];
        $storeName = trim((string) ($appearance['store_name'] ?? ''));

        return $storeName !== '' ? $storeName : (string) (tenant()?->name ?? 'مجموعه');
    }

    private function questionsPayload(): array
    {
        return CustomerFeedbackQuestion::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (CustomerFeedbackQuestion $question): array => [
                'id' => (string) $question->id,
                'title' => $question->title,
                'displayType' => $question->display_type ?: 'emoji',
                'sortOrder' => (int) $question->sort_order,
                'isActive' => (bool) $question->is_active,
            ])
            ->values()
            ->all();
    }

    private function activeQuestions(): Collection
    {
        return CustomerFeedbackQuestion::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
    }

    private function emojiOptions(array $settings): array
    {
        return [
            ['key' => 'excellent', 'label' => (string) ($settings['emojiLabels']['excellent'] ?? 'عالی'), 'value' => 4],
            ['key' => 'good', 'label' => (string) ($settings['emojiLabels']['good'] ?? 'خوب'), 'value' => 3],
            ['key' => 'average', 'label' => (string) ($settings['emojiLabels']['average'] ?? 'متوسط'), 'value' => 2],
            ['key' => 'bad', 'label' => (string) ($settings['emojiLabels']['bad'] ?? 'بد'), 'value' => 1],
        ];
    }

    private function emojiValueForKey(string $key): int
    {
        return match ($key) {
            'excellent' => 4,
            'good' => 3,
            'average' => 2,
            default => 1,
        };
    }

    private function invitationByPublicIdentifier(string $identifier, array $with = ['appointment.barber:id,name', 'appointment.service:id,name', 'response']): ?CustomerFeedbackInvitation
    {
        return CustomerFeedbackInvitation::query()
            ->with($with)
            ->where('token', $identifier)
            ->orWhereHas('appointment', function ($query) use ($identifier): void {
                $query->where('public_code', $identifier);
            })
            ->first();
    }
}
