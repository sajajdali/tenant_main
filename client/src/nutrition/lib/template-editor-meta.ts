export type NutritionDietPlanMode = "daily_prescription" | "user_choice" | "fixed_text";

export type NutritionTemplateEditorMeta = {
  dietPlanMode: NutritionDietPlanMode;
  allowFoodReplacement: boolean;
  suggestDailyReplacements: boolean;
};

const META_PREFIX = "[[NUTRITION_TEMPLATE_META]]";

const DEFAULT_META: NutritionTemplateEditorMeta = {
  dietPlanMode: "daily_prescription",
  allowFoodReplacement: false,
  suggestDailyReplacements: false,
};

export function parseNutritionTemplateConditions(raw?: string | null): {
  cleanText: string;
  meta: NutritionTemplateEditorMeta;
} {
  if (!raw) {
    return { cleanText: "", meta: DEFAULT_META };
  }

  const lines = raw.split("\n");
  const metaLineIndex = lines.findIndex((line) => line.startsWith(META_PREFIX));

  if (metaLineIndex === -1) {
    return {
      cleanText: raw,
      meta: DEFAULT_META,
    };
  }

  const metaLine = lines[metaLineIndex].slice(META_PREFIX.length);
  let parsedMeta = DEFAULT_META;

  try {
    const candidate = JSON.parse(metaLine) as Partial<NutritionTemplateEditorMeta>;
    parsedMeta = {
      dietPlanMode:
        candidate.dietPlanMode === "user_choice" || candidate.dietPlanMode === "fixed_text" || candidate.dietPlanMode === "daily_prescription"
          ? candidate.dietPlanMode
          : DEFAULT_META.dietPlanMode,
      allowFoodReplacement: candidate.allowFoodReplacement === true,
      suggestDailyReplacements: candidate.suggestDailyReplacements === true,
    };
  } catch {
    parsedMeta = DEFAULT_META;
  }

  const cleanLines = lines.filter((_, index) => index !== metaLineIndex);

  return {
    cleanText: cleanLines.join("\n").trim(),
    meta: parsedMeta,
  };
}

export function buildNutritionTemplateConditions(
  cleanText: string,
  meta: NutritionTemplateEditorMeta,
): string {
  const normalizedText = cleanText.trim();
  const encodedMeta = `${META_PREFIX}${JSON.stringify(meta)}`;

  return normalizedText ? `${normalizedText}\n${encodedMeta}` : encodedMeta;
}
