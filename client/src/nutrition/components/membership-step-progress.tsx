import { cn } from "@/lib/utils";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { isReturningToProfileHomeReview } from "@/nutrition/lib/membership-edit-navigation";

interface MembershipStepProgressProps {
  step: number;
  totalSteps: number;
  className?: string;
  barClassName?: string;
  itemClassName?: string;
}

export function MembershipStepProgress({
  step,
  totalSteps,
  className,
  barClassName,
  itemClassName,
}: MembershipStepProgressProps) {
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const t = useT();
  const format = useFormat();
  const { dir } = useLocale();

  if (isReturningToProfileHomeReview(searchParams)) {
    return null;
  }

  return (
    <div className={cn("mt-7 space-y-2.5", className)}>
      <div className="flex items-center justify-between text-[11px] font-extrabold">
        <div className="text-amber-300">{t("nutritionMembershipProgress.stepOf", { step: format.number(step), total: format.number(totalSteps) })}</div>
        <div className="text-slate-400">{t("nutritionMembershipProgress.title")}</div>
      </div>
      <div className={cn("grid grid-cols-[repeat(12,minmax(0,1fr))] gap-1", barClassName)} dir={dir}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={`membership-step-${step}-${index}`}
            className={cn("h-1 rounded-full", itemClassName, index < step ? "bg-amber-400" : "bg-white/10")}
          />
        ))}
      </div>
    </div>
  );
}
