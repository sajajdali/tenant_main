import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgePercent,
  BellRing,
  CalendarClock,
  Layers3,
  Loader2,
  Phone,
  Send,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type {
  Barber,
  NotificationCampaign,
  NotificationCampaignDetails,
  NotificationCampaignFilters,
  NotificationCampaignPresetKey,
  NotificationCampaignPreview,
  PaginatedNotificationCampaigns,
  Section,
  TenantMeta,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { emitNotificationsUpdated } from "@/lib/notifications";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import { PhoneText } from "@/i18n/ltr-text";

type AudienceCategory = "booking" | "store" | "nutrition";
type WizardStep = 1 | 2 | 3 | 4;

const PRESET_OPTIONS: Array<{
  key: NotificationCampaignPresetKey;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  category: AudienceCategory;
}> = [
  { key: "all_customers", labelKey: "panelNotificationCampaigns.preset.allCustomers.label", descriptionKey: "panelNotificationCampaigns.preset.allCustomers.description", category: "booking" },
  { key: "by_barber", labelKey: "panelNotificationCampaigns.preset.byBarber.label", descriptionKey: "panelNotificationCampaigns.preset.byBarber.description", category: "booking" },
  { key: "by_service", labelKey: "panelNotificationCampaigns.preset.byService.label", descriptionKey: "panelNotificationCampaigns.preset.byService.description", category: "booking" },
  { key: "inactive_customers", labelKey: "panelNotificationCampaigns.preset.inactiveCustomers.label", descriptionKey: "panelNotificationCampaigns.preset.inactiveCustomers.description", category: "booking" },
  { key: "inactive_service_customers", labelKey: "panelNotificationCampaigns.preset.inactiveServiceCustomers.label", descriptionKey: "panelNotificationCampaigns.preset.inactiveServiceCustomers.description", category: "booking" },
  { key: "single_visit", labelKey: "panelNotificationCampaigns.preset.singleVisit.label", descriptionKey: "panelNotificationCampaigns.preset.singleVisit.description", category: "booking" },
  { key: "loyal_customers", labelKey: "panelNotificationCampaigns.preset.loyalCustomers.label", descriptionKey: "panelNotificationCampaigns.preset.loyalCustomers.description", category: "booking" },
  { key: "cancelled_appointments", labelKey: "panelNotificationCampaigns.preset.cancelledAppointments.label", descriptionKey: "panelNotificationCampaigns.preset.cancelledAppointments.description", category: "booking" },
  { key: "booked_for_others", labelKey: "panelNotificationCampaigns.preset.bookedForOthers.label", descriptionKey: "panelNotificationCampaigns.preset.bookedForOthers.description", category: "booking" },
  { key: "new_customers", labelKey: "panelNotificationCampaigns.preset.newCustomers.label", descriptionKey: "panelNotificationCampaigns.preset.newCustomers.description", category: "booking" },
  { key: "at_risk_customers", labelKey: "panelNotificationCampaigns.preset.atRiskCustomers.label", descriptionKey: "panelNotificationCampaigns.preset.atRiskCustomers.description", category: "booking" },
  { key: "store_customers", labelKey: "panelNotificationCampaigns.preset.storeCustomers.label", descriptionKey: "panelNotificationCampaigns.preset.storeCustomers.description", category: "store" },
  { key: "store_paid_customers", labelKey: "panelNotificationCampaigns.preset.storePaidCustomers.label", descriptionKey: "panelNotificationCampaigns.preset.storePaidCustomers.description", category: "store" },
  { key: "store_pending_customers", labelKey: "panelNotificationCampaigns.preset.storePendingCustomers.label", descriptionKey: "panelNotificationCampaigns.preset.storePendingCustomers.description", category: "store" },
  { key: "store_no_orders", labelKey: "panelNotificationCampaigns.preset.storeNoOrders.label", descriptionKey: "panelNotificationCampaigns.preset.storeNoOrders.description", category: "store" },
  { key: "high_value_store_customers", labelKey: "panelNotificationCampaigns.preset.highValueStoreCustomers.label", descriptionKey: "panelNotificationCampaigns.preset.highValueStoreCustomers.description", category: "store" },
  { key: "nutrition_no_diets", labelKey: "panelNotificationCampaigns.preset.nutritionNoDiets.label", descriptionKey: "panelNotificationCampaigns.preset.nutritionNoDiets.description", category: "nutrition" },
  { key: "nutrition_has_diets", labelKey: "panelNotificationCampaigns.preset.nutritionHasDiets.label", descriptionKey: "panelNotificationCampaigns.preset.nutritionHasDiets.description", category: "nutrition" },
  { key: "nutrition_session_number", labelKey: "panelNotificationCampaigns.preset.nutritionSessionNumber.label", descriptionKey: "panelNotificationCampaigns.preset.nutritionSessionNumber.description", category: "nutrition" },
  { key: "nutrition_package_expired", labelKey: "panelNotificationCampaigns.preset.nutritionPackageExpired.label", descriptionKey: "panelNotificationCampaigns.preset.nutritionPackageExpired.description", category: "nutrition" },
  { key: "nutrition_package_active", labelKey: "panelNotificationCampaigns.preset.nutritionPackageActive.label", descriptionKey: "panelNotificationCampaigns.preset.nutritionPackageActive.description", category: "nutrition" },
  { key: "nutrition_active_diet", labelKey: "panelNotificationCampaigns.preset.nutritionActiveDiet.label", descriptionKey: "panelNotificationCampaigns.preset.nutritionActiveDiet.description", category: "nutrition" },
  { key: "nutrition_pending_request", labelKey: "panelNotificationCampaigns.preset.nutritionPendingRequest.label", descriptionKey: "panelNotificationCampaigns.preset.nutritionPendingRequest.description", category: "nutrition" },
];

const PRESET_LABEL_KEYS = {
  all_users: "panelNotificationCampaigns.preset.allUsers.label",
  appointments_count_at_least: "panelNotificationCampaigns.preset.appointmentsCountAtLeast.label",
  ...Object.fromEntries(PRESET_OPTIONS.map((item) => [item.key, item.labelKey])),
} as Record<NotificationCampaignPresetKey, MessageKey>;

const STATUS_LABEL_KEYS: Record<string, MessageKey> = {
  queued: "panelNotificationCampaigns.status.queued",
  sending: "panelNotificationCampaigns.status.sending",
  completed: "panelNotificationCampaigns.status.completed",
  cancelled: "panelNotificationCampaigns.status.cancelled",
  failed: "panelNotificationCampaigns.status.failed",
  draft: "panelNotificationCampaigns.status.draft",
};

const STATUS_VARIANTS: Record<string, "secondary" | "destructive" | "default"> = {
  queued: "secondary",
  sending: "default",
  completed: "secondary",
  cancelled: "destructive",
  failed: "destructive",
  draft: "secondary",
};

function requiresBarber(preset: NotificationCampaignPresetKey) {
  return ["by_barber", "inactive_service_customers"].includes(preset);
}

function requiresService(preset: NotificationCampaignPresetKey) {
  return ["by_service", "inactive_service_customers"].includes(preset);
}

function requiresInactiveMonths(preset: NotificationCampaignPresetKey) {
  return ["inactive_customers", "inactive_service_customers", "at_risk_customers"].includes(preset);
}

function requiresNewCustomerDays(preset: NotificationCampaignPresetKey) {
  return preset === "new_customers";
}

function requiresLoyalCount(preset: NotificationCampaignPresetKey) {
  return preset === "loyal_customers";
}

function requiresStoreMinAmount(preset: NotificationCampaignPresetKey) {
  return preset === "high_value_store_customers";
}

function requiresNutritionSessionNumber(preset: NotificationCampaignPresetKey) {
  return preset === "nutrition_session_number";
}

export default function PanelNotificationCampaignsPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const formatValue = useFormat();
  const { dir, isRtl } = useLocale();
  const { barbers, sections } = useStore();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const labels = getAudienceLabels(tenantMeta);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [selectedCategory, setSelectedCategory] = useState<AudienceCategory | null>(null);
  const [selectedPresetKey, setSelectedPresetKey] = useState<NotificationCampaignPresetKey | null>(null);
  const [filters, setFilters] = useState<NotificationCampaignFilters>({
    preset: "all_customers",
    inactive_months: 2,
    new_customer_days: 30,
    loyal_min_appointments: 3,
    min_store_total_amount: 1000000,
    nutrition_session_number: 2,
  });
  const [campaignName, setCampaignName] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<NotificationCampaignPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<NotificationCampaignDetails | null>(null);
  const stepRefs = useRef<Partial<Record<WizardStep, HTMLButtonElement | null>>>({});
  const [history, setHistory] = useState<PaginatedNotificationCampaigns>({
    items: [],
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  });
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const isNutritionAudience = ["nutritionists", "nutrition-doctors"].includes(tenantMeta?.audience?.slug ?? "");
  const storeModuleActive = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-store") ?? false;

  const filteredSections = useMemo(() => {
    if (!filters.barber_id) return sections;
    return sections.filter((section) => Number(section.barberId) === filters.barber_id);
  }, [filters.barber_id, sections]);

  const getPresetLabel = (preset: NotificationCampaignPresetKey) => t(PRESET_LABEL_KEYS[preset] ?? "panelNotificationCampaigns.unknown");
  const getStatusLabel = (status: string) => t(STATUS_LABEL_KEYS[status] ?? "panelNotificationCampaigns.status.unknown");
  const getCategoryTitle = (category: AudienceCategory) => {
    if (category === "store") return t("panelNotificationCampaigns.category.store.title");
    if (category === "nutrition") return t("panelNotificationCampaigns.category.nutrition.title");
    return t("panelNotificationCampaigns.category.booking.title");
  };
  const formatDate = (date?: string | null) => date ? formatValue.date(date) : t("panelNotificationCampaigns.notSet");
  const formatCount = (value?: number | null) => formatValue.number(value ?? 0);

  const bookingPresets = PRESET_OPTIONS.filter((option) => option.category === "booking");
  const storePresets = PRESET_OPTIONS.filter((option) => option.category === "store");
  const nutritionPresets = PRESET_OPTIONS.filter((option) => option.category === "nutrition");
  const activePreset = selectedPresetKey ?? filters.preset;
  const selectedPreset = selectedPresetKey ? PRESET_OPTIONS.find((option) => option.key === selectedPresetKey) : null;
  const hasPreviewResult = !!preview && preview.total > 0;
  const shouldHideBarberSelect = selectedPresetKey !== null && requiresBarber(activePreset) && barbers.length <= 1;
  const shouldHideServiceSelect = selectedPresetKey !== null && requiresService(activePreset) && filteredSections.length <= 1;

  const wizardSteps: Array<{ step: WizardStep; titleKey: MessageKey; descriptionKey: MessageKey }> = [
    { step: 1, titleKey: "panelNotificationCampaigns.step.category.title", descriptionKey: "panelNotificationCampaigns.step.category.description" },
    { step: 2, titleKey: "panelNotificationCampaigns.step.preset.title", descriptionKey: "panelNotificationCampaigns.step.preset.description" },
    { step: 3, titleKey: "panelNotificationCampaigns.step.preview.title", descriptionKey: "panelNotificationCampaigns.step.preview.description" },
    { step: 4, titleKey: "panelNotificationCampaigns.step.send.title", descriptionKey: "panelNotificationCampaigns.step.send.description" },
  ];

  const availableCategories = useMemo<Array<{
    key: AudienceCategory;
    titleKey: MessageKey;
    descriptionKey: MessageKey;
    accentClass: string;
  }>>(() => {
    const base: Array<{
      key: AudienceCategory;
      titleKey: MessageKey;
      descriptionKey: MessageKey;
      accentClass: string;
    }> = [
      {
        key: "booking",
        titleKey: "panelNotificationCampaigns.category.booking.cardTitle",
        descriptionKey: "panelNotificationCampaigns.category.booking.description",
        accentClass: "border-primary bg-primary/10",
      },
      {
        key: "store",
        titleKey: "panelNotificationCampaigns.category.store.cardTitle",
        descriptionKey: "panelNotificationCampaigns.category.store.description",
        accentClass: "border-sky-500/40 bg-sky-500/10",
      },
    ];

    if (isNutritionAudience) {
      base.push({
        key: "nutrition",
        titleKey: "panelNotificationCampaigns.category.nutrition.cardTitle",
        descriptionKey: "panelNotificationCampaigns.category.nutrition.description",
        accentClass: "border-emerald-500/40 bg-emerald-500/10",
      });
    }

    return base;
  }, [isNutritionAudience]);

  const visiblePresetOptions = selectedCategory === "store"
    ? storePresets
    : selectedCategory === "nutrition"
      ? nutritionPresets
      : bookingPresets;
  const storeCategoryLocked = selectedCategory === "store" && !storeModuleActive;

  const canOpenStep = (step: WizardStep) => {
    if (step === 1) return true;
    if (step === 2) return selectedCategory !== null;
    if (step === 3) return selectedCategory !== null && selectedPresetKey !== null && !storeCategoryLocked;
    return selectedCategory !== null && selectedPresetKey !== null && hasPreviewResult && !storeCategoryLocked;
  };

  const goToStep = (step: WizardStep) => {
    if (step <= currentStep || canOpenStep(step)) setCurrentStep(step);
  };

  const selectCategory = (category: AudienceCategory) => {
    setSelectedCategory(category);
    setSelectedPresetKey(null);
    setPreview(null);
    setCurrentStep(2);
    setFilters((current) => ({
      ...current,
      barber_id: undefined,
      service_id: undefined,
      inactive_months: current.inactive_months ?? 2,
      new_customer_days: current.new_customer_days ?? 30,
      loyal_min_appointments: current.loyal_min_appointments ?? 3,
      min_store_total_amount: current.min_store_total_amount ?? 1000000,
      nutrition_session_number: current.nutrition_session_number ?? 2,
    }));
  };

  const selectPreset = (preset: NotificationCampaignPresetKey) => {
    setSelectedPresetKey(preset);
    setFilters((current) => ({ ...current, preset }));
    setPreview(null);
    setCurrentStep(3);
  };

  const resetEditor = () => {
    setCurrentStep(1);
    setCampaignName("");
    setTitle("");
    setMessage("");
    setPreview(null);
    setSelectedCategory(null);
    setSelectedPresetKey(null);
    setFilters({
      preset: "all_customers",
      inactive_months: 2,
      new_customer_days: 30,
      loyal_min_appointments: 3,
      min_store_total_amount: 1000000,
      nutrition_session_number: 2,
    });
  };

  const loadHistory = async (page = 1) => {
    setHistoryLoading(true);
    const res = await api.notificationCampaigns.list(page, 10);
    if (res.success) {
      setHistory(res.data);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setHistoryLoading(false);
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    const res = await api.notificationCampaigns.preview(filters);
    if (res.success) {
      setPreview(res.data);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setPreviewLoading(false);
  };

  const handleCreate = async () => {
    if (!preview || preview.total === 0) {
      toast({ variant: "destructive", title: t("common.error"), description: t("panelNotificationCampaigns.toast.previewRequired") });
      return;
    }

    setCreating(true);
    const res = await api.notificationCampaigns.create({
      name: campaignName,
      title,
      message,
      filters,
    });
    setCreating(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    toast({ title: t("panelNotificationCampaigns.toast.created"), description: res.message });
    resetEditor();
    emitNotificationsUpdated();
    await loadHistory(1);
  };

  const openDetails = async (campaign: NotificationCampaign, page = 1) => {
    setDetailsLoading(true);
    const res = await api.notificationCampaigns.details(campaign.id, page, 10);
    if (res.success) {
      setSelectedCampaign(res.data);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setDetailsLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadHistory(1);
  }, [isAdmin]);

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) setTenantMeta(res.data);
    });
  }, []);

  useEffect(() => {
    const activeStep = stepRefs.current[currentStep];
    if (!activeStep) return;
    activeStep.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [currentStep]);

  useEffect(() => {
    if (!selectedPresetKey) return;

    if (!requiresBarber(activePreset) && filters.barber_id) {
      setFilters((current) => ({ ...current, barber_id: undefined }));
    }

    if (!requiresService(activePreset) && filters.service_id) {
      setFilters((current) => ({ ...current, service_id: undefined }));
    }
  }, [activePreset, filters.barber_id, filters.service_id, selectedPresetKey]);

  useEffect(() => {
    if (selectedPresetKey && requiresBarber(activePreset) && barbers.length === 1 && !filters.barber_id) {
      setFilters((current) => ({ ...current, barber_id: Number(barbers[0].id) }));
    }
  }, [activePreset, barbers, filters.barber_id, selectedPresetKey]);

  useEffect(() => {
    if (selectedPresetKey && requiresService(activePreset) && filteredSections.length === 1 && !filters.service_id) {
      setFilters((current) => ({ ...current, service_id: Number(filteredSections[0].id) }));
    }
  }, [activePreset, filteredSections, filters.service_id, selectedPresetKey]);

  useEffect(() => {
    if (!selectedCategory || !selectedPresetKey) return;

    if (requiresBarber(activePreset) && !filters.barber_id) {
      setPreview(null);
      return;
    }

    if (requiresService(activePreset) && !filters.service_id) {
      setPreview(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void handlePreview();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    activePreset,
    filters.barber_id,
    filters.inactive_months,
    filters.loyal_min_appointments,
    filters.min_store_total_amount,
    filters.new_customer_days,
    filters.nutrition_session_number,
    filters.service_id,
    selectedCategory,
    selectedPresetKey,
  ]);

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <BellRing className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{t("panelNotificationCampaigns.accessDenied.title")}</h1>
          <p className="text-muted-foreground leading-7">{t("panelNotificationCampaigns.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelNotificationCampaigns.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 text-start" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("panelNotificationCampaigns.title")}</h1>
          </div>
          <Link href="/panel">
            <Button
              variant="outline"
              size="icon"
              title={t("common.back")}
              className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            >
              <ArrowRight className={`w-5 h-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardHeader className="space-y-4">
            <div className="space-y-1">
              <CardTitle className="text-base">{t("panelNotificationCampaigns.builderTitle")}</CardTitle>
              <CardDescription>
                {t("panelNotificationCampaigns.builderDescription", { step: formatValue.number(currentStep), total: formatValue.number(4) })}
              </CardDescription>
            </div>

            <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
              {wizardSteps.map((stepItem) => {
                const isActive = currentStep === stepItem.step;
                const isClickable = stepItem.step <= currentStep || canOpenStep(stepItem.step);
                const isDone = stepItem.step < currentStep && canOpenStep(stepItem.step);

                return (
                  <button
                    key={stepItem.step}
                    ref={(element) => {
                      stepRefs.current[stepItem.step] = element;
                    }}
                    type="button"
                    onClick={() => goToStep(stepItem.step)}
                    disabled={!isClickable}
                    className={`rounded-3xl border p-4 text-start transition ${
                      isActive
                        ? "border-primary bg-primary/10 shadow-sm"
                        : isDone
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : "border-border/70 bg-background/20"
                    } min-w-[260px] shrink-0 snap-center md:min-w-0 md:shrink ${isClickable ? "hover:border-primary/40" : "cursor-not-allowed opacity-50"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-muted-foreground">
                        {isDone ? t("panelNotificationCampaigns.editable") : t("panelNotificationCampaigns.stepNumber", { step: formatValue.number(stepItem.step) })}
                      </span>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${isActive ? "bg-primary text-primary-foreground" : isDone ? "bg-emerald-500 text-white" : "bg-muted text-foreground"}`}>
                        {formatValue.number(stepItem.step)}
                      </span>
                    </div>
                    <div className="mt-3 font-bold">{t(stepItem.titleKey)}</div>
                    <div className="mt-1 text-sm leading-7 text-muted-foreground">{t(stepItem.descriptionKey)}</div>
                  </button>
                );
              })}
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {currentStep === 1 ? (
              <>
                <div className="space-y-1 text-start">
                  <div className="text-base font-bold">{t("panelNotificationCampaigns.step.category.title")}</div>
                  <div className="text-sm leading-7 text-muted-foreground">{t("panelNotificationCampaigns.step.category.longDescription")}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {availableCategories.map((category) => (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => selectCategory(category.key)}
                      className={`rounded-3xl border p-5 text-start transition ${selectedCategory === category.key ? category.accentClass : "border-border/70 bg-background/20 hover:border-primary/30"}`}
                    >
                      <div className="text-lg font-black">{t(category.titleKey)}</div>
                      <div className="mt-2 text-sm leading-7 text-muted-foreground">{t(category.descriptionKey)}</div>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {currentStep === 2 ? (
              <>
                <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-background/20 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1 text-start">
                    <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.selectedCategory")}</div>
                    <div className="font-bold">{selectedCategory ? getCategoryTitle(selectedCategory) : t("panelNotificationCampaigns.notSelected")}</div>
                  </div>
                  <Button type="button" variant="outline" onClick={() => goToStep(1)}>
                    {t("panelNotificationCampaigns.previousStep")}
                  </Button>
                </div>

                {storeCategoryLocked ? (
                  <div className="rounded-3xl border border-amber-500/25 bg-amber-500/10 p-5 text-start">
                    <div className="text-lg font-bold text-foreground">{t("panelNotificationCampaigns.storeLocked.title")}</div>
                    <div className="mt-2 text-sm leading-8 text-muted-foreground">
                      {t("panelNotificationCampaigns.storeLocked.description")}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                      <Link href="/panel/special-features/online-store">
                        <Button type="button">{t("panelNotificationCampaigns.storeLocked.button")}</Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedCategory ? visiblePresetOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => selectPreset(option.key)}
                        className={`rounded-2xl border p-4 text-start transition ${
                          selectedPresetKey === option.key
                            ? selectedCategory === "store"
                              ? "border-sky-500 bg-sky-500/10"
                              : selectedCategory === "nutrition"
                                ? "border-emerald-500 bg-emerald-500/10"
                                : "border-primary bg-primary/10"
                            : "border-border/70 bg-background/20 hover:border-primary/40"
                        }`}
                      >
                        <div className="font-bold">{t(option.labelKey)}</div>
                        <div className="mt-1 text-sm leading-7 text-muted-foreground">{t(option.descriptionKey)}</div>
                      </button>
                    )) : (
                      <div className="md:col-span-2 rounded-2xl border border-dashed border-border/70 bg-background/10 p-6 text-center text-sm text-muted-foreground">
                        {t("panelNotificationCampaigns.empty.selectCategoryFirst")}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}

            {currentStep === 3 ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-3xl border border-border/70 bg-background/20 p-4 text-start">
                    <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.audienceCategory")}</div>
                    <div className="mt-2 font-bold">{selectedCategory ? getCategoryTitle(selectedCategory) : t("panelNotificationCampaigns.notSelected")}</div>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background/20 p-4 text-start">
                    <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.selectedList")}</div>
                    <div className="mt-2 font-bold">{selectedPreset ? t(selectedPreset.labelKey) : t("panelNotificationCampaigns.notSelected")}</div>
                  </div>
                  <div className="flex items-center justify-end gap-2 rounded-3xl border border-border/70 bg-background/20 p-4">
                    <Button type="button" variant="outline" onClick={() => goToStep(2)}>
                      {t("panelNotificationCampaigns.editPreviousStep")}
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-border/70 bg-background/20 p-4">
                  <div className="space-y-1 text-start">
                    <div className="text-base font-bold">{t("panelNotificationCampaigns.preview.title")}</div>
                    <div className="text-sm leading-7 text-muted-foreground">
                      {selectedCategory && selectedPreset
                        ? t("panelNotificationCampaigns.preview.descriptionWithCategory", { category: getCategoryTitle(selectedCategory) })
                        : t("panelNotificationCampaigns.preview.description")}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedPresetKey && requiresBarber(activePreset) && !shouldHideBarberSelect && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{labels.singular}</label>
                        <select
                          value={filters.barber_id ?? ""}
                          onChange={(event) => setFilters((current) => ({
                            ...current,
                            barber_id: event.target.value ? Number(event.target.value) : undefined,
                            service_id: undefined,
                          }))}
                          className="w-full appearance-none rounded-md border border-border bg-background p-2 pe-10 ps-3 text-start"
                          dir={dir}
                        >
                          <option value="">{t("panelNotificationCampaigns.selectPlaceholder")}</option>
                          {barbers.map((barber: Barber) => (
                            <option key={barber.id} value={barber.id}>
                              {barber.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedPresetKey && requiresService(activePreset) && !shouldHideServiceSelect && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("panelNotificationCampaigns.serviceLabel")}</label>
                        <select
                          value={filters.service_id ?? ""}
                          onChange={(event) => setFilters((current) => ({
                            ...current,
                            service_id: event.target.value ? Number(event.target.value) : undefined,
                          }))}
                          className="w-full appearance-none rounded-md border border-border bg-background p-2 pe-10 ps-3 text-start"
                          dir={dir}
                        >
                          <option value="">{t("panelNotificationCampaigns.selectPlaceholder")}</option>
                          {filteredSections.map((section: Section) => (
                            <option key={section.id} value={section.id}>
                              {section.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedPresetKey && requiresInactiveMonths(activePreset) && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("panelNotificationCampaigns.filter.inactiveMonths")}</label>
                        <Input
                          type="number"
                          min={1}
                          max={24}
                          value={filters.inactive_months ?? 2}
                          onChange={(event) => setFilters((current) => ({ ...current, inactive_months: Number(event.target.value || 2) }))}
                          className="text-start [direction:ltr]"
                          dir="ltr"
                        />
                      </div>
                    )}

                    {selectedPresetKey && requiresNewCustomerDays(activePreset) && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("panelNotificationCampaigns.filter.newCustomerDays")}</label>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={filters.new_customer_days ?? 30}
                          onChange={(event) => setFilters((current) => ({ ...current, new_customer_days: Number(event.target.value || 30) }))}
                          className="text-start [direction:ltr]"
                          dir="ltr"
                        />
                      </div>
                    )}

                    {selectedPresetKey && requiresLoyalCount(activePreset) && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("panelNotificationCampaigns.filter.loyalMinAppointments")}</label>
                        <Input
                          type="number"
                          min={2}
                          max={100}
                          value={filters.loyal_min_appointments ?? 3}
                          onChange={(event) => setFilters((current) => ({ ...current, loyal_min_appointments: Number(event.target.value || 3) }))}
                          className="text-start [direction:ltr]"
                          dir="ltr"
                        />
                      </div>
                    )}

                    {selectedPresetKey && requiresStoreMinAmount(activePreset) && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("panelNotificationCampaigns.filter.minStoreAmount")}</label>
                        <Input
                          type="number"
                          min={1}
                          value={filters.min_store_total_amount ?? 1000000}
                          onChange={(event) => setFilters((current) => ({ ...current, min_store_total_amount: Number(event.target.value || 1000000) }))}
                          className="text-start [direction:ltr]"
                          dir="ltr"
                        />
                      </div>
                    )}

                    {selectedPresetKey && requiresNutritionSessionNumber(activePreset) && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("panelNotificationCampaigns.filter.nutritionSessionNumber")}</label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={filters.nutrition_session_number ?? 2}
                          onChange={(event) => setFilters((current) => ({ ...current, nutrition_session_number: Number(event.target.value || 2) }))}
                          className="text-start [direction:ltr]"
                          dir="ltr"
                        />
                      </div>
                    )}
                  </div>

                  {selectedPresetKey ? (
                    <div className="text-sm text-muted-foreground">
                      {t("panelNotificationCampaigns.preview.autoUpdateHint")}
                    </div>
                  ) : null}

                  {previewLoading && selectedPresetKey ? (
                    <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/20 text-sm text-muted-foreground">
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      {t("panelNotificationCampaigns.preview.loading")}
                    </div>
                  ) : !preview ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-6 text-center text-sm text-muted-foreground">
                      {t("panelNotificationCampaigns.preview.empty")}
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-border/70 bg-background/30 p-4 text-center">
                          <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.preview.totalUsers")}</div>
                          <div className="mt-2 text-2xl font-bold text-primary">{formatCount(preview.total)}</div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/30 p-4 text-center">
                          <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.campaignType")}</div>
                          <div className="mt-2 font-bold">{selectedPresetKey ? getPresetLabel(selectedPresetKey) : "—"}</div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/30 p-4 text-center">
                          <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.preview.sampleCount")}</div>
                          <div className="mt-2 font-bold">{formatCount(preview.samples.length)}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {preview.samples.map((sample) => (
                          <div key={`${sample.customer_phone}-${sample.tenant_user_id ?? "x"}`} className="rounded-2xl border border-border/60 bg-background/20 p-4">
                            <div className="flex flex-col-reverse items-end gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="w-full space-y-3 text-start">
                                <div className="font-bold">{sample.customer_name || t("panelNotificationCampaigns.noName")}</div>
                                <div className="flex w-full items-center justify-end gap-1 text-sm text-muted-foreground">
                                  <Phone className="h-4 w-4 shrink-0" />
                                  <PhoneText>{sample.customer_phone}</PhoneText>
                                </div>
                                {selectedCategory === "nutrition" ? (
                                  <div className="flex w-full flex-col items-end gap-1 text-sm text-muted-foreground sm:flex-wrap sm:flex-row sm:justify-end sm:gap-2">
                                    <span className="w-full text-start sm:w-auto">{t("panelNotificationCampaigns.sample.nutritionRequests", { count: formatCount(sample.nutrition_requests_count) })}</span>
                                    <span className="w-full text-start sm:w-auto">{t("panelNotificationCampaigns.sample.nutritionPublishedDiets", { count: formatCount(sample.nutrition_published_diets_count) })}</span>
                                    {(sample.nutrition_active_package_count ?? 0) > 0 ? <span className="w-full text-start sm:w-auto">{t("panelNotificationCampaigns.sample.hasActivePackage")}</span> : null}
                                    {(sample.nutrition_active_diet_count ?? 0) > 0 ? <span className="w-full text-start sm:w-auto">{t("panelNotificationCampaigns.sample.hasActiveDiet")}</span> : null}
                                  </div>
                                ) : (
                                  <div className="flex w-full items-center justify-end gap-1 text-sm text-muted-foreground">
                                    <CalendarClock className="h-4 w-4 shrink-0" />
                                    <span>{formatDate(sample.last_appointment_at)}</span>
                                  </div>
                                )}
                                {selectedCategory === "store" && (sample.store_orders_count ?? 0) > 0 ? (
                                  <div className="w-full text-start text-sm text-muted-foreground">
                                    {t("panelNotificationCampaigns.sample.storeSummary", {
                                      orders: formatCount(sample.store_orders_count),
                                      amount: formatValue.currency(sample.store_total_amount ?? 0),
                                    })}
                                  </div>
                                ) : null}
                                {selectedCategory === "nutrition" && sample.latest_nutrition_activity_at ? (
                                  <div className="w-full text-start text-sm text-muted-foreground">
                                    {t("panelNotificationCampaigns.sample.latestNutritionActivity", { date: formatDate(sample.latest_nutrition_activity_at) })}
                                  </div>
                                ) : null}
                              </div>
                              <Badge variant="secondary" className="self-start sm:self-auto">
                                {selectedCategory === "nutrition"
                                  ? t("panelNotificationCampaigns.sample.courseCount", { count: formatCount(sample.nutrition_requests_count) })
                                  : t("panelNotificationCampaigns.sample.visitCount", { count: formatCount(sample.appointments_count) })}
                              </Badge>
                            </div>
                            {selectedCategory !== "nutrition" ? (
                              <div className="mt-3 flex w-full items-center justify-end gap-1 text-start text-sm text-muted-foreground sm:justify-start">
                                <Layers3 className="h-4 w-4 shrink-0" />
                                <span>{sample.last_service_name || t("panelNotificationCampaigns.noService")}</span>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant="outline" onClick={() => goToStep(2)} className="hidden md:inline-flex">
                    {t("panelNotificationCampaigns.previousStep")}
                  </Button>
                  <Button type="button" onClick={() => goToStep(4)} disabled={!hasPreviewResult || previewLoading}>
                    {t("panelNotificationCampaigns.nextSendStep")}
                  </Button>
                </div>
              </>
            ) : null}

            {currentStep === 4 ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-3xl border border-border/70 bg-background/20 p-4 text-start">
                    <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.audienceCategory")}</div>
                    <div className="mt-2 font-bold">{selectedCategory ? getCategoryTitle(selectedCategory) : t("panelNotificationCampaigns.notSelected")}</div>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background/20 p-4 text-start">
                    <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.campaignType")}</div>
                    <div className="mt-2 font-bold">{selectedPresetKey ? getPresetLabel(selectedPresetKey) : t("panelNotificationCampaigns.notSelected")}</div>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background/20 p-4 text-start">
                    <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.recipientsCount")}</div>
                    <div className="mt-2 font-bold">{formatCount(preview?.total ?? 0)}</div>
                  </div>
                </div>

                <div className="space-y-1 text-start">
                  <div className="text-base font-bold">{t("panelNotificationCampaigns.step.send.fullTitle")}</div>
                  <div className="text-sm leading-7 text-muted-foreground">{t("panelNotificationCampaigns.step.send.longDescription")}</div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("panelNotificationCampaigns.form.name")}</label>
                  <Input
                    value={campaignName}
                    onChange={(event) => setCampaignName(event.target.value)}
                    placeholder={t("panelNotificationCampaigns.form.namePlaceholder")}
                    className="text-start"
                    dir={dir}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("panelNotificationCampaigns.form.title")}</label>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={t("panelNotificationCampaigns.form.titlePlaceholder")}
                    className="text-start"
                    dir={dir}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("panelNotificationCampaigns.form.message")}</label>
                  <Textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={t("panelNotificationCampaigns.form.messagePlaceholder")}
                    className="min-h-32 text-start"
                    dir={dir}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant="outline" onClick={() => goToStep(3)}>
                    {t("panelNotificationCampaigns.previousStep")}
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={creating || !campaignName.trim() || !title.trim() || !message.trim() || !hasPreviewResult}
                    className="w-full sm:w-auto"
                  >
                    {creating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4" />}
                    {t("panelNotificationCampaigns.form.submit")}
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("panelNotificationCampaigns.history.title")}</CardTitle>
            <CardDescription>{t("panelNotificationCampaigns.history.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {historyLoading ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("common.loading")}
              </div>
            ) : history.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-6 text-center text-sm text-muted-foreground">
                {t("panelNotificationCampaigns.history.empty")}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {history.items.map((campaign) => (
                    <div key={campaign.id} className="rounded-2xl border border-border/70 bg-background/25 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2 text-start">
                          <div className="font-bold">{campaign.name}</div>
                          <div className="text-sm text-muted-foreground">{PRESET_LABEL_KEYS[campaign.presetKey] ? getPresetLabel(campaign.presetKey) : campaign.presetKey}</div>
                          <div className="text-sm font-medium">{campaign.title}</div>
                          <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-muted-foreground">
                            <span className="inline-flex flex-row-reverse items-center gap-1">
                              <Users className="h-4 w-4" />
                              {t("panelNotificationCampaigns.count.recipients", { count: formatCount(campaign.recipientsCount) })}
                            </span>
                            <span className="inline-flex flex-row-reverse items-center gap-1">
                              <Send className="h-4 w-4" />
                              {t("panelNotificationCampaigns.count.success", { count: formatCount(campaign.successCount) })}
                            </span>
                            <span className="inline-flex flex-row-reverse items-center gap-1">
                              <BadgePercent className="h-4 w-4" />
                              {t("panelNotificationCampaigns.count.failed", { count: formatCount(campaign.failedCount) })}
                            </span>
                          </div>
                        </div>
                        <Badge variant={STATUS_VARIANTS[campaign.status] ?? "secondary"}>
                          {STATUS_LABEL_KEYS[campaign.status] ? getStatusLabel(campaign.status) : campaign.status}
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.history.createdAt", { date: formatDate(campaign.createdAt) })}</div>
                        <Button variant="outline" size="sm" onClick={() => openDetails(campaign)}>
                          {t("panelNotificationCampaigns.history.report")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {history.lastPage > 1 && (
                  <Pagination dir={dir}>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (history.currentPage > 1) void loadHistory(history.currentPage - 1);
                          }}
                          className={history.currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      <PaginationItem className="px-3 text-sm text-muted-foreground">
                        {t("common.pagination.pageOf", { current: formatValue.number(history.currentPage), total: formatValue.number(history.lastPage) })}
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (history.currentPage < history.lastPage) void loadHistory(history.currentPage + 1);
                          }}
                          className={history.currentPage === history.lastPage ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!selectedCampaign} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
        <DialogContent className="max-w-4xl" dir={dir}>
          <DialogHeader>
            <DialogTitle>{selectedCampaign?.campaign.name}</DialogTitle>
          </DialogHeader>

          {detailsLoading || !selectedCampaign ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="me-2 h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Card className="border-border/70 bg-card/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.details.totalRecipients")}</div>
                    <div className="mt-2 text-xl font-bold">{formatCount(selectedCampaign.campaign.recipientsCount)}</div>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.details.success")}</div>
                    <div className="mt-2 text-xl font-bold text-primary">{formatCount(selectedCampaign.campaign.successCount)}</div>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.details.failed")}</div>
                    <div className="mt-2 text-xl font-bold text-destructive">{formatCount(selectedCampaign.campaign.failedCount)}</div>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.details.cancelled")}</div>
                    <div className="mt-2 text-xl font-bold">{formatCount(selectedCampaign.campaign.cancelledCount)}</div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/70 bg-card/50">
                <CardContent className="space-y-2 p-4">
                  <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.form.title")}</div>
                  <div className="font-bold">{selectedCampaign.campaign.title}</div>
                  <div className="text-sm text-muted-foreground">{t("panelNotificationCampaigns.form.message")}</div>
                  <p className="whitespace-pre-wrap leading-7 text-sm">{selectedCampaign.campaign.message}</p>
                </CardContent>
              </Card>

              <ScrollArea className="h-[320px] rounded-2xl border border-border/70 bg-background/20">
                <div className="space-y-3 p-4">
                  {selectedCampaign.recipients.items.map((recipient) => (
                    <div key={recipient.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2 text-start">
                          <div className="font-bold">{recipient.recipientName || t("panelNotificationCampaigns.noName")}</div>
                          <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-muted-foreground">
                            <span className="inline-flex flex-row-reverse items-center gap-1">
                              <Phone className="h-4 w-4" />
                              <PhoneText>{recipient.recipientPhone}</PhoneText>
                            </span>
                            <span>{formatDate(recipient.lastAppointmentAt)}</span>
                            <span>{t("panelNotificationCampaigns.sample.visitCount", { count: formatCount(recipient.appointmentsCount) })}</span>
                            <span>{t("panelNotificationCampaigns.sample.orderCount", { count: formatCount(recipient.storeOrdersCount) })}</span>
                            <span>{t("panelNotificationCampaigns.sample.purchaseAmount", { amount: formatValue.currency(recipient.storeTotalAmount ?? 0) })}</span>
                          </div>
                          {recipient.errorMessage ? <div className="text-sm text-destructive">{recipient.errorMessage}</div> : null}
                        </div>
                        <Badge variant={recipient.status === "failed" ? "destructive" : "secondary"}>
                          {recipient.status === "pending"
                            ? t("panelNotificationCampaigns.recipientStatus.pending")
                            : recipient.status === "sent"
                              ? t("panelNotificationCampaigns.recipientStatus.sent")
                              : recipient.status === "failed"
                                ? t("panelNotificationCampaigns.recipientStatus.failed")
                                : t("panelNotificationCampaigns.recipientStatus.cancelled")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {selectedCampaign.recipients.lastPage > 1 && (
                <Pagination dir={dir}>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (selectedCampaign.recipients.currentPage > 1) {
                            void openDetails(selectedCampaign.campaign, selectedCampaign.recipients.currentPage - 1);
                          }
                        }}
                        className={selectedCampaign.recipients.currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    <PaginationItem className="px-3 text-sm text-muted-foreground">
                      {t("common.pagination.pageOf", { current: formatValue.number(selectedCampaign.recipients.currentPage), total: formatValue.number(selectedCampaign.recipients.lastPage) })}
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (selectedCampaign.recipients.currentPage < selectedCampaign.recipients.lastPage) {
                            void openDetails(selectedCampaign.campaign, selectedCampaign.recipients.currentPage + 1);
                          }
                        }}
                        className={selectedCampaign.recipients.currentPage === selectedCampaign.recipients.lastPage ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
