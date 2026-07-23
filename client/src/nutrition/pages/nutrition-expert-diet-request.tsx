import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Sparkles, Stethoscope } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLocale, useT } from "@/i18n/locale";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";

export default function NutritionExpertDietRequestPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const t = useT();
  const { dir, isRtl } = useLocale();
  const formState = useMemo(() => getNutritionFormState(), []);
  const [description, setDescription] = useState(formState.expertRequestDescription ?? "");

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (isLoading || !user) {
      return;
    }

    if (formState.dietRequestMode !== "expert") {
      setLocation("/nutrition/diet-type");
      return;
    }

    if (formState.repeatDietFlowRequired && !formState.repeatDietCheckinCompleted) {
      setLocation("/nutrition/diet-followup/1");
      return;
    }

    Promise.all([api.nutrition.getProfile(), api.nutritionPrescriptions.list()]).then(([profileResult, prescriptionsResult]) => {
      const profile = profileResult.success ? profileResult.data.profile : null;
      const hasPreviousDiet = Boolean(prescriptionsResult.success ? prescriptionsResult.data.items?.length : 0);

      if (!hasPreviousDiet && !profile?.mindsetCompletedAt) {
        setLocation("/nutrition/membership/mindset/1");
      }
    });
  }, [formState.dietRequestMode, formState.repeatDietCheckinCompleted, formState.repeatDietFlowRequired, isLoading, setLocation, user]);

  if (isLoading) {
    return (
      <div className="relative isolate min-h-screen bg-[#06131d] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_24%),linear-gradient(180deg,rgba(6,19,29,0.96),rgba(4,10,17,1))]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] px-4 py-8 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,rgba(6,19,29,0.96),rgba(4,10,17,1))]" />

      <div className="relative z-10 mx-auto max-w-md space-y-5">
        <NutritionTopbar
          backHref="/nutrition/diet-type"
          title={t("nutritionExpertDietRequest.topbarTitle")}
          description={t("nutritionExpertDietRequest.topbarDescription")}
        />

        <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(160deg,rgba(14,28,43,0.95),rgba(7,16,26,0.92))] p-5 shadow-[0_35px_90px_-52px_rgba(0,0,0,0.95)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/80">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            {t("nutritionExpertDietRequest.badge")}
          </div>

          <div className="mt-5 flex h-16 w-16 items-center justify-center rounded-[24px] bg-cyan-400/12 text-cyan-300">
            <Stethoscope className="h-8 w-8" />
          </div>

          <h1 className="mt-5 text-3xl font-black leading-tight">{t("nutritionExpertDietRequest.title")}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {t("nutritionExpertDietRequest.description")}
          </p>

          <div className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <label htmlFor="expert-request-description" className="text-sm font-black text-white">
              {t("nutritionExpertDietRequest.fieldLabel")}
            </label>
            <Textarea
              id="expert-request-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-3 min-h-40 rounded-[24px] border-white/10 bg-slate-950/20 leading-8 text-white"
              placeholder={t("nutritionExpertDietRequest.placeholder")}
            />
          </div>

          <Button
            type="button"
            onClick={() => {
              updateNutritionFormState({
                dietRequestMode: "expert",
                selectedDietTemplateId: undefined,
                selectedDietTemplateName: undefined,
                expertRequestDescription: description.trim(),
              });
              setLocation("/nutrition/diet-request/confirm");
            }}
            className="mt-5 h-14 w-full rounded-[18px] bg-cyan-400 font-black text-slate-950 shadow-[0_24px_55px_-30px_rgba(34,211,238,0.75)] hover:bg-cyan-300"
          >
            {t("nutritionExpertDietRequest.submit")}
            <ArrowLeft className={`h-5 w-5 ${isRtl ? "ms-2" : "me-2 rotate-180"}`} />
          </Button>
        </section>
      </div>
    </div>
  );
}
