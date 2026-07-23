import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, ArrowRight, Database, ExternalLink, History, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { SupportRenewalFeatureModule, SupportRenewalPackage, SupportRenewalPreview, SupportRenewalSettings } from "@/lib/types";
import { DiscountCodeDialog } from "@/components/discount-code-dialog";
import { useFormat, useLocale, useT } from "@/i18n/locale";

export default function PanelSupportRenewalInvoicePage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const format = useFormat();
  const [settings, setSettings] = useState<SupportRenewalSettings | null>(null);
  const [packages, setPackages] = useState<SupportRenewalPackage[]>([]);
  const [preview, setPreview] = useState<SupportRenewalPreview | null>(null);
  const [selectedFeatureModuleIds, setSelectedFeatureModuleIds] = useState<string[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const packageId = search.get("package") ?? "";
  const paymentStatus = search.get("payment");
  const paymentMessage = search.get("message");

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === packageId) ?? null,
    [packages, packageId],
  );

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let mounted = true;

    Promise.all([api.supportRenewal.packages(), packageId ? api.supportRenewal.preview(packageId, undefined, discountCode || undefined) : Promise.resolve(null)])
      .then(([packagesRes, previewRes]) => {
        if (!mounted) {
          return;
        }

        if (packagesRes.success) {
          setSettings(packagesRes.data.settings);
          setPackages(packagesRes.data.packages);
          setSelectedGateway(
            (packagesRes.data.settings.provider && (packagesRes.data.settings.enabledGateways ?? []).includes(packagesRes.data.settings.provider))
              ? packagesRes.data.settings.provider
              : (packagesRes.data.settings.enabledGateways?.[0] ?? ""),
          );
        }

        if (previewRes && previewRes.success) {
          setPreview(previewRes.data);
          setSelectedFeatureModuleIds(
            (previewRes.data.featureModules ?? []).filter((item) => item.selected).map((item) => item.moduleId),
          );
          setPageError(null);
        } else if (previewRes && !previewRes.success) {
          setPreview(null);
          setPageError(previewRes.message || t("supportRenewalInvoice.packageMismatch"));
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isAdmin, packageId, t]);

  useEffect(() => {
    if (!isAdmin || !packageId || loading) {
      return;
    }

    let active = true;
    setDiscountLoading(true);
    api.supportRenewal.preview(packageId, selectedFeatureModuleIds, discountCode || undefined).then((res) => {
      if (!active) {
        return;
      }

      if (res.success) {
        setPreview(res.data);
        setDiscountError(null);
        setPageError(null);
      } else {
        setDiscountError(discountCode ? (res.message || t("supportRenewalInvoice.invalidDiscountCode")) : null);
        if (!discountCode) {
          setPreview(null);
          setPageError(res.message || t("supportRenewalInvoice.packageMismatch"));
        }
      }
      setDiscountLoading(false);
    });

    return () => {
      active = false;
    };
  }, [discountCode, isAdmin, loading, packageId, selectedFeatureModuleIds, t]);

  useEffect(() => {
    if (!paymentStatus) {
      return;
    }

    if (paymentStatus === "success") {
      toast({ title: t("supportRenewalInvoice.toast.successTitle"), description: paymentMessage || t("supportRenewalInvoice.toast.successDescription") });
      return;
    }

    if (paymentStatus === "cancelled") {
      toast({ variant: "destructive", title: t("supportRenewalInvoice.toast.cancelledTitle"), description: t("supportRenewalInvoice.toast.cancelledDescription") });
      return;
    }

    if (paymentStatus === "failed") {
      toast({ variant: "destructive", title: t("supportRenewalInvoice.toast.failedTitle"), description: paymentMessage || t("supportRenewalInvoice.toast.failedDescription") });
    }
  }, [paymentMessage, paymentStatus, toast, t]);

  useEffect(() => {
    if (!preview?.package?.isUpgrade) {
      return;
    }

    if (selectedFeatureModuleIds.length > 0) {
      setSelectedFeatureModuleIds([]);
    }
  }, [preview?.package?.isUpgrade, selectedFeatureModuleIds.length]);

  const handlePay = async () => {
    if (!selectedPackage) {
      return;
    }

    try {
      setPaying(true);
      const res = await api.supportRenewal.pay(selectedPackage.id, selectedFeatureModuleIds, selectedGateway || undefined, discountCode || undefined);

      if (!res.success) {
        toast({ variant: "destructive", title: t("common.error"), description: res.message });
        return;
      }

      const payload = res.data;
      if (!payload || !payload.mode) {
        toast({ variant: "destructive", title: t("common.error"), description: t("supportRenewalInvoice.paymentIncomplete") });
        window.location.assign(`/panel/support-renewal/history?ts=${Date.now()}`);
        return;
      }

      if (payload.mode === "sandbox") {
        const paid = payload.payment;
        const durationText = paid?.durationDays ? t("supportRenewal.daysValue", { count: format.number(paid.durationDays) }) : t("supportRenewal.planDuration");
        const packageText = paid?.packageName ?? selectedPackage.name;
        const reference = paid?.referenceId ?? "-";
        const isolatedReference = `\u2066${reference}\u2069`;
        const message = t("supportRenewalInvoice.sandboxSuccessMessage", { reference: isolatedReference, duration: durationText, package: packageText });
        toast({ title: t("supportRenewalInvoice.toast.successTitle"), description: message });
        const params = new URLSearchParams({
          payment: "success",
          message,
          ts: String(Date.now()),
        });
        window.location.assign(`/panel/support-renewal/history?${params.toString()}`);
        return;
      }

      if (payload.redirectForm) {
        const form = document.createElement("form");
        form.method = (payload.redirectForm.method || "GET").toUpperCase();
        form.action = payload.redirectForm.action;
        form.style.display = "none";

        Object.entries(payload.redirectForm.inputs || {}).forEach(([name, value]) => {
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

      if (payload.paymentUrl) {
        window.location.assign(payload.paymentUrl);
        return;
      }

      toast({ variant: "destructive", title: t("common.error"), description: t("supportRenewalInvoice.paymentUrlMissing") });
      window.location.assign(`/panel/support-renewal/history?ts=${Date.now()}`);
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("supportRenewalInvoice.paymentServerError") });
    } finally {
      setPaying(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <ShieldCheck className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{t("supportRenewal.accessDeniedTitle")}</h1>
          <p className="text-muted-foreground leading-7">{t("supportRenewal.accessDeniedDescription")}</p>
          <Link href="/panel">
            <Button>{t("supportRenewal.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const lineItems = preview?.lineItems ?? [];
  const totalAmount = preview?.amount ?? 0;
  const totalDiscount = preview?.discountAmount ?? 0;
  const totalPayable = preview?.payableAmount ?? 0;

  const toggleFeatureModule = (module: SupportRenewalFeatureModule) => {
    setSelectedFeatureModuleIds((current) =>
      current.includes(module.moduleId)
        ? current.filter((item) => item !== module.moduleId)
        : [...current, module.moduleId],
    );
  };

  const handleApplyDiscountCode = async (nextCode: string) => {
    const normalized = nextCode.trim().toUpperCase();
    setDiscountLoading(true);
    const res = await api.supportRenewal.preview(packageId, selectedFeatureModuleIds, normalized);

    if (res.success) {
      setPreview(res.data);
      setDiscountCode(normalized);
      setDiscountError(null);
      setPageError(null);
    } else {
      setDiscountError(res.message || t("supportRenewalInvoice.invalidDiscountCode"));
    }

    setDiscountLoading(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("supportRenewalInvoice.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("supportRenewalInvoice.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/panel/support-renewal/history">
              <Button variant="outline" size="icon" title={t("supportRenewal.history")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
                <History className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/panel/support-renewal">
              <Button variant="outline" size="icon" title={t("supportRenewal.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
                <ArrowRight className={`w-5 h-5 ${isRtl ? "" : "rotate-180"}`} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
        {pageError ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-2 text-amber-300">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1 text-start">
                  <div className="font-semibold text-foreground">{t("supportRenewalInvoice.cannotContinueTitle")}</div>
                  <p className="text-sm leading-7 text-muted-foreground">{pageError}</p>
                </div>
              </div>
              <Link href="/panel/support-renewal">
                <Button className="w-full sm:w-auto">{t("supportRenewalInvoice.backToPackageSelection")}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <div className="flex h-52 items-center justify-center text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("supportRenewalInvoice.loading")}
          </div>
        ) : !selectedPackage ? (
          <Card className="border-border/70 bg-card/60">
            <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div className="space-y-2">
                <div className="text-lg font-bold">{t("supportRenewalInvoice.noPackageTitle")}</div>
                <p className="text-sm leading-7 text-muted-foreground">{t("supportRenewalInvoice.noPackageDescription")}</p>
              </div>
              <Link href="/panel/support-renewal">
                <Button>{t("supportRenewalInvoice.backToPackageSelection")}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : pageError || !preview ? (
          <Card className="border-border/70 bg-card/60">
            <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <AlertCircle className="h-10 w-10 text-amber-300" />
              <div className="space-y-2">
                <div className="text-lg font-bold">{t("supportRenewalInvoice.unavailableTitle")}</div>
                <p className="text-sm leading-7 text-muted-foreground">
                  {t("supportRenewalInvoice.unavailableDescription")}
                </p>
              </div>
              <Link href="/panel/support-renewal">
                <Button>{t("supportRenewalInvoice.backToPackageSelection")}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{selectedPackage.name}</CardTitle>
                    <CardDescription>
                      {t("supportRenewalInvoice.packageSummary", {
                        duration: t("supportRenewal.daysValue", { count: format.number(selectedPackage.durationDays) }),
                        limit: selectedPackage.userLimitLabel ?? t("supportRenewal.unlimited"),
                        unit: t("supportRenewal.defaultUnit"),
                      })}
                    </CardDescription>
                  </div>
                  <Badge variant={settings?.sandboxEnabled ? "secondary" : "outline"}>
                    {settings?.sandboxEnabled ? t("supportRenewalInvoice.sandboxBadge") : t("supportRenewalInvoice.onlinePaymentBadge")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-sm text-muted-foreground">{t("supportRenewalInvoice.previousSupportEndsAt")}</div>
                  <div className="mt-2 font-bold">{preview.previousSupportEndsAt ? format.date(preview.previousSupportEndsAt) : t("supportRenewal.notSet")}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-sm text-muted-foreground">{t("supportRenewalInvoice.newSupportEndsAt")}</div>
                  <div className="mt-2 font-bold text-primary">{preview.newSupportEndsAt ? format.date(preview.newSupportEndsAt) : t("supportRenewal.notSet")}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-sm text-muted-foreground">{t("supportRenewalInvoice.baseAmount")}</div>
                  <div className={`mt-2 font-bold ${preview.package.discountAmount > 0 ? "line-through text-muted-foreground" : ""}`}>
                    {format.currency(preview.package.priceAmount)}
                  </div>
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="text-sm text-muted-foreground">{t("supportRenewalInvoice.currentPayableAmount")}</div>
                  <div className="mt-2 text-lg font-black text-primary">{format.currency(totalPayable)}</div>
                </div>
              </CardContent>
            </Card>

            {(settings?.maliartEnabled || (settings?.enabledGateways?.length ?? 0) > 0) && (
              <Card className="border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle className="text-base">{t("supportRenewalInvoice.gatewayTitle")}</CardTitle>
                  <CardDescription>{t("supportRenewalInvoice.gatewayDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {settings?.maliartEnabled ? (
                    <div className="flex h-11 items-center rounded-md border border-primary/25 bg-primary/10 px-3 font-bold text-primary">
                      {t("payment.directGateway")}
                    </div>
                  ) : <select
                    value={selectedGateway}
                    onChange={(event) => setSelectedGateway(event.target.value)}
                    className="w-full appearance-none rounded-md border border-border bg-background p-2 px-3 text-start"
                    dir={dir}
                    disabled={!!settings?.sandboxEnabled}
                  >
                    {(settings?.gatewayOptions ?? [])
                      .filter((option) => (settings?.enabledGateways ?? []).includes(option.key))
                      .map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                  </select>}
                  {settings?.sandboxEnabled && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {t("supportRenewalInvoice.sandboxGatewayHint")}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {preview.package.isUpgrade ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="space-y-2 p-4 text-sm">
                  <div className="font-semibold">{t("supportRenewalInvoice.upgradeNoticeTitle")}</div>
                  <div className="text-muted-foreground">
                    {t("supportRenewalInvoice.upgradeNoticeDescription", { package: preview.package.upgradeFromPackageName ?? t("supportRenewalInvoice.currentPackageShort") })}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {preview.featureModules.length > 0 && !preview.package.isUpgrade ? (
              <Card className="border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle className="text-base">{t("supportRenewalInvoice.optionalModulesTitle")}</CardTitle>
                  <CardDescription>
                    {t("supportRenewalInvoice.optionalModulesDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {preview.featureModules.map((module) => {
                    const checked = selectedFeatureModuleIds.includes(module.moduleId);
                    const isActivation = module.billingMode === "activation";

                    return (
                      <label
                        key={module.id}
                        className={`flex cursor-pointer items-start justify-between gap-4 rounded-2xl border p-4 transition-colors ${checked ? "border-primary/40 bg-primary/5" : "border-border/70 bg-background/30"}`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox checked={checked} onCheckedChange={() => toggleFeatureModule(module)} />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold">{module.name}</div>
                              <Badge variant={isActivation ? "outline" : "secondary"}>
                                {isActivation ? t("supportRenewalInvoice.moduleActivation") : t("supportRenewalInvoice.moduleRenewal")}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {module.description || (isActivation ? t("supportRenewalInvoice.moduleActivationFallback") : t("supportRenewalInvoice.moduleRenewalFallback"))}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {isActivation
                                ? t("supportRenewalInvoice.moduleActivationDescription")
                                : t("supportRenewalInvoice.moduleRenewalDescription", {
                                  date: module.currentEndsAt ? format.date(module.currentEndsAt) : t("supportRenewal.notSet"),
                                  price: format.currency(module.monthlyPriceAmount),
                                })}
                            </div>
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="text-sm text-muted-foreground">{isActivation ? t("supportRenewalInvoice.moduleActivationCost") : t("supportRenewalInvoice.modulePeriodCost")}</div>
                          <div className="mt-1 font-bold text-primary">{format.currency(module.renewalAmount)}</div>
                        </div>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base">{t("supportRenewalInvoice.paymentSummaryTitle")}</CardTitle>
                <CardDescription>
                  {settings?.sandboxEnabled
                    ? t("supportRenewalInvoice.paymentSummarySandboxDescription")
                    : t("supportRenewalInvoice.paymentSummaryGatewayDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DiscountCodeDialog
                  value={discountCode}
                  applied={preview?.discountCode ? {
                    code: preview.discountCode.code,
                    discountAmount: preview.discountCode.discountAmount,
                    discountType: preview.discountCode.discountType,
                    discountValue: preview.discountCode.discountValue,
                  } : null}
                  loading={discountLoading}
                  error={discountError}
                  onApply={handleApplyDiscountCode}
                  onClear={() => {
                    setDiscountCode("");
                    setDiscountError(null);
                  }}
                />
                {totalDiscount > 0 ? (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">
                    {t("supportRenewalInvoice.totalDiscount", { amount: format.currency(totalDiscount) })}
                  </div>
                ) : null}
                <div className="space-y-3 rounded-2xl border border-border/70 bg-background/40 p-4">
                  {lineItems.map((item, index) => {
                    const isStorageRenewal = item.type === "storage_addon_renewal";

                    return (
                      <div
                        key={`${item.type}-${index}`}
                        className={`flex items-start justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0 ${isStorageRenewal ? "rounded-2xl border border-primary/25 bg-primary/5 p-3 last:p-3" : "border-border/40"}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {isStorageRenewal ? <Database className="h-4 w-4 shrink-0 text-primary" /> : null}
                            <div className="font-semibold">{item.title}</div>
                            {isStorageRenewal ? (
                              <Badge variant="secondary" className="rounded-xl">
                                {t("supportRenewalInvoice.fixedBadge")}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
                        </div>
                        <div className="shrink-0 text-end">
                          {item.type !== "discount_code" && item.discountAmount > 0 ? (
                            <div className="text-sm text-muted-foreground line-through">{format.currency(item.amount)}</div>
                          ) : null}
                          {item.type === "discount_code" ? (
                            <div className="font-bold text-emerald-300">-{format.currency(item.discountAmount)}</div>
                          ) : (
                            <div className="font-bold text-primary">{format.currency(item.payableAmount)}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="text-sm text-muted-foreground">{t("supportRenewalInvoice.finalPayableAmount")}</div>
                  <div className="mt-2 text-lg font-black text-primary">{format.currency(totalPayable)}</div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Link href="/panel/support-renewal">
                    <Button variant="outline" className="w-full sm:w-auto">
                      {t("supportRenewalInvoice.changePackage")}
                    </Button>
                  </Link>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={paying || !(settings?.enabled || settings?.sandboxEnabled) || (!settings?.sandboxEnabled && !settings?.maliartEnabled && !selectedGateway)}
                    onClick={handlePay}
                  >
                    {paying ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : settings?.sandboxEnabled ? <ShieldCheck className="me-2 h-4 w-4" /> : <ExternalLink className="me-2 h-4 w-4" />}
                    {paymentStatus === "failed" || paymentStatus === "cancelled" ? t("payment.retry") : t("supportRenewalInvoice.payOnline")}
                  </Button>
                </div>
                {!(settings?.enabled || settings?.sandboxEnabled) ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                    {t("supportRenewalInvoice.paymentDisabled")}
                  </div>
                ) : null}
                {settings?.enabled && !settings?.sandboxEnabled && !settings?.maliartEnabled && !selectedGateway ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                    {t("supportRenewalInvoice.gatewayRequired")}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
