import type {
  NutritionActivityLevel,
  NutritionAthleteMode,
  NutritionDietGoal,
  NutritionGender,
  NutritionDietRequestMode,
  NutritionMedicalConditionItem,
} from "@/nutrition/lib/nutrition-form-state";
import type { MessageKey } from "@/i18n/messages";

export type PanelNutritionPrescribeStepKey =
  | "goal"
  | "gender"
  | "activity"
  | "birth-date"
  | "height"
  | "weight"
  | "target-weight"
  | "weekly-rate"
  | "medical-conditions"
  | "medications-and-supplements"
  | "allergies"
  | "disliked-foods";

export interface PanelNutritionPrescribeUserSummary {
  id?: string | null;
  fullName: string;
  mobile: string;
  gender?: NutritionGender | null;
  birthDate?: string | null;
}

export interface PanelNutritionPrescribeState {
  selectedUser?: PanelNutritionPrescribeUserSummary | null;
  isNewUser?: boolean;
  fullName?: string;
  mobile?: string;
  persistedUserId?: string | null;
  dietGoal?: NutritionDietGoal;
  gender?: NutritionGender | null;
  athleteMode?: NutritionAthleteMode;
  activityLevel?: NutritionActivityLevel;
  birthDate?: string | null;
  heightCm?: number;
  weightKg?: string;
  targetWeightKg?: string;
  weeklyWeightChangeKg?: number;
  medicalConditions?: string;
  medicalConditionsItems?: NutritionMedicalConditionItem[];
  medicationsAndSupplements?: string;
  foodAllergies?: string;
  dislikedFoods?: string;
  mindsetAnswers?: Record<string, string>;
  selectedNutritionPackageId?: string | null;
  selectedNutritionPackageName?: string | null;
  selectedDietTemplateId?: string | null;
  selectedDietTemplateName?: string | null;
  dietRequestMode?: NutritionDietRequestMode;
}

const STORAGE_KEY = "panel_nutrition_prescribe_state";

export const PANEL_PRESCRIBE_CORE_STEPS: PanelNutritionPrescribeStepKey[] = [
  "goal",
  "gender",
  "activity",
  "birth-date",
  "height",
  "weight",
  "target-weight",
  "weekly-rate",
  "medical-conditions",
  "medications-and-supplements",
  "allergies",
  "disliked-foods",
];

export const PANEL_PRESCRIBE_QUESTION_STEPS = [
  {
    key: "reason",
    titleKey: "nutritionMembershipMindset.reason.title",
    descriptionKey: "nutritionMembershipMindset.reason.description",
    optionKeys: [
      "nutritionMembershipMindset.reason.option.health",
      "nutritionMembershipMindset.reason.option.confidence",
      "nutritionMembershipMindset.reason.option.energy",
      "nutritionMembershipMindset.reason.option.event",
      "nutritionMembershipMindset.reason.option.bodyShape",
      "nutritionMembershipMindset.option.none",
    ],
  },
  {
    key: "barrier",
    titleKey: "nutritionMembershipMindset.barrier.title",
    descriptionKey: "nutritionMembershipMindset.barrier.description",
    optionKeys: [
      "nutritionMembershipMindset.barrier.option.hunger",
      "nutritionMembershipMindset.barrier.option.noRoutine",
      "nutritionMembershipMindset.barrier.option.eatingOut",
      "nutritionMembershipMindset.barrier.option.stressEating",
      "nutritionMembershipMindset.barrier.option.time",
      "nutritionMembershipMindset.option.none",
    ],
  },
  {
    key: "stressAppetite",
    titleKey: "nutritionMembershipMindset.stressAppetite.title",
    descriptionKey: "nutritionMembershipMindset.stressAppetite.description",
    optionKeys: [
      "nutritionMembershipMindset.stressAppetite.option.more",
      "nutritionMembershipMindset.stressAppetite.option.less",
      "nutritionMembershipMindset.stressAppetite.option.same",
      "nutritionMembershipMindset.stressAppetite.option.mixed",
      "nutritionMembershipMindset.option.none",
    ],
  },
  {
    key: "hardestTime",
    titleKey: "nutritionMembershipMindset.hardestTime.title",
    descriptionKey: "nutritionMembershipMindset.hardestTime.description",
    optionKeys: [
      "nutritionMembershipMindset.hardestTime.option.morning",
      "nutritionMembershipMindset.hardestTime.option.noon",
      "nutritionMembershipMindset.hardestTime.option.evening",
      "nutritionMembershipMindset.hardestTime.option.night",
      "nutritionMembershipMindset.hardestTime.option.midnight",
      "nutritionMembershipMindset.option.none",
    ],
  },
  {
    key: "planStyle",
    titleKey: "nutritionMembershipMindset.planStyle.title",
    descriptionKey: "nutritionMembershipMindset.planStyle.description",
    optionKeys: [
      "nutritionMembershipMindset.planStyle.option.veryFlexible",
      "nutritionMembershipMindset.planStyle.option.flexible",
      "nutritionMembershipMindset.planStyle.option.balanced",
      "nutritionMembershipMindset.planStyle.option.strict",
      "nutritionMembershipMindset.planStyle.option.veryStrict",
      "nutritionMembershipMindset.option.none",
    ],
  },
] satisfies Array<{
  key: keyof NonNullable<PanelNutritionPrescribeState["mindsetAnswers"]>;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  optionKeys: MessageKey[];
}>;

export function getPanelNutritionPrescribeState(): PanelNutritionPrescribeState {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "{}") as PanelNutritionPrescribeState;
  } catch {
    return {};
  }
}

export function updatePanelNutritionPrescribeState(patch: Partial<PanelNutritionPrescribeState>) {
  if (typeof window === "undefined") {
    return;
  }

  const current = getPanelNutritionPrescribeState();
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
}

export function clearPanelNutritionPrescribeState() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
}
