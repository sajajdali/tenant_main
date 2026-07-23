import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Eye, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { StoreOrderSummary } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import { CodeText, PhoneText } from "@/i18n/ltr-text";

const STATUS_LABEL_KEYS = {
  pending_payment: "storeOrders.status.pendingPayment",
  awaiting_card_transfer: "storeOrders.status.awaitingCardTransfer",
  placed: "storeOrders.status.placed",
  paid: "storeOrders.status.paid",
  processing: "storeOrders.status.processing",
  shipped: "storeOrders.status.shipped",
  returned: "storeOrders.status.returned",
  cancelled: "storeOrders.status.cancelled",
  rejected: "storeOrders.status.rejected",
  failed: "storeOrders.status.failed",
} as const satisfies Record<string, MessageKey>;

const PAYMENT_LABEL_KEYS = {
  online: "storeOrders.payment.online",
  card: "storeOrders.payment.card",
  cod: "storeOrders.payment.cod",
} as const satisfies Record<string, MessageKey>;

const SHIPPING_LABEL_KEYS = {
  courier: "panelStoreOrders.shipping.courier",
  express: "panelStoreOrders.shipping.express",
  pickup: "panelStoreOrders.shipping.pickup",
} as const satisfies Record<string, MessageKey>;

function statusClass(status: string) {
  switch (status) {
    case "processing":
    case "paid":
    case "shipped":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "awaiting_card_transfer":
    case "pending_payment":
    case "placed":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "returned":
    case "cancelled":
    case "rejected":
    case "failed":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    default:
      return "border-border/70 bg-background/40 text-muted-foreground";
  }
}

const STATUS_OPTIONS = [
  "pending_payment",
  "awaiting_card_transfer",
  "placed",
  "paid",
  "processing",
  "shipped",
  "returned",
  "cancelled",
  "rejected",
  "failed",
];

