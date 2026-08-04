import { useEffect, useState } from "react";
import { ArrowLeft, Bot, Check, CheckCircle2, Loader2, PackageOpen, Stethoscope } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { NutritionDietRequest, NutritionPackageSubscription } from "@/lib/types";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { useFormat, useLocale, useT } from "@/i18n/locale";

export default function NutritionDietTypePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [activeRequest, setActiveRequest] = useState<NutritionDietRequest | null>(null);
  const [hasDietHistory, setHasDietHistory] = useState(false);
  const [subscription, setSubscription] = useState<NutritionPackageSubscription | null>(null);
  const [modeNextSteps, setModeNextSteps] = useState<Record<"ai" | "expert", string | null>>({ ai: null, expert: null });
  const [exhaustedDialogMode, setExhaustedDialogMode] = useState<"ai" | "expert" | null>(null);

  useEffect(() => {
    Promise.all([api.nutrition.getProfile(), api.nutritionDietRequests.listMine(), api.nutritionPrescriptions.list(), api.nutritionPackageCheckout.summary(), api.nutritionDietRequests.options()]).then(([profileResult, requestsResult, prescriptionsResult, summaryResult, optionsResult]) => {
      const profile = profileResult.success ? profileResult.data.profile : null;
      const hasPreviousDiet = Boolean(prescriptionsResult.success ? prescriptionsResult.data.items?.length : 0);

      if (!hasPreviousDiet && !profile?.mindsetCompletedAt) {
        setLocation("/nutrition/membership/mindset/1");
        return;
      }

      const currentActiveRequest = requestsResult.success
        ? requestsResult.data.items.find((item) => item.status === "sent" || item.status === "in_progress" || item.status === "not_sent") ?? null
        : null;
      const currentSubscription = summaryResult.success ? summaryResult.data.subscription ?? null : null;
      const aiModeNextStep = optionsResult.success
        ? optionsResult.data.modes.find((mode) => mode.key === "ai")?.nextStep
        : null;
      const firstAutoDietAvailable = !hasPreviousDiet && aiModeNextStep === "/nutrition/diet-request/confirm";
      const availableModes: Array<"ai" | "expert"> = currentSubscription
        ? [
            currentSubscription.onlineDietRemaining > 0 ? "ai" as const : null,
            currentSubscription.offlineDietRemaining > 0 ? "expert" as const : null,
          ].filter((mode): mode is "ai" | "expert" => mode !== null)
        : [];

      if (!currentActiveRequest && currentSubscription && firstAutoDietAvailable) {
        updateNutritionFormState({
          dietRequestMode: "ai",
          selectedDietTemplateId: undefined,
          selectedDietTemplateName: undefined,
          expertRequestDescription: undefined,
          repeatDietFlowRequired: false,
          repeatDietCheckinCompleted: undefined,
          repeatDietAnswers: undefined,
          repeatDietWeightKg: undefined,
          repeatDietMedicalNotes: undefined,
          repeatDietMedicalConditionsItems: undefined,
        });
        setLocation("/nutrition/diet-request/confirm");
        return;
      }

      if (!currentActiveRequest && currentSubscription && availableModes.length === 1) {
        const onlyMode = availableModes[0];
        updateNutritionFormState({
          dietRequestMode: onlyMode,
          selectedDietTemplateId: undefined,
          selectedDietTemplateName: undefined,
          expertRequestDescription: onlyMode === "expert" ? "" : undefined,
          repeatDietFlowRequired: hasPreviousDiet,
          repeatDietCheckinCompleted: hasPreviousDiet ? false : undefined,
          repeatDietAnswers: hasPreviousDiet ? {} : undefined,
          repeatDietWeightKg: undefined,
          repeatDietMedicalNotes: undefined,
          repeatDietMedicalConditionsItems: undefined,
        });
        const onlyModeNextStep = optionsResult.success
          ? optionsResult.data.modes.find((mode) => mode.key === onlyMode)?.nextStep
          : null;
        setLocation(hasPreviousDiet ? "/nutrition/diet-followup/1" : onlyModeNextStep ?? (onlyMode === "ai" ? "/nutrition/select-diet" : "/nutrition/diet-request/expert"));
        return;
      }

      setActiveRequest(currentActiveRequest);
      setHasDietHistory(hasPreviousDiet);
      setSubscription(currentSubscription);
      setModeNextSteps({
        ai: optionsResult.success ? optionsResult.data.modes.find((mode) => mode.key === "ai")?.nextStep ?? null : null,
        expert: optionsResult.success ? optionsResult.data.modes.find((mode) => mode.key === "expert")?.nextStep ?? null : null,
      });
      setLoading(false);
    });
  }, [setLocation]);

  const handleSelect = (mode: "ai" | "expert") => {
    if (activeRequest) {
      toast({
        variant: "destructive",
        title: t("nutritionDietType.toast.activeRequestTitle"),
        description: t("nutritionDietType.toast.activeRequestDescription"),
      });
      return;
    }

    if (!subscription || subscription.status !== "active") {
      toast({
        variant: "destructive",
        title: t("nutritionDietType.noActivePackageTitle"),
        description: t("nutritionDietType.noActivePackageDescription"),
      });
      return;
    }

    const hasIncludedQuota = mode === "ai"
      ? ((subscription?.onlineDietTotal ?? 0) > 0)
      : ((subscription?.offlineDietTotal ?? 0) > 0);
    const remainingQuota = mode === "ai"
      ? (subscription?.onlineDietRemaining ?? 0)
      : (subscription?.offlineDietRemaining ?? 0);
    const modeLabel = mode === "ai" ? t("nutritionDietType.mode.aiShort") : t("nutritionDietType.mode.expertShort");

    if (subscription && !hasIncludedQuota) {
      toast({
        variant: "destructive",
        title: t("nutritionDietType.toast.modeNotIncludedTitle"),
        description: t("nutritionDietType.toast.modeNotIncludedDescription", { mode: modeLabel }),
      });
      return;
    }

    if (subscription && hasIncludedQuota && remainingQuota <= 0) {
      toast({
        variant: "destructive",
        title: t("nutritionDietType.toast.quotaExhaustedTitle"),
        description: t("nutritionDietType.toast.quotaExhaustedDescription", { mode: modeLabel }),
      });
      return;
    }

    updateNutritionFormState({
      dietRequestMode: mode,
      selectedDietTemplateId: undefined,
      selectedDietTemplateName: undefined,
      expertRequestDescription: mode === "expert" ? "" : undefined,
      repeatDietFlowRequired: hasDietHistory,
      repeatDietCheckinCompleted: hasDietHistory ? false : undefined,
      repeatDietAnswers: hasDietHistory ? {} : undefined,
      repeatDietWeightKg: undefined,
      repeatDietMedicalNotes: undefined,
      repeatDietMedicalConditionsItems: undefined,
    });
    setLocation(hasDietHistory ? "/nutrition/diet-followup/1" : modeNextSteps[mode] ?? (mode === "ai" ? "/nutrition/select-diet" : "/nutrition/diet-request/expert"));
  };

  if (loading) {
    return (
      <div className="relative isolate min-h-screen bg-[#0a1224] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.13),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.16),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  if ((!subscription || subscription.status !== "active") && !activeRequest) {
    return (
      <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] px-5 pb-8 pt-5 text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.13),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.16),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />
        <div className="relative z-10 mx-auto max-w-[390px]">
          <NutritionTopbar backHref="/nutrition/profile" title={t("nutritionDietType.topbarTitle")} description={t("nutritionDietType.topbarDescription")} variant="hero" compact />
          <section className="mt-8 rounded-[26px] border border-amber-300/25 bg-[linear-gradient(155deg,rgba(251,191,36,0.11),rgba(255,255,255,0.035))] p-5 text-center shadow-[0_30px_75px_-52px_rgba(251,191,36,0.7)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[19px] border border-amber-300/25 bg-amber-400/12 text-amber-300">
              <PackageOpen className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-[20px] font-black leading-8 text-white">{t("nutritionDietType.noActivePackageTitle")}</h1>
            <p className="mt-2 text-[12px] font-semibold leading-7 text-slate-300">{t("nutritionDietType.noActivePackageDescription")}</p>
            <Button
              type="button"
              onClick={() => setLocation("/nutrition/membership/packages?direct_buy=1")}
              className="mt-5 h-12 w-full rounded-[16px] bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] text-[13px] font-black text-slate-950 hover:opacity-95"
            >
              {t("nutritionDietType.buyPackage")}
              <ArrowLeft className={isRtl ? "ms-2 h-4 w-4" : "me-2 h-4 w-4 rotate-180"} />
            </Button>
          </section>
        </div>
      </div>
    );
  }

  const aiIncluded = subscription ? subscription.onlineDietTotal > 0 : true;
  const expertIncluded = subscription ? subscription.offlineDietTotal > 0 : true;
  const aiRemaining = subscription?.onlineDietRemaining ?? 0;
  const expertRemaining = subscription?.offlineDietRemaining ?? 0;
  const aiExhausted = subscription !== null && aiIncluded && aiRemaining <= 0;
  const expertExhausted = subscription !== null && expertIncluded && expertRemaining <= 0;
  const exhaustedDialogTitle = exhaustedDialogMode === "ai" ? t("nutritionDietType.dialog.aiTitle") : t("nutritionDietType.dialog.expertTitle");
  const exhaustedDialogDescription = exhaustedDialogMode === "ai"
    ? t("nutritionDietType.dialog.aiDescription")
    : t("nutritionDietType.dialog.expertDescription");

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] px-5 pb-8 pt-5 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.13),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.16),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto max-w-[390px]">
        <NutritionTopbar backHref="/nutrition/profile" title={t("nutritionDietType.topbarTitle")} description={t("nutritionDietType.topbarDescription")} variant="hero" compact />

        <section className="mt-7 space-y-4">
          <div className="text-start">
            <h1 className="text-[24px] font-black leading-9 text-white">{t("nutritionDietType.title")}</h1>
          </div>

          {activeRequest ? (
            <div className="rounded-[18px] border border-amber-300/20 bg-amber-300/10 p-3.5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-amber-300/10 text-amber-300">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[12px] font-black text-amber-100">{t("nutritionDietType.activeRequestTitle")}</div>
                  <div className="mt-1.5 text-[10px] leading-5 text-amber-50/85">
                    {t("nutritionDietType.activeRequestDescription")}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!activeRequest ? (
            <>
              <div className="space-y-4">
                {aiIncluded ? (
                  <button
                    type="button"
                    onClick={() => (aiExhausted ? setExhaustedDialogMode("ai") : handleSelect("ai"))}
                    className={`group relative w-full overflow-hidden rounded-[24px] border p-4 text-start transition hover:-translate-y-0.5 ${
                      aiExhausted
                        ? "cursor-pointer border-white/10 bg-[linear-gradient(145deg,rgba(36,45,58,0.92),rgba(22,29,38,0.84))] text-slate-200 grayscale"
                        : "border-amber-300/45 bg-[linear-gradient(160deg,rgba(28,27,25,0.97),rgba(15,18,25,0.98))] text-white shadow-[0_28px_70px_-48px_rgba(251,191,36,0.55)] hover:border-amber-300/75"
                    }`}
                  >
                <div className={`relative flex items-start gap-3.5 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] ${
                    aiExhausted ? "border border-white/10 bg-white/5 text-slate-300" : "bg-amber-400 text-slate-950 shadow-[0_18px_45px_-28px_rgba(251,191,36,0.9)]"
                  }`}>
                    <Bot className="h-6 w-6" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${
                        aiExhausted ? "border-white/10 bg-white/10 text-white/70" : "border-amber-300/20 bg-amber-300/12 text-amber-200"
                      }`}>
                        {t("nutritionDietType.ai.badge")}
                      </span>
                      {aiExhausted ? (
                        <span className="rounded-full border border-rose-200/20 bg-rose-200/12 px-3 py-1 text-[11px] font-black text-rose-50">{t("nutritionDietType.exhaustedBadge")}</span>
                      ) : null}
                    </div>

                    <div className="mt-3 text-[20px] font-black leading-8">{t("nutritionDietType.ai.title")}</div>
                    <div className={`mt-2 text-[11px] font-bold leading-6 ${aiExhausted ? "text-slate-300/80" : "text-slate-400"}`}>
                      {t("nutritionDietType.ai.description")}
                    </div>

                    {subscription ? (
                      <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black ${aiExhausted ? "border-rose-300/20 bg-rose-400/12 text-rose-100" : "border-emerald-300/25 bg-emerald-400/12 text-emerald-300"}`}>
                        {!aiExhausted ? <Check className="h-3.5 w-3.5" /> : null}
                        {aiExhausted
                          ? t("nutritionDietType.ai.exhausted")
                          : t("nutritionDietType.remainingQuota", { count: format.number(aiRemaining) })}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={`relative mt-4 flex min-h-[48px] items-center justify-center gap-5 rounded-[17px] px-4 py-3 text-[13px] font-black ${
                  aiExhausted
                      ? "border border-rose-300/20 bg-rose-300/10 text-rose-100"
                      : "border border-amber-200/30 bg-gradient-to-l from-amber-500 to-amber-300 text-slate-950 shadow-[0_18px_45px_-30px_rgba(251,191,36,0.95)] group-hover:brightness-105"
                }`}>
                  <span>{aiExhausted ? t("nutritionDietType.buyNewPackage") : t("nutritionDietType.selectAndContinue")}</span>
                  <ArrowLeft className={isRtl ? "h-4 w-4" : "h-4 w-4 rotate-180"} />
                </div>
                  </button>
                ) : null}

                {expertIncluded ? (
                  <button
                    type="button"
                    onClick={() => (expertExhausted ? setExhaustedDialogMode("expert") : handleSelect("expert"))}
                    className={`group relative w-full overflow-hidden rounded-[24px] border p-4 text-start text-white transition hover:-translate-y-0.5 ${
                      expertExhausted
                        ? "cursor-pointer border-white/10 bg-[linear-gradient(160deg,rgba(36,45,58,0.9),rgba(22,29,38,0.8))] text-slate-300 grayscale"
                        : "border-emerald-300/35 bg-[linear-gradient(160deg,rgba(10,31,31,0.95),rgba(10,18,25,0.98))] shadow-[0_28px_70px_-52px_rgba(16,185,129,0.48)] hover:border-emerald-300/60"
                    }`}
                  >
                <div className={`relative flex items-start gap-3.5 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] ${
                    expertExhausted ? "border border-white/10 bg-white/5 text-slate-300" : "bg-emerald-400/16 text-emerald-300 shadow-[0_18px_45px_-30px_rgba(52,211,153,0.65)]"
                  }`}>
                    <Stethoscope className="h-6 w-6" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black text-emerald-200">
                        {t("nutritionDietType.expert.badge")}
                      </span>
                      {expertExhausted ? (
                        <span className="rounded-full border border-rose-200/20 bg-rose-200/12 px-3 py-1 text-[11px] font-black text-rose-50">{t("nutritionDietType.exhaustedBadge")}</span>
                      ) : null}
                    </div>

                    <div className="mt-3 text-[20px] font-black leading-8">{t("nutritionDietType.expert.title")}</div>
                    <div className="mt-2 text-[11px] font-bold leading-6 text-slate-400">
                      {t("nutritionDietType.expert.description")}
                    </div>

                    {subscription ? (
                      <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black ${expertExhausted ? "border-rose-300/20 bg-rose-400/12 text-rose-100" : "border-emerald-300/25 bg-emerald-400/12 text-emerald-300"}`}>
                        {!expertExhausted ? <Check className="h-3.5 w-3.5" /> : null}
                        {expertExhausted
                          ? t("nutritionDietType.expert.exhausted")
                          : t("nutritionDietType.remainingQuota", { count: format.number(expertRemaining) })}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={`relative mt-4 flex min-h-[48px] items-center justify-center gap-5 rounded-[17px] px-4 py-3 text-[13px] font-black ${
                  expertExhausted
                      ? "border border-rose-300/20 bg-rose-300/10 text-rose-100"
                      : "border border-emerald-300/45 bg-emerald-400/10 text-emerald-300 group-hover:bg-emerald-400/15"
                }`}>
                  <span>{expertExhausted ? t("nutritionDietType.buyNewPackage") : t("nutritionDietType.selectAndContinue")}</span>
                  <ArrowLeft className={isRtl ? "h-4 w-4" : "h-4 w-4 rotate-180"} />
                </div>
                  </button>
                ) : null}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/nutrition/profile")}
                className="h-11 w-full rounded-[15px] border-white/10 bg-white/[0.035] text-[12px] font-black text-slate-200 hover:bg-white/10"
              >
                {t("nutritionDietType.backToProfile")}
                <ArrowLeft className={isRtl ? "ms-2 h-4 w-4" : "me-2 h-4 w-4 rotate-180"} />
              </Button>
            </>
          ) : null}
        </section>
      </div>

      <Dialog open={exhaustedDialogMode !== null} onOpenChange={(open) => !open && setExhaustedDialogMode(null)}>
        <DialogContent dir={dir} className="max-w-[calc(100vw-32px)] rounded-[22px] border-white/10 bg-[#111827] p-5 text-start text-white sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-black leading-7 text-white">{exhaustedDialogTitle}</DialogTitle>
            <DialogDescription className="text-[11px] leading-6 text-slate-300">
              {exhaustedDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-col-reverse">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExhaustedDialogMode(null)}
              className="h-11 w-full rounded-[15px] border-white/10 bg-white/5 text-[12px] text-white hover:bg-white/10"
            >
              {t("common.close")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setExhaustedDialogMode(null);
                setLocation("/nutrition/membership/my-package");
              }}
              className="h-11 w-full rounded-[15px] bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] text-[12px] font-black text-slate-950 hover:opacity-95"
            >
              {t("nutritionDietType.buyPackage")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
