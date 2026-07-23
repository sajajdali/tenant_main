import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, CalendarClock, Loader2, Package2, Sparkles, WalletCards } from "lucide-react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NutritionPackageCheckoutSummaryPayload } from "@/lib/types";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { Button } from "@/components/ui/button";

function getSubscriptionStatusMeta(status: "active" | "expired" | "cancelled" | null | undefined, t: ReturnType<typeof useT>) {
  if (status === "active") {
    return {
      label: t("nutritionMyPackage.status.activeLabel"),
      caption: t("nutritionMyPackage.status.activeCaption"),
      className: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    };
  }

  if (status === "expired") {
    return {
      label: t("nutritionMyPackage.status.expiredLabel"),
      caption: t("nutritionMyPackage.status.expiredCaption"),
      className: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    };
  }

  return {
    label: t("nutritionMyPackage.status.inactiveLabel"),
    caption: t("nutritionMyPackage.status.inactiveCaption"),
    className: "border-white/10 bg-white/5 text-white/85",
  };
}

export default function NutritionMembershipMyPackagePage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<NutritionPackageCheckoutSummaryPayload | null>(null);
  const [activeView, setActiveView] = useState<"package" | "payment" | "buy">("package");

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (!user) {
      return;
    }

    api.nutritionPackageCheckout.summary().then((result) => {
      if (result.success) {
        setSummary(result.data);
      }

      setLoading(false);
    });
  }, [isLoading, setLocation, user]);

  const subscription = summary?.subscription ?? null;
  const latestOrder = useMemo(() => summary?.orders.items?.[0] ?? null, [summary?.orders.items]);
  const statusMeta = getSubscriptionStatusMeta(subscription?.status ?? null, t);
  const formatDate = (value?: string | null) => value ? format.date(value) : "—";
  const formatTomans = (value?: number | null) => t("nutritionMyPackage.tomanAmount", { amount: format.number(Math.max(0, Number(value ?? 0))) });
  const statusLabel = (status?: string | null) => {
    if (status === "active") {
      return t("nutritionMyPackage.status.active");
    }
    if (status === "expired") {
      return t("nutritionMyPackage.status.expired");
    }
    if (status === "paid") {
      return t("nutritionMyPackage.status.paid");
    }
    return t("nutritionMyPackage.status.inactive");
  };

  if (isLoading || loading) {
    return (
      <div className="relative isolate min-h-screen bg-[#06131d] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_25%),linear-gradient(180deg,rgba(6,19,29,0.96),rgba(4,10,17,1))]" />
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  const views = [
    { id: "package" as const, label: t("nutritionMyPackage.tabs.package"), icon: Package2 },
    { id: "payment" as const, label: t("nutritionMyPackage.tabs.payment"), icon: CalendarClock },
    { id: "buy" as const, label: t("nutritionMyPackage.tabs.buy"), icon: WalletCards },
  ];

  return (
    <div className="relative isolate min-h-screen bg-[#07101d] px-4 pb-16 pt-7 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.08),transparent_28%),linear-gradient(180deg,#0a1321,#050b14)]" />

      <div className="relative z-10 mx-auto max-w-md">
        <NutritionTopbar backHref="/nutrition/profile" title={t("nutritionMyPackage.topbarTitle")} description={t("nutritionMyPackage.topbarDescription")} variant="hero" compact />

        <header className="py-7 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[16px] border border-amber-300/20 bg-amber-400/10 text-amber-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-[22px] font-black">{t("nutritionMyPackage.title")}</h1>
        </header>

        <nav className="grid grid-cols-3 gap-2 rounded-[18px] border border-white/10 bg-white/[0.025] p-1.5" aria-label={t("nutritionMyPackage.title")}>
          {views.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveView(id)}
              className={`flex min-h-[68px] flex-col items-center justify-center gap-2 rounded-[13px] px-2 text-center text-[10.5px] font-black leading-5 transition ${activeView === id ? "bg-amber-400 text-slate-950 shadow-[0_14px_35px_-24px_rgba(251,191,36,0.9)]" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <main className="mt-4">
          {activeView === "package" ? (
            subscription ? (
              <section className="rounded-[22px] border border-white/10 bg-white/[0.025] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-black text-slate-500">{t("nutritionMyPackage.tabs.package")}</div>
                    <h2 className="mt-2 text-[21px] font-black text-white">{subscription.package?.name || t("nutritionMyPackage.noActivePackageTitle")}</h2>
                  </div>
                  <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${statusMeta.className}`}>{statusMeta.label}</span>
                </div>

                <div className="my-5 h-px bg-white/8" />
                <div className="grid grid-cols-2 gap-x-5 gap-y-4 text-[12px]">
                  <div><div className="text-slate-500">{t("nutritionMyPackage.startsAt")}</div><div className="mt-1.5 font-black text-white">{formatDate(subscription.startsAt)}</div></div>
                  <div><div className="text-slate-500">{t("nutritionMyPackage.endsAt")}</div><div className="mt-1.5 font-black text-white">{formatDate(subscription.endsAt)}</div></div>
                  {subscription.onlineDietTotal > 0 ? <div><div className="text-slate-500">{t("nutritionMyPackage.onlineRemaining")}</div><div className="mt-1.5 text-[18px] font-black text-emerald-300">{format.number(subscription.onlineDietRemaining)}</div></div> : null}
                  {subscription.offlineDietTotal > 0 ? <div><div className="text-slate-500">{t("nutritionMyPackage.offlineRemaining")}</div><div className="mt-1.5 text-[18px] font-black text-emerald-300">{format.number(subscription.offlineDietRemaining)}</div></div> : null}
                </div>
              </section>
            ) : (
              <section className="relative overflow-hidden rounded-[24px] border border-amber-300/25 bg-[linear-gradient(155deg,rgba(251,191,36,0.12),rgba(255,255,255,0.035)_45%,rgba(5,11,20,0.9))] p-5 text-center shadow-[0_30px_80px_-52px_rgba(251,191,36,0.65)]">
                <div className="pointer-events-none absolute -start-16 -top-20 h-44 w-44 rounded-full bg-amber-300/10 blur-3xl" />
                <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-[19px] border border-amber-200/30 bg-amber-400/14 text-amber-300 shadow-[0_18px_45px_-30px_rgba(251,191,36,0.95)]">
                  <Package2 className="h-7 w-7" />
                  <Sparkles className="absolute -end-1 -top-1 h-4 w-4 text-amber-200" />
                </div>
                <h2 className="relative mt-4 text-[18px] font-black leading-8 text-white">{t("nutritionMyPackage.emptyTitle")}</h2>
                <p className="relative mx-auto mt-2 max-w-[300px] text-[12px] font-semibold leading-7 text-slate-300">{t("nutritionMyPackage.emptyDescription")}</p>
                <Button
                  type="button"
                  onClick={() => setLocation("/nutrition/membership/packages?direct_buy=1")}
                  className="relative mt-5 h-12 w-full rounded-[16px] bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] text-[13px] font-black text-slate-950 shadow-[0_22px_52px_-30px_rgba(245,158,11,0.95)] hover:brightness-105"
                >
                  {t("nutritionMyPackage.emptyBuyAction")}
                  <ArrowLeft className={`h-4 w-4 ${isRtl ? "ms-2" : "me-2 rotate-180"}`} />
                </Button>
              </section>
            )
          ) : null}

          {activeView === "payment" ? (
            latestOrder ? (
              <section className="rounded-[22px] border border-white/10 bg-white/[0.025] p-5">
                <div className="flex items-center gap-2 text-[14px] font-black"><BadgeCheck className="h-5 w-5 text-emerald-300" />{t("nutritionMyPackage.tabs.payment")}</div>
                <div className="mt-5 space-y-4 text-[12px]">
                  <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{t("nutritionMyPackage.invoiceNumber")}</span><CodeText className="font-black">{latestOrder.invoiceNumber}</CodeText></div>
                  <div className="h-px bg-white/8" />
                  <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{t("nutritionMyPackage.statusLabel")}</span><span className="font-black text-emerald-300">{statusLabel(latestOrder.status)}</span></div>
                  <div className="h-px bg-white/8" />
                  <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{t("nutritionMyPackage.amount")}</span><span className="text-[15px] font-black text-amber-300">{formatTomans(latestOrder.payableAmount)}</span></div>
                </div>
              </section>
            ) : (
              <section className="rounded-[22px] border border-dashed border-white/10 px-5 py-10 text-center text-[13px] font-bold text-slate-400">{t("nutritionMyPackage.noPayment")}</section>
            )
          ) : null}

          {activeView === "buy" ? (
            <section className="rounded-[22px] border border-amber-300/15 bg-amber-400/[0.035] p-5 text-center">
              <WalletCards className="mx-auto h-7 w-7 text-amber-300" />
              <h2 className="mt-4 text-[18px] font-black">{t("nutritionMyPackage.buyNewTitle")}</h2>
              <p className="mx-auto mt-2 max-w-[280px] text-[12px] leading-7 text-slate-400">{t("nutritionMyPackage.buyNewDescription")}</p>
              <Button type="button" onClick={() => setLocation("/nutrition/membership/packages?direct_buy=1")} className="mt-5 h-11 w-full rounded-[14px] bg-amber-400 text-[13px] font-black text-slate-950 hover:bg-amber-300">
                {t("nutritionMyPackage.buyNewAction")}
                <ArrowLeft className={`h-4 w-4 ${isRtl ? "ms-2" : "me-2 rotate-180"}`} />
              </Button>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
