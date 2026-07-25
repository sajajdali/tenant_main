import { useEffect, useMemo, useState } from "react";
import { Apple, ArrowLeft, BarChart3, Boxes, CalendarClock, Camera, ChevronLeft, CircleHelp, ClipboardList, Crown, Headphones, Loader2, Shield, ShieldAlert, Sparkles, Target, UserRound, Utensils } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { getNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { NutritionPackageItem, NutritionPackageSubscription } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";

function getDiscountPercent(item: NutritionPackageItem) {
  if (!item.discountedPriceAmount || item.discountedPriceAmount >= item.priceAmount || item.priceAmount <= 0) {
    return null;
  }

  return Math.round(((item.priceAmount - item.discountedPriceAmount) / item.priceAmount) * 100);
}

function findPackagePath(items: NutritionPackageItem[], packageId: string): NutritionPackageItem[] | null {
  for (const item of items) {
    if (item.id === packageId) {
      return [item];
    }

    const childPath = findPackagePath(item.children ?? [], packageId);
    if (childPath) {
      return [item, ...childPath];
    }
  }

  return null;
}

function remainingSubscriptionDays(endsAt?: string | null) {
  if (!endsAt) return 0;

  const [year, month, day] = endsAt.split("-").map(Number);
  const today = new Date();
  const endUtc = Date.UTC(year, month - 1, day);
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  return Math.max(0, Math.round((endUtc - todayUtc) / 86_400_000));
}

const packageFeatureIcons = {
  clipboard: ClipboardList,
  user: UserRound,
  target: Target,
  chart: BarChart3,
  headphones: Headphones,
  utensils: Utensils,
  camera: Camera,
  apple: Apple,
  shield: Shield,
  sparkles: Sparkles,
};

function PackageFeatureIcon({ name }: { name: string }) {
  const Icon = packageFeatureIcons[name as keyof typeof packageFeatureIcons] ?? ClipboardList;

  return <Icon className="h-4 w-4" />;
}

export default function NutritionMembershipPackagesPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/nutrition/membership/packages/:packageId");
  const { user, isLoading } = useAuth();
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
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NutritionPackageItem[]>([]);
  const [goalLabel, setGoalLabel] = useState("");
  const [descriptionPackage, setDescriptionPackage] = useState<NutritionPackageItem | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<NutritionPackageSubscription | null>(null);
  const [replacementDestination, setReplacementDestination] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (!directBuy && (!formState.completedProfileSaved || !formState.targetWeightKg)) {
      setLocation("/nutrition/membership/target-weight");
      return;
    }

    if (!directBuy) {
      const firstIncompletePreferencesHref = formState.medicalConditions === undefined && formState.medicalConditionsItems === undefined
        ? "/nutrition/membership/medical-conditions"
        : formState.medicationsAndSupplements === undefined
          ? "/nutrition/membership/medications-and-supplements"
          : formState.foodAllergies === undefined
            ? "/nutrition/membership/allergies"
            : formState.dislikedFoods === undefined
              ? "/nutrition/membership/disliked-foods"
              : null;

      if (firstIncompletePreferencesHref) {
        setLocation(firstIncompletePreferencesHref);
        return;
      }
    }

    const load = async () => {
      const profileResult = await api.nutrition.getProfile();
      const goal = formState.dietGoal ?? profileResult.data.profile?.dietGoal;

      if (!goal) {
        setLocation(directBuy ? "/nutrition/membership/my-package" : "/nutrition/membership/goal");
        return;
      }

      const packageResult = await api.nutritionPackages.listPublic(goal);

      if (directBuy) {
        const summaryResult = await api.nutritionPackageCheckout.summary();
        setActiveSubscription(summaryResult.success ? summaryResult.data.subscription ?? null : null);
      }

      if (!packageResult.success) {
        setItems([]);
        setLoading(false);
        return;
      }

      setGoalLabel(
        goal === "lose-weight"
          ? t("nutritionMembershipGoal.option.loseWeight")
          : goal === "gain-weight"
            ? t("nutritionMembershipGoal.option.gainWeight")
            : t("nutritionMembershipGoal.option.maintainWeight"),
      );
      setItems(packageResult.data.items);
      setLoading(false);
    };

    void load();
  }, [
    formState.completedProfileSaved,
    formState.dietGoal,
    formState.medicalConditions,
    formState.medicalConditionsItems,
    formState.medicationsAndSupplements,
    formState.dislikedFoods,
    formState.foodAllergies,
    formState.targetWeightKg,
    directBuy,
    t,
    isLoading,
    setLocation,
    user,
  ]);

  const activePath = useMemo(() => {
    if (!match || !params?.packageId) {
      return null;
    }

    return findPackagePath(items, params.packageId) ?? null;
  }, [items, match, params?.packageId]);

  useEffect(() => {
    if (!loading && match && params?.packageId && !activePath) {
      setLocation(`/nutrition/membership/packages${directBuy ? "?direct_buy=1" : ""}`);
    }
  }, [activePath, directBuy, loading, match, params?.packageId, setLocation]);

  const currentNode = activePath ? activePath[activePath.length - 1] : null;
  const visibleItems = currentNode ? currentNode.children ?? [] : items;
  const parentNode = activePath && activePath.length > 1 ? activePath[activePath.length - 2] : null;
  const backHref = currentNode
    ? parentNode
      ? `/nutrition/membership/packages/${parentNode.id}${directBuy ? "?direct_buy=1" : ""}`
      : `/nutrition/membership/packages${directBuy ? "?direct_buy=1" : ""}`
    : directBuy
      ? "/nutrition/membership/my-package"
      : "/nutrition/membership/disliked-foods";
  const activeRemainingDays = remainingSubscriptionDays(activeSubscription?.endsAt);
  const needsReplacementConfirmation = directBuy && activeSubscription?.status === "active" && activeRemainingDays > 10;

  const navigateToPackage = (destination: string, hasChildren: boolean) => {
    if (!hasChildren && needsReplacementConfirmation) {
      setReplacementDestination(destination);
      return;
    }

    setLocation(destination);
  };

  const confirmReplacement = () => {
    if (!replacementDestination) return;

    const separator = replacementDestination.includes("?") ? "&" : "?";
    setLocation(`${replacementDestination}${separator}replace_active=1`);
  };

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

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.13),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.16),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[390px] flex-col px-5 pb-7 pt-5">
        <NutritionTopbar backHref={backHref} title={t("nutritionMembershipPackages.topbarTitle")} description={t("nutritionMembershipPackages.topbarDescription")} variant="hero" compact />

        <section className="mt-5 rounded-[24px] border border-white/10 bg-[#070d18]/35 px-4 py-5 text-center shadow-[0_30px_85px_-55px_rgba(0,0,0,0.95)]">
          <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border border-amber-300/24 bg-amber-400/10 text-amber-300 shadow-[0_24px_55px_-38px_rgba(251,191,36,0.75)]">
            <Boxes className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-[22px] font-black leading-8 text-white">
            {currentNode ? t("nutritionMembershipPackages.selectNodeTitle", { name: currentNode.name }) : t("nutritionMembershipPackages.title")}
          </h1>
          <p className="mx-auto mt-2 max-w-[300px] text-[11px] font-bold leading-6 text-slate-400">
            {currentNode ? t("nutritionMembershipPackages.nodeDescription") : t("nutritionMembershipPackages.description")}
          </p>
        </section>

        {!currentNode && goalLabel ? (
          <section className="mt-4 flex items-center justify-between rounded-[19px] border border-white/10 bg-[#101826]/80 px-4 py-3.5 shadow-[0_20px_55px_-46px_rgba(0,0,0,0.9)]">
            <div className="text-start">
              <div className="text-[11px] font-black text-amber-300">{t("nutritionMembershipPackages.selectedGoal")}</div>
              <div className="mt-1.5 text-[17px] font-black leading-6 text-white">{goalLabel}</div>
            </div>
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[15px] border border-amber-300/22 bg-amber-400/10 text-amber-300">
              <Sparkles className="h-[18px] w-[18px]" />
            </div>
          </section>
        ) : null}

        {activePath && activePath.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {activePath.map((item) => (
              <Badge key={item.id} variant="outline" className="rounded-[10px] border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200">
                {item.name}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-6 space-y-8">
          {visibleItems.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-slate-950/18 px-4 py-8 text-center">
              <Crown className="mx-auto mb-3 h-8 w-8 text-amber-300" />
              <div className="text-[14px] font-black">{t("nutritionMembershipPackages.emptyTitle")}</div>
              <div className="mt-2 text-[12px] leading-6 text-slate-400">{t("nutritionMembershipPackages.emptyDescription")}</div>
            </div>
          ) : (
            visibleItems.map((item) => {
              const hasChildren = (item.children ?? []).length > 0;
              const effectivePrice = item.discountedPriceAmount ?? item.priceAmount;
              const discountPercent = getDiscountPercent(item);
              const badgeTitle = item.badgeTitle?.trim() || (discountPercent ? t("nutritionMembershipPackages.specialDiscount") : "");
              const featured = !hasChildren && (Boolean(item.isRecommended) || badgeTitle !== "" || item.visualStyle === "gold" || item.visualStyle === "vip");
              const imageUrl = item.imageUrl?.trim();
              const packageDescription = item.description?.trim() ?? "";
              const featureRows = (item.features ?? []).filter((feature) => feature.text?.trim());
              const destination = hasChildren
                ? `/nutrition/membership/packages/${item.id}${directBuy ? "?direct_buy=1" : ""}`
                : `/nutrition/membership/packages/${item.id}/select${directBuy ? "?direct_buy=1" : ""}`;

              return (
                <div
                  key={item.id}
                  onClick={() => navigateToPackage(destination, hasChildren)}
                  className={`relative mt-1 w-full overflow-visible rounded-[22px] border p-4 text-start shadow-[0_24px_50px_-35px_rgba(0,0,0,0.78)] transition hover:-translate-y-0.5 hover:border-amber-300/45 hover:bg-white/[0.06] ${
                    featured
                      ? "border-amber-300/60 bg-amber-400/[0.045]"
                      : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(15,23,42,0.24))]"
                  }`}
                >
                  {badgeTitle ? (
                    <div className="absolute -top-3.5 end-4 rounded-[11px] bg-gradient-to-l from-amber-500 to-amber-300 px-3 py-1.5 text-[10px] font-black text-slate-950 shadow-[0_18px_45px_-28px_rgba(251,191,36,0.95)]">
                      {badgeTitle}
                    </div>
                  ) : null}

                  {imageUrl ? (
                    <div className="mb-4 overflow-hidden rounded-[18px] border border-white/10">
                      <img src={imageUrl} alt={item.name} className="h-28 w-full object-cover" />
                    </div>
                  ) : null}

                  <div className="flex items-start justify-between gap-5">
                    <div className="min-w-0 pt-1.5">
                      <div className="text-[19px] font-black leading-7 text-white">{item.shortTitle?.trim() || item.name}</div>
                      {item.subtitle ? <div className="mt-1 text-[12px] font-black leading-6 text-amber-300">{item.subtitle}</div> : null}
                      {!currentNode && packageDescription ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDescriptionPackage(item);
                          }}
                          className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/24 bg-amber-300/10 px-3 py-1.5 text-[11px] font-black text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-amber-300/45 hover:bg-amber-300/16 hover:text-amber-100"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-300 text-slate-950">
                            <CircleHelp className="h-3.5 w-3.5" />
                          </span>
                          {t("nutritionMembershipPackages.descriptionLink")}
                        </button>
                      ) : null}
                      <div className="mt-2 flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
                        <span className="text-[18px] font-black text-amber-300">{format.number(effectivePrice)}</span>
                        <span className="text-[10px] font-black text-slate-400">{t("nutritionMembershipPackages.tomanUnit")}</span>
                        {item.discountedPriceAmount && item.discountedPriceAmount < item.priceAmount ? (
                          <span className="text-[9px] font-bold text-slate-500 line-through">{format.number(item.priceAmount)}</span>
                        ) : null}
                        {discountPercent ? (
                          <span className="rounded-[9px] bg-emerald-400/12 px-2 py-1 text-[9px] font-black text-emerald-300">
                            {t("nutritionMembershipPackages.discountPercent", { percent: format.number(discountPercent) })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border ${
                      featured ? "border-amber-300 bg-amber-400 text-slate-950 shadow-[0_22px_44px_-26px_rgba(251,191,36,0.95)]" : "border-white/15 bg-white/[0.04] text-slate-400"
                    }`}>
                      {hasChildren ? <ChevronLeft className={isRtl ? "h-5 w-5" : "h-5 w-5 rotate-180"} /> : <ArrowLeft className={isRtl ? "h-5 w-5" : "h-5 w-5 rotate-180"} />}
                    </div>
                  </div>

                  <div className="my-4 h-px bg-white/10" />

                  {featureRows.length > 0 ? (
                    <div className="grid gap-3 text-[12px]">
                      {featureRows.map((feature, index) => (
                        <div key={`${feature.icon}-${index}`} className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-3 border-b border-white/7 pb-2.5 last:border-b-0 last:pb-0">
                          <span className="flex h-6 w-6 items-center justify-center text-amber-300"><PackageFeatureIcon name={feature.icon} /></span>
                          <span className="font-bold leading-6 text-slate-200">{feature.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-[1fr_auto] gap-x-7 gap-y-2.5 text-[12px]">
                      {item.durationDays > 0 ? (
                        <>
                          <div className="font-black text-slate-500">{t("nutritionMembershipPackages.duration")}</div>
                          <div className="text-end font-black text-white">{t("nutritionMembershipPackages.daysValue", { days: format.number(item.durationDays) })}</div>
                        </>
                      ) : null}
                      {item.onlineDietCount > 0 ? (
                        <>
                          <div className="font-black text-slate-500">{t("nutritionMembershipPackages.onlineDiet")}</div>
                          <div className="text-end font-black text-white">{t("nutritionMembershipPackages.planValue", { count: format.number(item.onlineDietCount) })}</div>
                        </>
                      ) : null}
                      {item.offlineDietCount > 0 ? (
                        <>
                          <div className="font-black text-slate-500">{t("nutritionMembershipPackages.offlineDiet")}</div>
                          <div className="text-end font-black text-white">{t("nutritionMembershipPackages.sessionValue", { count: format.number(item.offlineDietCount) })}</div>
                        </>
                      ) : null}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigateToPackage(destination, hasChildren);
                    }}
                    className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-[12px] border border-amber-300/25 bg-white/[0.025] px-4 text-[12px] font-black text-amber-200 transition hover:border-amber-300/45 hover:bg-amber-400/10 hover:text-amber-100"
                  >
                    {item.actionLabel?.trim() || (hasChildren ? t("nutritionMembershipPackages.viewOptions") : t("nutritionMembershipPackages.orderPackage"))}
                    <ArrowLeft className={isRtl ? "h-3.5 w-3.5 opacity-70" : "h-3.5 w-3.5 rotate-180 opacity-70"} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={!!descriptionPackage} onOpenChange={(open) => !open && setDescriptionPackage(null)}>
        <DialogContent className="max-h-[82vh] max-w-[390px] overflow-y-auto rounded-[24px] border-white/10 bg-[#151b2a] px-6 pb-6 pt-14 text-white shadow-[0_32px_100px_-42px_rgba(0,0,0,0.98)] [&>button]:end-4 [&>button]:start-auto [&>button]:top-4 [&>button]:h-7 [&>button]:w-7 [&>button]:rounded-full [&>button]:border-0 [&>button]:bg-transparent [&>button]:p-1.5 [&>button]:text-slate-300 [&>button]:opacity-75 [&>button]:ring-offset-transparent hover:[&>button]:bg-white/8 hover:[&>button]:text-white hover:[&>button]:opacity-100 [&>button_svg]:h-4 [&>button_svg]:w-4" dir={dir}>
          <DialogTitle className="sr-only">{descriptionPackage?.name ?? t("nutritionMembershipPackages.descriptionLink")}</DialogTitle>
          <div className="whitespace-pre-line text-start text-[15px] font-bold leading-9 text-slate-100">
            {descriptionPackage?.description?.trim()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!replacementDestination} onOpenChange={(open) => !open && setReplacementDestination(null)}>
        <DialogContent className="max-w-[370px] rounded-[28px] border border-amber-300/25 bg-[#111827] p-0 text-white shadow-[0_38px_120px_-42px_rgba(245,158,11,0.48)] [&>button]:end-4 [&>button]:start-auto [&>button]:top-4 [&>button]:text-slate-300" dir={dir}>
          <DialogTitle className="sr-only">{t("nutritionMembershipPackages.replacementDialog.title")}</DialogTitle>
          <div className="overflow-hidden rounded-[28px]">
            <div className="bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.22),transparent_66%)] px-6 pb-5 pt-7 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-amber-300/30 bg-amber-300/12 text-amber-300">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-[20px] font-black leading-8">{t("nutritionMembershipPackages.replacementDialog.title")}</h2>
              <p className="mt-2 text-[12px] font-bold leading-6 text-slate-300">
                {t("nutritionMembershipPackages.replacementDialog.description")}
              </p>
            </div>

            <div className="mx-5 rounded-[18px] border border-amber-300/18 bg-amber-300/[0.07] px-4 py-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[11px] font-black text-slate-300">
                  <CalendarClock className="h-4 w-4 text-amber-300" />
                  {t("nutritionMembershipPackages.replacementDialog.remainingLabel")}
                </div>
                <div className="text-[14px] font-black text-amber-200">
                  {t("nutritionMembershipPackages.daysValue", { days: format.number(activeRemainingDays) })}
                </div>
              </div>
              <div className="mt-3 border-t border-white/8 pt-3 text-[11px] font-bold leading-6 text-slate-400">
                {t("nutritionMembershipPackages.replacementDialog.resetNotice")}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5">
              <button
                type="button"
                onClick={() => setReplacementDestination(null)}
                className="h-12 rounded-[16px] border border-white/10 bg-white/[0.04] text-[12px] font-black text-slate-200 transition hover:bg-white/[0.08]"
              >
                {t("nutritionMembershipPackages.replacementDialog.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmReplacement}
                className="h-12 rounded-[16px] bg-gradient-to-l from-amber-500 to-amber-300 text-[12px] font-black text-slate-950 shadow-[0_20px_45px_-24px_rgba(251,191,36,0.9)] transition hover:brightness-105"
              >
                {t("nutritionMembershipPackages.replacementDialog.confirm")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
