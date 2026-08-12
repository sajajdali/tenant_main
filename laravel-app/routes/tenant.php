<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Customer\AppHomeController;
use App\Http\Controllers\Api\V1\Customer\Articles\ArticleController as CustomerAppArticleController;
use App\Http\Controllers\Api\V1\Customer\Auth\OtpAuthController as CustomerAppOtpAuthController;
use App\Http\Controllers\Api\V1\Customer\Membership\MembershipController as CustomerAppMembershipController;
use App\Http\Controllers\Api\V1\Customer\Nutrition\DietRequestController as CustomerAppDietRequestController;
use App\Http\Controllers\Api\V1\Customer\Nutrition\ProfileController as CustomerAppNutritionProfileController;
use App\Http\Controllers\Api\V1\Customer\OnlineChat\ConversationController as CustomerAppOnlineChatController;
use App\Http\Controllers\SupportTicketAttachmentController;
use App\Http\Controllers\Tenant\AboutSettingsController;
use App\Http\Controllers\Tenant\AppearanceSettingsController;
use App\Http\Controllers\Tenant\AppointmentController;
use App\Http\Controllers\Tenant\AppointmentBookingClosureController;
use App\Http\Controllers\Tenant\ArticlePostController;
use App\Http\Controllers\Tenant\ArticleSettingsController;
use App\Http\Controllers\Tenant\BarberController;
use App\Http\Controllers\Tenant\BookingPaymentController;
use App\Http\Controllers\Tenant\ContactSettingsController;
use App\Http\Controllers\Tenant\CustomLandingController;
use App\Http\Controllers\Tenant\CustomLandingPublicController;
use App\Http\Controllers\Tenant\CookingRecipeController;
use App\Http\Controllers\Tenant\CustomerClubController;
use App\Http\Controllers\Tenant\CustomerFeedbackController;
use App\Http\Controllers\Tenant\DomainRenewalController;
use App\Http\Controllers\Tenant\FeatureModuleController;
use App\Http\Controllers\Tenant\FinanceDashboardController;
use App\Http\Controllers\Tenant\GalleryController;
use App\Http\Controllers\Tenant\GeneralSettingsController;
use App\Http\Controllers\Tenant\HelpTopicController;
use App\Http\Controllers\Tenant\ManualFinanceController;
use App\Http\Controllers\Tenant\MessagingBotSettingsController;
use App\Http\Controllers\Tenant\MetaController;
use App\Http\Controllers\Tenant\NotificationCampaignController;
use App\Http\Controllers\Tenant\NutritionAdminUserController;
use App\Http\Controllers\Tenant\NutritionAiDietRequestController;
use App\Http\Controllers\Tenant\NutritionAiPromptPresetController;
use App\Http\Controllers\Tenant\NutritionAudioGuidanceController;
use App\Http\Controllers\Tenant\NutritionDietFileController;
use App\Http\Controllers\Tenant\NutritionDietPrescriptionController;
use App\Http\Controllers\Tenant\NutritionDietRequestController;
use App\Http\Controllers\Tenant\NutritionDietTemplateController;
use App\Http\Controllers\Tenant\NutritionDiscountCodeController;
use App\Http\Controllers\Tenant\NutritionExerciseAdminController;
use App\Http\Controllers\Tenant\NutritionExerciseCatalogController;
use App\Http\Controllers\Tenant\NutritionLandingSettingsController;
use App\Http\Controllers\Tenant\NutritionPackageController;
use App\Http\Controllers\Tenant\NutritionCafeBazaarPurchaseController;
use App\Http\Controllers\Tenant\NutritionPackagePurchaseController;
use App\Http\Controllers\Tenant\NutritionProfileController;
use App\Http\Controllers\Tenant\NutritionProfileDashboardController;
use App\Http\Controllers\Tenant\NutritionSettingsController;
use App\Http\Controllers\Tenant\NutritionTokenController;
use App\Http\Controllers\Tenant\OnlineChatAdminController;
use App\Http\Controllers\Tenant\OnlineChatAttachmentController;
use App\Http\Controllers\Tenant\OnlineChatController;
use App\Http\Controllers\Tenant\OnlineChatSettingsController;
use App\Http\Controllers\Tenant\ReferralController;
use App\Http\Controllers\Tenant\ServiceController;
use App\Http\Controllers\Tenant\SiteController;
use App\Http\Controllers\Tenant\SmsCampaignController;
use App\Http\Controllers\Tenant\SmsOutboundController;
use App\Http\Controllers\Tenant\SmsTopUpPaymentController;
use App\Http\Controllers\Tenant\SpecializedCourseCatalogController;
use App\Http\Controllers\Tenant\StoreCategoryController;
use App\Http\Controllers\Tenant\StoreDashboardController;
use App\Http\Controllers\Tenant\StoreOrderController;
use App\Http\Controllers\Tenant\StoreProductController;
use App\Http\Controllers\Tenant\StoreProductReviewController;
use App\Http\Controllers\Tenant\StoreSettingsController;
use App\Http\Controllers\Tenant\SupportRenewalController;
use App\Http\Controllers\Tenant\SupportTicketController;
use App\Http\Controllers\Tenant\TelegramBotWebhookController;
use App\Http\Controllers\Tenant\TenantAdminAuthController;
use App\Http\Controllers\Tenant\TenantDashboardController;
use App\Http\Controllers\Tenant\TenantFileManagerController;
use App\Http\Controllers\Tenant\TenantOtpAuthApiController;
use App\Http\Controllers\Tenant\TenantSeoController;
use App\Http\Controllers\Tenant\TenantUserController;
use App\Http\Controllers\Tenant\UserNotificationController;
use Illuminate\Support\Facades\Route;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;

/*
|--------------------------------------------------------------------------
| Tenant Routes
|--------------------------------------------------------------------------
|
| Here you can register the tenant routes for your application.
| These routes are loaded by the TenantRouteServiceProvider.
|
| Feel free to customize them however you want. Good luck!
|
*/

