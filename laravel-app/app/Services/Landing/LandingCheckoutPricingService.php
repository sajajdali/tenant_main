<?php

declare(strict_types=1);

namespace App\Services\Landing;

use App\Domain\Landing\Models\AudienceCheckoutSetting;
use App\Domain\Landing\Models\DomainTldPrice;
use App\Domain\Landing\Models\LandingSite;
use App\Domain\Tenant\Models\AudienceType;
use App\Domain\Tenant\Models\SubscriptionPackage;
use Illuminate\Validation\ValidationException;

class LandingCheckoutPricingService
{
    public function quote(
        AudienceType $audienceType,
        SubscriptionPackage $subscriptionPackage,
        ?string $requestedDomain = null,
        ?LandingSite $landingSite = null,
    ): array
    {
        $audienceType->loadMissing('checkoutSetting');
        $subscriptionPackage->loadMissing('audiencePrices');

        $packagePricing = $subscriptionPackage->pricingFor($audienceType->id);
        $checkoutSetting = $audienceType->checkoutSetting
            ?? new AudienceCheckoutSetting([
                'setup_fee_amount' => 0,
                'setup_fee_label' => 'هزینه اولیه',
                'currency' => 'IRT',
            ]);

        $landingPricing = is_array($landingSite?->settings_json['checkoutPricing'] ?? null)
            ? $landingSite->settings_json['checkoutPricing']
            : [];

        $domainAmount = 0;
        $domainTld = null;

        if ($requestedDomain !== null && trim($requestedDomain) !== '') {
            $domainTld = app(LandingDomainAvailabilityService::class)->extractTld(
                app(LandingDomainAvailabilityService::class)->normalizeDomain($requestedDomain)
            );

            $domainPricing = $domainTld !== null
                ? DomainTldPrice::query()->where('tld', $domainTld)->where('is_active', true)->first()
                : null;

            if ($domainPricing === null) {
                throw ValidationException::withMessages([
                    'domain' => 'قیمت‌گذاری این پسوند هنوز در مدیریت ثبت نشده است.',
                ]);
            }

            $domainAmount = $domainTld === '.ir' && isset($landingPricing['domainIrPriceAmount']) && $landingPricing['domainIrPriceAmount'] !== null
                ? (int) $landingPricing['domainIrPriceAmount']
                : (int) $domainPricing->register_price_amount;
        } elseif ($landingSite !== null) {
            $defaultIrPricing = DomainTldPrice::query()->where('tld', '.ir')->where('is_active', true)->first();
            $landingIrAmount = isset($landingPricing['domainIrPriceAmount']) && $landingPricing['domainIrPriceAmount'] !== null
                ? (int) $landingPricing['domainIrPriceAmount']
                : null;

            if ($landingIrAmount !== null || $defaultIrPricing !== null) {
                $domainTld = '.ir';
                $domainAmount = $landingIrAmount !== null
                    ? $landingIrAmount
                    : (int) $defaultIrPricing->register_price_amount;
            }
        }

        $packageAmount = (int) $packagePricing['payableAmount'];
        $setupAmount = (int) ($checkoutSetting->setup_fee_amount ?? 0);
        $discountAmount = (int) ($packagePricing['discountAmount'] ?? 0);
        $subtotal = $packageAmount + $setupAmount + $domainAmount;

        return [
            'currency' => (string) ($checkoutSetting->currency ?: 'IRT'),
            'packageAmount' => $packageAmount,
            'packageBaseAmount' => (int) ($packagePricing['priceAmount'] ?? $packageAmount),
            'setupAmount' => $setupAmount,
            'setupLabel' => (string) ($checkoutSetting->setup_fee_label ?: 'هزینه اولیه'),
            'domainAmount' => $domainAmount,
            'domainTld' => $domainTld,
            'discountAmount' => $discountAmount,
            'subtotalAmount' => $subtotal,
            'totalAmount' => max(0, $subtotal),
            'durationDays' => (int) $subscriptionPackage->duration_days,
            'userLimit' => $subscriptionPackage->user_limit,
            'packageName' => (string) $subscriptionPackage->name,
            'audienceName' => (string) $audienceType->name,
            'audienceOverrideApplied' => (bool) ($packagePricing['audienceOverrideApplied'] ?? false),
            'smsCreditGiftAmount' => max(0, (int) $subscriptionPackage->sms_credit_gift_amount),
        ];
    }
}
