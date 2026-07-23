import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowRight, BadgeCheck, BrainCircuit, CalendarClock, Coins, Download, Dumbbell, FileArchive, FileJson, Flame, ImageIcon, Loader2, Orbit, Pencil, Search, ShieldAlert, Sparkles, UploadCloud, UserRound, UtensilsCrossed, Wand2, XCircle } from "lucide-react";
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

const MODE_LABELS: Record<string, string> = {
  daily_prescription: "تجویز روزانه",
  user_choice: "انتخاب وعده توسط کاربر",
  fixed_text: "تجویز متن ثابت",
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("fa-IR") : "—");
const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const formatMedicalConditionStatus = (value?: string | null) =>
  value === "past" ? "قبلی" : value === "temporary" ? "موقت" : "فعلی";

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

function mealSlotLabel(slotKey?: string | null) {
  switch ((slotKey ?? "").trim()) {
    case "breakfast":
      return "صبحانه";
    case "lunch":
      return "ناهار";
    case "dinner":
      return "شام";
    case "snack":
      return "میان وعده";
    default:
      return slotKey || "وعده";
  }
}

function formatManualMetaText(value: unknown) {
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
        return `وعده: ${mealSlotLabel(part.slice(5).trim())}`;
      }
      if (part.startsWith("note:replacement:")) {
        return `غذای جایگزین به‌جای: ${part.slice("note:replacement:".length).trim()}`;
      }
      if (part.startsWith("note:manual:")) {
        return `یادداشت: ${part.slice("note:manual:".length).trim()}`;
      }
      if (part.startsWith("note:")) {
        return `یادداشت: ${part.slice(5).trim()}`;
      }
      if (part.startsWith("manual:")) {
        return `ثبت دستی: ${part.slice(7).trim()}`;
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

function compactMacroItems(source: Record<string, unknown>) {
  const items = [
    { key: "protein", label: "پروتئین", value: Number(source.protein_grams ?? 0) },
    { key: "carb", label: "کربو", value: Number(source.carbohydrate_grams ?? 0) },
    { key: "fat", label: "چربی", value: Number(source.fat_grams ?? 0) },
    { key: "fiber", label: "فیبر", value: Number(source.fiber_grams ?? 0) },
  ];

  return items.filter((item) => Number.isFinite(item.value) && item.value > 0);
}

function exerciseIntensityLabel(value?: string | null) {
  switch (value) {
    case "light":
      return "سبک";
    case "vigorous":
      return "شدید";
    case "moderate":
    default:
      return "متوسط";
  }
}


export default function PanelNutritionRequestDetailPage() {
  const { isAdmin, isLoading, user } = useAuth();
  const { toast } = useToast();
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

  const requestId = match ? params.requestId : null;
  const userProfileHref = item?.user?.mobile
    ? `/panel/nutrition/prescribe/users/${encodeURIComponent(item.user.mobile)}?returnTo=${encodeURIComponent(`/panel/nutrition/requests/${item.id}`)}`
    : "";
  const isRevisionPending = item?.aiGenerationStatus === "queued" || item?.aiGenerationStatus === "processing";
  const currentExpertFile = item?.currentPrescription?.expertFile ?? null;
  const isExpertFilePrescription = item?.currentPrescription?.deliveryChannel === "expert_file" || Boolean(currentExpertFile);
  const manualApprovalPending = Boolean(item?.manualApprovalPending);
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

  const formatAiLimitValue = (value?: number | null) => value == null ? "نامحدود" : value.toLocaleString("fa-IR");

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
      toast({ title: "محدودیت AI ذخیره شد", description: result.message });
    } else {
      toast({ variant: "destructive", title: "ذخیره محدودیت انجام نشد", description: result.message });
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
      toast({ title: "تاریخ رژیم ذخیره شد", description: result.message });
    } else {
      toast({ variant: "destructive", title: "ویرایش تاریخ انجام نشد", description: result.message });
    }
  };

  const openUserChoiceEdit = useCallback((slotKey: string, optionIndex: number, option: Record<string, unknown>) => {
    if (!item?.currentPrescription) {
      return;
    }

    setManualEditDraft({
      prescriptionId: Number(item.currentPrescription.id),
      sectionType: "user_choice_option",
      heading: "ویرایش آیتم وعده",
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
  }, [item?.currentPrescription]);

  const openDailyMealEdit = useCallback((dayNumber: number, mealIndex: number, meal: Record<string, unknown>) => {
    if (!item?.currentPrescription) {
      return;
    }

    setManualEditDraft({
      prescriptionId: Number(item.currentPrescription.id),
      sectionType: "daily_meal",
      heading: `ویرایش وعده روز ${dayNumber.toLocaleString("fa-IR")}`,
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
  }, [item?.currentPrescription]);

  const openReplacementEdit = useCallback((dayNumber: number, mealIndex: number, replacementIndex: number, replacement: Record<string, unknown>) => {
    if (!item?.currentPrescription) {
      return;
    }

    setManualEditDraft({
      prescriptionId: Number(item.currentPrescription.id),
      sectionType: "daily_replacement",
      heading: `ویرایش جایگزین وعده روز ${dayNumber.toLocaleString("fa-IR")}`,
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
  }, [item?.currentPrescription]);

  const openFixedTextEdit = useCallback((sectionIndex: number, section: Record<string, unknown>) => {
    if (!item?.currentPrescription) {
      return;
    }

    setManualEditDraft({
      prescriptionId: Number(item.currentPrescription.id),
      sectionType: "fixed_text_section",
      heading: "ویرایش متن ثابت رژیم",
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
  }, [item?.currentPrescription]);

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
      toast({ variant: "destructive", title: "بارگذاری جزئیات انجام نشد", description: result.message });
    }

    if (!options?.silent) {
      setLoading(false);
    }
  }, [requestId, toast]);

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
        aiGenerationStatusLabel: (result.data.aiGenerationStatus ?? "queued") === "processing" ? "در حال تولید" : "در صف",
        aiGenerationError: null,
      } : current);
      setRevisionModalOpen(true);
      toast({ title: item.currentPrescription ? "اصلاح نسخه شروع شد" : "در صف قرار گرفت", description: item.currentPrescription ? "نسخه فعلی برای بازتولید هوشمند به AI ارسال شد." : "درخواست تولید رژیم با AI ثبت شد و job آن ارسال شد." });
      await load({ silent: true });
    } else {
      toast({ variant: "destructive", title: "ارسال به AI انجام نشد", description: result.message || "درخواست در صف قرار نگرفت." });
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
      toast({ title: "درخواست لغو شد", description: "فرآیند اصلاح رژیم با AI متوقف شد." });
      await load({ silent: true });
    } else {
      toast({ variant: "destructive", title: "لغو انجام نشد", description: result.message || "درخواست لغو نشد." });
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
      toast({ title: "آیتم رژیم ویرایش شد", description: "تغییرات دستی روی همان نسخه فعلی ذخیره شد." });
    } else {
      toast({ variant: "destructive", title: "ویرایش ذخیره نشد", description: result.message || "ثبت تغییرات دستی انجام نشد." });
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
      title: String(viewerMessage.title ?? "پیام کارشناس شما"),
      body: viewerMessageBody,
    });

    if (result.success) {
      setItem(result.data.item);
      toast({
        title: viewerMessageBody.trim() !== "" ? "پیام کارشناس ذخیره شد" : "پیام کارشناس حذف شد",
        description: viewerMessageBody.trim() !== ""
          ? "این پیام از این به بعد در صفحه کاربر نمایش داده می‌شود."
          : "چون متنی ثبت نشده بود، باکس پیام برای کاربر نمایش داده نخواهد شد.",
      });
    } else {
      toast({ variant: "destructive", title: "ذخیره پیام انجام نشد", description: result.message || "پیام ثابت کارشناس ذخیره نشد." });
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
        title: "ارسال رژیم تایید شد",
        description: "رژیم برای کاربر منتشر شد و تاریخ شروع و پایان از امروز تنظیم شد.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "تایید ارسال انجام نشد",
        description: result.message || "لطفاً دوباره تلاش کنید.",
      });
    }

    setApprovingDelivery(false);
  };

  const sendExpertFile = async () => {
    if (!item) {
      return;
    }

    if (expertFileDraft.source === "library" && !expertFileDraft.selectedDietFileId) {
      toast({ variant: "destructive", title: "فایل آماده انتخاب نشده", description: "یکی از فایل‌های آماده رژیم را انتخاب کنید." });
      return;
    }

    if (expertFileDraft.source === "upload" && !expertFileDraft.file) {
      toast({ variant: "destructive", title: "فایل انتخاب نشده", description: "برای ارسال رژیم اختصاصی، فایل را از کامپیوتر انتخاب کنید." });
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
      toast({ title: "فایل رژیم ارسال شد", description: "نسخه اختصاصی فایل‌محور برای کاربر منتشر شد." });
    } else {
      toast({ variant: "destructive", title: "ارسال فایل انجام نشد", description: result.message || "دوباره تلاش کنید." });
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
      toast({ title: "فایل رژیم حذف شد", description: result.message || "درخواست دوباره آماده ارسال فایل است." });
    } else {
      toast({ variant: "destructive", title: "حذف فایل انجام نشد", description: result.message || "دوباره تلاش کنید." });
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
      toast({ title: "رژیم به‌روزرسانی شد", description: "اصلاح رژیم با AI انجام شد و همان نسخه فعلی ویرایش شد." });
      return;
    }

    if (item.aiGenerationStatus === "failed") {
      setDismissedRevisionModal(false);
      setRevisionModalOpen(false);
      toast({ variant: "destructive", title: "اصلاح رژیم ناموفق بود", description: item.aiGenerationError || "AI نتوانست نسخه اصلاح‌شده را تولید کند." });
      return;
    }

    if (item.aiGenerationStatus === "cancelled") {
      setDismissedRevisionModal(false);
      setRevisionModalOpen(false);
    }
  }, [item, revisionModalOpen, toast]);

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
      adherenceLevel: "پایبندی به رژیم قبلی",
      weightOutcome: "نتیجه وزنی",
      sizeChange: "تغییر سایز",
      energyLevel: "سطح انرژی",
      satietyLevel: "احساس سیری",
      cravingsLevel: "هوس و ریزه‌خواری",
      sleepQuality: "کیفیت خواب",
      activityLevel: "فعالیت بدنی",
      dietDifficulty: "سختی رژیم قبلی",
      overallSatisfaction: "رضایت کلی",
      newDietPreference: "ترجیح برای رژیم جدید",
      experiencedIssue: "مشکل خاص",
      foodPreference: "ترجیح غذایی",
    };

    if (typeof currentWeightKg === "number" || typeof currentWeightKg === "string") {
      rows.push(["وزن فعلی جدید", `${Number(currentWeightKg).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} کیلوگرم`]);
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
  }, [item?.requestPayloadSnapshot]);

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
      ["نوع درخواست", item.requestTypeLabel],
      ["نوع تجویز", MODE_LABELS[item.prescriptionMode ?? ""] ?? "—"],
      ["وضعیت درخواست", item.statusLabel],
      ["وضعیت AI", item.aiGenerationStatusLabel ?? "ثبت نشده"],
      ["نیاز به تایید دستی", item.requiresManualApproval ? "بله" : "خیر"],
      ["تاریخ تایید مدیریت", item.manualApprovedAt ? formatDateTime(item.manualApprovedAt) : "—"],
      ["کاربر", `${item.user?.name || "—"} | ${item.user?.mobile || "—"}`],
      ["پکیج", item.subscription?.packageName ?? "—"],
      ["شروع", formatDate(item.startedAt)],
      ["پایان", formatDate(item.endsAt)],
      ["ثبت درخواست", formatDateTime(item.createdAt)],
      ["ارسال job", formatDateTime(item.aiJobDispatchedAt)],
      ["تولید AI", formatDateTime(item.aiGeneratedAt)],
      ["وزن فعلی", item.currentWeightKg !== null && item.currentWeightKg !== undefined ? `${item.currentWeightKg.toLocaleString("fa-IR")} کیلو` : "—"],
      ["وزن هدف", item.targetWeightKg !== null && item.targetWeightKg !== undefined ? `${item.targetWeightKg.toLocaleString("fa-IR")} کیلو` : "—"],
      ["فاصله تا وزن هدف", weightGap > 0 ? `${weightGap.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} کیلو` : "—"],
      ["سرعت کاهش / افزایش", item.weeklyWeightChangeKg !== null && item.weeklyWeightChangeKg !== undefined ? `${item.weeklyWeightChangeKg.toLocaleString("fa-IR")} کیلو در هفته` : "—"],
      ["دارو یا مکمل مصرفی", medicationsAndSupplements || "—"],
      ["حساسیت غذایی", foodAllergies || "—"],
      ["غذاهای نامطلوب", dislikedFoods || "—"],
      ["کالری پایه کاربر", baseCalories > 0 ? `${baseCalories.toLocaleString("fa-IR")} kcal` : "—"],
      ["کالری رژیم تجویز شده", prescribedCalories > 0 ? `${prescribedCalories.toLocaleString("fa-IR")} kcal` : "—"],
      ["اختلاف کالری", baseCalories > 0 && prescribedCalories > 0 ? `${calorieDelta.toLocaleString("fa-IR")} kcal` : "—"],
    ];
  }, [caloriePlan, item]);
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
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir="rtl">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          در حال بارگذاری جزئیات درخواست...
        </div>
      </div>
    );
  }

  if (!isAdmin || !item) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir="rtl">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">درخواست پیدا نشد</h1>
          <p className="leading-7 text-muted-foreground">این درخواست وجود ندارد یا شما به آن دسترسی ندارید.</p>
          <Link href="/panel/nutrition/requests">
            <Button>بازگشت به لیست درخواست‌ها</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir="rtl">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-xl font-black">جزئیات درخواست رژیم #{item.id}</h1>
          <Link href="/panel/nutrition/requests">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" />
                خلاصه درخواست
              </CardTitle>
              {userProfileHref ? (
                <Link href={userProfileHref}>
                  <Button variant="outline" className="h-10 rounded-2xl">
                    <UserRound className="ml-2 h-4 w-4" />
                    مشاهده پروفایل کاربر
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
                <div className="text-xs text-muted-foreground">بیماری‌های خاص</div>
                {medicalConditionRows.length > 0 ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/60 bg-background/50 hover:bg-background/50">
                          <TableHead className="text-right">نام بیماری</TableHead>
                          <TableHead className="text-right">شروع</TableHead>
                          <TableHead className="text-right">پایان</TableHead>
                          <TableHead className="text-right">وضعیت</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {medicalConditionRows.map((condition) => (
                          <TableRow key={condition.id} className="border-border/60">
                            <TableCell className="font-bold">{condition.title}</TableCell>
                            <TableCell>{formatDate(condition.startedAt ?? null)}</TableCell>
                            <TableCell>{condition.status === "current" || condition.ongoing ? "—" : formatDate(condition.endedAt ?? null)}</TableCell>
                            <TableCell>{formatMedicalConditionStatus(condition.status)}</TableCell>
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
                وضعیت نسخه‌ها و اشتراک
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">رژیم آنلاین</div>
                  <div className="mt-1 font-bold">
                    {(item.subscription?.onlineDietUsed ?? 0).toLocaleString("fa-IR")} / {(item.subscription?.onlineDietTotal ?? 0).toLocaleString("fa-IR")}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">رژیم اختصاصی</div>
                  <div className="mt-1 font-bold">
                    {(item.subscription?.offlineDietUsed ?? 0).toLocaleString("fa-IR")} / {(item.subscription?.offlineDietTotal ?? 0).toLocaleString("fa-IR")}
                  </div>
                </div>
              </div>

              {item.currentPrescription ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-sm font-black">تاریخ همین رژیم</div>
                      <div className="mt-1 text-xs leading-6 text-muted-foreground">
                        این تاریخ شروع و پایان نسخه‌ای است که در همین صفحه مشاهده می‌کنید.
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openPrescriptionDateEdit(item.currentPrescription!)}
                      className="rounded-2xl"
                    >
                      <Pencil className="ml-2 h-4 w-4" />
                      ویرایش تاریخ رژیم
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                      <div className="text-xs text-muted-foreground">شروع رژیم</div>
                      <div className="mt-1 font-bold">{formatPersianDate(item.currentPrescription.startedAt)}</div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                      <div className="text-xs text-muted-foreground">پایان رژیم</div>
                      <div className="mt-1 font-bold">{formatPersianDate(item.currentPrescription.endsAt)}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="text-sm font-bold">نسخه‌های صادرشده</div>
                {item.prescriptions?.length ? (
                  <div className="space-y-2">
                    {item.prescriptions.map((prescription) => (
                      <div key={prescription.id} className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-1">
                            <div className="font-bold">نسخه #{prescription.id}</div>
                            <div className="text-xs text-muted-foreground">{MODE_LABELS[prescription.prescriptionMode] ?? prescription.prescriptionMode}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {prescription.isCurrent ? <Badge variant="default">فعال</Badge> : <Badge variant="secondary">آرشیو</Badge>}
                            <Badge variant="outline">{prescription.status}</Badge>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border/60 bg-card/35 p-3">
                            <div className="text-xs text-muted-foreground">تاریخ شروع رژیم</div>
                            <div className="mt-1 font-bold">{formatPersianDate(prescription.startedAt)}</div>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-card/35 p-3">
                            <div className="text-xs text-muted-foreground">تاریخ پایان رژیم</div>
                            <div className="mt-1 font-bold">{formatPersianDate(prescription.endsAt)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 px-4 py-8 text-center text-sm text-muted-foreground">
                    هنوز نسخه‌ای برای این درخواست ثبت نشده است.
                  </div>
                )}
              </div>

              {item.aiGenerationError ? (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm leading-7 text-rose-200">
                  <div className="font-bold">خطای آخر تولید</div>
                  <div>{item.aiGenerationError}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        {item.requestType === "ai" && tokenBreakdown ? (
          <Card className="border-amber-400/20 bg-amber-500/[0.04]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-300" />
                مصرف توکن همین رژیم / AI
              </CardTitle>
              <CardDescription>
                این بخش فقط مصرف توکن‌های همین درخواست رژیم را نشان می‌دهد؛ از تولید اولیه تا ویرایش، جایگزینی غذا و محاسبه غذای خارج از برنامه.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">کل توکن مصرف‌شده</div>
                  <div className="mt-2 text-2xl font-black">{tokenBreakdown.totalConsumedTokens.toLocaleString("fa-IR")}</div>
                </div>
                <div className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">تولید رژیم</div>
                  <div className="mt-2 text-2xl font-black">{tokenBreakdown.dietGenerationTokens.toLocaleString("fa-IR")}</div>
                </div>
                <div className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">ویرایش رژیم</div>
                  <div className="mt-2 text-2xl font-black">{tokenBreakdown.dietRevisionTokens.toLocaleString("fa-IR")}</div>
                </div>
                <div className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">جایگزین غذا</div>
                  <div className="mt-2 text-2xl font-black">{tokenBreakdown.mealReplacementTokens.toLocaleString("fa-IR")}</div>
                </div>
                <div className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">غذای خارج از برنامه</div>
                  <div className="mt-2 text-2xl font-black">{tokenBreakdown.manualMealNutritionTokens.toLocaleString("fa-IR")}</div>
                </div>
                <div className="rounded-2xl border border-amber-300/15 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">تحلیل عکس غذا</div>
                  <div className="mt-2 text-2xl font-black">{(tokenBreakdown.mealPhotoAnalysisTokens ?? 0).toLocaleString("fa-IR")}</div>
                </div>
              </div>

              {aiUsageLimits ? (
                <div className="rounded-2xl border border-amber-300/15 bg-background/35 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-black">مصرف AI کاربر در همین رژیم</div>
                      <div className="mt-1 text-sm leading-7 text-muted-foreground">سقف‌ها برای همین رژیم قابل افزایش هستند. خالی گذاشتن هر مورد یعنی برگشت به تنظیمات سراسری.</div>
                    </div>
                    <Button type="button" onClick={saveAiUsageLimits} disabled={savingAiUsageLimits}>
                      {savingAiUsageLimits ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                      ذخیره سقف AI
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
                              مصرف: <span className="font-bold text-foreground">{row.item.usedCount.toLocaleString("fa-IR")}</span>
                              {" "}از{" "}
                              <span className="font-bold text-foreground">{formatAiLimitValue(row.item.effectiveDietLimit)}</span>
                            </div>
                          </div>
                          <Badge variant={row.item.remainingCount === 0 ? "destructive" : "secondary"}>
                            {row.item.remainingCount == null ? "نامحدود" : `${row.item.remainingCount.toLocaleString("fa-IR")} باقی`}
                          </Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">سقف رژیم</Label>
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
                            <Label className="text-xs text-muted-foreground">سقف ساعت</Label>
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
                          فعلی: رژیم {formatAiLimitValue(row.item.effectiveDietLimit)} / ساعت {formatAiLimitValue(row.item.effectiveHourlyLimit)}
                        </div>
                      </div>
                    ) : null)}
                  </div>
                </div>
              ) : null}

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="diet-token-breakdown" className="rounded-2xl border border-amber-300/15 bg-background/30 px-4">
                  <AccordionTrigger className="text-right font-bold">
                    نمایش آمار کامل
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <div className="text-xs text-muted-foreground">تعداد رخدادها</div>
                        <div className="mt-1 font-bold">{tokenBreakdown.entriesCount.toLocaleString("fa-IR")}</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <div className="text-xs text-muted-foreground">تولید اولیه</div>
                        <div className="mt-1 font-bold">{tokenBreakdown.dietGenerationTokens.toLocaleString("fa-IR")} توکن</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <div className="text-xs text-muted-foreground">ویرایش با AI</div>
                        <div className="mt-1 font-bold">{tokenBreakdown.dietRevisionTokens.toLocaleString("fa-IR")} توکن</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <div className="text-xs text-muted-foreground">جایگزینی غذا</div>
                        <div className="mt-1 font-bold">{tokenBreakdown.mealReplacementTokens.toLocaleString("fa-IR")} توکن</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <div className="text-xs text-muted-foreground">غذای خارج از برنامه</div>
                        <div className="mt-1 font-bold">{tokenBreakdown.manualMealNutritionTokens.toLocaleString("fa-IR")} توکن</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <div className="text-xs text-muted-foreground">تحلیل عکس غذا</div>
                        <div className="mt-1 font-bold">{(tokenBreakdown.mealPhotoAnalysisTokens ?? 0).toLocaleString("fa-IR")} توکن</div>
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
                                  <Badge variant="secondary">-{entry.tokensAmount.toLocaleString("fa-IR")}</Badge>
                                  <Badge variant="outline">{entry.eventTypeLabel ?? entry.eventType}</Badge>
                                </div>
                                <div className="text-sm leading-7 text-muted-foreground">{entry.summary || "—"}</div>
                              </div>
                              <div className="text-sm text-muted-foreground">{entry.occurredAt ? new Date(entry.occurredAt).toLocaleString("fa-IR") : "—"}</div>
                            </div>

                            {(entry.actorUser?.name || entry.meta?.model || entry.meta?.slot_title || entry.meta?.food_title || (entry.meta?.usage as Record<string, unknown> | undefined)?.total_tokens) ? (
                              <div className="mt-3 rounded-2xl border border-border/70 bg-background/30 p-3 text-xs leading-6 text-muted-foreground">
                                {entry.actorUser?.name || entry.actorUser?.mobile ? (
                                  <div>ثبت‌کننده: <span className="font-bold text-foreground">{entry.actorUser?.name || "—"} {entry.actorUser?.mobile ? `• ${entry.actorUser.mobile}` : ""}</span></div>
                                ) : null}
                                {entry.meta?.model ? <div>مدل: <span className="font-bold text-foreground">{String(entry.meta.model)}</span></div> : null}
                                {entry.meta?.slot_title ? <div>وعده مرتبط: <span className="font-bold text-foreground">{String(entry.meta.slot_title)}</span></div> : null}
                                {entry.meta?.food_title ? <div>غذای ثبت‌شده: <span className="font-bold text-foreground">{String(entry.meta.food_title)}</span></div> : null}
                                {entry.meta?.usage && typeof entry.meta.usage === "object" ? (
                                  <div>
                                    مصرف واقعی:
                                    <span className="font-bold text-foreground"> {Number((entry.meta.usage as Record<string, unknown>).total_tokens ?? 0).toLocaleString("fa-IR")} </span>
                                    توکن
                                    <span> (prompt: {Number((entry.meta.usage as Record<string, unknown>).prompt_tokens ?? 0).toLocaleString("fa-IR")} / completion: {Number((entry.meta.usage as Record<string, unknown>).completion_tokens ?? 0).toLocaleString("fa-IR")})</span>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 px-4 py-8 text-center text-sm text-muted-foreground">
                        هنوز برای این رژیم مصرف توکنی ثبت نشده است.
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        ) : null}

        {item.requestType === "expert" && customerExpertDescription ? (
          <Card className="border-cyan-400/20 bg-cyan-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="h-5 w-5 text-cyan-300" />
                توضیحات کاربر برای رژیم اختصاصی
              </CardTitle>
              <CardDescription>این متن را خود کاربر قبل از ثبت درخواست برای بررسی کارشناس نوشته است.</CardDescription>
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
                بازخورد کاربر از رژیم قبلی
              </CardTitle>
              <CardDescription>این بخش فقط برای رژیم دوم به بعد ثبت می‌شود و برای نسخه بعدی به تصمیم‌گیری دقیق‌تر کمک می‌کند.</CardDescription>
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
                  <div className="text-xs text-muted-foreground">بیماری خاص یا داروهای مصرفی</div>
                  <div className="mt-2 text-sm leading-8 text-foreground">{repeatDietFeedback.medicalNotes}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {manualApprovalPending ? (
          <Card className="border-amber-300/20 bg-amber-400/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-300" />
                این رژیم هنوز برای کاربر ارسال نشده است
              </CardTitle>
              <CardDescription>
                نسخه توسط AI آماده شده اما چون تایید دستی برای رژیم‌های اتوماتیک فعال است، تا قبل از تایید شما برای کاربر نمایش داده نمی‌شود.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-amber-300/20 bg-background/40 p-4 text-sm leading-8 text-foreground">
                بعد از تایید، همین امروز به عنوان تاریخ شروع رژیم ثبت می‌شود و تاریخ پایان هم بر اساس مدت همان رژیم از نو محاسبه خواهد شد.
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-background/40 p-4">
                <Checkbox id="approve-delivery" checked={confirmApproveDelivery} onCheckedChange={(checked) => setConfirmApproveDelivery(Boolean(checked))} />
                <div className="space-y-1">
                  <Label htmlFor="approve-delivery" className="cursor-pointer text-sm font-bold">
                    آیا تایید میکنید که رژیم برای کاربر ارسال بشود ؟
                  </Label>
                  <div className="text-xs leading-6 text-muted-foreground">
                    بعد از تایید، پیامک مناسب برای کاربر ارسال می‌شود و زمان تایید مدیریت هم ثبت خواهد شد.
                  </div>
                </div>
              </div>

              <Button type="button" onClick={approveDelivery} disabled={!confirmApproveDelivery || approvingDelivery} className="rounded-2xl px-6">
                {approvingDelivery ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="ml-2 h-4 w-4" />}
                تایید و ارسال رژیم برای کاربر
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {item.requestType === "expert" && (!item.currentPrescription || expertFileEditorOpen) ? (
          <Card className="border-amber-400/20 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="h-5 w-5 text-amber-300" />
                {item.currentPrescription ? "ویرایش رژیم اختصاصی با فایل" : "ارسال رژیم اختصاصی با فایل"}
              </CardTitle>
              <CardDescription>
                {item.currentPrescription
                  ? "برای ویرایش، فایل آماده دیگری انتخاب کنید یا فایل جدیدی آپلود کنید. نسخه قبلی آرشیو می‌شود و نسخه جدید برای کاربر نمایش داده خواهد شد."
                  : "برای این درخواست به‌جای AI، فایل رژیم آماده را انتخاب کنید یا فایل جدیدی را مستقیم آپلود و برای کاربر ارسال کنید."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {item.currentPrescription ? (
                <div className="flex justify-end">
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setExpertFileEditorOpen(false)}>
                    بستن ویرایش
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
                  انتخاب از فایل‌های آماده
                </Button>
                <Button
                  type="button"
                  variant={expertFileDraft.source === "upload" ? "default" : "outline"}
                  className="rounded-2xl"
                  onClick={() => setExpertFileDraft((current) => ({ ...current, source: "upload" }))}
                >
                  آپلود فایل از کامپیوتر
                </Button>
              </div>

              {expertFileDraft.source === "library" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label>شروع رژیم</Label>
                      <div className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3 text-sm font-bold">
                        {formatPersianDate(expertFileDraft.startedAt)}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>پایان رژیم</Label>
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
                      <div className="text-xs text-muted-foreground">پیش‌فرض این رژیم ۱۵ روزه است، ولی در صورت نیاز می‌توانید تاریخ اتمام را تغییر دهید.</div>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[1fr,220px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={expertFileDraft.search}
                        onChange={(event) => setExpertFileDraft((current) => ({ ...current, search: event.target.value }))}
                        placeholder="جستجو در فایل‌های آماده"
                        className="h-12 rounded-2xl pr-11"
                      />
                    </div>
                    <Select value={expertFileDraft.libraryGroupId} onValueChange={(value) => setExpertFileDraft((current) => ({ ...current, libraryGroupId: value }))}>
                      <SelectTrigger className="h-12 rounded-2xl">
                        <SelectValue placeholder="فیلتر گروه" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">همه گروه‌ها</SelectItem>
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
                        className={`rounded-2xl border p-4 text-right ${
                          expertFileDraft.selectedDietFileId === file.id
                            ? "border-amber-300/30 bg-amber-300/10"
                            : "border-border/70 bg-background/40"
                        }`}
                      >
                        <div className="font-black">{file.title}</div>
                        <div className="mt-2 text-sm leading-7 text-muted-foreground">{file.description || "برای این فایل توضیحی ثبت نشده است."}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {file.groupName ? <Badge variant="secondary">{file.groupName}</Badge> : null}
                          {file.calories != null ? <Badge variant="outline">{file.calories.toLocaleString("fa-IR")} kcal</Badge> : null}
                        </div>
                      </button>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 px-4 py-10 text-center text-sm text-muted-foreground lg:col-span-2">
                        فایلی با این فیلتر پیدا نشد.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>شروع رژیم</Label>
                    <div className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3 text-sm font-bold">
                      {formatPersianDate(expertFileDraft.startedAt)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>پایان رژیم</Label>
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
                    <div className="text-xs text-muted-foreground">پیش‌فرض این رژیم ۱۵ روزه است، ولی در صورت نیاز می‌توانید تاریخ اتمام را تغییر دهید.</div>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="expert-upload-file">فایل رژیم</Label>
                    <Input id="expert-upload-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(event) => setExpertFileDraft((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} />
                    {item.currentPrescription ? (
                      <div className="text-xs leading-6 text-muted-foreground">برای جایگزینی نسخه ارسالی، فایل جدید را دوباره انتخاب کنید.</div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expert-upload-title">اسم فایل</Label>
                    <Input id="expert-upload-title" value={expertFileDraft.title} onChange={(event) => setExpertFileDraft((current) => ({ ...current, title: event.target.value }))} placeholder="مثلا رژیم درمانی ۱۵ روزه" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expert-upload-calories">کالری</Label>
                    <Input id="expert-upload-calories" value={expertFileDraft.calories} onChange={(event) => setExpertFileDraft((current) => ({ ...current, calories: event.target.value }))} placeholder="مثلا 1800" />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="expert-upload-group">گروه‌بندی رژیم</Label>
                    <Select value={expertFileDraft.groupId} onValueChange={(value) => setExpertFileDraft((current) => ({ ...current, groupId: value }))}>
                      <SelectTrigger id="expert-upload-group" className="rounded-2xl">
                        <SelectValue placeholder="انتخاب گروه" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون گروه</SelectItem>
                        {dietFileGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="expert-upload-description">توضیحات فایل</Label>
                    <Textarea id="expert-upload-description" value={expertFileDraft.description} onChange={(event) => setExpertFileDraft((current) => ({ ...current, description: event.target.value }))} className="min-h-28" placeholder="توضیح کوتاه برای کاربر یا توضیح داخلی کارشناس" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="expert-viewer-message">پیام برای کاربر</Label>
                <Textarea id="expert-viewer-message" value={expertFileDraft.viewerMessage} onChange={(event) => setExpertFileDraft((current) => ({ ...current, viewerMessage: event.target.value }))} className="min-h-24" placeholder="مثلا: این فایل را کامل مطالعه کن و اگر سوالی داشتی داخل چت بپرس." />
              </div>

              <Button type="button" onClick={sendExpertFile} disabled={sendingExpertFile} className="rounded-2xl px-6">
                {sendingExpertFile ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <UploadCloud className="ml-2 h-4 w-4" />}
                {item.currentPrescription ? "ذخیره و ارسال نسخه جدید" : "ارسال فایل رژیم برای کاربر"}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {isExpertFilePrescription && currentExpertFile ? (
          <Card className="border-amber-400/20 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="h-5 w-5 text-amber-300" />
                نسخه فایل‌محور کارشناس
              </CardTitle>
              <CardDescription>این درخواست به‌صورت رژیم اختصاصی فایل‌محور برای کاربر ارسال شده و بخش وعده‌ها یا AI برای آن نمایش داده نمی‌شود.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">نام فایل</div>
                <div className="mt-1 text-xl font-black">{currentExpertFile.title}</div>
                <div className="mt-2 text-sm text-muted-foreground">{currentExpertFile.fileName}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">گروه‌بندی / کالری</div>
                <div className="mt-1 font-bold">
                  {currentExpertFile.group?.name || "بدون گروه"}
                  {currentExpertFile.calories != null ? ` | ${currentExpertFile.calories.toLocaleString("fa-IR")} kcal` : ""}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4 lg:col-span-2">
                <div className="text-xs text-muted-foreground">توضیحات فایل</div>
                <div className="mt-1 leading-8">{currentExpertFile.description || item.currentPrescription?.notes || "توضیحی برای این فایل ثبت نشده است."}</div>
              </div>
              <div className="lg:col-span-2">
                <div className="flex flex-wrap gap-3">
                  <a href={currentExpertFile.fileUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground">
                    <Download className="ml-2 h-4 w-4" />
                    دانلود فایل ارسالی
                  </a>
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={openExpertFileEditor}>
                    <Pencil className="ml-2 h-4 w-4" />
                    ویرایش فایل ارسالی
                  </Button>
                  <Button type="button" variant="destructive" className="rounded-2xl" onClick={deleteExpertFile} disabled={deletingExpertFile}>
                    {deletingExpertFile ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <XCircle className="ml-2 h-4 w-4" />}
                    حذف فایل ارسالی
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
                جدول معیار کالری رژیم
              </CardTitle>
              <CardDescription>این بخش نشان می‌دهد رژیم بر چه مبنای کالری و با چه منطق کاهش یا افزایش انرژی ساخته شده است.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">کالری پایه کاربر</div>
                <div className="mt-1 text-xl font-black">{Number(caloriePlan.base_calories ?? 0).toLocaleString("fa-IR")} kcal</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">کالری تجویز شده</div>
                <div className="mt-1 text-xl font-black">{Number(caloriePlan.prescribed_calories ?? 0).toLocaleString("fa-IR")} kcal</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">میزان تغییر کالری</div>
                <div className="mt-1 text-xl font-black">
                  {(Number(caloriePlan.base_calories ?? 0) - Number(caloriePlan.prescribed_calories ?? 0)).toLocaleString("fa-IR")} kcal
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">سرعت هدف</div>
                <div className="mt-1 text-xl font-black">{item.weeklyWeightChangeKg != null ? `${item.weeklyWeightChangeKg.toLocaleString("fa-IR")} کیلو در هفته` : "—"}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">فاصله تا وزن هدف</div>
                <div className="mt-1 text-xl font-black">
                  {item.currentWeightKg != null && item.targetWeightKg != null
                    ? `${Math.abs(item.currentWeightKg - item.targetWeightKg).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} کیلو`
                    : "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">تغییر هدف</div>
                <div className="mt-1 font-bold leading-7">{String(caloriePlan.goal_adjustment ?? "—")}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4 lg:col-span-3">
                <div className="text-xs text-muted-foreground">توضیح منطق تجویز</div>
                <div className="mt-1 leading-8">{String(caloriePlan.summary_text ?? caloriePlan.reasoning ?? "—")}</div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {supplementPlan && !isExpertFilePrescription ? (
          <Card className="border-violet-400/20 bg-violet-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-violet-500" />
                مکمل های تجویز شده
              </CardTitle>
              <CardDescription>اگر در prompt یا تنظیمات الگو مکمل خواسته شده باشد، در این بخش به صورت جداگانه دیده می‌شود.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">وضعیت مکمل</div>
                <div className="mt-1 font-bold">{supplementPlan.enabled ? "تجویز شده" : "تجویز نشده"}</div>
                <div className="mt-2 leading-7">{String(supplementPlan.summary_text ?? "—")}</div>
              </div>
              {Array.isArray(supplementPlan.items) && supplementPlan.items.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {supplementPlan.items.map((itemValue, index) => {
                    const supplement = itemValue && typeof itemValue === "object" ? (itemValue as Record<string, unknown>) : {};

                    return (
                      <div key={`supplement-${index}`} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                        <div className="font-black">{String(supplement.title ?? "مکمل")}</div>
                        <div className="mt-2 text-sm leading-7">{String(supplement.usage ?? "")}</div>
                        <div className="mt-2 text-xs text-muted-foreground">زمان مصرف: {String(supplement.timing ?? "—")}</div>
                        <div className="mt-2 text-xs leading-6 text-muted-foreground">{String(supplement.notes ?? "")}</div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {shouldShowMealReplacementSummary ? (
          <Card className="border-amber-400/20 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-amber-400" />
                مدیریت تغییر غذا
              </CardTitle>
              <CardDescription>
                خلاصه وضعیت جایگزینی غذا برای این نسخه روزانه. جزئیات کامل هر وعده، کل لیست‌های ساخته‌شده توسط AI و عملیات مدیریتی در صفحه جداگانه نمایش داده می‌شود.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">تعداد وعده‌های قابل مدیریت</div>
                  <div className="mt-1 text-2xl font-black">{mealReplacementTargets.length.toLocaleString("fa-IR")}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">لیست‌های ساخته‌شده</div>
                  <div className="mt-1 text-2xl font-black">
                    {currentMealReplacementSuggestions.filter((suggestion) => suggestion.status === "generated").length.toLocaleString("fa-IR")}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">درخواست‌های در صف / در حال ساخت</div>
                  <div className="mt-1 text-2xl font-black">
                    {currentMealReplacementSuggestions.filter((suggestion) => suggestion.status === "queued" || suggestion.status === "processing").length.toLocaleString("fa-IR")}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-sm leading-8 text-muted-foreground">
                  {mealReplacementEnabled
                    ? "جایگزینی غذا برای این نسخه فعال است و جزئیات کامل هر وعده در صفحه مستقل مدیریت نمایش داده می‌شود."
                    : "این نسخه روزانه است، اما امکان جایگزین کردن غذا برای آن فعال نشده است."}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={`/panel/nutrition/requests/${item.id}/replacements`}>
                  <Button type="button" className="rounded-2xl">
                    مشاهده جزئیات
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
              ثبت مصرف کاربر و پیشرفت رژیم
            </CardTitle>
            <CardDescription>اینجا کارشناس تغذیه می‌بیند کاربر در هر روز دقیقاً چه وعده‌هایی را ثبت کرده، آیا غذایی خارج از رژیم خورده و روند اجرای نسخه در چه وضعیتی است.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">درصد پیشرفت کل</div>
                <div className="mt-1 text-xl font-black">{Number(item.currentPrescription?.progress?.progressPercent ?? 0).toLocaleString("fa-IR")}٪</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">وعده‌های ثبت شده</div>
                <div className="mt-1 text-xl font-black">
                  {Number(item.currentPrescription?.progress?.loggedMeals ?? item.currentPrescription?.mealLogs?.length ?? 0).toLocaleString("fa-IR")}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">هدف ثبت وعده‌ها</div>
                <div className="mt-1 text-xl font-black">
                  {Number(item.currentPrescription?.progress?.expectedMeals ?? 0).toLocaleString("fa-IR")}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-start gap-2">
              <Link href={`/panel/nutrition/requests/${item.id}/tracking`}>
                <Button type="button" className="rounded-2xl px-5">
                  مشاهده پیگیری روزانه رژیم
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
                          {day.status === "complete" ? "تمام وعده‌های این روز ثبت شده‌اند." : day.status === "partial" ? "بخشی از وعده‌های این روز ثبت شده‌اند." : "برای این روز هنوز چیزی ثبت نشده است."}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={day.status === "complete" ? "default" : day.status === "partial" ? "secondary" : "outline"}>
                          {Number(day.progressPercent ?? 0).toLocaleString("fa-IR")}٪
                        </Badge>
                        <Badge variant="outline">{Number(day.waterGlasses ?? 0).toLocaleString("fa-IR")} لیوان آب</Badge>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      {logs.length ? logs.map((log) => (
                        <div key={log.id} className="rounded-xl border border-border/70 bg-background/50 px-3 py-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-bold">{mealSlotLabel(log.mealSlotKey)}</div>
                            {log.isManual ? (
                              <Badge variant="secondary">خارج از رژیم</Badge>
                            ) : hasReplacementMeta(log.notes) ? (
                              <Badge variant="secondary">غذای جایگزین</Badge>
                            ) : (
                              <Badge variant="outline">طبق رژیم</Badge>
                            )}
                          </div>
                          <div className="mt-2 font-black">{log.foodTitle ?? "—"}</div>
                          {String(log.quantityText ?? "").trim() !== "" ? <div className="mt-1 text-xs text-muted-foreground">{String(log.quantityText)}</div> : null}
                          {log.photoUrl ? (
                            <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-500/5 p-2">
                              <div className="mb-2 text-[11px] font-bold text-emerald-300">عکس ثبت‌شده برای این وعده</div>
                              <button
                                type="button"
                                onClick={() => setMealPhotoPreview({ url: log.photoUrl ?? "", title: log.foodTitle ?? "عکس وعده ثبت‌شده" })}
                                className="flex w-full items-center gap-3 rounded-lg text-right transition hover:bg-white/5"
                              >
                                <img src={log.photoUrl} alt={log.foodTitle ?? "عکس وعده ثبت‌شده"} className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/10" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 text-xs font-bold text-white">
                                    <ImageIcon className="h-3.5 w-3.5 text-emerald-300" />
                                    مشاهده عکس بزرگ
                                  </div>
                                  <div className="mt-1 text-[11px] leading-5 text-muted-foreground">روی عکس بزنید تا نسخه بزرگ‌تر باز شود.</div>
                                </div>
                              </button>
                            </div>
                          ) : null}
                          {formatManualMetaText(log.foodDescription) !== "" ? <div className="mt-2 leading-7">{formatManualMetaText(log.foodDescription)}</div> : null}
                          {formatManualMetaText(log.notes) !== "" ? <div className="mt-2 text-xs leading-6 text-muted-foreground">{formatManualMetaText(log.notes)}</div> : null}
                        </div>
                      )) : (
                        <div className="rounded-xl border border-dashed border-border/70 bg-background/30 px-3 py-6 text-center text-sm text-muted-foreground lg:col-span-2">
                          برای این روز هنوز مصرفی ثبت نشده است.
                        </div>
                      )}
                    </div>

                    <div className="my-4 h-px bg-border/70" />

                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
                          <Dumbbell className="h-4 w-4" />
                          ورزش‌های ثبت‌شده
                        </div>
                        <Badge variant="outline" className="gap-1">
                          <Flame className="h-3.5 w-3.5" />
                          {Number(exerciseLogs.reduce((sum, log) => sum + Number(log.caloriesBurned ?? 0), 0)).toLocaleString("fa-IR")} kcal
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        {exerciseLogs.length ? exerciseLogs.map((log) => (
                          <div key={log.id} className="rounded-xl border border-border/70 bg-background/50 px-3 py-3 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-bold">{log.title ?? "ورزش ثبت‌شده"}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{log.groupTitle ?? "فعالیت ورزشی"} | شدت {exerciseIntensityLabel(log.intensity)}</div>
                              </div>
                              <Badge variant="secondary">{Number(log.caloriesBurned ?? 0).toLocaleString("fa-IR")} kcal</Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                              <span>{Number(log.durationMinutes ?? 0).toLocaleString("fa-IR")} دقیقه</span>
                              {log.speedKmh ? <span>| سرعت {Number(log.speedKmh).toLocaleString("fa-IR")} km/h</span> : null}
                              {log.distanceKm ? <span>| مسافت {Number(log.distanceKm).toLocaleString("fa-IR")} km</span> : null}
                              {log.weightKg ? <span>| وزن {Number(log.weightKg).toLocaleString("fa-IR")} کیلو</span> : null}
                            </div>
                            {String(log.notes ?? "").trim() !== "" ? <div className="mt-2 text-xs leading-6 text-muted-foreground">{String(log.notes)}</div> : null}
                          </div>
                        )) : (
                          <div className="rounded-xl border border-dashed border-border/70 bg-background/30 px-3 py-6 text-center text-sm text-muted-foreground lg:col-span-2">
                            برای این روز ورزشی ثبت نشده است.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  هنوز مصرفی از سمت کاربر برای این نسخه ثبت نشده است.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        ) : null}

        {currentPrescriptionContent && !isExpertFilePrescription ? (
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-primary" />
                جزئیات رژیم تجویز شده
              </CardTitle>
              <CardDescription>نسخه نهایی که برای کاربر صادر شده، به تفکیک همین‌جا دیده می‌شود.</CardDescription>
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
                            <div className="font-black">{String(slot.title ?? "وعده")}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{String(slot.description ?? "")}</div>
                          </div>
                          <div className="text-xs font-bold text-emerald-500">{Number(slot.target_calories ?? 0).toLocaleString("fa-IR")} kcal</div>
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
                                  <div className="flex-1 text-right">
                                    <div className="font-bold">{String(option.title ?? "غذا")}</div>
                                    <div className="mt-1 leading-7">{String(option.description ?? "")}</div>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                      {String(option.quantity_text ?? "")}
                                      {Number(option.grams ?? 0) > 0 ? ` (${Number(option.grams).toLocaleString("fa-IR")} gram)` : ""}
                                      {Number(option.calories ?? 0) > 0 ? ` | ${Number(option.calories).toLocaleString("fa-IR")} kcal` : ""}
                                    </div>
                                    {compactMacroItems(option).length ? (
                                      <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                                        {compactMacroItems(option).map((macro) => (
                                          <span key={`${macro.key}-${optionIndex}`} className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                            {macro.label} {macro.value.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}g
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
                          <div className="font-black">{String(plan.day_label ?? `روز ${index + 1}`)}</div>
                          <div className="text-xs font-bold text-emerald-500">{Number(plan.day_total_calories ?? 0).toLocaleString("fa-IR")} kcal</div>
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
                                  <div className="flex-1 text-right">
                                    <div className="font-bold">{String(meal.title ?? "وعده")}</div>
                                    <div className="mt-1 leading-7">{String(meal.meal_text ?? "")}</div>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                      {Number(meal.grams ?? 0) > 0 ? `${Number(meal.grams).toLocaleString("fa-IR")} gram | ` : ""}
                                      {Number(meal.calories ?? 0).toLocaleString("fa-IR")} kcal
                                    </div>
                                    {compactMacroItems(meal).length ? (
                                      <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                                        {compactMacroItems(meal).map((macro) => (
                                          <span key={`${macro.key}-${mealIndex}`} className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                            {macro.label} {macro.value.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}g
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
                                            <div className="flex-1 text-right">
                                              <div className="font-semibold">{String(replacement.title ?? "جایگزین")}</div>
                                              <div className="mt-1 leading-7">{String(replacement.description ?? "")}</div>
                                              <div className="mt-2 text-xs text-muted-foreground">
                                                {String(replacement.quantity_text ?? "")}
                                                {Number(replacement.grams ?? 0) > 0 ? ` (${Number(replacement.grams).toLocaleString("fa-IR")} gram)` : ""}
                                                {Number(replacement.calories ?? 0) > 0 ? ` | ${Number(replacement.calories).toLocaleString("fa-IR")} kcal` : ""}
                                              </div>
                                              {compactMacroItems(replacement).length ? (
                                                <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                                                  {compactMacroItems(replacement).map((macro) => (
                                                    <span key={`${macro.key}-${replacementIndex}`} className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                                      {macro.label} {macro.value.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}g
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
                          <div className="flex-1 text-right">
                            <div className="font-black">{String(section.title ?? "توضیح")}</div>
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
                پیام ثابت برای کاربر
              </CardTitle>
              <CardDescription>
                اگر اینجا متنی بنویسی، کاربر آن را در صفحه رژیم خودش می‌بیند. اگر خالی باشد، این باکس اصلاً برای کاربر نمایش داده نمی‌شود.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="viewer-message">متن پیام</Label>
                <Textarea
                  id="viewer-message"
                  value={viewerMessageBody}
                  onChange={(e) => setViewerMessageBody(e.target.value)}
                  className="min-h-28 leading-8"
                  placeholder="مثلاً: این هفته روی ثبت کامل صبحانه و آب روزانه تمرکز کن."
                />
              </div>
              <Button type="button" onClick={saveViewerMessage} disabled={manualEditSaving} className="rounded-2xl px-6">
                {manualEditSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="ml-2 h-4 w-4" />}
                ذخیره پیام برای کاربر
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {item.askAiEnabled ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                ورودی کارشناس برای AI
              </CardTitle>
              <CardDescription>توضیحات تخصصی را تنظیم کن و از همین صفحه درخواست را به AI بفرست.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expertNotes">توضیحات کارشناس تغذیه</Label>
                  <Textarea id="expertNotes" value={draft.expertNotes} onChange={(e) => setDraft((current) => ({ ...current, expertNotes: e.target.value }))} className="min-h-28 leading-7" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinicalNotes">نکات بالینی</Label>
                  <Textarea id="clinicalNotes" value={draft.clinicalNotes} onChange={(e) => setDraft((current) => ({ ...current, clinicalNotes: e.target.value }))} className="min-h-28 leading-7" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="generationInstructions">دستور ساخت رژیم</Label>
                <div className="flex justify-start">
                  <Button type="button" variant="outline" className="rounded-[14px]" onClick={() => setPromptPickerOpen(true)}>
                    استفاده از پرامپت آماده
                  </Button>
                </div>
                <Textarea id="generationInstructions" value={draft.generationInstructions} onChange={(e) => setDraft((current) => ({ ...current, generationInstructions: e.target.value }))} className="min-h-32 leading-7" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mustInclude">مواردی که حتماً باشد</Label>
                  <Textarea id="mustInclude" value={draft.mustInclude} onChange={(e) => setDraft((current) => ({ ...current, mustInclude: e.target.value }))} className="min-h-24 leading-7" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mustAvoid">مواردی که نباید باشد</Label>
                  <Textarea id="mustAvoid" value={draft.mustAvoid} onChange={(e) => setDraft((current) => ({ ...current, mustAvoid: e.target.value }))} className="min-h-24 leading-7" />
                </div>
              </div>

              <Button onClick={queueGeneration} disabled={submitting || item.aiGenerationStatus === "queued" || item.aiGenerationStatus === "processing"} className="rounded-2xl px-6">
                {submitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sparkles className="ml-2 h-4 w-4" />}
                {item.currentPrescription ? "اصلاح نسخه با AI" : "ارسال به AI"}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {item.requestType === "ai" ? (
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5 text-primary" />
                Snapshot ها و داده‌های خام درخواست
              </CardTitle>
              <CardDescription>هر بخش جداگانه باز می‌شود تا صفحه اصلی خلوت‌تر بماند و هر زمان لازم بود جزئیات کامل را ببینی.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="space-y-3">
                <AccordionItem value="profile" className="rounded-2xl border border-border/70 bg-background/30 px-4">
                  <AccordionTrigger className="text-right font-bold">Snapshot کاربر</AccordionTrigger>
                  <AccordionContent>
                    <pre className="overflow-x-auto rounded-2xl bg-slate-950/80 p-4 text-xs leading-7 text-slate-100">{jsonBlock(item.profileSnapshot)}</pre>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="template" className="rounded-2xl border border-border/70 bg-background/30 px-4">
                  <AccordionTrigger className="text-right font-bold">Snapshot الگو</AccordionTrigger>
                  <AccordionContent>
                    <pre className="overflow-x-auto rounded-2xl bg-slate-950/80 p-4 text-xs leading-7 text-slate-100">{jsonBlock(item.templateSnapshot)}</pre>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="payload" className="rounded-2xl border border-border/70 bg-background/30 px-4">
                  <AccordionTrigger className="text-right font-bold">Payload درخواست</AccordionTrigger>
                  <AccordionContent>
                    <pre className="overflow-x-auto rounded-2xl bg-slate-950/80 p-4 text-xs leading-7 text-slate-100">{jsonBlock(item.requestPayloadSnapshot)}</pre>
                  </AccordionContent>
                </AccordionItem>

                {item.askAiEnabled ? (
                  <AccordionItem value="prompt" className="rounded-2xl border border-border/70 bg-background/30 px-4">
                    <AccordionTrigger className="text-right font-bold">Prompt ثبت‌شده برای AI</AccordionTrigger>
                    <AccordionContent>
                      <pre className="overflow-x-auto rounded-2xl bg-slate-950/80 p-4 text-xs leading-7 text-slate-100">{jsonBlock(item.aiPromptSnapshot)}</pre>
                    </AccordionContent>
                  </AccordionItem>
                ) : null}

                {item.askAiEnabled ? (
                  <AccordionItem value="response" className="rounded-2xl border border-border/70 bg-background/30 px-4">
                    <AccordionTrigger className="text-right font-bold">پاسخ خام AI</AccordionTrigger>
                    <AccordionContent>
                      <pre className="overflow-x-auto rounded-2xl bg-slate-950/80 p-4 text-xs leading-7 text-slate-100">{jsonBlock(item.aiResponseSnapshot)}</pre>
                    </AccordionContent>
                  </AccordionItem>
                ) : null}
              </Accordion>
            </CardContent>
          </Card>
        ) : null}

        <section className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
          <Link href="/panel/nutrition/requests">
            <Button type="button" variant="outline" className="h-11 rounded-2xl border-border/70 bg-background/40 px-5">
              بازگشت به لیست رژیم ها
            </Button>
          </Link>
          <Link href="/panel/nutrition">
            <Button type="button" variant="outline" className="h-11 rounded-2xl border-border/70 bg-background/40 px-5">
              بازگشت به پنل
            </Button>
          </Link>
          {item.user?.mobile ? (
            <Link href={`/panel/nutrition/prescribe/users/${encodeURIComponent(item.user.mobile)}`}>
              <Button type="button" className="h-11 rounded-2xl px-5">
                تجویز رژیم
              </Button>
            </Link>
          ) : null}
        </section>
      </main>

      <Dialog open={Boolean(prescriptionDateDraft)} onOpenChange={(open) => {
        if (!open) {
          setPrescriptionDateDraft(null);
        }
      }}>
        <DialogContent dir="rtl" className="border-border/80 bg-card text-foreground sm:max-w-xl">
          <DialogHeader className="text-right">
            <DialogTitle>ویرایش تاریخ رژیم</DialogTitle>
            <DialogDescription>
              تاریخ‌ها را با تقویم شمسی انتخاب کنید. مقدار ذخیره‌شده در دیتابیس به صورت میلادی ثبت می‌شود.
            </DialogDescription>
          </DialogHeader>

          {prescriptionDateDraft ? (
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>تاریخ شروع رژیم</Label>
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
                <Label>تاریخ پایان رژیم</Label>
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
                  تاریخ پایان باید برابر یا بعد از تاریخ شروع باشد.
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
              {submitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="ml-2 h-4 w-4" />}
              ذخیره تاریخ‌ها
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPrescriptionDateDraft(null)}
              disabled={submitting}
              className="rounded-2xl"
            >
              انصراف
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
        <DialogContent dir="rtl" className="overflow-hidden border-amber-400/20 bg-[linear-gradient(165deg,rgba(17,24,39,0.98),rgba(9,14,25,0.97))] text-white sm:max-w-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_40%)]" />
          <DialogHeader className="relative z-10 text-right">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/5 shadow-[0_30px_80px_-40px_rgba(251,191,36,0.55)]">
              <div className="relative">
                <Orbit className="h-10 w-10 animate-spin text-amber-300" />
                <Sparkles className="absolute -right-2 -top-2 h-4 w-4 text-cyan-300" />
              </div>
            </div>
            <DialogTitle className="mt-4 text-center text-2xl font-black">
              {item?.currentPrescription ? "در حال اصلاح هوشمند نسخه" : "در حال ساخت رژیم با AI"}
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-8 text-slate-300">
              درخواست شما به AI ارسال شده است. تا چند لحظه دیگر نسخه جدید آماده می‌شود و همین صفحه به‌روزرسانی خواهد شد.
            </DialogDescription>
          </DialogHeader>

          <div className="relative z-10 mt-2 space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-white">وضعیت فعلی پردازش</div>
                  <div className="mt-1 text-xs leading-6 text-slate-400">
                    {item?.aiGenerationStatus === "queued"
                      ? "درخواست در صف AI قرار گرفته و منتظر شروع پردازش است."
                      : item?.aiGenerationStatus === "processing"
                      ? "AI در حال بازنویسی نسخه بر اساس دستور جدید کارشناس است."
                      : "در حال همگام‌سازی نتیجه..."}
                  </div>
                </div>
                <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">
                  {item?.aiGenerationStatusLabel ?? "در حال انجام"}
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#f59e0b,#fbbf24,#67e8f9)]" />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[11px] text-slate-400">درخواست</div>
                  <div className="mt-1 text-sm font-black text-white">#{item?.id ?? "—"}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[11px] text-slate-400">نسخه فعلی</div>
                  <div className="mt-1 text-sm font-black text-white">{item?.currentPrescription ? `نسخه #${item.currentPrescription.id}` : "نسخه اول"}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[11px] text-slate-400">الگو</div>
                  <div className="mt-1 text-sm font-black text-white">{item?.dietTemplateName ?? "—"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-cyan-400/15 bg-cyan-400/5 p-4 text-sm leading-8 text-cyan-100/90">
              AI نسخه فعلی را نگه می‌دارد و فقط بخش‌هایی را که در دستور کارشناس گفته شده اصلاح می‌کند. بقیه رژیم بدون تغییر باقی می‌ماند مگر اینکه خودت صریحاً خلافش را نوشته باشی.
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
              {cancellingRevision ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <XCircle className="ml-2 h-4 w-4" />}
              کنسل کردن درخواست
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
              بستن مدال
            </Button>
            <div className="text-xs leading-7 text-slate-400">
              بعد از آماده شدن نسخه، مدال خودکار بسته می‌شود و صفحه به‌روزرسانی خواهد شد.
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
        <DialogContent dir="rtl" className="border-border/80 bg-card text-foreground sm:max-w-2xl">
          <DialogHeader className="text-right">
            <DialogTitle>{manualEditDraft?.heading ?? "ویرایش دستی آیتم رژیم"}</DialogTitle>
            <DialogDescription>
              مدیر می‌تواند این ردیف را به صورت دستی ویرایش کند و تغییرات مستقیم روی همان نسخه فعلی ذخیره می‌شود.
            </DialogDescription>
          </DialogHeader>

          {manualEditDraft ? (
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="manual-title">عنوان</Label>
                <Textarea
                  id="manual-title"
                  value={manualEditDraft.title}
                  onChange={(e) => setManualEditDraft((current) => current ? { ...current, title: e.target.value } : current)}
                  className="min-h-20 leading-7"
                />
              </div>

              {manualEditDraft.sectionType === "fixed_text_section" ? (
                <div className="space-y-2">
                  <Label htmlFor="manual-body">متن کامل</Label>
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
                    <Label htmlFor="manual-meal-text">شرح کامل وعده</Label>
                    <Textarea
                      id="manual-meal-text"
                      value={manualEditDraft.mealText}
                      onChange={(e) => setManualEditDraft((current) => current ? { ...current, mealText: e.target.value } : current)}
                      className="min-h-32 leading-8"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="manual-grams">گرم</Label>
                      <Input
                        id="manual-grams"
                        value={manualEditDraft.grams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, grams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-calories">کالری</Label>
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
                      <Label htmlFor="manual-protein">پروتئین</Label>
                      <Input
                        id="manual-protein"
                        value={manualEditDraft.proteinGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, proteinGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-carb">کربوهیدرات</Label>
                      <Input
                        id="manual-carb"
                        value={manualEditDraft.carbohydrateGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, carbohydrateGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-fat">چربی</Label>
                      <Input
                        id="manual-fat"
                        value={manualEditDraft.fatGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, fatGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-fiber">فیبر</Label>
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
                    <Label htmlFor="manual-description">توضیحات</Label>
                    <Textarea
                      id="manual-description"
                      value={manualEditDraft.description}
                      onChange={(e) => setManualEditDraft((current) => current ? { ...current, description: e.target.value } : current)}
                      className="min-h-28 leading-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-quantity">مقدار نمایش داده‌شده</Label>
                    <Textarea
                      id="manual-quantity"
                      value={manualEditDraft.quantityText}
                      onChange={(e) => setManualEditDraft((current) => current ? { ...current, quantityText: e.target.value } : current)}
                      className="min-h-20 leading-7"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="manual-grams">گرم</Label>
                      <Input
                        id="manual-grams"
                        value={manualEditDraft.grams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, grams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-calories">کالری</Label>
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
                      <Label htmlFor="manual-protein">پروتئین</Label>
                      <Input
                        id="manual-protein"
                        value={manualEditDraft.proteinGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, proteinGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-carb">کربوهیدرات</Label>
                      <Input
                        id="manual-carb"
                        value={manualEditDraft.carbohydrateGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, carbohydrateGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-fat">چربی</Label>
                      <Input
                        id="manual-fat"
                        value={manualEditDraft.fatGrams}
                        onChange={(e) => setManualEditDraft((current) => current ? { ...current, fatGrams: e.target.value } : current)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-fiber">فیبر</Label>
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
              {manualEditSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Pencil className="ml-2 h-4 w-4" />}
              ذخیره ویرایش
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
              انصراف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(mealPhotoPreview)} onOpenChange={(open) => !open && setMealPhotoPreview(null)}>
        <DialogContent dir="rtl" className="max-w-3xl border-border/70 bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>{mealPhotoPreview?.title ?? "عکس وعده ثبت‌شده"}</DialogTitle>
            <DialogDescription>تصویر ثبت‌شده توسط کاربر برای بررسی کارشناس تغذیه.</DialogDescription>
          </DialogHeader>
          {mealPhotoPreview?.url ? (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-black/20">
              <img src={mealPhotoPreview.url} alt={mealPhotoPreview.title ?? "عکس وعده ثبت‌شده"} className="max-h-[75vh] w-full object-contain" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