Route::middleware([
    'web',
    InitializeTenancyByDomain::class,
    PreventAccessFromCentralDomains::class,
    'tenant.locale',
])->group(function () {
    Route::get('/support-attachments/{attachment}', SupportTicketAttachmentController::class)->name('tenant.support-attachments.show');
    Route::middleware(['auth:tenant_web', 'tenant.module:online-chat'])->get('/online-chat-attachments/{attachment}', OnlineChatAttachmentController::class)->name('tenant.online-chat.attachments.show');
    Route::get('/robots.txt', [TenantSeoController::class, 'robots'])->name('tenant.robots');
    Route::get('/sitemap.xml', [TenantSeoController::class, 'sitemap'])->name('tenant.sitemap');
    Route::get('/site.webmanifest', [SiteController::class, 'manifest'])->name('tenant.pwa.manifest');
    Route::get('/pwa/icon-{size}.png', [SiteController::class, 'pwaIcon'])
        ->whereNumber('size')
        ->name('tenant.pwa.icon');
    Route::get('/{verificationFile}.txt', [GeneralSettingsController::class, 'serveEnamadVerificationFile'])
        ->where('verificationFile', '[A-Za-z0-9_-]+')
        ->name('tenant.enamad-verification-file');

    Route::prefix('/api/v1/auth/otp')->group(function () {
        Route::post('/send', [TenantOtpAuthApiController::class, 'send'])->name('tenant.api.auth.otp.send');
        Route::post('/verify', [TenantOtpAuthApiController::class, 'verify'])->name('tenant.api.auth.otp.verify');
        Route::get('/me', [TenantOtpAuthApiController::class, 'me'])->name('tenant.api.auth.me');
        Route::post('/profile', [TenantOtpAuthApiController::class, 'updateProfile'])->name('tenant.api.auth.profile');
        Route::post('/logout', [TenantOtpAuthApiController::class, 'logout'])->name('tenant.api.auth.logout');
    });

    Route::prefix('/api/v1/app')->group(function () {
        Route::get('/home', AppHomeController::class)->name('tenant.api.app.home');
        Route::get('/articles', [CustomerAppArticleController::class, 'index'])->name('tenant.api.app.articles.index');
        Route::get('/articles/{articleId}', [CustomerAppArticleController::class, 'show'])->name('tenant.api.app.articles.show');
        Route::get('/articles/{slug}/comments', [CustomerAppArticleController::class, 'comments'])->name('tenant.api.app.articles.comments.index');
        Route::post('/articles/{slug}/comments', [CustomerAppArticleController::class, 'storeComment'])
            ->middleware('auth:sanctum')
            ->name('tenant.api.app.articles.comments.store');

        Route::prefix('/auth')->group(function () {
            Route::post('/login', [CustomerAppOtpAuthController::class, 'login'])->name('tenant.api.app.auth.login');
            Route::post('/verify', [CustomerAppOtpAuthController::class, 'verify'])->name('tenant.api.app.auth.verify');

            Route::middleware('auth:sanctum')->group(function () {
                Route::get('/me', [CustomerAppOtpAuthController::class, 'me'])->name('tenant.api.app.auth.me');
                Route::post('/logout', [CustomerAppOtpAuthController::class, 'logout'])->name('tenant.api.app.auth.logout');
            });
        });

        Route::middleware('auth:sanctum')->prefix('/membership')->group(function () {
            Route::get('/', [CustomerAppMembershipController::class, 'index'])->name('tenant.api.app.membership.index');
            Route::get('/profile', [CustomerAppMembershipController::class, 'profile'])->name('tenant.api.app.membership.profile');
            Route::post('/profile', [CustomerAppMembershipController::class, 'storeProfile'])->name('tenant.api.app.membership.profile.store');
            Route::get('/goal', [CustomerAppMembershipController::class, 'goal'])->name('tenant.api.app.membership.goal');
            Route::post('/goal', [CustomerAppMembershipController::class, 'storeGoal'])->name('tenant.api.app.membership.goal.store');
            Route::get('/activity', [CustomerAppMembershipController::class, 'activity'])->name('tenant.api.app.membership.activity');
            Route::post('/activity', [CustomerAppMembershipController::class, 'storeActivity'])->name('tenant.api.app.membership.activity.store');
            Route::get('/birth-date', [CustomerAppMembershipController::class, 'birthDate'])->name('tenant.api.app.membership.birth-date');
            Route::post('/birth-date', [CustomerAppMembershipController::class, 'storeBirthDate'])->name('tenant.api.app.membership.birth-date.store');
            Route::get('/height', [CustomerAppMembershipController::class, 'height'])->name('tenant.api.app.membership.height');
            Route::post('/height', [CustomerAppMembershipController::class, 'storeHeight'])->name('tenant.api.app.membership.height.store');
            Route::get('/weight', [CustomerAppMembershipController::class, 'weight'])->name('tenant.api.app.membership.weight');
            Route::post('/weight', [CustomerAppMembershipController::class, 'storeWeight'])->name('tenant.api.app.membership.weight.store');
            Route::get('/target-weight', [CustomerAppMembershipController::class, 'targetWeight'])->name('tenant.api.app.membership.target-weight');
            Route::post('/target-weight', [CustomerAppMembershipController::class, 'storeTargetWeight'])->name('tenant.api.app.membership.target-weight.store');
            Route::get('/result', [CustomerAppMembershipController::class, 'result'])->name('tenant.api.app.membership.result');
            Route::post('/result', [CustomerAppMembershipController::class, 'storeResult'])->name('tenant.api.app.membership.result.store');
            Route::get('/medical-conditions', [CustomerAppMembershipController::class, 'medicalConditions'])->name('tenant.api.app.membership.medical-conditions');
            Route::post('/medical-conditions', [CustomerAppMembershipController::class, 'storeMedicalConditions'])->name('tenant.api.app.membership.medical-conditions.store');
            Route::get('/medications-and-supplements', [CustomerAppMembershipController::class, 'medicationsAndSupplements'])->name('tenant.api.app.membership.medications-and-supplements');
            Route::post('/medications-and-supplements', [CustomerAppMembershipController::class, 'storeMedicationsAndSupplements'])->name('tenant.api.app.membership.medications-and-supplements.store');
            Route::get('/allergies', [CustomerAppMembershipController::class, 'allergies'])->name('tenant.api.app.membership.allergies');
            Route::post('/allergies', [CustomerAppMembershipController::class, 'storeAllergies'])->name('tenant.api.app.membership.allergies.store');
            Route::get('/disliked-foods', [CustomerAppMembershipController::class, 'dislikedFoods'])->name('tenant.api.app.membership.disliked-foods');
            Route::post('/disliked-foods', [CustomerAppMembershipController::class, 'storeDislikedFoods'])->name('tenant.api.app.membership.disliked-foods.store');
            Route::get('/packages', [CustomerAppMembershipController::class, 'packages'])->name('tenant.api.app.membership.packages');
            Route::get('/mindset', [CustomerAppMembershipController::class, 'mindset'])->name('tenant.api.app.membership.mindset');
            Route::post('/mindset', [CustomerAppMembershipController::class, 'storeMindset'])->name('tenant.api.app.membership.mindset.store');
        });

        Route::middleware('auth:sanctum')->prefix('/nutrition/package-checkout')->group(function () {
            Route::post('/preview', [NutritionPackagePurchaseController::class, 'preview'])
                ->name('tenant.api.app.nutrition.package-checkout.preview');
            Route::post('/pay', [NutritionPackagePurchaseController::class, 'checkout'])
                ->name('tenant.api.app.nutrition.package-checkout.pay');
            Route::get('/summary', [NutritionPackagePurchaseController::class, 'mySummary'])
                ->name('tenant.api.app.nutrition.package-checkout.summary');
        });
        Route::middleware('auth:sanctum')->prefix('/nutrition/iap/cafebazaar')->group(function () {
            Route::get('/settings', [NutritionCafeBazaarPurchaseController::class, 'settings'])
                ->name('tenant.api.app.nutrition.iap.cafebazaar.settings');
            Route::get('/packages', [NutritionCafeBazaarPurchaseController::class, 'packages'])
                ->name('tenant.api.app.nutrition.iap.cafebazaar.packages');
            Route::post('/package-orders', [NutritionCafeBazaarPurchaseController::class, 'createOrder'])
                ->name('tenant.api.app.nutrition.iap.cafebazaar.orders.create');
            Route::post('/package-orders/{order}/verify', [NutritionCafeBazaarPurchaseController::class, 'verify'])
                ->name('tenant.api.app.nutrition.iap.cafebazaar.orders.verify');
            Route::post('/purchases/recover', [NutritionCafeBazaarPurchaseController::class, 'recover'])
                ->name('tenant.api.app.nutrition.iap.cafebazaar.purchases.recover');
            Route::post('/purchases/consumed', [NutritionCafeBazaarPurchaseController::class, 'markConsumed'])
                ->name('tenant.api.app.nutrition.iap.cafebazaar.purchases.consumed');
        });

        Route::middleware('auth:sanctum')->prefix('/nutrition')->group(function () {
            Route::get('/profile', [CustomerAppNutritionProfileController::class, 'show'])->name('tenant.api.app.nutrition.profile.show');
            Route::get('/diet-templates', [NutritionDietTemplateController::class, 'publicIndex'])->name('tenant.api.app.nutrition.diet-templates.index');
            Route::get('/diet-requests/options', [CustomerAppDietRequestController::class, 'options'])->name('tenant.api.app.nutrition.diet-requests.options');
            Route::post('/diet-requests/preview', [CustomerAppDietRequestController::class, 'preview'])->name('tenant.api.app.nutrition.diet-requests.preview');
            Route::get('/diet-requests', [CustomerAppDietRequestController::class, 'index'])->name('tenant.api.app.nutrition.diet-requests.index');
            Route::post('/diet-requests', [CustomerAppDietRequestController::class, 'store'])->name('tenant.api.app.nutrition.diet-requests.store');
            Route::get('/exercises', [NutritionExerciseCatalogController::class, 'index'])->name('tenant.api.app.nutrition.exercises.index');
            Route::get('/prescriptions', [NutritionDietPrescriptionController::class, 'index'])->name('tenant.api.app.nutrition.prescriptions.index');
            Route::get('/prescriptions/current', [NutritionDietPrescriptionController::class, 'current'])->name('tenant.api.app.nutrition.prescriptions.current');
            Route::get('/prescriptions/{nutritionDietPrescription}', [NutritionDietPrescriptionController::class, 'show'])->name('tenant.api.app.nutrition.prescriptions.show');
            Route::post('/prescriptions/current/meal-log', [NutritionDietPrescriptionController::class, 'storeMealLog'])->name('tenant.api.app.nutrition.prescriptions.current.meal-log');
            Route::delete('/prescriptions/current/meal-log/{mealLogId}', [NutritionDietPrescriptionController::class, 'deleteMealLog'])->name('tenant.api.app.nutrition.prescriptions.current.meal-log.delete');
            Route::post('/prescriptions/current/meal-replacement-suggestions', [NutritionDietPrescriptionController::class, 'generateMealReplacementSuggestions'])->name('tenant.api.app.nutrition.prescriptions.current.meal-replacement-suggestions');
            Route::post('/prescriptions/current/meal-replacement-suggestions/{mealSuggestion}/cancel', [NutritionDietPrescriptionController::class, 'cancelMealReplacementSuggestions'])->name('tenant.api.app.nutrition.prescriptions.current.meal-replacement-suggestions.cancel');
            Route::post('/prescriptions/current/other-meal-photo-analysis', [NutritionDietPrescriptionController::class, 'analyzeOtherMealPhoto'])->name('tenant.api.app.nutrition.prescriptions.current.other-meal-photo-analysis');
            Route::post('/prescriptions/current/other-meal-log', [NutritionDietPrescriptionController::class, 'storeOtherMealLog'])->name('tenant.api.app.nutrition.prescriptions.current.other-meal-log');
            Route::delete('/prescriptions/current/other-meal-log/{mealLogId}', [NutritionDietPrescriptionController::class, 'deleteOtherMealLog'])->name('tenant.api.app.nutrition.prescriptions.current.other-meal-log.delete');
            Route::post('/prescriptions/current/water-log', [NutritionDietPrescriptionController::class, 'storeWaterLog'])->name('tenant.api.app.nutrition.prescriptions.current.water-log');
            Route::post('/prescriptions/current/exercise-log', [NutritionDietPrescriptionController::class, 'storeExerciseLog'])->name('tenant.api.app.nutrition.prescriptions.current.exercise-log');
            Route::delete('/prescriptions/current/exercise-log/{exerciseLogId}', [NutritionDietPrescriptionController::class, 'deleteExerciseLog'])->name('tenant.api.app.nutrition.prescriptions.current.exercise-log.delete');
        });

        Route::middleware('auth:sanctum')->prefix('/notifications')->group(function () {
            Route::get('/', [UserNotificationController::class, 'index'])->name('tenant.api.app.notifications.index');
            Route::get('/unread-count', [UserNotificationController::class, 'unreadCount'])->name('tenant.api.app.notifications.unread-count');
            Route::post('/read-all', [UserNotificationController::class, 'markAllRead'])->name('tenant.api.app.notifications.read-all');
            Route::get('/{notification}', [UserNotificationController::class, 'show'])->whereNumber('notification')->name('tenant.api.app.notifications.show');
            Route::post('/{notification}/read', [UserNotificationController::class, 'markRead'])->whereNumber('notification')->name('tenant.api.app.notifications.read');
        });

        Route::middleware(['auth:sanctum', 'tenant.module:online-chat'])->prefix('/online-chat')->group(function () {
            Route::get('/conversation', [CustomerAppOnlineChatController::class, 'show'])->name('tenant.api.app.online-chat.conversation.show');
            Route::get('/conversation/summary', [CustomerAppOnlineChatController::class, 'summary'])->name('tenant.api.app.online-chat.conversation.summary');
            Route::post('/messages', [CustomerAppOnlineChatController::class, 'sendMessage'])->name('tenant.api.app.online-chat.messages.store');
            Route::post('/conversation/seen', [CustomerAppOnlineChatController::class, 'markSeen'])->name('tenant.api.app.online-chat.conversation.seen');
            Route::get('/attachments/{attachment}', OnlineChatAttachmentController::class)->name('tenant.api.app.online-chat.attachments.show');
        });
    });

    Route::middleware('auth:sanctum,tenant_web')->prefix('/api/v1/nutrition')->group(function () {
        Route::get('/prescriptions', [NutritionDietPrescriptionController::class, 'index'])->name('tenant.api.nutrition.prescriptions.index');
        Route::get('/prescriptions/current', [NutritionDietPrescriptionController::class, 'current'])->name('tenant.api.nutrition.prescriptions.current');
        Route::get('/prescriptions/{nutritionDietPrescription}', [NutritionDietPrescriptionController::class, 'show'])->name('tenant.api.nutrition.prescriptions.show');
        Route::post('/prescriptions/current/meal-log', [NutritionDietPrescriptionController::class, 'storeMealLog'])->name('tenant.api.nutrition.prescriptions.current.meal-log');
        Route::delete('/prescriptions/current/meal-log/{mealLogId}', [NutritionDietPrescriptionController::class, 'deleteMealLog'])->name('tenant.api.nutrition.prescriptions.current.meal-log.delete');
        Route::post('/prescriptions/current/meal-replacement-suggestions', [NutritionDietPrescriptionController::class, 'generateMealReplacementSuggestions'])->name('tenant.api.nutrition.prescriptions.current.meal-replacement-suggestions');
        Route::post('/prescriptions/current/meal-replacement-suggestions/{mealSuggestion}/cancel', [NutritionDietPrescriptionController::class, 'cancelMealReplacementSuggestions'])->name('tenant.api.nutrition.prescriptions.current.meal-replacement-suggestions.cancel');
        Route::post('/prescriptions/current/other-meal-photo-analysis', [NutritionDietPrescriptionController::class, 'analyzeOtherMealPhoto'])->name('tenant.api.nutrition.prescriptions.current.other-meal-photo-analysis');
        Route::post('/prescriptions/current/other-meal-log', [NutritionDietPrescriptionController::class, 'storeOtherMealLog'])->name('tenant.api.nutrition.prescriptions.current.other-meal-log');
        Route::delete('/prescriptions/current/other-meal-log/{mealLogId}', [NutritionDietPrescriptionController::class, 'deleteOtherMealLog'])->name('tenant.api.nutrition.prescriptions.current.other-meal-log.delete');
        Route::post('/prescriptions/current/water-log', [NutritionDietPrescriptionController::class, 'storeWaterLog'])->name('tenant.api.nutrition.prescriptions.current.water-log');
        Route::get('/exercises', [NutritionExerciseCatalogController::class, 'index'])->name('tenant.api.nutrition.exercises.index');
        Route::post('/prescriptions/current/exercise-log', [NutritionDietPrescriptionController::class, 'storeExerciseLog'])->name('tenant.api.nutrition.prescriptions.current.exercise-log');
        Route::delete('/prescriptions/current/exercise-log/{exerciseLogId}', [NutritionDietPrescriptionController::class, 'deleteExerciseLog'])->name('tenant.api.nutrition.prescriptions.current.exercise-log.delete');
    });

    Route::middleware('auth:sanctum,tenant_web')->prefix('/api/v1/nutrition')->group(function () {
        Route::get('/profile-dashboard', [NutritionProfileDashboardController::class, 'show'])->name('tenant.api.nutrition.profile-dashboard.show');
        Route::get('/profile', [NutritionProfileController::class, 'show'])->name('tenant.api.nutrition.profile.show');
        Route::post('/profile', [NutritionProfileController::class, 'store'])->name('tenant.api.nutrition.profile.store');
        Route::post('/profile/birth-date', [NutritionProfileController::class, 'updateBirthDate'])->name('tenant.api.nutrition.profile.birth-date');
        Route::post('/profile/target-weight', [NutritionProfileController::class, 'updateTargetWeight'])->name('tenant.api.nutrition.profile.target-weight');
        Route::post('/profile/preferences', [NutritionProfileController::class, 'updatePreferences'])->name('tenant.api.nutrition.profile.preferences');
        Route::post('/profile/mindset', [NutritionProfileController::class, 'updateMindset'])->name('tenant.api.nutrition.profile.mindset');
        Route::post('/profile/package-selection', [NutritionProfileController::class, 'updatePackageSelection'])->name('tenant.api.nutrition.profile.package-selection');
        Route::get('/diet-requests', [NutritionDietRequestController::class, 'index'])->name('tenant.api.nutrition.diet-requests.index');
        Route::post('/diet-requests', [NutritionDietRequestController::class, 'store'])->name('tenant.api.nutrition.diet-requests.store');
        Route::get('/tokens/dashboard', [NutritionTokenController::class, 'dashboard'])->name('tenant.api.nutrition.tokens.dashboard');
        Route::get('/tokens/history', [NutritionTokenController::class, 'history'])->name('tenant.api.nutrition.tokens.history');
        Route::post('/tokens/pay', [NutritionTokenController::class, 'pay'])->name('tenant.api.nutrition.tokens.pay');
        Route::get('/diet-templates/public', [NutritionDietTemplateController::class, 'publicIndex'])->name('tenant.api.nutrition.templates.public');
        Route::post('/package-checkout/preview', [NutritionPackagePurchaseController::class, 'preview'])->name('tenant.api.nutrition.package-checkout.preview');
        Route::post('/package-checkout/pay', [NutritionPackagePurchaseController::class, 'checkout'])->name('tenant.api.nutrition.package-checkout.pay');
        Route::get('/package-checkout/summary', [NutritionPackagePurchaseController::class, 'mySummary'])->name('tenant.api.nutrition.package-checkout.summary');
    });

    Route::get('/', [CustomLandingPublicController::class, 'home'])->name('tenant.home');
    Route::get('/s/{code}', SiteController::class)->name('tenant.appointments.public')->where('code', '[A-Za-z0-9]{4}');
    Route::get('/f/{code}', SiteController::class)->name('tenant.customer-feedback.short')->where('code', '[A-Za-z0-9]{4}');
    Route::get('/booking', SiteController::class)->name('tenant.booking');
    Route::get('/gallery', SiteController::class)->name('tenant.gallery');
    Route::get('/about', SiteController::class)->name('tenant.about');
    Route::get('/contact', SiteController::class)->name('tenant.contact');
    Route::get('/articles', SiteController::class)->name('tenant.articles');
    Route::get('/articles/{any}', SiteController::class)->where('any', '.*');
    Route::get('/nutrition', SiteController::class)->name('tenant.nutrition');
    Route::get('/nutrition/{any}', SiteController::class)->where('any', '.*');
    Route::get('/store', SiteController::class)->name('tenant.store');
    Route::get('/store/{any}', SiteController::class)->where('any', '.*');
    Route::middleware('tenant.module:custom-landing')->get('/join/{token}', CustomLandingPublicController::class)->where('token', '[A-Za-z0-9]+')->name('tenant.custom-landing.join');
    Route::middleware('tenant.module:customer-club')->get('/club', SiteController::class)->name('tenant.customer-club');
    Route::get('/support/chat', SiteController::class)->name('tenant.support-chat');
    Route::get('/feedback/{token}', SiteController::class)->name('tenant.customer-feedback');
    Route::get('/landing-preview', SiteController::class)->name('tenant.landing-preview');
    Route::get('/landing-preview/{any}', SiteController::class)->where('any', '.*');
    Route::middleware('tenant.panel.access')->group(function () {
        Route::get('/panel', SiteController::class)->name('tenant.panel');
        Route::get('/panel/{any}', SiteController::class)->where('any', '.*');
        Route::get('/settings', SiteController::class)->name('tenant.settings');
    });
    Route::get('/support-renewal/callback', [SupportRenewalController::class, 'callback'])->name('tenant.support-renewal.callback');
    Route::get('/domain-renewal/callback', [DomainRenewalController::class, 'callback'])->name('tenant.domain-renewal.callback');
    Route::get('/nutrition-package-payments/{order}/callback', [NutritionPackagePurchaseController::class, 'callback'])->name('tenant.nutrition.package-payments.callback');
    Route::get('/nutrition-token-payments/callback', [NutritionTokenController::class, 'callback'])->name('tenant.nutrition.tokens.callback');
    Route::get('/sms-top-up/callback', [SmsTopUpPaymentController::class, 'callback'])->name('tenant.sms-top-up.callback');
    Route::get('/booking-payments/{payment}/callback', [BookingPaymentController::class, 'callback'])->name('tenant.booking-payments.callback');
    Route::get('/store-payments/{payment}/callback', [StoreOrderController::class, 'callback'])->name('tenant.store-payments.callback');

    Route::get('/admin_login', SiteController::class)->name('tenant.admin.login.alias');

    Route::middleware('guest:tenant_web')->group(function () {
        Route::get('/admin/login', [TenantAdminAuthController::class, 'create'])->name('tenant.admin.login');
        Route::post('/admin/login', [TenantAdminAuthController::class, 'store'])->name('tenant.admin.login.store');
    });
    Route::get('/admin/impersonate', [TenantAdminAuthController::class, 'impersonate'])
        ->middleware('tenant.panel.access')
        ->name('tenant.admin.impersonate');

    Route::middleware(['auth:tenant_web', 'tenant.panel.access'])->group(function () {
        Route::get('/admin', TenantDashboardController::class)->name('tenant.admin.dashboard');
        Route::post('/admin/logout', [TenantAdminAuthController::class, 'destroy'])->name('tenant.admin.logout');
    });
});

