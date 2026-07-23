import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, CreditCard, Loader2, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { PaymentProvider, PaymentSettings } from "@/lib/types";
import { PAYMENT_GATEWAYS, PAYMENT_GATEWAY_MAP } from "@/lib/payment-gateways";
import { normalizeDigits } from "@/lib/normalize";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const QUICK_AMOUNTS = [150000, 100000, 500000, 1000000];

function getAmountValue(customAmount: string, selectedPreset: number | null) {
  if (selectedPreset) {
    return selectedPreset;
  }

  const normalized = normalizeDigits(customAmount).replace(/\D/g, "");
  return normalized ? Number(normalized) : 0;
}

export default function PanelSmsTopUpPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const { isPrimaryAdmin, isAdmin } = useAuth();
  const { toast } = useToast();
  const tenantMeta = getInitialTenantMeta();
  const labels = getAudienceLabels(tenantMeta);
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(QUICK_AMOUNTS[0]);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedGateway, setSelectedGateway] = useState<PaymentProvider | "">("");
  const [customSelected, setCustomSelected] = useState(false);
  const paySectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.payment.getSettings().then((res) => {
      if (res.success) {
        setSettings(res.data);
        if (res.data.maliartEnabled) {
          setSelectedGateway("");
        } else {
          const firstGateway = (res.data.enabledGateways?.[0] as PaymentProvider | undefined) ?? PAYMENT_GATEWAYS[0].key;
          setSelectedGateway(firstGateway);
        }
      }
      setLoading(false);
    });
  }, []);

  const availableGateways = useMemo(() => {
    if (settings?.enabledGateways?.length) {
      return settings.enabledGateways as PaymentProvider[];
    }

    return PAYMENT_GATEWAYS.map((item) => item.key);
  }, [settings?.enabledGateways]);

  const finalAmount = getAmountValue(customAmount, selectedPreset);
  const maliartEnabled = settings?.maliartEnabled === true;
  const currentBalance = settings?.smsStats?.creditBalance ?? 0;
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const scrollToPaySection = () => {
    if (typeof window === "undefined") {
      return;
    }

    if (!window.matchMedia("(max-width: 768px)").matches) {
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
    if (!settings) {
      return;
    }

    if (!finalAmount || finalAmount < 10000) {
      toast({
        variant: "destructive",
        title: t("panelSmsTopUp.toast.invalidAmount.title"),
        description: t("panelSmsTopUp.toast.invalidAmount.description", { amount: format.currency(10000) }),
      });
      return;
    }

    if (!maliartEnabled && !selectedGateway) {
      toast({
        variant: "destructive",
        title: t("panelSmsTopUp.toast.gatewayRequired.title"),
        description: t("panelSmsTopUp.toast.gatewayRequired.description"),
      });
      return;
    }

    setPaying(true);
    const res = await api.smsTopUp.pay(finalAmount, maliartEnabled ? undefined : selectedGateway);

    setPaying(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("panelSmsTopUp.toast.failed.title"),
        description: res.message || t("panelSmsTopUp.toast.failed.description"),
      });
      return;
    }

    if (res.data.mode === "sandbox") {
      const params = new URLSearchParams({
        status: "success",
        amount: String(finalAmount),
        balance: String(res.data.currentBalance ?? currentBalance),
        reference: res.data.payment.referenceId ?? "—",
        paymentId: res.data.payment.invoiceNumber,
        paidAt: res.data.payment.paidAt ?? new Date().toISOString(),
        bank: selectedGateway ? t(PAYMENT_GATEWAY_MAP[selectedGateway].labelKey) : "—",
      });

      window.location.assign(`/panel/sms-settings/top-up/result?${params.toString()}`);
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

    toast({
      variant: "destructive",
      title: t("panelSmsTopUp.toast.redirectMissing.title"),
      description: t("panelSmsTopUp.toast.redirectMissing.description"),
    });
  };

  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <WalletCards className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelSmsTopUp.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelSmsTopUp.accessDenied.description")}</p>
          <Link href="/panel/sms-settings">
            <Button>{t("common.back")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_42%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black">{t("panelSmsTopUp.title")}</h1>
          </div>

          <Link href="/panel/sms-settings">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <BackIcon className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-5 px-4 py-6">
        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-[30px] border border-border/70 bg-card/50 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelSmsTopUp.loading")}
          </div>
        ) : (
          <>
            <Card className="border-border/70 bg-card/60">
              <CardContent className="space-y-6 p-5 sm:p-6">
                <div className="space-y-3">
                  <h2 className="text-lg font-black">{t("panelSmsTopUp.quickAmounts.title")}</h2>
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
                        className={`rounded-[24px] border px-4 py-5 text-start transition ${selectedPreset === amount ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background/40 hover:border-primary/30"}`}
                      >
                        <div className="text-sm text-muted-foreground">{t("panelSmsTopUp.quickAmounts.quickCharge")}</div>
                        <div className="mt-2 text-xl font-black">{format.currency(amount)}</div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPreset(null);
                        setCustomSelected(true);
                        scrollToPaySection();
                      }}
                      className={`rounded-[24px] border px-4 py-5 text-start transition ${customSelected ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background/40 hover:border-primary/30"}`}
                    >
                      <div className="text-sm text-muted-foreground">{t("panelSmsTopUp.quickAmounts.custom")}</div>
                      <div className="mt-2 text-xl font-black">{t("panelSmsTopUp.quickAmounts.customAmount")}</div>
                    </button>
                  </div>
                </div>

                {customSelected ? (
                  <div className="space-y-2">
                    <Label htmlFor="custom-topup-amount">{t("panelSmsTopUp.customAmount.label")}</Label>
                    <Input
                      id="custom-topup-amount"
                      inputMode="numeric"
                      value={customAmount}
                      onChange={(event) => {
                        setSelectedPreset(null);
                        setCustomAmount(event.target.value);
                      }}
                      placeholder={t("panelSmsTopUp.customAmount.placeholder")}
                      className="h-12 rounded-[18px] border-border bg-background/45"
                      dir="ltr"
                    />
                    <div className="text-xs leading-6 text-muted-foreground">{t("panelSmsTopUp.customAmount.hint", { amount: format.currency(10000) })}</div>
                  </div>
                ) : null}

                <div ref={paySectionRef} className={`grid gap-4 ${maliartEnabled ? "" : "md:grid-cols-2"}`}>
                  {maliartEnabled ? (
                    <div className="space-y-2">
                      <Label>{t("panelSmsTopUp.gateway.label")}</Label>
                      <div className="flex h-12 items-center rounded-[18px] border border-primary/25 bg-primary/10 px-4 font-bold text-primary">
                        {t("payment.directGateway")}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>{t("panelSmsTopUp.gateway.label")}</Label>
                      <Select value={selectedGateway || undefined} onValueChange={(value) => setSelectedGateway(value as PaymentProvider)}>
                        <SelectTrigger className="h-12 rounded-[18px] border-border bg-background/45 text-start">
                          <SelectValue placeholder={t("panelSmsTopUp.gateway.placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableGateways.map((gateway) => (
                            <SelectItem key={gateway} value={gateway}>
                              {t(PAYMENT_GATEWAY_MAP[gateway].labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-xs leading-6 text-muted-foreground">{t("panelSmsTopUp.gateway.hint")}</div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>{t("panelSmsTopUp.finalAmount.label")}</Label>
                    <div className="sms-top-up-final-amount flex h-12 items-center rounded-[18px] border border-amber-500/20 bg-amber-500/10 px-4 text-lg font-black text-amber-100">
                      {format.currency(finalAmount)}
                    </div>
                    <div className="text-xs leading-6 text-muted-foreground">{t("panelSmsTopUp.finalAmount.hint")}</div>
                  </div>
                </div>

                {!maliartEnabled && settings?.sandboxEnabled ? (
                  <div className="rounded-[24px] border border-dashed border-primary/20 bg-background/40 p-4 text-sm leading-8 text-muted-foreground">
                    {t("panelSmsTopUp.sandboxHint")}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Link href="/panel/sms-settings">
                    <Button variant="outline" className="rounded-[20px] border-border bg-background/40 px-6">{t("common.back")}</Button>
                  </Link>
                  <Button onClick={handlePay} disabled={paying} className="rounded-[20px] px-6">
                    {paying ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <CreditCard className="me-2 h-4 w-4" />}
                    {t("panelSmsTopUp.pay")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
