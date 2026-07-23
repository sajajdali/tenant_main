import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoginModal } from "@/components/login-modal";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { StoreOrderSummary } from "@/lib/types";

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

const PAYMENT_METHOD_KEYS: Record<string, MessageKey> = {
  card: "storeOrders.payment.card",
  cod: "storeOrders.payment.cod",
  online: "storeOrders.payment.online",
};

export default function StoreOrdersPage() {
  const { user } = useAuth();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const format = useFormat();
  const [orders, setOrders] = useState<StoreOrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  useEffect(() => {
    document.title = t("storeOrders.documentTitle");
  }, [t]);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }

    setLoading(true);
    api.store.listMyOrders({ page: currentPage, perPage: 10 }).then((res) => {
      if (res.success) {
        setOrders(res.data.items);
        setLastPage(res.data.lastPage || 1);
      } else {
        setOrders([]);
      }
      setLoading(false);
    });
  }, [currentPage, user?.id]);

  if (!user) {
    return (
      <div className="store-page min-h-screen bg-background text-foreground" dir={dir}>
        <div className="container mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-10">
          <Card className="w-full border-border/70 bg-card/60">
            <CardContent className="space-y-5 p-6 text-center sm:p-8">
              <div className="text-2xl font-black">{t("storeOrders.loginRequiredTitle")}</div>
              <p className="text-sm leading-8 text-muted-foreground">
                {t("storeOrders.loginRequiredDescription")}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button className="rounded-[20px] px-6" onClick={() => setLoginOpen(true)}>{t("storeOrders.loginButton")}</Button>
                <Link href="/store">
                  <Button variant="outline" className="rounded-[20px] border-border bg-background/40 px-6">{t("storeOrders.backToStore")}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <LoginModal
          isOpen={loginOpen}
          onClose={() => setLoginOpen(false)}
          phoneStepDescription={t("storeOrders.loginRequiredDescription")}
        />
      </div>
    );
  }

  return (
    <div className="store-page min-h-screen bg-background text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_42%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("storeOrders.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("storeOrders.title")}</h1>
          </div>
          <Link href="/store">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40" aria-label={t("storeOrders.backToStore")}>
              {isRtl ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            </Button>
          </Link>
        </div>

        <Card className="border-border/70 bg-card/60">
          <CardContent className="space-y-4 p-5">
            {loading ? (
              <div className="rounded-[20px] border border-border/70 bg-background/35 p-6 text-sm text-muted-foreground">{t("storeOrders.loading")}</div>
            ) : orders.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-border/70 bg-background/35 p-6 text-sm text-muted-foreground">
                {t("storeOrders.empty")}
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const tracking = order.shippingTrackingCode || order.payment?.referenceId || order.payment?.invoiceNumber || t("storeOrders.valueMissing");
                  const statusKey = ORDER_STATUS_KEYS[order.status];
                  const paymentMethodKey = PAYMENT_METHOD_KEYS[order.paymentMethod];
                  const itemsSummary = order.items
                    .slice(0, 3)
                    .map((item) => t("storeOrders.itemSummary", { title: item.title, quantity: format.number(item.quantity) }))
                    .join(t("storeOrders.itemsSeparator"));

                  return (
                    <div key={order.id} className="rounded-[24px] border border-border/70 bg-background/35 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <CodeText className="font-black text-primary">{order.orderNumber}</CodeText>
                        <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                          {statusKey ? t(statusKey) : order.statusLabel || order.status}
                        </div>
                      </div>

                      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <div>{t("storeOrders.field.paymentMethod")} <span className="font-semibold text-foreground">{paymentMethodKey ? t(paymentMethodKey) : order.paymentMethod}</span></div>
                        <div>{t("storeOrders.field.trackingCode")} <CodeText className="font-semibold text-foreground">{tracking}</CodeText></div>
                        <div>{t("storeOrders.field.totalAmount")} <span className="font-semibold text-foreground">{format.currency(order.totalAmount)}</span></div>
                        <div>{t("storeOrders.field.date")} <span className="font-semibold text-foreground">{order.createdAt ? format.date(order.createdAt) : t("storeOrders.valueMissing")}</span></div>
                      </div>

                      {order.items.length > 0 ? (
                        <div className="mt-3 rounded-[16px] border border-border/70 bg-card/40 p-3 text-sm text-muted-foreground">
                          {itemsSummary}
                          {order.items.length > 3 ? t("storeOrders.itemsMoreSuffix") : ""}
                        </div>
                      ) : null}
                      {order.shippingCarrier ? (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {t("storeOrders.field.shippingCarrier")} <span className="font-semibold text-foreground">{order.shippingCarrier}</span>
                        </div>
                      ) : null}
                      {order.adminNote ? (
                        <div className="mt-2 rounded-[14px] border border-border/70 bg-background/30 p-2 text-xs text-muted-foreground">
                          {t("storeOrders.field.adminNote")} {order.adminNote}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {lastPage > 1 ? (
              <div className="flex items-center justify-center gap-3 pt-1">
                <Button
                  variant="outline"
                  className="rounded-[16px] border-border bg-background/40"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage <= 1}
                >
                  {t("storeOrders.pagination.previous")}
                </Button>
                <div className="text-sm text-muted-foreground">
                  {t("storeOrders.pagination.page", { current: format.number(currentPage), total: format.number(lastPage) })}
                </div>
                <Button
                  variant="outline"
                  className="rounded-[16px] border-border bg-background/40"
                  onClick={() => setCurrentPage((page) => Math.min(lastPage, page + 1))}
                  disabled={currentPage >= lastPage}
                >
                  {t("storeOrders.pagination.next")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
