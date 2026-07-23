import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Loader2, Sparkles } from "lucide-react";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { useAuth } from "@/lib/auth";
import { LoginModal } from "@/components/login-modal";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { useLocale, useT } from "@/i18n/locale";

const heroImageUrl = "/booking-app/nutrition-hero.jpg";

export default function NutritionMembershipAuthPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const { dir } = useLocale();
  const t = useT();
  const tenantMeta = getInitialTenantMeta();
  const brandName = tenantMeta?.name?.trim() || t("nutritionMembershipAuth.defaultBrand");
  const successRedirectRef = useRef(false);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (user?.name?.trim()) {
      setLocation("/nutrition/membership/goal");
    }
  }, [isLoading, setLocation, user]);

  useEffect(() => {
    if (!isLoading && user?.name?.trim()) {
      setLocation("/nutrition/membership/goal");
    }
  }, [isLoading, setLocation, user?.name]);

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] text-white" dir={dir}>
      <div className="absolute inset-0">
        <img src={heroImageUrl} alt={brandName} className="h-full w-full object-cover opacity-20" />
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_28%),linear-gradient(180deg,rgba(7,12,26,0.15),rgba(7,12,26,0.82)_40%,rgba(7,12,26,0.98)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
        <NutritionTopbar
          backHref="/"
          title={t("nutritionMembershipAuth.topbarTitle")}
          description={t("nutritionMembershipAuth.topbarDescription")}
          onRequireLogin={() => setLocation("/nutrition/membership")}
        />
        <div className="space-y-4 rounded-[30px] border border-white/10 bg-[#1e2335]/60 p-6 text-center shadow-[0_30px_80px_-45px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/85 backdrop-blur">
            <Sparkles className="h-4 w-4 text-amber-300" />
            {t("nutritionMembershipAuth.badge")}
          </div>
          <h1 className="text-2xl font-black leading-tight">{t("nutritionMembershipAuth.title")}</h1>
          <p className="text-sm leading-8 text-slate-300">
            {t("nutritionMembershipAuth.description")}
          </p>
          {isLoading && (
            <div className="flex items-center justify-center pt-2">
              <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
            </div>
          )}
        </div>
      </div>

      <LoginModal
        isOpen
        onClose={() => {
          if (!successRedirectRef.current) {
            setLocation("/nutrition");
          }
        }}
        onDismiss={() => {
          if (!successRedirectRef.current) {
            setLocation("/nutrition");
          }
        }}
        onSuccess={() => {
          successRedirectRef.current = true;
          setLocation("/nutrition/membership/goal");
        }}
        phoneStepDescription={t("nutritionMembershipAuth.phoneStepDescription")}
      />
    </div>
  );
}
