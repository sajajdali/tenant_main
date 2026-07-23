import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Edit3, Gem, Loader2, Phone, ReceiptText, Search, Trash2, User, Users, WalletCards } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { ManualFinanceCustomerSummary, ManualFinanceDashboardPayload, PaginatedTenantUsers, TenantMeta, TenantPanelUser } from "@/lib/types";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserAppointmentsModal } from "@/components/user-appointments-modal";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { normalizeDigits } from "@/lib/normalize";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { PhoneText } from "@/i18n/ltr-text";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useFormat, useT } from "@/i18n/locale";
import { useLocale } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

const paymentMethodKeys = {
  card: "panelUsers.payment.card",
  cash: "panelUsers.payment.cash",
  online: "panelUsers.payment.online",
  transfer: "panelUsers.payment.transfer",
  other: "panelUsers.payment.other",
} as const satisfies Record<string, MessageKey>;

function PanelUsersPage() {
  const { isAdmin, isBarber, user } = useAuth();
  const { barbers } = useStore();
  const { toast } = useToast();
  const t = useT();
  const formatValue = useFormat();
  const { dir, isRtl } = useLocale();
  const ownBarber = useMemo(
    () => (isBarber ? barbers.find((barber) => barber.userId === user?.id) ?? null : null),
    [barbers, isBarber, user?.id],
  );
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [togglingMobile, setTogglingMobile] = useState<string | null>(null);
  const [vipTogglingMobile, setVipTogglingMobile] = useState<string | null>(null);
  const [selectedPanelUser, setSelectedPanelUser] = useState<TenantPanelUser | null>(null);
  const [financeUser, setFinanceUser] = useState<TenantPanelUser | null>(null);
  const [financePayload, setFinancePayload] = useState<ManualFinanceDashboardPayload | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financePage, setFinancePage] = useState(1);
  const [financeSummaries, setFinanceSummaries] = useState<Record<string, ManualFinanceCustomerSummary>>({});
  const [editingUser, setEditingUser] = useState<TenantPanelUser | null>(null);
  const [expandedInfoMobile, setExpandedInfoMobile] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UserProfileFormValues>(getUserProfileFormDefaults());
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof UserProfileFormValues, string>>>({});
  const [registrationRequirements, setRegistrationRequirements] = useState<RegistrationRequirements>(getDefaultRegistrationRequirements());
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingUser, setDeletingUser] = useState<TenantPanelUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [data, setData] = useState<PaginatedTenantUsers>({
    items: [],
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  });
  const labels = getAudienceLabels(tenantMeta);
  const nutritionMessageSupported = ["nutritionists", "nutrition-doctors"].includes(tenantMeta?.audience?.slug ?? "");
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const vipFeatureActive =
    data.vipFeatureActive ??
    tenantMeta?.activeFeatureModules?.some((item) => item.slug === "vip-customers") ??
    false;
  const money = (value: number) => formatValue.currency(value);
  const formatDate = (value?: string | null) => (value ? formatValue.date(new Date(`${value}T12:00:00`), { year: "numeric", month: "short", day: "numeric" }) : t("panelUsers.noDate"));
  const paymentMethodLabel = (method: string) => {
    const key = paymentMethodKeys[method as keyof typeof paymentMethodKeys] ?? paymentMethodKeys.other;
    return t(key);
  };

  const getGenderLabel = (gender?: TenantPanelUser["gender"]) => {
    if (gender === "male") return t("profile.gender.male");
    if (gender === "female") return t("profile.gender.female");
    return t("panelUsers.valueMissing");
  };

  const formatBirthDate = (birthDate?: string | null) => {
    if (!birthDate) return t("panelUsers.valueMissing");
    return birthDate.replaceAll("-", "/");
  };

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) {
        setTenantMeta(res.data);
      }
    });

    api.payment.getSettings().then((res) => {
      if (res.success) {
        setRegistrationRequirements(normalizeRegistrationRequirements(res.data.registrationRequirements));
      }
    });
  }, []);

  useEffect(() => {
    if (isBarber && ownBarber) {
      setSelectedBarberId(ownBarber.id);
      return;
    }

    if (isAdmin && !selectedBarberId && barbers.length > 0) {
      setSelectedBarberId(barbers[0].id);
    }
  }, [barbers, isAdmin, isBarber, ownBarber, selectedBarberId]);

  const isAllUsersView = selectedBarberId === "__all__";

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadUsers = async (page = 1, barberId = selectedBarberId, searchTerm = debouncedSearch) => {
    if (!barberId) return;
    setLoading(true);
    const res = await api.users.list(barberId, page, 10, searchTerm);
    if (res.success) {
      setData(res.data);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!selectedBarberId) return;
    loadUsers(1, selectedBarberId, debouncedSearch);
  }, [selectedBarberId, debouncedSearch]);

  useEffect(() => {
    const mobiles = data.items.map((item) => item.mobile).filter(Boolean);
    if (!mobiles.length || !selectedBarberId) {
      setFinanceSummaries({});
      return;
    }

    let cancelled = false;
    api.manualFinance.customerSummaries({
      mobiles,
      professionalId: selectedBarberId === "__all__" ? null : selectedBarberId,
    }).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setFinanceSummaries(Object.fromEntries(res.data.items.map((item) => [item.customerPhone, item])));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [data.items, selectedBarberId]);

  const loadFinanceProfile = async (panelUser: TenantPanelUser, page = 1) => {
    setFinanceUser(panelUser);
    setFinancePage(page);
    setFinanceLoading(true);
    const res = await api.manualFinance.dashboard({
      mobile: panelUser.mobile,
      professionalId: selectedBarberId === "__all__" ? undefined : selectedBarberId,
      page,
      perPage: 5,
    });
    setFinanceLoading(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setFinancePayload(res.data);
  };

  const handleToggleBookingAccess = async (panelUser: TenantPanelUser, blocked: boolean) => {
    setTogglingMobile(panelUser.mobile);
    const res = await api.users.updateBookingAccess(panelUser.mobile, selectedBarberId, !blocked);
    setTogglingMobile(null);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.mobile === panelUser.mobile ? { ...item, canBook: res.data.canBook } : item,
      ),
    }));

    toast({
      title: res.data.canBook ? t("panelUsers.toast.bookingOpened") : t("panelUsers.toast.bookingClosed"),
    });
  };

  const handleToggleVipAccess = async (panelUser: TenantPanelUser, nextVipState: boolean) => {
    setVipTogglingMobile(panelUser.mobile);
    const res = await api.users.updateVipAccess(panelUser.mobile, selectedBarberId, nextVipState);
    setVipTogglingMobile(null);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.mobile === panelUser.mobile ? { ...item, isVip: res.data.isVip } : item,
      ),
    }));

    toast({
      title: res.data.isVip ? t("panelUsers.toast.vipEnabled") : t("panelUsers.toast.vipDisabled"),
      description: res.data.isVip
        ? t("panelUsers.toast.vipEnabledDescription")
        : t("panelUsers.toast.vipDisabledDescription"),
    });
  };

  const openEditDialog = (panelUser: TenantPanelUser) => {
    setEditingUser(panelUser);
    setEditForm(getUserProfileFormDefaults({
      name: panelUser.fullName || "",
      mobile: panelUser.mobile,
      email: panelUser.email,
      gender: panelUser.gender,
      nationalCode: panelUser.nationalCode,
      birthDate: panelUser.birthDate,
      provinceId: panelUser.provinceId,
      cityId: panelUser.cityId,
      jobTitle: panelUser.jobTitle,
      nutritionProfileFixedMessage: panelUser.nutritionProfileFixedMessage ?? "",
    }));
    setEditErrors({});
  };

  const handleSaveIdentity = async () => {
    if (!editingUser || !selectedBarberId) return;

    const nextErrors = validateUserProfileForm(editForm, registrationRequirements, {
      requireMobile: true,
      t,
      formatNumber: formatValue.number,
    });
    setEditErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSavingEdit(true);
    const payload = buildUserProfilePayload(editForm);
    const res = await api.users.updateIdentity(editingUser.mobile, selectedBarberId, {
      ...payload,
      mobile: payload.mobile || "",
      nutritionProfileFixedMessage: nutritionMessageSupported ? (editForm as UserProfileFormValues & { nutritionProfileFixedMessage?: string }).nutritionProfileFixedMessage || "" : "",
    });
    setSavingEdit(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setData((current) => ({
      ...current,
      items: current.items.map((item) => (item.mobile === editingUser.mobile ? res.data : item)),
    }));

    setSelectedPanelUser((current) => (current?.mobile === editingUser.mobile ? res.data : current));
    setEditingUser(null);

    toast({ title: t("panelUsers.toast.updated") });
  };

  const handleDeleteUser = async () => {
    if (!deletingUser || deleteLoading) return;

    setDeleteLoading(true);
    const res = await api.users.delete(deletingUser.mobile);
    setDeleteLoading(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("panelUsers.toast.deleteFailed"), description: res.message });
      return;
    }

    const deletedMobile = deletingUser.mobile;
    const nextPage = data.items.length === 1 && data.currentPage > 1
      ? data.currentPage - 1
      : data.currentPage;

    setDeletingUser(null);
    setSelectedPanelUser((current) => (current?.mobile === deletedMobile ? null : current));
    setFinanceUser((current) => (current?.mobile === deletedMobile ? null : current));
    setEditingUser((current) => (current?.mobile === deletedMobile ? null : current));
    await loadUsers(nextPage, selectedBarberId, debouncedSearch);

    toast({
      title: t("panelUsers.toast.deleted"),
      description: t("panelUsers.toast.deletedDescription", { count: formatValue.number(res.data.deletedAppointments) }),
    });
  };

  if (!isAdmin && !isBarber) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <Users className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{t("panelUsers.accessDenied.title")}</h1>
          <p className="text-muted-foreground leading-7">{t("panelUsers.accessDenied.description", { professional: labels.singular })}</p>
          <Link href="/panel">
            <Button>{t("common.back")}</Button>
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
            <h1 className="text-xl font-bold text-foreground">{t("panelUsers.title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/panel/users/debtors">
              <Button variant="outline" className="h-10 rounded-2xl border-border bg-background/40 px-4 font-bold hover:bg-background/70">
                <ReceiptText className="me-2 h-4 w-4" />
                {t("panelUsers.debtors")}
              </Button>
            </Link>
            <Link href="/panel">
              <Button
                variant="outline"
                size="icon"
                title={t("common.back")}
                className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
              >
                {isRtl ? <ArrowRight className="w-5 h-5 rotate-180" /> : <ArrowLeft className="w-5 h-5" />}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("panelUsers.professional.title", { professional: labels.singular })}</CardTitle>
            <CardDescription>
              {isAdmin
                ? t("panelUsers.professional.descriptionAdmin", { professional: labels.singular })
                : t("panelUsers.professional.descriptionBarber")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <select
                dir={dir}
                value={selectedBarberId}
                onChange={(event) => setSelectedBarberId(event.target.value)}
                disabled={isBarber}
                className="w-full appearance-none rounded-md border border-border bg-background p-2 ps-3 pe-10 text-start"
              >
                {!isBarber && <option value="">{t("panelUsers.professional.selectPlaceholder")}</option>}
                {!isBarber && <option value="__all__">{t("panelUsers.professional.allUsers")}</option>}
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("panelUsers.search.title")}</CardTitle>
            <CardDescription>
              {t("panelUsers.search.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(normalizeDigits(event.target.value))}
                placeholder={t("panelUsers.search.placeholder")}
                className="ps-10 text-start"
                dir={dir}
                inputMode="search"
              />
            </div>
          </CardContent>
        </Card>

        {barbers.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-card/30">
            <CardContent className="p-8 text-center text-muted-foreground">
              {t("panelUsers.empty.noProfessionals", { professional: labels.singular, business: labels.business })}
            </CardContent>
          </Card>
        ) : !selectedBarberId ? (
          <Card className="border-dashed border-border/70 bg-card/30">
            <CardContent className="p-8 text-center text-muted-foreground">
              {t("panelUsers.empty.selectProfessional", { professional: labels.singular })}
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex h-52 items-center justify-center text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("common.loading")}
          </div>
        ) : data.items.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-card/30">
            <CardContent className="p-8 text-center text-muted-foreground">
              {t("panelUsers.empty.noUsers", { professional: labels.singular })}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {data.items.map((panelUser) => (
                (() => {
                  const financeSummary = financeSummaries[panelUser.mobile];
                  const hasDebt = (financeSummary?.balanceAmount ?? 0) > 0;

                  return (
                <Card
                  key={panelUser.mobile}
                  className={`cursor-pointer overflow-hidden border-border/70 bg-card/60 transition-colors hover:border-primary/30 ${hasDebt ? "border-destructive/50 bg-destructive/5" : ""}`}
                  onClick={() => {
                    if (!isAllUsersView) {
                      setSelectedPanelUser(panelUser);
                    }
                  }}
                >
                  <CardContent className="min-w-0 space-y-4 p-4">
                    <div className="grid min-w-0 grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0 space-y-1 text-start">
                        <div className="line-clamp-2 break-words text-lg font-bold leading-7 [overflow-wrap:anywhere]">
                          {panelUser.firstName || t("panelUsers.valueNoName")}{panelUser.lastName ? ` ${panelUser.lastName}` : ""}
                        </div>
                        {panelUser.isForSomeoneElse && panelUser.bookedByName && (
                          <div className="text-sm text-muted-foreground">
                            {t("panelUsers.bookedForSomeoneElse", { name: panelUser.bookedByName })}
                          </div>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                        {isAdmin ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-xl border border-red-400/35 bg-red-500/15 text-red-300 shadow-sm shadow-red-950/20 hover:bg-red-500/25 hover:text-red-100"
                            title={t("panelUsers.actions.delete")}
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeletingUser(panelUser);
                            }}
                          >
                            <Trash2 className="h-[17px] w-[17px]" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-xl"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditDialog(panelUser);
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-xl"
                          title={t("panelUsers.finance.title")}
                          onClick={(event) => {
                            event.stopPropagation();
                            void loadFinanceProfile(panelUser, 1);
                          }}
                        >
                          <WalletCards className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-xl"
                          title={t("panelUsers.finance.openManual")}
                          onClick={(event) => {
                            event.stopPropagation();
                            const query = new URLSearchParams({
                              mobile: panelUser.mobile,
                              name: panelUser.fullName || "",
                            });
                            if (selectedBarberId && selectedBarberId !== "__all__") {
                              query.set("professional_id", selectedBarberId);
                            }
                            window.location.href = `/panel/manual-finance?${query.toString()}`;
                          }}
                        >
                          <ReceiptText className="h-4 w-4" />
                        </Button>
                        <Badge variant="secondary">
                          {t("panelUsers.appointmentsCount", { count: formatValue.number(panelUser.appointmentsCount) })}
                        </Badge>
                        {vipFeatureActive && panelUser.isVip && (
                          <Badge className="border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/10">
                            <Gem className="me-1 h-3.5 w-3.5" />
                            VIP
                          </Badge>
                        )}
                        {!panelUser.canBook && <Badge variant="destructive">{t("panelUsers.bookingAccess.closedBadge")}</Badge>}
                        {hasDebt ? <Badge variant="destructive">{t("panelUsers.finance.debtBadge", { amount: money(financeSummary.balanceAmount) })}</Badge> : null}
                      </div>
                    </div>

                    {financeSummary && financeSummary.entriesCount > 0 ? (
                      <div
                        className={`grid gap-2 rounded-xl border px-3 py-2 text-xs sm:grid-cols-3 ${hasDebt ? "border-destructive/40 bg-destructive/10" : "border-border/60 bg-background/35"}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="text-start">
                          <span className="text-muted-foreground">{t("panelUsers.finance.paidToDate")}: </span>
                          <b>{money(financeSummary.paidAmount)}</b>
                        </div>
                        <div className="text-start">
                          <span className="text-muted-foreground">{t("panelUsers.finance.debt")}: </span>
                          <b className={hasDebt ? "text-destructive" : "text-emerald-500"}>{money(financeSummary.balanceAmount)}</b>
                        </div>
                        <div className="text-start text-muted-foreground">
                          {financeSummary.lastEntryDate ? t("panelUsers.finance.lastEntry", { date: formatDate(financeSummary.lastEntryDate) }) : t("panelUsers.finance.noRecentEntry")}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                      <div className="flex items-center justify-start gap-2 text-start">
                        <Phone className="h-4 w-4 shrink-0" />
                        <PhoneText>{panelUser.mobile}</PhoneText>
                      </div>
                      <div className="flex items-center justify-start gap-2 text-start">
                        <User className="h-4 w-4 shrink-0" />
                        <span>{panelUser.lastAppointmentAt ? t("panelUsers.history.hasAppointment") : t("panelUsers.history.noAppointment")}</span>
                      </div>
                    </div>

                    {isAllUsersView && (
                      <div
                        className="rounded-xl border border-border/60 bg-background/35 px-3 py-2 text-start text-xs text-muted-foreground"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {t("panelUsers.allUsersHint", { professional: labels.singular })}
                      </div>
                    )}

                    <div
                      className="flex justify-end"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-xl px-3 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setExpandedInfoMobile((current) => (current === panelUser.mobile ? null : panelUser.mobile))
                        }
                      >
                        {expandedInfoMobile === panelUser.mobile ? (
                          <ChevronUp className="me-1 h-4 w-4" />
                        ) : (
                          <ChevronDown className="me-1 h-4 w-4" />
                        )}
                        {t("panelUsers.moreInfo")}
                      </Button>
                    </div>

                    {expandedInfoMobile === panelUser.mobile && (
                      <div
                        className="grid gap-3 rounded-2xl border border-border/60 bg-background/35 p-4 text-sm"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl bg-background/40 px-3 py-2 text-start">
                            <div className="text-xs text-muted-foreground">{t("panelUsers.fields.email")}</div>
                            <div className="mt-1 font-medium text-foreground">{panelUser.email || t("panelUsers.valueMissing")}</div>
                          </div>
                          <div className="rounded-xl bg-background/40 px-3 py-2 text-start">
                            <div className="text-xs text-muted-foreground">{t("panelUsers.fields.gender")}</div>
                            <div className="mt-1 font-medium text-foreground">{getGenderLabel(panelUser.gender)}</div>
                          </div>
                          <div className="rounded-xl bg-background/40 px-3 py-2 text-start">
                            <div className="text-xs text-muted-foreground">{t("panelUsers.fields.nationalCode")}</div>
                            <div className="mt-1 font-medium text-foreground">{panelUser.nationalCode || t("panelUsers.valueMissing")}</div>
                          </div>
                          <div className="rounded-xl bg-background/40 px-3 py-2 text-start">
                            <div className="text-xs text-muted-foreground">{t("panelUsers.fields.birthDate")}</div>
                            <div className="mt-1 font-medium text-foreground">{formatBirthDate(panelUser.birthDate)}</div>
                          </div>
                          <div className="rounded-xl bg-background/40 px-3 py-2 text-start">
                            <div className="text-xs text-muted-foreground">{t("panelUsers.fields.jobTitle")}</div>
                            <div className="mt-1 font-medium text-foreground">{panelUser.jobTitle || t("panelUsers.valueMissing")}</div>
                          </div>
                        </div>
                        <div className="rounded-xl bg-background/40 px-3 py-2 text-start">
                          <div className="text-xs text-muted-foreground">{t("panelUsers.fields.location")}</div>
                          <div className="mt-1 font-medium text-foreground">
                            {panelUser.provinceName && panelUser.cityName
                              ? `${panelUser.cityName}، ${panelUser.provinceName}`
                              : t("panelUsers.valueMissing")}
                          </div>
                        </div>
                      </div>
                    )}

                    <div
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="text-start">
                        <div className="font-medium">{t("panelUsers.bookingAccess.title")}</div>
                        <div className="text-sm text-muted-foreground">
                          {t("panelUsers.bookingAccess.description")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {togglingMobile === panelUser.mobile && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        <span className={`text-xs font-medium ${panelUser.canBook ? "text-muted-foreground" : "text-destructive"}`}>
                          {panelUser.canBook ? t("panelUsers.status.active") : t("panelUsers.status.closed")}
                        </span>
                        <Switch
                          checked={!panelUser.canBook}
                          onCheckedChange={(checked) => handleToggleBookingAccess(panelUser, checked)}
                          className="data-[state=checked]:bg-destructive data-[state=unchecked]:bg-input"
                        />
                      </div>
                    </div>

                    {vipFeatureActive && (
                      <div
                        className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex-1 text-start">
                          <div className="flex items-center justify-start gap-2 font-medium text-start">
                            {t("panelUsers.vip.title")}
                            <Gem className="h-4 w-4 text-cyan-300" />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("panelUsers.vip.description")}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {vipTogglingMobile === panelUser.mobile && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          <span className={`text-xs font-medium ${panelUser.isVip ? "text-cyan-300" : "text-muted-foreground"}`}>
                            {panelUser.isVip ? t("panelUsers.status.active") : t("panelUsers.status.inactive")}
                          </span>
                          <Switch
                            checked={!!panelUser.isVip}
                            onCheckedChange={(checked) => handleToggleVipAccess(panelUser, checked)}
                            className="data-[state=checked]:bg-cyan-500 data-[state=unchecked]:bg-input"
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                  );
                })()
              ))}
            </div>

            <div className="flex flex-col gap-4 border-t border-border/60 bg-background/95 px-1 py-4 text-start md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                {t("panelUsers.totalUsers", { count: formatValue.number(data.total) })}
              </div>
              <Pagination className="mx-0 w-auto justify-start">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (data.currentPage > 1) {
                          loadUsers(data.currentPage - 1, selectedBarberId, debouncedSearch);
                        }
                      }}
                      className={data.currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-3 text-sm text-muted-foreground">
                      {t("panelUsers.pagination", { current: formatValue.number(data.currentPage), total: formatValue.number(data.lastPage) })}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (data.currentPage < data.lastPage) {
                          loadUsers(data.currentPage + 1, selectedBarberId, debouncedSearch);
                        }
                      }}
                      className={data.currentPage >= data.lastPage ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        )}
      </main>

      <UserAppointmentsModal
        isOpen={!!selectedPanelUser}
        onClose={() => setSelectedPanelUser(null)}
        user={selectedPanelUser}
        barberId={selectedBarberId}
      />

      <Dialog
        open={!!financeUser}
        onOpenChange={(open) => {
          if (!open) {
            setFinanceUser(null);
            setFinancePayload(null);
            setFinancePage(1);
          }
        }}
      >
        <DialogContent dir={dir} className="pretty-scrollbar max-h-[88vh] overflow-x-hidden overflow-y-auto text-start sm:max-w-3xl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle className="flex min-w-0 items-start justify-start gap-2">
              <WalletCards className="mt-1 h-5 w-5 shrink-0" />
              <span className="line-clamp-2 min-w-0 break-words leading-7 [overflow-wrap:anywhere]">
                {t("panelUsers.finance.dialogTitle", { user: financeUser?.fullName || financeUser?.mobile || t("panelUsers.userFallback") })}
              </span>
            </DialogTitle>
            <DialogDescription className="text-start">
              {t("panelUsers.finance.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          {financeLoading ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="me-2 h-5 w-5 animate-spin" />
              {t("panelUsers.finance.loading")}
            </div>
          ) : financePayload ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-background/35 p-3">
                  <div className="text-xs text-muted-foreground">{t("panelUsers.finance.totalAmount")}</div>
                  <div className="mt-1 font-bold">{money(financePayload.summary.totalAmount)}</div>
                </div>
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                  <div className="text-xs text-muted-foreground">{t("panelUsers.finance.paidAmount")}</div>
                  <div className="mt-1 font-bold text-emerald-500">{money(financePayload.summary.paidAmount)}</div>
                </div>
                <div className={`rounded-2xl border p-3 ${financePayload.summary.balanceAmount > 0 ? "border-destructive/40 bg-destructive/10" : "border-border/70 bg-background/35"}`}>
                  <div className="text-xs text-muted-foreground">{t("panelUsers.finance.currentDebt")}</div>
                  <div className={`mt-1 font-bold ${financePayload.summary.balanceAmount > 0 ? "text-destructive" : "text-emerald-500"}`}>
                    {money(financePayload.summary.balanceAmount)}
                  </div>
                </div>
              </div>

              {financePayload.summary.balanceAmount > 0 ? (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
                  {t("panelUsers.finance.activeDebt", { amount: money(financePayload.summary.balanceAmount) })}
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="font-bold">{t("panelUsers.finance.latestEntries")}</div>
                {financePayload.entries.items.length ? financePayload.entries.items.map((entry) => {
                  const appointmentText = entry.appointment
                    ? t("panelUsers.finance.appointmentText", {
                        service: entry.appointment.sectionName || t("panelUsers.serviceFallback"),
                        date: formatDate(entry.appointment.date),
                        time: entry.appointment.startTime ? t("panelUsers.finance.timeWithValue", { time: entry.appointment.startTime }) : "",
                      })
                    : t("panelUsers.finance.noAppointmentLink");

                  return (
                    <div key={entry.id} className="rounded-2xl border border-border/70 bg-background/35 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 text-start">
                          <div className="font-bold">{formatDate(entry.entryDate)} - {entry.professionalName || labels.singular}</div>
                          <div className="text-xs leading-6 text-muted-foreground">{appointmentText}</div>
                          <div className="text-xs leading-6 text-muted-foreground">
                            {entry.items.map((item) => `${item.categoryName}${item.description ? ` (${item.description})` : ""}: ${money(item.amount)}`).join("، ")}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Badge variant="secondary">{t("panelUsers.finance.totalBadge", { amount: money(entry.totalAmount) })}</Badge>
                          <Badge variant="outline">{t("panelUsers.finance.paidBadge", { amount: money(entry.paidAmount) })}</Badge>
                          {entry.balanceAmount > 0 ? <Badge variant="destructive">{t("panelUsers.finance.debtBadge", { amount: money(entry.balanceAmount) })}</Badge> : <Badge variant="outline">{t("panelUsers.finance.settled")}</Badge>}
                          <Badge variant="outline">{paymentMethodLabel(entry.paymentMethod)}</Badge>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-muted-foreground">
                    {t("panelUsers.finance.emptyEntries")}
                  </div>
                )}
              </div>

              {financePayload.entries.lastPage > 1 ? (
                <Pagination className="mx-0 w-auto justify-start">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (financeUser && financePage > 1) void loadFinanceProfile(financeUser, financePage - 1);
                        }}
                        className={financePage <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-3 text-sm text-muted-foreground">
                        {t("panelUsers.pagination", { current: formatValue.number(financePayload.entries.currentPage), total: formatValue.number(financePayload.entries.lastPage) })}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (financeUser && financePage < financePayload.entries.lastPage) void loadFinanceProfile(financeUser, financePage + 1);
                        }}
                        className={financePage >= financePayload.entries.lastPage ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent dir={dir} className="pretty-scrollbar max-h-[88vh] overflow-y-auto sm:max-w-[620px]">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{t("panelUsers.edit.title")}</DialogTitle>
            <DialogDescription>
              {t("panelUsers.edit.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <UserProfileForm
              form={editForm}
              onChange={setEditForm}
              requirements={registrationRequirements}
              errors={editErrors}
              showMobile
              cardless
            />

            {nutritionMessageSupported ? (
              <div className="mt-5 space-y-2">
                <div className="text-start">
                  <div className="text-sm font-semibold text-foreground">{t("panelUsers.edit.nutritionMessageTitle")}</div>
                  <div className="mt-1 text-xs leading-6 text-muted-foreground">
                    {t("panelUsers.edit.nutritionMessageDescription")}
                  </div>
                </div>
                <Textarea
                  dir={dir}
                  value={(editForm as UserProfileFormValues & { nutritionProfileFixedMessage?: string }).nutritionProfileFixedMessage ?? ""}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      nutritionProfileFixedMessage: event.target.value,
                    }))
                  }
                  placeholder={t("panelUsers.edit.nutritionMessagePlaceholder")}
                  className="min-h-[120px] text-start leading-7"
                />
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex-row-reverse sm:justify-start gap-2">
            <Button onClick={handleSaveIdentity} disabled={savingEdit}>
              {savingEdit ? t("common.saving") : t("panelUsers.edit.save")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingUser}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) {
            setDeletingUser(null);
          }
        }}
      >
        <AlertDialogContent dir={dir} className="border-destructive/30 text-start">
          <AlertDialogHeader className="items-stretch text-start sm:text-start">
            <AlertDialogTitle className="text-start">{t("panelUsers.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-start leading-7">
              <span className="block">
                {t("panelUsers.delete.confirm", { user: deletingUser?.fullName || deletingUser?.mobile || t("panelUsers.valueNoName") })}
              </span>
              <span className="block font-bold text-destructive">
                {t("panelUsers.delete.warning")}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start sm:space-x-0">
            <Button
              type="button"
              variant="destructive"
              disabled={deleteLoading}
              onClick={() => void handleDeleteUser()}
            >
              {deleteLoading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />}
              {t("panelUsers.delete.submit")}
            </Button>
            <AlertDialogCancel disabled={deleteLoading}>{t("common.cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default PanelUsersPage;
