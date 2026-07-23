import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BadgeCheck, CreditCard, Database, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { formatSupportRenewalMoney } from "@/lib/support-renewal";
import type { StorageAddonPreview } from "@/lib/types";
import { useLocale, useT, useFormat } from "@/i18n/locale";

function formatStorageBytes(
  bytes: number | null | undefined,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
  unitLabels: { gb: string; mb: string },
) {
  const safeBytes = Math.max(0, Number(bytes ?? 0));
  const gb = safeBytes / 1024 / 1024 / 1024;

  if (gb >= 1) {
    return `${formatNumber(gb, { maximumFractionDigits: gb >= 10 ? 0 : 1 })} ${unitLabels.gb}`;
  }

  const mb = safeBytes / 1024 / 1024;
  return `${formatNumber(mb, { maximumFractionDigits: mb >= 10 ? 0 : 1 })} ${unitLabels.mb}`;
}

const BYTES_PER_GB = 1024 * 1024 * 1024;

function submitRedirectForm(redirectForm: { action: string; method: string; inputs: Record<string, string> }) {
  const form = document.createElement("form");
  form.method = redirectForm.method || "POST";
  form.action = redirectForm.action;

  Object.entries(redirectForm.inputs || {}).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

export default function PanelStorageUpgradePage() {
  const { dir, isRtl } = useLocale();
  const t = useT();
  const format = useFormat();
  const initialUsage = getInitialTenantMeta()?.storage ?? null;
  const initialParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [selectedGb, setSelectedGb] = useState(() => Math.max(1, Number(initialParams.get("gb") || 1)));
  const [preview, setPreview] = useState<StorageAddonPreview | null>(null);
  const [currentUsage, setCurrentUsage] = useState(initialUsage);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");
  const gbOptions = [1, 2, 4, 6, 10];
  const previewUsage = (preview?.currentUsage?.totalQuotaBytes ?? 0) > 0 ? preview?.currentUsage : null;
  const usage = previewUsage ?? currentUsage ?? initialUsage;
  const displayUsedBytes = usage?.usedBytes ?? 0;
  const displayTotalBytes = usage?.totalQuotaBytes && usage.totalQuotaBytes > 0 ? usage.totalQuotaBytes : BYTES_PER_GB;
  const currentTotalGb = Math.max(1, Number(usage?.totalQuotaGb ?? Math.round(displayTotalBytes / BYTES_PER_GB)));
  const percent = displayTotalBytes > 0 ? Math.min(100, Math.max(0, (displayUsedBytes / displayTotalBytes) * 100)) : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const unitLabels = {
    gb: t("panelStorageUpgrade.unit.gb"),
    mb: t("panelStorageUpgrade.unit.mb"),
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const paymentMessage = params.get("message");

    if (payment === "success") {
      setMessage(paymentMessage || t("panelStorageUpgrade.payment.success"));
    } else if (payment === "failed") {
      setMessage(paymentMessage || t("panelStorageUpgrade.payment.failed"));
    } else if (payment === "cancelled") {
      setMessage(paymentMessage || t("panelStorageUpgrade.payment.cancelled"));
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    setLoadingPreview(true);
    setPreviewError("");

    api.files.storagePreview(selectedGb).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setPreview(res.data);
        setCurrentUsage(res.data.currentUsage);
      } else {
        setPreview(null);
        setPreviewError(res.message || t("panelStorageUpgrade.preview.failed"));
      }
      setLoadingPreview(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedGb, t]);

  useEffect(() => {
    let cancelled = false;

    api.files.list({ page: 1, perPage: 1 }).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setCurrentUsage(res.data.usage);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePay = async () => {
    setPaying(true);
    const res = await api.files.storagePay(selectedGb);
    setPaying(false);

    if (!res.success) {
      setMessage(res.message || t("panelStorageUpgrade.pay.failed"));
      return;
    }

    if (res.data.mode === "sandbox") {
      window.location.assign(`/panel/files/upgrade?payment=success&message=${encodeURIComponent(t("panelStorageUpgrade.payment.sandboxSuccess"))}`);
      return;
    }

    if (res.data.paymentUrl) {
      window.location.assign(res.data.paymentUrl);
      return;
    }

    if (res.data.redirectForm) {
      submitRedirectForm(res.data.redirectForm);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 text-foreground" dir={dir}>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-black">{t("panelStorageUpgrade.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelStorageUpgrade.description")}</p>
          </div>
          <Link href="/panel/files">
            <Button variant="outline" size="icon" className="rounded-full">
              <ArrowRight className={`h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>

        {message ? (
          <Card className="border-primary/30 bg-primary/10">
            <CardContent className="flex items-center gap-3 p-4 text-sm font-bold text-primary">
              <BadgeCheck className="h-5 w-5" />
              {message}
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-5 w-5 text-primary" />
                {t("panelStorageUpgrade.selectTitle")}
              </CardTitle>
              <CardDescription>{t("panelStorageUpgrade.selectDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {gbOptions.map((gb) => (
                  <button
                    key={gb}
                    type="button"
                    onClick={() => setSelectedGb(gb)}
                    className={`rounded-2xl border px-3 py-3 text-center text-sm font-black transition ${selectedGb === gb ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background/40 hover:border-primary/40"}`}
                  >
                    {t("panelStorageUpgrade.gbOption", { count: format.number(gb) })}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelStorageUpgrade.pricePerGbMonth")}</div>
                  <div className="mt-2 font-black">{formatSupportRenewalMoney(preview?.pricePerGbMonth ?? 0)}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelStorageUpgrade.remainingDays")}</div>
                  <div className="mt-2 font-black">{t("panelStorageUpgrade.daysValue", { count: format.number(Number(preview?.remainingDays ?? 0)) })}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{t("panelStorageUpgrade.extraStorage")}</div>
                  <div className="mt-2 font-black text-primary">{t("panelStorageUpgrade.gbValue", { count: format.number(selectedGb) })}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-7 text-muted-foreground">
                {t("panelStorageUpgrade.currentStorageInfo", { current: format.number(currentTotalGb), added: format.number(selectedGb) })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-border/70 bg-card/60">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="relative h-24 w-24 shrink-0">
                  <svg className="h-24 w-24 -rotate-90" viewBox="0 0 108 108" aria-hidden="true">
                    <circle cx="54" cy="54" r={radius} className="fill-none stroke-border/70" strokeWidth="10" />
                    <circle
                      cx="54"
                      cy="54"
                      r={radius}
                      className="fill-none stroke-primary transition-all duration-500"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-lg font-black">{format.percent(Math.round(percent) / 100)}</div>
                    <div className="text-xs text-muted-foreground">{t("panelStorageUpgrade.currentLabel")}</div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">{t("panelStorageUpgrade.currentUsage")}</div>
                  <div className="text-lg font-black">{formatStorageBytes(displayUsedBytes, format.number, unitLabels)}</div>
                  <div className="text-xs text-muted-foreground">{t("panelStorageUpgrade.fromStorage", { amount: formatStorageBytes(displayTotalBytes, format.number, unitLabels) })}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/25 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ReceiptText className="h-5 w-5 text-primary" />
                  {t("panelStorageUpgrade.invoiceTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("panelStorageUpgrade.payableAmount")}</span>
                  <span className="text-xl font-black text-primary">
                    {loadingPreview ? "..." : formatSupportRenewalMoney(preview?.payableAmount ?? 0)}
                  </span>
                </div>
                {previewError ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs leading-6 text-destructive">
                    {previewError}
                  </div>
                ) : null}
                {preview ? (
                  <div className="rounded-2xl border border-border/70 bg-background/40 p-3 text-xs leading-6 text-muted-foreground">
                    {t("panelStorageUpgrade.calculation", {
                      gb: format.number(selectedGb),
                      price: formatSupportRenewalMoney(preview.pricePerGbMonth),
                      remainingDays: format.number(Number(preview.remainingDays)),
                      billingDays: format.number(Number(preview.billingDaysPerMonth ?? 30)),
                    })}
                  </div>
                ) : null}
                <Button
                  className="h-12 w-full rounded-2xl gap-2"
                  disabled={loadingPreview || paying || !preview || (preview.pricePerGbMonth ?? 0) <= 0}
                  onClick={handlePay}
                >
                  <CreditCard className="h-4 w-4" />
                  {paying ? t("panelStorageUpgrade.activating") : (["failed", "cancelled"].includes(initialParams.get("payment") || "") ? t("payment.retry") : t("panelStorageUpgrade.payAndActivate"))}
                </Button>
                {preview && (preview.pricePerGbMonth ?? 0) <= 0 ? (
                  <div className="text-xs leading-6 text-muted-foreground">
                    {t("panelStorageUpgrade.missingGbPrice")}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