Route::middleware([
    'web',
    InitializeTenancyByDomain::class,
    PreventAccessFromCentralDomains::class,
])->prefix('api/v1')->group(function () {
    Route::get('/meta', MetaController::class);
    Route::get('/gallery-images', [GalleryController::class, 'index']);
    Route::get('/settings/appearance', [AppearanceSettingsController::class, 'show']);
    Route::get('/settings/about', [AboutSettingsController::class, 'show']);
    Route::get('/settings/contact', [ContactSettingsController::class, 'show']);
    Route::get('/feature-modules', [FeatureModuleController::class, 'index']);
    Route::get('/store/public-products', [StoreProductController::class, 'publicIndex']);
    Route::get('/store/public-products/{storeProduct}', [StoreProductController::class, 'publicShow']);
    Route::get('/store/public-products/{storeProduct}/reviews', [StoreProductReviewController::class, 'publicIndex']);
    Route::post('/store/public-products/{storeProduct}/reviews', [StoreProductReviewController::class, 'publicStore'])->middleware('auth:tenant_web');
    Route::get('/store/public-categories', [StoreCategoryController::class, 'publicIndex']);
    Route::get('/articles/public-posts', [ArticlePostController::class, 'publicIndex']);
    Route::get('/articles/public-posts/{articleId}', [ArticlePostController::class, 'publicShow']);
    Route::get('/professionals', [BarberController::class, 'index']);
    Route::get('/barbers', [BarberController::class, 'index']);
    Route::get('/services', [ServiceController::class, 'index']);
    Route::post('/messaging-bots/{channel}/webhook', TelegramBotWebhookController::class)->whereIn('channel', ['telegram', 'bale']);
    Route::get('/customer-feedback/public/{token}', [CustomerFeedbackController::class, 'publicShow']);
    Route::post('/customer-feedback/public/{token}/submit', [CustomerFeedbackController::class, 'publicSubmit']);
    Route::middleware(['auth:tenant_web', 'tenant.module:custom-landing'])->post('/custom-landing/app-token', [CustomLandingController::class, 'issueAppToken']);
    Route::middleware('tenant.module:cooking-recipes')->group(function () {
        Route::get('/cooking-recipes', [CookingRecipeController::class, 'index']);
        Route::get('/cooking-recipes/{recipe}', [CookingRecipeController::class, 'show'])
            ->where('recipe', '^(?!admin$)[A-Za-z0-9\-_]+$');
    });
    Route::middleware(['auth:tenant_web', 'tenant.panel.access', 'tenant.storage', 'tenant.support'])->group(function () {
        Route::get('/store/dashboard', StoreDashboardController::class);
        Route::get('/finance/dashboard', FinanceDashboardController::class);
        Route::get('/manual-finance/dashboard', [ManualFinanceController::class, 'dashboard']);
        Route::get('/manual-finance/debtors', [ManualFinanceController::class, 'debtors']);
        Route::post('/manual-finance/commission-report', [ManualFinanceController::class, 'commissionReport']);
        Route::post('/manual-finance/customer-summaries', [ManualFinanceController::class, 'customerSummaries']);
        Route::post('/manual-finance/entries', [ManualFinanceController::class, 'store']);
        Route::delete('/manual-finance/entries/{entryId}', [ManualFinanceController::class, 'destroy']);
        Route::post('/manual-finance/categories', [ManualFinanceController::class, 'storeCategory']);
        Route::put('/manual-finance/categories/{categoryId}', [ManualFinanceController::class, 'updateCategory']);
        Route::delete('/manual-finance/categories/{categoryId}', [ManualFinanceController::class, 'destroyCategory']);
        Route::get('/store/settings/general', [StoreSettingsController::class, 'showGeneral']);
        Route::put('/store/settings/general', [StoreSettingsController::class, 'updateGeneral']);
        Route::get('/store/settings/home', [StoreSettingsController::class, 'showHome']);
        Route::put('/store/settings/home', [StoreSettingsController::class, 'updateHome']);
        Route::post('/store/settings/home/banner', [StoreSettingsController::class, 'updateHomeBanner']);
        Route::get('/articles/settings', [ArticleSettingsController::class, 'showSettings']);
        Route::put('/articles/settings', [ArticleSettingsController::class, 'updateSettings']);
        Route::get('/articles/posts', [ArticlePostController::class, 'index']);
        Route::post('/articles/posts', [ArticlePostController::class, 'store']);
        Route::put('/articles/posts/{postId}', [ArticlePostController::class, 'update']);
        Route::post('/articles/posts/{postId}', [ArticlePostController::class, 'update']);
        Route::delete('/articles/posts/{postId}', [ArticlePostController::class, 'destroy']);
        Route::get('/articles/categories', [ArticleSettingsController::class, 'listCategories']);
        Route::post('/articles/categories', [ArticleSettingsController::class, 'storeCategory']);
        Route::put('/articles/categories/{categoryId}', [ArticleSettingsController::class, 'updateCategory']);
        Route::delete('/articles/categories/{categoryId}', [ArticleSettingsController::class, 'destroyCategory']);
        Route::get('/articles/tags', [ArticleSettingsController::class, 'listTags']);
        Route::post('/articles/tags', [ArticleSettingsController::class, 'storeTag']);
        Route::put('/articles/tags/{tagId}', [ArticleSettingsController::class, 'updateTag']);
        Route::delete('/articles/tags/{tagId}', [ArticleSettingsController::class, 'destroyTag']);
        Route::get('/help/topics', [HelpTopicController::class, 'index']);
        Route::get('/help/topic', [HelpTopicController::class, 'show']);
        Route::get('/store/settings/faq', [StoreSettingsController::class, 'showFaq']);
        Route::put('/store/settings/faq', [StoreSettingsController::class, 'updateFaq']);
        Route::get('/store/settings/shipping', [StoreSettingsController::class, 'showShipping']);
        Route::put('/store/settings/shipping', [StoreSettingsController::class, 'updateShipping']);
        Route::get('/store/categories', [StoreCategoryController::class, 'index']);
        Route::post('/store/categories', [StoreCategoryController::class, 'store']);
        Route::post('/store/categories/{storeCategory}', [StoreCategoryController::class, 'update']);
        Route::delete('/store/categories/{storeCategory}', [StoreCategoryController::class, 'destroy']);
        Route::get('/store/products', [StoreProductController::class, 'index']);
        Route::get('/store/products/{storeProduct}/reviews', [StoreProductReviewController::class, 'index']);
        Route::get('/store/product-reviews', [StoreProductReviewController::class, 'adminIndex']);
        Route::get('/store/admin-orders', [StoreOrderController::class, 'adminIndex']);
        Route::get('/store/admin-orders/{storeOrder}', [StoreOrderController::class, 'adminShow']);
        Route::post('/store/admin-orders/{storeOrder}', [StoreOrderController::class, 'adminUpdate']);
        Route::post('/store/admin-orders/{storeOrder}/send-sms', [StoreOrderController::class, 'adminSendSms']);
        Route::post('/store/products', [StoreProductController::class, 'store']);
        Route::post('/store/products/{storeProduct}', [StoreProductController::class, 'update']);
        Route::delete('/store/products/{storeProduct}', [StoreProductController::class, 'destroy']);
        Route::post('/store/product-reviews/{storeProductReview}/moderate', [StoreProductReviewController::class, 'moderate']);
        Route::delete('/store/product-reviews/{storeProductReview}', [StoreProductReviewController::class, 'destroy']);
        Route::post('/settings/general/enamad-verification-file', [GeneralSettingsController::class, 'createEnamadVerificationFile']);
        Route::get('/booking-closure', [AppointmentBookingClosureController::class, 'show']);
        Route::post('/booking-closure/close', [AppointmentBookingClosureController::class, 'close']);
        Route::post('/booking-closure/open', [AppointmentBookingClosureController::class, 'open']);
        Route::post('/booking-closure/notifications/start', [AppointmentBookingClosureController::class, 'startNotifications']);
        Route::post('/booking-closure/notifications/pause', [AppointmentBookingClosureController::class, 'pauseNotifications']);
        Route::get('/messaging-bots/settings', [MessagingBotSettingsController::class, 'show']);
        Route::put('/messaging-bots/settings', [MessagingBotSettingsController::class, 'update']);
        Route::post('/messaging-bots/settings', [MessagingBotSettingsController::class, 'update']);
        Route::post('/messaging-bots/{channel}/set-webhook', [MessagingBotSettingsController::class, 'setWebhook'])->whereIn('channel', ['telegram', 'bale']);
        Route::get('/messaging-bots/{channel}/webhook-info', [MessagingBotSettingsController::class, 'webhookInfo'])->whereIn('channel', ['telegram', 'bale']);
        Route::get('/users', [TenantUserController::class, 'index']);
        Route::get('/gallery-images/admin', [GalleryController::class, 'adminIndex']);
        Route::put('/gallery-images/settings', [GalleryController::class, 'updateSettings']);
        Route::post('/gallery-images', [GalleryController::class, 'store']);
        Route::put('/gallery-images/{galleryImage}', [GalleryController::class, 'update']);
        Route::delete('/gallery-images/{galleryImage}', [GalleryController::class, 'destroy']);
        Route::post('/settings/appearance', [AppearanceSettingsController::class, 'update']);
        Route::post('/settings/about', [AboutSettingsController::class, 'update']);
        Route::post('/settings/contact', [ContactSettingsController::class, 'update']);
        Route::post('/feature-modules/{featureModule}/preview-activation', [FeatureModuleController::class, 'previewActivation']);
        Route::post('/feature-modules/{featureModule}/activate', [FeatureModuleController::class, 'activate']);
        Route::get('/users/lookup', [TenantUserController::class, 'lookup']);
        Route::get('/users/{mobile}/appointments', [TenantUserController::class, 'appointments']);
        Route::put('/users/{mobile}', [TenantUserController::class, 'updateIdentity']);
        Route::delete('/users/{mobile}', [TenantUserController::class, 'destroy']);
        Route::put('/users/{mobile}/booking-access', [TenantUserController::class, 'updateBookingAccess']);
        Route::put('/users/{mobile}/vip-access', [TenantUserController::class, 'updateVipAccess'])->middleware('tenant.module:vip-customers');
        Route::get('/customer-feedback/settings', [CustomerFeedbackController::class, 'show']);
        Route::put('/customer-feedback/settings', [CustomerFeedbackController::class, 'update']);
        Route::get('/customer-feedback/report', [CustomerFeedbackController::class, 'report']);
        Route::get('/customer-feedback/report/responses/{response}', [CustomerFeedbackController::class, 'reportResponse']);
        Route::post('/customer-feedback/questions', [CustomerFeedbackController::class, 'storeQuestion']);
        Route::put('/customer-feedback/questions/{question}', [CustomerFeedbackController::class, 'updateQuestion']);
        Route::delete('/customer-feedback/questions/{question}', [CustomerFeedbackController::class, 'destroyQuestion']);
        Route::middleware('tenant.module:customer-club')->group(function () {
            Route::get('/customer-club/admin', [CustomerClubController::class, 'adminOverview']);
            Route::put('/customer-club/settings', [CustomerClubController::class, 'updateSettings']);
            Route::get('/customer-club/members', [CustomerClubController::class, 'members']);
            Route::post('/customer-club/members/{user}/adjust', [CustomerClubController::class, 'adjustMember']);
            Route::post('/customer-club/tiers', [CustomerClubController::class, 'storeTier']);
            Route::put('/customer-club/tiers/{tier}', [CustomerClubController::class, 'updateTier']);
            Route::delete('/customer-club/tiers/{tier}', [CustomerClubController::class, 'destroyTier']);
            Route::post('/customer-club/rewards', [CustomerClubController::class, 'storeReward']);
            Route::put('/customer-club/rewards/{reward}', [CustomerClubController::class, 'updateReward']);
            Route::delete('/customer-club/rewards/{reward}', [CustomerClubController::class, 'destroyReward']);
        });
        Route::middleware('tenant.module:cooking-recipes')->group(function () {
            Route::get('/cooking-recipes/admin', [CookingRecipeController::class, 'adminIndex']);
            Route::get('/cooking-recipes/admin/{cookingRecipe}', [CookingRecipeController::class, 'adminShow']);
            Route::put('/cooking-recipes/admin/{cookingRecipe}', [CookingRecipeController::class, 'adminUpdate']);
        });
        Route::middleware('tenant.module:custom-landing')->group(function () {
            Route::get('/custom-landing', [CustomLandingController::class, 'overview']);
            Route::get('/custom-landing/settings', [CustomLandingController::class, 'settings']);
            Route::put('/custom-landing/settings', [CustomLandingController::class, 'updateSettings']);
            Route::post('/custom-landing/settings/logo', [CustomLandingController::class, 'updateLogo']);
            Route::post('/custom-landing/partners', [CustomLandingController::class, 'storePartner']);
            Route::get('/custom-landing/partners/{partner}', [CustomLandingController::class, 'showPartner']);
            Route::put('/custom-landing/partners/{partner}', [CustomLandingController::class, 'updatePartner']);
            Route::delete('/custom-landing/partners/{partner}', [CustomLandingController::class, 'destroyPartner']);
            Route::post('/custom-landing/partners/{partner}/settlements', [CustomLandingController::class, 'settle']);
            Route::delete('/custom-landing/commissions/{commission}', [CustomLandingController::class, 'reverseCommission']);
            Route::delete('/custom-landing/settlements/{settlement}', [CustomLandingController::class, 'destroySettlement']);
            Route::delete('/custom-landing/attributions/{attribution}', [CustomLandingController::class, 'destroyAttribution']);
        });
        Route::get('/nutrition/diet-requests/admin', [NutritionDietRequestController::class, 'adminIndex']);
        Route::get('/nutrition/diet-requests/admin/settings', [NutritionDietRequestController::class, 'adminSettings']);
        Route::put('/nutrition/diet-requests/admin/settings', [NutritionDietRequestController::class, 'updateAdminSettings']);
        Route::get('/nutrition/diet-requests/admin/{nutritionDietRequest}', [NutritionDietRequestController::class, 'adminShow']);
        Route::put('/nutrition/diet-requests/admin/{nutritionDietRequest}/ai-usage-limits', [NutritionDietRequestController::class, 'adminUpdateAiUsageLimits']);
        Route::delete('/nutrition/diet-requests/admin/{nutritionDietRequest}', [NutritionDietRequestController::class, 'adminDestroy']);
        Route::post('/nutrition/diet-requests/admin/{nutritionDietRequest}/meal-replacement-suggestions', [NutritionDietRequestController::class, 'adminGenerateMealReplacementSuggestion']);
        Route::delete('/nutrition/diet-requests/admin/{nutritionDietRequest}/meal-replacement-suggestions/{mealSuggestion}', [NutritionDietRequestController::class, 'adminDeleteMealReplacementSuggestion']);
        Route::post('/nutrition/diet-requests/admin/{nutritionDietRequest}/meal-replacement-suggestions/{mealSuggestion}/cancel', [NutritionDietRequestController::class, 'adminCancelMealReplacementSuggestion']);
        Route::post('/nutrition/diet-requests/admin/{nutritionDietRequest}/meal-replacement-suggestions/{mealSuggestion}/regenerate', [NutritionDietRequestController::class, 'adminRegenerateMealReplacementSuggestion']);
        Route::put('/nutrition/diet-requests/admin/{nutritionDietRequest}/meal-replacement-suggestions/{mealSuggestion}/options', [NutritionDietRequestController::class, 'adminUpdateMealReplacementSuggestionOption']);
        Route::post('/nutrition/diet-requests/admin/{nutritionDietRequest}/manual-edit', [NutritionDietRequestController::class, 'adminManualEditPrescriptionItem']);
        Route::put('/nutrition/diet-requests/admin/{nutritionDietRequest}/prescriptions/{nutritionDietPrescription}/dates', [NutritionDietRequestController::class, 'adminUpdatePrescriptionDates']);
        Route::post('/nutrition/diet-requests/admin/{nutritionDietRequest}/approve-delivery', [NutritionDietRequestController::class, 'adminApproveGeneratedPrescription']);
        Route::post('/nutrition/diet-requests/admin/{nutritionDietRequest}/send-expert-file', [NutritionDietRequestController::class, 'adminSendExpertFilePrescription']);
        Route::delete('/nutrition/diet-requests/admin/{nutritionDietRequest}/expert-file', [NutritionDietRequestController::class, 'adminDeleteExpertFilePrescription']);
        Route::post('/nutrition/admin-prescribe/profile', [NutritionAdminUserController::class, 'savePrescribeProfile']);
        Route::post('/nutrition/admin-prescribe/request', [NutritionAdminUserController::class, 'createDietRequest']);
        Route::get('/nutrition/admin-users/{mobile}', [NutritionAdminUserController::class, 'show']);
        Route::post('/nutrition/admin-users/{mobile}/grant-package', [NutritionAdminUserController::class, 'grantPackage']);
        Route::put('/nutrition/admin-users/{mobile}/subscriptions/{subscription}/dates', [NutritionAdminUserController::class, 'updateSubscriptionDates']);
        Route::post('/nutrition/admin-users/{mobile}/subscriptions/{subscription}/credits', [NutritionAdminUserController::class, 'adjustSubscriptionCredits']);
        Route::post('/nutrition/admin-users/{mobile}/access', [NutritionAdminUserController::class, 'updateAccess']);
        Route::post('/nutrition/diet-requests/{nutritionDietRequest}/generate-ai', [NutritionAiDietRequestController::class, 'queue']);
        Route::post('/nutrition/diet-requests/{nutritionDietRequest}/cancel-ai', [NutritionAiDietRequestController::class, 'cancel']);
        Route::get('/nutrition/landing-settings', [NutritionLandingSettingsController::class, 'show']);
        Route::put('/nutrition/landing-settings', [NutritionLandingSettingsController::class, 'update']);
        Route::post('/nutrition/landing-settings/booking-banner/image', [NutritionLandingSettingsController::class, 'updateBookingBannerImage']);
        Route::post('/nutrition/landing-settings/{variant}/image', [NutritionLandingSettingsController::class, 'updateImage']);
        Route::get('/nutrition/settings', [NutritionSettingsController::class, 'show']);
        Route::put('/nutrition/settings', [NutritionSettingsController::class, 'update']);
        Route::get('/support-tickets', [SupportTicketController::class, 'index']);
        Route::post('/support-tickets', [SupportTicketController::class, 'store']);
        Route::get('/support-tickets/{ticket}', [SupportTicketController::class, 'show']);
        Route::post('/support-tickets/{ticket}/reply', [SupportTicketController::class, 'reply']);
        Route::post('/support-tickets/{ticket}/close', [SupportTicketController::class, 'close']);
        Route::post('/support-tickets/{ticket}/seen', [SupportTicketController::class, 'markSeen']);
        Route::get('/sms-campaigns', [SmsCampaignController::class, 'index']);
        Route::post('/sms-campaigns/preview', [SmsCampaignController::class, 'preview']);
        Route::post('/sms-campaigns', [SmsCampaignController::class, 'store']);
        Route::put('/sms-campaigns/{campaign}', [SmsCampaignController::class, 'update']);
        Route::get('/sms-campaigns/{campaign}', [SmsCampaignController::class, 'show']);
        Route::post('/sms-campaigns/{campaign}/cancel', [SmsCampaignController::class, 'cancel']);
        Route::get('/domain-renewal', [DomainRenewalController::class, 'overview']);
        Route::get('/domain-renewal/history', [DomainRenewalController::class, 'history']);
        Route::post('/domain-renewal/pay', [DomainRenewalController::class, 'store']);
        Route::get('/sms-outbounds', [SmsOutboundController::class, 'index']);
        Route::post('/sms-outbounds/send-single', [SmsOutboundController::class, 'sendSingle']);
        Route::post('/sms-outbounds/send-bulk', [SmsOutboundController::class, 'sendBulk']);
        Route::get('/notification-campaigns', [NotificationCampaignController::class, 'index']);
        Route::post('/notification-campaigns/preview', [NotificationCampaignController::class, 'preview']);
        Route::post('/notification-campaigns', [NotificationCampaignController::class, 'store']);
        Route::get('/notification-campaigns/{campaign}', [NotificationCampaignController::class, 'show']);
        Route::post('/professionals', [BarberController::class, 'store']);
        Route::put('/professionals/{barber}', [BarberController::class, 'update']);
        Route::delete('/professionals/{barber}', [BarberController::class, 'destroy']);
        Route::post('/barbers', [BarberController::class, 'store']);
        Route::put('/barbers/{barber}', [BarberController::class, 'update']);
        Route::delete('/barbers/{barber}', [BarberController::class, 'destroy']);
        Route::post('/services', [ServiceController::class, 'store']);
        Route::put('/services/{service}', [ServiceController::class, 'update']);
        Route::delete('/services/{service}', [ServiceController::class, 'destroy']);
    });
    Route::get('/appointments', [AppointmentController::class, 'index']);
    Route::get('/appointments/public/{code}', [AppointmentController::class, 'publicShow'])->where('code', '[A-Za-z0-9]{4}');
    Route::get('/support-renewal/public-packages', [SupportRenewalController::class, 'publicPackages']);
    Route::middleware(['auth:tenant_web'])->group(function () {
        Route::get('/notifications', [UserNotificationController::class, 'index']);
        Route::get('/notifications/unread-count', [UserNotificationController::class, 'unreadCount']);
        Route::post('/notifications/read-all', [UserNotificationController::class, 'markAllRead']);
        Route::get('/notifications/{notification}', [UserNotificationController::class, 'show'])->whereNumber('notification');
        Route::post('/notifications/{notification}/read', [UserNotificationController::class, 'markRead'])->whereNumber('notification');
        Route::middleware('tenant.module:online-chat')->group(function () {
            Route::get('/online-chat/conversation', [OnlineChatController::class, 'show']);
            Route::get('/online-chat/conversation/summary', [OnlineChatController::class, 'summary']);
            Route::post('/online-chat/messages', [OnlineChatController::class, 'sendMessage']);
            Route::post('/online-chat/conversation/seen', [OnlineChatController::class, 'markSeen']);
        });
    });
    Route::middleware(['auth:tenant_web', 'tenant.panel.access', 'tenant.storage'])->group(function () {
        Route::middleware('tenant.module:online-chat')->group(function () {
            Route::get('/online-chat/settings', [OnlineChatSettingsController::class, 'show']);
            Route::put('/online-chat/settings', [OnlineChatSettingsController::class, 'update']);
        });
        Route::get('/specialized-courses/home', [SpecializedCourseCatalogController::class, 'home']);
        Route::get('/nutrition/packages', [NutritionPackageController::class, 'index']);
        Route::post('/nutrition/packages', [NutritionPackageController::class, 'store']);
        Route::put('/nutrition/packages/{nutritionPackage}', [NutritionPackageController::class, 'update']);
        Route::delete('/nutrition/packages/{nutritionPackage}', [NutritionPackageController::class, 'destroy']);
        Route::get('/nutrition/discount-codes', [NutritionDiscountCodeController::class, 'index']);
        Route::post('/nutrition/discount-codes', [NutritionDiscountCodeController::class, 'store']);
        Route::put('/nutrition/discount-codes/{nutritionDiscountCode}', [NutritionDiscountCodeController::class, 'update']);
        Route::delete('/nutrition/discount-codes/{nutritionDiscountCode}', [NutritionDiscountCodeController::class, 'destroy']);
        Route::get('/nutrition/package-orders', [NutritionPackagePurchaseController::class, 'adminOrders']);
        Route::middleware('tenant.module:online-chat')->group(function () {
            Route::get('/online-chat/admin/conversations', [OnlineChatAdminController::class, 'index']);
            Route::get('/online-chat/admin/conversations/{conversation}', [OnlineChatAdminController::class, 'show']);
            Route::post('/online-chat/admin/conversations/{conversation}/messages', [OnlineChatAdminController::class, 'sendMessage']);
            Route::post('/online-chat/admin/conversations/{conversation}/seen', [OnlineChatAdminController::class, 'markSeen']);
            Route::post('/online-chat/admin/conversations/{conversation}/close', [OnlineChatAdminController::class, 'close']);
            Route::post('/online-chat/admin/conversations/{conversation}/reopen', [OnlineChatAdminController::class, 'reopen']);
        });
        Route::get('/nutrition/templates', [NutritionDietTemplateController::class, 'index']);
        Route::post('/nutrition/templates', [NutritionDietTemplateController::class, 'store']);
        Route::put('/nutrition/templates/{nutritionDietTemplate}', [NutritionDietTemplateController::class, 'update']);
        Route::delete('/nutrition/templates/{nutritionDietTemplate}', [NutritionDietTemplateController::class, 'destroy']);
        Route::get('/nutrition/audio-guidance-assets', [NutritionAudioGuidanceController::class, 'index']);
        Route::post('/nutrition/audio-guidance-assets', [NutritionAudioGuidanceController::class, 'store']);
        Route::put('/nutrition/audio-guidance-assets/{assetId}', [NutritionAudioGuidanceController::class, 'update']);
        Route::delete('/nutrition/audio-guidance-assets/{assetId}', [NutritionAudioGuidanceController::class, 'destroy']);
        Route::get('/nutrition/diet-files', [NutritionDietFileController::class, 'index']);
        Route::post('/nutrition/diet-files', [NutritionDietFileController::class, 'store']);
        Route::put('/nutrition/diet-files/{dietFileId}', [NutritionDietFileController::class, 'update']);
        Route::delete('/nutrition/diet-files/{dietFileId}', [NutritionDietFileController::class, 'destroy']);
        Route::post('/nutrition/diet-files/groups', [NutritionDietFileController::class, 'storeGroup']);
        Route::delete('/nutrition/diet-files/groups/{groupId}', [NutritionDietFileController::class, 'destroyGroup']);
        Route::get('/nutrition/ai-prompt-presets', [NutritionAiPromptPresetController::class, 'index']);
        Route::post('/nutrition/ai-prompt-presets', [NutritionAiPromptPresetController::class, 'store']);
        Route::put('/nutrition/ai-prompt-presets/{presetId}', [NutritionAiPromptPresetController::class, 'update']);
        Route::delete('/nutrition/ai-prompt-presets/{presetId}', [NutritionAiPromptPresetController::class, 'destroy']);
        Route::get('/nutrition/exercise-library', [NutritionExerciseAdminController::class, 'index']);
        Route::post('/nutrition/exercise-library/groups', [NutritionExerciseAdminController::class, 'storeGroup']);
        Route::put('/nutrition/exercise-library/groups/{groupId}', [NutritionExerciseAdminController::class, 'updateGroup']);
        Route::delete('/nutrition/exercise-library/groups/{groupId}', [NutritionExerciseAdminController::class, 'destroyGroup']);
        Route::post('/nutrition/exercise-library/items', [NutritionExerciseAdminController::class, 'storeExercise']);
        Route::put('/nutrition/exercise-library/items/{exerciseId}', [NutritionExerciseAdminController::class, 'updateExercise']);
        Route::delete('/nutrition/exercise-library/items/{exerciseId}', [NutritionExerciseAdminController::class, 'destroyExercise']);
        Route::get('/appointments/recent-bookings', [AppointmentController::class, 'recentBookings']);
        Route::get('/appointments/transient-alerts', [AppointmentController::class, 'transientAlerts']);
        Route::get('/support-renewal/packages', [SupportRenewalController::class, 'packages']);
        Route::get('/support-renewal/history', [SupportRenewalController::class, 'history']);
        Route::post('/support-renewal/preview', [SupportRenewalController::class, 'preview']);
        Route::post('/support-renewal/pay', [SupportRenewalController::class, 'store']);
        Route::post('/support-renewal/storage/preview', [SupportRenewalController::class, 'storagePreview']);
        Route::post('/support-renewal/storage/pay', [SupportRenewalController::class, 'storageStore']);
        Route::get('/files', [TenantFileManagerController::class, 'index']);
        Route::delete('/files/{encodedPath}', [TenantFileManagerController::class, 'destroy'])->where('encodedPath', '.*');
        Route::post('/files/storage/preview', [SupportRenewalController::class, 'storagePreview']);
        Route::post('/files/storage/pay', [SupportRenewalController::class, 'storageStore']);
        Route::post('/sms-top-up/pay', [SmsTopUpPaymentController::class, 'store']);
        Route::middleware('tenant.module:customer-club')->group(function () {
            Route::get('/customer-club/me', [CustomerClubController::class, 'me']);
            Route::post('/customer-club/rewards/{reward}/redeem', [CustomerClubController::class, 'redeemReward']);
        });
        Route::get('/nutrition/public-packages', [NutritionPackageController::class, 'publicIndex']);
        Route::get('/store/orders', [StoreOrderController::class, 'myOrders']);
        Route::get('/store/orders/{storeOrder}', [StoreOrderController::class, 'showMyOrder']);
        Route::post('/store/orders/checkout', [StoreOrderController::class, 'checkout']);
        Route::get('/referrals', [ReferralController::class, 'index']);
        Route::post('/referrals', [ReferralController::class, 'store']);
    });
    Route::middleware(['auth:tenant_web', 'tenant.panel.access', 'tenant.storage', 'tenant.support'])->group(function () {
        Route::get('/appointments/mine', [AppointmentController::class, 'mine']);
        Route::get('/appointments/{appointment}', [AppointmentController::class, 'show'])->whereNumber('appointment');
        Route::get('/appointments/latest-bookings', [AppointmentController::class, 'latestBookings']);
        Route::get('/appointments/daily-report/export', [AppointmentController::class, 'exportDailyReport']);
        Route::post('/booking-payments/checkout', [BookingPaymentController::class, 'checkout']);
        Route::post('/appointments', [AppointmentController::class, 'store']);
        Route::post('/appointments/{appointment}/change-time', [AppointmentController::class, 'changeTime'])->whereNumber('appointment');
        Route::post('/appointments/{appointment}/attendance', [AppointmentController::class, 'updateAttendance']);
        Route::post('/appointments/{appointment}/cancel', [AppointmentController::class, 'cancel']);
        Route::post('/appointments/bulk-cancel', [AppointmentController::class, 'bulkCancel']);
    });
    Route::get('/settings/general', [GeneralSettingsController::class, 'show']);
    Route::get('/booking-closure/public', [AppointmentBookingClosureController::class, 'show']);
    Route::post('/booking-closure/subscribe', [AppointmentBookingClosureController::class, 'subscribe'])->middleware('auth:tenant_web');
    Route::middleware(['auth:tenant_web', 'tenant.support'])->group(function () {
        Route::put('/settings/general', [GeneralSettingsController::class, 'update']);
    });
});
