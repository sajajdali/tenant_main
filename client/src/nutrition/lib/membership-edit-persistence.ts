import { api } from "@/lib/api";
import type { NutritionProfile } from "@/lib/types";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { translate, type MessageKey } from "@/i18n/messages";
import { DEFAULT_LOCALE, normalizeLocale } from "@/i18n/registry";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { normalizeMedicalConditionItems } from "@/nutrition/lib/medical-conditions";

type MembershipEditPatch =
  | { step: "goal"; dietGoal: NonNullable<NutritionProfile["dietGoal"]> }
  | { step: "gender"; gender: "male" | "female" }
  | { step: "activity"; athleteMode: "athlete" | "non-athlete"; activityLevel: "very-low" | "medium" | "high" | "intense" }
  | { step: "birth-date"; birthDate: string }
  | { step: "height"; heightCm: number }
  | { step: "weight"; weightKg: string }
  | { step: "target-weight"; targetWeightKg: string }
  | { step: "weekly-rate"; weeklyWeightChangeKg: number }
  | { step: "medical-conditions"; medicalConditions: string; medicalConditionsItems: NonNullable<NutritionProfile["medicalConditionsItems"]> }
  | { step: "medications-and-supplements"; medicationsAndSupplements: string }
  | { step: "allergies"; foodAllergies: string }
  | { step: "disliked-foods"; dislikedFoods: string }
  | { step: "mindset"; answers: Record<string, string> };

interface MembershipEditSaveResult {
  success: boolean;
  message?: string;
}

const MINDSET_KEYS = ["reason", "barrier", "stressAppetite", "hardestTime", "planStyle"] as const;

function fallbackMessage(key: MessageKey) {
  const locale = normalizeLocale(getInitialTenantMeta()?.locale) ?? DEFAULT_LOCALE;
  return translate(locale, key);
}

async function loadProfile() {
  const result = await api.nutrition.getProfile();
  if (!result.success || !result.data.profile) {
    return { success: false as const, message: result.message || fallbackMessage("membershipEditPersistence.error.profileMissing") };
  }

  return { success: true as const, profile: result.data.profile };
}

function toStringValue(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized === "" ? undefined : normalized;
}

