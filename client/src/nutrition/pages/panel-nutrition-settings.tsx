import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Info, Loader2, RotateCcw, Save, Settings2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { NutritionSettingsPayload } from "@/lib/types";
import { useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type PromptKey = keyof NutritionSettingsPayload["promptSettings"];

type PromptCardMeta = {
  key: PromptKey;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  placeholderKey: MessageKey;
};

type AiLimitFieldKey =
  | "mealPhotoAnalysisHourlyLimit"
  | "mealPhotoAnalysisDietLimit"
  | "manualMealNutritionHourlyLimit"
  | "manualMealNutritionDietLimit"
  | "mealReplacementHourlyLimit"
  | "mealReplacementDietLimit";

type AiLimitGroup = {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  hourlyKey: AiLimitFieldKey;
  dietKey: AiLimitFieldKey;
};

const PROMPT_FIELDS: PromptCardMeta[] = [
  {
    key: "general",
    titleKey: "panelNutritionSettings.prompt.general.title",
    descriptionKey: "panelNutritionSettings.prompt.general.description",
    placeholderKey: "panelNutritionSettings.prompt.general.placeholder",
  },
  {
    key: "user_choice",
    titleKey: "panelNutritionSettings.prompt.userChoice.title",
    descriptionKey: "panelNutritionSettings.prompt.userChoice.description",
    placeholderKey: "panelNutritionSettings.prompt.userChoice.placeholder",
  },
  {
    key: "daily_prescription",
    titleKey: "panelNutritionSettings.prompt.dailyPrescription.title",
    descriptionKey: "panelNutritionSettings.prompt.dailyPrescription.description",
    placeholderKey: "panelNutritionSettings.prompt.dailyPrescription.placeholder",
  },
  {
    key: "fixed_text",
    titleKey: "panelNutritionSettings.prompt.fixedText.title",
    descriptionKey: "panelNutritionSettings.prompt.fixedText.description",
    placeholderKey: "panelNutritionSettings.prompt.fixedText.placeholder",
  },
  {
    key: "meal_replacement",
    titleKey: "panelNutritionSettings.prompt.mealReplacement.title",
    descriptionKey: "panelNutritionSettings.prompt.mealReplacement.description",
    placeholderKey: "panelNutritionSettings.prompt.mealReplacement.placeholder",
  },
  {
    key: "manual_meal_nutrition",
    titleKey: "panelNutritionSettings.prompt.manualMealNutrition.title",
    descriptionKey: "panelNutritionSettings.prompt.manualMealNutrition.description",
    placeholderKey: "panelNutritionSettings.prompt.manualMealNutrition.placeholder",
  },
  {
    key: "meal_photo_analysis",
    titleKey: "panelNutritionSettings.prompt.mealPhotoAnalysis.title",
    descriptionKey: "panelNutritionSettings.prompt.mealPhotoAnalysis.description",
    placeholderKey: "panelNutritionSettings.prompt.mealPhotoAnalysis.placeholder",
  },
  {
    key: "diet_explanations",
    titleKey: "panelNutritionSettings.prompt.dietExplanations.title",
    descriptionKey: "panelNutritionSettings.prompt.dietExplanations.description",
    placeholderKey: "panelNutritionSettings.prompt.dietExplanations.placeholder",
  },
];

const AI_LIMIT_GROUPS: AiLimitGroup[] = [
  {
    titleKey: "panelNutritionSettings.limit.mealPhoto.title",
    descriptionKey: "panelNutritionSettings.limit.mealPhoto.description",
    hourlyKey: "mealPhotoAnalysisHourlyLimit",
    dietKey: "mealPhotoAnalysisDietLimit",
  },
  {
    titleKey: "panelNutritionSettings.limit.manualMeal.title",
    descriptionKey: "panelNutritionSettings.limit.manualMeal.description",
    hourlyKey: "manualMealNutritionHourlyLimit",
    dietKey: "manualMealNutritionDietLimit",
  },
  {
    titleKey: "panelNutritionSettings.limit.mealReplacement.title",
    descriptionKey: "panelNutritionSettings.limit.mealReplacement.description",
    hourlyKey: "mealReplacementHourlyLimit",
    dietKey: "mealReplacementDietLimit",
  },
];

function createEmptySettings(): NutritionSettingsPayload {
  return {
    manualAiApprovalRequired: false,
    holdIncompletePrescriptionsForReview: true,
    exerciseLoggingEnabled: true,
    outOfPlanMealLoggingEnabled: true,
    mealPhotoAnalysisEnabled: true,
    mealPhotoAnalysisHourlyLimit: null,
    mealPhotoAnalysisDietLimit: null,
    manualMealNutritionHourlyLimit: null,
    manualMealNutritionDietLimit: null,
    mealReplacementHourlyLimit: null,
    mealReplacementDietLimit: null,
    dietGenerationPrompt: "",
    promptSettings: {
      general: { value: "", default: "", customized: false },
      user_choice: { value: "", default: "", customized: false },
      daily_prescription: { value: "", default: "", customized: false },
      fixed_text: { value: "", default: "", customized: false },
      meal_replacement: { value: "", default: "", customized: false },
      manual_meal_nutrition: { value: "", default: "", customized: false },
      meal_photo_analysis: { value: "", default: "", customized: false },
      diet_explanations: { value: "", default: "", customized: false },
    },
  };
}

function parseOptionalPositiveInt(value: string) {
  const parsed = Number(value);

  return value.trim() === "" || !Number.isFinite(parsed) ? null : Math.max(1, Math.floor(parsed));
}

export default function PanelNutritionSettingsPage() {
  const { toast } = useToast();
  const t = useT();
  const { dir, isRtl } = useLocale();
  const tenantMeta = getInitialTenantMeta();
  const audienceSlug = tenantMeta?.audience?.slug || "";
  const isNutritionAudience = ["nutritionists", "nutrition-doctors"].includes(audienceSlug);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingPromptKey, setResettingPromptKey] = useState<PromptKey | null>(null);
  const [settings, setSettings] = useState<NutritionSettingsPayload>(createEmptySettings);

  const promptCards = useMemo(() => PROMPT_FIELDS, []);

  const loadSettings = async () => {
    setLoading(true);
    const result = await api.nutritionSettings.get();

    if (result.success) {
      setSettings(result.data);
    } else {
      toast({ variant: "destructive", title: t("panelNutritionSettings.toast.loadFailed"), description: result.message || t("panelNutritionSettings.toast.loadFailedDescription") });
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!isNutritionAudience) {
      setLoading(false);
      return;
    }

    void loadSettings();
  }, [isNutritionAudience]);

  const handlePromptChange = (key: PromptKey, value: string) => {
    setSettings((current) => ({
      ...current,
      dietGenerationPrompt: key === "general" ? value : current.dietGenerationPrompt,
      promptSettings: {
        ...current.promptSettings,
        [key]: {
          ...current.promptSettings[key],
          value,
          customized: value.trim() !== current.promptSettings[key].default.trim(),
        },
      },
    }));
  };

  const settingsPayload = (source: NutritionSettingsPayload, promptOverrides: Partial<Record<PromptKey, string>> = {}) => ({
    manualAiApprovalRequired: source.manualAiApprovalRequired,
    holdIncompletePrescriptionsForReview: source.holdIncompletePrescriptionsForReview,
    exerciseLoggingEnabled: source.exerciseLoggingEnabled,
    outOfPlanMealLoggingEnabled: source.outOfPlanMealLoggingEnabled,
    mealPhotoAnalysisEnabled: source.mealPhotoAnalysisEnabled,
    mealPhotoAnalysisHourlyLimit: source.mealPhotoAnalysisHourlyLimit ?? null,
    mealPhotoAnalysisDietLimit: source.mealPhotoAnalysisDietLimit ?? null,
    manualMealNutritionHourlyLimit: source.manualMealNutritionHourlyLimit ?? null,
    manualMealNutritionDietLimit: source.manualMealNutritionDietLimit ?? null,
    mealReplacementHourlyLimit: source.mealReplacementHourlyLimit ?? null,
    mealReplacementDietLimit: source.mealReplacementDietLimit ?? null,
    dietGenerationPrompt: promptOverrides.general ?? source.promptSettings.general.value,
    promptSettings: {
      general: promptOverrides.general ?? source.promptSettings.general.value,
      user_choice: promptOverrides.user_choice ?? source.promptSettings.user_choice.value,
      daily_prescription: promptOverrides.daily_prescription ?? source.promptSettings.daily_prescription.value,
      fixed_text: promptOverrides.fixed_text ?? source.promptSettings.fixed_text.value,
      meal_replacement: promptOverrides.meal_replacement ?? source.promptSettings.meal_replacement.value,
      manual_meal_nutrition: promptOverrides.manual_meal_nutrition ?? source.promptSettings.manual_meal_nutrition.value,
      meal_photo_analysis: promptOverrides.meal_photo_analysis ?? source.promptSettings.meal_photo_analysis.value,
      diet_explanations: promptOverrides.diet_explanations ?? source.promptSettings.diet_explanations.value,
    },
  });

  const resetPrompt = async (key: PromptKey) => {
    const previousSettings = settings;
    const nextSettings = {
      ...settings,
      dietGenerationPrompt: key === "general" ? settings.promptSettings[key].default : settings.dietGenerationPrompt,
      promptSettings: {
        ...settings.promptSettings,
        [key]: {
          ...settings.promptSettings[key],
          value: settings.promptSettings[key].default,
          customized: false,
        },
      },
    };

    setSettings(nextSettings);
    setResettingPromptKey(key);

    const result = await api.nutritionSettings.update(settingsPayload(nextSettings, { [key]: "" }));

    if (result.success) {
      setSettings(result.data);
      toast({ title: t("panelNutritionSettings.toast.promptReset"), description: t("panelNutritionSettings.toast.promptResetDescription") });
    } else {
      setSettings(previousSettings);
      toast({ variant: "destructive", title: t("panelNutritionSettings.toast.promptResetFailed"), description: result.message || t("panelNutritionSettings.toast.tryAgain") });
    }

    setResettingPromptKey(null);
  };

  const saveSettings = async () => {
    setSaving(true);

    const result = await api.nutritionSettings.update(settingsPayload(settings));

    if (result.success) {
      setSettings(result.data);
      toast({ title: t("panelNutritionSettings.toast.saved"), description: t("panelNutritionSettings.toast.savedDescription") });
    } else {
      toast({ variant: "destructive", title: t("panelNutritionSettings.toast.saveFailed"), description: result.message || t("panelNutritionSettings.toast.saveFailedDescription") });
    }

    setSaving(false);
  };

  if (!isNutritionAudience) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 text-foreground" dir={dir}>
        <div className="mx-auto max-w-3xl">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("panelNutritionSettings.accessDenied.title")}</CardTitle>
              <CardDescription>{t("panelNutritionSettings.accessDenied.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/panel">
                <Button variant="outline">{t("panelNutritionSettings.backToPanel")}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06131d] px-4 py-8 text-white" dir={dir}>
        <div className="mx-auto flex max-w-3xl items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.04] p-10">
          <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] pb-24 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_22%),linear-gradient(180deg,rgba(6,19,29,0.97),rgba(4,10,17,1))]" />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#06131d]/90 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-xl font-black text-white">{t("panelNutritionSettings.title")}</h1>
          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("panelNutritionSettings.back")} className="h-10 w-10 rounded-2xl border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]">
              {isRtl ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl space-y-5 px-4 py-6">
        <section className="grid gap-5 lg:grid-cols-[0.92fr,1.08fr]">
          <div className="space-y-5">
            <Card className="rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] text-white shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <Settings2 className="h-5 w-5 text-amber-300" />
                  {t("panelNutritionSettings.general.title")}
                </CardTitle>
                <CardDescription className="text-slate-300">
                  {t("panelNutritionSettings.general.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                  <div className="space-y-1">
                    <div className="font-bold text-white">{t("panelNutritionSettings.manualApproval.title")}</div>
                    <div className="text-xs leading-6 text-slate-300">
                      {t("panelNutritionSettings.manualApproval.description")}
                    </div>
                  </div>
                  <Switch
                    checked={settings.manualAiApprovalRequired}
                    onCheckedChange={(checked) => setSettings((current) => ({ ...current, manualAiApprovalRequired: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                  <div className="space-y-1">
                    <div className="font-bold text-white">{t("panelNutritionSettings.holdIncomplete.title")}</div>
                    <div className="text-xs leading-6 text-slate-300">
                      {t("panelNutritionSettings.holdIncomplete.description")}
                    </div>
                  </div>
                  <Switch
                    checked={settings.holdIncompletePrescriptionsForReview}
                    onCheckedChange={(checked) => setSettings((current) => ({ ...current, holdIncompletePrescriptionsForReview: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                  <div className="space-y-1">
                    <div className="font-bold text-white">{t("panelNutritionSettings.exerciseLogging.title")}</div>
                    <div className="text-xs leading-6 text-slate-300">
                      {t("panelNutritionSettings.exerciseLogging.description")}
                    </div>
                  </div>
                  <Switch
                    checked={settings.exerciseLoggingEnabled}
                    onCheckedChange={(checked) => setSettings((current) => ({ ...current, exerciseLoggingEnabled: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                  <div className="space-y-1">
                    <div className="font-bold text-white">{t("panelNutritionSettings.outOfPlan.title")}</div>
                    <div className="text-xs leading-6 text-slate-300">
                      {t("panelNutritionSettings.outOfPlan.description")}
                    </div>
                  </div>
                  <Switch
                    checked={settings.outOfPlanMealLoggingEnabled}
                    onCheckedChange={(checked) => setSettings((current) => ({ ...current, outOfPlanMealLoggingEnabled: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                  <div className="space-y-1">
                    <div className="font-bold text-white">{t("panelNutritionSettings.photoAnalysis.title")}</div>
                    <div className="text-xs leading-6 text-slate-300">
                      {t("panelNutritionSettings.photoAnalysis.description")}
                    </div>
                  </div>
                  <Switch
                    checked={settings.mealPhotoAnalysisEnabled}
                    onCheckedChange={(checked) => setSettings((current) => ({ ...current, mealPhotoAnalysisEnabled: checked }))}
                    disabled={!settings.outOfPlanMealLoggingEnabled}
                  />
                </div>

                <div className="space-y-4 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-4 space-y-1">
                    <div className="font-bold text-white">{t("panelNutritionSettings.aiLimits.title")}</div>
                    <div className="text-xs leading-6 text-slate-300">
                      {t("panelNutritionSettings.aiLimits.description")}
                    </div>
                  </div>

                  {AI_LIMIT_GROUPS.map((group) => (
                    <div key={group.hourlyKey} className="rounded-[18px] border border-white/10 bg-slate-950/20 p-4">
                      <div className="mb-3 space-y-1">
                        <div className="font-bold text-white">{t(group.titleKey)}</div>
                        <div className="text-xs leading-6 text-slate-400">{t(group.descriptionKey)}</div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-sm text-slate-200">{t("panelNutritionSettings.aiLimits.hourlyLabel")}</Label>
                          <input
                            type="number"
                            min="1"
                            inputMode="numeric"
                            value={settings[group.hourlyKey] ?? ""}
                            onChange={(event) => {
                              const value = event.target.value.trim();
                              setSettings((current) => ({
                                ...current,
                                [group.hourlyKey]: parseOptionalPositiveInt(value),
                              }));
                            }}
                            placeholder={t("panelNutritionSettings.aiLimits.unlimitedPlaceholder")}
                            className="h-11 w-full rounded-[16px] border border-white/10 bg-slate-950/40 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-slate-200">{t("panelNutritionSettings.aiLimits.dietLabel")}</Label>
                          <input
                            type="number"
                            min="1"
                            inputMode="numeric"
                            value={settings[group.dietKey] ?? ""}
                            onChange={(event) => {
                              const value = event.target.value.trim();
                              setSettings((current) => ({
                                ...current,
                                [group.dietKey]: parseOptionalPositiveInt(value),
                              }));
                            }}
                            placeholder={t("panelNutritionSettings.aiLimits.unlimitedPlaceholder")}
                            className="h-11 w-full rounded-[16px] border border-white/10 bg-slate-950/40 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-[22px] border border-amber-300/15 bg-amber-300/10 p-4 text-sm leading-7 text-amber-50">
                  <div className="flex items-center gap-2 font-black">
                    <Info className="h-4 w-4" />
                    {t("panelNutritionSettings.editLimit.title")}
                  </div>
                  <p className="mt-2 text-amber-50/90">
                    {t("panelNutritionSettings.editLimit.description")}
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={saving}
                  className="h-12 w-full rounded-[18px] bg-amber-400 font-black text-slate-950 hover:bg-amber-300"
                >
                  {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                  {t("panelNutritionSettings.save")}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            {promptCards.map((field) => {
              const current = settings.promptSettings[field.key];

              return (
                <Card key={field.key} className="rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] text-white shadow-none">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <CardTitle className="text-lg font-black">{t(field.titleKey)}</CardTitle>
                        <CardDescription className="leading-7 text-slate-300">{t(field.descriptionKey)}</CardDescription>
                      </div>
                      <div className={`rounded-full border px-3 py-1 text-[11px] font-black ${current.customized ? "border-amber-300/25 bg-amber-300/15 text-amber-100" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>
                        {current.customized ? t("panelNutritionSettings.prompt.customized") : t("panelNutritionSettings.prompt.default")}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-200">{t("panelNutritionSettings.prompt.editableText")}</Label>
                      <Textarea
                        value={current.value}
                        onChange={(event) => handlePromptChange(field.key, event.target.value)}
                        placeholder={t(field.placeholderKey)}
                        className="min-h-[190px] rounded-[20px] border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs leading-6 text-slate-400">
                        {t("panelNutritionSettings.prompt.defaultHint")}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void resetPrompt(field.key)}
                        disabled={saving || resettingPromptKey !== null}
                        className="rounded-[16px] border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                      >
                        {resettingPromptKey === field.key ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RotateCcw className="me-2 h-4 w-4" />}
                        {t("panelNutritionSettings.prompt.reset")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <Button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          className="h-12 w-full rounded-[18px] bg-amber-400 font-black text-slate-950 hover:bg-amber-300"
        >
          {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
          {t("panelNutritionSettings.save")}
        </Button>
      </main>
    </div>
  );
}
