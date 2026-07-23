import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Eye,
  Frown,
  HeartHandshake,
  Laugh,
  Loader2,
  Lock,
  Meh,
  Phone,
  Plus,
  Save,
  Settings2,
  Smile,
  Sparkles,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type {
  CustomerFeedbackQuestion,
  CustomerFeedbackReportPayload,
  CustomerFeedbackReportResponseDetail,
  CustomerFeedbackSettings,
} from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { getAudienceLabels } from "@/lib/audience";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type TFunction = (key: MessageKey, params?: Record<string, string | number>) => string;

const createDefaultSettings = (t: TFunction): CustomerFeedbackSettings => ({
  moduleActive: false,
  purchaseUrl: "/panel/special-features/customer-feedback",
  smsSettingsUrl: "/panel/sms-settings/feedback",
  enabled: false,
  emojiLabels: {
    excellent: t("customerFeedback.settings.defaults.excellent"),
    good: t("customerFeedback.settings.defaults.good"),
    average: t("customerFeedback.settings.defaults.average"),
    bad: t("customerFeedback.settings.defaults.bad"),
  },
  audienceScope: "all",
  professionalIds: [],
  firstSendDelayDays: 1,
  triggerAfterCompletedCount: 1,
  maxResponsesPerCustomer: 1,
  surveyTitle: t("customerFeedback.settings.defaults.surveyTitle"),
  introText: t("customerFeedback.settings.defaults.introText"),
  successText: t("customerFeedback.settings.defaults.successText"),
  professionals: [],
  questions: [],
});

const DEFAULT_NEW_QUESTION: Omit<CustomerFeedbackQuestion, "id"> = {
  title: "",
  displayType: "emoji",
  sortOrder: 0,
  isActive: true,
};

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

const FEEDBACK_LABEL_ICONS = [
  { key: "excellent" as const, labelKey: "customerFeedback.settings.labels.optionOne" as const, icon: Laugh, iconClassName: "text-emerald-300" },
  { key: "good" as const, labelKey: "customerFeedback.settings.labels.optionTwo" as const, icon: Smile, iconClassName: "text-sky-300" },
  { key: "average" as const, labelKey: "customerFeedback.settings.labels.optionThree" as const, icon: Meh, iconClassName: "text-amber-300" },
  { key: "bad" as const, labelKey: "customerFeedback.settings.labels.optionFour" as const, icon: Frown, iconClassName: "text-rose-300" },
];

