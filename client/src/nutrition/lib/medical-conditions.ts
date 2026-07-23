import type { NutritionMedicalConditionItem, NutritionMedicalConditionStatus } from "@/nutrition/lib/nutrition-form-state";
import type { MessageKey } from "@/i18n/messages";
import { formatDate } from "@/i18n/format";

export const MEDICAL_CONDITION_STATUS_OPTIONS: Array<{ value: NutritionMedicalConditionStatus; labelKey: MessageKey }> = [
  { value: "current", labelKey: "medicalConditionsEditor.status.current" },
  { value: "temporary", labelKey: "medicalConditionsEditor.status.temporary" },
  { value: "past", labelKey: "medicalConditionsEditor.status.past" },
];

const LEGACY_STATUS_LABELS: Record<NutritionMedicalConditionStatus, string> = {
  current: "فعلی",
  temporary: "موقت",
  past: "بیماری گذشته",
};

export function createEmptyMedicalConditionItem(title = ""): NutritionMedicalConditionItem {
  return {
    id: `condition_${Math.random().toString(36).slice(2, 10)}`,
    title,
    status: "current",
    startedAt: "",
    endedAt: "",
    ongoing: true,
    notes: "",
  };
}

export function normalizeMedicalConditionItems(items: NutritionMedicalConditionItem[] | null | undefined): NutritionMedicalConditionItem[] {
  return (items ?? [])
    .map((item, index): NutritionMedicalConditionItem => ({
      id: String(item?.id || `condition_${index + 1}`),
      title: String(item?.title ?? "").trim(),
      status: item?.status === "past" || item?.status === "temporary" ? item.status : "current",
      startedAt: String(item?.startedAt ?? "").trim(),
      endedAt: String(item?.endedAt ?? "").trim(),
      ongoing: item?.status === "past" ? false : Boolean(item?.ongoing ?? item?.status === "current"),
      notes: String(item?.notes ?? "").trim(),
    }))
    .filter((item) => item.title !== "")
    .map((item) => ({
      ...item,
      endedAt: item.status === "past" || !item.ongoing ? item.endedAt : "",
      ongoing: item.status === "past" ? false : item.ongoing,
    }));
}

export function ensureMedicalConditionDraft(items: NutritionMedicalConditionItem[] | null | undefined, fallbackText?: string | null) {
  const normalized = normalizeMedicalConditionItems(items);

  if (normalized.length > 0) {
    return normalized;
  }

  const legacy = String(fallbackText ?? "").trim();

  return legacy ? [createEmptyMedicalConditionItem(legacy)] : [];
}

export function summarizeMedicalConditionItems(items: NutritionMedicalConditionItem[] | null | undefined): string {
  const normalized = normalizeMedicalConditionItems(items);

  if (normalized.length === 0) {
    return "";
  }

  return normalized.map((item) => {
    const statusLabel = LEGACY_STATUS_LABELS[item.status] ?? LEGACY_STATUS_LABELS.current;
    const timingParts = [];

    if (item.startedAt) {
      timingParts.push(`از ${formatFaDate(item.startedAt)}`);
    }

    if ((item.status === "past" || !item.ongoing) && item.endedAt) {
      timingParts.push(`تا ${formatFaDate(item.endedAt)}`);
    } else if (item.status !== "past" && item.ongoing) {
      timingParts.push("ادامه‌دار");
    }

    const timingText = timingParts.length > 0 ? ` (${timingParts.join("، ")})` : "";
    const notesText = item.notes ? ` - ${item.notes}` : "";

    return `${item.title} [${statusLabel}]${timingText}${notesText}`;
  }).join(" | ");
}

export function formatMedicalConditionTimeline(
  item: NutritionMedicalConditionItem,
  options: {
    date: (value: string) => string;
    t: (key: MessageKey, params?: Record<string, string | number>) => string;
  },
): string {
  const parts = [];

  if (item.startedAt) {
    parts.push(options.t("medicalConditionsEditor.timeline.from", { date: options.date(item.startedAt) }));
  }

  if ((item.status === "past" || !item.ongoing) && item.endedAt) {
    parts.push(options.t("medicalConditionsEditor.timeline.to", { date: options.date(item.endedAt) }));
  } else if (item.status !== "past" && item.ongoing) {
    parts.push(options.t("medicalConditionsEditor.timeline.ongoing"));
  }

  return parts.join(options.t("medicalConditionsEditor.timeline.separator"));
}

function formatFaDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return formatDate(parsed, undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}
