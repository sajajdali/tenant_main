import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CalendarDays, ChevronLeft, Pill, ShoppingBag, Sparkles, Star, Stethoscope, UtensilsCrossed } from "lucide-react";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { NutritionStartDialog } from "@/nutrition/components/nutrition-start-dialog";
import { getNutritionLandingVariantSettings, NUTRITION_LANDING_VARIANTS } from "@/nutrition/lib/landing-presets";
import NutritionWebAppEntryPage from "@/nutrition/pages/nutrition-webapp-entry";
import { useAuth } from "@/lib/auth";
import { resolveNutritionStartPath } from "@/nutrition/lib/start-routing";
import { isAppointmentBookingDisabled } from "@/lib/audience";
import { useLocale, useT } from "@/i18n/locale";

type EntryCard = {
  key: "nutrition" | "booking" | "store";
  href: string;
  icon: typeof Stethoscope;
};

const ENTRY_OPTIONS: EntryCard[] = [
  { key: "nutrition", href: "/nutrition/membership/goal", icon: Stethoscope },
  { key: "booking", href: "/booking", icon: CalendarDays },
  { key: "store", href: "/store", icon: ShoppingBag },
];

function PreviewTabs({ currentPath }: { currentPath: string }) {
  const t = useT();
  const [, setLocation] = useLocation();

  return (
    <div className="mt-2 flex flex-wrap justify-end gap-2 text-start">
      {NUTRITION_LANDING_VARIANTS.map((item) => {
        const active = currentPath === item.previewPath;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setLocation(item.previewPath)}
            className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
              active
                ? "border-amber-300/45 bg-amber-300/14 text-amber-100"
                : "border-white/12 bg-white/6 text-white/75 hover:bg-white/10"
            }`}
          >
            {t(`nutritionEntryLanding.variant.${item.key}`)}
          </button>
        );
      })}
    </div>
  );
}

function PreviewFooter() {
  const t = useT();

  return (
    <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 text-sm leading-8 text-white/78 backdrop-blur-xl">
      <div className="mb-2 font-black text-white">{t("nutritionEntryLanding.previewPaths")}</div>
      {NUTRITION_LANDING_VARIANTS.map((item) => (
        <div key={item.key} dir="ltr" className="text-start">
          {item.previewPath}
        </div>
      ))}
    </div>
  );
}

function DietEditorialLanding({ previewMode = false }: { previewMode?: boolean }) {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [, setLocation] = useLocation();
  const [loginOpen, setLoginOpen] = useState(false);
  const { user } = useAuth();
  const tenantMeta = getInitialTenantMeta();
  const brandName = tenantMeta?.name?.trim() || t("nutritionEntryLanding.brandFallback");
  const variant = getNutritionLandingVariantSettings(tenantMeta, "diet");
  const content = variant.content;
  const heroImageUrl = variant.imageUrl || "/booking-app/nutrition-hero.jpg";
  const ActionIcon = isRtl ? ArrowLeft : ChevronLeft;

  const handleNutritionStart = async () => {
    if (user?.name?.trim()) {
      setLocation(await resolveNutritionStartPath());
      return;
    }

    setLoginOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#120d09] text-white" dir={dir}>
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.2),transparent_28%),linear-gradient(135deg,#140d08_0%,#25160d_40%,#0f172a_100%)]" />
        <div className="absolute inset-y-0 start-0 -z-10 hidden w-[46%] lg:block">
          <img src={heroImageUrl} alt={brandName} className="h-full w-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,6,5,0.2),rgba(9,6,5,0.88)_82%,rgba(9,6,5,1)_100%)]" />
        </div>

        <div className="mx-auto min-h-screen w-full max-w-7xl px-5 pb-10 pt-10 sm:px-8 lg:px-10">
          <NutritionTopbar
            backHref="/booking"
            title={t("nutritionEntryLanding.diet.topbarTitle")}
            description={t("nutritionEntryLanding.diet.topbarDescription")}
            onRequireLogin={() => setLoginOpen(true)}
          />

          {previewMode ? <PreviewTabs currentPath="/nutrition/landing-diet" /> : null}

          <div className="mt-8 grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
            <div className="lg:hidden">
              <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-[0_30px_90px_-50px_rgba(0,0,0,0.95)]">
                <img src={heroImageUrl} alt={brandName} className="h-72 w-full object-cover" />
              </div>
            </div>

            <div className="space-y-6 pb-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-black text-amber-200">
                <Sparkles className="h-4 w-4" />
                {content.badge}
              </div>

              <div className="max-w-3xl space-y-5">
                <div className="text-sm font-bold tracking-[0.28em] text-amber-100/75">{content.eyebrow}</div>
                <h1 className="text-4xl font-black leading-[1.18] sm:text-6xl">
                  {content.title}
                  <span className="mx-2 bg-[linear-gradient(135deg,#fde68a_0%,#f59e0b_45%,#fb7185_100%)] bg-clip-text text-transparent">
                    {content.highlight}
                  </span>
                </h1>
                <p className="max-w-2xl text-base leading-9 text-white/78 sm:text-lg">{content.description}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                  <div className="text-xs font-bold text-amber-200/80">{t("nutritionEntryLanding.mainBenefit")}</div>
                  <div className="mt-3 text-2xl font-black">{content.feature_title}</div>
                  <div className="mt-3 text-sm leading-8 text-white/72">{content.feature_body}</div>
                </div>
                <div className="rounded-[30px] border border-white/10 bg-black/18 p-5 backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-amber-300/14 text-amber-200">
                      <UtensilsCrossed className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white/55">{t("nutritionEntryLanding.versionSlogan")}</div>
                      <div className="text-lg font-black">{content.quote_title}</div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm leading-8 text-white/72">{content.quote_body}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[40px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-4 shadow-[0_50px_120px_-60px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:p-6">
              <div className="overflow-hidden rounded-[32px] border border-white/10 bg-black/20">
                <img src={heroImageUrl} alt={brandName} className="h-72 w-full object-cover sm:h-[420px]" />
              </div>

              <div className="mt-6 rounded-[30px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(244,114,182,0.08))] p-6">
                <div className="text-sm font-bold text-amber-100">{t("nutritionEntryLanding.primaryEntry")}</div>
                <div className="mt-2 text-3xl font-black">{content.cta_label}</div>
                <div className="mt-3 text-sm leading-8 text-white/78">{content.cta_body}</div>

                <button
                  type="button"
                  onClick={() => void handleNutritionStart()}
                  className="mt-6 flex w-full items-center justify-between rounded-[24px] bg-[linear-gradient(135deg,#fde68a_0%,#f59e0b_48%,#fb923c_100%)] px-5 py-4 text-start text-slate-950 shadow-[0_24px_70px_-30px_rgba(245,158,11,0.8)] transition hover:brightness-105"
                >
                  <div>
                    <div className="text-xs font-black text-slate-900/70">{t("nutritionEntryLanding.primaryCta")}</div>
                    <div className="mt-1 text-xl font-black">{content.cta_label}</div>
                  </div>
                  <ActionIcon className="h-6 w-6" />
                </button>
              </div>

              {previewMode ? (
                <div className="mt-4">
                  <PreviewFooter />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <NutritionStartDialog open={loginOpen} onOpenChange={setLoginOpen} onComplete={async () => setLocation(await resolveNutritionStartPath())} />
    </div>
  );
}

function AllFeaturesCommandLanding({ previewMode = false }: { previewMode?: boolean }) {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [, setLocation] = useLocation();
  const [loginOpen, setLoginOpen] = useState(false);
  const { user } = useAuth();
  const tenantMeta = getInitialTenantMeta();
  const variant = getNutritionLandingVariantSettings(tenantMeta, "all_features");
  const content = variant.content;
  const visibleEntryOptions = ENTRY_OPTIONS.filter((item) => item.key !== "booking" || !isAppointmentBookingDisabled(tenantMeta));

  const optionStyles = {
    nutrition: "from-amber-300/30 to-orange-400/12 border-amber-300/25",
    booking: "from-sky-300/30 to-blue-400/12 border-sky-300/25",
    store: "from-emerald-300/30 to-teal-400/12 border-emerald-300/25",
  } as const;

  const handleOptionClick = async (href: string, key: EntryCard["key"]) => {
    if (key !== "nutrition") {
      setLocation(href);
      return;
    }

    if (user?.name?.trim()) {
      setLocation(await resolveNutritionStartPath());
      return;
    }

    setLoginOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#06131d] text-white" dir={dir}>
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,#07121d_0%,#0d2230_52%,#07131b_100%)]" />

      <div className="mx-auto w-full max-w-7xl px-5 pb-12 pt-10 sm:px-8 lg:px-10">
        <NutritionTopbar
          backHref="/booking"
          title={t("nutritionEntryLanding.allFeatures.topbarTitle")}
          description={t("nutritionEntryLanding.allFeatures.topbarDescription")}
          onRequireLogin={() => setLoginOpen(true)}
        />

        {previewMode ? <PreviewTabs currentPath="/nutrition/landing-all-features" /> : null}

        <section className="mt-8 overflow-hidden rounded-[40px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_40px_120px_-65px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-xs font-black text-sky-100">
                <Star className="h-4 w-4" />
                {content.badge}
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.18] sm:text-6xl">
                {content.title}
                <span className="mt-2 block text-sky-200">{content.subtitle}</span>
              </h1>
              <p className="max-w-2xl text-base leading-9 text-white/75">{content.description}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[28px] border border-white/10 bg-black/18 p-5">
                <div className="text-xs font-bold text-white/55">{t("nutritionEntryLanding.suitableBrands")}</div>
                <div className="mt-3 text-xl font-black">{content.insight_title}</div>
                <div className="mt-3 text-sm leading-8 text-white/70">{content.insight_body}</div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-black/18 p-5">
                <div className="text-xs font-bold text-white/55">{t("nutritionEntryLanding.userBehavior")}</div>
                <div className="mt-3 text-xl font-black">{content.behavior_title}</div>
                <div className="mt-3 text-sm leading-8 text-white/70">{content.behavior_body}</div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {visibleEntryOptions.map((item) => {
              const Icon = item.icon;
              const title = content[`${item.key}_title`] ?? "";
              const description = content[`${item.key}_description`] ?? "";

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => void handleOptionClick(item.href, item.key)}
                  className={`group relative overflow-hidden rounded-[34px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 text-start shadow-[0_30px_90px_-58px_rgba(0,0,0,0.95)] transition-all duration-200 hover:-translate-y-1 ${optionStyles[item.key]}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.key === "nutrition" ? "from-amber-300/18 to-transparent" : item.key === "booking" ? "from-sky-300/18 to-transparent" : "from-emerald-300/18 to-transparent"}`} />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div className={`flex h-16 w-16 items-center justify-center rounded-[22px] ${item.key === "nutrition" ? "bg-amber-300/16 text-amber-100" : item.key === "booking" ? "bg-sky-300/16 text-sky-100" : "bg-emerald-300/16 text-emerald-100"}`}>
                        <Icon className="h-7 w-7" />
                      </div>
                      <ChevronLeft className={`h-6 w-6 text-white/55 transition ${isRtl ? "group-hover:-translate-x-1" : "rotate-180 group-hover:translate-x-1"}`} />
                    </div>

                    <div className="mt-10 text-3xl font-black">{title}</div>
                    <div className="mt-4 text-sm leading-8 text-white/72">{description}</div>

                    <div className="mt-8 flex items-center justify-between text-sm font-bold">
                      <span className="text-white/88">{t("nutritionEntryLanding.enterSection")}</span>
                      <span className={item.key === "nutrition" ? "text-amber-200" : item.key === "booking" ? "text-sky-200" : "text-emerald-200"}>
                        {t("nutritionEntryLanding.choose")}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {previewMode ? (
            <div className="mt-5">
              <PreviewFooter />
            </div>
          ) : null}
        </section>
      </div>

      <NutritionStartDialog open={loginOpen} onOpenChange={setLoginOpen} onComplete={async () => setLocation(await resolveNutritionStartPath())} />
    </div>
  );
}

function DietPrioritySplitLanding({ previewMode = false }: { previewMode?: boolean }) {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [, setLocation] = useLocation();
  const [loginOpen, setLoginOpen] = useState(false);
  const { user } = useAuth();
  const tenantMeta = getInitialTenantMeta();
  const brandName = tenantMeta?.name?.trim() || t("nutritionEntryLanding.brandFallback");
  const variant = getNutritionLandingVariantSettings(tenantMeta, "diet_priority");
  const content = variant.content;
  const heroImageUrl = variant.imageUrl || "/booking-app/nutrition-hero.jpg";
  const nutritionOption = ENTRY_OPTIONS[0];
  const nutritionIcon = nutritionOption.icon;
  const ActionIcon = isRtl ? ArrowLeft : ChevronLeft;
  const secondaryOptions = ENTRY_OPTIONS.slice(1).filter((item) => item.key !== "booking" || !isAppointmentBookingDisabled(tenantMeta));

  const handleNutritionStart = async () => {
    if (user?.name?.trim()) {
      setLocation(await resolveNutritionStartPath());
      return;
    }

    setLoginOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#09101d] text-white" dir={dir}>
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_22%),linear-gradient(180deg,#0b1120_0%,#10192d_36%,#08111b_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="mx-auto w-full max-w-md px-4 pb-12 pt-8 sm:max-w-lg">
        <NutritionTopbar
          backHref="/booking"
          title={t("nutritionEntryLanding.dietPriority.topbarTitle")}
          description={t("nutritionEntryLanding.dietPriority.topbarDescription")}
          onRequireLogin={() => setLoginOpen(true)}
        />

        {previewMode ? <PreviewTabs currentPath="/nutrition/landing-diet-priority" /> : null}

        <div className="mt-6 space-y-4">
          <button
            type="button"
            onClick={() => void handleNutritionStart()}
            className="group relative block w-full overflow-hidden rounded-[34px] border border-amber-300/22 bg-[linear-gradient(180deg,rgba(251,191,36,0.16),rgba(255,255,255,0.04),rgba(255,255,255,0.03))] p-4 text-start shadow-[0_35px_100px_-65px_rgba(251,191,36,0.9)]"
          >
            <div className="absolute inset-0 opacity-55">
              <img src={heroImageUrl} alt={brandName} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,15,25,0.14),rgba(8,15,25,0.72)_48%,rgba(8,15,25,0.96)_100%)]" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-black/18 px-3 py-2 text-[11px] font-black text-amber-100 backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                  {content.hero_badge}
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-amber-300/14 text-amber-100 backdrop-blur">
                  {(() => {
                    const NutritionIcon = nutritionIcon;
                    return <NutritionIcon className="h-6 w-6" />;
                  })()}
                </div>
              </div>

              <div className="mt-28">
                <div className="max-w-[15rem] text-4xl font-black leading-[1.12] sm:text-5xl">{content.hero_title}</div>
                <div className="mt-4 text-sm leading-8 text-white/82">{content.hero_description}</div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <div className="rounded-full border border-white/12 bg-black/18 px-3 py-2 text-[11px] font-bold text-white/82 backdrop-blur">
                  {content.chip_one}
                </div>
                <div className="rounded-full border border-white/12 bg-black/18 px-3 py-2 text-[11px] font-bold text-white/82 backdrop-blur">
                  {content.chip_two}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-[24px] border border-white/10 bg-black/24 px-4 py-4 backdrop-blur-xl">
                <div>
                  <div className="text-xs font-bold text-white/55">{content.cta_subtitle}</div>
                  <div className="mt-1 text-xl font-black">{content.cta_title}</div>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-white/88 text-slate-950 transition ${isRtl ? "group-hover:-translate-x-1" : "group-hover:translate-x-1"}`}>
                  <ActionIcon className="h-5 w-5" />
                </div>
              </div>
            </div>
          </button>

          <div className="grid gap-4 sm:grid-cols-2">
            {secondaryOptions.map((item) => {
              const Icon = item.icon;
              const title = content[`${item.key}_title`] ?? "";
              const description = content[`${item.key}_description`] ?? "";
              const tone = item.key === "booking" ? "bg-sky-300/14 text-sky-100" : "bg-emerald-300/14 text-emerald-100";

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setLocation(item.href)}
                  className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 text-start shadow-[0_24px_70px_-52px_rgba(0,0,0,0.95)] backdrop-blur-xl transition hover:-translate-y-1"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-[18px] ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-5 text-xl font-black">{title}</div>
                  <div className="mt-2 text-sm leading-7 text-white/70">{description}</div>
                </button>
              );
            })}
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 shadow-[0_22px_70px_-54px_rgba(0,0,0,0.95)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-pink-300/14 text-pink-100">
                <Pill className="h-5 w-5" />
              </div>
              <div>
                <div className="font-black">{content.summary_title}</div>
                <div className="text-xs text-white/55">{t("nutritionEntryLanding.mobileCompact")}</div>
              </div>
            </div>

            <div className="mt-4 text-sm leading-8 text-white/72">{content.summary_description}</div>

            {previewMode ? (
              <div className="mt-4">
                <PreviewFooter />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <NutritionStartDialog open={loginOpen} onOpenChange={setLoginOpen} onComplete={async () => setLocation(await resolveNutritionStartPath())} />
    </div>
  );
}

export function NutritionClassicLandingPage() {
  return <NutritionWebAppEntryPage forcedPreviewPath="/nutrition/landing-classic" />;
}

export function NutritionDietLandingPage() {
  return <DietEditorialLanding />;
}

export function NutritionAllFeaturesLandingPage() {
  return <AllFeaturesCommandLanding />;
}

export function NutritionDietPriorityLandingPage() {
  return <DietPrioritySplitLanding />;
}

export function NutritionDietLandingPreviewPage() {
  return <DietEditorialLanding previewMode />;
}

export function NutritionAllFeaturesLandingPreviewPage() {
  return <AllFeaturesCommandLanding previewMode />;
}

export function NutritionDietPriorityLandingPreviewPage() {
  return <DietPrioritySplitLanding previewMode />;
}
