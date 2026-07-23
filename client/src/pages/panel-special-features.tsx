import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowRight, CheckCircle2, Coins, ExternalLink, Gem, HeartHandshake, Loader2, Lock, MessageCircleMore, Settings2, ShieldCheck, ShoppingCart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { FeatureModuleActivationPreview, FeatureModuleSummary } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

const MODULE_ICONS: Record<string, typeof ShoppingCart> = {
  "online-store": ShoppingCart,
  "vip-customers": Gem,
  "customer-club": Coins,
  "customer-feedback": HeartHandshake,
  "online-chat": MessageCircleMore,
};

type SpecialFeaturesTranslate = (key: MessageKey, params?: Record<string, string | number>) => string;

const moduleActiveUntil = (module: FeatureModuleSummary, t: SpecialFeaturesTranslate, formatDate: (value?: string | null) => string) =>
  module.expiresAt ? t("panelSpecialFeatures.module.activeUntil", { date: formatDate(module.expiresAt) }) : "";

const getModuleActionConfig = (module: FeatureModuleSummary, t: SpecialFeaturesTranslate, formatDate: (value?: string | null) => string) => {
  if (module.slug === "customer-club") {
    return {
      activeHref: "/panel/customer-club",
      activeButtonLabel: t("panelSpecialFeatures.module.customerClub.activeButton"),
      inactiveButtonLabel: t("panelSpecialFeatures.module.customerClub.inactiveButton"),
      activeStatusLabel: t("panelSpecialFeatures.module.customerClub.status"),
      activeDescription: t("panelSpecialFeatures.module.customerClub.activeDescription", { expires: moduleActiveUntil(module, t, formatDate) }),
    };
  }

  if (module.slug === "vip-customers") {
    return {
      activeHref: "/panel/users",
      activeButtonLabel: t("panelSpecialFeatures.module.vipCustomers.activeButton"),
      inactiveButtonLabel: t("panelSpecialFeatures.module.vipCustomers.inactiveButton"),
      activeStatusLabel: t("panelSpecialFeatures.module.vipCustomers.status"),
      activeDescription: t("panelSpecialFeatures.module.vipCustomers.activeDescription", { expires: moduleActiveUntil(module, t, formatDate) }),
    };
  }

  if (module.slug === "customer-feedback") {
    return {
      activeHref: "/panel/customer-feedback",
      activeButtonLabel: t("panelSpecialFeatures.module.customerFeedback.activeButton"),
      inactiveButtonLabel: t("panelSpecialFeatures.module.customerFeedback.inactiveButton"),
      activeStatusLabel: t("panelSpecialFeatures.module.customerFeedback.status"),
      activeDescription: t("panelSpecialFeatures.module.customerFeedback.activeDescription", { expires: moduleActiveUntil(module, t, formatDate) }),
    };
  }

  if (module.slug === "online-chat") {
    return {
      activeHref: "/panel/online-chat",
      activeButtonLabel: t("panelSpecialFeatures.module.onlineChat.activeButton"),
      inactiveButtonLabel: t("panelSpecialFeatures.module.onlineChat.inactiveButton"),
      activeStatusLabel: t("panelSpecialFeatures.module.onlineChat.status"),
      activeDescription: t("panelSpecialFeatures.module.onlineChat.activeDescription", { expires: moduleActiveUntil(module, t, formatDate) }),
    };
  }

  return {
    activeHref: "/panel/store-settings",
    activeButtonLabel: t("panelSpecialFeatures.module.store.activeButton"),
    inactiveButtonLabel: t("panelSpecialFeatures.module.store.inactiveButton"),
    activeStatusLabel: t("panelSpecialFeatures.module.store.status"),
    activeDescription: t("panelSpecialFeatures.module.store.activeDescription", { expires: moduleActiveUntil(module, t, formatDate) }),
  };
};

