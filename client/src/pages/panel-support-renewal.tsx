import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, BadgeCheck, History, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { SupportRenewalPackage, SupportRenewalSettings, TenantMeta } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";

export default function PanelSupportRenewalPage() {
  const { isAdmin } = useAuth();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const format = useFormat();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [settings, setSettings] = useState<SupportRenewalSettings | null>(null);
  const [packages, setPackages] = useState<SupportRenewalPackage[]>([]);
  const [selectedUserLimitKey, setSelectedUserLimitKey] = useState<string>("");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const durationStepRef = useRef<HTMLDivElement | null>(null);
  const summaryStepRef = useRef<HTMLDivElement | null>(null);

  const unitLabel = tenantMeta?.audience?.pluralLabel?.trim() || t("supportRenewal.defaultUnit");
  const userLimitKey = (value?: number | null) => (value == null ? "unlimited" : String(value));
  const currentProfessionalCount = Math.max(0, tenantMeta?.barbersCount ?? 0);
  const currentTenantPackage = tenantMeta?.subscriptionPackage ?? null;
  const panelAccessLocked = tenantMeta?.panelAccessLocked ?? false;
  const panelAccessMessage = tenantMeta?.panelAccessMessage?.trim() || t("supportRenewal.panelLockedDescription");

  const userLimitOptions = useMemo(() => {
    const map = new Map<string, { key: string; userLimit: number | null; label: string }>();
    for (const item of packages) {
      const key = userLimitKey(item.userLimit ?? null);
      if (map.has(key)) continue;
      map.set(key, {
        key,
        userLimit: item.userLimit ?? null,
        label: item.userLimitLabel || (item.userLimit == null ? t("supportRenewal.unlimited") : format.number(item.userLimit)),
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.userLimit == null) return 1;
      if (b.userLimit == null) return -1;
      return a.userLimit - b.userLimit;
    });
  }, [format, packages, t]);

  const packagesForSelectedLimit = useMemo(
    () =>
      packages
        .filter((item) => userLimitKey(item.userLimit ?? null) === selectedUserLimitKey)
        .sort((a, b) => a.durationDays - b.durationDays),
    [packages, selectedUserLimitKey],
  );

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === selectedPackageId) ?? null,
    [packages, selectedPackageId],
  );

  const recommendedPackage = useMemo(() => {
    const currentPackageMatch = packages.find((item) => item.id === tenantMeta?.subscriptionPackage?.id);
    if (currentPackageMatch) {
      return currentPackageMatch;
    }

    return [...packages]
      .filter((item) => item.userLimit == null || (item.userLimit ?? 0) >= currentProfessionalCount)
      .sort((a, b) => {
        if (a.userLimit == null) return 1;
        if (b.userLimit == null) return -1;
        if ((a.userLimit ?? 0) !== (b.userLimit ?? 0)) return (a.userLimit ?? 0) - (b.userLimit ?? 0);
        return a.durationDays - b.durationDays;
      })[0] ?? null;
  }, [currentProfessionalCount, packages, tenantMeta?.subscriptionPackage?.id]);

  useEffect(() => {
    if (!isAdmin) return;

    api.meta.get().then((res) => {
      if (res.success) setTenantMeta(res.data);
    });

    api.supportRenewal.packages().then((res) => {
      if (res.success) {
        setSettings(res.data.settings);
        setPackages(res.data.packages);
        setSelectedUserLimitKey("");
        setSelectedPackageId("");
      }
    });
  }, [isAdmin, tenantMeta?.subscriptionPackage?.id]);

  useEffect(() => {
    if (!selectedUserLimitKey || !durationStepRef.current) return;
    durationStepRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedUserLimitKey]);

  useEffect(() => {
    if (!selectedPackageId || !summaryStepRef.current) return;
    summaryStepRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedPackageId]);

  const handleSelectUserLimit = (key: string) => {
    const matchedOption = userLimitOptions.find((item) => item.key === key);
    if (matchedOption && matchedOption.userLimit !== null && currentProfessionalCount > matchedOption.userLimit) {
      setLimitDialogOpen(true);
      return;
    }

    setSelectedUserLimitKey(key);
    setSelectedPackageId("");
  };

  const handleSelectPackage = (packageId: string) => {
    const nextPackage = packages.find((item) => item.id === packageId);
    const nextPackageLimit = nextPackage?.userLimit ?? null;
    if (nextPackage && nextPackageLimit !== null && currentProfessionalCount > nextPackageLimit) {
      setLimitDialogOpen(true);
      return;
    }

    setSelectedPackageId(packageId);
  };

  const useRecommendedPackage = () => {
    if (!recommendedPackage) {
      setLimitDialogOpen(false);
      return;
    }

    setSelectedUserLimitKey(userLimitKey(recommendedPackage.userLimit ?? null));
    setSelectedPackageId(recommendedPackage.id);
    setLimitDialogOpen(false);
  };

  const useCurrentPackage = () => {
    const currentPackageId = tenantMeta?.subscriptionPackage?.id;
    if (!currentPackageId) {
      useRecommendedPackage();
      return;
    }

    const currentPackageMatch = packages.find((item) => item.id === currentPackageId) ?? recommendedPackage;
    if (!currentPackageMatch) {
      return;
    }

    setSelectedUserLimitKey(userLimitKey(currentPackageMatch.userLimit ?? null));
    setSelectedPackageId(currentPackageMatch.id);
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

  if (panelAccessLocked) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-xl w-full">
          <Card className="border-destructive/30 bg-card/70 text-center shadow-sm">
            <CardHeader className="space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
                <Lock className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl">{t("supportRenewal.panelLockedTitle")}</CardTitle>
              <CardDescription className="text-base leading-8 text-muted-foreground">
                {panelAccessMessage}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/panel">
                <Button variant="outline" className="rounded-2xl">
                  {t("supportRenewal.backToPanel")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("supportRenewal.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("supportRenewal.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`w-5 h-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">{t("supportRenewal.currentStatusTitle")}</CardTitle>
              <CardDescription>{t("supportRenewal.currentStatusDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {t("supportRenewal.currentShortcutDescription")}
                </div>
                <Button
                  type="button"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
                  onClick={useCurrentPackage}
                  disabled={!tenantMeta?.subscriptionPackage?.id && !recommendedPackage}
                >
                  {t("supportRenewal.renewCurrentPackage")}
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-sm text-muted-foreground">{t("supportRenewal.currentPackage")}</div>
                <div className="mt-2 font-bold">{tenantMeta?.subscriptionPackage?.name ?? t("supportRenewal.undefined")}</div>
                {tenantMeta?.subscriptionPackage?.userLimitLabel ? (
                  <div className="mt-1 text-xs text-muted-foreground">{t("supportRenewal.unitSuffix", { value: tenantMeta.subscriptionPackage.userLimitLabel, unit: unitLabel })}</div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-sm text-muted-foreground">{t("supportRenewal.supportEndsAt")}</div>
                <div className="mt-2 font-bold">{tenantMeta?.supportEndsAt ? format.date(tenantMeta.supportEndsAt) : t("supportRenewal.notSet")}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-sm text-muted-foreground">{t("supportRenewal.daysRemaining")}</div>
                <div className={`mt-2 font-bold ${(tenantMeta?.supportExpired ?? false) ? "text-destructive" : "text-primary"}`}>
                  {format.number(Number(tenantMeta?.supportDaysRemaining ?? 0))}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4 sm:col-span-3">
                <div className="text-sm text-muted-foreground">{t("supportRenewal.currentUnitCount", { unit: unitLabel })}</div>
                <div className="mt-2 font-bold">{t("supportRenewal.unitSuffix", { value: format.number(currentProfessionalCount), unit: unitLabel })}</div>
              </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hidden border-border/70 bg-card/60 lg:block">
            <CardHeader>
              <CardTitle className="text-base">{t("supportRenewal.paymentSettingsTitle")}</CardTitle>
              <CardDescription>{t("supportRenewal.paymentSettingsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/40 p-4">
                <span className="text-muted-foreground">{t("supportRenewal.gatewayEnabled")}</span>
                <Badge variant={settings?.enabled ? "secondary" : "destructive"}>
                  {settings?.enabled ? t("supportRenewal.enabled") : t("supportRenewal.disabled")}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/40 p-4">
                <span className="text-muted-foreground">{t("supportRenewal.sandboxMode")}</span>
                <Badge variant={settings?.sandboxEnabled ? "secondary" : "outline"}>
                  {settings?.sandboxEnabled ? t("supportRenewal.enabled") : t("supportRenewal.disabled")}
                </Badge>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4 text-muted-foreground leading-7">
                {settings?.sandboxEnabled
                  ? t("supportRenewal.sandboxDescription")
                  : t("supportRenewal.gatewayDescription")}
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("supportRenewal.stepSelectionTitle")}</CardTitle>
            <CardDescription>{t("supportRenewal.stepSelectionDescription", { unit: unitLabel })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">{t("supportRenewal.stepOneTitle", { unit: unitLabel })}</div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {userLimitOptions.map((option) => {
                  const isSelected = selectedUserLimitKey === option.key;
                  const isBlocked = option.userLimit !== null && currentProfessionalCount > option.userLimit;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleSelectUserLimit(option.key)}
                      className={`rounded-3xl border p-4 text-start transition-all ${isSelected ? "border-primary bg-primary/10 shadow-sm shadow-primary/10" : isBlocked ? "border-border/40 bg-background/20 opacity-65" : "border-border/70 bg-background/40 hover:border-primary/30"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-bold">
                          {option.userLimit == null
                            ? t("supportRenewal.unlimitedUnit", { unit: unitLabel })
                            : t("supportRenewal.unitSuffix", { value: option.label, unit: unitLabel })}
                        </div>
                        {isBlocked ? <Lock className="h-5 w-5 text-muted-foreground" /> : isSelected ? <BadgeCheck className="h-5 w-5 text-primary" /> : null}
                      </div>
                      {isBlocked ? (
                        <div className="mt-3 text-xs leading-6 text-muted-foreground">
                          {t("supportRenewal.limitMismatchShort", { unit: unitLabel })}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedUserLimitKey ? (
            <div className="space-y-3" ref={durationStepRef}>
              <div className="text-sm font-semibold text-foreground">{t("supportRenewal.stepTwoTitle")}</div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {packagesForSelectedLimit.map((pkg) => {
                  const packageLimit = pkg.userLimit ?? null;
                  const isBlocked = packageLimit !== null && currentProfessionalCount > packageLimit;

                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => handleSelectPackage(pkg.id)}
                      className={`rounded-3xl border p-4 text-start transition-all ${selectedPackageId === pkg.id ? "border-primary bg-primary/10 shadow-sm shadow-primary/10" : isBlocked ? "border-border/40 bg-background/20 opacity-65" : "border-border/70 bg-background/40 hover:border-primary/30"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold">{t("supportRenewal.daysDuration", { count: format.number(pkg.durationDays) })}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {t("supportRenewal.stepCapacity", { value: pkg.userLimitLabel ?? t("supportRenewal.unlimited"), unit: unitLabel })}
                          </div>
                        </div>
                        {isBlocked ? <Lock className="h-5 w-5 text-muted-foreground" /> : selectedPackageId === pkg.id ? <BadgeCheck className="h-5 w-5 text-primary" /> : null}
                      </div>
                      <div className="mt-4 space-y-1">
                        <div className={`text-sm ${pkg.discountAmount > 0 ? "line-through text-muted-foreground" : "font-semibold"}`}>{format.currency(pkg.priceAmount)}</div>
                        <div className="text-lg font-bold text-primary">{format.currency(pkg.payableAmount)}</div>
                      </div>
                      {isBlocked ? (
                        <div className="mt-3 text-xs leading-6 text-muted-foreground">
                          {t("supportRenewal.limitMismatchShort", { unit: unitLabel })}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
                {selectedUserLimitKey && packagesForSelectedLimit.length === 0 ? (
                  <div className="rounded-2xl border border-border/70 bg-background/30 p-4 text-sm text-muted-foreground">
                    {t("supportRenewal.noPackageForCapacity")}
                  </div>
                ) : null}
              </div>
            </div>
            ) : (
              <div className="rounded-2xl border border-border/70 bg-background/30 p-4 text-sm text-muted-foreground">
                {t("supportRenewal.selectCapacityFirst", { unit: unitLabel })}
              </div>
            )}

            {selectedPackage ? (
              <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-4" ref={summaryStepRef}>
                <div className="text-sm font-semibold text-foreground">{t("supportRenewal.selectionSummaryTitle")}</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                    <div className="text-xs text-muted-foreground">{t("supportRenewal.unitCount", { unit: unitLabel })}</div>
                    <div className="mt-1 font-bold">{selectedPackage.userLimitLabel ?? t("supportRenewal.unlimited")}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                    <div className="text-xs text-muted-foreground">{t("supportRenewal.planDuration")}</div>
                    <div className="mt-1 font-bold">{t("supportRenewal.daysValue", { count: format.number(selectedPackage.durationDays) })}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                    <div className="text-xs text-muted-foreground">{t("supportRenewal.payableAmount")}</div>
                    <div className="mt-1 font-bold text-primary">{format.currency(selectedPackage.payableAmount)}</div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Link href="/panel/support-renewal/history">
                <Button variant="outline" className="w-full sm:w-auto">
                  <History className="me-2 h-4 w-4" />
                  {t("supportRenewal.history")}
                </Button>
              </Link>
              <Link href={selectedPackage ? `/panel/support-renewal/invoice?package=${encodeURIComponent(selectedPackage.id)}` : "#"}>
                <Button className="w-full sm:w-auto" disabled={!selectedPackage}>
                  {t("supportRenewal.continueToInvoice")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent className="max-w-xl" dir={dir}>
          <DialogHeader className="space-y-3 text-start">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-300 sm:mx-0">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <DialogTitle>{t("supportRenewal.limitDialogTitle")}</DialogTitle>
            <DialogDescription className="leading-8">
              {t("supportRenewal.limitDialogActivePrefix")}{" "}
              <span className="font-bold text-foreground">{t("supportRenewal.unitSuffix", { value: format.number(currentProfessionalCount), unit: unitLabel })}</span>{" "}
              {t("supportRenewal.limitDialogActiveSuffix")}
              {" "}
              {t("supportRenewal.limitDialogCapacityInstruction", { unit: unitLabel })}
              {" "}
              {t("supportRenewal.limitDialogRecommendationPrefix")}
              {" "}
              <span className="font-bold text-foreground">{recommendedPackage?.name ?? currentTenantPackage?.name ?? t("supportRenewal.currentPackageFallback")}</span>
              {" "}
              {t("supportRenewal.limitDialogRecommendationSuffix")}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border/70 bg-background/50 p-4 text-sm leading-8 text-muted-foreground">
            {t("supportRenewal.limitDialogHint", { unit: unitLabel })}
          </div>

          <DialogFooter className="gap-3 sm:flex-row-reverse">
            <Button onClick={useRecommendedPackage} className="sm:w-auto">
              {t("supportRenewal.chooseRecommendedPackage")}
            </Button>
            <Button variant="outline" onClick={() => setLimitDialogOpen(false)} className="sm:w-auto">
              {t("supportRenewal.understood")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
