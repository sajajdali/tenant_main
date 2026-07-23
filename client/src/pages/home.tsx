import { useEffect, useState, useMemo, useRef } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { buildTimeSlots, TimeSlotGrid } from "@/components/time-slot-grid";
import { BookingModal } from "@/components/booking-modal";
import { CancelModal } from "@/components/cancel-modal";
import { MyAppointmentsModal } from "@/components/my-appointments-modal";
import { ProfileNameDialog } from "@/components/profile-name-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Appointment, Section, Barber, PaymentSettings, CustomerClubMePayload, AppearanceSettings, ManualFinanceCustomerSummary, AppointmentBookingClosurePayload } from "@/lib/types";
import { format, addDays, endOfDay, startOfDay } from "date-fns";
import {
  Settings as SettingsIcon, LogIn, ChevronRight, ChevronLeft, CalendarDays, User, Clock, ArrowLeft, ListOrdered, ShieldAlert, Menu, ShoppingCart, RefreshCw, WandSparkles, Gem, Wallet, Sparkles, MessageCircleMore, Search, Check, Zap, X, Bell, Loader2
} from "lucide-react";
import { LoginModal } from "@/components/login-modal";
import { NotificationBell } from "@/components/notification-bell";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { MobileSiteMenu } from "@/components/mobile-site-menu";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import arabic from "react-date-object/calendars/arabic";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian_en from "react-date-object/locales/gregorian_en";
import arabic_ar from "react-date-object/locales/arabic_ar";
import { api } from "@/lib/api";
import { applyAppearance, readCachedAppearance } from "@/lib/appearance";
import { getAudienceLabels } from "@/lib/audience";
import { setPwaInstallPromptAllowed } from "@/lib/pwa";
import { getEffectiveSectionSchedule, hasSectionScheduleOverrideForDate } from "@/lib/service-schedule";
import { getNutritionBookingBannerSettings, isNutritionLandingDefaultEnabled } from "@/nutrition/lib/landing-presets";
import { subscribeOnlineChatUserUpdates, subscribeUserNotificationInboxUpdates } from "@/lib/realtime";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { usePublicSiteMenuItems } from "@/hooks/use-public-site-menu-items";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import "react-multi-date-picker/styles/backgrounds/bg-dark.css"

const toSafeGregorianDate = (date: string) => new Date(`${date}T12:00:00`);
const getTodayDateString = () => format(new Date(), "yyyy-MM-dd");
const isolateLtr = (value: string) => `\u2066${value}\u2069`;
const isPastAppointmentTime = (date: string, time: string) =>
  new Date(`${date}T${time}:00`).getTime() < Date.now();
const normalizeServiceGroupKey = (name: string) =>
  name
    .trim()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();

type BookingFlowIntent = "initial" | "change-barber" | "change-service";
type BookingViewTransition = { finished: Promise<void> };
type BookingTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => BookingViewTransition;
};

const getBookingLeadConfig = (barber?: Barber) => ({
  mode: barber?.bookingLeadMode ?? "today",
  hours: barber?.bookingLeadHours ?? 2,
  days: barber?.bookingLeadDays ?? 1,
});

const getMinimumBookableAt = (barber?: Barber) => {
  const now = new Date();
  const { mode, hours, days } = getBookingLeadConfig(barber);

  if (mode === "days") {
      const minimumDate = startOfDay(addDays(now, Math.max(days, 1)));
      return minimumDate;
  }

  return new Date(now.getTime() + Math.max(hours, 0) * 60 * 60 * 1000);
};

const getBookingHorizonConfig = (barber?: Barber) => ({
  mode: barber?.bookingHorizonMode ?? "days",
  maxDays: barber?.bookingMaxDays ?? 30,
  maxDate: barber?.bookingMaxDate ?? "",
});

const getMaximumBookableDate = (barber?: Barber) => {
  const today = startOfDay(new Date());
  const { mode, maxDays, maxDate } = getBookingHorizonConfig(barber);

  if (mode === "date" && maxDate) {
      return maxDate;
  }

  return format(addDays(today, Math.max(maxDays, 0)), "yyyy-MM-dd");
};

const findFirstActiveDate = (
  barber: Barber | undefined,
  section: Section | undefined,
  minimumBookableAt: Date | null,
  maximumBookableDate: string | null,
  isDateUnavailable: (date: string, section?: Section, barber?: Barber) => boolean,
) => {
  if (!barber || !section) return null;

  const startDate = minimumBookableAt ? startOfDay(minimumBookableAt) : startOfDay(new Date());
  const maxDate = maximumBookableDate ? toSafeGregorianDate(maximumBookableDate) : addDays(startDate, 365);
  const totalDays = Math.max(
    Math.ceil((maxDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)),
    0,
  );

  for (let offset = 0; offset <= totalDays; offset += 1) {
    const candidate = format(addDays(startDate, offset), "yyyy-MM-dd");

    if (!isDateUnavailable(candidate, section, barber)) {
      return candidate;
    }
  }

  return null;
};

const findNextActiveDate = (
  fromDate: string,
  barber: Barber | undefined,
  section: Section | undefined,
  minimumBookableAt: Date | null,
  maximumBookableDate: string | null,
  isDateUnavailable: (date: string, section?: Section, barber?: Barber) => boolean,
) => {
  if (!barber || !section) return null;

  const startDate = addDays(toSafeGregorianDate(fromDate), 1);
  const maxDate = maximumBookableDate ? toSafeGregorianDate(maximumBookableDate) : addDays(startDate, 365);
  const totalDays = Math.max(
    Math.ceil((maxDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)),
    0,
  );

  for (let offset = 0; offset <= totalDays; offset += 1) {
    const candidate = format(addDays(startDate, offset), "yyyy-MM-dd");

    if (!isDateUnavailable(candidate, section, barber)) {
      return candidate;
    }
  }

  return null;
};

