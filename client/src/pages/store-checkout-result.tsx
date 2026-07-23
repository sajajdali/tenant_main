import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Clock3, CreditCard, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import { api } from "@/lib/api";
import type { StoreOrderSummary } from "@/lib/types";

const PAYMENT_METHOD_KEYS: Record<string, MessageKey> = {
  card: "storeCheckoutResult.method.card",
  cod: "storeCheckoutResult.method.cod",
  online: "storeCheckoutResult.method.online",
};

const ORDER_STATUS_KEYS: Record<string, MessageKey> = {
  awaiting_card_transfer: "storeOrders.status.awaitingCardTransfer",
  cancelled: "storeOrders.status.cancelled",
  failed: "storeOrders.status.failed",
  paid: "storeOrders.status.paid",
  pending_payment: "storeOrders.status.pendingPayment",
  placed: "storeOrders.status.placed",
  processing: "storeOrders.status.processing",
  rejected: "storeOrders.status.rejected",
  returned: "storeOrders.status.returned",
  shipped: "storeOrders.status.shipped",
};

export default function StoreCheckoutResultPage() {
  const { dir, isRtl } = useLocale();
  const t = useT();
  const format = useFormat();
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const status = search.get("status") || "success";
  const orderNumber = search.get("order") || "";
  const orderId = search.get("oid") || "";
  const method = search.get("method");
  const message = search.get("message") || "";
  const note = search.get("note") || "";
  const trackingFromQuery = search.get("tracking") || "";
  const [orderDetails, setOrderDetails] = useState<StoreOrderSummary | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (!orderId) {
      setOrderDetails(null);
      return;
    }

    setLoadingOrder(true);
    api.store.getMyOrder(orderId).then((res) => {
      if (res.success) {
        setOrderDetails(res.data);
      } else {
        setOrderDetails(null);
      }
      setLoadingOrder(false);
    });
  }, [orderId]);

  const trackingCode = trackingFromQuery || orderDetails?.payment?.referenceId || orderDetails?.payment?.invoiceNumber || "";

  const config =
    status === "success"
      ? {
          title: t("storeCheckoutResult.status.successTitle"),
          description: t("storeCheckoutResult.status.successDescription"),
          icon: CheckCircle2,
          accent: "text-emerald-400",
          panel: "border-emerald-500/20 bg-emerald-500/10",
        }
      : status === "card_pending"
        ? {
            title: t("storeCheckoutResult.status.cardPendingTitle"),
            description: t("storeCheckoutResult.status.cardPendingDescription"),
            icon: CreditCard,
            accent: "text-primary",
            panel: "border-primary/20 bg-primary/10",
          }
        : status === "cod"
          ? {
              title: t("storeCheckoutResult.status.codTitle"),
              description: t("storeCheckoutResult.status.codDescription"),
              icon: Clock3,
              accent: "text-primary",
              panel: "border-primary/20 bg-primary/10",
            }
          : {
              title: t("storeCheckoutResult.status.failedTitle"),
              description: message || t("storeCheckoutResult.status.failedDescription"),
              icon: AlertCircle,
              accent: "text-red-400",
              panel: "border-red-500/20 bg-red-500/10",
            };

  const Icon = config.icon;
  const liveStatus = orderDetails?.status ? orderDetails.status : status;
  const liveStatusKey = ORDER_STATUS_KEYS[liveStatus] ?? (status === "success" ? "storeCheckoutResult.liveStatus.success" : status === "card_pending" ? "storeCheckoutResult.liveStatus.cardPending" : status === "cod" ? "storeCheckoutResult.liveStatus.cod" : status === "failed" ? "storeCheckoutResult.liveStatus.failed" : null);
  const methodKey = method ? PAYMENT_METHOD_KEYS[method] : null;

  return (
    <div className="store-page min-h-screen bg-background text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_42%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card className="border-border/70 bg-card/60">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <div className={`mb-4 flex h-20 w-20 items-center justify-center rounded-[28px] border ${config.panel}`}>
                <Icon className={`h-10 w-10 ${config.accent}`} />
              </div>
              <h1 className="text-2xl font-black sm:text-3xl">{config.title}</h1>
              <p className="mt-3 max-w-xl text-sm leading-8 text-muted-foreground">{config.description}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-border/70 bg-background/35 p-4">
                <div className="mb-2 text-sm text-muted-foreground">{t("storeCheckoutResult.orderNumber")}</div>
                {orderNumber ? (
                  <CodeText className="text-lg font-black text-primary">{orderNumber}</CodeText>
                ) : (
                  <div className="text-lg font-black text-primary">{t("storeCheckoutResult.notIssued")}</div>
                )}
              </div>
              <div className="rounded-[24px] border border-border/70 bg-background/35 p-4">
                <div className="mb-2 text-sm text-muted-foreground">{t("storeCheckoutResult.paymentMethod")}</div>
                <div className="text-lg font-black">{methodKey ? t(methodKey) : t("storeCheckoutResult.method.order")}</div>
              </div>
            </div>

            {trackingCode ? (
              <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="mb-2 text-sm text-muted-foreground">{t("storeCheckoutResult.trackingCode")}</div>
                <CodeText className="text-lg font-black text-emerald-300">{trackingCode}</CodeText>
              </div>
            ) : null}

            {status === "card_pending" && note ? (
              <div className="rounded-[24px] border border-primary/20 bg-primary/10 p-4 text-sm leading-8 text-muted-foreground">
                {note}
              </div>
            ) : null}

            {status === "failed" && message ? (
              <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-4 text-sm leading-8 text-muted-foreground">
                {message}
              </div>
            ) : null}

            {status !== "failed" ? (
              <div className="space-y-3 rounded-[24px] border border-border/70 bg-background/35 p-4">
                <div className="rounded-[18px] border border-border/70 bg-card/40 p-3 text-sm">
                  {t("storeCheckoutResult.currentStatus")} <span className="font-bold text-primary">{liveStatusKey ? t(liveStatusKey) : orderDetails?.statusLabel || liveStatus}</span>
                </div>
                <div className="font-bold">{t("storeCheckoutResult.orderProducts")}</div>
                {loadingOrder ? (
                  <div className="text-sm text-muted-foreground">{t("storeCheckoutResult.loadingDetails")}</div>
                ) : orderDetails?.items?.length ? (
                  <div className="space-y-2">
                    {orderDetails.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-[16px] border border-border/70 bg-card/40 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{item.title}</div>
                          <div className="text-xs text-muted-foreground">{t("storeCheckoutResult.itemQuantity", { count: format.number(item.quantity) })}</div>
                        </div>
                        <div className="text-sm font-bold text-primary">{format.currency(item.totalAmount)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{t("storeCheckoutResult.noProductDetails")}</div>
                )}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/store">
                <Button className="rounded-[20px] px-6">
                  <ShoppingBag className="me-2 h-4 w-4" />
                  {t("storeCheckoutResult.backToStore")}
                </Button>
              </Link>
              <Link href="/store/orders">
                <Button variant="outline" className="rounded-[20px] border-border bg-background/40 px-6">
                  {t("storeCheckoutResult.myOrders")}
                </Button>
              </Link>
              <Link href="/store/checkout">
                <Button variant="outline" className="rounded-[20px] border-border bg-background/40 px-6">
                  <BackIcon className="me-2 h-4 w-4" />
                  {t("storeCheckoutResult.backToCheckout")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
