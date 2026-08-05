import type { AppointmentAlertSoundKey } from "./appointment-alert-sounds";

export type UserRole = "guest" | "user" | "admin" | "barber" | "customer";

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

export interface User {
  id: string;
  name?: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  gender?: "male" | "female" | null;
  nationalCode?: string | null;
  birthDate?: string | null;
  provinceId?: number | null;
  provinceName?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  jobTitle?: string | null;
  isPrimaryAdmin?: boolean;
  canBook?: boolean;
  isVip?: boolean;
  otp?: string; 
  otpExpiresAt?: number;
}

export interface NutritionProfile {
  id: string;
  dietGoal: "lose-weight" | "gain-weight" | "maintain-weight";
  gender: "male" | "female" | null;
  athleteMode: "athlete" | "non-athlete";
  activityLevel: "very-low" | "medium" | "high" | "intense";
  birthDate: string | null;
  heightCm: number;
  weightKg: number;
  idealWeightKg: number | null;
  recommendedTargetWeightKg: number | null;
  targetWeightKg: number | null;
  weeklyWeightChangeKg?: number | null;
  dislikedFoods?: string | null;
  foodAllergies?: string | null;
  medicalConditions?: string | null;
  medicalConditionsItems?: NutritionMedicalConditionItem[] | null;
  medicationsAndSupplements?: string | null;
  mindsetAnswers?: Record<string, string> | null;
  selectedNutritionPackageId?: string | null;
  selectedNutritionPackageName?: string | null;
  preferencesCompletedAt?: string | null;
  mindsetCompletedAt?: string | null;
  packageSelectedAt?: string | null;
  onboardingCompletedAt: string | null;
}

export interface NutritionWeightRecommendation {
  healthyMinWeightKg: number;
  healthyMaxWeightKg: number;
  idealWeightKg: number;
  recommendedTargetWeightKg: number;
}

export interface NutritionDietTemplateOption {
  value: string;
  label: string;
}

export interface NutritionDietTemplateParentOption {
  id: string;
  name: string;
  depth: number;
  label: string;
  canHaveChild: boolean;
}

export interface NutritionDietTemplateMealSlot {
  key: string;
  title: string;
  icon: string;
  enabled: boolean;
  description?: string | null;
  foodCount: number;
  sortOrder: number;
}

export interface NutritionDietTemplateItem {
  id: string;
  parentId?: string | null;
  depth: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
  dietBasis: string;
  dietBasisLabel: string;
  dietLevel?: string | null;
  applicableGoals: string[];
  mealSlots: NutritionDietTemplateMealSlot[];
  prescriptionMode?: "daily_prescription" | "user_choice" | "fixed_text";
  allowFoodReplacement?: boolean;
  suggestDailyReplacements?: boolean;
  showDietExplanations?: boolean;
  dietExplanationPrompt?: string | null;
  structureVersion?: number;
  applicableGoalLabels: string[];
  description?: string | null;
  templateNotes?: string | null;
  conditionsText?: string | null;
  durationDays: number;
  supplementsEnabled: boolean;
  supplementNotes?: string | null;
  sortOrder: number;
  isActive: boolean;
  children: NutritionDietTemplateItem[];
  createdAt?: string | null;
}

export interface NutritionDietTemplateListPayload {
  items: NutritionDietTemplateItem[];
  parentOptions: NutritionDietTemplateParentOption[];
  dietBasisOptions: NutritionDietTemplateOption[];
  goalOptions: NutritionDietTemplateOption[];
}

export interface NutritionPackageItem {
  id: string;
  parentId?: string | null;
  depth?: number;
  name: string;
  shortTitle?: string | null;
  subtitle?: string | null;
  slug: string;
  description?: string | null;
  features?: Array<{ icon: string; text: string }>;
  imageUrl?: string | null;
  onlineDietCount: number;
  offlineDietCount: number;
  durationDays: number;
  priceAmount: number;
  discountedPriceAmount?: number | null;
  badgeTitle?: string | null;
  isRecommended?: boolean;
  visualStyle?: "normal" | "gold" | "vip" | string;
  actionLabel?: string | null;
  firstDietTemplateMode?: "default" | "custom" | "disabled" | string;
  firstDietTemplateId?: string | null;
  firstDietTemplateIds?: Record<string, string | null>;
  firstDietTemplateName?: string | null;
  applicableGoals?: string[];
  applicableGoalLabels?: string[];
  sortOrder: number;
  isActive: boolean;
  children: NutritionPackageItem[];
  createdAt?: string | null;
}

export interface NutritionPackageListPayload {
  items: NutritionPackageItem[];
  parentOptions?: NutritionDietTemplateParentOption[];
  goalOptions?: NutritionDietTemplateOption[];
  dietTemplateOptions?: NutritionDietTemplateOption[];
}

export interface NutritionDiscountCodeItem {
  id: string;
  code: string;
  title?: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxUses?: number | null;
  usedCount: number;
  isActive: boolean;
  effectiveIsActive?: boolean;
  status?: "active" | "manual_inactive" | "exhausted";
  statusReason?: string | null;
  usedBy?: Array<{
    orderId: string;
    invoiceNumber?: string | null;
    userId?: string | null;
    name?: string | null;
    mobile?: string | null;
    packageName?: string | null;
    payableAmount: number;
    paidAt?: string | null;
  }>;
  createdAt?: string | null;
}

export interface NutritionPackageSubscription {
  id: string;
  status: "active" | "expired" | "cancelled";
  startsAt?: string | null;
  endsAt?: string | null;
  onlineDietTotal: number;
  onlineDietUsed: number;
  offlineDietTotal: number;
  offlineDietUsed: number;
  onlineDietRemaining: number;
  offlineDietRemaining: number;
  priceAmount: number;
  payableAmount: number;
  package?: NutritionPackageItem | null;
}

export interface NutritionPackageOrder {
  id: string;
  invoiceNumber: string;
  status: "pending" | "paid" | "failed" | "cancelled" | "manual";
  gateway?: string | null;
  sandboxMode: boolean;
  amount: number;
  discountAmount: number;
  payableAmount: number;
  referenceId?: string | null;
  transactionId?: string | null;
  discountCode?: string | null;
  discountCodeSnapshot?: {
    id?: string;
    code: string;
    title?: string | null;
    discountType: "percent" | "fixed";
    discountValue: number;
    discountAmount: number;
  } | null;
  metaJson?: Record<string, unknown> | null;
  failureReason?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  expiresAt?: string | null;
  package?: NutritionPackageItem | null;
  subscription?: NutritionPackageSubscription | null;
  user?: {
    id: string;
    name?: string | null;
    mobile?: string | null;
  } | null;
}

export interface NutritionPackageCheckoutPreview {
  package: NutritionPackageItem;
  amount: number;
  discountAmount: number;
  payableAmount: number;
  discountCode?: {
    id: string;
    code: string;
    title?: string | null;
    discountType: "percent" | "fixed";
    discountValue: number;
    discountAmount: number;
  } | null;
  settings: {
    enabled: boolean;
    sandboxEnabled: boolean;
    provider?: string | null;
    enabledGateways: string[];
    gatewayOptions: { key: string; label: string }[];
    maliartEnabled?: boolean;
  };
}

export interface NutritionPackageCheckoutSummaryPayload {
  subscription?: NutritionPackageSubscription | null;
  orders: {
    items: NutritionPackageOrder[];
    page: number;
    perPage: number;
    total: number;
    lastPage: number;
  };
}

export interface NutritionAdminUserProfilePayload {
  user: {
    id: string;
    fullName: string;
    mobile: string;
    email?: string | null;
    gender?: "male" | "female" | null;
    birthDate?: string | null;
    nationalCode?: string | null;
    provinceId?: number | null;
    provinceName?: string | null;
    cityId?: number | null;
    cityName?: string | null;
    jobTitle?: string | null;
    nutritionProfileFixedMessage?: string | null;
    isActive: boolean;
    canBook: boolean;
  };
  stats: {
    dietsCount: number;
    weightGap?: number | null;
    weightGapLabel?: string | null;
    currentWeightKg?: number | null;
    startedAt?: string | null;
  };
  profile: {
    dietGoal?: string | null;
    gender?: string | null;
    athleteMode?: string | null;
    activityLevel?: string | null;
    birthDate?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    targetWeightKg?: number | null;
    weeklyWeightChangeKg?: number | null;
    foodAllergies?: string | null;
    dislikedFoods?: string | null;
    medicalConditions?: string | null;
    medicalConditionsItems?: NutritionMedicalConditionItem[] | null;
    medicationsAndSupplements?: string | null;
    mindsetAnswers?: Record<string, string> | null;
  } | null;
  subscription?: NutritionPackageSubscription | null;
  activeRequests: Array<{
    id: string;
    requestType: "ai" | "expert";
    requestTypeLabel: string;
    status: "sent" | "not_sent" | "finished" | "in_progress" | "cancelled";
    statusLabel: string;
    manualApprovalPending?: boolean;
    aiGenerationStatus?: "not_requested" | "queued" | "processing" | "generated" | "failed" | "cancelled";
    aiGenerationStatusLabel?: string;
    dietTemplateName?: string | null;
    currentWeightKg?: number | null;
    startedAt?: string | null;
    endsAt?: string | null;
    createdAt?: string | null;
  }>;
  prescriptions: Array<{
    id: string;
    requestId?: string | null;
    summaryText?: string | null;
    notes?: string | null;
    prescriptionMode?: "daily_prescription" | "user_choice" | "fixed_text" | null;
    status: string;
    isCurrent: boolean;
    currentWeightKg?: number | null;
    targetWeightKg?: number | null;
    weeklyWeightChangeKg?: number | null;
    startedAt?: string | null;
    endsAt?: string | null;
    publishedAt?: string | null;
  }>;
}

