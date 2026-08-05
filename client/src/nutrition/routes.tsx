import { Route } from "wouter";
import NutritionMembershipAuthPage from "@/nutrition/pages/nutrition-membership-auth";
import NutritionMembershipActivityPage from "@/nutrition/pages/nutrition-membership-activity";
import NutritionMembershipBirthDatePage from "@/nutrition/pages/nutrition-membership-birth-date";
import NutritionMembershipCompletePage from "@/nutrition/pages/nutrition-membership-complete";
import NutritionMembershipDislikedFoodsPage from "@/nutrition/pages/nutrition-membership-disliked-foods";
import NutritionMembershipGoalPage from "@/nutrition/pages/nutrition-membership-goal";
import NutritionMembershipHeightPage from "@/nutrition/pages/nutrition-membership-height";
import NutritionMembershipAllergiesPage from "@/nutrition/pages/nutrition-membership-allergies";
import NutritionMembershipMedicalConditionsPage from "@/nutrition/pages/nutrition-membership-medical-conditions";
import NutritionMembershipMedicationsAndSupplementsPage from "@/nutrition/pages/nutrition-membership-medications-and-supplements";
import NutritionMembershipMindsetPage from "@/nutrition/pages/nutrition-membership-mindset";
import NutritionMembershipPackagesPage from "@/nutrition/pages/nutrition-membership-packages";
import NutritionMembershipPackageSelectPage from "@/nutrition/pages/nutrition-membership-package-select";
import NutritionMembershipPackageResultPage from "@/nutrition/pages/nutrition-membership-package-result";
import NutritionMembershipMyPackagePage from "@/nutrition/pages/nutrition-membership-my-package";
import NutritionMembershipReviewPage from "@/nutrition/pages/nutrition-membership-review";
import NutritionMembershipTargetWeightPage from "@/nutrition/pages/nutrition-membership-target-weight";
import NutritionMembershipWeightPage from "@/nutrition/pages/nutrition-membership-weight";
import NutritionMembershipGenderPage from "@/nutrition/pages/nutrition-membership-gender";
import NutritionMembershipNextPage from "@/nutrition/pages/nutrition-membership-next";
import NutritionBmiPage from "@/nutrition/pages/nutrition-bmi";
import NutritionSelectDietPage from "@/nutrition/pages/nutrition-select-diet";
import PanelNutritionDiscountsPage from "@/nutrition/pages/panel-nutrition-discounts";
import PanelNutritionPackagesPage from "@/nutrition/pages/panel-nutrition-packages";
import PanelNutritionPackageOrdersPage from "@/nutrition/pages/panel-nutrition-package-orders";
import PanelNutritionRequestsPage from "@/nutrition/pages/panel-nutrition-requests";
import PanelNutritionRequestDetailPage from "@/nutrition/pages/panel-nutrition-request-detail";
import PanelNutritionRequestReplacementsPage from "@/nutrition/pages/panel-nutrition-request-replacements";
import PanelNutritionRequestTrackingPage from "@/nutrition/pages/panel-nutrition-request-tracking";
import PanelNutritionPrescribeSelectUserPage from "@/nutrition/pages/panel-nutrition-prescribe-select-user";
import PanelNutritionPrescribeUserProfilePage from "@/nutrition/pages/panel-nutrition-prescribe-user-profile";
import PanelNutritionPrescribeUserPage from "@/nutrition/pages/panel-nutrition-prescribe-user";
import PanelNutritionPrescribeStepPage from "@/nutrition/pages/panel-nutrition-prescribe-step";
import PanelNutritionPrescribeMindsetPage from "@/nutrition/pages/panel-nutrition-prescribe-mindset";
import PanelNutritionPrescribeReviewPage from "@/nutrition/pages/panel-nutrition-prescribe-review";
import PanelNutritionPrescribePackagesPage from "@/nutrition/pages/panel-nutrition-prescribe-packages";
import PanelNutritionPrescribeModePage from "@/nutrition/pages/panel-nutrition-prescribe-mode";
import PanelNutritionPrescribeTemplatesPage from "@/nutrition/pages/panel-nutrition-prescribe-templates";
import PanelNutritionPrescribeGeneratePage from "@/nutrition/pages/panel-nutrition-prescribe-generate";
import PanelNutritionTemplateCreatePage from "@/nutrition/pages/panel-nutrition-template-create";
import PanelNutritionTemplatesPage from "@/nutrition/pages/panel-nutrition-templates";
import PanelNutritionAudioGuidancePage from "@/nutrition/pages/panel-nutrition-audio-guidance";
import PanelNutritionDietFilesPage from "@/nutrition/pages/panel-nutrition-diet-files";
import PanelNutritionAiPromptPresetsPage from "@/nutrition/pages/panel-nutrition-ai-prompt-presets";
import PanelNutritionExercisesPage from "@/nutrition/pages/panel-nutrition-exercises";
import NutritionWebAppEntryPage from "@/nutrition/pages/nutrition-webapp-entry";
import NutritionPlaceholderPage from "@/nutrition/pages/nutrition-placeholder";
import NutritionProfileHomePage from "@/nutrition/pages/nutrition-profile-home";
import NutritionDietTypePage from "@/nutrition/pages/nutrition-diet-type";
import NutritionDietFollowUpPage from "@/nutrition/pages/nutrition-diet-followup";
import NutritionDietRequestConfirmPage from "@/nutrition/pages/nutrition-diet-request-confirm";
import NutritionExpertDietRequestPage from "@/nutrition/pages/nutrition-expert-diet-request";
import NutritionMyDietPage from "@/nutrition/pages/nutrition-my-diet";
import NutritionMyDietsPage from "@/nutrition/pages/nutrition-my-diets";
import NutritionExerciseLoggerPage from "@/nutrition/pages/nutrition-exercise-logger";
import NutritionDietViewPreviewPage from "@/nutrition/pages/nutrition-diet-view-preview";
import NutritionDietWeeklyPreviewPage from "@/nutrition/pages/nutrition-diet-weekly-preview";
import NutritionWellnessPreviewPage from "@/nutrition/pages/nutrition-wellness-preview";
import PanelNutritionTokensPage from "@/nutrition/pages/panel-nutrition-tokens";
import PanelNutritionTokenHistoryPage from "@/nutrition/pages/panel-nutrition-token-history";
import PanelNutritionTokenTopUpPage from "@/nutrition/pages/panel-nutrition-token-top-up";
import PanelNutritionTokenTopUpResultPage from "@/nutrition/pages/panel-nutrition-token-top-up-result";
import PanelNutritionLandingSettingsPage from "@/nutrition/pages/panel-nutrition-landing-settings";
import PanelNutritionSettingsPage from "@/nutrition/pages/panel-nutrition-settings";
import {
  NutritionAllFeaturesLandingPage,
  NutritionAllFeaturesLandingPreviewPage,
  NutritionClassicLandingPage,
  NutritionDietLandingPage,
  NutritionDietLandingPreviewPage,
  NutritionDietPriorityLandingPage,
  NutritionDietPriorityLandingPreviewPage,
} from "@/nutrition/pages/nutrition-entry-landings";
import { getActiveNutritionLandingVariant } from "@/nutrition/lib/landing-presets";
import { getInitialTenantMeta } from "@/lib/bootstrap";

