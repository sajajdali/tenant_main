<!doctype html>
<html lang="{{ app()->getLocale() }}" dir="{{ in_array(app()->getLocale(), ['fa', 'ar'], true) ? 'rtl' : 'ltr' }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ __('tenant.nutrition.redirecting_to_gateway') }}</title>
</head>
<body>
    <p>{{ __('tenant.nutrition.redirecting_to_gateway') }}</p>
    <form id="payment-redirect" action="{{ $action }}" method="{{ $method === 'GET' ? 'GET' : 'POST' }}">
        @foreach ($inputs as $name => $value)
            <input type="hidden" name="{{ $name }}" value="{{ is_scalar($value) ? $value : json_encode($value) }}">
        @endforeach
        <noscript><button type="submit">{{ __('tenant.nutrition.redirecting_to_gateway') }}</button></noscript>
    </form>
    <script>document.getElementById('payment-redirect').submit();</script>
</body>
</html>
