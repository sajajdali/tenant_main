import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
    Settings as SettingsIcon, Save, Plus, Trash2, ArrowRight, 
    Download, Gem, ShieldAlert, CalendarDays, BriefcaseBusiness, Ban, UserPlus, Users, Calendar, X, ChevronDown, Edit3, Volume2, ClipboardList, Clock3, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Appointment, Section, Barber, PaymentSettings, TenantMeta } from "@/lib/types";
import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { normalizePhoneInput } from "@/lib/normalize";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { subscribeAppointmentAvailability } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { PAYMENT_GATEWAYS } from "@/lib/payment-gateways";
import { getDefaultRegistrationRequirements, MEMBERSHIP_FIELD_DEFINITIONS, MembershipFieldKey } from "@/lib/membership";
import { APPOINTMENT_ALERT_SOUNDS, DEFAULT_APPOINTMENT_ALERT_SOUND, getAppointmentAlertSound } from "@/lib/appointment-alert-sounds";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import { COUNTRY_DEFINITIONS, LOCALE_DEFINITIONS, SELECTABLE_COUNTRIES, SELECTABLE_LOCALES } from "@/i18n/registry";
import { CodeText } from "@/i18n/ltr-text";

const WEEK_DAYS = [
    { labelKey: "settings.weekdays.short.saturday", value: 6 },
    { labelKey: "settings.weekdays.short.sunday", value: 0 },
    { labelKey: "settings.weekdays.short.monday", value: 1 },
    { labelKey: "settings.weekdays.short.tuesday", value: 2 },
    { labelKey: "settings.weekdays.short.wednesday", value: 3 },
    { labelKey: "settings.weekdays.short.thursday", value: 4 },
    { labelKey: "settings.weekdays.short.friday", value: 5 },
];

const toSafeGregorianDate = (date: string) => new Date(`${date}T12:00:00`);

const toGregorianDateString = (date: DateObject) =>
  format(date.toDate(), "yyyy-MM-dd");

