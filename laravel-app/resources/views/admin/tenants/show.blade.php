@extends('admin.layouts.app')

@section('title', $tenant->name)

@section('content')
    @php
        $irDomain = \App\Support\TenantIrDomain::summary($tenant);
        $formatStorageBytes = function (?int $bytes): string {
            $bytes = max(0, (int) ($bytes ?? 0));
            $gb = $bytes / 1024 / 1024 / 1024;

            if ($gb >= 1) {
                return number_format($gb, $gb >= 10 ? 0 : 1) . ' گیگ';
            }

            $mb = $bytes / 1024 / 1024;

            if ($mb >= 1) {
                return number_format($mb, $mb >= 10 ? 0 : 1) . ' مگ';
            }

            $kb = $bytes / 1024;

            if ($kb >= 1) {
                return number_format($kb, $kb >= 10 ? 0 : 1) . ' کیلوبایت';
            }

            return number_format($bytes) . ' بایت';
        };
        $storageUsedBytes = (int) ($storageUsage['usedBytes'] ?? 0);
        $storageTotalBytes = (int) ($storageUsage['totalQuotaBytes'] ?? 0);
        $storageRemainingBytes = (int) ($storageUsage['remainingBytes'] ?? 0);
        $storagePercent = $storageTotalBytes > 0 ? min(100, max(0, ($storageUsedBytes / $storageTotalBytes) * 100)) : 0;
        $storageProgressClass = ($storageUsage['isFull'] ?? false) || $storagePercent >= 95
            ? 'bg-danger'
            : ($storagePercent >= 75 ? 'bg-warning' : 'bg-success');
    @endphp
    <div class="row g-4">
        <div class="col-12">
            <div class="card">
                <div class="card-body d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-4">
                    <div>
                        <h4 class="mb-2">{{ $tenant->name }}</h4>
                        <div class="text-muted d-flex flex-wrap gap-3">
                            <span>طیف کاری: {{ $tenant->audienceType?->name ?? 'تعریف نشده' }}</span>
                            <span>بسته: {{ $tenant->subscriptionPackage?->name ?? 'تعریف نشده' }}</span>
                            <span>ظرفیت فعلی: {{ $tenant->subscriptionPackage?->user_limit === null ? 'نامحدود' : number_format($tenant->subscriptionPackage?->user_limit) }}</span>
                            <span>پایان پشتیبانی: {{ $tenant->support_ends_at ? \App\Support\JalaliDate::format($tenant->support_ends_at) : '—' }}</span>
                            <span>{{ $irDomain['label'] ?? 'دامنه' }}: {{ $irDomain['statusLabel'] }}</span>
                        </div>
                    </div>
                    <div class="d-flex flex-wrap gap-2">
                        @if ($impersonationUrl)
                            <a href="{{ $impersonationUrl }}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-lg">ورود با این کاربر</a>
                        @endif
                        <a href="{{ route('admin.tenants.edit', $tenant) }}" class="btn btn-light-primary">ویرایش</a>
                        <a href="{{ route('admin.tenants.index') }}" class="btn btn-light-secondary">بازگشت</a>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card border {{ $paymentGatewayReport['central_maliart_enabled'] ? 'border-success' : '' }}">
                <div class="card-body d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                    <div>
                        <div class="text-muted mb-2">درگاه پرداخت فعال مشتریان</div>
                        @if ($paymentGatewayReport['central_maliart_enabled'])
                            <h5 class="text-success mb-1">این سایت به درگاه مستقیم مرکزی متصل است.</h5>
                            <div class="text-muted">پرداخت نوبت، رژیم و فروشگاه فقط از درگاه مستقیم مرکزی انجام می‌شود و تنظیمات درگاه خود سامانه نادیده گرفته می‌شود.</div>
                        @else
                            <h5 class="mb-1">{{ $paymentGatewayReport['effective_gateway_label'] }}</h5>
                            <div class="text-muted">
                                @if ($paymentGatewayReport['payment_enabled'] && $paymentGatewayReport['enabled_gateway_labels'] !== [])
                                    پرداخت‌ها از درگاه‌های تنظیم‌شده همین سامانه انجام می‌شود.
                                @else
                                    درگاه پرداخت آنلاین قابل استفاده‌ای برای این سامانه فعال نیست.
                                @endif
                            </div>
                        @endif
                    </div>
                    <span class="badge {{ $paymentGatewayReport['central_maliart_enabled'] ? 'bg-light-success text-success' : ($paymentGatewayReport['payment_enabled'] ? 'bg-light-primary text-primary' : 'bg-light-secondary text-muted') }} fs-6">
                        {{ $paymentGatewayReport['central_maliart_enabled'] ? 'درگاه مستقیم مرکزی' : ($paymentGatewayReport['payment_enabled'] ? 'درگاه اختصاصی سامانه' : 'غیرفعال') }}
                    </span>
                </div>
            </div>
        </div>

        <div class="col-md-6 col-xl-3">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">کاربران سامانه</div><h3 class="mb-0">{{ number_format($metrics['customers_count']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">اپراتورهای سامانه</div><h3 class="mb-0">{{ number_format($metrics['operators_count']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">کل نوبت‌های دریافت‌شده</div><h3 class="mb-0">{{ number_format($metrics['appointments_total']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">نوبت‌های این ماه</div><h3 class="mb-0">{{ number_format($metrics['appointments_month']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">نوبت‌های امروز</div><h3 class="mb-0">{{ number_format($metrics['appointments_today']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">نوبت‌های دیروز</div><h3 class="mb-0">{{ number_format($metrics['appointments_yesterday']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">تیکت‌های ارسالی کاربر</div><h3 class="mb-0">{{ number_format($metrics['support_tickets_count']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">جمع مبالغ ثبت‌شده</div><h3 class="mb-0">{{ number_format($metrics['amount_total']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">کل سفارشات فروشگاه</div><h3 class="mb-0">{{ number_format($metrics['store_orders_total']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">سفارشات باز فروشگاه</div><h3 class="mb-0">{{ number_format($metrics['store_orders_open']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">سفارشات پرداخت‌شده</div><h3 class="mb-0">{{ number_format($metrics['store_orders_paid']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">جمع فروش فروشگاه</div><h3 class="mb-0">{{ number_format($metrics['store_sales_total']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-4">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">کل نظرات محصولات</div><h3 class="mb-0">{{ number_format($metrics['store_reviews_total']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-4">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">نظرات تاییدشده</div><h3 class="mb-0">{{ number_format($metrics['store_reviews_approved']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-4">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">نظرات در انتظار تایید</div><h3 class="mb-0">{{ number_format($metrics['store_reviews_pending']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-6">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">کل اعلان‌های کاربران</div><h3 class="mb-0">{{ number_format($metrics['notifications_total']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-6">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">اعلان‌های خوانده‌نشده</div><h3 class="mb-0">{{ number_format($metrics['notifications_unread']) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-6">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">تعداد پرداخت‌های پشتیبانی</div><h3 class="mb-0">{{ number_format((int) ($supportPaymentsStats->total_count ?? 0)) }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-6">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">مجموع پرداخت موفق پشتیبانی</div><h3 class="mb-0">{{ number_format((int) ($supportPaymentsStats->paid_total ?? 0)) }}</h3></div></div>
        </div>
        <div class="col-12">
            <div class="card border">
                <div class="card-header d-flex flex-column flex-lg-row justify-content-between gap-2">
                    <div>
                        <h5 class="mb-1">فضای ذخیره‌سازی</h5>
                        <p class="text-muted mb-0">میزان فضای مصرف‌شده و باقی‌مانده این tenant.</p>
                    </div>
                    <span class="badge {{ ($storageUsage['isFull'] ?? false) ? 'bg-light-danger text-danger' : 'bg-light-success text-success' }} align-self-lg-center">
                        {{ ($storageUsage['isFull'] ?? false) ? 'فضا پر شده' : 'فضا در دسترس است' }}
                    </span>
                </div>
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-6 col-xl-3">
                            <div class="border rounded-3 p-3 h-100">
                                <div class="text-muted mb-2">مصرف‌شده</div>
                                <h4 class="mb-0">{{ $formatStorageBytes($storageUsedBytes) }}</h4>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <div class="border rounded-3 p-3 h-100">
                                <div class="text-muted mb-2">باقی‌مانده</div>
                                <h4 class="mb-0">{{ $formatStorageBytes($storageRemainingBytes) }}</h4>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <div class="border rounded-3 p-3 h-100">
                                <div class="text-muted mb-2">کل سهمیه</div>
                                <h4 class="mb-0">{{ $formatStorageBytes($storageTotalBytes) }}</h4>
                                <div class="small text-muted mt-1">
                                    پایه: {{ number_format((int) ($storageUsage['baseQuotaGb'] ?? 0)) }} گیگ
                                    @if ((int) ($storageUsage['extraQuotaGb'] ?? 0) > 0)
                                        + اضافه: {{ number_format((int) ($storageUsage['extraQuotaGb'] ?? 0)) }} گیگ
                                    @endif
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <div class="border rounded-3 p-3 h-100">
                                <div class="d-flex justify-content-between mb-2">
                                    <span class="text-muted">درصد مصرف</span>
                                    <strong>{{ number_format($storagePercent, 0) }}٪</strong>
                                </div>
                                <div class="progress" style="height: 10px;">
                                    <div class="progress-bar {{ $storageProgressClass }}" role="progressbar" style="width: {{ number_format($storagePercent, 2, '.', '') }}%;" aria-valuenow="{{ number_format($storagePercent, 0) }}" aria-valuemin="0" aria-valuemax="100"></div>
                                </div>
                                <div class="small text-muted mt-2">
                                    {{ $formatStorageBytes($storageUsedBytes) }} از {{ $formatStorageBytes($storageTotalBytes) }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-xl-4">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">وضعیت {{ $irDomain['label'] ?? 'دامنه' }}</div><h3 class="mb-0">{{ $irDomain['statusLabel'] }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-4">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">سررسید {{ $irDomain['tld'] ?? 'دامنه' }}</div><h3 class="mb-0">{{ $irDomain['renewsAt'] ? \App\Support\JalaliDate::format($irDomain['renewsAt']) : 'ثبت نشده' }}</h3></div></div>
        </div>
        <div class="col-md-6 col-xl-4">
            <div class="card h-100"><div class="card-body"><div class="text-muted mb-2">{{ __('admin.tenants.ir_domain_annual_renewal_amount') }}</div><h3 class="mb-0">{{ $irDomain['amount'] !== null ? __('admin.money.iran_toman', ['amount' => number_format((int) $irDomain['amount'])]) : __('admin.common.not_available') }}</h3></div></div>
        </div>

        @if ($nutritionTokenSummary)
            <div class="col-12">
                <div class="card border border-success-subtle">
                    <div class="card-header d-flex flex-column flex-lg-row justify-content-between gap-2">
                        <div>
                            <h5 class="mb-1">اعتبار توکن تغذیه</h5>
                            <p class="text-muted mb-0">افزایش و کاهش دستی اعتبار این سایت، همراه با تاریخچه ثبت‌شده.</p>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="row g-3 mb-4">
                            <div class="col-md-4">
                                <div class="border rounded-3 p-3 h-100">
                                    <div class="text-muted mb-2">موجودی فعال</div>
                                    <h3 class="mb-0 text-success">{{ number_format((int) $nutritionTokenSummary['balanceTokens']) }}</h3>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="border rounded-3 p-3 h-100">
                                    <div class="text-muted mb-2">کل افزایش اعتبار</div>
                                    <h3 class="mb-0">{{ number_format((int) $nutritionTokenSummary['purchasedTokens']) }}</h3>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="border rounded-3 p-3 h-100">
                                    <div class="text-muted mb-2">کل مصرف/کاهش</div>
                                    <h3 class="mb-0">{{ number_format((int) $nutritionTokenSummary['usedTokens']) }}</h3>
                                </div>
                            </div>
                        </div>

                        <form action="{{ route('admin.tenants.nutrition-tokens.adjust', $tenant) }}" method="POST" class="row g-3 align-items-end mb-4">
                            @csrf
                            <div class="col-md-3">
                                <label class="form-label">نوع تغییر</label>
                                <select class="form-select" name="direction" required>
                                    <option value="credit" @selected(old('direction', 'credit') === 'credit')>افزایش اعتبار</option>
                                    <option value="debit" @selected(old('direction') === 'debit')>کاهش اعتبار</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">مقدار توکن</label>
                                <input type="number" min="1" max="100000000" class="form-control" name="amount" value="{{ old('amount') }}" required dir="ltr">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">دلیل</label>
                                <input type="text" class="form-control" name="reason" value="{{ old('reason') }}" maxlength="1000" required placeholder="مثلاً شارژ دستی یا اصلاح اعتبار">
                            </div>
                            <div class="col-md-2 d-grid">
                                <button type="submit" class="btn btn-success">ثبت تغییر</button>
                            </div>
                        </form>

                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>نوع</th>
                                        <th>مقدار</th>
                                        <th>موجودی بعد</th>
                                        <th>شرح</th>
                                        <th>ثبت‌کننده</th>
                                        <th>زمان</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($nutritionTokenSummary['recentLedgers'] as $ledger)
                                        @php
                                            $meta = $ledger['meta'] ?? [];
                                            $isCredit = ($ledger['direction'] ?? '') === 'credit';
                                        @endphp
                                        <tr>
                                            <td>
                                                <span class="badge {{ $isCredit ? 'bg-light-success text-success' : 'bg-light-danger text-danger' }}">
                                                    {{ $isCredit ? 'افزایش' : 'کاهش/مصرف' }}
                                                </span>
                                            </td>
                                            <td>{{ number_format((int) $ledger['tokens_amount']) }}</td>
                                            <td>{{ number_format((int) $ledger['balance_after']) }}</td>
                                            <td>
                                                {{ $ledger['reason_title'] }}
                                                @if (! empty($meta['reason']))
                                                    <div class="small text-muted">{{ $meta['reason'] }}</div>
                                                @endif
                                            </td>
                                            <td>{{ $meta['central_actor_name'] ?? 'سیستم/کاربر سامانه' }}</td>
                                            <td>{{ ! empty($ledger['occurred_at']) ? \App\Support\JalaliDate::format($ledger['occurred_at']) : '—' }}</td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="6" class="text-center text-muted py-4">هنوز تراکنشی برای توکن تغذیه ثبت نشده است.</td>
                                        </tr>
                                    @endforelse
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        @endif

        <div class="col-12 col-xl-6">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-1">مدیریت ماژول‌های ویژه</h5>
                    <p class="text-muted mb-0">فعال‌سازی نصب اولیه را انجام می‌دهد؛ غیرفعال‌سازی فقط دسترسی را می‌بندد و داده را حذف نمی‌کند.</p>
                </div>
                <div class="card-body">
                    @if ($availableFeatureModules->isEmpty())
                        <div class="text-center text-muted py-3">ماژول ویژه‌ای تعریف نشده است.</div>
                    @else
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>ماژول</th>
                                        <th>وضعیت</th>
                                        <th>فعال‌سازی</th>
                                        <th>نصب</th>
                                        <th class="text-end">عملیات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($availableFeatureModules as $featureModule)
                                        @php
                                            $module = $tenantModules->firstWhere('feature_module_id', $featureModule->id);
                                            $isActive = $module?->status === 'active';
                                            $metadata = $module?->metadata ?? [];
                                            $installError = $metadata['last_install_error']['message'] ?? null;
                                        @endphp
                                        <tr>
                                            <td>
                                                <div class="fw-semibold">{{ $featureModule->name }}</div>
                                                <div class="small text-muted" dir="ltr">{{ $featureModule->slug }}</div>
                                            </td>
                                            <td>
                                                <span class="badge {{ $isActive ? 'bg-light-success text-success' : 'bg-light-secondary text-secondary' }}">
                                                    {{ $isActive ? 'فعال' : 'غیرفعال' }}
                                                </span>
                                            </td>
                                            <td>{{ $module?->activated_at ? \App\Support\JalaliDate::format($module->activated_at) : '—' }}</td>
                                            <td>
                                                @if (($metadata['installed'] ?? false) === true)
                                                    <span class="badge bg-light-success text-success">نصب شده</span>
                                                @elseif ($installError)
                                                    <span class="badge bg-light-danger text-danger" title="{{ $installError }}">خطای نصب</span>
                                                @else
                                                    <span class="badge bg-light-secondary text-secondary">نصب نشده</span>
                                                @endif
                                            </td>
                                            <td class="text-end">
                                                @if ($isActive && $module)
                                                    <button
                                                        type="button"
                                                        class="btn btn-sm btn-light-danger"
                                                        data-bs-toggle="modal"
                                                        data-bs-target="#removeFeatureModuleModal"
                                                        data-action="{{ route('admin.tenants.feature-modules.remove', [$tenant, $module]) }}"
                                                        data-module-name="{{ $featureModule->name }}"
                                                    >
                                                        غیرفعال‌سازی
                                                    </button>
                                                @else
                                                    <form method="POST" action="{{ route('admin.tenants.feature-modules.activate', [$tenant, $featureModule]) }}" class="d-inline">
                                                        @csrf
                                                        <button type="submit" class="btn btn-sm btn-light-success">فعال‌سازی</button>
                                                    </form>
                                                @endif
                                            </td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @endif
                </div>
            </div>
        </div>

        <div class="col-12 col-xl-6">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-1">سابقه تغییر ماژول‌ها</h5>
                    <p class="text-muted mb-0">آخرین فعال‌سازی‌ها و غیرفعال‌سازی‌های دستی ماژول‌ها.</p>
                </div>
                <div class="card-body">
                    @if (! $historyLoggingAvailable)
                        <div class="alert alert-warning mb-0">برای ثبت این تاریخچه باید migration لاگ مدیریتی اجرا شده باشد.</div>
                    @elseif ($moduleRemovalHistory->isEmpty())
                        <div class="text-center text-muted py-3">تغییر دستی ماژولی برای این سامانه ثبت نشده است.</div>
                    @else
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>ماژول</th>
                                        <th>عملیات</th>
                                        <th>دلیل</th>
                                        <th>انجام‌دهنده</th>
                                        <th>زمان</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($moduleRemovalHistory as $log)
                                        <tr>
                                            <td>{{ $log->meta_json['feature_module_name'] ?? '—' }}</td>
                                            <td>
                                                <span class="badge {{ $log->action_type === 'tenant_feature_module_activated' ? 'bg-light-success text-success' : 'bg-light-danger text-danger' }}">
                                                    {{ $log->action_type === 'tenant_feature_module_activated' ? 'فعال‌سازی' : 'غیرفعال‌سازی' }}
                                                </span>
                                            </td>
                                            <td>{{ $log->reason }}</td>
                                            <td>{{ $log->actor?->name ?? 'کاربر نامشخص' }}</td>
                                            <td>{{ $log->occurred_at ? \App\Support\JalaliDate::format($log->occurred_at) : '—' }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @endif
                </div>
            </div>
        </div>

        <div class="col-12 col-xl-6">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-1">آخرین سفارشات فروشگاه</h5>
                    <p class="text-muted mb-0">۱۰ سفارش آخر ثبت‌شده.</p>
                </div>
                <div class="card-body">
                    @if (empty($metrics['latest_store_orders']))
                        <div class="text-center text-muted py-3">سفارشی ثبت نشده است.</div>
                    @else
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>شماره سفارش</th>
                                        <th>مشتری</th>
                                        <th>وضعیت</th>
                                        <th>پرداخت</th>
                                        <th>مبلغ</th>
                                        <th>زمان</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($metrics['latest_store_orders'] as $order)
                                        <tr>
                                            <td>{{ $order['order_number'] }}</td>
                                            <td>{{ $order['customer_name'] }}<div class="small text-muted">{{ $order['customer_phone'] }}</div></td>
                                            <td>{{ $order['status'] }}</td>
                                            <td>{{ $order['payment_method'] }}</td>
                                            <td>{{ number_format((int) $order['total_amount']) }}</td>
                                            <td>{{ $order['created_at'] ? \App\Support\JalaliDate::format($order['created_at']) : '—' }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @endif
                </div>
            </div>
        </div>

        <div class="col-12 col-xl-6">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-1">آخرین نظرات محصولات</h5>
                    <p class="text-muted mb-0">۱۰ نظر آخر کاربران.</p>
                </div>
                <div class="card-body">
                    @if (empty($metrics['latest_store_reviews']))
                        <div class="text-center text-muted py-3">نظری ثبت نشده است.</div>
                    @else
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>محصول</th>
                                        <th>کاربر</th>
                                        <th>امتیاز</th>
                                        <th>وضعیت</th>
                                        <th>زمان</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($metrics['latest_store_reviews'] as $review)
                                        <tr>
                                            <td>{{ $review['product_title'] }}</td>
                                            <td>{{ $review['reviewer_name'] }}</td>
                                            <td>{{ number_format((int) $review['rating']) }}/5</td>
                                            <td>
                                                <span class="badge {{ $review['is_approved'] ? 'bg-light-success text-success' : 'bg-light-warning text-warning' }}">
                                                    {{ $review['is_approved'] ? 'تایید شده' : 'در انتظار تایید' }}
                                                </span>
                                            </td>
                                            <td>{{ $review['created_at'] ? \App\Support\JalaliDate::format($review['created_at']) : '—' }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @endif
                </div>
            </div>
        </div>

        <div class="col-12 col-xl-6">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-1">تاریخچه پرداخت و پلن</h5>
                    <p class="text-muted mb-0">آخرین ۲۰ پرداخت پشتیبانی/ماژول برای این tenant.</p>
                </div>
                <div class="card-body">
                    @if ($paymentHistory->isEmpty())
                        <div class="text-center text-muted py-3">پرداختی ثبت نشده است.</div>
                    @else
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>فاکتور</th>
                                        <th>نوع</th>
                                        <th>پلن</th>
                                        <th>وضعیت</th>
                                        <th>مبلغ</th>
                                        <th>مرجع</th>
                                        <th>زمان</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($paymentHistory as $payment)
                                        <tr>
                                            <td>{{ $payment->invoice_number }}</td>
                                            <td>{{ $payment->payment_type }}</td>
                                            <td>{{ $payment->subscriptionPackage?->name ?? '—' }}</td>
                                            <td>{{ $payment->status }}</td>
                                            <td>{{ number_format((int) $payment->payable_amount) }}</td>
                                            <td>{{ $payment->reference_id ?? '—' }}</td>
                                            <td>{{ \App\Support\JalaliDate::format($payment->created_at) }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @endif
                </div>
            </div>
        </div>

        <div class="col-12 col-xl-6">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-1">ارسال پیام به کاربران</h5>
                    <p class="text-muted mb-0">از این بخش می‌توانید پیام همگانی یا پیام اختصاصی برای یک کاربر ارسال کنید.</p>
                </div>
                <div class="card-body">
                    <form action="{{ route('admin.tenants.notifications.send', $tenant) }}" method="POST" class="row g-3">
                        @csrf
                        <div class="col-md-6">
                            <label class="form-label">نوع گیرنده</label>
                            <select class="form-select" name="target_type" id="target_type" required>
                                <option value="all" @selected(old('target_type') === 'all')>همه کاربران فعال</option>
                                <option value="single" @selected(old('target_type') === 'single')>یک کاربر مشخص</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">فیلتر نقش (فقط حالت همگانی)</label>
                            <select class="form-select" name="recipient_role">
                                <option value="all" @selected(old('recipient_role', 'all') === 'all')>همه نقش‌ها</option>
                                <option value="customer" @selected(old('recipient_role') === 'customer')>کاربران سایت</option>
                                <option value="barber" @selected(old('recipient_role') === 'barber')>اپراتورها</option>
                                <option value="admin" @selected(old('recipient_role') === 'admin')>مدیران</option>
                            </select>
                        </div>
                        <div class="col-12" id="target_mobile_wrap" style="display: none;">
                            <label class="form-label">شماره موبایل گیرنده</label>
                            <input type="text" class="form-control" name="target_mobile" value="{{ old('target_mobile') }}" placeholder="مثال: 09123456789">
                        </div>
                        <div class="col-12">
                            <label class="form-label">عنوان پیام</label>
                            <input type="text" class="form-control" name="title" value="{{ old('title') }}" maxlength="180" required>
                        </div>
                        <div class="col-12">
                            <label class="form-label">متن پیام</label>
                            <textarea class="form-control" rows="5" name="message" maxlength="5000" required>{{ old('message') }}</textarea>
                        </div>
                        <div class="col-12 d-flex justify-content-end">
                            <button type="submit" class="btn btn-primary">ارسال پیام</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div class="col-12 col-xl-6">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-1">آخرین اعلان‌های ارسال‌شده</h5>
                    <p class="text-muted mb-0">۱۰ اعلان اخیر این سامانه و وضعیت خوانده شدن.</p>
                </div>
                <div class="card-body">
                    @if (empty($metrics['latest_notifications']))
                        <div class="text-center text-muted py-3">اعلانی ثبت نشده است.</div>
                    @else
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>عنوان</th>
                                        <th>گیرنده</th>
                                        <th>نقش</th>
                                        <th>وضعیت</th>
                                        <th>زمان</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($metrics['latest_notifications'] as $notification)
                                        <tr>
                                            <td>{{ $notification['title'] }}</td>
                                            <td>{{ $notification['recipient_name'] }}<div class="small text-muted">{{ $notification['recipient_mobile'] }}</div></td>
                                            <td>{{ $notification['recipient_role'] }}</td>
                                            <td>
                                                <span class="badge {{ $notification['is_read'] ? 'bg-light-success text-success' : 'bg-light-warning text-warning' }}">
                                                    {{ $notification['is_read'] ? 'خوانده شده' : 'خوانده نشده' }}
                                                </span>
                                            </td>
                                            <td>{{ $notification['created_at'] ? \App\Support\JalaliDate::format($notification['created_at']) : '—' }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @endif
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">سابقه تمدید</h5>
                    <p class="text-muted mb-0">همه تمدیدهای ثبت‌شده برای این سامانه.</p>
                </div>
                <div class="card-body">
                    @if ($tenant->subscriptionRenewals->isEmpty())
                        <div class="text-center text-muted py-4">هنوز تمدیدی برای این سامانه ثبت نشده است.</div>
                    @else
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>بسته</th>
                                        <th>مدت</th>
                                        <th>تاریخ قبلی</th>
                                        <th>تاریخ جدید</th>
                                        <th>تمدید توسط</th>
                                        <th>زمان ثبت</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($tenant->subscriptionRenewals as $renewal)
                                        <tr>
                                            <td>{{ $renewal->subscriptionPackage?->name ?? 'بسته حذف‌شده' }}</td>
                                            <td>{{ number_format($renewal->duration_days) }} روز</td>
                                            <td>{{ $renewal->previous_support_ends_at ? \App\Support\JalaliDate::format($renewal->previous_support_ends_at) : 'نداشته' }}</td>
                                            <td>{{ \App\Support\JalaliDate::format($renewal->new_support_ends_at) }}</td>
                                            <td>{{ $renewal->renewedBy?->name ?? 'کاربر نامشخص' }}</td>
                                            <td>{{ \App\Support\JalaliDate::format($renewal->created_at) }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
    <div class="modal fade" id="removeFeatureModuleModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <form method="POST" id="removeFeatureModuleForm">
                    @csrf
                    <div class="modal-header">
                        <h5 class="modal-title">غیرفعال‌سازی ماژول ویژه</h5>
                        <button type="button" class="btn-close ms-0 me-auto" data-bs-dismiss="modal" aria-label="بستن"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">
                            با این کار، دسترسی ماژول <strong id="removeFeatureModuleName">—</strong> بسته می‌شود اما جدول‌ها و داده‌های tenant حذف نمی‌شوند.
                        </div>
                        <div class="mb-0">
                            <label class="form-label">دلیل غیرفعال‌سازی</label>
                            <textarea class="form-control" name="reason" rows="4" required placeholder="مثلا: ماژول موقتاً نباید در پنل tenant نمایش داده شود."></textarea>
                            <div class="form-text">این دلیل در تاریخچه مدیریت ثبت می‌شود.</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-light-secondary" data-bs-dismiss="modal">انصراف</button>
                        <button type="submit" class="btn btn-danger">غیرفعال‌سازی</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    <script>
        (function () {
            const targetType = document.getElementById('target_type');
            const mobileWrap = document.getElementById('target_mobile_wrap');
            if (!targetType || !mobileWrap) return;

            const sync = () => {
                mobileWrap.style.display = targetType.value === 'single' ? 'block' : 'none';
            };

            targetType.addEventListener('change', sync);
            sync();
        })();

        (function () {
            const modal = document.getElementById('removeFeatureModuleModal');
            const form = document.getElementById('removeFeatureModuleForm');
            const moduleName = document.getElementById('removeFeatureModuleName');
            if (!modal || !form || !moduleName) return;

            modal.addEventListener('show.bs.modal', function (event) {
                const trigger = event.relatedTarget;
                if (!trigger) return;

                form.setAttribute('action', trigger.getAttribute('data-action') || '');
                moduleName.textContent = trigger.getAttribute('data-module-name') || 'ماژول نامشخص';
            });
        })();
    </script>
@endsection
