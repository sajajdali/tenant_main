import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { CustomerClubMePayload, ManualFinanceCustomerSummary, PaymentProvider, PaymentSettings, Section, UserLookupResult } from "@/lib/types";
import { addMinutes, format, parse } from "date-fns";
import { ArrowRight, Calendar, Gem, Loader2, Lock, Pencil, Phone, Unlock, User, Users, Wallet } from "lucide-react";
import { LoginModal } from "./login-modal";
import { api } from "@/lib/api";
import { normalizePhoneInput } from "@/lib/normalize";
import { useToast } from "@/hooks/use-toast";
import { PAYMENT_GATEWAY_MAP } from "@/lib/payment-gateways";
import { getEffectiveSectionSchedule } from "@/lib/service-schedule";
import { cn } from "@/lib/utils";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { LtrText, PhoneText } from "@/i18n/ltr-text";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: Section;
  date: string;
  time: string;
  offQueueBooking?: boolean;
  vipOnlySlot?: boolean;
  quickBlockAvailable?: boolean;
  quickBlockedSlot?: boolean;
  quickBlockCanApplyToAllSections?: boolean;
  onQuickToggleSlot?: (scope?: "section" | "all") => Promise<boolean> | boolean | void;
}

export function BookingModal({
  isOpen,
  onClose,
  section,
  date,
  time,
  offQueueBooking = false,
  vipOnlySlot = false,
  quickBlockAvailable = false,
  quickBlockedSlot = false,
  quickBlockCanApplyToAllSections = false,
  onQuickToggleSlot,
}: BookingModalProps) {
  const { user, isAdmin, isBarber, isAuthenticated } = useAuth();
  const { createAppointment, fetchAppointments } = useStore();
  const { toast } = useToast();
  const t = useT();
  const formatValue = useFormat();
  const { dir, isRtl } = useLocale();

  const [showLogin, setShowLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [customerClubSummary, setCustomerClubSummary] = useState<CustomerClubMePayload | null>(null);
  const [customerClubLoading, setCustomerClubLoading] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupResult, setLookupResult] = useState<UserLookupResult | null>(null);
  const [financeSummary, setFinanceSummary] = useState<ManualFinanceCustomerSummary | null>(null);
  const [financeSummaryLoading, setFinanceSummaryLoading] = useState(false);
  const [identityResolved, setIdentityResolved] = useState(false);
  const [editingResolvedIdentity, setEditingResolvedIdentity] = useState(false);
  const [quickToggleLoading, setQuickToggleLoading] = useState(false);
  const [quickBlockScopePromptOpen, setQuickBlockScopePromptOpen] = useState(false);

  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [isForSomeoneElse, setIsForSomeoneElse] = useState(false);

  const isStaff = isAdmin || isBarber;
  const staffMobileConfirmationEnabled = isStaff && !!paymentSettings?.customerMobileConfirmationEnabled;
  const resolvingStaffBookingFlow = isStaff && paymentSettings === null;
  const bookingBlockedForUser = !!user && user.role === "customer" && user.canBook === false;
  const mobileLookupBlockedForUser = lookupResult?.user?.role === "customer" && lookupResult.user.canBook === false;
  const mobileLookupName = (lookupResult?.user?.name || userName).trim();
  const mobileLookupNeedsName = staffMobileConfirmationEnabled && identityResolved && userName.trim().length < 3;
  const selectedDateLabel = formatValue.date(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const isPastAppointment = new Date(`${date}T${time}:00`).getTime() < Date.now();
  const money = (value: number) => t("booking.modal.amountToman", { amount: formatValue.number(value) });

  useEffect(() => {
    api.payment.getSettings().then((res) => {
      if (res.success) {
        setPaymentSettings(res.data);
      }
    });
  }, []);

  useEffect(() => {
    if (!isOpen || !user || isStaff || (section.price ?? 0) <= 0) {
      setCustomerClubSummary(null);
      setCustomerClubLoading(false);
      return;
    }

    let active = true;
    setCustomerClubLoading(true);

    api.customerClub.me()
      .then((res) => {
        if (!active) return;
        setCustomerClubSummary(res.success ? res.data : null);
      })
      .finally(() => {
        if (active) {
          setCustomerClubLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen, isStaff, section.price, user]);

  useEffect(() => {
    if (!isOpen || !isStaff || staffMobileConfirmationEnabled || userPhone.length !== 11) {
      if (!staffMobileConfirmationEnabled) {
        setFinanceSummary(null);
        setFinanceSummaryLoading(false);
      }
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setFinanceSummaryLoading(true);
      api.manualFinance.customerSummaries({
        mobiles: [userPhone],
        professionalId: section.barberId,
      }).then((res) => {
        if (cancelled) return;
        setFinanceSummary(res.success ? res.data.items[0] ?? null : null);
      }).finally(() => {
        if (!cancelled) {
          setFinanceSummaryLoading(false);
        }
      });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [isOpen, isStaff, section.barberId, staffMobileConfirmationEnabled, userPhone]);

  useEffect(() => {
    if (!isOpen) return;

    if (user && isStaff && paymentSettings === null) {
      return;
    }

    setNotes("");
    setSendSms(true);
    setIsForSomeoneElse(false);
    setLookupPhone("");
    setLookupResult(null);
    setFinanceSummary(null);
    setFinanceSummaryLoading(false);
    setIdentityResolved(false);
    setEditingResolvedIdentity(false);
    setUserName("");
    setUserPhone("");

    const enabledGateways = paymentSettings?.enabledGateways ?? [];
    setSelectedGateway(enabledGateways.length === 1 ? enabledGateways[0] : "");

    if (user) {
      if (!user.name) {
        setShowLogin(true);
        return;
      }

      if (isStaff) {
        if (staffMobileConfirmationEnabled) {
          setShowLogin(false);
          return;
        }
        setShowLogin(false);
        return;
      }

      setUserName(user.name);
      setUserPhone(user.phone);
      setShowLogin(false);
      return;
    }

    setShowLogin(true);
  }, [isOpen, isStaff, staffMobileConfirmationEnabled, paymentSettings, paymentSettings?.enabledGateways, user]);

  const totalAmount = section.price ?? 0;
  const customerWalletBalance =
    !paymentSettings?.tenantMaliartEnabled && !isStaff && user?.role === "customer" && customerClubSummary?.moduleActive
      ? customerClubSummary.account.walletBalance
      : 0;
  const walletUsedAmount = Math.min(customerWalletBalance, totalAmount);
  const payableAmount = Math.max(0, totalAmount - walletUsedAmount);
  const paymentFlowAvailable =
    !!paymentSettings?.sandboxEnabled ||
    !!paymentSettings?.enabledGateways?.length ||
    !!paymentSettings?.tenantMaliartEnabled ||
    walletUsedAmount > 0;
  const paymentRequired =
    !isStaff &&
    totalAmount > 0 &&
    paymentFlowAvailable;
  const submitDisabled =
    loading ||
    (!isStaff && totalAmount > 0 && paymentSettings === null) ||
    customerClubLoading ||
    bookingBlockedForUser ||
    mobileLookupBlockedForUser ||
    (staffMobileConfirmationEnabled && !identityResolved) ||
    (paymentRequired && payableAmount > 0 && !paymentSettings?.sandboxEnabled && !paymentSettings?.tenantMaliartEnabled && !selectedGateway);
  const isLookupStep = staffMobileConfirmationEnabled && !identityResolved;
  const showQuickBlockAction =
    quickBlockAvailable &&
    !offQueueBooking &&
    !!onQuickToggleSlot &&
    (!staffMobileConfirmationEnabled || isLookupStep);

  const handleQuickToggleClick = async (scope: "section" | "all" = "section") => {
    if (!onQuickToggleSlot || quickToggleLoading) {
      return;
    }

    setQuickToggleLoading(true);
    try {
      setQuickBlockScopePromptOpen(false);
      const result = await onQuickToggleSlot(scope);
      if (result !== false) {
        onClose();
      }
    } finally {
      setQuickToggleLoading(false);
    }
  };

  const handleQuickActionRequest = () => {
    if (quickToggleLoading) {
      return;
    }

    if (!quickBlockedSlot && quickBlockCanApplyToAllSections) {
      setQuickBlockScopePromptOpen(true);
      return;
    }

    void handleQuickToggleClick("section");
  };

  const handleLookupButtonClick = async () => {
    if (lookupPhone.length !== 11) return;

    setLookupLoading(true);
    const res = await api.users.lookup(lookupPhone);
    setLookupLoading(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setLookupResult(res.data);
    setIdentityResolved(true);
    setEditingResolvedIdentity(false);
    setUserPhone(lookupPhone);
    setUserName(res.data.user?.name || res.data.suggestedName || "");

    setFinanceSummaryLoading(true);
    const financeRes = await api.manualFinance.customerSummaries({
      mobiles: [lookupPhone],
      professionalId: section.barberId,
    });
    setFinanceSummaryLoading(false);
    setFinanceSummary(financeRes.success ? financeRes.data.items[0] ?? null : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }

    if (staffMobileConfirmationEnabled && !identityResolved) {
      return;
    }

    const finalUserName = (isStaff || isForSomeoneElse ? userName : user?.name || "").trim();
    const finalUserPhone = (isStaff || isForSomeoneElse ? userPhone : user?.phone || "").trim();

    if (!finalUserName || !finalUserPhone) {
      toast({
        variant: "destructive",
        title: t("booking.modal.incompleteInfoTitle"),
        description: t("booking.modal.incompleteInfoDescription"),
      });
      return;
    }

    setLoading(true);

    const schedule = getEffectiveSectionSchedule(section, date);
    const startTimeDate = parse(time, "HH:mm", new Date());
    const endTimeDate = addMinutes(startTimeDate, schedule.slotDurationMinutes);
    const endTime = format(endTimeDate, "HH:mm");

    const bookingPayload = {
      sectionId: section.id,
      date,
      startTime: time,
      endTime,
      userName: finalUserName,
      userPhone: finalUserPhone,
      originalUserPhone: staffMobileConfirmationEnabled && identityResolved && lookupResult?.exists ? lookupPhone : undefined,
      notes: isStaff ? notes : undefined,
      sendSms: isStaff && !isPastAppointment ? sendSms : false,
      isForSomeoneElse: isStaff ? finalUserPhone !== user?.phone : isForSomeoneElse,
      offQueueBooking,
    };

    if (paymentRequired) {
      if (payableAmount > 0 && !paymentSettings?.sandboxEnabled && !selectedGateway) {
        toast({
          variant: "destructive",
          title: t("booking.modal.payment.gatewayRequiredTitle"),
          description: t("booking.modal.payment.gatewayRequiredDescription"),
        });
        setLoading(false);
        return;
      }

      const paymentRes = await api.payment.checkoutAppointment({
        barberId: section.barberId,
        sectionId: section.id,
        date,
        startTime: time,
        endTime,
        userName: bookingPayload.userName,
        userPhone: bookingPayload.userPhone,
        notes: bookingPayload.notes,
        sendSms: bookingPayload.sendSms,
        isForSomeoneElse: bookingPayload.isForSomeoneElse,
        gateway: selectedGateway ? (selectedGateway as PaymentProvider) : undefined,
      });

      if (!paymentRes.success) {
        toast({ variant: "destructive", title: t("booking.modal.payment.errorTitle"), description: paymentRes.message });
        setLoading(false);
        return;
      }

      if (paymentRes.data.mode === "sandbox" || paymentRes.data.mode === "wallet") {
        toast({
          title: t("booking.modal.payment.successTitle"),
          description: paymentRes.data.mode === "wallet"
            ? t("booking.modal.payment.walletSuccessDescription")
            : t("booking.modal.payment.sandboxSuccessDescription"),
        });
        await fetchAppointments();
        onClose();
        setLoading(false);
        return;
      }

      if (paymentRes.data.redirectForm) {
        const form = document.createElement("form");
        form.method = paymentRes.data.redirectForm.method || "POST";
        form.action = paymentRes.data.redirectForm.action;
        form.style.display = "none";

        Object.entries(paymentRes.data.redirectForm.inputs || {}).forEach(([key, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
        return;
      }

      if (paymentRes.data.paymentUrl) {
        window.location.assign(paymentRes.data.paymentUrl);
        return;
      }

      toast({
        variant: "destructive",
        title: t("booking.modal.payment.errorTitle"),
        description: t("booking.modal.payment.redirectMissingDescription"),
      });
      setLoading(false);
      return;
    }

    const success = await createAppointment(bookingPayload);
    setLoading(false);

    if (success) {
      onClose();
    }
  };

  const resetResolvedIdentity = () => {
    setIdentityResolved(false);
    setLookupResult(null);
    setFinanceSummary(null);
    setFinanceSummaryLoading(false);
    setLookupPhone(userPhone);
    setEditingResolvedIdentity(false);
    setUserName("");
    setUserPhone("");
  };

  const renderUserIdentityCard = (name: string, phone: string, blocked = false, allowInlineEdit = false) => (
    <div className="bg-muted/50 p-4 rounded-lg space-y-3 text-sm">
      {allowInlineEdit && editingResolvedIdentity ? (
        <>
          <div className="space-y-2">
            <Label>{t("booking.modal.customerNameLabel")}</Label>
            <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder={t("booking.modal.customerNamePlaceholder")} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("booking.modal.mobileLabel")}</Label>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setEditingResolvedIdentity(false)}>
                {t("booking.modal.finishEdit")}
              </Button>
            </div>
            <Input
              value={userPhone}
              onChange={(e) => setUserPhone(normalizePhoneInput(e.target.value))}
              placeholder="0912..."
              dir="ltr"
              inputMode="numeric"
              className="text-start"
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-primary font-bold">
            <User className="w-4 h-4" />
            {name || t("booking.modal.noName")}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
            <div className="flex items-center gap-2 text-muted-foreground font-mono">
              <Phone className="w-4 h-4" />
              <PhoneText>{phone}</PhoneText>
            </div>
            {allowInlineEdit && (
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditingResolvedIdentity(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </>
      )}
      <p className="pt-1 text-xs text-muted-foreground">
        {t("booking.modal.bookedForThisUser")}
      </p>
      {financeSummaryLoading ? (
        <p className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          {t("booking.modal.financeChecking")}
        </p>
      ) : financeSummary && financeSummary.balanceAmount > 0 ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
          {t("booking.modal.financeDebtor", { amount: money(financeSummary.balanceAmount) })}
        </p>
      ) : financeSummary && financeSummary.entriesCount > 0 ? (
        <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
          {t("booking.modal.financeNoDebt", { amount: money(financeSummary.paidAmount) })}
        </p>
      ) : null}
      {blocked && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {t("booking.modal.bookingDisabledForAccount")}
        </p>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={isOpen && !showLogin} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="booking-modal-content sm:max-w-[425px]" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {t("booking.modal.title")}
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-center">
                  <span className="block text-[11px] font-bold text-muted-foreground">{t("booking.modal.timeLabel")}</span>
                  <span className="mt-0.5 block text-base font-black text-primary">
                    {selectedDateLabel} <span className="text-sm">{t("booking.modal.hourPrefix")}</span>{" "}
                    <LtrText>{time}</LtrText>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t("booking.modal.sectionPrefix")} <span className="font-bold text-foreground">{section.name}</span>
                  </span>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          {isPastAppointment && isAdmin ? (
            <div className="booking-past-appointment-alert rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 py-2.5 text-start">
              <p className="booking-past-appointment-alert__title text-sm font-black text-amber-300">
                {t("booking.modal.pastAppointmentTitle")}
              </p>
              <p className="booking-past-appointment-alert__description mt-1 text-xs leading-6 text-amber-100/75">
                {t("booking.modal.pastAppointmentDescription")}
              </p>
            </div>
          ) : null}

          {showQuickBlockAction && (
            <div className="flex justify-start -mb-1 -mt-1">
              <div
                role="button"
                tabIndex={quickToggleLoading ? -1 : 0}
                aria-disabled={quickToggleLoading}
                onClick={handleQuickActionRequest}
                onKeyDown={(event) => {
                  if (quickToggleLoading || (event.key !== "Enter" && event.key !== " ")) return;

                  event.preventDefault();
                  handleQuickActionRequest();
                }}
                className={cn(
                  "group inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-start text-[11px] font-black opacity-90 shadow-sm transition hover:opacity-100",
                  quickBlockedSlot
                    ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-200 shadow-emerald-950/20 hover:bg-emerald-500/15 hover:text-emerald-100"
                    : "border-rose-300/25 bg-rose-500/10 text-rose-200 shadow-rose-950/20 hover:bg-rose-500/15 hover:text-rose-100",
                  quickToggleLoading && "pointer-events-none opacity-65",
                )}
              >
                {quickBlockedSlot ? <Unlock className="h-3.5 w-3.5 shrink-0" /> : <Lock className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{quickBlockedSlot ? t("booking.modal.quickOpenTime") : t("booking.modal.quickCloseTime")}</span>
                {quickToggleLoading && (
                  <Loader2
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 animate-spin",
                      quickBlockedSlot ? "text-emerald-200/80" : "text-rose-200/80",
                    )}
                  />
                )}
              </div>
            </div>
          )}

          {quickBlockedSlot ? (
            <div className="-mt-2 space-y-3 pb-4 pt-0">
              <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-center text-sm font-bold leading-7 text-amber-200">
                {t("booking.modal.quickBlockedInfo")}
              </div>
              <Button type="button" variant="outline" onClick={onClose} className="h-11 w-full rounded-2xl">
                {t("booking.modal.close")}
              </Button>
            </div>
          ) : resolvingStaffBookingFlow ? (
            <div className="flex items-center justify-center py-10">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("booking.modal.preparingForm")}
              </div>
            </div>
          ) : (
          <form onSubmit={isLookupStep ? (e) => {
            e.preventDefault();
            void handleLookupButtonClick();
          } : handleSubmit} className={cn("space-y-4 pb-4", showQuickBlockAction ? "pt-0" : "pt-4")}>
            {vipOnlySlot && (
              <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-3 text-sm text-cyan-100">
                <div className="flex items-center gap-2 font-bold">
                  <Gem className="h-4 w-4" />
                  {t("booking.modal.vipTitle")}
                </div>
                <p className="mt-2 leading-7 text-cyan-50/90">
                  {isStaff
                    ? t("booking.modal.vipStaffDescription")
                    : t("booking.modal.vipCustomerDescription")}
                </p>
              </div>
            )}

            {isLookupStep && (
              <div className="space-y-4 rounded-lg border bg-card/40 p-4">
                <Label className="font-bold">{t("booking.modal.lookupPhoneLabel")}</Label>
                <div className="space-y-2">
                  <Input
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(normalizePhoneInput(e.target.value))}
                    placeholder="0912..."
                    dir="ltr"
                    inputMode="numeric"
                    className="text-start"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={lookupLoading || lookupPhone.length !== 11}>
                  {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("booking.modal.nextStep")}
                </Button>
              </div>
            )}

            {!staffMobileConfirmationEnabled && !isStaff && (
              <div className="flex items-center gap-2.5 pb-2">
                <Checkbox
                  id="someone-else"
                  checked={isForSomeoneElse}
                  onCheckedChange={(checked) => {
                    setIsForSomeoneElse(!!checked);
                    if (checked) {
                      setUserName("");
                      setUserPhone("");
                    } else if (user) {
                      setUserName(user.name || "");
                      setUserPhone(user.phone || "");
                    }
                  }}
                />
                <Label htmlFor="someone-else" className="cursor-pointer flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {t("booking.modal.bookForSomeoneElse")}
                </Label>
              </div>
            )}

            {(isStaff || isForSomeoneElse) && !staffMobileConfirmationEnabled && (
              <>
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label>{t("booking.modal.customerNameLabel")}</Label>
                  <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder={t("booking.modal.customerNamePlaceholder")} required />
                </div>
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label>{isPastAppointment ? t("booking.modal.contactLabel") : t("booking.modal.contactNotificationLabel")}</Label>
                  <Input
                    value={userPhone}
                    onChange={(e) => setUserPhone(normalizePhoneInput(e.target.value))}
                    placeholder="0912..."
                    dir="ltr"
                    inputMode="numeric"
                    className="text-start"
                    required
                  />
                </div>
              </>
            )}

            {staffMobileConfirmationEnabled && identityResolved && (
              lookupResult?.exists && lookupResult.user && mobileLookupName ? (
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="ghost"
                    className="absolute end-14 top-3.5 flex h-6 items-center gap-1 px-1 py-0 text-[10px] leading-none text-muted-foreground hover:text-foreground"
                    onClick={resetResolvedIdentity}
                  >
                    <ArrowRight className={cn("h-3.5 w-3.5", isRtl ? "" : "rotate-180")} />
                    {t("booking.modal.back")}
                  </Button>
                  {renderUserIdentityCard(mobileLookupName, userPhone, mobileLookupBlockedForUser, true)}
                </div>
              ) : (
                <div className="space-y-4 rounded-lg border bg-card/40 p-4">
                  <Button
                    type="button"
                    variant="ghost"
                    className="absolute end-14 top-3.5 flex h-6 items-center gap-1 px-1 py-0 text-[10px] leading-none text-muted-foreground hover:text-foreground"
                    onClick={resetResolvedIdentity}
                  >
                    <ArrowRight className={cn("h-3.5 w-3.5", isRtl ? "" : "rotate-180")} />
                    {t("booking.modal.back")}
                  </Button>
                  <div className="space-y-1">
                    <Label className="font-bold">{lookupResult?.exists ? t("booking.modal.completeUserNameTitle") : t("booking.modal.newUserTitle")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {lookupResult?.exists
                        ? t("booking.modal.completeUserNameDescription")
                        : t("booking.modal.newUserDescription")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("booking.modal.fullNameLabel")}</Label>
                    <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder={t("booking.modal.fullNamePlaceholder")} required />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                    <div className="text-xs text-muted-foreground font-mono" dir="ltr">
                      <PhoneText>{userPhone}</PhoneText>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditingResolvedIdentity((current) => !current)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  {editingResolvedIdentity && (
                    <div className="space-y-2">
                      <Label>{t("booking.modal.editMobileLabel")}</Label>
                      <Input
                        value={userPhone}
                        onChange={(e) => setUserPhone(normalizePhoneInput(e.target.value))}
                        placeholder="0912..."
                        dir="ltr"
                        inputMode="numeric"
                        className="text-start"
                      />
                    </div>
                  )}
                </div>
              )
            )}

            {isStaff && (!staffMobileConfirmationEnabled || identityResolved) && (
              <>
                <div className="space-y-2">
                  <Label>{t("booking.modal.notesLabel")}</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("booking.modal.notesPlaceholder")} />
                </div>
                {!isPastAppointment ? (
                  <div className="flex items-center gap-2.5">
                    <Checkbox id="sms" checked={sendSms} onCheckedChange={(checked) => setSendSms(!!checked)} />
                    <Label htmlFor="sms" className="cursor-pointer">{t("booking.modal.sendSmsLabel")}</Label>
                  </div>
                ) : null}
              </>
            )}

            {!isStaff && !isForSomeoneElse && !staffMobileConfirmationEnabled && (
              user ? (
                renderUserIdentityCard(user.name || "", user.phone, bookingBlockedForUser)
              ) : (
                <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground leading-7">
                  {t("booking.modal.loginRequired")}
                </div>
              )
            )}

            {paymentRequired && (
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg space-y-2 text-sm">
                <p className="font-bold text-primary">{t("booking.modal.payment.requiredTitle")}</p>
                <div className="space-y-1 rounded-xl bg-background/60 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t("booking.modal.payment.serviceAmount")}</span>
                    <span className="font-bold">{money(totalAmount)}</span>
                  </div>
                  {walletUsedAmount > 0 && (
                    <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400">
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="h-4 w-4" />
                        {t("booking.modal.payment.walletCredit")}
                      </span>
                      <span className="font-bold">- {money(walletUsedAmount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 pt-1 text-sm">
                    <span className="text-muted-foreground">{t("booking.modal.payment.remainingAmount")}</span>
                    <span className="font-black text-primary">{money(payableAmount)}</span>
                  </div>
                </div>
                {walletUsedAmount > 0 ? (
                  <p className="text-muted-foreground">
                    {payableAmount > 0
                      ? t("booking.modal.payment.walletPartialDescription")
                      : t("booking.modal.payment.walletFullDescription")}
                  </p>
                ) : (
                  <p className="text-muted-foreground">{t("booking.modal.payment.notBookedBeforePayment")}</p>
                )}
                {!!paymentSettings?.sandboxEnabled && payableAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("booking.modal.payment.sandboxDescription")}
                  </p>
                )}
                {payableAmount > 0 && !paymentSettings?.sandboxEnabled && (
                <div className="space-y-2 pt-2">
                  <Label>{t("booking.modal.payment.gatewayLabel")}</Label>
                  {paymentSettings?.tenantMaliartEnabled ? (
                    <div className="rounded-xl border border-primary bg-primary/10 px-3 py-3 font-bold text-foreground">
                      {t("payment.directGateway")}
                    </div>
                  ) : <div className="grid gap-2">
                    {(paymentSettings?.enabledGateways ?? []).map((gateway) => (
                      <button
                        key={gateway}
                        type="button"
                        onClick={() => setSelectedGateway(gateway)}
                        className={`rounded-xl border px-3 py-3 text-start transition ${
                          selectedGateway === gateway
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/70 bg-background text-muted-foreground"
                        }`}
                      >
                        {PAYMENT_GATEWAY_MAP[gateway]?.labelKey ? t(PAYMENT_GATEWAY_MAP[gateway].labelKey) : gateway}
                      </button>
                    ))}
                  </div>}
                </div>
                )}
              </div>
            )}

            {!isLookupStep && (
              <DialogFooter className="mt-6 flex-row-reverse sm:justify-start gap-2">
                <Button type="submit" className="flex-1" disabled={submitDisabled || mobileLookupNeedsName}>
                  {loading
                    ? (paymentRequired ? t("booking.modal.submit.processingPayment") : t("booking.modal.submit.saving"))
                    : (paymentRequired
                        ? (payableAmount > 0 ? t("booking.modal.submit.payAndBook") : t("booking.modal.submit.confirmWithWallet"))
                        : t("booking.modal.submit.confirm"))}
                </Button>
                <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                  {t("common.cancel")}
                </Button>
              </DialogFooter>
            )}
          </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={quickBlockScopePromptOpen} onOpenChange={setQuickBlockScopePromptOpen}>
        <DialogContent className="booking-modal-content sm:max-w-[360px]" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-lg font-black">{t("booking.modal.quickPromptTitle")}</DialogTitle>
            <DialogDescription className="leading-7">
              {t("booking.modal.quickPromptDescriptionBefore")} <LtrText className="font-bold text-foreground">{time}</LtrText> {t("booking.modal.quickPromptDescriptionAfter")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleQuickToggleClick("section")}
              disabled={quickToggleLoading}
              className="h-10 w-full rounded-xl border-rose-300/25 bg-rose-500/10 px-3 text-rose-100 hover:bg-rose-500/15 hover:text-rose-50"
            >
              <span className="flex w-full items-center justify-center gap-2 text-xs font-black">
                <span className="h-2 w-2 rounded-full bg-rose-400 shadow-sm shadow-rose-400/40" />
                {t("booking.modal.quickCloseForSection", { section: section.name })}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleQuickToggleClick("all")}
              disabled={quickToggleLoading}
              className="h-10 w-full rounded-xl border-rose-300/25 bg-rose-500/10 px-3 text-rose-100 hover:bg-rose-500/15 hover:text-rose-50"
            >
              <span className="flex w-full items-center justify-center gap-2 text-xs font-black">
                <span className="h-2 w-2 rounded-full bg-rose-400 shadow-sm shadow-rose-400/40" />
                {t("booking.modal.quickCloseForAll")}
              </span>
            </Button>
          </div>
          {quickToggleLoading && (
            <div className="flex items-center justify-center gap-2 pt-1 text-xs font-bold text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("booking.modal.quickSaving")}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onDismiss={() => {
          setShowLogin(false);
          onClose();
        }}
        onSuccess={() => setShowLogin(false)}
      />
    </>
  );
}
