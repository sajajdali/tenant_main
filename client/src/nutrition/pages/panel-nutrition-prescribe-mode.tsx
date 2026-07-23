import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, FileArchive, Loader2, Sparkles, Stethoscope } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { getPanelNutritionPrescribeState, updatePanelNutritionPrescribeState } from "@/nutrition/lib/panel-nutrition-prescribe-state";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { NutritionPackageSubscription } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";

export default function PanelNutritionPrescribeModePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const state = useMemo(() => getPanelNutritionPrescribeState(), []);
  const [loading, setLoading] = useState(true);
  const [submittingExpert, setSubmittingExpert] = useState(false);
  const [subscription, setSubscription] = useState<NutritionPackageSubscription | null>(null);
  const [exhaustedDialogMode, setExhaustedDialogMode] = useState<"ai" | "expert" | null>(null);

  useEffect(() => {
    if (!state.mobile || !state.selectedNutritionPackageId) {
      setLocation("/panel/nutrition/prescribe/review");
      return;
    }

    api.nutritionAdminUsers.show(state.mobile).then((result) => {
      if (result.success) {
        setSubscription(result.data.subscription ?? null);
      } else {
        toast({ variant: "destructive", title: t("panelNutritionPrescribeMode.toast.subscriptionLoadFailed"), description: result.message });
      }

      setLoading(false);
    });
  }, [setLocation, state.mobile, state.selectedNutritionPackageId, t, toast]);

  if (!state.mobile || !state.selectedNutritionPackageId) {
    return null;
  }

  const aiRemaining = subscription?.onlineDietRemaining ?? 0;
  const expertRemaining = subscription?.offlineDietRemaining ?? 0;
  const aiIncluded = subscription ? subscription.onlineDietTotal > 0 : true;
  const expertIncluded = subscription ? subscription.offlineDietTotal > 0 : true;
  const aiExhausted = subscription !== null && (!aiIncluded || aiRemaining <= 0);
  const expertExhausted = subscription !== null && (!expertIncluded || expertRemaining <= 0);
  const exhaustedDialogTitle = exhaustedDialogMode === "ai" ? t("panelNutritionPrescribeMode.dialog.aiTitle") : t("panelNutritionPrescribeMode.dialog.expertTitle");
  const exhaustedDialogDescription = exhaustedDialogMode === "ai"
    ? t("panelNutritionPrescribeMode.dialog.aiDescription")
    : t("panelNutritionPrescribeMode.dialog.expertDescription");
  const backHref = state.mobile ? `/panel/nutrition/prescribe/users/${encodeURIComponent(state.mobile)}` : "/panel/nutrition/prescribe";

  const handleSelectAi = () => {
    if (aiExhausted) {
      setExhaustedDialogMode("ai");
      return;
    }

    updatePanelNutritionPrescribeState({
      dietRequestMode: "ai",
      selectedDietTemplateId: null,
      selectedDietTemplateName: null,
    });
    setLocation("/panel/nutrition/prescribe/templates");
  };

  const handleSelectExpert = async () => {
    if (expertExhausted) {
      setExhaustedDialogMode("expert");
      return;
    }

    setSubmittingExpert(true);
    updatePanelNutritionPrescribeState({
      dietRequestMode: "expert",
      selectedDietTemplateId: null,
      selectedDietTemplateName: null,
    });

    const result = await api.nutritionAdminUsers.createDietRequest({
      mobile: state.mobile!,
      requestType: "expert",
    });

    if (result.success) {
      toast({
        title: t("panelNutritionPrescribeMode.toast.expertCreated"),
        description: t("panelNutritionPrescribeMode.toast.expertCreatedDescription"),
      });
      setLocation(`/panel/nutrition/requests/${result.data.requestId}`);
    } else {
      toast({
        variant: "destructive",
        title: t("panelNutritionPrescribeMode.toast.expertCreateFailed"),
        description: result.message,
      });
    }

    setSubmittingExpert(false);
  };

  if (loading) {
    return (
      <div className="relative isolate min-h-screen bg-[#06131d] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_30%),linear-gradient(180deg,rgba(6,19,29,0.96),rgba(4,10,17,1))]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] px-4 py-8 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_30%),linear-gradient(180deg,rgba(6,19,29,0.96),rgba(4,10,17,1))]" />

      <div className="relative z-10 mx-auto max-w-md space-y-5">
        <NutritionTopbar backHref={backHref} title={t("panelNutritionPrescribeMode.topbarTitle")} description={t("panelNutritionPrescribeMode.topbarDescription")} />

        <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(160deg,rgba(14,28,43,0.95),rgba(7,16,26,0.92))] p-5 shadow-[0_35px_90px_-52px_rgba(0,0,0,0.95)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/80">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            {t("panelNutritionPrescribeMode.eyebrow")}
          </div>

          <h1 className="mt-4 text-3xl font-black leading-tight">{t("panelNutritionPrescribeMode.title")}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {t("panelNutritionPrescribeMode.description")}
          </p>

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={handleSelectAi}
              className={`w-full rounded-[30px] p-5 text-start text-slate-950 shadow-[0_28px_70px_-36px_rgba(242,182,64,0.85)] transition ${aiExhausted ? "border border-white/10 bg-[linear-gradient(145deg,rgba(148,163,184,0.3)_0%,rgba(100,116,139,0.24)_45%,rgba(148,163,184,0.2)_100%)] text-slate-200 shadow-none grayscale" : "bg-[linear-gradient(145deg,#f4b63f_0%,#f2a43a_40%,#f7d286_100%)]"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${aiExhausted ? "border border-white/10 bg-white/10 text-white/70" : "bg-slate-950/10"}`}>{t("panelNutritionPrescribeMode.ai.badge")}</div>
                    {aiExhausted ? (
                      <div className="inline-flex rounded-full border border-rose-200/20 bg-rose-200/12 px-3 py-1 text-[11px] font-black text-rose-50">
                        {t("panelNutritionPrescribeMode.noQuota")}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-2xl font-black">{t("panelNutritionPrescribeMode.ai.title")}</div>
                  <div className={`text-sm leading-7 ${aiExhausted ? "text-slate-300" : "text-slate-800/80"}`}>
                    {t("panelNutritionPrescribeMode.ai.description")}
                  </div>
                  {subscription ? (
                    <div className={`text-xs font-bold ${aiExhausted ? "text-rose-100" : "text-slate-900/70"}`}>
                      {t("panelNutritionPrescribeMode.remainingQuota", { count: format.number(aiRemaining) })}
                    </div>
                  ) : null}
                </div>
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] ${aiExhausted ? "border border-white/10 bg-white/5 text-slate-300/70" : "bg-slate-950/10 text-slate-950"}`}>
                  <Bot className="h-7 w-7" />
                </div>
              </div>
            </button>

            <button
              type="button"
              disabled={submittingExpert}
              onClick={() => void handleSelectExpert()}
              className={`w-full rounded-[30px] border border-white/10 p-5 text-start text-white transition ${expertExhausted ? "bg-[linear-gradient(160deg,rgba(36,45,58,0.78),rgba(22,29,38,0.74))] text-slate-300 shadow-none grayscale" : "bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.85))] shadow-[0_28px_70px_-44px_rgba(0,0,0,0.95)]"} ${submittingExpert ? "pointer-events-none opacity-80" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold">{t("panelNutritionPrescribeMode.expert.badge")}</div>
                    {expertExhausted ? (
                      <div className="inline-flex rounded-full border border-rose-200/20 bg-rose-200/12 px-3 py-1 text-[11px] font-black text-rose-50">
                        {t("panelNutritionPrescribeMode.noQuota")}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-2xl font-black">{t("panelNutritionPrescribeMode.expert.title")}</div>
                  <div className="text-sm leading-7 text-slate-300">
                    {t("panelNutritionPrescribeMode.expert.description")}
                  </div>
                  {subscription ? (
                    <div className={`text-xs font-bold ${expertExhausted ? "text-rose-100" : "text-slate-300/80"}`}>
                      {t("panelNutritionPrescribeMode.remainingQuota", { count: format.number(expertRemaining) })}
                    </div>
                  ) : null}
                </div>
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] ${expertExhausted ? "border border-white/10 bg-white/5 text-slate-400/70" : "bg-cyan-400/12 text-cyan-300"}`}>
                  {submittingExpert ? <Loader2 className="h-7 w-7 animate-spin" /> : <Stethoscope className="h-7 w-7" />}
                </div>
              </div>
            </button>
          </div>

          <div className="mt-5 rounded-[26px] border border-white/10 bg-white/[0.04] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/5 text-amber-300">
                <FileArchive className="h-6 w-6" />
              </div>
              <div className="text-sm leading-7 text-slate-300">
                {t("panelNutritionPrescribeMode.expertNote")}
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation(backHref)}
            className="mt-5 h-13 w-full rounded-[18px] border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            {t("common.back")}
            <ArrowLeft className={`ms-2 h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />
          </Button>
        </section>
      </div>

      <Dialog open={exhaustedDialogMode !== null} onOpenChange={(open) => !open && setExhaustedDialogMode(null)}>
        <DialogContent dir={dir} className="max-w-sm border-white/10 bg-[linear-gradient(160deg,rgba(14,28,43,0.98),rgba(7,16,26,0.98))] text-start text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white">{exhaustedDialogTitle}</DialogTitle>
            <DialogDescription className="leading-7 text-slate-300">
              {exhaustedDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-col-reverse">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExhaustedDialogMode(null)}
              className="w-full rounded-[16px] border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              {t("common.close")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setExhaustedDialogMode(null);
                setLocation("/panel/nutrition/prescribe/packages");
              }}
              className="w-full rounded-[16px] bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] font-black text-slate-950 hover:opacity-95"
            >
              {t("panelNutritionPrescribeMode.chooseAnotherPackage")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
