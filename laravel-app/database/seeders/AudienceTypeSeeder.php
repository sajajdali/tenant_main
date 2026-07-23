<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Tenant\Models\AudienceType;
use App\Support\AudienceSpecializedCourseSettings;
use Illuminate\Database\Seeder;

class AudienceTypeSeeder extends Seeder
{
    public function run(): void
    {
        $currentFeatures = array_keys(config('audience-features.current'));
        $specialFeatures = array_keys(config('audience-features.special'));
        $nutritionFeatures = array_keys(config('audience-features.nutrition'));
        $futureFeatures = array_keys(config('audience-features.future'));
        $globalFutureFeatures = collect(config('audience-features.future'))
            ->filter(fn (array $feature): bool => empty($feature['scopes']))
            ->keys()
            ->values()
            ->all();
        $doctorFutureFeatures = array_values(array_merge($globalFutureFeatures, [
            'waiting_queue',
            'patient_intake',
            'doctor_commission',
        ]));

        $items = [
            [
                'slug' => 'barbers',
                'name' => 'آرایشگران',
                'singular_label' => 'آرایشگر',
                'plural_label' => 'آرایشگران',
                'business_label' => 'آرایشگاه',
                'enabled_features' => $currentFeatures,
                'future_features' => array_values(array_merge($specialFeatures, $globalFutureFeatures)),
                'sort_order' => 10,
            ],
            [
                'slug' => 'doctors',
                'name' => 'پزشکان',
                'singular_label' => 'پزشک',
                'plural_label' => 'پزشکان',
                'business_label' => 'کلینیک',
                'enabled_features' => $currentFeatures,
                'future_features' => array_values(array_merge($specialFeatures, $doctorFutureFeatures)),
                'sort_order' => 20,
            ],
            [
                'slug' => 'lawyers',
                'name' => 'وکلا',
                'singular_label' => 'وکیل',
                'plural_label' => 'وکلا',
                'business_label' => 'دفتر',
                'enabled_features' => $currentFeatures,
                'future_features' => array_values(array_merge($specialFeatures, $globalFutureFeatures)),
                'sort_order' => 30,
            ],
            [
                'slug' => 'consultants',
                'name' => 'مشاوران',
                'singular_label' => 'مشاور',
                'plural_label' => 'مشاوران',
                'business_label' => 'مرکز',
                'enabled_features' => $currentFeatures,
                'future_features' => array_values(array_merge($specialFeatures, $globalFutureFeatures)),
                'sort_order' => 40,
            ],
            [
                'slug' => 'experts',
                'name' => 'کارشناسان',
                'singular_label' => 'کارشناس',
                'plural_label' => 'کارشناسان',
                'business_label' => 'مرکز',
                'enabled_features' => $currentFeatures,
                'future_features' => array_values(array_merge($specialFeatures, $globalFutureFeatures)),
                'sort_order' => 50,
            ],
            [
                'slug' => 'nutritionists',
                'name' => 'کارشناسان تغذیه',
                'singular_label' => 'کارشناس تغذیه',
                'plural_label' => 'کارشناسان تغذیه',
                'business_label' => 'مرکز تغذیه',
                'enabled_features' => $currentFeatures,
                'nutrition_features' => $nutritionFeatures,
                'future_features' => array_values(array_merge($specialFeatures, $globalFutureFeatures)),
                'sort_order' => 60,
            ],
            [
                'slug' => 'nutrition-doctors',
                'name' => 'پزشکان تغذیه',
                'singular_label' => 'پزشک تغذیه',
                'plural_label' => 'پزشکان تغذیه',
                'business_label' => 'کلینیک تغذیه',
                'enabled_features' => $currentFeatures,
                'nutrition_features' => $nutritionFeatures,
                'future_features' => array_values(array_merge($specialFeatures, $doctorFutureFeatures)),
                'sort_order' => 70,
            ],
        ];

        foreach ($items as $item) {
            AudienceType::query()->updateOrCreate(
                ['slug' => $item['slug']],
                [
                    'name' => $item['name'],
                    'singular_label' => $item['singular_label'],
                    'plural_label' => $item['plural_label'],
                    'business_label' => $item['business_label'],
                    'enabled_features' => $item['enabled_features'],
                    'nutrition_features' => $item['nutrition_features'] ?? [],
                    'future_features' => $item['future_features'],
                    'specialized_course_settings' => AudienceSpecializedCourseSettings::defaultsFor($item['slug']),
                    'sort_order' => $item['sort_order'],
                    'is_active' => true,
                ],
            );
        }
    }
}
