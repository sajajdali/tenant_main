import { CheckCircle2, ArrowLeft } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { getNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { useLocale, useT } from "@/i18n/locale";

export default function NutritionMembershipCompletePage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const formState = useMemo(() => getNutritionFormState(), []);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (!formState.completedProfileSaved) {
      setLocation("/nutrition/membership/weight");
    }
  }, [formState.completedProfileSaved, isLoading, setLocation, user]);

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_28%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
        <NutritionTopbar backHref="/nutrition/membership/weight" title={t("nutritionMembershipComplete.topbarTitle")} description={t("nutritionMembershipComplete.topbarDescription")} />

        <div className="space-y-5 rounded-[34px] border border-white/10 bg-[#1e2335]/88 p-6 text-center shadow-[0_40px_120px_-45px_rgba(0,0,0,0.78)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-400/14 text-emerald-300">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div className="space-y-3">
            <div className="text-sm font-bold text-amber-300">{t("nutritionMembershipComplete.badge")}</div>
            <h1 className="text-3xl font-black leading-tight">{t("nutritionMembershipComplete.title")}</h1>
            <p className="text-base leading-8 text-slate-300">
              {t("nutritionMembershipComplete.description")}
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setLocation("/nutrition/membership/target-weight")}
            className="h-14 w-full rounded-[18px] bg-amber-400 font-black text-slate-950 hover:bg-amber-300"
          >
            {t("nutritionMembershipComplete.continue")}
            <ArrowLeft className={`me-2 h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}
