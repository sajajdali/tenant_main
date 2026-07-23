import { Link } from "wouter";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RefreshCw, WalletCards, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

export default function PanelSmsTopUpResultPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [retrying, setRetrying] = useState(false);
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const status = search.get("status") || "success";
  const amount = Number(search.get("amount") || "0");
  const returnedBalance = Number(search.get("balance") || "0");
  const [balance, setBalance] = useState(returnedBalance);
  const reference = search.get("reference") || "";
  const paymentId = search.get("paymentId") || "";
  const paidAt = search.get("paidAt") || "";
  const bank = search.get("bank") || "";
  const message = search.get("message") || "";
  const isSuccess = status === "success";
  const isCancelled = status === "cancelled";
  const missingValue = t("panelSmsTopUpResult.valueMissing");
  const formattedPaidAt = paidAt ? format.dateTime(paidAt) : missingValue;

  useEffect(() => {
    let active = true;
    api.payment.getSettings().then((response) => {
      if (active && response.success) {
        setBalance(Number(response.data.smsStats?.creditBalance ?? returnedBalance));
      }
    });

    return () => {
      active = false;
    };
  }, [returnedBalance]);

  const retryPayment = async () => {
    if (amount <= 0 || retrying) return;
    setRetrying(true);
    const response = await api.smsTopUp.pay(amount, undefined);
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

  const ResultIcon = isSuccess ? CheckCircle2 : isCancelled ? AlertTriangle : XCircle;
  const resultTitle = isSuccess
    ? t("panelSmsTopUpResult.successTitle")
    : isCancelled
      ? t("panelSmsTopUpResult.cancelledTitle")
      : t("panelSmsTopUpResult.failedTitle");
  const resultDescription = isSuccess
    ? (
      <>
        {t("panelSmsTopUpResult.successDescriptionPrefix")}{" "}
        {reference ? <CodeText className="font-bold text-foreground">{reference}</CodeText> : <span className="font-bold text-foreground">{missingValue}</span>}{" "}
        {t("panelSmsTopUpResult.successDescriptionSuffix")}
      </>
    )
    : message || (isCancelled ? t("panelSmsTopUpResult.cancelledDescription") : t("panelSmsTopUpResult.failedDescription"));

  return (
    <div className="min-h-screen bg-background text-foreground" dir={dir}>
      <div className={`absolute inset-x-0 top-0 -z-10 h-[320px] ${isSuccess ? "bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_42%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" : "bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.18),_transparent_42%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]"}`} />

      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card className="border-border/70 bg-card/60">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <div className={`mb-4 flex h-20 w-20 items-center justify-center rounded-[28px] border ${isSuccess ? "border-emerald-500/20 bg-emerald-500/10" : "border-rose-500/20 bg-rose-500/10"}`}>
                <ResultIcon className={`h-10 w-10 ${isSuccess ? "text-emerald-300" : "text-rose-300"}`} />
              </div>
              <h1 className="text-2xl font-black sm:text-3xl">{resultTitle}</h1>
              <p className="mt-3 max-w-xl text-sm leading-8 text-muted-foreground">
                {resultDescription}
              </p>
            </div>

            <div className={`rounded-[24px] border p-4 ${isSuccess ? "border-emerald-500/20 bg-emerald-500/10" : "border-rose-500/20 bg-rose-500/10"}`}>
              <div className="mb-2 text-sm text-muted-foreground">{t("panelSmsTopUpResult.amount")}</div>
              <div className={`text-xl font-black ${isSuccess ? "text-emerald-300" : "text-rose-300"}`}>{format.currency(amount)}</div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-border/70 bg-background/35 p-4">
                <div className="mb-2 text-sm text-muted-foreground">{t("panelSmsTopUpResult.paidAt")}</div>
                <div className="text-lg font-black">{formattedPaidAt}</div>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-background/35 p-4">
                <div className="mb-2 text-sm text-muted-foreground">{t("panelSmsTopUpResult.paymentId")}</div>
                <div className="text-lg font-black">{paymentId ? <CodeText>{paymentId}</CodeText> : missingValue}</div>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-background/35 p-4">
                <div className="mb-2 text-sm text-muted-foreground">{t("panelSmsTopUpResult.bank")}</div>
                <div className="text-lg font-black">{bank || missingValue}</div>
              </div>
            </div>

            <div className={`rounded-[24px] border p-4 ${isSuccess ? "border-primary/20 bg-primary/10" : "border-border/70 bg-background/35"}`}>
              <div className={`mb-2 flex items-center gap-2 text-sm ${isSuccess ? "text-primary" : "text-muted-foreground"}`}>
                <WalletCards className="h-4 w-4" />
                {isSuccess ? t("panelSmsTopUpResult.newSmsBalance") : t("panelSmsTopUpResult.currentSmsBalance")}
              </div>
              <div className={`text-2xl font-black ${isSuccess ? "text-primary" : "text-foreground"}`}>{format.currency(balance)}</div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              {!isSuccess ? (
                <Button className="rounded-[20px] px-6" onClick={() => void retryPayment()} disabled={retrying || amount <= 0}>
                  {retrying ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
                  {t("payment.retry")}
                </Button>
              ) : null}
              <Link href="/panel/sms-settings">
                <Button className="rounded-[20px] px-6">{t("panelSmsTopUpResult.backToSmsSettings")}</Button>
              </Link>
              <Link href="/panel">
                <Button variant="outline" className="rounded-[20px] border-border bg-background/40 px-6">
                  <ArrowLeft className={`h-4 w-4 ${isRtl ? "ms-2 rotate-180" : "me-2"}`} />
                  {t("panelSmsTopUpResult.backToPanel")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
