<!DOCTYPE html>
<html lang="{{ $localeMeta['htmlLang'] ?? 'fa' }}" dir="{{ $localeMeta['dir'] ?? 'rtl' }}">
  <head>
    @php
      $pickLatestAsset = function (string $pattern): ?string {
          return collect(glob($pattern))
              ->sortByDesc(fn (string $path) => filemtime($path))
              ->map(fn (string $path) => basename($path))
              ->first();
      };

      $cssFile = $pickLatestAsset(public_path('booking-app/assets/index-*.css'));
      $jsFile = $pickLatestAsset(public_path('booking-app/assets/index-*.js'));
      $landingFaviconUrl = $bootstrapMeta['landingSiteSettings']['faviconUrl'] ?? global_asset('favicon.png');
      $landingFaviconType = $bootstrapMeta['landingSiteSettings']['faviconType'] ?? 'image/png';
    @endphp
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <meta name="theme-color" content="{{ ($bootstrapMeta['themeMode'] ?? 'dark') === 'light' ? '#f8fafc' : '#0f172a' }}" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="{{ $pageMeta['siteName'] }}" />
    <link rel="manifest" href="/landing-site.webmanifest" />
    <link rel="apple-touch-icon" href="{{ $landingFaviconUrl }}" />
    <script>
      window.__BOOKING_BOOTSTRAP__ = {
        meta: @json($bootstrapMeta),
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

    <link rel="icon" type="{{ $landingFaviconType }}" href="{{ $landingFaviconUrl }}" />
    <link rel="alternate icon" type="image/x-icon" href="{{ global_asset('favicon.ico') }}" />
    @if ($cssFile)
      <link rel="stylesheet" crossorigin href="{{ global_asset('booking-app/assets/' . $cssFile) }}?v={{ @filemtime(public_path('booking-app/assets/' . $cssFile)) ?: time() }}">
    @endif
    @if ($jsFile)
      <script type="module" crossorigin src="{{ global_asset('booking-app/assets/' . $jsFile) }}?v={{ @filemtime(public_path('booking-app/assets/' . $jsFile)) ?: time() }}"></script>
    @endif
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
