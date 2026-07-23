import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowRight, BadgeCheck, Bot, BrainCircuit, CalendarClock, ChevronLeft, Coins, Download, Dumbbell, FileArchive, FileJson, Flame, ImageIcon, Layers3, Loader2, Orbit, Pencil, Search, ShieldAlert, Sparkles, UploadCloud, UserRound, UtensilsCrossed, Wand2, XCircle } from "lucide-react";
import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { addDays, format } from "date-fns";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { NutritionDietFileGroup, NutritionDietFileItem, NutritionDietRequest, NutritionMedicalConditionItem } from "@/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { subscribeNutritionDietRequestUpdates, subscribeUserNotificationInboxUpdates } from "@/lib/realtime";
import { NutritionAiPromptPicker } from "@/nutrition/components/nutrition-ai-prompt-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizeMedicalConditionItems, summarizeMedicalConditionItems } from "@/nutrition/lib/medical-conditions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type Draft = {
  expertNotes: string;
  clinicalNotes: string;
  generationInstructions: string;
  mustInclude: string;
  mustAvoid: string;
};

type ManualEditDraft = {
  prescriptionId: number;
  sectionType: "user_choice_option" | "daily_meal" | "daily_replacement" | "fixed_text_section" | "viewer_message";
  heading: string;
  title: string;
  description: string;
  quantityText: string;
  grams: string;
  calories: string;
  proteinGrams: string;
  fatGrams: string;
  carbohydrateGrams: string;
  fiberGrams: string;
  mealText: string;
  body: string;
  slotKey?: string;
  optionIndex?: number;
  dayNumber?: number;
  mealIndex?: number;
  replacementIndex?: number;
  sectionIndex?: number;
};

type ExpertFileSendDraft = {
  source: "library" | "upload";
  selectedDietFileId: string;
  search: string;
  libraryGroupId: string;
  startedAt: string;
  endsAt: string;
  title: string;
  description: string;
  calories: string;
  groupId: string;
  file: File | null;
  viewerMessage: string;
};

type MealReplacementTarget = {
  key: string;
  sourceType: "meal_slot" | "daily_meal";
  mealSlotKey: string;
  slotTitle: string;
  dayNumber?: number;
  mealIndex?: number;
  originLabel?: string;
};

type PrescriptionDateDraft = {
  prescriptionId: string;
  startedAt: string;
  endsAt: string;
};

type DetailSectionKey = "service" | "user" | "diet" | "tracking" | "supplements" | "ai";

type Translator = ReturnType<typeof useT>;

const getModeLabel = (value: string | null | undefined, t: Translator) => {
  if (value === "daily_prescription") return t("panelNutritionRequestDetail.mode.dailyPrescription");
  if (value === "user_choice") return t("panelNutritionRequestDetail.mode.userChoice");
  if (value === "fixed_text") return t("panelNutritionRequestDetail.mode.fixedText");
  return "—";
};

const getMedicalConditionStatus = (value: string | null | undefined, t: Translator) => {
  if (value === "past") return t("panelNutritionRequestDetail.medicalStatus.past");
  if (value === "temporary") return t("panelNutritionRequestDetail.medicalStatus.temporary");
  return t("panelNutritionRequestDetail.medicalStatus.current");
};

function jsonBlock(value: unknown) {
  if (!value) {
    return "—";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function mealSlotLabel(slotKey?: string | null, t?: Translator) {
  switch ((slotKey ?? "").trim()) {
    case "breakfast":
      return t ? t("panelNutritionRequestDetail.mealSlot.breakfast") : "breakfast";
    case "lunch":
      return t ? t("panelNutritionRequestDetail.mealSlot.lunch") : "lunch";
    case "dinner":
      return t ? t("panelNutritionRequestDetail.mealSlot.dinner") : "dinner";
    case "snack":
      return t ? t("panelNutritionRequestDetail.mealSlot.snack") : "snack";
    default:
      return slotKey || (t ? t("panelNutritionRequestDetail.mealSlot.meal") : "meal");
  }
}

function formatManualMetaText(value: unknown, t: Translator) {
  const raw = String(value ?? "").trim();
  if (raw === "") {
    return "";
  }

  return raw
    .split("|")
    .map((segment) => {
      const part = segment.trim();
      if (part === "") {
        return "";
      }
      if (part.startsWith("slot:")) {
        return t("panelNutritionRequestDetail.manualMeta.slot", { value: mealSlotLabel(part.slice(5).trim(), t) });
      }
      if (part.startsWith("note:replacement:")) {
        return t("panelNutritionRequestDetail.manualMeta.replacement", { value: part.slice("note:replacement:".length).trim() });
      }
      if (part.startsWith("note:manual:")) {
        return t("panelNutritionRequestDetail.manualMeta.note", { value: part.slice("note:manual:".length).trim() });
      }
      if (part.startsWith("note:")) {
        return t("panelNutritionRequestDetail.manualMeta.note", { value: part.slice(5).trim() });
      }
      if (part.startsWith("manual:")) {
        return t("panelNutritionRequestDetail.manualMeta.manual", { value: part.slice(7).trim() });
      }
      return part;
    })
    .filter(Boolean)
    .join(" | ");
}

function hasReplacementMeta(value: unknown) {
  return String(value ?? "").includes("note:replacement:");
}

function toSafeGregorianDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function formatPersianDate(date?: string | null) {
  if (!date) {
    return "—";
  }

  return new DateObject({
    date: toSafeGregorianDate(date),
    calendar: persian,
    locale: persian_fa,
  }).format("YYYY/MM/DD");
}

function normalizeMealSlotKey(value?: unknown) {
  const raw = String(value ?? "").trim();
  if (raw === "") {
    return "";
  }

  return raw
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_\u0600-\u06FF-]+/g, "")
    .replace(/_+/g, "_");
}

function nutritionFieldValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return String(numeric);
  }

  return String(value);
}

function compactMacroItems(source: Record<string, unknown>, t: Translator) {
  const items = [
    { key: "protein", label: t("panelNutritionRequestDetail.macro.protein"), value: Number(source.protein_grams ?? 0) },
    { key: "carb", label: t("panelNutritionRequestDetail.macro.carbohydrate"), value: Number(source.carbohydrate_grams ?? 0) },
    { key: "fat", label: t("panelNutritionRequestDetail.macro.fat"), value: Number(source.fat_grams ?? 0) },
    { key: "fiber", label: t("panelNutritionRequestDetail.macro.fiber"), value: Number(source.fiber_grams ?? 0) },
  ];

  return items.filter((item) => Number.isFinite(item.value) && item.value > 0);
}

function exerciseIntensityLabel(value: string | null | undefined, t: Translator) {
  switch (value) {
    case "light":
      return t("panelNutritionRequestDetail.exerciseIntensity.light");
    case "vigorous":
      return t("panelNutritionRequestDetail.exerciseIntensity.vigorous");
    case "moderate":
    default:
      return t("panelNutritionRequestDetail.exerciseIntensity.moderate");
  }
}


