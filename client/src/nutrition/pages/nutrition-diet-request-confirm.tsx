import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Clock, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NutritionPackageSubscription, NutritionProfile } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { getNutritionFormState } from "@/nutrition/lib/nutrition-form-state";

const DIET_REQUEST_SUCCESS_MODAL_KEY = "nutrition:diet-request-success-modal";

function goalLabel(goal: NutritionProfile["dietGoal"] | null | undefined, t: ReturnType<typeof useT>) {
  if (goal === "lose-weight") {
    return t("nutritionDietRequestConfirm.goal.loseWeight");
  }
  if (goal === "gain-weight") {
    return t("nutritionDietRequestConfirm.goal.gainWeight");
  }
  if (goal === "maintain-weight") {
    return t("nutritionDietRequestConfirm.goal.maintainWeight");
  }
  return "—";
}

export default function NutritionDietRequestConfirmPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const formState = useMemo(() => getNutritionFormState(), []);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [subscription, setSubscription] = useState<NutritionPackageSubscription | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (formState.repeatDietFlowRequired && !formState.repeatDietCheckinCompleted) {
      setLocation("/nutrition/diet-followup/1");
      return;
    }

    if (!formState.dietRequestMode) {
      setLocation("/nutrition/diet-type");
      return;
    }

    Promise.all([api.nutrition.getProfile(), api.nutritionPackageCheckout.summary()]).then(([profileResult, summaryResult]) => {
      if (!profileResult.success || !profileResult.data.profile) {
        setLocation("/nutrition/profile");
        return;
      }

      setProfile(profileResult.data.profile);
      setSubscription(summaryResult.success ? summaryResult.data.subscription ?? null : null);
      setLoading(false);
    });
  }, [formState.dietRequestMode, formState.repeatDietCheckinCompleted, formState.repeatDietFlowRequired, isLoading, setLocation, user]);

  if (isLoading || loading || !profile) {
    return (
      <div className="relative isolate min-h-screen bg-[#06131d] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_30%),linear-gradient(180deg,rgba(6,19,29,0.96),rgba(4,10,17,1))]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  const remainingCount = formState.dietRequestMode === "ai"
    ? (subscription?.onlineDietRemaining ?? 0)
    : (subscription?.offlineDietRemaining ?? 0);
  const hasAvailableQuota = remainingCount > 0;
  const noQuotaMessage = !subscription
    ? t("nutritionDietRequestConfirm.noQuota.noSubscription")
    : formState.dietRequestMode === "ai"
      ? t("nutritionDietRequestConfirm.noQuota.ai")
      : t("nutritionDietRequestConfirm.noQuota.expert");
  const backHref = formState.dietRequestMode === "ai"
    ? formState.selectedDietTemplateId || formState.repeatDietFlowRequired
      ? "/nutrition/select-diet"
      : "/nutrition/diet-type"
    : "/nutrition/diet-request/expert";

  const handleSubmit = async () => {
    if (!formState.dietRequestMode || submitting) {
      return;
    }

    if (!hasAvailableQuota) {
      setAvailabilityMessage(noQuotaMessage);
      return;
    }

    setSubmitting(true);
    setAvailabilityMessage(null);
    const result = await api.nutritionDietRequests.create({
      nutritionDietTemplateId: formState.selectedDietTemplateId,
      requestType: formState.dietRequestMode,
      expertDescription: formState.expertRequestDescription,
      currentWeightKg: formState.repeatDietWeightKg,
      repeatDietFeedback: formState.repeatDietAnswers,
      repeatDietMedicalNotes: formState.repeatDietMedicalNotes,
      repeatDietMedicalConditionsItems: formState.repeatDietMedicalConditionsItems,
    });
    setSubmitting(false);

    if (!result.success) {
      setAvailabilityMessage(result.message || t("nutritionDietRequestConfirm.error.unavailable"));
      toast({
        variant: "destructive",
        title: t("nutritionDietRequestConfirm.toast.errorTitle"),
        description: result.message,
      });
      return;
    }

    toast({
      title: t("nutritionDietRequestConfirm.toast.successTitle"),
      description: t("nutritionDietRequestConfirm.toast.successDescription"),
    });
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DIET_REQUEST_SUCCESS_MODAL_KEY, "1");
    }
    setLocation("/nutrition/profile");
  };

  return (
    <div className="relative isolate min-h-screen overflow-y-auto bg-[#03070d] px-2 py-2 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.1),transparent_25%),linear-gradient(180deg,#03070d,#050914_58%,#02050a_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-16px)] w-full max-w-[390px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,29,0.98),rgba(5,9,17,0.995)_54%,rgba(5,8,14,1))] px-5 pb-6 pt-5 shadow-[0_24px_80px_-52px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.04)]">
        <NutritionTopbar
          backHref={backHref}
          title={t("nutritionDietRequestConfirm.topbarTitle")}
          description={t("nutritionDietRequestConfirm.topbarDescription")}
          variant="hero"
          compact
        />

        <section className="mt-5 text-center">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-[12px] border border-amber-300/28 bg-amber-400/10 text-amber-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="mt-2.5 text-[11px] font-black text-amber-300">{t("nutritionDietRequestConfirm.eyebrow")}</div>
          <h1 className="mt-2.5 text-[20px] font-black leading-8 text-white">{t("nutritionDietRequestConfirm.title")}</h1>
          <button
            type="button"
            onClick={() => setLocation("/nutrition/diet-type")}
            className="mt-2 inline-flex items-center justify-center rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-1.5 text-[11px] font-black text-amber-200 transition hover:border-amber-300/45 hover:bg-amber-300/15"
          >
            {t("nutritionDietRequestConfirm.edit")}
          </button>
        </section>

        <main className="mt-4 flex flex-1 flex-col">
          <div className="grid grid-cols-1 gap-2.5">
            <div className="rounded-[18px] border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-center gap-2 text-[11px] font-black text-slate-400">
                <span className="flex h-6 w-6 items-center justify-center rounded-[9px] bg-amber-400/12 text-amber-300">
                  <Clock className="h-3.5 w-3.5" />
                </span>
                {t("nutritionDietRequestConfirm.currentWeight")}
              </div>
              <div className="mt-3 text-start text-[18px] font-black leading-7 text-white">
                {format.number(profile.weightKg)}
                <span className="ms-1 text-[10px] font-black text-slate-400">{t("nutritionDietRequestConfirm.kilogram")}</span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.035] px-3 py-3">
            <div className="flex items-center gap-2.5 text-[11px] font-black text-slate-400">
              <span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-emerald-400/12 text-emerald-300">
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
              {t("nutritionDietRequestConfirm.selectedGoal")}
            </div>
            <div className="text-[16px] font-black text-white">{goalLabel(profile.dietGoal, t)}</div>
          </div>

          <div className="mt-2.5 rounded-[18px] border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-[13px] font-black text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-white/[0.06] text-slate-300">
                  <CalendarDays className="h-3.5 w-3.5" />
                </span>
                {t("nutritionDietRequestConfirm.remainingDietCount")}
              </div>
              <div className={`rounded-full px-2.5 py-1 text-[11px] font-black ${hasAvailableQuota ? "bg-emerald-400/12 text-emerald-300" : "bg-rose-400/12 text-rose-300"}`}>
                {t("nutritionDietRequestConfirm.remainingDietBadge", { count: format.number(remainingCount) })}
              </div>
            </div>
          </div>

          {formState.repeatDietFlowRequired ? (
            <div className="mt-2.5 rounded-[18px] border border-amber-300/20 bg-amber-300/10 p-3">
              <div className="text-[12px] font-black text-amber-100">{t("nutritionDietRequestConfirm.previousPeriodTitle")}</div>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <div className="rounded-[14px] border border-white/10 bg-white/[0.04] p-2.5">
                  <div className="text-[11px] font-bold text-slate-400">{t("nutritionDietRequestConfirm.newWeight")}</div>
                  <div className="mt-1 text-[12px] font-black text-white">
                    {formState.repeatDietWeightKg ? t("nutritionDietRequestConfirm.weightValue", { value: format.number(Number(formState.repeatDietWeightKg)) }) : "—"}
                  </div>
                </div>
                <div className="rounded-[14px] border border-white/10 bg-white/[0.04] p-2.5">
                  <div className="text-[11px] font-bold text-slate-400">{t("nutritionDietRequestConfirm.previousAdherence")}</div>
                  <div className="mt-1 text-[12px] font-black leading-6 text-white">{formState.repeatDietAnswers?.adherenceLevel || "—"}</div>
                </div>
              </div>
              <div className="mt-2.5 text-[11px] leading-6 text-slate-200">
                {formState.repeatDietMedicalNotes?.trim() || t("nutritionDietRequestConfirm.noMedicalNotes")}
              </div>
            </div>
          ) : null}

          {formState.dietRequestMode === "expert" ? (
            <div className="mt-2.5 rounded-[18px] border border-cyan-400/20 bg-cyan-400/10 p-3">
              <div className="text-[12px] font-black text-cyan-100">{t("nutritionDietRequestConfirm.expertDescriptionTitle")}</div>
              <div className="mt-2 text-[11px] leading-6 text-slate-100">
                {formState.expertRequestDescription?.trim() || t("nutritionDietRequestConfirm.noExpertDescription")}
              </div>
            </div>
          ) : null}

          {availabilityMessage || !hasAvailableQuota ? (
            <div className="mt-2.5 rounded-[18px] border border-rose-400/20 bg-rose-400/10 p-3">
              <div className="text-[12px] font-black text-rose-200">{availabilityMessage || noQuotaMessage}</div>
              <div className="mt-2 text-[11px] leading-6 text-rose-100/80">
                {t("nutritionDietRequestConfirm.noQuotaHelp")}
              </div>
            </div>
          ) : null}
        </main>

        <div className="mt-auto pt-5">
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !hasAvailableQuota}
            className="h-[49px] w-full rounded-[16px] bg-gradient-to-l from-amber-500 to-amber-300 text-[13px] font-black text-slate-950 shadow-[0_22px_48px_-30px_rgba(251,191,36,0.95)] hover:from-amber-400 hover:to-amber-300 disabled:opacity-70"
          >
            {submitting ? t("nutritionDietRequestConfirm.submitting") : t("nutritionDietRequestConfirm.submit")}
            <ArrowLeft className={`h-4 w-4 ${isRtl ? "ms-2" : "me-2 rotate-180"}`} />
          </Button>

          {!hasAvailableQuota ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/nutrition/membership/packages")}
              className="mt-3 h-12 w-full rounded-[16px] border-white/10 bg-white/5 text-[13px] text-white hover:bg-white/10"
            >
              {t("nutritionDietRequestConfirm.buyPackage")}
              <ArrowLeft className={`h-4 w-4 ${isRtl ? "ms-2" : "me-2 rotate-180"}`} />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