export default function PanelCustomerFeedbackPage() {
  const { isPrimaryAdmin, isAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const tenantMeta = getInitialTenantMeta();
  const labels = getAudienceLabels(tenantMeta);
  const defaultSettings = useMemo(() => createDefaultSettings(t), [t]);
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const purchasedFromMeta = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "customer-feedback") ?? false;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<CustomerFeedbackSettings>(() => createDefaultSettings(t));
  const [newQuestion, setNewQuestion] = useState<Omit<CustomerFeedbackQuestion, "id">>(DEFAULT_NEW_QUESTION);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [report, setReport] = useState<CustomerFeedbackReportPayload>(EMPTY_REPORT);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [responseDetail, setResponseDetail] = useState<CustomerFeedbackReportResponseDetail | null>(null);
  const [responseDetailLoading, setResponseDetailLoading] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  useEffect(() => {
    if (!isPrimaryAdmin) {
      return;
    }

    const loadSettings = async () => {
      const res = await api.customerFeedback.getSettings();

      if (res.success) {
        setLoadError(null);
        setSettings({ ...defaultSettings, ...res.data, moduleActive: res.data.moduleActive || purchasedFromMeta });
      } else {
        setLoadError(res.message || t("customerFeedback.settings.error.load"));
        setSettings((current) => ({ ...current, moduleActive: purchasedFromMeta }));
      }

      setLoading(false);
    };

    loadSettings();
  }, [defaultSettings, isPrimaryAdmin, purchasedFromMeta, t]);

  useEffect(() => {
    if (loading || !settings.moduleActive || !isPrimaryAdmin) {
      return;
    }

    void loadReport();
  }, [loading, settings.moduleActive, isPrimaryAdmin]);

  const questionCount = useMemo(
    () => settings.questions.filter((item) => item.isActive).length,
    [settings.questions],
  );

  const saveSettings = async () => {
    setSaving(true);
    const res = await api.customerFeedback.updateSettings({
      enabled: settings.enabled,
      emojiLabels: settings.emojiLabels,
      audienceScope: settings.audienceScope,
      professionalIds: settings.professionalIds,
      firstSendDelayDays: settings.firstSendDelayDays,
      triggerAfterCompletedCount: settings.triggerAfterCompletedCount,
      maxResponsesPerCustomer: settings.maxResponsesPerCustomer,
      surveyTitle: settings.surveyTitle,
      introText: settings.introText,
      successText: settings.successText,
    });
    setSaving(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("customerFeedback.settings.toast.saveFailed"), description: res.message });
      return;
    }

    setSettings({ ...defaultSettings, ...res.data });
    toast({ title: t("customerFeedback.settings.toast.saved"), description: t("customerFeedback.settings.toast.savedDescription") });
  };

  const saveQuestion = async (question: Omit<CustomerFeedbackQuestion, "id">, id?: string) => {
    const payload = {
      title: question.title,
      displayType: question.displayType,
      sortOrder: question.sortOrder,
      isActive: question.isActive,
    };

    const res = id ? await api.customerFeedback.updateQuestion(id, payload) : await api.customerFeedback.createQuestion(payload);

    if (!res.success) {
      toast({ variant: "destructive", title: t("customerFeedback.settings.toast.questionSaveFailed"), description: res.message });
      return;
    }

    setSettings((current) => ({
      ...current,
      questions: id
        ? current.questions.map((item) => (item.id === id ? res.data : item))
        : [...current.questions, res.data].sort((a, b) => a.sortOrder - b.sortOrder),
    }));

    if (!id) {
      setNewQuestion(DEFAULT_NEW_QUESTION);
    }

    toast({
      title: id ? t("customerFeedback.settings.toast.questionUpdated") : t("customerFeedback.settings.toast.questionAdded"),
      description: t("customerFeedback.settings.toast.questionSavedDescription"),
    });
  };

  const removeQuestion = async (id: string) => {
    const res = await api.customerFeedback.removeQuestion(id);

    if (!res.success) {
      toast({ variant: "destructive", title: t("customerFeedback.settings.toast.questionDeleteFailed"), description: res.message });
      return;
    }

    setSettings((current) => ({
      ...current,
      questions: current.questions.filter((item) => item.id !== id),
    }));
    toast({ title: t("customerFeedback.settings.toast.questionDeleted"), description: t("customerFeedback.settings.toast.questionDeletedDescription") });
  };

  const loadReport = async () => {
    setReportLoading(true);
    setReportError(null);
    const res = await api.customerFeedback.getReport();
    setReportLoading(false);

    if (!res.success) {
      setReportError(res.message || t("customerFeedback.report.error.load"));
      return;
    }

    setReport(res.data);
  };

  const openResponseDetail = async (responseId: string) => {
    setReportDialogOpen(true);
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
            <h1 className="text-xl font-bold">{t("customerFeedback.settings.accessDenied.title")}</h1>
            <p className="leading-7 text-muted-foreground">{t("customerFeedback.settings.accessDenied.description")}</p>
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
          <div className="space-y-1 text-start">
            <h1 className="text-xl font-bold">{t("customerFeedback.settings.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("customerFeedback.settings.description")}</p>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("customerFeedback.report.backToPanel")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-5 px-4 py-6 text-start">
        {loading ? (
          <div className="flex h-56 items-center justify-center text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("customerFeedback.settings.loading")}
          </div>
        ) : loadError && settings.moduleActive ? (
          <Card className="border-dashed border-amber-500/30 bg-amber-500/10">
            <CardContent className="space-y-4 p-8 text-center">
              <HeartHandshake className="mx-auto h-12 w-12 text-amber-300" />
              <h2 className="text-xl font-black">{t("customerFeedback.settings.loadPartial.title")}</h2>
              <p className="mx-auto max-w-2xl leading-8 text-muted-foreground">{loadError}</p>
              <div className="flex justify-center gap-3">
                <Button onClick={() => window.location.reload()} className="rounded-2xl">{t("customerFeedback.settings.loadPartial.reload")}</Button>
                <Link href={settings.smsSettingsUrl}>
                  <Button variant="outline" className="rounded-2xl">{t("customerFeedback.settings.smsTemplate")}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : !settings.moduleActive ? (
          <Card className="border-dashed border-amber-500/30 bg-amber-500/10">
            <CardContent className="space-y-4 p-8 text-center">
              <Lock className="mx-auto h-12 w-12 text-amber-300" />
              <h2 className="text-xl font-black">{t("customerFeedback.settings.moduleInactive.title")}</h2>
              <p className="mx-auto max-w-2xl leading-8 text-muted-foreground">
                {t("customerFeedback.settings.moduleInactive.description")}
              </p>
              <div className="flex justify-center gap-3">
                <Link href={settings.purchaseUrl}>
                  <Button className="rounded-2xl">{t("customerFeedback.settings.moduleInactive.purchase")}</Button>
                </Link>
                <Link href={settings.smsSettingsUrl}>
                  <Button variant="outline" className="rounded-2xl">{t("customerFeedback.settings.smsTemplate")}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                title={t("customerFeedback.settings.metrics.module")}
                value={settings.enabled ? t("customerFeedback.settings.status.active") : t("customerFeedback.settings.status.inactive")}
                description={settings.enabled ? t("customerFeedback.settings.metrics.moduleActive") : t("customerFeedback.settings.metrics.moduleInactive")}
                icon={<HeartHandshake className="h-5 w-5 text-primary" />}
              />
              <MetricCard
                title={t("customerFeedback.settings.metrics.activeQuestions")}
                value={format.number(questionCount)}
                description={t("customerFeedback.settings.metrics.activeQuestionsDescription")}
                icon={<Sparkles className="h-5 w-5 text-amber-300" />}
              />
              <MetricCard
                title={t("customerFeedback.report.metrics.responded")}
                value={format.number(report.summary.respondedCount)}
                description={t("customerFeedback.settings.metrics.respondedDescription")}
                icon={<Users className="h-5 w-5 text-emerald-300" />}
              />
              <MetricCard
                title={t("customerFeedback.report.metrics.rate")}
                value={format.percent(report.summary.responseRate / 100)}
                description={t("customerFeedback.settings.metrics.rateDescription")}
                icon={<BarChart3 className="h-5 w-5 text-sky-300" />}
              />
            </div>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1 text-start">
                  <div className="text-lg font-black">{t("customerFeedback.report.title")}</div>
                  <div className="text-sm leading-7 text-muted-foreground">
                    {t("customerFeedback.settings.fullReportDescription")}
                  </div>
                </div>
                <Link href="/panel/customer-feedback/report">
                  <Button className="rounded-2xl">
                    <BarChart3 className="me-2 h-4 w-4" />
                    {t("customerFeedback.settings.fullReport")}
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Tabs defaultValue="settings" className="space-y-5">
              <TabsList className="me-auto grid w-full max-w-xl grid-cols-3 rounded-2xl">
                <TabsTrigger value="settings">{t("customerFeedback.settings.tabs.settings")}</TabsTrigger>
                <TabsTrigger value="questions">{t("customerFeedback.settings.tabs.questions")}</TabsTrigger>
                <TabsTrigger value="reports">{t("customerFeedback.settings.tabs.reports")}</TabsTrigger>
              </TabsList>

              <TabsContent value="settings" className="space-y-5">
                <div className="grid gap-5 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("customerFeedback.settings.main.title")}</CardTitle>
                      <CardDescription>{t("customerFeedback.settings.main.description")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/40 p-4 text-start">
                        <div className="space-y-1 text-start">
                          <div className="font-bold">{t("customerFeedback.settings.main.enable")}</div>
                          <div className="text-sm text-muted-foreground">{t("customerFeedback.settings.main.enableDescription")}</div>
                        </div>
                        <Switch checked={settings.enabled} onCheckedChange={(checked) => setSettings((current) => ({ ...current, enabled: checked }))} />
                      </div>

                      <div className="space-y-3">
                        <Label>{t("customerFeedback.settings.preview.title")}</Label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border bg-background/40 p-4 text-start">
                            <div className="flex items-center justify-end gap-3 text-lg">
                              <Laugh className="h-7 w-7 text-emerald-300" />
                              <Smile className="h-7 w-7 text-sky-300" />
                              <Meh className="h-7 w-7 text-amber-300" />
                              <Frown className="h-7 w-7 text-rose-300" />
                            </div>
                            <div className="mt-3 text-sm leading-7 text-muted-foreground">{t("customerFeedback.settings.preview.emojiDescription")}</div>
                          </div>
                          <div className="rounded-2xl border border-border bg-background/40 p-4 text-start">
                            <div className="flex items-center justify-end gap-2 text-lg">
                              {Array.from({ length: 5 }).map((_, index) => (
                                <Star key={index} className="h-6 w-6 fill-current text-amber-300" />
                              ))}
                            </div>
                            <div className="mt-3 text-sm leading-7 text-muted-foreground">{t("customerFeedback.settings.preview.starDescription")}</div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t("customerFeedback.settings.main.firstSendDelayDays")}</Label>
                          <Input type="number" min={1} value={settings.firstSendDelayDays} onChange={(event) => setSettings((current) => ({ ...current, firstSendDelayDays: Math.max(1, Number(event.target.value || 1)) }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("customerFeedback.settings.main.triggerAfterCompletedCount")}</Label>
                          <Input type="number" min={1} value={settings.triggerAfterCompletedCount} onChange={(event) => setSettings((current) => ({ ...current, triggerAfterCompletedCount: Math.max(1, Number(event.target.value || 1)) }))} />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>{t("customerFeedback.settings.main.maxResponsesPerCustomer")}</Label>
                          <Input type="number" min={1} value={settings.maxResponsesPerCustomer} onChange={(event) => setSettings((current) => ({ ...current, maxResponsesPerCustomer: Math.max(1, Number(event.target.value || 1)) }))} />
                          <p className="text-sm leading-7 text-muted-foreground">{t("customerFeedback.settings.main.maxResponsesHint")}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label>{t("customerFeedback.settings.audience.title")}</Label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <button type="button" onClick={() => setSettings((current) => ({ ...current, audienceScope: "all" }))} className={`rounded-2xl border p-4 text-start ${settings.audienceScope === "all" ? "border-primary bg-primary/10" : "border-border bg-background/40"}`}>
                            <div className="font-bold">{t("customerFeedback.settings.audience.all")}</div>
                            <div className="mt-2 text-sm leading-7 text-muted-foreground">{t("customerFeedback.settings.audience.allDescription", { professionals: labels.plural })}</div>
                          </button>
                          <button type="button" onClick={() => setSettings((current) => ({ ...current, audienceScope: "professional" }))} className={`rounded-2xl border p-4 text-start ${settings.audienceScope === "professional" ? "border-primary bg-primary/10" : "border-border bg-background/40"}`}>
                            <div className="font-bold">{t("customerFeedback.settings.audience.professional", { professionals: labels.plural })}</div>
                            <div className="mt-2 text-sm leading-7 text-muted-foreground">{t("customerFeedback.settings.audience.professionalDescription", { professionals: labels.plural })}</div>
                          </button>
                        </div>
                      </div>

                      {settings.audienceScope === "professional" ? (
                        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/40 p-4">
                          <div className="font-bold">{t("customerFeedback.settings.audience.selectProfessionals", { professionals: labels.plural })}</div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {settings.professionals.map((professional) => {
                              const checked = settings.professionalIds.includes(Number(professional.id));
                              return (
                                <label key={professional.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 p-3">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(nextChecked) =>
                                      setSettings((current) => ({
                                        ...current,
                                        professionalIds: nextChecked
                                          ? [...current.professionalIds, Number(professional.id)]
                                          : current.professionalIds.filter((id) => id !== Number(professional.id)),
                                      }))
                                    }
                                  />
                                  <span className="text-sm">{professional.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t("customerFeedback.settings.copy.title")}</CardTitle>
                      <CardDescription>{t("customerFeedback.settings.copy.description")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-2">
                        <Label>{t("customerFeedback.settings.copy.surveyTitle")}</Label>
                        <Input value={settings.surveyTitle} onChange={(event) => setSettings((current) => ({ ...current, surveyTitle: event.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("customerFeedback.settings.copy.introText")}</Label>
                        <Textarea rows={4} value={settings.introText} onChange={(event) => setSettings((current) => ({ ...current, introText: event.target.value }))} className="leading-8" />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("customerFeedback.settings.copy.successText")}</Label>
                        <Textarea rows={4} value={settings.successText} onChange={(event) => setSettings((current) => ({ ...current, successText: event.target.value }))} className="leading-8" />
                      </div>

                      <div className="space-y-3 rounded-2xl border border-border/70 bg-background/40 p-4">
                        <div className="flex items-center justify-start gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <div className="font-bold">{t("customerFeedback.settings.copy.emojiLabels")}</div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {FEEDBACK_LABEL_ICONS.map((item) => {
                            const Icon = item.icon;
                            return (
                              <div key={item.key} className="space-y-2">
                                <Label className="flex items-center justify-start gap-2 text-start">
                                  <Icon className={`h-5 w-5 ${item.iconClassName}`} />
                                  <span>{t(item.labelKey)}</span>
                                </Label>
                                <Input
                                  className="text-start"
                                  value={settings.emojiLabels[item.key]}
                                  onChange={(event) => setSettings((current) => ({ ...current, emojiLabels: { ...current.emojiLabels, [item.key]: event.target.value } }))}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={saveSettings} disabled={saving} className="rounded-2xl">
                    {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                    {t("customerFeedback.settings.save")}
                  </Button>
                  <Link href={settings.smsSettingsUrl}>
                    <Button variant="outline" className="rounded-2xl">
                      <Settings2 className="me-2 h-4 w-4" />
                      {t("customerFeedback.settings.configureSms")}
                    </Button>
                  </Link>
                </div>
              </TabsContent>

              <TabsContent value="questions" className="space-y-5">
                  <Card>
                    <CardHeader>
                    <CardTitle>{t("customerFeedback.settings.questions.title")}</CardTitle>
                    <CardDescription>{t("customerFeedback.settings.questions.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-4 rounded-3xl border border-dashed border-primary/20 bg-primary/5 p-5">
                      <div className="space-y-1">
                        <div className="font-bold">{t("customerFeedback.settings.questions.addTitle")}</div>
                        <div className="text-sm text-muted-foreground">{t("customerFeedback.settings.questions.addDescription")}</div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_140px]">
                        <div className="space-y-2">
                          <Label>{t("customerFeedback.settings.questions.questionText")}</Label>
                          <Input className="text-start" value={newQuestion.title} onChange={(event) => setNewQuestion((current) => ({ ...current, title: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("customerFeedback.settings.questions.displayType")}</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant={newQuestion.displayType === "emoji" ? "default" : "outline"} className="rounded-2xl" onClick={() => setNewQuestion((current) => ({ ...current, displayType: "emoji" }))}>{t("customerFeedback.report.displayType.icon")}</Button>
                            <Button type="button" variant={newQuestion.displayType === "star" ? "default" : "outline"} className="rounded-2xl" onClick={() => setNewQuestion((current) => ({ ...current, displayType: "star" }))}>{t("customerFeedback.report.displayType.star")}</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("customerFeedback.settings.questions.sortOrder")}</Label>
                          <Input className="text-start" type="number" min={0} value={newQuestion.sortOrder} onChange={(event) => setNewQuestion((current) => ({ ...current, sortOrder: Number(event.target.value || 0) }))} />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <label className="flex items-center gap-3 text-sm font-medium">
                          <Switch checked={newQuestion.isActive} onCheckedChange={(checked) => setNewQuestion((current) => ({ ...current, isActive: checked }))} />
                          <span>{t("customerFeedback.settings.questions.active")}</span>
                        </label>
                        <Button
                          onClick={async () => {
                            if (!newQuestion.title.trim()) {
                              toast({ variant: "destructive", title: t("customerFeedback.settings.toast.questionTitleRequired"), description: t("customerFeedback.settings.toast.questionTitleRequiredDescription") });
                              return;
                            }
                            setQuestionSaving(true);
                            await saveQuestion(newQuestion);
                            setQuestionSaving(false);
                          }}
                          disabled={questionSaving}
                          className="rounded-2xl sm:min-w-40"
                        >
                          {questionSaving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
                          {t("customerFeedback.settings.questions.add")}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {settings.questions.length === 0 ? (
                        <div className="rounded-2xl border border-border/70 bg-background/40 p-6 text-center text-muted-foreground">
                          {t("customerFeedback.settings.questions.empty")}
                        </div>
                      ) : (
                        settings.questions
                          .slice()
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((question) => (
                            <QuestionEditor key={question.id} question={question} onSave={saveQuestion} onRemove={removeQuestion} />
                          ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reports" className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-lg font-black">{t("customerFeedback.report.title")}</h2>
                    <p className="text-sm text-muted-foreground">{t("customerFeedback.settings.reports.description")}</p>
                  </div>
                  <Button variant="outline" className="rounded-2xl" onClick={() => void loadReport()} disabled={reportLoading}>
                    {reportLoading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <BarChart3 className="me-2 h-4 w-4" />}
                    {t("customerFeedback.report.refresh")}
                  </Button>
                </div>

                {reportError ? (
                  <Card className="border-dashed border-destructive/30 bg-destructive/5">
                    <CardContent className="p-6 text-start text-sm text-muted-foreground">{reportError}</CardContent>
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
                      {reportLoading ? (
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
                      {reportLoading ? (
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
                                      {participant.appointmentDate}
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
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
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
                <InfoCard title={t("customerFeedback.report.info.customerName")} value={responseDetail.customerName} />
                <InfoCard title={t("customerFeedback.report.info.mobile")} value={responseDetail.customerMobile} ltr />
                <InfoCard title={t("customerFeedback.report.info.professional")} value={responseDetail.professionalName || "-"} />
                <InfoCard title={t("customerFeedback.report.info.service")} value={responseDetail.serviceName || "-"} />
                <InfoCard title={t("customerFeedback.report.info.appointmentDate")} value={responseDetail.appointmentDate || "-"} />
                <InfoCard title={t("customerFeedback.report.info.appointmentTime")} value={responseDetail.appointmentTime || "-"} ltr />
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
}: {
  title: string;
  value: string;
  ltr?: boolean;
}) {
  const { dir } = useLocale();

  return (
    <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="mt-1 text-lg font-bold" dir={ltr ? "ltr" : dir}>
        {ltr ? <PhoneText>{value}</PhoneText> : value}
      </div>
    </div>
  );
}

function QuestionEditor({
  question,
  onSave,
  onRemove,
}: {
  question: CustomerFeedbackQuestion;
  onSave: (question: Omit<CustomerFeedbackQuestion, "id">, id?: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const t = useT();
  const [draft, setDraft] = useState<CustomerFeedbackQuestion>(question);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setDraft(question);
  }, [question]);

  return (
    <div className="space-y-4 rounded-3xl border border-border/70 bg-background/50 p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_140px]">
        <div className="space-y-2">
          <Label>{t("customerFeedback.settings.questions.questionText")}</Label>
          <Input className="text-start" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>{t("customerFeedback.settings.questions.displayType")}</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={draft.displayType === "emoji" ? "default" : "outline"} className="rounded-2xl" onClick={() => setDraft((current) => ({ ...current, displayType: "emoji" }))}>{t("customerFeedback.report.displayType.icon")}</Button>
            <Button type="button" variant={draft.displayType === "star" ? "default" : "outline"} className="rounded-2xl" onClick={() => setDraft((current) => ({ ...current, displayType: "star" }))}>{t("customerFeedback.report.displayType.star")}</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("customerFeedback.settings.questions.sortOrder")}</Label>
          <Input className="text-start" type="number" min={0} value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value || 0) }))} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-3 text-sm font-medium">
          <Switch checked={draft.isActive} onCheckedChange={(checked) => setDraft((current) => ({ ...current, isActive: checked }))} />
          <span>{t("customerFeedback.settings.questions.active")}</span>
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={async () => {
              setSaving(true);
              await onSave({ title: draft.title, displayType: draft.displayType, sortOrder: draft.sortOrder, isActive: draft.isActive }, draft.id);
              setSaving(false);
            }}
            disabled={saving}
            className="rounded-2xl sm:min-w-36"
          >
            {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
            {t("customerFeedback.settings.questions.save")}
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              setRemoving(true);
              await onRemove(draft.id);
              setRemoving(false);
            }}
            disabled={removing}
            className="rounded-2xl sm:min-w-32"
          >
            {removing ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />}
            {t("customerFeedback.settings.questions.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
