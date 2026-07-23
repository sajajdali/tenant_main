<?php

declare(strict_types=1);

return [
    [
        'type' => 'caption',
        'label' => 'ناوبری',
        'icon' => 'ph-duotone ph-gauge',
    ],
    [
        'type' => 'menu',
        'label' => 'داشبورد',
        'icon' => 'ph-duotone ph-squares-four',
        'route' => 'admin.dashboard',
        'roles' => ['admin', 'sales_manager', 'sales_expert'],
    ],
    [
        'type' => 'menu',
        'label' => 'داشبورد مدرس',
        'icon' => 'ph-duotone ph-presentation-chart',
        'route' => 'admin.teacher.dashboard',
        'roles' => ['teacher'],
    ],
    [
        'type' => 'menu',
        'label' => 'کاربران',
        'icon' => 'ph-duotone ph-users-three',
        'roles' => ['admin'],
        'children' => [
            [
                'label' => 'همه کاربران',
                'route' => 'admin.users.index',
            ],
            [
                'label' => 'افزودن کاربر',
                'route' => 'admin.users.create',
            ],
            [
                'label' => 'کاربران فعال',
                'route' => 'admin.users.index',
                'query' => ['status' => 'active'],
            ],
            [
                'label' => 'کاربران غیرفعال',
                'route' => 'admin.users.index',
                'query' => ['status' => 'inactive'],
            ],
            [
                'label' => 'مدرس‌ها',
                'route' => 'admin.users.index',
                'query' => ['role' => 'teacher'],
            ],
        ],
    ],
    [
        'type' => 'menu',
        'label' => 'دوره‌های تخصصی',
        'icon' => 'ph-duotone ph-video',
        'roles' => ['admin', 'teacher'],
        'children' => [
            [
                'label' => 'همه دوره‌ها',
                'route' => 'admin.specialized-courses.index',
                'roles' => ['admin'],
            ],
            [
                'label' => 'تنظیمات دوره‌ها',
                'route' => 'admin.specialized-course-settings.index',
                'roles' => ['admin'],
            ],
            [
                'label' => 'گروه‌بندی دوره‌ها',
                'route' => 'admin.specialized-course-categories.index',
                'roles' => ['admin'],
            ],
            [
                'label' => 'دوره‌های من',
                'route' => 'admin.specialized-courses.index',
                'roles' => ['teacher'],
            ],
            [
                'label' => 'گزارش فروش دوره‌ها',
                'route' => 'admin.specialized-course-reports.index',
                'roles' => ['admin', 'teacher'],
            ],
            [
                'label' => 'افزودن دوره',
                'route' => 'admin.specialized-courses.create',
                'roles' => ['admin', 'teacher'],
            ],
            [
                'label' => 'سفارش‌های دوره‌ها',
                'route' => 'admin.specialized-course-orders.index',
                'roles' => ['admin', 'teacher'],
            ],
            [
                'label' => 'برداشت و تسویه مدرس',
                'route' => 'admin.teacher.withdrawals',
                'roles' => ['teacher'],
            ],
            [
                'label' => 'معرفی مشتری‌ها',
                'route' => 'admin.sales-team.customers',
                'roles' => ['teacher'],
            ],
        ],
    ],
    [
        'type' => 'menu',
        'label' => 'تیم فروش',
        'icon' => 'ph-duotone ph-chart-line-up',
        'roles' => ['admin', 'sales_manager', 'sales_expert', 'teacher'],
        'children' => [
            [
                'label' => 'داشبورد فروش',
                'route' => 'admin.sales-team.index',
                'roles' => ['admin', 'sales_manager', 'sales_expert'],
            ],
            [
                'label' => 'ثبت مشتری‌ها',
                'route' => 'admin.sales-team.customers',
                'roles' => ['admin', 'sales_manager', 'sales_expert', 'teacher'],
            ],
            [
                'label' => 'کارشناسان فروش',
                'route' => 'admin.sales-team.index',
                'query' => ['role' => 'sales_expert'],
                'roles' => ['admin', 'sales_manager'],
            ],
            [
                'label' => 'مدیران فروش',
                'route' => 'admin.sales-team.index',
                'query' => ['role' => 'sales_manager'],
                'roles' => ['admin'],
            ],
            [
                'label' => 'درخواست‌های برداشت',
                'route' => 'admin.sales-withdrawals.index',
                'roles' => ['admin', 'sales_manager'],
            ],
            [
                'label' => 'فرصت‌های تمدید',
                'route' => 'admin.sales-team.renewals',
                'roles' => ['sales_manager', 'sales_expert'],
            ],
        ],
    ],
    [
        'type' => 'menu',
        'label' => 'سامانه‌های نوبت‌دهی',
        'icon' => 'ph-duotone ph-storefront',
        'roles' => ['admin'],
        'children' => [
            [
                'label' => 'همه سامانه‌های نوبت‌دهی',
                'route' => 'admin.tenants.index',
            ],
            [
                'label' => 'افزودن سامانه نوبت‌دهی',
                'route' => 'admin.tenants.create',
            ],
            [
                'label' => 'کاهش بسته و تاریخ',
                'route' => 'admin.support-adjustments.index',
            ],
            [
                'label' => 'سررسید دامنه‌ها',
                'route' => 'admin.ir-domain-renewals.index',
            ],
            [
                'label' => 'قیمت پسوند دامنه‌ها',
                'route' => 'admin.domain-tld-prices.index',
            ],
        ],
    ],
    [
        'type' => 'menu',
        'label' => 'لندینگ‌ها',
        'icon' => 'ph-duotone ph-browser',
        'roles' => ['admin'],
        'children' => [
            [
                'label' => 'همه لندینگ‌ها',
                'route' => 'admin.landing-sites.index',
            ],
            [
                'label' => 'افزودن لندینگ',
                'route' => 'admin.landing-sites.create',
            ],
        ],
    ],
    [
        'type' => 'menu',
        'label' => 'بسته‌ها و طیف‌ها',
        'icon' => 'ph-duotone ph-stack',
        'roles' => ['admin'],
        'children' => [
            [
                'label' => 'بسته‌های زمانی',
                'route' => 'admin.subscription-packages.index',
            ],
            [
                'label' => 'افزودن بسته',
                'route' => 'admin.subscription-packages.create',
            ],
            [
                'label' => 'طیف‌های کاری',
                'route' => 'admin.audience-types.index',
            ],
            [
                'label' => 'افزودن طیف',
                'route' => 'admin.audience-types.create',
            ],
            [
                'label' => 'ماژول‌های ویژه',
                'route' => 'admin.feature-modules.index',
            ],
            [
                'label' => 'افزودن ماژول',
                'route' => 'admin.feature-modules.create',
            ],
            [
                'label' => 'کدهای تخفیف',
                'route' => 'admin.discount-codes.index',
            ],
            [
                'label' => 'افزودن کد تخفیف',
                'route' => 'admin.discount-codes.create',
            ],
            [
                'label' => 'فعالیت های ورزشی',
                'route' => 'admin.nutrition-exercises.index',
            ],
        ],
    ],
    [
        'type' => 'menu',
        'label' => 'مالی',
        'icon' => 'ph-duotone ph-bank',
        'roles' => ['admin'],
        'children' => [
            [
                'label' => 'گزارش مالی',
                'route' => 'admin.finance.index',
            ],
            [
                'label' => 'درآمد پیامک',
                'route' => 'admin.sms-revenue.index',
            ],
            [
                'label' => 'مدیریت پرداخت‌ها',
                'route' => 'admin.payments.index',
            ],
            [
                'label' => 'ابطال درآمدها',
                'route' => 'admin.revenue-adjustments.index',
            ],
        ],
    ],
    [
        'type' => 'menu',
        'label' => 'تیکت‌های پشتیبانی',
        'icon' => 'ph-duotone ph-headset',
        'roles' => ['admin'],
        'children' => [
            [
                'label' => 'همه تیکت‌ها',
                'route' => 'admin.support-tickets.index',
            ],
            [
                'label' => 'در انتظار پاسخ',
                'route' => 'admin.support-tickets.index',
                'query' => ['status' => 'waiting_admin'],
            ],
            [
                'label' => 'پاسخ داده شده',
                'route' => 'admin.support-tickets.index',
                'query' => ['status' => 'waiting_requester'],
            ],
            [
                'label' => 'بسته شده',
                'route' => 'admin.support-tickets.index',
                'query' => ['status' => 'closed'],
            ],
        ],
    ],
    [
        'type' => 'menu',
        'label' => 'تنظیمات سایت',
        'icon' => 'ph-duotone ph-gear-six',
        'route' => 'admin.system-settings.edit',
        'roles' => ['admin'],
    ],
    [
        'type' => 'menu',
        'label' => 'تنظیمات پیامک',
        'icon' => 'ph-duotone ph-chat-circle-text',
        'children' => [
            [
                'label' => 'تنظیمات پیامک',
                'route' => 'admin.sms-settings.edit',
            ],
            [
                'label' => 'پیامک‌های ارسالی',
                'route' => 'admin.sms-outbounds.index',
            ],
            [
                'label' => 'تایید قالب‌های پیامک',
                'route' => 'admin.sms-templates.index',
            ],
            [
                'label' => 'تایید کمپین‌های پیامکی',
                'route' => 'admin.sms-campaigns.index',
            ],
        ],
        'roles' => ['admin'],
    ],
    [
        'type' => 'menu',
        'label' => 'تنظیمات ربات تلگرام',
        'icon' => 'ph-duotone ph-telegram-logo',
        'route' => 'admin.telegram-bot-settings.edit',
        'roles' => ['admin'],
    ],
    [
        'type' => 'menu',
        'label' => 'تنظیمات AI',
        'icon' => 'ph-duotone ph-cpu',
        'route' => 'admin.ai-settings.edit',
        'roles' => ['admin'],
    ],
    [
        'type' => 'menu',
        'label' => 'راهنمای سیستم',
        'icon' => 'ph-duotone ph-question',
        'children' => [
            [
                'label' => 'همه آموزش‌ها',
                'route' => 'admin.help-topics.index',
            ],
            [
                'label' => 'افزودن آموزش',
                'route' => 'admin.help-topics.create',
            ],
        ],
        'roles' => ['admin'],
    ],
];
