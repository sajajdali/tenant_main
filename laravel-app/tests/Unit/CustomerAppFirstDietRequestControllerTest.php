<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Api\V1\Customer\Nutrition\DietRequestController;
use App\Http\Controllers\Tenant\NutritionDietRequestController as LegacyNutritionDietRequestController;
use App\Services\Api\CustomerDietRequestFlowService;
use Illuminate\Http\Request;
use Mockery;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class CustomerAppFirstDietRequestControllerTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();

        parent::tearDown();
    }

    public function test_store_maps_the_official_app_payload_to_the_existing_diet_request_contract(): void
    {
        $user = (new TenantUser)->forceFill([
            'id' => 15,
            'can_book' => true,
        ]);
        $request = Request::create('/api/v1/app/nutrition/diet-requests', 'POST', [
            'requestType' => 'ai',
            'nutritionDietTemplateId' => 12,
            'repeatDietMedicalConditionsItems' => [
                [
                    'id' => 'condition_1',
                    'title' => 'کم‌کاری تیروئید',
                    'status' => 'current',
                    'startedAt' => '2025-02-01',
                    'ongoing' => true,
                    'notes' => 'لووتیروکسین مصرف می‌کنم.',
                ],
            ],
        ]);
        $request->setUserResolver(fn (): TenantUser => $user);

        $legacy = Mockery::mock(LegacyNutritionDietRequestController::class);
        $flow = Mockery::mock(CustomerDietRequestFlowService::class);
        $flow->shouldReceive('preview')
            ->once()
            ->with($user, Mockery::on(fn (array $payload): bool => $payload['requestType'] === 'ai'
                && $payload['nutritionDietTemplateId'] === 12
                && ($payload['repeatDietMedicalConditionsItems'][0]['title'] ?? null) === 'کم‌کاری تیروئید'
                && str_contains((string) ($payload['repeatDietMedicalNotes'] ?? ''), 'کم‌کاری تیروئید')))
            ->andReturn(['canConfirm' => true]);
        $legacy->shouldReceive('store')
            ->once()
            ->with(Mockery::on(function (Request $mappedRequest): bool {
                return $mappedRequest->input('request_type') === 'ai'
                    && $mappedRequest->integer('nutrition_diet_template_id') === 12
                    && $mappedRequest->input('expert_description') === null
                    && $mappedRequest->input('repeat_diet_feedback') === null
                    && $mappedRequest->input('repeat_diet_medical_conditions_items.0.title') === 'کم‌کاری تیروئید'
                    && str_contains((string) $mappedRequest->input('repeat_diet_medical_notes'), 'کم‌کاری تیروئید');
            }))
            ->andReturn(response()->json([
                'success' => true,
                'message' => 'ثبت شد.',
                'data' => [
                    'request' => [
                        'id' => '81',
                        'requestType' => 'ai',
                        'status' => 'sent',
                        'createdAt' => '2026-07-06T12:30:00+03:30',
                        'aiPromptSnapshot' => ['internal' => true],
                    ],
                ],
            ]));

        $response = (new DietRequestController($legacy, $flow))->store($request);
        $body = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('81', $body['data']['request']['id']);
        $this->assertArrayNotHasKey('aiPromptSnapshot', $body['data']['request']);
        $this->assertStringContainsString('"meta":{}', $response->getContent());
    }

    public function test_locked_user_cannot_reach_the_diet_request_service(): void
    {
        $user = (new TenantUser)->forceFill([
            'id' => 15,
            'can_book' => false,
        ]);
        $request = Request::create('/api/v1/app/nutrition/diet-requests', 'POST', [
            'requestType' => 'expert',
        ]);
        $request->setUserResolver(fn (): TenantUser => $user);

        $legacy = Mockery::mock(LegacyNutritionDietRequestController::class);
        $legacy->shouldNotReceive('store');
        $flow = Mockery::mock(CustomerDietRequestFlowService::class);
        $flow->shouldNotReceive('preview');

        try {
            (new DietRequestController($legacy, $flow))->store($request);
            $this->fail('A locked nutrition user should receive HTTP 423.');
        } catch (HttpException $exception) {
            $this->assertSame(423, $exception->getStatusCode());
        }
    }

    public function test_preview_returns_the_read_only_flow_payload_without_calling_store(): void
    {
        $user = (new TenantUser)->forceFill([
            'id' => 15,
            'can_book' => true,
        ]);
        $request = Request::create('/api/v1/app/nutrition/diet-requests/preview', 'POST', [
            'requestType' => 'expert',
            'expertDescription' => 'غذاهای ساده را ترجیح می‌دهم.',
        ]);
        $request->setUserResolver(fn (): TenantUser => $user);

        $preview = [
            'flowType' => 'first_diet',
            'balance' => [
                'remaining' => 2,
                'remainingAfterConfirmation' => 1,
            ],
            'canConfirm' => true,
        ];
        $legacy = Mockery::mock(LegacyNutritionDietRequestController::class);
        $legacy->shouldNotReceive('store');
        $flow = Mockery::mock(CustomerDietRequestFlowService::class);
        $flow->shouldReceive('preview')
            ->once()
            ->with($user, Mockery::on(fn (array $payload): bool => $payload['requestType'] === 'expert'
                && $payload['expertDescription'] === 'غذاهای ساده را ترجیح می‌دهم.'))
            ->andReturn($preview);

        $response = (new DietRequestController($legacy, $flow))->preview($request);
        $body = $response->getData(true);

        $this->assertSame($preview, $body['data']);
        $this->assertTrue($body['data']['canConfirm']);
    }
}
