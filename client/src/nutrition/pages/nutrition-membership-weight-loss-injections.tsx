import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Hash, ShieldCheck, Sparkles, Syringe, X } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { MembershipStepProgress } from "@/nutrition/components/membership-step-progress";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { PROFILE_HOME_REVIEW_HREF, isReturningToProfileHomeReview, resolveProfileHomeReviewAwareHref } from "@/nutrition/lib/membership-edit-navigation";
import { saveMembershipProfileEdit } from "@/nutrition/lib/membership-edit-persistence";
import { MEMBERSHIP_STEPS, MEMBERSHIP_TOTAL_STEPS } from "@/nutrition/lib/membership-progress";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { useLocale, useT } from "@/i18n/locale";

const PROFILE_SETUP_STEP = MEMBERSHIP_STEPS.weightLossInjections;

export default function NutritionMembershipWeightLossInjectionsPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const formState = useMemo(() => getNutritionFormState(), []);
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const shouldPersistEdit = isReturningToProfileHomeReview(searchParams);
  const backHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/medical-conditions", searchParams);
  const nextHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/medications-and-supplements", searchParams);
  const [usesInjections, setUsesInjections] = useState<boolean | undefined>(formState.usesWeightLossInjections);
  const [injectionName, setInjectionName] = useState(formState.weightLossInjectionName ?? "");
  const [doseCount, setDoseCount] = useState(
    formState.weightLossInjectionDoseCount != null ? String(formState.weightLossInjectionDoseCount) : "",
  );

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (!shouldPersistEdit && !formState.targetWeightKg) {
      setLocation("/nutrition/membership/target-weight");
      return;
    }

    if (!shouldPersistEdit && formState.medicalConditions === undefined && formState.medicalConditionsItems === undefined) {
      setLocation("/nutrition/membership/medical-conditions");
    }
  }, [formState.medicalConditions, formState.medicalConditionsItems, formState.targetWeightKg, isLoading, setLocation, shouldPersistEdit, user]);

  const chooseAnswer = (value: boolean) => {
    setUsesInjections(value);
    if (!value) {
      setInjectionName("");
      setDoseCount("");
      void handleContinue(false, "", "");
    }
  };

  const handleContinue = async (
    answer = usesInjections,
    selectedInjectionName = injectionName,
    selectedDoseCount = doseCount,
  ) => {
    if (answer === undefined) {
      toast({
        variant: "destructive",
        title: t("nutritionMembershipMedications.injection.requiredTitle"),
        description: t("nutritionMembershipMedications.injection.requiredDescription"),
      });
      return;
    }

    const normalizedName = answer ? selectedInjectionName.trim() : "";
    const parsedDose = answer && selectedDoseCount.trim() !== "" ? Number(selectedDoseCount) : undefined;
    const normalizedDose = parsedDose !== undefined && Number.isInteger(parsedDose) && parsedDose > 0
      ? parsedDose
      : undefined;

    updateNutritionFormState({
      usesWeightLossInjections: answer,
      weightLossInjectionName: normalizedName,
      weightLossInjectionDoseCount: normalizedDose,
    });

    if (shouldPersistEdit) {
      const result = await saveMembershipProfileEdit({
        step: "weight-loss-injections",
        usesWeightLossInjections: answer,
        weightLossInjectionName: normalizedName,
        weightLossInjectionDoseCount: normalizedDose,
      });
      if (!result.success) {
        toast({ variant: "destructive", title: t("nutritionMembershipShared.toast.saveFailed"), description: result.message });
        return;
      }

      setLocation(PROFILE_HOME_REVIEW_HREF);
      return;
    }

    setLocation(nextHref);
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[390px] flex-col px-5 pb-8 pt-7">
        <NutritionTopbar
          backHref={backHref}
          title={t("nutritionMembershipShared.topbarTitle")}
          description={t("nutritionMembershipWeightLossInjection.topbarDescription")}
          variant="hero"
        />

        <MembershipStepProgress step={PROFILE_SETUP_STEP} totalSteps={MEMBERSHIP_TOTAL_STEPS} />

        <main className="relative mt-7 overflow-hidden rounded-[32px] border border-emerald-200/10 bg-[linear-gradient(155deg,rgba(15,31,47,.96),rgba(5,13,25,.94))] px-5 pb-5 pt-7 shadow-[0_34px_100px_-45px_rgba(0,0,0,.95)]">
          <div className="pointer-events-none absolute -end-16 -top-20 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -start-20 top-56 h-48 w-48 rounded-full bg-sky-400/[0.07] blur-3xl" />

          <div className="relative mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-[26px] border border-emerald-200/20 bg-[linear-gradient(145deg,rgba(52,211,153,.22),rgba(16,185,129,.06))] text-emerald-200 shadow-[0_24px_65px_-28px_rgba(52,211,153,.75)]">
            <Syringe className="h-9 w-9 -rotate-12" />
            <span className="absolute -end-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-amber-200/30 bg-amber-300 text-slate-950 shadow-lg">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="relative mt-6 text-center">
            <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200/12 bg-emerald-300/[0.06] px-3 py-1.5 text-[11px] font-black text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("nutritionMembershipWeightLossInjection.badge")}
            </div>
            <h1 className="text-[20px] font-black leading-8 text-white">
              {t("nutritionMembershipMedications.injection.question")}
            </h1>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3" role="group" aria-label={t("nutritionMembershipMedications.injection.question")}>
            <button
              type="button"
              aria-pressed={usesInjections === true}
              onClick={() => chooseAnswer(true)}
              className={cn(
                "group relative min-h-[112px] overflow-hidden rounded-[23px] border p-4 text-start transition-all duration-300",
                usesInjections === true
                  ? "border-emerald-300/70 bg-[linear-gradient(145deg,rgba(16,185,129,.24),rgba(5,150,105,.08))] shadow-[0_20px_55px_-30px_rgba(52,211,153,.8)]"
                  : "border-white/10 bg-white/[0.035] hover:border-emerald-200/30 hover:bg-emerald-300/[0.06]",
              )}
            >
              <span className={cn(
                "mb-4 flex h-10 w-10 items-center justify-center rounded-[14px] border transition-colors",
                usesInjections === true ? "border-emerald-200/30 bg-emerald-300 text-slate-950" : "border-white/10 bg-white/[0.05] text-emerald-300",
              )}>
                {usesInjections === true ? <Check className="h-5 w-5" /> : <Syringe className="h-5 w-5" />}
              </span>
              <div className="text-[16px] font-black text-white">{t("nutritionMembershipMedications.injection.yes")}</div>
              <div className="mt-1 text-[10px] font-bold leading-5 text-slate-400">{t("nutritionMembershipWeightLossInjection.yesDescription")}</div>
            </button>

            <button
              type="button"
              aria-pressed={usesInjections === false}
              onClick={() => chooseAnswer(false)}
              className={cn(
                "group relative min-h-[112px] overflow-hidden rounded-[23px] border p-4 text-start transition-all duration-300",
                usesInjections === false
                  ? "border-sky-300/55 bg-[linear-gradient(145deg,rgba(56,189,248,.18),rgba(14,116,144,.06))] shadow-[0_20px_55px_-30px_rgba(56,189,248,.65)]"
                  : "border-white/10 bg-white/[0.035] hover:border-sky-200/25 hover:bg-sky-300/[0.05]",
              )}
            >
              <span className={cn(
                "mb-4 flex h-10 w-10 items-center justify-center rounded-[14px] border transition-colors",
                usesInjections === false ? "border-sky-200/30 bg-sky-300 text-slate-950" : "border-white/10 bg-white/[0.05] text-sky-300",
              )}>
                {usesInjections === false ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </span>
              <div className="text-[16px] font-black text-white">{t("nutritionMembershipMedications.injection.no")}</div>
              <div className="mt-1 text-[10px] font-bold leading-5 text-slate-400">{t("nutritionMembershipWeightLossInjection.noDescription")}</div>
            </button>
          </div>

          <div className={cn(
            "relative grid overflow-hidden transition-all duration-500 ease-out",
            usesInjections === true ? "mt-5 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0",
          )}>
            <div className="min-h-0">
              <div className="rounded-[24px] border border-emerald-200/15 bg-black/20 p-4 shadow-inner shadow-black/20">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-[12px] font-black text-emerald-100">{t("nutritionMembershipWeightLossInjection.detailsTitle")}</div>
                  <div className="rounded-full border border-white/8 bg-white/[0.05] px-2.5 py-1 text-[10px] font-black text-slate-400">
                    {t("nutritionMembershipShared.optional")}
                  </div>
                </div>

                <div className="grid gap-4">
                  <label className="grid gap-2 text-start" htmlFor="weight-loss-injection-name">
                    <span className="flex items-center gap-2 text-[12px] font-black text-slate-200">
                      <Syringe className="h-4 w-4 text-emerald-300" />
                      {t("nutritionMembershipMedications.injection.nameLabel")}
                      <span className="text-[10px] text-slate-500">({t("nutritionMembershipShared.optional")})</span>
                    </span>
                    <Input
                      id="weight-loss-injection-name"
                      value={injectionName}
                      onChange={(event) => setInjectionName(event.target.value)}
                      placeholder={t("nutritionMembershipMedications.injection.namePlaceholder")}
                      className="h-[52px] rounded-[16px] border-white/10 bg-[#07101d]/85 px-4 text-[13px] font-bold text-white shadow-inner placeholder:text-slate-600 focus-visible:border-emerald-300/60 focus-visible:ring-2 focus-visible:ring-emerald-300/20"
                    />
                  </label>

                  <label className="grid gap-2 text-start" htmlFor="weight-loss-injection-dose-count">
                    <span className="flex items-center gap-2 text-[12px] font-black text-slate-200">
                      <Hash className="h-4 w-4 text-amber-300" />
                      {t("nutritionMembershipMedications.injection.doseLabel")}
                      <span className="text-[10px] text-slate-500">({t("nutritionMembershipShared.optional")})</span>
                    </span>
                    <Input
                      id="weight-loss-injection-dose-count"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={1000}
                      dir="ltr"
                      value={doseCount}
                      onChange={(event) => setDoseCount(event.target.value)}
                      placeholder={t("nutritionMembershipMedications.injection.dosePlaceholder")}
                      className="h-[52px] rounded-[16px] border-white/10 bg-[#07101d]/85 px-4 text-center text-[14px] font-black text-white shadow-inner placeholder:text-slate-600 focus-visible:border-amber-300/60 focus-visible:ring-2 focus-visible:ring-amber-300/20"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </main>

        <div className="mt-auto pt-6">
          <Button
            type="button"
            disabled={usesInjections === undefined}
            onClick={() => void handleContinue()}
            className="h-[52px] w-full rounded-[16px] bg-gradient-to-l from-amber-500 to-amber-300 text-[14px] font-black text-slate-950 shadow-[0_24px_54px_-34px_rgba(251,191,36,0.9)] hover:from-amber-400 hover:to-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {shouldPersistEdit ? t("nutritionMembershipShared.saveChanges") : t("nutritionMembershipShared.continueSteps")}
            <ArrowLeft className={`me-2 h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}
