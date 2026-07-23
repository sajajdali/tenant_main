import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import arabic from "react-date-object/calendars/arabic";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";
import arabic_ar from "react-date-object/locales/arabic_ar";
import gregorian_en from "react-date-object/locales/gregorian_en";
import persian_fa from "react-date-object/locales/persian_fa";
import { addDays, format } from "date-fns";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MessageSquareText,
  Phone,
  ReceiptText,
  Trash2,
  User,
  UserRoundX,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Appointment, ManualFinanceCustomerSummary, TenantMeta } from "@/lib/types";
import { api } from "@/lib/api";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { CancelModal } from "@/components/cancel-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { LtrText, PhoneText, UrlText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const toSafeDate = (value: string) => new Date(`${value}T12:00:00`);

export default function PanelDailyReportPage() {
  const { isAdmin, isBarber, user } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const formatters = useFormat();
  const { calendar, dir, isRtl, locale } = useLocale();
  const {
    barbers,
    appointments,
    loading,
    currentDate,
    currentBarberId,
    setCurrentDate,
    setCurrentBarberId,
    fetchAppointments,
  } = useStore();

  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [detailTarget, setDetailTarget] = useState<Appointment | null>(null);
  const [noShowTarget, setNoShowTarget] = useState<Appointment | null>(null);
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [financeSummaries, setFinanceSummaries] = useState<Record<string, ManualFinanceCustomerSummary>>({});
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const labels = getAudienceLabels(tenantMeta);
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const pickerCalendar = calendar === "hijri" ? arabic : calendar === "jalali" ? persian : gregorian;
  const pickerLocale = calendar === "hijri" ? arabic_ar : locale === "fa" ? persian_fa : gregorian_en;
  const calendarPosition = isRtl ? "bottom-right" : "bottom-left";
  const money = (value: number) => formatters.currency(value);
  const reportDate = (value: string) => formatters.date(toSafeDate(value));
  const appointmentTime = (value: string) => formatters.time(`2000-01-01T${value}`, { hourCycle: "h23" });
  const statusLabels: Record<Appointment["status"], string> = {
    booked: t("panelDailyReport.status.booked"),
    completed: t("panelDailyReport.status.completed"),
    no_show: t("panelDailyReport.status.noShow"),
    cancelled: t("panelDailyReport.status.cancelled"),
    pending_payment: t("panelDailyReport.status.pendingPayment"),
  };

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) {
        setTenantMeta(res.data);
      }
    });
  }, []);

  const ownBarber = useMemo(
    () => (isBarber ? barbers.find((barber) => barber.userId === user?.id) ?? null : null),
    [barbers, isBarber, user?.id],
  );

  useEffect(() => {
    if (isBarber && ownBarber && currentBarberId !== ownBarber.id) {
      setCurrentBarberId(ownBarber.id);
      return;
    }

    if (isAdmin && !currentBarberId && barbers.length > 0) {
      setCurrentBarberId(barbers[0].id);
    }
  }, [barbers, currentBarberId, isAdmin, isBarber, ownBarber, setCurrentBarberId]);

  const currentBarber = useMemo(
    () => barbers.find((barber) => barber.id === currentBarberId) ?? null,
    [barbers, currentBarberId],
  );

  const rows = useMemo(() => {
    return [...appointments]
      .filter((appointment) => appointment.status !== "cancelled")
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [appointments]);

  useEffect(() => {
    const mobiles = Array.from(new Set(rows.map((appointment) => appointment.userPhone).filter(Boolean)));
    if (!mobiles.length || !currentBarberId) {
      setFinanceSummaries({});
      return;
    }

    let cancelled = false;
    api.manualFinance.customerSummaries({ mobiles, professionalId: currentBarberId }).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setFinanceSummaries(Object.fromEntries(res.data.items.map((item) => [item.customerPhone, item])));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [rows, currentBarberId]);

  const handleAttendanceUpdate = async (
    appointment: Appointment,
    status: "completed" | "no_show",
    options?: { blockCustomerBooking?: boolean },
  ) => {
    setUpdatingAppointmentId(appointment.id);
    const res = await api.appointments.updateAttendance(appointment.id, status, options);
    setUpdatingAppointmentId(null);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    if (detailTarget?.id === appointment.id) {
      setDetailTarget(res.data);
    }

    toast({ title: res.message || t("panelDailyReport.toast.attendanceSaved") });
    await fetchAppointments();
  };

  const handleNoShowConfirm = async (blockCustomerBooking: boolean) => {
    if (!noShowTarget) {
      return;
    }

    const target = noShowTarget;
    setNoShowTarget(null);
    await handleAttendanceUpdate(target, "no_show", { blockCustomerBooking });
  };

  const copyFeedbackLink = async (appointment: Appointment) => {
    if (!appointment.feedbackUrl) {
      toast({ variant: "destructive", title: t("panelDailyReport.toast.feedbackLinkMissing") });
      return;
    }

    try {
      await navigator.clipboard.writeText(appointment.feedbackUrl);
      toast({ title: t("panelDailyReport.toast.feedbackLinkCopied") });
    } catch {
      toast({ variant: "destructive", title: t("panelDailyReport.toast.copyFailed") });
    }
  };

  const handleExport = async () => {
    if (!currentBarberId) {
      toast({ variant: "destructive", title: t("common.error"), description: t("panelDailyReport.empty.selectProfessional", { professional: labels.singular }) });
      return;
    }

    setExporting(true);
    const res = await api.appointments.exportDailyReport(currentDate, currentBarberId);
    setExporting(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    const downloadUrl = window.URL.createObjectURL(res.data.blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = res.data.filename || "daily-report.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  };

  if (!isAdmin && !isBarber) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <CalendarDays className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{t("panelDailyReport.accessDenied.title")}</h1>
          <p className="text-muted-foreground leading-7">{t("panelDailyReport.accessDenied.description", { professional: labels.singular })}</p>
          <Link href="/panel">
            <Button>{t("panelDailyReport.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("panelDailyReport.title")}</h1>
          </div>
          <Link href="/panel">
            <Button
              variant="outline"
              size="icon"
              title={t("panelDailyReport.backToPanel")}
              className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            >
              <ArrowRight className={`w-5 h-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">{t("panelDailyReport.filter.title")}</CardTitle>
              <CardDescription>{t("panelDailyReport.filter.description", { professional: labels.singular })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">{labels.singular}</label>
                <select
                  value={currentBarberId}
                  onChange={(event) => setCurrentBarberId(event.target.value)}
                  disabled={isBarber}
                  className="w-full appearance-none rounded-xl border border-border bg-background p-3 pe-10 ps-3 text-start"
                >
                  {!isBarber && <option value="">{t("panelDailyReport.filter.selectProfessional")}</option>}
                  {barbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">{t("panelDailyReport.filter.reportDay")}</label>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentDate(format(addDays(toSafeDate(currentDate), -1), "yyyy-MM-dd"))}
                  >
                    {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </Button>
                  <DatePicker
                    value={new DateObject({ date: toSafeDate(currentDate), calendar: pickerCalendar, locale: pickerLocale })}
                    onChange={(value) => {
                      const formatted = value?.isValid ? format(value.toDate(), "yyyy-MM-dd") : currentDate;
                      setCurrentDate(formatted);
                    }}
                    calendar={pickerCalendar}
                    locale={pickerLocale}
                    calendarPosition={calendarPosition}
                    format="YYYY/MM/DD"
                    inputClass="w-full rounded-xl border border-border bg-background px-4 py-3 text-center"
                    containerClassName="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentDate(format(addDays(toSafeDate(currentDate), 1), "yyyy-MM-dd"))}
                  >
                    {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {currentBarber && (
                <div className="rounded-[1.75rem] border border-border/70 bg-background/30 p-4 text-sm">
                  <div className="font-bold text-foreground">{currentBarber.name}</div>
                  <div className="mt-1 text-muted-foreground">{t("panelDailyReport.filter.reportDate", { date: reportDate(currentDate) })}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">{t("panelDailyReport.list.title")}</CardTitle>
                  <CardDescription>{t("panelDailyReport.list.description")}</CardDescription>
                </div>
                <Badge variant="secondary">{t("panelDailyReport.value.appointmentsCount", { count: formatters.number(rows.length) })}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {barbers.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-background/20 p-10 text-center text-muted-foreground">
                  {t("panelDailyReport.empty.noProfessionals", { professional: labels.singular, business: labels.business })}
                </div>
              ) : !currentBarberId ? (
                <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-background/20 p-10 text-center text-muted-foreground">
                  {t("panelDailyReport.empty.selectProfessional", { professional: labels.singular })}
                </div>
              ) : loading ? (
                <div className="flex h-52 items-center justify-center text-muted-foreground">
                  <Loader2 className="me-2 h-5 w-5 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-background/20 p-10 text-center text-muted-foreground">
                  {t("panelDailyReport.empty.noAppointmentsForDay")}
                </div>
              ) : (
                <div className="space-y-3">
                  {rows.map((appointment) => {
                    const financeSummary = financeSummaries[appointment.userPhone];
                    const hasDebt = (financeSummary?.balanceAmount ?? 0) > 0;

                    return (
                    <div
                      key={appointment.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetailTarget(appointment)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setDetailTarget(appointment);
                        }
                      }}
                      className={`w-full min-w-0 cursor-pointer overflow-hidden rounded-[1.6rem] border bg-gradient-to-r from-card via-card/95 to-background/20 p-4 text-start transition-all hover:border-primary/35 hover:shadow-lg hover:shadow-black/10 md:rounded-[1.4rem] md:p-3.5 ${hasDebt ? "border-destructive/50 bg-destructive/5" : "border-border/70"}`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col items-start gap-2">
                            <div className="flex items-center gap-2 text-2xl font-black tracking-tight md:text-lg">
                              <LtrText>{appointmentTime(appointment.startTime)}</LtrText>
                              <Clock3 className="h-4 w-4 text-primary" />
                            </div>
                            <Badge
                              variant={
                                appointment.status === "completed"
                                  ? "secondary"
                                  : appointment.status === "no_show"
                                    ? "destructive"
                                    : "outline"
                              }
                              className="rounded-full px-3 py-1 text-xs"
                            >
                              {statusLabels[appointment.status]}
                            </Badge>
                            {appointment.isOffQueue && (
                              <Badge className="rounded-full border-amber-400/50 bg-amber-500/15 px-3 py-1 text-[11px] text-amber-100 hover:bg-amber-500/15">
                                {t("panelDailyReport.badge.offQueue")}
                              </Badge>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 text-start">
                            <div className="flex min-w-0 items-start justify-end gap-2 text-start text-[1.85rem] font-black leading-none md:text-xl">
                              <span className="line-clamp-2 min-w-0 break-words leading-tight [overflow-wrap:anywhere]">{appointment.userName}</span>
                              <User className="mt-1 h-4 w-4 shrink-0 text-primary" />
                            </div>
                            <div className="mt-2 text-sm leading-7 text-muted-foreground md:text-xs md:leading-6">
                              {appointment.isForSomeoneElse && appointment.bookedByName
                                ? t("panelDailyReport.booking.bookedByOther", { name: appointment.bookedByName })
                                : t("panelDailyReport.booking.direct")}
                            </div>
                            {hasDebt ? (
                              <Badge variant="destructive" className="mt-2 rounded-full">
                                {t("panelDailyReport.badge.debt", { amount: money(financeSummary.balanceAmount) })}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          <div className="rounded-2xl border border-border/50 bg-background/25 px-3 py-2 text-start">
                            <div className="flex w-full items-center justify-end gap-2 text-start text-base text-muted-foreground md:text-sm">
                              <PhoneText>{appointment.userPhone}</PhoneText>
                              <Phone className="h-4 w-4 shrink-0 text-primary" />
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/50 bg-background/25 px-3 py-2 text-start">
                            <div className="flex w-full items-center justify-end gap-2 text-start text-sm text-foreground md:text-sm">
                              <span>{appointment.sectionName || t("panelDailyReport.value.service")}</span>
                              <BriefcaseBusiness className="h-4 w-4 shrink-0 text-primary" />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground md:text-xs">
                          {appointment.notes?.trim() ? (
                            <>
                              <span>{t("panelDailyReport.notes.hasNotes")}</span>
                              <MessageSquareText className="h-4 w-4 shrink-0 text-primary" />
                            </>
                          ) : (
                            <span>{t("panelDailyReport.notes.noNotesShort")}</span>
                          )}
                        </div>

                        <div className="border-t border-border/60 pt-3" onClick={(event) => event.stopPropagation()}>
                          {appointment.status === "booked" ? (
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                size="lg"
                                className="h-11 rounded-2xl bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-500 md:h-9 md:text-xs"
                                disabled={updatingAppointmentId === appointment.id}
                                onClick={() => handleAttendanceUpdate(appointment, "completed")}
                              >
                                <CheckCircle2 className="me-2 h-4 w-4" />
                                {t("panelDailyReport.action.markCompleted")}
                              </Button>
                              <Button
                                size="lg"
                                variant="outline"
                                className="h-11 rounded-2xl border-amber-500/40 bg-amber-500/10 px-3 text-sm font-bold text-amber-300 hover:bg-amber-500/20 md:h-9 md:text-xs"
                                disabled={updatingAppointmentId === appointment.id}
                                onClick={() => setNoShowTarget(appointment)}
                              >
                                <UserRoundX className="me-2 h-4 w-4" />
                                {t("panelDailyReport.action.markNoShow")}
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex justify-end">
                                <Badge
                                  variant={appointment.status === "completed" ? "secondary" : "destructive"}
                                  className="rounded-2xl px-3 py-2 text-sm font-bold md:text-xs"
                                >
                                  {appointment.status === "completed"
                                    ? t("panelDailyReport.attendance.completedSaved")
                                    : t("panelDailyReport.attendance.noShowSaved")}
                                </Badge>
                              </div>
                              {appointment.status === "completed" && appointment.feedbackUrl ? (
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button asChild size="sm" variant="outline" className="h-9 rounded-2xl px-3 text-xs">
                                    <a href={appointment.feedbackUrl} target="_blank" rel="noreferrer">
                                      <ExternalLink className="me-1 h-4 w-4" />
                                      {t("panelDailyReport.action.openFeedback")}
                                    </a>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 rounded-2xl px-3 text-xs"
                                    onClick={() => copyFeedbackLink(appointment)}
                                  >
                                    <Copy className="me-1 h-4 w-4" />
                                    {t("panelDailyReport.action.copyLink")}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          )}
                          <div className="mt-2 flex justify-end">
                            <Button asChild size="sm" variant="outline" className="me-2 h-9 rounded-2xl px-3 text-xs">
                              <Link href={`/panel/manual-finance?appointment_id=${encodeURIComponent(appointment.id)}`}>
                                <ReceiptText className="me-1 h-4 w-4" />
                                {t("panelDailyReport.action.addFinance")}
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-2xl border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => setCancelTarget(appointment)}
                            >
                              <Trash2 className="me-1 h-4 w-4" />
                              {t("common.cancel")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}

                  <div className="flex justify-end pt-2">
                    <Button
                      className="h-11 rounded-2xl px-5 text-sm font-bold"
                      disabled={exporting || !currentBarberId || rows.length === 0}
                      onClick={handleExport}
                    >
                      {exporting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Download className="me-2 h-4 w-4" />}
                      {t("panelDailyReport.action.exportExcel")}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={!!detailTarget} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <DialogContent className="sm:max-w-xl" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-start">{t("panelDailyReport.detail.title")}</DialogTitle>
            <DialogDescription className="text-start">
              {t("panelDailyReport.detail.description")}
            </DialogDescription>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-4 text-start">
              {(financeSummaries[detailTarget.userPhone]?.balanceAmount ?? 0) > 0 ? (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
                  {t("panelDailyReport.detail.activeDebt", { amount: money(financeSummaries[detailTarget.userPhone].balanceAmount) })}
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                  <div className="text-sm text-muted-foreground">{t("panelDailyReport.detail.time")}</div>
                  <div className="mt-1 text-xl font-bold">
                    <LtrText>{appointmentTime(detailTarget.startTime)}</LtrText>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                  <div className="text-sm text-muted-foreground">{t("panelDailyReport.detail.status")}</div>
                  <div className="mt-1 text-xl font-bold">{statusLabels[detailTarget.status]}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                  <div className="text-sm text-muted-foreground">{t("panelDailyReport.detail.customer")}</div>
                  <div className="mt-1 line-clamp-2 break-words text-lg font-bold leading-7 [overflow-wrap:anywhere]">{detailTarget.userName}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                  <div className="text-sm text-muted-foreground">{t("panelDailyReport.detail.mobile")}</div>
                  <div className="mt-1 text-lg font-bold">
                    <PhoneText>{detailTarget.userPhone}</PhoneText>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                <div className="text-sm text-muted-foreground">{t("panelDailyReport.detail.service")}</div>
                <div className="mt-1 text-lg font-bold">{detailTarget.sectionName || t("panelDailyReport.value.unknown")}</div>
              </div>

              <div className="flex justify-end">
                <Button asChild className="rounded-2xl">
                  <Link href={`/panel/manual-finance?appointment_id=${encodeURIComponent(detailTarget.id)}`}>
                    <ReceiptText className="me-2 h-4 w-4" />
                    {t("panelDailyReport.action.addFinanceForAppointment")}
                  </Link>
                </Button>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                <div className="text-sm text-muted-foreground">{t("panelDailyReport.detail.bookingType")}</div>
                <div className="mt-1 text-lg font-bold">
                  {detailTarget.isOffQueue ? t("panelDailyReport.booking.offQueue") : t("panelDailyReport.booking.normal")}
                </div>
              </div>

              {detailTarget.status === "completed" && detailTarget.feedbackUrl ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="text-sm text-muted-foreground">{t("panelDailyReport.detail.feedbackLink")}</div>
                  <UrlText className="mt-2 max-w-full truncate text-xs text-muted-foreground">{detailTarget.feedbackUrl}</UrlText>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button asChild size="sm" className="rounded-2xl">
                      <a href={detailTarget.feedbackUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="me-2 h-4 w-4" />
                        {t("panelDailyReport.action.openFeedback")}
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => copyFeedbackLink(detailTarget)}>
                      <Copy className="me-2 h-4 w-4" />
                      {t("panelDailyReport.action.copyLink")}
                    </Button>
                  </div>
                </div>
              ) : null}

              {detailTarget.isForSomeoneElse && detailTarget.bookedByName && (
                <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                  <div className="text-sm text-muted-foreground">{t("panelDailyReport.detail.booker")}</div>
                  <div className="mt-1 text-base font-bold">
                    {detailTarget.bookedByName}
                    {detailTarget.bookedByPhone ? (
                      <>
                        {" "}
                        - <PhoneText>{detailTarget.bookedByPhone}</PhoneText>
                      </>
                    ) : null}
                  </div>
                </div>
              )}

              {detailTarget.notes?.trim() ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-end gap-2 text-sm text-primary">
                    <span>{t("panelDailyReport.detail.notes")}</span>
                    <MessageSquareText className="h-4 w-4" />
                  </div>
                  <p className="mt-3 leading-8">{detailTarget.notes}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-4 text-sm text-muted-foreground">
                  {t("panelDailyReport.notes.noNotes")}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!noShowTarget} onOpenChange={(open) => !open && setNoShowTarget(null)}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-start">{t("panelDailyReport.noShow.title")}</DialogTitle>
            <DialogDescription className="text-start leading-7">
              {noShowTarget
                ? t("panelDailyReport.noShow.descriptionWithName", { name: noShowTarget.userName })
                : t("panelDailyReport.noShow.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border/70 bg-background/30 p-4 text-sm text-muted-foreground">
              {t("panelDailyReport.noShow.blockHint")}
            </div>

            <div className="grid gap-3">
              <Button
                className="h-11 rounded-2xl bg-amber-500 text-sm font-bold text-slate-950 hover:bg-amber-400"
                disabled={!!updatingAppointmentId}
                onClick={() => handleNoShowConfirm(true)}
              >
                <UserRoundX className="me-2 h-4 w-4" />
                {t("panelDailyReport.noShow.submitAndBlock")}
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-2xl text-sm font-bold"
                disabled={!!updatingAppointmentId}
                onClick={() => handleNoShowConfirm(false)}
              >
                {t("panelDailyReport.noShow.submitOnly")}
              </Button>
              <Button
                variant="ghost"
                className="h-10 rounded-2xl text-sm"
                disabled={!!updatingAppointmentId}
                onClick={() => setNoShowTarget(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CancelModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        appointment={cancelTarget}
      />
    </div>
  );
}
