export type NutritionGender = "male" | "female";
export type NutritionAthleteMode = "athlete" | "non-athlete";
export type NutritionActivityLevel = "very-low" | "medium" | "high" | "intense";
export type NutritionDietGoal = "lose-weight" | "gain-weight" | "maintain-weight";
export type NutritionDietRequestMode = "ai" | "expert";
export type NutritionMedicalConditionStatus = "current" | "past" | "temporary";

export interface NutritionMedicalConditionItem {
  id: string;
  title: string;
  status: NutritionMedicalConditionStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  ongoing?: boolean;
  notes?: string | null;
}

export interface NutritionFormState {
  dietGoal?: NutritionDietGoal;
  gender?: NutritionGender;
  athleteMode?: NutritionAthleteMode;
  activityLevel?: NutritionActivityLevel;
  birthDate?: string;
  heightCm?: number;
  weightKg?: string;
  idealWeightKg?: number;
  recommendedTargetWeightKg?: number;
  healthyMinWeightKg?: number;
  healthyMaxWeightKg?: number;
  targetWeightKg?: string;
  weeklyWeightChangeKg?: number;
  completedProfileSaved?: boolean;
  dislikedFoods?: string;
  foodAllergies?: string;
  medicalConditions?: string;
  medicalConditionsItems?: NutritionMedicalConditionItem[];
  medicationsAndSupplements?: string;
  mindsetAnswers?: Record<string, string>;
  mindsetCompleted?: boolean;
  selectedNutritionPackageId?: string;
  selectedNutritionPackageName?: string;
  selectedDietTemplateId?: string;
  selectedDietTemplateName?: string;
  dietRequestMode?: NutritionDietRequestMode;
  expertRequestDescription?: string;
  repeatDietFlowRequired?: boolean;
  repeatDietCheckinCompleted?: boolean;
  repeatDietAnswers?: Record<string, string>;
  repeatDietWeightKg?: string;
  repeatDietMedicalNotes?: string;
  repeatDietMedicalConditionsItems?: NutritionMedicalConditionItem[];
}

const STORAGE_KEY = "nutrition_membership_form_state";
const PERSISTENT_DRAFT_STORAGE_KEY = "nutrition_membership_onboarding_draft";

const PERSISTENT_DRAFT_KEYS = [
  "dietGoal",
  "gender",
  "athleteMode",
  "activityLevel",
  "birthDate",
  "heightCm",
] as const satisfies ReadonlyArray<keyof NutritionFormState>;

export function getNutritionFormState(): NutritionFormState {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const persistentDraft = JSON.parse(window.localStorage.getItem(PERSISTENT_DRAFT_STORAGE_KEY) || "{}") as NutritionFormState;
    const sessionState = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "{}") as NutritionFormState;
    return { ...persistentDraft, ...sessionState };
  } catch {
    return {};
  }
}

export function updateNutritionFormState(patch: Partial<NutritionFormState>) {
  if (typeof window === "undefined") {
    return;
  }

  const current = getNutritionFormState();
  const next = { ...current, ...patch };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  if (next.completedProfileSaved) {
    window.localStorage.removeItem(PERSISTENT_DRAFT_STORAGE_KEY);
    return;
  }

  const persistentDraft = Object.fromEntries(
    PERSISTENT_DRAFT_KEYS.flatMap((key) => next[key] === undefined ? [] : [[key, next[key]]]),
  );
  window.localStorage.setItem(PERSISTENT_DRAFT_STORAGE_KEY, JSON.stringify(persistentDraft));
}