export default function PanelStoreOrdersPage() {
  const { isPrimaryAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const formatValue = useFormat();
  const { dir, isRtl } = useLocale();
  const requestIdRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<StoreOrderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    paymentMethod: "",
    shippingMethod: "",
    onlyNew: false,
  });
  const statusLabel = (status: string) => {
    const key = STATUS_LABEL_KEYS[status as keyof typeof STATUS_LABEL_KEYS];
    return key ? t(key) : status;
  };
  const paymentMethodLabel = (method: string) => {
    const key = PAYMENT_LABEL_KEYS[method as keyof typeof PAYMENT_LABEL_KEYS];
    return key ? t(key) : method;
  };
  const shippingMethodLabel = (method: string) => {
    const key = SHIPPING_LABEL_KEYS[method as keyof typeof SHIPPING_LABEL_KEYS];
    return key ? t(key) : method;
  };

  const loadOrders = async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const res = await api.store.listAdminOrders({
      page,
      perPage: 12,
      q: filters.q.trim() || undefined,
      status: filters.status || undefined,
      paymentMethod: (filters.paymentMethod || undefined) as any,
      shippingMethod: (filters.shippingMethod || undefined) as any,
      onlyNew: filters.onlyNew,
    });
    if (requestId !== requestIdRef.current) {
      return;
    }
    setLoading(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("panelStoreOrders.loadFailed"), description: res.message });
      return;
    }

    setOrders(res.data.items);
    setLastPage(res.data.lastPage || 1);
  };

  useEffect(() => {
    document.title = t("panelStoreOrders.documentTitle");
  }, [t]);

  useEffect(() => {
    if (authLoading || !isPrimaryAdmin) {
      return;
    }
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isPrimaryAdmin, page]);

  useEffect(() => {
    if (authLoading || !isPrimaryAdmin) {
      return;
    }

    const handlePageShow = () => {
      if (window.location.pathname === "/panel/store-settings/orders") {
        loadOrders();
      }
    };

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isPrimaryAdmin]);

  const totalAmount = useMemo(() => orders.reduce((sum, item) => sum + (item.totalAmount || 0), 0), [orders]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="flex items-center text-muted-foreground">
          <Loader2 className="me-2 h-5 w-5 animate-spin" />
          {t("panelStoreOrders.preparing")}
        </div>
      </div>
    );
  }

  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelStoreOrders.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelStoreOrders.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelStoreOrders.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_42%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("panelStoreOrders.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("panelStoreOrders.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelStoreOrders.description")}</p>
          </div>
          <Link href="/panel/store-settings">
            <Button
              variant="outline"
              size="icon"
              aria-label={t("panelStoreOrders.back")}
              className="h-11 w-11 rounded-2xl border-border bg-background/40"
            >
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </header>

        <Card className="border-border/70 bg-card/60">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="xl:col-span-2">
                <Label className="mb-2 block">{t("panelStoreOrders.filter.search")}</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filters.q}
                    onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                    placeholder={t("panelStoreOrders.filter.searchPlaceholder")}
                    className="ps-10"
                  />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">{t("panelStoreOrders.filter.status")}</Label>
                <Select value={filters.status || "all"} onValueChange={(value) => setFilters((current) => ({ ...current, status: value === "all" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder={t("panelStoreOrders.filter.all")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("panelStoreOrders.filter.all")}</SelectItem>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">{t("panelStoreOrders.filter.paymentMethod")}</Label>
                <Select value={filters.paymentMethod || "all"} onValueChange={(value) => setFilters((current) => ({ ...current, paymentMethod: value === "all" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder={t("panelStoreOrders.filter.all")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("panelStoreOrders.filter.all")}</SelectItem>
                    {Object.entries(PAYMENT_LABEL_KEYS).map(([method, key]) => (
                      <SelectItem key={method} value={method}>{t(key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">{t("panelStoreOrders.filter.shippingMethod")}</Label>
                <Select value={filters.shippingMethod || "all"} onValueChange={(value) => setFilters((current) => ({ ...current, shippingMethod: value === "all" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder={t("panelStoreOrders.filter.all")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("panelStoreOrders.filter.all")}</SelectItem>
                    {Object.entries(SHIPPING_LABEL_KEYS).map(([method, key]) => (
                      <SelectItem key={method} value={method}>{t(key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Switch checked={filters.onlyNew} onCheckedChange={(checked) => setFilters((current) => ({ ...current, onlyNew: checked }))} />
                <div className="text-sm text-muted-foreground">{t("panelStoreOrders.filter.onlyNew")}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setFilters({ q: "", status: "", paymentMethod: "", shippingMethod: "", onlyNew: false });
                  setPage(1);
                }}>{t("panelStoreOrders.filter.clear")}</Button>
                <Button onClick={() => { setPage(1); loadOrders(); }}>{t("panelStoreOrders.filter.apply")}</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/70 bg-card/60"><CardContent className="p-5"><div className="text-sm text-muted-foreground">{t("panelStoreOrders.stats.pageCount")}</div><div className="mt-2 text-2xl font-black">{formatValue.number(orders.length)}</div></CardContent></Card>
          <Card className="border-border/70 bg-card/60"><CardContent className="p-5"><div className="text-sm text-muted-foreground">{t("panelStoreOrders.stats.pageAmount")}</div><div className="mt-2 text-2xl font-black text-primary">{formatValue.currency(totalAmount)}</div></CardContent></Card>
          <Card className="border-border/70 bg-card/60"><CardContent className="p-5"><div className="text-sm text-muted-foreground">{t("panelStoreOrders.stats.currentPage")}</div><div className="mt-2 text-2xl font-black">{formatValue.number(page)}</div></CardContent></Card>
          <Card className="border-border/70 bg-card/60"><CardContent className="p-5"><div className="text-sm text-muted-foreground">{t("panelStoreOrders.stats.lastPage")}</div><div className="mt-2 text-2xl font-black">{formatValue.number(lastPage)}</div></CardContent></Card>
        </div>

        <Card className="border-border/70 bg-card/60">
          <CardContent className="p-5">
            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center text-muted-foreground">
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("panelStoreOrders.loading")}
              </div>
            ) : orders.length === 0 ? (
              <div className="flex min-h-[240px] items-center justify-center text-center text-muted-foreground">{t("panelStoreOrders.empty")}</div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {orders.map((order) => (
                  <div key={order.id} className="rounded-[28px] border border-border/70 bg-background/35 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-black">
                            {t("panelStoreOrders.orderNumber", { number: `\u2066${order.orderNumber}\u2069` })}
                          </div>
                          <div className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>
                            {order.statusLabel || statusLabel(order.status)}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                          <span>{order.customerName}</span>
                          <span aria-hidden="true">-</span>
                          <PhoneText>{order.customerPhone}</PhoneText>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {paymentMethodLabel(order.paymentMethod)} | {shippingMethodLabel(order.shippingMethod)} | {order.createdAt ? formatValue.dateTime(order.createdAt) : "-"}
                        </div>
                      </div>
                      <Link href={`/panel/store-settings/orders/${order.id}`}>
                        <Button variant="outline" className="gap-2">
                          <Eye className="h-4 w-4" />
                          {t("panelStoreOrders.manage")}
                        </Button>
                      </Link>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[20px] border border-border/70 bg-card/50 p-4">
                        <div className="text-xs text-muted-foreground">{t("panelStoreOrders.items")}</div>
                        <div className="mt-2 text-lg font-black">{formatValue.number(order.itemsCount)}</div>
                      </div>
                      <div className="rounded-[20px] border border-border/70 bg-card/50 p-4">
                        <div className="text-xs text-muted-foreground">{t("panelStoreOrders.totalAmount")}</div>
                        <div className="mt-2 text-lg font-black text-primary">{formatValue.currency(order.totalAmount)}</div>
                      </div>
                      <div className="rounded-[20px] border border-border/70 bg-card/50 p-4">
                        <div className="text-xs text-muted-foreground">{t("panelStoreOrders.shippingTrackingCode")}</div>
                        <div className="mt-2 text-sm font-bold">
                          {order.shippingTrackingCode
                            ? <CodeText>{order.shippingTrackingCode}</CodeText>
                            : t("panelStoreOrders.valueMissing")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              <Button variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                {t("panelStoreOrders.pagination.previous")}
              </Button>
              <div className="text-sm text-muted-foreground">
                {t("panelStoreOrders.pagination.page", {
                  current: formatValue.number(page),
                  total: formatValue.number(lastPage),
                })}
              </div>
              <Button variant="outline" onClick={() => setPage((current) => Math.min(lastPage, current + 1))} disabled={page >= lastPage}>
                {t("panelStoreOrders.pagination.next")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
