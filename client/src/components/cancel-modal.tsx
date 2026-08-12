import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Appointment, ManualFinanceCustomerSummary, ManualFinanceDashboardPayload, PaymentSettings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, CheckCircle2, ChevronDown, Clock3, Loader2, MessageSquareText, Pencil, Plus, ReceiptText, Save, Trash2, User, Phone, Scissors, Users, WandSparkles, MessageCircleWarning, UserRoundX, X } from "lucide-react";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { PhoneText } from "@/i18n/ltr-text";
import { UserProfileForm } from "@/components/user-profile-form";
import {
  buildUserProfilePayload,
  getDefaultRegistrationRequirements,
  getUserProfileFormDefaults,
  normalizeRegistrationRequirements,
  RegistrationRequirements,
  UserProfileFormValues,
  validateUserProfileForm,
} from "@/lib/membership";

type FinanceItemForm = {
  categoryId: string;
  amount: string;
  description: string;
  materialCost: string;
  materialCostOpen: boolean;
};

const emptyFinanceItem = (categoryId = ""): FinanceItemForm => ({
  categoryId,
  amount: "",
  description: "",
  materialCost: "",
  materialCostOpen: false,
});

const toEnglishDigits = (value: string) =>
  value
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));

const onlyDigits = (value: string) => toEnglishDigits(value).replace(/\D/g, "");
const toTelHref = (value: string) => {
  const normalized = toEnglishDigits(value).replace(/[^\d+]/g, "");

  return normalized ? `tel:${normalized}` : null;
};
const formatMoneyInput = (value: string, formatter: ReturnType<typeof useFormat>) => {
  const digits = onlyDigits(value);
  return digits ? formatter.number(Number(digits)) : "";
};
const parseMoneyInput = (value: string) => Number(onlyDigits(value)) || 0;
const formatAmountValue = (value: number | null | undefined, formatter: ReturnType<typeof useFormat>) =>
  value && value > 0 ? formatter.number(value) : "";
const staffManagementStorageKey = (appointmentId: string) =>
  `booking:staff-management:v2:${appointmentId}`;

const hasRememberedStaffManagement = (appointmentId: string) => {
  try {
    return window.localStorage.getItem(staffManagementStorageKey(appointmentId)) === "1";
  } catch {
    return false;
  }
};

const rememberStaffManagement = (appointmentId: string) => {
  try {
    window.localStorage.setItem(staffManagementStorageKey(appointmentId), "1");
  } catch {
    // The server-backed attendance/finance state still keeps the view persistent.
  }
};

interface CancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  customerFinanceSummary?: ManualFinanceCustomerSummary | null;
  onChangeTime?: (appointment: Appointment) => void;
  onFinanceChanged?: () => void | Promise<void>;
}

