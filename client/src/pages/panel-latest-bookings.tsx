import { useEffect, useState } from "react";
import { Link } from "wouter";
import DatePicker, { DateObject } from "react-multi-date-picker";
import arabic from "react-date-object/calendars/arabic";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";
import arabic_ar from "react-date-object/locales/arabic_ar";
import gregorian_en from "react-date-object/locales/gregorian_en";
import persian_fa from "react-date-object/locales/persian_fa";
import { format } from "date-fns";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  Loader2,
  MessageSquareText,
  Phone,
  ReceiptText,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Appointment, ManualFinanceCustomerSummary, PaginatedAppointments, TenantMeta } from "@/lib/types";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { CancelModal } from "@/components/cancel-modal";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const perPage = 15;
const toSafeDate = (value: string) => new Date(`${value}T12:00:00`);

const STATUS_BADGE_VARIANTS: Record<Appointment["status"], "default" | "secondary" | "destructive" | "outline"> = {
  booked: "secondary",
  completed: "secondary",
  no_show: "outline",
  cancelled: "destructive",
  pending_payment: "outline",
};

type LatestBookingFilters = {
  date: string;
  name: string;
  mobile: string;
  status: "" | "confirmed" | "pending" | "cancelled";
};

const emptyFilters: LatestBookingFilters = {
  date: "",
  name: "",
  mobile: "",
  status: "",
};

function getTodayDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

function toDatePickerValue(value: string, pickerCalendar: typeof persian | typeof gregorian | typeof arabic, pickerLocale: typeof persian_fa | typeof gregorian_en | typeof arabic_ar) {
  if (!value) {
    return null;
  }

  return new DateObject({
    date: toSafeDate(value),
    calendar: pickerCalendar,
    locale: pickerLocale,
  });
}

