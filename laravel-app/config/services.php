<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'kavenegar' => [
        'use_http' => (bool) env('KAVENEGAR_USE_HTTP', true),
        'connect_timeout_seconds' => (int) env('KAVENEGAR_CONNECT_TIMEOUT_SECONDS', 5),
        'timeout_seconds' => (int) env('KAVENEGAR_TIMEOUT_SECONDS', 15),
    ],

    'maliart_payment' => [
        'enabled' => (bool) env('MALIART_PAYMENT_ENABLED', false),
        'base_url' => rtrim((string) env('MALIART_PAYMENT_BASE_URL', 'https://maliart.ir'), '/'),
        'timeout_seconds' => (int) env('MALIART_PAYMENT_TIMEOUT_SECONDS', 20),
    ],

    'openai' => [
        'enabled' => (bool) env('OPENAI_ENABLED', false),
        'api_key' => env('OPENAI_API_KEY'),
        'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1/chat/completions'),
        'model' => env('OPENAI_MODEL', 'gpt-4.1-mini'),
        'model_version' => env('OPENAI_MODEL_VERSION'),
        'timeout_seconds' => (int) env('OPENAI_TIMEOUT_SECONDS', 90),
        'temperature' => (float) env('OPENAI_TEMPERATURE', 0.3),
        'proxy_enabled' => (bool) env('OPENAI_PROXY_ENABLED', false),
        'proxy_url' => env('OPENAI_PROXY_URL', env('ALL_PROXY')),
        'system_prompt' => env('OPENAI_SYSTEM_PROMPT'),
    ],

];
