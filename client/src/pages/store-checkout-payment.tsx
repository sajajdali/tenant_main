import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Landmark, ShieldCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import { api } from "@/lib/api";
import type { PaymentProvider, PaymentSettings } from "@/lib/types";
import type { StoreCheckoutDraft } from "@/lib/store-checkout-draft";
import { clearStoreCheckoutDraft, getStoreCheckoutDraft } from "@/lib/store-checkout-draft";
import { clearStoreCart } from "@/lib/store-cart";
import { useToast } from "@/hooks/use-toast";

type PaymentMethod = "online" | "card";

const GATEWAY_LABEL_KEYS: Partial<Record<PaymentProvider, MessageKey>> = {
  asanpardakht: "storeCheckoutPayment.gateway.asanpardakht",
  digipay: "storeCheckoutPayment.gateway.digipay",
  parsian: "storeCheckoutPayment.gateway.parsian",
  pasargad: "storeCheckoutPayment.gateway.pasargad",
  saman: "storeCheckoutPayment.gateway.saman",
  zarinpal: "storeCheckoutPayment.gateway.zarinpal",
  zibal: "storeCheckoutPayment.gateway.zibal",
};

function parseTomansLabel(value: string) {
  const normalized = value
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06F0))
    .replace(/[^\d]/g, "");
  return Math.max(0, Number(normalized) || 0);
}

export default function StoreCheckoutPaymentPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const format = useFormat();
  const [draftReady, setDraftReady] = useState(false);
  const [draft, setDraft] = useState<StoreCheckoutDraft | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<PaymentProvider | "">("");
  const [transferTime, setTransferTime] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const enabledGateways = paymentSettings?.enabledGateways ?? [];
  const previewGateways: PaymentProvider[] = enabledGateways.length
    ? (enabledGateways as PaymentProvider[])
    : ["zarinpal", "zibal"];
  const tenantMaliartEnabled = paymentSettings?.tenantMaliartEnabled === true;
  const isFreeCheckout = (draft?.summary.total ?? 0) <= 0;
  const onlineAvailable = true;
  const cardAvailable = !tenantMaliartEnabled;
  const cardNote = paymentSettings?.managementPanelNote?.trim() || "";
  const canSubmitOnline = selectedMethod === "online" && (tenantMaliartEnabled || !!selectedGateway);
  const canSubmitCard = selectedMethod === "card" && !!transferTime.trim() && !!trackingNumber.trim();
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const ContinueIcon = isRtl ? ChevronLeft : ChevronRight;

  useEffect(() => {
    document.title = t("storeCheckoutPayment.documentTitle");

    let cancelled = false;
    const syncDraft = () => {
      if (cancelled) {
        return;
      }

      const nextDraft = getStoreCheckoutDraft();
      setDraft(nextDraft);
      setDraftReady(true);
    };

    syncDraft();
    const timer = window.setTimeout(syncDraft, 60);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [t]);

  useEffect(() => {
    api.payment.getSettings().then((res) => {
      if (res.success) {
        setPaymentSettings(res.data);
        if (res.data.tenantMaliartEnabled) {
          setSelectedMethod("online");
          setSelectedGateway("");
          return;
        }
        const nextGateways = res.data.enabledGateways?.length ? res.data.enabledGateways : previewGateways;
        setSelectedGateway((res.data.provider as PaymentProvider | null) || (nextGateways[0] as PaymentProvider | undefined) || "");
      }
    });
  }, []);

  const redirectToResult = (params: Record<string, string | null | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        search.set(key, value);
      }
    });
    setLocation(`/store/checkout/result?${search.toString()}`);
  };

  const submitGatewayForm = (redirectForm: { action: string; method: string; inputs: Record<string, string> }) => {
    const form = document.createElement("form");
    form.action = redirectForm.action;
    form.method = (redirectForm.method || "POST").toUpperCase();
    form.style.display = "none";

    Object.entries(redirectForm.inputs || {}).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  };

  const handleContinue = async () => {
    if (!isFreeCheckout && !selectedMethod) {
      toast({
        variant: "destructive",
        title: t("storeCheckoutPayment.toast.methodRequiredTitle"),
        description: t("storeCheckoutPayment.toast.methodRequiredDescription"),
      });
      return;
    }

    if (!draft) {
      toast({
        variant: "destructive",
        title: t("storeCheckoutPayment.toast.draftMissingTitle"),
        description: t("storeCheckoutPayment.toast.draftMissingDescription"),
      });
      setLocation("/store/checkout");
      return;
    }

    if (!isFreeCheckout && selectedMethod === "online") {
      if (!tenantMaliartEnabled && !selectedGateway) {
        toast({
          variant: "destructive",
          title: t("storeCheckoutPayment.toast.gatewayRequiredTitle"),
          description: t("storeCheckoutPayment.toast.gatewayRequiredDescription"),
        });
        return;
      }
    }

    if (!isFreeCheckout && selectedMethod === "card" && (!transferTime.trim() || !trackingNumber.trim())) {
      toast({
        variant: "destructive",
        title: t("storeCheckoutPayment.toast.cardInfoRequiredTitle"),
        description: t("storeCheckoutPayment.toast.cardInfoRequiredDescription"),
      });
      return;
    }

    setSubmitting(true);
    const payload = {
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      shippingMethod: draft.shippingMethod,
      paymentMethod: isFreeCheckout ? "online" : selectedMethod!,
      gateway: !isFreeCheckout && selectedMethod === "online" && selectedGateway ? selectedGateway : undefined,
      notes: !isFreeCheckout && selectedMethod === "card"
        ? t("storeCheckoutPayment.cardPayloadNote", { time: transferTime.trim(), tracking: trackingNumber.trim() })
        : draft.notes,
      address: draft.address,
      items: draft.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        title: item.title,
        subtitle: item.subtitle,
        imageLabel: item.imageLabel,
        unitAmount: Math.max(1, item.unitAmount ?? parseTomansLabel(item.price)),
        quantity: item.quantity,
      })),
    } as const;

    const checkoutRes = await api.store.checkout(payload);
    setSubmitting(false);

    if (!checkoutRes.success) {
      toast({
        variant: "destructive",
        title: t("storeCheckoutPayment.toast.checkoutFailedTitle"),
        description: checkoutRes.message || t("storeCheckoutPayment.toast.checkoutFailedDescription"),
      });
      return;
    }

    const result = checkoutRes.data;
    const orderId = result.order.id;
    const orderNumber = result.order.orderNumber;
    const tracking = result.payment.referenceId || result.payment.invoiceNumber || "";
    const method = result.order.paymentMethod;

    clearStoreCart();
    clearStoreCheckoutDraft();

    if (result.mode === "sandbox" || result.mode === "free") {
      redirectToResult({
        status: "success",
        method,
        order: orderNumber,
        oid: orderId,
        tracking,
        message: result.mode === "free"
          ? t("storeCheckoutPayment.free.successMessage")
          : t("storeCheckoutPayment.sandboxSuccessMessage"),
      });
      return;
    }

    if (result.mode === "card") {
      redirectToResult({
        status: "card_pending",
        method: "card",
        order: orderNumber,
        oid: orderId,
        tracking,
        note: result.cardNote || result.payment.cardNote || undefined,
      });
      return;
    }

    if (result.mode === "cod") {
      redirectToResult({
        status: "cod",
        method: "cod",
        order: orderNumber,
        oid: orderId,
        tracking,
      });
      return;
    }

    if (result.mode === "gateway" && result.redirectForm) {
      submitGatewayForm(result.redirectForm);
      return;
    }

    if (result.mode === "gateway" && result.paymentUrl) {
      window.location.assign(result.paymentUrl);
      return;
    }

    toast({
      variant: "destructive",
      title: t("storeCheckoutPayment.toast.gatewayConnectionFailedTitle"),
      description: t("storeCheckoutPayment.toast.gatewayConnectionFailedDescription"),
    });
  };

  if (!draftReady) {
    return null;
  }

  if (!draft || draft.items.length === 0) {
    return (
      <div className="store-page min-h-screen bg-background text-foreground" dir={dir}>
        <div className="container mx-auto max-w-3xl px-4 py-10">
          <Card className="border-border/70 bg-card/60">
            <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-5 p-6 text-center">
              <div className="space-y-2">
                <h1 className="text-2xl font-black">{t("storeCheckoutPayment.missing.title")}</h1>
                <p className="text-sm leading-7 text-muted-foreground">
                  {t("storeCheckoutPayment.missing.description")}
                </p>
              </div>

              <Link href="/store/checkout">
                <Button className="rounded-[20px] px-6">
                  {t("storeCheckoutPayment.backToCheckout")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="store-page min-h-screen bg-background pb-16 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_45%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="border-b border-border/70 bg-card/40 backdrop-blur-md">
        <div className="container mx-auto max-w-6xl px-4 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm text-primary">{t("storeCheckoutPayment.eyebrow")}</div>
              <h1 className="text-2xl font-black">{t("storeCheckoutPayment.title")}</h1>
            </div>

            <button
              type="button"
              onClick={() => setLocation("/store/checkout")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/40 transition-colors hover:border-primary/30"
              aria-label={t("storeCheckoutPayment.backToCheckout")}
            >
              <BackIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="border-border/70 bg-card/60">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-black">{t("storeCheckoutPayment.methods.title")}</h2>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {t("storeCheckoutPayment.methods.description")}
                  </p>
                </div>

                {isFreeCheckout ? (
                  <div className="rounded-[28px] border border-emerald-400/30 bg-emerald-400/10 p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-400">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-lg font-black text-emerald-300">{t("storeCheckoutPayment.free.title")}</div>
                        <div className="mt-2 text-sm leading-7 text-muted-foreground">{t("storeCheckoutPayment.free.description")}</div>
                      </div>
                    </div>
                    <Button className="mt-5 h-12 w-full rounded-[18px] bg-emerald-500 font-black text-white hover:bg-emerald-600" onClick={handleContinue} disabled={submitting}>
                      {submitting ? t("storeCheckoutPayment.free.submitting") : t("storeCheckoutPayment.free.submit")}
                      <ContinueIcon className="ms-2 h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                <div className="space-y-4">
                    {onlineAvailable ? (
                      <div className={`rounded-[28px] border p-5 transition-all ${selectedMethod === "online" ? "border-primary bg-primary/10 shadow-[0_20px_60px_-35px_rgba(245,158,11,0.45)]" : "border-border/70 bg-background/35 hover:border-primary/30"}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedMethod("online")}
                          className="w-full text-start"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                                  <Landmark className="h-6 w-6" />
                                </div>
                                <div className="text-lg font-black">{t("storeCheckoutPayment.online.title")}</div>
                              </div>
                              <div className="text-sm leading-7 text-muted-foreground">
                                {t("storeCheckoutPayment.online.description")}
                              </div>
                            </div>
                            {selectedMethod === "online" ? <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" /> : null}
                          </div>
                        </button>

                        {selectedMethod === "online" ? (
                          <div className="mt-5 space-y-4 border-t border-border/60 pt-5">
                            <div className="space-y-2">
                              <Label>{t("storeCheckoutPayment.online.gatewayLabel")}</Label>
                              {tenantMaliartEnabled ? (
                                <div className="flex h-12 items-center rounded-[18px] border border-primary/25 bg-primary/10 px-4 font-bold text-primary">
                                  {t("payment.directGateway")}
                                </div>
                              ) : <Select value={selectedGateway} onValueChange={(value) => setSelectedGateway(value as PaymentProvider)}>
                                <SelectTrigger className="h-12 rounded-[18px] border-border bg-background/45 text-start">
                                  <SelectValue placeholder={t("storeCheckoutPayment.online.gatewayPlaceholder")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {previewGateways.map((gateway) => (
                                    <SelectItem key={gateway} value={gateway}>
                                      {GATEWAY_LABEL_KEYS[gateway] ? t(GATEWAY_LABEL_KEYS[gateway]) : gateway}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>}
                            </div>

                            <div className="rounded-[22px] border border-border/70 bg-background/45 p-4 text-sm leading-8 text-muted-foreground">
                              {t("storeCheckoutPayment.online.gatewayHint")}
                            </div>

                            <div className="flex justify-end">
                              <Button className="rounded-[18px] px-6" onClick={handleContinue} disabled={!canSubmitOnline || submitting}>
                                {t("storeCheckoutPayment.online.payButton")}
                                <ContinueIcon className="ms-2 h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {cardAvailable ? (
                      <div className={`rounded-[28px] border p-5 transition-all ${selectedMethod === "card" ? "border-primary bg-primary/10 shadow-[0_20px_60px_-35px_rgba(245,158,11,0.45)]" : "border-border/70 bg-background/35 hover:border-primary/30"}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedMethod("card")}
                          className="w-full text-start"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                                  <CreditCard className="h-6 w-6" />
                                </div>
                                <div className="text-lg font-black">{t("storeCheckoutPayment.card.title")}</div>
                              </div>
                              <div className="text-sm leading-7 text-muted-foreground">
                                {t("storeCheckoutPayment.card.description")}
                              </div>
                            </div>
                            {selectedMethod === "card" ? <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" /> : null}
                          </div>
                        </button>

                        {selectedMethod === "card" ? (
                          <div className="mt-5 space-y-4 border-t border-border/60 pt-5">
                            <div className="whitespace-pre-line rounded-[22px] border border-border/70 bg-background/45 p-4 text-sm leading-8 text-muted-foreground">
                              {cardNote || t("storeCheckoutPayment.card.defaultNote")}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="transfer-time">{t("storeCheckoutPayment.card.transferTimeLabel")}</Label>
                                <Input
                                  id="transfer-time"
                                  value={transferTime}
                                  onChange={(event) => setTransferTime(event.target.value)}
                                  placeholder={t("storeCheckoutPayment.card.transferTimePlaceholder")}
                                  className="h-12 rounded-[18px] border-border bg-background/45 text-start [direction:ltr]"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="tracking-number">{t("storeCheckoutPayment.card.trackingLabel")}</Label>
                                <Input
                                  id="tracking-number"
                                  value={trackingNumber}
                                  onChange={(event) => setTrackingNumber(event.target.value)}
                                  placeholder={t("storeCheckoutPayment.card.trackingPlaceholder")}
                                  className="h-12 rounded-[18px] border-border bg-background/45 text-start [direction:ltr]"
                                />
                              </div>
                            </div>

                            <div className="rounded-[22px] border border-dashed border-primary/30 bg-background/35 p-4 text-sm leading-8 text-muted-foreground">
                              {t("storeCheckoutPayment.card.finalHintBefore")}
                              <span className="mx-1 font-bold text-foreground">{t("storeCheckoutPayment.card.finalButton")}</span>
                              {t("storeCheckoutPayment.card.finalHintAfter")}
                            </div>

                            <div className="flex justify-end">
                              <Button className="rounded-[18px] px-6" onClick={handleContinue} disabled={!canSubmitCard || submitting}>
                                {t("storeCheckoutPayment.card.finalButton")}
                                <ContinueIcon className="ms-2 h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-[18px] border-border bg-background/40"
                    onClick={() => setLocation("/store/checkout")}
                  >
                    {t("storeCheckoutPayment.backToDetails")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="border-border/70 bg-card/60 xl:sticky xl:top-6">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex items-center gap-2 text-primary">
                  <ShoppingBag className="h-5 w-5" />
                  <div className="font-bold">{t("storeCheckoutPayment.summary.title")}</div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-[20px] border border-border/70 bg-background/35 px-4 py-3">
                    <span className="text-sm text-muted-foreground">{t("storeCheckoutPayment.summary.itemsCountLabel")}</span>
                    <span className="font-bold">{t("storeCheckoutPayment.summary.itemsCount", { count: format.number(draft.summary.itemsCount) })}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-[20px] border border-border/70 bg-background/35 px-4 py-3">
                    <span className="text-sm text-muted-foreground">{t("storeCheckoutPayment.summary.subtotal")}</span>
                    <span className="font-bold">{format.currency(draft.summary.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-[20px] border border-border/70 bg-background/35 px-4 py-3">
                    <span className="text-sm text-muted-foreground">{t("storeCheckoutPayment.summary.shipping")}</span>
                    <span className="font-bold">{draft.summary.shipping > 0 ? format.currency(draft.summary.shipping) : t("storeCheckoutPayment.summary.free")}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-[20px] border border-border/70 bg-background/35 px-4 py-3">
                    <span className="text-sm text-muted-foreground">{t("storeCheckoutPayment.summary.total")}</span>
                    <span className="font-black text-primary">{format.currency(draft.summary.total)}</span>
                  </div>
                </div>

                <div className="rounded-[24px] border border-primary/20 bg-primary/8 p-4 text-sm leading-7 text-muted-foreground">
                  <div className="mb-2 font-bold text-foreground">{t("storeCheckoutPayment.summary.recipient")}</div>
                  <div>{draft.customerName || t("storeCheckoutPayment.summary.notSet")}</div>
                  <PhoneText>{draft.customerPhone || t("storeCheckoutPayment.summary.valueMissing")}</PhoneText>
                </div>

                {draft.address ? (
                  <div className="rounded-[24px] border border-border/70 bg-background/35 p-4 text-sm leading-7 text-muted-foreground">
                    <div className="mb-2 font-bold text-foreground">{draft.address.title || t("storeCheckoutPayment.summary.deliveryAddress")}</div>
                    <div>{t("storeCheckoutPayment.summary.cityProvince", { city: draft.address.cityName || "", province: draft.address.provinceName || "" })}</div>
                    <div>{draft.address.address}</div>
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-border/70 bg-background/35 p-4 text-sm leading-7 text-muted-foreground">
                    {t("storeCheckoutPayment.summary.pickupNoticeBefore")} <span className="font-bold text-foreground">{t("storeCheckoutPayment.shipping.pickup")}</span> {t("storeCheckoutPayment.summary.pickupNoticeAfter")}
                  </div>
                )}

                <div className="rounded-[24px] border border-border/70 bg-background/35 p-4 text-sm leading-7 text-muted-foreground">
                  <div className="mb-2 flex items-center gap-2 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                    {t("storeCheckoutPayment.summary.currentStatus")}
                  </div>
                  {t("storeCheckoutPayment.summary.currentStatusDescription")}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
