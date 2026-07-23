import type { NutritionProfile } from "@/lib/types";
import { updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import type { NutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { normalizeMedicalConditionItems, summarizeMedicalConditionItems } from "@/nutrition/lib/medical-conditions";

export function isNutritionProfileComplete(profile: NutritionProfile | null) {
  return Boolean(
    profile?.onboardingCompletedAt &&
    profile?.preferencesCompletedAt,
  );
}

export function syncNutritionProfileFormState(profile: NutritionProfile | null) {
  if (!profile) {
    return;
  }

  const baseProfileComplete = Boolean(
    profile.dietGoal &&
    profile.gender &&
    profile.athleteMode &&
    profile.activityLevel &&
    profile.birthDate &&
    profile.heightCm != null &&
    profile.weightKg != null,
  );

  updateNutritionFormState({
    dietGoal: profile.dietGoal,
    gender: profile.gender ?? undefined,
    athleteMode: profile.athleteMode,
    activityLevel: profile.activityLevel,
    birthDate: profile.birthDate ?? undefined,
    heightCm: profile.heightCm ?? undefined,
    weightKg: profile.weightKg != null ? String(profile.weightKg) : undefined,
    idealWeightKg: profile.idealWeightKg ?? undefined,
    recommendedTargetWeightKg: profile.recommendedTargetWeightKg ?? undefined,
    targetWeightKg: profile.targetWeightKg != null ? String(profile.targetWeightKg) : undefined,
    weeklyWeightChangeKg: profile.weeklyWeightChangeKg ?? undefined,
    completedProfileSaved: Boolean(profile.onboardingCompletedAt) || baseProfileComplete,
    foodAllergies: profile.preferencesCompletedAt || profile.foodAllergies != null ? profile.foodAllergies ?? "" : undefined,
    dislikedFoods: profile.preferencesCompletedAt || profile.dislikedFoods != null ? profile.dislikedFoods ?? "" : undefined,
    medicalConditions: profile.preferencesCompletedAt || profile.medicalConditions != null ? profile.medicalConditions ?? summarizeMedicalConditionItems(profile.medicalConditionsItems) : undefined,
    medicalConditionsItems: profile.preferencesCompletedAt || profile.medicalConditionsItems != null ? normalizeMedicalConditionItems(profile.medicalConditionsItems) : undefined,
    medicationsAndSupplements: profile.preferencesCompletedAt || profile.medicationsAndSupplements != null ? profile.medicationsAndSupplements ?? "" : undefined,
    mindsetAnswers: profile.mindsetAnswers ?? undefined,
    mindsetCompleted: Boolean(profile.mindsetCompletedAt),
  });
}

export function getFirstIncompleteNutritionProfileHref(profile: NutritionProfile | null) {
  if (!profile) {
    return "/nutrition/membership/goal";
  }

  if (!profile.dietGoal) {
    return "/nutrition/membership/goal";
  }

  if (!profile.gender) {
    return "/nutrition/membership/gender";
  }

  if (!profile.athleteMode || !profile.activityLevel) {
    return "/nutrition/membership/activity";
  }

  if (!profile.birthDate) {
    return "/nutrition/membership/birth-date";
  }

  if (profile.heightCm == null) {
    return "/nutrition/membership/height";
  }

  if (profile.weightKg == null) {
    return "/nutrition/membership/weight";
  }

  if (profile.targetWeightKg == null) {
    return "/nutrition/membership/target-weight";
  }

  if (profile.weeklyWeightChangeKg == null) {
    return "/nutrition/membership/result";
  }

  if (!profile.preferencesCompletedAt) {
    return "/nutrition/membership/medical-conditions";
  }

  return null;
}

export function getFirstIncompleteNutritionDraftHref(state: NutritionFormState) {
  if (!state.dietGoal) {
    return null;
  }
  if (!state.gender) {
    return "/nutrition/membership/gender";
  }
  if (!state.athleteMode || !state.activityLevel) {
    return "/nutrition/membership/activity";
  }
  if (!state.birthDate) {
    return "/nutrition/membership/birth-date";
  }
  if (state.heightCm == null) {
    return "/nutrition/membership/height";
  }
  return "/nutrition/membership/weight";
}

export function hasNutritionProfileHomeAccess(profile: NutritionProfile | null) {
  if (!profile) {
    return false;
  }

  if (profile.onboardingCompletedAt) {
    return true;
  }

  return Boolean(
    profile.dietGoal &&
    profile.gender &&
    profile.athleteMode &&
    profile.activityLevel &&
    profile.birthDate &&
    profile.heightCm != null &&
    profile.weightKg != null &&
    profile.targetWeightKg != null,
  );
}