export interface NutritionDietRequest {
  id: string;
  requestType: "ai" | "expert";
  requestTypeLabel: string;
  status: "sent" | "not_sent" | "finished" | "in_progress" | "cancelled";
  statusLabel: string;
  askAiEnabled: boolean;
  requiresManualApproval?: boolean;
  manualApprovalPending?: boolean;
  manualApprovedAt?: string | null;
  aiGenerationStatus?: "not_requested" | "queued" | "processing" | "generated" | "failed" | "cancelled";
  aiGenerationStatusLabel?: string;
  prescriptionMode?: "daily_prescription" | "user_choice" | "fixed_text";
  allowFoodReplacement?: boolean;
  suggestDailyReplacements?: boolean;
  dietTemplateId?: string | null;
  dietTemplateName?: string | null;
  dietGoal?: string | null;
  gender?: string | null;
  athleteMode?: string | null;
  activityLevel?: string | null;
  birthDate?: string | null;
  heightCm?: number | null;
  currentWeightKg?: number | null;
  targetWeightKg?: number | null;
  weeklyWeightChangeKg?: number | null;
  startedAt?: string | null;
  endsAt?: string | null;
  createdAt?: string | null;
  expertNotes?: string | null;
  clinicalNotes?: string | null;
  generationInstructions?: string | null;
  mustInclude?: string | null;
  mustAvoid?: string | null;
  aiJobDispatchedAt?: string | null;
  aiGeneratedAt?: string | null;
  aiGenerationError?: string | null;
  profileSnapshot?: Record<string, unknown> | null;
  templateSnapshot?: Record<string, unknown> | null;
  requestPayloadSnapshot?: Record<string, unknown> | null;
  aiPromptSnapshot?: Record<string, unknown> | null;
  aiResponseSnapshot?: Record<string, unknown> | null;
  user?: {
    id: string;
    name?: string | null;
    mobile?: string | null;
  } | null;
  subscription?: {
    id: string;
    packageName?: string | null;
    endsAt?: string | null;
    onlineDietTotal?: number;
    onlineDietUsed?: number;
    offlineDietTotal?: number;
    offlineDietUsed?: number;
  } | null;
  prescriptions?: Array<{
    id: string;
    status: string;
    deliveryChannel: string;
    prescriptionMode: "daily_prescription" | "user_choice" | "fixed_text" | string;
    allowFoodReplacement?: boolean;
    suggestDailyReplacements?: boolean;
    isCurrent: boolean;
    startedAt?: string | null;
    endsAt?: string | null;
    version?: number | null;
    summaryText?: string | null;
    notes?: string | null;
	    contentSnapshot?: Record<string, unknown> | null;
	    expertFile?: {
      source: "library" | "upload" | string;
      libraryFileId?: string | null;
      title: string;
      description?: string | null;
      calories?: number | null;
      fileName: string;
      filePath?: string | null;
      fileUrl: string;
      mimeType?: string | null;
      fileSize?: number | null;
      group?: {
        id?: string | null;
        name?: string | null;
      } | null;
    } | null;
    dailyMacroSummary?: NutritionDailyMacroSummary;
    mealReplacementSuggestions?: NutritionMealReplacementSuggestion[];
    mealLogs?: Array<{
      id: string;
      consumedDate?: string | null;
      mealSlotKey?: string | null;
      foodTitle?: string | null;
      foodDescription?: string | null;
      quantityText?: string | null;
      calories?: number | null;
      proteinGrams?: number | null;
      fatGrams?: number | null;
      carbohydrateGrams?: number | null;
      fiberGrams?: number | null;
      aiNutritionStatus?: "not_requested" | "queued" | "processing" | "generated" | "failed" | "cancelled" | string | null;
      aiNutritionError?: string | null;
      notes?: string | null;
      status?: string | null;
      consumptionType?: string | null;
      isManual?: boolean;
      manualEntryMethod?: "manual" | "photo" | string | null;
      photoUrl?: string | null;
    }>;
    waterLogs?: Array<{
      id: string;
      consumedDate?: string | null;
      amountMl: number;
      glasses: number;
    }>;
    progress?: {
      expectedMealsPerDay: number;
      loggedMeals: number;
      expectedMeals: number;
      progressPercent: number;
      days: Array<{
        date: string;
        loggedMeals: number;
        expectedMeals: number;
        progressPercent: number;
        status: string;
        waterGlasses: number;
      }>;
    };
    publishedAt?: string | null;
  }>;
  currentPrescription?: {
    id: string;
    status: string;
    deliveryChannel: string;
    prescriptionMode: "daily_prescription" | "user_choice" | "fixed_text" | string;
    allowFoodReplacement?: boolean;
    suggestDailyReplacements?: boolean;
    isCurrent: boolean;
    startedAt?: string | null;
    endsAt?: string | null;
    version?: number | null;
    summaryText?: string | null;
    contentSnapshot?: Record<string, unknown> | null;
    notes?: string | null;
    expertFile?: {
      source: "library" | "upload" | string;
      libraryFileId?: string | null;
      title: string;
      description?: string | null;
      calories?: number | null;
      fileName: string;
      filePath?: string | null;
      fileUrl: string;
      mimeType?: string | null;
      fileSize?: number | null;
      group?: {
        id?: string | null;
        name?: string | null;
      } | null;
    } | null;
    dailyMacroSummary?: NutritionDailyMacroSummary;
    mealReplacementSuggestions?: NutritionMealReplacementSuggestion[];
    mealLogs?: Array<{
      id: string;
      consumedDate?: string | null;
      mealSlotKey?: string | null;
      foodTitle?: string | null;
      foodDescription?: string | null;
      quantityText?: string | null;
      calories?: number | null;
      proteinGrams?: number | null;
      fatGrams?: number | null;
      carbohydrateGrams?: number | null;
      fiberGrams?: number | null;
      notes?: string | null;
      status?: string | null;
      consumptionType?: string | null;
      isManual?: boolean;
      manualEntryMethod?: "manual" | "photo" | string | null;
      photoUrl?: string | null;
    }>;
    waterLogs?: Array<{
      id: string;
      consumedDate?: string | null;
      amountMl: number;
      glasses: number;
    }>;
    progress?: {
      expectedMealsPerDay: number;
      loggedMeals: number;
      expectedMeals: number;
      progressPercent: number;
      days: Array<{
        date: string;
        loggedMeals: number;
        expectedMeals: number;
        progressPercent: number;
        status: string;
        waterGlasses: number;
      }>;
    };
    exerciseLogs?: Array<{
      id: string;
      consumedDate?: string | null;
      exerciseId?: string | null;
      title?: string | null;
      groupTitle?: string | null;
      iconKey?: string | null;
      intensity?: "light" | "moderate" | "vigorous" | string | null;
      durationMinutes: number;
      distanceKm?: number | null;
      speedKmh?: number | null;
      weightKg?: number | null;
      caloriesBurned: number;
      notes?: string | null;
    }>;
    publishedAt?: string | null;
  } | null;
  mealReplacementSuggestions?: NutritionMealReplacementSuggestion[];
  tokenBreakdown?: NutritionDietRequestTokenBreakdown | null;
}

export interface NutritionMealReplacementOption {
  id: string;
  title: string;
  description: string;
  preparationText: string;
  quantityText: string;
  grams: number;
  calories: number;
  matchReason?: string | null;
}

export interface NutritionMealReplacementSuggestion {
  id: string;
  prescriptionId?: string | null;
  sourceType: "meal_slot" | "daily_meal" | string;
  sourceSignature: string;
  mealSlotKey: string;
  slotTitle?: string | null;
  dayNumber?: number | null;
  mealIndex?: number | null;
  cacheScope?: string | null;
  cacheScopeLabel?: string | null;
  suggestionCount: number;
  status: "queued" | "processing" | "generated" | "failed" | "cancelled" | string;
  errorMessage?: string | null;
  requestedAt?: string | null;
  generatedAt?: string | null;
  cancelledAt?: string | null;
  promptMode?: "tenant" | "default" | "custom" | string;
  promptModeLabel?: string | null;
  customPrompt?: string | null;
  effectiveSystemPrompt?: string | null;
  options: NutritionMealReplacementOption[];
}

export interface NutritionMacroProgress {
  targetGrams?: number | null;
  consumedGrams: number;
  remainingGrams?: number | null;
  overGrams?: number | null;
  percent?: number | null;
}

export interface NutritionDailyMacroSummary {
  date: string;
  source: "ai_target" | "day_plan_sum" | "estimated" | "content_target" | "unavailable" | string;
  protein: NutritionMacroProgress;
  carbohydrate: NutritionMacroProgress;
  fat: NutritionMacroProgress;
  fiber: NutritionMacroProgress;
}

export interface NutritionDietRequestAdminStats {
  total: number;
  aiRequests: number;
  expertRequests: number;
  activeRequests: number;
  finishedRequests: number;
  cancelledRequests: number;
  queuedAi: number;
  processingAi: number;
  generatedAi: number;
  failedAi: number;
  notGeneratedAi: number;
  pendingManualApprovals: number;
  expertManualDelivery: number;
}

export interface NutritionDietRequestAdminSettings {
  manualAiApprovalRequired: boolean;
}

export interface NutritionDietPromptSettingItem {
  value: string;
  default: string;
  customized: boolean;
}

export interface NutritionDietPromptSettings {
  general: NutritionDietPromptSettingItem;
  user_choice: NutritionDietPromptSettingItem;
  daily_prescription: NutritionDietPromptSettingItem;
  fixed_text: NutritionDietPromptSettingItem;
  meal_replacement: NutritionDietPromptSettingItem;
  manual_meal_nutrition: NutritionDietPromptSettingItem;
  meal_photo_analysis: NutritionDietPromptSettingItem;
  diet_explanations: NutritionDietPromptSettingItem;
}

export interface NutritionSettingsPayload {
  manualAiApprovalRequired: boolean;
  holdIncompletePrescriptionsForReview: boolean;
  exerciseLoggingEnabled: boolean;
  outOfPlanMealLoggingEnabled: boolean;
  mealPhotoAnalysisEnabled: boolean;
  mealPhotoAnalysisHourlyLimit?: number | null;
  mealPhotoAnalysisDietLimit?: number | null;
  manualMealNutritionHourlyLimit?: number | null;
  manualMealNutritionDietLimit?: number | null;
  mealReplacementHourlyLimit?: number | null;
  mealReplacementDietLimit?: number | null;
  autoFirstDietEnabled: boolean;
  autoFirstDietTemplateId?: number | string | null;
  autoFirstDietTemplateIds?: Record<string, number | string | null>;
  autoFirstDietRequiresApproval: boolean;
  dietTemplateOptions?: NutritionDietTemplateOption[];
  dietGenerationPrompt: string;
  promptSettings: NutritionDietPromptSettings;
}

export interface NutritionMealPhotoAnalysis {
  foodTitle: string;
  foodDescription?: string | null;
  fullPortionText?: string | null;
  suggestedQuantityText: string;
  suggestedCalories: number;
  suggestedProteinGrams?: number | null;
  suggestedFatGrams?: number | null;
  suggestedCarbohydrateGrams?: number | null;
  suggestedFiberGrams?: number | null;
  guidanceText: string;
  confidence?: "low" | "medium" | "high" | string | null;
  notes?: string | null;
}

