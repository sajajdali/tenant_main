import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CalendarClock, CreditCard, Loader2, RefreshCw, Sparkles, TicketPercent } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NutritionPackageOrder, NutritionPackageSubscription } from "@/lib/types";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const MINDSET_PAYMENT_SUCCESS_INTRO_KEY = "nutrition:mindset-payment-success-intro";
const MINDSET_AFTER_PAYMENT_TARGET_KEY = "nutrition:mindset-after-payment-target";

function submitRedirectForm(redirectForm?: { action: string; method: string; inputs: Record<string, string> }) {
  if (!redirectForm) return false;

  const form = document.createElement("form");
  form.method = (redirectForm.method || "GET").toUpperCase();
  form.action = redirectForm.action;
  form.style.display = "none";
  Object.entries(redirectForm.inputs || {}).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  return true;
}

export default function NutritionMembershipPackageResultPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir } = useLocale();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<NutritionPackageSubscription | null>(null);
  const [order, setOrder] = useState<NutritionPackageOrder | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const status = search.get("status") ?? "success";
  const orderId = search.get("order") ?? "";
  const trackingNumber = search.get("tracking") ?? orderId;
  const failedPackageId = Number(search.get("package") ?? 0);
  const failedDiscountCode = search.get("discount") ?? undefined;
  const isSandbox = search.get("sandbox") === "1";

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (status !== "success") {
      setLoading(false);
      return;
    }

    api.nutritionPackageCheckout.summary().then((result) => {
      if (!result.success) {
        toast({
          variant: "destructive",
          title: t("nutritionMembershipPackageResult.toast.loadFailed"),
          description: result.message,
        });
        setLoading(false);
        return;
      }

      setSubscription(result.data.subscription ?? null);
      setOrder(
        result.data.orders.items.find((item) => item.id === orderId) ??
          result.data.orders.items[0] ??
          null,
      );
      setLoading(false);
    });
  }, [isLoading, orderId, setLocation, status, toast, user]);

  const summaryRows = useMemo(() => {
    if (!subscription) {
      return [];
    }

    return [
      subscription.onlineDietTotal > 0 ? {
        label: t("nutritionMembershipPackageResult.onlineDietCount"),
        value: t("nutritionMembershipPackageResult.countValue", { count: format.number(subscription.onlineDietTotal) }),
      } : null,
      subscription.offlineDietTotal > 0 ? {
        label: t("nutritionMembershipPackageResult.offlineDietCount"),
        value: t("nutritionMembershipPackageResult.countValue", { count: format.number(subscription.offlineDietTotal) }),
      } : null,
      {
        label: t("nutritionMembershipPackageResult.endsAt"),
        value: subscription.endsAt ? format.date(subscription.endsAt) : "—",
      },
      {
        label: t("nutritionMembershipPackageResult.paidAmount"),
        value: t("nutritionMembershipPackageResult.tomanAmount", { amount: format.number(Math.max(0, subscription.payableAmount)) }),
      },
    ].filter((row): row is NonNullable<typeof row> => row !== null);
  }, [format, subscription, t]);

  if (isLoading || loading) {
    return (
      <div className="relative isolate min-h-screen bg-[#0a1224] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_28%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  if (status !== "success") {
    const handleRetry = async () => {
      if (retrying) return;
      if (!Number.isInteger(failedPackageId) || failedPackageId <= 0) {
        setLocation("/nutrition/membership/packages");
        return;
      }

      setRetrying(true);
      try {
        const result = await api.nutritionPackageCheckout.pay(String(failedPackageId), undefined, failedDiscountCode);
        if (!result.success) {
          toast({
            variant: "destructive",
            title: t("nutritionMembershipPackageResult.retryFailed"),
            description: t("nutritionMembershipPackageResult.failedDescription"),
          });
          return;
        }

        if (submitRedirectForm(result.data.redirectForm)) return;
        if (result.data.paymentUrl) {
          window.location.assign(result.data.paymentUrl);
          return;
        }

        toast({ variant: "destructive", title: t("nutritionMembershipPackageResult.retryFailed") });
      } finally {
        setRetrying(false);
      }
    };

    return (
      <div className="relative isolate min-h-screen bg-[#0a1224] px-5 pb-8 pt-5 text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.13),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.16),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />
        <div className="relative z-10 mx-auto max-w-[390px] space-y-4">
          <NutritionTopbar backHref="/nutrition/membership/packages" title={t("nutritionMembershipPackageResult.statusTopbarTitle")} description={t("nutritionMembershipPackageResult.statusTopbarDescription")} variant="hero" compact />
          <div className="rounded-[22px] border border-rose-400/20 bg-[#111827]/82 p-4 text-center shadow-[0_30px_80px_-45px_rgba(0,0,0,0.85)] backdrop-blur-xl">
            <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-rose-400/12 text-rose-300">
              <CreditCard className="h-6 w-6" />
            </div>
            <div className="mt-4 text-[11px] font-bold text-rose-300">{t("nutritionMembershipPackageResult.failedBadge")}</div>
            <h1 className="mt-1.5 text-[20px] font-black">{t("nutritionMembershipPackageResult.failedTitle")}</h1>
            <p className="mt-2 text-[11px] leading-6 text-slate-300">
              {t("nutritionMembershipPackageResult.failedDescription")}
            </p>
            <div className="mt-3 flex items-center justify-between rounded-[14px] border border-white/10 bg-slate-950/25 px-3 py-2.5 text-[11px]">
              <span className="text-slate-400">{t("nutritionMembershipPackageResult.referenceId")}</span>
              <CodeText className="max-w-[62%] truncate font-black text-white">{trackingNumber || "—"}</CodeText>
            </div>
            <Button
              type="button"
              onClick={() => void handleRetry()}
              disabled={retrying}
              className="mt-4 h-11 w-full rounded-[15px] bg-amber-400 text-[12px] font-black text-slate-950 hover:bg-amber-300"
            >
              {retrying ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
              {retrying ? t("nutritionMembershipPackageResult.retrying") : t("nutritionMembershipPackageResult.retryPayment")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleContinue = async () => {
    if (continuing) {
      return;
    }

    setContinuing(true);
    const result = await api.nutrition.getProfile();
    setContinuing(false);

    const profile = result.success ? result.data.profile : null;
    if (profile?.mindsetCompletedAt) {
      updateNutritionFormState({
        mindsetCompleted: true,
        mindsetAnswers: profile.mindsetAnswers ?? {},
      });
      setLocation("/nutrition/diet-type");
      return;
    }

    if (typeof window !== "undefined" && window.location.pathname === "/nutrition/membership/package-result" && status === "success") {
      window.sessionStorage.setItem(MINDSET_PAYMENT_SUCCESS_INTRO_KEY, "1");
      window.sessionStorage.setItem(MINDSET_AFTER_PAYMENT_TARGET_KEY, "diet-type");
    }

    setLocation("/nutrition/membership/mindset/1");
  };

  return (
    <div className="relative isolate min-h-screen bg-[#0a1224] px-5 pb-8 pt-5 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.13),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.16),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto max-w-[390px] space-y-4">
        <NutritionTopbar backHref="/nutrition" title={t("nutritionMembershipPackageResult.topbarTitle")} description={t("nutritionMembershipPackageResult.topbarDescription")} variant="hero" compact />

        <div className="rounded-[22px] border border-white/10 bg-[#111827]/82 p-4 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-emerald-400/12 text-emerald-300">
            <BadgeCheck className="h-6 w-6" />
          </div>

          <div className="mt-4 space-y-1.5 text-center">
            <div className="text-[11px] font-bold text-emerald-300">{isSandbox ? t("nutritionMembershipPackageResult.sandboxBadge") : t("nutritionMembershipPackageResult.successBadge")}</div>
            <h1 className="text-[20px] font-black leading-7">{t("nutritionMembershipPackageResult.successTitle")}</h1>
          </div>

          {subscription?.package ? (
            <div className="mt-4 rounded-[17px] border border-emerald-400/20 bg-emerald-400/8 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold text-emerald-100">{t("nutritionMembershipPackageResult.purchasedPackage")}</div>
                  <div className="mt-1.5 text-[16px] font-black text-white">{subscription.package.name}</div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-emerald-400/12 text-emerald-300">
                  <Sparkles className="h-[18px] w-[18px]" />
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {summaryRows.map((row) => (
              <div key={row.label} className="rounded-[16px] border border-white/10 bg-slate-950/18 p-3">
                <div className="text-[10px] font-bold text-slate-400">{row.label}</div>
                <div className="mt-2 text-[15px] font-black text-white">{row.value}</div>
              </div>
            ))}
          </div>

          {order ? (
            <div className="mt-3 rounded-[17px] border border-white/10 bg-slate-950/18 p-3.5">
              <div className="flex items-center gap-2 text-[12px] font-bold text-white">
                <CalendarClock className="h-3.5 w-3.5 text-amber-300" />
                {t("nutritionMembershipPackageResult.orderDetails")}
              </div>
              <div className="mt-3 space-y-2.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{t("nutritionMembershipPackageResult.referenceId")}</span>
                  {order.referenceId ? <CodeText className="max-w-[58%] truncate font-black text-white">{order.referenceId}</CodeText> : <span className="font-black text-white">—</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{t("nutritionMembershipPackageResult.paidAmount")}</span>
                  <span className="font-black text-emerald-300">{t("nutritionMembershipPackageResult.tomanAmount", { amount: format.number(Math.max(0, order.payableAmount)) })}</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4">
            <Button
              type="button"
              onClick={() => void handleContinue()}
              className="h-12 w-full rounded-[16px] border border-amber-200/20 bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] text-[13px] font-black text-slate-950 shadow-[0_25px_55px_-28px_rgba(245,158,11,0.92)] hover:opacity-95"
            >
              {continuing ? t("nutritionMembershipPackageResult.checking") : t("nutritionMembershipPackageResult.continue")}
              <TicketPercent className="ms-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