export default function Home() {
  const { 
      barbers, sections, appointments, 
      barbersLoaded, sectionsLoaded, sectionsBarberId,
      currentDate, setCurrentDate, 
      currentBarberId, setCurrentBarberId,
      updateSection,
      fetchAppointments,
      loading 
  } = useStore();
  
  const { user, isAdmin, isPrimaryAdmin, isBarber, isLoading: authLoading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const formatValue = useFormat();
  const { calendar, dir, isRtl, locale } = useLocale();
  const todayDate = getTodayDateString();
  const activeBarbers = useMemo(() => barbers.filter((barber) => barber.isActive), [barbers]);
  const activeSections = useMemo(() => sections.filter((section) => section.isActive), [sections]);
  const selectedDateLabel = useMemo(
    () => formatValue.date(toSafeGregorianDate(currentDate), {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    [currentDate, formatValue],
  );
  const pickerCalendar = calendar === "hijri" ? arabic : calendar === "jalali" ? persian : gregorian;
  const pickerLocale = calendar === "hijri" ? arabic_ar : locale === "fa" ? persian_fa : gregorian_en;
  const formatServiceDurationLabel = (minutes?: number) => {
    const safeMinutes = Math.max(0, Number(minutes || 0));
    const hours = Math.floor(safeMinutes / 60);
    const remainingMinutes = safeMinutes % 60;

    if (hours > 0 && remainingMinutes > 0) {
      return t("home.duration.hoursMinutes", {
        hours: formatValue.number(hours),
        minutes: formatValue.number(remainingMinutes),
      });
    }

    if (hours > 0) {
      return t("home.duration.hours", { hours: formatValue.number(hours) });
    }

    return t("home.duration.minutes", { minutes: formatValue.number(safeMinutes) });
  };
  const getServiceDurationDisplayText = (
    durationDisplayText: string | null | undefined,
    durationMinutes: number,
  ) => durationDisplayText?.trim() || t("home.duration.approximate", {
    duration: formatServiceDurationLabel(durationMinutes),
  });
  
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [serviceFirstPickerOpen, setServiceFirstPickerOpen] = useState(false);
  const [bookingFlowIntent, setBookingFlowIntent] = useState<BookingFlowIntent>("initial");
  const [bookingFlowTransitionDirection, setBookingFlowTransitionDirection] = useState<"forward" | "backward">("forward");
  const [serviceFirstConfirmed, setServiceFirstConfirmed] = useState(false);
  const [serviceFirstDismissed, setServiceFirstDismissed] = useState(false);
  const [barberFirstConfirmed, setBarberFirstConfirmed] = useState(false);
  const [selectedServiceGroupKey, setSelectedServiceGroupKey] = useState("");
  const [serviceFirstServiceSearch, setServiceFirstServiceSearch] = useState("");
  const [serviceFirstBarberSearch, setServiceFirstBarberSearch] = useState("");
  const [serviceDialogSearch, setServiceDialogSearch] = useState("");
  const [allBookingSections, setAllBookingSections] = useState<Section[]>([]);
  const [allBookingSectionsLoaded, setAllBookingSectionsLoaded] = useState(false);
  const [barberDialogOpen, setBarberDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [myAppointmentsOpen, setMyAppointmentsOpen] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [bookingClosure, setBookingClosure] = useState<AppointmentBookingClosurePayload | null>(null);
  const [bookingClosureSubscribing, setBookingClosureSubscribing] = useState(false);
  const [bookingClosureLoginIntent, setBookingClosureLoginIntent] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceSettings | null>(() => readCachedAppearance());
  const [customerClubSummary, setCustomerClubSummary] = useState<CustomerClubMePayload | null>(null);
  const [financeSummaries, setFinanceSummaries] = useState<Record<string, ManualFinanceCustomerSummary>>({});
  const [onlineChatUnreadCount, setOnlineChatUnreadCount] = useState(0);
  const { tenantMeta, publicMenuItems } = usePublicSiteMenuItems({
    onlineChatUnreadCount,
    showCustomerClub: !!user && !isAdmin && !isBarber,
  });
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [acknowledgedAnnouncementKey, setAcknowledgedAnnouncementKey] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const bookingTemplate = appearance?.bookingTemplate ?? "default";
  const activeBookingTemplate =
    bookingTemplate === "pink" ||
    bookingTemplate === "blue" ||
    bookingTemplate === "green" ||
    bookingTemplate === "red" ||
    bookingTemplate === "purple" ||
    bookingTemplate === "yellow" ||
    bookingTemplate === "olive"
      ? bookingTemplate
      : null;
  const bookingTemplateClass = activeBookingTemplate ? `booking-template-${activeBookingTemplate}` : null;
  const initializedBookingFlowRef = useRef<string | null>(null);
  const bookingFlowCommittedRef = useRef(false);
  const bookingFlowOriginalSelectionRef = useRef<{
    barberId: string;
    sectionId: string;
    serviceGroupKey: string;
  } | null>(null);
  const initializedSelectionKeyRef = useRef<string | null>(null);
  const focusedAppointmentDateRef = useRef<string | null>(null);
  const handledAppointmentFocusRef = useRef<string | null>(null);
  const barberSelectionInProgressRef = useRef(false);
  const barberItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sectionItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pageTopRef = useRef<HTMLDivElement | null>(null);
  const timeSlotsSectionRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToTimeSlotsRef = useRef(false);
  
  const [bookingModal, setBookingModal] = useState<{isOpen: boolean, time: string, offQueue?: boolean, vipOnly?: boolean} | null>(null);
  const [offQueueDialogOpen, setOffQueueDialogOpen] = useState(false);
  const [offQueueTime, setOffQueueTime] = useState("");
  const [profileNameDialogOpen, setProfileNameDialogOpen] = useState(false);
  const [cancelModal, setCancelModal] = useState<{isOpen: boolean, appointment: Appointment} | null>(null);
  const [changeTimeAppointment, setChangeTimeAppointment] = useState<Appointment | null>(null);
  const [pendingChangeTarget, setPendingChangeTarget] = useState<{ date: string; time: string } | null>(null);
  const [sendChangeTimeSms, setSendChangeTimeSms] = useState(true);
  const [changingTime, setChangingTime] = useState(false);

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
      api.payment.getSettings().then((res) => {
          if (res.success) {
              setPaymentSettings(res.data);
          }
      });
  }, []);

  useEffect(() => {
      if (paymentSettings?.bookingClosedEnabled !== true) {
          setBookingClosure(null);
          return;
      }

      api.bookingClosure.publicStatus().then((res) => {
          if (res.success) {
              setBookingClosure(res.data);
          }
      });
  }, [paymentSettings?.bookingClosedEnabled, user?.id]);

  useEffect(() => {
      const onlineChatActive =
          tenantMeta?.onlineChatSettings?.moduleActive ??
          (tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-chat") ?? false);

      if (!onlineChatActive || !user) {
          setOnlineChatUnreadCount(0);
          return;
      }

      api.onlineChat.summary().then((res) => {
          if (res.success) {
              setOnlineChatUnreadCount(res.data.conversation?.customerUnreadCount ?? 0);
          }
      });
  }, [tenantMeta?.activeFeatureModules, tenantMeta?.onlineChatSettings?.moduleActive, user]);

  useEffect(() => {
      const onlineChatActive =
          tenantMeta?.onlineChatSettings?.moduleActive ??
          (tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-chat") ?? false);

      if (!onlineChatActive || !user?.id) {
          return;
      }

      return subscribeOnlineChatUserUpdates(user.id, (payload) => {
          const nextUnread = Number((payload.conversation as { customerUnreadCount?: number })?.customerUnreadCount ?? 0);
          setOnlineChatUnreadCount(Number.isFinite(nextUnread) ? nextUnread : 0);
      });
  }, [tenantMeta?.activeFeatureModules, tenantMeta?.onlineChatSettings?.moduleActive, user?.id]);

  useEffect(() => {
      const search = new URLSearchParams(window.location.search);
      const paymentStatus = search.get("bookingPayment");

      if (!paymentStatus) {
          return;
      }

      if (paymentStatus === "success") {
          toast({
              title: t("home.payment.successTitle"),
              description: t("home.payment.successDescription"),
          });
      } else if (paymentStatus === "failed") {
          toast({
              variant: "destructive",
              title: t("home.payment.failedTitle"),
              description: search.get("message") || t("home.payment.failedDescription"),
          });
      }

      search.delete("bookingPayment");
      search.delete("message");
      const nextQuery = search.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
  }, [t, toast]);

  useEffect(() => {
      const search = new URLSearchParams(window.location.search);
      const focusDate = search.get("date") || search.get("appointment_date");
      const focusBarberId = search.get("barber_id") || search.get("professional_id");
      const focusSectionId = search.get("section_id") || search.get("service_id");

      if (!focusDate || !focusBarberId || !/^\d{4}-\d{2}-\d{2}$/.test(focusDate)) {
          return;
      }

      if (!barbersLoaded) {
          return;
      }

      const focusKey = `${focusDate}:${focusBarberId}`;

      if (handledAppointmentFocusRef.current === focusKey) {
          return;
      }

      if (!barbers.some((barber) => barber.id === focusBarberId)) {
          toast({
              variant: "destructive",
              title: t("home.barberNotFound.title"),
              description: t("home.barberNotFound.description"),
          });
          handledAppointmentFocusRef.current = focusKey;
          return;
      }

      handledAppointmentFocusRef.current = focusKey;
      focusedAppointmentDateRef.current = focusDate;
      setCurrentBarberId(focusBarberId);
      setCurrentDate(focusDate);
      if (focusSectionId) {
          setSelectedSectionId(focusSectionId);
      }
      setBarberDialogOpen(false);
      setServiceDialogOpen(false);
      shouldScrollToTimeSlotsRef.current = true;
  }, [barbers, barbersLoaded, setCurrentBarberId, setCurrentDate, t, toast]);

  useEffect(() => {
      const search = new URLSearchParams(window.location.search);
      const action = search.get("action");
      const appointmentId = search.get("appointment");

      if (action !== "change_time" || !appointmentId) {
          setChangeTimeAppointment(null);
          setPendingChangeTarget(null);
          return;
      }

      if (authLoading) {
          return;
      }

      if (!isAdmin && !isBarber) {
          setChangeTimeAppointment(null);
          setPendingChangeTarget(null);
          window.history.replaceState({}, "", "/");
          setLocation("/");
          return;
      }

      let cancelled = false;

      api.appointments.show(appointmentId).then((res) => {
          if (cancelled) {
              return;
          }

          if (!res.success) {
              toast({
                  variant: "destructive",
                  title: t("home.appointmentNotFound.title"),
                  description: res.message || t("home.appointmentNotFound.description"),
              });
              setChangeTimeAppointment(null);
              setPendingChangeTarget(null);
              return;
          }

          setChangeTimeAppointment(res.data);
          setCurrentBarberId(res.data.barberId);
          setSelectedSectionId(res.data.sectionId);
          focusedAppointmentDateRef.current = res.data.date;
          setCurrentDate(res.data.date);
          setBarberDialogOpen(false);
          setServiceDialogOpen(false);
          shouldScrollToTimeSlotsRef.current = true;
      });

      return () => {
          cancelled = true;
      };
  }, [authLoading, isAdmin, isBarber, setCurrentBarberId, setCurrentDate, setLocation, toast]);

  useEffect(() => {
      const reloadSettings = () => {
          api.payment.getSettings().then((res) => {
              if (res.success) {
                  setPaymentSettings(res.data);
              }
          });
      };

      window.addEventListener("booking:payment-settings-updated", reloadSettings);
      window.addEventListener("storage", reloadSettings);

      return () => {
          window.removeEventListener("booking:payment-settings-updated", reloadSettings);
          window.removeEventListener("storage", reloadSettings);
      };
  }, []);

  const siteAnnouncementKey =
      !isAdmin &&
      !isBarber &&
      paymentSettings?.siteAnnouncementEnabled &&
      paymentSettings.siteAnnouncementText?.trim()
          ? paymentSettings.siteAnnouncementText.trim()
          : null;
  const isAnnouncementBlocking =
      !!siteAnnouncementKey && acknowledgedAnnouncementKey !== siteAnnouncementKey;

  useEffect(() => {
      setAnnouncementOpen(isAnnouncementBlocking);
  }, [isAnnouncementBlocking]);

  useEffect(() => {
      const publicBookingIsClosed = paymentSettings?.bookingClosedEnabled === true && !isAdmin && !isBarber;

      if (isAnnouncementBlocking || publicBookingIsClosed) {
          setBarberDialogOpen(false);
          setServiceDialogOpen(false);
          setServiceFirstPickerOpen(false);
      }
  }, [isAdmin, isAnnouncementBlocking, isBarber, paymentSettings?.bookingClosedEnabled]);

  useEffect(() => {
      if (!barbersLoaded) {
          return;
      }

      const currentBarberIsActive = activeBarbers.some((barber) => barber.id === currentBarberId);
      if (currentBarberIsActive) {
          return;
      }

      if (activeBarbers.length === 1) {
          setCurrentBarberId(activeBarbers[0].id);
          return;
      }

      if (currentBarberId) {
          setCurrentBarberId("");
      }
  }, [activeBarbers, barbersLoaded, currentBarberId, setCurrentBarberId]);

  const serviceFirstPreferenceEnabled = paymentSettings?.serviceFirstBookingEnabled === true;
  const serviceFirstBookingEnabled = serviceFirstPreferenceEnabled && activeBarbers.length > 1;

  useEffect(() => {
      if (!paymentSettings || !barbersLoaded) {
          return;
      }

      const publicBookingIsClosed = paymentSettings.bookingClosedEnabled === true && !isAdmin && !isBarber;

      if (isAnnouncementBlocking || publicBookingIsClosed || tenantMeta?.supportExpired) {
          setBarberDialogOpen(false);
          setServiceDialogOpen(false);
          setServiceFirstPickerOpen(false);
          return;
      }

      const activeBarberKey = activeBarbers.map((barber) => barber.id).sort().join(",");
      const flowKey = `${serviceFirstPreferenceEnabled ? "service-first" : "barber-first"}:${activeBarberKey}`;

      if (initializedBookingFlowRef.current === flowKey) {
          return;
      }

      initializedBookingFlowRef.current = flowKey;

      const search = new URLSearchParams(window.location.search);
      const hasExplicitAppointmentTarget =
          search.get("action") === "change_time" ||
          !!(search.get("date") || search.get("appointment_date")) &&
          !!(search.get("barber_id") || search.get("professional_id"));

      if (hasExplicitAppointmentTarget) {
          return;
      }

      setSelectedSectionId("");
      setServiceDialogOpen(false);
      setServiceDialogSearch("");
      setBarberDialogOpen(false);
      setServiceFirstConfirmed(false);
      setServiceFirstDismissed(false);
      setBarberFirstConfirmed(false);
      setBookingFlowIntent("initial");
      setBookingFlowTransitionDirection("forward");
      setSelectedServiceGroupKey("");
      setServiceFirstServiceSearch("");
      setServiceFirstBarberSearch("");
      bookingFlowCommittedRef.current = false;
      bookingFlowOriginalSelectionRef.current = null;

      if (activeBarbers.length > 1) {
          setCurrentBarberId("");
          setServiceFirstPickerOpen(true);
          return;
      }

      setServiceFirstPickerOpen(false);

      if (activeBarbers.length === 1) {
          setCurrentBarberId(activeBarbers[0].id);
          return;
      }

      setCurrentBarberId("");
  }, [
      activeBarbers,
      barbersLoaded,
      isAdmin,
      isAnnouncementBlocking,
      isBarber,
      paymentSettings,
      serviceFirstPreferenceEnabled,
      setCurrentBarberId,
      tenantMeta?.supportExpired,
  ]);

  useEffect(() => {
      if (activeBarbers.length <= 1) {
          setAllBookingSections([]);
          setAllBookingSectionsLoaded(false);
          return;
      }

      let cancelled = false;
      setAllBookingSectionsLoaded(false);

      api.sections.list().then((res) => {
          if (cancelled) {
              return;
          }

          setAllBookingSections(res.success ? res.data.filter((section) => section.isActive) : []);
      }).finally(() => {
          if (!cancelled) {
              setAllBookingSectionsLoaded(true);
          }
      });

      return () => {
          cancelled = true;
      };
  }, [activeBarbers]);

  useEffect(() => {
      if (!paymentSettings) {
          setBarberDialogOpen(false);
          return;
      }

      if (activeBarbers.length > 1) {
          setBarberDialogOpen(false);
          return;
      }

      if (activeBarbers.length <= 1) {
          setBarberDialogOpen(false);
          return;
      }

      if (isAnnouncementBlocking) {
          setBarberDialogOpen(false);
          return;
      }

      if (!currentBarberId) {
          setBarberDialogOpen(true);
      } else {
          setBarberDialogOpen(false);
      }
  }, [activeBarbers, currentBarberId, isAnnouncementBlocking, paymentSettings, serviceFirstBookingEnabled]);

  useEffect(() => {
      if (!paymentSettings) {
          setServiceDialogOpen(false);
          return;
      }

      if (paymentSettings.bookingClosedEnabled === true && !isAdmin && !isBarber) {
          setServiceDialogOpen(false);
          return;
      }

      if (activeBarbers.length > 1) {
          setServiceDialogOpen(false);
          return;
      }

      if (serviceFirstBookingEnabled) {
          setServiceDialogOpen(false);

          if (!serviceFirstConfirmed || !selectedServiceGroupKey || !currentBarberId) {
              return;
          }

          const matchingSection = activeSections.find((section) => normalizeServiceGroupKey(section.name) === selectedServiceGroupKey);

          if (matchingSection && selectedSectionId !== matchingSection.id) {
              setSelectedSectionId(matchingSection.id);
          }

          return;
      }

      const selectedBarberSectionsAreReady =
          !!currentBarberId &&
          sectionsLoaded &&
          sectionsBarberId === currentBarberId;

      if (!selectedBarberSectionsAreReady || barberDialogOpen) {
          setServiceDialogOpen(false);
          return;
      }

      if (activeSections.length === 0) {
          setSelectedSectionId("");
          setServiceDialogOpen(false);
          return;
      }

      if (isAnnouncementBlocking) {
          setServiceDialogOpen(false);
          return;
      }

      if (activeSections.length === 1) {
          setSelectedSectionId(activeSections[0].id);
          setServiceDialogOpen(false);
          return;
      }

      const hasValidSelection = activeSections.some((section) => section.id === selectedSectionId);

      if (!hasValidSelection) {
          setSelectedSectionId("");
          setServiceDialogOpen(true);
      }
  }, [activeBarbers.length, activeSections, selectedSectionId, isAdmin, isAnnouncementBlocking, isBarber, paymentSettings, serviceFirstBookingEnabled, serviceFirstConfirmed, selectedServiceGroupKey, currentBarberId, sectionsBarberId, sectionsLoaded, barberDialogOpen]);

  const selectedSection = activeSections.find(s => s.id === selectedSectionId);
  const currentBarber = activeBarbers.find(b => b.id === currentBarberId);
  const labels = getAudienceLabels(tenantMeta);
  const panelAccessLocked = tenantMeta?.panelAccessLocked ?? false;
  const panelAccessMessage = tenantMeta?.panelAccessMessage?.trim() || t("home.panelAccessLocked");
  const canOpenSettings = isAdmin || (isBarber && barbers.some((barber) => barber.userId === user?.id && barber.canAccessPanel));
  const isCurrentBarberPanelBlocked =
    isBarber &&
    !!user &&
    !!currentBarber &&
    currentBarber.userId === user.id &&
    currentBarber.canAccessPanel === false;
  const canStaffBookInBreaks = isAdmin || (isBarber && !isCurrentBarberPanelBlocked);
  const canStaffOverridePublicLeadTime = isAdmin || (isBarber && canOpenSettings && !isCurrentBarberPanelBlocked);
  const canStaffOverridePublicBookingHorizon = canStaffOverridePublicLeadTime;
  const canCreatePastAppointments = isAdmin;
  const isBookingClosed = !!paymentSettings?.bookingClosedEnabled;
  const bookingClosedMessage = paymentSettings?.bookingClosedText?.trim() || t("home.bookingClosedDefault", {
      business: labels.business,
  });
  const isBookingClosedForUsers = isBookingClosed && !isAdmin && !isBarber;
  const canRequestBookingReopenNotification =
      isBookingClosedForUsers &&
      bookingClosure?.notifyOptInEnabled === true &&
      !!bookingClosure.activeClosureId;
  const publicBookingClosedBannerText = t("home.bookingClosedBanner");
  const isSupportExpired = !!tenantMeta?.supportExpired;
  const supportLockedMessage = t("home.supportExpired", { business: labels.business });
  const showEmptyBarbersState = barbersLoaded && activeBarbers.length === 0;
  const showEmptySectionsState = barbersLoaded && sectionsLoaded && activeBarbers.length > 0 && !selectedSection;
  const hasMyAppointments = !!user && !isAdmin && !isBarber;
  const serviceFirstGroups = useMemo(() => {
      if (activeBarbers.length <= 1) {
          return [] as Array<{ key: string; name: string; durationMinutes: number; durationDisplayText: string | null; sortOrder: number; sections: Section[] }>;
      }

      const activeBarberIds = new Set(barbers.filter((barber) => barber.isActive).map((barber) => barber.id));
      const grouped = new Map<string, { key: string; name: string; durationMinutes: number; durationDisplayText: string | null; sortOrder: number; sections: Section[] }>();

      allBookingSections
        .filter((section) => section.isActive && activeBarberIds.has(section.barberId))
        .forEach((section) => {
            const key = normalizeServiceGroupKey(section.name);
            const existing = grouped.get(key);

            if (existing) {
                existing.sections.push(section);
                existing.durationMinutes = Math.min(existing.durationMinutes, section.slotDurationMinutes);
                existing.durationDisplayText ||= section.durationDisplayText?.trim() || null;
                existing.sortOrder = Math.min(existing.sortOrder, section.sortOrder ?? 0);
                return;
            }

            grouped.set(key, {
                key,
                name: section.name,
                durationMinutes: section.slotDurationMinutes,
                durationDisplayText: section.durationDisplayText?.trim() || null,
                sortOrder: section.sortOrder ?? 0,
                sections: [section],
            });
        });

      return Array.from(grouped.values()).sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) {
              return a.sortOrder - b.sortOrder;
          }

          return a.name.localeCompare(b.name, "fa");
      });
  }, [activeBarbers.length, allBookingSections, barbers]);

  const subscribeToBookingReopenNotification = async () => {
      if (bookingClosureSubscribing) {
          return;
      }

      if (!user) {
          setBookingClosureLoginIntent(true);
          setLoginOpen(true);
          return;
      }

      setBookingClosureSubscribing(true);
      const res = await api.bookingClosure.subscribe();
      setBookingClosureSubscribing(false);

      if (!res.success) {
          toast({
              variant: "destructive",
              title: t("home.bookingClosure.subscribeFailedTitle"),
              description: res.message,
          });
          return;
      }

      setBookingClosure(res.data);
      toast({
          title: t("home.bookingClosure.subscribeEnabledTitle"),
          description: res.message || t("home.bookingClosure.subscribeEnabledDescription"),
      });
  };

  const handleLoginSuccess = () => {
      if (!bookingClosureLoginIntent) {
          return;
      }

      setBookingClosureLoginIntent(true);
  };

  useEffect(() => {
      if (!bookingClosureLoginIntent || !user || !canRequestBookingReopenNotification) {
          return;
      }

      setBookingClosureLoginIntent(false);
      void subscribeToBookingReopenNotification();
  }, [bookingClosureLoginIntent, canRequestBookingReopenNotification, user?.id]);

  const selectedServiceGroup = serviceFirstGroups.find((group) => group.key === selectedServiceGroupKey);
  const serviceFirstCandidateSections = selectedServiceGroup?.sections ?? [];
  const serviceFirstCandidateBarbers = useMemo(() => {
      if (!selectedServiceGroup) {
          return [] as Barber[];
      }

      const candidateBarberIds = new Set(selectedServiceGroup.sections.map((section) => section.barberId));
      return barbers
        .filter((barber) => barber.isActive && candidateBarberIds.has(barber.id))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "fa"));
  }, [barbers, selectedServiceGroup]);
  const normalizedServiceSearch = normalizeServiceGroupKey(serviceFirstServiceSearch);
  const normalizedBarberSearch = normalizeServiceGroupKey(serviceFirstBarberSearch);
  const normalizedServiceDialogSearch = normalizeServiceGroupKey(serviceDialogSearch);
  const filteredActiveSections = activeSections.filter((section) =>
      !normalizedServiceDialogSearch || normalizeServiceGroupKey(section.name).includes(normalizedServiceDialogSearch)
  );
  const filteredServiceFirstGroups = serviceFirstGroups.filter((group) =>
      !normalizedServiceSearch || normalizeServiceGroupKey(group.name).includes(normalizedServiceSearch)
  );
  const filteredServiceFirstBarbers = serviceFirstCandidateBarbers.filter((barber) =>
      !normalizedBarberSearch || normalizeServiceGroupKey(barber.name).includes(normalizedBarberSearch)
  );
  const filteredActiveBarbersForPicker = activeBarbers.filter((barber) =>
      !normalizedBarberSearch || normalizeServiceGroupKey(barber.name).includes(normalizedBarberSearch)
  );
  const guidedBookingFlowEnabled = activeBarbers.length > 1;
  const bookingFlowStartsWithService =
      bookingFlowIntent === "change-service" ||
      (bookingFlowIntent === "initial" && serviceFirstPreferenceEnabled);
  const bookingFlowStep = bookingFlowStartsWithService
      ? (selectedServiceGroup ? 2 : 1)
      : (barberFirstConfirmed ? 2 : 1);
  const bookingFlowIsServiceStep = bookingFlowStartsWithService
      ? bookingFlowStep === 1
      : bookingFlowStep === 2;
  const bookingFlowFirstLabel = bookingFlowStartsWithService ? t("home.serviceLabel") : labels.singular;
  const bookingFlowSecondLabel = bookingFlowStartsWithService ? labels.singular : t("home.serviceLabel");
  const bookingFlowSearchVisible = bookingFlowStartsWithService
      ? (bookingFlowStep === 1 || serviceFirstCandidateBarbers.length > 1)
      : (
          bookingFlowStep === 1 ||
          (sectionsLoaded && sectionsBarberId === currentBarberId && activeSections.length > 1)
        );
  const bookingFlowSearchValue = bookingFlowStartsWithService
      ? (bookingFlowStep === 1 ? serviceFirstServiceSearch : serviceFirstBarberSearch)
      : (bookingFlowStep === 1 ? serviceFirstBarberSearch : serviceDialogSearch);
  const bookingFlowSearchCount = bookingFlowStartsWithService
      ? (bookingFlowStep === 1 ? filteredServiceFirstGroups.length : filteredServiceFirstBarbers.length)
      : (bookingFlowStep === 1 ? filteredActiveBarbersForPicker.length : filteredActiveSections.length);
  const bookingFlowTransitionClass = bookingFlowTransitionDirection === "forward"
      ? "booking-flow-page-forward"
      : "booking-flow-page-backward";
  const bookingFlowTransitionKey = `${bookingFlowIntent}-${bookingFlowStep}-${bookingFlowTransitionDirection}`;
  const bookingFlowModalOpen =
      guidedBookingFlowEnabled &&
      serviceFirstPickerOpen &&
      !serviceFirstConfirmed &&
      !isAnnouncementBlocking &&
      !isBookingClosedForUsers &&
      !isSupportExpired;
  const customerClubModuleActive = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "customer-club") ?? false;
  const customerClubActive = tenantMeta?.customerClubSettings?.isPublicActive ?? customerClubModuleActive;
  const onlineChatModuleActive =
    tenantMeta?.onlineChatSettings?.moduleActive ??
    (tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-chat") ?? false);
  const onlineChatVisibleOnBookingPage =
    tenantMeta?.onlineChatSettings?.showOnBookingPage ?? onlineChatModuleActive;
  const isNutritionAudience = ["nutritionists", "nutrition-doctors"].includes(tenantMeta?.audience?.slug || "");
  const hasMenu = canOpenSettings || hasMyAppointments || !!user || !user || publicMenuItems.length > 0;
  const nutritionBookingBanner = getNutritionBookingBannerSettings(tenantMeta);
  const isBookingPath = location === "/" || location === "/booking" || location.startsWith("/booking?");
  const showFloatingOnlineChat = onlineChatModuleActive && onlineChatVisibleOnBookingPage && isBookingPath;
  const shouldShowNutritionBookingBanner =
    isNutritionAudience &&
    (isBookingPath || !isNutritionLandingDefaultEnabled(tenantMeta)) &&
    nutritionBookingBanner.enabled;
  const shouldShowStoreBannerOnMainSite =
    tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-store") &&
    tenantMeta?.storeEnabled !== false &&
    tenantMeta?.storeHomeSettings?.showBannerOnMainSite === true;
  const shouldPreferStoreAsDefaultLanding =
    tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-store") &&
    tenantMeta?.storeEnabled !== false &&
    tenantMeta?.storeHomeSettings?.preferStoreAsDefaultLanding === true;
  const isDefaultLandingPath = location === "/" || location.startsWith("/?");
  const storeBannerOnMainSite = shouldShowStoreBannerOnMainSite
    ? tenantMeta?.storeHomeSettings?.mainSiteBannerImageUrl || null
    : null;
  const storeBannerTitle = tenantMeta?.storeHomeSettings?.mainSiteBannerTitle?.trim() || t("home.storeBanner.title");
  const storeBannerDescription = tenantMeta?.storeHomeSettings?.mainSiteBannerDescription?.trim() || t("home.storeBanner.description");
  const nutritionBookingBannerImage = nutritionBookingBanner.imageUrl || "/booking-app/nutrition-hero.jpg";
  const nutritionBookingBannerBadge = nutritionBookingBanner.content.badge?.trim() || t("home.nutritionBanner.badge");
  const nutritionBookingBannerTitle = nutritionBookingBanner.content.title?.trim() || t("home.nutritionBanner.title");
  const nutritionBookingBannerDescription = nutritionBookingBanner.content.description?.trim() || t("home.nutritionBanner.description");
  const nutritionBookingBannerCta = nutritionBookingBanner.content.cta_label?.trim() || t("home.nutritionBanner.cta");
  const offQueueBookingEnabled = paymentSettings?.offQueueBookingEnabled ?? true;
  const offQueueEndTimeLabel = useMemo(() => {
      if (!selectedSection || !offQueueTime) {
          return "";
      }

      const startTimeDate = new Date(`${currentDate}T${offQueueTime}:00`);
      if (Number.isNaN(startTimeDate.getTime())) {
          return "";
      }

      const schedule = getEffectiveSectionSchedule(selectedSection, currentDate);
      return format(new Date(startTimeDate.getTime() + schedule.slotDurationMinutes * 60 * 1000), "HH:mm");
  }, [currentDate, offQueueTime, selectedSection]);

  useEffect(() => {
      if (!guidedBookingFlowEnabled) {
          setServiceFirstPickerOpen(false);
          setServiceFirstConfirmed(false);
          setServiceFirstDismissed(false);
          setBarberFirstConfirmed(false);
          setSelectedServiceGroupKey("");
          return;
      }

      if (isAnnouncementBlocking || isBookingClosedForUsers || isSupportExpired) {
          setServiceFirstPickerOpen(false);
          return;
      }

      if (!serviceFirstConfirmed && !serviceFirstDismissed) {
          setServiceFirstPickerOpen(true);
      }
  }, [guidedBookingFlowEnabled, isAnnouncementBlocking, isBookingClosedForUsers, isSupportExpired, serviceFirstConfirmed, serviceFirstDismissed]);

  const initialBookingChoiceComplete =
      panelAccessLocked ||
      isBookingClosedForUsers ||
      isSupportExpired ||
      (barbersLoaded && activeBarbers.length === 0) ||
      (guidedBookingFlowEnabled ? serviceFirstConfirmed : Boolean(selectedSectionId));
  const hasBlockingBookingOverlay =
      isAnnouncementBlocking ||
      announcementOpen ||
      bookingFlowModalOpen ||
      barberDialogOpen ||
      serviceDialogOpen ||
      loginOpen ||
      myAppointmentsOpen ||
      menuOpen ||
      Boolean(bookingModal?.isOpen) ||
      offQueueDialogOpen ||
      profileNameDialogOpen ||
      Boolean(cancelModal?.isOpen) ||
      Boolean(changeTimeAppointment);
  const pwaInstallPromptAllowed =
      initialBookingChoiceComplete &&
      !panelAccessLocked &&
      !authLoading &&
      !loading &&
      !hasBlockingBookingOverlay;

  useEffect(() => {
      setPwaInstallPromptAllowed(pwaInstallPromptAllowed);
  }, [pwaInstallPromptAllowed]);

  useEffect(() => {
      return () => {
          setPwaInstallPromptAllowed(true);
      };
  }, []);

  if (panelAccessLocked) {
      return (
          <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
              <div className="max-w-xl w-full">
                  <div className="rounded-[32px] border border-destructive/25 bg-card/75 p-8 text-center shadow-sm">
                      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
                          <ShieldAlert className="h-8 w-8 text-destructive" />
                      </div>
                      <h1 className="text-2xl font-bold text-foreground">{t("home.panelLockedTitle")}</h1>
                      <p className="mt-4 text-base leading-8 text-muted-foreground">{panelAccessMessage}</p>
                  </div>
              </div>
          </div>
      );
  }

  const navigateFromMenu = (href: string) => {
      setMenuOpen(false);
      setLocation(href);
  };

  useEffect(() => {
      if (!user || isAdmin || isBarber || !customerClubActive) {
          setCustomerClubSummary(null);
          return;
      }

      api.customerClub.me().then((res) => {
          if (res.success) {
              setCustomerClubSummary(res.data);
          }
      });
  }, [user, isAdmin, isBarber, customerClubActive]);

  useEffect(() => {
      if (!user || isAdmin || isBarber) {
          return;
      }

      let cancelled = false;
      const storageKey = "customer_club_shown_notifications";

      const showUnreadClubNotifications = async () => {
          const res = await api.notifications.list("unread", 1, 5);
          if (!res.success || cancelled) {
              return;
          }

          const shown = new Set<string>(JSON.parse(window.sessionStorage.getItem(storageKey) || "[]"));
          const pending = res.data.items.filter((item) => item.targetType === "customer_club" && !shown.has(item.id));

          pending.forEach((item) => {
              toast({
                  title: item.title || t("home.club.defaultCreditTitle"),
                  description: item.message,
              });
              shown.add(item.id);
          });

          window.sessionStorage.setItem(storageKey, JSON.stringify(Array.from(shown).slice(-30)));
      };

      void showUnreadClubNotifications();

      const unsubscribe = subscribeUserNotificationInboxUpdates(user.id, () => {
          void showUnreadClubNotifications();
      });

      return () => {
          cancelled = true;
          unsubscribe?.();
      };
  }, [user, isAdmin, isBarber, toast]);

  useEffect(() => {
      if (typeof window !== "undefined") {
          const skipOnce = window.sessionStorage.getItem("skip_store_default_redirect_once");
          if (skipOnce === "1") {
              window.sessionStorage.removeItem("skip_store_default_redirect_once");
              return;
          }
      }

      if (shouldPreferStoreAsDefaultLanding && isDefaultLandingPath) {
          setLocation("/store");
      }
  }, [isDefaultLandingPath, setLocation, shouldPreferStoreAsDefaultLanding]);

  const handleBarberSelect = (barberId: string, source: "inline" | "modal" = "inline") => {
      barberSelectionInProgressRef.current = true;
      setSelectedSectionId("");
      setCurrentBarberId(barberId);
      setBarberDialogOpen(false);

      if (source === "modal") {
          shouldScrollToTimeSlotsRef.current = false;
      }

      window.setTimeout(() => {
          barberSelectionInProgressRef.current = false;
      }, 250);
  };

  const handleSectionSelect = (sectionId: string, source: "inline" | "modal" = "inline") => {
      setSelectedSectionId(sectionId);
      setServiceDialogOpen(false);

      if (source === "modal") {
          shouldScrollToTimeSlotsRef.current = true;
      }
  };

  useEffect(() => {
      if (!currentBarberId) {
          return;
      }

      const frame = window.requestAnimationFrame(() => {
          barberItemRefs.current[currentBarberId]?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "center",
          });
      });

      return () => window.cancelAnimationFrame(frame);
  }, [currentBarberId]);

  useEffect(() => {
      if (!selectedSectionId) {
          return;
      }

      const frame = window.requestAnimationFrame(() => {
          sectionItemRefs.current[selectedSectionId]?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "center",
          });
      });

      return () => window.cancelAnimationFrame(frame);
  }, [selectedSectionId, sections]);

  useEffect(() => {
      if (!shouldScrollToTimeSlotsRef.current || !selectedSection || !timeSlotsSectionRef.current) {
          return;
      }

      const timeout = window.setTimeout(() => {
          scrollToTimeSlotsSection();
      }, 260);

      const resetTimeout = window.setTimeout(() => {
          shouldScrollToTimeSlotsRef.current = false;
      }, 700);

      return () => {
          window.clearTimeout(timeout);
          window.clearTimeout(resetTimeout);
      };
  }, [selectedSection, currentDate]);

  const minimumBookableAt = useMemo(
    () => (canStaffOverridePublicLeadTime ? null : getMinimumBookableAt(currentBarber)),
    [canStaffOverridePublicLeadTime, currentBarber],
  );
  const maximumBookableDate = useMemo(
    () => (canStaffOverridePublicBookingHorizon ? null : getMaximumBookableDate(currentBarber)),
    [canStaffOverridePublicBookingHorizon, currentBarber],
  );

  const isDateUnavailable = (date: string, section?: Section, barber?: Barber) => {
      if (!section || !barber) return false;

      const today = getTodayDateString();
      if (date < today) {
          return !canCreatePastAppointments;
      }

      if (minimumBookableAt && endOfDay(toSafeGregorianDate(date)) < minimumBookableAt) {
          return true;
      }

      if (maximumBookableDate && date > maximumBookableDate) {
          return true;
      }

      if (barber.activeRanges && barber.activeRanges.length > 0) {
          const inRange = barber.activeRanges.some((range) => date >= range.start && date <= range.end);
          if (!inRange) return true;
      }

      if (barber.disabledDates && barber.disabledDates.includes(date)) {
          return true;
      }

      if (!hasSectionScheduleOverrideForDate(section, date) && section.workDays && section.workDays.length > 0) {
          const dayOfWeek = toSafeGregorianDate(date).getDay();
          if (!section.workDays.includes(dayOfWeek)) return true;
      }

      if (section.disabledDates.includes(date)) return true;

      if (section.disabledDateRanges) {
          for (const range of section.disabledDateRanges) {
              if (date >= range.start && date <= range.end) return true;
          }
      }

      return false;
  };

  const isDateUnavailableForServiceFirst = (
      date: string,
      section: Section | undefined,
      barber: Barber | undefined,
      candidateMinimumBookableAt: Date | null,
      candidateMaximumBookableDate: string | null,
  ) => {
      if (!section || !barber) return false;

      const today = getTodayDateString();
      if (date < today) {
          return !canCreatePastAppointments;
      }

      if (candidateMinimumBookableAt && endOfDay(toSafeGregorianDate(date)) < candidateMinimumBookableAt) {
          return true;
      }

      if (candidateMaximumBookableDate && date > candidateMaximumBookableDate) {
          return true;
      }

      if (barber.activeRanges && barber.activeRanges.length > 0) {
          const inRange = barber.activeRanges.some((range) => date >= range.start && date <= range.end);
          if (!inRange) return true;
      }

      if (barber.disabledDates && barber.disabledDates.includes(date)) {
          return true;
      }

      if (!hasSectionScheduleOverrideForDate(section, date) && section.workDays && section.workDays.length > 0) {
          const dayOfWeek = toSafeGregorianDate(date).getDay();
          if (!section.workDays.includes(dayOfWeek)) return true;
      }

      if (section.disabledDates.includes(date)) return true;

      if (section.disabledDateRanges) {
          for (const range of section.disabledDateRanges) {
              if (date >= range.start && date <= range.end) return true;
          }
      }

      return false;
  };

  const getServiceFirstSectionForBarber = (barberId: string) =>
      serviceFirstCandidateSections
        .filter((section) => section.barberId === barberId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "fa"))[0];

  const getServiceFirstFirstDate = (section?: Section) => {
      if (!section) return null;

      const barber = barbers.find((item) => item.id === section.barberId);
      if (!barber) return null;

      const candidateMinimumBookableAt = canStaffOverridePublicLeadTime ? null : getMinimumBookableAt(barber);
      const candidateMaximumBookableDate = canStaffOverridePublicBookingHorizon ? null : getMaximumBookableDate(barber);

      return findFirstActiveDate(
          barber,
          section,
          candidateMinimumBookableAt,
          candidateMaximumBookableDate,
          (date, candidateSection, candidateBarber) =>
              isDateUnavailableForServiceFirst(
                  date,
                  candidateSection,
                  candidateBarber,
                  candidateMinimumBookableAt,
                  candidateMaximumBookableDate,
              ),
      );
  };

  const applyServiceFirstSelection = (section: Section, preferredDate?: string | null) => {
      bookingFlowCommittedRef.current = true;
      bookingFlowOriginalSelectionRef.current = null;
      setSelectedServiceGroupKey(normalizeServiceGroupKey(section.name));
      setSelectedSectionId(section.id);
      setCurrentBarberId(section.barberId);
      setBarberDialogOpen(false);
      setServiceDialogOpen(false);
      setServiceFirstConfirmed(true);
      setServiceFirstDismissed(false);
      setServiceFirstPickerOpen(false);

      if (preferredDate) {
          setCurrentDate(preferredDate);
      }

      shouldScrollToTimeSlotsRef.current = true;
  };

  const resetBookingFlowSearches = () => {
      setServiceFirstServiceSearch("");
      setServiceFirstBarberSearch("");
      setServiceDialogSearch("");
  };

  const rememberCurrentBookingSelection = () => {
      bookingFlowOriginalSelectionRef.current = {
          barberId: currentBarberId,
          sectionId: selectedSectionId,
          serviceGroupKey: selectedSection
              ? normalizeServiceGroupKey(selectedSection.name)
              : selectedServiceGroupKey,
      };
      bookingFlowCommittedRef.current = false;
  };

  const openInitialBookingFlow = () => {
      setBookingFlowIntent("initial");
      setBookingFlowTransitionDirection("forward");
      bookingFlowOriginalSelectionRef.current = null;
      bookingFlowCommittedRef.current = false;
      setSelectedServiceGroupKey("");
      setServiceFirstConfirmed(false);
      setServiceFirstDismissed(false);
      setBarberFirstConfirmed(false);
      resetBookingFlowSearches();

      if (!serviceFirstPreferenceEnabled && activeBarbers.length > 1) {
          setSelectedSectionId("");
          setCurrentBarberId("");
      }

      setServiceFirstPickerOpen(true);
  };

  const openBarberChangeFlow = () => {
      if (activeBarbers.length <= 1) return;

      rememberCurrentBookingSelection();
      setBookingFlowIntent("change-barber");
      setBookingFlowTransitionDirection("forward");
      setServiceFirstConfirmed(false);
      setServiceFirstDismissed(false);
      setBarberFirstConfirmed(false);
      resetBookingFlowSearches();
      setServiceFirstPickerOpen(true);
  };

  const openServiceChangeFlow = () => {
      if (activeBarbers.length <= 1) {
          setServiceDialogOpen(true);
          return;
      }

      rememberCurrentBookingSelection();
      setBookingFlowIntent("change-service");
      setBookingFlowTransitionDirection("forward");
      setSelectedServiceGroupKey("");
      setServiceFirstConfirmed(false);
      setServiceFirstDismissed(false);
      setBarberFirstConfirmed(false);
      resetBookingFlowSearches();
      setServiceFirstPickerOpen(true);
  };

  const closeServiceFirstPicker = () => {
      const originalSelection = bookingFlowOriginalSelectionRef.current;

      if (originalSelection && !bookingFlowCommittedRef.current) {
          setCurrentBarberId(originalSelection.barberId);
          setSelectedSectionId(originalSelection.sectionId);
          setSelectedServiceGroupKey(originalSelection.serviceGroupKey);
          setServiceFirstConfirmed(true);
      }

      bookingFlowOriginalSelectionRef.current = null;
      bookingFlowCommittedRef.current = false;
      setServiceFirstPickerOpen(false);

      if (!serviceFirstConfirmed && !originalSelection) {
          setServiceFirstDismissed(true);
      }
  };

  const runBookingFlowStepTransition = (
      direction: "forward" | "backward",
      updateStep: () => void,
  ) => {
      const transitionDocument = document as BookingTransitionDocument;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!transitionDocument.startViewTransition || prefersReducedMotion) {
          setBookingFlowTransitionDirection(direction);
          updateStep();
          return;
      }

      const root = document.documentElement;
      const directionClass = direction === "forward"
          ? "booking-flow-transition-forward"
          : "booking-flow-transition-backward";

      root.classList.remove("booking-flow-transition-forward", "booking-flow-transition-backward");
      root.classList.add("booking-flow-view-transition", directionClass);

      const transition = transitionDocument.startViewTransition(() => {
          flushSync(() => {
              setBookingFlowTransitionDirection(direction);
              updateStep();
          });
      });

      const clearTransitionClasses = () => {
          root.classList.remove(directionClass);
      };
      void transition.finished.then(clearTransitionClasses, clearTransitionClasses);
  };

  const handleServiceFirstGroupSelect = (groupKey: string) => {
      const group = serviceFirstGroups.find((item) => item.key === groupKey);
      if (!group) return;

      if (bookingFlowIntent === "change-service") {
          const matchingCurrentBarberSection = group.sections
              .filter((section) => section.barberId === currentBarberId)
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0];

          if (matchingCurrentBarberSection) {
              applyServiceFirstSelection(matchingCurrentBarberSection);
              return;
          }
      }

      runBookingFlowStepTransition("forward", () => {
          setSelectedServiceGroupKey(group.key);
          setServiceFirstBarberSearch("");
      });
  };

  const handleBarberFirstBarberSelect = (barberId: string) => {
      if (bookingFlowIntent === "change-barber") {
          const originalServiceGroupKey = bookingFlowOriginalSelectionRef.current?.serviceGroupKey;
          const matchingSection = originalServiceGroupKey
              ? allBookingSections
                  .filter((section) =>
                      section.isActive &&
                      section.barberId === barberId &&
                      normalizeServiceGroupKey(section.name) === originalServiceGroupKey
                  )
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0]
              : undefined;

          if (matchingSection) {
              applyServiceFirstSelection(matchingSection);
              return;
          }
      }

      runBookingFlowStepTransition("forward", () => {
          setSelectedSectionId("");
          setCurrentBarberId(barberId);
          setBarberFirstConfirmed(true);
          setServiceFirstBarberSearch("");
          setServiceDialogSearch("");
      });
  };

  const handleBarberFirstSectionSelect = (sectionId: string) => {
      bookingFlowCommittedRef.current = true;
      bookingFlowOriginalSelectionRef.current = null;
      setSelectedSectionId(sectionId);
      const section = activeSections.find((item) => item.id === sectionId);
      if (section) {
          setSelectedServiceGroupKey(normalizeServiceGroupKey(section.name));
      }
      setServiceFirstConfirmed(true);
      setServiceFirstDismissed(false);
      setServiceFirstPickerOpen(false);
      shouldScrollToTimeSlotsRef.current = true;
  };

  const handleServiceFirstBarberSelect = (barberId: string) => {
      const section = getServiceFirstSectionForBarber(barberId);
      if (!section) return;

      applyServiceFirstSelection(section, getServiceFirstFirstDate(section));
  };

  const handleServiceFirstAnyBarber = () => {
      const ranked = serviceFirstCandidateSections
        .map((section) => ({
            section,
            firstDate: getServiceFirstFirstDate(section),
        }))
        .sort((a, b) => {
            if (a.firstDate && b.firstDate) {
                return a.firstDate.localeCompare(b.firstDate);
            }

            if (a.firstDate) return -1;
            if (b.firstDate) return 1;

            return (a.section.sortOrder ?? 0) - (b.section.sortOrder ?? 0);
        });

      const bestMatch = ranked[0];
      if (!bestMatch) return;

      applyServiceFirstSelection(bestMatch.section, bestMatch.firstDate);
  };

  // Check if Date is Disabled for this section OR Barber
  const isDateDisabled = useMemo(() => {
      return isDateUnavailable(currentDate, selectedSection, currentBarber);
  }, [currentDate, selectedSection, currentBarber, minimumBookableAt, maximumBookableDate]);

  const firstActiveDate = useMemo(
    () =>
      findFirstActiveDate(
        currentBarber,
        selectedSection,
        minimumBookableAt,
        maximumBookableDate,
        isDateUnavailable,
      ),
    [currentBarber, selectedSection, minimumBookableAt, maximumBookableDate],
  );

  useEffect(() => {
      if (!selectedSection || !currentBarber) {
          return;
      }

      const selectionKey = `${currentBarber.id}:${selectedSection.id}`;

      if (initializedSelectionKeyRef.current === selectionKey) {
          return;
      }

      initializedSelectionKeyRef.current = selectionKey;

      if (!firstActiveDate) {
          return;
      }

      if (focusedAppointmentDateRef.current === currentDate) {
          focusedAppointmentDateRef.current = null;
          return;
      }

      const currentDateIsUnavailable = isDateUnavailable(currentDate, selectedSection, currentBarber);

      if (currentDateIsUnavailable || currentDate < firstActiveDate) {
          setCurrentDate(firstActiveDate);
      }
  }, [currentBarber, selectedSection, firstActiveDate, currentDate, setCurrentDate]);

  const daySlots = useMemo(() => {
      if (!selectedSection || isDateDisabled) return [];
      return buildTimeSlots(selectedSection, appointments, currentDate, minimumBookableAt, currentBarber?.blockedTimeRanges);
  }, [selectedSection, appointments, currentDate, isDateDisabled, minimumBookableAt, currentBarber?.blockedTimeRanges]);

  const isDayFullyBooked = useMemo(() => {
      if (isCurrentBarberPanelBlocked) return false;
      if (!selectedSection || isDateDisabled || loading) return false;
      return daySlots.length > 0 && !daySlots.some((slot) =>
        slot.status === "free" ||
        (isAdmin && slot.status === "overlapped") ||
        (canStaffBookInBreaks && slot.status === "break")
      );
  }, [selectedSection, isDateDisabled, loading, daySlots, isAdmin, isCurrentBarberPanelBlocked, canStaffBookInBreaks]);

  const nextActiveDate = useMemo(
    () =>
      findNextActiveDate(
        currentDate,
        currentBarber,
        selectedSection,
        minimumBookableAt,
        maximumBookableDate,
        isDateUnavailable,
      ),
    [currentDate, currentBarber, selectedSection, minimumBookableAt, maximumBookableDate],
  );

  const nextNavigationDate = useMemo(() => {
      if (nextActiveDate) {
          return nextActiveDate;
      }

      if (firstActiveDate && firstActiveDate !== currentDate) {
          return firstActiveDate;
      }

      return null;
  }, [nextActiveDate, firstActiveDate, currentDate]);

  const nextNavigationLabel = nextActiveDate ? t("home.nextActiveDateAfter") : t("home.nextActiveDate");
  const minimumNavigationDate = minimumBookableAt
      ? format(startOfDay(minimumBookableAt), "yyyy-MM-dd")
      : todayDate;
  const canNavigatePastDates = canCreatePastAppointments;
  const canGoPreviousDay = canNavigatePastDates || currentDate > minimumNavigationDate;
  const canGoNextDay = !maximumBookableDate || currentDate < maximumBookableDate;
  const setCurrentDateWithinLimits = (nextDate: string) => {
      if (!canNavigatePastDates && nextDate < todayDate) {
          setCurrentDate(todayDate);
          return;
      }

      if (!canNavigatePastDates && minimumBookableAt) {
          const minimumDate = format(startOfDay(minimumBookableAt), "yyyy-MM-dd");
          if (nextDate < minimumDate) {
              setCurrentDate(minimumDate);
              return;
          }
      }

      if (maximumBookableDate && nextDate > maximumBookableDate) {
          setCurrentDate(maximumBookableDate);
          return;
      }

      setCurrentDate(nextDate);
  };

  const handleSlotClick = (time: string, options?: { vipOnly?: boolean }) => {
    if (isBookingClosedForUsers) {
      return;
    }

    if (isPastAppointmentTime(currentDate, time) && !canCreatePastAppointments) {
      toast({
        variant: "destructive",
        title: t("home.pastBooking.title"),
        description: t("home.pastBooking.timeAdminOnly"),
      });
      return;
    }

    setBookingModal({ isOpen: true, time, offQueue: false, vipOnly: options?.vipOnly ?? false });
  };

  const quickSlotRange = (section: Section, date: string, time: string) => {
    const schedule = getEffectiveSectionSchedule(section, date);
    const startMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const endMinutes = startMinutes + schedule.slotDurationMinutes;

    return {
      start: time,
      end: `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`,
    };
  };

  const timeToMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map((part) => Number(part) || 0);
    return hours * 60 + minutes;
  };

  const quickBlockedSlotFor = (section: Section, date: string, time: string) => {
    const range = quickSlotRange(section, date, time);
    const slotStart = timeToMinutes(range.start);
    const slotEnd = timeToMinutes(range.end);

    return section.quickBlockedSlots?.find(
      (item) => {
        if (item.date !== date) return false;

        const blockStart = timeToMinutes(item.start);
        const blockEnd = timeToMinutes(item.end);

        return slotStart < blockEnd && slotEnd > blockStart;
      },
    ) ?? null;
  };

  const handleQuickToggleSlot = async (time: string, scope: "section" | "all" = "section") => {
    if (!selectedSection) {
      return false;
    }

    const currentBlockedSlot = quickBlockedSlotFor(selectedSection, currentDate, time);
    const blockTargets =
      scope === "all" && !currentBlockedSlot
        ? activeSections.filter((section) => section.barberId === selectedSection.barberId)
        : [selectedSection];

    const buildQuickBlockedSlots = (section: Section) => {
      const range = quickSlotRange(section, currentDate, time);
      const schedule = getEffectiveSectionSchedule(section, currentDate);
      const slotIndex = Math.max(0, Math.round(
        (Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) - (
          Number(schedule.startHour.slice(0, 2)) * 60 + Number(schedule.startHour.slice(3, 5))
        )) / schedule.slotDurationMinutes,
      ));
      const existingBlockedSlot = quickBlockedSlotFor(section, currentDate, time);

      if (currentBlockedSlot) {
        return (section.quickBlockedSlots || []).filter((item) => item.id !== currentBlockedSlot.id);
      }

      if (existingBlockedSlot) {
        return section.quickBlockedSlots || [];
      }

      return [
        ...(section.quickBlockedSlots || []),
        {
          id: `quick-${section.id}-${currentDate}-${time.replace(":", "")}-${slotIndex}`,
          date: currentDate,
          start: range.start,
          end: range.end,
          reason: t("home.quickBlock.reason"),
        },
      ].sort((first, second) => `${first.date} ${first.start}`.localeCompare(`${second.date} ${second.start}`));
    };

    let success = true;

    for (const section of blockTargets) {
      const sectionSuccess = await updateSection({
        ...section,
        quickBlockedSlots: buildQuickBlockedSlots(section),
      }, { silent: true });

      if (!sectionSuccess) {
        success = false;
        break;
      }
    }

    if (success) {
      toast({
        title: currentBlockedSlot ? t("home.quickBlock.openedTitle") : t("home.quickBlock.closedTitle"),
        description: currentBlockedSlot
          ? t("home.quickBlock.openedDescription", { time: isolateLtr(time) })
          : scope === "all"
            ? t("home.quickBlock.allDescription", { time: isolateLtr(time) })
            : t("home.quickBlock.sectionDescription", { time: isolateLtr(time) }),
      });
    }

    return success;
  };

  const handleChangeTimeSlotClick = (time: string) => {
      if (!changeTimeAppointment) {
          return;
      }

      if (currentDate < todayDate) {
          toast({
              variant: "destructive",
              title: t("home.changeTime.pastTitle"),
              description: t("home.pastBooking.viewOnly"),
          });
          return;
      }

      if (currentDate === changeTimeAppointment.date && time === changeTimeAppointment.startTime) {
          toast({
              title: t("home.changeTime.sameTitle"),
              description: t("home.changeTime.sameDescription"),
          });
          return;
      }

      setSendChangeTimeSms(Boolean(paymentSettings?.smsEnabled && paymentSettings.smsTemplatesV2?.appointmentChange?.enabled));
      setPendingChangeTarget({ date: currentDate, time });
  };

  const clearChangeTimeMode = () => {
      setChangeTimeAppointment(null);
      setPendingChangeTarget(null);

      const search = new URLSearchParams(window.location.search);
      search.delete("appointment");
      search.delete("action");
      const nextQuery = search.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
  };

  const startChangeTimeMode = (appointment: Appointment) => {
      setCancelModal(null);
      setChangeTimeAppointment(appointment);
      setPendingChangeTarget(null);
      setCurrentBarberId(appointment.barberId);
      setSelectedSectionId(appointment.sectionId);
      focusedAppointmentDateRef.current = appointment.date;
      setCurrentDate(appointment.date);
      setBarberDialogOpen(false);
      setServiceDialogOpen(false);
      shouldScrollToTimeSlotsRef.current = true;
      window.history.replaceState(
          {},
          "",
          `/booking?appointment=${encodeURIComponent(appointment.id)}&action=change_time&date=${encodeURIComponent(appointment.date)}&barber_id=${encodeURIComponent(appointment.barberId)}&section_id=${encodeURIComponent(appointment.sectionId)}`,
      );
  };

  const confirmChangeTime = async () => {
      if (!changeTimeAppointment || !pendingChangeTarget) {
          return;
      }

      setChangingTime(true);
      const res = await api.appointments.changeTime(changeTimeAppointment.id, pendingChangeTarget.time, {
          date: pendingChangeTarget.date,
          sendSms: sendChangeTimeSms,
      });
      setChangingTime(false);

      if (!res.success) {
          toast({
              variant: "destructive",
              title: t("home.changeTime.failedTitle"),
              description: res.message || t("home.changeTime.tryAnother"),
          });
          return;
      }

      clearChangeTimeMode();
      setPendingChangeTarget(null);
      await fetchAppointments();
      toast({
          title: t("home.changeTime.successTitle"),
          description: t("home.changeTime.successDescription", {
              user: res.data.userName || t("home.changeTime.defaultUser"),
              date: formatValue.date(toSafeGregorianDate(res.data.date), {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
              }),
              time: isolateLtr(res.data.startTime),
          }),
      });
  };

  const handleOpenOffQueueDialog = () => {
      if (!selectedSection) {
          return;
      }

      if (currentDate < todayDate && !canCreatePastAppointments) {
          toast({
              variant: "destructive",
              title: t("home.pastBooking.title"),
              description: t("home.pastBooking.dayAdminOnly"),
          });
          return;
      }

      setOffQueueTime(getEffectiveSectionSchedule(selectedSection, currentDate).startHour || "09:00");
      setOffQueueDialogOpen(true);
  };

  const handleConfirmOffQueueTime = () => {
      if (!selectedSection || !offQueueTime) {
          toast({
              variant: "destructive",
              title: t("home.offQueue.startRequiredTitle"),
              description: t("home.offQueue.startRequiredDescription"),
          });
          return;
      }

      if (isPastAppointmentTime(currentDate, offQueueTime) && !canCreatePastAppointments) {
          toast({
              variant: "destructive",
              title: t("home.pastBooking.title"),
              description: t("home.pastBooking.timeAdminOnly"),
          });
          return;
      }

      setOffQueueDialogOpen(false);
      setBookingModal({ isOpen: true, time: offQueueTime, offQueue: true, vipOnly: false });
  };

  const handleAppointmentClick = (app: Appointment) => {
     setCancelModal({ isOpen: true, appointment: app });
  };

  const refreshCustomerFinanceSummary = async (mobile: string, professionalId?: string) => {
      const res = await api.manualFinance.customerSummaries({
          mobiles: [mobile],
          professionalId: professionalId || currentBarberId || undefined,
      });

      if (!res.success) return;

      const summary = res.data.items[0];
      setFinanceSummaries((current) => {
          if (!summary) {
              const next = { ...current };
              delete next[mobile];
              return next;
          }

          return { ...current, [summary.customerPhone]: summary };
      });
  };

  useEffect(() => {
      if (!isAdmin && !isBarber) {
          setFinanceSummaries({});
          return;
      }

      const mobiles = Array.from(new Set(
          appointments
              .filter((appointment) => appointment.status !== "cancelled")
              .map((appointment) => appointment.userPhone)
              .filter(Boolean),
      ));

      if (!mobiles.length) {
          setFinanceSummaries({});
          return;
      }

      let active = true;
      api.manualFinance.customerSummaries({
          mobiles,
          professionalId: currentBarberId || undefined,
      }).then((res) => {
          if (!active) return;
          if (res.success) {
              setFinanceSummaries(Object.fromEntries(res.data.items.map((item) => [item.customerPhone, item])));
          }
      });

      return () => {
          active = false;
      };
  }, [appointments, currentBarberId, isAdmin, isBarber]);
  
  const handleDateChange = (dateObject: any) => {
      if(dateObject) {
         // Convert to YYYY-MM-DD
         const date = dateObject.toDate();
         setCurrentDateWithinLimits(format(date, "yyyy-MM-dd"));
      }
  }

  const scrollToTimeSlotsSection = () => {
      if (!timeSlotsSectionRef.current) {
          return;
      }

      const element = timeSlotsSectionRef.current;
      const headerOffset = 112;

      element.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
      });

      window.setTimeout(() => {
          window.scrollTo({
              top: Math.max(window.scrollY - headerOffset, 0),
              behavior: "smooth",
          });
      }, 120);
  };

  const changeDay = (days: number) => {
      if (days < 0 && !canGoPreviousDay) {
          return;
      }

      if (days > 0 && !canGoNextDay) {
          return;
      }

      const date = toSafeGregorianDate(currentDate);
      const newDate = addDays(date, days);
      setCurrentDateWithinLimits(format(newDate, "yyyy-MM-dd"));
  }

  const scrollPageToTop = () => {
      pageTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

      const scrollRoot = document.scrollingElement;
      if (scrollRoot && scrollRoot.scrollTop > 0) {
          scrollRoot.scrollTo({ top: 0, behavior: "smooth" });
      }
  };

  const changeDayAndScrollToTop = (days: number) => {
      changeDay(days);

      window.requestAnimationFrame(() => {
          scrollPageToTop();
      });
  };

  const goToNextActiveDate = () => {
      if (nextNavigationDate) {
          setCurrentDateWithinLimits(nextNavigationDate);
      }
  };

  useEffect(() => {
      if (!maximumBookableDate) {
          return;
      }

      if (currentDate > maximumBookableDate) {
          setCurrentDate(maximumBookableDate);
      }
  }, [currentDate, maximumBookableDate, setCurrentDate]);

  return (
    <div
      ref={pageTopRef}
      className={cn(
        "min-h-screen bg-[#09111f] text-[#eef3ff] pb-20",
        bookingTemplateClass,
      )}
      data-booking-template={bookingTemplate}
      dir={dir}
    >
      
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#09111f]/94 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[390px] items-center justify-between gap-2 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
             <div className="flex size-[40px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6a21a] text-[17px] font-black text-[#07101e] shadow-lg shadow-[#f6a21a]/20">
                {appearance?.logoUrl ? (
                  <img src={appearance.logoUrl} alt={appearance.storeName || t("home.header.logoAlt")} className="block h-full w-full rounded-full object-cover" />
                ) : (
                  <span className="mt-1">{(appearance?.storeName?.trim()?.[0] || "B").toUpperCase()}</span>
                )}
             </div>
             <div className="min-w-0 flex-1 text-start">
                <h1 className="truncate text-[15px] font-black leading-5 text-white">
                  {appearance?.storeName?.trim() || appearance?.bookingHeaderTitle?.trim() || t("home.header.defaultTitle")}
                </h1>
                {appearance?.bookingHeaderTitle?.trim() && appearance.bookingHeaderTitle.trim() !== appearance?.storeName?.trim() && (
                  <p className="mt-0.5 truncate text-[10px] font-medium leading-4 text-[#7f8ba3]">
                    {appearance.bookingHeaderTitle.trim()}
                  </p>
                )}
             </div>
          </div>
          
          <div className="flex shrink-0 gap-2">
            {user && <NotificationBell onClick={() => setLocation("/notifications")} />}
            {!user && (
              <Button
                variant="outline"
                title={t("auth.login")}
                onClick={() => setLoginOpen(true)}
                className="h-8 rounded-lg border-[#8b6125] bg-[#211e20] px-2.5 text-[#f6a21a] hover:bg-[#2c2520] hover:text-[#f6a21a]"
              >
                <span className="text-[11px] font-black">{t("auth.login")}</span>
                <LogIn className="h-3.5 w-3.5" />
              </Button>
            )}
            {canOpenSettings && (
              <Link href="/panel">
                <Button variant="outline" size="icon" title={t("home.header.settings")} className="h-[36px] w-[36px] rounded-xl border-[#26344c] bg-[#131b2b] text-[#a5b0c8]">
                  <SettingsIcon className="w-4 h-4" />
                </Button>
              </Link>
            )}
            {hasMenu && (
              <Button variant="outline" size="icon" title={t("common.menu")} onClick={() => setMenuOpen(true)} className="h-[36px] w-[36px] rounded-full border-[#303a4f] bg-[#151e2e] text-[#b6c0d6]">
                <Menu className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </header>
      {isBookingClosed && (isAdmin || isBarber) && (
        <div className="container mx-auto px-4 pt-3">
          <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-center text-sm font-bold text-red-400">
            {publicBookingClosedBannerText}
          </div>
        </div>
      )}

      <MobileSiteMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        user={user}
        accountExtra={customerClubSummary?.moduleActive ? (
          <div className="flex flex-wrap justify-end gap-2">
            {!!user?.isVip && (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                <Gem className="h-3 w-3" />
                VIP
              </span>
            )}
            {customerClubSummary.settings.showWalletToCustomer && (
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/35 px-3 py-1.5 text-start">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                <div className="text-[11px] text-muted-foreground">{t("home.club.wallet")}</div>
                <div className="text-xs font-bold">{formatValue.currency(customerClubSummary.account.walletBalance)}</div>
              </div>
            )}
            {customerClubSummary.settings.showPointsToCustomer && (
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/35 px-3 py-1.5 text-start">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <div className="text-[11px] text-muted-foreground">{t("home.club.points")}</div>
                <div className="text-xs font-bold">{formatValue.number(customerClubSummary.account.pointsBalance)}</div>
              </div>
            )}
          </div>
        ) : (!!user?.isVip ? (
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
              <Gem className="h-3 w-3" />
              VIP
            </span>
          </div>
        ) : null)}
        items={[
          ...publicMenuItems.map((item) => ({
            key: item.key,
            title: item.title,
            icon: item.icon,
            badge: item.badge,
            onSelect: () => navigateFromMenu(item.href),
          })),
          ...(user ? [{
            key: "notifications",
            title: t("home.menu.notifications"),
            icon: ShieldAlert,
            onSelect: () => navigateFromMenu("/notifications"),
          }] : []),
          ...(user ? [{
            key: "profile-edit",
            title: t("profile.editTitle"),
            icon: User,
            onSelect: () => {
              setMenuOpen(false);
              setProfileNameDialogOpen(true);
            },
          }] : []),
          ...(hasMyAppointments ? [{
            key: "my-appointments",
            title: t("home.menu.myAppointments"),
            icon: ListOrdered,
            onSelect: () => {
              setMenuOpen(false);
              setMyAppointmentsOpen(true);
            },
          }] : []),
          ...(canOpenSettings ? [{
            key: "settings",
            title: t("home.header.settings"),
            icon: SettingsIcon,
            onSelect: () => navigateFromMenu("/panel"),
          }] : []),
        ]}
        loginAction={!user ? {
          label: t("auth.login"),
          icon: LogIn,
          onSelect: () => {
            setMenuOpen(false);
            setLoginOpen(true);
          },
        } : null}
        logoutAction={user ? async () => {
          setMenuOpen(false);
          await logout();
        } : null}
      />

      <main className="mx-auto w-full max-w-[390px] space-y-2 px-4 py-2">
        {shouldShowNutritionBookingBanner && (
          <Link href="/nutrition" className="block">
            <div className="group relative overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(13,18,36,0.94)_52%,rgba(245,158,11,0.14))] shadow-lg shadow-black/10 transition hover:border-emerald-300/40 hover:shadow-emerald-500/10">
              <div className="absolute inset-y-0 start-0 hidden w-[38%] sm:block">
                <img
                  src={nutritionBookingBannerImage}
                  alt={t("home.nutritionBanner.alt")}
                  className="h-full w-full object-cover opacity-85 transition duration-500 group-hover:scale-[1.03]"
                />
                <div className={cn(
                  "absolute inset-0 from-transparent via-[#091120]/45 to-[#091120]",
                  isRtl ? "bg-gradient-to-l" : "bg-gradient-to-r",
                )} />
              </div>

              <div className="pointer-events-none absolute -end-10 top-0 h-32 w-32 rounded-full bg-emerald-400/15 blur-2xl" />
              <div className="pointer-events-none absolute bottom-0 start-10 h-28 w-28 rounded-full bg-amber-400/15 blur-2xl" />

              <div className="relative flex min-h-[178px] flex-col items-end justify-center gap-3 px-5 py-6 text-end sm:min-h-[198px] sm:px-8 sm:ps-[42%]">
                <div className="rounded-full border border-emerald-300/25 bg-white/8 px-3 py-1 text-xs font-bold text-emerald-200 backdrop-blur">
                  {nutritionBookingBannerBadge}
                </div>
                <div className="text-xl font-black leading-9 text-white sm:text-2xl">
                  {nutritionBookingBannerTitle}
                </div>
                <div className="text-sm leading-7 text-white/75 sm:max-w-2xl">
                  {nutritionBookingBannerDescription}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20">
                  <Sparkles className="h-4 w-4" />
                  {nutritionBookingBannerCta}
                </div>
              </div>
            </div>
          </Link>
        )}

        {shouldShowStoreBannerOnMainSite && (
          <Link href="/store" className="block mb-3">
            {storeBannerOnMainSite ? (
              <div className="group relative overflow-hidden rounded-[2rem] border border-primary/25 bg-card/70 shadow-lg shadow-black/10 transition hover:border-primary/45 hover:shadow-primary/10">
                <img
                  src={storeBannerOnMainSite}
                  alt={t("home.storeBanner.alt")}
                  className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.02] sm:h-52"
                />
                <div className={cn("absolute inset-0 from-black/65 via-black/20 to-transparent", isRtl ? "bg-gradient-to-r" : "bg-gradient-to-l")} />
                <div className="absolute inset-y-0 end-0 flex max-w-[78%] flex-col items-end justify-center gap-3 px-5 text-end sm:px-8">
                  <div className="rounded-full border border-primary/30 bg-background/55 px-3 py-1 text-xs font-bold text-primary backdrop-blur">
                    {t("home.storeBanner.eyebrow")}
                  </div>
                  <div className="text-xl font-black leading-9 text-white sm:text-2xl">
                    {storeBannerTitle}
                  </div>
                  <div className="text-sm leading-7 text-white/80 sm:max-w-md">
                    {storeBannerDescription}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20">
                    <ShoppingCart className="h-4 w-4" />
                    {t("home.storeBanner.enter")}
                  </div>
                </div>
              </div>
            ) : (
              <div className="group relative overflow-hidden rounded-[2rem] border border-primary/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.20),rgba(2,132,199,0.16))] shadow-lg shadow-black/10 transition hover:border-primary/55 hover:shadow-primary/15">
                <div className="pointer-events-none absolute -start-8 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-14 end-6 h-44 w-44 rounded-full bg-sky-400/20 blur-2xl" />
                <div className="relative flex min-h-[168px] flex-col items-end justify-center gap-3 px-5 py-6 text-end sm:min-h-[196px] sm:px-8">
                  <div className="rounded-full border border-primary/35 bg-background/70 px-3 py-1 text-xs font-bold text-primary backdrop-blur">
                    {t("home.storeBanner.eyebrow")}
                  </div>
                  <div className="text-xl font-black leading-9 text-foreground sm:text-2xl">
                    {storeBannerTitle}
                  </div>
                  <div className="text-sm leading-7 text-muted-foreground sm:max-w-md">
                    {storeBannerDescription}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20">
                    <ShoppingCart className="h-4 w-4" />
                    {t("home.storeBanner.view")}
                  </div>
                </div>
              </div>
            )}
          </Link>
        )}
        
        {/* Barber Selection */}
        {tenantMeta && !tenantMeta.setupCompleted ? (
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="max-w-xl w-full rounded-3xl border border-border bg-card/60 p-8 text-center shadow-sm">
                <CalendarDays className="w-14 h-14 mx-auto text-primary mb-5" />
                <h2 className="text-2xl font-bold">{t("home.emptySetup.title")}</h2>
                <p className="text-muted-foreground mt-3 leading-8">
                  {t("home.emptySetup.description", {
                    professionals: labels.plural,
                    business: labels.business,
                  })}
                </p>
                <div className="mt-8 flex justify-center">
                  {canOpenSettings ? (
                    <Link href="/panel">
                      <Button size="lg" className="px-10">{t("home.emptySetup.enterSettings")}</Button>
                    </Link>
                  ) : (
                    <Button size="lg" className="px-10" onClick={() => setLoginOpen(true)}>
                      {t("auth.login")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
        ) : (
        <>
        {/* Barber Selection */}
        {!isBookingClosedForUsers && activeBarbers.length > 1 && currentBarber && (
            <div
              role={activeBarbers.length > 1 ? "button" : undefined}
              tabIndex={activeBarbers.length > 1 ? 0 : undefined}
              aria-label={activeBarbers.length > 1 ? t("home.changeProfessional", { professional: labels.singular }) : undefined}
              onClick={() => {
                if (activeBarbers.length <= 1) return;
                openBarberChangeFlow();
              }}
              onKeyDown={(event) => {
                if (activeBarbers.length <= 1 || (event.key !== "Enter" && event.key !== " ")) return;
                event.preventDefault();
                event.currentTarget.click();
              }}
              className={cn(
                "rounded-2xl border border-[#8a621e] bg-[#1d2a45] p-px shadow-[0_0_0_2px_rgba(246,162,26,0.08)]",
                activeBarbers.length > 1 && "cursor-pointer transition hover:border-[#b47b21] hover:bg-[#21304f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6a21a]/45",
              )}
            >
              <div className="flex min-h-[54px] items-center gap-2 rounded-[15px] px-2.5 py-1.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6a21a] text-[#07101e]">
                  {currentBarber.avatar ? (
                    <img src={currentBarber.avatar} alt={currentBarber.name} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-start">
                  <p className="truncate text-[13px] font-black leading-5 text-white">{currentBarber.name}</p>
                  <p className="truncate text-[9px] font-bold text-[#8f9bb3]">
                    {t("home.seniorProfessional", { professional: labels.singular })}
                  </p>
                </div>
                {activeBarbers.length > 1 && (
                  <span className="flex h-6 shrink-0 items-center gap-1 rounded-full px-1.5 text-[9px] font-bold text-[#d99a32]">
                    {isRtl ? <ChevronLeft className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                    {t("home.changeProfessional", { professional: labels.singular })}
                  </span>
                )}
              </div>
            </div>
        )}

        {activeBarbers.length > 0 && !isBookingClosedForUsers && !isSupportExpired && (
          <div className="rounded-2xl border border-[#26344b] bg-[#121b2b] px-2.5 py-2 shadow-sm">
             <div className="grid grid-cols-[32px_1fr_32px] items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  data-date-nav="previous"
                  data-date-nav-state={canGoPreviousDay ? "active" : "disabled"}
                  onClick={() => changeDayAndScrollToTop(-1)}
                  disabled={!canGoPreviousDay}
                  aria-label={t("home.previousDay")}
                  title={t("home.previousDay")}
                  className="h-8 w-8 rounded-lg border-[#313d53] bg-[#1d2637] text-[#d6deef] hover:bg-[#253147] disabled:cursor-not-allowed disabled:border-[#202a3b] disabled:bg-[#0b1320] disabled:text-[#424e64] disabled:opacity-100"
                >
                   {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
                
                <div className="text-center">
                  <DatePicker 
                     value={toSafeGregorianDate(currentDate)}
                     onChange={handleDateChange}
                     minDate={canNavigatePastDates ? undefined : toSafeGregorianDate(minimumNavigationDate)}
                     maxDate={maximumBookableDate ? toSafeGregorianDate(maximumBookableDate) : undefined}
                     editable={false}
                     inputMode="none"
                     calendar={pickerCalendar}
                     locale={pickerLocale}
                     calendarPosition="bottom-center"
                     inputClass="bg-transparent border-none text-center text-[15px] font-black text-[#f6a21a] w-28 cursor-pointer hover:text-[#ffc15b] focus:outline-none"
                     format="YYYY/MM/DD"
                  />
                  <p className="text-[9px] font-bold text-[#8f9bb3]">{selectedDateLabel}</p>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  data-date-nav="next"
                  data-date-nav-state={canGoNextDay ? "active" : "disabled"}
                  onClick={() => changeDayAndScrollToTop(1)}
                  disabled={!canGoNextDay}
                  aria-label={t("home.nextDay")}
                  title={t("home.nextDay")}
                  className="h-8 w-8 rounded-lg border-[#313d53] bg-[#1d2637] text-[#d6deef] hover:bg-[#253147] disabled:cursor-not-allowed disabled:border-[#202a3b] disabled:bg-[#0b1320] disabled:text-[#424e64] disabled:opacity-100"
                >
                   {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
             </div>
             
             {activeSections.length > 1 && (
               <>
                 <div className="my-2 h-px bg-[#27354b]" />

                 <div className="mb-1.5 flex items-center justify-between text-[10px] font-black">
                    <span className="text-[#d8dfef]">{t("home.desiredService")}</span>
                    <span className="text-[#8f9bb3]">{t("home.servicesCount", { count: formatValue.number(activeSections.length) })}</span>
                 </div>

                 <button
                   type="button"
                   onClick={() => {
                     if (activeBarbers.length > 1) {
                       openServiceChangeFlow();
                       return;
                     }

                     setServiceDialogOpen(true);
                   }}
                   className="flex min-h-[38px] w-full items-center justify-between rounded-lg border border-[#3a4558] bg-[#202939] px-2.5 text-start transition hover:border-[#f6a21a]/60"
                 >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#f6a21a]" />
                      <span className="truncate text-[11px] font-black text-white">{selectedSection?.name || t("home.selectService")}</span>
                    </span>
                    {isRtl ? <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-[#9ca8bd]" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#9ca8bd]" />}
                 </button>
               </>
             )}
          </div>
        )}

        {isAdmin && currentDate < todayDate && !isBookingClosedForUsers && !isSupportExpired ? (
          <div className="rounded-xl border border-border/70 bg-card/65 px-3 py-2 text-center">
            <p className="text-xs font-black text-foreground">
              {t("home.pastBooking.viewingNotice")}
            </p>
          </div>
        ) : null}

        {/* Content */}
        {isBookingClosedForUsers ? (
            <div className="flex min-h-[230px] flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed border-primary/35 bg-[linear-gradient(135deg,rgba(245,158,11,0.10),rgba(15,23,42,0.42))] px-6 py-8 text-center shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <p className="text-base font-black text-foreground">{t("home.bookingClosedTitle")}</p>
                <p className="mt-2 max-w-sm whitespace-pre-line text-sm leading-7 text-muted-foreground">
                  {bookingClosedMessage}
                </p>
                {canRequestBookingReopenNotification ? (
                  bookingClosure?.userSubscribed ? (
                    <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200">
                      <Check className="h-4 w-4" />
                      {t("home.bookingClosure.subscribed")}
                    </div>
                  ) : (
                    <Button className="mt-5 gap-2" onClick={() => void subscribeToBookingReopenNotification()} disabled={bookingClosureSubscribing}>
                      {bookingClosureSubscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                      {t("home.bookingClosure.subscribe")}
                    </Button>
                  )
                ) : null}
            </div>
        ) : showEmptyBarbersState ? (
            <div className="text-center py-10 text-muted-foreground">
                {t("home.emptyProfessionals", {
                  professional: labels.singular,
                  business: labels.business,
                })}
            </div>
        ) : selectedSection ? (
            <div ref={timeSlotsSectionRef} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                 <div
                   dir="ltr"
                   className="flex min-h-[52px] items-center justify-between gap-2.5 rounded-xl border border-[#263247] bg-[#121b2a] p-1.5 sm:min-h-[58px] sm:px-3"
                 >
                   <Button
                     type="button"
                     variant="ghost"
                     size="icon"
                     className="h-8 w-8 shrink-0 rounded-lg border border-[#344056] bg-[#1b2434] p-0 text-[#9aa6bc] hover:bg-[#253147] hover:text-white sm:h-9 sm:w-9"
                     onClick={() => fetchAppointments()}
                     disabled={loading}
                     aria-label={t("home.refreshSlots")}
                     title={t("home.refreshSlots")}
                   >
                     <RefreshCw className={`h-4 w-4 sm:h-[18px] sm:w-[18px] ${loading ? "animate-spin" : ""}`} />
                   </Button>

                   <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
                     <span className="flex shrink-0 items-center gap-1.5 text-[9px] font-black text-[#3ed39a] sm:text-[11px]">
                       <span className="h-2 w-2 shrink-0 rounded-full bg-[#3ed39a] sm:h-2.5 sm:w-2.5" />
                       {t("home.freeSlots", {
                         count: formatValue.number(daySlots.filter((slot) => slot.status === "free").length),
                       })}
                     </span>

                     <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[#2d394d]" />

                     <span className="flex min-w-0 items-center gap-1.5 text-[9px] font-black text-[#929db3] sm:text-[11px]">
                       <Clock className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                       <span className="truncate">
                         {t("home.workingHours", {
                           start: getEffectiveSectionSchedule(selectedSection, currentDate).startHour,
                           end: getEffectiveSectionSchedule(selectedSection, currentDate).endHour,
                         })}
                       </span>
                     </span>
                   </div>
                 </div>

                 {loading ? (
                     <div className="h-64 flex items-center justify-center">
                         <span className="animate-pulse text-muted-foreground">{t("common.loading")}</span>
                     </div>
                 ) : isDateDisabled ? (
                     <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-card/20 rounded-2xl border-dashed border-2 border-border/50">
                         <CalendarDays className="w-12 h-12 mb-4 opacity-50" />
                         <p className="font-bold">{firstActiveDate ? t("home.dateUnavailable") : t("home.noFreeSlot")}</p>
                         <p className="text-sm mt-1">
                           {firstActiveDate ? t("home.selectAnotherRange") : t("home.noActiveBookingDay")}
                         </p>
                         {nextNavigationDate && (
                           <Button className="mt-5 gap-2" onClick={() => setCurrentDate(nextNavigationDate)}>
                             <ArrowLeft className="w-4 h-4" />
                             {nextNavigationLabel}
                           </Button>
                         )}
                     </div>
                 ) : isSupportExpired ? (
                     <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground bg-card/20 rounded-2xl border-dashed border-2 border-border/50 px-6">
                         <ShieldAlert className="w-12 h-12 mb-4 opacity-70 text-destructive" />
                         <p className="font-bold text-foreground">
                           {canOpenSettings
                             ? t("home.supportLocked", { business: labels.business })
                             : t("home.accessUnavailable")}
                         </p>
                         <p className="text-sm mt-2 leading-7">
                           {canOpenSettings ? supportLockedMessage : t("home.contactSupport")}
                         </p>
                         {canOpenSettings && (
                           <Link href="/panel/support-renewal">
                             <Button className="mt-5">{t("home.renewSupport")}</Button>
                           </Link>
                         )}
                     </div>
                 ) : isBookingClosedForUsers ? (
                     <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground bg-card/20 rounded-2xl border-dashed border-2 border-border/50 px-6">
                         <CalendarDays className="w-12 h-12 mb-4 opacity-50" />
                         <p className="font-bold text-foreground">{t("home.bookingClosedTitle")}</p>
                         <p className="text-sm mt-2 leading-7">{bookingClosedMessage}</p>
                         {canRequestBookingReopenNotification ? (
                           bookingClosure?.userSubscribed ? (
                             <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200">
                               <Check className="h-4 w-4" />
                               {t("home.bookingClosure.subscribed")}
                             </div>
                           ) : (
                             <Button className="mt-5 gap-2" onClick={() => void subscribeToBookingReopenNotification()} disabled={bookingClosureSubscribing}>
                               {bookingClosureSubscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                               {t("home.bookingClosure.subscribe")}
                             </Button>
                           )
                         ) : null}
                     </div>
                 ) : isDayFullyBooked ? (
                     <div className="flex h-52 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 bg-card/20 px-5 text-center text-muted-foreground">
                         <CalendarDays className="mb-3 h-9 w-9 opacity-50" />
                         <p className="text-sm font-bold">{t("home.fullyBooked")}</p>
                         <p className="mt-1 text-xs">{t("home.chooseAnotherDay")}</p>
                         {nextNavigationDate && (
                           <Button className="mt-4 h-9 gap-1.5 rounded-lg px-3 text-xs" onClick={goToNextActiveDate}>
                             <ArrowLeft className="h-3.5 w-3.5" />
                             {nextNavigationLabel}
                           </Button>
                         )}
                     </div>
                 ) : (
                    <>
                    {changeTimeAppointment ? (
                      <div className="relative overflow-hidden rounded-[1.6rem] border border-amber-300/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.20),rgba(16,185,129,0.12),rgba(15,23,42,0.76))] px-4 py-4 text-start shadow-xl shadow-amber-500/10 backdrop-blur">
                        <div className="pointer-events-none absolute -top-16 -end-10 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />
                        <div className="pointer-events-none absolute -bottom-20 start-6 h-36 w-36 rounded-full bg-emerald-300/15 blur-2xl" />
                        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-300/15 px-3 py-1 text-[11px] font-black text-amber-100">
                              <Clock className="h-3.5 w-3.5" />
                              {t("home.changeTime.bannerTitle", {
                                user: changeTimeAppointment.userName || t("home.changeTime.defaultUser"),
                              })}
                            </div>
                            <div className="text-sm leading-7 text-foreground">
                              {t("home.changeTime.bannerDescription", {
                                user: changeTimeAppointment.userName || t("home.changeTime.defaultUser"),
                                section: changeTimeAppointment.sectionName || selectedSection.name,
                                date: selectedDateLabel,
                                time: isolateLtr(changeTimeAppointment.startTime),
                              })}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-full border-white/15 bg-background/35 px-4 text-xs text-foreground hover:bg-background/55"
                            onClick={clearChangeTimeMode}
                          >
                            {t("home.changeTime.exit")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <TimeSlotGrid 
                        section={selectedSection}
                        date={currentDate}
                        appointments={appointments}
                        minimumBookableAt={minimumBookableAt}
                        blockedTimeRanges={currentBarber?.blockedTimeRanges}
                        allowRestBreakBooking={canStaffBookInBreaks}
                        forceFullyBooked={isCurrentBarberPanelBlocked}
                        changeTimeAppointmentId={changeTimeAppointment?.id ?? null}
                        onSlotClick={handleSlotClick}
                        allowQuickSlotManagement={isPrimaryAdmin && !changeTimeAppointment}
                        customerFinanceSummaries={financeSummaries}
                        onChangeTimeSlotClick={changeTimeAppointment ? handleChangeTimeSlotClick : undefined}
                        onAppointmentClick={handleAppointmentClick}
                    />
                    </>
                 )}
                 {(isAdmin || isBarber) && offQueueBookingEnabled && !changeTimeAppointment && (
                   <div className="flex justify-start px-1">
                     <Button
                       type="button"
                       variant="outline"
                       size="sm"
                       onClick={handleOpenOffQueueDialog}
                       className="rounded-full border-dashed px-4 text-xs text-muted-foreground"
                     >
                       <WandSparkles className="me-1 h-3.5 w-3.5" />
                       {t("home.offQueue.title")}
                     </Button>
                   </div>
                 )}
                 <div className="booking-bottom-action-bar fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[390px] items-center justify-between gap-2.5 border-t border-[#1b283c] bg-[#08101d]/96 px-4 py-1.5 backdrop-blur">
                   <Button
                     variant="outline"
                     data-day-nav="previous"
                     data-day-nav-state={canGoPreviousDay ? "active" : "disabled"}
                     className={cn(
                       "booking-bottom-day-action h-8 rounded-full bg-transparent px-3 text-[11px] font-black hover:bg-white/8 disabled:cursor-not-allowed disabled:bg-[#0b1320] disabled:opacity-100",
                       canGoPreviousDay
                         ? "border-[#a1a8b5] text-white"
                         : "border-[#30394c] text-[#68748b]",
                     )}
                     onClick={() => changeDayAndScrollToTop(-1)}
                     disabled={!canGoPreviousDay}
                   >
                     {isRtl ? <ChevronRight className="me-1 h-3 w-3" /> : <ChevronLeft className="me-1 h-3 w-3" />}
                     {t("home.previousDay")}
                   </Button>
                   <Button
                     variant="outline"
                     data-day-nav="next"
                     data-day-nav-state={canGoNextDay ? "active" : "disabled"}
                     className={cn(
                       "booking-bottom-day-action h-8 rounded-full bg-transparent px-3 text-[11px] font-black hover:bg-white/8 disabled:cursor-not-allowed disabled:bg-[#0b1320] disabled:opacity-100",
                       canGoNextDay
                         ? "border-[#a1a8b5] text-white"
                         : "border-[#30394c] text-[#68748b]",
                     )}
                     onClick={() => changeDayAndScrollToTop(1)}
                     disabled={!canGoNextDay}
                   >
                     {t("home.nextDay")}
                     {isRtl ? <ChevronLeft className="ms-1 h-3 w-3" /> : <ChevronRight className="ms-1 h-3 w-3" />}
                   </Button>
                 </div>
            </div>
        ) : guidedBookingFlowEnabled && !serviceFirstConfirmed ? (
            <div className="booking-empty-section-card rounded-[1.75rem] border border-dashed border-primary/35 bg-[linear-gradient(135deg,rgba(245,158,11,0.10),rgba(15,23,42,0.42))] px-5 py-8 text-center shadow-sm">
                <div className="booking-empty-section-icon mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-primary/20 bg-primary/10 text-primary">
                  <ListOrdered className="h-7 w-7" />
                </div>
                <p className="booking-empty-section-title text-base font-black text-foreground">{t("home.emptySection.title")}</p>
                <p className="booking-empty-section-description mx-auto mt-2 max-w-sm text-sm leading-7 text-muted-foreground">
                  {t("home.emptySection.description", {
                    first: serviceFirstPreferenceEnabled ? t("home.desiredService") : labels.singular,
                    second: serviceFirstPreferenceEnabled ? labels.singular : t("home.desiredService"),
                  })}
                </p>
                <Button
                  type="button"
                  className="booking-empty-section-action mt-5 rounded-2xl px-7 font-black"
                  onClick={openInitialBookingFlow}
                >
                  {t("home.emptySection.select")}
                </Button>
            </div>
        ) : showEmptySectionsState ? (
            <div className="text-center py-10 text-muted-foreground">
                {t("home.emptySection.noneForProfessional", { professional: labels.singular })}
            </div>
        ) : (
            <div className="h-24" />
        )}
        </>
        )}

      </main>

      {showFloatingOnlineChat && (
        <Link href="/support/chat">
          <button
            type="button"
            className="booking-floating-chat-button group fixed bottom-5 start-5 z-40 flex h-14 w-14 flex-col items-center justify-center rounded-2xl border border-cyan-200/12 bg-[linear-gradient(180deg,rgba(18,28,48,0.96),rgba(10,18,34,0.98))] px-1 text-cyan-100 shadow-[0_18px_40px_-18px_rgba(6,182,212,0.35)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-200/20 hover:text-white"
            title={t("home.onlineChat")}
          >
            <div className="booking-floating-chat-glow absolute inset-[1px] rounded-[15px] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_58%)]" />
            <div className="booking-floating-chat-status absolute start-2 top-2 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]" />
            <MessageCircleMore className="relative h-5 w-5" />
            <span className="booking-floating-chat-label relative mt-1.5 text-[8px] font-medium leading-none text-cyan-100/80">
              {t("home.onlineChat")}
            </span>
            {onlineChatUnreadCount > 0 ? (
              <span className="booking-floating-chat-count absolute -end-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full border border-slate-950/80 bg-amber-400 px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-950 shadow-[0_10px_18px_-10px_rgba(251,191,36,0.9)]">
                {onlineChatUnreadCount > 99 ? "99+" : formatValue.number(onlineChatUnreadCount)}
              </span>
            ) : null}
          </button>
        </Link>
      )}

      {paymentSettings?.enamadCode && (
        <div className="container mx-auto px-4 pb-8">
          <div className="mt-4 flex justify-center rounded-2xl border border-border bg-card/40 p-4">
            <div
              className="enamad-wrapper"
              dangerouslySetInnerHTML={{ __html: paymentSettings.enamadCode }}
            />
          </div>
        </div>
      )}

      <Dialog
        open={announcementOpen}
        onOpenChange={(open) => {
          if (open) {
            setAnnouncementOpen(true);
            return;
          }

          if (siteAnnouncementKey) {
            setAcknowledgedAnnouncementKey(siteAnnouncementKey);
          }
          setAnnouncementOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-lg" dir={dir}>
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{t("home.announcement.title")}</DialogTitle>
          </DialogHeader>
          <div className="rounded-2xl border bg-card/40 p-4 text-sm leading-8 text-foreground whitespace-pre-wrap">
            {paymentSettings?.siteAnnouncementText}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (siteAnnouncementKey) {
                  setAcknowledgedAnnouncementKey(siteAnnouncementKey);
                }
                setAnnouncementOpen(false);
              }}
            >
              {t("home.announcement.understood")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <Dialog
        open={bookingFlowModalOpen}
        onOpenChange={(open) => {
          if (open) {
            setServiceFirstPickerOpen(true);
            return;
          }

          closeServiceFirstPicker();
        }}
      >
        <DialogContent
          className="w-[min(360px,calc(100vw-20px))] max-w-none overflow-hidden rounded-[22px] border-[#263653] bg-[#080e1b] p-0 text-[#eef3ff] shadow-2xl shadow-black/45 [&>button]:hidden"
          dir={dir}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {bookingFlowIsServiceStep
                ? t("home.flow.selectService")
                : t("home.flow.selectProfessional", { professional: labels.singular })}
            </DialogTitle>
            <DialogDescription>
              {t("home.flow.instruction", {
                first: bookingFlowFirstLabel,
                second: bookingFlowSecondLabel,
              })}
            </DialogDescription>
          </DialogHeader>

          <button
            type="button"
            onClick={closeServiceFirstPicker}
            className="absolute start-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[#2d3b57] bg-[#121c30] text-[#a8b4ce] transition hover:border-[#ffad24]/55 hover:text-[#f5f7ff]"
            aria-label={t("home.flow.close")}
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="flex max-h-[84vh] min-h-[520px] flex-col overflow-hidden">
            <div className="px-2.5 pt-2.5">
              <div className="flex items-center gap-2.5 text-xs font-black">
                <div className="flex items-center gap-1.5 text-[#ffad24]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ffad24] text-sm font-black text-[#06101f]">
                    {bookingFlowStep === 2 ? <Check className="h-3.5 w-3.5" /> : formatValue.number(1)}
                  </span>
                  <span>{bookingFlowFirstLabel}</span>
                </div>
                <div className="h-0.5 flex-1 rounded-full bg-[#334462]" />
                <div className={`flex items-center gap-1.5 ${bookingFlowStep === 2 ? "text-[#ffad24]" : "text-[#8190ad]"}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${bookingFlowStep === 2 ? "bg-[#ffad24] text-[#06101f]" : "bg-[#172541] text-[#8c9ab6]"}`}>
                    {formatValue.number(2)}
                  </span>
                  <span>{bookingFlowSecondLabel}</span>
                </div>
              </div>

              {bookingFlowStep === 2 && (
                <button
                  type="button"
                  onClick={() => {
                    runBookingFlowStepTransition("backward", () => {
                      if (bookingFlowStartsWithService) {
                        setSelectedServiceGroupKey("");
                        setServiceFirstBarberSearch("");
                      } else {
                        setBarberFirstConfirmed(false);
                        const originalSelection = bookingFlowOriginalSelectionRef.current;
                        setSelectedSectionId(originalSelection?.sectionId || "");
                        setCurrentBarberId(originalSelection?.barberId || "");
                        setServiceDialogSearch("");
                      }
                    });
                  }}
                  className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#2b3b5a] bg-[#101a2e] px-2.5 py-1.5 text-[10px] font-black text-[#d8e0f4]"
                >
                  {isRtl ? <ChevronRight className="h-3 w-3 text-[#ffad24]" /> : <ChevronLeft className="h-3 w-3 text-[#ffad24]" />}
                  <span className="text-[#9daac4]">{t("home.flow.changeFirst", { first: bookingFlowFirstLabel })}</span>
                  <span className="truncate text-[#ffad24]">
                    {bookingFlowStartsWithService ? selectedServiceGroup?.name : currentBarber?.name}
                  </span>
                </button>
              )}

              {bookingFlowSearchVisible && (
                <div
                  key={`search-${bookingFlowTransitionKey}`}
                  className={cn("relative mt-2.5", bookingFlowTransitionClass)}
                  style={{ viewTransitionName: "booking-flow-search" }}
                >
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7786a5]" />
                  <Input
                    value={bookingFlowSearchValue}
                    onChange={(event) => {
                      if (bookingFlowStartsWithService) {
                        if (bookingFlowStep === 1) {
                          setServiceFirstServiceSearch(event.target.value);
                        } else {
                          setServiceFirstBarberSearch(event.target.value);
                        }
                      } else if (bookingFlowStep === 1) {
                        setServiceFirstBarberSearch(event.target.value);
                      } else {
                        setServiceDialogSearch(event.target.value);
                      }
                    }}
                    placeholder={bookingFlowIsServiceStep
                      ? t("home.flow.searchService")
                      : t("home.flow.searchProfessional", { professional: labels.singular })}
                    className="h-11 rounded-xl border-[#253653] bg-[#0d1629] ps-9 text-start text-xs font-bold text-[#dfe7f8] placeholder:text-[#7584a1] focus-visible:ring-[#ffad24]/45"
                  />
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#7584a1]">
                    {formatValue.number(bookingFlowSearchCount)}
                  </span>
                </div>
              )}
            </div>

            <div
              key={`content-${bookingFlowTransitionKey}`}
              className={cn("pretty-scrollbar flex-1 overflow-y-auto px-2.5 py-2.5", bookingFlowTransitionClass)}
              style={{ viewTransitionName: "booking-flow-content" }}
            >
              {bookingFlowStartsWithService ? (
                bookingFlowStep === 1 ? (
                <div className="space-y-2">
                  {!allBookingSectionsLoaded ? (
                    <div className="rounded-2xl border border-[#253653] bg-[#111a2d] px-4 py-5 text-center text-sm font-bold text-[#9ba8c3]">
                      {t("home.flow.loadingServices")}
                    </div>
                  ) : filteredServiceFirstGroups.length === 0 ? (
                    <div className="rounded-2xl border border-[#253653] bg-[#111a2d] px-4 py-5 text-center text-sm font-bold text-[#9ba8c3]">
                      {t("home.flow.noServices")}
                    </div>
                  ) : filteredServiceFirstGroups.map((group) => {
                    const isSelected = selectedServiceGroupKey === group.key;
                    const currentBarberOffersGroup = group.sections.some((section) => section.barberId === currentBarberId);
                    return (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => handleServiceFirstGroupSelect(group.key)}
                        className={`flex min-h-[62px] w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-start transition ${
                          isSelected
                            ? "border-[#ffad24] bg-[#241f21] shadow-[0_0_0_1px_rgba(255,173,36,0.22)]"
                            : "border-[#253653] bg-[#111b31] hover:border-[#ffad24]/70"
                        }`}
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-black ${
                          isSelected ? "bg-[#ffad24] text-[#06101f]" : "bg-[#2a2931] text-[#ffad24]"
                        }`}>
                          {group.name.trim().charAt(0) || "?"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-[#f5f7ff]">{group.name}</span>
                          <span className="mt-0.5 block truncate text-[10px] font-bold text-[#8f9bb7]">
                            {bookingFlowIntent === "change-service"
                              ? currentBarberOffersGroup
                                ? t("home.flow.keepCurrentProfessional", { professional: labels.singular })
                                : t("home.flow.needsNewProfessional", { professional: labels.singular })
                              : getServiceDurationDisplayText(group.durationDisplayText, group.durationMinutes)}
                          </span>
                        </span>
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                          isSelected ? "border-[#ffad24] bg-[#ffad24] text-[#06101f]" : "border-[#43506b] text-transparent"
                        }`}>
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {serviceFirstCandidateBarbers.length === 1 && (
                    <div className="booking-single-provider-notice rounded-xl border border-[#ffad24]/45 bg-[#ffad24]/10 px-3 py-2.5 text-start">
                      <p className="booking-single-provider-title text-[11px] font-black text-[#ffe3aa]">
                        {t("home.flow.onlyBy", { name: serviceFirstCandidateBarbers[0].name })}
                      </p>
                      <p className="booking-single-provider-description mt-1 text-[9px] font-bold text-[#b9a98c]">
                        {t("home.flow.confirmProfessionalChange", { professional: labels.singular })}
                      </p>
                    </div>
                  )}

                  {serviceFirstCandidateBarbers.length > 1 && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleServiceFirstAnyBarber}
                        className="group flex min-h-[58px] w-full cursor-pointer items-center gap-2 rounded-xl border border-[#ffad24]/75 bg-[#ffad24]/12 px-2.5 py-2 text-start shadow-[0_0_0_1px_rgba(255,173,36,0.08)] transition hover:border-[#ffad24] hover:bg-[#ffad24]/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffad24]/45"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ffad24]/18 text-[#ffad24] transition group-hover:bg-[#ffad24]/25">
                          <Zap className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 truncate text-[13px] font-black text-[#fff1c7]">
                            <span>{t("home.flow.anyProfessional")}</span>
                            <span className="rounded-full bg-[#ffad24]/15 px-1.5 py-0.5 text-[8px] text-[#ffca69]">{t("home.flow.fastest")}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-[9px] font-bold text-[#c6b99e]">{t("home.flow.nearestAvailable")}</span>
                        </span>
                        <span className="flex h-7 shrink-0 items-center gap-0.5 rounded-lg bg-[#ffad24] px-2 text-[9px] font-black text-[#07101e] transition group-hover:bg-[#ffbd45]">
                          {t("home.flow.select")}
                          {isRtl ? <ChevronLeft className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                        </span>
                      </button>
                      <div className="flex items-center gap-2 px-1">
                        <span className="h-px flex-1 bg-[#2a3955]" />
                        <span className="text-[11px] font-bold text-[#7f8da9]">
                          {t("home.flow.orSpecificProfessional", { professional: labels.singular })}
                        </span>
                        <span className="h-px flex-1 bg-[#2a3955]" />
                      </div>
                    </div>
                  )}

                  {filteredServiceFirstBarbers.length === 0 ? (
                    <div className="rounded-2xl border border-[#253653] bg-[#111a2d] px-4 py-5 text-center text-sm font-bold text-[#9ba8c3]">
                      {t("home.flow.noProfessionalForService", { professional: labels.singular })}
                    </div>
                  ) : filteredServiceFirstBarbers.map((barber) => {
                    const section = getServiceFirstSectionForBarber(barber.id);
                    const firstDate = getServiceFirstFirstDate(section);
                    const firstDateLabel = firstDate
                      ? formatValue.date(toSafeGregorianDate(firstDate), {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })
                      : t("home.noAvailableTime");

                    return (
                      <button
                        key={barber.id}
                        type="button"
                        onClick={() => handleServiceFirstBarberSelect(barber.id)}
                        className="flex min-h-[62px] w-full items-center gap-2.5 rounded-xl border border-[#253653] bg-[#111b31] px-2.5 py-2 text-start transition hover:border-[#ffad24]/70"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2a2931] text-base font-black text-[#ffad24]">
                          {barber.avatar ? (
                            <img src={barber.avatar} alt={barber.name} className="h-full w-full object-cover" />
                          ) : (
                            barber.name.trim().charAt(0) || "?"
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-[#f5f7ff]">{barber.name}</span>
                          <span className="mt-0.5 block truncate text-[10px] font-bold text-[#8f9bb7]">
                            {t("home.flow.firstAvailable", { date: firstDateLabel })}
                          </span>
                        </span>
                        {serviceFirstCandidateBarbers.length === 1 ? (
                          <span className="booking-single-provider-action flex h-7 shrink-0 items-center gap-0.5 rounded-lg bg-[#ffad24] px-2 text-[9px] font-black text-[#07101e]">
                            {t("home.flow.selectAndContinue")}
                            {isRtl ? <ChevronLeft className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                          </span>
                        ) : (
                          <span className="h-7 w-7 shrink-0 rounded-full border border-[#43506b]" />
                        )}
                      </button>
                    );
                  })}
                </div>
                )
              ) : bookingFlowStep === 1 ? (
                <div className="space-y-2">
                  {bookingFlowIntent === "change-barber" && !allBookingSectionsLoaded ? (
                    <div className="rounded-xl border border-[#253653] bg-[#111a2d] px-4 py-4 text-center text-xs font-bold text-[#9ba8c3]">
                      {t("home.flow.checkingServices", { professionals: labels.plural })}
                    </div>
                  ) : filteredActiveBarbersForPicker.length === 0 ? (
                    <div className="rounded-xl border border-[#253653] bg-[#111a2d] px-4 py-4 text-center text-xs font-bold text-[#9ba8c3]">
                      {t("home.flow.noProfessional", { professional: labels.singular })}
                    </div>
                  ) : filteredActiveBarbersForPicker.map((barber) => {
                    const originalSelection = bookingFlowOriginalSelectionRef.current;
                    const originalServiceGroupKey = originalSelection?.serviceGroupKey;
                    const preservesCurrentService = !!originalServiceGroupKey && allBookingSections.some((section) =>
                      section.isActive &&
                      section.barberId === barber.id &&
                      normalizeServiceGroupKey(section.name) === originalServiceGroupKey
                    );
                    const isCurrentBarber = bookingFlowIntent === "change-barber" && originalSelection?.barberId === barber.id;
                    const helperText = bookingFlowIntent !== "change-barber"
                      ? t("home.flow.selectProfessional", { professional: labels.singular })
                      : preservesCurrentService
                        ? isCurrentBarber
                          ? t("home.flow.currentProfessionalKeepsService", { professional: labels.singular })
                          : t("home.flow.currentServiceKept")
                        : t("home.flow.needsNewService");

                    return (
                      <button
                        key={barber.id}
                        type="button"
                        onClick={() => handleBarberFirstBarberSelect(barber.id)}
                        className={`flex min-h-[62px] w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-start transition ${
                          isCurrentBarber
                            ? "border-[#ffad24]/55 bg-[#241f21]"
                            : "border-[#253653] bg-[#111b31] hover:border-[#ffad24]/70"
                        }`}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2a2931] text-base font-black text-[#ffad24]">
                          {barber.avatar ? (
                            <img src={barber.avatar} alt={barber.name} className="h-full w-full object-cover" />
                          ) : (
                            barber.name.trim().charAt(0) || "?"
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-[#f5f7ff]">{barber.name}</span>
                          <span className={`booking-flow-helper-text mt-0.5 block truncate text-[10px] font-bold ${preservesCurrentService ? "booking-flow-helper-text--preserved text-[#9fc8ad]" : "text-[#8f9bb7]"}`}>
                            {helperText}
                          </span>
                        </span>
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${isCurrentBarber ? "border-[#ffad24] text-[#ffad24]" : "border-[#43506b]"}`}>
                          {isCurrentBarber && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {!currentBarberId || !sectionsLoaded || sectionsBarberId !== currentBarberId ? (
                    <div className="rounded-xl border border-[#253653] bg-[#111a2d] px-4 py-4 text-center text-xs font-bold text-[#9ba8c3]">
                      {t("home.flow.loadingServices")}
                    </div>
                  ) : filteredActiveSections.length === 0 ? (
                    <div className="rounded-xl border border-[#253653] bg-[#111a2d] px-4 py-4 text-center text-xs font-bold text-[#9ba8c3]">
                      {t("home.flow.noServices")}
                    </div>
                  ) : filteredActiveSections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleBarberFirstSectionSelect(section.id)}
                      className="flex min-h-[62px] w-full items-center gap-2.5 rounded-xl border border-[#253653] bg-[#111b31] px-2.5 py-2 text-start transition hover:border-[#ffad24]/70"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2a2931] text-base font-black text-[#ffad24]">
                        {section.name.trim().charAt(0) || "?"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-[#f5f7ff]">{section.name}</span>
                        <span className="mt-0.5 block truncate text-[10px] font-bold text-[#8f9bb7]">
                          {getServiceDurationDisplayText(section.durationDisplayText, section.slotDurationMinutes)}
                        </span>
                      </span>
                      <span className="h-7 w-7 shrink-0 rounded-full border border-[#43506b]" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-[#1f2c45] bg-[#0d1629] p-2.5">
              <Button
                type="button"
                disabled
                className="booking-flow-disabled-action h-11 w-full rounded-xl bg-[#172541] text-xs font-black text-[#8391ad] opacity-100"
              >
                {bookingFlowIsServiceStep
                  ? t("home.flow.chooseService")
                  : t("home.flow.chooseProfessional", { professional: labels.singular })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={barberDialogOpen && !guidedBookingFlowEnabled && !isAnnouncementBlocking && !serviceFirstBookingEnabled}
        onOpenChange={(open) => {
          if (guidedBookingFlowEnabled || isAnnouncementBlocking || serviceFirstBookingEnabled) return;
          if (!open && activeBarbers.length > 1 && !currentBarberId && !barberSelectionInProgressRef.current) return;
          setBarberDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t("home.flow.selectProfessional", { professional: labels.singular })}</DialogTitle>
            <DialogDescription>
              {t("home.flow.professionalDialogDescription", { professional: labels.singular })}
            </DialogDescription>
          </DialogHeader>

          <div className="pretty-scrollbar max-h-[60vh] overflow-y-auto px-1 pt-2">
            <div className="grid gap-3">
            {activeBarbers.map((barber) => (
              <Button
                key={barber.id}
                variant="outline"
                className="h-auto justify-between rounded-xl px-4 py-4 text-start"
                onClick={() => handleBarberSelect(barber.id, "modal")}
              >
                <span className="font-bold">{barber.name}</span>
                <span className="text-xs text-muted-foreground">{labels.singular}</span>
              </Button>
            ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={
          serviceDialogOpen &&
          !guidedBookingFlowEnabled &&
          !barberDialogOpen &&
          !isAnnouncementBlocking &&
          !serviceFirstBookingEnabled &&
          !!currentBarberId &&
          sectionsLoaded &&
          sectionsBarberId === currentBarberId
        }
        onOpenChange={(open) => {
          if (guidedBookingFlowEnabled || isAnnouncementBlocking || serviceFirstBookingEnabled) return;
          if (!open && activeSections.length > 1 && !selectedSectionId) return;
          if (open) setServiceDialogSearch("");
          setServiceDialogOpen(open);
        }}
      >
        <DialogContent
          className="w-[min(360px,calc(100vw-20px))] max-w-none overflow-hidden rounded-[22px] border-[#263653] bg-[#080e1b] p-0 text-[#eef3ff] shadow-2xl shadow-black/45 [&>button]:hidden"
          dir={dir}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t("home.flow.servicesDialogTitle")}</DialogTitle>
            <DialogDescription>{t("home.flow.servicesDialogDescription")}</DialogDescription>
          </DialogHeader>

          <button
            type="button"
            onClick={() => setServiceDialogOpen(false)}
            className="absolute start-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[#2d3b57] bg-[#121c30] text-[#a8b4ce] transition hover:border-[#ffad24]/55 hover:text-[#f5f7ff]"
            aria-label={t("home.flow.close")}
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="flex max-h-[84vh] min-h-[520px] flex-col overflow-hidden">
            <div className="px-2.5 pt-2.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#ffad24]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ffad24] text-sm font-black text-[#06101f]">{formatValue.number(1)}</span>
                <span>{t("home.flow.servicesDialogTitle")}</span>
              </div>

              <div className="relative mt-2.5">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7786a5]" />
                <Input
                  value={serviceDialogSearch}
                  onChange={(event) => setServiceDialogSearch(event.target.value)}
                  placeholder={t("home.flow.searchService")}
                  className="h-11 rounded-xl border-[#253653] bg-[#0d1629] ps-9 text-start text-xs font-bold text-[#dfe7f8] placeholder:text-[#7584a1] focus-visible:ring-[#ffad24]/45"
                />
                <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#7584a1]">
                  {formatValue.number(filteredActiveSections.length)}
                </span>
              </div>
            </div>

            <div className="pretty-scrollbar flex-1 overflow-y-auto px-2.5 py-2.5">
              <div className="space-y-2">
                {filteredActiveSections.length === 0 ? (
                  <div className="rounded-xl border border-[#253653] bg-[#111a2d] px-4 py-4 text-center text-xs font-bold text-[#9ba8c3]">
                    {t("home.flow.noServices")}
                  </div>
                ) : filteredActiveSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleSectionSelect(section.id, "modal")}
                    className="flex min-h-[62px] w-full items-center gap-2.5 rounded-xl border border-[#253653] bg-[#111b31] px-2.5 py-2 text-start transition hover:border-[#ffad24]/70"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2a2931] text-base font-black text-[#ffad24]">
                      {section.name.trim().charAt(0) || "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-[#f5f7ff]">{section.name}</span>
                      <span className="mt-0.5 block truncate text-[10px] font-bold text-[#8f9bb7]">
                        {getServiceDurationDisplayText(section.durationDisplayText, section.slotDurationMinutes)}
                      </span>
                    </span>
                    <span className="h-7 w-7 shrink-0 rounded-full border border-[#43506b]" />
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#1f2c45] bg-[#0d1629] p-2.5">
              <Button
                type="button"
                disabled
                className="h-11 w-full rounded-xl bg-[#172541] text-xs font-black text-[#8391ad] opacity-100"
              >
                {t("home.flow.chooseService")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingChangeTarget} onOpenChange={(open) => !open && !changingTime && setPendingChangeTarget(null)}>
        <DialogContent className="change-time-confirm-dialog sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="change-time-confirm-title">{t("home.changeTime.confirmTitle")}</DialogTitle>
            <DialogDescription className="change-time-confirm-description leading-7">
              {t("home.changeTime.confirmDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="change-time-confirm-summary rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4 text-sm leading-8">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("home.changeTime.customer")}</span>
              <span className="change-time-confirm-value font-bold">{changeTimeAppointment?.userName || t("home.changeTime.unnamed")}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("home.changeTime.currentTime")}</span>
              <bdi className="change-time-confirm-value font-bold">{changeTimeAppointment?.startTime}</bdi>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("home.changeTime.newDay")}</span>
              <span className="change-time-confirm-new-value font-black text-cyan-200">
                {pendingChangeTarget ? formatValue.date(toSafeGregorianDate(pendingChangeTarget.date), {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }) : "-"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("home.changeTime.newTime")}</span>
              <bdi className="change-time-confirm-new-value font-black text-cyan-200">{pendingChangeTarget?.time}</bdi>
            </div>
          </div>

          <label className="change-time-confirm-sms flex cursor-pointer items-center gap-3 rounded-2xl border border-border/70 bg-card/55 p-3 text-sm leading-7">
            <Checkbox
              checked={sendChangeTimeSms}
              onCheckedChange={(checked) => setSendChangeTimeSms(Boolean(checked))}
              disabled={changingTime || !paymentSettings?.smsEnabled}
            />
            <span>
              {t("home.changeTime.sendSms")}
              {!paymentSettings?.smsEnabled ? (
                <span className="block text-xs text-muted-foreground">{t("home.changeTime.smsDisabled")}</span>
              ) : null}
            </span>
          </label>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="change-time-confirm-cancel" onClick={() => setPendingChangeTarget(null)} disabled={changingTime}>
              {t("common.cancel")}
            </Button>
            <Button type="button" className="change-time-confirm-submit" onClick={() => void confirmChangeTime()} disabled={changingTime}>
              {changingTime ? t("home.changeTime.transferring") : t("home.changeTime.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={handleLoginSuccess} />
      
      {bookingModal && selectedSection && (
        <BookingModal 
          isOpen={bookingModal.isOpen} 
          onClose={() => setBookingModal(null)} 
          section={selectedSection}
          date={currentDate}
          time={bookingModal.time}
          offQueueBooking={bookingModal.offQueue ?? false}
          vipOnlySlot={bookingModal.vipOnly ?? false}
          quickBlockAvailable={isPrimaryAdmin && currentDate >= todayDate && !bookingModal.offQueue}
          quickBlockedSlot={!!quickBlockedSlotFor(selectedSection, currentDate, bookingModal.time)}
          quickBlockCanApplyToAllSections={activeSections.filter((section) => section.barberId === selectedSection.barberId).length > 1}
          onQuickToggleSlot={(scope) => handleQuickToggleSlot(bookingModal.time, scope)}
        />
      )}
      <Dialog open={offQueueDialogOpen} onOpenChange={setOffQueueDialogOpen}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t("home.offQueue.title")}</DialogTitle>
            <DialogDescription className="leading-7">
              {t("home.offQueue.description", { service: selectedSection?.name || "" })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-card/45 p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("home.offQueue.selectedDate")}</span>
                <span className="font-bold text-foreground">{selectedDateLabel}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="off-queue-time" className="font-bold">{t("home.offQueue.startTime")}</Label>
                  <Input
                    id="off-queue-time"
                    type="time"
                    value={offQueueTime}
                    onChange={(event) => setOffQueueTime(event.target.value)}
                    className="h-12 rounded-2xl text-center text-lg [direction:ltr]"
                  />
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-center">
                  <div className="text-xs text-muted-foreground">{t("home.offQueue.approximateEnd")}</div>
                  <div className="mt-1 text-lg font-black text-primary" dir="ltr">
                    {offQueueEndTimeLabel || "--:--"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOffQueueDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="button" onClick={handleConfirmOffQueueTime}>
                {t("home.offQueue.continue")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ProfileNameDialog isOpen={profileNameDialogOpen} onClose={() => setProfileNameDialogOpen(false)} />

      {cancelModal && (
        <CancelModal 
          isOpen={cancelModal.isOpen} 
          onClose={() => setCancelModal(null)} 
          appointment={cancelModal.appointment}
          customerFinanceSummary={financeSummaries[cancelModal.appointment.userPhone] ?? null}
          onChangeTime={startChangeTimeMode}
          onFinanceChanged={() => refreshCustomerFinanceSummary(cancelModal.appointment.userPhone, cancelModal.appointment.barberId)}
        />
      )}

      {!isAdmin && !isBarber && (
        <MyAppointmentsModal isOpen={myAppointmentsOpen} onClose={() => setMyAppointmentsOpen(false)} />
      )}

    </div>
  );
}
