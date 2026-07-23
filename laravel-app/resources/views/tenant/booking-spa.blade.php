<!DOCTYPE html>
<html lang="{{ $localeMeta['htmlLang'] ?? 'fa' }}" dir="{{ $localeMeta['dir'] ?? 'rtl' }}">
  <head>
    @php
      $builtIndexPath = public_path('booking-app/index.html');
      $builtIndexHtml = is_file($builtIndexPath) ? file_get_contents($builtIndexPath) : false;

      $extractBuiltAsset = function ($html, string $pattern): ?string {
          if (! is_string($html) || $html === '') {
              return null;
          }

          if (! preg_match($pattern, $html, $matches)) {
              return null;
          }

          return isset($matches[1]) ? basename((string) $matches[1]) : null;
      };

      $cssFile = $extractBuiltAsset($builtIndexHtml, '/<link rel="stylesheet" crossorigin href="([^"]+)"/');
      $jsFile = $extractBuiltAsset($builtIndexHtml, '/<script type="module" crossorigin src="([^"]+)"/');
    @endphp
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <meta name="theme-color" content="{{ $pwaMeta['themeColor'] ?? '#0f172a' }}" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="{{ $pwaMeta['appName'] ?? $tenant->name }}" />
    <link rel="manifest" href="{{ $pwaMeta['manifestUrl'] ?? global_asset('manifest.webmanifest') }}" />
    <link rel="apple-touch-icon" sizes="180x180" href="{{ $pwaMeta['appleTouchIconUrl'] ?? global_asset('booking-app/apple-touch-icon.png') }}" />
    <script>
      @php
        $reverbClientHost = env('VITE_REVERB_HOST')
            ?: env('REVERB_HOST')
            ?: request()->getHost();
        $reverbClientPort = env('VITE_REVERB_PORT')
            ?: env('REVERB_PORT', 8080);
        $reverbClientScheme = env('VITE_REVERB_SCHEME')
            ?: env('REVERB_SCHEME', 'http');

        if ($reverbClientHost === '0.0.0.0') {
            $reverbClientHost = request()->getHost();
        }
      @endphp

      window.__BOOKING_BOOTSTRAP__ = {
        meta: @json($bootstrapMeta),
      };

      window.__BOOKING_REALTIME__ = {
        tenantId: @json((string) $tenant->id),
        enabled: @json((bool) env('BOOKING_REALTIME_ENABLED', true)),
        key: @json(env('REVERB_APP_KEY')),
        wsHost: @json($reverbClientHost),
        wsPort: @json((int) $reverbClientPort),
        wssPort: @json((int) $reverbClientPort),
        forceTLS: @json($reverbClientScheme === 'https'),
      };
    </script>

    <title>{{ $pageMeta['title'] }}</title>
    <meta name="description" content="{{ $pageMeta['description'] }}" />
    <meta name="robots" content="{{ $pageMeta['robots'] }}" />
    @if (!empty($pageMeta['keywords']))
      <meta name="keywords" content="{{ $pageMeta['keywords'] }}" />
    @endif
    <link rel="canonical" href="{{ $pageMeta['canonical'] }}" />
    <meta property="og:locale" content="{{ $localeMeta['ogLocale'] ?? 'fa_IR' }}" />
    <meta property="og:site_name" content="{{ $pageMeta['siteName'] }}" />
    <meta property="og:title" content="{{ $pageMeta['title'] }}" />
    <meta property="og:description" content="{{ $pageMeta['description'] }}" />
    <meta property="og:type" content="{{ $pageMeta['type'] }}" />
    <meta property="og:url" content="{{ $pageMeta['canonical'] }}" />
    <meta property="og:image" content="{{ $pageMeta['image'] }}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{{ $pageMeta['title'] }}" />
    <meta name="twitter:description" content="{{ $pageMeta['description'] }}" />
    <meta name="twitter:image" content="{{ $pageMeta['image'] }}" />

    <link rel="icon" type="{{ $pwaMeta['iconType'] ?? 'image/png' }}" sizes="192x192" href="{{ $pwaMeta['icon192Url'] ?? global_asset('booking-app/icon-192.png') }}" />
    <link rel="icon" type="{{ $pwaMeta['faviconType'] ?? 'image/png' }}" href="{{ $pwaMeta['faviconUrl'] ?? global_asset('booking-app/favicon.png') }}" />
    <link rel="alternate icon" type="{{ $pwaMeta['alternateIconType'] ?? 'image/x-icon' }}" href="{{ $pwaMeta['alternateIconUrl'] ?? global_asset('booking-app/favicon.ico') }}" />
    @if ($cssFile)
      <link rel="stylesheet" crossorigin href="{{ global_asset('booking-app/assets/' . $cssFile) }}?v={{ @filemtime(public_path('booking-app/assets/' . $cssFile)) ?: time() }}">
    @endif
    @if ($jsFile)
      <script type="module" crossorigin src="{{ global_asset('booking-app/assets/' . $jsFile) }}?v={{ @filemtime(public_path('booking-app/assets/' . $jsFile)) ?: time() }}"></script>
    @endif
    <script defer src="{{ global_asset('js/web-otp-autofill.js') }}?v={{ @filemtime(public_path('js/web-otp-autofill.js')) ?: time() }}"></script>
    @if (!empty($pageMeta['jsonLd']))
      <script type="application/ld+json">{!! json_encode($pageMeta['jsonLd'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}</script>
    @endif
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
