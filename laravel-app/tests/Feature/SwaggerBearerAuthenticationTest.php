<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Routing\Route;
use Tests\TestCase;

class SwaggerBearerAuthenticationTest extends TestCase
{
    public function test_every_bearer_operation_has_a_matching_sanctum_route(): void
    {
        $specification = json_decode(
            file_get_contents(storage_path('api-docs/api-docs.json')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );

        $httpMethods = ['get', 'post', 'put', 'patch', 'delete'];
        $applicationRoutes = collect(app('router')->getRoutes()->getRoutes());

        foreach ($specification['paths'] as $path => $operations) {
            foreach ($operations as $method => $operation) {
                if (! in_array($method, $httpMethods, true) || ! $this->usesBearerAuthentication($operation)) {
                    continue;
                }

                $matchingRoutes = $applicationRoutes->filter(
                    fn (Route $route): bool => $this->normalizedPath($route->uri()) === $this->normalizedPath($path)
                        && in_array(strtoupper($method), $route->methods(), true),
                );

                $this->assertNotEmpty(
                    $matchingRoutes,
                    sprintf('Swagger bearer operation %s %s has no matching Laravel route.', strtoupper($method), $path),
                );

                $this->assertTrue(
                    $matchingRoutes->contains(
                        fn (Route $route): bool => in_array('auth:sanctum', $route->gatherMiddleware(), true),
                    ),
                    sprintf('Swagger bearer operation %s %s is not protected by auth:sanctum.', strtoupper($method), $path),
                );
            }
        }
    }

    public function test_swagger_does_not_hide_invalid_bearer_tokens_with_browser_session(): void
    {
        $template = file_get_contents(resource_path('views/vendor/l5-swagger/index.blade.php'));

        $this->assertStringContainsString("request.credentials = 'omit';", $template);
        $this->assertStringNotContainsString("request.headers['X-CSRF-TOKEN']", $template);
    }

    private function usesBearerAuthentication(array $operation): bool
    {
        foreach ($operation['security'] ?? [] as $requirement) {
            if (array_key_exists('bearerAuth', $requirement)) {
                return true;
            }
        }

        return false;
    }

    private function normalizedPath(string $path): string
    {
        return preg_replace('/\{[^}]+}/', '{}', ltrim($path, '/')) ?? ltrim($path, '/');
    }
}