export default function PanelSpecialFeaturesPage() {
  const [, params] = useRoute("/panel/special-features/:slug");
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const formatValue = useFormat();
  const { dir, isRtl } = useLocale();
  const [modules, setModules] = useState<FeatureModuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewModule, setPreviewModule] = useState<FeatureModuleSummary | null>(null);
  const [preview, setPreview] = useState<FeatureModuleActivationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activating, setActivating] = useState(false);

  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const paymentStatus = search.get("payment");
  const paymentMessage = search.get("message");
  const moduleSlug = search.get("module");
  const requestedSlug = params?.slug ?? null;

  const reloadModules = async () => {
    setLoading(true);
    const res = await api.featureModules.list();
    if (res.success) {
      setModules(res.data.items);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    reloadModules();
  }, [isAdmin]);

  useEffect(() => {
    if (!paymentStatus) {
      return;
    }

    if (paymentStatus === "success") {
      toast({
        title: t("panelSpecialFeatures.toast.activatedTitle"),
        description: moduleSlug
          ? t("panelSpecialFeatures.toast.activatedWithModule", { module: moduleSlug })
          : t("panelSpecialFeatures.toast.activatedDescription"),
      });
      void reloadModules();
      return;
    }

    if (paymentStatus === "cancelled") {
      toast({ variant: "destructive", title: t("panelSpecialFeatures.toast.cancelledTitle"), description: t("panelSpecialFeatures.toast.cancelledDescription") });
      return;
    }

    if (paymentStatus === "failed") {
      toast({ variant: "destructive", title: t("panelSpecialFeatures.toast.failedTitle"), description: paymentMessage || t("panelSpecialFeatures.toast.failedDescription") });
    }
  }, [moduleSlug, paymentMessage, paymentStatus, t, toast]);

  const filteredModules = useMemo(() => {
    if (!requestedSlug) {
      return modules;
    }

    return modules.filter((module) => module.slug === requestedSlug);
  }, [modules, requestedSlug]);

  const selectedModuleTitle = useMemo(() => {
    if (!requestedSlug) {
      return null;
    }

    return modules.find((module) => module.slug === requestedSlug)?.name ?? null;
  }, [modules, requestedSlug]);

  const selectedIcon = useMemo(() => {
    if (!previewModule) return ShoppingCart;
    return MODULE_ICONS[previewModule.slug] ?? ShoppingCart;
  }, [previewModule]);
  const formatDate = (value?: string | null) => value ? formatValue.date(value) : t("supportRenewal.notSet");

  const openActivation = async (module: FeatureModuleSummary) => {
    setPreviewModule(module);
    setPreview(null);
    setPreviewLoading(true);
    const res = await api.featureModules.previewActivation(module.id);
    setPreviewLoading(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      setPreviewModule(null);
      return;
    }

    setPreview(res.data);
  };

  const handleActivate = async (module: FeatureModuleSummary | null = previewModule) => {
    if (!module) return;

    setActivating(true);
    const res = await api.featureModules.activate(module.id);
    setActivating(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    if (res.data.mode === "sandbox") {
      const returnPath = requestedSlug ? `/panel/special-features/${requestedSlug}` : "/panel/special-features";
      window.location.href = `${returnPath}?payment=success&module=${encodeURIComponent(module.slug)}`;
      return;
    }

    if (res.data.redirectForm) {
      const form = document.createElement("form");
      form.method = (res.data.redirectForm.method || "GET").toUpperCase();
      form.action = res.data.redirectForm.action;
      form.style.display = "none";

      Object.entries(res.data.redirectForm.inputs || {}).forEach(([name, value]) => {
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

    if (res.data.paymentUrl) {
      window.location.href = res.data.paymentUrl;
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <ShieldCheck className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{t("panelSpecialFeatures.accessDenied.title")}</h1>
          <p className="text-muted-foreground leading-7">{t("panelSpecialFeatures.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelSpecialFeatures.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 text-start" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-start">
            <h1 className="text-xl font-bold text-foreground">{selectedModuleTitle ? selectedModuleTitle : t("panelSpecialFeatures.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {selectedModuleTitle
                ? t("panelSpecialFeatures.description.single")
                : t("panelSpecialFeatures.description.list")}
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
            {requestedSlug ? (
              <Link href="/panel/special-features">
                <Button variant="outline" className="w-full rounded-2xl border-border bg-background/40 hover:bg-background/70 sm:w-auto">
                  <ExternalLink className="me-2 h-4 w-4" />
                  {t("panelSpecialFeatures.showAll")}
                </Button>
              </Link>
            ) : null}
            <Link href="/panel">
              <Button variant="outline" size="icon" title={t("common.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
                <ArrowRight className={`w-5 h-5 ${isRtl ? "rotate-180" : ""}`} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-6">
        {loading ? (
          <div className="flex h-52 items-center justify-center text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelSpecialFeatures.loading")}
          </div>
        ) : (
          filteredModules.length === 0 ? (
            <Card className="border-border/70 bg-card/60">
              <CardContent className="flex min-h-52 flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="text-lg font-bold">{t("panelSpecialFeatures.notFound.title")}</div>
                <div className="max-w-md text-sm leading-7 text-muted-foreground">{t("panelSpecialFeatures.notFound.description")}</div>
                <Link href="/panel/special-features">
                  <Button variant="outline">{t("panelSpecialFeatures.showAll")}</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
          <div className={`grid gap-4 ${requestedSlug ? "md:grid-cols-1" : "md:grid-cols-2"}`}>
            {filteredModules.map((module) => {
              const Icon = MODULE_ICONS[module.slug] ?? ShoppingCart;
              const actionConfig = getModuleActionConfig(module, t, formatDate);

              return (
                <Card key={module.id} className="border-border/70 bg-card/60">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Icon className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{module.name}</CardTitle>
                            <CardDescription>{module.description || t("panelSpecialFeatures.module.defaultDescription")}</CardDescription>
                          </div>
                        </div>
                      </div>
                      <Badge variant={module.isActive ? "secondary" : "outline"} className={module.isActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-primary/30 text-primary"}>
                        {module.isActive ? t("panelSpecialFeatures.badge.active") : t("panelSpecialFeatures.badge.locked")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                      <div className="text-sm text-muted-foreground">{t("panelSpecialFeatures.monthlyCost")}</div>
                      <div className="mt-2 text-lg font-black text-primary">{formatValue.currency(module.monthlyPriceAmount ?? 0)}</div>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-background/40 p-4 text-sm leading-7 text-muted-foreground">
                      {module.isActive
                        ? actionConfig.activeDescription
                        : module.ctaNote}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                      {module.isActive ? (
                        <div className="flex items-center gap-2 text-sm text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />
                          {actionConfig.activeStatusLabel}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">{t("panelSpecialFeatures.proratedHint")}</div>
                      )}
                      {module.isActive ? (
                        <Link href={actionConfig.activeHref}>
                          <Button className="sm:w-auto">
                            <Settings2 className="me-2 h-4 w-4" />
                            {actionConfig.activeButtonLabel}
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          onClick={() => paymentStatus && paymentStatus !== "success" && module.slug === moduleSlug
                            ? void handleActivate(module)
                            : void openActivation(module)}
                          disabled={activating}
                          className="sm:w-auto"
                        >
                          <Lock className="me-2 h-4 w-4" />
                          {paymentStatus && paymentStatus !== "success" && module.slug === moduleSlug ? t("payment.retry") : actionConfig.inactiveButtonLabel}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          )
        )}
      </main>

      <Dialog open={!!previewModule} onOpenChange={(open) => !open && setPreviewModule(null)}>
        <DialogContent className="sm:max-w-lg" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {(() => {
                const Icon = selectedIcon;
                return <Icon className="h-5 w-5 text-primary" />;
              })()}
              {t("panelSpecialFeatures.activation.title", { module: previewModule?.name ?? "" })}
            </DialogTitle>
            <DialogDescription>
              {t("panelSpecialFeatures.activation.description")}
            </DialogDescription>
          </DialogHeader>

          {previewLoading || !preview ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="me-2 h-5 w-5 animate-spin" />
              {t("panelSpecialFeatures.activation.loading")}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-sm text-muted-foreground">{t("panelSpecialFeatures.monthlyCost")}</div>
                  <div className="mt-2 font-bold">{formatValue.currency(preview.module.monthlyPriceAmount ?? 0)}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-sm text-muted-foreground">{t("panelSpecialFeatures.activation.remainingDays")}</div>
                  <div className="mt-2 font-bold">{t("supportRenewal.daysValue", { count: formatValue.number(preview.remainingDays) })}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="text-sm text-muted-foreground">{t("panelSpecialFeatures.activation.activeUntil")}</div>
                  <div className="mt-2 font-bold">{formatDate(preview.currentSupportEndsAt)}</div>
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="text-sm text-muted-foreground">{t("panelSpecialFeatures.activation.payableAmount")}</div>
                  <div className="mt-2 text-lg font-black text-primary">{formatValue.currency(preview.payableAmount ?? 0)}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/40 p-4 text-sm leading-7 text-muted-foreground">
                {preview.message}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <Button variant="outline" onClick={() => setPreviewModule(null)}>
                  {t("common.close")}
                </Button>
                <Button onClick={() => void handleActivate()} disabled={activating}>
                  {activating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ExternalLink className="me-2 h-4 w-4" />}
                  {paymentStatus === "failed" || paymentStatus === "cancelled" ? t("payment.retry") : t("panelSpecialFeatures.activation.payAndActivate")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