export function CancelModal({ isOpen, onClose, appointment, customerFinanceSummary = null, onChangeTime, onFinanceChanged }: CancelModalProps) {
  const [, setLocation] = useLocation();
  const { cancelAppointment, fetchAppointments, sections } = useStore();
  const { isAdmin, isBarber } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, locale } = useLocale();
  const financeFormRef = useRef<HTMLDivElement | null>(null);
  const latestFinanceItemRef = useRef<HTMLDivElement | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [sendCancellationSms, setSendCancellationSms] = useState(false);
  const [showSmsWarning, setShowSmsWarning] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState<"review" | "finalize">("review");
  const [isCancelling, setIsCancelling] = useState(false);
  const [attendanceAction, setAttendanceAction] = useState<"completed" | "no_show" | null>(null);
  const [localAttendanceStatus, setLocalAttendanceStatus] = useState<Appointment["status"] | null>(null);
  const [showNoShowPrompt, setShowNoShowPrompt] = useState(false);
  const [financePayload, setFinancePayload] = useState<ManualFinanceDashboardPayload | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [customerFinancePayload, setCustomerFinancePayload] = useState<ManualFinanceDashboardPayload | null>(null);
  const [customerFinanceLoading, setCustomerFinanceLoading] = useState(false);
  const [showCustomerFinanceDetails, setShowCustomerFinanceDetails] = useState(false);
  const [showFinanceForm, setShowFinanceForm] = useState(false);
  const [financeItems, setFinanceItems] = useState<FinanceItemForm[]>([emptyFinanceItem()]);
  const [financePaidAmount, setFinancePaidAmount] = useState("");
  const [financePaidAmountEdited, setFinancePaidAmountEdited] = useState(false);
  const [financePaymentMethod, setFinancePaymentMethod] = useState<"cash" | "card" | "online" | "transfer" | "other">("card");
  const [financeNotes, setFinanceNotes] = useState("");
  const [financeSaving, setFinanceSaving] = useState(false);
  const [deletingFinanceEntryId, setDeletingFinanceEntryId] = useState<string | null>(null);
  const [staffManagementAppointmentId, setStaffManagementAppointmentId] = useState<string | null>(null);
  const [highlightedFinanceItemIndex, setHighlightedFinanceItemIndex] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [customerEditOpen, setCustomerEditOpen] = useState(false);
  const [customerEditLoading, setCustomerEditLoading] = useState(false);
  const [customerEditSaving, setCustomerEditSaving] = useState(false);
  const [customerEditForm, setCustomerEditForm] = useState<UserProfileFormValues>(() => getUserProfileFormDefaults());
  const [customerEditErrors, setCustomerEditErrors] = useState<Partial<Record<keyof UserProfileFormValues, string>>>({});
  const [registrationRequirements, setRegistrationRequirements] = useState<RegistrationRequirements>(getDefaultRegistrationRequirements());
  const [localCustomerName, setLocalCustomerName] = useState("");
  const [localCustomerPhone, setLocalCustomerPhone] = useState("");
  const financeTotalAmount = useMemo(
    () => financeItems.reduce((sum, item) => sum + parseMoneyInput(item.amount), 0),
    [financeItems],
  );
  const financeMaterialCostAmount = useMemo(
    () => financeItems.reduce((sum, item) => sum + parseMoneyInput(item.materialCost), 0),
    [financeItems],
  );
  const financeCategoryById = useMemo(
    () => new Map((financePayload?.categories ?? []).map((category) => [category.id, category])),
    [financePayload?.categories],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!isAdmin && !isBarber) {
      setPaymentSettings(null);
      return;
    }

    let active = true;

    api.payment.getSettings().then((res) => {
      if (active && res.success) {
        setPaymentSettings(res.data);
      }
    });

    return () => {
      active = false;
    };
  }, [isAdmin, isBarber, isOpen]);

  const cancellationSmsEnabled = useMemo(() => {
    return (
      paymentSettings?.smsEnabled === true &&
      !!paymentSettings.smsProvider &&
      (paymentSettings.smsTemplatesV2?.cancellation?.enabled ?? false)
    );
  }, [paymentSettings]);

  useEffect(() => {
    if (!isOpen) {
      setSendCancellationSms(false);
      setShowSmsWarning(false);
      setConfirmationStep("review");
      setIsCancelling(false);
      setAttendanceAction(null);
      setLocalAttendanceStatus(null);
      setShowNoShowPrompt(false);
      setFinancePayload(null);
      setFinanceLoading(false);
      setCustomerFinancePayload(null);
      setCustomerFinanceLoading(false);
      setShowCustomerFinanceDetails(false);
      setShowFinanceForm(false);
      setFinanceItems([emptyFinanceItem()]);
      setFinancePaidAmount("");
      setFinancePaidAmountEdited(false);
      setFinancePaymentMethod("card");
      setFinanceNotes("");
      setFinanceSaving(false);
      setDeletingFinanceEntryId(null);
      setCustomerEditOpen(false);
      setCustomerEditLoading(false);
      setCustomerEditSaving(false);
      setCustomerEditErrors({});
      return;
    }

    setSendCancellationSms(cancellationSmsEnabled);
  }, [cancellationSmsEnabled, isOpen]);

  useEffect(() => {
    setRegistrationRequirements(normalizeRegistrationRequirements(paymentSettings?.registrationRequirements));
  }, [paymentSettings?.registrationRequirements]);

  useEffect(() => {
    if (!isOpen) return;

    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);

    return () => window.clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !appointment) return;
    setLocalAttendanceStatus(appointment.status);
    setLocalCustomerName(appointment.userName || "");
    setLocalCustomerPhone(appointment.userPhone || "");
  }, [appointment, isOpen]);

  useEffect(() => {
    if (!isOpen || !appointment || (!isAdmin && !isBarber)) {
      setFinancePayload(null);
      setFinanceLoading(false);
      return;
    }

    const shouldLoadFinance =
      ["booked", "completed", "no_show"].includes(appointment.status);

    if (!shouldLoadFinance) {
      setFinancePayload(null);
      setFinanceLoading(false);
      return;
    }

    let active = true;
    setFinanceLoading(true);

    api.manualFinance.dashboard({ appointmentId: appointment.id, perPage: 3 }).then((res) => {
      if (!active) return;
      setFinancePayload(res.success ? res.data : null);
    }).finally(() => {
      if (active) {
        setFinanceLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [appointment, isAdmin, isBarber, isOpen]);

  useEffect(() => {
    if (!isOpen || !appointment || (!isAdmin && !isBarber)) {
      return;
    }

    const hasPersistedAction =
      ["completed", "no_show"].includes(appointment.status) ||
      (customerFinanceSummary?.appointmentIds?.includes(appointment.id) ?? false) ||
      hasRememberedStaffManagement(appointment.id);

    setStaffManagementAppointmentId(hasPersistedAction ? appointment.id : null);
  }, [
    appointment,
    customerFinanceSummary?.appointmentIds,
    isAdmin,
    isBarber,
    isOpen,
  ]);

  useEffect(() => {
    if (
      !isOpen ||
      !appointment ||
      (!isAdmin && !isBarber) ||
      !financePayload?.entries.items.length
    ) {
      return;
    }

    setStaffManagementAppointmentId(appointment.id);
    rememberStaffManagement(appointment.id);
  }, [appointment, financePayload?.entries.items.length, isAdmin, isBarber, isOpen]);

  useEffect(() => {
    if (!isOpen || !appointment || (!isAdmin && !isBarber) || (customerFinanceSummary?.balanceAmount ?? 0) <= 0) {
      setCustomerFinancePayload(null);
      setCustomerFinanceLoading(false);
      setShowCustomerFinanceDetails(false);
      return;
    }

    let active = true;
    setCustomerFinanceLoading(true);

    api.manualFinance.dashboard({
      mobile: appointment.userPhone,
      professionalId: appointment.barberId,
      perPage: 10,
    }).then((res) => {
      if (!active) return;
      setCustomerFinancePayload(res.success ? res.data : null);
    }).finally(() => {
      if (active) {
        setCustomerFinanceLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [appointment, customerFinanceSummary?.balanceAmount, isAdmin, isBarber, isOpen]);

  useEffect(() => {
    const firstCategory = financePayload?.categories[0];
    const firstCategoryId = firstCategory?.id || "";
    if (!firstCategoryId) return;

    setFinanceItems((current) =>
      current.map((item) => ({
        ...item,
        categoryId: item.categoryId || firstCategoryId,
        amount: item.amount || formatAmountValue(firstCategory?.defaultAmount, format),
      })),
    );
  }, [financePayload?.categories, format]);

  useEffect(() => {
    if (financePaidAmountEdited) return;
    setFinancePaidAmount(formatAmountValue(financeTotalAmount, format));
  }, [financePaidAmountEdited, financeTotalAmount]);

  useEffect(() => {
    if (!showFinanceForm) return;

    const timer = window.setTimeout(() => {
      financeFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [showFinanceForm]);

  if (!appointment) return null;

  const section = sections.find(s => s.id === appointment.sectionId);
  const serviceName = appointment.sectionName || section?.name || t("appointment.cancel.unknownService");
  const money = (value: number) => locale === "fa"
    ? t("appointment.cancel.money", { amount: format.number(value) })
    : format.currency(value, { currencyDisplay: "narrowSymbol" });
  const appointmentStartAt = new Date(`${appointment.date}T${appointment.startTime}:00`);
  const isStaffPastAppointment =
    (isAdmin || isBarber) &&
    ["booked", "completed", "no_show"].includes(appointment.status) &&
    nowMs > appointmentStartAt.getTime();
  const hasServerManagedState =
    ["completed", "no_show"].includes(appointment.status) ||
    (customerFinanceSummary?.appointmentIds?.includes(appointment.id) ?? false) ||
    (financePayload?.entries.items.length ?? 0) > 0;
  const isStaffManagementView =
    isStaffPastAppointment ||
    ((isAdmin || isBarber) &&
      (hasServerManagedState || staffManagementAppointmentId === appointment.id));
  const cancellationLockedAt = appointment.cancellationLockedAt ? new Date(appointment.cancellationLockedAt) : null;
  const isCustomerCancellationLocked =
    !isAdmin &&
    !isBarber &&
    appointment.status === "booked" &&
    cancellationLockedAt !== null &&
    nowMs >= cancellationLockedAt.getTime();
  const registeredByAdminOrBarber =
    appointment.bookedByRole === "admin" || appointment.bookedByRole === "barber";
  const canChangeTime =
    (isAdmin || isBarber) &&
    appointment.status === "booked" &&
    !isStaffPastAppointment &&
    appointment.date >= new Date().toISOString().slice(0, 10);
  const attendanceStatus = localAttendanceStatus || appointment.status;
  const attendanceStatusLabel =
    attendanceStatus === "completed"
      ? t("appointment.cancel.attendanceStatus.completed")
      : attendanceStatus === "no_show"
        ? t("appointment.cancel.attendanceStatus.noShow")
        : t("appointment.cancel.attendanceStatus.pending");
  const displayCustomerName = localCustomerName || appointment.userName || "";
  const displayCustomerPhone = localCustomerPhone || appointment.userPhone || "";
  const customerPhoneHref = toTelHref(displayCustomerPhone);
  const customerInitial = (displayCustomerName || t("appointment.cancel.customerInitial")).trim().slice(0, 1);
  const customerDebtAmount = customerFinanceSummary?.balanceAmount ?? 0;
  const customerHasDebt = customerDebtAmount > 0;

  const enterStaffManagementView = (openFinanceForm = false) => {
    setStaffManagementAppointmentId(appointment.id);
    if (openFinanceForm) {
      setShowFinanceForm(true);
    }
  };

  const persistStaffManagementView = () => {
    setStaffManagementAppointmentId(appointment.id);
    rememberStaffManagement(appointment.id);
  };

  const handleConfirm = async () => {
    if (isCancelling) {
      return;
    }

    setIsCancelling(true);

    try {
      if (isCustomerCancellationLocked) {
        return;
      }

      await cancelAppointment(appointment.id, sendCancellationSms);
      onClose();
    } finally {
      setIsCancelling(false);
    }
  };

  const handleAttendanceUpdate = async (
    status: "completed" | "no_show",
    options?: { blockCustomerBooking?: boolean },
  ) => {
    if (attendanceAction) {
      return;
    }

    setAttendanceAction(status);

    try {
      const res = await api.appointments.updateAttendance(appointment.id, status, options);

      if (!res.success) {
        toast({ variant: "destructive", title: t("common.error"), description: res.message });
        return;
      }

      toast({ title: res.message || t("appointment.cancel.attendanceSaved") });
      persistStaffManagementView();
      setLocalAttendanceStatus(res.data.status);
      await fetchAppointments();
    } finally {
      setAttendanceAction(null);
    }
  };

  const handleAttendanceClick = (status: "completed" | "no_show") => {
    if (attendanceStatus === status || attendanceAction) {
      return;
    }

    if (status === "no_show") {
      setShowNoShowPrompt(true);
      return;
    }

    void handleAttendanceUpdate("completed");
  };

  const handleNoShowConfirm = async (blockCustomerBooking: boolean) => {
    setShowNoShowPrompt(false);
    await handleAttendanceUpdate("no_show", { blockCustomerBooking });
  };

  const openCustomerEdit = async () => {
    setCustomerEditForm(getUserProfileFormDefaults({
      name: displayCustomerName,
      mobile: displayCustomerPhone,
    }));
    setCustomerEditErrors({});
    setCustomerEditOpen(true);

    if (!displayCustomerPhone) {
      return;
    }

    setCustomerEditLoading(true);

    try {
      const res = await api.users.lookup(displayCustomerPhone);

      if (res.success && res.data.user) {
        setCustomerEditForm(getUserProfileFormDefaults({
          name: res.data.user.name || displayCustomerName,
          mobile: res.data.user.phone || displayCustomerPhone,
          email: res.data.user.email,
          gender: res.data.user.gender,
          nationalCode: res.data.user.nationalCode,
          birthDate: res.data.user.birthDate,
          provinceId: res.data.user.provinceId,
          cityId: res.data.user.cityId,
          jobTitle: res.data.user.jobTitle,
        }));
      }
    } finally {
      setCustomerEditLoading(false);
    }
  };

  const handleSaveCustomerEdit = async () => {
    if (customerEditSaving) {
      return;
    }

    const nextErrors = validateUserProfileForm(customerEditForm, registrationRequirements, {
      requireMobile: true,
      t,
      formatNumber: format.number,
    });
    setCustomerEditErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = buildUserProfilePayload(customerEditForm);
    setCustomerEditSaving(true);

    try {
      const res = await api.users.updateIdentity(displayCustomerPhone || appointment.userPhone, appointment.barberId, {
        ...payload,
        mobile: payload.mobile || "",
      });

      if (!res.success) {
        toast({ variant: "destructive", title: t("common.error"), description: res.message });
        return;
      }

      setLocalCustomerName(res.data.fullName || payload.name);
      setLocalCustomerPhone(res.data.mobile || payload.mobile || displayCustomerPhone);
      setCustomerEditOpen(false);
      toast({ title: t("appointment.cancel.customerEdit.saved") });
      await fetchAppointments();
      await onFinanceChanged?.();
    } finally {
      setCustomerEditSaving(false);
    }
  };

  const handleClose = () => {
    if (isCancelling || attendanceAction || customerEditSaving) {
      return;
    }

    const hasCompletedManagementAction =
      ["completed", "no_show"].includes(localAttendanceStatus || appointment.status) ||
      (financePayload?.entries.items.length ?? 0) > 0 ||
      (customerFinanceSummary?.appointmentIds?.includes(appointment.id) ?? false) ||
      hasRememberedStaffManagement(appointment.id);

    if (!hasCompletedManagementAction) {
      setStaffManagementAppointmentId(null);
    }

    setConfirmationStep("review");
    setShowNoShowPrompt(false);
    onClose();
  };

  const handleSmsCheckedChange = (checked: boolean) => {
    if (!checked) {
      setSendCancellationSms(false);
      return;
    }

    if (!cancellationSmsEnabled) {
      setShowSmsWarning(true);
      return;
    }

    setSendCancellationSms(true);
  };

  const handleNavigateToSmsSettings = () => {
    setShowSmsWarning(false);
    handleClose();
    setLocation("/panel/sms-settings/booking");
  };

  const reloadFinance = async () => {
    setFinanceLoading(true);
    const res = await api.manualFinance.dashboard({ appointmentId: appointment.id, perPage: 3 });
    setFinanceLoading(false);

    if (res.success) {
      setFinancePayload(res.data);
    }
  };

  const handleSaveFinance = async () => {
    const validItems = financeItems
      .map((item) => ({
        ...item,
        amountValue: parseMoneyInput(item.amount),
      }))
      .filter((item) => item.categoryId && item.amountValue > 0);

    if (!validItems.length) {
      toast({ variant: "destructive", title: t("appointment.cancel.finance.validation.itemRequired") });
      return;
    }

    if (validItems.some((item) => parseMoneyInput(item.materialCost) > item.amountValue)) {
      toast({ variant: "destructive", title: t("appointment.cancel.finance.validation.materialTooHigh") });
      return;
    }

    setFinanceSaving(true);
    const res = await api.manualFinance.createEntry({
      appointmentId: appointment.id,
      professionalId: appointment.barberId,
      customerName: appointment.userName,
      customerPhone: appointment.userPhone,
      entryDate: appointment.date,
      paidAmount: parseMoneyInput(financePaidAmount),
      paymentMethod: financePaymentMethod,
      items: validItems.map((item) => ({
        categoryId: item.categoryId,
        amount: item.amountValue,
        materialCost: parseMoneyInput(item.materialCost),
        description: item.description.trim() || null,
      })),
      notes: financeNotes.trim() || null,
    });
    setFinanceSaving(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    toast({ title: t("appointment.cancel.finance.saved") });
    persistStaffManagementView();
    setShowFinanceForm(false);
    setFinanceItems([emptyFinanceItem(financePayload?.categories[0]?.id)]);
    setFinancePaidAmount("");
    setFinancePaidAmountEdited(false);
    setFinancePaymentMethod("card");
    setFinanceNotes("");
    await reloadFinance();
    await onFinanceChanged?.();
  };

  const handleAddFinanceItem = () => {
    const category = financePayload?.categories[0];
    let nextIndex = 0;

    setFinanceItems((current) => {
      nextIndex = current.length;
      return [...current, { ...emptyFinanceItem(category?.id), amount: formatAmountValue(category?.defaultAmount, format) }];
    });
    setHighlightedFinanceItemIndex(nextIndex);

    window.setTimeout(() => {
      latestFinanceItemRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);

    window.setTimeout(() => {
      setHighlightedFinanceItemIndex((current) => (current === nextIndex ? null : current));
    }, 1500);
  };

  const handleDeleteFinanceEntry = async (entryId: string) => {
    if (deletingFinanceEntryId) {
      return;
    }

    setDeletingFinanceEntryId(entryId);
    const res = await api.manualFinance.deleteEntry(entryId);
    setDeletingFinanceEntryId(null);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    toast({ title: res.message || t("appointment.cancel.finance.deleted") });
    await reloadFinance();
    await onFinanceChanged?.();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className={`max-h-[88vh] overflow-x-hidden overflow-y-auto ${isStaffManagementView ? "staff-management-modal border-[#26344b] bg-[#111a2d] p-0 text-start text-[#f5f7ff] shadow-2xl shadow-black/40 sm:max-w-[360px] sm:rounded-[22px] [&>button.absolute]:end-4 [&>button.absolute]:start-auto [&>button.absolute]:top-4 [&>button.absolute]:flex [&>button.absolute]:h-10 [&>button.absolute]:w-10 [&>button.absolute]:items-center [&>button.absolute]:justify-center [&>button.absolute]:rounded-full [&>button.absolute]:border [&>button.absolute]:border-[#33445f] [&>button.absolute]:bg-[#182338] [&>button.absolute]:opacity-100 [&>button.absolute]:ring-offset-0 [&>button.absolute_svg]:h-5 [&>button.absolute_svg]:w-5 [&>button.absolute_svg]:text-[#aeb8ca]" : "bg-card sm:max-w-[425px] border-destructive/20"}`} dir={dir}>
          {confirmationStep === "review" ? (
            <>
              <DialogHeader className={isStaffManagementView ? "items-stretch border-b border-[#26344b]/80 px-5 pb-4 pt-6 text-start" : undefined}>
                <DialogTitle className={`${isStaffManagementView ? "w-full flex-row justify-start text-start text-[17px] font-black leading-7 text-[#f5f7ff]" : "text-foreground"} flex items-center gap-2`}>
                  {isStaffManagementView ? (
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  ) : <CalendarDays className="h-5 w-5 text-primary" />}
                  {isStaffManagementView ? t("appointment.cancel.staffTitle") : t("appointment.cancel.detailsTitle")}
                </DialogTitle>
                <DialogDescription className={isStaffManagementView ? "w-full max-w-none self-stretch text-start text-xs font-bold leading-6 text-[#93a0b7]" : undefined}>
                  {isStaffManagementView
                    ? isStaffPastAppointment
                      ? t("appointment.cancel.staffPastDescription")
                      : t("appointment.cancel.staffDescription")
                    : t("appointment.cancel.detailsDescription")}
                </DialogDescription>
              </DialogHeader>

              <div className={isStaffManagementView ? "space-y-4 px-5 py-4 text-start" : "py-4 space-y-3 bg-muted/30 rounded-lg p-4 border border-border/50"}>
                 {isStaffManagementView && (
                   <div className="flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-[16px] border border-[#31415e] bg-[#162136] p-3">
                     <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#f59e0b] text-xl font-black text-[#111827]">
                       {customerInitial}
                     </div>
                     <div className="min-w-0 flex-1 text-start">
                       <div className="flex w-full min-w-0 items-center justify-start gap-1.5" dir={dir}>
                         <div className="line-clamp-2 min-w-0 break-words text-start text-[16px] font-black leading-6 text-[#f5f7ff] [overflow-wrap:anywhere]">{displayCustomerName}</div>
                         <Button
                           type="button"
                           variant="ghost"
                           size="icon"
                           className="h-6 w-6 shrink-0 rounded-full border border-[#31415e] bg-[#1c2940] text-[#aeb8ca] hover:bg-[#22324e] hover:text-white"
                           onClick={() => void openCustomerEdit()}
                           title={t("appointment.cancel.customerEdit.action")}
                         >
                           <Pencil className="h-3 w-3" />
                         </Button>
                       </div>
                       <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5 text-[11px] font-bold text-[#8f9bb3]">
                         <span>{serviceName}</span>
                         {displayCustomerPhone && <span className="h-1 w-1 rounded-full bg-[#53617a]" />}
                         {displayCustomerPhone && <PhoneText>{displayCustomerPhone}</PhoneText>}
                       </div>
                     </div>
                     {customerPhoneHref && (
                       <Button
                         asChild
                         type="button"
                         variant="ghost"
                         size="icon"
                         className="h-11 w-11 shrink-0 rounded-[13px] border border-emerald-300/25 bg-emerald-400/12 text-emerald-200 shadow-lg shadow-emerald-500/10 hover:border-emerald-200/50 hover:bg-emerald-400/20 hover:text-white"
                         title={t("appointment.cancel.callCustomer")}
                       >
                         <a href={customerPhoneHref} aria-label={t("appointment.cancel.callCustomer")}>
                           <Phone className="h-4 w-4" />
                         </a>
                       </Button>
                     )}
                   </div>
                 )}
                 <div className={isStaffManagementView ? "hidden" : "flex min-w-0 items-start justify-between gap-3"}>
                    <span className="text-muted-foreground text-sm flex items-center gap-1">
                      <User className="w-3 h-3" /> {t("appointment.cancel.customer")}
                    </span>
                    <span className="line-clamp-2 min-w-0 break-words text-start font-bold [overflow-wrap:anywhere]">{displayCustomerName}</span>
                 </div>
                 <div className={isStaffManagementView ? "hidden" : "flex items-center justify-between gap-3"}>
                    <span className="text-muted-foreground text-sm flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {t("appointment.cancel.phone")}
                    </span>
                    <span className="flex items-center gap-2">
                      <PhoneText>{displayCustomerPhone}</PhoneText>
                      {customerPhoneHref && (
                        <Button
                          asChild
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15"
                          title={t("appointment.cancel.callCustomer")}
                        >
                          <a href={customerPhoneHref} aria-label={t("appointment.cancel.callCustomer")}>
                            <Phone className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </span>
                 </div>
                 {appointment.isForSomeoneElse && !isStaffManagementView && (
                   <>
                     <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm flex items-center gap-1">
                          <Users className="w-3 h-3" /> {t("appointment.cancel.bookedBy")}
                        </span>
                        <span className="font-bold">
                          {registeredByAdminOrBarber ? t("appointment.cancel.admin") : (appointment.bookedByName || t("appointment.cancel.siteUser"))}
                        </span>
                     </div>
                     {!registeredByAdminOrBarber && (
                       <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-sm flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {t("appointment.cancel.bookedByPhone")}
                          </span>
                          <PhoneText>{appointment.bookedByPhone || "-"}</PhoneText>
                       </div>
                     )}
                   </>
                 )}
                 {appointment.notes && !isStaffManagementView && (
                   <div className="space-y-2 rounded-lg border border-border/50 bg-background/40 p-3">
                      <div className="text-muted-foreground text-sm flex items-center gap-1">
                        <MessageSquareText className="w-3 h-3" /> {t("appointment.cancel.notes")}
                      </div>
                      <p className="text-sm leading-7">{appointment.notes}</p>
                   </div>
                 )}
                 <div className={isStaffManagementView ? "hidden" : "flex items-center justify-between"}>
                    <span className="text-muted-foreground text-sm flex items-center gap-1">
                      <Scissors className="w-3 h-3" /> {t("appointment.cancel.service")}
                    </span>
                    <span>{serviceName}</span>
                 </div>
                 {appointment.isOffQueue && !isStaffManagementView && (
                   <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm flex items-center gap-1">
                        <WandSparkles className="w-3 h-3" /> {t("appointment.cancel.bookingType")}
                      </span>
                      <span className="font-bold text-amber-400">{t("appointment.cancel.offQueue")}</span>
                   </div>
                 )}
                 {isCustomerCancellationLocked && (
                   <div className="rounded-lg border border-amber-300/35 bg-amber-500/10 p-3 text-sm font-bold leading-7 text-amber-200">
                     {appointment.cancellationLockMessage || t("appointment.cancel.lockedDefault")}
                   </div>
                 )}
                 {customerHasDebt && (
                   <div className={isStaffManagementView ? "staff-customer-debt-card space-y-2 rounded-[13px] border border-[#ff746c]/25 bg-[#3a2130]/45 p-3 text-start" : "space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-start"}>
                     <div className="flex items-center justify-between gap-2">
                       <Button
                         type="button"
                         variant="ghost"
                         size="sm"
                         className={isStaffManagementView ? "h-8 rounded-[10px] px-2 text-[11px] font-bold text-[#ff9a93] hover:bg-[#ff746c]/10 hover:text-[#ffb0aa]" : "h-8 px-2 text-xs"}
                         onClick={() => setShowCustomerFinanceDetails((value) => !value)}
                       >
                         {showCustomerFinanceDetails ? t("appointment.cancel.finance.closeDebtDetails") : t("appointment.cancel.finance.debtDetails")}
                       </Button>
                       <div className={isStaffManagementView ? "text-xs font-black text-[#ff8178]" : "text-sm font-bold text-destructive"}>
                         {t("appointment.cancel.finance.customerDebt", { amount: money(customerDebtAmount) })}
                       </div>
                     </div>
                     {showCustomerFinanceDetails && (
                       <div className="space-y-1.5">
                         {customerFinanceLoading ? (
                           <div className="py-2 text-center text-[11px] font-bold text-[#8f9bb3]">
                             <Loader2 className="me-1 inline h-3.5 w-3.5 animate-spin" />
                             {t("appointment.cancel.finance.loadingDebt")}
                           </div>
                         ) : customerFinancePayload?.entries.items.length ? (
                           customerFinancePayload.entries.items
                             .filter((entry) => entry.balanceAmount > 0)
                             .map((entry) => (
                               <div key={`debt-${entry.id}`} className="staff-customer-debt-entry rounded-[10px] bg-[#111a2d]/55 px-3 py-2 text-start text-[11px] font-bold">
                                 <div className="flex flex-row-reverse items-center justify-between gap-2">
                                   <span className="min-w-0 truncate text-[#f5f7ff]">
                                    {entry.items.map((item) => item.categoryName).join(t("common.listSeparator"))}
                                   </span>
                                   <span className="shrink-0 text-[#ff8178]">{money(entry.balanceAmount)}</span>
                                 </div>
                                 <div className="mt-1 text-[#8f9bb3]">
                                   {t("appointment.cancel.finance.paidAndTotal", { paid: money(entry.paidAmount), total: money(entry.totalAmount) })}
                                 </div>
                               </div>
                             ))
                         ) : (
                           <div className="py-2 text-center text-[11px] font-bold text-[#8f9bb3]">{t("appointment.cancel.finance.noDebtDetails")}</div>
                         )}
                       </div>
                     )}
                   </div>
                 )}
                 {isStaffManagementView && (
                   <>
                     <div className="space-y-2 text-start">
                       <div className="text-start text-xs font-black text-[#aeb8ca]">{t("appointment.cancel.attendanceTitle")}</div>
                       <div className="grid grid-cols-2 gap-2">
                         <Button
                           type="button"
                           variant="outline"
                           disabled={!!attendanceAction}
                           onClick={() => handleAttendanceClick("completed")}
                           className={`h-10 rounded-[13px] border text-xs font-black ${
                             attendanceStatus === "completed"
                               ? "border-emerald-400/80 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15 hover:text-emerald-200"
                               : "border-[#31415e] bg-[#182338] text-[#8f9bb3] hover:bg-[#1b2941] hover:text-[#b8c2d6]"
                           }`}
                         >
                           {attendanceAction === "completed" ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <span className={`me-2 h-2 w-2 rounded-full ${attendanceStatus === "completed" ? "bg-emerald-300" : "bg-[#53617a]"}`} />}
                           {t("appointment.cancel.attendance.completed")}
                         </Button>
                         <Button
                           type="button"
                           variant="outline"
                           disabled={!!attendanceAction}
                           onClick={() => handleAttendanceClick("no_show")}
                           className={`h-10 rounded-[13px] border text-xs font-black ${
                             attendanceStatus === "no_show"
                               ? "border-[#ff746c] bg-[#332637] text-[#ff8178] hover:bg-[#3a293c] hover:text-[#ff9a93]"
                               : "border-[#31415e] bg-[#182338] text-[#8f9bb3] hover:bg-[#1b2941] hover:text-[#b8c2d6]"
                           }`}
                         >
                           {attendanceAction === "no_show" ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <span className={`me-2 h-2 w-2 rounded-full ${attendanceStatus === "no_show" ? "bg-[#ff8178]" : "bg-[#53617a]"}`} />}
                           {t("appointment.cancel.attendance.noShow")}
                         </Button>
                       </div>
                     </div>
                     <div className="space-y-2.5 text-start">
                       <div className="flex flex-row-reverse items-center justify-between gap-2">
                         <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           className="h-9 rounded-[12px] border-[#a86a17] bg-[#2b241d] px-3 text-xs font-black text-[#f59e0b] hover:bg-[#352816] hover:text-[#fbbf24]"
                           onClick={() => {
                             enterStaffManagementView();
                             setShowFinanceForm((value) => !value);
                           }}
                         >
                           <Plus className="me-1 h-3.5 w-3.5" />
                           {showFinanceForm ? t("appointment.cancel.finance.closeForm") : t("appointment.cancel.finance.addExpense")}
                         </Button>
                         <div className="flex items-center gap-1.5 text-sm font-black text-[#f5f7ff]">
                           <ReceiptText className="h-4 w-4 text-[#f59e0b]" />
                           {t("appointment.cancel.finance.title")}
                         </div>
                       </div>

                       {financeLoading ? (
                         <div className="flex items-center justify-center rounded-[13px] border border-dashed border-[#31415e] bg-[#162136]/50 py-4 text-[11px] font-bold text-[#8f9bb3]">
                           <Loader2 className="me-2 h-4 w-4 animate-spin" />
                           {t("appointment.cancel.finance.loading")}
                         </div>
                       ) : financePayload && financePayload.entries.items.length > 0 ? (
                         <div className="space-y-2">
                           <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                             <div className="rounded-xl bg-muted/40 p-2">
                               <div className="text-muted-foreground">{t("appointment.cancel.finance.total")}</div>
                               <div className="mt-1 font-bold">{money(financePayload.summary.totalAmount)}</div>
                             </div>
                             <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-300">
                               <div>{t("appointment.cancel.finance.paid")}</div>
                               <div className="mt-1 font-bold">{money(financePayload.summary.paidAmount)}</div>
                             </div>
                             <div className={`booking-finance-summary-card rounded-xl p-2 ${financePayload.summary.balanceAmount > 0 ? "booking-finance-summary-card--debt" : "bg-emerald-500/10 text-emerald-300"}`}>
                               <div className="booking-finance-summary-label">{t("appointment.cancel.finance.balance")}</div>
                               <div className="booking-finance-summary-value mt-1 font-black">{money(financePayload.summary.balanceAmount)}</div>
                             </div>
                           </div>
                           {financePayload.summary.materialCostAmount > 0 ? (
                             <div className="booking-finance-history-entry flex items-center justify-between rounded-xl border border-[#31415e]/70 bg-[#162136]/55 px-3 py-2 text-[11px]">
                               <span className="booking-finance-muted text-[#8f9bb3]">{t("appointment.cancel.finance.materialAmount", { amount: money(financePayload.summary.materialCostAmount) })}</span>
                               <span className="font-black text-emerald-300">{t("appointment.cancel.finance.netRevenue", { amount: money(financePayload.summary.netRevenueAmount) })}</span>
                             </div>
                           ) : null}
                           <div className="space-y-1.5">
                             {financePayload.entries.items.map((entry) => (
                               <div key={entry.id} className="booking-finance-history-entry space-y-2 rounded-[13px] border border-[#31415e]/75 bg-[#1c2638] p-3 text-start">
                                 <div className="flex items-start justify-between gap-2">
                                   <div className="flex min-w-0 flex-1 flex-col items-start text-start">
                                     <div className="booking-finance-muted text-[11px] font-bold leading-6 text-[#8f9bb3]">
                                       <span>{t("appointment.cancel.finance.paidAmount", { amount: money(entry.paidAmount) })}</span>
                                       <span className="mx-1 text-[#53617a]">·</span>
                                       <span className={entry.balanceAmount > 0 ? "text-[var(--booking-debt-value)]" : "text-emerald-300"}>
                                         {t("appointment.cancel.finance.balanceAmount", { amount: money(entry.balanceAmount) })}
                                       </span>
                                     </div>
                                   </div>
                                   <Button
                                     type="button"
                                     variant="ghost"
                                     size="icon"
                                     className="h-8 w-8 shrink-0 rounded-[10px] border border-[#ff746c]/30 bg-[#ff746c]/10 text-[#ff8178] hover:bg-[#ff746c]/15 hover:text-[#ff9a93]"
                                     disabled={deletingFinanceEntryId === entry.id}
                                     onClick={() => handleDeleteFinanceEntry(entry.id)}
                                     title={t("appointment.cancel.finance.deleteExpense")}
                                   >
                                     {deletingFinanceEntryId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                   </Button>
                                 </div>
                                 <div className="space-y-1">
                                   {entry.items.map((entryItem, itemIndex) => (
                                     <div key={`${entry.id}-${itemIndex}`} className="booking-finance-history-item rounded-[10px] bg-[#242d3f] px-3 py-2 text-xs">
                                       <div className="flex items-center justify-between gap-2">
                                         <span className="booking-finance-strong min-w-0 truncate text-start font-bold text-[#f5f7ff]">{entryItem.categoryName}</span>
                                         <span className="shrink-0 font-black text-[#f59e0b]">{money(entryItem.amount)}</span>
                                       </div>
                                       {(entryItem.materialCost ?? 0) > 0 ? (
                                         <div className="booking-finance-muted mt-1 text-start text-[10px] font-bold text-[#8f9bb3]">
                                           {t("appointment.cancel.finance.materialAndNet", { material: money(entryItem.materialCost ?? 0), net: money(Math.max(0, entryItem.amount - (entryItem.materialCost ?? 0))) })}
                                         </div>
                                       ) : null}
                                       {entryItem.description?.trim() && (
                                         <div className="booking-finance-muted mt-1 truncate text-start text-[11px] font-bold text-[#8f9bb3]">{entryItem.description}</div>
                                       )}
                                     </div>
                                   ))}
                                 </div>
                                 {entry.notes?.trim() && (
                                   <div className="booking-finance-muted truncate text-start text-[11px] font-bold text-[#8f9bb3]">
                                     {entry.notes}
                                   </div>
                                 )}
                               </div>
                             ))}
                           </div>
                         </div>
                       ) : !showFinanceForm ? (
                         <div className="rounded-[13px] border border-dashed border-[#31415e] bg-[#162136]/40 px-3 py-4 text-center text-[11px] font-bold text-[#7f8ba3]">
                           {t("appointment.cancel.finance.empty")}
                         </div>
                       ) : null}
                       {showFinanceForm && (
                         <div ref={financeFormRef} className="booking-finance-form space-y-2.5 rounded-[14px] border border-[#31415e] bg-[#162136] p-3 scroll-mt-6">
                           <div className="booking-finance-section-title text-start text-sm font-black text-[#aeb8ca]">{t("appointment.cancel.finance.itemsTitle")}</div>
                           <div className="space-y-3">
                             {financeItems.map((item, index) => (
                               <div
                                 key={index}
                                 ref={index === financeItems.length - 1 ? latestFinanceItemRef : undefined}
                                 className={`booking-finance-item-card space-y-2 rounded-[14px] border bg-[#1c2638] p-3 text-start transition-all duration-500 scroll-mt-6 ${
                                   highlightedFinanceItemIndex === index
                                     ? "border-[#f59e0b]/75 shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_14px_30px_rgba(245,158,11,0.12)]"
                                     : "border-[#31415e]/85"
                                 }`}
                               >
                                 <div className="flex items-center justify-between gap-2">
                                   <div className="booking-finance-item-title text-xs font-black text-[#aeb8ca]">{t("appointment.cancel.finance.itemNumber", { number: format.number(index + 1) })}</div>
                                   {financeItems.length > 1 && (
                                     <Button
                                       type="button"
                                       variant="ghost"
                                       size="icon"
                                       className="h-8 w-8 rounded-[10px] border border-[#ff746c]/30 bg-[#ff746c]/10 text-[#ff8178] hover:bg-[#ff746c]/15 hover:text-[#ff9a93]"
                                       onClick={() => setFinanceItems((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                                       title={t("appointment.cancel.finance.deleteItem")}
                                     >
                                       <Trash2 className="h-4 w-4" />
                                     </Button>
                                   )}
                                 </div>
                                 <div className="relative">
                                   <select
                                     value={item.categoryId}
                                     onChange={(event) => {
                                       const nextCategoryId = event.target.value;
                                       setFinanceItems((current) => current.map((row, rowIndex) => {
                                         if (rowIndex !== index) return row;
                                         const previousDefault = formatAmountValue(financeCategoryById.get(row.categoryId)?.defaultAmount, format);
                                         const nextDefault = formatAmountValue(financeCategoryById.get(nextCategoryId)?.defaultAmount, format);
                                         const shouldUseDefault = !row.amount || row.amount === previousDefault;

                                         return {
                                           ...row,
                                           categoryId: nextCategoryId,
                                           amount: shouldUseDefault ? nextDefault : row.amount,
                                         };
                                       }));
                                     }}
                                     className="booking-finance-control h-11 w-full appearance-none rounded-[12px] border border-[#3a465e] bg-[#242d3f] py-0 pe-9 ps-8 text-start text-sm font-black text-[#f5f7ff]"
                                     dir={dir}
                                   >
                                     <option value="">{t("appointment.cancel.finance.selectService")}</option>
                                     {(financePayload?.categories || []).map((category) => (
                                       <option key={category.id} value={category.id}>{category.name}</option>
                                     ))}
                                   </select>
                                   <span className="pointer-events-none absolute start-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#f59e0b]" />
                                   <ChevronDown className="booking-finance-control-icon pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f9bb3]" />
                                 </div>
                                 <div className="relative">
                                   <Input
                                     value={item.amount}
                                     onChange={(event) => setFinanceItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, amount: formatMoneyInput(event.target.value, format) } : row))}
                                     placeholder="0"
                                     inputMode="numeric"
                                     dir="ltr"
                                     className="booking-finance-control booking-finance-money-input h-11 rounded-[12px] border-[#3a465e] bg-[#242d3f] pe-4 ps-14 text-sm font-black text-[#f5f7ff]"
                                   />
                                   <span className="booking-finance-muted pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8f9bb3]">{t("appointment.cancel.currencyUnit")}</span>
                                 </div>
                                 <Input
                                   value={item.description}
                                   onChange={(event) => setFinanceItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))}
                                   placeholder={t("appointment.cancel.finance.descriptionPlaceholder")}
                                   className="booking-finance-control h-11 rounded-[12px] border-[#3a465e] bg-[#242d3f] px-4 text-start text-sm font-bold text-[#f5f7ff] placeholder:text-[#75839a]"
                                 />
                                 <div className="flex justify-start">
                                   {item.materialCostOpen ? (
                                     <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                                       <span className="booking-finance-muted shrink-0 whitespace-nowrap text-[10px] font-bold text-[#8f9bb3]">{t("appointment.cancel.finance.materialCost")}</span>
                                       <div className="relative flex-1">
                                         <Input
                                           value={item.materialCost}
                                           onChange={(event) => setFinanceItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, materialCost: formatMoneyInput(event.target.value, format) } : row))}
                                           placeholder="0"
                                           inputMode="numeric"
                                           dir="ltr"
                                           className="booking-finance-control booking-finance-money-input h-9 rounded-[10px] border-[#3a465e] bg-[#242d3f] pe-3 ps-12 text-xs font-black text-[#f5f7ff]"
                                         />
                                         <span className="booking-finance-muted pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#8f9bb3]">{t("appointment.cancel.currencyUnit")}</span>
                                       </div>
                                       <Button
                                         type="button"
                                         variant="ghost"
                                         size="icon"
                                         className="h-7 w-7 shrink-0 rounded-[8px] text-[#718098] hover:bg-[#ff746c]/10 hover:text-[#ff8178]"
                                         onClick={() => setFinanceItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, materialCost: "", materialCostOpen: false } : row))}
                                         title={t("appointment.cancel.finance.deleteMaterialCost")}
                                       >
                                         <Trash2 className="h-3 w-3" />
                                       </Button>
                                     </div>
                                   ) : (
                                     <button
                                       type="button"
                                       className="booking-finance-accent-action inline-flex items-center gap-1 text-[11px] font-black text-[#f3b65c] hover:text-[#ffd08a]"
                                       onClick={() => setFinanceItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, materialCostOpen: true } : row))}
                                     >
                                       <Plus className="h-3.5 w-3.5" />
                                       {t("appointment.cancel.finance.addMaterialCost")}
                                     </button>
                                   )}
                                 </div>
                               </div>
                             ))}
                             <div className="flex justify-start">
                               <Button
                                 type="button"
                                 variant="outline"
                                 className="booking-finance-add-item-button h-10 rounded-[12px] border-dashed border-[#3a465e] bg-transparent px-4 text-xs font-black text-[#c1cad8] hover:bg-[#242d3f] hover:text-white"
                                 onClick={handleAddFinanceItem}
                               >
                                 <Plus className="me-1.5 h-4 w-4" />
                                 {t("appointment.cancel.finance.addItem")}
                               </Button>
                             </div>
                           </div>
                           <div className="booking-finance-separator border-t border-dashed border-[#3a465e]/55" />
                           <div className="grid items-end gap-2 sm:grid-cols-2">
                             <div className="space-y-1">
                               <div className="booking-finance-field-label ps-1 text-start text-[10px] font-bold leading-none text-[#8f9bb3]">{t("appointment.cancel.finance.userPaid")}</div>
                               <div className="relative">
                               <Input
                                 value={financePaidAmount}
                                 onChange={(event) => {
                                   setFinancePaidAmountEdited(true);
                                   setFinancePaidAmount(formatMoneyInput(event.target.value, format));
                                 }}
                                 placeholder={t("appointment.cancel.finance.paidPlaceholder")}
                                 inputMode="numeric"
                                 dir="ltr"
                                 className="booking-finance-control booking-finance-money-input h-9 pe-3 ps-12 text-xs"
                               />
                               <span className="booking-finance-muted pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{t("appointment.cancel.currencyUnit")}</span>
                               </div>
                             </div>
                             <div className="space-y-1">
                               <div className="booking-finance-field-label ps-1 text-start text-[10px] font-bold leading-none text-[#8f9bb3]">{t("appointment.cancel.finance.paymentType")}</div>
                               <select
                                 value={financePaymentMethod}
                                 onChange={(event) => setFinancePaymentMethod(event.target.value as typeof financePaymentMethod)}
                                 className="booking-finance-control h-9 w-full rounded-md border border-border bg-background px-2 text-start text-xs"
                               >
                                 <option value="card">{t("appointment.cancel.finance.payment.card")}</option>
                                 <option value="cash">{t("appointment.cancel.finance.payment.cash")}</option>
                                 <option value="online">{t("appointment.cancel.finance.payment.online")}</option>
                                 <option value="transfer">{t("appointment.cancel.finance.payment.transfer")}</option>
                                 <option value="other">{t("appointment.cancel.finance.payment.other")}</option>
                               </select>
                             </div>
                           </div>
                           <div className="booking-finance-total-box rounded-xl bg-background/45 px-3 py-2 text-xs">
                             <div className="flex items-center justify-between">
                               <span className="text-muted-foreground">{t("appointment.cancel.finance.currentTotal")}</span>
                               <span className="font-bold">{money(financeTotalAmount)}</span>
                             </div>
                             <div className="mt-1 flex items-center justify-between">
                               <span className="text-muted-foreground">{t("appointment.cancel.finance.balance")}</span>
                               <span className={Math.max(0, financeTotalAmount - parseMoneyInput(financePaidAmount)) > 0 ? "font-bold text-destructive" : "font-bold text-emerald-300"}>
                                 {money(Math.max(0, financeTotalAmount - parseMoneyInput(financePaidAmount)))}
                               </span>
                             </div>
                             {financeMaterialCostAmount > 0 ? (
                               <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-1">
                                 <span className="text-muted-foreground">{t("appointment.cancel.finance.materialNetLabel")}</span>
                                 <span className="font-bold">
                                   {money(financeMaterialCostAmount)} / {money(Math.max(0, financeTotalAmount - financeMaterialCostAmount))}
                                 </span>
                               </div>
                             ) : null}
                           </div>
                           <Textarea
                             value={financeNotes}
                             onChange={(event) => setFinanceNotes(event.target.value)}
                             placeholder={t("appointment.cancel.finance.notesPlaceholder")}
                             className="booking-finance-control min-h-16 text-start text-xs"
                           />
                           <Button
                             type="button"
                             className="h-10 w-full rounded-2xl text-sm font-bold"
                             disabled={financeSaving || financeLoading}
                             onClick={handleSaveFinance}
                           >
                             {financeSaving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                             {t("appointment.cancel.finance.addExpense")}
                           </Button>
                         </div>
                       )}
                     </div>
                   </>
                 )}
              </div>

              {isStaffManagementView ? (
                <DialogFooter className="mt-0 border-t border-[#26344b]/80 px-5 py-4">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={!!attendanceAction || financeSaving}
                    className="staff-management-footer-close h-10 w-full rounded-[13px] border-[#3a4b68] bg-[#182338] text-xs font-black text-[#f5f7ff] hover:bg-[#1d2b45] hover:text-white"
                  >
                    {t("appointment.cancel.close")}
                  </Button>
                </DialogFooter>
              ) : (
              <DialogFooter className="mt-4 block">
                {isAdmin || isBarber ? (
                  <div className="grid w-full grid-cols-2 gap-3">
                    <div className="flex min-w-0 flex-col gap-3">
                      <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isCancelling}
                        className="h-11 w-full rounded-2xl px-2 text-xs font-black sm:text-sm"
                      >
                        <X className="me-1.5 h-4 w-4" />
                        {t("appointment.cancel.close")}
                      </Button>
                      {canChangeTime && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (onChangeTime) {
                              onChangeTime(appointment);
                            } else {
                              setLocation(`/booking?appointment=${encodeURIComponent(appointment.id)}&action=change_time&date=${encodeURIComponent(appointment.date)}&barber_id=${encodeURIComponent(appointment.barberId)}&section_id=${encodeURIComponent(appointment.sectionId)}`);
                            }
                            handleClose();
                          }}
                          disabled={isCancelling}
                          className="h-11 w-full rounded-2xl border-amber-300/45 bg-amber-500/10 px-2 text-xs font-black text-amber-300 hover:bg-amber-500/15 hover:text-amber-200 sm:text-sm"
                        >
                          <Clock3 className="me-1.5 h-4 w-4 shrink-0" />
                          {t("appointment.cancel.changeTime")}
                        </Button>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => enterStaffManagementView(true)}
                        disabled={isCancelling || financeLoading}
                        className="h-11 w-full rounded-2xl border-primary/35 bg-primary/5 px-2 text-xs font-black text-primary hover:bg-primary/10 sm:text-sm"
                      >
                        {financeLoading ? (
                          <Loader2 className="me-1.5 h-4 w-4 shrink-0 animate-spin" />
                        ) : (
                          <ReceiptText className="me-1.5 h-4 w-4 shrink-0" />
                        )}
                        {t("appointment.cancel.finance.addExpense")}
                      </Button>
                      {!isCustomerCancellationLocked && (
                        <Button
                          variant="destructive"
                          onClick={() => {
                            if (isCancelling) {
                              return;
                            }

                            if (!isAdmin) {
                              void handleConfirm();
                              return;
                            }

                            setConfirmationStep("finalize");
                          }}
                          disabled={isCancelling}
                          className="h-11 w-full rounded-2xl px-2 text-xs font-black sm:text-sm"
                        >
                          {isCancelling ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="me-1.5 h-4 w-4" />}
                          {isCancelling ? t("appointment.cancel.cancelling") : t("appointment.cancel.cancelAppointment")}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={`grid gap-3 ${!isCustomerCancellationLocked ? "grid-cols-2" : "grid-cols-1"}`}>
                    <Button
                      variant="outline"
                      onClick={handleClose}
                      disabled={isCancelling}
                      className="h-11 w-full rounded-2xl"
                    >
                      <X className="me-1.5 h-4 w-4" />
                      {t("appointment.cancel.close")}
                    </Button>
                    {!isCustomerCancellationLocked && (
                      <Button
                        variant="destructive"
                        onClick={() => void handleConfirm()}
                        disabled={isCancelling}
                        className="h-11 rounded-2xl px-2 text-xs font-black sm:text-sm"
                      >
                        {isCancelling ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="me-1.5 h-4 w-4" />}
                        {isCancelling ? t("appointment.cancel.cancelling") : t("appointment.cancel.cancelAppointment")}
                      </Button>
                    )}
                  </div>
                )}
              </DialogFooter>
              )}
            </>
          ) : isAdmin ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  {t("appointment.cancel.finalTitle")}
                </DialogTitle>
                <DialogDescription>
                  {t("appointment.cancel.finalDescription")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 rounded-lg border border-border/50 bg-muted/30 p-4">
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-7 text-muted-foreground">
                  {t("appointment.cancel.finalSummaryBefore")} <span className="font-bold text-foreground">{appointment.userName}</span> {t("appointment.cancel.finalSummaryFor")}
                  <span className="font-bold text-foreground"> {serviceName} </span>
                  {t("appointment.cancel.finalSummaryAfter")}
                </div>

                <div
                  className="rounded-lg border border-border/50 bg-background/40 p-3 space-y-2 cursor-pointer"
                  onClick={() => handleSmsCheckedChange(!sendCancellationSms)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={sendCancellationSms}
                      onClick={(event) => event.stopPropagation()}
                      onCheckedChange={(checked) => handleSmsCheckedChange(!!checked)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <div className="text-sm font-bold">{t("appointment.cancel.smsCheckboxTitle")}</div>
                      <div className="text-xs leading-6 text-muted-foreground">
                        {cancellationSmsEnabled
                          ? t("appointment.cancel.smsEnabledDescription")
                          : t("appointment.cancel.smsDisabledDescription")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex gap-2 mt-4 sm:justify-start">
                <Button
                  variant="destructive"
                  onClick={handleConfirm}
                  disabled={isCancelling}
                  className="flex-1"
                >
                  {isCancelling ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />}
                  {isCancelling ? t("appointment.cancel.cancelling") : t("appointment.cancel.finalConfirm")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmationStep("review")}
                  disabled={isCancelling}
                  className="flex-1"
                >
                  {t("appointment.cancel.back")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showSmsWarning} onOpenChange={setShowSmsWarning}>
        <AlertDialogContent dir={dir} className="text-start">
          <AlertDialogHeader className="text-start sm:text-start">
            <AlertDialogTitle className="flex items-center gap-2 text-start">
              <MessageCircleWarning className="h-5 w-5 text-amber-500" />
              {t("appointment.cancel.smsWarningTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-8 text-start">
              {t("appointment.cancel.smsWarningBefore")} <span className="font-bold">{t("appointment.cancel.smsWarningTemplate")}</span> {t("appointment.cancel.smsWarningMiddle")}
              <span className="font-bold">{t("appointment.cancel.smsWarningSettings")}</span> {t("appointment.cancel.smsWarningAfter")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:justify-start">
            <Button variant="outline" onClick={handleNavigateToSmsSettings}>
              {t("appointment.cancel.smsSettingsAction")}
            </Button>
            <AlertDialogAction>{t("appointment.cancel.understood")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showNoShowPrompt} onOpenChange={(open) => !open && setShowNoShowPrompt(false)}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-start">{t("appointment.cancel.noShowPromptTitle")}</DialogTitle>
            <DialogDescription className="text-start leading-7">
              {t("appointment.cancel.noShowPromptDescription", { customer: displayCustomerName })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border/70 bg-background/30 p-4 text-sm text-muted-foreground">
              {t("appointment.cancel.noShowBlockHelp")}
            </div>

            <div className="grid gap-3">
              <Button
                className="h-11 rounded-2xl bg-amber-500 text-sm font-bold text-slate-950 hover:bg-amber-400"
                disabled={!!attendanceAction}
                onClick={() => handleNoShowConfirm(true)}
              >
                <UserRoundX className="me-2 h-4 w-4" />
                {t("appointment.cancel.noShowBlockAction")}
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-2xl text-sm font-bold"
                disabled={!!attendanceAction}
                onClick={() => handleNoShowConfirm(false)}
              >
                {t("appointment.cancel.noShowOnlyAction")}
              </Button>
              <Button
                variant="ghost"
                className="h-10 rounded-2xl text-sm"
                disabled={!!attendanceAction}
                onClick={() => setShowNoShowPrompt(false)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={customerEditOpen} onOpenChange={(open) => {
        if (!open && !customerEditSaving) {
          setCustomerEditOpen(false);
        }
      }}>
        <DialogContent dir={dir} className="pretty-scrollbar max-h-[88vh] overflow-y-auto text-start sm:max-w-[620px]">
          <DialogHeader className="items-stretch text-start sm:text-start">
            <DialogTitle className="text-start">{t("appointment.cancel.customerEdit.title")}</DialogTitle>
            <DialogDescription className="text-start leading-6">
              {t("appointment.cancel.customerEdit.description")}
            </DialogDescription>
          </DialogHeader>

          {customerEditLoading ? (
            <div className="flex items-center justify-center rounded-2xl border border-border/70 bg-muted/30 py-8 text-sm font-bold text-muted-foreground">
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t("appointment.cancel.customerEdit.loading")}
            </div>
          ) : (
            <UserProfileForm
              form={customerEditForm}
              onChange={setCustomerEditForm}
              requirements={registrationRequirements}
              errors={customerEditErrors}
              showMobile
              cardless
            />
          )}

          <DialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start sm:space-x-0">
            <Button type="button" onClick={() => void handleSaveCustomerEdit()} disabled={customerEditSaving || customerEditLoading}>
              {customerEditSaving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
              {t("appointment.cancel.customerEdit.save")}
            </Button>
            <Button type="button" variant="outline" disabled={customerEditSaving} onClick={() => setCustomerEditOpen(false)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
