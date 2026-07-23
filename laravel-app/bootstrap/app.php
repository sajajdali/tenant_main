<?php

use App\Http\Controllers\Landing\LandingSitePublicController;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\EnsureTenantPanelAccessOpen;
use App\Http\Middleware\EnsureTenantModuleActive;
use App\Http\Middleware\EnsureTenantSupportActive;
use App\Http\Middleware\EnsureTenantStorageAvailable;
use App\Http\Middleware\ForcePersianOnlyLocale;
use App\Http\Middleware\SetTenantLocale;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Validation\ValidationException;
use Stancl\Tenancy\Exceptions\TenantCouldNotBeIdentifiedOnDomainException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->append(ForcePersianOnlyLocale::class);

        $except = [
            'api/v1/*',
            'landing-api/v1/*',
        ];

        if (method_exists($middleware, 'preventRequestForgery')) {
            $middleware->preventRequestForgery(except: $except);
        } else {
            $middleware->validateCsrfTokens(except: $except);
        }

        $middleware->alias([
            'tenant.panel.access' => EnsureTenantPanelAccessOpen::class,
            'tenant.module' => EnsureTenantModuleActive::class,
            'tenant.support' => EnsureTenantSupportActive::class,
            'tenant.storage' => EnsureTenantStorageAvailable::class,
            'tenant.locale' => SetTenantLocale::class,
        ]);

        $middleware->redirectGuestsTo(function ($request) {
            if (str_starts_with($request->path(), 'api/v1/app/')) {
                return null;
            }

            return route('login');
        });
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(function ($request, Throwable $exception) {
            if (str_starts_with($request->path(), 'api/v1/app/')) {
                return true;
            }

            return $request->expectsJson();
        });

        $exceptions->render(function (AuthenticationException $exception, $request) {
            if (! str_starts_with($request->path(), 'api/v1/app/')) {
                return null;
            }

            return response()->json([
                'success' => false,
                'message' => 'ابتدا وارد حساب کاربری شوید.',
                'errors' => [],
            ], 401);
        });

        $exceptions->render(function (ValidationException $exception, $request) {
            if (! str_starts_with($request->path(), 'api/v1/app/')) {
                return null;
            }

            return response()->json([
                'success' => false,
                'message' => 'اطلاعات ارسال‌شده معتبر نیست.',
                'errors' => $exception->errors(),
            ], $exception->status);
        });

        $exceptions->render(function (NotFoundHttpException $exception, $request) {
            if (! str_starts_with($request->path(), 'api/v1/app/')) {
                return null;
            }

            return response()->json([
                'success' => false,
                'message' => 'آدرس یا منبع موردنظر پیدا نشد.',
                'errors' => [],
            ], 404);
        });

        $exceptions->render(function (MethodNotAllowedHttpException $exception, $request) {
            if (! str_starts_with($request->path(), 'api/v1/app/')) {
                return null;
            }

            return response()->json([
                'success' => false,
                'message' => 'متد درخواست برای این آدرس مجاز نیست.',
                'errors' => [],
            ], 405);
        });

        $resolveLandingResponse = function ($request) {
            $host = $request->getHost();

            $isLandingDomain = \App\Domain\Landing\Models\LandingSiteDomain::query()
                ->where('domain', $host)
                ->where('status', 'active')
                ->exists();

            if (! $isLandingDomain) {
                return null;
            }

            if (str_starts_with($request->path(), 'landing-api/')) {
                return null;
            }

            return app(LandingSitePublicController::class)($request);
        };

        $exceptions->render(function (TenantCouldNotBeIdentifiedOnDomainException $exception, $request) use ($resolveLandingResponse) {
            return $resolveLandingResponse($request);
        });

        $exceptions->render(function (NotFoundHttpException $exception, $request) use ($resolveLandingResponse) {
            return $resolveLandingResponse($request);
        });
    })->create();
