<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Support\TenantLocale;
use Illuminate\Http\Request;
use Tests\TestCase;

class TenantLocaleTest extends TestCase
{
    public function test_defaults_to_persian_locale_metadata(): void
    {
        $meta = TenantLocale::meta();

        $this->assertSame('fa', $meta['locale']);
        $this->assertSame('IR', $meta['country']);
        $this->assertSame('rtl', $meta['dir']);
        $this->assertSame('jalali', $meta['calendar']);
        $this->assertSame('IRR', $meta['currency']);
    }

    public function test_resolves_locale_from_general_settings_rules(): void
    {
        $settings = (new GeneralSetting())->forceFill([
            'currency' => 'IRR',
            'booking_rules' => [
                'localization' => [
                    'locale' => 'en',
                    'country' => 'US',
                ],
            ],
        ]);

        $meta = TenantLocale::meta($settings);

        $this->assertSame('en', $meta['locale']);
        $this->assertSame('US', $meta['country']);
        $this->assertSame('ltr', $meta['dir']);
        $this->assertSame('gregorian', $meta['calendar']);
        $this->assertSame('USD', $meta['currency']);
    }

    public function test_registered_locale_currency_and_calendar_metadata_stays_ready_for_future_locales(): void
    {
        $supported = config('localization.supported');

        $this->assertSame('IRR', $supported['fa']['currency']);
        $this->assertSame('jalali', $supported['fa']['calendar']);
        $this->assertSame('USD', $supported['en']['currency']);
        $this->assertSame('gregorian', $supported['en']['calendar']);
        $this->assertSame('SAR', $supported['ar']['currency']);
        $this->assertSame('hijri', $supported['ar']['calendar']);
        $this->assertSame('EUR', $supported['de']['currency']);
        $this->assertSame('gregorian', $supported['de']['calendar']);
    }

    public function test_explicit_request_locale_overrides_settings_for_testing(): void
    {
        $settings = (new GeneralSetting())->forceFill([
            'booking_rules' => [
                'localization' => [
                    'locale' => 'fa',
                ],
            ],
        ]);
        $request = Request::create('/api/v1/meta', 'GET', ['locale' => 'en']);

        $this->assertSame('en', TenantLocale::resolve($settings, $request));
    }

    public function test_future_locales_are_registered_but_not_enabled_yet(): void
    {
        $this->assertContains('ar', TenantLocale::supportedLocales());
        $this->assertContains('de', TenantLocale::supportedLocales());
        $this->assertNotContains('ar', TenantLocale::selectableLocales());
        $this->assertNotContains('de', TenantLocale::selectableLocales());
        $this->assertNull(TenantLocale::normalize('ar'));
        $this->assertNull(TenantLocale::normalize('de'));
    }
}
