@extends('admin.layouts.app')

@section('title', 'تنظیمات پیامک')

@section('content')
    @php
        $senders = old('senders', $smsSenderSettings['senders'] ?? []);
        if (empty($senders)) {
            $senders = [['number' => '', 'label' => '', 'is_default' => false]];
        }
        $defaultSender = old('default_sender', $smsSenderSettings['default_sender'] ?? '');
    @endphp

    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">تنظیمات پیامک</h5>
                    <p class="text-muted mb-0">تعرفه‌ها و شماره‌های فرستنده مرکزی را از این بخش مدیریت کنید.</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ route('admin.sms-settings.update') }}">
                        @csrf
                        @method('PUT')

                        <ul class="nav nav-tabs mb-4" id="sms-settings-tabs" role="tablist">
                            <li class="nav-item" role="presentation">
                                <button class="nav-link active" type="button" data-bs-toggle="tab" data-bs-target="#tab-gateway" role="tab">درگاه و تعرفه</button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" type="button" data-bs-toggle="tab" data-bs-target="#tab-credit-alerts" role="tab">هشدار شارژ</button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" type="button" data-bs-toggle="tab" data-bs-target="#tab-support-reminders" role="tab">یادآوری پکیج</button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" type="button" data-bs-toggle="tab" data-bs-target="#tab-domain-reminders" role="tab">یادآوری دامنه</button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" type="button" data-bs-toggle="tab" data-bs-target="#tab-nutrition-token-alerts" role="tab">هشدار توکن تغذیه</button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" type="button" data-bs-toggle="tab" data-bs-target="#tab-notifications" role="tab">ناتیفیکیشن‌ها</button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" type="button" data-bs-toggle="tab" data-bs-target="#tab-notification-sms" role="tab">پیامک‌های سیستمی</button>
                            </li>
                        </ul>

                        <div class="tab-content">
                            <div class="tab-pane fade show active" id="tab-gateway" role="tabpanel">
                                <div class="row g-4">
                                    <div class="col-12">
                                        <div class="border rounded-3 p-3">
                                            <h6 class="mb-1">اتصال کاوه‌نگار</h6>
                                            <p class="text-muted mb-3">کلید API مرکزی را اینجا ثبت کنید تا همه tenantها از همین حساب استفاده کنند.</p>
                                            <div class="row g-3">
                                                <div class="col-md-8">
                                                    <label class="form-label" for="kavenegar_api_key">API Key</label>
                                                    <input
                                                        type="text"
                                                        id="kavenegar_api_key"
                                                        name="kavenegar_api_key"
                                                        class="form-control"
                                                        dir="ltr"
                                                        value="{{ old('kavenegar_api_key', $smsGatewaySettings['kavenegar_api_key'] ?? '') }}"
                                                        placeholder="Kavenegar API Key"
                                                    >
                                                </div>
                                                <div class="col-md-4">
                                                    <label class="form-label d-block">ارسال سندباکس</label>
                                                    <div class="form-check form-switch mt-2">
                                                        <input
                                                            class="form-check-input"
                                                            type="checkbox"
                                                            role="switch"
                                                            id="sandbox_enabled"
                                                            name="sandbox_enabled"
                                                            value="1"
                                                            @checked(old('sandbox_enabled', $smsGatewaySettings['sandbox_enabled'] ?? false))
                                                        >
                                                        <label class="form-check-label" for="sandbox_enabled">
                                                            پیامک واقعی نرود
                                                        </label>
                                                    </div>
                                                    <div class="text-muted small mt-2">
                                                        در این حالت پیامک در دیتابیس ثبت می‌شود و شارژ کم می‌شود، ولی به کاوه‌نگار ارسال واقعی انجام نمی‌شود.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="col-12">
                                        <div class="border rounded-3 p-3">
                                            <h6 class="mb-1">تعرفه پیامک</h6>
                                            <p class="text-muted mb-3">هزینه هر پیامک فارسی و انگلیسی از اینجا تعیین می‌شود.</p>
                                            <div class="row g-3">
                                                <div class="col-md-6">
                                                    <label class="form-label" for="persian_price">هزینه هر پیامک فارسی</label>
                                                    <input type="number" min="0" id="persian_price" name="persian_price" class="form-control" value="{{ old('persian_price', $smsPricingSettings['persian_price'] ?? 0) }}">
                                                </div>
                                                <div class="col-md-6">
                                                    <label class="form-label" for="english_price">هزینه هر پیامک انگلیسی</label>
                                                    <input type="number" min="0" id="english_price" name="english_price" class="form-control" value="{{ old('english_price', $smsPricingSettings['english_price'] ?? 0) }}">
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="col-12">
                                        <div class="border rounded-3 p-3">
                                            <div class="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <h6 class="mb-1">شماره‌های فرستنده</h6>
                                                    <p class="text-muted mb-0">شماره‌های مجاز ارسال را تعریف کنید تا tenant فقط از بین همین‌ها انتخاب کند.</p>
                                                </div>
                                                <button type="button" class="btn btn-light-primary" id="add-sender-row">افزودن شماره</button>
                                            </div>

                                            <div id="sender-rows" class="d-flex flex-column gap-3">
                                                @foreach($senders as $index => $sender)
                                                    <div class="border rounded-3 p-3 sender-row">
                                                        <div class="row g-3 align-items-end">
                                                            <div class="col-md-4">
                                                                <label class="form-label">شماره فرستنده</label>
                                                                <input
                                                                    type="text"
                                                                    name="senders[{{ $index }}][number]"
                                                                    class="form-control"
                                                                    dir="ltr"
                                                                    value="{{ $sender['number'] ?? '' }}"
                                                                    placeholder="1000..."
                                                                >
                                                            </div>
                                                            <div class="col-md-5">
                                                                <label class="form-label">عنوان</label>
                                                                <input
                                                                    type="text"
                                                                    name="senders[{{ $index }}][label]"
                                                                    class="form-control"
                                                                    value="{{ $sender['label'] ?? '' }}"
                                                                    placeholder="مثلاً خط اصلی"
                                                                >
                                                            </div>
                                                            <div class="col-md-2">
                                                                <div class="form-check mt-4">
                                                                    <input
                                                                        class="form-check-input"
                                                                        type="radio"
                                                                        name="default_sender"
                                                                        value="{{ $sender['number'] ?? '' }}"
                                                                        @checked(($sender['number'] ?? '') !== '' && $defaultSender === ($sender['number'] ?? ''))
                                                                    >
                                                                    <label class="form-check-label">پیش‌فرض</label>
                                                                </div>
                                                            </div>
                                                            <div class="col-md-1">
                                                                <button type="button" class="btn btn-light-danger remove-sender-row w-100">حذف</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                @endforeach
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="tab-pane fade" id="tab-credit-alerts" role="tabpanel">
                                <div class="row g-4">
                                    <div class="col-12">
                                        <div class="border rounded-3 p-3">
                                            <h6 class="mb-1">متن هشدار کاهش شارژ</h6>
                                            <p class="text-muted mb-3">این متن‌ها برای مدیر tenant وقتی شارژ پیامک به محدوده‌های مهم می‌رسد ارسال می‌شوند. از متغیر <code>{{ '{' }}{{ 'balance' }}{{ '}' }}</code> برای مبلغ باقی‌مانده استفاده کنید.</p>
                                            <div class="row g-3">
                                                <div class="col-12">
                                                    <label class="form-label" for="credit_alert_threshold_50000">{{ __('admin.sms_settings.credit_alerts.threshold_50000') }}</label>
                                                    <textarea id="credit_alert_threshold_50000" name="credit_alert_templates[threshold_50000]" class="form-control" rows="5">{{ old('credit_alert_templates.threshold_50000', $smsGatewaySettings['credit_alert_templates']['threshold_50000'] ?? '') }}</textarea>
                                                </div>
                                                <div class="col-12">
                                                    <label class="form-label" for="credit_alert_threshold_10000">{{ __('admin.sms_settings.credit_alerts.threshold_10000') }}</label>
                                                    <textarea id="credit_alert_threshold_10000" name="credit_alert_templates[threshold_10000]" class="form-control" rows="5">{{ old('credit_alert_templates.threshold_10000', $smsGatewaySettings['credit_alert_templates']['threshold_10000'] ?? '') }}</textarea>
                                                </div>
                                                <div class="col-12">
                                                    <label class="form-label" for="credit_alert_threshold_zero">تمام شدن شارژ</label>
                                                    <textarea id="credit_alert_threshold_zero" name="credit_alert_templates[threshold_zero]" class="form-control" rows="5">{{ old('credit_alert_templates.threshold_zero', $smsGatewaySettings['credit_alert_templates']['threshold_zero'] ?? '') }}</textarea>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="tab-pane fade" id="tab-support-reminders" role="tabpanel">
                                <div class="row g-4">
                                    <div class="col-12">
                                        <div class="border rounded-3 p-3">
                                            <h6 class="mb-1">متن یادآوری پایان پکیج</h6>
                                            <p class="text-muted mb-3">این پیامک‌ها هر روز بعد از ساعت ۱۰ صبح بررسی می‌شوند و برای ۵ روز مانده، ۱ روز مانده و روز پایان پکیج فقط یک بار در همان روز ارسال خواهند شد.</p>
                                            <div class="row g-3">
                                                <div class="col-12">
                                                    <label class="form-label" for="support_reminder_day_5">۵ روز مانده</label>
                                                    <textarea id="support_reminder_day_5" name="support_reminder_templates[day_5]" class="form-control" rows="4">{{ old('support_reminder_templates.day_5', $smsGatewaySettings['support_reminder_templates']['day_5'] ?? '') }}</textarea>
                                                </div>
                                                <div class="col-12">
                                                    <label class="form-label" for="support_reminder_day_1">۱ روز مانده</label>
                                                    <textarea id="support_reminder_day_1" name="support_reminder_templates[day_1]" class="form-control" rows="4">{{ old('support_reminder_templates.day_1', $smsGatewaySettings['support_reminder_templates']['day_1'] ?? '') }}</textarea>
                                                </div>
                                                <div class="col-12">
                                                    <label class="form-label" for="support_reminder_day_0">روز پایان پکیج</label>
                                                    <textarea id="support_reminder_day_0" name="support_reminder_templates[day_0]" class="form-control" rows="4">{{ old('support_reminder_templates.day_0', $smsGatewaySettings['support_reminder_templates']['day_0'] ?? '') }}</textarea>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="tab-pane fade" id="tab-domain-reminders" role="tabpanel">
                                <div class="row g-4">
                                    <div class="col-12">
                                        <div class="border rounded-3 p-3">
                                            <h6 class="mb-1">متن یادآوری سررسید دامنه</h6>
                                            <p class="text-muted mb-3">این پیامک‌ها فقط برای سامانه‌هایی ارسال می‌شوند که دامنه توسط شما ثبت و مدیریت شده باشد. بررسی هر روز بعد از ساعت ۱۰ صبح انجام می‌شود و برای ۳۰ روز مانده، ۱۵ روز مانده و ۱ روز مانده فقط یک بار در همان روز می‌رود.</p>
                                            <div class="row g-3">
                                                <div class="col-12">
                                                    <label class="form-label" for="domain_reminder_day_30">۳۰ روز مانده</label>
                                                    <textarea id="domain_reminder_day_30" name="domain_reminder_templates[day_30]" class="form-control" rows="4">{{ old('domain_reminder_templates.day_30', $smsGatewaySettings['domain_reminder_templates']['day_30'] ?? '') }}</textarea>
                                                </div>
                                                <div class="col-12">
                                                    <label class="form-label" for="domain_reminder_day_15">۱۵ روز مانده</label>
                                                    <textarea id="domain_reminder_day_15" name="domain_reminder_templates[day_15]" class="form-control" rows="4">{{ old('domain_reminder_templates.day_15', $smsGatewaySettings['domain_reminder_templates']['day_15'] ?? '') }}</textarea>
                                                </div>
                                                <div class="col-12">
                                                    <label class="form-label" for="domain_reminder_day_1">۱ روز مانده</label>
                                                    <textarea id="domain_reminder_day_1" name="domain_reminder_templates[day_1]" class="form-control" rows="4">{{ old('domain_reminder_templates.day_1', $smsGatewaySettings['domain_reminder_templates']['day_1'] ?? '') }}</textarea>
                                                </div>
                                            </div>
                                            <div class="alert alert-light-info mt-3 mb-0">
                                                پارامترهای قابل استفاده:
                                                <code>{{ '{' }}{{ 'name' }}{{ '}' }}</code>
                                                <code>{{ '{' }}{{ 'business_name' }}{{ '}' }}</code>
                                                <code>{{ '{' }}{{ 'domain_name' }}{{ '}' }}</code>
                                                <code>{{ '{' }}{{ 'domain_tld' }}{{ '}' }}</code>
                                                <code>{{ '{' }}{{ 'domain_end_date' }}{{ '}' }}</code>
                                                <code>{{ '{' }}{{ 'days_remaining' }}{{ '}' }}</code>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="tab-pane fade" id="tab-nutrition-token-alerts" role="tabpanel">
                                <div class="row g-4">
                                    <div class="col-12">
                                        <div class="border rounded-3 p-3">
                                            <h6 class="mb-1">متن هشدار توکن هوش مصنوعی تغذیه</h6>
                                            <p class="text-muted mb-3">این پیامک‌ها فقط برای صنف‌های کارشناس تغذیه و پزشک تغذیه ارسال می‌شوند. هر هشدار تا وقتی موجودی دوباره به ۵۰۰۰ توکن یا بیشتر نرسد، فقط یک بار ارسال می‌شود.</p>
                                            <div class="row g-3">
                                                <div class="col-12">
                                                    <label class="form-label" for="nutrition_token_alert_low_5000">کمتر از ۵,۰۰۰ توکن</label>
                                                    <textarea id="nutrition_token_alert_low_5000" name="nutrition_token_alert_templates[low_5000]" class="form-control" rows="5">{{ old('nutrition_token_alert_templates.low_5000', $smsGatewaySettings['nutrition_token_alert_templates']['low_5000'] ?? '') }}</textarea>
                                                </div>
                                                <div class="col-12">
                                                    <label class="form-label" for="nutrition_token_alert_critical_500">بین ۰ تا ۵۰۰ توکن</label>
                                                    <textarea id="nutrition_token_alert_critical_500" name="nutrition_token_alert_templates[critical_500]" class="form-control" rows="5">{{ old('nutrition_token_alert_templates.critical_500', $smsGatewaySettings['nutrition_token_alert_templates']['critical_500'] ?? '') }}</textarea>
                                                </div>
                                            </div>
                                            <div class="alert alert-light-info mt-3 mb-0">
                                                پارامترهای قابل استفاده:
                                                <code>{{ '{' }}{{ 'name' }}{{ '}' }}</code>
                                                <code>{{ '{' }}{{ 'business_name' }}{{ '}' }}</code>
                                                <code>{{ '{' }}{{ 'token_balance' }}{{ '}' }}</code>
                                                <code>{{ '{' }}{{ 'top_up_url' }}{{ '}' }}</code>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="tab-pane fade" id="tab-notifications" role="tabpanel">
                                <div class="row g-4">
                                    @foreach(($smsGatewaySettings['notification_templates'] ?? []) as $key => $template)
                                        <div class="col-12">
                                            <div class="border rounded-3 p-3">
                                                <h6 class="mb-3">
                                                    @switch($key)
                                                        @case('support_ticket_reply') پاسخ تیکت @break
                                                        @case('sms_template_approved') تایید قالب پیامک @break
                                                        @case('sms_template_rejected') رد قالب پیامک @break
                                                        @case('sms_campaign_approved') تایید کمپین پیامکی @break
                                                        @case('sms_campaign_rejected') رد کمپین پیامکی @break
                                                        @default {{ $key }}
                                                    @endswitch
                                                </h6>
                                                <div class="row g-3">
                                                    <div class="col-md-4">
                                                        <label class="form-label">عنوان ناتیفیکیشن</label>
                                                        <input type="text" name="notification_templates[{{ $key }}][title]" class="form-control" value="{{ old("notification_templates.{$key}.title", $template['title'] ?? '') }}">
                                                    </div>
                                                    <div class="col-md-8">
                                                        <label class="form-label">متن ناتیفیکیشن</label>
                                                        <textarea name="notification_templates[{{ $key }}][message]" class="form-control" rows="3">{{ old("notification_templates.{$key}.message", $template['message'] ?? '') }}</textarea>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    @endforeach
                                </div>
                            </div>

                            <div class="tab-pane fade" id="tab-notification-sms" role="tabpanel">
                                <div class="row g-4">
                                    <div class="col-12">
                                        <div class="border rounded-3 p-3">
                                            <h6 class="mb-1">پیامک رد قالب پیامک</h6>
                                            <p class="text-muted mb-3">این پیامک بعد از رد شدن قالب پیامک برای مدیر اصلی سامانه ارسال می‌شود. هزینه آن از شارژ همان tenant کم می‌شود و اگر شارژ کافی نباشد، منفی می‌شود ولی پیامک ارسال خواهد شد.</p>
                                            <textarea name="notification_sms_templates[sms_template_rejected]" class="form-control" rows="4">{{ old('notification_sms_templates.sms_template_rejected', $smsGatewaySettings['notification_sms_templates']['sms_template_rejected'] ?? '') }}</textarea>
                                        </div>
                                    </div>
                                    <div class="col-12">
                                        <div class="border rounded-3 p-3">
                                            <h6 class="mb-1">پیامک رد کمپین پیامکی</h6>
                                            <p class="text-muted mb-3">این پیامک بعد از رد شدن کمپین پیامکی برای مدیر اصلی سامانه ارسال می‌شود. هزینه آن از شارژ همان tenant کم می‌شود و اگر شارژ کافی نباشد، منفی می‌شود ولی پیامک ارسال خواهد شد.</p>
                                            <textarea name="notification_sms_templates[sms_campaign_rejected]" class="form-control" rows="4">{{ old('notification_sms_templates.sms_campaign_rejected', $smsGatewaySettings['notification_sms_templates']['sms_campaign_rejected'] ?? '') }}</textarea>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="mt-4">
                            <button type="submit" class="btn btn-primary">ذخیره تنظیمات</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
    <script>
        (() => {
            const container = document.getElementById('sender-rows');
            const addButton = document.getElementById('add-sender-row');
            if (!container || !addButton) return;

            const updateRadioValues = () => {
                container.querySelectorAll('.sender-row').forEach((row) => {
                    const numberInput = row.querySelector('input[name$="[number]"]');
                    const radioInput = row.querySelector('input[type="radio"][name="default_sender"]');
                    if (numberInput && radioInput) {
                        radioInput.value = numberInput.value;
                        numberInput.addEventListener('input', () => {
                            radioInput.value = numberInput.value;
                        });
                    }
                });
            };

            addButton.addEventListener('click', () => {
                const index = container.querySelectorAll('.sender-row').length;
                const wrapper = document.createElement('div');
                wrapper.className = 'border rounded-3 p-3 sender-row';
                wrapper.innerHTML = `
                    <div class="row g-3 align-items-end">
                        <div class="col-md-4">
                            <label class="form-label">شماره فرستنده</label>
                            <input type="text" name="senders[${index}][number]" class="form-control" dir="ltr" placeholder="1000...">
                        </div>
                        <div class="col-md-5">
                            <label class="form-label">عنوان</label>
                            <input type="text" name="senders[${index}][label]" class="form-control" placeholder="مثلاً خط اصلی">
                        </div>
                        <div class="col-md-2">
                            <div class="form-check mt-4">
                                <input class="form-check-input" type="radio" name="default_sender" value="">
                                <label class="form-check-label">پیش‌فرض</label>
                            </div>
                        </div>
                        <div class="col-md-1">
                            <button type="button" class="btn btn-light-danger remove-sender-row w-100">حذف</button>
                        </div>
                    </div>
                `;
                container.appendChild(wrapper);
                updateRadioValues();
            });

            container.addEventListener('click', (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                if (!target.classList.contains('remove-sender-row')) return;
                target.closest('.sender-row')?.remove();
                updateRadioValues();
            });

            updateRadioValues();
        })();
    </script>
@endpush
