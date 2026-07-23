<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Booking\Models\Appointment;

class CustomerFeedbackPublicLink
{
    public static function publicPath(string $code): string
    {
        return '/f/' . ltrim($code, '/');
    }

    public static function publicUrl(Appointment $appointment): string
    {
        $code = trim((string) $appointment->public_code);

        if ($code === '') {
            return '';
        }

        $path = static::publicPath($code);
        $request = request();

        if ($request !== null) {
            return rtrim($request->getSchemeAndHttpHost(), '/') . $path;
        }

        $tenant = tenant();

        if ($tenant && method_exists($tenant, 'domains')) {
            $domain = $tenant->domains()->value('domain');

            if (is_string($domain) && $domain !== '') {
                return 'https://' . $domain . $path;
            }
        }

        return $path;
    }
}
