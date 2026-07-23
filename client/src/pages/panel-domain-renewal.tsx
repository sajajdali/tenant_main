import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, BadgeCheck, CalendarClock, ExternalLink, Globe, Loader2, Receipt, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { DomainRenewalOverview, PaginatedDomainRenewalPayments, TenantMeta } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { CodeText, UrlText } from "@/i18n/ltr-text";

const STATUS_LABELS = {
  pending: "domainRenewal.status.pending",
  paid: "domainRenewal.status.paid",
  failed: "domainRenewal.status.failed",
  cancelled: "domainRenewal.status.cancelled",
} as const;

export default function PanelDomainRenewalPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const format = useFormat();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [overview, setOverview] = useState<DomainRenewalOverview | null>(null);
  const [history, setHistory] = useState<PaginatedDomainRenewalPayments>({
    items: [],
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState("");

  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const paymentStatus = search.get("payment");
  const paymentMessage = search.get("message");

  const loadOverview = async () => {
    const [metaRes, overviewRes] = await Promise.all([api.meta.get(), api.domainRenewal.overview()]);

    if (metaRes.success) {
      setTenantMeta(metaRes.data);
    }

    if (overviewRes.success) {
      setOverview(overviewRes.data);
      setSelectedGateway(
        (overviewRes.data.settings.provider && (overviewRes.data.settings.enabledGateways ?? []).includes(overviewRes.data.settings.provider))
          ? overviewRes.data.settings.provider
          : (overviewRes.data.settings.enabledGateways?.[0] ?? ""),
      );
    }
  };

  const loadHistory = async (page = 1) => {
    setHistoryLoading(true);
    const res = await api.domainRenewal.history(page, 10);
    if (res.success) {
      setHistory(res.data);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    Promise.all([loadOverview(), loadHistory(1)]).finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    if (!paymentStatus) {
      return;
    }

    if (paymentStatus === "success") {
      toast({ title: t("domainRenewal.toast.successTitle"), description: paymentMessage || t("domainRenewal.toast.successDescription") });
      void loadOverview();
      void loadHistory(1);
      return;
    }

    if (paymentStatus === "cancelled") {
      toast({ variant: "destructive", title: t("domainRenewal.toast.cancelledTitle"), description: paymentMessage || t("domainRenewal.toast.cancelledDescription") });
      return;
    }

    if (paymentStatus === "failed") {
      toast({ variant: "destructive", title: t("domainRenewal.toast.failedTitle"), description: paymentMessage || t("domainRenewal.toast.failedDescription") });
    }
  }, [paymentMessage, paymentStatus, toast, t]);

  const handlePay = async () => {
    try {
      setPaying(true);
      const res = await api.domainRenewal.pay(selectedGateway || undefined);

      if (!res.success) {
        toast({ variant: "destructive", title: t("common.error"), description: res.message });
        return;
      }

      if (res.data.mode === "sandbox") {
        toast({ title: t("domainRenewal.toast.successTitle"), description: t("domainRenewal.toast.sandboxSuccessDescription") });
        window.location.assign(`/panel/domain-renewal?payment=success&message=${encodeURIComponent(t("domainRenewal.toast.sandboxRedirectMessage"))}`);
        return;
      }

      if (res.data.redirectForm) {
        const form = document.createElement("form");
        form.method = (res.data.redirectForm.method || "GET").toUpperCase();
        form.action = res.data.redirectForm.action;
        form.style.display = "none";

        Object.entries(res.data.redirectForm.inputs || {}).forEach(([name, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
        return;
      }

      if (res.data.paymentUrl) {
        window.location.assign(res.data.paymentUrl);
        return;
      }

      toast({ variant: "destructive", title: t("common.error"), description: t("domainRenewal.toast.paymentUrlMissing") });
    } finally {
      setPaying(false);
    }
  };

  const domain = overview?.domain ?? tenantMeta?.domainRenewal ?? tenantMeta?.irDomain;
  const primaryDomain = tenantMeta?.tenant_domains?.[0] || "-";
  const canRenewNow = domain?.renewalAvailable !== false;
  const statusTone = useMemo(() => {
    if (domain?.selfManaged) return "secondary";
    if (!domain?.enabled) return "secondary";
    if (domain.expired) return "destructive";
    if (domain.isDueSoon) return "warning";
    return "default";
  }, [domain]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <ShieldCheck className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{t("domainRenewal.accessDeniedTitle")}</h1>
          <p className="text-muted-foreground leading-7">{t("domainRenewal.accessDeniedDescription")}</p>
          <Link href="/panel">
            <Button>{t("domainRenewal.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="flex items-center text-muted-foreground">
          <Loader2 className="me-2 h-5 w-5 animate-spin" />
          {t("domainRenewal.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{domain?.label || t("domainRenewal.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("domainRenewal.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`w-5 h-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{t("domainRenewal.currentStatusTitle")}</CardTitle>
                <CardDescription>{t("domainRenewal.currentStatusDescription")}</CardDescription>
              </div>
              <Badge variant={statusTone === "destructive" ? "destructive" : statusTone === "warning" ? "outline" : "secondary"}>
                {domain?.statusLabel || t("domainRenewal.notSet")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="text-sm text-muted-foreground">{t("domainRenewal.primaryDomain")}</div>
              <div className="mt-2 font-bold"><UrlText>{primaryDomain}</UrlText></div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="text-sm text-muted-foreground">{t("domainRenewal.tld")}</div>
              <div className="mt-2 font-bold"><CodeText>{domain?.tld || "-"}</CodeText></div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="text-sm text-muted-foreground">{t("domainRenewal.renewsAt")}</div>
              <div className="mt-2 font-bold">{domain?.renewsAt ? format.date(domain.renewsAt, { month: "long" }) : t("domainRenewal.notSet")}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="text-sm text-muted-foreground">{t("domainRenewal.annualRenewalAmount")}</div>
              <div className="mt-2 font-bold">{domain?.enabled ? format.currency(domain?.amount) : "-"}</div>
            </div>
          </CardContent>
        </Card>

        {domain?.selfManaged ? (
          <Card className="border-border/70 bg-card/60">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Globe className="h-10 w-10 text-muted-foreground" />
              <div className="text-lg font-bold">{t("domainRenewal.selfManagedTitle")}</div>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                {t("domainRenewal.selfManagedDescription")}
              </p>
            </CardContent>
          </Card>
        ) : !domain?.enabled ? (
          <Card className="border-border/70 bg-card/60">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Globe className="h-10 w-10 text-muted-foreground" />
              <div className="text-lg font-bold">{t("domainRenewal.notConfiguredTitle")}</div>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                {t("domainRenewal.notConfiguredDescription")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className={`border-border/70 ${domain.expired ? "border-destructive/40 bg-destructive/5" : domain.isDueSoon ? "border-amber-500/30 bg-amber-500/5" : "bg-card/60"}`}>
            <CardHeader>
              <CardTitle className="text-base">{t("domainRenewal.paymentReminderTitle")}</CardTitle>
              <CardDescription>
                {domain.expired
                  ? t("domainRenewal.expiredDescription", { domain: domain.label || t("domainRenewal.domainFallback") })
                  : domain.isDueSoon
                    ? t("domainRenewal.dueSoonDescription", { days: format.number(Number(domain.daysRemaining ?? 0)), domain: domain.tld || t("domainRenewal.domainFallback") })
                    : canRenewNow
                      ? t("domainRenewal.activeDescription", { domain: domain.label || t("domainRenewal.domainFallback") })
                      : domain.renewalBlockedReason || t("domainRenewal.notDueYet")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><BadgeCheck className="h-4 w-4" /> {t("domainRenewal.lastPaidAt")}</div>
                  <div className="mt-2 font-bold">{domain.lastPaidAt ? format.date(domain.lastPaidAt, { month: "long" }) : t("domainRenewal.notSet")}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="h-4 w-4" /> {t("domainRenewal.nextDueAt")}</div>
                  <div className="mt-2 font-bold">{domain.renewsAt ? format.date(domain.renewsAt, { month: "long" }) : t("domainRenewal.notSet")}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Receipt className="h-4 w-4" /> {t("domainRenewal.currentRenewalAmount")}</div>
                  <div className="mt-2 font-bold">{format.currency(domain.amount)}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 p-4 text-sm leading-7 text-muted-foreground">
                {t("domainRenewal.sandboxHint")}
              </div>

              {!canRenewNow ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
                  {domain?.renewalBlockedReason || t("domainRenewal.notDueYet")}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button className="rounded-2xl" onClick={() => void handlePay()} disabled={paying || !canRenewNow}>
                  {paying ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ExternalLink className="me-2 h-4 w-4" />}
                  {paymentStatus === "failed" || paymentStatus === "cancelled" ? t("payment.retry") : t("domainRenewal.payOnline")}
                </Button>
                <Link href="/panel">
                  <Button variant="outline" className="rounded-2xl">{t("domainRenewal.backToPanel")}</Button>
                </Link>
              </div>
              {overview && !overview.settings.enabled && !overview.settings.sandboxEnabled ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
                  {t("domainRenewal.gatewayDisabledHint")}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{t("domainRenewal.historyTitle")}</CardTitle>
                <CardDescription>{t("domainRenewal.historyDescription")}</CardDescription>
              </div>
              <Badge variant="secondary">{t("domainRenewal.historyTotal", { count: format.number(history.total) })}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {historyLoading ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("domainRenewal.historyLoading")}
              </div>
            ) : history.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-10 text-center text-muted-foreground">
                {t("domainRenewal.historyEmpty")}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {history.items.map((payment) => (
                    <div key={payment.id} className="rounded-3xl border border-border/70 bg-background/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 text-start">
                          <div className="font-bold">{payment.domainName ? <UrlText>{payment.domainName}</UrlText> : payment.domainLabel || t("domainRenewal.title")}</div>
                          <div className="text-sm text-muted-foreground">
                            {t("domainRenewal.invoice")} <CodeText>{payment.invoiceNumber}</CodeText> • {payment.createdAt ? format.date(payment.createdAt.slice(0, 10), { month: "long" }) : t("domainRenewal.notSet")}
                          </div>
                        </div>
                        <Badge variant={payment.status === "paid" ? "secondary" : payment.status === "pending" ? "outline" : "destructive"}>
                          {t(STATUS_LABELS[payment.status])}
                        </Badge>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                          <div className="text-xs text-muted-foreground">{t("domainRenewal.paidAmount")}</div>
                          <div className="mt-1 font-bold">{format.currency(payment.payableAmount)}</div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                          <div className="text-xs text-muted-foreground">{t("domainRenewal.newRenewsAt")}</div>
                          <div className="mt-1 font-bold">{payment.newRenewsAt ? format.date(payment.newRenewsAt, { month: "long" }) : t("domainRenewal.notSet")}</div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                          <div className="text-xs text-muted-foreground">{t("domainRenewal.referenceId")}</div>
                          <div className="mt-1 font-bold"><CodeText>{payment.referenceId || "-"}</CodeText></div>
                        </div>
                      </div>
                      {payment.failureReason ? (
                        <div className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                          {payment.failureReason}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {history.lastPage > 1 ? (
                  <Pagination dir={dir}>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (history.currentPage > 1) {
                              void loadHistory(history.currentPage - 1);
                            }
                          }}
                          className={history.currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-3 text-sm text-muted-foreground">
                          {t("domainRenewal.pageOf", { page: format.number(history.currentPage), total: format.number(history.lastPage) })}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (history.currentPage < history.lastPage) {
                              void loadHistory(history.currentPage + 1);
                            }
                          }}
                          className={history.currentPage >= history.lastPage ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
