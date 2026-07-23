import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowRight, CheckCircle2, Loader2, MapPin, MessageSquareText, Package, Save, Send, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ContactLocationMap } from "@/components/contact-location-map";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { StoreOrderSummary, StoreSmsTemplateKey } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import { CodeText, IdText, PhoneText } from "@/i18n/ltr-text";

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

const PAYMENT_STATUS_KEYS = {
  paid: "panelStoreOrderDetail.paymentStatus.paid",
  pending: "panelStoreOrderDetail.paymentStatus.pending",
  failed: "panelStoreOrderDetail.paymentStatus.failed",
  refunded: "panelStoreOrderDetail.paymentStatus.refunded",
  cancelled: "panelStoreOrderDetail.paymentStatus.cancelled",
} as const satisfies Record<string, MessageKey>;

const SMS_TEMPLATE_LABEL_KEYS = {
  afterOrder: "panelStoreOrderDetail.sms.afterOrder.label",
  afterApproval: "panelStoreOrderDetail.sms.afterApproval.label",
  afterShippingCode: "panelStoreOrderDetail.sms.afterShippingCode.label",
  afterRejection: "panelStoreOrderDetail.sms.afterRejection.label",
} as const satisfies Record<string, MessageKey>;

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

const SMS_ACTIONS: Array<{ key: StoreSmsTemplateKey; labelKey: MessageKey; descriptionKey: MessageKey }> = [
  { key: "afterOrder", labelKey: "panelStoreOrderDetail.sms.afterOrder.label", descriptionKey: "panelStoreOrderDetail.sms.afterOrder.description" },
  { key: "afterApproval", labelKey: "panelStoreOrderDetail.sms.afterApproval.label", descriptionKey: "panelStoreOrderDetail.sms.afterApproval.description" },
  { key: "afterShippingCode", labelKey: "panelStoreOrderDetail.sms.afterShippingCode.label", descriptionKey: "panelStoreOrderDetail.sms.afterShippingCode.description" },
  { key: "afterRejection", labelKey: "panelStoreOrderDetail.sms.afterRejection.label", descriptionKey: "panelStoreOrderDetail.sms.afterRejection.description" },
];

type EditableOrderItem = {
  id: string;
  title: string;
  subtitle: string;
  quantity: number;
  unitAmount: number;
  productId?: string | null;
};

function parseCoordinate(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = Number(value.trim());
    return Number.isFinite(normalized) ? normalized : null;
  }

  return null;
}

