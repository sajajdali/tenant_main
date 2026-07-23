import { RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  FileText,
  Loader2,
  Plus,
  ReceiptText,
  Save,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { formatNumber } from "@/i18n/format";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import { normalizeDigits } from "@/lib/normalize";
import { Appointment, ManualFinanceDashboardPayload, TenantMeta, TenantPanelUser } from "@/lib/types";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type FinanceItemForm = {
  categoryId: string;
  amount: string;
  description: string;
  materialCost: string;
  materialCostOpen: boolean;
};

type SelectedAppointment = {
  id: string;
  customerName: string;
  customerPhone: string;
  professionalId: string;
  professionalName?: string | null;
  date: string;
  startTime: string;
  sectionName?: string | null;
};

type CategoryDraft = {
  name: string;
  defaultAmount: string;
};
type LocaleFormatter = ReturnType<typeof useFormat>;

const todayIso = () => new Date().toISOString().slice(0, 10);
const paymentMethodKeys = {
  card: "panelManualFinance.payment.card",
  cash: "panelManualFinance.payment.cash",
  online: "panelManualFinance.payment.online",
  transfer: "panelManualFinance.payment.transfer",
  other: "panelManualFinance.payment.other",
} as const satisfies Record<"card" | "cash" | "online" | "transfer" | "other", MessageKey>;
const formatNumberInput = (value: number, formatter?: LocaleFormatter) => formatter?.number(value) ?? formatNumber(value);

const emptyItem = (categoryId = "", defaultAmount = 0, formatter?: LocaleFormatter): FinanceItemForm => ({
  categoryId,
  amount: defaultAmount > 0 ? formatNumberInput(defaultAmount, formatter) : "",
  description: "",
  materialCost: "",
  materialCostOpen: false,
});

const toEnglishDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

const onlyDigits = (value: string) => toEnglishDigits(normalizeDigits(value)).replace(/\D/g, "");

const formatMoneyInput = (value: string, formatter?: LocaleFormatter) => {
  const digits = onlyDigits(value);
  return digits ? formatNumberInput(Number(digits), formatter) : "";
};

const parseMoneyInput = (value: string) => Number(onlyDigits(value)) || 0;
const formatAmountValue = (value?: number | null, formatter?: LocaleFormatter) => value && value > 0 ? formatNumberInput(value, formatter) : "";

const appointmentToSelected = (appointment: Appointment): SelectedAppointment => ({
  id: appointment.id,
  customerName: appointment.userName,
  customerPhone: appointment.userPhone,
  professionalId: appointment.barberId,
  professionalName: appointment.barberName,
  date: appointment.date,
  startTime: appointment.startTime,
  sectionName: appointment.sectionName,
});

export default function PanelManualFinancePage() {
  const { isAdmin, isPrimaryAdmin, isBarber, user } = useAuth();
  const { barbers } = useStore();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [location, setLocation] = useLocation();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [payload, setPayload] = useState<ManualFinanceDashboardPayload | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [professionalId, setProfessionalId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<TenantPanelUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<TenantPanelUser | null>(null);
  const [appointmentScope, setAppointmentScope] = useState<"upcoming" | "past">("upcoming");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<SelectedAppointment | null>(null);
  const [skipAppointment, setSkipAppointment] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "online" | "transfer" | "other">("card");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<FinanceItemForm[]>([emptyItem()]);
  const [paidAmountEdited, setPaidAmountEdited] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDefaultAmount, setNewCategoryDefaultAmount] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CategoryDraft>>({});
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  const labels = getAudienceLabels(tenantMeta);
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const params = useMemo(() => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""), [location]);
  const appointmentId = params.get("appointment_id") || "";
  const initialMobile = params.get("mobile") || "";
  const initialName = params.get("name") || "";
  const initialProfessionalId = params.get("professional_id") || "";
  const initialDate = params.get("date") || "";
  const initialStartTime = params.get("start_time") || "";
  const initialSectionName = params.get("section_name") || "";
  const initialProfessionalName = params.get("professional_name") || "";
  const hasPresetAppointment = appointmentId !== "";
  const showPresetExpenseOnly = hasPresetAppointment;
  const money = (value: number) => format.currency(value);
  const currencyUnitLabel = format.currency(0).replace(format.number(0), "").trim();
  const formatDate = (value?: string | null) => (value ? format.date(new Date(`${value}T12:00:00`), { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : t("panelManualFinance.notSelected"));
  const formatShortDate = (value?: string | null) => (value ? format.date(new Date(`${value}T12:00:00`), { year: "numeric", month: "short", day: "numeric" }) : t("panelManualFinance.noAppointment"));

  const totalAmount = items.reduce((sum, item) => sum + parseMoneyInput(item.amount), 0);
  const materialCostAmount = items.reduce((sum, item) => sum + parseMoneyInput(item.materialCost), 0);
  const netRevenueAmount = Math.max(0, totalAmount - materialCostAmount);
  const paid = parseMoneyInput(paidAmount);
  const nextDebt = Math.max(0, totalAmount - paid);
  const expenseEnabled = Boolean(selectedUser && (selectedAppointment || skipAppointment));
  const professionalRef = useRef<HTMLDivElement | null>(null);
  const userRef = useRef<HTMLDivElement | null>(null);
  const appointmentRef = useRef<HTMLDivElement | null>(null);
  const expenseRef = useRef<HTMLDivElement | null>(null);
  const latestItemRef = useRef<HTMLDivElement | null>(null);
  const selectedPersonName = selectedAppointment?.customerName || selectedUser?.fullName || selectedUser?.mobile || t("panelManualFinance.unknown");
  const selectedPersonPhone = selectedAppointment?.customerPhone || selectedUser?.mobile || "";
  const selectedProfessionalName = selectedAppointment?.professionalName || barbers.find((barber) => barber.id === professionalId)?.name || t("panelManualFinance.unknown");
  const selectedAppointmentLabel = selectedAppointment
    ? t("panelManualFinance.appointmentLabel", {
        service: selectedAppointment.sectionName || t("panelManualFinance.appointmentFallback"),
        date: formatShortDate(selectedAppointment.date),
        time: selectedAppointment.startTime ? t("panelManualFinance.timeWithValue", { time: selectedAppointment.startTime }) : "",
      })
    : t("panelManualFinance.noAppointmentSelected");
  const categoryById = useMemo(
    () => new Map((payload?.categories ?? []).map((category) => [category.id, category])),
    [payload?.categories],
  );

  const ownBarber = useMemo(
    () => (isBarber ? barbers.find((barber) => barber.userId === user?.id) ?? null : null),
    [barbers, isBarber, user?.id],
  );

  const scrollTo = (ref: RefObject<HTMLDivElement | null>) => {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  const handleAddItem = () => {
    const category = payload?.categories[0];
    setItems((current) => [...current, emptyItem(category?.id, category?.defaultAmount ?? 0, format)]);
    window.setTimeout(() => {
      latestItemRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  };

  useEffect(() => {
    if (paidAmountEdited) return;
    setPaidAmount(totalAmount > 0 ? formatNumberInput(totalAmount, format) : "");
  }, [format, paidAmountEdited, totalAmount]);

  const loadDashboard = async (options?: { mobile?: string; appointmentId?: string; professionalId?: string }) => {
    setLoadingDashboard(true);
    const res = await api.manualFinance.dashboard({
      mobile: options?.mobile || selectedUser?.mobile || initialMobile || undefined,
      appointmentId: options?.appointmentId || appointmentId || undefined,
      professionalId: options?.professionalId || professionalId || initialProfessionalId || undefined,
      perPage: 20,
    });
    setLoadingDashboard(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setPayload(res.data);
    const firstCategory = res.data.categories[0];
    const firstCategoryId = firstCategory?.id || "";
    setItems((current) => current.map((item) => {
      if (item.categoryId) return item;
      return {
        ...item,
        categoryId: firstCategoryId,
        amount: item.amount || formatAmountValue(firstCategory?.defaultAmount, format),
      };
    }));

    if (res.data.appointment) {
      const nextAppointment = res.data.appointment;
      setProfessionalId(nextAppointment.professionalId);
      setSelectedUser({
        id: res.data.customer?.id ?? null,
        firstName: nextAppointment.customerName,
        lastName: "",
        fullName: nextAppointment.customerName,
        mobile: nextAppointment.customerPhone,
        canBook: true,
        appointmentsCount: 0,
      });
      setSelectedAppointment({
        id: nextAppointment.id,
        customerName: nextAppointment.customerName,
        customerPhone: nextAppointment.customerPhone,
        professionalId: nextAppointment.professionalId,
        professionalName: nextAppointment.professionalName,
        date: nextAppointment.date,
        startTime: nextAppointment.startTime,
        sectionName: nextAppointment.sectionName,
      });
      setSkipAppointment(false);
      scrollTo(expenseRef);
      return;
    }

    if (res.data.customer && !selectedUser && (res.data.customer.phone || initialMobile)) {
      setSelectedUser({
        id: res.data.customer.id ?? null,
        firstName: res.data.customer.name || initialName || "",
        lastName: "",
        fullName: res.data.customer.name || initialName || "",
        mobile: res.data.customer.phone || initialMobile,
        canBook: true,
        appointmentsCount: 0,
      });
    }
  };

  const loadUsers = async (term = searchTerm) => {
    if (!professionalId) return;
    setLoadingUsers(true);
    const res = await api.users.list(professionalId, 1, 10, term);
    setLoadingUsers(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setUsers(res.data.items);
  };

  const loadAppointments = async (panelUser = selectedUser, scope = appointmentScope) => {
    if (!panelUser || !professionalId) return;
    setLoadingAppointments(true);
    const res = await api.users.appointments(panelUser.mobile, professionalId, scope, 1, 20);
    setLoadingAppointments(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setAppointments(res.data.items);
  };

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) setTenantMeta(res.data);
    });
  }, []);

  useEffect(() => {
    if (hasPresetAppointment && initialMobile && initialProfessionalId && initialDate) {
      setProfessionalId(initialProfessionalId);
      setSelectedUser({
        id: null,
        firstName: initialName,
        lastName: "",
        fullName: initialName,
        mobile: initialMobile,
        canBook: true,
        appointmentsCount: 0,
      });
      setSelectedAppointment({
        id: appointmentId,
        customerName: initialName,
        customerPhone: initialMobile,
        professionalId: initialProfessionalId,
        professionalName: initialProfessionalName,
        date: initialDate,
        startTime: initialStartTime,
        sectionName: initialSectionName,
      });
      setSkipAppointment(false);
      scrollTo(expenseRef);
    }

    if (isBarber && ownBarber) {
      setProfessionalId(ownBarber.id);
      return;
    }

    if (initialProfessionalId) {
      setProfessionalId(initialProfessionalId);
      return;
    }

    if (!professionalId && barbers.length === 1) {
      setProfessionalId(barbers[0].id);
    }
  }, [barbers, initialProfessionalId, isBarber, ownBarber, professionalId]);

  useEffect(() => {
    if (!isAdmin && !isBarber) return;
    void loadDashboard({
      mobile: initialMobile || undefined,
      appointmentId: appointmentId || undefined,
      professionalId: initialProfessionalId || professionalId || undefined,
    });
  }, [appointmentId, initialMobile, initialProfessionalId, isAdmin, isBarber, professionalId]);

  useEffect(() => {
    if (!professionalId || selectedAppointment) return;
    const timeout = window.setTimeout(() => {
      void loadUsers(searchTerm.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [professionalId, searchTerm, selectedAppointment]);

  useEffect(() => {
    if (!selectedUser || selectedAppointment) return;
    void loadAppointments(selectedUser, appointmentScope);
  }, [selectedUser?.mobile, appointmentScope, professionalId]);

  const handleSelectUser = async (panelUser: TenantPanelUser) => {
    setSelectedUser(panelUser);
    setSelectedAppointment(null);
    setSkipAppointment(false);
    setAppointments([]);
    setLocation(`/panel/manual-finance?mobile=${encodeURIComponent(panelUser.mobile)}&name=${encodeURIComponent(panelUser.fullName || "")}&professional_id=${encodeURIComponent(professionalId)}`);
    await loadDashboard({ mobile: panelUser.mobile, professionalId });
    await loadAppointments(panelUser, appointmentScope);
    scrollTo(appointmentRef);
  };

  const handleSelectAppointment = async (appointment: Appointment) => {
    const nextAppointment = appointmentToSelected(appointment);
    setSelectedAppointment(nextAppointment);
    setSkipAppointment(false);
    setProfessionalId(nextAppointment.professionalId);
    setLocation(`/panel/manual-finance?appointment_id=${encodeURIComponent(appointment.id)}`);
    await loadDashboard({ mobile: appointment.userPhone, appointmentId: appointment.id, professionalId: appointment.barberId });
    scrollTo(expenseRef);
  };

  const handleSkipAppointment = async () => {
    if (!selectedUser || !professionalId) return;
    setSelectedAppointment(null);
    setSkipAppointment(true);
    setLocation(`/panel/manual-finance?mobile=${encodeURIComponent(selectedUser.mobile)}&name=${encodeURIComponent(selectedUser.fullName || "")}&professional_id=${encodeURIComponent(professionalId)}&mode=free`);
    await loadDashboard({ mobile: selectedUser.mobile, professionalId });
    scrollTo(expenseRef);
  };

  const handleSave = async () => {
    if (!selectedUser || !professionalId) {
      toast({ variant: "destructive", title: t("panelManualFinance.validation.selectProfessionalAndUser", { professional: labels.singular }) });
      return;
    }

    if (totalAmount <= 0) {
      toast({ variant: "destructive", title: t("panelManualFinance.validation.amountRequired") });
      return;
    }

    if (items.some((item) => parseMoneyInput(item.materialCost) > parseMoneyInput(item.amount))) {
      toast({ variant: "destructive", title: t("panelManualFinance.validation.materialTooHigh") });
      return;
    }

    setSaving(true);
    const res = await api.manualFinance.createEntry({
      appointmentId: selectedAppointment?.id ?? null,
      professionalId: selectedAppointment?.professionalId ?? professionalId,
      customerName: selectedAppointment?.customerName || selectedUser.fullName || selectedUser.mobile,
      customerPhone: selectedAppointment?.customerPhone || selectedUser.mobile,
      entryDate: selectedAppointment?.date ?? todayIso(),
      paidAmount: paid,
      paymentMethod,
      items: items
        .filter((item) => item.categoryId && parseMoneyInput(item.amount) > 0)
        .map((item) => ({
          categoryId: item.categoryId,
          amount: parseMoneyInput(item.amount),
          materialCost: parseMoneyInput(item.materialCost),
          sharePercent: null,
          description: item.description || null,
        })),
      notes,
    });
    setSaving(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    toast({ title: res.message || t("panelManualFinance.toast.saved") });
    setPaidAmount("");
    setPaidAmountEdited(false);
    setNotes("");
    const firstCategory = payload?.categories[0];
    setItems([emptyItem(firstCategory?.id, firstCategory?.defaultAmount ?? 0, format)]);
    await loadDashboard({
      mobile: selectedAppointment?.customerPhone || selectedUser.mobile,
      appointmentId: selectedAppointment?.id,
      professionalId: selectedAppointment?.professionalId ?? professionalId,
    });
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    const res = await api.manualFinance.createCategory({
      name: newCategoryName,
      defaultSharePercent: null,
      defaultAmount: parseMoneyInput(newCategoryDefaultAmount) || null,
    });
    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }
    setNewCategoryName("");
    setNewCategoryDefaultAmount("");
    toast({ title: t("panelManualFinance.toast.categoryCreated") });
    await loadDashboard();
  };

  const handleUpdateCategory = async (categoryId: string) => {
    const draft = categoryDrafts[categoryId];
    if (!draft?.name.trim()) {
      toast({ variant: "destructive", title: t("panelManualFinance.validation.categoryNameRequired") });
      return;
    }

    setSavingCategoryId(categoryId);
    const res = await api.manualFinance.updateCategory(categoryId, {
      name: draft.name,
      defaultSharePercent: null,
      defaultAmount: parseMoneyInput(draft.defaultAmount) || null,
    });
    setSavingCategoryId(null);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    toast({ title: res.message || t("panelManualFinance.toast.categoryUpdated") });
    await loadDashboard();
  };

  const handleDeleteCategory = async (categoryId: string) => {
    setDeletingCategoryId(categoryId);
    const res = await api.manualFinance.deleteCategory(categoryId);
    setDeletingCategoryId(null);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    toast({ title: res.message || t("panelManualFinance.toast.categoryDeleted") });
    await loadDashboard();
  };

  useEffect(() => {
    setCategoryDrafts(Object.fromEntries((payload?.categories ?? []).map((category) => [
      category.id,
      {
        name: category.name,
        defaultAmount: formatAmountValue(category.defaultAmount, format),
      },
    ])));
  }, [payload?.categories]);

  if (!isAdmin && !isBarber) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="max-w-md space-y-4 text-center">
          <ReceiptText className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelManualFinance.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelManualFinance.accessDenied.description", { professional: labels.singular })}</p>
          <Link href="/panel"><Button>{t("common.back")}</Button></Link>
        </div>
      </div>
    );
  }

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-start text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="text-start">
            <h1 className="text-xl font-bold">{t("panelManualFinance.title")}</h1>
            {!showPresetExpenseOnly ? (
              <p className="text-sm text-muted-foreground">{t("panelManualFinance.description", { professional: labels.singular })}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {isPrimaryAdmin ? (
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-2xl"
                title={t("panelManualFinance.categories.title")}
                onClick={() => setCategoryDialogOpen(true)}
              >
                <FileText className="h-5 w-5" />
              </Button>
            ) : null}
            <Link href="/panel">
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl" title={t("common.back")}>
                {isRtl ? <ArrowRight className="h-5 w-5 rotate-180" /> : <ArrowLeft className="h-5 w-5" />}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
          <section className="space-y-6">
            {showPresetExpenseOnly && !expenseEnabled ? (
              <Card className="border-border/70 bg-card/60">
                <CardContent className="flex h-40 items-center justify-center p-6 text-muted-foreground">
                  <Loader2 className="me-2 h-5 w-5 animate-spin" />
                  {t("panelManualFinance.loadingForm")}
                </CardContent>
              </Card>
            ) : null}

            {!showPresetExpenseOnly ? (
            <Card ref={professionalRef} className="border-border/70 bg-card/60 scroll-mt-24">
              <CardHeader className="text-start">
                <CardTitle className="flex items-center justify-start gap-2 text-base">
                  <span>{t("panelManualFinance.professional.title", { professional: labels.singular })}</span>
                  <Users className="h-4 w-4" />
                </CardTitle>
                <CardDescription className="text-start">
                  {t("panelManualFinance.professional.description", { professional: labels.singular })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[320px_minmax(0,1fr)]">
                  <select
                    value={professionalId}
                    onChange={(event) => {
                      const nextProfessionalId = event.target.value;
                      setProfessionalId(nextProfessionalId);
                      setSelectedUser(null);
                      setSelectedAppointment(null);
                      setSkipAppointment(false);
                      setAppointments([]);
                      setUsers([]);
                      setLocation(nextProfessionalId ? `/panel/manual-finance?professional_id=${encodeURIComponent(nextProfessionalId)}` : "/panel/manual-finance");
                      if (nextProfessionalId) {
                        scrollTo(userRef);
                      }
                    }}
                    disabled={isBarber || Boolean(selectedAppointment && appointmentId)}
                    className="h-10 rounded-md border border-border bg-background px-3 text-start"
                  >
                    <option value="">{t("panelManualFinance.professional.option", { professional: labels.singular })}</option>
                    {barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}
                  </select>
                  <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
                    {professionalId ? t("panelManualFinance.professional.selected", { professional: labels.singular }) : t("panelManualFinance.professional.hint", { professional: labels.singular })}
                  </div>
                </div>
              </CardContent>
            </Card>
            ) : null}

            {!showPresetExpenseOnly && professionalId ? (
            <Card ref={userRef} className="border-border/70 bg-card/60 scroll-mt-24">
              <CardHeader className="text-start">
                <CardTitle className="flex items-center justify-start gap-2 text-base">
                  <span>{t("panelManualFinance.user.title")}</span>
                  <Users className="h-4 w-4" />
                </CardTitle>
                <CardDescription className="text-start">{t("panelManualFinance.user.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(normalizeDigits(event.target.value))}
                      placeholder={t("panelManualFinance.user.searchPlaceholder")}
                      className="ps-10 text-start"
                      disabled={!professionalId || Boolean(selectedAppointment && appointmentId)}
                    />
                  </div>
                </div>

                {selectedUser ? (
                  <div className="min-w-0 overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-start">
                    <div className="line-clamp-2 break-words font-bold leading-6 [overflow-wrap:anywhere]">{selectedUser.fullName || selectedUser.mobile}</div>
                    <div className="mt-1 text-sm text-muted-foreground"><PhoneText>{selectedUser.mobile}</PhoneText></div>
                  </div>
                ) : null}

                {!selectedAppointment || !appointmentId ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {loadingUsers ? (
                      <div className="col-span-full flex h-24 items-center justify-center text-muted-foreground">
                        <Loader2 className="me-2 h-5 w-5 animate-spin" />
                        {t("panelManualFinance.user.loading")}
                      </div>
                    ) : users.length > 0 ? users.map((panelUser) => (
                      <button
                        key={panelUser.mobile}
                        type="button"
                        onClick={() => void handleSelectUser(panelUser)}
                        className={`min-w-0 overflow-hidden rounded-2xl border p-4 text-start transition-colors hover:border-primary/40 ${selectedUser?.mobile === panelUser.mobile ? "border-primary/40 bg-primary/5" : "border-border/70 bg-background/30"}`}
                      >
                        <div className="line-clamp-2 break-words font-bold leading-6 [overflow-wrap:anywhere]">{panelUser.fullName || t("panelManualFinance.noName")}</div>
                        <div className="mt-1 text-sm text-muted-foreground"><PhoneText>{panelUser.mobile}</PhoneText></div>
                        <div className="mt-2 text-xs text-muted-foreground">{t("panelManualFinance.appointmentsCount", { count: format.number(panelUser.appointmentsCount) })}</div>
                      </button>
                    )) : (
                      <div className="col-span-full rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                        {professionalId ? t("panelManualFinance.user.emptySearch") : t("panelManualFinance.user.selectProfessionalFirst", { professional: labels.singular })}
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
            ) : null}

            {!showPresetExpenseOnly && selectedUser ? (
            <Card ref={appointmentRef} className="border-border/70 bg-card/60 scroll-mt-24">
              <CardHeader className="text-start">
                <CardTitle className="flex items-center justify-start gap-2 text-base">
                  <span>{t("panelManualFinance.appointment.title")}</span>
                  <CalendarDays className="h-4 w-4" />
                </CardTitle>
                <CardDescription className="text-start">{t("panelManualFinance.appointment.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedAppointment ? (
                  <div className="min-w-0 overflow-hidden rounded-2xl border border-primary/25 bg-primary/5 p-4 text-start">
                    <div className="line-clamp-2 break-words font-bold leading-6 [overflow-wrap:anywhere]">{selectedAppointment.customerName}</div>
                    <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                      <div>{formatDate(selectedAppointment.date)}</div>
                      <div>{t("panelManualFinance.timeWithValue", { time: selectedAppointment.startTime })}</div>
                      <div>{selectedAppointment.sectionName || selectedAppointment.professionalName || labels.singular}</div>
                    </div>
                    {!appointmentId ? (
                      <Button variant="outline" size="sm" className="mt-3 rounded-2xl" onClick={() => setSelectedAppointment(null)}>
                        {t("panelManualFinance.appointment.change")}
                      </Button>
                    ) : null}
                  </div>
                ) : selectedUser ? (
                  <>
                    <div className="flex flex-wrap justify-between gap-2">
                      <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => void handleSkipAppointment()}>
                        {t("panelManualFinance.appointment.skip")}
                      </Button>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant={appointmentScope === "upcoming" ? "default" : "outline"} size="sm" onClick={() => setAppointmentScope("upcoming")}>{t("panelManualFinance.appointment.upcoming")}</Button>
                        <Button variant={appointmentScope === "past" ? "default" : "outline"} size="sm" onClick={() => setAppointmentScope("past")}>{t("panelManualFinance.appointment.past")}</Button>
                      </div>
                    </div>
                    {loadingAppointments ? (
                      <div className="flex h-24 items-center justify-center text-muted-foreground">
                        <Loader2 className="me-2 h-5 w-5 animate-spin" />
                        {t("panelManualFinance.appointment.loading")}
                      </div>
                    ) : appointments.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {[...appointments]
                          .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`))
                          .map((appointment) => (
                          <button
                            key={appointment.id}
                            type="button"
                            onClick={() => void handleSelectAppointment(appointment)}
                            className="rounded-2xl border border-border/70 bg-background/30 p-4 text-start transition-colors hover:border-primary/40"
                          >
                            <div className="font-bold">{t("panelManualFinance.appointment.cardTitle", { service: appointment.sectionName || t("panelManualFinance.serviceFallback") })}</div>
                            <div className="mt-2 text-sm text-muted-foreground">{formatDate(appointment.date)}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{t("panelManualFinance.timeWithValue", { time: appointment.startTime })}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                        {t("panelManualFinance.appointment.empty")}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                    {t("panelManualFinance.appointment.selectUserFirst")}
                  </div>
                )}
              </CardContent>
            </Card>
            ) : null}

            {expenseEnabled ? (
            <Card ref={expenseRef} className="border-border/70 bg-card/60 scroll-mt-24">
              <CardHeader className="text-start">
                <CardTitle className="flex items-center justify-start gap-2 text-base">
                  <span>{t("panelManualFinance.expense.title")}</span>
                  <ReceiptText className="h-4 w-4" />
                </CardTitle>
                <CardDescription className="text-start">
                  {selectedAppointment
                    ? t("panelManualFinance.expense.descriptionWithAppointment", { date: formatDate(selectedAppointment.date) })
                    : t("panelManualFinance.expense.descriptionFree")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex min-w-0 flex-wrap items-center justify-start gap-x-3 gap-y-1 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] leading-5 text-muted-foreground sm:text-xs">
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                    {t("panelManualFinance.expense.forUser")} <b className="text-foreground">{selectedPersonName}</b>
                    {selectedPersonPhone ? <PhoneText className="ms-1 text-muted-foreground">({selectedPersonPhone})</PhoneText> : null}
                  </span>
                  <span className="text-border">|</span>
                  <span>
                    {t("panelManualFinance.expense.appointment")} <b className="text-foreground">{selectedAppointmentLabel}</b>
                  </span>
                  <span className="text-border">|</span>
                  <span>
                    {labels.singular} <b className="text-foreground">{selectedProfessionalName}</b>
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      ref={index === items.length - 1 ? latestItemRef : undefined}
                      className="rounded-2xl border border-border/70 bg-background/30 p-3"
                    >
                      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1.3fr_auto]">
                        <select
                          value={item.categoryId}
                          onChange={(event) => {
                            const nextCategoryId = event.target.value;
                            setItems((current) => current.map((row, rowIndex) => {
                              if (rowIndex !== index) return row;
                              const previousDefault = formatAmountValue(categoryById.get(row.categoryId)?.defaultAmount, format);
                              const nextDefault = formatAmountValue(categoryById.get(nextCategoryId)?.defaultAmount, format);
                              const shouldUseDefault = !row.amount || row.amount === previousDefault;

                              return {
                                ...row,
                                categoryId: nextCategoryId,
                                amount: shouldUseDefault ? nextDefault : row.amount,
                              };
                            }));
                          }}
                          className="h-10 rounded-md border border-border bg-background px-3 text-start"
                        >
                          {payload?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </select>
                        <div className="relative">
                          <Input
                            value={item.amount}
                            onChange={(event) => {
                              const nextAmount = formatMoneyInput(event.target.value, format);
                              setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, amount: nextAmount } : row));
                              if (!paidAmountEdited) {
                                const nextTotal = items.reduce((sum, row, rowIndex) => sum + parseMoneyInput(rowIndex === index ? nextAmount : row.amount), 0);
                                setPaidAmount(nextTotal > 0 ? formatNumberInput(nextTotal, format) : "");
                              }
                            }}
                            placeholder={format.number(22000)}
                            inputMode="numeric"
                            dir="ltr"
                            className="ps-16 text-start"
                          />
                          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{currencyUnitLabel}</span>
                        </div>
                        <Input value={item.description} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} placeholder={t("panelManualFinance.expense.itemDescriptionPlaceholder")} className="text-start" />
                        <Button type="button" variant="outline" className="h-10" onClick={() => setItems((current) => current.filter((_, rowIndex) => rowIndex !== index))} disabled={items.length === 1}>{t("panelManualFinance.actions.delete")}</Button>
                      </div>
                      <div className="mt-2 flex justify-start">
                        {item.materialCostOpen ? (
                          <div className="grid w-full max-w-sm grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{t("panelManualFinance.expense.materialCost")}</span>
                            <div className="relative flex-1">
                              <Input
                                value={item.materialCost}
                                onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, materialCost: formatMoneyInput(event.target.value, format) } : row))}
                                placeholder="0"
                                inputMode="numeric"
                                dir="ltr"
                                className="h-9 ps-14 text-start text-sm"
                              />
                              <span className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{currencyUnitLabel}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, materialCost: "", materialCostOpen: false } : row))}
                              title={t("panelManualFinance.expense.removeMaterial")}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            onClick={() => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, materialCostOpen: true } : row))}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {t("panelManualFinance.expense.addMaterial")}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={handleAddItem}>
                    <Plus className="me-2 h-4 w-4" />
                    {t("panelManualFinance.expense.addItem")}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("panelManualFinance.expense.paidAmount")}</label>
                    <div className="relative">
                      <Input
                        value={paidAmount}
                        onChange={(event) => {
                          setPaidAmountEdited(true);
                          setPaidAmount(formatMoneyInput(event.target.value, format));
                        }}
                        inputMode="numeric"
                        dir="ltr"
                        className="ps-16 text-start"
                      />
                      <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{currencyUnitLabel}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("panelManualFinance.expense.paymentMethod")}</label>
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-start">
                      {Object.entries(paymentMethodKeys).map(([value, key]) => (
                        <option key={value} value={value}>{t(key)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/30 p-3 text-start">
                    <div className="text-xs text-muted-foreground">{t("panelManualFinance.expense.summaryTitle")}</div>
                    <div className="mt-1 font-bold">{money(totalAmount)}</div>
                    {materialCostAmount > 0 ? <div className="text-xs text-muted-foreground">{t("panelManualFinance.expense.materialNet", { material: money(materialCostAmount), net: money(netRevenueAmount) })}</div> : null}
                    <div className={nextDebt > 0 ? "text-sm font-bold text-destructive" : "text-sm text-emerald-500"}>{nextDebt > 0 ? t("panelManualFinance.expense.debt", { amount: money(nextDebt) }) : t("panelManualFinance.expense.settled")}</div>
                  </div>
                </div>

                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("panelManualFinance.expense.notesPlaceholder")} className="min-h-24 text-start" />
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving || loadingDashboard} className="h-11 rounded-2xl px-5 font-bold">
                    {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                    {t("panelManualFinance.expense.save")}
                  </Button>
                </div>
              </CardContent>
            </Card>
            ) : null}

            {!showPresetExpenseOnly && selectedUser ? (
            <Card className="border-border/70 bg-card/60">
              <CardHeader className="text-start">
                <CardTitle className="text-base">{t("panelManualFinance.history.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingDashboard ? (
                  <div className="flex h-32 items-center justify-center text-muted-foreground"><Loader2 className="me-2 h-5 w-5 animate-spin" />{t("common.loading")}</div>
                ) : selectedUser && payload?.entries.items.length ? (
                  <div className="space-y-3">
                    {payload.entries.items.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-border/70 bg-background/30 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="text-start">
                            <div className="font-bold">{formatDate(entry.entryDate)} - {entry.professionalName || labels.singular}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{entry.items.map((item) => item.categoryName).join("، ")}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{money(entry.totalAmount)}</Badge>
                            {entry.materialCostAmount > 0 ? <Badge variant="outline">{t("panelManualFinance.expense.materialNet", { material: money(entry.materialCostAmount), net: money(entry.netRevenueAmount) })}</Badge> : null}
                            {entry.balanceAmount > 0 ? <Badge variant="destructive">{t("panelManualFinance.expense.debt", { amount: money(entry.balanceAmount) })}</Badge> : <Badge variant="outline">{t("panelManualFinance.expense.settled")}</Badge>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-muted-foreground">
                    {selectedUser ? t("panelManualFinance.history.emptyForUser") : t("panelManualFinance.history.emptyBeforeUser")}
                  </div>
                )}
              </CardContent>
            </Card>
            ) : null}
          </section>
      </main>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent dir={dir} className="sm:max-w-2xl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{t("panelManualFinance.categories.title")}</DialogTitle>
            <DialogDescription>{t("panelManualFinance.categories.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {payload?.categories.map((category) => {
                const draft = categoryDrafts[category.id] ?? { name: category.name, defaultAmount: formatAmountValue(category.defaultAmount, format) };
                const isSavingCategory = savingCategoryId === category.id;

                return (
                  <div key={category.id} className="grid gap-2 rounded-xl border border-border/70 bg-background/35 p-3 md:grid-cols-[minmax(0,1fr)_180px_auto_auto]">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t("panelManualFinance.categories.name")}</label>
                      <Input
                        value={draft.name}
                        onChange={(event) => setCategoryDrafts((current) => ({
                          ...current,
                          [category.id]: { ...draft, name: event.target.value },
                        }))}
                        className="text-start"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t("panelManualFinance.categories.defaultAmount")}</label>
                      <div className="relative">
                        <Input
                          value={draft.defaultAmount}
                          onChange={(event) => setCategoryDrafts((current) => ({
                            ...current,
                            [category.id]: { ...draft, defaultAmount: formatMoneyInput(event.target.value, format) },
                          }))}
                          placeholder="0"
                          inputMode="numeric"
                          dir="ltr"
                          className="ps-14 text-start"
                        />
                        <span className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{currencyUnitLabel}</span>
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full rounded-xl md:w-auto"
                        onClick={() => void handleUpdateCategory(category.id)}
                        disabled={isSavingCategory || deletingCategoryId === category.id}
                      >
                        {isSavingCategory ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                        {t("common.save")}
                      </Button>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive md:w-10"
                        onClick={() => void handleDeleteCategory(category.id)}
                        disabled={deletingCategoryId === category.id || isSavingCategory || (payload?.categories.length ?? 0) <= 1}
                        title={t("panelManualFinance.categories.delete")}
                      >
                        {deletingCategoryId === category.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid gap-2 border-t border-border/70 pt-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder={t("panelManualFinance.categories.newNamePlaceholder")} className="text-start" />
              <div className="relative">
                <Input
                  value={newCategoryDefaultAmount}
                  onChange={(event) => setNewCategoryDefaultAmount(formatMoneyInput(event.target.value, format))}
                  placeholder={t("panelManualFinance.categories.defaultAmountPlaceholder")}
                  inputMode="numeric"
                  dir="ltr"
                  className="ps-14 text-start"
                />
                <span className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{currencyUnitLabel}</span>
              </div>
            </div>
            <Button className="w-full rounded-2xl" onClick={handleCreateCategory}>
              <Plus className="me-2 h-4 w-4" />
              {t("panelManualFinance.categories.add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
