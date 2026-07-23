import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Clock3, HeartPulse, Loader2, Sparkles, Target, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { useAuth } from "@/lib/auth";
import { NutritionStartDialog } from "@/nutrition/components/nutrition-start-dialog";
import { api } from "@/lib/api";
import { getFirstIncompleteNutritionDraftHref, getFirstIncompleteNutritionProfileHref, hasNutritionProfileHomeAccess, isNutritionProfileComplete } from "@/nutrition/lib/profile-completion";
import { getNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { getNutritionLandingVariantSettings, NUTRITION_LANDING_VARIANTS } from "@/nutrition/lib/landing-presets";
import { resolveNutritionStartPath } from "@/nutrition/lib/start-routing";
import { useLocale, useT } from "@/i18n/locale";

export default function NutritionWebAppEntryPage({ forcedPreviewPath }: { forcedPreviewPath?: string } = {}) {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [, setLocation] = useLocation();
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileChecking, setProfileChecking] = useState(false);
  const [incompleteProfileHref, setIncompleteProfileHref] = useState<string | null>(null);
  const [incompleteProfileOpen, setIncompleteProfileOpen] = useState(false);
  const tenantMeta = getInitialTenantMeta();
  const { user } = useAuth();
  const brandName = tenantMeta?.name?.trim() || t("nutritionWebAppEntry.brandFallback");
  const content = getNutritionLandingVariantSettings(tenantMeta, "classic").content;
  const heroImageUrl = getNutritionLandingVariantSettings(tenantMeta, "classic").imageUrl || "/booking-app/nutrition-hero.jpg";
  const currentPreviewPath = forcedPreviewPath || "/nutrition";
  const ActionIcon = isRtl ? ArrowLeft : ArrowRight;

  useEffect(() => {
    if (!user) {
      setProfileReady(false);
      setProfileChecking(false);
      setIncompleteProfileHref(null);
      setIncompleteProfileOpen(false);
      return;
    }

    setProfileChecking(true);
    api.nutrition.getProfile().then((result) => {
      const profile = result.success ? result.data.profile : null;
      const draftHref = profile ? null : getFirstIncompleteNutritionDraftHref(getNutritionFormState());
      setProfileReady(hasNutritionProfileHomeAccess(profile));

      if (!forcedPreviewPath && ((profile && !isNutritionProfileComplete(profile)) || draftHref)) {
        setIncompleteProfileHref(profile ? getFirstIncompleteNutritionProfileHref(profile) ?? "/nutrition/membership/goal" : draftHref);
        setIncompleteProfileOpen(true);
      } else {
        setIncompleteProfileHref(null);
        setIncompleteProfileOpen(false);
      }

      setProfileChecking(false);
    });
  }, [forcedPreviewPath, user]);

  const handleStart = async () => {
    if (user?.name?.trim()) {
      setLocation(await resolveNutritionStartPath());
      return;
    }

    setLoginOpen(true);
  };

  const handleComplete = async () => {
    const nextPath = await resolveNutritionStartPath();
    setLocation(nextPath);
  };
  const ctaTitle = profileChecking ? t("nutritionWebAppEntry.cta.checkingTitle") : profileReady ? t("nutritionWebAppEntry.cta.profileTitle") : content.cta_title;
  const ctaSubtitle = profileChecking ? t("nutritionWebAppEntry.cta.checkingSubtitle") : profileReady ? t("nutritionWebAppEntry.cta.profileSubtitle") : content.cta_subtitle;

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#080b09] text-white" dir={dir}>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,#11150f_0%,#080b09_52%,#050706_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col pb-24">
        <section className="relative mx-3 mt-4 min-h-[46vh] overflow-hidden rounded-[38px]">
          <img
            src={heroImageUrl}
            alt={brandName}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.15)_38%,rgba(8,11,9,0.94)_100%)]" />
          <div className="absolute inset-x-0 top-0 z-10 px-4 pt-6">
            <NutritionTopbar
              backHref="/booking"
              title={t("nutritionWebAppEntry.topbarTitle")}
              description={t("nutritionWebAppEntry.topbarDescription")}
              onRequireLogin={() => setLoginOpen(true)}
              variant="hero"
            />
          </div>
          <div className="absolute bottom-7 start-4 z-10">
            <div className="inline-flex items-center gap-2 border-s-2 border-amber-300/80 ps-3 text-[12px] font-black text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              <Sparkles className="h-4 w-4 text-amber-300" />
              {content.topbar_badge}
            </div>
          </div>
        </section>

        {forcedPreviewPath ? (
          <div className="mx-5 mt-5 flex flex-wrap justify-end gap-2 text-start">
            {NUTRITION_LANDING_VARIANTS.map((item) => {
              const active = currentPreviewPath === item.previewPath;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setLocation(item.previewPath)}
                  className={`rounded-full border px-3 py-2 text-xs font-bold transition ${active ? "border-amber-300/45 bg-amber-300/14 text-amber-100" : "border-white/12 bg-white/6 text-white/75 hover:bg-white/10"}`}
                >
                  {t(`nutritionEntryLanding.variant.${item.key}`)}
                </button>
              );
            })}
          </div>
        ) : null}

        <main className="px-5 pt-5">
          <div className="flex items-center justify-end gap-3 text-end text-[13px] font-black tracking-wide text-amber-300">
            <span className="h-px w-11 rounded-full bg-amber-300" />
            {t("nutritionWebAppEntry.eyebrow")}
          </div>

          <div className="mt-5 space-y-4 text-start">
            <h1 className="text-[29px] font-black leading-[1.52] text-white sm:text-[32px]">
              {content.title_intro}
              <span className="text-amber-300"> {content.title_highlight} </span>
              {content.title_outro}
            </h1>
            <p className="text-[13px] font-bold leading-[2.15] text-zinc-400">
              {content.description}
            </p>
          </div>

          <div className="mt-6 border-e border-white/15 pe-4">
            <p className="text-[11px] font-bold text-zinc-500">{t("nutritionWebAppEntry.featuresTitle")}</p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3" aria-label={t("nutritionWebAppEntry.featuresAria")}>
              <li className="flex items-center gap-2 text-[12px] font-bold text-zinc-300">
                <Clock3 className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                <span>{t("nutritionWebAppEntry.feature.lifestyle")}</span>
              </li>
              <li className="flex items-center gap-2 text-[12px] font-bold text-zinc-300">
                <Utensils className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                <span>{t("nutritionWebAppEntry.feature.body")}</span>
              </li>
              <li className="flex items-center gap-2 text-[12px] font-bold text-zinc-300">
                <Target className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <span>{t("nutritionWebAppEntry.feature.goal")}</span>
              </li>
            </ul>
          </div>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-4 sm:pb-6">
        <div className="mx-auto w-full max-w-md">
          <Button
            type="button"
            onClick={() => void handleStart()}
            className="group h-[74px] w-full rounded-[24px] border border-amber-100/45 bg-[linear-gradient(135deg,#f8cf62_0%,#f7b128_50%,#e9910b_100%)] px-4 text-[#2b1d05] shadow-[0_34px_80px_-32px_rgba(245,158,11,0.9),0_0_48px_-28px_rgba(255,255,255,0.85)] transition-all duration-200 hover:brightness-105"
          >
            <div className="flex w-full items-center justify-between gap-3">
              <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[16px] bg-[#c98212]/36 text-[#3a2605] ring-1 ring-[#6d4308]/8">
                {profileChecking ? <Loader2 className="h-5 w-5 animate-spin" /> : <HeartPulse className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1 text-center">
                <div className="text-[16px] font-black leading-6">
                  {ctaTitle}
                </div>
                <div className="mt-1 text-[11px] font-black leading-4 text-[#6b4308]/78">
                  {ctaSubtitle}
                </div>
              </div>
              <div className={`flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[16px] bg-white/20 text-[#231602] transition-transform duration-200 ${isRtl ? "group-hover:-translate-x-1" : "group-hover:translate-x-1"}`}>
                <ActionIcon className="h-5 w-5" />
              </div>
            </div>
          </Button>
        </div>
      </div>

      <NutritionStartDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onComplete={handleComplete}
      />

      <Dialog open={incompleteProfileOpen} onOpenChange={setIncompleteProfileOpen}>
        <DialogContent className="max-w-[calc(100vw-32px)] overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(155deg,#101d2b_0%,#09131f_55%,#07101a_100%)] p-6 text-white shadow-[0_36px_100px_-34px_rgba(14,165,233,0.42)] sm:max-w-[390px] [&>button[data-dialog-close]]:!left-4 [&>button[data-dialog-close]]:!right-auto [&>button[data-dialog-close]]:!top-4 [&>button[data-dialog-close]]:flex [&>button[data-dialog-close]]:h-10 [&>button[data-dialog-close]]:w-10 [&>button[data-dialog-close]]:items-center [&>button[data-dialog-close]]:justify-center [&>button[data-dialog-close]]:rounded-full [&>button[data-dialog-close]]:border [&>button[data-dialog-close]]:border-white/10 [&>button[data-dialog-close]]:bg-white/[0.06] [&>button[data-dialog-close]]:text-slate-300 [&>button[data-dialog-close]]:opacity-100" dir={dir}>
          <div className="mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-[22px] border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <HeartPulse className="h-8 w-8" />
          </div>
          <DialogHeader className="items-center text-center sm:text-center">
            <DialogTitle className="text-center text-[21px] font-black leading-8">{t("nutritionWebAppEntry.incompleteProfile.title")}</DialogTitle>
            <DialogDescription className="max-w-[315px] text-center text-[12px] font-semibold leading-7 text-slate-300">
              {t("nutritionWebAppEntry.incompleteProfile.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              className="h-[54px] w-full rounded-[18px] border border-amber-200/45 bg-[linear-gradient(135deg,#f5d477_0%,#eab84f_52%,#d99a2b_100%)] font-black text-[#251804] shadow-[0_20px_44px_-24px_rgba(245,183,63,0.8)] transition hover:brightness-105"
              onClick={() => incompleteProfileHref && setLocation(incompleteProfileHref)}
            >
              {t("nutritionWebAppEntry.incompleteProfile.action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
