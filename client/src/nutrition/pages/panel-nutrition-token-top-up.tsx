import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { PaymentProvider } from "@/lib/types";
import { PAYMENT_GATEWAYS, PAYMENT_GATEWAY_MAP } from "@/lib/payment-gateways";
import { normalizeDigits } from "@/lib/normalize";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const QUICK_AMOUNTS = [25000, 50000, 125000, 250000];

function getAmountValue(customAmount: string, selectedPreset: number | null) {
  if (selectedPreset) {
    return selectedPreset;
  }

  const normalized = normalizeDigits(customAmount).replace(/\D/g, "");
  return normalized ? Number(normalized) : 0;
}

export default function PanelNutritionTokenTopUpPage() {
  const { isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(QUICK_AMOUNTS[2]);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedGateway, setSelectedGateway] = useState<PaymentProvider | "">("");
  const [currentTokens, setCurrentTokens] = useState(0);
  const [unitPriceToman, setUnitPriceToman] = useState(1);
  const [customSelected, setCustomSelected] = useState(false);
  const [maliartEnabled, setMaliartEnabled] = useState(false);
  const paySectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.nutritionTokens.dashboard().then((result) => {
      if (result.success) {
        setCurrentTokens(result.data.stats.currentTokens);
        setUnitPriceToman(Math.max(1, result.data.stats.tokenUnitPriceToman || 1));
        setMaliartEnabled(result.data.paymentSettings?.maliartEnabled === true);
      }
      setSelectedGateway(result.success && result.data.paymentSettings?.maliartEnabled ? "" : PAYMENT_GATEWAYS[0].key);
      setLoading(false);
    });
  }, []);

  const finalAmount = useMemo(() => getAmountValue(customAmount, selectedPreset), [customAmount, selectedPreset]);
  const payableAmount = useMemo(() => finalAmount * unitPriceToman, [finalAmount, unitPriceToman]);

  const scrollToPaySection = () => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 768px)").matches) {
      return;
    }

    window.setTimeout(() => {
      paySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
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
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  };

  const handlePay = async () => {
    if (!finalAmount || finalAmount < 10000) {
      toast({ variant: "destructive", title: t("panelNutritionTokenTopUp.toast.invalidAmount"), description: t("panelNutritionTokenTopUp.toast.invalidAmountDescription", { count: format.number(10000) }) });
      return;
    }

    if (payableAmount < 100000) {
      toast({ variant: "destructive", title: t("panelNutritionTokenTopUp.toast.payableTooLow"), description: t("panelNutritionTokenTopUp.toast.payableTooLowDescription", { amount: format.currency(100000) }) });
      return;
    }

    if (!maliartEnabled && !selectedGateway) {
      toast({ variant: "destructive", title: t("panelNutritionTokenTopUp.toast.gatewayRequired"), description: t("panelNutritionTokenTopUp.toast.gatewayRequiredDescription") });
      return;
    }

    setPaying(true);
    const res = await api.nutritionTokens.pay(finalAmount, maliartEnabled ? undefined : selectedGateway);
    setPaying(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("panelNutritionTokenTopUp.toast.paymentFailed"), description: res.message });
      return;
    }

    if (res.data.mode === "sandbox") {
      const params = new URLSearchParams({
        status: "success",
        amount: String(res.data.payment.payableAmount ?? payableAmount),
        purchasedTokens: String(res.data.payment.tokensAmount ?? finalAmount),
        unitPriceToman: String(res.data.payment.unitPriceToman ?? unitPriceToman),
        tokens: String(res.data.currentTokens ?? currentTokens),
        reference: res.data.payment.referenceId ?? "—",
        paymentId: res.data.payment.invoiceNumber,
        paidAt: res.data.payment.paidAt ?? new Date().toISOString(),
        bank: maliartEnabled ? t("payment.directGateway") : (selectedGateway ? t(PAYMENT_GATEWAY_MAP[selectedGateway].labelKey) : "—"),
      });

      window.location.assign(`/panel/nutrition/tokens/top-up/result?${params.toString()}`);
      return;
    }

    if (res.data.redirectForm) {
      submitGatewayForm(res.data.redirectForm);
      return;
    }

    if (res.data.paymentUrl) {
      window.location.assign(res.data.paymentUrl);
      return;
    }

    toast({ variant: "destructive", title: t("common.error"), description: t("panelNutritionTokenTopUp.toast.paymentFailed") });
  };

  if (!isPrimaryAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.16),_transparent_42%),linear-gradient(180deg,rgba(10,36,38,0.96),rgba(15,23,42,0))]" />

      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black">{t("panelNutritionTokenTopUp.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelNutritionTokenTopUp.description")}</p>
          </div>
          <Link href="/panel/nutrition/tokens">
            <Button variant="outline" size="icon" title={t("panelNutritionTokenTopUp.back")} className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              {isRtl ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-5 px-4 py-6">
        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-[30px] border border-border/70 bg-card/50 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelNutritionTokenTopUp.loading")}
          </div>
        ) : (
          <Card className="border-border/70 bg-card/60">
            <CardContent className="space-y-6 p-5 sm:p-6">
              <div className="rounded-[26px] border border-teal-500/20 bg-teal-500/10 p-4">
                <div className="text-sm text-muted-foreground">{t("panelNutritionTokenTopUp.currentBalance")}</div>
                <div className="mt-2 text-3xl font-black text-teal-100">{t("panelNutritionTokenTopUp.tokensCount", { count: format.number(currentTokens) })}</div>
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-black">{t("panelNutritionTokenTopUp.quickPackages")}</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {QUICK_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(amount);
                        setCustomSelected(false);
                        setCustomAmount("");
                        scrollToPaySection();
                      }}
                      className={`rounded-[24px] border px-4 py-5 text-start transition ${selectedPreset === amount ? "border-teal-500 bg-teal-500/10 text-teal-400" : "border-border/70 bg-background/40 hover:border-teal-500/30"}`}
                    >
                      <div className="text-sm text-muted-foreground">{t("panelNutritionTokenTopUp.quickBuy")}</div>
                      <div className="mt-2 text-xl font-black">{t("panelNutritionTokenTopUp.tokensCount", { count: format.number(amount) })}</div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPreset(null);
                      setCustomSelected(true);
                      scrollToPaySection();
                    }}
                    className={`rounded-[24px] border px-4 py-5 text-start transition ${customSelected ? "border-teal-500 bg-teal-500/10 text-teal-400" : "border-border/70 bg-background/40 hover:border-teal-500/30"}`}
                  >
                    <div className="text-sm text-muted-foreground">{t("panelNutritionTokenTopUp.customSelect")}</div>
                    <div className="mt-2 text-xl font-black">{t("panelNutritionTokenTopUp.customTokens")}</div>
                  </button>
                </div>
              </div>

              {customSelected ? (
                <div className="space-y-2">
                  <Label htmlFor="custom-token-amount">{t("panelNutritionTokenTopUp.customAmountLabel")}</Label>
                  <Input
                    id="custom-token-amount"
                    inputMode="numeric"
                    value={customAmount}
                    onChange={(event) => {
                      setSelectedPreset(null);
                      setCustomAmount(event.target.value);
                    }}
                    placeholder={t("panelNutritionTokenTopUp.customAmountPlaceholder")}
                    className="h-12 rounded-[18px] border-border bg-background/45"
                  />
                </div>
              ) : null}

              <div ref={paySectionRef} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("panelNutritionTokenTopUp.gatewayLabel")}</Label>
                  {maliartEnabled ? (
                    <div className="flex h-12 items-center rounded-[18px] border border-primary/25 bg-primary/10 px-4 font-bold text-primary">
                      {t("payment.directGateway")}
                    </div>
                  ) : (
                    <Select value={selectedGateway || undefined} onValueChange={(value) => setSelectedGateway(value as PaymentProvider)}>
                      <SelectTrigger className="h-12 rounded-[18px] border-border bg-background/45 text-start">
                        <SelectValue placeholder={t("panelNutritionTokenTopUp.gatewayPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent dir={dir}>
                        {PAYMENT_GATEWAYS.map((gateway) => (
                          <SelectItem key={gateway.key} value={gateway.key}>
                            {t(gateway.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("panelNutritionTokenTopUp.payableAmount")}</Label>
                  <div className="flex h-12 items-center rounded-[18px] border border-teal-500/20 bg-teal-500/10 px-4 text-lg font-black text-teal-100">
                    {format.currency(payableAmount)}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-dashed border-teal-500/20 bg-background/40 p-4 text-sm leading-8 text-muted-foreground">
                {t("panelNutritionTokenTopUp.selectedCount")} <span className="font-black text-foreground">{t("panelNutritionTokenTopUp.tokensCount", { count: format.number(finalAmount) })}</span>
                <span className="mx-2 text-border">|</span>
                {t("panelNutritionTokenTopUp.unitPrice")} <span className="font-black text-foreground">{format.currency(unitPriceToman)}</span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Link href="/panel/nutrition/tokens">
                  <Button variant="outline" className="rounded-[20px] border-border bg-background/40 px-6">{t("panelNutritionTokenTopUp.back")}</Button>
                </Link>
                <Button onClick={handlePay} disabled={paying} className="rounded-[20px] bg-teal-600 px-6 hover:bg-teal-500">
                  {paying ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <CreditCard className="me-2 h-4 w-4" />}
                  {t("panelNutritionTokenTopUp.pay")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