export async function saveMembershipProfileEdit(patch: MembershipEditPatch): Promise<MembershipEditSaveResult> {
  const profileResult = await loadProfile();
  if (!profileResult.success) {
    return profileResult;
  }

  const profile = profileResult.profile;
  const formState = getNutritionFormState();

  if (patch.step === "birth-date") {
    const result = await api.nutrition.updateBirthDate(patch.birthDate);
    if (!result.success) {
      return { success: false, message: result.message || fallbackMessage("membershipEditPersistence.error.birthDateSaveFailed") };
    }

    updateNutritionFormState({ birthDate: result.data.profile.birthDate ?? patch.birthDate });
    return { success: true };
  }

  if (patch.step === "goal" || patch.step === "gender" || patch.step === "activity" || patch.step === "height" || patch.step === "weight") {
    const dietGoal = patch.step === "goal" ? patch.dietGoal : formState.dietGoal ?? profile.dietGoal;
    const gender = patch.step === "gender" ? patch.gender : formState.gender ?? profile.gender ?? undefined;
    const athleteMode = patch.step === "activity" ? patch.athleteMode : formState.athleteMode ?? profile.athleteMode;
    const activityLevel = patch.step === "activity" ? patch.activityLevel : formState.activityLevel ?? profile.activityLevel;
    const birthDate = formState.birthDate ?? profile.birthDate ?? undefined;
    const heightCm = patch.step === "height" ? patch.heightCm : formState.heightCm ?? profile.heightCm;
    const weightKg = patch.step === "weight" ? patch.weightKg : toStringValue(formState.weightKg) ?? toStringValue(profile.weightKg);

    if (!dietGoal || !gender || !athleteMode || !activityLevel || !birthDate || !heightCm || !weightKg) {
      return { success: false, message: fallbackMessage("membershipEditPersistence.error.baseProfileIncomplete") };
    }

    const result = await api.nutrition.saveProfile({
      dietGoal,
      gender,
      athleteMode,
      activityLevel,
      birthDate,
      heightCm,
      weightKg,
    });

    if (!result.success) {
      return { success: false, message: result.message || fallbackMessage("membershipEditPersistence.error.profileSaveFailed") };
    }

    updateNutritionFormState({
      dietGoal,
      gender,
      athleteMode,
      activityLevel,
      birthDate,
      heightCm,
      weightKg,
      idealWeightKg: result.data.recommendation.idealWeightKg,
      recommendedTargetWeightKg: result.data.recommendation.recommendedTargetWeightKg,
      healthyMinWeightKg: result.data.recommendation.healthyMinWeightKg,
      healthyMaxWeightKg: result.data.recommendation.healthyMaxWeightKg,
      completedProfileSaved: true,
    });

    return { success: true };
  }

  if (patch.step === "target-weight" || patch.step === "weekly-rate") {
    const targetWeightKg = patch.step === "target-weight"
      ? patch.targetWeightKg
      : toStringValue(formState.targetWeightKg) ?? toStringValue(profile.targetWeightKg);
    const weeklyWeightChangeKg = patch.step === "weekly-rate"
      ? patch.weeklyWeightChangeKg
      : formState.weeklyWeightChangeKg ?? profile.weeklyWeightChangeKg ?? undefined;

    if (!targetWeightKg) {
      return { success: false, message: fallbackMessage("membershipEditPersistence.error.targetWeightMissing") };
    }

    const result = await api.nutrition.updateTargetWeight(targetWeightKg, weeklyWeightChangeKg);
    if (!result.success) {
      return { success: false, message: result.message || fallbackMessage("membershipEditPersistence.error.targetWeightSaveFailed") };
    }

    updateNutritionFormState({
      targetWeightKg,
      weeklyWeightChangeKg: weeklyWeightChangeKg ?? undefined,
    });

    return { success: true };
  }

  if (
    patch.step === "medical-conditions"
    || patch.step === "medications-and-supplements"
    || patch.step === "allergies"
    || patch.step === "disliked-foods"
  ) {
    const medicalConditions = patch.step === "medical-conditions"
      ? patch.medicalConditions
      : formState.medicalConditions ?? profile.medicalConditions ?? "";
    const medicalConditionsItems = patch.step === "medical-conditions"
      ? normalizeMedicalConditionItems(patch.medicalConditionsItems)
      : normalizeMedicalConditionItems(formState.medicalConditionsItems ?? profile.medicalConditionsItems);
    const medicationsAndSupplements = patch.step === "medications-and-supplements"
      ? patch.medicationsAndSupplements
      : formState.medicationsAndSupplements ?? profile.medicationsAndSupplements ?? "";
    const foodAllergies = patch.step === "allergies"
      ? patch.foodAllergies
      : formState.foodAllergies ?? profile.foodAllergies ?? "";
    const dislikedFoods = patch.step === "disliked-foods"
      ? patch.dislikedFoods
      : formState.dislikedFoods ?? profile.dislikedFoods ?? "";

    const result = await api.nutrition.savePreferences({
      medicalConditions,
      medicalConditionsItems,
      medicationsAndSupplements,
      foodAllergies,
      dislikedFoods,
    });
    if (!result.success) {
      return { success: false, message: result.message || fallbackMessage("membershipEditPersistence.error.preferencesSaveFailed") };
    }

    updateNutritionFormState({
      medicalConditions,
      medicalConditionsItems,
      medicationsAndSupplements,
      foodAllergies,
      dislikedFoods,
    });
    return { success: true };
  }

  const answers = {
    ...(profile.mindsetAnswers ?? {}),
    ...(formState.mindsetAnswers ?? {}),
    ...patch.answers,
  };

  const missingAnswer = MINDSET_KEYS.some((key) => !toStringValue(answers[key]));
  if (missingAnswer) {
    return { success: false, message: fallbackMessage("membershipEditPersistence.error.mindsetIncomplete") };
  }

  const result = await api.nutrition.saveMindset({
    reason: answers.reason,
    barrier: answers.barrier,
    stressAppetite: answers.stressAppetite,
    hardestTime: answers.hardestTime,
    planStyle: answers.planStyle,
  });

  if (!result.success) {
    return { success: false, message: result.message || fallbackMessage("membershipEditPersistence.error.mindsetSaveFailed") };
  }

  updateNutritionFormState({
    mindsetCompleted: true,
    mindsetAnswers: answers,
  });

  return { success: true };
}