const bySortOrder = <T extends { sortOrder?: number }>(items: T[]) =>
  [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

type SettingsTab = "barbers" | "payment" | "bulk";
type BarberBlockedTimeRange = NonNullable<Barber["blockedTimeRanges"]>[number];
type RestBreak = NonNullable<Section["restBreaks"]>[number];
type RestBreakScope = NonNullable<RestBreak["scope"]>;
type VipBreak = NonNullable<Section["vipBreaks"]>[number];
type VipBreakScope = NonNullable<VipBreak["scope"]>;
type ScheduleOverride = NonNullable<Section["scheduleOverrides"]>[number];
type ScheduleOverrideScope = ScheduleOverride["scope"];

const defaultRestBreakInput = (): RestBreak => ({
  start: "13:00",
  end: "14:00",
  scope: "all",
  weekdays: [],
  dates: [],
});

const normalizeRestBreak = (restBreak: RestBreak): RestBreak => ({
  start: restBreak.start,
  end: restBreak.end,
  scope: restBreak.scope ?? "all",
  weekdays: restBreak.scope === "weekdays" ? [...(restBreak.weekdays || [])].map(Number).sort((a, b) => a - b) : [],
  dates: restBreak.scope === "dates" ? [...(restBreak.dates || [])].sort() : [],
});

const sortRestBreaks = (items: RestBreak[]) =>
  items.map(normalizeRestBreak).sort((a, b) => `${a.start} ${a.end} ${a.scope}`.localeCompare(`${b.start} ${b.end} ${b.scope}`));

type SettingsTranslate = (key: MessageKey, params?: Record<string, string | number>) => string;
type SettingsDateFormatter = (value: Date | string | number | null | undefined) => string;

const describeScopedBreakScope = (item: RestBreak | VipBreak, t: SettingsTranslate, formatDate: SettingsDateFormatter) => {
  const scope = item.scope ?? "all";
  const weekdays = scope === "weekdays" ? [...(item.weekdays || [])].map(Number).sort((a, b) => a - b) : [];
  const dates = scope === "dates" ? [...(item.dates || [])].sort() : [];

  if (scope === "weekdays") {
    const labels = weekdays
      .map((day) => {
        const key = WEEK_DAYS.find((weekday) => weekday.value === day)?.labelKey;
        return key ? t(key as MessageKey) : null;
      })
      .filter(Boolean)
      .join(t("settings.schedule.listSeparator"));

    return labels
      ? t("settings.schedule.weekdaysWithLabels", { labels })
      : t("settings.schedule.weekdays");
  }

  if (scope === "dates") {
    const labels = dates.map(formatDate).join(t("settings.schedule.listSeparator"));

    return labels
      ? t("settings.schedule.datesWithLabels", { labels })
      : t("settings.schedule.specificDate");
  }

  return t("settings.schedule.allDays");
};

const defaultVipBreakInput = (): VipBreak => ({
  start: "10:00",
  end: "11:00",
  scope: "all",
  weekdays: [],
  dates: [],
});

const normalizeVipBreak = (vipBreak: VipBreak): VipBreak => ({
  start: vipBreak.start,
  end: vipBreak.end,
  scope: vipBreak.scope ?? "all",
  weekdays: vipBreak.scope === "weekdays" ? [...(vipBreak.weekdays || [])].map(Number).sort((a, b) => a - b) : [],
  dates: vipBreak.scope === "dates" ? [...(vipBreak.dates || [])].sort() : [],
});

const sortVipBreaks = (items: VipBreak[]) =>
  items.map(normalizeVipBreak).sort((a, b) => `${a.start} ${a.end} ${a.scope}`.localeCompare(`${b.start} ${b.end} ${b.scope}`));

const describeVipBreakScope = (vipBreak: VipBreak, t: SettingsTranslate, formatDate: SettingsDateFormatter) =>
  describeScopedBreakScope(normalizeVipBreak(vipBreak), t, formatDate);

const defaultScheduleOverrideInput = (): ScheduleOverride => ({
  scope: "weekdays",
  weekdays: [5],
  dates: [],
  startHour: "09:00",
  endHour: "11:00",
  slotDurationMinutes: 45,
});

const normalizeScheduleOverride = (override: ScheduleOverride): ScheduleOverride => ({
  scope: override.scope,
  weekdays: override.scope === "weekdays" ? [...(override.weekdays || [])].map(Number).sort((a, b) => a - b) : [],
  dates: override.scope === "dates" ? [...(override.dates || [])].sort() : [],
  startHour: override.startHour,
  endHour: override.endHour,
  slotDurationMinutes: Math.max(5, Number(override.slotDurationMinutes || 30)),
});

const sortScheduleOverrides = (items: ScheduleOverride[]) =>
  items
    .map(normalizeScheduleOverride)
    .sort((a, b) => `${a.scope} ${a.startHour} ${a.endHour}`.localeCompare(`${b.scope} ${b.startHour} ${b.endHour}`));

const describeScheduleOverrideScope = (override: ScheduleOverride, t: SettingsTranslate, formatDate: SettingsDateFormatter) => {
  const normalized = normalizeScheduleOverride(override);

  if (normalized.scope === "weekdays") {
    const labels = normalized.weekdays
      ?.map((day) => {
        const key = WEEK_DAYS.find((item) => item.value === day)?.labelKey;
        return key ? t(key as MessageKey) : null;
      })
      .filter(Boolean)
      .join(t("settings.schedule.listSeparator"));

    return labels
      ? t("settings.schedule.weekdaysWithLabels", { labels })
      : t("settings.schedule.weekdays");
  }

  const labels = normalized.dates?.map(formatDate).join(t("settings.schedule.listSeparator"));

  return labels
    ? t("settings.schedule.datesWithLabels", { labels })
    : t("settings.schedule.specificDate");
};

function SettingsSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { dir } = useLocale();

  return (
    <div className="relative">
      <select
        dir={dir}
        className={cn(
          "w-full appearance-none rounded-md border border-border bg-background p-2 pe-10 ps-3 text-start",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

type SettingsPageProps = {
  forcedTab?: SettingsTab;
};

export default function SettingsPage({ forcedTab }: SettingsPageProps) {
  const t = useT();
  const formatValue = useFormat();
  const { dir, locale } = useLocale();
  const localeOptions = SELECTABLE_LOCALES.map((locale) => LOCALE_DEFINITIONS[locale]);
  const countryOptions = SELECTABLE_COUNTRIES.map((country) => COUNTRY_DEFINITIONS[country]);
  const { 
      barbers,
      addBarber, updateBarber, deleteBarber, addSection, updateSection, deleteSection,
      bulkCancel
  } = useStore();
  const { isAdmin, isPrimaryAdmin, isBarber, user } = useAuth();
  const { toast } = useToast();
  const ownBarber = useMemo(
      () => (isBarber ? barbers.find((barber) => barber.userId === user?.id) ?? null : null),
      [barbers, isBarber, user?.id],
  );
  
  // State for adding new barber
  const [newBarberName, setNewBarberName] = useState("");
  const [newBarberMobile, setNewBarberMobile] = useState("");
  const [newBarberApiCode, setNewBarberApiCode] = useState("");
  const [newBarberSortOrder, setNewBarberSortOrder] = useState(10);
  const [limitUpgradeDialogOpen, setLimitUpgradeDialogOpen] = useState(false);
  const [limitUpgradeMessage, setLimitUpgradeMessage] = useState("");
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  const [editBarberName, setEditBarberName] = useState("");
  const [editBarberMobile, setEditBarberMobile] = useState("");
  const [editBarberApiCode, setEditBarberApiCode] = useState("");
  const [editBarberSortOrder, setEditBarberSortOrder] = useState(0);
  const [editBarberIsActive, setEditBarberIsActive] = useState(true);
  const [editBarberCanAccessPanel, setEditBarberCanAccessPanel] = useState(true);
  
  // State for barber availability
  const [selectedBarberForAvailability, setSelectedBarberForAvailability] = useState<string>("");
  const [activeRanges, setActiveRanges] = useState<{ start: string; end: string }[]>([]);
  const [disabledDates, setDisabledDates] = useState<DateObject[]>([]); // For specific off days
  const [blockedTimeRanges, setBlockedTimeRanges] = useState<BarberBlockedTimeRange[]>([]);
  const [newRangeStart, setNewRangeStart] = useState<DateObject | null>(null);
  const [newRangeEnd, setNewRangeEnd] = useState<DateObject | null>(null);
  const [newDisabledDate, setNewDisabledDate] = useState<DateObject | null>(null);
  const [newBlockedDate, setNewBlockedDate] = useState<DateObject | null>(null);
  const [newBlockedStart, setNewBlockedStart] = useState("15:00");
  const [newBlockedEnd, setNewBlockedEnd] = useState("16:00");
  const [newBlockedReason, setNewBlockedReason] = useState("");
  const [savingBlockedTime, setSavingBlockedTime] = useState(false);
  const [bookingLeadMode, setBookingLeadMode] = useState<"today" | "days">("today");
  const [bookingLeadHours, setBookingLeadHours] = useState(2);
  const [bookingLeadDays, setBookingLeadDays] = useState(1);
  const [bookingHorizonMode, setBookingHorizonMode] = useState<"days" | "date">("days");
  const [bookingMaxDays, setBookingMaxDays] = useState(30);
  const [bookingMaxDate, setBookingMaxDate] = useState<DateObject | null>(null);

  // Load barber availability when selected
  useEffect(() => {
      if (isBarber && ownBarber) {
          setSelectedBarberForAvailability(ownBarber.id);
      }
  }, [isBarber, ownBarber]);

  useEffect(() => {
      if (isBarber && ownBarber) {
          setSelectedBarberForEdit(ownBarber.id);
      }
  }, [isBarber, ownBarber]);

  useEffect(() => {
      if (isBarber && ownBarber) {
          setSelectedBulkBarberId(ownBarber.id);
      }
  }, [isBarber, ownBarber]);

  useEffect(() => {
      if (selectedBarberForAvailability) {
          const barber = barbers.find(b => b.id === selectedBarberForAvailability);
          if (barber) {
              setActiveRanges(barber.activeRanges || []);
              setBookingLeadMode(barber.bookingLeadMode || "today");
              setBookingLeadHours(barber.bookingLeadHours ?? 2);
              setBookingLeadDays(barber.bookingLeadDays ?? 1);
              setBookingHorizonMode(barber.bookingHorizonMode || "days");
              setBookingMaxDays(barber.bookingMaxDays ?? 30);
              setBookingMaxDate(
                  barber.bookingMaxDate
                      ? new DateObject({
                            date: toSafeGregorianDate(barber.bookingMaxDate),
                            calendar: persian,
                            locale: persian_fa,
                        })
                      : null,
              );
              // Convert string dates to DateObjects for the picker
              if (barber.disabledDates) {
                  setDisabledDates(
                      barber.disabledDates.map(
                          (date) =>
                              new DateObject({
                                  date: toSafeGregorianDate(date),
                                  calendar: persian,
                                  locale: persian_fa,
                              }),
                      ),
                  );
              } else {
                  setDisabledDates([]);
              }
              setBlockedTimeRanges(
                  [...(barber.blockedTimeRanges || [])].sort((a, b) =>
                      `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)
                  ),
              );
          }
      } else {
          setActiveRanges([]);
          setDisabledDates([]);
          setBlockedTimeRanges([]);
          setBookingLeadMode("today");
          setBookingLeadHours(2);
          setBookingLeadDays(1);
          setBookingHorizonMode("days");
          setBookingMaxDays(30);
          setBookingMaxDate(null);
      }
      setNewRangeStart(null);
      setNewRangeEnd(null);
      setNewBlockedDate(null);
  }, [selectedBarberForAvailability, barbers]);

  // State for sections management
  const [selectedBarberForEdit, setSelectedBarberForEdit] = useState<string>("");
  const [sectionsForEdit, setSectionsForEdit] = useState<Section[]>([]);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionData, setNewSectionData] = useState<Partial<Section>>({
      name: "",
      sortOrder: 10,
      startHour: "09:00",
      endHour: "21:00",
      restBreaks: [],
      vipBreaks: [],
      scheduleOverrides: [],
      slotDurationMinutes: 30,
      durationDisplayText: null,
      price: 0,
      checkConflicts: true,
      workDays: [0, 1, 2, 3, 4, 6] // Default all except Friday
  });
  const [sectionBreakInputs, setSectionBreakInputs] = useState<Record<string, RestBreak>>({});
  const [sectionVipInputs, setSectionVipInputs] = useState<Record<string, VipBreak>>({});
  const [sectionScheduleInputs, setSectionScheduleInputs] = useState<Record<string, ScheduleOverride>>({});
  const [newSectionBreakInput, setNewSectionBreakInput] = useState<RestBreak>(defaultRestBreakInput());
  const [newSectionVipInput, setNewSectionVipInput] = useState<VipBreak>(defaultVipBreakInput());
  const [newSectionScheduleInput, setNewSectionScheduleInput] = useState<ScheduleOverride>(defaultScheduleOverrideInput());
  const [durationDisplayDialog, setDurationDisplayDialog] = useState<{
      sectionId: string | null;
      sectionName: string;
      value: string;
  } | null>(null);
  const [savingDurationDisplayText, setSavingDurationDisplayText] = useState(false);
  
  // Bulk Cancel
  const [selectedBulkBarberId, setSelectedBulkBarberId] = useState("");
  const [selectedBulkDate, setSelectedBulkDate] = useState<DateObject | null>(null);
  const [bulkAppointments, setBulkAppointments] = useState<Appointment[]>([]);
  const [bulkAppointmentIds, setBulkAppointmentIds] = useState<string[]>([]);
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [sendBulkSms, setSendBulkSms] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkAppointmentsLoading, setBulkAppointmentsLoading] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
      enabled: false,
      locale: "fa",
      country: "IR",
      provider: null,
      sandboxEnabled: false,
      cafebazaarEnabled: false,
      cafebazaarPublicKey: "",
      enabledGateways: [],
      gateways: Object.fromEntries(
          PAYMENT_GATEWAYS.map((gateway) => [gateway.key, { enabled: false }]),
      ) as PaymentSettings["gateways"],
      enamadCode: "",
      siteAnnouncementEnabled: false,
      siteAnnouncementText: "",
      bookingClosedEnabled: false,
      bookingClosedText: "",
      appointmentBookingDisabled: false,
      offQueueBookingEnabled: true,
      serviceFirstBookingEnabled: false,
      customerMobileConfirmationEnabled: false,
      showCountryPrefixInAuthenticationForm: false,
      hourlyBookingLimit: 4,
      customerCancellationCutoffHours: 2,
      appointmentAlertSound: DEFAULT_APPOINTMENT_ALERT_SOUND,
      androidAppSettingsEnabled: false,
      androidAppVersion: "",
      androidWebAppUrl: "",
      androidPaymentReturnUrl: "",
      registrationRequirements: getDefaultRegistrationRequirements(),
      smsEnabled: false,
      smsProvider: null,
      smsApiKey: "",
      smsTemplateAdminBooking: "",
      smsTemplateUserBooking: "",
      smsTemplateCancellation: "",
      smsTemplateReminder: "",
      preferNutritionLandingAsDefault: false,
      activeNutritionLandingVariant: "classic",
  });
  const pageDir = forcedTab === "payment"
      ? LOCALE_DEFINITIONS[locale].dir
      : dir;
  const isRtl = pageDir === "rtl";
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [enamadFileLoading, setEnamadFileLoading] = useState(false);
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const labels = getAudienceLabels(tenantMeta);
  const vipFeatureActive =
      tenantMeta?.activeFeatureModules?.some((item) => item.slug === "vip-customers") ?? false;
  const nutritionAudienceSlug = tenantMeta?.audience?.slug || "";
  const isNutritionAudience = ["nutritionists", "nutrition-doctors"].includes(nutritionAudienceSlug);
  const requestedTab =
      forcedTab ||
      (typeof window !== "undefined"
          ? (() => {
                const path = window.location.pathname;
                if (path === "/panel/barbers" || path === "/panel/professionals") return "barbers";
                if (path === "/panel/general") return "payment";
                if (path === "/panel/bulk") return "bulk";
                const tab = new URLSearchParams(window.location.search).get("tab");
                return tab === "barbers" || tab === "payment" || tab === "bulk" ? tab : null;
            })()
          : null);
  const singleTabMode = !!forcedTab || requestedTab === "barbers" || requestedTab === "payment" || requestedTab === "bulk";
  const allowedInitialTab =
      requestedTab === "payment" && !isPrimaryAdmin
          ? "barbers"
          : requestedTab === "bulk" || requestedTab === "payment" || requestedTab === "barbers"
            ? requestedTab
            : "barbers";
  const [activeTab, setActiveTab] = useState<SettingsTab>(allowedInitialTab as SettingsTab);

  useEffect(() => {
      setActiveTab(allowedInitialTab as SettingsTab);
  }, [allowedInitialTab]);

  // Fetch sections when selected barber changes
  useEffect(() => {
      if(selectedBarberForEdit) {
          api.sections.list(selectedBarberForEdit).then(res => {
              if(res.success) {
                  setSectionsForEdit(res.data);
                  setNewSectionData((current) => ({
                      ...current,
                      sortOrder: ((res.data.at(-1)?.sortOrder ?? 0) + 10),
                  }));
                  setSectionBreakInputs((current) =>
                      Object.fromEntries(
                          res.data.map((section) => [
                              section.id,
                              current[section.id] || { start: "13:00", end: "14:00" },
                          ]),
                      ),
                  );
                  setSectionVipInputs((current) =>
                      Object.fromEntries(
                          res.data.map((section) => [
                              section.id,
                              current[section.id] || defaultVipBreakInput(),
                          ]),
                      ),
                  );
                  setSectionScheduleInputs((current) =>
                      Object.fromEntries(
                          res.data.map((section) => [
                              section.id,
                              current[section.id] || defaultScheduleOverrideInput(),
                          ]),
                      ),
                  );
              }
          });
      } else {
          setSectionsForEdit([]);
          setIsAddingSection(false);
      }
  }, [selectedBarberForEdit]);

  useEffect(() => {
      api.sections.list().then((res) => {
          if (res.success) setAllSections(res.data);
      });
  }, []);

  useEffect(() => {
      api.meta.get().then((res) => {
          if (res.success) setTenantMeta(res.data);
      });
  }, []);

  useEffect(() => {
      api.payment.getSettings().then((res) => {
          if (res.success) setPaymentSettings(res.data);
      });
  }, []);

  useEffect(() => {
      if (!selectedBulkBarberId || !selectedBulkDate) {
          setBulkAppointments([]);
          setBulkAppointmentIds([]);
          return;
      }

      const selectedDate = toGregorianDateString(selectedBulkDate);
      setBulkAppointmentsLoading(true);

      api.appointments.listByDate(selectedDate, selectedBulkBarberId).then((res) => {
          if (res.success) {
              setBulkAppointments(res.data);
              setBulkAppointmentIds(res.data.map((appointment) => appointment.id));
          }
          setBulkAppointmentsLoading(false);
      });
  }, [selectedBulkDate, selectedBulkBarberId]);

  useEffect(() => {
      if (!selectedBulkBarberId || !selectedBulkDate) return;

      const selectedDate = toGregorianDateString(selectedBulkDate);

      return subscribeAppointmentAvailability(selectedDate, selectedBulkBarberId, () => {
          api.appointments.listByDate(selectedDate, selectedBulkBarberId).then((res) => {
              if (!res.success) return;

              setBulkAppointments(res.data);
              setBulkAppointmentIds((prev) =>
                  prev.filter((id) => res.data.some((appointment) => appointment.id === id)),
              );
          });
      });
  }, [selectedBulkBarberId, selectedBulkDate]);

  // Update local sections if update happened
  // This is a bit tricky with local state + store state. 
  // Ideally sectionsForEdit should be derived or fetched. 
  // We rely on the fetch in useEffect above.
  
  // Handlers
  const handleAddBarber = async () => {
      if(!newBarberName || !newBarberMobile) return;
      const result = await addBarber(
          newBarberName,
          newBarberMobile,
          newBarberSortOrder,
          paymentSettings.apiCodeEnabled ? newBarberApiCode.trim() : undefined,
      );
      if (!result.success) {
          const message = result.message || t("settings.barberManagement.addFailed");
          const isPlanLimitError =
              message.includes(t("settings.limitUpgrade.match.account")) ||
              message.includes(t("settings.limitUpgrade.match.add")) ||
              message.includes(t("settings.limitUpgrade.match.upgrade"));

          if (isPlanLimitError) {
              setLimitUpgradeMessage(message);
              setLimitUpgradeDialogOpen(true);
              return;
          }

          toast({ variant: "destructive", title: t("common.error"), description: message });
          return;
      }
      setNewBarberName("");
      setNewBarberMobile("");
      setNewBarberApiCode("");
      setNewBarberSortOrder((barbers.length + 2) * 10);
  }

  const openBarberEditDialog = (barber: Barber) => {
      setEditingBarber(barber);
      setEditBarberName(barber.name);
      setEditBarberMobile(barber.mobile || "");
      setEditBarberApiCode(barber.apiCode || "");
      setEditBarberSortOrder(barber.sortOrder ?? 0);
      setEditBarberIsActive(barber.isActive);
      setEditBarberCanAccessPanel(barber.canAccessPanel ?? true);
  };

  const handleSaveBarberEdit = async () => {
      if (!editingBarber || editBarberName.trim().length < 2 || editBarberMobile.trim().length !== 11) return;

      const success = await updateBarber({
          ...editingBarber,
          name: editBarberName.trim(),
          mobile: editBarberMobile.trim(),
          apiCode: paymentSettings.apiCodeEnabled ? (editBarberApiCode.trim() || null) : null,
          sortOrder: editBarberSortOrder,
          isActive: editBarberIsActive,
          canAccessPanel: editBarberCanAccessPanel,
      });

      if (success) {
          setEditingBarber(null);
      }
  };
  
  const handleAddAvailabilityRange = async () => {
      if (!selectedBarberForAvailability || !newRangeStart || !newRangeEnd) return;
      
      const start = toGregorianDateString(newRangeStart);
      const end = toGregorianDateString(newRangeEnd);
      
      if (start > end) {
          toast({
              variant: "destructive",
              title: t("settings.availability.invalidRangeTitle"),
              description: t("settings.availability.invalidRangeDescription"),
          });
          return;
      }

      const barber = barbers.find(b => b.id === selectedBarberForAvailability);
      if (!barber) return;

      const updatedRanges = [...(barber.activeRanges || []), { start, end }];
      
      await updateBarber({
          ...barber,
          activeRanges: updatedRanges
      });
      
      setNewRangeStart(null);
      setNewRangeEnd(null);
  }

  const handleDeleteAvailabilityRange = async (index: number) => {
      if (!selectedBarberForAvailability) return;
      const barber = barbers.find(b => b.id === selectedBarberForAvailability);
      if (!barber) return;

      const updatedRanges = [...(barber.activeRanges || [])];
      updatedRanges.splice(index, 1);

      await updateBarber({
          ...barber,
          activeRanges: updatedRanges
      });
  }

  const handleSaveBookingLeadSettings = async () => {
      if (!selectedBarberForAvailability) return;

      const barber = barbers.find((item) => item.id === selectedBarberForAvailability);
      if (!barber) return;

      await updateBarber({
          ...barber,
          bookingLeadMode,
          bookingLeadHours: bookingLeadMode === "today" ? Math.max(bookingLeadHours, 0) : barber.bookingLeadHours ?? 2,
          bookingLeadDays: bookingLeadMode === "days" ? Math.max(bookingLeadDays, 1) : barber.bookingLeadDays ?? 1,
          bookingHorizonMode,
          bookingMaxDays: bookingHorizonMode === "days" ? Math.max(bookingMaxDays, 0) : barber.bookingMaxDays ?? 30,
          bookingMaxDate: bookingHorizonMode === "date" && bookingMaxDate ? toGregorianDateString(bookingMaxDate) : "",
      });
  }

  const handleAddDisabledDate = async () => {
      if (!newDisabledDate || !selectedBarberForAvailability) return;
      
      // Check if already exists
      const dateStr = toGregorianDateString(newDisabledDate);
      const exists = disabledDates.some(d => toGregorianDateString(d) === dateStr);
      
      if (exists) {
          toast({ title: t("settings.availability.duplicateDisabledDateTitle") });
          return;
      }
      
      const updatedDates = [...disabledDates, newDisabledDate];
      setDisabledDates(updatedDates); // Optimistic
      setNewDisabledDate(null);

      const barber = barbers.find(b => b.id === selectedBarberForAvailability);
      if (!barber) return;

      await updateBarber({
          ...barber,
          disabledDates: updatedDates.map(toGregorianDateString)
      });
  }

  const handleRemoveDisabledDate = async (index: number) => {
      if (!selectedBarberForAvailability) return;
      
      const updatedDates = [...disabledDates];
      updatedDates.splice(index, 1);
      setDisabledDates(updatedDates); // Optimistic

      const barber = barbers.find(b => b.id === selectedBarberForAvailability);
      if (!barber) return;

      await updateBarber({
          ...barber,
          disabledDates: updatedDates.map(toGregorianDateString)
      });
  }

  const handleAddBlockedTimeRange = async () => {
      if (!newBlockedDate || !selectedBarberForAvailability || savingBlockedTime) return;

      const date = toGregorianDateString(newBlockedDate);
      const today = format(new Date(), "yyyy-MM-dd");

      if (date < today) {
          toast({
              variant: "destructive",
              title: t("settings.blockedTime.pastDateTitle"),
              description: t("settings.blockedTime.pastDateDescription"),
          });
          return;
      }

      if (!newBlockedStart || !newBlockedEnd || newBlockedStart >= newBlockedEnd) {
          toast({
              variant: "destructive",
              title: t("settings.blockedTime.invalidWindowTitle"),
              description: t("settings.blockedTime.invalidWindowDescription"),
          });
          return;
      }

      const overlapsExistingBlock = blockedTimeRanges.some((range) =>
          range.date === date && newBlockedStart < range.end && newBlockedEnd > range.start
      );

      if (overlapsExistingBlock) {
          toast({
              variant: "destructive",
              title: t("settings.blockedTime.duplicateTitle"),
              description: t("settings.blockedTime.duplicateDescription"),
          });
          return;
      }

      setSavingBlockedTime(true);
      const appointmentsResponse = await api.appointments.list(date, selectedBarberForAvailability);

      if (!appointmentsResponse.success) {
          setSavingBlockedTime(false);
          toast({
              variant: "destructive",
              title: t("settings.blockedTime.appointmentCheckFailedTitle"),
              description: appointmentsResponse.message || t("settings.blockedTime.appointmentCheckFailedDescription"),
          });
          return;
      }

      const overlappingAppointments = appointmentsResponse.data.filter((appointment) =>
          appointment.status !== "cancelled" &&
          appointment.startTime < newBlockedEnd &&
          appointment.endTime > newBlockedStart
      );

      if (
          overlappingAppointments.length > 0 &&
          !window.confirm(
              t("settings.blockedTime.overlapConfirm", { count: formatValue.number(overlappingAppointments.length) }),
          )
      ) {
          setSavingBlockedTime(false);
          return;
      }

      const barber = barbers.find((item) => item.id === selectedBarberForAvailability);
      if (!barber) {
          setSavingBlockedTime(false);
          return;
      }

      const newRange: BarberBlockedTimeRange = {
          id: typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          date,
          start: newBlockedStart,
          end: newBlockedEnd,
          reason: newBlockedReason.trim(),
      };
      const nextRanges = [...blockedTimeRanges, newRange].sort((a, b) =>
          `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)
      );
      const success = await updateBarber({ ...barber, blockedTimeRanges: nextRanges });
      setSavingBlockedTime(false);

      if (success) {
          setBlockedTimeRanges(nextRanges);
          setNewBlockedDate(null);
          setNewBlockedReason("");
          toast({
              title: t("settings.blockedTime.savedTitle"),
              description: overlappingAppointments.length > 0
                  ? t("settings.blockedTime.savedDescriptionWithOverlaps")
                  : t("settings.blockedTime.savedDescriptionNoOverlaps", { professional: labels.singular }),
          });
      }
  };

  const handleRemoveBlockedTimeRange = async (rangeId: string) => {
      if (!selectedBarberForAvailability || savingBlockedTime) return;

      const barber = barbers.find((item) => item.id === selectedBarberForAvailability);
      if (!barber) return;

      const nextRanges = blockedTimeRanges.filter((range) => range.id !== rangeId);
      setSavingBlockedTime(true);
      const success = await updateBarber({ ...barber, blockedTimeRanges: nextRanges });
      setSavingBlockedTime(false);

      if (success) {
          setBlockedTimeRanges(nextRanges);
      }
  };
  
  const handleBulkCancel = async () => {
     if (!selectedBulkBarberId || !selectedBulkDate || bulkAppointmentIds.length === 0) return;
     setBulkLoading(true);

     const selectedDate = toGregorianDateString(selectedBulkDate);

     if(confirm(t("settings.bulkCancel.confirm", { count: formatValue.number(bulkAppointmentIds.length) }))) {
         const success = await bulkCancel(bulkAppointmentIds, sendBulkSms);

         if (success) {
             const res = await api.appointments.listByDate(selectedDate, selectedBulkBarberId);
             if (res.success) {
                 setBulkAppointments(res.data);
                 setBulkAppointmentIds(res.data.map((appointment) => appointment.id));
             }
         }
     }
     setBulkLoading(false);
  };

  const toggleBulkAppointment = (appointmentId: string, checked: boolean) => {
      setBulkAppointmentIds((currentIds) =>
          checked
              ? [...currentIds, appointmentId]
              : currentIds.filter((id) => id !== appointmentId),
      );
  };

  const getBarberName = (barberId: string) =>
      barbers.find((barber) => barber.id === barberId)?.name || labels.singular;

  const getSectionName = (sectionId: string) =>
      allSections.find((section) => section.id === sectionId)?.name || t("settings.bulkCancel.serviceFallback");

  const handleDeleteBarber = async (id: string) => {
      if(confirm(t("settings.barberManagement.deleteConfirm", { professional: labels.singular }))) {
          await deleteBarber(id);
          if(selectedBarberForEdit === id && barbers.length > 0) {
              setSelectedBarberForEdit(barbers[0].id);
          }
      }
  }

  const handleAddSection = async () => {
      const sectionName = (newSectionData.name || "").trim();

      if(!sectionName) {
          toast({
              variant: "destructive",
              title: t("settings.sections.nameRequiredTitle"),
              description: t("settings.sections.nameRequiredDescription"),
          });
          return;
      }

      if(!selectedBarberForEdit) return;
      
      const success = await addSection({
          ...newSectionData,
          name: sectionName,
          barberId: selectedBarberForEdit
      });

      if (!success) return;
      
      // Refresh local list
      const res = await api.sections.list(selectedBarberForEdit);
      if(res.success) setSectionsForEdit(res.data);
      
      setIsAddingSection(false);
      setNewSectionData({
          name: "",
          sortOrder: (sectionsForEdit.length + 2) * 10,
          startHour: "09:00",
          endHour: "21:00",
          restBreaks: [],
          vipBreaks: [],
          scheduleOverrides: [],
          slotDurationMinutes: 30,
          durationDisplayText: null,
          price: 0,
          checkConflicts: true,
          workDays: [0, 1, 2, 3, 4, 6]
      });
      setNewSectionBreakInput(defaultRestBreakInput());
      setNewSectionVipInput(defaultVipBreakInput());
      setNewSectionScheduleInput(defaultScheduleOverrideInput());
  }

  const handleUpdateSection = async (updatedSection: Section) => {
      const previousSections = sectionsForEdit;

      setSectionsForEdit((prev) => bySortOrder(prev.map((section) => section.id === updatedSection.id ? updatedSection : section)));

      const success = await updateSection(updatedSection);

      if (!success) {
          setSectionsForEdit(previousSections);

          if (selectedBarberForEdit) {
              const res = await api.sections.list(selectedBarberForEdit);
              if (res.success) setSectionsForEdit(res.data);
          }
      }

      return success;
  }

  const openDurationDisplayDialog = (section?: Section) => {
      setDurationDisplayDialog({
          sectionId: section?.id ?? null,
          sectionName: section?.name || newSectionData.name?.trim() || t("settings.sections.newSectionFallback"),
          value: section?.durationDisplayText || newSectionData.durationDisplayText || "",
      });
  };

  const handleSaveDurationDisplayText = async (useAutomatic = false) => {
      if (!durationDisplayDialog) return;

      const durationDisplayText = useAutomatic ? null : (durationDisplayDialog.value.trim() || null);

      if (!durationDisplayDialog.sectionId) {
          setNewSectionData((current) => ({ ...current, durationDisplayText }));
          setDurationDisplayDialog(null);
          return;
      }

      const section = sectionsForEdit.find((item) => item.id === durationDisplayDialog.sectionId);
      if (!section) {
          setDurationDisplayDialog(null);
          return;
      }

      setSavingDurationDisplayText(true);
      const success = await handleUpdateSection({ ...section, durationDisplayText });
      setSavingDurationDisplayText(false);

      if (success) {
          setDurationDisplayDialog(null);
      }
  };

  const handleDeleteSection = async (id: string) => {
      if(confirm(t("settings.sections.deleteConfirm"))) {
          // Optimistic update
          setSectionsForEdit(prev => prev.filter(s => s.id !== id));
          
          await deleteSection(id);
          // Refresh local list
          const res = await api.sections.list(selectedBarberForEdit);
          if(res.success) setSectionsForEdit(res.data);
      }
  }

  const isValidTimeWindow = (start: string, end: string, sectionStart: string, sectionEnd: string) => {
      if (!start || !end) return false;
      if (start >= end) return false;
      if (start < sectionStart || end > sectionEnd) return false;
      return true;
  };

  const setSectionRestBreakInput = (sectionId: string, updater: (current: RestBreak) => RestBreak) => {
      setSectionBreakInputs((current) => ({
          ...current,
          [sectionId]: normalizeRestBreak(updater(current[sectionId] || defaultRestBreakInput())),
      }));
  };

  const updateRestBreakScope = (restBreak: RestBreak, scope: RestBreakScope): RestBreak => ({
      ...restBreak,
      scope,
      weekdays: scope === "weekdays" ? (restBreak.weekdays?.length ? restBreak.weekdays : [5]) : [],
      dates: scope === "dates" ? (restBreak.dates || []) : [],
  });

  const validateRestBreakInput = (input: RestBreak) => {
      const normalized = normalizeRestBreak(input);

      if (!isValidTimeWindow(normalized.start, normalized.end, "00:00", "23:59")) {
          toast({
              variant: "destructive",
              title: t("settings.schedule.rest.invalidWindowTitle"),
              description: t("settings.schedule.rest.invalidWindowDescription"),
          });
          return null;
      }

      if (normalized.scope === "weekdays" && !normalized.weekdays?.length) {
          toast({
              variant: "destructive",
              title: t("settings.schedule.rest.weekdayRequiredTitle"),
              description: t("settings.schedule.rest.weekdayRequiredDescription"),
          });
          return null;
      }

      if (normalized.scope === "dates" && !normalized.dates?.length) {
          toast({
              variant: "destructive",
              title: t("settings.schedule.rest.dateRequiredTitle"),
              description: t("settings.schedule.rest.dateRequiredDescription"),
          });
          return null;
      }

      return normalized;
  };

  const toggleRestBreakWeekday = (restBreak: RestBreak, day: number, checked: boolean): RestBreak => {
      const weekdays = new Set((restBreak.weekdays || []).map(Number));
      if (checked) {
          weekdays.add(day);
      } else {
          weekdays.delete(day);
      }

      return { ...restBreak, weekdays: Array.from(weekdays).sort((a, b) => a - b) };
  };

  const addRestBreakDate = (restBreak: RestBreak, date: DateObject | null): RestBreak => {
      if (!date) return restBreak;

      const value = toGregorianDateString(date);
      const dates = new Set(restBreak.dates || []);
      dates.add(value);

      return { ...restBreak, dates: Array.from(dates).sort() };
  };

  const removeRestBreakDate = (restBreak: RestBreak, date: string): RestBreak => ({
      ...restBreak,
      dates: (restBreak.dates || []).filter((item) => item !== date),
  });

  const renderRestBreakScopeControls = (input: RestBreak, onChange: (next: RestBreak) => void) => (
      <div dir={dir} className="space-y-3 rounded-md border border-amber-500/15 bg-background/40 p-3 text-start">
          <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_1fr]">
              <div className="space-y-1">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.dayType")}</Label>
                  <SettingsSelect
                      value={input.scope ?? "all"}
                      onChange={(e) => onChange(updateRestBreakScope(input, e.target.value as RestBreakScope))}
                  >
                      <option value="all">{t("settings.schedule.allDays")}</option>
                      <option value="weekdays">{t("settings.schedule.weekdays")}</option>
                      <option value="dates">{t("settings.schedule.specificDate")}</option>
                  </SettingsSelect>
              </div>
              <div className="space-y-1">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.restStart")}</Label>
                  <Input
                      type="time"
                      value={input.start}
                      className="text-start [direction:ltr]"
                      onChange={(e) => onChange({ ...input, start: e.target.value })}
                  />
              </div>
              <div className="space-y-1">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.restEnd")}</Label>
                  <Input
                      type="time"
                      value={input.end}
                      className="text-start [direction:ltr]"
                      onChange={(e) => onChange({ ...input, end: e.target.value })}
                  />
              </div>
          </div>

          {(input.scope ?? "all") === "weekdays" && (
              <div className="space-y-1">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.weekdays")}</Label>
                  <div dir={dir} className="grid grid-cols-7 gap-1.5">
                      {WEEK_DAYS.map((day) => {
                          const checked = (input.weekdays || []).includes(day.value);

                          return (
                              <label
                                  key={`rest-weekday-${day.value}`}
                                  className={cn(
                                      "flex h-9 cursor-pointer items-center justify-center rounded-md border text-xs font-bold transition-colors",
                                      checked
                                          ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
                                          : "border-border bg-background text-muted-foreground hover:bg-muted",
                                  )}
                              >
                                  <Checkbox
                                      checked={checked}
                                      onCheckedChange={(value) => onChange(toggleRestBreakWeekday(input, day.value, !!value))}
                                      className="sr-only"
                                  />
                                  {t(day.labelKey as MessageKey)}
                              </label>
                          );
                      })}
                  </div>
              </div>
          )}

          {(input.scope ?? "all") === "dates" && (
              <div className="space-y-2">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.restDates")}</Label>
                  <DatePicker
                      value={null}
                      onChange={(date) => onChange(addRestBreakDate(input, Array.isArray(date) ? date[0] ?? null : date))}
                      minDate={new Date()}
                      onOpenPickNewDate={false}
                      editable={false}
                      inputMode="none"
                      calendar={persian}
                      locale={persian_fa}
                      placeholder={t("settings.schedule.addRestDate")}
                      inputClass="h-10 w-full rounded-md border border-border bg-background px-3 text-center text-sm"
                      containerStyle={{ width: "100%" }}
                  />
                  {!!input.dates?.length && (
                      <div className="flex flex-wrap justify-start gap-1.5">
                          {input.dates.map((date) => (
                              <button
                                  type="button"
                                  key={date}
                                  className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs text-amber-100"
                                  onClick={() => onChange(removeRestBreakDate(input, date))}
                              >
                                  <X className="h-3 w-3" />
                                  {formatValue.date(date)}
                              </button>
                          ))}
                      </div>
                  )}
              </div>
          )}
      </div>
  );

  const renderRestBreakSummary = (restBreak: RestBreak) => (
      <div className="min-w-0 text-start" dir={dir}>
          <span className="flex flex-wrap items-center justify-start gap-2 font-mono">
              <Clock3 className="h-3.5 w-3.5 shrink-0 text-amber-200" />
              <bdi>{restBreak.start}</bdi> {t("settings.schedule.until")} <bdi>{restBreak.end}</bdi>
          </span>
          <div className="mt-1 text-xs text-amber-100/80">{describeScopedBreakScope(normalizeRestBreak(restBreak), t, formatValue.date)}</div>
      </div>
  );

  const setSectionVipInput = (sectionId: string, updater: (current: VipBreak) => VipBreak) => {
      setSectionVipInputs((current) => ({
          ...current,
          [sectionId]: normalizeVipBreak(updater(current[sectionId] || defaultVipBreakInput())),
      }));
  };

  const updateVipBreakScope = (vipBreak: VipBreak, scope: VipBreakScope): VipBreak => ({
      ...vipBreak,
      scope,
      weekdays: scope === "weekdays" ? (vipBreak.weekdays?.length ? vipBreak.weekdays : [5]) : [],
      dates: scope === "dates" ? (vipBreak.dates || []) : [],
  });

  const validateVipBreakInput = (input: VipBreak, sectionStart: string, sectionEnd: string) => {
      const normalized = normalizeVipBreak(input);

      if (!isValidTimeWindow(normalized.start, normalized.end, sectionStart, sectionEnd)) {
          toast({
              variant: "destructive",
              title: t("settings.schedule.vip.invalidWindowTitle"),
              description: t("settings.schedule.vip.invalidWindowDescription"),
          });
          return null;
      }

      if (normalized.scope === "weekdays" && !normalized.weekdays?.length) {
          toast({
              variant: "destructive",
              title: t("settings.schedule.vip.weekdayRequiredTitle"),
              description: t("settings.schedule.vip.weekdayRequiredDescription"),
          });
          return null;
      }

      if (normalized.scope === "dates" && !normalized.dates?.length) {
          toast({
              variant: "destructive",
              title: t("settings.schedule.vip.dateRequiredTitle"),
              description: t("settings.schedule.vip.dateRequiredDescription"),
          });
          return null;
      }

      return normalized;
  };

  const toggleVipBreakWeekday = (vipBreak: VipBreak, day: number, checked: boolean): VipBreak => {
      const weekdays = new Set((vipBreak.weekdays || []).map(Number));
      if (checked) {
          weekdays.add(day);
      } else {
          weekdays.delete(day);
      }

      return { ...vipBreak, weekdays: Array.from(weekdays).sort((a, b) => a - b) };
  };

  const addVipBreakDate = (vipBreak: VipBreak, date: DateObject | null): VipBreak => {
      if (!date) return vipBreak;

      const value = toGregorianDateString(date);
      const dates = new Set(vipBreak.dates || []);
      dates.add(value);

      return { ...vipBreak, dates: Array.from(dates).sort() };
  };

  const removeVipBreakDate = (vipBreak: VipBreak, date: string): VipBreak => ({
      ...vipBreak,
      dates: (vipBreak.dates || []).filter((item) => item !== date),
  });

  const renderVipBreakScopeControls = (input: VipBreak, onChange: (next: VipBreak) => void) => (
      <div dir={dir} className="space-y-3 rounded-md border border-cyan-500/15 bg-background/40 p-3 text-start">
          <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_1fr]">
              <div className="space-y-1">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.dayType")}</Label>
                  <SettingsSelect
                      value={input.scope ?? "all"}
                      onChange={(e) => onChange(updateVipBreakScope(input, e.target.value as VipBreakScope))}
                  >
                      <option value="all">{t("settings.schedule.allDays")}</option>
                      <option value="weekdays">{t("settings.schedule.weekdays")}</option>
                      <option value="dates">{t("settings.schedule.specificDate")}</option>
                  </SettingsSelect>
              </div>
              <div className="space-y-1">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.vipStart")}</Label>
                  <Input
                      type="time"
                      value={input.start}
                      className="text-start [direction:ltr]"
                      onChange={(e) => onChange({ ...input, start: e.target.value })}
                  />
              </div>
              <div className="space-y-1">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.vipEnd")}</Label>
                  <Input
                      type="time"
                      value={input.end}
                      className="text-start [direction:ltr]"
                      onChange={(e) => onChange({ ...input, end: e.target.value })}
                  />
              </div>
          </div>

          {(input.scope ?? "all") === "weekdays" && (
              <div className="space-y-1">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.weekdays")}</Label>
                  <div dir={dir} className="grid grid-cols-7 gap-1.5">
                      {WEEK_DAYS.map((day) => {
                          const checked = (input.weekdays || []).includes(day.value);

                          return (
                              <label
                                  key={`vip-weekday-${day.value}`}
                                  className={cn(
                                      "flex h-9 cursor-pointer items-center justify-center rounded-md border text-xs font-bold transition-colors",
                                      checked
                                          ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                                          : "border-border bg-background text-muted-foreground hover:bg-muted",
                                  )}
                              >
                                  <Checkbox
                                      checked={checked}
                                      onCheckedChange={(value) => onChange(toggleVipBreakWeekday(input, day.value, !!value))}
                                      className="sr-only"
                                  />
                                  {t(day.labelKey as MessageKey)}
                              </label>
                          );
                      })}
                  </div>
              </div>
          )}

          {(input.scope ?? "all") === "dates" && (
              <div className="space-y-2">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.vipDates")}</Label>
                  <DatePicker
                      value={null}
                      onChange={(date) => onChange(addVipBreakDate(input, Array.isArray(date) ? date[0] ?? null : date))}
                      minDate={new Date()}
                      onOpenPickNewDate={false}
                      editable={false}
                      inputMode="none"
                      calendar={persian}
                      locale={persian_fa}
                      placeholder={t("settings.schedule.addVipDate")}
                      inputClass="h-10 w-full rounded-md border border-border bg-background px-3 text-center text-sm"
                      containerStyle={{ width: "100%" }}
                  />
                  {!!input.dates?.length && (
                      <div className="flex flex-wrap justify-start gap-1.5">
                          {input.dates.map((date) => (
                              <button
                                  type="button"
                                  key={date}
                                  className="inline-flex items-center gap-1 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
                                  onClick={() => onChange(removeVipBreakDate(input, date))}
                              >
                                  <X className="h-3 w-3" />
                                  {formatValue.date(date)}
                              </button>
                          ))}
                      </div>
                  )}
              </div>
          )}
      </div>
  );

  const renderVipBreakSummary = (vipBreak: VipBreak) => (
      <div className="min-w-0 text-start" dir={dir}>
          <span className="flex flex-wrap items-center justify-start gap-2 font-mono">
              <Gem className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
              <bdi>{vipBreak.start}</bdi> {t("settings.schedule.until")} <bdi>{vipBreak.end}</bdi>
          </span>
          <div className="mt-1 text-xs text-cyan-100/80">{describeVipBreakScope(vipBreak, t, formatValue.date)}</div>
      </div>
  );

  const setSectionScheduleInput = (sectionId: string, updater: (current: ScheduleOverride) => ScheduleOverride) => {
      setSectionScheduleInputs((current) => ({
          ...current,
          [sectionId]: normalizeScheduleOverride(updater(current[sectionId] || defaultScheduleOverrideInput())),
      }));
  };

  const updateScheduleOverrideScope = (override: ScheduleOverride, scope: ScheduleOverrideScope): ScheduleOverride => ({
      ...override,
      scope,
      weekdays: scope === "weekdays" ? (override.weekdays?.length ? override.weekdays : [5]) : [],
      dates: scope === "dates" ? (override.dates || []) : [],
  });

  const toggleScheduleOverrideWeekday = (override: ScheduleOverride, day: number, checked: boolean): ScheduleOverride => {
      const weekdays = new Set((override.weekdays || []).map(Number));
      if (checked) {
          weekdays.add(day);
      } else {
          weekdays.delete(day);
      }

      return { ...override, weekdays: Array.from(weekdays).sort((a, b) => a - b) };
  };

  const addScheduleOverrideDate = (override: ScheduleOverride, date: DateObject | null): ScheduleOverride => {
      if (!date) return override;

      const value = toGregorianDateString(date);
      const dates = new Set(override.dates || []);
      dates.add(value);

      return { ...override, dates: Array.from(dates).sort() };
  };

  const removeScheduleOverrideDate = (override: ScheduleOverride, date: string): ScheduleOverride => ({
      ...override,
      dates: (override.dates || []).filter((item) => item !== date),
  });

  const validateScheduleOverrideInput = (input: ScheduleOverride) => {
      const normalized = normalizeScheduleOverride(input);

      if (!isValidTimeWindow(normalized.startHour, normalized.endHour, "00:00", "23:59")) {
          toast({
              variant: "destructive",
              title: t("settings.schedule.override.invalidWindowTitle"),
              description: t("settings.schedule.override.invalidWindowDescription"),
          });
          return null;
      }

      if (normalized.scope === "weekdays" && !normalized.weekdays?.length) {
          toast({
              variant: "destructive",
              title: t("settings.schedule.override.weekdayRequiredTitle"),
              description: t("settings.schedule.override.weekdayRequiredDescription"),
          });
          return null;
      }

      if (normalized.scope === "dates" && !normalized.dates?.length) {
          toast({
              variant: "destructive",
              title: t("settings.schedule.override.dateRequiredTitle"),
              description: t("settings.schedule.override.dateRequiredDescription"),
          });
          return null;
      }

      return normalized;
  };

  const renderScheduleOverrideControls = (input: ScheduleOverride, onChange: (next: ScheduleOverride) => void) => (
      <div dir={dir} className="space-y-3 rounded-md border border-emerald-500/15 bg-background/40 p-3 text-start">
          <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
              <div className="space-y-1">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.dayType")}</Label>
                  <SettingsSelect
                      value={input.scope}
                      onChange={(e) => onChange(updateScheduleOverrideScope(input, e.target.value as ScheduleOverrideScope))}
                  >
                      <option value="weekdays">{t("settings.schedule.weekdays")}</option>
                      <option value="dates">{t("settings.schedule.specificDate")}</option>
                  </SettingsSelect>
              </div>
              <div className="space-y-1">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.workStart")}</Label>
                  <Input
                      type="time"
                      value={input.startHour}
                      className="text-start [direction:ltr]"
                      onChange={(e) => onChange({ ...input, startHour: e.target.value })}
                  />
              </div>
              <div className="space-y-1">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.workEnd")}</Label>
                  <Input
                      type="time"
                      value={input.endHour}
                      className="text-start [direction:ltr]"
                      onChange={(e) => onChange({ ...input, endHour: e.target.value })}
                  />
              </div>
              <div className="space-y-1">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.slotDuration")}</Label>
                  <Input
                      type="number"
                      min={5}
                      value={input.slotDurationMinutes}
                      className="text-start [direction:ltr]"
                      onChange={(e) => onChange({ ...input, slotDurationMinutes: parseInt(e.target.value || "5", 10) })}
                  />
              </div>
          </div>

          {input.scope === "weekdays" && (
              <div className="space-y-1">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.weekdays")}</Label>
                  <div dir={dir} className="grid grid-cols-7 gap-1.5">
                      {WEEK_DAYS.map((day) => {
                          const checked = (input.weekdays || []).includes(day.value);

                          return (
                              <label
                                  key={`schedule-weekday-${day.value}`}
                                  className={cn(
                                      "flex h-9 cursor-pointer items-center justify-center rounded-md border text-xs font-bold transition-colors",
                                      checked
                                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                                          : "border-border bg-background text-muted-foreground hover:bg-muted",
                                  )}
                              >
                                  <Checkbox
                                      checked={checked}
                                      onCheckedChange={(value) => onChange(toggleScheduleOverrideWeekday(input, day.value, !!value))}
                                      className="sr-only"
                                  />
                                  {t(day.labelKey as MessageKey)}
                              </label>
                          );
                      })}
                  </div>
              </div>
          )}

          {input.scope === "dates" && (
              <div className="space-y-2">
                  <Label className="block text-[11px] text-muted-foreground">{t("settings.schedule.overrideDates")}</Label>
                  <DatePicker
                      value={null}
                      onChange={(date) => onChange(addScheduleOverrideDate(input, Array.isArray(date) ? date[0] ?? null : date))}
                      minDate={new Date()}
                      onOpenPickNewDate={false}
                      editable={false}
                      inputMode="none"
                      calendar={persian}
                      locale={persian_fa}
                      placeholder={t("settings.schedule.addOverrideDate")}
                      inputClass="h-10 w-full rounded-md border border-border bg-background px-3 text-center text-sm"
                      containerStyle={{ width: "100%" }}
                  />
                  {!!input.dates?.length && (
                      <div className="flex flex-wrap justify-start gap-1.5">
                          {input.dates.map((date) => (
                              <button
                                  type="button"
                                  key={date}
                                  className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100"
                                  onClick={() => onChange(removeScheduleOverrideDate(input, date))}
                              >
                                  <X className="h-3 w-3" />
                                  {formatValue.date(date)}
                              </button>
                          ))}
                      </div>
                  )}
              </div>
          )}
      </div>
  );

  const renderScheduleOverrideSummary = (override: ScheduleOverride) => (
      <div className="min-w-0 text-start" dir={dir}>
          <div className="flex flex-wrap items-center justify-start gap-2 text-sm font-bold text-emerald-100">
              <Clock3 className="h-3.5 w-3.5 shrink-0" />
              <span>{describeScheduleOverrideScope(override, t, formatValue.date)}</span>
          </div>
          <div className="mt-1 text-xs text-emerald-100/80">
              {t("settings.schedule.overrideSummary", {
                start: override.startHour,
                end: override.endHour,
                duration: formatValue.number(override.slotDurationMinutes),
              })}
          </div>
      </div>
  );

  const renderSectionOptionPanel = ({
      title,
      description,
      icon,
      count,
      tone,
      children,
  }: {
      title: string;
      description: string;
      icon: React.ReactNode;
      count: number;
      tone: "amber" | "emerald" | "cyan";
      children: React.ReactNode;
  }) => {
      const tones = {
          amber: {
              panel: "border-amber-500/20 bg-amber-500/5",
              title: "text-amber-100",
              button: "border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20",
              badge: "border-amber-500/20 bg-amber-500/10 text-amber-100",
          },
          emerald: {
              panel: "border-emerald-500/20 bg-emerald-500/5",
              title: "text-emerald-100",
              button: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20",
              badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
          },
          cyan: {
              panel: "border-cyan-500/20 bg-cyan-500/5",
              title: "text-cyan-100",
              button: "border-cyan-500/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20",
              badge: "border-cyan-500/20 bg-cyan-500/10 text-cyan-100",
          },
      }[tone];

      return (
          <Collapsible defaultOpen={false} dir={dir} className={cn("rounded-lg border p-3 text-start", tones.panel)}>
              <CollapsibleTrigger asChild>
                  <button
                      type="button"
                      className="flex w-full cursor-pointer flex-col gap-3 rounded-md text-start outline-none transition-colors hover:bg-background/20 focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
                  >
                      <div className="min-w-0 space-y-1">
                          <span className={cn("flex items-center justify-start gap-2 text-xs font-medium", tones.title)}>
                              {icon}
                              {title}
                          </span>
                          <span className="block text-xs leading-6 text-muted-foreground">{description}</span>
                          {count > 0 && (
                              <span className={cn("inline-flex rounded-md border px-2 py-1 text-xs", tones.badge)}>
                                  {t("settings.schedule.registeredCount", { count: formatValue.number(count) })}
                              </span>
                          )}
                      </div>
                      <span className={cn("inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm sm:w-auto", tones.button)}>
                          <Edit3 className="h-3.5 w-3.5" />
                          {t("settings.schedule.configure")}
                      </span>
                  </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3">
                  {children}
              </CollapsibleContent>
          </Collapsible>
      );
  };

  const handleAddSectionRestBreak = async (section: Section) => {
      const input = validateRestBreakInput(sectionBreakInputs[section.id] || defaultRestBreakInput());

      if (!input) return;

      const nextBreaks = sortRestBreaks([...(section.restBreaks || []), input]);
      const success = await handleUpdateSection({ ...section, restBreaks: nextBreaks });

      if (!success) return;

      setSectionBreakInputs((current) => ({
          ...current,
          [section.id]: { ...defaultRestBreakInput(), start: input.start, end: input.end },
      }));
  };

  const handleRemoveSectionRestBreak = async (section: Section, index: number) => {
      const nextBreaks = [...(section.restBreaks || [])];
      nextBreaks.splice(index, 1);
      await handleUpdateSection({ ...section, restBreaks: nextBreaks });
  };

  const handleAddNewSectionRestBreak = () => {
      const input = validateRestBreakInput(newSectionBreakInput);

      if (!input) return;

      setNewSectionData((current) => ({
          ...current,
          restBreaks: sortRestBreaks([...(current.restBreaks || []), input]),
      }));
      setNewSectionBreakInput({ ...defaultRestBreakInput(), start: input.start, end: input.end });
  };

  const handleRemoveNewSectionRestBreak = (index: number) => {
      setNewSectionData((current) => {
          const nextBreaks = [...(current.restBreaks || [])];
          nextBreaks.splice(index, 1);
          return {
              ...current,
              restBreaks: nextBreaks,
          };
      });
  };

  const handleAddSectionVipBreak = async (section: Section) => {
      const input = validateVipBreakInput(sectionVipInputs[section.id] || defaultVipBreakInput(), section.startHour, section.endHour);

      if (!input) return;

      const nextBreaks = sortVipBreaks([...(section.vipBreaks || []), input]);
      const success = await handleUpdateSection({ ...section, vipBreaks: nextBreaks });

      if (!success) return;

      setSectionVipInputs((current) => ({
          ...current,
          [section.id]: { ...defaultVipBreakInput(), start: input.start, end: input.end },
      }));
  };

  const handleRemoveSectionVipBreak = async (section: Section, index: number) => {
      const nextBreaks = [...(section.vipBreaks || [])];
      nextBreaks.splice(index, 1);
      await handleUpdateSection({ ...section, vipBreaks: nextBreaks });
  };

  const handleAddNewSectionVipBreak = () => {
      const input = validateVipBreakInput(
          newSectionVipInput,
          newSectionData.startHour || "09:00",
          newSectionData.endHour || "21:00",
      );

      if (!input) return;

      setNewSectionData((current) => ({
          ...current,
          vipBreaks: sortVipBreaks([...(current.vipBreaks || []), input]),
      }));
      setNewSectionVipInput({ ...defaultVipBreakInput(), start: input.start, end: input.end });
  };

  const handleRemoveNewSectionVipBreak = (index: number) => {
      setNewSectionData((current) => {
          const nextBreaks = [...(current.vipBreaks || [])];
          nextBreaks.splice(index, 1);
          return {
              ...current,
              vipBreaks: nextBreaks,
          };
      });
  };

  const handleAddSectionScheduleOverride = async (section: Section) => {
      const input = validateScheduleOverrideInput(sectionScheduleInputs[section.id] || defaultScheduleOverrideInput());

      if (!input) return;

      const nextOverrides = sortScheduleOverrides([...(section.scheduleOverrides || []), input]);
      const success = await handleUpdateSection({ ...section, scheduleOverrides: nextOverrides });

      if (!success) return;

      setSectionScheduleInputs((current) => ({
          ...current,
          [section.id]: { ...defaultScheduleOverrideInput(), startHour: input.startHour, endHour: input.endHour, slotDurationMinutes: input.slotDurationMinutes },
      }));
  };

  const handleRemoveSectionScheduleOverride = async (section: Section, index: number) => {
      const nextOverrides = [...(section.scheduleOverrides || [])];
      nextOverrides.splice(index, 1);
      await handleUpdateSection({ ...section, scheduleOverrides: nextOverrides });
  };

  const handleAddNewSectionScheduleOverride = () => {
      const input = validateScheduleOverrideInput(newSectionScheduleInput);

      if (!input) return;

      setNewSectionData((current) => ({
          ...current,
          scheduleOverrides: sortScheduleOverrides([...(current.scheduleOverrides || []), input]),
      }));
      setNewSectionScheduleInput({
          ...defaultScheduleOverrideInput(),
          startHour: input.startHour,
          endHour: input.endHour,
          slotDurationMinutes: input.slotDurationMinutes,
      });
  };

  const handleRemoveNewSectionScheduleOverride = (index: number) => {
      setNewSectionData((current) => {
          const nextOverrides = [...(current.scheduleOverrides || [])];
          nextOverrides.splice(index, 1);

          return {
              ...current,
              scheduleOverrides: nextOverrides,
          };
      });
  };

  const handleSavePaymentSettings = async () => {
      setPaymentLoading(true);
      const res = await api.payment.updateSettings({
          ...paymentSettings,
          siteAnnouncementText: paymentSettings.siteAnnouncementEnabled ? paymentSettings.siteAnnouncementText || "" : "",
          bookingClosedText: paymentSettings.bookingClosedEnabled ? paymentSettings.bookingClosedText || "" : "",
      });
      if (res.success) {
          setPaymentSettings(res.data);
          toast({ title: t("settings.general.saved") });
      }
      setPaymentLoading(false);
  }

  const handlePreviewAppointmentAlertSound = (soundKey?: string) => {
      const sound = getAppointmentAlertSound(soundKey);
      if (!sound.file) {
          toast({
              title: t("settings.appointmentAlert.silentToastTitle"),
              description: t("settings.appointmentAlert.silentToastDescription"),
          });
          return;
      }

      const audio = new Audio(sound.file);
      audio.volume = 1;
      audio.play().catch(() => {
          toast({
              variant: "destructive",
              title: t("settings.appointmentAlert.previewFailedTitle"),
              description: t("settings.appointmentAlert.previewFailedDescription"),
          });
      });
  };

  const handleCreateEnamadVerificationFile = async () => {
      const filename = (paymentSettings.enamadVerificationFileName || "").trim().replace(/\.txt$/i, "");

      if (!filename) {
          toast({
              variant: "destructive",
              title: t("settings.enamad.fileNameRequiredTitle"),
              description: t("settings.enamad.fileNameRequiredDescription"),
          });
          return;
      }

      setEnamadFileLoading(true);
      const res = await api.payment.createEnamadVerificationFile(filename);
      setEnamadFileLoading(false);

      if (!res.success) {
          toast({ variant: "destructive", title: t("common.error"), description: res.message });
          return;
      }

      setPaymentSettings(res.data);
      toast({
          title: t("settings.enamad.createdTitle"),
          description: t("settings.enamad.createdDescription"),
      });
  };

  if (!isAdmin && !isBarber) {
      return (
          <div dir={dir} className="h-screen flex items-center justify-center text-center p-4">
              <div>
                  <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
                  <h1 className="text-xl font-bold">{t("settings.shell.accessDeniedTitle")}</h1>
                  <p className="text-muted-foreground mt-2">{t("settings.shell.accessDeniedDescription")}</p>
                  <Link href="/">
                      <Button className="mt-6">{t("settings.shell.backHome")}</Button>
                  </Link>
              </div>
          </div>
      )
  }

  if (tenantMeta?.supportExpired) {
      return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  if (isBarber && (!ownBarber || !ownBarber.canAccessPanel)) {
      return (
          <div dir={dir} className="h-screen flex items-center justify-center text-center p-4">
              <div>
                  <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
                  <h1 className="text-xl font-bold">{t("settings.shell.panelBlockedTitle")}</h1>
                  <p className="text-muted-foreground mt-2">
                    {t("settings.shell.panelBlockedDescription", { professional: labels.singular })}
                  </p>
                  <Link href="/">
                      <Button className="mt-6">{t("settings.shell.backHome")}</Button>
                  </Link>
              </div>
          </div>
      );
  }

  return (
    <div
      className="barber-settings-page min-h-screen bg-background text-foreground pb-20 text-start"
      data-general-settings={forcedTab === "payment" ? "true" : undefined}
      dir={pageDir}
      style={{ direction: pageDir, textAlign: "start" }}
    >
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xl font-bold text-primary">
            <SettingsIcon className="w-6 h-6" />
            <h1>{isAdmin ? t("settings.shell.adminTitle") : t("settings.shell.professionalPanelTitle", { professional: labels.singular })}</h1>
          </div>
          <Link href={singleTabMode ? "/panel" : "/"}>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
              title={t("settings.shell.back")}
            >
              <ArrowRight className={cn("w-5 h-5", isRtl ? "rotate-0" : "rotate-180")} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        {!singleTabMode && !(isNutritionAudience && paymentSettings.appointmentBookingDisabled) && (
          <Link href="/panel/latest-bookings">
            <Card className="border-border/70 bg-card/60 transition-all hover:border-primary/40 hover:bg-card/80">
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base">{t("settings.shell.latestBookingsTitle")}</CardTitle>
                    <CardDescription className="leading-7">
                      {t("settings.shell.latestBookingsDescription")}
                    </CardDescription>
                  </div>
                </div>
                <ArrowRight className={cn("h-4 w-4 shrink-0 text-muted-foreground", isRtl ? "rotate-0" : "rotate-180")} />
              </CardHeader>
            </Card>
          </Link>
        )}
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "barbers" | "payment" | "bulk")}>
            {!singleTabMode && (
                <TabsList className={`grid w-full ${isPrimaryAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
                    <TabsTrigger value="barbers">{t("settings.tabs.barbers", { professionals: labels.plural })}</TabsTrigger>
                    {isPrimaryAdmin && <TabsTrigger value="payment">{t("settings.tabs.payment")}</TabsTrigger>}
                    <TabsTrigger value="bulk">{t("settings.tabs.bulk")}</TabsTrigger>
                </TabsList>
            )}

            <TabsContent value="barbers" className="space-y-6 mt-4">
                
                {/* 1. Barber Management */}
                {isPrimaryAdmin && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            {t("settings.barberManagement.title", { professionals: labels.plural })}
                        </CardTitle>
                        <CardDescription>{t("settings.barberManagement.description", { professionals: labels.plural })}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                            {paymentSettings.apiCodeEnabled ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div className="space-y-2 text-start">
                                            <Label className="text-xs text-muted-foreground">{t("settings.barberManagement.nameLabel", { professional: labels.singular })}</Label>
                                            <Input
                                                placeholder={t("settings.barberManagement.namePlaceholder", { professional: labels.singular })}
                                                value={newBarberName}
                                                onChange={(e) => setNewBarberName(e.target.value)}
                                                className="min-w-0"
                                            />
                                        </div>
                                        <div className="space-y-2 text-start">
                                            <Label className="text-xs text-muted-foreground">{t("settings.barberManagement.mobileLabel")}</Label>
                                            <Input
                                                placeholder="09..."
                                                dir="ltr"
                                                inputMode="numeric"
                                                value={newBarberMobile}
                                                onChange={(e) => setNewBarberMobile(normalizePhoneInput(e.target.value))}
                                                className="min-w-0 text-center [direction:ltr]"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_140px_180px]">
                                        <div className="space-y-2 text-start">
                                            <Label className="text-xs text-muted-foreground">{t("settings.barberManagement.apiCodeLabel")}</Label>
                                            <Input
                                                placeholder={t("settings.barberManagement.apiCodeLabel")}
                                                value={newBarberApiCode}
                                                onChange={(e) => setNewBarberApiCode(e.target.value)}
                                                className="min-w-0 text-start [direction:ltr]"
                                                dir="ltr"
                                            />
                                        </div>
                                        <div className="space-y-2 text-start">
                                            <Label className="text-xs text-muted-foreground">{t("settings.barberManagement.sortOrderLabel")}</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={newBarberSortOrder}
                                                onChange={(e) => setNewBarberSortOrder(parseInt(e.target.value || "0", 10))}
                                                className="min-w-0 text-center [direction:ltr]"
                                            />
                                        </div>
                                        <div className="flex items-end md:col-span-2 xl:col-span-1">
                                            <Button onClick={handleAddBarber} className="w-full">
                                                <Plus className="w-4 h-4 me-2" /> {t("settings.barberManagement.add")}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_140px_160px]">
                                    <div className="space-y-2 text-start">
                                        <Label className="text-xs text-muted-foreground">{t("settings.barberManagement.nameLabel", { professional: labels.singular })}</Label>
                                        <Input 
                                            placeholder={t("settings.barberManagement.namePlaceholder", { professional: labels.singular })}
                                            value={newBarberName}
                                            onChange={(e) => setNewBarberName(e.target.value)}
                                            className="min-w-0"
                                        />
                                    </div>
                                    <div className="space-y-2 text-start">
                                        <Label className="text-xs text-muted-foreground">{t("settings.barberManagement.mobileLabel")}</Label>
                                        <Input 
                                            placeholder="09..."
                                            dir="ltr"
                                            inputMode="numeric"
                                            value={newBarberMobile}
                                            onChange={(e) => setNewBarberMobile(normalizePhoneInput(e.target.value))}
                                            className="text-center [direction:ltr] min-w-0"
                                        />
                                    </div>
                                    <div className="space-y-2 text-start">
                                        <Label className="text-xs text-muted-foreground">{t("settings.barberManagement.sortOrderLabel")}</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            placeholder="0"
                                            value={newBarberSortOrder}
                                            onChange={(e) => setNewBarberSortOrder(parseInt(e.target.value || "0", 10))}
                                            className="text-center [direction:ltr] min-w-0"
                                        />
                                    </div>
                                    <div className="flex items-end md:col-span-2 xl:col-span-1">
                                        <Button onClick={handleAddBarber} className="w-full">
                                            <Plus className="w-4 h-4 me-2" /> {t("settings.barberManagement.add")}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                            {barbers.map(barber => (
                                <div key={barber.id} className="rounded-2xl border border-border/70 bg-card/50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 text-start">
                                            <span className="block text-lg font-bold">{barber.name}</span>
                                            {barber.mobile && (
                                                <span className="mt-1 block text-sm text-muted-foreground [direction:ltr] text-start">
                                                    {barber.mobile}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 rounded-xl"
                                                onClick={() => openBarberEditDialog(barber)}
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDeleteBarber(barber.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {paymentSettings.apiCodeEnabled && barber.apiCode && (
                                        <div className="mt-2 text-start">
                                            <span className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2 py-1 text-xs text-muted-foreground">
                                                <span>{t("settings.barberManagement.apiCodeLabel")}</span>
                                                <bdi dir="ltr">{barber.apiCode}</bdi>
                                            </span>
                                        </div>
                                    )}

                                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr] sm:items-end">
                                        <div className="space-y-2 text-start">
                                            <Label className="text-xs text-muted-foreground">{t("settings.barberManagement.sortOrderLabel")}</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={barber.sortOrder ?? 0}
                                                onChange={(e) => updateBarber({ ...barber, sortOrder: parseInt(e.target.value || "0", 10) })}
                                                className="h-10 text-center [direction:ltr]"
                                            />
                                        </div>
                                        <div className="flex flex-wrap items-center justify-start gap-5 rounded-xl border border-border/60 bg-background/30 px-4 py-3 text-sm">
                                            <label className="flex items-center gap-2 text-muted-foreground">
                                                <Switch
                                                    checked={barber.isActive}
                                                    onCheckedChange={(checked) => updateBarber({ ...barber, isActive: checked })}
                                                />
                                                {t("settings.barberManagement.active")}
                                            </label>
                                            <label className="flex items-center gap-2 text-muted-foreground">
                                                <Switch
                                                    checked={barber.canAccessPanel ?? true}
                                                    onCheckedChange={(checked) => updateBarber({ ...barber, canAccessPanel: checked })}
                                                />
                                                {t("settings.barberManagement.panelAccess")}
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                )}
                
                {/* 1.5 Barber Availability */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary" />
                            {t("settings.availability.title")}
                        </CardTitle>
                        <CardDescription>{t("settings.availability.description", { professional: labels.singular })}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>{t("settings.availability.selectProfessionalLabel", { professional: labels.singular })}</Label>
                            <SettingsSelect
                                value={selectedBarberForAvailability}
                                onChange={(e) => setSelectedBarberForAvailability(e.target.value)}
                                disabled={isBarber}
                            >
                                <option value="">{t("settings.availability.selectPlaceholder")}</option>
                                {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </SettingsSelect>
                        </div>
                        
                        {selectedBarberForAvailability && (
                            <div className="space-y-4 border-t pt-4">
                                <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                    <div className="space-y-1">
                                        <Label className="font-bold">{t("settings.availability.lead.title")}</Label>
                                        <p className="text-sm text-muted-foreground">
                                            {t("settings.availability.lead.description")}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>{t("settings.availability.lead.modeLabel")}</Label>
                                        <SettingsSelect
                                            value={bookingLeadMode}
                                            onChange={(e) => setBookingLeadMode(e.target.value as "today" | "days")}
                                        >
                                            <option value="today">{t("settings.availability.lead.mode.today")}</option>
                                            <option value="days">{t("settings.availability.lead.mode.days")}</option>
                                        </SettingsSelect>
                                    </div>

                                    {bookingLeadMode === "today" ? (
                                        <div className="space-y-2">
                                            <Label>{t("settings.availability.lead.hoursLabel")}</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={bookingLeadHours}
                                                onChange={(e) => setBookingLeadHours(parseInt(e.target.value || "0", 10))}
                                                className="text-center [direction:ltr]"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {t("settings.availability.lead.hoursHint")}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label>{t("settings.availability.lead.daysLabel")}</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={bookingLeadDays}
                                                onChange={(e) => setBookingLeadDays(parseInt(e.target.value || "1", 10))}
                                                className="text-center [direction:ltr]"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {t("settings.availability.lead.daysHint")}
                                            </p>
                                        </div>
                                    )}

                                    <Button variant="secondary" className="w-full" onClick={handleSaveBookingLeadSettings}>
                                        {t("settings.availability.lead.save")}
                                    </Button>
                                </div>

                                <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                    <div className="space-y-1">
                                        <Label className="font-bold">{t("settings.availability.horizon.title")}</Label>
                                        <p className="text-sm text-muted-foreground">
                                            {t("settings.availability.horizon.description")}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>{t("settings.availability.horizon.modeLabel")}</Label>
                                        <SettingsSelect
                                            value={bookingHorizonMode}
                                            onChange={(e) => setBookingHorizonMode(e.target.value as "days" | "date")}
                                        >
                                            <option value="days">{t("settings.availability.horizon.mode.days")}</option>
                                            <option value="date">{t("settings.availability.horizon.mode.date")}</option>
                                        </SettingsSelect>
                                    </div>

                                    {bookingHorizonMode === "days" ? (
                                        <div className="space-y-2">
                                            <Label>{t("settings.availability.horizon.maxDaysLabel")}</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={bookingMaxDays}
                                                onChange={(e) => setBookingMaxDays(parseInt(e.target.value || "0", 10))}
                                                className="text-center [direction:ltr]"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {t("settings.availability.horizon.maxDaysHint")}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label>{t("settings.availability.horizon.maxDateLabel")}</Label>
                                            <DatePicker
                                                value={bookingMaxDate}
                                                onChange={(value) => setBookingMaxDate((value as DateObject) || null)}
                                                calendar={persian}
                                                locale={persian_fa}
                                                placeholder={t("settings.availability.horizon.maxDatePlaceholder")}
                                                className="bg-card w-full"
                                                inputClass="bg-background border border-border rounded-md p-2 w-full text-center"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {t("settings.availability.horizon.maxDateHint")}
                                            </p>
                                        </div>
                                    )}

                                    <Button variant="secondary" className="w-full" onClick={handleSaveBookingLeadSettings}>
                                        {t("settings.availability.horizon.save")}
                                    </Button>
                                </div>

                                <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                    <div className="space-y-1">
                                        <Label className="font-bold">{t("settings.availability.ranges.title")}</Label>
                                        <p className="text-sm text-muted-foreground">
                                            {t("settings.availability.ranges.description")}
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-4 md:flex-row">
                                         <div className="flex-1 space-y-2">
                                             <Label>{t("settings.availability.ranges.startLabel")}</Label>
                                             <div className="w-full">
                                                 <DatePicker 
                                                    value={newRangeStart}
                                                    onChange={setNewRangeStart}
                                                    calendar={persian}
                                                    locale={persian_fa}
                                                    placeholder={t("settings.availability.ranges.startPlaceholder")}
                                                    className="bg-card w-full"
                                                    inputClass="bg-background border border-border rounded-md p-2 w-full text-center"
                                                 />
                                             </div>
                                         </div>
                                         <div className="flex-1 space-y-2">
                                             <Label>{t("settings.availability.ranges.endLabel")}</Label>
                                             <div className="w-full">
                                                 <DatePicker 
                                                    value={newRangeEnd}
                                                    onChange={setNewRangeEnd}
                                                    calendar={persian}
                                                    locale={persian_fa}
                                                    placeholder={t("settings.availability.ranges.endPlaceholder")}
                                                    className="bg-card w-full"
                                                    inputClass="bg-background border border-border rounded-md p-2 w-full text-center"
                                                 />
                                             </div>
                                         </div>
                                    </div>
                                    
                                    <Button 
                                        className="w-full" 
                                        variant="secondary"
                                        onClick={handleAddAvailabilityRange}
                                        disabled={!newRangeStart || !newRangeEnd}
                                    >
                                        <Plus className="w-4 h-4 me-2" />
                                        {t("settings.availability.ranges.add")}
                                    </Button>
                                </div>

                                {activeRanges.length > 0 && (
                                    <div className="space-y-2 mt-4">
                                        <Label>{t("settings.availability.ranges.currentLabel")}</Label>
                                        <div className="space-y-2">
                                            {activeRanges.map((range, idx) => (
                                                <div key={idx} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/50 p-3">
                                                    <div className="space-y-1 text-start">
                                                        <div className="text-xs text-muted-foreground">{t("settings.availability.ranges.itemLabel")}</div>
                                                        <span className="text-sm font-medium">
                                                            {t("settings.availability.ranges.itemSummary", {
                                                                start: formatValue.date(range.start),
                                                                end: formatValue.date(range.end),
                                                            })}
                                                        </span>
                                                    </div>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="text-destructive h-8 w-8 p-0"
                                                        onClick={() => handleDeleteAvailabilityRange(idx)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="border-t pt-4 mt-6">
                                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-5">
                                        <div className="space-y-1 text-start">
                                            <Label className="flex w-full items-center justify-start gap-2 text-start text-base font-bold text-white">
                                                <Ban className="w-5 h-5" />
                                                {t("settings.availability.offDays.title")}
                                            </Label>
                                            <p className="text-sm leading-7 text-muted-foreground">
                                                {t("settings.availability.offDays.description", { professional: labels.singular })}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-border/70 bg-background/40 p-4 space-y-3">
                                            <div className="space-y-1">
                                                <Label className="font-bold">{t("settings.availability.offDays.addTitle")}</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    {t("settings.availability.offDays.addDescription")}
                                                </p>
                                            </div>

                                            <div className="flex gap-2 items-end">
                                                <div className="flex-1">
                                                    <Label className="text-xs mb-1 block">{t("settings.availability.offDays.dateLabel")}</Label>
                                                    <DatePicker 
                                                        value={newDisabledDate}
                                                        onChange={setNewDisabledDate}
                                                        calendar={persian}
                                                        locale={persian_fa}
                                                        className="bg-card shadow-sm border border-border"
                                                        placeholder={t("settings.availability.offDays.datePlaceholder")}
                                                        style={{
                                                            backgroundColor: "hsl(var(--card))",
                                                            height: "40px",
                                                            borderRadius: "8px",
                                                            fontSize: "14px",
                                                            padding: "3px 10px",
                                                            width: "100%",
                                                            textAlign: "center"
                                                        }}
                                                        containerStyle={{ width: "100%" }}
                                                    />
                                                </div>
                                                <Button onClick={handleAddDisabledDate} disabled={!newDisabledDate} className="h-10">
                                                    <Plus className="w-4 h-4 me-2" />
                                                    {t("settings.availability.offDays.add")}
                                                </Button>
                                            </div>
                                        </div>

                                        {disabledDates.length > 0 ? (
                                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                                {disabledDates.map((date, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between rounded-xl border border-border/70 bg-background/50 px-3 py-3"
                                                    >
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <Calendar className="h-4 w-4 text-primary" />
                                                            <span className="font-medium">{formatValue.date(toGregorianDateString(date))}</span>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleRemoveDisabledDate(idx)}
                                                            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center p-4 text-muted-foreground text-sm border border-dashed rounded-lg">
                                                {t("settings.availability.offDays.empty")}
                                            </div>
                                        )}

                                        <div className="border-t border-border/70 pt-5 space-y-4">
                                            <div className="space-y-1 text-start">
                                                <Label className="flex w-full items-center justify-start gap-2 text-start text-base font-bold">
                                                    <Clock3 className="h-5 w-5 text-amber-500" />
                                                    {t("settings.blockedTime.title")}
                                                </Label>
                                                <p className="text-xs leading-6 text-muted-foreground">
                                                    {t("settings.blockedTime.description", { professional: labels.singular })}
                                                </p>
                                            </div>

                                            <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-start">
                                                <div className="grid gap-3 md:grid-cols-3">
                                                    <div className="space-y-1.5">
                                                        <Label className="block text-start text-xs">{t("settings.blockedTime.dateLabel")}</Label>
                                                        <DatePicker
                                                            value={newBlockedDate}
                                                            onChange={setNewBlockedDate}
                                                            minDate={new Date()}
                                                            editable={false}
                                                            inputMode="none"
                                                            calendar={persian}
                                                            locale={persian_fa}
                                                            placeholder={t("settings.blockedTime.datePlaceholder")}
                                                            inputClass="h-10 w-full rounded-md border border-border bg-background px-3 text-center text-sm"
                                                            containerStyle={{ width: "100%" }}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="block text-start text-xs">{t("settings.blockedTime.startTimeLabel")}</Label>
                                                        <Input
                                                            type="time"
                                                            value={newBlockedStart}
                                                            onChange={(event) => setNewBlockedStart(event.target.value)}
                                                            dir="ltr"
                                                            className="h-10 text-center font-mono [direction:ltr]"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="block text-start text-xs">{t("settings.blockedTime.endTimeLabel")}</Label>
                                                        <Input
                                                            type="time"
                                                            value={newBlockedEnd}
                                                            onChange={(event) => setNewBlockedEnd(event.target.value)}
                                                            dir="ltr"
                                                            className="h-10 text-center font-mono [direction:ltr]"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                                                    <div className="space-y-1.5">
                                                        <Label className="block text-start text-xs">{t("settings.blockedTime.reasonLabel")}</Label>
                                                        <Input
                                                            value={newBlockedReason}
                                                            onChange={(event) => setNewBlockedReason(event.target.value)}
                                                            maxLength={120}
                                                            placeholder={t("settings.blockedTime.reasonPlaceholder")}
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        onClick={handleAddBlockedTimeRange}
                                                        disabled={!newBlockedDate || savingBlockedTime}
                                                        className="h-10 min-w-32"
                                                    >
                                                        <Ban className="me-2 h-4 w-4" />
                                                        {savingBlockedTime ? t("settings.blockedTime.saving") : t("settings.blockedTime.add")}
                                                    </Button>
                                                </div>
                                            </div>

                                            {blockedTimeRanges.length > 0 ? (
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    {blockedTimeRanges.map((range) => (
                                                        <div
                                                            key={range.id}
                                                            className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-3"
                                                        >
                                                            <div className="min-w-0 text-start">
                                                                <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                                                                    <span>{formatValue.date(range.date)}</span>
                                                                    <span dir="ltr" className="font-mono text-amber-500">
                                                                        {range.start} - {range.end}
                                                                    </span>
                                                                </div>
                                                                {range.reason && (
                                                                    <p className="mt-1 truncate text-xs text-muted-foreground">{range.reason}</p>
                                                                )}
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={savingBlockedTime}
                                                                className="h-8 w-8 shrink-0 text-destructive"
                                                                onClick={() => handleRemoveBlockedTimeRange(range.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                                                    {t("settings.blockedTime.empty", { professional: labels.singular })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 2. Section Management */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BriefcaseBusiness className="w-5 h-5 text-primary" />
                            {t("settings.sections.title")}
                        </CardTitle>
                        <CardDescription>
                            {t("settings.sections.description", { professional: labels.singular })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Select Barber */}
                        <div className="space-y-2">
                            <Label>{t("settings.sections.selectProfessionalLabel", { professional: labels.singular })}</Label>
                            <SettingsSelect
                                value={selectedBarberForEdit}
                                onChange={(e) => setSelectedBarberForEdit(e.target.value)}
                                disabled={isBarber}
                            >
                                <option value="">{t("settings.sections.selectPlaceholder")}</option>
                                {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </SettingsSelect>
                        </div>

                        {/* List Sections */}
                        {selectedBarberForEdit ? (
                        <div className="space-y-4">
                            {sectionsForEdit.map(section => (
                                <div key={section.id} className="border border-border rounded-lg p-4 bg-card/40 relative text-start">
                                    <div className="absolute end-2 top-2 flex gap-2">
                                         <Switch 
                                            checked={section.isActive} 
                                            onCheckedChange={(c) => handleUpdateSection({...section, isActive: c})}
                                         />
                                         <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 text-destructive"
                                            onClick={() => handleDeleteSection(section.id)}
                                         >
                                             <Trash2 className="w-3 h-3" />
                                         </Button>
                                    </div>

                                    <div className="mb-4 space-y-2">
                                        <Label className="text-xs text-muted-foreground">{t("settings.sections.nameLabel")}</Label>
                                        <Input
                                            value={section.name}
                                            onChange={(e) => handleUpdateSection({ ...section, name: e.target.value })}
                                            placeholder={t("settings.sections.namePlaceholder")}
                                        />
                                    </div>

                                    {paymentSettings.apiCodeEnabled && (
                                        <div className="mb-4 space-y-2">
                                            <Label className="text-xs text-muted-foreground">{t("settings.barberManagement.apiCodeLabel")}</Label>
                                            <Input
                                                value={section.apiCode || ""}
                                                onChange={(e) => handleUpdateSection({ ...section, apiCode: e.target.value })}
                                                placeholder={t("settings.barberManagement.apiCodeLabel")}
                                                className="text-start [direction:ltr]"
                                                dir="ltr"
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                                        <div>
                                            <Label className="text-xs text-muted-foreground">{t("settings.schedule.workStart")}</Label>
                                            <Input 
                                                type="time" 
                                                value={section.startHour} 
                                                onChange={(e) => handleUpdateSection({...section, startHour: e.target.value})}
                                                dir="ltr"
                                                className="h-8 font-mono mt-1 text-center [direction:ltr]"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground">{t("settings.schedule.workEnd")}</Label>
                                            <Input 
                                                type="time" 
                                                value={section.endHour} 
                                                onChange={(e) => handleUpdateSection({...section, endHour: e.target.value})}
                                                dir="ltr"
                                                className="h-8 font-mono mt-1 text-center [direction:ltr]"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground">{t("settings.schedule.slotDuration")}</Label>
                                            <Input 
                                                type="number" 
                                                value={section.slotDurationMinutes} 
                                                onChange={(e) => handleUpdateSection({...section, slotDurationMinutes: parseInt(e.target.value)})}
                                                className="h-8 font-mono mt-1 text-center [direction:ltr]"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground">{t("settings.barberManagement.sortOrderLabel")}</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={section.sortOrder ?? 0}
                                                onChange={(e) => handleUpdateSection({ ...section, sortOrder: parseInt(e.target.value || "0", 10) })}
                                                className="h-8 font-mono mt-1 text-center [direction:ltr]"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border/60 bg-background/25 p-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0 text-start">
                                            <div className="text-xs font-bold">{t("settings.durationDisplay.summaryLabel")}</div>
                                            <div className="mt-1 truncate text-xs text-muted-foreground">
                                                {section.durationDisplayText?.trim() || t("settings.durationDisplay.automatic")}
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="shrink-0"
                                            onClick={() => openDurationDisplayDialog(section)}
                                        >
                                            <Clock3 className="me-2 h-3.5 w-3.5" />
                                            {t("settings.durationDisplay.button")}
                                        </Button>
                                    </div>

                                    <div className="mt-4 border-t pt-3 text-start">
                                        <Label className="text-xs text-muted-foreground block mb-2">{t("settings.sections.workDaysLabel")}</Label>
                                        <div className="flex flex-wrap justify-start gap-1">
                                            {WEEK_DAYS.map((day) => {
                                                const isActive = section.workDays?.includes(day.value) ?? true;
                                                return (
                                                    <div 
                                                        key={day.value}
                                                        onClick={() => {
                                                            const currentDays = section.workDays || [0, 1, 2, 3, 4, 6];
                                                            const newDays = isActive 
                                                                ? currentDays.filter(d => d !== day.value)
                                                                : [...currentDays, day.value];
                                                            handleUpdateSection({...section, workDays: newDays});
                                                        }}
                                                        className={`
                                                            w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-colors border
                                                            ${isActive 
                                                                ? "bg-primary text-primary-foreground border-primary" 
                                                                : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                                                            }
                                                        `}
                                                        title={t(day.labelKey as MessageKey)}
                                                    >
                                                        {t(day.labelKey as MessageKey)}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {paymentSettings.enabled && (
                                        <div className="mt-3">
                                            <Label className="text-xs text-muted-foreground">{t("settings.sections.priceLabel")}</Label>
                                            <Input
                                                type="number"
                                                value={section.price ?? 0}
                                                onChange={(e) => handleUpdateSection({...section, price: parseInt(e.target.value || "0", 10)})}
                                                className="h-8 mt-1 text-center [direction:ltr]"
                                            />
                                        </div>
                                    )}

                                    <div className="mt-3 flex items-center justify-start gap-2 text-start">
                                        <Checkbox
                                            id={`conf-${section.id}`}
                                            checked={section.checkConflicts}
                                            onCheckedChange={(c) => handleUpdateSection({...section, checkConflicts: !!c})}
                                        />
                                        <Label htmlFor={`conf-${section.id}`} className="text-xs">
                                            {t("settings.sections.checkConflictsLabel", { professional: labels.singular })}
                                        </Label>
                                    </div>

                                    <div className="mt-4">
                                        {renderSectionOptionPanel({
                                            title: t("settings.sections.restBreaks.title"),
                                            description: t("settings.sections.restBreaks.description"),
                                            icon: <Clock3 className="h-3.5 w-3.5" />,
                                            count: section.restBreaks?.length || 0,
                                            tone: "amber",
                                            children: (
                                                <>
                                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr] md:items-start">
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            className="h-10 border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                                                            onClick={() => handleAddSectionRestBreak(section)}
                                                        >
                                                            {t("settings.sections.add")}
                                                        </Button>
                                                        {renderRestBreakScopeControls(
                                                            sectionBreakInputs[section.id] || defaultRestBreakInput(),
                                                            (next) => setSectionRestBreakInput(section.id, () => next),
                                                        )}
                                                    </div>

                                                    {!!section.restBreaks?.length && (
                                                        <div className="space-y-2">
                                                            {section.restBreaks.map((restBreak, index) => (
                                                                <div
                                                                    key={`${section.id}-break-${index}`}
                                                                    className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm"
                                                                >
                                                                    {renderRestBreakSummary(restBreak)}
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-destructive"
                                                                        onClick={() => handleRemoveSectionRestBreak(section, index)}
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            ),
                                        })}
                                    </div>

                                    <div className="mt-4">
                                        {renderSectionOptionPanel({
                                            title: t("settings.sections.scheduleOverrides.title"),
                                            description: t("settings.sections.scheduleOverrides.description"),
                                            icon: <Clock3 className="h-3.5 w-3.5" />,
                                            count: section.scheduleOverrides?.length || 0,
                                            tone: "emerald",
                                            children: (
                                                <>
                                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr] md:items-start">
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            className="h-10 border-emerald-500/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                                                            onClick={() => handleAddSectionScheduleOverride(section)}
                                                        >
                                                            {t("settings.sections.add")}
                                                        </Button>
                                                        {renderScheduleOverrideControls(
                                                            sectionScheduleInputs[section.id] || defaultScheduleOverrideInput(),
                                                            (next) => setSectionScheduleInput(section.id, () => next),
                                                        )}
                                                    </div>

                                                    {!!section.scheduleOverrides?.length && (
                                                        <div className="space-y-2">
                                                            {section.scheduleOverrides.map((override, index) => (
                                                                <div
                                                                    key={`${section.id}-schedule-override-${index}`}
                                                                    className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm"
                                                                >
                                                                    {renderScheduleOverrideSummary(override)}
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-destructive"
                                                                        onClick={() => handleRemoveSectionScheduleOverride(section, index)}
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            ),
                                        })}
                                    </div>

                                    {vipFeatureActive && (
                                        <div className="mt-4">
                                            {renderSectionOptionPanel({
                                                title: t("settings.sections.vipBreaks.title"),
                                                description: t("settings.sections.vipBreaks.description"),
                                                icon: <Gem className="h-3.5 w-3.5" />,
                                                count: section.vipBreaks?.length || 0,
                                                tone: "cyan",
                                                children: (
                                                    <>
                                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr] md:items-start">
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                className="h-10 border-cyan-500/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                                                                onClick={() => handleAddSectionVipBreak(section)}
                                                            >
                                                                {t("settings.sections.add")}
                                                            </Button>
                                                            {renderVipBreakScopeControls(
                                                                sectionVipInputs[section.id] || defaultVipBreakInput(),
                                                                (next) => setSectionVipInput(section.id, () => next),
                                                            )}
                                                        </div>

                                                        {!!section.vipBreaks?.length && (
                                                            <div className="space-y-2">
                                                                {section.vipBreaks.map((vipBreak, index) => (
                                                                    <div
                                                                        key={`${section.id}-vip-break-${index}`}
                                                                        className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm"
                                                                    >
                                                                        {renderVipBreakSummary(vipBreak)}
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 text-destructive"
                                                                            onClick={() => handleRemoveSectionVipBreak(section, index)}
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                ),
                                            })}
                                        </div>
                                    )}

                                </div>
                            ))}

                            {/* Add New Section */}
                            {!isAddingSection ? (
                                <Button 
                                    variant="outline" 
                                    className="w-full border-dashed"
                                    onClick={() => setIsAddingSection(true)}
                                >
                                    <Plus className="w-4 h-4 me-2" /> {t("settings.sections.addNew")}
                                </Button>
                            ) : (
                                <div className="border border-primary rounded-lg p-4 bg-primary/5 space-y-4 text-start animate-in fade-in zoom-in-95">
                                    <div className="space-y-2">
                                        <Label>{t("settings.sections.nameLabel")}</Label>
                                        <Input 
                                            placeholder={t("settings.sections.namePlaceholder")}
                                            value={newSectionData.name}
                                            onChange={(e) => setNewSectionData({...newSectionData, name: e.target.value})}
                                        />
                                    </div>
                                    {paymentSettings.apiCodeEnabled && (
                                        <div className="space-y-2">
                                            <Label>{t("settings.barberManagement.apiCodeLabel")}</Label>
                                            <Input
                                                placeholder={t("settings.barberManagement.apiCodeLabel")}
                                                value={newSectionData.apiCode || ""}
                                                onChange={(e) => setNewSectionData({...newSectionData, apiCode: e.target.value})}
                                                className="text-start [direction:ltr]"
                                                dir="ltr"
                                            />
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                        <div className="space-y-1">
                                            <Label className="text-xs">{t("settings.schedule.workStart")}</Label>
                                            <Input type="time" dir="ltr" className="[direction:ltr]" value={newSectionData.startHour} onChange={e => setNewSectionData({...newSectionData, startHour: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">{t("settings.schedule.workEnd")}</Label>
                                            <Input type="time" dir="ltr" className="[direction:ltr]" value={newSectionData.endHour} onChange={e => setNewSectionData({...newSectionData, endHour: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">{t("settings.schedule.slotDuration")}</Label>
                                            <Input type="number" className="[direction:ltr]" value={newSectionData.slotDurationMinutes} onChange={e => setNewSectionData({...newSectionData, slotDurationMinutes: parseInt(e.target.value)})} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">{t("settings.sections.sortOrderShortLabel")}</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={newSectionData.sortOrder ?? 0}
                                                onChange={e => setNewSectionData({...newSectionData, sortOrder: parseInt(e.target.value || "0", 10)})}
                                                className="text-center [direction:ltr]"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/25 p-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0 text-start">
                                            <div className="text-xs font-bold">{t("settings.durationDisplay.summaryLabel")}</div>
                                            <div className="mt-1 truncate text-xs text-muted-foreground">
                                                {newSectionData.durationDisplayText?.trim() || t("settings.durationDisplay.automatic")}
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="shrink-0"
                                            onClick={() => openDurationDisplayDialog()}
                                        >
                                            <Clock3 className="me-2 h-3.5 w-3.5" />
                                            {t("settings.durationDisplay.button")}
                                        </Button>
                                    </div>

                                    <div className="mt-2 text-start">
                                        <Label className="text-xs text-muted-foreground block mb-2">{t("settings.sections.workDaysLabel")}</Label>
                                        <div className="flex flex-wrap justify-start gap-1">
                                            {WEEK_DAYS.map((day) => {
                                                const isActive = newSectionData.workDays?.includes(day.value) ?? true;
                                                return (
                                                    <div 
                                                        key={day.value}
                                                        onClick={() => {
                                                            const currentDays = newSectionData.workDays || [0, 1, 2, 3, 4, 6];
                                                            const newDays = isActive 
                                                                ? currentDays.filter(d => d !== day.value)
                                                                : [...currentDays, day.value];
                                                            setNewSectionData({...newSectionData, workDays: newDays});
                                                        }}
                                                        className={`
                                                            w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-colors border
                                                            ${isActive 
                                                                ? "bg-primary text-primary-foreground border-primary" 
                                                                : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                                                            }
                                                        `}
                                                        title={t(day.labelKey as MessageKey)}
                                                    >
                                                        {t(day.labelKey as MessageKey)}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {paymentSettings.enabled && (
                                        <div className="space-y-2">
                                            <Label>{t("settings.sections.priceLabel")}</Label>
                                            <Input
                                                type="number"
                                                value={newSectionData.price ?? 0}
                                                onChange={(e) => setNewSectionData({...newSectionData, price: parseInt(e.target.value || "0", 10)})}
                                                className="text-center [direction:ltr]"
                                            />
                                        </div>
                                    )}

                                    {renderSectionOptionPanel({
                                        title: t("settings.sections.restBreaks.title"),
                                        description: t("settings.sections.restBreaks.newDescription"),
                                        icon: <Clock3 className="h-3.5 w-3.5" />,
                                        count: newSectionData.restBreaks?.length || 0,
                                        tone: "amber",
                                        children: (
                                            <>
                                                <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr] md:items-start">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        className="h-10 border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                                                        onClick={handleAddNewSectionRestBreak}
                                                    >
                                                        {t("settings.sections.add")}
                                                    </Button>
                                                    {renderRestBreakScopeControls(newSectionBreakInput, (next) =>
                                                        setNewSectionBreakInput(normalizeRestBreak(next)),
                                                    )}
                                                </div>

                                                {!!newSectionData.restBreaks?.length && (
                                                    <div className="space-y-2">
                                                        {newSectionData.restBreaks.map((restBreak, index) => (
                                                            <div
                                                                key={`new-section-break-${index}`}
                                                                className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm"
                                                            >
                                                                {renderRestBreakSummary(restBreak)}
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-destructive"
                                                                    onClick={() => handleRemoveNewSectionRestBreak(index)}
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        ),
                                    })}

                                    {renderSectionOptionPanel({
                                        title: t("settings.sections.scheduleOverrides.title"),
                                        description: t("settings.sections.scheduleOverrides.newDescription"),
                                        icon: <Clock3 className="h-3.5 w-3.5" />,
                                        count: newSectionData.scheduleOverrides?.length || 0,
                                        tone: "emerald",
                                        children: (
                                            <>
                                                <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr] md:items-start">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        className="h-10 border-emerald-500/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                                                        onClick={handleAddNewSectionScheduleOverride}
                                                    >
                                                        {t("settings.sections.add")}
                                                    </Button>
                                                    {renderScheduleOverrideControls(newSectionScheduleInput, (next) =>
                                                        setNewSectionScheduleInput(normalizeScheduleOverride(next)),
                                                    )}
                                                </div>

                                                {!!newSectionData.scheduleOverrides?.length && (
                                                    <div className="space-y-2">
                                                        {newSectionData.scheduleOverrides.map((override, index) => (
                                                            <div
                                                                key={`new-section-schedule-override-${index}`}
                                                                className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm"
                                                            >
                                                                {renderScheduleOverrideSummary(override)}
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-destructive"
                                                                    onClick={() => handleRemoveNewSectionScheduleOverride(index)}
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        ),
                                    })}

                                    {vipFeatureActive && (
                                        renderSectionOptionPanel({
                                            title: t("settings.sections.vipBreaks.title"),
                                            description: t("settings.sections.vipBreaks.newDescription"),
                                            icon: <Gem className="h-3.5 w-3.5" />,
                                            count: newSectionData.vipBreaks?.length || 0,
                                            tone: "cyan",
                                            children: (
                                                <>
                                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr] md:items-start">
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            className="h-10 border-cyan-500/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                                                            onClick={handleAddNewSectionVipBreak}
                                                        >
                                                            {t("settings.sections.add")}
                                                        </Button>
                                                        {renderVipBreakScopeControls(newSectionVipInput, (next) =>
                                                            setNewSectionVipInput(normalizeVipBreak(next)),
                                                        )}
                                                    </div>

                                                    {!!newSectionData.vipBreaks?.length && (
                                                        <div className="space-y-2">
                                                            {newSectionData.vipBreaks.map((vipBreak, index) => (
                                                                <div
                                                                    key={`new-section-vip-break-${index}`}
                                                                    className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm"
                                                                >
                                                                    {renderVipBreakSummary(vipBreak)}
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-destructive"
                                                                        onClick={() => handleRemoveNewSectionVipBreak(index)}
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            ),
                                        })
                                    )}

                                    <div className="flex justify-start gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => setIsAddingSection(false)}>{t("settings.sections.cancel")}</Button>
                                        <Button size="sm" onClick={handleAddSection}>{t("settings.sections.save")}</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                        ) : (
                            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                                {t("settings.sections.emptySelectProfessional", { professional: labels.singular })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            {isPrimaryAdmin && <TabsContent value="payment" className="mt-4">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("settings.announcementStatus.title")}</CardTitle>
                            <CardDescription>
                                {t("settings.announcementStatus.description")}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                <div className="space-y-1">
                                    <Label className="font-bold">{t("settings.languageRegion.title")}</Label>
                                    <p className="text-sm text-muted-foreground leading-7">
                                        {t("settings.languageRegion.description")}
                                    </p>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="tenant-locale">{t("settings.language.label")}</Label>
                                        <SettingsSelect
                                            id="tenant-locale"
                                            value={paymentSettings.locale ?? "fa"}
                                            onChange={(e) =>
                                                setPaymentSettings((current) => ({
                                                    ...current,
                                                    locale: e.target.value,
                                                }))
                                            }
                                        >
                                            {localeOptions.map((locale) => (
                                                <option key={locale.code} value={locale.code}>
                                                    {locale.nativeLabel}
                                                </option>
                                            ))}
                                        </SettingsSelect>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="tenant-country">{t("settings.country.label")}</Label>
                                        <SettingsSelect
                                            id="tenant-country"
                                            value={paymentSettings.country ?? "IR"}
                                            onChange={(e) =>
                                                setPaymentSettings((current) => ({
                                                    ...current,
                                                    country: e.target.value,
                                                }))
                                            }
                                        >
                                            {countryOptions.map((country) => (
                                                <option key={country.code} value={country.code}>
                                                    {country.nativeLabel}
                                                </option>
                                            ))}
                                        </SettingsSelect>
                                    </div>
                                </div>

                            </div>

                            <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                <div className="space-y-1">
                                    <Label className="font-bold">{t("settings.managementPanelNote.title")}</Label>
                                    <p className="text-sm text-muted-foreground leading-7">
                                        {t("settings.managementPanelNote.description", { professionals: labels.plural })}
                                    </p>
                                </div>
                                <Textarea
                                    value={paymentSettings.managementPanelNote || ""}
                                    onChange={(e) =>
                                        setPaymentSettings((current) => ({
                                            ...current,
                                            managementPanelNote: e.target.value,
                                        }))
                                    }
                                    placeholder={t("settings.managementPanelNote.placeholder")}
                                    className="min-h-24 text-start"
                                />
                            </div>

                            {isNutritionAudience && (
                                <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                    <div className="space-y-1">
                                        <Label className="font-bold">{t("settings.nutritionLanding.title")}</Label>
                                        <p className="text-sm text-muted-foreground leading-7">
                                            {t("settings.nutritionLanding.description")}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/35 px-4 py-3">
                                        <div className="space-y-1">
                                            <div className="font-bold">{t("settings.nutritionLanding.defaultTitle")}</div>
                                            <div className="text-xs text-muted-foreground">{t("settings.nutritionLanding.defaultDescription")}</div>
                                        </div>
                                        <Switch
                                            checked={paymentSettings.preferNutritionLandingAsDefault ?? false}
                                            onCheckedChange={(checked) =>
                                                setPaymentSettings((current) => ({
                                                    ...current,
                                                    preferNutritionLandingAsDefault: checked,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-[1fr_220px] md:items-end">
                                        <div className="space-y-2">
                                            <Label htmlFor="nutrition-landing-active">{t("settings.nutritionLanding.activeLabel")}</Label>
                                            <SettingsSelect
                                                id="nutrition-landing-active"
                                                value={paymentSettings.activeNutritionLandingVariant ?? "classic"}
                                                onChange={(e) =>
                                                    setPaymentSettings((current) => ({
                                                        ...current,
                                                        activeNutritionLandingVariant: e.target.value as PaymentSettings["activeNutritionLandingVariant"],
                                                    }))
                                                }
                                            >
                                                <option value="classic">{t("settings.nutritionLanding.variant.classic")}</option>
                                                <option value="diet">{t("settings.nutritionLanding.variant.diet")}</option>
                                                <option value="all_features">{t("settings.nutritionLanding.variant.allFeatures")}</option>
                                                <option value="diet_priority">{t("settings.nutritionLanding.variant.dietPriority")}</option>
                                            </SettingsSelect>
                                        </div>

                                        <Link href="/panel/nutrition/landing">
                                            <Button variant="outline" className="h-11 w-full rounded-2xl">
                                                {t("settings.nutritionLanding.settingsButton")}
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            )}

                            <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <Label className="font-bold">{t("settings.siteAnnouncement.title")}</Label>
                                        <p className="text-sm text-muted-foreground leading-7">
                                            {t("settings.siteAnnouncement.description")}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={paymentSettings.siteAnnouncementEnabled ?? false}
                                        onCheckedChange={(checked) =>
                                            setPaymentSettings((current) => ({ ...current, siteAnnouncementEnabled: checked }))
                                        }
                                    />
                                </div>
                                <Textarea
                                    value={paymentSettings.siteAnnouncementText || ""}
                                    onChange={(e) =>
                                        setPaymentSettings((current) => ({
                                            ...current,
                                            siteAnnouncementText: e.target.value,
                                        }))
                                    }
                                    placeholder={t("settings.siteAnnouncement.placeholder")}
                                    className="min-h-28 text-start"
                                    disabled={!paymentSettings.siteAnnouncementEnabled}
                                />
                            </div>

                            <div className="rounded-lg border bg-card/40 p-4">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                        <Label className="font-bold text-destructive">{t("settings.bookingClosure.title")}</Label>
                                        <p className="text-sm text-muted-foreground leading-7">
                                            {t("settings.bookingClosure.description")}
                                        </p>
                                    </div>
                                    <Link href="/panel/booking-closure">
                                        <Button type="button" variant="outline">{t("settings.bookingClosure.manageButton")}</Button>
                                    </Link>
                                </div>
                            </div>

                            {isNutritionAudience && (
                                <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <Label className="font-bold text-amber-100">{t("settings.appointmentBookingDisabled.title")}</Label>
                                            <p className="text-sm text-muted-foreground leading-7">
                                                {t("settings.appointmentBookingDisabled.description")}
                                            </p>
                                        </div>
                                        <Switch
                                            checked={paymentSettings.appointmentBookingDisabled ?? false}
                                            onCheckedChange={(checked) =>
                                                setPaymentSettings((current) => ({ ...current, appointmentBookingDisabled: checked }))
                                            }
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <Label className="font-bold">{t("settings.offQueueBooking.title")}</Label>
                                            <p className="text-sm text-muted-foreground leading-7">
                                            {t("settings.offQueueBooking.description", { professional: labels.singular })}
                                            </p>
                                        </div>
                                    <Switch
                                        checked={paymentSettings.offQueueBookingEnabled ?? true}
                                        onCheckedChange={(checked) =>
                                            setPaymentSettings((current) => ({
                                                ...current,
                                                offQueueBookingEnabled: checked,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <Label className="font-bold">{t("settings.serviceFirstBooking.title", { professionals: labels.plural })}</Label>
                                        <p className="text-sm text-muted-foreground leading-7">
                                            {t("settings.serviceFirstBooking.description", { professionals: labels.plural })}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={paymentSettings.serviceFirstBookingEnabled ?? false}
                                        onCheckedChange={(checked) =>
                                            setPaymentSettings((current) => ({
                                                ...current,
                                                serviceFirstBookingEnabled: checked,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <Label className="font-bold">{t("settings.customerMobileConfirmation.title")}</Label>
                                        <p className="text-sm text-muted-foreground leading-7">
                                            {t("settings.customerMobileConfirmation.description")}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={paymentSettings.customerMobileConfirmationEnabled ?? false}
                                        onCheckedChange={(checked) =>
                                            setPaymentSettings((current) => ({
                                                ...current,
                                                customerMobileConfirmationEnabled: checked,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <Label className="font-bold">
                                            {t("settings.authenticationCountryPrefix.title")}
                                        </Label>
                                        <p className="text-sm leading-7 text-muted-foreground">
                                            {t("settings.authenticationCountryPrefix.description")}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={paymentSettings.showCountryPrefixInAuthenticationForm ?? false}
                                        onCheckedChange={(checked) =>
                                            setPaymentSettings((current) => ({
                                                ...current,
                                                showCountryPrefixInAuthenticationForm: checked,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                <div className="space-y-1">
                                    <Label className="font-bold">{t("settings.hourlyBookingLimit.title")}</Label>
                                    <p className="text-sm text-muted-foreground leading-7">
                                        {t("settings.hourlyBookingLimit.description", { hours: formatValue.number(1) })}
                                    </p>
                                </div>

                                <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-start">
                                    <div className="space-y-2">
                                        <Label htmlFor="hourly-booking-limit">{t("settings.hourlyBookingLimit.limitLabel", { hours: formatValue.number(1) })}</Label>
                                        <Input
                                            id="hourly-booking-limit"
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={paymentSettings.hourlyBookingLimit ?? 4}
                                            onChange={(e) =>
                                                setPaymentSettings((current) => ({
                                                    ...current,
                                                    hourlyBookingLimit: Math.min(
                                                        100,
                                                        Math.max(1, Number.parseInt(e.target.value || "4", 10) || 4),
                                                    ),
                                                }))
                                            }
                                            dir="ltr"
                                        />
                                    </div>

                                    <div className="rounded-2xl border border-border/60 bg-background/40 p-3 text-start text-sm leading-7 text-muted-foreground">
                                        {t("settings.hourlyBookingLimit.defaultInfo", { count: formatValue.number(4) })}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                <div className="space-y-1">
                                    <Label className="font-bold">{t("settings.cancellationCutoff.title")}</Label>
                                    <p className="text-sm text-muted-foreground leading-7">
                                        {t("settings.cancellationCutoff.description", { professional: labels.singular })}
                                    </p>
                                </div>

                                <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-start">
                                    <div className="space-y-2">
                                        <Label htmlFor="customer-cancellation-cutoff-hours">{t("settings.cancellationCutoff.hoursLabel")}</Label>
                                        <Input
                                            id="customer-cancellation-cutoff-hours"
                                            type="number"
                                            min={1}
                                            max={720}
                                            value={paymentSettings.customerCancellationCutoffHours ?? 2}
                                            onChange={(e) =>
                                                setPaymentSettings((current) => ({
                                                    ...current,
                                                    customerCancellationCutoffHours: Math.min(
                                                        720,
                                                        Math.max(1, Number.parseInt(e.target.value || "2", 10) || 2),
                                                    ),
                                                }))
                                            }
                                            dir="ltr"
                                        />
                                    </div>

                                    <div className="rounded-2xl border border-border/60 bg-background/40 p-3 text-start text-sm leading-7 text-muted-foreground">
                                        {t("settings.cancellationCutoff.defaultInfo", { hours: formatValue.number(2) })}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                <div className="space-y-1">
                                    <Label className="font-bold">{t("settings.appointmentAlert.title")}</Label>
                                    <p className="text-sm text-muted-foreground leading-7">
                                        {t("settings.appointmentAlert.description", { professional: labels.singular })}
                                    </p>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    {APPOINTMENT_ALERT_SOUNDS.map((sound) => {
                                        const checked = (paymentSettings.appointmentAlertSound ?? DEFAULT_APPOINTMENT_ALERT_SOUND) === sound.key;

                                        return (
                                            <div
                                                key={sound.key}
                                                className={`rounded-xl border p-4 transition-all ${checked ? "border-primary bg-primary/10" : "border-border/60 bg-background/35"}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <button
                                                        type="button"
                                                        className="flex-1 space-y-1 text-start"
                                                        onClick={() =>
                                                            setPaymentSettings((current) => ({
                                                                ...current,
                                                                appointmentAlertSound: sound.key,
                                                            }))
                                                        }
                                                    >
                                                        <div className="font-bold">{t(sound.labelKey)}</div>
                                                        <p className="text-sm leading-7 text-muted-foreground">{t(sound.descriptionKey)}</p>
                                                    </button>

                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 rounded-2xl"
                                                            onClick={() => handlePreviewAppointmentAlertSound(sound.key)}
                                                            title={t("settings.appointmentAlert.previewTitle", { sound: t(sound.labelKey) })}
                                                        >
                                                            <Volume2 className="h-4 w-4" />
                                                        </Button>
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={() =>
                                                                setPaymentSettings((current) => ({
                                                                    ...current,
                                                                    appointmentAlertSound: sound.key,
                                                                }))
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1 space-y-1 text-start">
                                        <Label className="font-bold">{t("settings.apiCode.title")}</Label>
                                        <p dir={dir} className="text-sm text-muted-foreground leading-7 [unicode-bidi:plaintext]">
                                            {t("settings.apiCode.descriptionBefore", { professional: labels.singular })} <CodeText>api code</CodeText> {t("settings.apiCode.descriptionAfter")}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={paymentSettings.apiCodeEnabled ?? false}
                                        onCheckedChange={(checked) =>
                                            setPaymentSettings((current) => ({
                                                ...current,
                                                apiCodeEnabled: checked,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1 space-y-1 text-start">
                                        <Label className="text-sm font-medium text-muted-foreground">{t("settings.androidApp.title")}</Label>
                                        <p dir={dir} className="text-xs leading-6 text-muted-foreground [unicode-bidi:plaintext]">{t("settings.androidApp.description")}</p>
                                    </div>
                                    <Switch
                                        checked={paymentSettings.androidAppSettingsEnabled ?? false}
                                        onCheckedChange={(checked) => setPaymentSettings((current) => ({ ...current, androidAppSettingsEnabled: checked }))}
                                    />
                                </div>

                                {paymentSettings.androidAppSettingsEnabled && (
                                    <div className="mt-4 grid gap-4 border-t border-border/50 pt-4 md:grid-cols-3">
                                        <div className="space-y-2">
                                            <Label>{t("settings.androidApp.version")}</Label>
                                            <Input dir="ltr" value={paymentSettings.androidAppVersion ?? ""} onChange={(event) => setPaymentSettings((current) => ({ ...current, androidAppVersion: event.target.value }))} placeholder="1.0.0" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t("settings.androidApp.webAppUrl")}</Label>
                                            <Input dir="ltr" type="url" value={paymentSettings.androidWebAppUrl ?? ""} onChange={(event) => setPaymentSettings((current) => ({ ...current, androidWebAppUrl: event.target.value }))} placeholder="https://app.example.com" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t("settings.androidApp.paymentReturnUrl")}</Label>
                                            <Input dir="ltr" type="url" value={paymentSettings.androidPaymentReturnUrl ?? ""} onChange={(event) => setPaymentSettings((current) => ({ ...current, androidPaymentReturnUrl: event.target.value }))} placeholder="myapp://payment-result" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-border/70 bg-card/40 p-4 space-y-4">
                                <div className="space-y-1">
                                    <Label className="font-bold">{t("settings.membership.title")}</Label>
                                    <p className="text-sm leading-7 text-muted-foreground">
                                        {t("settings.membership.description")}
                                    </p>
                                </div>

                                <div className="grid gap-3">
                                    {MEMBERSHIP_FIELD_DEFINITIONS.map((field) => {
                                        const fieldState = paymentSettings.registrationRequirements?.[field.key as MembershipFieldKey] ?? {
                                            enabled: false,
                                            required: false,
                                        };

                                        return (
                                            <div key={field.key} className="rounded-xl border border-border/60 bg-background/40 p-4">
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                    <div className="flex-1 space-y-1 text-start">
                                                        <div className="font-bold">{t(field.labelKey)}</div>
                                                        <p className="text-sm leading-7 text-muted-foreground">{t(field.descriptionKey)}</p>
                                                    </div>

                                                    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-6">
                                                        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3 sm:min-w-[140px]">
                                                            <Label className="text-sm text-muted-foreground">{t("settings.membership.enabled")}</Label>
                                                            <Switch
                                                                checked={fieldState.enabled}
                                                                onCheckedChange={(checked) =>
                                                                    setPaymentSettings((current) => ({
                                                                        ...current,
                                                                        registrationRequirements: {
                                                                            ...(current.registrationRequirements ?? getDefaultRegistrationRequirements()),
                                                                            [field.key]: {
                                                                                enabled: checked,
                                                                                required: checked
                                                                                    ? (current.registrationRequirements?.[field.key as MembershipFieldKey]?.required ?? false)
                                                                                    : false,
                                                                            },
                                                                        },
                                                                    }))
                                                                }
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3 sm:min-w-[140px]">
                                                            <Label className="text-sm text-muted-foreground">{t("settings.membership.required")}</Label>
                                                            <Switch
                                                                checked={fieldState.required}
                                                                disabled={!fieldState.enabled}
                                                                onCheckedChange={(checked) =>
                                                                    setPaymentSettings((current) => ({
                                                                        ...current,
                                                                        registrationRequirements: {
                                                                            ...(current.registrationRequirements ?? getDefaultRegistrationRequirements()),
                                                                            [field.key]: {
                                                                                enabled: current.registrationRequirements?.[field.key as MembershipFieldKey]?.enabled ?? false,
                                                                                required: checked,
                                                                            },
                                                                        },
                                                                    }))
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t("settings.onlinePayment.title")}</CardTitle>
                            <CardDescription>
                                {t("settings.onlinePayment.description")}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="flex items-center justify-between rounded-lg border bg-card/40 p-4">
                                <div className="space-y-1">
                                    <Label className="font-bold">{t("settings.onlinePayment.enableTitle")}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t("settings.onlinePayment.enableDescription")}
                                    </p>
                                </div>
                                <Switch
                                    checked={paymentSettings.enabled}
                                    onCheckedChange={(checked) =>
                                        setPaymentSettings((current) => ({ ...current, enabled: checked }))
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between rounded-lg border bg-card/30 p-4">
                                <div className="space-y-1">
                                    <Label className="font-bold">{t("settings.onlinePayment.cafebazaarTitle")}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t("settings.onlinePayment.cafebazaarDescription")}
                                    </p>
                                </div>
                                <Switch
                                    checked={paymentSettings.cafebazaarEnabled ?? false}
                                    onCheckedChange={(checked) =>
                                        setPaymentSettings((current) => ({ ...current, cafebazaarEnabled: checked }))
                                    }
                                />
                            </div>

                            {paymentSettings.cafebazaarEnabled && (
                                <div className="space-y-2">
                                    <Label>{t("settings.onlinePayment.cafebazaarPublicKey")}</Label>
                                    <Textarea
                                        dir="ltr"
                                        value={paymentSettings.cafebazaarPublicKey ?? ""}
                                        onChange={(event) =>
                                            setPaymentSettings((current) => ({ ...current, cafebazaarPublicKey: event.target.value }))
                                        }
                                        placeholder="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A..."
                                        className="min-h-[120px] font-mono text-xs"
                                    />
                                    <p className="text-xs text-muted-foreground">{t("settings.onlinePayment.cafebazaarPublicKeyHint")}</p>
                                </div>
                            )}

                            {paymentSettings.enabled && (
                                <>
                                    <fieldset className="space-y-5">
                                        <div className="flex items-center justify-between rounded-lg border bg-card/30 p-4">
                                            <div className="space-y-1">
                                                <Label className="font-bold">{t("settings.onlinePayment.sandboxTitle")}</Label>
                                                <p className="text-sm text-muted-foreground">
                                                    {t("settings.onlinePayment.sandboxDescription")}
                                                </p>
                                            </div>
                                            <Switch
                                                checked={paymentSettings.sandboxEnabled ?? false}
                                                onCheckedChange={(checked) =>
                                                    setPaymentSettings((current) => ({ ...current, sandboxEnabled: checked }))
                                                }
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label>{t("settings.onlinePayment.gatewaysLabel")}</Label>
                                            <div className="grid gap-4 md:grid-cols-2">
                                                {PAYMENT_GATEWAYS.map((gateway) => {
                                                    const gatewayState = paymentSettings.gateways?.[gateway.key] ?? { enabled: false };

                                                    return (
                                                        <div key={gateway.key} className="rounded-2xl border border-border/70 bg-card/20 p-4">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="space-y-1">
                                                                    <div className="font-bold">{t(gateway.labelKey)}</div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {t("settings.onlinePayment.gatewayVisibilityHint")}
                                                                    </div>
                                                                </div>
                                                                <Switch
                                                                    checked={gatewayState.enabled ?? false}
                                                                    onCheckedChange={(checked) =>
                                                                        setPaymentSettings((current) => {
                                                                            const nextGateways = {
                                                                                ...(current.gateways ?? {}),
                                                                                [gateway.key]: {
                                                                                    ...(current.gateways?.[gateway.key] ?? {}),
                                                                                    enabled: checked,
                                                                                },
                                                                            };
                                                                            const enabledGateways = PAYMENT_GATEWAYS
                                                                                .filter((item) => nextGateways[item.key]?.enabled)
                                                                                .map((item) => item.key);

                                                                            return {
                                                                                ...current,
                                                                                gateways: nextGateways,
                                                                                enabledGateways,
                                                                                provider: enabledGateways[0] ?? null,
                                                                            };
                                                                        })
                                                                    }
                                                                />
                                                            </div>

                                                            {gatewayState.enabled && (
                                                                <div className="mt-4 space-y-3">
                                                                    {gateway.fields.map((field) => (
                                                                        <div key={field.key} className="space-y-2">
                                                                            <Label>{t(field.labelKey)}</Label>
                                                                            <Input
                                                                                value={String((gatewayState as unknown as Record<string, unknown>)[field.key] ?? "")}
                                                                                onChange={(e) =>
                                                                                    setPaymentSettings((current) => ({
                                                                                        ...current,
                                                                                        gateways: {
                                                                                            ...(current.gateways ?? {}),
                                                                                            [gateway.key]: {
                                                                                                ...(current.gateways?.[gateway.key] ?? {}),
                                                                                                enabled: true,
                                                                                                [field.key]: e.target.value,
                                                                                            },
                                                                                        },
                                                                                    }))
                                                                                }
                                                                                placeholder={field.placeholder}
                                                                                dir="ltr"
                                                                                className="text-start [direction:ltr]"
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>{t("settings.enamad.codeLabel")}</Label>
                                            <Textarea
                                                value={paymentSettings.enamadCode || ""}
                                                onChange={(e) =>
                                                    setPaymentSettings((current) => ({
                                                        ...current,
                                                        enamadCode: e.target.value,
                                                    }))
                                                }
                                                placeholder={t("settings.enamad.codePlaceholder")}
                                                className="min-h-28 text-start [direction:ltr]"
                                                dir="ltr"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {t("settings.enamad.codeHint")}
                                            </p>
                                        </div>

                                        <div className="space-y-3 rounded-2xl border border-border/70 bg-card/20 p-4">
                                            <div className="space-y-1">
                                                <Label className="font-bold">{t("settings.enamad.fileTitle")}</Label>
                                                <p className="text-sm text-muted-foreground leading-7">
                                                    {t("settings.enamad.fileDescription")}
                                                </p>
                                            </div>

                                            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                                                <Input
                                                    value={paymentSettings.enamadVerificationFileName || ""}
                                                    onChange={(e) =>
                                                        setPaymentSettings((current) => ({
                                                            ...current,
                                                            enamadVerificationFileName: e.target.value.replace(/\.txt$/i, ""),
                                                        }))
                                                    }
                                                    placeholder={t("settings.enamad.filePlaceholder")}
                                                    dir="ltr"
                                                    className="text-center [direction:ltr]"
                                                />
                                                <Button
                                                    type="button"
                                                    onClick={handleCreateEnamadVerificationFile}
                                                    disabled={enamadFileLoading}
                                                    className="min-w-40"
                                                >
                                                    {enamadFileLoading ? t("settings.enamad.creatingFile") : t("settings.enamad.createFile")}
                                                </Button>
                                            </div>

                                            {paymentSettings.enamadVerificationFileName && (
                                                <div className="rounded-xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm leading-7">
                                                    <div className="font-bold text-primary">{t("settings.enamad.fileUrlTitle")}</div>
                                                    <div dir="ltr" className="mt-1 break-all text-foreground">
                                                        {`${window.location.origin}/${paymentSettings.enamadVerificationFileName}.txt`}
                                                    </div>
                                                    <div className="mt-2 text-muted-foreground">
                                                        {t("settings.enamad.createdDescription")}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </fieldset>

                                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                        {t("settings.onlinePayment.readyHint")}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t("settings.smsRedirect.title")}</CardTitle>
                            <CardDescription>
                                {t("settings.smsRedirect.description")}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5 text-start">
                                <div className="space-y-2">
                                    <div className="font-bold text-primary">{t("settings.smsRedirect.noticeTitle")}</div>
                                    <p className="text-sm leading-7 text-muted-foreground">
                                        {t("settings.smsRedirect.noticeDescription")}
                                    </p>
                                </div>
                                <div className="mt-4">
                                    <Link href="/panel/sms-settings">
                                        <Button>{t("settings.smsRedirect.button")}</Button>
                                    </Link>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Button className="w-full" onClick={handleSavePaymentSettings} disabled={paymentLoading}>
                        {paymentLoading ? t("settings.general.saving") : t("settings.general.save")}
                    </Button>
                </div>
            </TabsContent>}

            <TabsContent value="bulk" className="mt-4" dir={dir}>
                <Card className="bg-muted/10 text-start" dir={dir}>
                    <CardHeader className="text-start">
                        <CardTitle className="flex items-center gap-2 text-start text-destructive">
                            <CalendarDays className="h-5 w-5" />
                            {t("settings.bulkCancel.title")}
                        </CardTitle>
                        <CardDescription className="text-start">
                            {t("settings.bulkCancel.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>{t("settings.bulkCancel.professionalLabel", { professional: labels.singular })}</Label>
                            <SettingsSelect
                                value={selectedBulkBarberId}
                                onChange={(e) => {
                                    setSelectedBulkBarberId(e.target.value);
                                    setSelectedBulkDate(null);
                                    setBulkAppointments([]);
                                    setBulkAppointmentIds([]);
                                }}
                                disabled={isBarber}
                            >
                                <option value="">{t("settings.bulkCancel.selectPlaceholder")}</option>
                                {barbers.map((barber) => (
                                    <option key={barber.id} value={barber.id}>
                                        {barber.name}
                                    </option>
                                ))}
                            </SettingsSelect>
                        </div>

                        {selectedBulkBarberId ? (
                          <>
                            <div className="flex justify-center p-4 bg-muted/20 rounded-lg">
                                <DatePicker
                                    value={selectedBulkDate}
                                    onChange={(value) => setSelectedBulkDate((value as DateObject) || null)}
                                    calendar={persian}
                                    locale={persian_fa}
                                    className="bg-card shadow-sm border border-border"
                                    placeholder={t("settings.bulkCancel.datePlaceholder")}
                                    style={{
                                        backgroundColor: "hsl(var(--card))",
                                        height: "40px",
                                        borderRadius: "8px",
                                        fontSize: "14px",
                                        padding: "3px 10px",
                                        width: "100%",
                                        textAlign: "center"
                                    }}
                                />
                            </div>

                            {selectedBulkDate && (
                              <div className="rounded-lg border bg-card/40 p-4 space-y-4">
                                <div className="flex flex-col gap-3 text-start md:flex-row md:items-center md:justify-between">
                                    <div className="space-y-1">
                                        <p className="font-bold">
                                            {t("settings.bulkCancel.appointmentsForDate", {
                                                professional: getBarberName(selectedBulkBarberId),
                                                date: formatValue.date(toGregorianDateString(selectedBulkDate)),
                                            })}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {t("settings.bulkCancel.selectionHint")}
                                        </p>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {t("settings.bulkCancel.selectedCount", {
                                            selected: formatValue.number(bulkAppointmentIds.length),
                                            total: formatValue.number(bulkAppointments.length),
                                        })}
                                    </div>
                                </div>

                                {bulkAppointmentsLoading ? (
                                    <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                                        {t("settings.bulkCancel.loading")}
                                    </div>
                                ) : bulkAppointments.length === 0 ? (
                                    <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                                        {t("settings.bulkCancel.empty")}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {bulkAppointments.map((appointment) => {
                                            const checked = bulkAppointmentIds.includes(appointment.id);

                                            return (
                                                <label
                                                    key={appointment.id}
                                                    className="flex items-start gap-3 rounded-xl border bg-background/60 p-4 text-start cursor-pointer"
                                                >
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={(value) =>
                                                            toggleBulkAppointment(appointment.id, !!value)
                                                        }
                                                    />
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                            <div className="flex flex-wrap items-center justify-start gap-2">
                                                                {appointment.isForSomeoneElse && (
                                                                    <Badge variant="outline">{t("settings.bulkCancel.forSomeoneElse")}</Badge>
                                                                )}
                                                                <Badge variant={checked ? "default" : "secondary"}>
                                                                    {checked ? t("settings.bulkCancel.selectedForCancel") : t("settings.bulkCancel.keep")}
                                                                </Badge>
                                                            </div>
                                                            <span className="font-bold">
                                                                <bdi dir="ltr">{appointment.startTime}</bdi> {t("settings.schedule.until")} <bdi dir="ltr">{appointment.endTime}</bdi>
                                                            </span>
                                                        </div>
                                                        <p className="text-sm">
                                                            {appointment.userName} - <bdi dir="ltr">{appointment.userPhone}</bdi>
                                                        </p>
                                                        {appointment.isForSomeoneElse && (
                                                            <p className="text-sm text-muted-foreground">
                                                                {t("settings.bulkCancel.bookedByLabel")} {appointment.bookedByName || t("settings.bulkCancel.siteUser")} - <bdi dir="ltr">{appointment.bookedByPhone || "-"}</bdi>
                                                            </p>
                                                        )}
                                                        <p className="text-xs text-muted-foreground">
                                                            {getBarberName(appointment.barberId)} / {getSectionName(appointment.sectionId)}
                                                        </p>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-4 rounded-lg border bg-card/40 p-4 text-start">
                                <div className="space-y-1">
                                    <p className="font-bold">{t("settings.bulkCancel.smsTitle")}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {t("settings.bulkCancel.smsDescription")}
                                    </p>
                                </div>
                                <Checkbox
                                    checked={sendBulkSms}
                                    onCheckedChange={(value) => setSendBulkSms(!!value)}
                                />
                            </div>

                            <Button
                                variant="destructive"
                                className="w-full"
                                onClick={handleBulkCancel}
                                disabled={!selectedBulkDate || bulkAppointmentIds.length === 0 || bulkLoading}
                            >
                                {bulkLoading ? t("settings.bulkCancel.cancelling") : t("settings.bulkCancel.submit")}
                            </Button>
                          </>
                        ) : null}
                    </CardContent>
                </Card>
            </TabsContent>
            
            {/* 3. Barber Schedule Management (New) */}
            <TabsContent value="schedule" className="mt-4">
                 {/* This section is removed or merged as per user request to simpler flow or can be added if needed */}
            </TabsContent>
        </Tabs>

      </main>

      <Dialog
          open={!!durationDisplayDialog}
          onOpenChange={(open) => {
              if (!open && !savingDurationDisplayText) {
                  setDurationDisplayDialog(null);
              }
          }}
      >
          <DialogContent dir={dir} className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle className="text-start">{t("settings.durationDisplay.dialogTitle")}</DialogTitle>
                  <DialogDescription className="text-start leading-7">
                      {t("settings.durationDisplay.dialogDescription")}
                  </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      {t("settings.durationDisplay.serviceLabel")} <span className="font-bold text-foreground">{durationDisplayDialog?.sectionName}</span>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="duration-display-text">{t("settings.durationDisplay.textLabel")}</Label>
                      <Textarea
                          id="duration-display-text"
                          value={durationDisplayDialog?.value || ""}
                          onChange={(event) => setDurationDisplayDialog((current) => current ? { ...current, value: event.target.value } : current)}
                          placeholder={t("settings.durationDisplay.placeholder")}
                          maxLength={255}
                          rows={3}
                          autoFocus
                      />
                      <div className="text-xs leading-6 text-muted-foreground">
                          {t("settings.durationDisplay.hint")}
                      </div>
                  </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-start">
                  <Button onClick={() => void handleSaveDurationDisplayText()} disabled={savingDurationDisplayText}>
                      {savingDurationDisplayText ? (
                          <>
                              <Loader2 className="me-2 h-4 w-4 animate-spin" />
                              {t("settings.durationDisplay.saving")}
                          </>
                      ) : (
                          t("settings.durationDisplay.saveText")
                      )}
                  </Button>
                  <Button
                      type="button"
                      variant="outline"
                      disabled={savingDurationDisplayText}
                      onClick={() => void handleSaveDurationDisplayText(true)}
                  >
                      {t("settings.durationDisplay.useAutomatic")}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={limitUpgradeDialogOpen} onOpenChange={setLimitUpgradeDialogOpen}>
          <DialogContent dir={dir} className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle className="text-start">{t("settings.limitUpgrade.title")}</DialogTitle>
                  <DialogDescription className="text-start leading-7">
                      {limitUpgradeMessage || t("settings.limitUpgrade.description", { professional: labels.singular })}
                  </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-start">
                  <Button onClick={() => { setLimitUpgradeDialogOpen(false); window.location.href = "/panel/support-renewal"; }}>
                      {t("settings.limitUpgrade.upgrade")}
                  </Button>
                  <Button variant="outline" onClick={() => setLimitUpgradeDialogOpen(false)}>
                      {t("settings.limitUpgrade.later")}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={!!editingBarber} onOpenChange={(open) => { if (!open) setEditingBarber(null); }}>
          <DialogContent dir={dir} className="sm:max-w-[520px]">
              <DialogHeader>
                  <DialogTitle>{t("settings.barberEdit.title", { professional: labels.singular })}</DialogTitle>
                  <DialogDescription>
                      {t("settings.barberEdit.description")}
                  </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                  <div className="space-y-2">
                      <Label>{t("settings.barberManagement.nameLabel", { professional: labels.singular })}</Label>
                      <Input value={editBarberName} onChange={(e) => setEditBarberName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                      <Label>{t("settings.barberManagement.mobileLabel")}</Label>
                      <Input
                          value={editBarberMobile}
                          onChange={(e) => setEditBarberMobile(normalizePhoneInput(e.target.value))}
                          dir="ltr"
                          inputMode="numeric"
                          className="text-start [direction:ltr]"
                      />
                  </div>
                  {paymentSettings.apiCodeEnabled && (
                      <div className="space-y-2">
                          <Label>{t("settings.barberManagement.apiCodeLabel")}</Label>
                          <Input
                              value={editBarberApiCode}
                              onChange={(e) => setEditBarberApiCode(e.target.value)}
                              dir="ltr"
                              className="text-start [direction:ltr]"
                          />
                      </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                          <Label>{t("settings.barberManagement.sortOrderLabel")}</Label>
                          <Input
                              type="number"
                              min={0}
                              value={editBarberSortOrder}
                              onChange={(e) => setEditBarberSortOrder(parseInt(e.target.value || "0", 10))}
                              className="text-center [direction:ltr]"
                          />
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/30 px-3 py-3">
                          <Label>{t("settings.barberManagement.active")}</Label>
                          <Switch checked={editBarberIsActive} onCheckedChange={setEditBarberIsActive} />
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/30 px-3 py-3">
                          <Label>{t("settings.barberManagement.panelAccess")}</Label>
                          <Switch checked={editBarberCanAccessPanel} onCheckedChange={setEditBarberCanAccessPanel} />
                      </div>
                  </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-start">
                  <Button onClick={handleSaveBarberEdit} disabled={editBarberName.trim().length < 2 || editBarberMobile.trim().length !== 11}>
                      {t("settings.barberEdit.save")}
                  </Button>
                  <Button variant="outline" onClick={() => setEditingBarber(null)}>
                      {t("settings.sections.cancel")}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
