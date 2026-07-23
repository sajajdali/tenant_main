import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BadgeCheck, Coins, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { api } from "@/lib/api";

export default function PanelNutritionTokenTopUpResultPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [retrying, setRetrying] = useState(false);
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const status = search.get("status") ?? "success";
  const amount = Number(search.get("amount") ?? "0");
  const purchasedTokens = Number(search.get("purchasedTokens") ?? search.get("amount") ?? "0");
  const unitPriceToman = Number(search.get("unitPriceToman") ?? "0");
  const tokens = Number(search.get("tokens") ?? "0");
  const reference = search.get("reference") ?? "—";
  const bank = search.get("bank") ?? "—";
  const message = search.get("message") ?? "";

  const success = status === "success";
  const paidAt = useMemo(() => {
    const value = search.get("paidAt");
    return value ? format.dateTime(value) : t("nutritionTokens.valueMissing");
  }, [format, search, t]);
  const tokenCount = (value: number) => t("panelNutritionTokenTopUp.tokensCount", { count: format.number(value) });
  const tomanAmount = (value: number) => t("panelNutritionTokenTopUpResult.tomanAmount", { amount: format.number(value) });

  const retryPayment = async () => {
    if (purchasedTokens <= 0 || retrying) return;
    setRetrying(true);
    const response = await api.nutritionTokens.pay(purchasedTokens, undefined);
    setRetrying(false);
    if (!response.success) return;
    if (response.data.redirectForm) {
      const form = document.createElement("form");
      form.method = (response.data.redirectForm.method || "POST").toUpperCase();
      form.action = response.data.redirectForm.action;
      Object.entries(response.data.redirectForm.inputs || {}).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      return;
    }
    if (response.data.paymentUrl) window.location.assign(response.data.paymentUrl);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground" dir={dir}>
      <div className="mx-auto max-w-2xl">
        <Card className="border-border/70 bg-card/60">
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">{t("panelNutritionTokenTopUpResult.eyebrow")}</div>
                <div className="text-2xl font-black">{success ? t("panelNutritionTokenTopUpResult.successTitle") : t("panelNutritionTokenTopUpResult.failedTitle")}</div>
              </div>
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${success ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                {success ? <BadgeCheck className="h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-border/70 bg-background/30 p-4">
                <div className="text-sm text-muted-foreground">{t("panelNutritionTokenTopUpResult.purchasedTokens")}</div>
                <div className="mt-2 text-2xl font-black">{tokenCount(purchasedTokens)}</div>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-background/30 p-4">
                <div className="text-sm text-muted-foreground">{t("panelNutritionTokenTopUpResult.paidAmount")}</div>
                <div className="mt-2 text-2xl font-black">{tomanAmount(amount)}</div>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-background/30 p-4">
                <div className="text-sm text-muted-foreground">{t("panelNutritionTokenTopUpResult.gateway")}</div>
                <div className="mt-2 font-black"><CodeText>{bank}</CodeText></div>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-background/30 p-4">
                <div className="text-sm text-muted-foreground">{t("panelNutritionTokenTopUpResult.newBalance")}</div>
                <div className="mt-2 font-black">{tokenCount(tokens)}</div>
                {unitPriceToman > 0 ? <div className="mt-1 text-xs text-muted-foreground">{t("panelNutritionTokenTopUpResult.unitPrice", { amount: tomanAmount(unitPriceToman) })}</div> : null}
              </div>
              <div className="rounded-[24px] border border-border/70 bg-background/30 p-4 md:col-span-2">
                <div className="text-sm text-muted-foreground">{t("panelNutritionTokenTopUpResult.reference")}</div>
                <div className="mt-2 font-black"><CodeText>{reference}</CodeText></div>
              </div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-background/30 p-4 text-sm leading-8 text-muted-foreground">
              {success ? t("panelNutritionTokenTopUpResult.successDescription", { paidAt }) : (message || t("panelNutritionTokenTopUpResult.failedDescription"))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              {!success ? (
                <Button className="rounded-[20px]" onClick={() => void retryPayment()} disabled={retrying || purchasedTokens <= 0}>
                  {retrying ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
                  {t("payment.retry")}
                </Button>
              ) : null}
              <Link href="/panel/nutrition/tokens">
                <Button className="rounded-[20px] bg-teal-600 hover:bg-teal-500">
                  <Coins className="me-2 h-4 w-4" />
                  {t("panelNutritionTokenTopUpResult.backToTokens")}
                </Button>
              </Link>
              <Link href="/panel">
                <Button variant="outline" className="rounded-[20px]">
                  <ArrowRight className={`me-2 h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
                  {t("panelNutritionTokenTopUpResult.backToPanel")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
