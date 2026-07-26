import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { AlertCircle, ArrowLeft, CalendarDays, Clock3, Loader2, MapPinned, MessageSquareText, Navigation, ReceiptText, Trash2, UserRound } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LoginModal } from "@/components/login-modal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { applyAppearance, readCachedAppearance } from "@/lib/appearance";
import { getAudienceLabels, isAppointmentBookingDisabled } from "@/lib/audience";
import { useToast } from "@/hooks/use-toast";
import type { AppearanceSettings, PublicAppointmentDetails } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { CodeText, LtrText, UrlText } from "@/i18n/ltr-text";

const ContactLocationMap = lazy(async () => {
  const module = await import("@/components/contact-location-map");
  return { default: module.ContactLocationMap };
});

const statusToneMap: Record<PublicAppointmentDetails["status"], string> = {
  booked: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  completed: "border-primary/25 bg-primary/10 text-primary",
  no_show: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  cancelled: "border-red-500/25 bg-red-500/10 text-red-300",
  pending_payment: "border-slate-500/25 bg-slate-500/10 text-slate-200",
};

function parseAppointmentDateTime(date?: string | null, startTime?: string | null) {
  if (!date || !startTime) {
    return null;
  }

  const [hourRaw = "0", minuteRaw = "0"] = String(startTime).split(":");
  const yearMonthDay = String(date).split("-");

  if (yearMonthDay.length !== 3) {
    return null;
  }

  const [year, month, day] = yearMonthDay.map((value) => Number(value));
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function countdownParts(target: Date | null, nowMs: number) {
  if (!target) {
    return null;
  }

  const diffMs = target.getTime() - nowMs;
  if (diffMs <= 0) {
    return {
      expired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    expired: false,
    days,
    hours,
    minutes,
    seconds,
  };
}

function statusBadgeLabel(status: PublicAppointmentDetails["status"], statusLabel: string, t: ReturnType<typeof useT>) {
  if (status === "booked") {
    return t("appointment.public.status.confirmed");
  }

  if (status === "cancelled") {
    return t("appointment.public.status.cancelled");
  }

  return statusLabel;
}

function appointmentStatusPresentation(
  status: PublicAppointmentDetails["status"],
  statusLabel: string,
  expired: boolean,
  t: ReturnType<typeof useT>,
) {
  if (status === "booked" && expired) {
    return {
      label: t("appointment.public.status.past"),
      tone: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    };
  }

  return {
    label: statusBadgeLabel(status, statusLabel, t),
    tone: statusToneMap[status],
  };
}

const detailRows = (
  appointment: PublicAppointmentDetails,
  appointmentDateLabel: string,
  professionalLabel: string,
  t: ReturnType<typeof useT>,
) => [
  { key: "status", label: t("appointment.public.detail.status"), value: appointment.statusLabel, icon: ReceiptText, isStatus: true },
  { key: "customer", label: t("appointment.public.detail.customer"), value: appointment.customerName, icon: UserRound },
  { key: "service", label: t("appointment.public.detail.service"), value: appointment.sectionName || t("appointment.public.notRegistered"), icon: ReceiptText },
  { key: "date", label: t("appointment.public.detail.date"), value: appointmentDateLabel, icon: CalendarDays, mutedWhenCancelled: true },
  { key: "time", label: t("appointment.public.detail.time"), value: appointment.startTime, icon: Clock3, ltr: true, mutedWhenCancelled: true },
  { key: "barber", label: professionalLabel, value: appointment.barberName || t("appointment.public.notRegistered"), icon: UserRound },
];

function cleanAddressLine(address?: string | null, provinceName?: string | null, cityName?: string | null) {
  let cleaned = (address ?? "").trim();

  [provinceName, cityName].filter(Boolean).forEach((part) => {
    const escapedPart = String(part).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned
      .replace(new RegExp(`^${escapedPart}\\s*،\\s*`, "u"), "")
      .replace(new RegExp(`^${escapedPart}\\s*,\\s*`, "u"), "")
      .replace(new RegExp(`^${escapedPart}\\s+`, "u"), "");
  });

  return cleaned.trim();
}

export default function AppointmentPublicPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/s/:code");
  const { user, isAuthenticated, isAdmin, isLoading: authLoading, logout } = useAuth();
  const { dir } = useLocale();
  const t = useT();
  const format = useFormat();
  const tenantMeta = getInitialTenantMeta();
  const homeHref = isAppointmentBookingDisabled(tenantMeta) ? "/nutrition" : "/booking";
  const { toast } = useToast();
  const [appointment, setAppointment] = useState<PublicAppointmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [pendingCancelAfterLogin, setPendingCancelAfterLogin] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [mapReady, setMapReady] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceSettings | null>(() => readCachedAppearance());
  const activeBookingTemplate =
    appearance?.bookingTemplate === "pink" ||
    appearance?.bookingTemplate === "blue" ||
    appearance?.bookingTemplate === "green" ||
    appearance?.bookingTemplate === "red" ||
    appearance?.bookingTemplate === "purple" ||
    appearance?.bookingTemplate === "yellow" ||
    appearance?.bookingTemplate === "olive"
      ? appearance.bookingTemplate
      : null;

  const code = params?.code ?? "";

  const loadAppointment = async (showLoading = true) => {
    if (!match || !code) {
      setAppointment(null);
      setLoading(false);
      return;
    }

    if (showLoading) {
      setLoading(true);
    }
    const res = await api.appointments.getPublic(code);

    if (res.success) {
      setAppointment(res.data);
      document.title = t("appointment.public.documentTitleWithCode", { code: res.data.publicCode });
    } else {
      setAppointment(null);
      document.title = t("appointment.public.documentTitle");
    }

    if (showLoading) {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAppointment(true);
  }, [match, code]);

  useEffect(() => {
    api.appearance.get().then((res) => {
      if (res.success) {
        setAppearance(res.data);
        applyAppearance(res.data);
      }
    });
  }, []);

  useEffect(() => {
    if (activeBookingTemplate) {
      document.body.dataset.bookingTemplate = activeBookingTemplate;
    } else {
      delete document.body.dataset.bookingTemplate;
    }

    return () => {
      delete document.body.dataset.bookingTemplate;
    };
  }, [activeBookingTemplate]);

  useEffect(() => {
    if (authLoading || !appointment) {
      return;
    }

    void loadAppointment(false);
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !pendingCancelAfterLogin) {
      return;
    }

    setPendingCancelAfterLogin(false);
    setConfirmOpen(true);
  }, [isAuthenticated, pendingCancelAfterLogin]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setMapReady(true), 150);

    return () => window.clearTimeout(timer);
  }, []);

  const appointmentDateLabel = useMemo(() => {
    if (!appointment?.date) {
      return "";
    }

    return format.date(appointment.date, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [appointment?.date, format]);
  const professionalLabel = getAudienceLabels(tenantMeta).singular || t("appointment.public.professionalFallback");
  const appointmentStartsAt = useMemo(
    () => parseAppointmentDateTime(appointment?.date, appointment?.startTime),
    [appointment?.date, appointment?.startTime],
  );
  const countdown = useMemo(
    () => countdownParts(appointmentStartsAt, nowMs),
    [appointmentStartsAt, nowMs],
  );
  const isPastAppointment = appointment?.status === "booked" && Boolean(countdown?.expired);
  const appointmentStatusUi = appointmentStatusPresentation(
    appointment?.status ?? "pending_payment",
    appointment?.statusLabel ?? t("appointment.public.status.pending"),
    Boolean(isPastAppointment),
    t,
  );
  const mapTitle = tenantMeta?.name ? t("appointment.public.mapTitleWithName", { name: tenantMeta.name }) : t("appointment.public.mapTitleDefault");
  const locationTitle = appointment?.location
    ? [appointment.location.provinceName, appointment.location.cityName].filter(Boolean).join(t("appointment.public.locationSeparator"))
    : "";
  const locationAddress = appointment?.location
    ? cleanAddressLine(appointment.location.address, appointment.location.provinceName, appointment.location.cityName)
    : "";

  const navigationUrl = useMemo(() => {
    if (!appointment?.location?.latitude || !appointment?.location?.longitude) {
      return null;
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${appointment.location.latitude},${appointment.location.longitude}`;
  }, [appointment?.location?.latitude, appointment?.location?.longitude]);
  const canStartCancelFlow =
    appointment?.status === "booked" &&
    ((appointment?.canCancel ?? false) || (appointment?.requiresLoginForCancel ?? false)) &&
    !(appointment?.cancellationLockedAt && nowMs >= new Date(appointment.cancellationLockedAt).getTime());
  const cancellationLockMessage =
    appointment?.cancellationLockMessage ||
    (appointment?.status === "booked" && appointment?.cancellationLockedAt && nowMs >= new Date(appointment.cancellationLockedAt).getTime()
      ? t("appointment.public.cancelLockedDefault")
      : null);
  const isCancelled = appointment?.status === "cancelled";

  const handleCancelClick = () => {
    if (!appointment) {
      return;
    }

    if (!isAuthenticated) {
      setPendingCancelAfterLogin(true);
      setLoginOpen(true);
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!appointment || !user) {
      return;
    }

    setCancelLoading(true);
    const res = await api.appointments.cancel(appointment.id, user.id, user.role === "admin");
    setCancelLoading(false);

    if (res.success) {
      toast({ title: t("appointment.public.cancelledToastTitle"), description: t("appointment.public.cancelledToastDescription") });
      setConfirmOpen(false);
      await loadAppointment();
      return;
    }

    toast({ variant: "destructive", title: t("appointment.public.cancelFailedTitle"), description: res.message });
  };

  if (loading) {
    return (
      <div className={`appointment-public-page min-h-screen bg-background text-foreground ${activeBookingTemplate ? `appointment-public-template-${activeBookingTemplate}` : ""}`} dir={dir}>
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4">
          <div className="appointment-public-loading flex items-center gap-3 rounded-[28px] border border-border/70 bg-card/70 px-6 py-4 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{t("appointment.public.loadingDetails")}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className={`appointment-public-page min-h-screen bg-background text-foreground ${activeBookingTemplate ? `appointment-public-template-${activeBookingTemplate}` : ""}`} dir={dir}>
        <div className="appointment-public-backdrop absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_40%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />
        <div className="container mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-10">
          <Card className="appointment-public-card w-full border-border/70 bg-card/65">
            <CardContent className="space-y-5 p-8 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-red-500/20 bg-red-500/10">
                <AlertCircle className="h-10 w-10 text-red-300" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black">{t("appointment.public.notFoundTitle")}</h1>
                <p className="text-sm leading-7 text-muted-foreground">
                  {t("appointment.public.notFoundDescription")}
                </p>
              </div>
              <Button variant="outline" className="rounded-[20px] px-6" onClick={() => setLocation(homeHref)}>
                {t("appointment.public.backToSite")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={`appointment-public-page min-h-screen bg-background text-foreground ${activeBookingTemplate ? `appointment-public-template-${activeBookingTemplate}` : ""}`} dir={dir}>
      <div className="appointment-public-backdrop absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.14),_transparent_36%),radial-gradient(circle_at_top_left,_rgba(30,41,59,0.68),_transparent_48%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0))]" />

      <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" className="h-auto rounded-[16px] px-0 text-sm text-muted-foreground hover:bg-transparent" onClick={() => setLocation(homeHref)}>
            <ArrowLeft className="me-2 h-4 w-4" />
            {t("appointment.public.backToSite")}
          </Button>
          <div className={`rounded-full border px-3 py-1.5 text-xs font-bold ${appointmentStatusUi.tone}`}>
            {appointmentStatusUi.label}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-5">
            <Card className="appointment-public-card overflow-hidden border-border/70 bg-card/65">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2.5">
                    <div className="appointment-public-badge inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      <ReceiptText className="h-3.5 w-3.5" />
                      {t("appointment.public.dedicatedBadge")}
                    </div>
                    <div>
                      <h1 className="text-xl font-black sm:text-2xl">{t("appointment.public.detailsTitle")}</h1>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                        {t("appointment.public.detailsDescription")}
                      </p>
                    </div>
                  </div>
                  <div className="appointment-public-code inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/55 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
                    <span>{t("appointment.public.trackingCode")}</span>
                    <CodeText className="rounded-full bg-primary/10 px-2 py-0.5 font-bold tracking-[0.18em] text-primary">
                      {appointment.publicCode}
                    </CodeText>
                  </div>
                </div>

                {appointment.status === "booked" && countdown && !countdown.expired ? (
                  <div className="appointment-public-countdown overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,24,41,0.98),rgba(17,29,49,0.95))] p-4 shadow-[0_26px_60px_-42px_rgba(0,0,0,0.85)] sm:p-5">
                    <div className="mb-4 flex justify-center border-b border-white/10 pb-4">
                      <div className="text-center text-sm font-bold text-white">
                        {t("appointment.public.countdownIntro")}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2.5 sm:gap-4">
                      {[
                        { label: t("appointment.public.countdown.days"), value: countdown.days },
                        { label: t("appointment.public.countdown.hours"), value: countdown.hours },
                        { label: t("appointment.public.countdown.minutes"), value: countdown.minutes },
                        { label: t("appointment.public.countdown.seconds"), value: countdown.seconds },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] px-2 py-3 text-center shadow-[0_18px_40px_-30px_rgba(0,0,0,0.9)] backdrop-blur-sm sm:rounded-[20px] sm:px-4 sm:py-4"
                        >
                          <div className="text-xl font-black tracking-tight text-white sm:text-3xl">{format.number(item.value)}</div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400 sm:text-xs">{item.label}</div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 text-center text-[11px] text-slate-500">
                      {t("appointment.public.countdownRemaining")}
                    </div>
                  </div>
                ) : null}

                {appointment.status === "booked" && countdown?.expired ? (
                  <div className="appointment-public-expired overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(19,31,50,0.98),rgba(15,23,42,0.95))] p-4 shadow-[0_26px_60px_-42px_rgba(0,0,0,0.85)] sm:p-5">
                    <div className="mb-3 flex justify-center">
                      <div className="inline-flex items-center rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold text-cyan-100">
                        {t("appointment.public.expiredCtaHint")}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-lg font-black text-white sm:text-xl">
                        {t("appointment.public.expiredTitle")}
                      </div>
                    </div>

                    <div className="mt-5 flex justify-center">
                      <Button
                        type="button"
                        className="h-11 min-w-[220px] rounded-[18px] bg-[linear-gradient(135deg,#f59e0b,#ffb020)] px-6 text-sm font-bold text-slate-950 shadow-[0_18px_40px_-24px_rgba(245,158,11,0.65)] hover:brightness-105"
                        onClick={() => setLocation(homeHref)}
                      >
                        {t("appointment.public.newAppointment")}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div
                  className={`appointment-public-details overflow-hidden rounded-[20px] border border-border/70 bg-background/35 transition-opacity ${
                    appointment.status === "booked" && countdown?.expired ? "opacity-35" : "opacity-100"
                  }`}
                >
                  {detailRows(appointment, appointmentDateLabel, professionalLabel, t).map((item, index) => {
                    const Icon = item.icon;
                    const isCancelledValue = appointment.status === "cancelled" && item.mutedWhenCancelled;

                    return (
                      <div
                        key={item.key}
                        className={`flex items-start gap-3 px-4 py-3 ${index !== 0 ? "border-t border-border/60" : ""}`}
                      >
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1 text-sm leading-7">
                          <span className="me-1 text-muted-foreground">{item.label}:</span>
                          {item.isStatus ? (
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${appointmentStatusUi.tone}`}
                            >
                              {appointmentStatusUi.label}
                            </span>
                          ) : (
                            <span
                              className={isCancelledValue ? "font-semibold text-red-300 line-through decoration-2" : "font-semibold text-foreground"}
                            >
                              {item.ltr ? <LtrText>{item.value}</LtrText> : item.value}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isAdmin && appointment.managerNotes ? (
                  <div className="appointment-public-note rounded-[20px] border border-primary/20 bg-primary/10 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
                      <MessageSquareText className="h-4 w-4" />
                      {t("appointment.public.managerNote")}
                    </div>
                    <p className="text-sm leading-8 text-muted-foreground">{appointment.managerNotes}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {appointment.location ? (
              <Card className="appointment-public-card appointment-public-location overflow-hidden border-border/70 bg-card/65">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black">{t("appointment.public.locationTitle")}</h2>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {t("appointment.public.locationDescription")}
                      </p>
                    </div>
                    {navigationUrl ? (
                      <a href={navigationUrl} target="_blank" rel="noreferrer">
                        <Button className="appointment-public-primary-action rounded-[18px] px-4 text-sm">
                          <Navigation className="me-2 h-4 w-4" />
                          {t("appointment.public.directions")}
                        </Button>
                      </a>
                    ) : null}
                  </div>

                  {appointment.location.address ? (
                    <div className="appointment-public-address rounded-[20px] border border-border/70 bg-background/35 p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPinned className="h-3.5 w-3.5" />
                        {t("appointment.public.address")}
                      </div>
                      {locationTitle ? (
                        <div className="text-base font-bold">{locationTitle}</div>
                      ) : null}
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-8 text-muted-foreground">
                        {locationAddress || appointment.location.address}
                      </p>
                    </div>
                  ) : null}

                  {appointment.location.latitude && appointment.location.longitude ? (
                    <Suspense
                      fallback={
                        <div className="appointment-public-map-placeholder flex h-[320px] items-center justify-center rounded-[20px] border border-border/70 bg-background/30 text-sm text-muted-foreground">
                          <Loader2 className="me-2 h-4 w-4 animate-spin text-primary" />
                          {t("appointment.public.mapLoading")}
                        </div>
                      }
                    >
                      <ErrorBoundary
                        fallback={
                          <div className="appointment-public-map-placeholder flex h-[320px] flex-col items-center justify-center gap-3 rounded-[20px] border border-border/70 bg-background/30 px-4 text-center text-sm text-muted-foreground">
                            <MapPinned className="h-6 w-6 text-primary" />
                            <div>{t("appointment.public.mapError")}</div>
                            {navigationUrl ? (
                              <a href={navigationUrl} target="_blank" rel="noreferrer" className="font-bold text-primary underline underline-offset-4">
                                {t("appointment.public.openDirections")}
                              </a>
                            ) : null}
                          </div>
                        }
                      >
                        {mapReady ? (
                          <ContactLocationMap
                            center={{ lat: appointment.location.latitude, lng: appointment.location.longitude }}
                            marker={{ lat: appointment.location.latitude, lng: appointment.location.longitude }}
                            interactive={false}
                            title={mapTitle}
                          />
                        ) : (
                          <div className="appointment-public-map-placeholder flex h-[320px] items-center justify-center rounded-[20px] border border-border/70 bg-background/30 text-sm text-muted-foreground">
                            <Loader2 className="me-2 h-4 w-4 animate-spin text-primary" />
                            {t("appointment.public.mapPreparing")}
                          </div>
                        )}
                      </ErrorBoundary>
                    </Suspense>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </section>

          <aside className="space-y-5">
            {!(appointment.status === "booked" && countdown?.expired) ? (
              <Card className="appointment-public-card border-border/70 bg-card/65">
                <CardContent className="space-y-4 p-5">
                  <div>
                    <h2 className="text-lg font-black">{t("appointment.public.cancelSectionTitle")}</h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {t("appointment.public.cancelSectionDescription")}
                    </p>
                  </div>

                  <div className="appointment-public-info-box rounded-[20px] border border-border/70 bg-background/35 p-4 text-sm leading-8 text-muted-foreground">
                    {isAuthenticated
                      ? t("appointment.public.cancelInfoAuthenticated")
                      : t("appointment.public.cancelInfoGuest")}
                  </div>

                  {!isCancelled && !cancellationLockMessage ? (
                    <Button
                      className="h-11 w-full rounded-[18px] bg-red-500 text-sm text-white hover:bg-red-500/90"
                      disabled={!canStartCancelFlow || cancelLoading}
                      onClick={handleCancelClick}
                    >
                      {cancelLoading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />}
                      {t("appointment.public.cancelAction")}
                    </Button>
                  ) : null}

                  {isCancelled ? (
                    <div className="rounded-[18px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-7 text-red-200">
                      {t("appointment.public.cancelledMessage")}
                    </div>
                  ) : cancellationLockMessage ? (
                    <div className="rounded-[18px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-bold leading-7 text-amber-200">
                      {cancellationLockMessage}
                    </div>
                  ) : !canStartCancelFlow ? (
                    <div className="rounded-[18px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-7 text-amber-200">
                      {t("appointment.public.notOwnedMessage")}{" "}
                      <button
                        type="button"
                        onClick={() => void logout()}
                        className="font-bold text-white underline underline-offset-4 transition hover:text-amber-100"
                      >
                        {t("appointment.public.logout")}
                      </button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Card className="appointment-public-card border-border/70 bg-card/65">
              <CardContent className="space-y-3 p-5">
                <div className="text-xs font-bold text-muted-foreground">{t("appointment.public.dedicatedLink")}</div>
                <div className="flex justify-center pb-1">
                  <div className="appointment-public-qr rounded-[20px] border border-border/70 bg-white p-3 shadow-sm">
                    <QRCode value={appointment.publicUrl} size={108} />
                  </div>
                </div>
                <div className="appointment-public-link rounded-[18px] border border-border/70 bg-background/35 p-3 text-start text-xs leading-7 break-all text-muted-foreground" dir="ltr">
                  <UrlText>{appointment.publicUrl}</UrlText>
                </div>
                <Link href={homeHref}>
                  <Button variant="outline" className="h-10 w-full rounded-[18px] border-border bg-background/40 text-sm">
                    {t("appointment.public.backHome")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onDismiss={() => {
          setLoginOpen(false);
          setPendingCancelAfterLogin(false);
        }}
        onSuccess={() => {
          setLoginOpen(false);
        }}
        phoneStepDescription={t("appointment.public.loginCancelDescription")}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir={dir} className="text-start">
          <AlertDialogHeader className="text-start sm:text-start">
            <AlertDialogTitle className="text-start">{t("appointment.public.confirmCancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-start leading-8">
              {t("appointment.public.confirmCancelDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:justify-start sm:space-x-0">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 text-white hover:bg-red-500/90 hover:text-white" onClick={handleConfirmCancel}>
              {t("appointment.public.confirmCancelAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
