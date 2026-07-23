import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Ban, BriefcaseMedical, CalendarDays, ClipboardPlus, Dumbbell, Flag, Pencil, Pill, Ruler, Scale, ShieldAlert, Target, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { NutritionProfile } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { MedicalConditionsSummary } from "@/nutrition/components/medical-conditions-summary";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { appendProfileHomeReviewReturn } from "@/nutrition/lib/membership-edit-navigation";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

const QUESTION_LABELS: Array<{ key: keyof NonNullable<NutritionProfile["mindsetAnswers"]>; titleKey: MessageKey; href: string }> = [
  { key: "reason", titleKey: "nutritionMembershipReview.mindset.reason", href: "/nutrition/membership/mindset/1?edit=1" },
  { key: "barrier", titleKey: "nutritionMembershipReview.mindset.barrier", href: "/nutrition/membership/mindset/2?edit=1" },
  { key: "stressAppetite", titleKey: "nutritionMembershipReview.mindset.stressAppetite", href: "/nutrition/membership/mindset/3?edit=1" },
  { key: "hardestTime", titleKey: "nutritionMembershipReview.mindset.hardestTime", href: "/nutrition/membership/mindset/4?edit=1" },
  { key: "planStyle", titleKey: "nutritionMembershipReview.mindset.planStyle", href: "/nutrition/membership/mindset/5?edit=1" },
];

