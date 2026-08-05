import { Component, FormEvent, useEffect, useState } from "react";
import type React from "react";
import { Link } from "wouter";
import DatePicker, { DateObject } from "react-multi-date-picker";
import arabic from "react-date-object/calendars/arabic";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";
import arabic_ar from "react-date-object/locales/arabic_ar";
import gregorian_en from "react-date-object/locales/gregorian_en";
import persian_fa from "react-date-object/locales/persian_fa";
import { format as formatDateFns } from "date-fns";
import { ArrowRight, CalendarDays, Eye, Loader2, PackageCheck, ReceiptText, Search, WalletCards } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NutritionPackageOrder } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { CodeText, PhoneText } from "@/i18n/ltr-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Payload = {
  items: NutritionPackageOrder[];
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
};

const EMPTY_PAYLOAD: Payload = {
  items: [],
  page: 1,
  perPage: 20,
  total: 0,
  lastPage: 1,
};

const toSafeDate = (value: string) => new Date(`${value}T12:00:00`);

function toDatePickerValue(value: string, pickerCalendar: typeof persian | typeof gregorian | typeof arabic, pickerLocale: typeof persian_fa | typeof gregorian_en | typeof arabic_ar) {
  if (!value) {
    return null;
  }

  return new DateObject({
    date: toSafeDate(value),
    calendar: pickerCalendar,
    locale: pickerLocale,
  });
}

function isPayload(value: unknown): value is Payload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Payload>;

  return Array.isArray(candidate.items)
    && typeof candidate.page === "number"
    && typeof candidate.perPage === "number"
    && typeof candidate.total === "number"
    && typeof candidate.lastPage === "number";
}

function statusClass(status: NutritionPackageOrder["status"]) {
  switch (status) {
    case "paid":
    case "manual":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "failed":
    case "cancelled":
      return "border-rose-400/20 bg-rose-400/10 text-rose-300";
    default:
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  }
}

export default function PanelNutritionPackageOrdersPage() {
  return (
    <PackageOrdersErrorBoundary>
      <PanelNutritionPackageOrdersContent />
    </PackageOrdersErrorBoundary>
  );
}

class PackageOrdersErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background p-6 text-foreground" dir="rtl">
          <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-start">
            <h1 className="text-lg font-black text-destructive">خطا در نمایش صفحه پکیج های خریداری شده</h1>
            <p className="mt-3 text-sm leading-7 text-destructive/90">{this.state.error.message}</p>
            <Link href="/panel">
              <Button className="mt-4">بازگشت به پنل</Button>
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function PanelNutritionPackageOrdersContent() {
  const { isAdmin, isBarber, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { calendar, dir, isRtl, locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<Payload>(EMPTY_PAYLOAD);
  const [selected, setSelected] = useState<NutritionPackageOrder | null>(null);
  const [q, setQ] = useState("");
  const [user, setUser] = useState("");
  const [mobile, setMobile] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pickerCalendar = calendar === "hijri" ? arabic : calendar === "jalali" ? persian : gregorian;
  const pickerLocale = calendar === "hijri" ? arabic_ar : locale === "fa" ? persian_fa : gregorian_en;
  const calendarPosition = isRtl ? "bottom-right" : "bottom-left";

  const money = (value: number) => t("panelNutritionPackageOrders.money.toman", { amount: format.number(Math.max(0, value)) });
  const date = (value?: string | null) => {
    if (!value) {
      return t("panelNutritionPackageOrders.value.empty");
    }

    try {
      return format.dateTime(value, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  };
  const statusLabel = (status: NutritionPackageOrder["status"]) => t(`panelNutritionPackageOrders.status.${status}`);
  const gatewayLabel = (value?: string | null) => {
    if (!value) return t("panelNutritionPackageOrders.value.empty");

    const labels: Record<string, string> = {
      sandbox: t("panelNutritionPackageOrders.gateway.sandbox"),
      free: t("panelNutritionPackageOrders.gateway.free"),
      manual: t("panelNutritionPackageOrders.gateway.manual"),
      maliart: t("panelNutritionPackageOrders.gateway.maliart"),
      zarinpal: t("panelNutritionPackageOrders.gateway.zarinpal"),
      idpay: t("panelNutritionPackageOrders.gateway.idpay"),
      nextpay: t("panelNutritionPackageOrders.gateway.nextpay"),
    };

    return labels[value] ?? value;
  };

  const load = async (page = 1) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await api.nutritionPackageCheckout.adminOrders({ q, user, mobile, dateFrom, dateTo, page, perPage: 20 });

      if (result.success && isPayload(result.data)) {
        setPayload(result.data);
      } else {
        const message = result.message || t("api.requestFailed");
        setPayload(EMPTY_PAYLOAD);
        setErrorMessage(message);
        toast({ variant: "destructive", title: t("panelNutritionPackageOrders.toast.loadFailed"), description: message });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("api.requestFailed");
      setErrorMessage(message);
      toast({ variant: "destructive", title: t("panelNutritionPackageOrders.toast.loadFailed"), description: message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (isAdmin || isBarber) {
      void load();
      return;
    }

    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isBarber, isLoading]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void load(1);
  };

  const resetFilters = () => {
    setQ("");
    setUser("");
    setMobile("");
    setDateFrom("");
    setDateTo("");
    setTimeout(() => void load(1), 0);
  };

  const paidTotal = payload.items.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.payableAmount, 0);
  const paidCount = payload.items.filter((item) => item.status === "paid").length;

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("panelNutritionPackageOrders.loading")}
        </div>
      </div>
    );
  }

  if (!isAdmin && !isBarber) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelNutritionPackageOrders.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelNutritionPackageOrders.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelNutritionPackageOrders.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-bold text-primary">{t("panelNutritionPackageOrders.kicker")}</p>
            <h1 className="text-2xl font-black">{t("panelNutritionPackageOrders.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="grid gap-3 sm:grid-cols-3 lg:gap-4">
          <SummaryCard title={t("panelNutritionPackageOrders.stats.total")} value={format.number(payload.total)} icon={<ReceiptText className="h-5 w-5" />} />
          <SummaryCard title={t("panelNutritionPackageOrders.stats.paid")} value={format.number(paidCount)} icon={<PackageCheck className="h-5 w-5" />} />
          <SummaryCard title={t("panelNutritionPackageOrders.stats.paidAmount")} value={money(paidTotal)} icon={<WalletCards className="h-5 w-5" />} />
        </div>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-5 w-5 text-primary" />
              {t("panelNutritionPackageOrders.filters.title")}
            </CardTitle>
            <CardDescription className="text-start">{t("panelNutritionPackageOrders.filters.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_0.85fr_0.85fr_auto]">
              <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("panelNutritionPackageOrders.filters.search")} className="h-11 rounded-xl text-start" />
              <Input value={user} onChange={(event) => setUser(event.target.value)} placeholder={t("panelNutritionPackageOrders.filters.user")} className="h-11 rounded-xl text-start" />
              <Input value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder={t("panelNutritionPackageOrders.filters.mobile")} className="h-11 rounded-xl text-start" dir="ltr" />
              <DateFilter
                value={dateFrom}
                onChange={setDateFrom}
                pickerCalendar={pickerCalendar}
                pickerLocale={pickerLocale}
                calendarPosition={calendarPosition}
              />
              <DateFilter
                value={dateTo}
                onChange={setDateTo}
                pickerCalendar={pickerCalendar}
                pickerLocale={pickerLocale}
                calendarPosition={calendarPosition}
              />
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button type="submit" className="h-11 rounded-xl px-5">{t("panelNutritionPackageOrders.filters.submit")}</Button>
                <Button type="button" variant="outline" onClick={resetFilters} className="h-11 rounded-xl px-4">{t("panelNutritionPackageOrders.filters.reset")}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("panelNutritionPackageOrders.table.title")}</CardTitle>
            <CardDescription className="text-start">{t("panelNutritionPackageOrders.pagination.summary", { page: format.number(payload.page), lastPage: format.number(payload.lastPage), total: format.number(payload.total) })}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {errorMessage ? (
              <div className="m-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-bold leading-7 text-destructive">
                {errorMessage}
              </div>
            ) : null}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 bg-background/50 hover:bg-background/50">
                    <TableHead className="text-start">{t("panelNutritionPackageOrders.table.user")}</TableHead>
                    <TableHead className="text-start">{t("panelNutritionPackageOrders.table.package")}</TableHead>
                    <TableHead className="text-start">{t("panelNutritionPackageOrders.table.amount")}</TableHead>
                    <TableHead className="text-start">{t("panelNutritionPackageOrders.table.gateway")}</TableHead>
                    <TableHead className="text-start">{t("panelNutritionPackageOrders.table.status")}</TableHead>
                    <TableHead className="text-start">{t("panelNutritionPackageOrders.table.date")}</TableHead>
                    <TableHead className="text-end">{t("panelNutritionPackageOrders.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.items.map((item) => (
                    <TableRow key={item.id} className="border-border/60">
                      <TableCell>
                        <div className="font-bold">{item.user?.name || t("panelNutritionPackageOrders.value.empty")}</div>
                        {item.user?.mobile ? <PhoneText className="text-xs text-muted-foreground">{item.user.mobile}</PhoneText> : null}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold">{item.package?.name || t("panelNutritionPackageOrders.value.empty")}</div>
                        <CodeText className="text-xs text-muted-foreground">{item.invoiceNumber}</CodeText>
                      </TableCell>
                      <TableCell className="font-bold">{money(item.payableAmount)}</TableCell>
                      <TableCell>{gatewayLabel(item.gateway)}</TableCell>
                      <TableCell><Badge className={statusClass(item.status)}>{statusLabel(item.status)}</Badge></TableCell>
                      <TableCell>{date(item.createdAt)}</TableCell>
                      <TableCell className="text-end">
                        <Button type="button" variant="outline" size="icon" onClick={() => setSelected(item)} className="h-9 w-9 rounded-xl">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 p-4 md:hidden">
              {payload.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="w-full rounded-2xl border border-border/70 bg-background/35 p-4 text-start transition hover:bg-background/55"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black">{item.user?.name || t("panelNutritionPackageOrders.value.empty")}</div>
                      {item.user?.mobile ? <PhoneText className="mt-1 block text-xs text-muted-foreground">{item.user.mobile}</PhoneText> : null}
                    </div>
                    <Badge className={`${statusClass(item.status)} shrink-0`}>{statusLabel(item.status)}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <MobileInfo label={t("panelNutritionPackageOrders.table.package")} value={item.package?.name || t("panelNutritionPackageOrders.value.empty")} />
                    <MobileInfo label={t("panelNutritionPackageOrders.table.amount")} value={money(item.payableAmount)} />
                    <MobileInfo label={t("panelNutritionPackageOrders.table.gateway")} value={gatewayLabel(item.gateway)} />
                    <MobileInfo label={t("panelNutritionPackageOrders.table.date")} value={date(item.createdAt)} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    <CodeText>{item.invoiceNumber}</CodeText>
                    <Eye className="h-4 w-4 text-primary" />
                  </div>
                </button>
              ))}
            </div>
            {payload.items.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">{t("panelNutritionPackageOrders.empty")}</div>
            ) : null}
            <div className="flex items-center justify-between gap-3 border-t border-border/70 p-4">
              <Button variant="outline" disabled={payload.page <= 1} onClick={() => load(payload.page - 1)} className="rounded-xl">{t("panelNutritionPackageOrders.pagination.prev")}</Button>
              <span className="text-sm text-muted-foreground">{t("panelNutritionPackageOrders.pagination.summary", { page: format.number(payload.page), lastPage: format.number(payload.lastPage), total: format.number(payload.total) })}</span>
              <Button variant="outline" disabled={payload.page >= payload.lastPage} onClick={() => load(payload.page + 1)} className="rounded-xl">{t("panelNutritionPackageOrders.pagination.next")}</Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[86vh] overflow-y-auto border-border/70 bg-card text-start sm:max-w-3xl" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t("panelNutritionPackageOrders.modal.title")}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label={t("panelNutritionPackageOrders.modal.user")} value={selected.user?.name || t("panelNutritionPackageOrders.value.empty")} />
                <Info label={t("panelNutritionPackageOrders.modal.mobile")} value={selected.user?.mobile ? <PhoneText>{selected.user.mobile}</PhoneText> : t("panelNutritionPackageOrders.value.empty")} />
                <Info label={t("panelNutritionPackageOrders.modal.package")} value={selected.package?.name || t("panelNutritionPackageOrders.value.empty")} />
                <Info label={t("panelNutritionPackageOrders.modal.invoice")} value={<CodeText>{selected.invoiceNumber}</CodeText>} />
                <Info label={t("panelNutritionPackageOrders.modal.gateway")} value={gatewayLabel(selected.gateway)} />
                <Info label={t("panelNutritionPackageOrders.modal.status")} value={<Badge className={statusClass(selected.status)}>{statusLabel(selected.status)}</Badge>} />
                <Info label={t("panelNutritionPackageOrders.modal.amount")} value={money(selected.amount)} />
                <Info label={t("panelNutritionPackageOrders.modal.discount")} value={money(selected.discountAmount)} />
                <Info label={t("panelNutritionPackageOrders.modal.payable")} value={money(selected.payableAmount)} />
                <Info label={t("panelNutritionPackageOrders.modal.reference")} value={selected.referenceId ? <CodeText>{selected.referenceId}</CodeText> : t("panelNutritionPackageOrders.value.empty")} />
                <Info label={t("panelNutritionPackageOrders.modal.transaction")} value={selected.transactionId ? <CodeText>{selected.transactionId}</CodeText> : t("panelNutritionPackageOrders.value.empty")} />
                <Info label={t("panelNutritionPackageOrders.modal.discountCode")} value={selected.discountCode || t("panelNutritionPackageOrders.value.empty")} />
                <Info label={t("panelNutritionPackageOrders.modal.createdAt")} value={date(selected.createdAt)} />
                <Info label={t("panelNutritionPackageOrders.modal.paidAt")} value={date(selected.paidAt)} />
                <Info label={t("panelNutritionPackageOrders.modal.expiresAt")} value={date(selected.expiresAt)} />
                <Info label={t("panelNutritionPackageOrders.modal.sandbox")} value={selected.sandboxMode ? t("panelNutritionPackageOrders.value.yes") : t("panelNutritionPackageOrders.value.no")} />
              </div>
              {selected.failureReason ? <Info label={t("panelNutritionPackageOrders.modal.failureReason")} value={selected.failureReason} /> : null}
              <pre className="max-h-64 overflow-auto rounded-2xl border border-border/70 bg-background/40 p-4 text-xs leading-6 text-muted-foreground" dir="ltr">
                {JSON.stringify(selected.metaJson ?? {}, null, 2)}
              </pre>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="border-border/70 bg-card/60">
      <CardContent className="flex min-h-24 items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="text-xs leading-5 text-muted-foreground sm:text-sm">{title}</div>
          <div className="mt-1 break-words text-xl font-black leading-7 sm:mt-2 sm:text-2xl">{value}</div>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-12 sm:w-12">{icon}</div>
      </CardContent>
    </Card>
  );
}

function DateFilter({
  value,
  onChange,
  pickerCalendar,
  pickerLocale,
  calendarPosition,
}: {
  value: string;
  onChange: (value: string) => void;
  pickerCalendar: typeof persian | typeof gregorian | typeof arabic;
  pickerLocale: typeof persian_fa | typeof gregorian_en | typeof arabic_ar;
  calendarPosition: "bottom-right" | "bottom-left";
}) {
  return (
    <div className="relative">
      <DatePicker
        value={toDatePickerValue(value, pickerCalendar, pickerLocale)}
        onChange={(nextValue) => onChange(nextValue?.isValid ? formatDateFns(nextValue.toDate(), "yyyy-MM-dd") : "")}
        calendar={pickerCalendar}
        locale={pickerLocale}
        calendarPosition={calendarPosition}
        format="YYYY/MM/DD"
        inputClass="h-11 w-full rounded-xl border border-input bg-background px-3 text-center text-sm"
        containerClassName="w-full"
      />
      <CalendarDays className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function MobileInfo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-card/40 p-2.5">
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <div className="mt-1 min-w-0 break-words text-xs font-black leading-5">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/35 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-bold">{value}</div>
    </div>
  );
}
