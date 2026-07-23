import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "wouter";
import DatePicker, { DateObject } from "react-multi-date-picker";
import arabic from "react-date-object/calendars/arabic";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";
import arabic_ar from "react-date-object/locales/arabic_ar";
import gregorian_en from "react-date-object/locales/gregorian_en";
import persian_fa from "react-date-object/locales/persian_fa";
import { format, startOfMonth } from "date-fns";
import { ArrowRight, Calculator, CalendarDays, Loader2, Percent, ReceiptText, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { ManualFinanceCategory, ManualFinanceCommissionReportPayload, TenantMeta } from "@/lib/types";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const toIsoDate = (value: DateObject | null) => {
  if (!value) return "";
  return format(value.toDate(), "yyyy-MM-dd");
};

const percentNumber = (value: string) => {
  const numeric = Number(value.replace(/[^\d]/g, ""));
  if (Number.isNaN(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
};

export default function PanelCommissionReportPage() {
  const { isAdmin, isPrimaryAdmin } = useAuth();
  const { barbers } = useStore();
  const { toast } = useToast();
  const t = useT();
  const formatters = useFormat();
  const { calendar, dir, isRtl, locale } = useLocale();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [categories, setCategories] = useState<ManualFinanceCategory[]>([]);
  const [professionalId, setProfessionalId] = useState("");
  const [dateFrom, setDateFrom] = useState<DateObject | null>(() => new DateObject({ date: startOfMonth(new Date()) }));
  const [dateTo, setDateTo] = useState<DateObject | null>(() => new DateObject());
  const [defaultPercent, setDefaultPercent] = useState("50");
  const [useCategoryPercents, setUseCategoryPercents] = useState(false);
  const [categoryPercents, setCategoryPercents] = useState<Record<string, string>>({});
  const [loadingBase, setLoadingBase] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [report, setReport] = useState<ManualFinanceCommissionReportPayload | null>(null);

  const labels = getAudienceLabels(tenantMeta);
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const pickerCalendar = calendar === "hijri" ? arabic : calendar === "jalali" ? persian : gregorian;
  const pickerLocale = calendar === "hijri" ? arabic_ar : locale === "fa" ? persian_fa : gregorian_en;
  const calendarPosition = isRtl ? "bottom-right" : "bottom-left";
  const money = (value: number) => formatters.currency(value);
  const date = (value?: string | null) => value ? formatters.date(`${value}T12:00:00`, { month: "long" }) : t("panelCommission.value.noDate");
  const percent = (value: number) => formatters.percent(value / 100);
  const time = (value?: string | null) => value ? formatters.time(`2000-01-01T${value}`, { hourCycle: "h23" }) : t("panelCommission.value.missing");

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) setTenantMeta(res.data);
    });
  }, []);

  useEffect(() => {
    if (isPrimaryAdmin && !professionalId && barbers.length > 0) {
      setProfessionalId(barbers[0].id);
    }
  }, [barbers, isPrimaryAdmin, professionalId]);

  useEffect(() => {
    if (!isPrimaryAdmin) return;

    setLoadingBase(true);
    api.manualFinance.dashboard({ professionalId: professionalId || undefined, perPage: 1 }).then((res) => {
      if (res.success) {
        setCategories(res.data.categories);
        setCategoryPercents((current) => {
          const next = { ...current };
          res.data.categories.forEach((category) => {
            if (next[category.id] === undefined && category.defaultSharePercent !== null && category.defaultSharePercent !== undefined) {
              next[category.id] = String(category.defaultSharePercent);
            }
          });
          return next;
        });
      }
      setLoadingBase(false);
    });
  }, [isPrimaryAdmin, professionalId]);

  const handleCalculate = async () => {
    if (!professionalId) {
      toast({ variant: "destructive", title: t("panelCommission.toast.professionalRequired", { professional: labels.singular }) });
      return;
    }

    const from = toIsoDate(dateFrom);
    const to = toIsoDate(dateTo);
    if (!from || !to) {
      toast({ variant: "destructive", title: t("panelCommission.toast.dateRangeRequired") });
      return;
    }

    setCalculating(true);
    const res = await api.manualFinance.commissionReport({
      professionalId,
      dateFrom: from,
      dateTo: to,
      defaultPercent: percentNumber(defaultPercent),
      categoryPercents: Object.fromEntries(
        categories.map((category) => [
          category.id,
          useCategoryPercents && categoryPercents[category.id]?.trim() ? percentNumber(categoryPercents[category.id]) : null,
        ]),
      ),
    });
    setCalculating(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setReport(res.data);
  };

  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="max-w-md space-y-4 text-center">
          <Calculator className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelCommission.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelCommission.accessDenied.description")}</p>
          <Link href="/panel"><Button>{t("panelCommission.backToPanel")}</Button></Link>
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
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("panelCommission.title", { professional: labels.singular })}</h1>
          </div>
          <Link href="/panel/finance">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardHeader className="text-start">
            <CardTitle className="flex items-center justify-start gap-2 text-base">
              <Calculator className="h-4 w-4" />
              {t("panelCommission.form.title")}
            </CardTitle>
            <CardDescription className="text-start">{t("panelCommission.form.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr_0.9fr]">
              <div className="space-y-2">
                <label className="text-sm font-medium">{labels.singular}</label>
                <select
                  value={professionalId}
                  onChange={(event) => setProfessionalId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-start text-foreground"
                >
                  <option value="">{t("panelCommission.form.selectProfessional")}</option>
                  {barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}
                </select>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <label className="block text-sm font-medium">{t("panelCommission.form.dateFrom")}</label>
                <DatePicker
                  value={dateFrom}
                  onChange={(value) => setDateFrom(value as DateObject)}
                  calendar={pickerCalendar}
                  locale={pickerLocale}
                  calendarPosition={calendarPosition}
                  containerClassName="w-full"
                  inputClass="h-11 w-full rounded-xl border border-border bg-background px-3 text-start text-foreground"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <label className="block text-sm font-medium">{t("panelCommission.form.dateTo")}</label>
                <DatePicker
                  value={dateTo}
                  onChange={(value) => setDateTo(value as DateObject)}
                  calendar={pickerCalendar}
                  locale={pickerLocale}
                  calendarPosition={calendarPosition}
                  containerClassName="w-full"
                  inputClass="h-11 w-full rounded-xl border border-border bg-background px-3 text-start text-foreground"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("panelCommission.form.defaultPercent")}</label>
                <div className="relative" dir="ltr">
                  <Input
                    value={defaultPercent}
                    onChange={(event) => setDefaultPercent(String(percentNumber(event.target.value)))}
                    inputMode="numeric"
                    className="h-11 ps-10 text-start"
                    dir="ltr"
                  />
                  <Percent className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <label className="flex cursor-pointer items-start gap-3 text-start">
                  <input
                    type="checkbox"
                    checked={useCategoryPercents}
                    onChange={(event) => setUseCategoryPercents(event.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-border bg-background accent-primary"
                  />
                  <span>
                    <span className="block font-bold">{t("panelCommission.form.categoryPercentsTitle")}</span>
                    <span className="mt-1 block text-xs leading-6 text-muted-foreground">
                      {t("panelCommission.form.categoryPercentsDescription")}
                    </span>
                  </span>
                </label>
                {loadingBase ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </div>

              {useCategoryPercents ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {categories.map((category) => (
                    <div key={category.id} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/35 px-3 py-2">
                      <div className="min-w-0 truncate text-sm font-medium">{category.name}</div>
                      <div className="relative w-28 shrink-0" dir="ltr">
                        <Input
                          value={categoryPercents[category.id] ?? ""}
                          onChange={(event) => setCategoryPercents((current) => ({ ...current, [category.id]: event.target.value ? String(percentNumber(event.target.value)) : "" }))}
                          placeholder={defaultPercent}
                          inputMode="numeric"
                          className="h-9 w-full ps-7 text-start"
                          dir="ltr"
                        />
                        <Percent className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleCalculate} disabled={calculating || loadingBase} className="h-11 rounded-2xl px-5 font-bold">
                {calculating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Calculator className="me-2 h-4 w-4" />}
                {t("panelCommission.form.calculate")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {report ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <SummaryBox title={t("panelCommission.summary.totalServices")} value={money(report.summary.totalAmount)} icon={<ReceiptText className="h-4 w-4" />} />
              <SummaryBox title={t("panelCommission.summary.materialCost")} value={money(report.summary.materialCostAmount)} accent="text-amber-500" icon={<ReceiptText className="h-4 w-4" />} />
              <SummaryBox title={t("panelCommission.summary.netRevenue")} value={money(report.summary.netRevenueAmount)} accent="text-emerald-500" icon={<ReceiptText className="h-4 w-4" />} />
              <SummaryBox title={t("panelCommission.summary.paid")} value={money(report.summary.paidAmount)} icon={<CalendarDays className="h-4 w-4" />} />
              <SummaryBox title={t("panelCommission.summary.payable")} value={money(report.summary.commissionPayable)} accent="text-emerald-500" icon={<Percent className="h-4 w-4" />} />
              <SummaryBox title={t("panelCommission.summary.customerDebt")} value={money(report.summary.balanceAmount)} accent={report.summary.balanceAmount > 0 ? "text-destructive" : "text-emerald-500"} icon={<UserRound className="h-4 w-4" />} />
            </div>

            <Card className="border-border/70 bg-card/60">
              <CardHeader className="text-start">
                <CardTitle className="text-base">{t("panelCommission.settlement.title")}</CardTitle>
                <CardDescription className="text-start">
                  {t("panelCommission.settlement.range", {
                    professional: report.filter.professionalName || labels.singular,
                    from: date(report.filter.dateFrom),
                    to: date(report.filter.dateTo),
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoLine title={t("panelCommission.settlement.entriesCount")} value={t("panelCommission.value.records", { count: formatters.number(report.summary.entriesCount) })} />
                <InfoLine title={t("panelCommission.settlement.commissionOnTotal")} value={money(report.summary.commissionOnTotal)} />
                <InfoLine title={t("panelCommission.settlement.netPaid")} value={money(report.summary.netPaidAmount)} />
                <InfoLine title={t("panelCommission.settlement.businessShare")} value={money(report.summary.businessShareAfterPayable)} />
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/60">
              <CardHeader className="text-start">
                <CardTitle className="text-base">{t("panelCommission.categoryBreakdown.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.byCategory.length ? report.byCategory.map((row) => (
                  <div key={row.categoryId} className="grid gap-3 rounded-2xl border border-border/70 bg-background/30 p-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_repeat(7,minmax(0,1fr))]">
                    <div>
                      <div className="font-bold">{row.categoryName}</div>
                      <Badge variant="outline" className="mt-2">{percent(row.percent)}</Badge>
                    </div>
                    <InfoLine title={t("panelCommission.categoryBreakdown.total")} value={money(row.totalAmount)} compact />
                    <InfoLine title={t("panelCommission.categoryBreakdown.material")} value={money(row.materialCostAmount)} compact />
                    <InfoLine title={t("panelCommission.categoryBreakdown.net")} value={money(row.netRevenueAmount)} compact />
                    <InfoLine title={t("panelCommission.categoryBreakdown.paid")} value={money(row.paidAmount)} compact />
                    <InfoLine title={t("panelCommission.categoryBreakdown.debt")} value={money(row.balanceAmount)} compact />
                    <InfoLine title={t("panelCommission.categoryBreakdown.totalShare")} value={money(row.commissionOnTotal)} compact />
                    <InfoLine title={t("panelCommission.categoryBreakdown.payable")} value={money(row.commissionPayable)} compact highlight />
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-muted-foreground">
                    {t("panelCommission.categoryBreakdown.empty", { professional: labels.singular })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/60">
              <CardHeader className="text-start">
                <CardTitle className="text-base">{t("panelCommission.entries.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.entries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-border/70 bg-background/30 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 text-start">
                        <div className="font-bold">{entry.customerName} - {date(entry.entryDate)}</div>
                        <div className="text-xs leading-6 text-muted-foreground">
                          {entry.appointment
                            ? t("panelCommission.entries.appointment", {
                              section: entry.appointment.sectionName || t("panelCommission.value.service"),
                              time: time(entry.appointment.startTime),
                            })
                            : t("panelCommission.entries.noAppointment")}
                        </div>
                        <div className="text-xs leading-6 text-muted-foreground">
                          {entry.items.map((item) => {
                            const materialCost = item.materialCost ?? 0;
                            return materialCost > 0
                              ? t("panelCommission.entries.itemWithMaterial", {
                                category: item.categoryName,
                                amount: money(item.amount),
                                material: money(materialCost),
                                net: money(Math.max(0, item.amount - materialCost)),
                              })
                              : t("panelCommission.entries.item", { category: item.categoryName, amount: money(item.amount) });
                          }).join(t("panelCommission.value.separator"))}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge variant="secondary">{t("panelCommission.badge.total", { amount: money(entry.totalAmount) })}</Badge>
                        {entry.materialCostAmount > 0 ? <Badge variant="outline">{t("panelCommission.badge.material", { amount: money(entry.materialCostAmount) })}</Badge> : null}
                        <Badge variant="outline">{t("panelCommission.badge.net", { amount: money(entry.netRevenueAmount) })}</Badge>
                        <Badge variant="outline">{t("panelCommission.badge.paid", { amount: money(entry.paidAmount) })}</Badge>
                        {entry.balanceAmount > 0 ? <Badge variant="destructive">{t("panelCommission.badge.debt", { amount: money(entry.balanceAmount) })}</Badge> : <Badge variant="outline">{t("panelCommission.badge.settled")}</Badge>}
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">{t("panelCommission.badge.payable", { amount: money(entry.commissionPayable) })}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  );
}

function SummaryBox({ title, value, icon, accent = "text-foreground" }: { title: string; value: string; icon: ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{title}</span>
        {icon}
      </div>
      <div className={`mt-3 text-lg font-black ${accent}`}>{value}</div>
    </div>
  );
}

function InfoLine({ title, value, compact = false, highlight = false }: { title: string; value: string; compact?: boolean; highlight?: boolean }) {
  return (
    <div className={compact ? "text-start" : "rounded-2xl border border-border/70 bg-background/30 p-3 text-start"}>
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className={`mt-1 font-bold ${highlight ? "text-emerald-500" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