function formatBirthDate(value: string | null | undefined, emptyText: string, formatDate: (value: string, options?: Intl.DateTimeFormatOptions) => string) {
  if (!value) {
    return emptyText;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return emptyText;
  }

  return formatDate(value, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function formatValue(value: number | string | undefined | null, emptyText: string, formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string) {
  if (value === undefined || value === null || value === "") {
    return emptyText;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return formatNumber(numeric, { maximumFractionDigits: 2 });
  }

  return String(value);
}

function goalLabel(goal: string | undefined, emptyText: string, t: (key: MessageKey) => string) {
  switch (goal) {
    case "lose-weight":
      return t("nutritionMembershipGoal.option.loseWeight");
    case "gain-weight":
      return t("nutritionMembershipGoal.option.gainWeight");
    case "maintain-weight":
      return t("nutritionMembershipGoal.option.maintainWeight");
    default:
      return emptyText;
  }
}

function genderLabel(gender: string | null | undefined, emptyText: string, t: (key: MessageKey) => string) {
  return gender === "female" ? t("nutritionMembershipGender.option.female") : gender === "male" ? t("nutritionMembershipGender.option.male") : emptyText;
}

function athleteLabel(mode: string | null | undefined, emptyText: string, t: (key: MessageKey) => string) {
  return mode === "athlete" ? t("nutritionMembershipActivity.athlete.athlete") : mode === "non-athlete" ? t("nutritionMembershipActivity.athlete.nonAthlete") : emptyText;
}

function activityLabel(level: string | null | undefined, emptyText: string, t: (key: MessageKey) => string) {
  switch (level) {
    case "very-low":
      return t("nutritionMembershipActivity.level.veryLow");
    case "medium":
      return t("nutritionMembershipActivity.level.medium");
    case "high":
      return t("nutritionMembershipActivity.level.high");
    case "intense":
      return t("nutritionMembershipActivity.level.intense");
    default:
      return emptyText;
  }
}

function weeklyWeightChangeLabel(value: number | undefined, emptyText: string, formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string, t: (key: MessageKey, params?: Record<string, string | number>) => string) {
  if (!value) {
    return emptyText;
  }

  return t("nutritionMembershipReview.weeklyWeightChange", { value: formatNumber(value, { maximumFractionDigits: 1 }) });
}

function compactText(value: string | null | undefined, emptyText: string, maxLength = 48) {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return emptyText;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
}

function breakLongText(value: React.ReactNode) {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .split(/(\s+)/)
    .map((part, index) => (part.trim().length > 18 ? <span key={`${part}-${index}`} className="break-all">{part}</span> : part));
}

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  href: string;
}) {
  const [, setLocation] = useLocation();

  return (
    <div className="grid min-w-0 grid-cols-[36px_minmax(0,1fr)_32px] items-center gap-3 rounded-[20px] border border-white/10 bg-[#070c14]/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] border border-amber-300/14 bg-amber-400/10 text-amber-300">
        {icon}
      </div>
      <div className="min-w-0 overflow-hidden text-start">
        <div className="truncate text-[11px] font-black leading-5 text-slate-400">{label}</div>
        <div className="mt-1 min-w-0 whitespace-normal break-words text-[13px] font-black leading-6 text-white">
          {breakLongText(value)}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setLocation(href)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] border border-white/10 bg-white/[0.04] text-slate-400 transition hover:border-amber-300/30 hover:text-amber-300"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const PROFILE_SETUP_STEP = 12;
const PROFILE_SETUP_TOTAL_STEPS = 12;

export default function NutritionMembershipReviewPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const formState = useMemo(() => getNutritionFormState(), []);
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isEditOnly = search.has("edit_only");
  const from = search.get("from") ?? "";
  const cameFromProfileHome = from === "profile_home";
  const backHref = cameFromProfileHome || isEditOnly ? "/nutrition/profile" : "/nutrition/membership/mindset/5";
  const showReturnButton = cameFromProfileHome || isEditOnly;
  const showProfileSetupProgress = !cameFromProfileHome && !isEditOnly;
  const buildEditHref = (href: string) => appendProfileHomeReviewReturn(href, cameFromProfileHome);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    api.nutrition.getProfile().then((result) => {
      if (!result.success || !result.data.profile) {
        toast({
          variant: "destructive",
          title: t("nutritionMembershipReview.toast.loadFailed"),
          description: result.message || t("nutritionMembershipReview.toast.tryAgain"),
        });
        setLocation("/nutrition/membership/goal");
        return;
      }

      const nextProfile = result.data.profile;
      setProfile(nextProfile);
      updateNutritionFormState({
        mindsetCompleted: Boolean(nextProfile.mindsetCompletedAt),
        mindsetAnswers: nextProfile.mindsetAnswers ?? formState.mindsetAnswers ?? {},
      });
      setLoading(false);
    });
  }, [formState.mindsetAnswers, isLoading, setLocation, t, toast, user]);

  if (isLoading || loading || !profile) {
    return (
      <div className="relative isolate min-h-screen bg-[#0a1224] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_28%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center text-[13px] font-black text-slate-300">{t("nutritionMembershipReview.loading")}</div>
      </div>
    );
  }

  const mindsetAnswers = profile.mindsetAnswers ?? {};
  const emptyText = t("nutritionMembershipReview.emptyValue");
  return (
    <div className="relative isolate min-h-screen overflow-y-auto bg-[#0a1224] text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[390px] flex-col px-5 pb-8 pt-7">
        <NutritionTopbar backHref={backHref} title={t("nutritionMembershipShared.topbarTitle")} description={t("nutritionMembershipReview.topbarDescription")} variant="hero" />

        {showProfileSetupProgress ? (
          <div className="mt-7 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-extrabold">
              <div className="text-amber-300">{t("nutritionMembershipReview.stepCounter", { current: format.number(PROFILE_SETUP_STEP), total: format.number(PROFILE_SETUP_TOTAL_STEPS) })}</div>
              <div className="text-slate-400">{t("nutritionMembershipShared.topbarTitle")}</div>
            </div>
            <div className="grid grid-cols-[repeat(12,minmax(0,1fr))] gap-1" dir={dir}>
              {Array.from({ length: PROFILE_SETUP_TOTAL_STEPS }).map((_, index) => (
                <div
                  key={`review-step-${index}`}
                  className={cn("h-1 rounded-full", index < PROFILE_SETUP_STEP ? "bg-amber-400" : "bg-white/10")}
                />
              ))}
            </div>
          </div>
        ) : null}

        <main className={cn(
          "rounded-[28px] border border-white/10 bg-[#070d18]/35 px-5 pb-5 pt-8 shadow-[0_30px_85px_-55px_rgba(0,0,0,0.95)]",
          showProfileSetupProgress ? "mt-7" : "mt-8",
        )}>
          <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[22px] border border-amber-300/24 bg-amber-400/10 text-amber-300 shadow-[0_24px_55px_-38px_rgba(251,191,36,0.75)]">
            <ClipboardPlus className="h-8 w-8" />
          </div>

          <div className="mt-6 space-y-3 text-center">
            <div className="text-[13px] font-black text-amber-300">{t("nutritionMembershipReview.finalReview")}</div>
            <h1 className={cn("font-black leading-[1.55] text-white", isEditOnly ? "text-[22px]" : "text-[25px]")}>
              {isEditOnly ? t("nutritionMembershipReview.editTitle") : t("nutritionMembershipReview.title")}
            </h1>
            <p className="mx-auto max-w-[300px] text-[13px] font-bold leading-7 text-slate-400">
              {t("nutritionMembershipReview.description")}
            </p>
          </div>

          <section className="mt-7 rounded-[24px] border border-amber-300/18 bg-[#070c14]/70 p-4 shadow-[0_20px_50px_-38px_rgba(251,191,36,0.55)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[14px] font-black text-white">{t("nutritionMembershipReview.mainInfo")}</div>
              <div className="rounded-[12px] bg-amber-400/10 px-3 py-1 text-[11px] font-black text-amber-300">{t("nutritionMembershipReview.editable")}</div>
            </div>
            <div className="grid gap-2.5">
            <InfoRow icon={<Flag className="h-5 w-5" />} label={t("nutritionMembershipReview.label.goal")} value={goalLabel(profile.dietGoal, emptyText, t)} href={buildEditHref("/nutrition/membership/goal")} />
            <InfoRow icon={<UserRound className="h-5 w-5" />} label={t("nutritionMembershipReview.label.gender")} value={genderLabel(profile.gender, emptyText, t)} href={buildEditHref("/nutrition/membership/gender")} />
            <InfoRow icon={<Dumbbell className="h-5 w-5" />} label={t("nutritionMembershipReview.label.athlete")} value={athleteLabel(profile.athleteMode, emptyText, t)} href={buildEditHref("/nutrition/membership/activity")} />
            <InfoRow icon={<BriefcaseMedical className="h-5 w-5" />} label={t("nutritionMembershipReview.label.activity")} value={activityLabel(profile.activityLevel, emptyText, t)} href={buildEditHref("/nutrition/membership/activity")} />
            <InfoRow icon={<CalendarDays className="h-5 w-5" />} label={t("nutritionMembershipReview.label.birthDate")} value={formatBirthDate(profile.birthDate, emptyText, format.date)} href={buildEditHref("/nutrition/membership/birth-date")} />
            <InfoRow icon={<Ruler className="h-5 w-5" />} label={t("nutritionMembershipReview.label.height")} value={t("nutritionMembershipReview.cmValue", { value: formatValue(profile.heightCm, emptyText, format.number) })} href={buildEditHref("/nutrition/membership/height")} />
            <InfoRow icon={<Scale className="h-5 w-5" />} label={t("nutritionMembershipReview.label.currentWeight")} value={t("nutritionMembershipNext.weightValue", { value: formatValue(profile.weightKg, emptyText, format.number) })} href={buildEditHref("/nutrition/membership/weight")} />
            <InfoRow icon={<Target className="h-5 w-5" />} label={t("nutritionMembershipReview.label.targetWeight")} value={t("nutritionMembershipNext.weightValue", { value: formatValue(profile.targetWeightKg, emptyText, format.number) })} href={buildEditHref("/nutrition/membership/target-weight")} />
            <InfoRow icon={<Target className="h-5 w-5" />} label={t("nutritionMembershipReview.label.weeklyChange")} value={weeklyWeightChangeLabel(formState.weeklyWeightChangeKg, emptyText, format.number, t)} href={buildEditHref("/nutrition/membership/result")} />
            <InfoRow
              icon={<ClipboardPlus className="h-5 w-5" />}
              label={t("nutritionMembershipReview.label.medicalConditions")}
              value={<MedicalConditionsSummary items={profile.medicalConditionsItems} />}
              href={buildEditHref("/nutrition/membership/medical-conditions")}
            />
            <InfoRow icon={<Pill className="h-5 w-5" />} label={t("nutritionMembershipReview.label.medications")} value={compactText(profile.medicationsAndSupplements, emptyText)} href={buildEditHref("/nutrition/membership/medications-and-supplements")} />
            <InfoRow icon={<Ban className="h-5 w-5" />} label={t("nutritionMembershipReview.label.dislikedFoods")} value={compactText(profile.dislikedFoods, emptyText)} href={buildEditHref("/nutrition/membership/disliked-foods")} />
            <InfoRow icon={<ShieldAlert className="h-5 w-5" />} label={t("nutritionMembershipReview.label.allergies")} value={compactText(profile.foodAllergies, emptyText)} href={buildEditHref("/nutrition/membership/allergies")} />
            </div>
          </section>

          <section className="mt-5 rounded-[24px] border border-white/10 bg-[#070c14]/70 p-4 shadow-[0_20px_50px_-42px_rgba(0,0,0,0.95)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[14px] font-black text-white">{t("nutritionMembershipReview.mindsetAnswers")}</div>
              <div className="rounded-[12px] bg-white/[0.06] px-3 py-1 text-[11px] font-black text-slate-400">{t("nutritionMembershipReview.mindsetBadge")}</div>
            </div>
            <div className="grid gap-2.5">
            {QUESTION_LABELS.map((item) => (
              <InfoRow
                key={item.key}
                icon={<BriefcaseMedical className="h-5 w-5" />}
                label={t(item.titleKey)}
                value={mindsetAnswers[item.key] || emptyText}
                href={buildEditHref(item.href)}
              />
            ))}
            </div>
          </section>
        </main>

        <div className="mt-auto pt-6">
          {showReturnButton ? (
            <Button
              type="button"
              onClick={() => setLocation(backHref)}
              className="h-[52px] w-full rounded-[16px] bg-gradient-to-l from-amber-500 to-amber-300 text-[14px] font-black text-slate-950 shadow-[0_24px_54px_-34px_rgba(251,191,36,0.9)] hover:from-amber-400 hover:to-amber-300"
            >
              {t("nutritionMembershipReview.backToProfile")}
              <ArrowLeft className={isRtl ? "ms-2 h-4 w-4" : "me-2 h-4 w-4 rotate-180"} />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setLocation("/nutrition/diet-type")}
              className="h-[52px] w-full rounded-[16px] bg-gradient-to-l from-amber-500 to-amber-300 text-[14px] font-black text-slate-950 shadow-[0_24px_54px_-34px_rgba(251,191,36,0.9)] hover:from-amber-400 hover:to-amber-300"
            >
              {t("nutritionMembershipShared.continueSteps")}
              <ArrowLeft className={isRtl ? "ms-2 h-4 w-4" : "me-2 h-4 w-4 rotate-180"} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