export default function PanelNutritionRequestDetailPage() {
  const { isAdmin, isLoading, user } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const localeFormat = useFormat();
  const { dir, isRtl } = useLocale();
  const [match, params] = useRoute("/panel/nutrition/requests/:requestId");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingRevision, setCancellingRevision] = useState(false);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [dismissedRevisionModal, setDismissedRevisionModal] = useState(false);
  const [promptPickerOpen, setPromptPickerOpen] = useState(false);
  const [manualEditOpen, setManualEditOpen] = useState(false);
  const [manualEditSaving, setManualEditSaving] = useState(false);
  const [approvingDelivery, setApprovingDelivery] = useState(false);
  const [confirmApproveDelivery, setConfirmApproveDelivery] = useState(false);
  const [sendingExpertFile, setSendingExpertFile] = useState(false);
  const [expertFileEditorOpen, setExpertFileEditorOpen] = useState(false);
  const [deletingExpertFile, setDeletingExpertFile] = useState(false);
  const [savingAiUsageLimits, setSavingAiUsageLimits] = useState(false);
  const [activeDetailSection, setActiveDetailSection] = useState<DetailSectionKey>("service");
  const [manualEditDraft, setManualEditDraft] = useState<ManualEditDraft | null>(null);
  const [prescriptionDateDraft, setPrescriptionDateDraft] = useState<PrescriptionDateDraft | null>(null);
  const [viewerMessageBody, setViewerMessageBody] = useState("");
  const [mealPhotoPreview, setMealPhotoPreview] = useState<{ url: string; title: string } | null>(null);
  const [aiLimitDraft, setAiLimitDraft] = useState({
    mealPhotoAnalysisDietLimit: "",
    mealPhotoAnalysisHourlyLimit: "",
    manualMealNutritionDietLimit: "",
    manualMealNutritionHourlyLimit: "",
    mealReplacementDietLimit: "",
    mealReplacementHourlyLimit: "",
  });
  const [item, setItem] = useState<NutritionDietRequest | null>(null);
  const [dietFileGroups, setDietFileGroups] = useState<NutritionDietFileGroup[]>([]);
  const [dietFiles, setDietFiles] = useState<NutritionDietFileItem[]>([]);
  const [expertFileDraft, setExpertFileDraft] = useState<ExpertFileSendDraft>({
    source: "library",
    selectedDietFileId: "",
    search: "",
    libraryGroupId: "all",
    startedAt: format(new Date(), "yyyy-MM-dd"),
    endsAt: format(addDays(new Date(), 14), "yyyy-MM-dd"),
    title: "",
    description: "",
    calories: "",
    groupId: "none",
    file: null,
    viewerMessage: "",
  });
  const [draft, setDraft] = useState<Draft>({
    expertNotes: "",
    clinicalNotes: "",
    generationInstructions: "",
    mustInclude: "",
    mustAvoid: "",
  });
  const formatDate = (value?: string | null) => (value ? localeFormat.date(value) : "—");
  const formatDateTime = (value?: string | null) => (value ? localeFormat.dateTime(value) : "—");
  const formatNumber = (value: number, maximumFractionDigits = 0) => localeFormat.number(value, { maximumFractionDigits });
  const formatWeight = (value: number, maximumFractionDigits = 0) => t("panelNutritionRequestDetail.units.kg", { value: formatNumber(value, maximumFractionDigits) });
  const formatWeeklyWeight = (value: number) => t("panelNutritionRequestDetail.units.kgPerWeek", { value: formatNumber(value, 1) });
  const formatCalories = (value: number) => t("panelNutritionRequestDetail.units.kcal", { value: formatNumber(value) });
  const formatTokens = (value: number) => t("panelNutritionRequestDetail.units.tokens", { value: formatNumber(value) });
  const formatGrams = (value: number) => t("panelNutritionRequestDetail.units.grams", { value: formatNumber(value) });
  const formatMinutes = (value: number) => t("panelNutritionRequestDetail.units.minutes", { value: formatNumber(value) });
  const formatSpeed = (value: number) => t("panelNutritionRequestDetail.units.kmh", { value: formatNumber(value, 1) });
  const formatDistance = (value: number) => t("panelNutritionRequestDetail.units.km", { value: formatNumber(value, 1) });
  const formatWater = (value: number) => t("panelNutritionRequestDetail.units.waterGlasses", { value: formatNumber(value) });
  const formatPercentValue = (value: number) => t("panelNutritionRequestDetail.units.percent", { value: formatNumber(value) });
  const formatUsageRatio = (used?: number | null, total?: number | null) =>
    t("panelNutritionRequestDetail.units.usageRatio", { used: formatNumber(Number(used ?? 0)), total: formatNumber(Number(total ?? 0)) });
  const formatAiLimitValue = (value?: number | null) => value == null ? t("panelNutritionRequestDetail.ai.unlimited") : formatNumber(value);

  const requestId = match ? params.requestId : null;
  const userProfileHref = item?.user?.mobile
    ? `/panel/nutrition/prescribe/users/${encodeURIComponent(item.user.mobile)}?returnTo=${encodeURIComponent(`/panel/nutrition/requests/${item.id}`)}`
    : "";
  const isRevisionPending = item?.aiGenerationStatus === "queued" || item?.aiGenerationStatus === "processing";
  const currentExpertFile = item?.currentPrescription?.expertFile ?? null;
  const isExpertFilePrescription = item?.currentPrescription?.deliveryChannel === "expert_file" || Boolean(currentExpertFile);
  const manualApprovalPending = Boolean(item?.manualApprovalPending);
  const goToDeliveryApproval = () => {
    setActiveDetailSection("diet");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById("nutrition-delivery-approval")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };
  const currentMealReplacementSuggestions = useMemo(() => {
    return item?.currentPrescription?.mealReplacementSuggestions ?? item?.mealReplacementSuggestions ?? [];
  }, [item?.currentPrescription?.mealReplacementSuggestions, item?.mealReplacementSuggestions]);
  const tokenBreakdown = item?.tokenBreakdown ?? null;
  const aiUsageLimits = tokenBreakdown?.aiUsageLimits ?? null;
  const isPrescriptionDateDraftValid = Boolean(
    prescriptionDateDraft?.startedAt
    && prescriptionDateDraft?.endsAt
    && prescriptionDateDraft.endsAt >= prescriptionDateDraft.startedAt,
  );

  useEffect(() => {
    setAiLimitDraft({
      mealPhotoAnalysisDietLimit: aiUsageLimits?.mealPhotoAnalysis?.overrideDietLimit != null ? String(aiUsageLimits.mealPhotoAnalysis.overrideDietLimit) : "",
      mealPhotoAnalysisHourlyLimit: aiUsageLimits?.mealPhotoAnalysis?.overrideHourlyLimit != null ? String(aiUsageLimits.mealPhotoAnalysis.overrideHourlyLimit) : "",
      manualMealNutritionDietLimit: aiUsageLimits?.manualMealNutrition?.overrideDietLimit != null ? String(aiUsageLimits.manualMealNutrition.overrideDietLimit) : "",
      manualMealNutritionHourlyLimit: aiUsageLimits?.manualMealNutrition?.overrideHourlyLimit != null ? String(aiUsageLimits.manualMealNutrition.overrideHourlyLimit) : "",
      mealReplacementDietLimit: aiUsageLimits?.mealReplacement?.overrideDietLimit != null ? String(aiUsageLimits.mealReplacement.overrideDietLimit) : "",
      mealReplacementHourlyLimit: aiUsageLimits?.mealReplacement?.overrideHourlyLimit != null ? String(aiUsageLimits.mealReplacement.overrideHourlyLimit) : "",
    });
  }, [
    aiUsageLimits?.mealPhotoAnalysis?.overrideDietLimit,
    aiUsageLimits?.mealPhotoAnalysis?.overrideHourlyLimit,
    aiUsageLimits?.manualMealNutrition?.overrideDietLimit,
    aiUsageLimits?.manualMealNutrition?.overrideHourlyLimit,
    aiUsageLimits?.mealReplacement?.overrideDietLimit,
    aiUsageLimits?.mealReplacement?.overrideHourlyLimit,
  ]);

  const parseAiLimitDraftValue = (value: string) => {
    const normalized = value.trim();
    if (normalized === "") {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
  };

  const saveAiUsageLimits = async () => {
    if (!item) {
      return;
    }

    setSavingAiUsageLimits(true);
    const result = await api.nutritionDietRequests.adminUpdateAiUsageLimits(item.id, {
      mealPhotoAnalysisDietLimit: parseAiLimitDraftValue(aiLimitDraft.mealPhotoAnalysisDietLimit),
      mealPhotoAnalysisHourlyLimit: parseAiLimitDraftValue(aiLimitDraft.mealPhotoAnalysisHourlyLimit),
      manualMealNutritionDietLimit: parseAiLimitDraftValue(aiLimitDraft.manualMealNutritionDietLimit),
      manualMealNutritionHourlyLimit: parseAiLimitDraftValue(aiLimitDraft.manualMealNutritionHourlyLimit),
      mealReplacementDietLimit: parseAiLimitDraftValue(aiLimitDraft.mealReplacementDietLimit),
      mealReplacementHourlyLimit: parseAiLimitDraftValue(aiLimitDraft.mealReplacementHourlyLimit),
    });
    setSavingAiUsageLimits(false);

    if (result.success) {
      setItem(result.data.item);
      toast({ title: t("panelNutritionRequestDetail.toast.aiLimitSaved"), description: result.message });
    } else {
      toast({ variant: "destructive", title: t("panelNutritionRequestDetail.toast.aiLimitSaveFailed"), description: result.message });
    }
  };

  const openPrescriptionDateEdit = (prescription: NonNullable<NutritionDietRequest["prescriptions"]>[number]) => {
    setPrescriptionDateDraft({
      prescriptionId: prescription.id,
      startedAt: prescription.startedAt || item?.startedAt || format(new Date(), "yyyy-MM-dd"),
      endsAt: prescription.endsAt || item?.endsAt || format(addDays(new Date(), 14), "yyyy-MM-dd"),
    });
  };

  const savePrescriptionDates = async () => {
    if (!item || !prescriptionDateDraft || !isPrescriptionDateDraftValid) {
      return;
    }

    setSubmitting(true);
    const result = await api.nutritionDietRequests.adminUpdatePrescriptionDates(item.id, prescriptionDateDraft.prescriptionId, {
      startedAt: prescriptionDateDraft.startedAt,
      endsAt: prescriptionDateDraft.endsAt,
    });
    setSubmitting(false);

    if (result.success) {
      setItem(result.data.item);
      setPrescriptionDateDraft(null);
      toast({ title: t("panelNutritionRequestDetail.toast.prescriptionDateSaved"), description: result.message });
    } else {
      toast({ variant: "destructive", title: t("panelNutritionRequestDetail.toast.prescriptionDateSaveFailed"), description: result.message });
    }
  };

  const openUserChoiceEdit = useCallback((slotKey: string, optionIndex: number, option: Record<string, unknown>) => {
    if (!item?.currentPrescription) {
      return;
    }

    setManualEditDraft({
      prescriptionId: Number(item.currentPrescription.id),
      sectionType: "user_choice_option",
      heading: t("panelNutritionRequestDetail.manualEdit.heading.userChoice"),
      slotKey,
      optionIndex,
      title: String(option.title ?? ""),
      description: String(option.description ?? ""),
      quantityText: String(option.quantity_text ?? ""),
      grams: option.grams != null ? String(option.grams) : "",
      calories: option.calories != null ? String(option.calories) : "",
      proteinGrams: nutritionFieldValue(option.protein_grams),
      fatGrams: nutritionFieldValue(option.fat_grams),
      carbohydrateGrams: nutritionFieldValue(option.carbohydrate_grams),
      fiberGrams: nutritionFieldValue(option.fiber_grams),
      mealText: "",
      body: "",
    });
    setManualEditOpen(true);
  }, [item?.currentPrescription, t]);

  const openDailyMealEdit = useCallback((dayNumber: number, mealIndex: number, meal: Record<string, unknown>) => {
    if (!item?.currentPrescription) {
      return;
    }

    setManualEditDraft({
      prescriptionId: Number(item.currentPrescription.id),
      sectionType: "daily_meal",
      heading: t("panelNutritionRequestDetail.manualEdit.heading.dailyMeal", { day: formatNumber(dayNumber) }),
      dayNumber,
      mealIndex,
      title: String(meal.title ?? ""),
      description: "",
      quantityText: "",
      grams: meal.grams != null ? String(meal.grams) : "",
      calories: meal.calories != null ? String(meal.calories) : "",
      proteinGrams: nutritionFieldValue(meal.protein_grams),
      fatGrams: nutritionFieldValue(meal.fat_grams),
      carbohydrateGrams: nutritionFieldValue(meal.carbohydrate_grams),
      fiberGrams: nutritionFieldValue(meal.fiber_grams),
      mealText: String(meal.meal_text ?? ""),
      body: "",
    });
    setManualEditOpen(true);
  }, [formatNumber, item?.currentPrescription, t]);

  const openReplacementEdit = useCallback((dayNumber: number, mealIndex: number, replacementIndex: number, replacement: Record<string, unknown>) => {
    if (!item?.currentPrescription) {
      return;
    }

    setManualEditDraft({
      prescriptionId: Number(item.currentPrescription.id),
      sectionType: "daily_replacement",
      heading: t("panelNutritionRequestDetail.manualEdit.heading.dailyReplacement", { day: formatNumber(dayNumber) }),
      dayNumber,
      mealIndex,
      replacementIndex,
      title: String(replacement.title ?? ""),
      description: String(replacement.description ?? ""),
      quantityText: String(replacement.quantity_text ?? ""),
      grams: replacement.grams != null ? String(replacement.grams) : "",
      calories: replacement.calories != null ? String(replacement.calories) : "",
      proteinGrams: nutritionFieldValue(replacement.protein_grams),
      fatGrams: nutritionFieldValue(replacement.fat_grams),
      carbohydrateGrams: nutritionFieldValue(replacement.carbohydrate_grams),
      fiberGrams: nutritionFieldValue(replacement.fiber_grams),
      mealText: "",
      body: "",
    });
    setManualEditOpen(true);
  }, [formatNumber, item?.currentPrescription, t]);

  const openFixedTextEdit = useCallback((sectionIndex: number, section: Record<string, unknown>) => {
    if (!item?.currentPrescription) {
      return;
    }

    setManualEditDraft({
      prescriptionId: Number(item.currentPrescription.id),
      sectionType: "fixed_text_section",
      heading: t("panelNutritionRequestDetail.manualEdit.heading.fixedText"),
      sectionIndex,
      title: String(section.title ?? ""),
      description: "",
      quantityText: "",
      grams: "",
      calories: "",
      proteinGrams: "",
      fatGrams: "",
      carbohydrateGrams: "",
      fiberGrams: "",
      mealText: "",
      body: String(section.body ?? ""),
    });
    setManualEditOpen(true);
  }, [item?.currentPrescription, t]);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!requestId) {
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }
    const result = await api.nutritionDietRequests.adminShow(requestId);

    if (result.success) {
      setItem(result.data.item);
      setDraft({
        expertNotes: result.data.item.expertNotes ?? "",
        clinicalNotes: result.data.item.clinicalNotes ?? "",
        generationInstructions: result.data.item.generationInstructions ?? "",
        mustInclude: result.data.item.mustInclude ?? "",
        mustAvoid: result.data.item.mustAvoid ?? "",
      });
    } else {
      toast({ variant: "destructive", title: t("panelNutritionRequestDetail.toast.loadFailed"), description: result.message });
    }

    if (!options?.silent) {
      setLoading(false);
    }
  }, [requestId, t, toast]);

  useEffect(() => {
    if (isLoading || !isAdmin || !requestId) {
      return;
    }

    void load();
  }, [isAdmin, isLoading, load, requestId]);

  useEffect(() => {
    if (!isAdmin || item?.requestType !== "expert") {
      return;
    }

    api.nutritionDietFiles.list(expertFileDraft.search).then((result) => {
      if (result.success) {
        setDietFileGroups(result.data.groups ?? []);
        setDietFiles(result.data.items?.filter((file) => file.isActive) ?? []);
      }
    });
  }, [expertFileDraft.search, isAdmin, item?.requestType]);

  useEffect(() => {
    if (item?.requestType !== "expert" || item.currentPrescription) {
      return;
    }

    const startedAt = item.startedAt || format(new Date(), "yyyy-MM-dd");
    const endsAt = item.endsAt || format(addDays(toSafeGregorianDate(startedAt), 14), "yyyy-MM-dd");

    setExpertFileDraft((current) => ({
      ...current,
      startedAt,
      endsAt,
    }));
  }, [item?.currentPrescription, item?.endsAt, item?.requestType, item?.startedAt]);

  const queueGeneration = async () => {
    if (!item) {
      return;
    }

    setSubmitting(true);
    const result = await api.nutritionDietRequests.generateAi(item.id, draft);

    if (result.success) {
      setDismissedRevisionModal(false);
      setItem((current) => current ? {
        ...current,
        aiGenerationStatus: (result.data.aiGenerationStatus as typeof current.aiGenerationStatus) ?? "queued",
        aiGenerationStatusLabel: (result.data.aiGenerationStatus ?? "queued") === "processing"
          ? t("panelNutritionRequestDetail.aiStatus.processing")
          : t("panelNutritionRequestDetail.aiStatus.queued"),
        aiGenerationError: null,
      } : current);
      setRevisionModalOpen(true);
      toast({
        title: item.currentPrescription ? t("panelNutritionRequestDetail.toast.revisionStarted") : t("panelNutritionRequestDetail.toast.generationQueued"),
        description: item.currentPrescription
          ? t("panelNutritionRequestDetail.toast.revisionStartedDescription")
          : t("panelNutritionRequestDetail.toast.generationQueuedDescription"),
      });
      await load({ silent: true });
    } else {
      toast({
        variant: "destructive",
        title: t("panelNutritionRequestDetail.toast.generationFailed"),
        description: result.message || t("panelNutritionRequestDetail.toast.generationFailedDescription"),
      });
    }

    setSubmitting(false);
  };

  const cancelRevision = async () => {
    if (!item) {
      return;
    }

    setCancellingRevision(true);
    const result = await api.nutritionDietRequests.cancelAi(item.id);

    if (result.success) {
      setRevisionModalOpen(false);
      toast({
        title: t("panelNutritionRequestDetail.toast.revisionCancelled"),
        description: t("panelNutritionRequestDetail.toast.revisionCancelledDescription"),
      });
      await load({ silent: true });
    } else {
      toast({
        variant: "destructive",
        title: t("panelNutritionRequestDetail.toast.cancelRevisionFailed"),
        description: result.message || t("panelNutritionRequestDetail.toast.cancelRevisionFailedDescription"),
      });
    }

    setCancellingRevision(false);
  };

  const submitManualEdit = async () => {
    if (!item || !manualEditDraft) {
      return;
    }

    setManualEditSaving(true);
    const result = await api.nutritionDietRequests.adminManualEdit(item.id, {
      prescriptionId: manualEditDraft.prescriptionId,
      sectionType: manualEditDraft.sectionType,
      slotKey: manualEditDraft.slotKey,
      optionIndex: manualEditDraft.optionIndex,
      dayNumber: manualEditDraft.dayNumber,
      mealIndex: manualEditDraft.mealIndex,
      replacementIndex: manualEditDraft.replacementIndex,
      sectionIndex: manualEditDraft.sectionIndex,
      title: manualEditDraft.title,
      description: manualEditDraft.description,
      quantityText: manualEditDraft.quantityText,
      grams: manualEditDraft.grams,
      calories: manualEditDraft.calories,
      proteinGrams: manualEditDraft.proteinGrams,
      fatGrams: manualEditDraft.fatGrams,
      carbohydrateGrams: manualEditDraft.carbohydrateGrams,
      fiberGrams: manualEditDraft.fiberGrams,
      mealText: manualEditDraft.mealText,
      body: manualEditDraft.body,
    });

    if (result.success) {
      setItem(result.data.item);
      setManualEditOpen(false);
      setManualEditDraft(null);
      toast({
        title: t("panelNutritionRequestDetail.toast.manualEditSaved"),
        description: t("panelNutritionRequestDetail.toast.manualEditSavedDescription"),
      });
    } else {
      toast({
        variant: "destructive",
        title: t("panelNutritionRequestDetail.toast.manualEditFailed"),
        description: result.message || t("panelNutritionRequestDetail.toast.manualEditFailedDescription"),
      });
    }

    setManualEditSaving(false);
  };

  const saveViewerMessage = async () => {
    if (!item?.currentPrescription) {
      return;
    }

    setManualEditSaving(true);
    const result = await api.nutritionDietRequests.adminManualEdit(item.id, {
      prescriptionId: Number(item.currentPrescription.id),
      sectionType: "viewer_message",
      title: String(viewerMessage.title ?? t("panelNutritionRequestDetail.viewerMessage.defaultTitle")),
      body: viewerMessageBody,
    });

    if (result.success) {
      setItem(result.data.item);
      toast({
        title: viewerMessageBody.trim() !== ""
          ? t("panelNutritionRequestDetail.toast.viewerMessageSaved")
          : t("panelNutritionRequestDetail.toast.viewerMessageRemoved"),
        description: viewerMessageBody.trim() !== ""
          ? t("panelNutritionRequestDetail.toast.viewerMessageSavedDescription")
          : t("panelNutritionRequestDetail.toast.viewerMessageRemovedDescription"),
      });
    } else {
      toast({
        variant: "destructive",
        title: t("panelNutritionRequestDetail.toast.viewerMessageFailed"),
        description: result.message || t("panelNutritionRequestDetail.toast.viewerMessageFailedDescription"),
      });
    }

    setManualEditSaving(false);
  };

  const approveDelivery = async () => {
    if (!item || !confirmApproveDelivery) {
      return;
    }

    setApprovingDelivery(true);
    const result = await api.nutritionDietRequests.approveDelivery(item.id);

    if (result.success) {
      setItem(result.data.item);
      setConfirmApproveDelivery(false);
      toast({
        title: t("panelNutritionRequestDetail.toast.deliveryApproved"),
        description: t("panelNutritionRequestDetail.toast.deliveryApprovedDescription"),
      });
    } else {
      toast({
        variant: "destructive",
        title: t("panelNutritionRequestDetail.toast.deliveryApprovalFailed"),
        description: result.message || t("common.tryAgain"),
      });
    }

    setApprovingDelivery(false);
  };

  const sendExpertFile = async () => {
    if (!item) {
      return;
    }

    if (expertFileDraft.source === "library" && !expertFileDraft.selectedDietFileId) {
      toast({
        variant: "destructive",
        title: t("panelNutritionRequestDetail.toast.libraryFileMissing"),
        description: t("panelNutritionRequestDetail.toast.libraryFileMissingDescription"),
      });
      return;
    }

    if (expertFileDraft.source === "upload" && !expertFileDraft.file) {
      toast({
        variant: "destructive",
        title: t("panelNutritionRequestDetail.toast.uploadFileMissing"),
        description: t("panelNutritionRequestDetail.toast.uploadFileMissingDescription"),
      });
      return;
    }

    const body = new FormData();
    body.append("source", expertFileDraft.source);
    body.append("nutrition_diet_file_id", expertFileDraft.selectedDietFileId);
    body.append("nutrition_diet_file_group_id", expertFileDraft.groupId === "none" ? "" : expertFileDraft.groupId);
    body.append("started_at", expertFileDraft.startedAt);
    body.append("ends_at", expertFileDraft.endsAt);
    body.append("title", expertFileDraft.title.trim());
    body.append("description", expertFileDraft.description.trim());
    body.append("calories", expertFileDraft.calories.trim());
    body.append("viewer_message", expertFileDraft.viewerMessage.trim());

    if (expertFileDraft.file) {
      body.append("file", expertFileDraft.file);
    }

    setSendingExpertFile(true);
    const result = await api.nutritionDietRequests.adminSendExpertFile(item.id, body);

    if (result.success) {
      setItem(result.data.item);
      setExpertFileEditorOpen(false);
      toast({
        title: t("panelNutritionRequestDetail.toast.expertFileSent"),
        description: t("panelNutritionRequestDetail.toast.expertFileSentDescription"),
      });
    } else {
      toast({ variant: "destructive", title: t("panelNutritionRequestDetail.toast.expertFileSendFailed"), description: result.message || t("common.tryAgain") });
    }

    setSendingExpertFile(false);
  };

  const openExpertFileEditor = () => {
    const file = currentExpertFile;
    const prescription = item?.currentPrescription;
    const content = asRecord(prescription?.contentSnapshot);
    const message = asRecord(content.viewer_message);

    setExpertFileDraft((current) => ({
      ...current,
      source: file?.source === "library" ? "library" : "upload",
      selectedDietFileId: file?.libraryFileId ?? "",
      search: "",
      libraryGroupId: "all",
      startedAt: prescription?.startedAt ?? format(new Date(), "yyyy-MM-dd"),
      endsAt: prescription?.endsAt ?? format(addDays(new Date(), 14), "yyyy-MM-dd"),
      title: file?.title ?? "",
      description: file?.description ?? "",
      calories: file?.calories != null ? String(file.calories) : "",
      groupId: file?.group?.id ?? "none",
      file: null,
      viewerMessage: String(message.body ?? ""),
    }));
    setExpertFileEditorOpen(true);
  };

  const deleteExpertFile = async () => {
    if (!item) {
      return;
    }

    setDeletingExpertFile(true);
    const result = await api.nutritionDietRequests.adminDeleteExpertFile(item.id);

    if (result.success) {
      setItem(result.data.item);
      setExpertFileEditorOpen(false);
      toast({
        title: t("panelNutritionRequestDetail.toast.expertFileDeleted"),
        description: result.message || t("panelNutritionRequestDetail.toast.expertFileDeletedDescription"),
      });
    } else {
      toast({ variant: "destructive", title: t("panelNutritionRequestDetail.toast.expertFileDeleteFailed"), description: result.message || t("common.tryAgain") });
    }

    setDeletingExpertFile(false);
  };

  useEffect(() => {
    if (!user?.id || !revisionModalOpen) {
      return;
    }

    const unsubscribe = subscribeUserNotificationInboxUpdates(user.id, () => {
      void load({ silent: true });
    });

    return () => {
      unsubscribe?.();
    };
  }, [load, revisionModalOpen, user?.id]);

  useEffect(() => {
    const tenantUserId = item?.user?.id;

    if (!revisionModalOpen || !tenantUserId) {
      return;
    }

    return subscribeNutritionDietRequestUpdates(tenantUserId, (payload) => {
      if (payload?.dietRequest?.id === item?.id) {
        void load({ silent: true });
      }
    });
  }, [item?.id, item?.user?.id, load, revisionModalOpen]);

  useEffect(() => {
    if (!item) {
      return;
    }

    if (isRevisionPending && !dismissedRevisionModal) {
      setRevisionModalOpen(true);
      return;
    }

    if (!isRevisionPending) {
      setDismissedRevisionModal(false);
    }
  }, [dismissedRevisionModal, isRevisionPending, item]);

  useEffect(() => {
    if (!revisionModalOpen || !item) {
      return;
    }

    if (item.aiGenerationStatus === "generated") {
      setDismissedRevisionModal(false);
      setRevisionModalOpen(false);
      toast({
        title: t("panelNutritionRequestDetail.toast.revisionUpdated"),
        description: t("panelNutritionRequestDetail.toast.revisionUpdatedDescription"),
      });
      return;
    }

    if (item.aiGenerationStatus === "failed") {
      setDismissedRevisionModal(false);
      setRevisionModalOpen(false);
      toast({
        variant: "destructive",
        title: t("panelNutritionRequestDetail.toast.revisionFailed"),
        description: item.aiGenerationError || t("panelNutritionRequestDetail.toast.revisionFailedDescription"),
      });
      return;
    }

    if (item.aiGenerationStatus === "cancelled") {
      setDismissedRevisionModal(false);
      setRevisionModalOpen(false);
    }
  }, [item, revisionModalOpen, t, toast]);

  const caloriePlan = useMemo(() => {
    const snapshot = item?.currentPrescription?.contentSnapshot ?? item?.aiResponseSnapshot ?? null;
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }

    const value = (snapshot as Record<string, unknown>)["calorie_plan"];
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  }, [item]);

  const supplementPlan = useMemo(() => {
    const snapshot = item?.currentPrescription?.contentSnapshot ?? item?.aiResponseSnapshot ?? null;
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }

    const value = (snapshot as Record<string, unknown>)["supplement_plan"];
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  }, [item]);

  const currentPrescriptionContent = useMemo(() => {
    return item?.currentPrescription?.contentSnapshot && typeof item.currentPrescription.contentSnapshot === "object"
      ? (item.currentPrescription.contentSnapshot as Record<string, unknown>)
      : null;
  }, [item]);

  const viewerMessage = useMemo(() => {
    return asRecord(currentPrescriptionContent?.viewer_message);
  }, [currentPrescriptionContent]);

  const mealReplacementTargets = useMemo<MealReplacementTarget[]>(() => {
    if (!item?.currentPrescription || !currentPrescriptionContent) {
      return [];
    }

    if (item.currentPrescription.prescriptionMode === "user_choice") {
      const targets: MealReplacementTarget[] = [];

      asArray(currentPrescriptionContent.meal_slots).forEach((slotValue, index) => {
        const slot = asRecord(slotValue);
        const mealSlotKey = normalizeMealSlotKey(slot.slot_key ?? slot.key ?? slot.title ?? `meal_${index + 1}`);

        if (mealSlotKey === "") {
          return;
        }

        targets.push({
          key: mealSlotKey,
          sourceType: "meal_slot",
          mealSlotKey,
          slotTitle: String(slot.title ?? mealSlotLabel(mealSlotKey)),
          originLabel: String(slot.description ?? ""),
        });
      });

      return targets;
    }

    if (item.currentPrescription.prescriptionMode === "daily_prescription") {
      const targets = new Map<string, MealReplacementTarget>();

      asArray(currentPrescriptionContent.day_plans).forEach((planValue, planIndex) => {
        const plan = asRecord(planValue);
        asArray(plan.meals).forEach((mealValue, mealIndex) => {
          const meal = asRecord(mealValue);
          const mealSlotKey = normalizeMealSlotKey(meal.slot_key ?? meal.title ?? `meal_${mealIndex + 1}`);

          if (mealSlotKey === "" || targets.has(mealSlotKey)) {
            return;
          }

          targets.set(mealSlotKey, {
            key: mealSlotKey,
            sourceType: "daily_meal",
            mealSlotKey,
            slotTitle: String(meal.title ?? mealSlotLabel(mealSlotKey)),
            dayNumber: Number(plan.day_number ?? planIndex + 1) || undefined,
            mealIndex,
            originLabel: String(meal.meal_text ?? ""),
          });
        });
      });

      return Array.from(targets.values());
    }

    return [];
  }, [currentPrescriptionContent, item?.currentPrescription]);
  const shouldShowMealReplacementSummary = Boolean(
    item?.currentPrescription
      && !isExpertFilePrescription
      && item.currentPrescription.prescriptionMode === "daily_prescription",
  );
  const mealReplacementEnabled = item?.currentPrescription?.allowFoodReplacement === true;

  const filteredDietFiles = useMemo(() => {
    const search = expertFileDraft.search.trim();
    const selectedGroupId = expertFileDraft.libraryGroupId;

    return dietFiles.filter((file) => {
      if (selectedGroupId !== "all" && String(file.groupId ?? "") !== selectedGroupId) {
        return false;
      }

      if (search === "") {
        return true;
      }

      const haystack = [file.title, file.description, file.groupName, file.fileName].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [dietFiles, expertFileDraft.libraryGroupId, expertFileDraft.search]);


  const consumptionDays = useMemo(() => {
    const progressDays = item?.currentPrescription?.progress?.days ?? [];
    const mealLogDates = (item?.currentPrescription?.mealLogs ?? []).map((log) => String(log.consumedDate ?? "").trim()).filter(Boolean);
    const exerciseLogDates = (item?.currentPrescription?.exerciseLogs ?? []).map((log) => String(log.consumedDate ?? "").trim()).filter(Boolean);
    const allDates = Array.from(new Set([
      ...progressDays.map((day) => String(day.date ?? "").trim()).filter(Boolean),
      ...mealLogDates,
      ...exerciseLogDates,
    ])).sort((a, b) => String(a).localeCompare(String(b)));

    return allDates.map((date) => {
      const progress = progressDays.find((day) => String(day.date ?? "").trim() === date);
      const logs = (item?.currentPrescription?.mealLogs ?? []).filter((log) => log.consumedDate === date);

      return {
        date,
        progressPercent: Number(progress?.progressPercent ?? 0),
        waterGlasses: Number(progress?.waterGlasses ?? 0),
        status: progress?.status ?? (logs.length > 0 ? "partial" : "none"),
      };
    });
  }, [item]);

  const customerExpertDescription = useMemo(() => {
    const payload = asRecord(item?.requestPayloadSnapshot);
    const value = payload["customerExpertDescription"];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  }, [item?.requestPayloadSnapshot]);

  const repeatDietFeedback = useMemo(() => {
    const payload = asRecord(item?.requestPayloadSnapshot);
    const feedback = asRecord(payload["repeatDietFeedback"]);
    const answers = asRecord(feedback["answers"]);
    const currentWeightKg = feedback["currentWeightKg"];
    const medicalNotes = feedback["medicalNotes"];

    const rows: Array<[string, string]> = [];
    const answerLabelMap: Record<string, string> = {
      adherenceLevel: t("panelNutritionRequestDetail.feedback.adherenceLevel"),
      weightOutcome: t("panelNutritionRequestDetail.feedback.weightOutcome"),
      sizeChange: t("panelNutritionRequestDetail.feedback.sizeChange"),
      energyLevel: t("panelNutritionRequestDetail.feedback.energyLevel"),
      satietyLevel: t("panelNutritionRequestDetail.feedback.satietyLevel"),
      cravingsLevel: t("panelNutritionRequestDetail.feedback.cravingsLevel"),
      sleepQuality: t("panelNutritionRequestDetail.feedback.sleepQuality"),
      activityLevel: t("panelNutritionRequestDetail.feedback.activityLevel"),
      dietDifficulty: t("panelNutritionRequestDetail.feedback.dietDifficulty"),
      overallSatisfaction: t("panelNutritionRequestDetail.feedback.overallSatisfaction"),
      newDietPreference: t("panelNutritionRequestDetail.feedback.newDietPreference"),
      experiencedIssue: t("panelNutritionRequestDetail.feedback.experiencedIssue"),
      foodPreference: t("panelNutritionRequestDetail.feedback.foodPreference"),
    };

    if (typeof currentWeightKg === "number" || typeof currentWeightKg === "string") {
      rows.push([t("panelNutritionRequestDetail.feedback.currentWeight"), formatWeight(Number(currentWeightKg), 1)]);
    }

    Object.entries(answerLabelMap).forEach(([key, label]) => {
      const value = answers[key];
      if (typeof value === "string" && value.trim() !== "") {
        rows.push([label, value.trim()]);
      }
    });

    return {
      rows,
      medicalNotes: typeof medicalNotes === "string" && medicalNotes.trim() !== "" ? medicalNotes.trim() : null,
    };
  }, [formatWeight, item?.requestPayloadSnapshot, t]);

  useEffect(() => {
    setViewerMessageBody(String(viewerMessage.body ?? ""));
  }, [viewerMessage.body]);

  useEffect(() => {
    if (!manualApprovalPending) {
      setConfirmApproveDelivery(false);
    }
  }, [manualApprovalPending]);

  const summaryRows = useMemo(() => {
    if (!item) {
      return [];
    }

    const currentWeight = Number(item.currentWeightKg ?? 0);
    const targetWeight = Number(item.targetWeightKg ?? 0);
    const weightGap = currentWeight > 0 && targetWeight > 0 ? Math.abs(currentWeight - targetWeight) : 0;
    const baseCalories = Number(caloriePlan?.base_calories ?? 0);
    const prescribedCalories = Number(caloriePlan?.prescribed_calories ?? 0);
    const calorieDelta = baseCalories - prescribedCalories;
    const profileSnapshot = item.profileSnapshot && typeof item.profileSnapshot === "object"
      ? item.profileSnapshot as Record<string, unknown>
      : {};
    const medicationsAndSupplements = typeof profileSnapshot["medicationsAndSupplements"] === "string" ? profileSnapshot["medicationsAndSupplements"].trim() : "";
    const foodAllergies = typeof profileSnapshot["foodAllergies"] === "string" ? profileSnapshot["foodAllergies"].trim() : "";
    const dislikedFoods = typeof profileSnapshot["dislikedFoods"] === "string" ? profileSnapshot["dislikedFoods"].trim() : "";

    return [
      [t("panelNutritionRequestDetail.summary.requestType"), item.requestTypeLabel],
      [t("panelNutritionRequestDetail.summary.prescriptionType"), getModeLabel(item.prescriptionMode, t)],
      [t("panelNutritionRequestDetail.summary.requestStatus"), item.statusLabel],
      [t("panelNutritionRequestDetail.summary.aiStatus"), item.aiGenerationStatusLabel ?? t("panelNutritionRequestDetail.valueMissing")],
      [t("panelNutritionRequestDetail.summary.requiresManualApproval"), item.requiresManualApproval ? t("panelNutritionRequestDetail.boolean.yes") : t("panelNutritionRequestDetail.boolean.no")],
      [t("panelNutritionRequestDetail.summary.manualApprovedAt"), item.manualApprovedAt ? formatDateTime(item.manualApprovedAt) : "—"],
      [t("panelNutritionRequestDetail.summary.user"), `${item.user?.name || "—"} | ${item.user?.mobile || "—"}`],
      [t("panelNutritionRequestDetail.summary.package"), item.subscription?.packageName ?? "—"],
      [t("panelNutritionRequestDetail.summary.startedAt"), formatDate(item.startedAt)],
      [t("panelNutritionRequestDetail.summary.endsAt"), formatDate(item.endsAt)],
      [t("panelNutritionRequestDetail.summary.createdAt"), formatDateTime(item.createdAt)],
      [t("panelNutritionRequestDetail.summary.aiJobDispatchedAt"), formatDateTime(item.aiJobDispatchedAt)],
      [t("panelNutritionRequestDetail.summary.aiGeneratedAt"), formatDateTime(item.aiGeneratedAt)],
      [t("panelNutritionRequestDetail.summary.currentWeight"), item.currentWeightKg !== null && item.currentWeightKg !== undefined ? formatWeight(item.currentWeightKg) : "—"],
      [t("panelNutritionRequestDetail.summary.targetWeight"), item.targetWeightKg !== null && item.targetWeightKg !== undefined ? formatWeight(item.targetWeightKg) : "—"],
      [t("panelNutritionRequestDetail.summary.weightGap"), weightGap > 0 ? formatWeight(weightGap, 1) : "—"],
      [t("panelNutritionRequestDetail.summary.weeklyWeightChange"), item.weeklyWeightChangeKg !== null && item.weeklyWeightChangeKg !== undefined ? formatWeeklyWeight(item.weeklyWeightChangeKg) : "—"],
      [t("panelNutritionRequestDetail.summary.medications"), medicationsAndSupplements || "—"],
      [t("panelNutritionRequestDetail.summary.foodAllergies"), foodAllergies || "—"],
      [t("panelNutritionRequestDetail.summary.dislikedFoods"), dislikedFoods || "—"],
      [t("panelNutritionRequestDetail.summary.baseCalories"), baseCalories > 0 ? formatCalories(baseCalories) : "—"],
      [t("panelNutritionRequestDetail.summary.prescribedCalories"), prescribedCalories > 0 ? formatCalories(prescribedCalories) : "—"],
      [t("panelNutritionRequestDetail.summary.calorieDelta"), baseCalories > 0 && prescribedCalories > 0 ? formatCalories(calorieDelta) : "—"],
    ];
  }, [caloriePlan, formatCalories, formatDate, formatDateTime, formatWeeklyWeight, formatWeight, item, t]);
  const medicalConditionRows = useMemo(() => {
    if (!item) {
      return [];
    }

    const profileSnapshot = item.profileSnapshot && typeof item.profileSnapshot === "object"
      ? item.profileSnapshot as Record<string, unknown>
      : {};

    return normalizeMedicalConditionItems(
      (Array.isArray(profileSnapshot["medicalConditionsItems"]) ? profileSnapshot["medicalConditionsItems"] : []) as NutritionMedicalConditionItem[],
    );
  }, [item]);

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("panelNutritionRequestDetail.loading")}
        </div>
      </div>
    );
  }

  if (!isAdmin || !item) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelNutritionRequestDetail.notFound.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelNutritionRequestDetail.notFound.description")}</p>
          <Link href="/panel/nutrition/requests">
            <Button>{t("panelNutritionRequestDetail.notFound.back")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const detailSections: Array<{
    key: DetailSectionKey;
    label: string;
    description: string;
    icon: typeof CalendarClock;
  }> = [
    { key: "service", label: t("panelNutritionRequestDetail.sections.service.label"), description: t("panelNutritionRequestDetail.sections.service.description"), icon: CalendarClock },
    { key: "user", label: t("panelNutritionRequestDetail.sections.user.label"), description: t("panelNutritionRequestDetail.sections.user.description"), icon: UserRound },
    { key: "diet", label: t("panelNutritionRequestDetail.sections.diet.label"), description: t("panelNutritionRequestDetail.sections.diet.description"), icon: BadgeCheck },
    { key: "tracking", label: t("panelNutritionRequestDetail.sections.tracking.label"), description: t("panelNutritionRequestDetail.sections.tracking.description"), icon: UtensilsCrossed },
    { key: "supplements", label: t("panelNutritionRequestDetail.sections.supplements.label"), description: t("panelNutritionRequestDetail.sections.supplements.description"), icon: Layers3 },
    { key: "ai", label: t("panelNutritionRequestDetail.sections.ai.label"), description: t("panelNutritionRequestDetail.sections.ai.description"), icon: Bot },
  ];
  const activeDetail = detailSections.find((section) => section.key === activeDetailSection) ?? detailSections[0];
  const ActiveDetailIcon = activeDetail.icon;

  return (
    <div className="min-h-screen bg-[#070b12] pb-20 text-slate-50" dir={dir}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_80%_0%,rgba(245,158,11,0.12),transparent_34%),linear-gradient(180deg,#0b101a_0%,#05070b_100%)]" />
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070b12]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-black text-white md:text-xl">{t("panelNutritionRequestDetail.header.title", { id: item.id })}</h1>
              <Badge className="border-amber-300/25 bg-amber-400/15 text-amber-200 hover:bg-amber-400/15">{item.requestTypeLabel}</Badge>
              <Badge className="border-emerald-300/25 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/15">{item.statusLabel}</Badge>
              <Badge className="border-sky-300/25 bg-sky-400/15 text-sky-200 hover:bg-sky-400/15">{item.aiGenerationStatusLabel ?? t("panelNutritionRequestDetail.valueMissing")}</Badge>
            </div>
            <div className="mt-1 text-xs text-slate-400">{t("panelNutritionRequestDetail.header.description")}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/panel/nutrition/requests">
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10">
                <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
              </Button>
            </Link>
            <Button type="button" variant="outline" className="hidden h-10 rounded-2xl border-white/10 bg-white/5 px-4 text-xs font-bold text-white hover:bg-white/10 sm:inline-flex">
              {t("panelNutritionRequestDetail.header.sessionSummary")}
            </Button>
          </div>
        </div>
      </header>

      {manualApprovalPending ? (
        <div className="mx-auto max-w-7xl px-4 pt-5">
          <div className="overflow-hidden rounded-[28px] border border-amber-300/30 bg-[linear-gradient(135deg,rgba(120,53,15,0.78),rgba(69,26,3,0.9))] p-5 shadow-[0_28px_80px_-38px_rgba(251,191,36,0.65)] md:p-7">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-amber-200/25 bg-amber-300/15 text-amber-200">
                  <ShieldAlert className="h-7 w-7" />
                </div>
                <div>
                  <div className="text-xs font-black text-amber-200">{t("panelNutritionRequestDetail.pendingApprovalBanner.badge")}</div>
                  <h2 className="mt-2 text-xl font-black leading-8 text-white md:text-2xl">
                    {t("panelNutritionRequestDetail.pendingApprovalBanner.title")}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm font-bold leading-8 text-amber-50/80">
                    {t("panelNutritionRequestDetail.pendingApprovalBanner.description")}
                  </p>
                </div>
              </div>
              <Button type="button" onClick={goToDeliveryApproval} className="h-12 shrink-0 rounded-2xl bg-amber-300 px-6 text-sm font-black text-amber-950 hover:bg-amber-200">
                <BadgeCheck className="me-2 h-5 w-5" />
                {t("panelNutritionRequestDetail.pendingApprovalBanner.action")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden border-white/10 bg-[#111827]/80 text-white shadow-2xl shadow-black/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-slate-400">{t("panelNutritionRequestDetail.sidebar.team")}</div>
                  <div className="mt-1 truncate text-sm font-black">{item.user?.name || t("panelNutritionRequestDetail.sidebar.unnamedUser")}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.user?.mobile ? <PhoneText>{item.user.mobile}</PhoneText> : t("panelNutritionRequestDetail.sidebar.mobileMissing")}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/15 text-amber-200">
                  <CalendarClock className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <nav className="rounded-[26px] border border-white/10 bg-[#111827]/75 p-2 shadow-2xl shadow-black/20">
            {detailSections.map((section) => {
              const SectionIcon = section.icon;
              const active = section.key === activeDetailSection;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveDetailSection(section.key)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-start transition ${
                    active
                      ? "border border-amber-300/20 bg-amber-500/15 text-amber-100 shadow-inner shadow-amber-950/20"
                      : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-amber-400/20 text-amber-200" : "bg-slate-950/60 text-slate-400"}`}>
                    <SectionIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">{section.label}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">{section.description}</span>
                  </span>
                  <ChevronLeft className={`h-4 w-4 ${!isRtl ? "rotate-180" : ""} ${active ? "text-amber-200" : "text-slate-600"}`} />
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="nutrition-request-redesign min-w-0 space-y-4">
          <div className="rounded-[26px] border border-white/10 bg-[#111827]/70 p-4 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/15 text-amber-200">
                  <ActiveDetailIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-200">{activeDetail.description}</div>
                  <h2 className="mt-1 text-xl font-black text-white">{activeDetail.label}</h2>
                </div>
              </div>
              {userProfileHref ? (
                <Link href={userProfileHref}>
                  <Button variant="outline" className="h-10 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10">
                    <UserRound className="me-2 h-4 w-4" />
                    {t("panelNutritionRequestDetail.actions.viewUserProfile")}
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>

          {activeDetailSection === "service" ? (
          <div className="space-y-4">
        <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" />
                {t("panelNutritionRequestDetail.service.summaryTitle")}
              </CardTitle>
              {userProfileHref ? (
                <Link href={userProfileHref}>
                  <Button variant="outline" className="h-10 rounded-2xl">
                    <UserRound className="me-2 h-4 w-4" />
                    {t("panelNutritionRequestDetail.actions.viewUserProfile")}
                  </Button>
                </Link>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {summaryRows.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 font-bold leading-7">{value}</div>
                </div>
              ))}
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4 sm:col-span-2">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.service.medicalConditions")}</div>
                {medicalConditionRows.length > 0 ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/60 bg-background/50 hover:bg-background/50">
                          <TableHead className="text-start">{t("panelNutritionRequestDetail.medicalTable.condition")}</TableHead>
                          <TableHead className="text-start">{t("panelNutritionRequestDetail.medicalTable.start")}</TableHead>
                          <TableHead className="text-start">{t("panelNutritionRequestDetail.medicalTable.end")}</TableHead>
                          <TableHead className="text-start">{t("panelNutritionRequestDetail.medicalTable.status")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {medicalConditionRows.map((condition) => (
                          <TableRow key={condition.id} className="border-border/60">
                            <TableCell className="font-bold">{condition.title}</TableCell>
                            <TableCell>{formatDate(condition.startedAt ?? null)}</TableCell>
                            <TableCell>{condition.status === "current" || condition.ongoing ? "—" : formatDate(condition.endedAt ?? null)}</TableCell>
                            <TableCell>{getMedicalConditionStatus(condition.status, t)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="mt-1 font-bold leading-7">—</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                {t("panelNutritionRequestDetail.service.prescriptionStatusTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.service.onlineDiet")}</div>
                  <div className="mt-1 font-bold">
                    {formatUsageRatio(item.subscription?.onlineDietUsed, item.subscription?.onlineDietTotal)}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.service.offlineDiet")}</div>
                  <div className="mt-1 font-bold">
                    {formatUsageRatio(item.subscription?.offlineDietUsed, item.subscription?.offlineDietTotal)}
                  </div>
                </div>
              </div>

              {item.currentPrescription ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-sm font-black">{t("panelNutritionRequestDetail.service.currentPrescriptionDate")}</div>
                      <div className="mt-1 text-xs leading-6 text-muted-foreground">
                        {t("panelNutritionRequestDetail.service.currentPrescriptionDateDescription")}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openPrescriptionDateEdit(item.currentPrescription!)}
                      className="rounded-2xl"
                    >
                      <Pencil className="me-2 h-4 w-4" />
                      {t("panelNutritionRequestDetail.service.editPrescriptionDate")}
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                      <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.service.dietStart")}</div>
                      <div className="mt-1 font-bold">{formatDate(item.currentPrescription.startedAt)}</div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                      <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.service.dietEnd")}</div>
                      <div className="mt-1 font-bold">{formatDate(item.currentPrescription.endsAt)}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="text-sm font-bold">{t("panelNutritionRequestDetail.service.prescriptions")}</div>
                {item.prescriptions?.length ? (
                  <div className="space-y-2">
                    {item.prescriptions.map((prescription) => (
                      <div key={prescription.id} className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-1">
                            <div className="font-bold">{t("panelNutritionRequestDetail.service.prescriptionNumber", { id: prescription.id })}</div>
                            <div className="text-xs text-muted-foreground">{getModeLabel(prescription.prescriptionMode, t)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {prescription.isCurrent ? <Badge variant="default">{t("panelNutritionRequestDetail.service.current")}</Badge> : <Badge variant="secondary">{t("panelNutritionRequestDetail.service.archived")}</Badge>}
                            <Badge variant="outline">{prescription.status}</Badge>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border/60 bg-card/35 p-3">
                            <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.service.dietStart")}</div>
                            <div className="mt-1 font-bold">{formatDate(prescription.startedAt)}</div>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-card/35 p-3">
                            <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.service.dietEnd")}</div>
                            <div className="mt-1 font-bold">{formatDate(prescription.endsAt)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 px-4 py-8 text-center text-sm text-muted-foreground">
                    {t("panelNutritionRequestDetail.service.noPrescriptions")}
                  </div>
                )}
              </div>

              {item.aiGenerationError ? (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm leading-7 text-rose-200">
                  <div className="font-bold">{t("panelNutritionRequestDetail.service.lastGenerationError")}</div>
                  <div>{item.aiGenerationError}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
          </div>
          ) : null}

        {activeDetailSection === "ai" && item.requestType === "ai" && tokenBreakdown ? (
          <div className="space-y-4">
          <Card className="border-amber-400/20 bg-amber-500/[0.04]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-300" />
                {t("panelNutritionRequestDetail.aiUsage.title")}
              </CardTitle>
              <CardDescription>
                {t("panelNutritionRequestDetail.aiUsage.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.totalConsumed")}</div>
                  <div className="mt-2 text-2xl font-black">{formatNumber(tokenBreakdown.totalConsumedTokens)}</div>
                </div>
                <div className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.dietGeneration")}</div>
                  <div className="mt-2 text-2xl font-black">{formatNumber(tokenBreakdown.dietGenerationTokens)}</div>
                </div>
                <div className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.dietRevision")}</div>
                  <div className="mt-2 text-2xl font-black">{formatNumber(tokenBreakdown.dietRevisionTokens)}</div>
                </div>
                <div className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.mealReplacement")}</div>
                  <div className="mt-2 text-2xl font-black">{formatNumber(tokenBreakdown.mealReplacementTokens)}</div>
                </div>
                <div className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.manualMealNutrition")}</div>
                  <div className="mt-2 text-2xl font-black">{formatNumber(tokenBreakdown.manualMealNutritionTokens)}</div>
                </div>
                <div className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.mealPhotoAnalysis")}</div>
                  <div className="mt-2 text-2xl font-black">{formatNumber(tokenBreakdown.mealPhotoAnalysisTokens ?? 0)}</div>
                </div>
              </div>

              {aiUsageLimits ? (
                <div className="rounded-2xl border border-amber-300/15 bg-background/35 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-black">{t("panelNutritionRequestDetail.aiUsage.userLimitsTitle")}</div>
                      <div className="mt-1 text-sm leading-7 text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.userLimitsDescription")}</div>
                    </div>
                    <Button type="button" onClick={saveAiUsageLimits} disabled={savingAiUsageLimits}>
                      {savingAiUsageLimits ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                      {t("panelNutritionRequestDetail.aiUsage.saveLimits")}
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {[
                      { dietKey: "mealPhotoAnalysisDietLimit", hourlyKey: "mealPhotoAnalysisHourlyLimit", item: aiUsageLimits.mealPhotoAnalysis },
                      { dietKey: "manualMealNutritionDietLimit", hourlyKey: "manualMealNutritionHourlyLimit", item: aiUsageLimits.manualMealNutrition },
                      { dietKey: "mealReplacementDietLimit", hourlyKey: "mealReplacementHourlyLimit", item: aiUsageLimits.mealReplacement },
                    ].map((row) => row.item ? (
                      <div key={row.dietKey} className="rounded-2xl border border-border/70 bg-card/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold">{row.item.label}</div>
                            <div className="mt-1 text-xs leading-6 text-muted-foreground">
                              {t("panelNutritionRequestDetail.aiUsage.usedFrom", {
                                used: formatNumber(row.item.usedCount),
                                total: formatAiLimitValue(row.item.effectiveDietLimit),
                              })}
                            </div>
                          </div>
                          <Badge variant={row.item.remainingCount === 0 ? "destructive" : "secondary"}>
                            {row.item.remainingCount == null
                              ? t("panelNutritionRequestDetail.ai.unlimited")
                              : t("panelNutritionRequestDetail.aiUsage.remaining", { count: formatNumber(row.item.remainingCount) })}
                          </Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.dietLimit")}</Label>
                            <Input
                              inputMode="numeric"
                              type="number"
                              min={1}
                              value={aiLimitDraft[row.dietKey as keyof typeof aiLimitDraft]}
                              onChange={(event) => setAiLimitDraft((current) => ({ ...current, [row.dietKey]: event.target.value }))}
                              placeholder={formatAiLimitValue(row.item.globalDietLimit)}
                              className="h-9"
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.hourlyLimit")}</Label>
                            <Input
                              inputMode="numeric"
                              type="number"
                              min={1}
                              value={aiLimitDraft[row.hourlyKey as keyof typeof aiLimitDraft]}
                              onChange={(event) => setAiLimitDraft((current) => ({ ...current, [row.hourlyKey]: event.target.value }))}
                              placeholder={formatAiLimitValue(row.item.globalHourlyLimit)}
                              className="h-9"
                            />
                          </div>
                        </div>
                        <div className="mt-2 text-[11px] leading-5 text-muted-foreground">
                          {t("panelNutritionRequestDetail.aiUsage.currentLimits", {
                            diet: formatAiLimitValue(row.item.effectiveDietLimit),
                            hourly: formatAiLimitValue(row.item.effectiveHourlyLimit),
                          })}
                        </div>
                      </div>
                    ) : null)}
                  </div>
                </div>
              ) : null}

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="diet-token-breakdown" className="rounded-2xl border border-amber-300/15 bg-background/30 px-4">
                  <AccordionTrigger className="text-start font-bold">
                    {t("panelNutritionRequestDetail.aiUsage.showFullStats")}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.entriesCount")}</div>
                        <div className="mt-1 font-bold">{formatNumber(tokenBreakdown.entriesCount)}</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.initialGeneration")}</div>
                        <div className="mt-1 font-bold">{formatTokens(tokenBreakdown.dietGenerationTokens)}</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.aiRevision")}</div>
                        <div className="mt-1 font-bold">{formatTokens(tokenBreakdown.dietRevisionTokens)}</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.mealReplacement")}</div>
                        <div className="mt-1 font-bold">{formatTokens(tokenBreakdown.mealReplacementTokens)}</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.manualMealNutrition")}</div>
                        <div className="mt-1 font-bold">{formatTokens(tokenBreakdown.manualMealNutritionTokens)}</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.aiUsage.mealPhotoAnalysis")}</div>
                        <div className="mt-1 font-bold">{formatTokens(tokenBreakdown.mealPhotoAnalysisTokens ?? 0)}</div>
                      </div>
                    </div>

                    {tokenBreakdown.entries.length ? (
                      <div className="space-y-3">
                        {tokenBreakdown.entries.map((entry) => (
                          <div key={entry.id} className="rounded-2xl border border-border/70 bg-card/40 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="font-black">{entry.reasonTitle}</div>
                                  <Badge variant="secondary">-{formatNumber(entry.tokensAmount)}</Badge>
                                  <Badge variant="outline">{entry.eventTypeLabel ?? entry.eventType}</Badge>
                                </div>
                                <div className="text-sm leading-7 text-muted-foreground">{entry.summary || "—"}</div>
                              </div>
                              <div className="text-sm text-muted-foreground">{formatDateTime(entry.occurredAt)}</div>
                            </div>

                            {(entry.actorUser?.name || entry.meta?.model || entry.meta?.slot_title || entry.meta?.food_title || (entry.meta?.usage as Record<string, unknown> | undefined)?.total_tokens) ? (
                              <div className="mt-3 rounded-2xl border border-border/70 bg-background/30 p-3 text-xs leading-6 text-muted-foreground">
                                {entry.actorUser?.name || entry.actorUser?.mobile ? (
                                  <div>
                                    {t("panelNutritionRequestDetail.aiUsage.actor")}:{" "}
                                    <span className="font-bold text-foreground">
                                      {entry.actorUser?.name || "—"} {entry.actorUser?.mobile ? <>• <PhoneText>{entry.actorUser.mobile}</PhoneText></> : ""}
                                    </span>
                                  </div>
                                ) : null}
                                {entry.meta?.model ? <div>{t("panelNutritionRequestDetail.aiUsage.model")}: <span className="font-bold text-foreground">{String(entry.meta.model)}</span></div> : null}
                                {entry.meta?.slot_title ? <div>{t("panelNutritionRequestDetail.aiUsage.relatedMeal")}: <span className="font-bold text-foreground">{String(entry.meta.slot_title)}</span></div> : null}
                                {entry.meta?.food_title ? <div>{t("panelNutritionRequestDetail.aiUsage.loggedFood")}: <span className="font-bold text-foreground">{String(entry.meta.food_title)}</span></div> : null}
                                {entry.meta?.usage && typeof entry.meta.usage === "object" ? (
                                  <div>
                                    {t("panelNutritionRequestDetail.aiUsage.actualUsage")}:{" "}
                                    <span className="font-bold text-foreground">{formatTokens(Number((entry.meta.usage as Record<string, unknown>).total_tokens ?? 0))}</span>
                                    <span>
                                      {" "}
                                      {t("panelNutritionRequestDetail.aiUsage.promptCompletion", {
                                        prompt: formatNumber(Number((entry.meta.usage as Record<string, unknown>).prompt_tokens ?? 0)),
                                        completion: formatNumber(Number((entry.meta.usage as Record<string, unknown>).completion_tokens ?? 0)),
                                      })}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 px-4 py-8 text-center text-sm text-muted-foreground">
                        {t("panelNutritionRequestDetail.aiUsage.emptyEntries")}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
          </div>
        ) : null}
        {activeDetailSection === "ai" && !(item.requestType === "ai" && tokenBreakdown) ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#111827]/70 p-5 text-sm leading-7 text-slate-400">
            {t("panelNutritionRequestDetail.aiUsage.emptySection")}
          </div>
        ) : null}

        {activeDetailSection === "user" ? (
          <div className="space-y-4">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-primary" />
                {t("panelNutritionRequestDetail.userInfo.title")}
              </CardTitle>
              <CardDescription>{t("panelNutritionRequestDetail.userInfo.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {summaryRows.map(([label, value]) => (
                  <div key={`user-${label}`} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 font-bold leading-7">{value}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.service.medicalConditions")}</div>
                {medicalConditionRows.length > 0 ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/60 bg-background/50 hover:bg-background/50">
                          <TableHead className="text-start">{t("panelNutritionRequestDetail.medicalTable.condition")}</TableHead>
                          <TableHead className="text-start">{t("panelNutritionRequestDetail.medicalTable.start")}</TableHead>
                          <TableHead className="text-start">{t("panelNutritionRequestDetail.medicalTable.end")}</TableHead>
                          <TableHead className="text-start">{t("panelNutritionRequestDetail.medicalTable.status")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {medicalConditionRows.map((condition) => (
                          <TableRow key={`user-condition-${condition.id}`} className="border-border/60">
                            <TableCell className="font-bold">{condition.title}</TableCell>
                            <TableCell>{formatDate(condition.startedAt ?? null)}</TableCell>
                            <TableCell>{condition.status === "current" || condition.ongoing ? "—" : formatDate(condition.endedAt ?? null)}</TableCell>
                            <TableCell>{getMedicalConditionStatus(condition.status, t)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="mt-1 font-bold leading-7">—</div>
                )}
              </div>
            </CardContent>
          </Card>

        {item.requestType === "expert" && customerExpertDescription ? (
          <Card className="border-cyan-400/20 bg-cyan-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="h-5 w-5 text-cyan-300" />
                {t("panelNutritionRequestDetail.customerExpert.title")}
              </CardTitle>
              <CardDescription>{t("panelNutritionRequestDetail.customerExpert.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-cyan-400/15 bg-background/40 p-4 text-sm leading-8 text-foreground">
                {customerExpertDescription}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {repeatDietFeedback.rows.length > 0 || repeatDietFeedback.medicalNotes ? (
          <Card className="border-amber-400/20 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-amber-300" />
                {t("panelNutritionRequestDetail.feedback.title")}
              </CardTitle>
              <CardDescription>{t("panelNutritionRequestDetail.feedback.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {repeatDietFeedback.rows.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {repeatDietFeedback.rows.map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="mt-2 text-sm font-bold leading-7 text-foreground">{value}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {repeatDietFeedback.medicalNotes ? (
                <div className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.feedback.medicalNotes")}</div>
                  <div className="mt-2 text-sm leading-8 text-foreground">{repeatDietFeedback.medicalNotes}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
          </div>
        ) : null}

        {activeDetailSection === "diet" ? (
          <div className="space-y-4">
        {manualApprovalPending ? (
          <Card id="nutrition-delivery-approval" className="scroll-mt-28 border-amber-300/20 bg-amber-400/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-300" />
                {t("panelNutritionRequestDetail.deliveryApproval.title")}
              </CardTitle>
              <CardDescription>
                {t("panelNutritionRequestDetail.deliveryApproval.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-amber-300/20 bg-background/40 p-4 text-sm leading-8 text-foreground">
                {t("panelNutritionRequestDetail.deliveryApproval.notice")}
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-background/40 p-4">
                <Checkbox id="approve-delivery" checked={confirmApproveDelivery} onCheckedChange={(checked) => setConfirmApproveDelivery(Boolean(checked))} />
                <div className="space-y-1">
                  <Label htmlFor="approve-delivery" className="cursor-pointer text-sm font-bold">
                    {t("panelNutritionRequestDetail.deliveryApproval.confirmLabel")}
                  </Label>
                  <div className="text-xs leading-6 text-muted-foreground">
                    {t("panelNutritionRequestDetail.deliveryApproval.confirmDescription")}
                  </div>
                </div>
              </div>

              <Button type="button" onClick={approveDelivery} disabled={!confirmApproveDelivery || approvingDelivery} className="rounded-2xl px-6">
                {approvingDelivery ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="me-2 h-4 w-4" />}
                {t("panelNutritionRequestDetail.deliveryApproval.submit")}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {item.requestType === "expert" && (!item.currentPrescription || expertFileEditorOpen) ? (
          <Card className="border-amber-400/20 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="h-5 w-5 text-amber-300" />
                {item.currentPrescription ? t("panelNutritionRequestDetail.expertFile.editTitle") : t("panelNutritionRequestDetail.expertFile.sendTitle")}
              </CardTitle>
              <CardDescription>
                {item.currentPrescription
                  ? t("panelNutritionRequestDetail.expertFile.editDescription")
                  : t("panelNutritionRequestDetail.expertFile.sendDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {item.currentPrescription ? (
                <div className="flex justify-start">
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setExpertFileEditorOpen(false)}>
                    {t("panelNutritionRequestDetail.expertFile.closeEditor")}
                  </Button>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant={expertFileDraft.source === "library" ? "default" : "outline"}
                  className="rounded-2xl"
                  onClick={() => setExpertFileDraft((current) => ({ ...current, source: "library" }))}
                >
                  {t("panelNutritionRequestDetail.expertFile.sourceLibrary")}
                </Button>
                <Button
                  type="button"
                  variant={expertFileDraft.source === "upload" ? "default" : "outline"}
                  className="rounded-2xl"
                  onClick={() => setExpertFileDraft((current) => ({ ...current, source: "upload" }))}
                >
                  {t("panelNutritionRequestDetail.expertFile.sourceUpload")}
                </Button>
              </div>

              {expertFileDraft.source === "library" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("panelNutritionRequestDetail.expertFile.startedAt")}</Label>
                      <div className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3 text-sm font-bold">
                        {formatDate(expertFileDraft.startedAt)}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("panelNutritionRequestDetail.expertFile.endsAt")}</Label>
                      <DatePicker
                        value={expertFileDraft.endsAt ? toSafeGregorianDate(expertFileDraft.endsAt) : undefined}
                        onChange={(value) => {
                          const date = value as DateObject | null;
                          if (!date) {
                            return;
                          }

                          setExpertFileDraft((current) => ({
                            ...current,
                            endsAt: format(date.toDate(), "yyyy-MM-dd"),
                          }));
                        }}
                        calendar={persian}
                        locale={persian_fa}
                        format="YYYY/MM/DD"
                        className="bg-card w-full"
                        inputClass="bg-background border border-border rounded-2xl p-3 w-full text-center"
                      />
                      <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.expertFile.defaultDurationHint")}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[1fr,220px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground end-4" />
                      <Input
                        value={expertFileDraft.search}
                        onChange={(event) => setExpertFileDraft((current) => ({ ...current, search: event.target.value }))}
                        placeholder={t("panelNutritionRequestDetail.expertFile.searchPlaceholder")}
                        className="h-12 rounded-2xl pe-11"
                      />
                    </div>
                    <Select value={expertFileDraft.libraryGroupId} onValueChange={(value) => setExpertFileDraft((current) => ({ ...current, libraryGroupId: value }))}>
                      <SelectTrigger className="h-12 rounded-2xl">
                        <SelectValue placeholder={t("panelNutritionRequestDetail.expertFile.groupFilterPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("panelNutritionRequestDetail.expertFile.allGroups")}</SelectItem>
                        {dietFileGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {filteredDietFiles.length ? filteredDietFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setExpertFileDraft((current) => ({ ...current, selectedDietFileId: file.id }))}
                        className={`rounded-2xl border p-4 text-start ${
                          expertFileDraft.selectedDietFileId === file.id
                            ? "border-amber-300/30 bg-amber-300/10"
                            : "border-border/70 bg-background/40"
                        }`}
                      >
                        <div className="font-black">{file.title}</div>
                        <div className="mt-2 text-sm leading-7 text-muted-foreground">{file.description || t("panelNutritionRequestDetail.expertFile.noFileDescription")}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {file.groupName ? <Badge variant="secondary">{file.groupName}</Badge> : null}
                          {file.calories != null ? <Badge variant="outline">{formatCalories(file.calories)}</Badge> : null}
                        </div>
                      </button>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 px-4 py-10 text-center text-sm text-muted-foreground lg:col-span-2">
                        {t("panelNutritionRequestDetail.expertFile.emptyLibrary")}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("panelNutritionRequestDetail.expertFile.startedAt")}</Label>
                    <div className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3 text-sm font-bold">
                      {formatDate(expertFileDraft.startedAt)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("panelNutritionRequestDetail.expertFile.endsAt")}</Label>
                    <DatePicker
                      value={expertFileDraft.endsAt ? toSafeGregorianDate(expertFileDraft.endsAt) : undefined}
                      onChange={(value) => {
                        const date = value as DateObject | null;
                        if (!date) {
                          return;
                        }

                        setExpertFileDraft((current) => ({
                          ...current,
                          endsAt: format(date.toDate(), "yyyy-MM-dd"),
                        }));
                      }}
                      calendar={persian}
                      locale={persian_fa}
                      format="YYYY/MM/DD"
                      className="bg-card w-full"
                      inputClass="bg-background border border-border rounded-2xl p-3 w-full text-center"
                    />
                    <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.expertFile.defaultDurationHint")}</div>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="expert-upload-file">{t("panelNutritionRequestDetail.expertFile.file")}</Label>
                    <Input id="expert-upload-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(event) => setExpertFileDraft((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} />
                    {item.currentPrescription ? (
                      <div className="text-xs leading-6 text-muted-foreground">{t("panelNutritionRequestDetail.expertFile.replaceFileHint")}</div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expert-upload-title">{t("panelNutritionRequestDetail.expertFile.fileTitle")}</Label>
                    <Input id="expert-upload-title" value={expertFileDraft.title} onChange={(event) => setExpertFileDraft((current) => ({ ...current, title: event.target.value }))} placeholder={t("panelNutritionRequestDetail.expertFile.fileTitlePlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expert-upload-calories">{t("panelNutritionRequestDetail.expertFile.calories")}</Label>
                    <Input id="expert-upload-calories" value={expertFileDraft.calories} onChange={(event) => setExpertFileDraft((current) => ({ ...current, calories: event.target.value }))} placeholder={t("panelNutritionRequestDetail.expertFile.caloriesPlaceholder")} />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="expert-upload-group">{t("panelNutritionRequestDetail.expertFile.group")}</Label>
                    <Select value={expertFileDraft.groupId} onValueChange={(value) => setExpertFileDraft((current) => ({ ...current, groupId: value }))}>
                      <SelectTrigger id="expert-upload-group" className="rounded-2xl">
                        <SelectValue placeholder={t("panelNutritionRequestDetail.expertFile.groupPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("panelNutritionRequestDetail.expertFile.noGroup")}</SelectItem>
                        {dietFileGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="expert-upload-description">{t("panelNutritionRequestDetail.expertFile.descriptionField")}</Label>
                    <Textarea id="expert-upload-description" value={expertFileDraft.description} onChange={(event) => setExpertFileDraft((current) => ({ ...current, description: event.target.value }))} className="min-h-28" placeholder={t("panelNutritionRequestDetail.expertFile.descriptionPlaceholder")} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="expert-viewer-message">{t("panelNutritionRequestDetail.viewerMessage.label")}</Label>
                <Textarea id="expert-viewer-message" value={expertFileDraft.viewerMessage} onChange={(event) => setExpertFileDraft((current) => ({ ...current, viewerMessage: event.target.value }))} className="min-h-24" placeholder={t("panelNutritionRequestDetail.viewerMessage.placeholder")} />
              </div>

              <Button type="button" onClick={sendExpertFile} disabled={sendingExpertFile} className="rounded-2xl px-6">
                {sendingExpertFile ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <UploadCloud className="me-2 h-4 w-4" />}
                {item.currentPrescription ? t("panelNutritionRequestDetail.expertFile.saveAndSendNewVersion") : t("panelNutritionRequestDetail.expertFile.sendToUser")}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {isExpertFilePrescription && currentExpertFile ? (
          <Card className="border-amber-400/20 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="h-5 w-5 text-amber-300" />
                {t("panelNutritionRequestDetail.expertFile.currentTitle")}
              </CardTitle>
              <CardDescription>{t("panelNutritionRequestDetail.expertFile.currentDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.expertFile.fileName")}</div>
                <div className="mt-1 text-xl font-black">{currentExpertFile.title}</div>
                <div className="mt-2 text-sm text-muted-foreground">{currentExpertFile.fileName}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.expertFile.groupAndCalories")}</div>
                <div className="mt-1 font-bold">
                  {currentExpertFile.group?.name || t("panelNutritionRequestDetail.expertFile.noGroup")}
                  {currentExpertFile.calories != null ? ` | ${formatCalories(currentExpertFile.calories)}` : ""}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4 lg:col-span-2">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.expertFile.descriptionField")}</div>
                <div className="mt-1 leading-8">{currentExpertFile.description || item.currentPrescription?.notes || t("panelNutritionRequestDetail.expertFile.noFileDescription")}</div>
              </div>
              <div className="lg:col-span-2">
                <div className="flex flex-wrap gap-3">
                  <a href={currentExpertFile.fileUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground">
                    <Download className="me-2 h-4 w-4" />
                    {t("panelNutritionRequestDetail.expertFile.download")}
                  </a>
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={openExpertFileEditor}>
                    <Pencil className="me-2 h-4 w-4" />
                    {t("panelNutritionRequestDetail.expertFile.editSentFile")}
                  </Button>
                  <Button type="button" variant="destructive" className="rounded-2xl" onClick={deleteExpertFile} disabled={deletingExpertFile}>
                    {deletingExpertFile ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <XCircle className="me-2 h-4 w-4" />}
                    {t("panelNutritionRequestDetail.expertFile.deleteSentFile")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {caloriePlan && !isExpertFilePrescription ? (
          <Card className="border-emerald-400/20 bg-emerald-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-emerald-500" />
                {t("panelNutritionRequestDetail.caloriePlan.title")}
              </CardTitle>
              <CardDescription>{t("panelNutritionRequestDetail.caloriePlan.description")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.caloriePlan.baseCalories")}</div>
                <div className="mt-1 text-xl font-black">{formatCalories(Number(caloriePlan.base_calories ?? 0))}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.caloriePlan.prescribedCalories")}</div>
                <div className="mt-1 text-xl font-black">{formatCalories(Number(caloriePlan.prescribed_calories ?? 0))}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.caloriePlan.calorieChange")}</div>
                <div className="mt-1 text-xl font-black">
                  {formatCalories(Number(caloriePlan.base_calories ?? 0) - Number(caloriePlan.prescribed_calories ?? 0))}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.caloriePlan.targetPace")}</div>
                <div className="mt-1 text-xl font-black">{item.weeklyWeightChangeKg != null ? formatWeeklyWeight(item.weeklyWeightChangeKg) : "—"}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.caloriePlan.weightGap")}</div>
                <div className="mt-1 text-xl font-black">
                  {item.currentWeightKg != null && item.targetWeightKg != null
                    ? formatWeight(Math.abs(item.currentWeightKg - item.targetWeightKg), 1)
                    : "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.caloriePlan.goalAdjustment")}</div>
                <div className="mt-1 font-bold leading-7">{String(caloriePlan.goal_adjustment ?? "—")}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4 lg:col-span-3">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.caloriePlan.reasoning")}</div>
                <div className="mt-1 leading-8">{String(caloriePlan.summary_text ?? caloriePlan.reasoning ?? "—")}</div>
              </div>
            </CardContent>
          </Card>
        ) : null}
          </div>
        ) : null}

        {activeDetailSection === "supplements" ? (
          <div className="space-y-4">
        {supplementPlan && !isExpertFilePrescription ? (
          <Card className="border-violet-400/20 bg-violet-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-violet-500" />
                {t("panelNutritionRequestDetail.supplements.title")}
              </CardTitle>
              <CardDescription>{t("panelNutritionRequestDetail.supplements.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.supplements.status")}</div>
                <div className="mt-1 font-bold">{supplementPlan.enabled ? t("panelNutritionRequestDetail.supplements.prescribed") : t("panelNutritionRequestDetail.supplements.notPrescribed")}</div>
                <div className="mt-2 leading-7">{String(supplementPlan.summary_text ?? "—")}</div>
              </div>
              {Array.isArray(supplementPlan.items) && supplementPlan.items.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {supplementPlan.items.map((itemValue, index) => {
                    const supplement = itemValue && typeof itemValue === "object" ? (itemValue as Record<string, unknown>) : {};

                    return (
                      <div key={`supplement-${index}`} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                        <div className="font-black">{String(supplement.title ?? t("panelNutritionRequestDetail.supplements.defaultTitle"))}</div>
                        <div className="mt-2 text-sm leading-7">{String(supplement.usage ?? "")}</div>
                        <div className="mt-2 text-xs text-muted-foreground">{t("panelNutritionRequestDetail.supplements.timing", { value: String(supplement.timing ?? "—") })}</div>
                        <div className="mt-2 text-xs leading-6 text-muted-foreground">{String(supplement.notes ?? "")}</div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
        {!supplementPlan || isExpertFilePrescription ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#111827]/70 p-5 text-sm leading-7 text-slate-400">
            {t("panelNutritionRequestDetail.supplements.empty")}
          </div>
        ) : null}
          </div>
        ) : null}

        {activeDetailSection === "tracking" ? (
          <div className="space-y-4">
        {shouldShowMealReplacementSummary ? (
          <Card className="border-amber-400/20 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-amber-400" />
                {t("panelNutritionRequestDetail.replacements.title")}
              </CardTitle>
              <CardDescription>
                {t("panelNutritionRequestDetail.replacements.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.replacements.manageableMeals")}</div>
                  <div className="mt-1 text-2xl font-black">{formatNumber(mealReplacementTargets.length)}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.replacements.generatedLists")}</div>
                  <div className="mt-1 text-2xl font-black">
                    {formatNumber(currentMealReplacementSuggestions.filter((suggestion) => suggestion.status === "generated").length)}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.replacements.pendingRequests")}</div>
                  <div className="mt-1 text-2xl font-black">
                    {formatNumber(currentMealReplacementSuggestions.filter((suggestion) => suggestion.status === "queued" || suggestion.status === "processing").length)}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-sm leading-8 text-muted-foreground">
                  {mealReplacementEnabled
                    ? t("panelNutritionRequestDetail.replacements.enabledNotice")
                    : t("panelNutritionRequestDetail.replacements.disabledNotice")}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={`/panel/nutrition/requests/${item.id}/replacements`}>
                  <Button type="button" className="rounded-2xl">
                    {t("panelNutritionRequestDetail.replacements.viewDetails")}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {item.requestType === "ai" && !isExpertFilePrescription && !manualApprovalPending ? (
        <Card className="border-cyan-400/20 bg-cyan-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-cyan-400" />
              {t("panelNutritionRequestDetail.tracking.title")}
            </CardTitle>
            <CardDescription>{t("panelNutritionRequestDetail.tracking.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.tracking.progressPercent")}</div>
                <div className="mt-1 text-xl font-black">{formatPercentValue(Number(item.currentPrescription?.progress?.progressPercent ?? 0))}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.tracking.loggedMeals")}</div>
                <div className="mt-1 text-xl font-black">
                  {formatNumber(Number(item.currentPrescription?.progress?.loggedMeals ?? item.currentPrescription?.mealLogs?.length ?? 0))}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{t("panelNutritionRequestDetail.tracking.expectedMeals")}</div>
                <div className="mt-1 text-xl font-black">
                  {formatNumber(Number(item.currentPrescription?.progress?.expectedMeals ?? 0))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-start gap-2">
              <Link href={`/panel/nutrition/requests/${item.id}/tracking`}>
                <Button type="button" className="rounded-2xl px-5">
                  {t("panelNutritionRequestDetail.tracking.viewDailyTracking")}
                </Button>
              </Link>
            </div>

            <div className="space-y-3">
              {consumptionDays.length ? consumptionDays.map((day) => {
                const logs = (item.currentPrescription?.mealLogs ?? []).filter((log) => log.consumedDate === day.date);
                const exerciseLogs = (item.currentPrescription?.exerciseLogs ?? []).filter((log) => log.consumedDate === day.date);

                return (
                  <div key={day.date} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-black">{formatDate(day.date)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {day.status === "complete"
                            ? t("panelNutritionRequestDetail.tracking.dayComplete")
                            : day.status === "partial"
                            ? t("panelNutritionRequestDetail.tracking.dayPartial")
                            : t("panelNutritionRequestDetail.tracking.dayEmpty")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={day.status === "complete" ? "default" : day.status === "partial" ? "secondary" : "outline"}>
                          {formatPercentValue(Number(day.progressPercent ?? 0))}
                        </Badge>
                        <Badge variant="outline">{formatWater(Number(day.waterGlasses ?? 0))}</Badge>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      {logs.length ? logs.map((log) => (
                        <div key={log.id} className="rounded-xl border border-border/70 bg-background/50 px-3 py-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-bold">{mealSlotLabel(log.mealSlotKey, t)}</div>
                            {log.isManual ? (
                              <Badge variant="secondary">{t("panelNutritionRequestDetail.tracking.logManual")}</Badge>
                            ) : hasReplacementMeta(log.notes) ? (
                              <Badge variant="secondary">{t("panelNutritionRequestDetail.tracking.logReplacement")}</Badge>
                            ) : (
                              <Badge variant="outline">{t("panelNutritionRequestDetail.tracking.logPlanned")}</Badge>
                            )}
                          </div>
                          <div className="mt-2 font-black">{log.foodTitle ?? "—"}</div>
                          {String(log.quantityText ?? "").trim() !== "" ? <div className="mt-1 text-xs text-muted-foreground">{String(log.quantityText)}</div> : null}
                          {log.photoUrl ? (
                            <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-500/5 p-2">
                              <div className="mb-2 text-[11px] font-bold text-emerald-300">{t("panelNutritionRequestDetail.photoPreview.loggedForMeal")}</div>
                              <button
                                type="button"
                                onClick={() => setMealPhotoPreview({ url: log.photoUrl ?? "", title: log.foodTitle ?? t("panelNutritionRequestDetail.photoPreview.title") })}
                                className="flex w-full items-center gap-3 rounded-lg text-start transition hover:bg-white/5"
                              >
                                <img src={log.photoUrl} alt={log.foodTitle ?? t("panelNutritionRequestDetail.photoPreview.title")} className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/10" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 text-xs font-bold text-white">
                                    <ImageIcon className="h-3.5 w-3.5 text-emerald-300" />
                                    {t("panelNutritionRequestDetail.photoPreview.viewLarge")}
                                  </div>
                                  <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{t("panelNutritionRequestDetail.photoPreview.viewLargeHint")}</div>
                                </div>
                              </button>
                            </div>
                          ) : null}
                          {formatManualMetaText(log.foodDescription, t) !== "" ? <div className="mt-2 leading-7">{formatManualMetaText(log.foodDescription, t)}</div> : null}
                          {formatManualMetaText(log.notes, t) !== "" ? <div className="mt-2 text-xs leading-6 text-muted-foreground">{formatManualMetaText(log.notes, t)}</div> : null}
                        </div>
                      )) : (
                        <div className="rounded-xl border border-dashed border-border/70 bg-background/30 px-3 py-6 text-center text-sm text-muted-foreground lg:col-span-2">
                          {t("panelNutritionRequestDetail.tracking.noConsumptionForDay")}
                        </div>
                      )}
                    </div>

                    <div className="my-4 h-px bg-border/70" />

                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
                          <Dumbbell className="h-4 w-4" />
                          {t("panelNutritionRequestDetail.tracking.exercises")}
                        </div>
                        <Badge variant="outline" className="gap-1">
                          <Flame className="h-3.5 w-3.5" />
                          {formatCalories(Number(exerciseLogs.reduce((sum, log) => sum + Number(log.caloriesBurned ?? 0), 0)))}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        {exerciseLogs.length ? exerciseLogs.map((log) => (
                          <div key={log.id} className="rounded-xl border border-border/70 bg-background/50 px-3 py-3 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-bold">{log.title ?? t("panelNutritionRequestDetail.tracking.defaultExercise")}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{log.groupTitle ?? t("panelNutritionRequestDetail.exercise.defaultGroup")} | {t("panelNutritionRequestDetail.exercise.intensity", { value: exerciseIntensityLabel(log.intensity, t) })}</div>
                              </div>
                              <Badge variant="secondary">{formatCalories(Number(log.caloriesBurned ?? 0))}</Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                              <span>{formatMinutes(Number(log.durationMinutes ?? 0))}</span>
                              {log.speedKmh ? <span>{t("panelNutritionRequestDetail.tracking.speed", { value: formatSpeed(Number(log.speedKmh)) })}</span> : null}
                              {log.distanceKm ? <span>{t("panelNutritionRequestDetail.tracking.distance", { value: formatDistance(Number(log.distanceKm)) })}</span> : null}
                              {log.weightKg ? <span>{t("panelNutritionRequestDetail.tracking.weight", { value: formatWeight(Number(log.weightKg)) })}</span> : null}
                            </div>
                            {String(log.notes ?? "").trim() !== "" ? <div className="mt-2 text-xs leading-6 text-muted-foreground">{String(log.notes)}</div> : null}
                          </div>
                        )) : (
                          <div className="rounded-xl border border-dashed border-border/70 bg-background/30 px-3 py-6 text-center text-sm text-muted-foreground lg:col-span-2">
                            {t("panelNutritionRequestDetail.tracking.noExerciseForDay")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("panelNutritionRequestDetail.tracking.noConsumption")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        ) : null}
        {!shouldShowMealReplacementSummary && !(item.requestType === "ai" && !isExpertFilePrescription && !manualApprovalPending) ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#111827]/70 p-5 text-sm leading-7 text-slate-400">
            {t("panelNutritionRequestDetail.tracking.noTrackingData")}
          </div>
        ) : null}
          </div>
        ) : null}

        {activeDetailSection === "diet" ? (
          <div className="space-y-4">
        {currentPrescriptionContent && !isExpertFilePrescription ? (
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-primary" />
                {t("panelNutritionRequestDetail.dietDetails.title")}
              </CardTitle>
              <CardDescription>{t("panelNutritionRequestDetail.dietDetails.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {item?.currentPrescription?.prescriptionMode === "user_choice" ? (
                <div className="space-y-3">
                  {asArray(currentPrescriptionContent.meal_slots).map((slotValue, index) => {
                    const slot = asRecord(slotValue);
                    return (
                      <div key={`slot-${index}`} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-black">{String(slot.title ?? t("panelNutritionRequestDetail.dietDetails.defaultMeal"))}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{String(slot.description ?? "")}</div>
                          </div>
                          <div className="text-xs font-bold text-emerald-500">{formatCalories(Number(slot.target_calories ?? 0))}</div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {asArray(slot.options).map((optionValue, optionIndex) => {
                            const option = asRecord(optionValue);
                            return (
                              <div key={`option-${optionIndex}`} className="rounded-xl border border-border/70 bg-background/50 px-3 py-3 text-sm">
                                <div className="flex items-start justify-between gap-3">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0 rounded-xl border border-border/70 bg-background/60"
                                    onClick={() => openUserChoiceEdit(String(slot.slot_key ?? ""), optionIndex, option)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <div className="flex-1 text-start">
                                    <div className="font-bold">{String(option.title ?? t("panelNutritionRequestDetail.dietDetails.defaultFood"))}</div>
                                    <div className="mt-1 leading-7">{String(option.description ?? "")}</div>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                      {String(option.quantity_text ?? "")}
                                      {Number(option.grams ?? 0) > 0 ? ` (${formatGrams(Number(option.grams))})` : ""}
                                      {Number(option.calories ?? 0) > 0 ? ` | ${formatCalories(Number(option.calories))}` : ""}
                                    </div>
                                    {compactMacroItems(option, t).length ? (
                                      <div className="mt-2 flex flex-wrap justify-start gap-1.5">
                                        {compactMacroItems(option, t).map((macro) => (
                                          <span key={`${macro.key}-${optionIndex}`} className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                            {macro.label} {formatNumber(macro.value, 1)}g
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {item?.currentPrescription?.prescriptionMode === "daily_prescription" ? (
                <div className="space-y-3">
                  {asArray(currentPrescriptionContent.day_plans).map((planValue, index) => {
                    const plan = asRecord(planValue);
                    return (
                      <div key={`plan-${index}`} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-black">{String(plan.day_label ?? t("panelNutritionRequestDetail.dietDetails.dayNumber", { number: formatNumber(index + 1) }))}</div>
                          <div className="text-xs font-bold text-emerald-500">{formatCalories(Number(plan.day_total_calories ?? 0))}</div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {asArray(plan.meals).map((mealValue, mealIndex) => {
                            const meal = asRecord(mealValue);
                            return (
                              <div key={`meal-${mealIndex}`} className="rounded-xl border border-border/70 bg-background/50 px-3 py-3 text-sm">
                                <div className="flex items-start justify-between gap-3">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0 rounded-xl border border-border/70 bg-background/60"
                                    onClick={() => openDailyMealEdit(Number(plan.day_number ?? index + 1), mealIndex, meal)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <div className="flex-1 text-start">
                                    <div className="font-bold">{String(meal.title ?? t("panelNutritionRequestDetail.dietDetails.defaultMeal"))}</div>
                                    <div className="mt-1 leading-7">{String(meal.meal_text ?? "")}</div>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                      {Number(meal.grams ?? 0) > 0 ? `${formatGrams(Number(meal.grams))} | ` : ""}
                                      {formatCalories(Number(meal.calories ?? 0))}
                                    </div>
                                    {compactMacroItems(meal, t).length ? (
                                      <div className="mt-2 flex flex-wrap justify-start gap-1.5">
                                        {compactMacroItems(meal, t).map((macro) => (
                                          <span key={`${macro.key}-${mealIndex}`} className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                            {macro.label} {formatNumber(macro.value, 1)}g
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                                {asArray(meal.replacements).length ? (
                                  <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                                    {asArray(meal.replacements).map((replacementValue, replacementIndex) => {
                                      const replacement = asRecord(replacementValue);
                                      return (
                                        <div key={`replacement-${replacementIndex}`} className="rounded-lg border border-dashed border-border/60 bg-background/30 px-3 py-3">
                                          <div className="flex items-start justify-between gap-3">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 shrink-0 rounded-lg border border-border/60 bg-background/60"
                                              onClick={() => openReplacementEdit(Number(plan.day_number ?? index + 1), mealIndex, replacementIndex, replacement)}
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <div className="flex-1 text-start">
                                              <div className="font-semibold">{String(replacement.title ?? t("panelNutritionRequestDetail.dietDetails.defaultReplacement"))}</div>
                                              <div className="mt-1 leading-7">{String(replacement.description ?? "")}</div>
                                              <div className="mt-2 text-xs text-muted-foreground">
                                                {String(replacement.quantity_text ?? "")}
                                                {Number(replacement.grams ?? 0) > 0 ? ` (${formatGrams(Number(replacement.grams))})` : ""}
                                                {Number(replacement.calories ?? 0) > 0 ? ` | ${formatCalories(Number(replacement.calories))}` : ""}
                                              </div>
                                              {compactMacroItems(replacement, t).length ? (
                                                <div className="mt-2 flex flex-wrap justify-start gap-1.5">
                                                  {compactMacroItems(replacement, t).map((macro) => (
                                                    <span key={`${macro.key}-${replacementIndex}`} className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                                      {macro.label} {formatNumber(macro.value, 1)}g
                                                    </span>
                                                  ))}
                                                </div>
                                              ) : null}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {item?.currentPrescription?.prescriptionMode === "fixed_text" ? (
                <div className="space-y-3">
                  {asArray(currentPrescriptionContent.text_sections).map((sectionValue, index) => {
                    const section = asRecord(sectionValue);
                    return (
                      <div key={`section-${index}`} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-xl border border-border/70 bg-background/60"
                            onClick={() => openFixedTextEdit(index, section)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <div className="flex-1 text-start">
                            <div className="font-black">{String(section.title ?? t("panelNutritionRequestDetail.dietDetails.defaultDescription"))}</div>
                            <div className="mt-2 leading-8">{String(section.body ?? "")}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {item.currentPrescription ? (
          <Card className="border-sky-400/20 bg-sky-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-sky-400" />
                {t("panelNutritionRequestDetail.viewerMessage.title")}
              </CardTitle>
              <CardDescription>
                {t("panelNutritionRequestDetail.viewerMessage.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="viewer-message">{t("panelNutritionRequestDetail.viewerMessage.messageText")}</Label>
                <Textarea
                  id="viewer-message"
                  value={viewerMessageBody}
                  onChange={(e) => setViewerMessageBody(e.target.value)}
                  className="min-h-28 leading-8"
                  placeholder={t("panelNutritionRequestDetail.viewerMessage.messagePlaceholder")}
                />
              </div>
              <Button type="button" onClick={saveViewerMessage} disabled={manualEditSaving} className="rounded-2xl px-6">
                {manualEditSaving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="me-2 h-4 w-4" />}
                {t("panelNutritionRequestDetail.viewerMessage.save")}
              </Button>
            </CardContent>
          </Card>
        ) : null}
          </div>
        ) : null}

        {activeDetailSection === "ai" ? (
          <div className="space-y-4">
        {item.askAiEnabled ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                {t("panelNutritionRequestDetail.aiInput.title")}
              </CardTitle>
              <CardDescription>{t("panelNutritionRequestDetail.aiInput.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expertNotes">{t("panelNutritionRequestDetail.aiInput.expertNotes")}</Label>
                  <Textarea id="expertNotes" value={draft.expertNotes} onChange={(e) => setDraft((current) => ({ ...current, expertNotes: e.target.value }))} className="min-h-28 leading-7" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinicalNotes">{t("panelNutritionRequestDetail.aiInput.clinicalNotes")}</Label>
                  <Textarea id="clinicalNotes" value={draft.clinicalNotes} onChange={(e) => setDraft((current) => ({ ...current, clinicalNotes: e.target.value }))} className="min-h-28 leading-7" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="generationInstructions">{t("panelNutritionRequestDetail.aiInput.generationInstructions")}</Label>
                <div className="flex justify-start">
                  <Button type="button" variant="outline" className="rounded-[14px]" onClick={() => setPromptPickerOpen(true)}>
                    {t("panelNutritionRequestDetail.aiInput.usePreset")}
                  </Button>
                </div>
                <Textarea id="generationInstructions" value={draft.generationInstructions} onChange={(e) => setDraft((current) => ({ ...current, generationInstructions: e.target.value }))} className="min-h-32 leading-7" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mustInclude">{t("panelNutritionRequestDetail.aiInput.mustInclude")}</Label>
                  <Textarea id="mustInclude" value={draft.mustInclude} onChange={(e) => setDraft((current) => ({ ...current, mustInclude: e.target.value }))} className="min-h-24 leading-7" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mustAvoid">{t("panelNutritionRequestDetail.aiInput.mustAvoid")}</Label>
                  <Textarea id="mustAvoid" value={draft.mustAvoid} onChange={(e) => setDraft((current) => ({ ...current, mustAvoid: e.target.value }))} className="min-h-24 leading-7" />
                </div>
              </div>

              <Button onClick={queueGeneration} disabled={submitting || item.aiGenerationStatus === "queued" || item.aiGenerationStatus === "processing"} className="rounded-2xl px-6">
                {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Sparkles className="me-2 h-4 w-4" />}
                {item.currentPrescription ? t("panelNutritionRequestDetail.aiInput.reviseWithAi") : t("panelNutritionRequestDetail.aiInput.sendToAi")}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {item.requestType === "ai" ? (
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5 text-primary" />
                {t("panelNutritionRequestDetail.rawData.title")}
              </CardTitle>
              <CardDescription>{t("panelNutritionRequestDetail.rawData.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="space-y-3">
                <AccordionItem value="profile" className="rounded-2xl border border-border/70 bg-background/30 px-4">
                  <AccordionTrigger className="text-start font-bold">{t("panelNutritionRequestDetail.rawData.profileSnapshot")}</AccordionTrigger>
                  <AccordionContent>
                    <pre className="overflow-x-auto rounded-2xl bg-slate-950/80 p-4 text-xs leading-7 text-slate-100">{jsonBlock(item.profileSnapshot)}</pre>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="template" className="rounded-2xl border border-border/70 bg-background/30 px-4">
                  <AccordionTrigger className="text-start font-bold">{t("panelNutritionRequestDetail.rawData.templateSnapshot")}</AccordionTrigger>
                  <AccordionContent>
                    <pre className="overflow-x-auto rounded-2xl bg-slate-950/80 p-4 text-xs leading-7 text-slate-100">{jsonBlock(item.templateSnapshot)}</pre>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="payload" className="rounded-2xl border border-border/70 bg-background/30 px-4">
                  <AccordionTrigger className="text-start font-bold">{t("panelNutritionRequestDetail.rawData.requestPayload")}</AccordionTrigger>
                  <AccordionContent>
                    <pre className="overflow-x-auto rounded-2xl bg-slate-950/80 p-4 text-xs leading-7 text-slate-100">{jsonBlock(item.requestPayloadSnapshot)}</pre>
                  </AccordionContent>
                </AccordionItem>

                {item.askAiEnabled ? (
                  <AccordionItem value="prompt" className="rounded-2xl border border-border/70 bg-background/30 px-4">
                    <AccordionTrigger className="text-start font-bold">{t("panelNutritionRequestDetail.rawData.aiPrompt")}</AccordionTrigger>
                    <AccordionContent>
                      <pre className="overflow-x-auto rounded-2xl bg-slate-950/80 p-4 text-xs leading-7 text-slate-100">{jsonBlock(item.aiPromptSnapshot)}</pre>
                    </AccordionContent>
                  </AccordionItem>
                ) : null}

                {item.askAiEnabled ? (
                  <AccordionItem value="response" className="rounded-2xl border border-border/70 bg-background/30 px-4">
                    <AccordionTrigger className="text-start font-bold">{t("panelNutritionRequestDetail.rawData.aiResponse")}</AccordionTrigger>
                    <AccordionContent>
                      <pre className="overflow-x-auto rounded-2xl bg-slate-950/80 p-4 text-xs leading-7 text-slate-100">{jsonBlock(item.aiResponseSnapshot)}</pre>
                    </AccordionContent>
                  </AccordionItem>
                ) : null}
              </Accordion>
            </CardContent>
          </Card>
        ) : null}
          </div>
        ) : null}

        <section className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
          <Link href="/panel/nutrition/requests">
            <Button type="button" variant="outline" className="h-11 rounded-2xl border-white/10 bg-white/5 px-5 text-white hover:bg-white/10">
              {t("panelNutritionRequestDetail.footer.backToRequests")}
            </Button>
          </Link>
          <Link href="/panel/nutrition">
            <Button type="button" variant="outline" className="h-11 rounded-2xl border-white/10 bg-white/5 px-5 text-white hover:bg-white/10">
              {t("panelNutritionRequestDetail.footer.backToPanel")}
            </Button>
          </Link>
          {item.user?.mobile ? (
            <Link href={`/panel/nutrition/prescribe/users/${encodeURIComponent(item.user.mobile)}`}>
              <Button type="button" className="h-11 rounded-2xl px-5">
                {t("panelNutritionRequestDetail.footer.prescribeDiet")}
              </Button>
            </Link>
          ) : null}
        </section>
        </section>
      </main>

      <Dialog open={Boolean(prescriptionDateDraft)} onOpenChange={(open) => {
        if (!open) {
          setPrescriptionDateDraft(null);
        }
      }}>
        <DialogContent dir={dir} className="border-border/80 bg-card text-foreground sm:max-w-xl">
          <DialogHeader className="text-start">
            <DialogTitle>{t("panelNutritionRequestDetail.dateDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("panelNutritionRequestDetail.dateDialog.description")}
            </DialogDescription>
          </DialogHeader>

          {prescriptionDateDraft ? (
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("panelNutritionRequestDetail.dateDialog.startedAt")}</Label>
                <DatePicker
                  value={prescriptionDateDraft.startedAt ? toSafeGregorianDate(prescriptionDateDraft.startedAt) : undefined}
                  onChange={(value) => {
                    const date = value as DateObject | null;
                    if (!date) {
                      return;
                    }

                    setPrescriptionDateDraft((current) => current ? {
                      ...current,
                      startedAt: format(date.toDate(), "yyyy-MM-dd"),
                    } : current);
                  }}
                  calendar={persian}
                  locale={persian_fa}
                  format="YYYY/MM/DD"
                  className="bg-card w-full"
                  inputClass="bg-background border border-border rounded-2xl p-3 w-full text-center"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("panelNutritionRequestDetail.dateDialog.endsAt")}</Label>
                <DatePicker
                  value={prescriptionDateDraft.endsAt ? toSafeGregorianDate(prescriptionDateDraft.endsAt) : undefined}
                  onChange={(value) => {
                    const date = value as DateObject | null;
                    if (!date) {
                      return;
                    }

                    setPrescriptionDateDraft((current) => current ? {
                      ...current,
                      endsAt: format(date.toDate(), "yyyy-MM-dd"),
                    } : current);
                  }}
                  calendar={persian}
                  locale={persian_fa}
                  format="YYYY/MM/DD"
                  className="bg-card w-full"
                  inputClass="bg-background border border-border rounded-2xl p-3 w-full text-center"
                />
              </div>
              {!isPrescriptionDateDraftValid ? (
                <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 sm:col-span-2">
                  {t("panelNutritionRequestDetail.dateDialog.invalidRange")}
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              type="button"
              onClick={() => void savePrescriptionDates()}
              disabled={submitting || !isPrescriptionDateDraftValid}
              className="rounded-2xl px-6"
            >
              {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="me-2 h-4 w-4" />}
              {t("panelNutritionRequestDetail.dateDialog.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPrescriptionDateDraft(null)}
              disabled={submitting}
              className="rounded-2xl"
            >
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revisionModalOpen} onOpenChange={(open) => {
        if (!open && isRevisionPending) {
          setDismissedRevisionModal(true);
        }

        if (open) {
          setDismissedRevisionModal(false);
        }

        setRevisionModalOpen(open);
      }}>
        <DialogContent dir={dir} className="overflow-hidden border-amber-400/20 bg-[linear-gradient(165deg,rgba(17,24,39,0.98),rgba(9,14,25,0.97))] text-white sm:max-w-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_40%)]" />
          <DialogHeader className="relative z-10 text-start">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/5 shadow-[0_30px_80px_-40px_rgba(251,191,36,0.55)]">
              <div className="relative">
                <Orbit className="h-10 w-10 animate-spin text-amber-300" />
                <Sparkles className="absolute -top-2 end-[-0.5rem] h-4 w-4 text-cyan-300" />
              </div>
            </div>
            <DialogTitle className="mt-4 text-center text-2xl font-black">
              {item?.currentPrescription ? t("panelNutritionRequestDetail.aiModal.revisingTitle") : t("panelNutritionRequestDetail.aiModal.generatingTitle")}
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-8 text-slate-300">
              {t("panelNutritionRequestDetail.aiModal.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="relative z-10 mt-2 space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-white">{t("panelNutritionRequestDetail.aiModal.currentStatus")}</div>
                  <div className="mt-1 text-xs leading-6 text-slate-400">
                    {item?.aiGenerationStatus === "queued"
                      ? t("panelNutritionRequestDetail.aiModal.statusQueued")
                      : item?.aiGenerationStatus === "processing"
                      ? t("panelNutritionRequestDetail.aiModal.statusProcessing")
                      : t("panelNutritionRequestDetail.aiModal.statusSyncing")}
                  </div>
                </div>
                <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">
                  {item?.aiGenerationStatusLabel ?? t("panelNutritionRequestDetail.aiModal.inProgress")}
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#f59e0b,#fbbf24,#67e8f9)]" />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[11px] text-slate-400">{t("panelNutritionRequestDetail.aiModal.request")}</div>
                  <div className="mt-1 text-sm font-black text-white">#{item?.id ?? "—"}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[11px] text-slate-400">{t("panelNutritionRequestDetail.aiModal.currentVersion")}</div>
                  <div className="mt-1 text-sm font-black text-white">{item?.currentPrescription ? t("panelNutritionRequestDetail.aiModal.versionNumber", { id: item.currentPrescription.id }) : t("panelNutritionRequestDetail.aiModal.firstVersion")}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[11px] text-slate-400">{t("panelNutritionRequestDetail.aiModal.template")}</div>
                  <div className="mt-1 text-sm font-black text-white">{item?.dietTemplateName ?? "—"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-cyan-400/15 bg-cyan-400/5 p-4 text-sm leading-8 text-cyan-100/90">
              {t("panelNutritionRequestDetail.aiModal.notice")}
            </div>
          </div>

          <DialogFooter className="relative z-10 gap-2 sm:justify-start">
            <Button
              type="button"
              variant="outline"
              onClick={cancelRevision}
              disabled={cancellingRevision}
              className="rounded-2xl border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
            >
              {cancellingRevision ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <XCircle className="me-2 h-4 w-4" />}
              {t("panelNutritionRequestDetail.aiModal.cancelRequest")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDismissedRevisionModal(true);
                setRevisionModalOpen(false);
              }}
              className="rounded-2xl text-slate-300 hover:bg-white/5 hover:text-white"
            >
              {t("common.close")}
            </Button>
            <div className="text-xs leading-7 text-slate-400">
              {t("panelNutritionRequestDetail.aiModal.footerHint")}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NutritionAiPromptPicker
        open={promptPickerOpen}
        onOpenChange={setPromptPickerOpen}
        onSelect={(preset) => {
          setDraft((current) => ({
            ...current,
            generationInstructions: preset.body,
          }));
        }}
      />

      <Dialog open={manualEditOpen} onOpenChange={setManualEditOpen}>
        <DialogContent dir={dir} className="border-border/80 bg-card text-foreground sm:max-w-2xl">
          <DialogHeader className="text-start">
            <DialogTitle>{manualEditDraft?.heading ?? t("panelNutritionRequestDetail.manualEdit.title")}</DialogTitle>
            <DialogDescription>
              {t("panelNutritionRequestDetail.manualEdit.description")}
            </DialogDescription>
          </DialogHeader>

          {manualEditDraft ? (
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="manual-title">{t("panelNutritionRequestDetail.manualEdit.field.title")}</Label>
                <Textarea
                  id="manual-title"
                  value={manualEditDraft.title}
                  onChange={(e) => setManualEditDraft((current) => current ? { ...current, title: e.target.value } : current)}
                  className="min-h-20 leading-7"
                />
              </div>

              {manualEditDraft.sectionType === "fixed_text_section" ? (
                <div className="space-y-2">
                  <Label htmlFor="manual-body">{t("panelNutritionRequestDetail.manualEdit.field.body")}</Label>
                  <Textarea
                    id="manual-body"
                    value={manualEditDraft.body}
                    onChange={(e) => setManualEditDraft((current) => current ? { ...current, body: e.target.value } : current)}
                    className="min-h-40 leading-8"
                  />
                </div>
              ) : manualEditDraft.sectionType === "daily_meal" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="manual-meal-text">{t("panelNutritionRequestDetail.manualEdit.field.mealText")}</Label>
                    <Textarea
                      id="manual-meal-text"
                      value={manualEditDraft.mealText}
                      onChange={(e) => setManualEditDraft((current) => current ? { ...current, mealText: e.target.value } : current)}
                      className="min-h-32 leading-8"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="manual-grams">{t("panelNutritionRequestDetail.manualEdit.field.grams")}</Label>
                      <Input
                        id="manual-grams"
                        value={manualEditDraft.grams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, grams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-calories">{t("panelNutritionRequestDetail.manualEdit.field.calories")}</Label>
                      <Input
                        id="manual-calories"
                        value={manualEditDraft.calories}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, calories: e.target.value } : current)}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="manual-protein">{t("panelNutritionRequestDetail.macro.protein")}</Label>
                      <Input
                        id="manual-protein"
                        value={manualEditDraft.proteinGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, proteinGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-carb">{t("panelNutritionRequestDetail.macro.carbohydrate")}</Label>
                      <Input
                        id="manual-carb"
                        value={manualEditDraft.carbohydrateGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, carbohydrateGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-fat">{t("panelNutritionRequestDetail.macro.fat")}</Label>
                      <Input
                        id="manual-fat"
                        value={manualEditDraft.fatGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, fatGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-fiber">{t("panelNutritionRequestDetail.macro.fiber")}</Label>
                      <Input
                        id="manual-fiber"
                        value={manualEditDraft.fiberGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, fiberGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="manual-description">{t("panelNutritionRequestDetail.manualEdit.field.description")}</Label>
                    <Textarea
                      id="manual-description"
                      value={manualEditDraft.description}
                      onChange={(e) => setManualEditDraft((current) => current ? { ...current, description: e.target.value } : current)}
                      className="min-h-28 leading-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-quantity">{t("panelNutritionRequestDetail.manualEdit.field.quantityText")}</Label>
                    <Textarea
                      id="manual-quantity"
                      value={manualEditDraft.quantityText}
                      onChange={(e) => setManualEditDraft((current) => current ? { ...current, quantityText: e.target.value } : current)}
                      className="min-h-20 leading-7"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="manual-grams">{t("panelNutritionRequestDetail.manualEdit.field.grams")}</Label>
                      <Input
                        id="manual-grams"
                        value={manualEditDraft.grams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, grams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-calories">{t("panelNutritionRequestDetail.manualEdit.field.calories")}</Label>
                      <Input
                        id="manual-calories"
                        value={manualEditDraft.calories}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, calories: e.target.value } : current)}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="manual-protein">{t("panelNutritionRequestDetail.macro.protein")}</Label>
                      <Input
                        id="manual-protein"
                        value={manualEditDraft.proteinGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, proteinGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-carb">{t("panelNutritionRequestDetail.macro.carbohydrate")}</Label>
                      <Input
                        id="manual-carb"
                        value={manualEditDraft.carbohydrateGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, carbohydrateGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-fat">{t("panelNutritionRequestDetail.macro.fat")}</Label>
                      <Input
                        id="manual-fat"
                        value={manualEditDraft.fatGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, fatGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-fiber">{t("panelNutritionRequestDetail.macro.fiber")}</Label>
                      <Input
                        id="manual-fiber"
                        value={manualEditDraft.fiberGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, fiberGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="button" onClick={submitManualEdit} disabled={!manualEditDraft || manualEditSaving} className="rounded-2xl px-6">
              {manualEditSaving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Pencil className="me-2 h-4 w-4" />}
              {t("panelNutritionRequestDetail.manualEdit.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setManualEditOpen(false);
                setManualEditDraft(null);
              }}
              className="rounded-2xl"
            >
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(mealPhotoPreview)} onOpenChange={(open) => !open && setMealPhotoPreview(null)}>
        <DialogContent dir={dir} className="max-w-3xl border-border/70 bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>{mealPhotoPreview?.title ?? t("panelNutritionRequestDetail.photoPreview.title")}</DialogTitle>
            <DialogDescription>{t("panelNutritionRequestDetail.photoPreview.description")}</DialogDescription>
          </DialogHeader>
          {mealPhotoPreview?.url ? (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-black/20">
              <img src={mealPhotoPreview.url} alt={mealPhotoPreview.title ?? t("panelNutritionRequestDetail.photoPreview.title")} className="max-h-[75vh] w-full object-contain" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
