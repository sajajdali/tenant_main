import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgePercent,
  CalendarClock,
  Layers3,
  Loader2,
  Megaphone,
  PauseCircle,
  Phone,
  RefreshCcw,
  Send,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { subscribeSmsCampaignUpdates } from "@/lib/realtime";
import type {
  Barber,
  PaginatedSmsCampaigns,
  Section,
  SmsCampaign,
  SmsCampaignDetails,
  SmsCampaignFilters,
  SmsCampaignPresetKey,
  SmsCampaignPreview,
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
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { PhoneText } from "@/i18n/ltr-text";
import type { MessageKey } from "@/i18n/messages";

type PlaceholderOption = {
  token: string;
  label: string;
  sample: string;
};

type AudienceCategory = "booking" | "store" | "nutrition";
type WizardStep = 1 | 2 | 3 | 4;

const PRESET_OPTIONS: Array<{
  key: SmsCampaignPresetKey;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  category: AudienceCategory;
}> = [
  { key: "all_customers", labelKey: "panelSmsCampaigns.preset.allCustomers.label", descriptionKey: "panelSmsCampaigns.preset.allCustomers.description", category: "booking" },
  { key: "by_barber", labelKey: "panelSmsCampaigns.preset.byBarber.label", descriptionKey: "panelSmsCampaigns.preset.byBarber.description", category: "booking" },
  { key: "by_service", labelKey: "panelSmsCampaigns.preset.byService.label", descriptionKey: "panelSmsCampaigns.preset.byService.description", category: "booking" },
  { key: "inactive_customers", labelKey: "panelSmsCampaigns.preset.inactiveCustomers.label", descriptionKey: "panelSmsCampaigns.preset.inactiveCustomers.description", category: "booking" },
  { key: "inactive_service_customers", labelKey: "panelSmsCampaigns.preset.inactiveServiceCustomers.label", descriptionKey: "panelSmsCampaigns.preset.inactiveServiceCustomers.description", category: "booking" },
  { key: "single_visit", labelKey: "panelSmsCampaigns.preset.singleVisit.label", descriptionKey: "panelSmsCampaigns.preset.singleVisit.description", category: "booking" },
  { key: "loyal_customers", labelKey: "panelSmsCampaigns.preset.loyalCustomers.label", descriptionKey: "panelSmsCampaigns.preset.loyalCustomers.description", category: "booking" },
  { key: "cancelled_appointments", labelKey: "panelSmsCampaigns.preset.cancelledAppointments.label", descriptionKey: "panelSmsCampaigns.preset.cancelledAppointments.description", category: "booking" },
  { key: "booked_for_others", labelKey: "panelSmsCampaigns.preset.bookedForOthers.label", descriptionKey: "panelSmsCampaigns.preset.bookedForOthers.description", category: "booking" },
  { key: "new_customers", labelKey: "panelSmsCampaigns.preset.newCustomers.label", descriptionKey: "panelSmsCampaigns.preset.newCustomers.description", category: "booking" },
  { key: "at_risk_customers", labelKey: "panelSmsCampaigns.preset.atRiskCustomers.label", descriptionKey: "panelSmsCampaigns.preset.atRiskCustomers.description", category: "booking" },
  { key: "store_customers", labelKey: "panelSmsCampaigns.preset.storeCustomers.label", descriptionKey: "panelSmsCampaigns.preset.storeCustomers.description", category: "store" },
  { key: "store_paid_customers", labelKey: "panelSmsCampaigns.preset.storePaidCustomers.label", descriptionKey: "panelSmsCampaigns.preset.storePaidCustomers.description", category: "store" },
  { key: "store_pending_customers", labelKey: "panelSmsCampaigns.preset.storePendingCustomers.label", descriptionKey: "panelSmsCampaigns.preset.storePendingCustomers.description", category: "store" },
  { key: "store_no_orders", labelKey: "panelSmsCampaigns.preset.storeNoOrders.label", descriptionKey: "panelSmsCampaigns.preset.storeNoOrders.description", category: "store" },
  { key: "high_value_store_customers", labelKey: "panelSmsCampaigns.preset.highValueStoreCustomers.label", descriptionKey: "panelSmsCampaigns.preset.highValueStoreCustomers.description", category: "store" },
  { key: "nutrition_no_diets", labelKey: "panelSmsCampaigns.preset.nutritionNoDiets.label", descriptionKey: "panelSmsCampaigns.preset.nutritionNoDiets.description", category: "nutrition" },
  { key: "nutrition_has_diets", labelKey: "panelSmsCampaigns.preset.nutritionHasDiets.label", descriptionKey: "panelSmsCampaigns.preset.nutritionHasDiets.description", category: "nutrition" },
  { key: "nutrition_session_number", labelKey: "panelSmsCampaigns.preset.nutritionSessionNumber.label", descriptionKey: "panelSmsCampaigns.preset.nutritionSessionNumber.description", category: "nutrition" },
  { key: "nutrition_package_expired", labelKey: "panelSmsCampaigns.preset.nutritionPackageExpired.label", descriptionKey: "panelSmsCampaigns.preset.nutritionPackageExpired.description", category: "nutrition" },
  { key: "nutrition_package_active", labelKey: "panelSmsCampaigns.preset.nutritionPackageActive.label", descriptionKey: "panelSmsCampaigns.preset.nutritionPackageActive.description", category: "nutrition" },
  { key: "nutrition_active_diet", labelKey: "panelSmsCampaigns.preset.nutritionActiveDiet.label", descriptionKey: "panelSmsCampaigns.preset.nutritionActiveDiet.description", category: "nutrition" },
  { key: "nutrition_pending_request", labelKey: "panelSmsCampaigns.preset.nutritionPendingRequest.label", descriptionKey: "panelSmsCampaigns.preset.nutritionPendingRequest.description", category: "nutrition" },
];

const PRESET_LABEL_KEYS = Object.fromEntries(PRESET_OPTIONS.map((item) => [item.key, item.labelKey])) as Record<SmsCampaignPresetKey, MessageKey>;

const STATUS_LABEL_KEYS: Record<string, MessageKey> = {
  pending_review: "panelSmsCampaigns.status.pendingReview",
  rejected: "panelSmsCampaigns.status.rejected",
  queued: "panelSmsCampaigns.status.queued",
  sending: "panelSmsCampaigns.status.sending",
  paused: "panelSmsCampaigns.status.paused",
  completed: "panelSmsCampaigns.status.completed",
  cancelled: "panelSmsCampaigns.status.cancelled",
  failed: "panelSmsCampaigns.status.failed",
  draft: "panelSmsCampaigns.status.draft",
};

const STATUS_VARIANTS: Record<string, "secondary" | "destructive" | "default"> = {
  pending_review: "secondary",
  rejected: "destructive",
  queued: "secondary",
  sending: "default",
  paused: "secondary",
  completed: "secondary",
  cancelled: "destructive",
  failed: "destructive",
  draft: "secondary",
};

function requiresBarber(preset: SmsCampaignPresetKey) {
  return ["by_barber", "inactive_service_customers"].includes(preset);
}

function requiresService(preset: SmsCampaignPresetKey) {
  return ["by_service", "inactive_service_customers"].includes(preset);
}

function requiresInactiveMonths(preset: SmsCampaignPresetKey) {
  return ["inactive_customers", "inactive_service_customers", "at_risk_customers"].includes(preset);
}

function requiresNewCustomerDays(preset: SmsCampaignPresetKey) {
  return preset === "new_customers";
}

function requiresLoyalCount(preset: SmsCampaignPresetKey) {
  return preset === "loyal_customers";
}

function requiresStoreMinAmount(preset: SmsCampaignPresetKey) {
  return preset === "high_value_store_customers";
}

function requiresNutritionSessionNumber(preset: SmsCampaignPresetKey) {
  return preset === "nutrition_session_number";
}

function getCategoryForPreset(preset: SmsCampaignPresetKey): AudienceCategory {
  return PRESET_OPTIONS.find((option) => option.key === preset)?.category ?? "booking";
}

function getCategoryTitle(category: AudienceCategory, t: (key: MessageKey) => string) {
  if (category === "store") {
    return t("panelSmsCampaigns.category.store.title");
  }

  if (category === "nutrition") {
    return t("panelSmsCampaigns.category.nutrition.title");
  }

  return t("panelSmsCampaigns.category.booking.title");
}

export default function PanelSmsCampaignsPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const { barbers, sections } = useStore();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const labels = getAudienceLabels(tenantMeta);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [selectedCategory, setSelectedCategory] = useState<AudienceCategory | null>(null);
  const [selectedPresetKey, setSelectedPresetKey] = useState<SmsCampaignPresetKey | null>(null);
  const [filters, setFilters] = useState<SmsCampaignFilters>({
    preset: "all_customers",
    inactive_months: 2,
    new_customer_days: 30,
    loyal_min_appointments: 3,
  });
  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<SmsCampaignPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [editMessageModalOpen, setEditMessageModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<SmsCampaignDetails | null>(null);
  const stepRefs = useRef<Partial<Record<WizardStep, HTMLButtonElement | null>>>({});
  const [history, setHistory] = useState<PaginatedSmsCampaigns>({
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
    if (!filters.barber_id) {
      return sections;
    }

    return sections.filter((section) => Number(section.barberId) === filters.barber_id);
  }, [filters.barber_id, sections]);

  const bookingPresets = PRESET_OPTIONS.filter((option) => option.category === "booking");
  const storePresets = PRESET_OPTIONS.filter((option) => option.category === "store");
  const nutritionPresets = PRESET_OPTIONS.filter((option) => option.category === "nutrition");
  const activePreset = selectedPresetKey ?? filters.preset;
  const shouldHideBarberSelect = selectedPresetKey !== null && requiresBarber(activePreset) && barbers.length <= 1;
  const shouldHideServiceSelect = selectedPresetKey !== null && requiresService(activePreset) && filteredSections.length <= 1;
  const campaignPlaceholderOptions = useMemo<PlaceholderOption[]>(
    () => [
      { token: "{{customer_name}}", label: t("panelSmsCampaigns.placeholders.customerName"), sample: t("panelSmsCampaigns.placeholders.customerNameSample") },
    ],
    [t],
  );

  const selectedPreset = selectedPresetKey ? PRESET_OPTIONS.find((option) => option.key === selectedPresetKey) : null;
  const hasPreviewResult = !!preview && preview.total > 0;
  const wizardSteps: Array<{
    step: WizardStep;
    titleKey: MessageKey;
    descriptionKey: MessageKey;
  }> = [
    { step: 1, titleKey: "panelSmsCampaigns.wizard.step1.title", descriptionKey: "panelSmsCampaigns.wizard.step1.description" },
    { step: 2, titleKey: "panelSmsCampaigns.wizard.step2.title", descriptionKey: "panelSmsCampaigns.wizard.step2.description" },
    { step: 3, titleKey: "panelSmsCampaigns.wizard.step3.title", descriptionKey: "panelSmsCampaigns.wizard.step3.description" },
    { step: 4, titleKey: "panelSmsCampaigns.wizard.step4.title", descriptionKey: "panelSmsCampaigns.wizard.step4.description" },
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
        titleKey: "panelSmsCampaigns.category.booking.boxTitle",
        descriptionKey: "panelSmsCampaigns.category.booking.description",
        accentClass: "border-primary bg-primary/10",
      },
      {
        key: "store",
        titleKey: "panelSmsCampaigns.category.store.boxTitle",
        descriptionKey: "panelSmsCampaigns.category.store.description",
        accentClass: "border-sky-500/40 bg-sky-500/10",
      },
    ];

    if (isNutritionAudience) {
      base.push({
        key: "nutrition",
        titleKey: "panelSmsCampaigns.category.nutrition.boxTitle",
        descriptionKey: "panelSmsCampaigns.category.nutrition.description",
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
  const formatDateOrMissing = (date?: string | null) => date ? format.date(date) : t("common.valueMissing");
  const formatIranToman = (value?: number | null) => t("panelSmsCampaigns.units.iranToman", { value: format.number(value ?? 0) });
  const getPresetLabel = (preset: SmsCampaignPresetKey) => t(PRESET_LABEL_KEYS[preset]);
  const getStatusLabel = (status: string) => STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : status;

  const canOpenStep = (step: WizardStep) => {
    if (step === 1) {
      return true;
    }

    if (step === 2) {
      return selectedCategory !== null;
    }

    if (step === 3) {
      return selectedCategory !== null && selectedPresetKey !== null && !storeCategoryLocked;
    }

    return selectedCategory !== null && selectedPresetKey !== null && hasPreviewResult && !storeCategoryLocked;
  };

  const goToStep = (step: WizardStep) => {
    if (step <= currentStep || canOpenStep(step)) {
      setCurrentStep(step);
    }
  };

  useEffect(() => {
    const activeStep = stepRefs.current[currentStep];

    if (!activeStep) {
      return;
    }

    activeStep.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [currentStep]);

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

  const selectPreset = (preset: SmsCampaignPresetKey) => {
    setSelectedPresetKey(preset);
    setFilters((current) => ({ ...current, preset }));
    setPreview(null);
    setCurrentStep(3);
  };

  const loadHistory = async (page = 1) => {
    setHistoryLoading(true);
    const res = await api.smsCampaigns.list(page, 10);
    if (res.success) {
      setHistory(res.data);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadHistory(1);
  }, [isAdmin]);

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) {
        setTenantMeta(res.data);
      }
    });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    return subscribeSmsCampaignUpdates((payload) => {
      const campaign = payload.campaign as unknown as SmsCampaign;

      setHistory((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === campaign.id ? { ...item, ...campaign } : item)),
      }));

      if (selectedCampaign?.campaign.id === campaign.id) {
        openDetails(campaign, selectedCampaign.recipients.currentPage);
      }
    });
  }, [isAdmin, selectedCampaign]);

  useEffect(() => {
    if (!selectedPresetKey) {
      return;
    }

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

  const handlePreview = async () => {
    setPreviewLoading(true);
    const res = await api.smsCampaigns.preview({ ...filters, message });
    if (res.success) {
      setPreview(res.data);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setPreviewLoading(false);
  };

  useEffect(() => {
    if (!selectedCategory || !selectedPresetKey) {
      return;
    }

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

  const handleCreate = async () => {
    if (!editingCampaignId && (!preview || preview.total === 0)) {
      toast({ variant: "destructive", title: t("common.error"), description: t("panelSmsCampaigns.toast.previewRequired") });
      return;
    }

    setCreating(true);
    const payload = {
      name: campaignName,
      message,
      filters,
    };
    const res = editingCampaignId
      ? await api.smsCampaigns.update(editingCampaignId, payload)
      : await api.smsCampaigns.create(payload);
    setCreating(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    toast({ title: editingCampaignId ? t("panelSmsCampaigns.toast.updated") : t("panelSmsCampaigns.toast.created"), description: res.message });
    resetEditor();
    await loadHistory(1);
  };

  const startEditing = (campaign: SmsCampaign) => {
    setEditingCampaignId(campaign.id);
    setCampaignName(campaign.name);
    setMessage(campaign.message);
    setFilters({
      preset: campaign.filters.preset,
      barber_id: campaign.filters.barber_id,
      service_id: campaign.filters.service_id,
      inactive_months: campaign.filters.inactive_months,
      new_customer_days: campaign.filters.new_customer_days,
      loyal_min_appointments: campaign.filters.loyal_min_appointments,
      min_store_total_amount: campaign.filters.min_store_total_amount,
      nutrition_session_number: campaign.filters.nutrition_session_number,
    });
    setEditMessageModalOpen(true);
  };

  const resetEditor = () => {
    setCurrentStep(1);
    setEditingCampaignId(null);
    setEditMessageModalOpen(false);
    setCampaignName("");
    setMessage("");
    setPreview(null);
    setSelectedCategory(null);
    setSelectedPresetKey(null);
    setFilters({
      preset: "all_customers",
      inactive_months: 2,
      new_customer_days: 30,
      loyal_min_appointments: 3,
    });
  };

  const insertCampaignPlaceholder = (token: string) => {
    setMessage((current) => `${current}${current.trim() ? " " : ""}${token}`);
  };

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  const openDetails = async (campaign: SmsCampaign, page = 1) => {
    setDetailsLoading(true);
    const res = await api.smsCampaigns.details(campaign.id, page, 10);
    if (res.success) {
      setSelectedCampaign(res.data);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setDetailsLoading(false);
  };

  const handleCancel = async (campaign: SmsCampaign) => {
    const confirmationMessage =
      campaign.status === "pending_review"
        ? t("panelSmsCampaigns.confirm.cancelPending")
        : t("panelSmsCampaigns.confirm.stopSending");

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setCancellingId(campaign.id);
    const res = await api.smsCampaigns.cancel(campaign.id);
    setCancellingId(null);
    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    toast({ title: t("panelSmsCampaigns.toast.stopped"), description: res.message });
    await loadHistory(history.currentPage);
    if (selectedCampaign?.campaign.id === campaign.id) {
      await openDetails(campaign);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <Megaphone className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{t("panelSmsCampaigns.access.title")}</h1>
          <p className="text-muted-foreground leading-7">{t("panelSmsCampaigns.access.description")}</p>
          <Link href="/panel">
            <Button>{t("panelSmsCampaigns.access.back")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("panelSmsCampaigns.header.title")}</h1>
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
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">{t("panelSmsCampaigns.editor.title")}</CardTitle>
                <CardDescription>
                  {t("panelSmsCampaigns.editor.description", { current: format.number(currentStep), total: format.number(4) })}
                </CardDescription>
              </div>
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
                        {isDone ? t("panelSmsCampaigns.wizard.editable") : t("panelSmsCampaigns.wizard.stepLabel", { step: format.number(stepItem.step) })}
                      </span>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${isActive ? "bg-primary text-primary-foreground" : isDone ? "bg-emerald-500 text-white" : "bg-muted text-foreground"}`}>
                        {format.number(stepItem.step)}
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
                  <div className="text-base font-bold">{t("panelSmsCampaigns.step1.title")}</div>
                  <div className="text-sm leading-7 text-muted-foreground">{t("panelSmsCampaigns.step1.description")}</div>
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
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.summary.selectedCategory")}</div>
                    <div className="font-bold">{selectedCategory ? getCategoryTitle(selectedCategory, t) : t("panelSmsCampaigns.common.notSelected")}</div>
                  </div>
                  <Button type="button" variant="outline" onClick={() => goToStep(1)}>
                    {t("panelSmsCampaigns.actions.previousStep")}
                  </Button>
                </div>

                <div className="space-y-1 text-start">
                  <div className="text-base font-bold">{t("panelSmsCampaigns.step2.title")}</div>
                  <div className="text-sm leading-7 text-muted-foreground">{t("panelSmsCampaigns.step2.description")}</div>
                </div>

                {storeCategoryLocked ? (
                  <div className="rounded-3xl border border-amber-500/25 bg-amber-500/10 p-5 text-start">
                    <div className="text-lg font-bold text-foreground">{t("panelSmsCampaigns.storeLocked.title")}</div>
                    <div className="mt-2 text-sm leading-8 text-muted-foreground">
                      {t("panelSmsCampaigns.storeLocked.description")}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                      <Link href="/panel/special-features/online-store">
                        <Button type="button">{t("panelSmsCampaigns.storeLocked.cta")}</Button>
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
                        {t("panelSmsCampaigns.step2.chooseCategoryFirst")}
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
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.summary.category")}</div>
                    <div className="mt-2 font-bold">{selectedCategory ? getCategoryTitle(selectedCategory, t) : t("panelSmsCampaigns.common.notSelected")}</div>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background/20 p-4 text-start">
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.summary.selectedList")}</div>
                    <div className="mt-2 font-bold">{selectedPreset ? t(selectedPreset.labelKey) : t("panelSmsCampaigns.common.notSelected")}</div>
                  </div>
                  <div className="flex items-center justify-end gap-2 rounded-3xl border border-border/70 bg-background/20 p-4">
                    <Button type="button" variant="outline" onClick={() => goToStep(2)}>
                      {t("panelSmsCampaigns.actions.editPreviousStep")}
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-border/70 bg-background/20 p-4">
                  <div className="space-y-1 text-start">
                    <div className="text-base font-bold">{t("panelSmsCampaigns.step3.title")}</div>
                    <div className="text-sm leading-7 text-muted-foreground">
                      {selectedCategory && selectedPreset
                        ? t("panelSmsCampaigns.step3.selectedDescription", { category: getCategoryTitle(selectedCategory, t) })
                        : t("panelSmsCampaigns.step3.emptyDescription")}
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
                          <option value="">{t("panelSmsCampaigns.common.choose")}</option>
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
                        <label className="text-sm font-medium">{t("panelSmsCampaigns.filters.section")}</label>
                        <select
                          value={filters.service_id ?? ""}
                          onChange={(event) => setFilters((current) => ({
                            ...current,
                            service_id: event.target.value ? Number(event.target.value) : undefined,
                          }))}
                          className="w-full appearance-none rounded-md border border-border bg-background p-2 pe-10 ps-3 text-start"
                          dir={dir}
                        >
                          <option value="">{t("panelSmsCampaigns.common.choose")}</option>
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
                        <label className="text-sm font-medium">{t("panelSmsCampaigns.filters.inactiveMonths")}</label>
                        <Input
                          type="number"
                          min={1}
                          max={24}
                          value={filters.inactive_months ?? 2}
                          onChange={(event) => setFilters((current) => ({ ...current, inactive_months: Number(event.target.value || 2) }))}
                          className="text-start"
                          dir="ltr"
                        />
                      </div>
                    )}

                    {selectedPresetKey && requiresNewCustomerDays(activePreset) && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("panelSmsCampaigns.filters.newCustomerDays")}</label>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={filters.new_customer_days ?? 30}
                          onChange={(event) => setFilters((current) => ({ ...current, new_customer_days: Number(event.target.value || 30) }))}
                          className="text-start"
                          dir="ltr"
                        />
                      </div>
                    )}

                    {selectedPresetKey && requiresLoyalCount(activePreset) && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("panelSmsCampaigns.filters.loyalMinAppointments")}</label>
                        <Input
                          type="number"
                          min={2}
                          max={100}
                          value={filters.loyal_min_appointments ?? 3}
                          onChange={(event) => setFilters((current) => ({ ...current, loyal_min_appointments: Number(event.target.value || 3) }))}
                          className="text-start"
                          dir="ltr"
                        />
                      </div>
                    )}

                    {selectedPresetKey && requiresStoreMinAmount(activePreset) && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("panelSmsCampaigns.filters.minStoreAmount")}</label>
                        <Input
                          type="number"
                          min={1}
                          value={filters.min_store_total_amount ?? 1000000}
                          onChange={(event) => setFilters((current) => ({ ...current, min_store_total_amount: Number(event.target.value || 1000000) }))}
                          className="text-start"
                          dir="ltr"
                        />
                      </div>
                    )}

                    {selectedPresetKey && requiresNutritionSessionNumber(activePreset) && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("panelSmsCampaigns.filters.nutritionSessionNumber")}</label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={filters.nutrition_session_number ?? 2}
                          onChange={(event) => setFilters((current) => ({ ...current, nutrition_session_number: Number(event.target.value || 2) }))}
                          className="text-start"
                          dir="ltr"
                        />
                      </div>
                    )}
                  </div>

                  {selectedPresetKey ? (
                    <div className="text-sm text-muted-foreground">
                      {t("panelSmsCampaigns.step3.autoRefreshHint")}
                    </div>
                  ) : null}

                  {previewLoading && selectedPresetKey ? (
                    <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/20 text-sm text-muted-foreground">
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      {t("panelSmsCampaigns.step3.refreshing")}
                    </div>
                  ) : !preview ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-6 text-center text-sm text-muted-foreground">
                      {t("panelSmsCampaigns.step3.noReport")}
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-border/70 bg-background/30 p-4 text-center">
                          <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.preview.userCount")}</div>
                          <div className="mt-2 text-2xl font-bold text-primary">{format.number(preview.total)}</div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/30 p-4 text-center">
                          <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.preview.campaignType")}</div>
                          <div className="mt-2 font-bold">{selectedPresetKey ? getPresetLabel(selectedPresetKey) : t("common.valueMissing")}</div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/30 p-4 text-center">
                          <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.preview.sampleCount")}</div>
                          <div className="mt-2 font-bold">{format.number(preview.samples.length)}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {preview.samples.map((sample) => (
                          <div key={`${sample.customer_phone}-${sample.last_appointment_at}`} className="rounded-2xl border border-border/60 bg-background/20 p-4">
                            <div className="flex flex-col-reverse items-end gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="w-full space-y-3 text-start">
                                <div className="font-bold">{sample.customer_name || t("panelSmsCampaigns.common.noName")}</div>
                                <div className="flex w-full items-center justify-end gap-1 text-sm text-muted-foreground">
                                  <Phone className="h-4 w-4 shrink-0" />
                                  <PhoneText>{sample.customer_phone}</PhoneText>
                                </div>
                                {selectedCategory === "nutrition" ? (
                                  <div className="flex w-full flex-col items-end gap-1 text-sm text-muted-foreground sm:flex-wrap sm:flex-row sm:justify-end sm:gap-2">
                                    <span className="w-full text-start sm:w-auto">{t("panelSmsCampaigns.sample.nutritionRequests", { count: format.number(sample.nutrition_requests_count ?? 0) })}</span>
                                    <span className="w-full text-start sm:w-auto">{t("panelSmsCampaigns.sample.publishedDiets", { count: format.number(sample.nutrition_published_diets_count ?? 0) })}</span>
                                    {(sample.nutrition_active_package_count ?? 0) > 0 ? <span className="w-full text-start sm:w-auto">{t("panelSmsCampaigns.sample.hasActivePackage")}</span> : null}
                                    {(sample.nutrition_active_diet_count ?? 0) > 0 ? <span className="w-full text-start sm:w-auto">{t("panelSmsCampaigns.sample.hasActiveDiet")}</span> : null}
                                  </div>
                                ) : (
                                  <div className="flex w-full items-center justify-end gap-1 text-sm text-muted-foreground">
                                    <CalendarClock className="h-4 w-4 shrink-0" />
                                    <span>{formatDateOrMissing(sample.last_appointment_at)}</span>
                                  </div>
                                )}
                                {selectedCategory === "store" && (sample.store_orders_count ?? 0) > 0 ? (
                                  <div className="w-full text-start text-sm text-muted-foreground">
                                    {t("panelSmsCampaigns.sample.storeSummary", {
                                      count: format.number(sample.store_orders_count ?? 0),
                                      amount: formatIranToman(sample.store_total_amount ?? 0),
                                    })}
                                  </div>
                                ) : null}
                                {selectedCategory === "nutrition" && sample.latest_nutrition_activity_at ? (
                                  <div className="w-full text-start text-sm text-muted-foreground">
                                    {t("panelSmsCampaigns.sample.latestNutritionActivity", { date: formatDateOrMissing(sample.latest_nutrition_activity_at) })}
                                  </div>
                                ) : null}
                              </div>
                              <Badge variant="secondary" className="self-start sm:self-auto">
                                {selectedCategory === "nutrition"
                                  ? t("panelSmsCampaigns.sample.dietCourseCount", { count: format.number(sample.nutrition_requests_count ?? 0) })
                                  : t("panelSmsCampaigns.sample.appointmentCount", { count: format.number(sample.appointments_count) })}
                              </Badge>
                            </div>
                            {selectedCategory !== "nutrition" ? (
                              <div className="mt-3 flex w-full items-center justify-end gap-1 text-start text-sm text-muted-foreground sm:justify-start">
                                <Layers3 className="h-4 w-4 shrink-0" />
                                <span>{sample.last_service_name || t("panelSmsCampaigns.common.noSection")}</span>
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
                    {t("panelSmsCampaigns.actions.previousStep")}
                  </Button>
                  <Button type="button" onClick={() => goToStep(4)} disabled={!hasPreviewResult || previewLoading}>
                    {t("panelSmsCampaigns.actions.nextSubmit")}
                  </Button>
                </div>
              </>
            ) : null}

            {currentStep === 4 ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-3xl border border-border/70 bg-background/20 p-4 text-start">
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.summary.category")}</div>
                    <div className="mt-2 font-bold">{selectedCategory ? getCategoryTitle(selectedCategory, t) : t("panelSmsCampaigns.common.notSelected")}</div>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background/20 p-4 text-start">
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.preview.campaignType")}</div>
                    <div className="mt-2 font-bold">{selectedPresetKey ? getPresetLabel(selectedPresetKey) : t("panelSmsCampaigns.common.notSelected")}</div>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background/20 p-4 text-start">
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.summary.recipients")}</div>
                    <div className="mt-2 font-bold">{format.number(preview?.total ?? 0)}</div>
                  </div>
                </div>

                <div className="space-y-1 text-start">
                  <div className="text-base font-bold">{t("panelSmsCampaigns.step4.title")}</div>
                  <div className="text-sm leading-7 text-muted-foreground">{t("panelSmsCampaigns.step4.description")}</div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("panelSmsCampaigns.form.name")}</label>
                  <Input
                    value={campaignName}
                    onChange={(event) => setCampaignName(event.target.value)}
                    placeholder={t("panelSmsCampaigns.form.namePlaceholder")}
                    className="text-start"
                    dir={dir}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("panelSmsCampaigns.form.message")}</label>
                  <Textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={t("panelSmsCampaigns.form.messagePlaceholder")}
                    className="min-h-32 text-start"
                    dir={dir}
                  />
                  <div className="space-y-3">
                    <div className="text-sm font-bold">{t("panelSmsCampaigns.placeholders.title")}</div>
                    <div className="flex flex-wrap gap-2">
                      {campaignPlaceholderOptions.map((item) => (
                        <button
                          key={item.token}
                          type="button"
                          onClick={() => insertCampaignPlaceholder(item.token)}
                          className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/10"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3 text-sm leading-7 text-muted-foreground">
                      {t("panelSmsCampaigns.placeholders.customerNameFallbackPrefix")} <code dir="ltr">{"{{customer_name}}"}</code> {t("panelSmsCampaigns.placeholders.customerNameFallbackSuffix")}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => goToStep(3)}>
                      {t("panelSmsCampaigns.actions.previousStep")}
                    </Button>
                  </div>
                  <Button
                    onClick={handleCreate}
                    disabled={creating || !campaignName.trim() || !message.trim() || !hasPreviewResult}
                    className="w-full sm:w-auto"
                  >
                    {creating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4" />}
                    {t("panelSmsCampaigns.actions.create")}
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("panelSmsCampaigns.history.title")}</CardTitle>
            <CardDescription>{t("panelSmsCampaigns.history.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {historyLoading ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("common.loading")}
              </div>
            ) : history.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-6 text-center text-sm text-muted-foreground">
                {t("panelSmsCampaigns.history.empty")}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {history.items.map((campaign) => (
                    <div key={campaign.id} className="rounded-2xl border border-border/70 bg-background/25 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2 text-start">
                          <div className="font-bold">{campaign.name}</div>
                          <div className="text-sm text-muted-foreground">{getPresetLabel(campaign.presetKey)}</div>
                          <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-muted-foreground">
                            <span className="inline-flex flex-row-reverse items-center gap-1">
                              <Users className="h-4 w-4" />
                              {t("panelSmsCampaigns.history.recipientsCount", { count: format.number(campaign.recipientsCount) })}
                            </span>
                            <span className="inline-flex flex-row-reverse items-center gap-1">
                              <Send className="h-4 w-4" />
                              {t("panelSmsCampaigns.history.successCount", { count: format.number(campaign.successCount) })}
                            </span>
                            <span className="inline-flex flex-row-reverse items-center gap-1">
                              <BadgePercent className="h-4 w-4" />
                              {t("panelSmsCampaigns.history.failedCount", { count: format.number(campaign.failedCount) })}
                            </span>
                            <span>{t("panelSmsCampaigns.history.estimated", { amount: formatIranToman(campaign.estimatedTotalPrice) })}</span>
                            <span>{t("panelSmsCampaigns.history.spent", { amount: formatIranToman(campaign.spentTotalPrice) })}</span>
                          </div>
                          {campaign.rejectionReason ? (
                            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                              {t("panelSmsCampaigns.history.rejectionReason", { reason: campaign.rejectionReason })}
                            </div>
                          ) : null}
                        </div>
                        <Badge variant={STATUS_VARIANTS[campaign.status] ?? "secondary"}>
                          {getStatusLabel(campaign.status)}
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground">
                          {t("panelSmsCampaigns.history.createdAt", { date: formatDateOrMissing(campaign.createdAt) })}
                        </div>
                        <div className="flex items-center gap-2">
                          {(campaign.status === "pending_review" || campaign.status === "queued" || campaign.status === "sending") && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancel(campaign)}
                              disabled={cancellingId === campaign.id}
                            >
                              {cancellingId === campaign.id ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <PauseCircle className="me-2 h-4 w-4" />}
                              {campaign.status === "pending_review" ? t("panelSmsCampaigns.actions.cancelCampaign") : t("panelSmsCampaigns.actions.stopSending")}
                            </Button>
                          )}
                          {campaign.status === "rejected" && (
                            <Button variant="outline" size="sm" onClick={() => startEditing(campaign)}>
                              <RefreshCcw className="me-2 h-4 w-4" />
                              {t("panelSmsCampaigns.actions.editText")}
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openDetails(campaign)}>
                            {t("panelSmsCampaigns.actions.report")}
                          </Button>
                        </div>
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
                            if (history.currentPage > 1) {
                              loadHistory(history.currentPage - 1);
                            }
                          }}
                          className={history.currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                        >
                          {t("panelSmsCampaigns.pagination.previous")}
                        </PaginationPrevious>
                      </PaginationItem>
                      <PaginationItem className="px-3 text-sm text-muted-foreground">
                        {t("panelSmsCampaigns.pagination.pageOf", { current: format.number(history.currentPage), total: format.number(history.lastPage) })}
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (history.currentPage < history.lastPage) {
                              loadHistory(history.currentPage + 1);
                            }
                          }}
                          className={history.currentPage === history.lastPage ? "pointer-events-none opacity-50" : ""}
                        >
                          {t("panelSmsCampaigns.pagination.next")}
                        </PaginationNext>
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
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.details.totalRecipients")}</div>
                    <div className="mt-2 text-xl font-bold">{format.number(selectedCampaign.campaign.recipientsCount)}</div>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.details.success")}</div>
                    <div className="mt-2 text-xl font-bold text-primary">{format.number(selectedCampaign.campaign.successCount)}</div>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.details.failed")}</div>
                    <div className="mt-2 text-xl font-bold text-destructive">{format.number(selectedCampaign.campaign.failedCount)}</div>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.details.cancelled")}</div>
                    <div className="mt-2 text-xl font-bold">{format.number(selectedCampaign.campaign.cancelledCount)}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <Card className="border-border/70 bg-card/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.details.messageType")}</div>
                    <div className="mt-2 text-xl font-bold">{selectedCampaign.campaign.messageEncoding === "english" ? t("panelSmsCampaigns.encoding.english") : t("panelSmsCampaigns.encoding.persian")}</div>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.details.charactersParts")}</div>
                    <div className="mt-2 text-xl font-bold">
                      {format.number(selectedCampaign.campaign.messageCharactersCount ?? 0)} / {format.number(selectedCampaign.campaign.messagePartsCount ?? 0)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.details.unitPrice")}</div>
                    <div className="mt-2 text-xl font-bold">{formatIranToman(selectedCampaign.campaign.unitPrice)}</div>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.details.estimateSpent")}</div>
                    <div className="mt-2 text-xl font-bold">
                      {formatIranToman(selectedCampaign.campaign.estimatedTotalPrice)} / {formatIranToman(selectedCampaign.campaign.spentTotalPrice)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/70 bg-card/50">
                <CardContent className="space-y-2 p-4">
                  <div className="text-sm text-muted-foreground">{t("panelSmsCampaigns.details.message")}</div>
                  <p className="whitespace-pre-wrap leading-7 text-sm">{selectedCampaign.campaign.message}</p>
                </CardContent>
              </Card>

              <ScrollArea className="h-[320px] rounded-2xl border border-border/70 bg-background/20">
                <div className="space-y-3 p-4">
                  {selectedCampaign.recipients.items.map((recipient) => (
                    <div key={recipient.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2 text-start">
                          <div className="font-bold">{recipient.customerName || t("panelSmsCampaigns.common.noName")}</div>
                          <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-muted-foreground">
                            <span className="inline-flex flex-row-reverse items-center gap-1">
                              <Phone className="h-4 w-4" />
                              <PhoneText>{recipient.customerPhone}</PhoneText>
                            </span>
                            <span>{recipient.lastServiceName || t("panelSmsCampaigns.common.noSection")}</span>
                            <span>{formatDateOrMissing(recipient.lastAppointmentAt)}</span>
                            <span>{formatIranToman(recipient.unitPrice)}</span>
                          </div>
                          {recipient.errorMessage && (
                            <div className="text-sm text-destructive">{recipient.errorMessage}</div>
                          )}
                        </div>
                        <Badge variant={recipient.status === "failed" ? "destructive" : "secondary"}>
                          {recipient.status === "pending"
                            ? t("panelSmsCampaigns.recipientStatus.pending")
                            : recipient.status === "sent"
                              ? t("panelSmsCampaigns.recipientStatus.sent")
                              : recipient.status === "failed"
                                ? t("panelSmsCampaigns.recipientStatus.failed")
                                : t("panelSmsCampaigns.recipientStatus.cancelled")}
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
                            openDetails(selectedCampaign.campaign, selectedCampaign.recipients.currentPage - 1);
                          }
                        }}
                        className={selectedCampaign.recipients.currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                      >
                        {t("panelSmsCampaigns.pagination.previous")}
                      </PaginationPrevious>
                    </PaginationItem>
                    <PaginationItem className="px-3 text-sm text-muted-foreground">
                      {t("panelSmsCampaigns.pagination.pageOf", { current: format.number(selectedCampaign.recipients.currentPage), total: format.number(selectedCampaign.recipients.lastPage) })}
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (selectedCampaign.recipients.currentPage < selectedCampaign.recipients.lastPage) {
                            openDetails(selectedCampaign.campaign, selectedCampaign.recipients.currentPage + 1);
                          }
                        }}
                        className={selectedCampaign.recipients.currentPage === selectedCampaign.recipients.lastPage ? "pointer-events-none opacity-50" : ""}
                      >
                        {t("panelSmsCampaigns.pagination.next")}
                      </PaginationNext>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editMessageModalOpen} onOpenChange={(open) => !open && resetEditor()}>
        <DialogContent className="max-w-2xl" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t("panelSmsCampaigns.edit.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-7 text-muted-foreground">
              {t("panelSmsCampaigns.edit.description")}
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/20 p-4 text-sm leading-7 text-muted-foreground">
              <div className="font-bold text-foreground">{campaignName || t("panelSmsCampaigns.edit.unnamedCampaign")}</div>
              <div className="mt-1">{t("panelSmsCampaigns.edit.fixedInfo")}</div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("panelSmsCampaigns.form.message")}</label>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t("panelSmsCampaigns.edit.messagePlaceholder")}
                className="min-h-36 text-start"
                dir={dir}
              />
            </div>

            <div className="space-y-3">
              <div className="text-sm font-bold">{t("panelSmsCampaigns.placeholders.title")}</div>
              <div className="flex flex-wrap gap-2">
                {campaignPlaceholderOptions.map((item) => (
                  <button
                    key={`edit-${item.token}`}
                    type="button"
                    onClick={() => insertCampaignPlaceholder(item.token)}
                    className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/10"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3 text-sm leading-7 text-muted-foreground">
                {t("panelSmsCampaigns.placeholders.customerNameFallbackPrefix")} <code dir="ltr">{"{{customer_name}}"}</code> {t("panelSmsCampaigns.placeholders.customerNameFallbackSuffix")}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleCreate} disabled={creating || !message.trim() || !editingCampaignId}>
                {creating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4" />}
                {t("panelSmsCampaigns.actions.resubmit")}
              </Button>
              <Button type="button" variant="outline" onClick={resetEditor}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
