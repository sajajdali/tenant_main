import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Calculator, CalendarClock, Coins, CreditCard, Loader2, Receipt, ReceiptText, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { PanelFinanceDashboardPayload, PanelFinanceWindowStats, TenantMeta } from "@/lib/types";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { CodeText, LtrText, PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

function RevenueStatsSection({
  title,
  description,
  stats,
  tone = "default",
}: {
  title: string;
  description: string;
  stats: {
    overall: PanelFinanceWindowStats;
    today: PanelFinanceWindowStats;
    yesterday: PanelFinanceWindowStats;
    thisWeek: PanelFinanceWindowStats;
  };
  tone?: "default" | "nutrition";
}) {
  const t = useT();
  const format = useFormat();
  const iconClass = tone === "nutrition" ? "text-emerald-500" : "text-primary";

  return (
    <Card className={tone === "nutrition" ? "border-emerald-500/20 bg-emerald-500/5" : "border-border/70 bg-card/60"}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-background/40">
          <CardHeader className="pb-3">
            <CardDescription>{t("panelFinance.stats.overallDescription")}</CardDescription>
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              {t("panelFinance.stats.overallTitle")}
              <Receipt className={`h-5 w-5 ${iconClass}`} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black">{format.currency(stats.overall.grossAmount)}</div>
            <div className="text-xs text-muted-foreground">{t("panelFinance.stats.successTransactions", { count: format.number(stats.overall.transactionsCount) })}</div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/40">
          <CardHeader className="pb-3">
            <CardDescription>{t("panelFinance.stats.todayDescription")}</CardDescription>
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              {t("panelFinance.stats.todayTitle")}
              <CalendarClock className={`h-5 w-5 ${iconClass}`} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black">{format.currency(stats.today.grossAmount)}</div>
            <div className="text-xs text-muted-foreground">{t("panelFinance.stats.todayTransactions", { count: format.number(stats.today.transactionsCount) })}</div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/40">
          <CardHeader className="pb-3">
            <CardDescription>{t("panelFinance.stats.yesterdayDescription")}</CardDescription>
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              {t("panelFinance.stats.yesterdayTitle")}
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black">{format.currency(stats.yesterday.grossAmount)}</div>
            <div className="text-xs text-muted-foreground">{t("panelFinance.stats.yesterdayTransactions", { count: format.number(stats.yesterday.transactionsCount) })}</div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/40">
          <CardHeader className="pb-3">
            <CardDescription>{t("panelFinance.stats.weekDescription")}</CardDescription>
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              {t("panelFinance.stats.weekTitle")}
              <Coins className={`h-5 w-5 ${iconClass}`} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black">{format.currency(stats.thisWeek.grossAmount)}</div>
            <div className="text-xs text-muted-foreground">{t("panelFinance.stats.weekTransactions", { count: format.number(stats.thisWeek.transactionsCount) })}</div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

export default function PanelFinancePage() {
  const { isAdmin, isPrimaryAdmin, isBarber, user } = useAuth();
  const { barbers } = useStore();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [payload, setPayload] = useState<PanelFinanceDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const labels = getAudienceLabels(tenantMeta);
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const audienceSlug = tenantMeta?.audience?.slug || "";
  const isNutritionAudience = ["nutritionists", "nutrition-doctors"].includes(audienceSlug);

  const ownBarber = useMemo(
    () => (isBarber ? barbers.find((barber) => barber.userId === user?.id) ?? null : null),
    [barbers, isBarber, user?.id],
  );

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) {
        setTenantMeta(res.data);
      }
    });
  }, []);

  useEffect(() => {
    if (isBarber && ownBarber && selectedBarberId !== ownBarber.id) {
      setSelectedBarberId(ownBarber.id);
    }
  }, [isBarber, ownBarber, selectedBarberId]);

  useEffect(() => {
    if (!isAdmin && !isBarber) {
      return;
    }

    if (isBarber && !ownBarber) {
      return;
    }

    setLoading(true);
    api.finance.dashboard(isBarber ? ownBarber?.id : (selectedBarberId || undefined)).then((res) => {
      if (res.success) {
        setPayload(res.data);
      }
      setLoading(false);
    });
  }, [isAdmin, isBarber, ownBarber?.id, selectedBarberId]);

  if (!isAdmin && !isBarber) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelFinance.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelFinance.accessDenied.description", { role: labels.singular })}</p>
          <Link href="/panel">
            <Button>{t("panelFinance.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  const stats = payload?.stats;
  const showNutritionFinance = isNutritionAudience && Boolean(payload?.nutritionStats);

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("panelFinance.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("panelFinance.filter.title")}</CardTitle>
            <CardDescription>
              {isBarber
                ? t("panelFinance.filter.barberDescription", { role: labels.singular })
                : t("panelFinance.filter.adminDescription", { role: labels.singular })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)_auto_auto] md:items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">{labels.singular}</label>
                <select
                  dir={dir}
                  value={selectedBarberId}
                  onChange={(event) => setSelectedBarberId(event.target.value)}
                  disabled={isBarber}
                  className="w-full appearance-none rounded-xl border border-border bg-background p-3 pe-10 ps-3 text-start"
                >
                  {!isBarber && <option value="">{t("panelFinance.filter.allProfessionals", { role: labels.plural })}</option>}
                  {barbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                {payload?.filter.barberName
                  ? t("panelFinance.filter.viewingProfessional", { name: payload.filter.barberName })
                  : t("panelFinance.filter.viewingBusiness", { business: labels.business })}
              </div>
              <Button asChild className="h-12 rounded-2xl px-4">
                <Link href={selectedBarberId ? `/panel/manual-finance?professional_id=${encodeURIComponent(selectedBarberId)}` : "/panel/manual-finance"}>
                  <ReceiptText className="me-2 h-4 w-4" />
                  {t("panelFinance.addExpense")}
                </Link>
              </Button>
              {isPrimaryAdmin ? (
                <Button asChild variant="outline" className="h-12 rounded-2xl px-4">
                  <Link href="/panel/commission-report">
                    <Calculator className="me-2 h-4 w-4" />
                    {t("panelFinance.commissionReport")}
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {loading || !stats ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelFinance.loading")}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <RevenueStatsSection
                title={showNutritionFinance ? t("panelFinance.appointmentRevenueWithNutrition") : t("panelFinance.appointmentRevenue")}
                description={t("panelFinance.appointmentRevenueDescription")}
                stats={stats}
              />

              {showNutritionFinance && payload.nutritionStats ? (
                <RevenueStatsSection
                  title={t("panelFinance.nutritionRevenue")}
                  description={t("panelFinance.nutritionRevenueDescription")}
                  stats={payload.nutritionStats}
                  tone="nutrition"
                />
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-border/70 bg-card/60">
                <CardHeader className="pb-3">
                  <CardDescription>{t("panelFinance.onlineTotal.description")}</CardDescription>
                  <CardTitle className="text-base">{t("panelFinance.onlineTotal.title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black">{format.currency(stats.overall.onlineAmount)}</div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/60">
                <CardHeader className="pb-3">
                  <CardDescription>{t("panelFinance.walletTotal.description")}</CardDescription>
                  <CardTitle className="text-base">{t("panelFinance.walletTotal.title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black">{format.currency(stats.overall.walletAmount)}</div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/60">
                <CardHeader className="pb-3">
                  <CardDescription>{t("panelFinance.settlementMix.description")}</CardDescription>
                  <CardTitle className="text-base">{t("panelFinance.settlementMix.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t("panelFinance.sandbox")}</span>
                    <span className="font-bold">{format.number(stats.overall.sandboxCount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t("panelFinance.walletOnly")}</span>
                    <span className="font-bold">{format.number(stats.overall.walletOnlyCount)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base">{showNutritionFinance ? t("panelFinance.latest.appointmentsTitle") : t("panelFinance.latest.title")}</CardTitle>
                <CardDescription>{t("panelFinance.latest.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                {payload.latestTransactions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
                    {t("panelFinance.latest.empty")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payload.latestTransactions.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-black">
                                  {t("panelFinance.invoice")} <CodeText>{item.invoiceNumber}</CodeText>
                                </div>
                                <Badge variant={item.walletAmount > 0 ? "secondary" : "outline"}>{item.gatewayLabel}</Badge>
                              {item.sandboxMode && <Badge variant="outline">{t("panelFinance.sandbox")}</Badge>}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {item.customerName} • <PhoneText>{item.customerPhone}</PhoneText>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {item.barberName || t("panelFinance.valueMissing")} • {item.serviceName || t("panelFinance.valueMissing")} • {item.appointmentDate ? format.date(item.appointmentDate) : t("panelFinance.valueMissing")} {t("panelFinance.timePrefix")} <LtrText>{item.startTime}</LtrText>
                            </div>
                          </div>
                          <div className="grid min-w-[260px] gap-2 text-sm sm:grid-cols-3 lg:min-w-[330px]">
                            <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-start">
                              <div className="text-xs text-muted-foreground">{t("panelFinance.amount.total")}</div>
                              <div className="mt-1 font-black">{format.currency(item.totalAmount)}</div>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-start">
                              <div className="text-xs text-muted-foreground">{t("panelFinance.amount.online")}</div>
                              <div className="mt-1 font-black">{format.currency(item.onlineAmount)}</div>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-start">
                              <div className="text-xs text-muted-foreground">{t("panelFinance.amount.wallet")}</div>
                              <div className="mt-1 font-black">{format.currency(item.walletAmount)}</div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                          <div className="flex flex-wrap items-center gap-3">
                            <span>{t("panelFinance.paidAt", { date: format.dateTime(item.paidAt) || t("panelFinance.valueMissing") })}</span>
                            <span>
                              {t("panelFinance.reference")} {item.referenceId ? <CodeText>{item.referenceId}</CodeText> : t("panelFinance.valueMissing")}
                            </span>
                          </div>
                          <div className="inline-flex items-center gap-1">
                            <Wallet className="h-3.5 w-3.5" />
                            {item.walletAmount > 0 ? t("panelFinance.walletUsed") : t("panelFinance.walletNotUsed")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {showNutritionFinance ? (
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardHeader>
                  <CardTitle className="text-base">{t("panelFinance.nutritionLatest.title")}</CardTitle>
                  <CardDescription>{t("panelFinance.nutritionLatest.description")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {(payload.latestNutritionTransactions ?? []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-emerald-500/30 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
                      {t("panelFinance.nutritionLatest.empty")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(payload.latestNutritionTransactions ?? []).map((item) => (
                        <div key={item.id} className="rounded-2xl border border-emerald-500/20 bg-background/40 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-black">
                                  {t("panelFinance.invoice")} <CodeText>{item.invoiceNumber}</CodeText>
                                </div>
                                <Badge variant="secondary">{item.gatewayLabel}</Badge>
                                {item.sandboxMode && <Badge variant="outline">{t("panelFinance.sandbox")}</Badge>}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {item.customerName} • <PhoneText>{item.customerPhone}</PhoneText>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {t("panelFinance.packageName", { name: item.packageName || t("panelFinance.valueMissing") })}
                              </div>
                            </div>
                            <div className="grid min-w-[260px] gap-2 text-sm sm:grid-cols-3 lg:min-w-[330px]">
                              <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-start">
                                <div className="text-xs text-muted-foreground">{t("panelFinance.amount.package")}</div>
                                <div className="mt-1 font-black">{format.currency(item.totalAmount)}</div>
                              </div>
                              <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-start">
                                <div className="text-xs text-muted-foreground">{t("panelFinance.amount.discount")}</div>
                                <div className="mt-1 font-black">{format.currency(item.discountAmount)}</div>
                              </div>
                              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-start">
                                <div className="text-xs text-muted-foreground">{t("panelFinance.amount.payable")}</div>
                                <div className="mt-1 font-black">{format.currency(item.payableAmount)}</div>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                            <span>{t("panelFinance.paidAt", { date: format.dateTime(item.paidAt) || t("panelFinance.valueMissing") })}</span>
                            <span>
                              {t("panelFinance.reference")} {item.referenceId ? <CodeText>{item.referenceId}</CodeText> : t("panelFinance.valueMissing")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
