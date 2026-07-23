<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Booking\Models\Appointment;
use Illuminate\Support\Str;

class AppointmentPublicLink
{
    public static function generateCode(): string
    {
        return Str::random(4);
    }

    public static function publicPath(string $code): string
    {
        return '/s/' . ltrim($code, '/');
    }

    public static function publicUrl(Appointment $appointment): string
    {
        $code = trim((string) $appointment->public_code);

        if ($code === '') {
            return '';
        }

        $path = static::publicPath($code);
        $tenant = tenant();

        // Queue workers have a synthetic localhost request, so the active
        // tenant domain must take priority over the request host. Otherwise
        // scheduled reminders leak APP_URL/localhost into customer messages.
        if ($tenant && method_exists($tenant, 'domains')) {
            $domain = trim((string) $tenant->domains()->value('domain'));

            if ($domain !== '') {
                $host = preg_replace('#^https?://#i', '', $domain) ?? $domain;
                $host = rtrim($host, '/');
                $scheme = in_array(strtolower($host), ['localhost', '127.0.0.1'], true)
                    ? 'http'
                    : 'https';

                return $scheme . '://' . $host . $path;
            }
        }

        $request = request();
        $host = $request->getHost();
        $scheme = in_array($host, ['localhost', '127.0.0.1'], true)
            ? $request->getScheme()
            : 'https';
        $port = $request->getPort();
        $portSuffix = $port !== null && ! in_array((int) $port, [80, 443], true)
            ? ':' . $port
            : '';

        return $scheme . '://' . $host . $portSuffix . $path;
    }
}
