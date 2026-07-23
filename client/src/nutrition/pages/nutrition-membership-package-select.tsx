import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NutritionPackageCheckoutPreview } from "@/lib/types";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

function submitRedirectForm(redirectForm?: { action: string; method: string; inputs: Record<string, string> }) {
  if (!redirectForm) {
    return false;
  }

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

export default function NutritionMembershipPackageSelectPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/nutrition/membership/packages/:packageId/select");
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const formState = useMemo(() => getNutritionFormState(), []);
  const directBuy = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return new URLSearchParams(window.location.search).get("direct_buy") === "1";
  }, []);
  const replaceActiveSubscription = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return new URLSearchParams(window.location.search).get("replace_active") === "1";
  }, []);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [preview, setPreview] = useState<NutritionPackageCheckoutPreview | null>(null);
  const [selectedGateway, setSelectedGateway] = useState("");

  const packageId = params?.packageId ?? "";
  const packagesHref = `/nutrition/membership/packages${directBuy ? "?direct_buy=1" : ""}`;

  const loadPreview = async (nextCode?: string) => {
    if (!packageId) {
      return;
    }

    setDiscountLoading(true);
    const result = await api.nutritionPackageCheckout.preview(packageId, nextCode || undefined);
    setDiscountLoading(false);

    if (!result.success) {
      if (nextCode) {
        setDiscountError(result.message || t("nutritionMembershipPackageSelect.discountInvalid"));
        return;
      }

      toast({
        variant: "destructive",
        title: t("nutritionMembershipPackageSelect.previewUnavailable"),
        description: result.message,
      });
      setLocation(packagesHref);
      return;
    }

    setPreview(result.data);
    setDiscountError(null);
    setDiscountCode(nextCode ?? "");
    setSelectedGateway((current) => {
      if (result.data.settings.maliartEnabled || result.data.settings.provider === "maliart") return "";
      if (current && result.data.settings.enabledGateways.includes(current)) {
        return current;
      }

      const fallback = result.data.settings.provider && result.data.settings.enabledGateways.includes(result.data.settings.provider)
        ? result.data.settings.provider
        : result.data.settings.enabledGateways[0] || "";

      return fallback;
    });
  };

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (!packageId) {
      setLocation(packagesHref);
      return;
    }

    if (!directBuy && (!formState.completedProfileSaved || !formState.targetWeightKg)) {
      setLocation("/nutrition/membership/target-weight");
      return;
    }

    setLoading(true);
    loadPreview().finally(() => setLoading(false));
  }, [
    formState.completedProfileSaved,
    formState.targetWeightKg,
    directBuy,
    isLoading,
    packageId,
    packagesHref,
    setLocation,
    user,
  ]);

  const handleApplyDiscount = async (code: string) => {
    const normalized = code.trim().toUpperCase();
    await loadPreview(normalized);
  };

  const handleClearDiscount = async () => {
    setDiscountCode("");
    setDiscountError(null);
    await loadPreview();
  };

  const handlePay = async () => {
    if (!preview) {
      return;
    }

    try {
      setPaying(true);
      const result = await api.nutritionPackageCheckout.pay(
        preview.package.id,
        preview.settings.sandboxEnabled ? undefined : selectedGateway || undefined,
        discountCode || undefined,
        replaceActiveSubscription,
      );

      if (!result.success) {
        toast({
          variant: "destructive",
          title: t("nutritionMembershipPackageSelect.paymentStartFailed"),
          description: result.message,
        });
        return;
      }

      const payload = result.data;

      updateNutritionFormState({
        selectedNutritionPackageId: payload.order.package?.id ?? preview.package.id,
        selectedNutritionPackageName: payload.order.package?.name ?? preview.package.name,
      });

      if (payload.mode === "sandbox" || payload.mode === "free") {
        const query = new URLSearchParams({
          status: "success",
          order: payload.order.id,
          invoice: payload.order.invoiceNumber,
          reference: payload.order.referenceId ?? "",
        });
        if (payload.mode === "sandbox") query.set("sandbox", "1");
        setLocation(`/nutrition/membership/package-result?${query.toString()}`);
        return;
      }

      if (submitRedirectForm(payload.redirectForm)) {
        return;
      }

      if (payload.paymentUrl) {
        window.location.assign(payload.paymentUrl);
        return;
      }

      toast({
        variant: "destructive",
        title: t("nutritionMembershipPackageSelect.gatewayUnavailable"),
        description: t("nutritionMembershipPackageSelect.gatewayUnavailableDescription"),
      });
    } finally {
      setPaying(false);
    }
  };

  if (isLoading || loading || !preview) {
    return (
      <div className="relative isolate min-h-screen bg-[#0a1224] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_28%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  const maliartEnabled = preview.settings.maliartEnabled || preview.settings.provider === "maliart";
  const isFreeCheckout = preview.payableAmount <= 0;

  const codeDiscountAmount = Math.max(0, preview.discountAmount);
  const appliedDiscount = preview.discountCode && codeDiscountAmount > 0
    ? {
        code: preview.discountCode.code,
        discountAmount: codeDiscountAmount,
        discountType: preview.discountCode.discountType,
        discountValue: preview.discountCode.discountValue,
      }
    : null;
  const packageDiscountAmount = Math.max(0, preview.package.priceAmount - preview.amount);

  return (
    <div className="relative isolate min-h-screen bg-[#0a1224] px-5 pb-32 pt-5 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto max-w-[390px] space-y-4">
        <NutritionTopbar
          backHref={packagesHref}
          title={t("nutritionMembershipPackageSelect.topbarTitle")}
          description={t("nutritionMembershipPackageSelect.topbarDescription")}
          variant="hero"
          compact
        />

        <div className="rounded-[22px] border border-white/10 bg-[#151823] p-4 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.88)]">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <h1 className="text-[19px] font-black leading-7 text-white">{preview.package.name}</h1>
              <div className="mt-3 space-y-2 text-[11px] font-black text-slate-300">
                {preview.package.onlineDietCount > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {t("nutritionMembershipPackageSelect.onlineDietPlans", { count: format.number(preview.package.onlineDietCount) })}
                  </div>
                ) : null}
                {preview.package.offlineDietCount > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {t("nutritionMembershipPackageSelect.offlineDietSessions", { count: format.number(preview.package.offlineDietCount) })}
                  </div>
                ) : null}
              </div>
            </div>
            {preview.package.durationDays > 0 ? (
              <div className="shrink-0 rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-black text-slate-950">
                {t("nutritionMembershipPackages.daysValue", { days: format.number(preview.package.durationDays) })}
              </div>
            ) : null}
          </div>

          {preview.package.imageUrl ? (
            <div className="mt-4 overflow-hidden rounded-[18px] border border-white/10">
              <img src={preview.package.imageUrl} alt={preview.package.name} className="h-28 w-full object-cover" />
            </div>
          ) : null}

        </div>

        <form
          className="space-y-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleApplyDiscount(discountCode);
          }}
        >
          <label htmlFor="nutrition-discount-code" className="block text-[13px] font-black text-white">
            {t("nutritionMembershipPackageSelect.discountCode")}
          </label>
          <div className="flex gap-2.5">
            <Input
              id="nutrition-discount-code"
              value={discountCode}
              onChange={(event) => {
                setDiscountCode(event.target.value.toUpperCase());
                setDiscountError(null);
              }}
              dir="ltr"
              placeholder={t("nutritionMembershipPackageSelect.discountPlaceholder")}
              className="h-11 min-w-0 flex-1 rounded-[15px] border-white/10 bg-white/[0.06] px-3.5 text-start text-[12px] font-black text-white placeholder:text-start placeholder:font-bold placeholder:text-slate-500"
            />
            <Button
              type="submit"
              disabled={discountLoading || !discountCode.trim()}
              className="h-11 shrink-0 rounded-[15px] bg-white px-4 text-[12px] font-black text-slate-950 hover:bg-slate-100"
            >
              {discountLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("nutritionMembershipPackageSelect.applyDiscount")}
            </Button>
          </div>
          {discountError ? <div className="text-[11px] font-bold text-rose-300">{discountError}</div> : null}
          {appliedDiscount ? (
            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-2.5 text-[11px]">
              <div className="flex items-center gap-2 font-black text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                {t("nutritionMembershipPackageSelect.discountApplied")} <CodeText>{appliedDiscount.code}</CodeText>
              </div>
              <button type="button" onClick={() => void handleClearDiscount()} className="font-black text-slate-300">
                {t("nutritionMembershipPackageSelect.removeDiscount")}
              </button>
            </div>
          ) : null}
        </form>

        <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4 shadow-[0_25px_70px_-50px_rgba(255,255,255,0.5)] backdrop-blur-xl">
          <div className="space-y-3 text-[12px] font-black">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">{t("nutritionMembershipPackageSelect.packageAmount")}</span>
              <span className="text-white">{t("nutritionMembershipPackageResult.tomanAmount", { amount: format.number(preview.package.priceAmount) })}</span>
            </div>
            {packageDiscountAmount > 0 ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">{t("nutritionMembershipPackageSelect.packageDiscount")}</span>
                <span className="text-emerald-300">- {t("nutritionMembershipPackageResult.tomanAmount", { amount: format.number(packageDiscountAmount) })}</span>
              </div>
            ) : null}
            {appliedDiscount ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">{t("nutritionMembershipPackageSelect.discountCode")}</span>
                <span className="text-emerald-300">- {t("nutritionMembershipPackageResult.tomanAmount", { amount: format.number(appliedDiscount.discountAmount) })}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-4 h-px bg-white/10" />

          <div className="mt-4 flex items-end justify-between gap-4">
            <span className="text-[13px] font-black text-white">{t("nutritionMembershipPackageSelect.payableAmount")}</span>
            <div className="text-end">
              <span className="text-[22px] font-black text-amber-300">{format.number(preview.payableAmount)}</span>
              <span className="ms-1 text-[11px] font-black text-slate-400">{t("nutritionMembershipPackages.tomanUnit")}</span>
            </div>
          </div>
        </div>

        <div className="rounded-[18px] border border-emerald-400/15 bg-emerald-400/8 px-4 py-3 text-[11px] font-bold leading-6 text-emerald-100">
          {t("nutritionMembershipPackageSelect.activationHint")}
        </div>
        {maliartEnabled ? (
          <div className="rounded-[18px] border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-center text-[12px] font-black text-amber-200">
            {t("payment.directGateway")}
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0a1224]/92 px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-[390px]">
          <Button
            type="button"
            onClick={() => void handlePay()}
            disabled={paying || (!isFreeCheckout && !preview.settings.sandboxEnabled && !maliartEnabled && !selectedGateway)}
            className="h-12 w-full rounded-[17px] border border-rose-300/20 bg-[linear-gradient(135deg,#e11d48,#be123c)] text-[14px] font-black text-white shadow-[0_25px_55px_-28px_rgba(225,29,72,0.92)] hover:opacity-95"
          >
            {paying ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t("nutritionMembershipPackageSelect.preparingPayment")}
              </>
            ) : (
              <>
                {isFreeCheckout
                  ? t("nutritionMembershipPackageSelect.freeCheckoutCta")
                  : t("nutritionMembershipPackageSelect.payCta", { amount: t("nutritionMembershipPackageResult.tomanAmount", { amount: format.number(preview.payableAmount) }) })}
                <ArrowLeft className={isRtl ? "ms-2 h-4 w-4" : "me-2 h-4 w-4 rotate-180"} />
              </>
            )}
          </Button>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            {t("nutritionMembershipPackageSelect.securePayment")}
          </div>
        </div>
      </div>

    </div>
  );
}
