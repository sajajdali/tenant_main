import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import {
  ChevronRight,
  Frown,
  HeartHandshake,
  Laugh,
  Loader2,
  Meh,
  Smile,
  Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { api } from "@/lib/api";
import type { CustomerFeedbackPublicAnswerInput, CustomerFeedbackPublicPayload } from "@/lib/types";

const ICON_OPTIONS = [
  { key: "excellent", icon: Laugh, className: "text-emerald-300" },
  { key: "good", icon: Smile, className: "text-sky-300" },
  { key: "average", icon: Meh, className: "text-amber-300" },
  { key: "bad", icon: Frown, className: "text-rose-300" },
] as const;

export default function CustomerFeedbackPublicPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [shortMatch, shortParams] = useRoute("/f/:token");
  const [, longParams] = useRoute("/feedback/:token");
  const params = shortMatch ? shortParams : longParams;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payload, setPayload] = useState<CustomerFeedbackPublicPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, CustomerFeedbackPublicAnswerInput>>({});

  useEffect(() => {
    if (!params?.token) {
      setError(t("feedbackPublic.invalidLink"));
      setLoading(false);
      return;
    }

    api.customerFeedback.getPublic(params.token).then((res) => {
      if (res.success) {
        setPayload(res.data);
      } else {
        setError(res.message || t("feedbackPublic.invalidLink"));
      }
      setLoading(false);
    });
  }, [params?.token, t]);

  const currentQuestion = payload?.questions[stepIndex] ?? null;
  const totalSteps = payload?.questions.length ?? 0;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const isLastStep = totalSteps > 0 && stepIndex === totalSteps - 1;
  const progressPercent = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;

  const emojiOptions = useMemo(() => {
    if (!payload) {
      return [];
    }

    return ICON_OPTIONS.map((option, index) => ({
      ...option,
      value: 4 - index,
      label: payload.emojiLabels[option.key],
    }));
  }, [payload]);

  const selectAnswer = (input: CustomerFeedbackPublicAnswerInput) => {
    setAnswers((current) => ({
      ...current,
      [input.questionId]: input,
    }));
  };

  const handleSelectAnswer = (input: CustomerFeedbackPublicAnswerInput) => {
    selectAnswer(input);

    if (!isLastStep) {
      window.setTimeout(() => {
        setStepIndex((current) => Math.min(current + 1, Math.max(totalSteps - 1, 0)));
      }, 120);
    }
  };

  const handleNext = async () => {
    if (!currentQuestion || !currentAnswer) {
      return;
    }

    if (!isLastStep) {
      setStepIndex((current) => current + 1);
      return;
    }

    if (!params?.token) {
      return;
    }

    setSubmitting(true);
    const orderedAnswers = payload?.questions.map((question) => answers[question.id]).filter(Boolean) ?? [];
    const res = await api.customerFeedback.submitPublic(params.token, orderedAnswers);
    setSubmitting(false);

    if (!res.success) {
      if (res.data?.status === "responded") {
        setPayload(res.data || payload);
        return;
      }

      setError(res.message || t("feedbackPublic.submitFailed"));
      return;
    }

    setPayload(res.data);
  };

  const alreadyResponded = payload?.status === "responded";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.15),transparent_32%),linear-gradient(180deg,#0f172a_0%,#111827_100%)] px-4 py-10 text-foreground" dir={dir}>
      <div className="mx-auto max-w-3xl">
        <Card className="overflow-hidden border-primary/20 bg-slate-950/70 shadow-2xl backdrop-blur-xl">
          <CardContent className="space-y-6 p-6 sm:p-8">
            {loading ? (
              <div className="flex min-h-56 items-center justify-center text-muted-foreground">
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("feedbackPublic.loading")}
              </div>
            ) : error ? (
              <div className="space-y-3 py-8 text-center">
                <HeartHandshake className="mx-auto h-12 w-12 text-destructive" />
                <h1 className="text-xl font-black">{t("feedbackPublic.errorTitle")}</h1>
                <p className="leading-8 text-muted-foreground">{error}</p>
              </div>
            ) : payload ? (
              <>
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/15">
                    <HeartHandshake className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-2xl font-black sm:text-3xl">{payload.surveyTitle}</h1>
                    <p className="mx-auto max-w-2xl leading-8 text-slate-300">{payload.introText}</p>
                  </div>
                </div>

                <div className="text-start text-sm text-slate-400">
                  {t("feedbackPublic.customerName")} <span className="font-bold text-slate-200">{payload.customerName || t("feedbackPublic.customerFallback")}</span>
                </div>

                {alreadyResponded ? (
                  <div className="rounded-[2rem] border border-emerald-500/25 bg-emerald-500/10 p-6 text-center">
                    <div className="text-xl font-black text-emerald-300">{t("feedbackPublic.alreadyResponded")}</div>
                    <p className="mt-3 leading-8 text-slate-300">{payload.successText}</p>
                  </div>
                ) : totalSteps === 0 ? (
                  <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/5 p-6 text-center text-slate-300">
                    {t("feedbackPublic.noQuestions")}
                  </div>
                ) : (
                  <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>{t("feedbackPublic.progress.short", { current: format.number(stepIndex + 1), total: format.number(totalSteps) })}</span>
                        <span>{t("feedbackPublic.progress.long", { current: format.number(stepIndex + 1), total: format.number(totalSteps) })}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400">{t("feedbackPublic.currentQuestion")}</div>
                        <div className="text-xl font-black leading-9 sm:text-2xl">{currentQuestion?.title}</div>
                      </div>

                      {currentQuestion?.displayType === "star" ? (
                        <div className="grid gap-3 sm:grid-cols-5">
                          {Array.from({ length: 5 }).map((_, index) => {
                            const value = 5 - index;
                            const selected = currentAnswer?.value === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => handleSelectAnswer({ questionId: currentQuestion!.id, value })}
                                className={`rounded-[1.7rem] border p-4 transition-all ${selected ? "border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/10" : "border-white/10 bg-slate-900/70 hover:border-amber-400/40"}`}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  {Array.from({ length: value }).map((__, starIndex) => (
                                    <Star key={starIndex} className="h-5 w-5 fill-current text-amber-300" />
                                  ))}
                                </div>
                                <div className="mt-3 text-sm text-slate-300">{t("feedbackPublic.stars", { count: format.number(value) })}</div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {emojiOptions.map((option) => {
                            const Icon = option.icon;
                            const selected = currentAnswer?.choiceKey === option.key;
                            return (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => handleSelectAnswer({ questionId: currentQuestion!.id, choiceKey: option.key, value: option.value })}
                                className={`rounded-[1.7rem] border p-5 text-start transition-all ${selected ? "border-primary bg-primary/10 shadow-lg shadow-primary/10" : "border-white/10 bg-slate-900/70 hover:border-primary/40"}`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className={`rounded-2xl bg-white/5 p-3 ${option.className}`}>
                                    <Icon className="h-7 w-7" />
                                  </div>
                                  <div className="text-lg font-bold">{option.label}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl border-white/20 bg-transparent text-slate-200 hover:bg-white/5"
                        onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                        disabled={stepIndex === 0 || submitting}
                      >
                        {t("feedbackPublic.previousStep")}
                      </Button>
                      {isLastStep ? (
                        <Button
                          type="button"
                          onClick={() => void handleNext()}
                          disabled={!currentAnswer || submitting}
                          className="rounded-2xl px-6"
                        >
                          {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ChevronRight className={`me-2 h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />}
                          {t("feedbackPublic.submit")}
                        </Button>
                      ) : (
                        <div className="text-sm text-slate-400">{t("feedbackPublic.autoNextHint")}</div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