export function NutritionEntryRoute() {
  const activeVariant = getActiveNutritionLandingVariant(getInitialTenantMeta());

  if (activeVariant === "diet") {
    return <NutritionDietLandingPage />;
  }

  if (activeVariant === "all_features") {
    return <NutritionAllFeaturesLandingPage />;
  }

  if (activeVariant === "diet_priority") {
    return <NutritionDietPriorityLandingPage />;
  }

  return <NutritionWebAppEntryPage />;
}

function NutritionPlaceholderRoute() {
  return <NutritionPlaceholderPage />;
}

export function getNutritionRouteDefs(enabled: boolean) {
  if (!enabled) {
    return [];
  }

  return [
    <Route key="nutrition-home" path="/nutrition" component={NutritionEntryRoute} />,
    <Route key="nutrition-landing-classic" path="/nutrition/landing-classic" component={NutritionClassicLandingPage} />,
    <Route key="nutrition-landing-diet" path="/nutrition/landing-diet" component={NutritionDietLandingPreviewPage} />,
    <Route key="nutrition-landing-all-features" path="/nutrition/landing-all-features" component={NutritionAllFeaturesLandingPreviewPage} />,
    <Route key="nutrition-landing-diet-priority" path="/nutrition/landing-diet-priority" component={NutritionDietPriorityLandingPreviewPage} />,
    <Route key="nutrition-diet-type" path="/nutrition/diet-type" component={NutritionDietTypePage} />,
    <Route key="nutrition-diet-followup" path="/nutrition/diet-followup/:step" component={NutritionDietFollowUpPage} />,
    <Route key="nutrition-expert-diet-request" path="/nutrition/diet-request/expert" component={NutritionExpertDietRequestPage} />,
    <Route key="nutrition-diet-request-confirm" path="/nutrition/diet-request/confirm" component={NutritionDietRequestConfirmPage} />,
    <Route key="nutrition-my-diet" path="/nutrition/my-diet" component={NutritionMyDietPage} />,
    <Route key="nutrition-my-diet-exercises" path="/nutrition/my-diet/exercises" component={NutritionExerciseLoggerPage} />,
    <Route key="nutrition-my-diets" path="/nutrition/my-diets" component={NutritionMyDietsPage} />,
    <Route key="nutrition-my-diet-detail" path="/nutrition/my-diets/:prescriptionId" component={NutritionMyDietPage} />,
    <Route key="nutrition-my-diet-detail-exercises" path="/nutrition/my-diets/:prescriptionId/exercises" component={NutritionExerciseLoggerPage} />,
    <Route key="nutrition-diet-view-preview" path="/nutrition/diet-view-preview" component={NutritionDietViewPreviewPage} />,
    <Route key="nutrition-diet-weekly-preview" path="/nutrition/diet-weekly-preview" component={NutritionDietWeeklyPreviewPage} />,
    <Route key="nutrition-wellness-preview" path="/nutrition/wellness-preview" component={NutritionWellnessPreviewPage} />,
    <Route key="nutrition-membership" path="/nutrition/membership" component={NutritionMembershipAuthPage} />,
    <Route key="nutrition-membership-goal-start" path="/nutrition/membership/goal" component={NutritionMembershipGoalPage} />,
    <Route key="nutrition-membership-gender" path="/nutrition/membership/gender" component={NutritionMembershipGenderPage} />,
    <Route key="nutrition-membership-activity" path="/nutrition/membership/activity" component={NutritionMembershipActivityPage} />,
    <Route key="nutrition-membership-birth-date" path="/nutrition/membership/birth-date" component={NutritionMembershipBirthDatePage} />,
    <Route key="nutrition-membership-height" path="/nutrition/membership/height" component={NutritionMembershipHeightPage} />,
    <Route key="nutrition-membership-weight" path="/nutrition/membership/weight" component={NutritionMembershipWeightPage} />,
    <Route key="nutrition-membership-completed" path="/nutrition/membership/completed" component={NutritionMembershipCompletePage} />,
    <Route key="nutrition-membership-target-weight" path="/nutrition/membership/target-weight" component={NutritionMembershipTargetWeightPage} />,
    <Route key="nutrition-membership-next-alias" path="/nutrition/membership/next" component={NutritionMembershipNextPage} />,
    <Route key="nutrition-membership-next" path="/nutrition/membership/result" component={NutritionMembershipNextPage} />,
    <Route key="nutrition-membership-mindset" path="/nutrition/membership/mindset/:step" component={NutritionMembershipMindsetPage} />,
    <Route key="nutrition-membership-review" path="/nutrition/membership/review" component={NutritionMembershipReviewPage} />,
    <Route key="nutrition-membership-medical-conditions" path="/nutrition/membership/medical-conditions" component={NutritionMembershipMedicalConditionsPage} />,
    <Route key="nutrition-membership-medications-and-supplements" path="/nutrition/membership/medications-and-supplements" component={NutritionMembershipMedicationsAndSupplementsPage} />,
    <Route key="nutrition-membership-disliked-foods" path="/nutrition/membership/disliked-foods" component={NutritionMembershipDislikedFoodsPage} />,
    <Route key="nutrition-membership-allergies" path="/nutrition/membership/allergies" component={NutritionMembershipAllergiesPage} />,
    <Route key="nutrition-membership-packages" path="/nutrition/membership/packages" component={NutritionMembershipPackagesPage} />,
    <Route key="nutrition-membership-my-package" path="/nutrition/membership/my-package" component={NutritionMembershipMyPackagePage} />,
    <Route key="nutrition-membership-packages-select" path="/nutrition/membership/packages/:packageId/select" component={NutritionMembershipPackageSelectPage} />,
    <Route key="nutrition-membership-package-result" path="/nutrition/membership/package-result" component={NutritionMembershipPackageResultPage} />,
    <Route key="nutrition-membership-packages-branch" path="/nutrition/membership/packages/:packageId" component={NutritionMembershipPackagesPage} />,
    <Route key="nutrition-select-diet-branch" path="/nutrition/select-diet/:templateId" component={NutritionSelectDietPage} />,
    <Route key="nutrition-select-diet" path="/nutrition/select-diet" component={NutritionSelectDietPage} />,
    <Route key="nutrition-introduction" path="/nutrition/introduction" component={NutritionPlaceholderRoute} />,
    <Route key="nutrition-resume" path="/nutrition/resume" component={NutritionPlaceholderRoute} />,
    <Route key="nutrition-profile" path="/nutrition/profile" component={NutritionProfileHomePage} />,
    <Route key="nutrition-bmi" path="/nutrition/bmi" component={NutritionBmiPage} />,
    <Route key="panel-nutrition-settings" path="/panel/nutrition/settings" component={PanelNutritionSettingsPage} />,
    <Route key="panel-nutrition-landing" path="/panel/nutrition/landing" component={PanelNutritionLandingSettingsPage} />,
    <Route key="panel-nutrition-requests" path="/panel/nutrition/requests" component={PanelNutritionRequestsPage} />,
    <Route key="panel-nutrition-prescribe-select" path="/panel/nutrition/prescribe" component={PanelNutritionPrescribeSelectUserPage} />,
    <Route key="panel-nutrition-prescribe-user-profile" path="/panel/nutrition/prescribe/users/:mobile" component={PanelNutritionPrescribeUserProfilePage} />,
    <Route key="panel-nutrition-prescribe-user" path="/panel/nutrition/prescribe/user" component={PanelNutritionPrescribeUserPage} />,
    <Route key="panel-nutrition-prescribe-packages-branch" path="/panel/nutrition/prescribe/packages/:packageId" component={PanelNutritionPrescribePackagesPage} />,
    <Route key="panel-nutrition-prescribe-packages" path="/panel/nutrition/prescribe/packages" component={PanelNutritionPrescribePackagesPage} />,
    <Route key="panel-nutrition-prescribe-mode" path="/panel/nutrition/prescribe/mode" component={PanelNutritionPrescribeModePage} />,
    <Route key="panel-nutrition-prescribe-templates-branch" path="/panel/nutrition/prescribe/templates/:templateId" component={PanelNutritionPrescribeTemplatesPage} />,
    <Route key="panel-nutrition-prescribe-templates" path="/panel/nutrition/prescribe/templates" component={PanelNutritionPrescribeTemplatesPage} />,
    <Route key="panel-nutrition-prescribe-generate" path="/panel/nutrition/prescribe/generate" component={PanelNutritionPrescribeGeneratePage} />,
    <Route key="panel-nutrition-prescribe-mindset" path="/panel/nutrition/prescribe/mindset/:step" component={PanelNutritionPrescribeMindsetPage} />,
    <Route key="panel-nutrition-prescribe-review" path="/panel/nutrition/prescribe/review" component={PanelNutritionPrescribeReviewPage} />,
    <Route key="panel-nutrition-prescribe-step" path="/panel/nutrition/prescribe/:step" component={PanelNutritionPrescribeStepPage} />,
    <Route key="panel-nutrition-request-detail" path="/panel/nutrition/requests/:requestId" component={PanelNutritionRequestDetailPage} />,
    <Route key="panel-nutrition-request-replacements" path="/panel/nutrition/requests/:requestId/replacements" component={PanelNutritionRequestReplacementsPage} />,
    <Route key="panel-nutrition-request-tracking" path="/panel/nutrition/requests/:requestId/tracking" component={PanelNutritionRequestTrackingPage} />,
    <Route key="panel-nutrition-package-orders" path="/panel/nutrition/package-orders" component={PanelNutritionPackageOrdersPage} />,
    <Route key="panel-nutrition-packages" path="/panel/nutrition/packages" component={PanelNutritionPackagesPage} />,
    <Route key="panel-nutrition-discounts" path="/panel/nutrition/discounts" component={PanelNutritionDiscountsPage} />,
    <Route key="panel-nutrition-template-edit" path="/panel/nutrition/templates/:templateId/edit" component={PanelNutritionTemplateCreatePage} />,
    <Route key="panel-nutrition-template-create" path="/panel/nutrition/templates/create" component={PanelNutritionTemplateCreatePage} />,
    <Route key="panel-nutrition-templates" path="/panel/nutrition/templates" component={PanelNutritionTemplatesPage} />,
    <Route key="panel-nutrition-audio-guidance" path="/panel/nutrition/audio-guidance" component={PanelNutritionAudioGuidancePage} />,
    <Route key="panel-nutrition-diet-files" path="/panel/nutrition/diet-files" component={PanelNutritionDietFilesPage} />,
    <Route key="panel-nutrition-ai-prompt-presets" path="/panel/nutrition/ai-prompt-presets" component={PanelNutritionAiPromptPresetsPage} />,
    <Route key="panel-nutrition-exercises" path="/panel/nutrition/exercises" component={PanelNutritionExercisesPage} />,
    <Route key="panel-nutrition-tokens" path="/panel/nutrition/tokens" component={PanelNutritionTokensPage} />,
    <Route key="panel-nutrition-token-history" path="/panel/nutrition/tokens/history" component={PanelNutritionTokenHistoryPage} />,
    <Route key="panel-nutrition-token-top-up" path="/panel/nutrition/tokens/top-up" component={PanelNutritionTokenTopUpPage} />,
    <Route key="panel-nutrition-token-top-up-result" path="/panel/nutrition/tokens/top-up/result" component={PanelNutritionTokenTopUpResultPage} />,
    <Route key="panel-nutrition-membership" path="/panel/nutrition/membership" component={NutritionPlaceholderRoute} />,
    <Route key="panel-nutrition-profile" path="/panel/nutrition/profile" component={NutritionPlaceholderRoute} />,
    <Route key="panel-nutrition-plans" path="/panel/nutrition/plans" component={NutritionPlaceholderRoute} />,
    <Route key="panel-nutrition-home" path="/panel/nutrition" component={PanelNutritionTokensPage} />,
  ];
}