export default function PanelStoreOrderDetailPage() {
  const { isPrimaryAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const formatValue = useFormat();
  const { dir, isRtl } = useLocale();
  const [, params] = useRoute("/panel/store-settings/orders/:orderId");
  const orderId = params?.orderId ?? "";
  const requestIdRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [smsSendingKey, setSmsSendingKey] = useState<StoreSmsTemplateKey | null>(null);
  const [order, setOrder] = useState<StoreOrderSummary | null>(null);
  const [status, setStatus] = useState("");
  const [shippingMethod, setShippingMethod] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [comment, setComment] = useState("");
  const [shippingTrackingCode, setShippingTrackingCode] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [editableItems, setEditableItems] = useState<EditableOrderItem[]>([]);
  const statusLabel = (value: string) => {
    const key = STATUS_LABEL_KEYS[value as keyof typeof STATUS_LABEL_KEYS];
    return key ? t(key) : value;
  };
  const paymentMethodLabel = (value: string) => {
    const key = PAYMENT_LABEL_KEYS[value as keyof typeof PAYMENT_LABEL_KEYS];
    return key ? t(key) : value;
  };
  const shippingMethodLabel = (value: string) => {
    const key = SHIPPING_LABEL_KEYS[value as keyof typeof SHIPPING_LABEL_KEYS];
    return key ? t(key) : value;
  };
  const paymentStatusLabel = (value?: string | null) => {
    if (!value) return "-";
    const key = PAYMENT_STATUS_KEYS[value as keyof typeof PAYMENT_STATUS_KEYS];
    return key ? t(key) : value;
  };
  const smsTemplateLabel = (value?: string | null) => {
    if (!value) return t("panelStoreOrderDetail.sms.store");
    const key = SMS_TEMPLATE_LABEL_KEYS[value as keyof typeof SMS_TEMPLATE_LABEL_KEYS];
    return key ? t(key) : value;
  };
  const deliveryLatitude = parseCoordinate(order?.deliveryLatitude);
  const deliveryLongitude = parseCoordinate(order?.deliveryLongitude);
  const hasMap = deliveryLatitude !== null && deliveryLongitude !== null;
  const totalItemsPrice = useMemo(() => order?.items.reduce((sum, item) => sum + item.totalAmount, 0) ?? 0, [order]);
  const draftItemsPrice = useMemo(
    () => editableItems.reduce((sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitAmount), 0),
    [editableItems],
  );

  const loadOrder = async () => {
    if (!orderId) {
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const res = await api.store.getAdminOrder(orderId);
    if (requestId !== requestIdRef.current) {
      return;
    }
    setLoading(false);
    if (!res.success) {
      toast({ variant: "destructive", title: t("panelStoreOrderDetail.loadFailed"), description: res.message });
      return;
    }

    const nextOrder = res.data;
    setOrder(nextOrder);
    setStatus(nextOrder.status);
    setShippingMethod(nextOrder.shippingMethod);
    setAdminNote(nextOrder.adminNote || "");
    setComment("");
    setShippingTrackingCode(nextOrder.shippingTrackingCode || "");
    setShippingCarrier(nextOrder.shippingCarrier || "");
    setSendSms(true);
    setEditableItems(
      nextOrder.items.map((item) => ({
        id: item.id,
        title: item.title || "",
        subtitle: item.subtitle || "",
        quantity: item.quantity,
        unitAmount: item.unitAmount,
        productId: item.productId || null,
      })),
    );
  };

  useEffect(() => {
    document.title = t("panelStoreOrderDetail.documentTitle");
  }, [t]);

  useEffect(() => {
    if (authLoading || !isPrimaryAdmin || !orderId) {
      return;
    }
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isPrimaryAdmin, orderId]);

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
          <Link href="/panel"><Button>{t("panelStoreOrders.backToPanel")}</Button></Link>
        </div>
      </div>
    );
  }

  const saveChanges = async () => {
    if (!order) {
      return;
    }
    if (!editableItems.length) {
      toast({
        variant: "destructive",
        title: t("panelStoreOrderDetail.minimumItem.title"),
        description: t("panelStoreOrderDetail.minimumItem.description"),
      });
      return;
    }
    setSaving(true);
    const res = await api.store.updateAdminOrder(order.id, {
      status,
      shippingMethod,
      adminNote,
      comment: comment.trim() || undefined,
      shippingTrackingCode,
      shippingCarrier,
      items: editableItems.map((item) => ({
        id: item.id,
        title: item.title.trim(),
        subtitle: item.subtitle.trim(),
        quantity: Math.max(1, item.quantity),
        unitAmount: Math.max(0, item.unitAmount),
      })),
      sendSms,
    });
    setSaving(false);
    if (!res.success) {
      toast({ variant: "destructive", title: t("panelStoreOrderDetail.saveFailed"), description: res.message });
      return;
    }
    setOrder(res.data.order);
    setAdminNote(res.data.order.adminNote || "");
    setComment("");
    setShippingTrackingCode(res.data.order.shippingTrackingCode || "");
    setShippingCarrier(res.data.order.shippingCarrier || "");
    setStatus(res.data.order.status);
    setShippingMethod(res.data.order.shippingMethod);
    setEditableItems(
      res.data.order.items.map((item) => ({
        id: item.id,
        title: item.title || "",
        subtitle: item.subtitle || "",
        quantity: item.quantity,
        unitAmount: item.unitAmount,
        productId: item.productId || null,
      })),
    );
    toast({
      title: t("panelStoreOrderDetail.saved"),
      description: res.data.sms?.attempted
        ? (res.data.sms.sent
          ? t("panelStoreOrderDetail.savedWithSms")
          : t("panelStoreOrderDetail.savedWithoutSms", { message: res.data.sms.message }))
        : t("panelStoreOrderDetail.savedDescription"),
    });
  };

  const sendManualSms = async (templateKey: StoreSmsTemplateKey) => {
    if (!order) {
      return;
    }
    setSmsSendingKey(templateKey);
    const res = await api.store.sendAdminOrderSms(order.id, templateKey);
    setSmsSendingKey(null);
    if (!res.success) {
      toast({ variant: "destructive", title: t("panelStoreOrderDetail.smsSendFailed"), description: res.message });
      return;
    }
    setOrder(res.data.order);
    toast({
      title: t("panelStoreOrderDetail.smsQueued"),
      description: res.data.sms?.message || t("panelStoreOrderDetail.smsQueuedDescription"),
    });
  };

  const updateEditableItem = (itemId: string, key: keyof EditableOrderItem, value: string | number) => {
    setEditableItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        return {
          ...item,
          [key]: value,
        };
      }),
    );
  };

  const removeEditableItem = (itemId: string) => {
    setEditableItems((current) => current.filter((item) => item.id !== itemId));
  };

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_42%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("panelStoreOrders.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("panelStoreOrderDetail.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {order
                ? t("panelStoreOrders.orderNumber", { number: `\u2066${order.orderNumber}\u2069` })
                : t("panelStoreOrderDetail.loadingInfo")}
            </p>
          </div>
          <Link href="/panel/store-settings/orders">
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

        {loading || !order ? (
          <Card className="border-border/70 bg-card/60">
            <CardContent className="flex min-h-[320px] items-center justify-center text-muted-foreground">
              <Loader2 className="me-2 h-5 w-5 animate-spin" />
              {t("panelStoreOrderDetail.loading")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-6">
              <Card className="border-border/70 bg-card/60">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-lg font-black">
                        {t("panelStoreOrders.orderNumber", { number: `\u2066${order.orderNumber}\u2069` })}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                        <span>{order.customerName}</span>
                        <span aria-hidden="true">-</span>
                        <PhoneText>{order.customerPhone}</PhoneText>
                      </div>
                    </div>
                    <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      {order.statusLabel || statusLabel(order.status)}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[20px] border border-border/70 bg-background/35 p-4"><div className="text-xs text-muted-foreground">{t("panelStoreOrderDetail.stats.items")}</div><div className="mt-2 text-lg font-black">{formatValue.number(order.itemsCount)}</div></div>
                    <div className="rounded-[20px] border border-border/70 bg-background/35 p-4"><div className="text-xs text-muted-foreground">{t("panelStoreOrderDetail.stats.paymentMethod")}</div><div className="mt-2 text-lg font-black">{paymentMethodLabel(order.paymentMethod)}</div></div>
                    <div className="rounded-[20px] border border-border/70 bg-background/35 p-4"><div className="text-xs text-muted-foreground">{t("panelStoreOrderDetail.stats.shippingMethod")}</div><div className="mt-2 text-lg font-black">{shippingMethodLabel(order.shippingMethod)}</div></div>
                    <div className="rounded-[20px] border border-border/70 bg-background/35 p-4"><div className="text-xs text-muted-foreground">{t("panelStoreOrderDetail.stats.totalAmount")}</div><div className="mt-2 text-lg font-black text-primary">{formatValue.currency(order.totalAmount)}</div></div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[20px] border border-border/70 bg-background/35 p-4">
                      <div className="text-xs text-muted-foreground">{t("panelStoreOrderDetail.stats.paymentAmount")}</div>
                      <div className="mt-2 text-lg font-black">{formatValue.currency(order.payment?.amount || 0)}</div>
                    </div>
                    <div className="rounded-[20px] border border-border/70 bg-background/35 p-4">
                      <div className="text-xs text-muted-foreground">{t("panelStoreOrderDetail.stats.subtotalAmount")}</div>
                      <div className="mt-2 text-lg font-black">{formatValue.currency(order.subtotalAmount || totalItemsPrice)}</div>
                    </div>
                    <div className="rounded-[20px] border border-border/70 bg-background/35 p-4">
                      <div className="text-xs text-muted-foreground">{t("panelStoreOrderDetail.stats.paymentStatus")}</div>
                      <div className="mt-2 text-lg font-black">{paymentStatusLabel(order.payment?.status)}</div>
                    </div>
                    <div className="rounded-[20px] border border-border/70 bg-background/35 p-4">
                      <div className="text-xs text-muted-foreground">{t("panelStoreOrderDetail.stats.createdAt")}</div>
                      <div className="mt-2 text-sm font-black leading-7">{order.createdAt ? formatValue.dateTime(order.createdAt) : "-"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/60">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-primary">
                    <Package className="h-5 w-5" />
                    <div className="font-bold">{t("panelStoreOrderDetail.products.title")}</div>
                  </div>
                  <div className="space-y-3">
                    {editableItems.map((item, index) => (
                      <div key={item.id} className="rounded-[22px] border border-border/70 bg-background/35 p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-bold">{t("panelStoreOrderDetail.products.item", { number: formatValue.number(index + 1) })}</div>
                            {item.productId ? (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span>{t("panelStoreOrderDetail.products.productId")}</span>
                                <IdText>{item.productId}</IdText>
                              </div>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2 rounded-xl border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                            onClick={() => removeEditableItem(item.id)}
                            disabled={editableItems.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                            {t("panelStoreOrderDetail.products.remove")}
                          </Button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>{t("panelStoreOrderDetail.products.titleLabel")}</Label>
                            <Input value={item.title} onChange={(event) => updateEditableItem(item.id, "title", event.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("panelStoreOrderDetail.products.subtitle")}</Label>
                            <Input value={item.subtitle} onChange={(event) => updateEditableItem(item.id, "subtitle", event.target.value)} placeholder={t("panelStoreOrderDetail.products.optional")} />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("panelStoreOrderDetail.products.quantity")}</Label>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              className="text-start [direction:ltr]"
                              onChange={(event) => updateEditableItem(item.id, "quantity", Math.max(1, Number(event.target.value) || 1))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("panelStoreOrderDetail.products.unitAmount")}</Label>
                            <Input
                              type="number"
                              min={0}
                              value={item.unitAmount}
                              className="text-start [direction:ltr]"
                              onChange={(event) => updateEditableItem(item.id, "unitAmount", Math.max(0, Number(event.target.value) || 0))}
                            />
                          </div>
                        </div>

                        <div className="mt-4 rounded-[18px] border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                          {t("panelStoreOrderDetail.products.itemTotal", {
                            amount: formatValue.currency(Math.max(1, item.quantity) * Math.max(0, item.unitAmount)),
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-background/35 p-4 text-sm text-muted-foreground">
                    {t("panelStoreOrderDetail.products.itemsTotal", {
                      amount: formatValue.currency(draftItemsPrice || totalItemsPrice),
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/60">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-primary">
                    <MapPin className="h-5 w-5" />
                    <div className="font-bold">{t("panelStoreOrderDetail.shipping.title")}</div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-border/70 bg-background/35 p-4 text-sm leading-7 text-muted-foreground">
                      {t("panelStoreOrderDetail.shipping.addressTitle")} <span className="font-bold text-foreground">{order.deliveryTitle || "-"}</span><br />
                      {t("panelStoreOrderDetail.shipping.provinceCity")} <span className="font-bold text-foreground">{order.deliveryCityName || "-"}, {order.deliveryProvinceName || "-"}</span><br />
                      {t("panelStoreOrderDetail.shipping.fullAddress")} <span className="font-bold text-foreground">{order.deliveryAddress || t("panelStoreOrderDetail.valueMissing")}</span>
                    </div>
                    <div className="grid gap-3">
                      <div className="rounded-[20px] border border-border/70 bg-background/35 p-4 text-sm text-muted-foreground">
                        {t("panelStoreOrderDetail.shipping.cost")} <span className="font-bold text-foreground">{formatValue.currency(order.shippingAmount)}</span>
                      </div>
                      <div className="rounded-[20px] border border-border/70 bg-background/35 p-4 text-sm text-muted-foreground">
                        {t("panelStoreOrderDetail.shipping.trackingCode")}{" "}
                        {order.shippingTrackingCode
                          ? <CodeText className="font-bold text-foreground">{order.shippingTrackingCode}</CodeText>
                          : <span className="font-bold text-foreground">{t("panelStoreOrderDetail.valueMissing")}</span>}
                      </div>
                      <div className="rounded-[20px] border border-border/70 bg-background/35 p-4 text-sm text-muted-foreground">
                        {t("panelStoreOrderDetail.shipping.carrier")} <span className="font-bold text-foreground">{order.shippingCarrier || t("panelStoreOrderDetail.valueMissing")}</span>
                      </div>
                    </div>
                  </div>

                  {hasMap ? (
                    <ErrorBoundary fallback={<div className="flex h-[300px] items-center justify-center rounded-[1.75rem] border border-border/70 bg-card/40 text-sm text-muted-foreground">{t("panelStoreOrderDetail.shipping.mapError")}</div>}>
                      <ContactLocationMap
                        center={{ lat: deliveryLatitude!, lng: deliveryLongitude! }}
                        marker={{ lat: deliveryLatitude!, lng: deliveryLongitude! }}
                        interactive={false}
                      />
                    </ErrorBoundary>
                  ) : (
                    <div className="flex min-h-[160px] items-center justify-center rounded-[1.75rem] border border-dashed border-border/70 bg-background/25 px-4 text-center text-sm leading-7 text-muted-foreground">
                      {t("panelStoreOrderDetail.shipping.mapUnavailable")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6 xl:self-start">
              <div className="xl:sticky xl:top-6 xl:z-20">
                <Card className="overflow-hidden border-border/80 bg-background/95 shadow-2xl backdrop-blur-md">
                  <CardContent className="space-y-5 p-5 sm:p-6">
                    <div className="flex items-center gap-2 text-primary">
                      <ShoppingBag className="h-5 w-5" />
                      <div className="font-bold">{t("panelStoreOrderDetail.edit.title")}</div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t("panelStoreOrderDetail.edit.status")}</Label>
                        <Select value={status} onValueChange={setStatus}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("panelStoreOrderDetail.edit.shippingType")}</Label>
                        <Select value={shippingMethod} onValueChange={setShippingMethod}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(SHIPPING_LABEL_KEYS).map(([value, key]) => (
                              <SelectItem key={value} value={value}>{t(key)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t("panelStoreOrderDetail.edit.carrier")}</Label>
                        <Input value={shippingCarrier} onChange={(event) => setShippingCarrier(event.target.value)} placeholder={t("panelStoreOrderDetail.edit.carrierPlaceholder")} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("panelStoreOrderDetail.edit.trackingCode")}</Label>
                        <Input
                          value={shippingTrackingCode}
                          onChange={(event) => setShippingTrackingCode(event.target.value)}
                          placeholder={t("panelStoreOrderDetail.edit.trackingPlaceholder")}
                          className="text-start [direction:ltr]"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("panelStoreOrderDetail.edit.adminNote")}</Label>
                      <Textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} className="min-h-[110px] text-start" placeholder={t("panelStoreOrderDetail.edit.adminNotePlaceholder")} />
                    </div>

                    <div className="space-y-2">
                      <Label>{t("panelStoreOrderDetail.edit.newComment")}</Label>
                      <Textarea value={comment} onChange={(event) => setComment(event.target.value)} className="min-h-[100px] text-start" placeholder={t("panelStoreOrderDetail.edit.newCommentPlaceholder")} />
                    </div>

                    <div className="flex items-center gap-3 rounded-[20px] border border-border/70 bg-background/35 px-4 py-3">
                      <Switch checked={sendSms} onCheckedChange={setSendSms} />
                      <div className="text-sm text-muted-foreground">{t("panelStoreOrderDetail.edit.sendSms")}</div>
                    </div>

                    <Button className="w-full gap-2" onClick={saveChanges} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {t("panelStoreOrderDetail.edit.save")}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/70 bg-card/60">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-primary">
                    <Send className="h-5 w-5" />
                    <div className="font-bold">{t("panelStoreOrderDetail.sms.title")}</div>
                  </div>
                  <div className="grid gap-3">
                    {SMS_ACTIONS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => sendManualSms(item.key)}
                        disabled={smsSendingKey !== null}
                        className="flex items-center justify-between rounded-[20px] border border-border/70 bg-background/35 px-4 py-4 text-start transition hover:border-primary/30 disabled:opacity-60"
                      >
                        <div className="space-y-1">
                          <div className="font-bold">{t(item.labelKey)}</div>
                          <div className="text-sm text-muted-foreground">{t(item.descriptionKey)}</div>
                        </div>
                        {smsSendingKey === item.key ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Send className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/60">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                    <div className="font-bold">{t("panelStoreOrderDetail.history.title")}</div>
                  </div>
                  <div className="space-y-3">
                    {(order.statusHistory?.length ? [...order.statusHistory].reverse() : []).map((item, index) => (
                      <div key={`${item.at}-${index}`} className="rounded-[18px] border border-border/70 bg-background/35 p-4 text-sm leading-7 text-muted-foreground">
                        <div className="font-bold text-foreground">
                          {item.from ? `${statusLabel(item.from)} ${isRtl ? "←" : "→"} ` : ""}
                          {statusLabel(item.to || "")}
                        </div>
                        <div>{item.actorName || "-"}</div>
                        <div>{item.at ? formatValue.dateTime(item.at) : "-"}</div>
                        {item.note ? <div>{item.note}</div> : null}
                      </div>
                    ))}
                    {!order.statusHistory?.length ? <div className="text-sm text-muted-foreground">{t("panelStoreOrderDetail.history.empty")}</div> : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/60">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-primary">
                    <MessageSquareText className="h-5 w-5" />
                    <div className="font-bold">{t("panelStoreOrderDetail.logs.title")}</div>
                  </div>
                  <div className="space-y-3">
                    {(order.adminComments?.length ? [...order.adminComments].reverse() : []).map((item, index) => (
                      <div key={`${item.at}-${index}`} className="rounded-[18px] border border-border/70 bg-background/35 p-4 text-sm leading-7 text-muted-foreground">
                        <div className="font-bold text-foreground">{item.actorName || t("panelStoreOrderDetail.logs.defaultAdmin")}</div>
                        <div>{item.at ? formatValue.dateTime(item.at) : "-"}</div>
                        <div>{item.body || "-"}</div>
                      </div>
                    ))}
                    {!order.adminComments?.length ? <div className="text-sm text-muted-foreground">{t("panelStoreOrderDetail.logs.emptyComments")}</div> : null}
                  </div>

                  <div className="space-y-3 border-t border-border/70 pt-5">
                    {(order.smsLog?.length ? [...order.smsLog].reverse() : []).map((item, index) => (
                      <div key={`${item.at}-${index}`} className="rounded-[18px] border border-border/70 bg-background/35 p-4 text-sm leading-7 text-muted-foreground">
                        <div className="font-bold text-foreground">{smsTemplateLabel(item.template || item.status)}</div>
                        <div>{item.actorName || "-"}</div>
                        <div>{item.at ? formatValue.dateTime(item.at) : "-"}</div>
                        <div className={item.ok ? "text-emerald-300" : "text-amber-300"}>{item.message || "-"}</div>
                      </div>
                    ))}
                    {!order.smsLog?.length ? <div className="text-sm text-muted-foreground">{t("panelStoreOrderDetail.logs.emptySms")}</div> : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
