import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowRight, Bell, CalendarX2, CheckCircle2, Loader2, PauseCircle, PlayCircle, Send, ShieldAlert, WalletCards } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { subscribeSmsCampaignUpdates } from "@/lib/realtime";
import type { AppointmentBookingClosurePayload } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

const STATUS_LABEL_KEYS: Record<string, MessageKey> = {
  queued: "panelBookingClosure.status.queued",
  sending: "panelBookingClosure.status.sending",
  paused: "panelBookingClosure.status.paused",
  completed: "panelBookingClosure.status.completed",
  cancelled: "panelBookingClosure.status.cancelled",
  failed: "panelBookingClosure.status.failed",
  draft: "panelBookingClosure.status.draft",
  pending_review: "panelBookingClosure.status.pendingReview",
  rejected: "panelBookingClosure.status.rejected",
};

function percent(done: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

function getStatusLabel(status: string | null | undefined, t: (key: MessageKey) => string) {
  if (!status) return t("panelBookingClosure.delivery.notSent");
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(key) : status;
}

export default function PanelBookingClosureDetailPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/panel/booking-closure/:closureId");
  const closureId = params?.closureId ?? null;
  const [payload, setPayload] = useState<AppointmentBookingClosurePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showOpenedNotice, setShowOpenedNotice] = useState(false);

  const load = async () => {
    if (!closureId) {
      setLoading(false);
      return;
    }

    const res = await api.bookingClosure.get(closureId);
    if (res.success) {
      setPayload(res.data);
    } else {
      toast({ variant: "destructive", title: t("panelBookingClosure.toast.loadFailed"), description: res.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [closureId]);

  useEffect(() => {
    if (!closureId || typeof window === "undefined") {
      return;
    }

    const query = new URLSearchParams(window.location.search);
    if (query.get("opened") === "1") {
      setShowOpenedNotice(true);
      setLocation(`/panel/booking-closure/${closureId}`, { replace: true });
    }
  }, [closureId, setLocation]);

  useEffect(() => {
    return subscribeSmsCampaignUpdates((eventPayload) => {
      const campaignId = String(eventPayload.campaign?.id ?? "");
      if (campaignId && payload?.campaign?.id === campaignId) {
        void load();
      }
    });
  }, [payload?.campaign?.id, closureId]);

  const stats = payload?.notificationStats;
  const campaign = payload?.campaign;
  const closure = payload?.closure ?? null;
  const sentOrFailed = (stats?.sent ?? 0) + (stats?.failed ?? 0) + (stats?.cancelled ?? 0);
  const progress = percent(sentOrFailed, stats?.queued || stats?.requested || 0);
  const canStartNotifications = !!closure && (stats?.requested ?? 0) > 0 && !["sending", "queued", "completed"].includes(campaign?.status ?? "");
  const canPauseNotifications = ["queued", "sending"].includes(campaign?.status ?? "");

  const runAction = async (key: string, action: () => Promise<{ success: boolean; data: AppointmentBookingClosurePayload; message?: string }>) => {
    setActionLoading(key);
    const res = await action();
    setActionLoading(null);

    if (!res.success) {
      toast({ variant: "destructive", title: t("panelBookingClosure.toast.actionFailed"), description: res.message });
      return;
    }

    setPayload(res.data);
    toast({ title: t("panelBookingClosure.toast.actionDone"), description: res.message });
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground" dir={dir}>
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
          <ShieldAlert className="mb-4 h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelBookingClosure.accessDenied.title")}</h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("panelBookingClosure.detail.accessDeniedDescription")}</p>
          <Link href="/panel/booking-closure"><Button className="mt-5">{t("panelBookingClosure.back")}</Button></Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="barber-settings-page min-h-screen bg-background pb-20 text-start text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 shadow-sm backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-xl font-bold text-primary">
            <Bell className="h-6 w-6" />
            <h1>{t("panelBookingClosure.detail.title")}</h1>
          </div>
          <Link href="/panel/booking-closure">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
              title={t("panelBookingClosure.back")}
            >
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-5 px-4 py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-7 text-muted-foreground">{t("panelBookingClosure.detail.description")}</p>
          {campaign ? (
            <Badge variant={campaign.status === "completed" ? "secondary" : campaign.status === "failed" ? "destructive" : "outline"} className="w-fit px-3 py-1 text-sm">
              {getStatusLabel(campaign.status, t)}
            </Badge>
          ) : null}
        </div>

        {showOpenedNotice ? (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm leading-7 text-emerald-700 dark:text-emerald-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-5 w-5 flex-shrink-0" />
              <div>
                <div className="font-bold text-foreground">{t("panelBookingClosure.detail.openedNoticeTitle")}</div>
                <div className="text-muted-foreground">{t("panelBookingClosure.detail.openedNoticeDescription")}</div>
              </div>
            </div>
          </div>
        ) : null}

        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-primary" />
              {t("panelBookingClosure.detail.reportTitle")}
            </CardTitle>
            <CardDescription>{t("panelBookingClosure.detail.reportDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {closure ? (
              <div className="rounded-xl border border-border/70 bg-background/35 p-4 text-sm leading-7">
                <div className="flex items-start gap-2 font-bold text-foreground">
                  <CalendarX2 className="mt-1 h-4 w-4 text-primary" />
                  {t("panelBookingClosure.detail.closedAt", { date: format.dateTime(closure.closedAt) || t("panelBookingClosure.valueMissing") })}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {closure.openedAt
                    ? t("panelBookingClosure.detail.openedAt", { date: format.dateTime(closure.openedAt) })
                    : t("panelBookingClosure.detail.stillOpen")}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/70 bg-background/35 p-4 text-sm leading-7 text-muted-foreground">
                {t("panelBookingClosure.detail.notFound")}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatBox title={t("panelBookingClosure.detail.stats.requested")} value={format.number(stats?.requested ?? 0)} />
              <StatBox title={t("panelBookingClosure.detail.stats.sent")} value={format.number(stats?.sent ?? 0)} tone="success" />
              <StatBox title={t("panelBookingClosure.detail.stats.failed")} value={format.number(stats?.failed ?? 0)} tone="danger" />
              <StatBox title={t("panelBookingClosure.detail.stats.pending")} value={format.number(stats?.pending ?? 0)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("panelBookingClosure.detail.progress")}</span>
                <span>{format.percent(progress / 100)}</span>
              </div>
              <Progress value={progress} />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <InfoBox icon={<WalletCards className="h-4 w-4" />} title={t("panelBookingClosure.detail.smsCredit")} value={format.currency(stats?.creditBalance)} />
              <InfoBox title={t("panelBookingClosure.detail.estimatedCost")} value={format.currency(stats?.estimatedTotalPrice)} />
              <InfoBox title={t("panelBookingClosure.detail.spentCost")} value={format.currency(stats?.spentTotalPrice)} />
            </div>

            {campaign ? (
              <div className="rounded-xl border border-border/70 bg-background/35 p-4 text-sm leading-7">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-bold text-foreground">{t("panelBookingClosure.detail.campaignTitle")}</div>
                    <div className="text-muted-foreground">{getStatusLabel(campaign.status, t)}</div>
                  </div>
                  {campaign.lastError ? <Badge variant="destructive" className="w-fit">{campaign.lastError}</Badge> : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="gap-2"
                onClick={() => runAction("start", () => api.bookingClosure.startNotifications(closureId))}
                disabled={!canStartNotifications || actionLoading !== null}
              >
                {actionLoading === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : campaign?.status === "paused" ? <PlayCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {campaign?.status === "paused" ? t("panelBookingClosure.detail.continueSms") : t("panelBookingClosure.detail.sendSms")}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => runAction("pause", () => api.bookingClosure.pauseNotifications(closureId))}
                disabled={!canPauseNotifications || actionLoading !== null}
              >
                {actionLoading === "pause" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />}
                {t("panelBookingClosure.detail.pauseSms")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatBox({ title, value, tone }: { title: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/35 p-4">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className={`mt-2 text-2xl font-black ${tone === "success" ? "text-emerald-500" : tone === "danger" ? "text-destructive" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function InfoBox({ title, value, icon }: { title: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/35 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="mt-2 font-bold text-foreground">{value}</div>
    </div>
  );
}
