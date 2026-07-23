import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, PencilLine, Pill } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MembershipStepProgress } from "@/nutrition/components/membership-step-progress";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { PROFILE_HOME_REVIEW_HREF, isReturningToProfileHomeReview, resolveProfileHomeReviewAwareHref } from "@/nutrition/lib/membership-edit-navigation";
import { saveMembershipProfileEdit } from "@/nutrition/lib/membership-edit-persistence";
import { MEMBERSHIP_STEPS, MEMBERSHIP_TOTAL_STEPS } from "@/nutrition/lib/membership-progress";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { summarizeMedicalConditionItems } from "@/nutrition/lib/medical-conditions";
import { useLocale, useT } from "@/i18n/locale";

const PROFILE_SETUP_STEP = MEMBERSHIP_STEPS.medicationsAndSupplements;
const PROFILE_SETUP_TOTAL_STEPS = MEMBERSHIP_TOTAL_STEPS;

export default function NutritionMembershipMedicationsAndSupplementsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const formState = useMemo(() => getNutritionFormState(), []);
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [medicationsAndSupplements, setMedicationsAndSupplements] = useState(formState.medicationsAndSupplements ?? "");
  const shouldPersistEdit = isReturningToProfileHomeReview(searchParams);
  const backHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/medical-conditions", searchParams);
  const nextHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/allergies", searchParams);

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

  const handleContinue = async (value = medicationsAndSupplements) => {
    const latestFormState = getNutritionFormState();
    const normalizedValue = value.trim();
    updateNutritionFormState({
      medicalConditions: latestFormState.medicalConditions ?? summarizeMedicalConditionItems(latestFormState.medicalConditionsItems),
      medicalConditionsItems: latestFormState.medicalConditionsItems ?? [],
      medicationsAndSupplements: normalizedValue,
    });

    if (shouldPersistEdit) {
      const result = await saveMembershipProfileEdit({
        step: "medications-and-supplements",
        medicationsAndSupplements: normalizedValue,
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
        <NutritionTopbar backHref={backHref} title={t("nutritionMembershipShared.topbarTitle")} description={t("nutritionMembershipMedications.topbarDescription")} variant="hero" />

        <MembershipStepProgress step={PROFILE_SETUP_STEP} totalSteps={PROFILE_SETUP_TOTAL_STEPS} />

        <main className="mt-7 rounded-[28px] border border-white/10 bg-[#070d18]/35 px-5 pb-5 pt-8 shadow-[0_30px_85px_-55px_rgba(0,0,0,0.95)]">
          <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[22px] border border-emerald-300/24 bg-emerald-400/10 text-emerald-300 shadow-[0_24px_55px_-38px_rgba(52,211,153,0.75)]">
            <Pill className="h-8 w-8" />
          </div>

          <div className="mt-6 space-y-3 text-center">
            <h1 className="text-[26px] font-black leading-[1.55] text-white">{t("nutritionMembershipMedications.title")}</h1>
          </div>

          <div className="mt-7 rounded-[24px] border border-amber-300/28 bg-[#070c14]/70 p-4 shadow-[0_20px_50px_-38px_rgba(251,191,36,0.75)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label htmlFor="medications-and-supplements" className="flex items-center gap-2 text-[14px] font-black text-amber-300">
                <PencilLine className="h-4 w-4" />
                {t("nutritionMembershipShared.writeHere")}
              </label>
              <span className="rounded-[12px] bg-white/[0.06] px-3 py-1.5 text-[11px] font-black text-slate-400">{t("nutritionMembershipShared.optional")}</span>
            </div>
            <Textarea
              id="medications-and-supplements"
              value={medicationsAndSupplements}
              onChange={(event) => setMedicationsAndSupplements(event.target.value)}
              className="min-h-[190px] rounded-[18px] border-white/10 bg-[#080e19] px-4 py-4 text-center text-[14px] font-black leading-8 text-white placeholder:text-slate-500 focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/35"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMedicationsAndSupplements("");
                void handleContinue("");
              }}
              className="mt-3 h-[48px] w-full rounded-[15px] border-white/15 bg-white/[0.04] text-[13px] font-black text-slate-200 hover:border-emerald-300/35 hover:bg-emerald-400/10 hover:text-emerald-200"
            >
              <Check className="me-2 h-4 w-4 text-emerald-300" />
              {t("nutritionMembershipMedications.none")}
            </Button>
          </div>
        </main>

        <div className="mt-auto pt-6">
          <Button
            type="button"
            onClick={() => void handleContinue()}
            className="h-[52px] w-full rounded-[16px] bg-gradient-to-l from-amber-500 to-amber-300 text-[14px] font-black text-slate-950 shadow-[0_24px_54px_-34px_rgba(251,191,36,0.9)] hover:from-amber-400 hover:to-amber-300"
          >
            {shouldPersistEdit ? t("nutritionMembershipShared.saveChanges") : t("nutritionMembershipShared.continueSteps")}
            <ArrowLeft className={`me-2 h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}
