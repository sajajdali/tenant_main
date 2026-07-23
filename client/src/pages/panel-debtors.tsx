import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Loader2, Phone, ReceiptText, Search, UserRound, WalletCards } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { ManualFinanceDebtorsPayload, TenantMeta } from "@/lib/types";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { normalizeDigits } from "@/lib/normalize";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";

export default function PanelDebtorsPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const { isAdmin, isBarber, user } = useAuth();
  const { barbers } = useStore();
  const { toast } = useToast();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<ManualFinanceDebtorsPayload | null>(null);
  const labels = getAudienceLabels(tenantMeta);
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const formatDate = (value?: string | null) => value ? format.date(`${value}T12:00:00`) : t("panelDebtors.noDate");
  const ownBarber = useMemo(
    () => (isBarber ? barbers.find((barber) => barber.userId === user?.id) ?? null : null),
    [barbers, isBarber, user?.id],
  );

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) setTenantMeta(res.data);
    });
  }, []);

  useEffect(() => {
    if (isBarber && ownBarber) {
      setSelectedBarberId(ownBarber.id);
      return;
    }

    if (isAdmin && !selectedBarberId) {
      setSelectedBarberId("__all__");
    }
  }, [isAdmin, isBarber, ownBarber, selectedBarberId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadDebtors = async (page = 1, barberId = selectedBarberId, searchTerm = debouncedSearch) => {
    if (!barberId) return;
    setLoading(true);
    const res = await api.manualFinance.debtors({
      professionalId: barberId === "__all__" ? null : barberId,
      search: searchTerm,
      page,
      perPage: 12,
    });
    setLoading(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setPayload(res.data);
  };

  useEffect(() => {
    if (!selectedBarberId) return;
    void loadDebtors(1, selectedBarberId, debouncedSearch);
  }, [selectedBarberId, debouncedSearch]);

  if (!isAdmin && !isBarber) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="max-w-md space-y-4 text-center">
          <WalletCards className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelDebtors.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelDebtors.accessDenied.description", { professional: labels.singular })}</p>
          <Link href="/panel/users"><Button>{t("panelDebtors.accessDenied.back")}</Button></Link>
        </div>
      </div>
    );
  }

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1 text-start">
            <h1 className="text-xl font-bold text-foreground">{t("panelDebtors.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelDebtors.description")}</p>
          </div>
          <Link href="/panel/users">
            <Button variant="outline" size="icon" title={t("common.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <BackIcon className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_1.4fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium">{labels.singular}</label>
              <select
                dir={dir}
                value={selectedBarberId}
                onChange={(event) => setSelectedBarberId(event.target.value)}
                disabled={isBarber}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-start text-foreground"
              >
                {!isBarber && <option value="__all__">{t("panelDebtors.allDebtors")}</option>}
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>{barber.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("panelDebtors.search.label")}</label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(normalizeDigits(event.target.value))}
                  placeholder={t("panelDebtors.search.placeholder")}
                  className="h-11 ps-10 text-start"
                  dir={dir}
                  inputMode="search"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {payload ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-border/70 bg-card/60">
              <CardContent className="p-4 text-start">
                <div className="text-xs text-muted-foreground">{t("panelDebtors.summary.debtorsCount")}</div>
                <div className="mt-2 text-lg font-bold">{t("panelDebtors.summary.people", { count: format.number(payload.summary.debtorsCount) })}</div>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/60">
              <CardContent className="p-4 text-start">
                <div className="text-xs text-muted-foreground">{t("panelDebtors.summary.totalAmount")}</div>
                <div className="mt-2 text-lg font-bold">{format.currency(payload.summary.totalAmount)}</div>
              </CardContent>
            </Card>
            <Card className="border-destructive/40 bg-destructive/10">
              <CardContent className="p-4 text-start">
                <div className="text-xs text-muted-foreground">{t("panelDebtors.summary.balanceAmount")}</div>
                <div className="mt-2 text-lg font-bold text-destructive">{format.currency(payload.summary.balanceAmount)}</div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("panelDebtors.list.title")}</CardTitle>
            <CardDescription>{t("panelDebtors.list.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex h-48 items-center justify-center text-muted-foreground">
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("panelDebtors.list.loading")}
              </div>
            ) : payload && payload.items.length ? payload.items.map((item) => {
              const query = new URLSearchParams({
                mobile: item.customerPhone,
                name: item.customerName || "",
              });
              if (selectedBarberId && selectedBarberId !== "__all__") {
                query.set("professional_id", selectedBarberId);
              }

              return (
                <div key={item.customerPhone} className="rounded-2xl border border-destructive/35 bg-destructive/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2 text-start">
                      <div className="flex flex-wrap items-center justify-start gap-2">
                        <div className="text-lg font-bold">{item.customerName || t("panelDebtors.customerNameMissing")}</div>
                        <Badge variant="destructive">{t("panelDebtors.balanceBadge", { amount: format.currency(item.balanceAmount) })}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center justify-start gap-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          <PhoneText>{item.customerPhone}</PhoneText>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-4 w-4" />
                          {t("panelDebtors.entriesCount", { count: format.number(item.entriesCount) })}
                        </span>
                        <span>{t("panelDebtors.lastEntry", { date: formatDate(item.lastEntryDate) })}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge variant="secondary">{t("panelDebtors.totalBadge", { amount: format.currency(item.totalAmount ?? 0) })}</Badge>
                      <Badge variant="outline">{t("panelDebtors.paidBadge", { amount: format.currency(item.paidAmount ?? 0) })}</Badge>
                      <Link href={`/panel/manual-finance?${query.toString()}`}>
                        <Button size="sm" className="h-9 rounded-xl font-bold">
                          <ReceiptText className="me-2 h-4 w-4" />
                          {t("panelDebtors.financeFile")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-muted-foreground">
                {t("panelDebtors.list.empty")}
              </div>
            )}

            {payload && payload.lastPage > 1 ? (
              <Pagination className="mx-0 w-auto justify-start pt-2">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (payload.currentPage > 1) void loadDebtors(payload.currentPage - 1);
                      }}
                      className={payload.currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-3 text-sm text-muted-foreground">
                      {t("panelDebtors.pagination.page", {
                        current: format.number(payload.currentPage),
                        total: format.number(payload.lastPage),
                      })}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (payload.currentPage < payload.lastPage) void loadDebtors(payload.currentPage + 1);
                      }}
                      className={payload.currentPage >= payload.lastPage ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
