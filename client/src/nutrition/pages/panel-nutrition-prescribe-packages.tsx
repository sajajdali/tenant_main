import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Boxes, ChevronLeft, Crown, Loader2, Sparkles, TicketPercent } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { api } from "@/lib/api";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { NutritionPackageItem } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import {
  getPanelNutritionPrescribeState,
  updatePanelNutritionPrescribeState,
} from "@/nutrition/lib/panel-nutrition-prescribe-state";

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

function filterPackagesByGoal(items: NutritionPackageItem[], goal?: string): NutritionPackageItem[] {
  return items
    .map((item) => {
      const children = filterPackagesByGoal(item.children ?? [], goal);
      const matchesGoal = !goal || !item.applicableGoals?.length || item.applicableGoals.includes(goal);

      if (!item.isActive || (!matchesGoal && children.length === 0)) {
        return null;
      }

      return {
        ...item,
        children,
      };
    })
    .filter(Boolean) as NutritionPackageItem[];
}

export default function PanelNutritionPrescribePackagesPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/panel/nutrition/prescribe/packages/:packageId");
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const state = useMemo(() => getPanelNutritionPrescribeState(), []);
  const [loading, setLoading] = useState(true);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [items, setItems] = useState<NutritionPackageItem[]>([]);

  useEffect(() => {
    const saveAndLoad = async () => {
      if (!state.fullName || !state.mobile || !state.dietGoal || !state.gender || !state.athleteMode || !state.activityLevel || !state.birthDate || !state.heightCm || !state.weightKg || !state.targetWeightKg) {
        setLocation("/panel/nutrition/prescribe/review");
        return;
      }

      setLoading(true);
      const profileResult = await api.nutritionAdminUsers.savePrescribeProfile({
        fullName: state.fullName,
        mobile: state.mobile,
        dietGoal: state.dietGoal,
        gender: state.gender,
        athleteMode: state.athleteMode,
        activityLevel: state.activityLevel,
        birthDate: state.birthDate,
        heightCm: state.heightCm,
        weightKg: state.weightKg,
        targetWeightKg: state.targetWeightKg,
        weeklyWeightChangeKg: state.weeklyWeightChangeKg,
        medicalConditions: state.medicalConditions,
        medicalConditionsItems: state.medicalConditionsItems,
        medicationsAndSupplements: state.medicationsAndSupplements,
        foodAllergies: state.foodAllergies,
        dislikedFoods: state.dislikedFoods,
        mindsetAnswers: state.mindsetAnswers ?? {},
      });

      if (!profileResult.success) {
        toast({ variant: "destructive", title: t("panelNutritionPrescribePackages.toast.profileSaveFailed"), description: profileResult.message });
        setLoading(false);
        return;
      }

      updatePanelNutritionPrescribeState({
        persistedUserId: profileResult.data.user.id,
        fullName: profileResult.data.user.fullName,
        mobile: profileResult.data.user.mobile,
      });

      const packagesResult = await api.nutritionPackages.listPublic(state.dietGoal);
      if (!packagesResult.success) {
        toast({ variant: "destructive", title: t("panelNutritionPrescribePackages.toast.packagesLoadFailed"), description: packagesResult.message });
        setLoading(false);
        return;
      }

      setItems(filterPackagesByGoal(packagesResult.data.items ?? [], state.dietGoal));
      setLoading(false);
    };

    void saveAndLoad();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePath = useMemo(() => {
    if (!match || !params?.packageId) {
      return null;
    }

    return findPackagePath(items, params.packageId) ?? null;
  }, [items, match, params?.packageId]);

  const currentNode = activePath ? activePath[activePath.length - 1] : null;
  const visibleItems = currentNode ? currentNode.children ?? [] : items;
  const parentNode = activePath && activePath.length > 1 ? activePath[activePath.length - 2] : null;
  const backHref = currentNode
    ? parentNode
      ? `/panel/nutrition/prescribe/packages/${parentNode.id}`
      : "/panel/nutrition/prescribe/packages"
    : "/panel/nutrition/prescribe/review";

  const handleGrantPackage = async (item: NutritionPackageItem) => {
    if (!state.mobile) {
      return;
    }

    setGrantingId(item.id);
    const result = await api.nutritionAdminUsers.grantPackage(state.mobile, item.id);

    if (result.success) {
      updatePanelNutritionPrescribeState({
        selectedNutritionPackageId: item.id,
        selectedNutritionPackageName: item.name,
        dietRequestMode: undefined,
        selectedDietTemplateId: null,
        selectedDietTemplateName: null,
      });
      toast({ title: t("panelNutritionPrescribePackages.toast.granted"), description: result.message || t("panelNutritionPrescribePackages.toast.grantedDescription") });
      setLocation("/panel/nutrition/prescribe/mode");
    } else {
      toast({ variant: "destructive", title: t("panelNutritionPrescribePackages.toast.grantFailed"), description: result.message });
    }

    setGrantingId(null);
  };

  if (loading) {
    return (
      <div className="relative isolate min-h-screen bg-[#06131d] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_28%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen bg-[#06131d] px-4 py-8 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center space-y-5">
        <NutritionTopbar backHref={backHref} title={t("panelNutritionPrescribePackages.topbarTitle")} description={t("panelNutritionPrescribePackages.topbarDescription")} />

        <div className="rounded-[32px] border border-white/10 bg-[#1e2335]/88 p-5 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-amber-400/12 text-amber-300">
            <Boxes className="h-8 w-8" />
          </div>

          <div className="mt-5 space-y-2 text-center">
            <div className="text-sm font-bold text-amber-300">{t("panelNutritionPrescribePackages.stepLabel")}</div>
            <h1 className="text-3xl font-black leading-tight">
              {currentNode ? t("panelNutritionPrescribePackages.childrenTitle", { name: currentNode.name }) : t("panelNutritionPrescribePackages.title")}
            </h1>
            <p className="text-sm leading-7 text-slate-300">
              {currentNode
                ? t("panelNutritionPrescribePackages.childrenDescription")
                : t("panelNutritionPrescribePackages.description")}
            </p>
          </div>

          {activePath && activePath.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {activePath.map((item) => (
                <Badge key={item.id} variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                  {item.name}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {visibleItems.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-slate-950/18 px-4 py-8 text-center">
                <Crown className="mx-auto mb-3 h-10 w-10 text-amber-300" />
                <div className="font-black">{t("panelNutritionPrescribePackages.empty.title")}</div>
                <div className="mt-2 text-sm leading-7 text-slate-400">{t("panelNutritionPrescribePackages.empty.description")}</div>
              </div>
            ) : (
              visibleItems.map((item) => {
                const hasChildren = (item.children ?? []).length > 0;
                const effectivePrice = item.discountedPriceAmount ?? item.priceAmount;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (hasChildren) {
                        setLocation(`/panel/nutrition/prescribe/packages/${item.id}`);
                        return;
                      }

                      void handleGrantPackage(item);
                    }}
                    disabled={grantingId === item.id}
                    className="w-full overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(15,23,42,0.24))] p-4 text-start shadow-[0_24px_50px_-35px_rgba(0,0,0,0.78)] transition hover:-translate-y-1 hover:border-amber-300/30 hover:bg-white/[0.06] disabled:opacity-70"
                  >
                    <div className="mt-1 flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-xl font-black">{item.name}</div>
                          {item.discountedPriceAmount && item.discountedPriceAmount < item.priceAmount ? (
                            <Badge className="border-0 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">
                              {t("panelNutritionPrescribePackages.discounted")}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                            {item.durationDays % 30 === 0
                              ? t("panelNutritionPrescribePackages.monthsDuration", { count: format.number(item.durationDays / 30) })
                              : t("panelNutritionPrescribePackages.daysDuration", { count: format.number(item.durationDays) })}
                          </Badge>
                          <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                            {t("panelNutritionPrescribePackages.onlineDietCount", { count: format.number(item.onlineDietCount) })}
                          </Badge>
                          <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                            {t("panelNutritionPrescribePackages.offlineDietCount", { count: format.number(item.offlineDietCount) })}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-amber-400/12 text-amber-300">
                        {grantingId === item.id ? <Loader2 className="h-6 w-6 animate-spin" /> : hasChildren ? <ChevronLeft className={`h-6 w-6 ${isRtl ? "" : "rotate-180"}`} /> : <ArrowLeft className={`h-6 w-6 ${isRtl ? "" : "rotate-180"}`} />}
                      </div>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3 rounded-[22px] border border-white/10 bg-black/10 px-4 py-3">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-400">{hasChildren ? t("panelNutritionPrescribePackages.openChildrenHint") : t("panelNutritionPrescribePackages.grantHint")}</div>
                        <div className="flex items-center gap-2">
                          {item.discountedPriceAmount && item.discountedPriceAmount < item.priceAmount ? (
                            <div className="text-sm text-slate-500 line-through">{format.currency(item.priceAmount)}</div>
                          ) : null}
                          <div className="text-lg font-black text-amber-300">{format.currency(effectivePrice)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl bg-amber-400 px-3 py-2 text-sm font-black text-slate-950">
                        {!hasChildren && item.discountedPriceAmount && item.discountedPriceAmount < item.priceAmount ? (
                          <TicketPercent className="h-4 w-4 text-slate-950" />
                        ) : null}
                        {hasChildren ? t("panelNutritionPrescribePackages.openChildren") : t("panelNutritionPrescribePackages.selectPackage")}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {state.selectedNutritionPackageName ? (
            <div className="mt-5 rounded-[22px] border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-7 text-emerald-100">
              {t("panelNutritionPrescribePackages.selectedPackage")} <span className="font-black">{state.selectedNutritionPackageName}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
