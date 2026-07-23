<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Http\Middleware\ForcePersianOnlyLocale;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Tests\TestCase;

class CentralAdminLocaleTest extends TestCase
{
    public function test_central_admin_stays_persian_when_application_locale_is_english(): void
    {
        App::setLocale('en');

        $request = Request::create('/admin/login', 'GET');
        $response = (new ForcePersianOnlyLocale())->handle(
            $request,
            static fn () => response('ok'),
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('fa', App::getLocale());
    }

    public function test_landing_builder_api_stays_persian_when_application_locale_is_english(): void
    {
        App::setLocale('en');

        $request = Request::create('/landing-api/v1/orders', 'GET');
        (new ForcePersianOnlyLocale())->handle($request, static fn () => response('ok'));

        $this->assertSame('fa', App::getLocale());
    }
}