export interface NutritionExerciseItem {
  id: string;
  source?: "central" | "tenant" | string;
  centralId?: string | null;
  tenantId?: string | null;
  isCustom?: boolean;
  isOverride?: boolean;
  groupId: string;
  groupTitle?: string | null;
  title: string;
  slug: string;
  description?: string | null;
  iconKey?: string | null;
  badgeText?: string | null;
  searchTerms?: string | null;
  supportsIntensity: boolean;
  supportsDistance: boolean;
  supportsSpeed: boolean;
  defaultIntensity: "light" | "moderate" | "vigorous" | string;
  metLight?: number | null;
  metModerate?: number | null;
  metVigorous?: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface NutritionExerciseGroup {
  id: string;
  source?: "central" | "tenant" | string;
  centralId?: string | null;
  tenantId?: string | null;
  isCustom?: boolean;
  isOverride?: boolean;
  title: string;
  slug: string;
  description?: string | null;
  iconKey?: string | null;
  accentColor?: string | null;
  softColor?: string | null;
  sortOrder: number;
  isActive: boolean;
  exercisesCount?: number;
  exercises: NutritionExerciseItem[];
}

export interface NutritionDietPrescription {
  id: string;
  requestId?: string | null;
  nutritionDietTemplateId?: string | null;
  dietName?: string | null;
  deliveryChannel: "ai" | "expert" | string;
  prescriptionMode: "daily_prescription" | "user_choice" | "fixed_text";
  status: string;
  expired?: boolean;
  allowFoodReplacement: boolean;
  suggestDailyReplacements: boolean;
  exerciseLoggingEnabled?: boolean;
  outOfPlanMealLoggingEnabled?: boolean;
  mealPhotoAnalysisEnabled?: boolean;
  currentWeightKg?: number | null;
  targetWeightKg?: number | null;
  weeklyWeightChangeKg?: number | null;
  startedAt?: string | null;
  endsAt?: string | null;
  version: number;
  isCurrent: boolean;
  summaryText?: string | null;
  notes?: string | null;
  durationDays?: number | null;
  contentSnapshot?: Record<string, unknown> | null;
  expertFile?: {
    source: "library" | "upload" | string;
    libraryFileId?: string | null;
    title: string;
    description?: string | null;
    calories?: number | null;
    fileName: string;
    filePath?: string | null;
    fileUrl: string;
    mimeType?: string | null;
    fileSize?: number | null;
    group?: {
      id?: string | null;
      name?: string | null;
    } | null;
  } | null;
  dailyMacroSummary?: NutritionDailyMacroSummary;
  mealReplacementSuggestions?: NutritionMealReplacementSuggestion[];
  mealLogs?: Array<{
    id: string;
    consumedDate?: string | null;
    mealSlotKey?: string | null;
    foodTitle?: string | null;
    foodDescription?: string | null;
    quantityText?: string | null;
    calories?: number | null;
    proteinGrams?: number | null;
    fatGrams?: number | null;
    carbohydrateGrams?: number | null;
    fiberGrams?: number | null;
    aiNutritionStatus?: "not_requested" | "queued" | "processing" | "generated" | "failed" | "cancelled" | string | null;
    aiNutritionError?: string | null;
    notes?: string | null;
    status?: string | null;
    consumptionType?: string | null;
    isManual?: boolean;
    manualEntryMethod?: "manual" | "photo" | string | null;
    photoUrl?: string | null;
  }>;
  waterLogs?: Array<{
    id: string;
    consumedDate?: string | null;
    amountMl: number;
    glasses: number;
  }>;
  exerciseLogs?: Array<{
    id: string;
    consumedDate?: string | null;
    exerciseId?: string | null;
    title?: string | null;
    groupTitle?: string | null;
    iconKey?: string | null;
    intensity?: "light" | "moderate" | "vigorous" | string | null;
    durationMinutes: number;
    distanceKm?: number | null;
    speedKmh?: number | null;
    weightKg?: number | null;
    caloriesBurned: number;
    notes?: string | null;
  }>;
  publishedAt?: string | null;
}

export interface NutritionProfileDashboardPayload {
  profile: NutritionProfile | null;
  managerMessage?: string | null;
  subscription?: NutritionPackageSubscription | null;
  dietRequest: {
    active: NutritionDietRequest | null;
    latest: NutritionDietRequest | null;
    isPrescribing: boolean;
  };
  prescription: {
    current: NutritionDietPrescription | null;
    hasHistory: boolean;
  };
  dashboard: {
    state:
      | "has_current_prescription"
      | "prescribing"
      | "profile_incomplete"
      | "needs_package"
      | "needs_mindset"
      | "ready_for_first_diet"
      | "ready_for_repeat_diet"
      | string;
    banner: {
      type: "prescribing" | "membership_incomplete" | "needs_package" | "get_first_diet" | "get_repeat_diet" | string;
      title: string;
      description: string;
      actionLabel?: string | null;
      actionHref?: string | null;
    } | null;
    dietAction: {
      type: "view_current_diet" | "prescribing" | "get_diet" | string;
      title: string;
      href?: string | null;
      disabled: boolean;
    };
    activeDate: string;
    days: Array<{
      dayNumber: number;
      date?: string | null;
      label?: string | null;
      notes?: string | null;
      totalCalories?: number | null;
      mealsCount: number;
      isActive: boolean;
    }> | null;
    dietRenewal?: {
      hasActiveDiet: boolean;
      blocked: boolean;
      daysRemaining: number;
      endsAt?: string | null;
      prescriptionId?: string | null;
    } | null;
    dailyCalories: {
      date: string;
      targetCalories?: number | null;
      loggedMeals: number;
      loggedExercises: number;
      consumedCalories: number;
      burnedCalories: number;
      netCalories: number;
      remainingCalories?: number | null;
      macros: {
        carbohydrateGrams: number;
        proteinGrams: number;
        fatGrams: number;
        fiberGrams: number;
      };
    } | null;
    exercise: {
      enabled: boolean;
      date: string;
      href: string;
      loggedCount: number;
      burnedCalories: number;
      netCalories?: number | null;
      items: NonNullable<NutritionDietPrescription["exerciseLogs"]>;
    } | null;
  };
  nullables: Record<string, string | null>;
}

export interface NutritionAudioGuidanceAsset {
  id: string;
  title: string;
  description?: string | null;
  templateId?: string | null;
  templateName?: string | null;
  sessionNumber?: number | null;
  sortOrder: number;
  isActive: boolean;
  fileUrl: string;
  filePath?: string | null;
  durationSeconds?: number | null;
  scopeLabel: string;
  createdAt?: string | null;
}

export interface NutritionDietFileGroup {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  filesCount?: number;
}

export interface NutritionDietFileItem {
  id: string;
  title: string;
  description?: string | null;
  calories?: number | null;
  groupId?: string | null;
  groupName?: string | null;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
  isActive: boolean;
  createdAt?: string | null;
}

export interface NutritionAiPromptPreset {
  id: string;
  title: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string | null;
}

export interface NutritionTokenLedgerItem {
  id: string;
  tokensAmount: number;
  direction: "credit" | "debit";
  directionLabel?: string;
  eventType: "topup" | "diet_request_ai" | "ai_question";
  eventTypeLabel?: string;
  balanceAfter: number;
  reasonTitle: string;
  reasonCode?: string | null;
  occurredAt?: string | null;
  subjectUser?: {
    id: string;
    name?: string | null;
    mobile?: string | null;
  } | null;
  actorUser?: {
    id: string;
    name?: string | null;
    mobile?: string | null;
  } | null;
  dietRequest?: {
    id: string;
    dietTemplateName?: string | null;
  } | null;
  summary?: string;
  meta?: Record<string, unknown> | null;
}

export interface NutritionTokenDashboardPayload {
  paymentSettings?: {
    maliartEnabled?: boolean;
    sandboxEnabled?: boolean;
    provider?: string | null;
    enabledGateways?: PaymentProvider[];
  };
  stats: {
    newOfflineRequests: number;
    prescribedToday: number;
    currentTokens: number;
    usedTokens: number;
    purchasedTokens: number;
    aiDietRequestCost: number;
    aiQuestionCost: number;
    tokenUnitPriceToman: number;
  };
  filters: {
    q: string;
  };
  recentEntries: NutritionTokenLedgerItem[];
  byUsers: Array<{
    userId?: string | null;
    name?: string | null;
    mobile?: string | null;
    consumedTokens: number;
    entriesCount: number;
  }>;
}

export interface NutritionTokenHistoryPayload {
  stats: {
    total: number;
    consumedTokens: number;
    chargedTokens: number;
  };
  filters: {
    q: string;
  };
  items: NutritionTokenLedgerItem[];
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
}

export interface NutritionDietRequestTokenBreakdown {
  totalConsumedTokens: number;
  dietGenerationTokens: number;
  dietRevisionTokens: number;
  mealReplacementTokens: number;
  manualMealNutritionTokens: number;
  mealPhotoAnalysisTokens?: number;
  aiUsageLimits?: {
    mealPhotoAnalysis?: NutritionDietRequestAiUsageLimit;
    manualMealNutrition?: NutritionDietRequestAiUsageLimit;
    mealReplacement?: NutritionDietRequestAiUsageLimit;
  };
  entriesCount: number;
  entries: NutritionTokenLedgerItem[];
}

export interface NutritionDietRequestAiUsageLimit {
  operationType: string;
  label: string;
  globalDietLimit: number | null;
  globalHourlyLimit: number | null;
  overrideDietLimit: number | null;
  overrideHourlyLimit: number | null;
  effectiveDietLimit: number | null;
  effectiveHourlyLimit: number | null;
  usedCount: number;
  remainingCount: number | null;
}

export interface UserLookupResult {
  exists: boolean;
  user: User | null;
  suggestedName?: string | null;
}

export interface TenantPanelUser {
  id?: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  mobile: string;
  email?: string | null;
  canBook: boolean;
  isVip?: boolean;
  gender?: "male" | "female" | null;
  nationalCode?: string | null;
  birthDate?: string | null;
  provinceId?: number | null;
  provinceName?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  jobTitle?: string | null;
  appointmentsCount: number;
  lastAppointmentAt?: string | null;
  isForSomeoneElse?: boolean;
  bookedByName?: string | null;
  bookedByPhone?: string | null;
  nutritionProfileFixedMessage?: string | null;
}

export interface Barber {
  id: string;
  name: string;
  apiCode?: string | null;
  sortOrder?: number;
  mobile?: string;
  userId?: string | null;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  activeRanges?: { start: string; end: string }[]; // YYYY-MM-DD
  disabledDates?: string[]; // YYYY-MM-DD
  blockedTimeRanges?: Array<{
    id: string;
    date: string;
    start: string;
    end: string;
    reason?: string;
  }>;
  bookingLeadMode?: "today" | "days";
  bookingLeadHours?: number;
  bookingLeadDays?: number;
  bookingHorizonMode?: "days" | "date";
  bookingMaxDays?: number;
  bookingMaxDate?: string;
  canAccessPanel?: boolean;
}

export interface Section {
  id: string;
  name: string;
  apiCode?: string | null;
  sortOrder?: number;
  barberId: string; // Required now
  startHour: string; 
  endHour: string;   
  restBreaks?: {
    start: string;
    end: string;
    scope?: "all" | "weekdays" | "dates";
    weekdays?: number[];
    dates?: string[];
  }[];
  vipBreaks?: {
    start: string;
    end: string;
    scope?: "all" | "weekdays" | "dates";
    weekdays?: number[];
    dates?: string[];
  }[];
  scheduleOverrides?: {
    scope: "weekdays" | "dates";
    weekdays?: number[];
    dates?: string[];
    startHour: string;
    endHour: string;
    slotDurationMinutes: number;
  }[];
  quickBlockedSlots?: {
    id: string;
    date: string;
    start: string;
    end: string;
    reason?: string | null;
  }[];
  slotDurationMinutes: number;
  durationDisplayText?: string | null;
  price?: number;
  checkConflicts: boolean; 
  isActive: boolean;
  workDays?: number[]; // 0-6, where 0 is Saturday or Sunday depending on convention. Let's use standard JS: 0=Sunday, 6=Saturday
  disabledDates: string[]; // YYYY-MM-DD
  disabledDateRanges?: { start: string; end: string }[];
  createdAt: string;
}

export type PaymentProvider =
  | "zibal"
  | "saman"
  | "digipay"
  | "asanpardakht"
  | "parsian"
  | "pasargad"
  | "zarinpal";
export type SmsProvider = "kavenegar" | "shsms";

export type SmsTemplateKey = "adminBooking" | "userBooking" | "cancellation" | "appointmentChange" | "reminder" | "reminderThreeHours" | "loginOtp" | "customerFeedback" | "appointmentReopened";
export type StoreSmsTemplateKey = "afterOrder" | "afterApproval" | "afterShippingCode" | "afterRejection";
export type NutritionSmsTemplateKey =
  | "afterAiPrescription"
  | "afterAiApproval"
  | "dietEndingTomorrow"
  | "dietEndsToday"
  | "dietExpiredNoRequestDay1"
  | "packageFinished"
  | "packageFinishedWeek1"
  | "packageFinishedDay15"
  | "afterPackagePurchase";

export interface SmsTemplateConfig {
  enabled: boolean;
  body: string;
  approval_status?: "draft" | "pending_review" | "approved" | "rejected";
  approved_body?: string;
  approved_enabled?: boolean;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
}

export interface SmsStats {
  totalSent: number;
  sentToday: number;
  creditBalance: number;
}

export interface SmsPricingSummary {
  persianPrice: number;
  englishPrice: number;
}

export interface SmsSenderOption {
  number: string;
  label?: string;
  isDefault?: boolean;
}

export interface PaymentGatewaySettings {
  enabled: boolean;
  merchantId?: string;
  password?: string;
  username?: string;
  clientId?: string;
  clientSecret?: string;
  merchantConfigID?: string;
  userName?: string;
  terminalCode?: string;
}

export interface PaymentSettings {
  enabled: boolean;
  locale?: "fa" | "en" | string;
  country?: string;
  localization?: Pick<TenantMeta, "locale" | "fallbackLocale" | "supportedLocales" | "country" | "defaultCountry" | "supportedCountries" | "dir" | "htmlLang" | "ogLocale" | "dateLocale" | "calendar" | "numberingSystem" | "currency">;
  provider: PaymentProvider | null;
  sandboxEnabled?: boolean;
  maliartEnabled?: boolean;
  tenantMaliartEnabled?: boolean;
  enabledGateways?: PaymentProvider[];
  gateways: Partial<Record<PaymentProvider, PaymentGatewaySettings>>;
  enamadCode?: string;
  enamadVerificationFileName?: string;
  managementPanelNote?: string;
  siteAnnouncementEnabled?: boolean;
  siteAnnouncementText?: string;
  bookingClosedEnabled?: boolean;
  bookingClosedText?: string;
  appointmentBookingDisabled?: boolean;
  offQueueBookingEnabled?: boolean;
  serviceFirstBookingEnabled?: boolean;
  customerMobileConfirmationEnabled?: boolean;
  showCountryPrefixInAuthenticationForm?: boolean;
  hourlyBookingLimit?: number;
  customerCancellationCutoffHours?: number;
  appointmentAlertSound?: AppointmentAlertSoundKey;
  apiCodeEnabled?: boolean;
  registrationRequirements?: {
    email: { enabled: boolean; required: boolean };
    gender: { enabled: boolean; required: boolean };
    nationalCode: { enabled: boolean; required: boolean };
    birthDate: { enabled: boolean; required: boolean };
    location: { enabled: boolean; required: boolean };
    jobTitle: { enabled: boolean; required: boolean };
  };
  galleryEnabled?: boolean;
  smsEnabled?: boolean;
  smsProvider?: SmsProvider | null;
  smsApiKey?: string;
  smsApiKeyConfigured?: boolean;
  smsSender?: string;
  smsAvailableSenders?: SmsSenderOption[];
  smsTemplateAdminBooking?: string;
  smsTemplateUserBooking?: string;
  smsTemplateCancellation?: string;
  smsTemplateReminder?: string;
  smsTemplatesV2?: Record<SmsTemplateKey, SmsTemplateConfig>;
  nutritionSmsEnabled?: boolean;
  nutritionSmsTemplatesV2?: Record<NutritionSmsTemplateKey, SmsTemplateConfig>;
  smsStats?: SmsStats;
  smsPricing?: SmsPricingSummary;
  preferNutritionLandingAsDefault?: boolean;
  activeNutritionLandingVariant?: NutritionLandingVariant | null;
}

export interface AppointmentBookingClosureSummary {
  id: string;
  closedMessage: string;
  notifyOptInEnabled: boolean;
  smsCampaignId?: string | null;
  closedAt?: string | null;
  openedAt?: string | null;
}

export interface AppointmentBookingClosureStats {
  requested: number;
  queued: number;
  sent: number;
  failed: number;
  pending: number;
  cancelled: number;
  estimatedTotalPrice: number;
  spentTotalPrice: number;
  creditBalance: number;
}

export interface AppointmentBookingClosureCampaign {
  id: string;
  name: string;
  status: string;
  message: string;
  estimatedTotalPrice: number;
  spentTotalPrice: number;
  recipientsCount: number;
  sentCount: number;
  successCount: number;
  failedCount: number;
  cancelledCount: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  cancelledAt?: string | null;
  lastError?: string | null;
}

export interface AppointmentBookingClosureHistoryItem extends AppointmentBookingClosureSummary {
  notificationStats: AppointmentBookingClosureStats;
  campaign?: AppointmentBookingClosureCampaign | null;
}

export interface AppointmentBookingClosureHistoryPagination {
  currentPage: number;
  perPage: number;
  lastPage: number;
  total: number;
  from: number;
  to: number;
}

export interface AppointmentBookingClosurePayload {
  isClosed: boolean;
  closedMessage: string;
  notifyOptInEnabled: boolean;
  activeClosureId?: string | null;
  userSubscribed: boolean;
  closure?: AppointmentBookingClosureSummary | null;
  notificationStats: AppointmentBookingClosureStats;
  campaign?: AppointmentBookingClosureCampaign | null;
  history?: AppointmentBookingClosureHistoryItem[];
  historyPagination?: AppointmentBookingClosureHistoryPagination;
}

export interface MessagingBotChannelSettings {
  enabled: boolean;
  token: string;
  tokenConfigured: boolean;
  tokenMasked: string;
  apiBaseUrl?: string;
  webhookUrl?: string;
  welcomeText?: string;
  welcomeImageUrl?: string | null;
  removeWelcomeImage?: boolean;
}

export interface MessagingBotSettings {
  telegram: MessagingBotChannelSettings;
  bale: MessagingBotChannelSettings;
  moduleActive?: boolean;
}

export interface TelegramWebhookInfo {
  configured: boolean;
  expectedUrl: string;
  currentUrl?: string | null;
  pendingUpdateCount: number;
  lastErrorDate?: number | null;
  lastErrorMessage?: string | null;
  maxConnections?: number | null;
  raw?: Record<string, unknown>;
}

export interface AboutSettings {
  enabled: boolean;
  title: string;
  body: string;
  imageUrl?: string | null;
  seoEnabled?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  seoIndexable?: boolean;
}

export interface ContactPhone {
  id: string;
  title: string;
  number: string;
}

export interface ContactSettings {
  enabled: boolean;
  phones: ContactPhone[];
  locationEnabled: boolean;
  provinceId?: number | null;
  provinceName?: string;
  cityId?: number | null;
  cityName?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
}

export interface LandingContactSubmissionPayload {
  fullName: string;
  mobile: string;
  email?: string;
  message: string;
}

export interface LandingCustomer {
  id: string;
  mobile: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  gender?: "male" | "female" | null;
  nationalCode?: string | null;
  birthDate?: string | null;
  provinceId?: number | null;
  provinceName?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  addressLine?: string | null;
  postalCode?: string | null;
  lastLoginAt?: string | null;
}

export interface LandingOrderPaymentSummary {
  id: string;
  invoiceNumber: string;
  gateway?: string | null;
  status: string;
  amount: number;
  sandboxMode: boolean;
  referenceId?: string | null;
  authority?: string | null;
  failureReason?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
}

export interface LandingOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  requestedDomain?: string | null;
  requestedDomainTld?: string | null;
  usesOwnDomain?: boolean;
  completionSubmittedAt?: string | null;
  customerFullName: string;
  customerMobile: string;
  customerEmail?: string | null;
  customerGender?: "male" | "female" | null;
  customerNationalCode?: string | null;
  customerProvinceName?: string | null;
  customerCityName?: string | null;
  customerAddressLine?: string | null;
  totalAmount: number;
  subtotalAmount: number;
  setupFeeAmount: number;
  domainPriceAmount: number;
  packagePriceAmount: number;
  currency: string;
  createdAt?: string | null;
  paidAt?: string | null;
  provisionedAt?: string | null;
  siteUrl?: string | null;
  package: {
    id: string;
    name?: string | null;
    durationDays: number;
    userLimit?: number | null;
    userLimitLabel?: string | null;
  };
  items: Array<{
    id: string;
    title: string;
    description?: string | null;
    type: string;
    quantity: number;
    unitAmount: number;
    totalAmount: number;
  }>;
  payment?: LandingOrderPaymentSummary | null;
}

