import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Brain, CheckCircle2, HeartPulse } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { PROFILE_HOME_REVIEW_HREF, isReturningToProfileHomeReview } from "@/nutrition/lib/membership-edit-navigation";
import { saveMembershipProfileEdit } from "@/nutrition/lib/membership-edit-persistence";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { cn } from "@/lib/utils";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type QuestionKey = "reason" | "barrier" | "stressAppetite" | "hardestTime" | "planStyle";

const MINDSET_PAYMENT_SUCCESS_INTRO_KEY = "nutrition:mindset-payment-success-intro";
const MINDSET_AFTER_PAYMENT_TARGET_KEY = "nutrition:mindset-after-payment-target";

const QUESTION_STEPS: Array<{
  key: QuestionKey;
  titleKey: MessageKey;
  optionKeys: MessageKey[];
}> = [
  {
    key: "reason",
    titleKey: "nutritionMembershipMindset.reason.title",
    optionKeys: [
      "nutritionMembershipMindset.reason.option.health",
      "nutritionMembershipMindset.reason.option.confidence",
      "nutritionMembershipMindset.reason.option.energy",
      "nutritionMembershipMindset.reason.option.event",
      "nutritionMembershipMindset.reason.option.bodyShape",
      "nutritionMembershipMindset.option.none",
    ],
  },
  {
    key: "barrier",
    titleKey: "nutritionMembershipMindset.barrier.title",
    optionKeys: [
      "nutritionMembershipMindset.barrier.option.hunger",
      "nutritionMembershipMindset.barrier.option.noRoutine",
      "nutritionMembershipMindset.barrier.option.eatingOut",
      "nutritionMembershipMindset.barrier.option.stressEating",
      "nutritionMembershipMindset.barrier.option.time",
      "nutritionMembershipMindset.option.none",
    ],
  },
  {
    key: "stressAppetite",
    titleKey: "nutritionMembershipMindset.stressAppetite.title",
    optionKeys: [
      "nutritionMembershipMindset.stressAppetite.option.more",
      "nutritionMembershipMindset.stressAppetite.option.less",
      "nutritionMembershipMindset.stressAppetite.option.same",
      "nutritionMembershipMindset.stressAppetite.option.mixed",
      "nutritionMembershipMindset.option.none",
    ],
  },
  {
    key: "hardestTime",
    titleKey: "nutritionMembershipMindset.hardestTime.title",
    optionKeys: [
      "nutritionMembershipMindset.hardestTime.option.morning",
      "nutritionMembershipMindset.hardestTime.option.noon",
      "nutritionMembershipMindset.hardestTime.option.evening",
      "nutritionMembershipMindset.hardestTime.option.night",
      "nutritionMembershipMindset.hardestTime.option.midnight",
      "nutritionMembershipMindset.option.none",
    ],
  },
  {
    key: "planStyle",
    titleKey: "nutritionMembershipMindset.planStyle.title",
    optionKeys: [
      "nutritionMembershipMindset.planStyle.option.veryFlexible",
      "nutritionMembershipMindset.planStyle.option.flexible",
      "nutritionMembershipMindset.planStyle.option.balanced",
      "nutritionMembershipMindset.planStyle.option.strict",
      "nutritionMembershipMindset.planStyle.option.veryStrict",
      "nutritionMembershipMindset.option.none",
    ],
  },
];

export default function NutritionMembershipMindsetPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/nutrition/membership/mindset/:step");
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const formState = useMemo(() => getNutritionFormState(), []);
  const currentStep = Math.max(1, Math.min(QUESTION_STEPS.length, Number(params?.step || "1")));
  const stepIndex = currentStep - 1;
  const question = QUESTION_STEPS[stepIndex];
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isEditMode = searchParams.get("edit") === "1";
  const shouldReturnToProfileHomeReview = isReturningToProfileHomeReview(searchParams);
  const backHref = shouldReturnToProfileHomeReview
    ? PROFILE_HOME_REVIEW_HREF
    : currentStep === 1
      ? "/nutrition/membership/review"
      : `/nutrition/membership/mindset/${currentStep - 1}${isEditMode ? "?edit=1" : ""}`;

  const [answers, setAnswers] = useState<Record<string, string>>(formState.mindsetAnswers ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentSuccessIntro, setShowPaymentSuccessIntro] = useState(false);
  const [returnToDietTypeAfterMindset, setReturnToDietTypeAfterMindset] = useState(() => (
    typeof window !== "undefined" && window.sessionStorage.getItem(MINDSET_AFTER_PAYMENT_TARGET_KEY) === "diet-type"
  ));

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (!shouldReturnToProfileHomeReview && !formState.targetWeightKg) {
      setLocation("/nutrition/membership/result");
      return;
    }

    api.nutrition.getProfile().then((result) => {
      const profile = result.success ? result.data.profile : null;

      if (profile?.mindsetCompletedAt && !isEditMode) {
        updateNutritionFormState({
          mindsetCompleted: true,
          mindsetAnswers: profile.mindsetAnswers ?? formState.mindsetAnswers ?? {},
        });
        setLocation("/nutrition/membership/review");
        return;
      }

      if (profile?.mindsetAnswers) {
        setAnswers((current) => ({ ...profile.mindsetAnswers!, ...current }));
      }
    });
  }, [formState.mindsetAnswers, formState.targetWeightKg, isEditMode, isLoading, setLocation, shouldReturnToProfileHomeReview, user]);

  useEffect(() => {
    if (typeof window !== "undefined" && (isEditMode || shouldReturnToProfileHomeReview)) {
      window.sessionStorage.removeItem(MINDSET_AFTER_PAYMENT_TARGET_KEY);
      setReturnToDietTypeAfterMindset(false);
    }
  }, [isEditMode, shouldReturnToProfileHomeReview]);

  useEffect(() => {
    if (typeof window === "undefined" || currentStep !== 1 || isEditMode || shouldReturnToProfileHomeReview) {
      return;
    }

    if (window.sessionStorage.getItem(MINDSET_PAYMENT_SUCCESS_INTRO_KEY) !== "1") {
      return;
    }

    window.sessionStorage.removeItem(MINDSET_PAYMENT_SUCCESS_INTRO_KEY);
    setShowPaymentSuccessIntro(true);
  }, [currentStep, isEditMode, shouldReturnToProfileHomeReview]);

  const handleSelect = async (value: string) => {
    const nextAnswers = { ...answers, [question.key]: value };
    setAnswers(nextAnswers);
    updateNutritionFormState({ mindsetAnswers: nextAnswers });

    if (shouldReturnToProfileHomeReview) {
      const result = await saveMembershipProfileEdit({ step: "mindset", answers: nextAnswers });
      if (!result.success) {
        toast({
          variant: "destructive",
          title: t("nutritionMembershipMindset.toast.saveFailed"),
          description: result.message,
        });
        return;
      }

      updateNutritionFormState({
        mindsetCompleted: true,
        mindsetAnswers: nextAnswers,
      });

      setLocation(PROFILE_HOME_REVIEW_HREF);
      return;
    }

    if (currentStep < QUESTION_STEPS.length) {
      setLocation(`/nutrition/membership/mindset/${currentStep + 1}${isEditMode ? "?edit=1" : ""}`);
      return;
    }

    setSubmitting(true);
    const result = await api.nutrition.saveMindset({
      reason: nextAnswers.reason,
      barrier: nextAnswers.barrier,
      stressAppetite: nextAnswers.stressAppetite,
      hardestTime: nextAnswers.hardestTime,
      planStyle: nextAnswers.planStyle,
    });
    setSubmitting(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("nutritionMembershipMindset.toast.saveFailed"),
        description: result.message,
      });
      return;
    }

    updateNutritionFormState({
      mindsetCompleted: true,
      mindsetAnswers: nextAnswers,
    });

    if (returnToDietTypeAfterMindset) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(MINDSET_AFTER_PAYMENT_TARGET_KEY);
      }
      toast({
        title: t("nutritionMembershipMindset.toast.saved"),
        description: t("nutritionMembershipMindset.toast.savedChooseDietType"),
      });
      setLocation("/nutrition/diet-type");
      return;
    }

    toast({
      title: t("nutritionMembershipMindset.toast.saved"),
      description: t("nutritionMembershipMindset.toast.savedReview"),
    });
    setLocation("/nutrition/membership/review");
  };

  return (
    <div className="relative isolate min-h-screen bg-[#0a1224] px-5 pb-8 pt-5 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.13),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.16),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto max-w-[390px] space-y-4">
        <NutritionTopbar
          backHref={backHref}
          title={t("nutritionMembershipMindset.topbarTitle")}
          description={t("nutritionMembershipMindset.topbarDescription")}
          variant="hero"
          compact
        />

        <div className="rounded-[22px] border border-white/10 bg-[#111827]/82 p-4 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border border-amber-300/15 bg-amber-400/12 text-amber-300">
            {currentStep === QUESTION_STEPS.length ? <CheckCircle2 className="h-6 w-6" /> : <Brain className="h-6 w-6" />}
          </div>

          <div className="mt-4 space-y-2 text-center">
            <div className="text-[11px] font-bold text-amber-300">
              {t("nutritionMembershipMindset.stepCounter", { current: format.number(currentStep), total: format.number(QUESTION_STEPS.length) })}
            </div>
            <h1 className="mx-auto max-w-[330px] text-[18px] font-black leading-7">{t(question.titleKey)}</h1>
          </div>

          <div className="mt-4 flex items-center gap-1.5">
            {QUESTION_STEPS.map((item, index) => (
              <div
                key={item.key}
                className={cn(
                  "h-1 flex-1 rounded-full transition-all",
                  index < currentStep ? "bg-amber-300" : "bg-white/10",
                )}
              />
            ))}
          </div>

          <div className="mt-4 grid gap-2.5">
            {question.optionKeys.map((optionKey) => {
              const option = t(optionKey);

              return (
              <button
                key={optionKey}
                type="button"
                disabled={submitting}
                onClick={() => void handleSelect(option)}
                className={cn(
                  "min-h-[52px] rounded-[16px] border border-white/10 bg-slate-950/18 px-4 py-3 text-start text-[13px] font-bold leading-6 text-white transition hover:border-amber-300/30 hover:bg-amber-400/10",
                  answers[question.key] === option && "border-amber-300/40 bg-amber-400/12 text-amber-300",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <span>{option}</span>
                  <ArrowLeft className={cn("h-3.5 w-3.5 shrink-0", !isRtl && "rotate-180")} />
                </div>
              </button>
              );
            })}
          </div>

          {submitting ? (
            <div className="mt-4 text-center text-[11px] text-slate-400">{t("nutritionMembershipMindset.submitting")}</div>
          ) : null}
        </div>
      </div>

      <Dialog open={showPaymentSuccessIntro} onOpenChange={setShowPaymentSuccessIntro}>
        <DialogContent dir={dir} className="max-w-[calc(100vw-32px)] overflow-hidden rounded-[22px] border-amber-300/20 bg-[#111827] p-0 text-white shadow-[0_30px_90px_-35px_rgba(251,191,36,0.35)] sm:max-w-[370px]">
          <div className="relative p-5">
            <DialogHeader className="relative z-10 text-center sm:text-center">
              <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border border-amber-300/20 bg-amber-300/12 text-amber-300 shadow-[0_18px_45px_-30px_rgba(251,191,36,0.9)]">
                <HeartPulse className="h-6 w-6" />
              </div>
              <DialogTitle className="mt-4 w-full text-center text-[19px] font-black leading-7 text-white">
                {t("nutritionMembershipMindset.paymentIntroTitle")}
              </DialogTitle>
            </DialogHeader>

            <div className="relative z-10 mt-4 rounded-[16px] border border-emerald-300/15 bg-emerald-300/8 px-3.5 py-2.5 text-center text-[12.5px] font-black leading-6 text-emerald-100">
              {t("nutritionMembershipMindset.paymentIntroHint")}
            </div>

            <Button
              type="button"
              onClick={() => setShowPaymentSuccessIntro(false)}
              className="relative z-10 mt-4 h-11 w-full rounded-[15px] bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] text-[12px] font-black text-slate-950 shadow-[0_22px_50px_-28px_rgba(245,158,11,0.95)] hover:opacity-95"
            >
              {t("nutritionMembershipMindset.paymentIntroCta")}
              <ArrowLeft className={cn("h-4 w-4", isRtl ? "ms-2" : "me-2 rotate-180")} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
