import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Eye,
  HeartHandshake,
  Loader2,
  Phone,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { CustomerFeedbackReportPayload, CustomerFeedbackReportResponseDetail } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { getAudienceLabels } from "@/lib/audience";
import { useAuth } from "@/lib/auth";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { PhoneText, LtrText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const EMPTY_REPORT: CustomerFeedbackReportPayload = {
  summary: {
    sentCount: 0,
    respondedCount: 0,
    pendingCount: 0,
    responseRate: 0,
  },
  questions: [],
  participants: [],
};

export default function PanelCustomerFeedbackReportPage() {
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const { isPrimaryAdmin, isAdmin } = useAuth();
  const tenantMeta = getInitialTenantMeta();
  const labels = getAudienceLabels(tenantMeta);
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const [report, setReport] = useState<CustomerFeedbackReportPayload>(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responseDetail, setResponseDetail] = useState<CustomerFeedbackReportResponseDetail | null>(null);
  const [responseDetailLoading, setResponseDetailLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!isPrimaryAdmin) {
      return;
    }

    void loadReport();
  }, [isPrimaryAdmin]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    const res = await api.customerFeedback.getReport();
    setLoading(false);

    if (!res.success) {
      setError(res.message || t("customerFeedback.report.error.load"));
      return;
    }

    setReport(res.data);
  };

  const openResponseDetail = async (responseId: string) => {
    setDialogOpen(true);
    setResponseDetail(null);
    setResponseDetailLoading(true);
    const res = await api.customerFeedback.getReportResponse(responseId);
    setResponseDetailLoading(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("customerFeedback.report.toast.detailError"), description: res.message });
      return;
    }

    setResponseDetail(res.data);
  };

  if (!isPrimaryAdmin) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground" dir={dir}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="w-full max-w-md space-y-4 text-center">
            <HeartHandshake className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="text-xl font-bold">{t("customerFeedback.report.accessDenied.title")}</h1>
            <p className="leading-7 text-muted-foreground">{t("customerFeedback.report.accessDenied.description")}</p>
            <Link href="/panel">
              <Button>{t("customerFeedback.report.backToPanel")}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("customerFeedback.report.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("customerFeedback.report.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/panel/customer-feedback">
              <Button variant="outline" className="rounded-2xl">{t("customerFeedback.report.backToSettings")}</Button>
            </Link>
            <Link href="/panel">
              <Button variant="outline" size="icon" title={t("common.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
                <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-5 px-4 py-6 text-start">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-black">{t("customerFeedback.report.analyticsTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("customerFeedback.report.analyticsDescription")}</p>
          </div>
          <Button variant="outline" className="rounded-2xl" onClick={() => void loadReport()} disabled={loading}>
            {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <BarChart3 className="me-2 h-4 w-4" />}
            {t("customerFeedback.report.refresh")}
          </Button>
        </div>

        {error ? (
          <Card className="border-dashed border-destructive/30 bg-destructive/5">
            <CardContent className="p-6 text-start text-sm text-muted-foreground">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard title={t("customerFeedback.report.metrics.sent")} value={format.number(report.summary.sentCount)} description={t("customerFeedback.report.metrics.sentDescription")} icon={<HeartHandshake className="h-5 w-5 text-primary" />} />
          <MetricCard title={t("customerFeedback.report.metrics.responded")} value={format.number(report.summary.respondedCount)} description={t("customerFeedback.report.metrics.respondedDescription")} icon={<Users className="h-5 w-5 text-emerald-300" />} />
          <MetricCard title={t("customerFeedback.report.metrics.pending")} value={format.number(report.summary.pendingCount)} description={t("customerFeedback.report.metrics.pendingDescription")} icon={<Sparkles className="h-5 w-5 text-amber-300" />} />
          <MetricCard title={t("customerFeedback.report.metrics.rate")} value={format.percent(report.summary.responseRate / 100)} description={t("customerFeedback.report.metrics.rateDescription")} icon={<BarChart3 className="h-5 w-5 text-sky-300" />} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{t("customerFeedback.report.questionsTitle")}</CardTitle>
              <CardDescription>{t("customerFeedback.report.questionsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  <Loader2 className="me-2 h-5 w-5 animate-spin" />
                  {t("customerFeedback.report.loading")}
                </div>
              ) : report.questions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-6 text-center text-muted-foreground">
                  {t("customerFeedback.report.questionsEmpty")}
                </div>
              ) : (
                report.questions.map((question) => (
                  <div key={question.questionId} className="space-y-4 rounded-3xl border border-border/70 bg-background/40 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline">{question.displayType === "star" ? t("customerFeedback.report.displayType.star") : t("customerFeedback.report.displayType.icon")}</Badge>
                      <div className="text-sm text-muted-foreground">{t("customerFeedback.report.answerCount", { count: format.number(question.totalAnswers) })}</div>
                    </div>
                    <div className="text-base font-black">{question.title}</div>
                    <div className="space-y-3">
                      {question.options.map((option) => (
                        <div key={option.key} className="space-y-2">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <div className="text-muted-foreground">{t("customerFeedback.report.voteCount", { count: format.number(option.count) })}</div>
                            <div className="font-medium">{option.label}</div>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-background/70">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${option.percent}%` }} />
                          </div>
                          <div className="text-end text-xs text-muted-foreground">{format.percent(option.percent / 100)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("customerFeedback.report.participantsTitle")}</CardTitle>
              <CardDescription>{t("customerFeedback.report.participantsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  <Loader2 className="me-2 h-5 w-5 animate-spin" />
                  {t("customerFeedback.report.participantsLoading")}
                </div>
              ) : report.participants.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-6 text-center text-muted-foreground">
                  {t("customerFeedback.report.participantsEmpty")}
                </div>
              ) : (
                report.participants.map((participant) => (
                  <button
                    key={participant.responseId}
                    type="button"
                    onClick={() => void openResponseDetail(participant.responseId)}
                    className="w-full rounded-3xl border border-border/70 bg-background/40 p-4 text-start transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Eye className="h-4 w-4" />
                        {t("customerFeedback.report.viewDetails")}
                      </div>
                      <div className="space-y-2 text-start">
                        <div className="text-base font-black">{participant.customerName}</div>
                        <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-muted-foreground">
                          {participant.appointmentDate ? (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-4 w-4" />
                              {format.date(participant.appointmentDate)}
                            </span>
                          ) : null}
                          {participant.customerMobile ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              <PhoneText>{participant.customerMobile}</PhoneText>
                            </span>
                          ) : null}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {participant.professionalName ? `${participant.professionalName} / ` : ""}
                          {participant.serviceName || t("customerFeedback.report.serviceMissing")}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl text-start" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-start">{t("customerFeedback.report.detailTitle")}</DialogTitle>
            <DialogDescription className="text-start">{t("customerFeedback.report.detailDescription")}</DialogDescription>
          </DialogHeader>

          {responseDetailLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="me-2 h-5 w-5 animate-spin" />
              {t("customerFeedback.report.detailLoading")}
            </div>
          ) : responseDetail ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoCard title={t("customerFeedback.report.info.customerName")} value={responseDetail.customerName} dir={dir} />
                <InfoCard title={t("customerFeedback.report.info.mobile")} value={responseDetail.customerMobile} dir={dir} ltr />
                <InfoCard title={t("customerFeedback.report.info.professional")} value={responseDetail.professionalName || "-"} dir={dir} />
                <InfoCard title={t("customerFeedback.report.info.service")} value={responseDetail.serviceName || "-"} dir={dir} />
                <InfoCard title={t("customerFeedback.report.info.appointmentDate")} value={responseDetail.appointmentDate ? format.date(responseDetail.appointmentDate) : "-"} dir={dir} />
                <InfoCard title={t("customerFeedback.report.info.appointmentTime")} value={responseDetail.appointmentTime || "-"} dir={dir} ltr />
              </div>

              <Card className="border-border/70 bg-background/30">
                <CardHeader>
                  <CardTitle className="text-base">{t("customerFeedback.report.answersTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {responseDetail.answers.map((answer, index) => (
                    <div key={`${answer.questionTitle}-${index}`} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                      <div className="text-sm text-muted-foreground">{t("customerFeedback.report.questionNumber", { number: format.number(index + 1) })}</div>
                      <div className="mt-1 font-bold">{answer.questionTitle}</div>
                      <div className="mt-3 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary">
                        {answer.label}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-6 text-center text-muted-foreground">
              {t("customerFeedback.report.detailEmpty")}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-border/70 bg-card/60">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>{icon}</div>
          <div className="text-sm text-muted-foreground">{title}</div>
        </div>
        <div className="text-2xl font-black">{value}</div>
        <div className="text-sm leading-7 text-muted-foreground">{description}</div>
      </CardContent>
    </Card>
  );
}

function InfoCard({
  title,
  value,
  ltr = false,
  dir,
}: {
  title: string;
  value: string;
  ltr?: boolean;
  dir: "rtl" | "ltr";
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="mt-1 text-lg font-bold" dir={ltr ? "ltr" : dir}>
        {ltr ? <LtrText>{value}</LtrText> : value}
      </div>
    </div>
  );
}
