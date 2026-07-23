import { Badge } from "@/components/ui/badge";
import { useT } from "@/i18n/locale";
import type { NutritionMedicalConditionItem } from "@/lib/types";
import { normalizeMedicalConditionItems } from "@/nutrition/lib/medical-conditions";
import type { MessageKey } from "@/i18n/messages";

function statusKey(status: NutritionMedicalConditionItem["status"]): MessageKey {
  switch (status) {
    case "past":
      return "medicalConditionsSummary.status.past";
    case "temporary":
      return "medicalConditionsSummary.status.temporary";
    default:
      return "medicalConditionsSummary.status.current";
  }
}

function statusClassName(status: NutritionMedicalConditionItem["status"]) {
  switch (status) {
    case "past":
      return "border-slate-400/20 bg-slate-400/10 text-slate-200";
    case "temporary":
      return "border-amber-300/20 bg-amber-300/10 text-amber-100";
    default:
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }
}

export function MedicalConditionsSummary({
  items,
  emptyText,
}: {
  items?: NutritionMedicalConditionItem[] | null;
  emptyText?: string;
}) {
  const t = useT();
  const normalizedItems = normalizeMedicalConditionItems(items);

  if (normalizedItems.length === 0) {
    return <span>{emptyText ?? t("medicalConditionsSummary.empty")}</span>;
  }

  return (
    <div className="min-w-0 space-y-2">
      {normalizedItems.map((item) => (
        <div key={item.id} className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 break-words font-black text-white">{item.title}</span>
          <Badge variant="outline" className={`${statusClassName(item.status)} shrink-0`}>
            {t(statusKey(item.status))}
          </Badge>
        </div>
      ))}
    </div>
  );
}