export default function PanelLatestBookingsPage() {
  const { isAdmin, isBarber } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const formatters = useFormat();
  const { calendar, dir, isRtl, locale } = useLocale();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [payload, setPayload] = useState<PaginatedAppointments | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filters, setFilters] = useState<LatestBookingFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<LatestBookingFilters>(emptyFilters);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [notesTarget, setNotesTarget] = useState<Appointment | null>(null);
  const [financeSummaries, setFinanceSummaries] = useState<Record<string, ManualFinanceCustomerSummary>>({});
  const labels = getAudienceLabels(tenantMeta);
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const pickerCalendar = calendar === "hijri" ? arabic : calendar === "jalali" ? persian : gregorian;
  const pickerLocale = calendar === "hijri" ? arabic_ar : locale === "fa" ? persian_fa : gregorian_en;
  const calendarPosition = isRtl ? "bottom-right" : "bottom-left";
  const money = (value: number) => formatters.currency(value);
  const formatAppointmentDate = (value: string) => formatters.date(toSafeDate(value), { weekday: "long", month: "long", day: "numeric" });
  const formatAppointmentTime = (value: string) => t("panelLatestBookings.value.time", { time: formatters.time(`2000-01-01T${value}`, { hourCycle: "h23" }) });
  const formatCreatedAt = (value?: string | null) => {
    if (!value) {
      return t("panelLatestBookings.value.missing");
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return t("panelLatestBookings.value.missing");
    }

    return t("panelLatestBookings.value.dateTime", {
      date: formatters.date(date),
      time: formatters.time(date, { hourCycle: "h23" }),
    });
  };
  const statusLabels: Record<Appointment["status"], string> = {
    booked: t("panelLatestBookings.status.confirmed"),
    completed: t("panelLatestBookings.status.confirmed"),
    no_show: t("panelLatestBookings.status.confirmed"),
    cancelled: t("panelLatestBookings.status.cancelled"),
    pending_payment: t("panelLatestBookings.status.pending"),
  };

  const fetchPage = async (nextPage = page) => {
    setLoading(true);
    const res = await api.appointments.latestBookings(nextPage, perPage, appliedFilters);
    setLoading(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setPayload(res.data);
  };

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) {
        setTenantMeta(res.data);
      }
    });
  }, []);

  useEffect(() => {
    void fetchPage(page);
  }, [page, appliedFilters]);

  const hasActiveFilters = Object.values(appliedFilters).some((value) => value.trim() !== "");

  useEffect(() => {
    const mobiles = Array.from(new Set((payload?.items ?? []).map((appointment) => appointment.userPhone).filter(Boolean)));
    if (!mobiles.length) {
      setFinanceSummaries({});
      return;
    }

    let cancelled = false;
    api.manualFinance.customerSummaries({ mobiles }).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setFinanceSummaries(Object.fromEntries(res.data.items.map((item) => [item.customerPhone, item])));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [payload?.items]);

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  if (!isAdmin && !isBarber) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <CalendarDays className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{t("panelLatestBookings.accessDenied.title")}</h1>
          <p className="text-muted-foreground leading-7">{t("panelLatestBookings.accessDenied.description", { professional: labels.singular })}</p>
          <Link href="/panel">
            <Button>{t("panelLatestBookings.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  const rows = payload?.items ?? [];
  const total = payload?.total ?? 0;
  const lastPage = payload?.lastPage ?? 1;
  const today = getTodayDateString();

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("panelLatestBookings.title")}</h1>
          </div>
          <Link href="/panel">
            <Button
              variant="outline"
              size="icon"
              title={t("panelLatestBookings.backToPanel")}
              className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            >
              <ArrowRight className={`w-5 h-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <Card className="border-border/70 bg-card/60">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start transition-colors hover:bg-background/20"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Filter className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-foreground">{t("panelLatestBookings.filters.title")}</div>
                    {hasActiveFilters ? (
                      <div className="mt-1 text-xs text-primary">{t("panelLatestBookings.filters.active")}</div>
                    ) : null}
                  </div>
                </div>
                {isRtl ? (
                  <ChevronLeft className={`h-4 w-4 text-muted-foreground transition-transform ${advancedOpen ? "-rotate-90" : ""}`} />
                ) : (
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${advancedOpen ? "rotate-90" : ""}`} />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/70 px-5 py-5">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2 text-start">
                    <label className="text-sm font-medium">{t("panelLatestBookings.filters.date")}</label>
                    <DatePicker
                      value={toDatePickerValue(filters.date, pickerCalendar, pickerLocale)}
                      onChange={(value) => {
                        const nextDate = value?.isValid ? format(value.toDate(), "yyyy-MM-dd") : "";
                        setFilters((current) => ({ ...current, date: nextDate }));
                      }}
                      calendar={pickerCalendar}
                      locale={pickerLocale}
                      calendarPosition={calendarPosition}
                      format="YYYY/MM/DD"
                      inputClass="h-10 w-full rounded-xl border border-border bg-background px-3 text-center"
                      containerClassName="w-full"
                    />
                  </div>
                  <div className="space-y-2 text-start">
                    <label className="text-sm font-medium">{t("panelLatestBookings.filters.name")}</label>
                    <Input
                      value={filters.name}
                      onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))}
                      placeholder={t("panelLatestBookings.filters.namePlaceholder")}
                      className="h-10 rounded-xl text-start"
                    />
                  </div>
                  <div className="space-y-2 text-start">
                    <label className="text-sm font-medium">{t("panelLatestBookings.filters.mobile")}</label>
                    <Input
                      value={filters.mobile}
                      onChange={(event) => setFilters((current) => ({ ...current, mobile: event.target.value }))}
                      placeholder={t("panelLatestBookings.filters.mobilePlaceholder")}
                      className="h-10 rounded-xl [direction:ltr] [text-align:left]"
                    />
                  </div>
                  <div className="space-y-2 text-start">
                    <label className="text-sm font-medium">{t("panelLatestBookings.filters.status")}</label>
                    <select
                      value={filters.status}
                      onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as LatestBookingFilters["status"] }))}
                      className="h-10 w-full appearance-none rounded-xl border border-border bg-background px-3 text-start"
                    >
                      <option value="">{t("panelLatestBookings.filters.allStatuses")}</option>
                      <option value="confirmed">{t("panelLatestBookings.status.confirmed")}</option>
                      <option value="pending">{t("panelLatestBookings.status.pending")}</option>
                      <option value="cancelled">{t("panelLatestBookings.status.cancelled")}</option>
                    </select>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs" onClick={handleClearFilters}>
                    <X className="me-1 h-4 w-4" />
                    {t("panelLatestBookings.filters.clear")}
                  </Button>
                  <Button className="h-9 rounded-xl px-4 text-xs" onClick={handleApplyFilters}>
                    <Search className="me-1 h-4 w-4" />
                    {t("panelLatestBookings.filters.apply")}
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">{t("panelLatestBookings.list.title")}</CardTitle>
                <CardDescription>
                  {isBarber
                    ? t("panelLatestBookings.list.barberDescription", { professional: labels.singular })
                    : t("panelLatestBookings.list.adminDescription", { business: labels.business })}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                {t("panelLatestBookings.value.appointmentsCount", { count: formatters.number(total) })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("common.loading")}
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-background/20 p-10 text-center text-muted-foreground">
                {t("panelLatestBookings.empty.noAppointments")}
              </div>
            ) : (
              <>
              <div className="hidden overflow-x-auto rounded-2xl border border-border/70 md:block">
                <Table dir={dir} className="text-start">
                  <TableHeader>
                    <TableRow className="bg-background/50">
                      <TableHead className="min-w-[150px] text-start">{t("panelLatestBookings.table.user")}</TableHead>
                      <TableHead className="min-w-[130px] text-start">{t("panelLatestBookings.table.mobile")}</TableHead>
                      <TableHead className="min-w-[150px] text-start">{t("panelLatestBookings.table.appointmentDay")}</TableHead>
                      <TableHead className="min-w-[100px] text-start">{t("panelLatestBookings.table.time")}</TableHead>
                      <TableHead className="min-w-[140px] text-start">{t("panelLatestBookings.table.section")}</TableHead>
                      <TableHead className="min-w-[110px] text-start">{t("panelLatestBookings.table.status")}</TableHead>
                      <TableHead className="min-w-[170px] text-start">{t("panelLatestBookings.table.createdAt")}</TableHead>
                      <TableHead className="min-w-[220px] text-start">{t("panelLatestBookings.table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((appointment) => {
                      const canViewDay = appointment.date >= today;
                      const canChangeTime = appointment.status === "booked" && appointment.date >= today;
                      const financeSummary = financeSummaries[appointment.userPhone];
                      const hasDebt = (financeSummary?.balanceAmount ?? 0) > 0;

                      return (
                      <TableRow key={appointment.id} className={`text-start ${hasDebt ? "bg-destructive/5" : ""}`}>
                        <TableCell className="font-medium text-start">
                          <div className="flex min-w-0 flex-col items-end gap-1">
                            <div className="flex min-w-0 items-start justify-end gap-2">
                              <span className="line-clamp-2 min-w-0 max-w-[180px] break-words leading-6 [overflow-wrap:anywhere]">{appointment.userName || t("panelLatestBookings.value.noName")}</span>
                              <User className="h-4 w-4 shrink-0 text-primary" />
                            </div>
                            {hasDebt ? <Badge variant="destructive" className="rounded-full text-[11px]">{t("panelLatestBookings.badge.debt", { amount: money(financeSummary.balanceAmount) })}</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-start">
                          <div className="flex items-center justify-end gap-2">
                            <PhoneText>{appointment.userPhone}</PhoneText>
                            <Phone className="h-4 w-4 shrink-0 text-primary" />
                          </div>
                        </TableCell>
                        <TableCell className="text-start">
                          <div className="flex items-center justify-end gap-2">
                            <span>{formatAppointmentDate(appointment.date)}</span>
                            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                          </div>
                        </TableCell>
                        <TableCell className="text-start">
                          <div className="flex items-center justify-end gap-2">
                            <span>{formatAppointmentTime(appointment.startTime)}</span>
                            <Clock3 className="h-4 w-4 shrink-0 text-primary" />
                          </div>
                        </TableCell>
                        <TableCell className="text-start">
                          <div className="flex items-center justify-end gap-2">
                            <span className="min-w-0 break-words">{appointment.sectionName || t("panelLatestBookings.value.noSection")}</span>
                            <BriefcaseBusiness className="h-4 w-4 shrink-0 text-primary" />
                          </div>
                        </TableCell>
                        <TableCell className="text-start">
                          <Badge variant={STATUS_BADGE_VARIANTS[appointment.status]} className="rounded-full">
                            {statusLabels[appointment.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-start">
                          {formatCreatedAt(appointment.createdAt)}
                        </TableCell>
                        <TableCell className="text-start">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {appointment.notes?.trim() ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                title={t("panelLatestBookings.action.showNotes")}
                                className="h-8 w-8 rounded-full border border-border/60 bg-background/40 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                onClick={() => setNotesTarget(appointment)}
                              >
                                <MessageSquareText className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {canViewDay ? (
                              <Button asChild size="sm" variant="ghost" className="h-8 rounded-full border border-border/60 bg-background/40 px-3 text-[11px] font-bold text-foreground/85 hover:bg-primary/10 hover:text-primary">
                                <Link href={`/booking?date=${encodeURIComponent(appointment.date)}&barber_id=${encodeURIComponent(appointment.barberId)}`}>
                                  <Eye className="me-1 h-3.5 w-3.5" />
                                  {t("panelLatestBookings.action.viewDay")}
                                </Link>
                              </Button>
                            ) : null}
                            {canChangeTime ? (
                              <Button asChild size="sm" variant="ghost" className="h-8 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 text-[11px] font-bold text-cyan-300 hover:bg-cyan-500/15 hover:text-cyan-200">
                                <Link href={`/booking?appointment=${encodeURIComponent(appointment.id)}&action=change_time&date=${encodeURIComponent(appointment.date)}&barber_id=${encodeURIComponent(appointment.barberId)}&section_id=${encodeURIComponent(appointment.sectionId)}`}>
                                  <Clock3 className="me-1 h-3.5 w-3.5" />
                                  {t("panelLatestBookings.action.changeTime")}
                                </Link>
                              </Button>
                            ) : null}
                            <Button asChild size="sm" variant="ghost" className="h-8 rounded-full border border-primary/25 bg-primary/10 px-3 text-[11px] font-bold text-primary hover:bg-primary/15">
                              <Link href={`/panel/manual-finance?appointment_id=${encodeURIComponent(appointment.id)}`}>
                                <ReceiptText className="me-1 h-3.5 w-3.5" />
                                {t("panelLatestBookings.action.addFinance")}
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 rounded-full border border-destructive/25 bg-destructive/5 px-3 text-[11px] font-bold text-destructive hover:bg-destructive/10 disabled:border-border/40 disabled:bg-background/20 disabled:text-muted-foreground"
                              disabled={appointment.status === "cancelled"}
                              onClick={() => setCancelTarget(appointment)}
                            >
                              <Trash2 className="me-1 h-3.5 w-3.5" />
                              {t("common.cancel")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 md:hidden">
                {rows.map((appointment) => {
                  const canViewDay = appointment.date >= today;
                  const canChangeTime = appointment.status === "booked" && appointment.date >= today;
                  const financeSummary = financeSummaries[appointment.userPhone];
                  const hasDebt = (financeSummary?.balanceAmount ?? 0) > 0;

                  return (
                    <div key={appointment.id} className={`min-w-0 overflow-hidden rounded-[1.4rem] border bg-background/25 p-4 text-start ${hasDebt ? "border-destructive/45 bg-destructive/5" : "border-border/70"}`}>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                        <div className="min-w-0 justify-self-start space-y-1 text-start">
                          <div className="flex min-w-0 items-start justify-end gap-2 text-base font-bold">
                            <span className="line-clamp-2 min-w-0 break-words leading-6 [overflow-wrap:anywhere]">{appointment.userName || t("panelLatestBookings.value.noName")}</span>
                            <User className="h-4 w-4 shrink-0 text-primary" />
                          </div>
                          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                            <PhoneText>{appointment.userPhone}</PhoneText>
                            <Phone className="h-4 w-4 shrink-0 text-primary" />
                          </div>
                          {hasDebt ? <Badge variant="destructive" className="rounded-full">{t("panelLatestBookings.badge.debt", { amount: money(financeSummary.balanceAmount) })}</Badge> : null}
                        </div>
                        <Badge variant={STATUS_BADGE_VARIANTS[appointment.status]} className="shrink-0 justify-self-end rounded-full">
                          {statusLabels[appointment.status]}
                        </Badge>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm">
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/35 px-3 py-2">
                          <span className="text-muted-foreground">{t("panelLatestBookings.table.appointmentDay")}</span>
                          <span className="font-medium">{formatAppointmentDate(appointment.date)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/35 px-3 py-2">
                          <span className="text-muted-foreground">{t("panelLatestBookings.table.time")}</span>
                          <span className="font-medium">{formatAppointmentTime(appointment.startTime)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/35 px-3 py-2">
                          <span className="text-muted-foreground">{t("panelLatestBookings.table.section")}</span>
                          <span className="min-w-0 break-words font-medium">{appointment.sectionName || t("panelLatestBookings.value.noSection")}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/35 px-3 py-2">
                          <span className="text-muted-foreground">{t("panelLatestBookings.table.createdAt")}</span>
                          <span className="font-medium">{formatCreatedAt(appointment.createdAt)}</span>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                          {appointment.notes?.trim() ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              title={t("panelLatestBookings.action.showNotes")}
                              className="h-10 w-full rounded-2xl border border-border/60 bg-card/45 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                              onClick={() => setNotesTarget(appointment)}
                            >
                              <MessageSquareText className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {canViewDay ? (
                            <Button asChild size="sm" variant="ghost" className="h-10 rounded-2xl border border-border/60 bg-card/45 px-3 text-xs font-bold text-foreground/85 hover:bg-primary/10 hover:text-primary">
                              <Link href={`/booking?date=${encodeURIComponent(appointment.date)}&barber_id=${encodeURIComponent(appointment.barberId)}`}>
                                <Eye className="me-1.5 h-4 w-4" />
                                {t("panelLatestBookings.action.viewDay")}
                              </Link>
                            </Button>
                          ) : null}
                          {canChangeTime ? (
                            <Button asChild size="sm" variant="ghost" className="h-10 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-3 text-xs font-bold text-cyan-300 hover:bg-cyan-500/15 hover:text-cyan-200">
                              <Link href={`/booking?appointment=${encodeURIComponent(appointment.id)}&action=change_time&date=${encodeURIComponent(appointment.date)}&barber_id=${encodeURIComponent(appointment.barberId)}&section_id=${encodeURIComponent(appointment.sectionId)}`}>
                                <Clock3 className="me-1.5 h-4 w-4" />
                                {t("panelLatestBookings.action.changeTime")}
                              </Link>
                            </Button>
                          ) : null}
                          <Button asChild size="sm" variant="ghost" className="h-10 rounded-2xl border border-primary/25 bg-primary/10 px-3 text-xs font-bold text-primary hover:bg-primary/15">
                            <Link href={`/panel/manual-finance?appointment_id=${encodeURIComponent(appointment.id)}`}>
                              <ReceiptText className="me-1.5 h-4 w-4" />
                              {t("panelLatestBookings.action.addFinance")}
                            </Link>
                          </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-10 rounded-2xl border border-destructive/25 bg-destructive/5 px-3 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:border-border/40 disabled:bg-card/30 disabled:text-muted-foreground"
                          disabled={appointment.status === "cancelled"}
                          onClick={() => setCancelTarget(appointment)}
                        >
                          <Trash2 className="me-1.5 h-4 w-4" />
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}

            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                {t("panelLatestBookings.pagination.page", { current: formatters.number(page), total: formatters.number(lastPage) })}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="h-10 rounded-2xl px-3"
                  disabled={loading || page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  {isRtl ? <ChevronRight className="me-1 h-4 w-4" /> : <ChevronLeft className="me-1 h-4 w-4" />}
                  {t("panelLatestBookings.pagination.previous")}
                </Button>
                <Button
                  variant="outline"
                  className="h-10 rounded-2xl px-3"
                  disabled={loading || page >= lastPage}
                  onClick={() => setPage((value) => Math.min(lastPage, value + 1))}
                >
                  {t("panelLatestBookings.pagination.next")}
                  {isRtl ? <ChevronLeft className="ms-1 h-4 w-4" /> : <ChevronRight className="ms-1 h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!notesTarget} onOpenChange={(open) => !open && setNotesTarget(null)}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-start">{t("panelLatestBookings.notes.title")}</DialogTitle>
            <DialogDescription className="text-start">
              {t("panelLatestBookings.notes.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 leading-8 whitespace-pre-wrap">
            {notesTarget?.notes?.trim()}
          </div>
        </DialogContent>
      </Dialog>

      <CancelModal
        isOpen={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null);
          void fetchPage(page);
        }}
        appointment={cancelTarget}
      />
    </div>
  );
}