export interface PaginatedLandingOrders {
  items: LandingOrderSummary[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface LandingCheckoutQuote {
  package: {
    id: string;
    name: string;
    durationDays: number;
    userLimit?: number | null;
    userLimitLabel?: string | null;
    payableAmount: number;
  };
  setupFee: {
    label: string;
    amount: number;
  };
  smsCreditGift?: {
    amount: number;
  };
  domain: {
    name?: string | null;
    tld?: string | null;
    amount: number;
    usesOwnDomain: boolean;
    inspection?: {
      domain?: string;
      tld?: string | null;
      status?: string;
      available?: boolean;
      message?: string;
      price?: number | null;
      source?: string;
      payload?: Record<string, unknown> | null;
    } | null;
  };
  subtotalAmount: number;
  totalAmount: number;
  discountCode?: {
    id: string;
    code: string;
    title?: string | null;
    discountType: string;
    discountValue: number;
    discountAmount: number;
    salesUserId?: string | null;
    salesUserName?: string | null;
  } | null;
  currency: string;
  gatewaySettings: {
    enabled: boolean;
    sandboxEnabled: boolean;
    provider?: string | null;
    enabledGateways?: string[];
  };
}

export interface Appointment {
  id: string;
  userId: string;
  userPhone: string; 
  userName: string;
  originalUserPhone?: string;
  bookedByUserId?: string | null;
  bookedByPhone?: string | null;
  bookedByName?: string | null;
  bookedByRole?: UserRole | null;
  barberId: string; 
  barberName?: string;
  sectionId: string;
  sectionName?: string;
  date: string; // YYYY-MM-DD 
  startTime: string; 
  endTime: string;   
  status: "booked" | "completed" | "no_show" | "cancelled" | "pending_payment";
  notes?: string; 
  sendSms: boolean;
  publicCode?: string | null;
  publicUrl?: string | null;
  feedbackUrl?: string | null;
  feedbackStatus?: "pending" | "sent" | "responded" | "cancelled" | null;
  createdAt: string;
  isForSomeoneElse?: boolean; 
  isOffQueue?: boolean;
  customerCancellationCutoffHours?: number;
  cancellationLockedAt?: string | null;
  cancellationLockMessage?: string | null;
  isVipSlot?: boolean;
}

export interface ManualFinanceCategory {
  id: string;
  name: string;
  defaultSharePercent?: number | null;
  defaultAmount?: number | null;
  isDefault: boolean;
}

export interface ManualFinanceEntryItem {
  categoryId: string;
  categoryName: string;
  amount: number;
  materialCost?: number;
  netAmount?: number;
  sharePercent: number;
  professionalShareAmount: number;
  description?: string | null;
}

export interface ManualFinanceEntry {
  id: string;
  appointmentId?: string | null;
  appointment?: {
    id: string;
    date?: string | null;
    startTime?: string | null;
    sectionName?: string | null;
    professionalName?: string | null;
  } | null;
  professionalId?: string | null;
  professionalName?: string | null;
  customerName: string;
  customerPhone: string;
  entryDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  materialCostAmount: number;
  netRevenueAmount: number;
  professionalShareAmount: number;
  businessShareAmount: number;
  paymentMethod: "cash" | "card" | "online" | "transfer" | "other";
  status: "paid" | "partial" | "debt";
  items: ManualFinanceEntryItem[];
  notes?: string | null;
  createdAt?: string | null;
}

export interface ManualFinanceDebtor {
  customerName: string;
  customerPhone: string;
  totalAmount?: number;
  paidAmount?: number;
  balanceAmount: number;
  entriesCount: number;
  lastEntryDate?: string | null;
  appointmentIds?: string[];
}

export interface ManualFinanceDebtorsPayload {
  summary: {
    debtorsCount: number;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
  };
  items: ManualFinanceDebtor[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  selectedProfessionalId?: string | null;
  forcedToActorProfessional: boolean;
}

export interface ManualFinanceCustomerSummary {
  customerPhone: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  entriesCount: number;
  lastEntryDate?: string | null;
  appointmentIds?: string[];
}

export interface ManualFinanceDashboardPayload {
  categories: ManualFinanceCategory[];
  appointment?: {
    id: string;
    customerName: string;
    customerPhone: string;
    professionalId: string;
    professionalName?: string | null;
    sectionName?: string | null;
    date: string;
    startTime: string;
  } | null;
  customer?: {
    id?: string | null;
    name?: string | null;
    phone?: string | null;
  } | null;
  selectedProfessionalId?: string | null;
  forcedToActorProfessional: boolean;
  summary: {
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    materialCostAmount: number;
    netRevenueAmount: number;
  };
  entries: {
    items: ManualFinanceEntry[];
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  };
  debtors: ManualFinanceDebtor[];
}

export interface ManualFinanceCommissionCategoryRow {
  categoryId: string;
  categoryName: string;
  percent: number;
  itemsCount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  materialCostAmount: number;
  netRevenueAmount: number;
  netPaidAmount: number;
  commissionOnTotal: number;
  commissionPayable: number;
}

export interface ManualFinanceCommissionEntry extends ManualFinanceEntry {
  commissionOnTotal: number;
  commissionPayable: number;
}

export interface ManualFinanceCommissionReportPayload {
  filter: {
    professionalId: string;
    professionalName?: string | null;
    dateFrom: string;
    dateTo: string;
    defaultPercent: number;
  };
  categories: ManualFinanceCategory[];
  summary: {
    entriesCount: number;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    materialCostAmount: number;
    netRevenueAmount: number;
    netPaidAmount: number;
    commissionOnTotal: number;
    commissionPayable: number;
    businessShareAfterPayable: number;
  };
  byCategory: ManualFinanceCommissionCategoryRow[];
  entries: ManualFinanceCommissionEntry[];
}

export interface PublicAppointmentDetails {
  id: string;
  publicCode: string;
  publicUrl: string;
  customerName: string;
  barberName?: string | null;
  sectionName?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: "booked" | "completed" | "no_show" | "cancelled" | "pending_payment";
  statusLabel: string;
  priceAmount: number;
  durationMinutes: number;
  bookedAt?: string | null;
  canCancel: boolean;
  customerCancellationCutoffHours?: number;
  cancellationLockedAt?: string | null;
  cancellationLockMessage?: string | null;
  requiresLoginForCancel: boolean;
  managerNotes?: string | null;
  location?: {
    address?: string | null;
    provinceName?: string | null;
    cityName?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}

export interface AppointmentPaymentCheckout {
  mode: "sandbox" | "gateway" | "wallet";
  payment: {
    id: string;
    invoiceNumber: string;
    gateway: PaymentProvider | "maliart" | "wallet" | "sandbox";
    status: string;
    amount: number;
    sandboxMode: boolean;
    totalAmount: number;
    walletUsedAmount: number;
    payableAmount: number;
  };
  appointmentId?: string | null;
  redirectForm?: {
    action: string;
    method: string;
    inputs: Record<string, string>;
  } | null;
  paymentUrl?: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface CustomLandingPartner {
  id: string;
  name: string;
  mobile: string;
  status: string;
  publicToken: string;
  url: string;
  isDirect?: boolean;
  firstPaymentPercent: number;
  recurringPaymentPercent: number;
  attributionsCount: number;
  creditedAmount: number;
  settledAmount: number;
  availableAmount: number;
  notes?: string | null;
}

export interface CustomLandingCommission {
  id: string;
  partnerName?: string | null;
  userName?: string | null;
  userMobile?: string | null;
  paymentKind: string;
  grossAmount: number;
  percent: number;
  amount: number;
  status: string;
  paidAt?: string | null;
  reversalNote?: string | null;
}

export interface CustomLandingSettlement {
  id: string;
  partnerName?: string | null;
  amount: number;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paidAt?: string | null;
  note?: string | null;
}

export interface CustomLandingReferredUser {
  id: string;
  userId: string;
  name?: string | null;
  mobile?: string | null;
  registeredAt?: string | null;
  firstPaidAt?: string | null;
}

export interface CustomLandingPartnerDashboard {
  partner: CustomLandingPartner;
  stats: {
    availableAmount: number;
    totalIncome: number;
    firstPaymentIncome: number;
    recurringPaymentIncome: number;
    referredUsers: number;
    dietUsers: number;
    settledAmount: number;
    reversedAmount: number;
  };
  users: CustomLandingReferredUser[];
  commissions: CustomLandingCommission[];
  settlements: CustomLandingSettlement[];
}

export interface CustomLandingSettings {
  title: string;
  headline: string;
  description: string;
  buttonLabel: string;
  autoTokenEnabled: boolean;
  redirectHomeEnabled: boolean;
  logoUrl?: string | null;
  appViewUrl: string;
  webAppUrl: string;
  androidUrl: string;
  iosUrl: string;
}

export interface CustomLandingOverview {
  stats: { partners: number; attributions: number; firstPayments: number; creditedAmount: number; settledAmount: number; availableAmount: number };
  partners: CustomLandingPartner[];
  commissions: CustomLandingCommission[];
  settlements: CustomLandingSettlement[];
  settings?: CustomLandingSettings;
}

export interface SpecializedCoursePageStat {
  id: string;
  value: string;
  label: string;
}

export interface SpecializedCoursePageCarouselCard {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
}

export interface SpecializedCoursePageSlide {
  id: string;
  enabled: boolean;
  course_id?: number | null;
  linked_course_id?: string | null;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  stat: string;
  image_url?: string | null;
  image_position?: string | null;
}

export interface SpecializedCoursePageSection {
  id: string;
  enabled: boolean;
  title: string;
  description: string;
}

export interface SpecializedCoursePageFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface SpecializedCourseCatalogCategory {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  courseCount: number;
}

export interface SpecializedCourseCatalogCourse {
  id: string;
  title: string;
  instructor: string;
  students: number;
  duration: string;
  rating: number;
  reviews: number;
  price: number;
  previousPrice?: number | null;
  badge?: string | null;
  categoryId: string;
  sectionIds: string[];
  imageUrl: string;
  imagePosition?: string | null;
  imageAccent?: string | null;
}

export interface SpecializedCourseCatalogSection {
  id: string;
  title: string;
  description: string;
  courseIds: string[];
}

export interface SpecializedCoursePurchasedItem {
  id: string;
  title: string;
  progress: number;
  nextLesson: string;
  teacherName?: string | null;
}

export interface SpecializedCourseDiscountContext {
  code: string;
  title?: string | null;
  salesUserId?: string | null;
  salesUserName?: string | null;
  salesUserRole?: string | null;
  connectedTeacherUserId?: number | null;
  restrictToTeacherCourses?: boolean;
}

export interface SpecializedCourseHomePayload {
  usesDemoFallback: boolean;
  discountContext?: SpecializedCourseDiscountContext | null;
  settings: SpecializedCoursePageSettings;
  categories: SpecializedCourseCatalogCategory[];
  courses: SpecializedCourseCatalogCourse[];
  sections: SpecializedCourseCatalogSection[];
  purchasedCourses: SpecializedCoursePurchasedItem[];
}

export interface SpecializedCoursePageLabelSettings {
  course_video_label: string;
  students_label: string;
  certificate_badge: string;
  popular_badge: string;
  view_course_cta: string;
  purchased_badge: string;
  progress_label: string;
  continue_path_label: string;
  continue_learning_cta: string;
  learning_status_text: string;
  more_button: string;
  empty_state: string;
  active_courses_suffix: string;
}

export interface SpecializedCoursePageSettings {
  enabled: boolean;
  disabled: {
    title: string;
    description: string;
  };
  header: {
    eyebrow: string;
    title: string;
  };
  search: {
    placeholder: string;
  };
  access: {
    title: string;
    description: string;
  };
  labels: SpecializedCoursePageLabelSettings;
  hero: {
    enabled: boolean;
    badge: string;
    title: string;
    description: string;
    stats: SpecializedCoursePageStat[];
  };
  purchased: {
    enabled: boolean;
    title: string;
    description: string;
  };
  carousel: {
    enabled: boolean;
    title: string;
    description: string;
    side_cards: SpecializedCoursePageCarouselCard[];
    slides: SpecializedCoursePageSlide[];
  };
  categories: {
    enabled: boolean;
    title: string;
    description: string;
  };
  sections: SpecializedCoursePageSection[];
  highlight_banner: {
    enabled: boolean;
    badge: string;
    title: string;
    description: string;
    items: Array<{
      id: string;
      label: string;
    }>;
  };
  faq: {
    enabled: boolean;
    title: string;
    description: string;
    items: SpecializedCoursePageFaqItem[];
  };
}

export interface TenantMeta {
  tenant_id: string;
  locale?: "fa" | "en" | string;
  fallbackLocale?: "fa" | "en" | string;
  supportedLocales?: string[];
  country?: string;
  defaultCountry?: string;
  supportedCountries?: string[];
  dir?: "rtl" | "ltr";
  htmlLang?: string;
  ogLocale?: string;
  dateLocale?: string;
  calendar?: "jalali" | "gregorian" | "hijri" | string;
  numberingSystem?: string;
  currency?: string;
  tenant_domains: string[];
  name?: string;
  slug?: string;
  landingSiteId?: number;
  primaryDomain?: string;
  isLandingDomain?: boolean;
  demoBar?: {
    enabled: boolean;
    message: string;
    ctaLabel: string;
    url?: string | null;
    openNewTab?: boolean;
  } | null;
  landingSiteSettings?: Record<string, unknown>;
  landingSections?: Record<string, {
    id: number;
    name: string;
    status: "active" | "inactive" | string;
    sortOrder: number;
    content?: Record<string, unknown>;
  }>;
  landingPackages?: SupportRenewalPackage[];
  landingFeatures?: Array<{
    id: number; slug: string; title: string; badgeText?: string | null; short?: string | null; detail?: string | null;
    url: string; isPrimary: boolean; sortOrder: number; videoUrl?: string | null; coverUrl?: string | null;
    imageUrl?: string | null; benefits?: string[]; seo?: Record<string, unknown>;
  }>;
  landingPages?: Record<string, {
    id: number;
    name: string;
    slug: string;
    pageKey: string;
    status: "draft" | "published" | "archived" | string;
    sortOrder: number;
    seo?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  }>;
  setupCompleted: boolean;
  barbersCount: number;
  servicesCount: number;
  supportEndsAt?: string | null;
  supportExpired?: boolean;
  supportDaysRemaining?: number | null;
  customerCancellationCutoffHours?: number;
  storage?: TenantStorageUsage;
  irDomain?: {
    enabled: boolean;
    selfManaged?: boolean;
    managementMode?: "platform_managed" | "self_managed" | string;
    tld?: string | null;
    label?: string | null;
    registeredAt?: string | null;
    lastPaidAt?: string | null;
    renewsAt?: string | null;
    expired?: boolean;
    daysRemaining?: number | null;
    isDueSoon?: boolean;
    amount?: number | null;
    statusKey?: string;
    statusLabel?: string;
    renewalAvailable?: boolean;
    renewalWindowOpen?: boolean;
    renewalBlockedReason?: string | null;
  };
  domainRenewal?: {
    enabled: boolean;
    selfManaged?: boolean;
    managementMode?: "platform_managed" | "self_managed" | string;
    tld?: string | null;
    label?: string | null;
    registeredAt?: string | null;
    lastPaidAt?: string | null;
    renewsAt?: string | null;
    expired?: boolean;
    daysRemaining?: number | null;
    isDueSoon?: boolean;
    amount?: number | null;
    statusKey?: string;
    statusLabel?: string;
    renewalAvailable?: boolean;
    renewalWindowOpen?: boolean;
    renewalBlockedReason?: string | null;
  };
  panelAccessLocked?: boolean;
  panelAccessMessage?: string | null;
  galleryEnabled?: boolean;
  contactEnabled?: boolean;
  storeEnabled?: boolean;
  appointmentBookingDisabled?: boolean;
  articlesSettings?: ArticleSectionSettings;
  articleCategories?: ArticleCategoryItem[];
  articleTags?: ArticleTagItem[];
  articlePosts?: ArticlePostItem[];
  storeHomeSettings?: {
    showCategories: boolean;
    showBestsellers: boolean;
    showGraphicBanner: boolean;
    showPopularProducts: boolean;
    showLatestProducts: boolean;
    showFaq: boolean;
    showBannerOnMainSite: boolean;
    preferStoreAsDefaultLanding?: boolean;
    showBookingEntryOnStore?: boolean;
    mainSiteBannerImageUrl?: string | null;
    mainSiteBannerTitle?: string | null;
    mainSiteBannerDescription?: string | null;
    graphicBannerImageUrl?: string | null;
    graphicBannerBadge?: string | null;
    graphicBannerTitle?: string | null;
    graphicBannerDescription?: string | null;
    graphicBannerButtonLabel?: string | null;
    graphicBannerLink?: string | null;
  };
  storeFaqItems?: StoreFaqItem[];
  storeShippingSettings?: StoreShippingSettings;
  audience?: {
    id: string;
    name: string;
    slug: string;
    singularLabel: string;
    pluralLabel: string;
    businessLabel: string;
    enabledFeatures: string[];
    nutritionFeatures?: string[];
    futureFeatures: string[];
    specializedCourseSettings?: SpecializedCoursePageSettings;
  } | null;
  subscriptionPackage?: {
    id: string;
    name: string;
    durationDays: number;
    userLimit?: number | null;
    userLimitLabel?: string | null;
  } | null;
  activeFeatureModules?: Array<{
    id: string;
    slug: string;
    name: string;
    label?: string;
    metaKey?: string;
    routePrefix?: string;
    expiresAt?: string | null;
  }>;
  customerClubSettings?: {
    moduleActive: boolean;
    isEnabled: boolean;
    isPublicActive: boolean;
  };
  customLandingSettings?: CustomLandingSettings;
  onlineChatSettings?: {
    moduleActive: boolean;
    showOnBookingPage: boolean;
    showInMenu: boolean;
  };
  nutritionLanding?: NutritionLandingSettings;
}

export interface UserNotificationItem {
  id: string;
  title: string;
  message: string;
  recipientRole?: string | null;
  targetType: "all" | "single" | string;
  senderName?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt?: string | null;
  meta?: {
    audienceName?: string | null;
    audienceSlug?: string | null;
    customerClub?: {
      pointsDelta: number;
      walletDelta: number;
      reasonTitle?: string | null;
    } | null;
  };
}

export interface PaginatedUserNotifications {
  items: UserNotificationItem[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface StoreFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface StoreFaqSettings {
  items: StoreFaqItem[];
}

export interface ArticleTagItem {
  id: string;
  name: string;
  slug: string;
  createdAt?: string | null;
}

export interface ArticleTagListPayload {
  items: ArticleTagItem[];
}

export interface ArticleCategoryItem {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  parentName?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string | null;
  children?: ArticleCategoryItem[];
}

export interface ArticleCategoryListPayload {
  items: ArticleCategoryItem[];
  tree: ArticleCategoryItem[];
}

export interface ArticleSectionSettings {
  enabled: boolean;
  showInMenu: boolean;
}

export interface ArticlePostTagSummary {
  id: string;
  name: string;
  slug: string;
}

export interface ArticlePostItem {
  id: string;
  categoryId?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  keyPoints?: string[];
  authorName: string;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  showInFeaturedSlider: boolean;
  isImportant: boolean;
  publishedAt?: string | null;
  publishedAtJalali?: string | null;
  readingTimeMinutes?: number;
  readingTimeLabel?: string;
  viewCount: number;
  tagIds: string[];
  tags: ArticlePostTagSummary[];
  createdAt?: string | null;
}

export interface ArticlePostAdminPayload {
  items: ArticlePostItem[];
  stats: {
    total: number;
    published: number;
    featuredTitle?: string | null;
    importantTitle?: string | null;
    sliderCount: number;
  };
  tagOptions: ArticleTagItem[];
  categoryOptions: ArticleCategoryItem[];
}

export interface ArticlePostPublicListPayload {
  items: ArticlePostItem[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  query?: string | null;
  activeCategory?: Pick<ArticleCategoryItem, "id" | "name" | "slug" | "parentId"> | null;
  activeTag?: Pick<ArticleTagItem, "id" | "name" | "slug"> | null;
  featured?: ArticlePostItem | null;
  heroArticle?: ArticlePostItem | null;
  important?: ArticlePostItem | null;
  latestNews: ArticlePostItem[];
  featuredNews: ArticlePostItem[];
  slider: ArticlePostItem[];
  popular: ArticlePostItem[];
  categories: ArticleCategoryItem[];
  categoryList?: ArticleCategoryItem[];
  tags: ArticleTagItem[];
}

export interface ArticlePostPublicDetailPayload {
  item: ArticlePostItem;
  related: ArticlePostItem[];
  nextArticle?: ArticlePostItem | null;
}

export interface SupportRenewalPackage {
  id: string;
  name: string;
  durationDays: number;
  userLimit?: number | null;
  userLimitLabel?: string | null;
  priceAmount: number;
  discountedPriceAmount?: number | null;
  payableAmount: number;
  discountAmount: number;
  showOnLandingHome?: boolean;
  isLandingRecommended?: boolean;
  landingSortOrder?: number;
  isUpgrade?: boolean;
  upgradeFromPackageName?: string | null;
  upgradeCreditAmount?: number;
  basePayableAmount?: number;
}

export interface SupportRenewalSettings {
  enabled: boolean;
  sandboxEnabled: boolean;
  provider: string;
  enabledGateways?: string[];
  maliartEnabled?: boolean;
  gatewayOptions?: Array<{
    key: string;
    label: string;
  }>;
}

export interface SupportRenewalPublicPackagesPayload {
  audience?: {
    pluralLabel?: string;
    singularLabel?: string;
  };
  packages: SupportRenewalPackage[];
}

export interface SupportRenewalFeatureModule {
  id: string;
  moduleId: string;
  slug: string;
  name: string;
  description?: string | null;
  monthlyPriceAmount: number;
  renewalAmount: number;
  billingMode?: "renewal" | "activation";
  isActive?: boolean;
  currentEndsAt?: string | null;
  selected: boolean;
}

export interface SupportRenewalLineItem {
  type: "support_package" | "feature_module_renewal" | "feature_module_activation" | "storage_addon" | "storage_addon_renewal" | "discount_code";
  title: string;
  description?: string | null;
  amount: number;
  discountAmount: number;
  payableAmount: number;
  metadata?: Record<string, unknown>;
}

export interface TenantStorageUsage {
  usedBytes: number;
  baseQuotaBytes: number;
  extraQuotaBytes: number;
  totalQuotaBytes: number;
  baseQuotaGb: number;
  extraQuotaGb: number;
  totalQuotaGb: number;
  remainingBytes: number;
  isFull: boolean;
  tenantId?: string | null;
}

export type TenantFileCategory = "image" | "audio" | "video" | "document" | "other";

export interface TenantFileItem {
  id: string;
  path: string;
  name: string;
  directory: string;
  extension: string;
  mimeType?: string | null;
  category: TenantFileCategory;
  sizeBytes: number;
  modifiedAt?: string | null;
  url?: string | null;
}

export interface TenantFileManagerPayload {
  items: TenantFileItem[];
  usage: TenantStorageUsage;
  pagination: {
    page: number;
    perPage: number;
    total: number;
    lastPage: number;
  };
}

export interface StorageAddonPreview {
  gb: number;
  remainingDays: number;
  billingDaysPerMonth?: number;
  pricePerGbMonth: number;
  amount: number;
  payableAmount: number;
  startsAt: string;
  endsAt?: string | null;
  currentUsage: TenantStorageUsage;
}

export interface SupportRenewalPreview {
  package: SupportRenewalPackage;
  featureModules: SupportRenewalFeatureModule[];
  lineItems: SupportRenewalLineItem[];
  extraStorageRenewal?: {
    gb: number;
    pricePerGbMonth: number;
    durationDays: number;
    billingDaysPerMonth?: number;
    amount: number;
    payableAmount: number;
  } | null;
  amount: number;
  discountAmount: number;
  payableAmount: number;
  discountCode?: {
    id: string;
    code: string;
    title?: string | null;
    discountType: string;
    discountValue: number;
    discountAmount: number;
    salesUserId?: string | null;
    salesUserName?: string | null;
  } | null;
  previousSupportEndsAt?: string | null;
  newSupportEndsAt: string;
  settings: SupportRenewalSettings;
}

export interface SupportRenewalPayment {
  id: string;
  invoiceNumber: string;
  paymentType: "support_renewal" | "feature_module_activation" | "sms_credit_topup" | "domain_renewal";
  status: "pending" | "paid" | "failed" | "cancelled";
  gateway?: string | null;
  amount: number;
  discountAmount: number;
  payableAmount: number;
  sandboxMode: boolean;
  referenceId?: string | null;
  packageName?: string | null;
  durationDays?: number | null;
  userLimit?: number | null;
  userLimitLabel?: string | null;
  previousSupportEndsAt?: string | null;
  newSupportEndsAt?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
  initiatedByName?: string | null;
  initiatedByMobile?: string | null;
  failureReason?: string | null;
}

export interface DomainRenewalOverview {
  settings: SupportRenewalSettings;
  domain: NonNullable<TenantMeta["domainRenewal"]>;
  availableTlds: Array<{
    tld: string;
    label: string;
    registerAmount: number;
    renewAmount: number;
  }>;
}

export interface DomainRenewalPayment extends SupportRenewalPayment {
  paymentType: "domain_renewal";
  domainTld?: string | null;
  domainName?: string | null;
  domainLabel?: string | null;
  previousRenewsAt?: string | null;
  newRenewsAt?: string | null;
}

export interface PaginatedDomainRenewalPayments {
  items: DomainRenewalPayment[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface PaymentRedirectForm {
  action: string;
  method: string;
  inputs: Record<string, string>;
}

export interface SmsTopUpCheckoutResponse {
  mode: "sandbox" | "gateway";
  paymentUrl?: string | null;
  redirectForm?: PaymentRedirectForm | null;
  payment: SupportRenewalPayment;
  currentBalance?: number | null;
}

export interface ReferralLead {
  id: string;
  mobile: string;
  status: "pending" | "rewarded";
  rewardDurationDays?: number | null;
  purchasedDurationDays?: number | null;
  previousSupportEndsAt?: string | null;
  newSupportEndsAt?: string | null;
  convertedAt?: string | null;
  rewardedAt?: string | null;
  createdAt?: string | null;
}

export interface PaginatedReferralLeads {
  stats: {
    total: number;
    pending: number;
    rewarded: number;
    rewardDays: number;
  };
  items: ReferralLead[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  actorName?: string;
}

export interface PaginatedSupportRenewalPayments {
  items: SupportRenewalPayment[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface FeatureModuleSummary {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  monthlyPriceAmount: number;
  isActive: boolean;
  expiresAt?: string | null;
  status: "active" | "locked";
  ctaNote: string;
}

export interface FeatureModuleActivationPreview {
  module: {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    monthlyPriceAmount: number;
  };
  currentSupportEndsAt: string;
  remainingDays: number;
  amount: number;
  discountAmount: number;
  payableAmount: number;
  message: string;
}

export type CookingRecipeFlag = "important" | "popular" | "frequent" | "low_calorie" | "vegan" | "affordable";

export interface CookingRecipeItem {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  servings: number;
  ingredients?: string | null;
  ingredientsJson: string[];
  instructions?: string | null;
  instructionsJson: string[];
  nutrition?: {
    servings?: string | number;
    perServing?: Record<string, number>;
    total?: Record<string, number>;
    ingredients?: Array<Record<string, string | number>>;
  } | null;
  micronutrients?: Record<string, number> | null;
  isPublished: boolean;
  isActive: boolean;
  sortOrder: number;
  flags: CookingRecipeFlag[];
  imageUrl: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CookingRecipeDetailItem extends CookingRecipeItem {
  stats: {
    servings: number;
    ingredientsCount: number;
    stepsCount: number;
    caloriesKcal?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    fiberG?: number | null;
    sugarG?: number | null;
    sodiumMg?: number | null;
    cholesterolMg?: number | null;
    prepMinutes?: number | null;
    cookMinutes?: number | null;
    difficulty?: string | null;
    rating?: number | null;
  };
  ingredientItems: Array<{
    position: number;
    text: string;
    name: string;
    amount?: string | null;
    checked: boolean;
    nutrition?: Record<string, string | number> | null;
  }>;
  instructionSteps: Array<{
    position: number;
    text: string;
  }>;
  nutritionPerServing: Record<string, number>;
  nutritionTotal: Record<string, number>;
  nutritionIngredients: Array<Record<string, string | number>>;
  source: {
    url?: string | null;
    scrapedAt?: string | null;
  };
}

export interface CookingRecipeDetailPayload {
  item: CookingRecipeDetailItem;
}

export interface CookingRecipeListPayload {
  items: CookingRecipeItem[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface CookingRecipeUpdatePayload {
  title: string;
  description?: string | null;
  servings: number;
  ingredientsJson: string[];
  instructionsJson: string[];
  nutrition?: CookingRecipeItem["nutrition"];
  micronutrients?: Record<string, number> | null;
  isPublished: boolean;
  isActive: boolean;
  sortOrder: number;
  flags: CookingRecipeFlag[];
}

export interface CustomerClubSettings {
  isEnabled: boolean;
  pointsEnabled: boolean;
  walletEnabled: boolean;
  tiersEnabled: boolean;
  rewardsEnabled: boolean;
  autoTierUpgradeEnabled: boolean;
  appointmentPointsEnabled: boolean;
  appointmentFixedPoints: number;
  appointmentPointsPer100k: number;
  appointmentWalletEnabled: boolean;
  appointmentFixedWallet: number;
  storePointsEnabled: boolean;
  storeFixedPoints: number;
  storePointsPer100k: number;
  storeWalletEnabled: boolean;
  storeWalletPercent: number;
  welcomeBonusEnabled: boolean;
  welcomeBonusPoints: number;
  welcomeBonusWallet: number;
  birthdayBonusEnabled: boolean;
  birthdayBonusPoints: number;
  birthdayBonusWallet: number;
  manualAdjustmentsEnabled: boolean;
  showWalletToCustomer: boolean;
  showPointsToCustomer: boolean;
  showTierToCustomer: boolean;
  nutritionRewardsEnabled: boolean;
  nutritionDailyFoodLogEnabled: boolean;
  nutritionDailyFoodLogPoints: number;
  nutritionPerMealLogEnabled: boolean;
  nutritionPerMealLogPoints: number;
  nutritionDailyWaterLogEnabled: boolean;
  nutritionDailyWaterLogPoints: number;
  nutritionWeightLossRewardEnabled: boolean;
  nutritionWeightLossRewardPoints: number;
  nutritionOnlineDietRequestRewardEnabled: boolean;
  nutritionOnlineDietRequestRewardPoints: number;
}

export interface CustomerClubTier {
  id: string;
  title: string;
  slug: string;
  badgeColor: string;
  icon?: string | null;
  minimumPoints: number;
  minimumWallet: number;
  sortOrder: number;
  isActive: boolean;
  benefits: string[];
}

export type CustomerClubRewardType = "wallet_credit" | "bonus_points" | "vip_access";

export interface CustomerClubReward {
  id: string;
  title: string;
  slug: string;
  rewardType: CustomerClubRewardType;
  costPoints: number;
  walletAmount: number;
  bonusPoints: number;
  vipDays: number;
  perUserLimit: number;
  totalLimit?: number | null;
  sortOrder: number;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  description?: string | null;
  canRedeem?: boolean;
}

export interface CustomerClubAccountSummary {
  userId: string;
  name?: string | null;
  mobile: string;
  isVip: boolean;
  pointsBalance: number;
  walletBalance: number;
  lifetimePointsEarned: number;
  lifetimeWalletEarned: number;
  joinedAt?: string | null;
  lastActivityAt?: string | null;
  currentTier?: {
    id?: string;
    title: string;
    badgeColor?: string;
  } | null;
}

export interface CustomerClubLedgerEntry {
  id: string;
  entryType: string;
  sourceType?: string | null;
  sourceId?: string | null;
  pointsDelta: number;
  walletDelta: number;
  pointsBalanceAfter: number;
  walletBalanceAfter: number;
  title: string;
  description?: string | null;
  occurredAt?: string | null;
  user?: {
    id: string;
    name?: string | null;
    mobile: string;
  } | null;
}

export interface CustomerClubRedemption {
  id: string;
  status: string;
  costPoints: number;
  walletAmount: number;
  issuedCode?: string | null;
  redeemedAt?: string | null;
  expiresAt?: string | null;
  reward?: {
    id: string;
    title: string;
    rewardType: CustomerClubRewardType;
  } | null;
}

export interface CustomerClubAdminMember extends CustomerClubAccountSummary {
  email?: string | null;
  registeredAt?: string | null;
}

export interface PaginatedCustomerClubMembers {
  items: CustomerClubAdminMember[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface CustomerClubAdminOverview {
  moduleActive: boolean;
  settings: CustomerClubSettings;
  stats: {
    membersCount: number;
    pointsBalance: number;
    walletBalance: number;
    redemptionsCount: number;
    ledgerEntriesCount: number;
  };
  tiers: CustomerClubTier[];
  rewards: CustomerClubReward[];
  recentLedger: CustomerClubLedgerEntry[];
}

export interface CustomerClubMePayload {
  moduleActive: boolean;
  settings: {
    showWalletToCustomer: boolean;
    showPointsToCustomer: boolean;
    showTierToCustomer: boolean;
    rewardsEnabled: boolean;
  };
  account: CustomerClubAccountSummary;
  rewards: CustomerClubReward[];
  recentLedger: CustomerClubLedgerEntry[];
  recentRedemptions: CustomerClubRedemption[];
}

export interface PanelFinanceWindowStats {
  transactionsCount: number;
  grossAmount: number;
  onlineAmount: number;
  walletAmount: number;
  sandboxCount: number;
  walletOnlyCount: number;
}

export interface PanelFinanceTransaction {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  barberId: string;
  barberName?: string | null;
  serviceName?: string | null;
  appointmentDate: string;
  startTime: string;
  totalAmount: number;
  onlineAmount: number;
  walletAmount: number;
  gateway: string;
  gatewayLabel: string;
  referenceId?: string | null;
  sandboxMode: boolean;
  paidAt?: string | null;
}

export interface PanelFinanceNutritionTransaction {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  packageName?: string | null;
  totalAmount: number;
  discountAmount: number;
  payableAmount: number;
  gateway: string;
  gatewayLabel: string;
  referenceId?: string | null;
  sandboxMode: boolean;
  paidAt?: string | null;
}

export interface PanelFinanceDashboardPayload {
  filter: {
    barberId?: string | null;
    barberName?: string | null;
    forcedToActorBarber: boolean;
  };
  stats: {
    overall: PanelFinanceWindowStats;
    today: PanelFinanceWindowStats;
    yesterday: PanelFinanceWindowStats;
    thisWeek: PanelFinanceWindowStats;
  };
  latestTransactions: PanelFinanceTransaction[];
  nutritionStats?: {
    overall: PanelFinanceWindowStats;
    today: PanelFinanceWindowStats;
    yesterday: PanelFinanceWindowStats;
    thisWeek: PanelFinanceWindowStats;
  };
  latestNutritionTransactions?: PanelFinanceNutritionTransaction[];
}

export interface GalleryImage {
  id: string;
  title?: string | null;
  description?: string | null;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string | null;
}

export interface GalleryPublicPayload {
  enabled: boolean;
  items: GalleryImage[];
}

export interface GalleryAdminPayload extends GalleryPublicPayload {
  actorRole?: UserRole;
}

export type AppearancePrimaryTheme = "amber" | "rose" | "emerald" | "sky" | "violet" | "copper" | "teal" | "indigo" | "pink" | "lime" | "ruby" | "cyan" | "orange" | "blue";
export type AppearanceCardTheme = "slate" | "navy" | "graphite" | "plum" | "forest" | "midnight" | "charcoal" | "ocean" | "sand" | "mocha" | "steel" | "wine";
export type AppearanceBackgroundTheme = "slate" | "midnight" | "ocean" | "forest" | "plum" | "charcoal" | "dusk" | "espresso" | "aurora" | "stone";
export type AppearanceMode = "dark" | "light";
export type BookingTemplate = "default" | "pink" | "blue" | "green" | "red" | "purple" | "yellow" | "olive";

export interface AppearanceSettings {
  storeName: string;
  bookingHeaderTitle?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  bookingTemplate: BookingTemplate;
  themeMode: AppearanceMode;
  customThemeEnabled: boolean;
  primaryTheme: AppearancePrimaryTheme;
  accentTheme: AppearancePrimaryTheme;
  backgroundTheme: AppearanceBackgroundTheme;
  cardTheme: AppearanceCardTheme;
}

export interface HelpTopic {
  id: string;
  topicKey: string;
  moduleKey?: string | null;
  title: string;
  summary?: string | null;
  body?: string | null;
  videoUrl?: string | null;
  coverImageUrl?: string | null;
  sortOrder: number;
  showInHelpCenter: boolean;
  showInPageHeader: boolean;
  audience?: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
}

export interface HelpTopicListPayload {
  items: HelpTopic[];
}

export interface PaginatedAppointments {
  items: Appointment[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface PaginatedTenantUsers {
  items: TenantPanelUser[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  selectedBarberId?: string;
  selectedBarberName?: string;
  actorRole?: UserRole;
  vipFeatureActive?: boolean;
}

export type SmsCampaignPresetKey =
  | "all_customers"
  | "by_barber"
  | "by_service"
  | "inactive_customers"
  | "inactive_service_customers"
  | "single_visit"
  | "loyal_customers"
  | "cancelled_appointments"
  | "booked_for_others"
  | "new_customers"
  | "at_risk_customers"
  | "store_customers"
  | "store_paid_customers"
  | "store_pending_customers"
  | "store_no_orders"
  | "high_value_store_customers"
  | "nutrition_no_diets"
  | "nutrition_has_diets"
  | "nutrition_session_number"
  | "nutrition_package_expired"
  | "nutrition_package_active"
  | "nutrition_active_diet"
  | "nutrition_pending_request"
  | "appointment_reopen_notification";

export type SmsCampaignStatus =
  | "draft"
  | "pending_review"
  | "rejected"
  | "queued"
  | "sending"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

export interface SmsCampaignFilters {
  preset: SmsCampaignPresetKey;
  barber_id?: number;
  service_id?: number;
  inactive_months?: number;
  new_customer_days?: number;
  loyal_min_appointments?: number;
  min_store_total_amount?: number;
  nutrition_session_number?: number;
  message?: string;
}

export interface SmsCampaignRecipient {
  id: string;
  customerPhone: string;
  customerName?: string | null;
  lastBarberName?: string | null;
  lastServiceName?: string | null;
  lastAppointmentAt?: string | null;
  firstAppointmentAt?: string | null;
  appointmentsCount: number;
  messageEncoding?: "persian" | "english";
  messagePartsCount?: number;
  unitPrice?: number;
  status: "pending" | "sent" | "failed" | "cancelled";
  providerMessageId?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
}

export interface SmsCampaign {
  id: string;
  name: string;
  presetKey: SmsCampaignPresetKey;
  status: SmsCampaignStatus;
  message: string;
  messageEncoding?: "persian" | "english";
  messageCharactersCount?: number;
  messagePartsCount?: number;
  unitPrice?: number;
  estimatedTotalPrice?: number;
  spentTotalPrice?: number;
  filters: SmsCampaignFilters;
  recipientsCount: number;
  sentCount: number;
  successCount: number;
  failedCount: number;
  cancelledCount: number;
  createdAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  cancelledAt?: string | null;
  lastError?: string | null;
  approvalStatus?: "draft" | "pending_review" | "approved" | "rejected";
  rejectionReason?: string | null;
  createdByName?: string | null;
  createdByPhone?: string | null;
}

export interface SmsCampaignPreview {
  filters: SmsCampaignFilters;
  total: number;
  pricing?: {
    encoding: "persian" | "english";
    charactersCount: number;
    partsCount: number;
    unitPrice: number;
    totalPrice: number;
  };
  samples: Array<{
    customer_phone: string;
    customer_name?: string | null;
    last_barber_id?: number | null;
    last_barber_name?: string | null;
    last_service_id?: number | null;
    last_service_name?: string | null;
    last_appointment_at?: string | null;
    first_appointment_at?: string | null;
    appointments_count: number;
    store_orders_count?: number;
    store_paid_orders_count?: number;
    store_total_amount?: number;
    nutrition_requests_count?: number;
    nutrition_published_diets_count?: number;
    nutrition_active_package_count?: number;
    nutrition_active_diet_count?: number;
    latest_nutrition_activity_at?: string | null;
  }>;
}

export interface PaginatedSmsCampaigns {
  items: SmsCampaign[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface SmsCampaignDetails {
  campaign: SmsCampaign;
  recipients: {
    items: SmsCampaignRecipient[];
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  };
}

export interface SmsOutboundItem {
  id: string;
  campaignId?: string | null;
  type: string;
  templateKey?: string | null;
  provider?: string | null;
  sender?: string | null;
  recipientMobile: string;
  recipientName?: string | null;
  message: string;
  messageEncoding: "persian" | "english";
  partsCount: number;
  unitPrice: number;
  totalPrice: number;
  status: "pending" | "sent" | "failed" | "cancelled" | string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt?: string | null;
}

export interface PaginatedSmsOutbounds {
  items: SmsOutboundItem[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  search?: string;
  stats?: {
    totalSent: number;
    sentToday: number;
    sentYesterday: number;
    sentThisWeek: number;
  };
}

export interface SmsBulkRecipientInput {
  mobile: string;
  name?: string;
}

export type NotificationCampaignPresetKey =
  | "all_users"
  | "all_customers"
  | "by_barber"
  | "by_service"
  | "inactive_customers"
  | "inactive_service_customers"
  | "single_visit"
  | "loyal_customers"
  | "cancelled_appointments"
  | "booked_for_others"
  | "new_customers"
  | "at_risk_customers"
  | "appointments_count_at_least"
  | "store_customers"
  | "store_paid_customers"
  | "store_pending_customers"
  | "store_no_orders"
  | "high_value_store_customers"
  | "nutrition_no_diets"
  | "nutrition_has_diets"
  | "nutrition_session_number"
  | "nutrition_package_expired"
  | "nutrition_package_active"
  | "nutrition_active_diet"
  | "nutrition_pending_request";

export type NotificationCampaignStatus =
  | "draft"
  | "queued"
  | "sending"
  | "completed"
  | "cancelled"
  | "failed";

export interface NotificationCampaignFilters {
  preset: NotificationCampaignPresetKey;
  role?: "admin" | "barber" | "customer";
  barber_id?: number;
  service_id?: number;
  inactive_months?: number;
  new_customer_days?: number;
  loyal_min_appointments?: number;
  min_appointments?: number;
  min_store_total_amount?: number;
  nutrition_session_number?: number;
}

export interface NotificationCampaignRecipient {
  id: string;
  tenantUserId?: string | null;
  recipientPhone: string;
  recipientName?: string | null;
  recipientRole?: string | null;
  appointmentsCount: number;
  lastAppointmentAt?: string | null;
  storeOrdersCount: number;
  storePaidOrdersCount: number;
  storeTotalAmount: number;
  status: "pending" | "sent" | "failed" | "cancelled";
  errorMessage?: string | null;
  sentAt?: string | null;
}

export interface NotificationCampaign {
  id: string;
  name: string;
  presetKey: NotificationCampaignPresetKey;
  status: NotificationCampaignStatus;
  title: string;
  message: string;
  filters: NotificationCampaignFilters;
  recipientsCount: number;
  successCount: number;
  failedCount: number;
  cancelledCount: number;
  createdAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  cancelledAt?: string | null;
  lastError?: string | null;
  createdByName?: string | null;
  createdByPhone?: string | null;
}

export interface NotificationCampaignPreview {
  filters: NotificationCampaignFilters;
  total: number;
  samples: Array<{
    tenant_user_id?: number | null;
    customer_phone: string;
    customer_name?: string | null;
    user_role?: string | null;
    last_barber_id?: number | null;
    last_barber_name?: string | null;
    last_service_id?: number | null;
    last_service_name?: string | null;
    last_appointment_at?: string | null;
    first_appointment_at?: string | null;
    appointments_count: number;
    store_orders_count: number;
    store_paid_orders_count: number;
    store_total_amount: number;
    nutrition_requests_count?: number;
    nutrition_published_diets_count?: number;
    nutrition_active_package_count?: number;
    nutrition_active_diet_count?: number;
    latest_nutrition_activity_at?: string | null;
  }>;
}

export interface PaginatedNotificationCampaigns {
  items: NotificationCampaign[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface NotificationCampaignDetails {
  campaign: NotificationCampaign;
  recipients: {
    items: NotificationCampaignRecipient[];
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  };
}

export interface StoreCheckoutOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: "online" | "card" | "cod";
  shippingMethod: "courier" | "express" | "pickup";
  customerName: string;
  customerPhone: string;
  itemsCount: number;
  subtotalAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  createdAt?: string | null;
}

export interface StoreCheckoutPayment {
  id: string;
  invoiceNumber: string;
  method: "online" | "card" | "cod";
  gateway?: PaymentProvider | null;
  status: string;
  amount: number;
  sandboxMode: boolean;
  referenceId?: string | null;
  cardNote?: string;
}

export interface StoreCheckoutResponse {
  mode: "free" | "sandbox" | "gateway" | "card" | "cod";
  order: StoreCheckoutOrder;
  payment: StoreCheckoutPayment;
  cardNote?: string | null;
  redirectForm?: {
    action: string;
    method: string;
    inputs: Record<string, string>;
  } | null;
  paymentUrl?: string | null;
}

export interface StoreOrderItemSummary {
  id: string;
  productId?: string | null;
  title: string;
  subtitle?: string | null;
  imageLabel?: string | null;
  unitAmount: number;
  quantity: number;
  totalAmount: number;
}

export interface StoreOrderSummary extends StoreCheckoutOrder {
  statusLabel?: string;
  items: StoreOrderItemSummary[];
  payment?: StoreCheckoutPayment | null;
  adminNote?: string;
  shippingTrackingCode?: string;
  shippingCarrier?: string;
  deliveryTitle?: string | null;
  deliveryProvinceName?: string | null;
  deliveryCityName?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  deliveryAddress?: string | null;
  statusHistory?: Array<{
    at?: string;
    from?: string;
    to?: string;
    actorName?: string;
    note?: string | null;
  }>;
  adminComments?: Array<{
    at?: string;
    actorName?: string;
    body?: string | null;
  }>;
  smsLog?: Array<{
    at?: string;
    status?: string;
    template?: StoreSmsTemplateKey | string;
    ok?: boolean;
    message?: string;
    actorName?: string;
  }>;
  updatedAt?: string | null;
}

export interface PaginatedStoreOrders {
  items: StoreOrderSummary[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export type PaginatedStoreAdminOrders = PaginatedStoreOrders;

export interface StoreGeneralSettings {
  enabled: boolean;
  storeModuleActive?: boolean;
  smsEnabled: boolean;
  smsTemplateAfterOrder?: string;
  smsTemplateAfterApproval?: string;
  smsTemplateAfterShippingCode?: string;
  smsTemplateAfterRejection?: string;
  smsTemplatesV2?: Record<StoreSmsTemplateKey, SmsTemplateConfig>;
}

export interface CustomerFeedbackQuestion {
  id: string;
  title: string;
  displayType: "emoji" | "star";
  sortOrder: number;
  isActive: boolean;
}

export interface CustomerFeedbackSettings {
  moduleActive: boolean;
  purchaseUrl: string;
  smsSettingsUrl: string;
  enabled: boolean;
  emojiLabels: {
    excellent: string;
    good: string;
    average: string;
    bad: string;
  };
  audienceScope: "all" | "professional";
  professionalIds: number[];
  firstSendDelayDays: number;
  triggerAfterCompletedCount: number;
  maxResponsesPerCustomer: number;
  surveyTitle: string;
  introText: string;
  successText: string;
  professionals: Array<{
    id: string;
    name: string;
  }>;
  questions: CustomerFeedbackQuestion[];
}

export interface CustomerFeedbackPublicPayload {
  token: string;
  status: "pending" | "sent" | "responded" | "cancelled";
  businessName: string;
  customerName?: string | null;
  professionalName?: string | null;
  serviceName?: string | null;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
  surveyTitle: string;
  introText: string;
  successText: string;
  submittedAt?: string | null;
  emojiLabels: {
    excellent: string;
    good: string;
    average: string;
    bad: string;
  };
  questions: Array<{
    id: string;
    title: string;
    displayType: "emoji" | "star";
  }>;
}

export interface CustomerFeedbackPublicAnswerInput {
  questionId: string;
  choiceKey?: string | null;
  value: number;
}

export interface CustomerFeedbackReportSummary {
  sentCount: number;
  respondedCount: number;
  pendingCount: number;
  responseRate: number;
}

export interface CustomerFeedbackReportQuestionStat {
  questionId: string;
  title: string;
  displayType: "emoji" | "star";
  totalAnswers: number;
  options: Array<{
    key: string;
    label: string;
    count: number;
    percent: number;
  }>;
}

export interface CustomerFeedbackReportParticipant {
  responseId: string;
  customerName: string;
  customerMobile: string;
  professionalName: string;
  serviceName: string;
  appointmentDate?: string | null;
  respondedAt?: string | null;
}

export interface CustomerFeedbackReportPayload {
  summary: CustomerFeedbackReportSummary;
  questions: CustomerFeedbackReportQuestionStat[];
  participants: CustomerFeedbackReportParticipant[];
}

export interface CustomerFeedbackReportResponseDetail {
  responseId: string;
  customerName: string;
  customerMobile: string;
  professionalName: string;
  serviceName: string;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
  respondedAt?: string | null;
  answers: Array<{
    questionTitle: string;
    displayType: "emoji" | "star";
    label: string;
    value: number;
  }>;
}

export interface StoreHomeSettings {
  showCategories: boolean;
  showBestsellers: boolean;
  showGraphicBanner: boolean;
  showPopularProducts: boolean;
  showLatestProducts: boolean;
  showFaq: boolean;
  showBannerOnMainSite: boolean;
  preferStoreAsDefaultLanding?: boolean;
  showBookingEntryOnStore?: boolean;
  mainSiteBannerImageUrl?: string | null;
  mainSiteBannerTitle?: string | null;
  mainSiteBannerDescription?: string | null;
  graphicBannerImageUrl?: string | null;
  graphicBannerBadge?: string | null;
  graphicBannerTitle?: string | null;
  graphicBannerDescription?: string | null;
  graphicBannerButtonLabel?: string | null;
  graphicBannerLink?: string | null;
}

export type NutritionLandingVariant = "classic" | "diet" | "all_features" | "diet_priority";

export interface NutritionLandingVariantSettings {
  content: Record<string, string>;
  imageUrl?: string | null;
}

export interface NutritionBookingBannerSettings {
  enabled: boolean;
  content: Record<string, string>;
  imageUrl?: string | null;
}

export interface NutritionLandingSettings {
  available?: boolean;
  preferAsDefault: boolean;
  activeVariant: NutritionLandingVariant;
  variants: Partial<Record<NutritionLandingVariant, NutritionLandingVariantSettings>>;
  bookingBanner: NutritionBookingBannerSettings;
}


export interface StoreShippingCityAmount {
  id: string;
  provinceId: number;
  provinceName: string;
  cityId: number;
  cityName: string;
  amount: number;
}

export interface StoreShippingCity {
  id: string;
  provinceId: number;
  provinceName: string;
  cityId: number;
  cityName: string;
}

export interface StoreShippingSettings {
  postalEnabled: boolean;
  postalBaseAmount: number;
  postalCityOverrides: StoreShippingCityAmount[];
  expressEnabled: boolean;
  expressAmount: number;
  expressCities: StoreShippingCity[];
  pickupEnabled: boolean;
}

export interface StoreCategoryItem {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  showOnHome?: boolean;
  imageUrl?: string | null;
  createdAt?: string | null;
}

export interface StoreCategoryListPayload {
  items: StoreCategoryItem[];
}

export interface StoreProductItem {
  id: string;
  categoryId?: string | null;
  categoryName?: string | null;
  title: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  priceAmount: number;
  discountedPriceAmount?: number | null;
  stockQuantity: number;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  isBestseller: boolean;
  isPopular: boolean;
  reviewsEnabled: boolean;
  imageUrl?: string | null;
  galleryImages: Array<{
    id: string;
    url: string;
  }>;
  galleryImageUrls: string[];
  createdAt?: string | null;
}

export interface StoreProductListPayload {
  items: StoreProductItem[];
}

export interface StoreProductReviewItem {
  id: string;
  storeProductId: string;
  productTitle?: string | null;
  tenantUserId?: string | null;
  reviewerName: string;
  rating: number;
  body: string;
  adminReply?: string | null;
  isApproved: boolean;
  createdAt?: string | null;
}

export interface StoreProductReviewListPayload {
  items: StoreProductReviewItem[];
}

export interface StoreDashboardStatBlock {
  productsCount: number;
  ordersCount: number;
  newOrdersCount: number;
  reviewsCount: number;
}

export interface StoreDashboardOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: "online" | "card" | "cod";
  shippingMethod: "courier" | "express" | "pickup";
  customerName: string;
  customerPhone: string;
  itemsCount: number;
  subtotalAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  createdAt?: string | null;
  items: Array<{
    title: string;
    quantity: number;
  }>;
}

export interface StoreDashboardReview {
  id: string;
  reviewerName: string;
  rating: number;
  body: string;
  adminReply?: string | null;
  isApproved: boolean;
  createdAt?: string | null;
  product: {
    id: string;
    title: string;
  };
}

export interface StoreDashboardPayload {
  stats: StoreDashboardStatBlock;
  latestOrders: StoreDashboardOrder[];
  latestReviews: StoreDashboardReview[];
}

export type SupportTicketStatus = "waiting_admin" | "waiting_requester" | "closed";

export interface SupportTicket {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  messagesCount: number;
  requesterUnreadCount: number;
  adminUnreadCount: number;
  lastMessageAt?: string | null;
  createdAt?: string | null;
  closedAt?: string | null;
}

export interface SupportTicketMessage {
  id: string;
  senderType: "tenant_user" | "central_admin";
  senderName?: string | null;
  senderRole?: string | null;
  body: string;
  createdAt?: string | null;
  attachments: Array<{
    id: string;
    url: string;
    originalName: string;
    mimeType?: string | null;
    size: number;
  }>;
}

export interface PaginatedSupportTickets {
  items: SupportTicket[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  stats: {
    total: number;
    open: number;
    answered: number;
    closed: number;
    unread: number;
  };
}

export interface SupportTicketDetails {
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
}

export interface OnlineChatAttachment {
  id: string;
  url: string;
  originalName: string;
  mimeType?: string | null;
  size: number;
}

export interface OnlineChatMessage {
  id: string;
  senderType: "customer" | "panel_user" | "system";
  senderName?: string | null;
  senderRole?: string | null;
  body?: string | null;
  attachmentsCount: number;
  createdAt?: string | null;
  attachments: OnlineChatAttachment[];
}

export interface OnlineChatConversationSummary {
  id: string;
  status: "open" | "closed";
  lastMessagePreview?: string | null;
  lastMessageSenderRole?: string | null;
  lastMessageAt?: string | null;
  customerUnreadCount: number;
  adminUnreadCount: number;
  createdAt?: string | null;
  closedAt?: string | null;
  customer?: {
    id: string;
    name?: string | null;
    mobile?: string | null;
    role?: string | null;
    isVip?: boolean;
  } | null;
  assignedTo?: {
    id: string;
    name?: string | null;
    mobile?: string | null;
    role?: string | null;
  } | null;
}

export interface OnlineChatConversationDetails {
  conversation: OnlineChatConversationSummary | null;
  messages: OnlineChatMessage[];
  messagesMeta: {
    hasOlder: boolean;
    oldestMessageId?: string | null;
  };
}

export interface OnlineChatAdminDashboardPayload {
  items: OnlineChatConversationSummary[];
  stats: {
    total: number;
    open: number;
    closed: number;
    unread: number;
  };
}
