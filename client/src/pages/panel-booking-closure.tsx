import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, CalendarX2, ChevronLeft, ChevronRight, Eye, Loader2, LockOpen, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { subscribeSmsCampaignUpdates } from "@/lib/realtime";
import type { AppointmentBookingClosurePayload } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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

function getStatusLabel(status: string | null | undefined, t: (key: MessageKey) => string) {
  if (!status) return t("panelBookingClosure.delivery.notSent");
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(key) : status;
}

function deliveryLabel(status: string | null | undefined, requested = 0, sent = 0, t: (key: MessageKey) => string) {
  if (!requested) return t("panelBookingClosure.delivery.noRequest");
  if (!status) return t("panelBookingClosure.delivery.notSent");
  if (status === "completed" && sent >= requested) return t("panelBookingClosure.delivery.completed");
  return getStatusLabel(status, t);
}

export default function PanelBookingClosurePage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [, setLocation] = useLocation();
  const [payload, setPayload] = useState<AppointmentBookingClosurePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeMessage, setCloseMessage] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = async (page = historyPage) => {
    if (!loading) {
      setHistoryLoading(true);
    }

    const res = await api.bookingClosure.get(null, page);
    if (res.success) {
      setPayload(res.data);
      setHistoryPage(res.data.historyPagination?.currentPage ?? page);
      setCloseMessage(res.data.closedMessage || t("panelBookingClosure.closedMessageDefault"));
      setNotifyEnabled(res.data.notifyOptInEnabled);
    } else {
      toast({ variant: "destructive", title: t("panelBookingClosure.toast.loadFailed"), description: res.message });
    }
    setLoading(false);
    setHistoryLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    return subscribeSmsCampaignUpdates((eventPayload) => {
      const campaignId = String(eventPayload.campaign?.id ?? "");
      const watchedCampaigns = new Set((payload?.history ?? []).map((item) => item.campaign?.id).filter(Boolean));

      if (campaignId && watchedCampaigns.has(campaignId)) {
        void load(historyPage);
      }
    });
  }, [payload?.history, historyPage]);

  const history = payload?.history ?? [];
  const historyPagination = payload?.historyPagination ?? {
    currentPage: historyPage,
    perPage: 20,
    lastPage: 1,
    total: history.length,
    from: history.length ? 1 : 0,
    to: history.length,
  };

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

  const handleClose = async () => {
    if (!closeMessage.trim()) {
      toast({ variant: "destructive", title: t("panelBookingClosure.toast.messageRequired"), description: t("panelBookingClosure.toast.messageRequiredDescription") });
      return;
    }

    await runAction("close", () => api.bookingClosure.close({ message: closeMessage.trim(), notifyOptInEnabled: notifyEnabled }));
    setCloseDialogOpen(false);
  };

  const handleOpen = async () => {
    setActionLoading("open");
    const res = await api.bookingClosure.open();
    setActionLoading(null);

    if (!res.success) {
      toast({ variant: "destructive", title: t("panelBookingClosure.toast.actionFailed"), description: res.message });
      return;
    }

    setPayload(res.data);
    toast({ title: t("panelBookingClosure.toast.actionDone"), description: res.message });

    const openedClosureId = res.data.closure?.id;
    if (openedClosureId) {
      setLocation(`/panel/booking-closure/${openedClosureId}?opened=1`);
    }
  };

  const statusText = useMemo(() => {
    if (payload?.isClosed) return t("panelBookingClosure.statusText.closed");
    return t("panelBookingClosure.statusText.open");
  }, [payload?.isClosed, t]);

  const changeHistoryPage = (page: number) => {
    if (page < 1 || page > historyPagination.lastPage || page === historyPagination.currentPage || historyLoading) {
      return;
    }

    void load(page);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground" dir={dir}>
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
          <ShieldAlert className="mb-4 h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelBookingClosure.accessDenied.title")}</h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("panelBookingClosure.accessDenied.description")}</p>
          <Link href="/panel"><Button className="mt-5">{t("panelBookingClosure.backToPanel")}</Button></Link>
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
            <CalendarX2 className="h-6 w-6" />
            <h1>{t("panelBookingClosure.title")}</h1>
          </div>
          <Link href="/panel">
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
          <p className="text-sm leading-7 text-muted-foreground">{t("panelBookingClosure.description")}</p>
          <Badge variant={payload?.isClosed ? "destructive" : "secondary"} className="w-fit px-3 py-1 text-sm">
            {statusText}
          </Badge>
        </div>

        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {payload?.isClosed ? <CalendarX2 className="h-5 w-5 text-destructive" /> : <LockOpen className="h-5 w-5 text-emerald-500" />}
              {t("panelBookingClosure.current.title")}
            </CardTitle>
            <CardDescription>{payload?.isClosed ? t("panelBookingClosure.current.closedDescription") : t("panelBookingClosure.current.openDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {payload?.isClosed ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
                <div className="text-sm font-bold text-foreground">{t("panelBookingClosure.current.userMessage")}</div>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">{payload.closedMessage}</p>
              </div>
            ) : payload?.closure ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-7 text-muted-foreground">
                {t("panelBookingClosure.current.previousCycleAvailable")}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              {payload?.isClosed ? (
                <Button className="gap-2" onClick={handleOpen} disabled={actionLoading !== null}>
                  {actionLoading === "open" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />}
                  {t("panelBookingClosure.openButton")}
                </Button>
              ) : (
                <Button className="gap-2" variant="destructive" onClick={() => setCloseDialogOpen(true)} disabled={actionLoading !== null}>
                  <CalendarX2 className="h-4 w-4" />
                  {t("panelBookingClosure.closeButton")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarX2 className="h-5 w-5 text-primary" />
              {t("panelBookingClosure.report.title")}
            </CardTitle>
            <CardDescription>{t("panelBookingClosure.report.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length ? (
              <div className="space-y-3">
                <div className={`overflow-x-auto rounded-xl border border-border/70 ${historyLoading ? "opacity-70" : ""}`}>
                  <table className="w-full min-w-[860px] border-collapse text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-start font-medium">{t("panelBookingClosure.table.closedAt")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("panelBookingClosure.table.openedAt")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("panelBookingClosure.table.requested")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("panelBookingClosure.table.sent")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("panelBookingClosure.table.failed")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("panelBookingClosure.table.pending")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("panelBookingClosure.table.deliveryStatus")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("panelBookingClosure.table.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => {
                        const rowStats = item.notificationStats;
                        const label = deliveryLabel(item.campaign?.status, rowStats.requested, rowStats.sent, t);

                        return (
                          <tr key={item.id} className="border-t border-border/70 bg-background/20">
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{format.dateTime(item.closedAt) || t("panelBookingClosure.valueMissing")}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{item.openedAt ? format.dateTime(item.openedAt) : t("panelBookingClosure.stillClosed")}</td>
                            <td className="px-4 py-3 text-foreground">{format.number(rowStats.requested)}</td>
                            <td className="px-4 py-3 text-emerald-500">{format.number(rowStats.sent)}</td>
                            <td className="px-4 py-3 text-destructive">{format.number(rowStats.failed)}</td>
                            <td className="px-4 py-3 text-foreground">{format.number(rowStats.pending)}</td>
                            <td className="px-4 py-3">
                              <Badge variant={item.campaign?.status === "completed" ? "secondary" : item.campaign?.status === "failed" ? "destructive" : "outline"}>
                                {label}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/panel/booking-closure/${item.id}`}>
                                <Button variant="outline" size="sm" className="gap-2">
                                  <Eye className="h-4 w-4" />
                                  {t("panelBookingClosure.table.details")}
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/35 p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {t("panelBookingClosure.pagination.summary", {
                      from: format.number(historyPagination.from),
                      to: format.number(historyPagination.to),
                      total: format.number(historyPagination.total),
                    })}
                    <span className="mx-2">|</span>
                    {t("panelBookingClosure.pagination.page", {
                      current: format.number(historyPagination.currentPage),
                      total: format.number(historyPagination.lastPage),
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    {historyLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => changeHistoryPage(historyPagination.currentPage - 1)}
                      disabled={historyLoading || historyPagination.currentPage <= 1}
                    >
                      {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      {t("panelBookingClosure.pagination.previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => changeHistoryPage(historyPagination.currentPage + 1)}
                      disabled={historyLoading || historyPagination.currentPage >= historyPagination.lastPage}
                    >
                      {t("panelBookingClosure.pagination.next")}
                      {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm leading-7 text-muted-foreground">
                {t("panelBookingClosure.emptyHistory")}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-lg" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t("panelBookingClosure.dialog.title")}</DialogTitle>
            <DialogDescription>{t("panelBookingClosure.dialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea value={closeMessage} onChange={(event) => setCloseMessage(event.target.value)} rows={6} />
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-background/40 p-3 text-sm leading-7">
              <Checkbox checked={notifyEnabled} onCheckedChange={(checked) => setNotifyEnabled(checked === true)} />
              <span>{t("panelBookingClosure.dialog.notifyLabel")}</span>
            </label>
            <Button className="w-full gap-2" variant="destructive" onClick={handleClose} disabled={actionLoading !== null || !closeMessage.trim()}>
              {actionLoading === "close" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarX2 className="h-4 w-4" />}
              {t("panelBookingClosure.closeButton")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
