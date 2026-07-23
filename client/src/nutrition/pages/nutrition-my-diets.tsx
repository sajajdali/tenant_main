import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, Eye, History, Loader2, Plus, Scale, TimerOff, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import type { NutritionDietPrescription, NutritionDietRequest, NutritionPackageCheckoutSummaryPayload, NutritionProfile } from "@/lib/types";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getFirstIncompleteNutritionProfileHref, isNutritionProfileComplete } from "@/nutrition/lib/profile-completion";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type DietRequestTab = "current" | "archived" | "expired";

function dietDisplayName(item: NutritionDietPrescription, t: ReturnType<typeof useT>) {
  const snapshot = item.contentSnapshot ?? {};
  const snapshotName = ["diet_name", "dietName", "title", "plan_title", "planTitle"]
    .map((key) => String(snapshot[key] ?? "").trim())
    .find(Boolean);

  return String(item.dietName ?? "").trim()
    || String(item.expertFile?.title ?? "").trim()
    || snapshotName
    || (item.deliveryChannel === "expert_file" ? t("nutritionMyDiets.mode.expertFile") : t("nutritionDietRequestConfirm.requestType.ai"));
}

export default function NutritionMyDietsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NutritionDietPrescription[]>([]);
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [summary, setSummary] = useState<NutritionPackageCheckoutSummaryPayload | null>(null);
  const [activeDietRequest, setActiveDietRequest] = useState<NutritionDietRequest | null>(null);
  const [activeTab, setActiveTab] = useState<DietRequestTab>("current");

  useEffect(() => {
    Promise.all([
      api.nutritionPrescriptions.list(),
      api.nutrition.getProfileDashboard(),
      api.nutritionPackageCheckout.summary(),
    ]).then(([prescriptionsResult, dashboardResult, summaryResult]) => {
      if (prescriptionsResult.success) {
        setItems(prescriptionsResult.data.items ?? []);
      }

      if (dashboardResult.success) {
        setProfile(dashboardResult.data.profile);
        setActiveDietRequest(
          dashboardResult.data.dietRequest.active && !dashboardResult.data.prescription.current
            ? dashboardResult.data.dietRequest.active
            : null,
        );
      }

      if (summaryResult.success) {
        setSummary(summaryResult.data);
      }

      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="relative isolate min-h-screen bg-[#06131d] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_25%),linear-gradient(180deg,rgba(6,19,29,0.96),rgba(4,10,17,1))]" />
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  const currentItems = items.filter((item) => item.isCurrent);
  const finishedItems = items.filter((item) => !item.isCurrent);
  const archivedItems = finishedItems.slice(0, 1);
  const expiredItems = finishedItems.slice(1);
  const hasCurrentDiet = currentItems.length > 0;
  const hasPendingDietRequest = Boolean(activeDietRequest);
  const hasDietHistory = items.length > 0;
  const profileCompleted = isNutritionProfileComplete(profile);
  const firstIncompleteProfileHref = getFirstIncompleteNutritionProfileHref(profile);
  const activeSubscription = summary?.subscription ?? null;
  const subscriptionEndTime = activeSubscription?.endsAt ? new Date(activeSubscription.endsAt).getTime() : Number.NaN;
  const hasValidSubscriptionDate = !activeSubscription?.endsAt || (!Number.isNaN(subscriptionEndTime) && subscriptionEndTime >= Date.now());
  const hasUsableSubscription = Boolean(
    activeSubscription
      && activeSubscription.status === "active"
      && hasValidSubscriptionDate
      && ((activeSubscription.onlineDietRemaining ?? 0) > 0 || (activeSubscription.offlineDietRemaining ?? 0) > 0),
  );
  const dietStartHref = !profileCompleted
    ? firstIncompleteProfileHref ?? "/nutrition/membership/goal"
    : hasUsableSubscription
      ? !hasDietHistory && !profile?.mindsetCompletedAt
        ? "/nutrition/membership/mindset/1"
        : "/nutrition/diet-type"
      : "/nutrition/membership/packages?direct_buy=1";
  const formatDate = (value?: string | null) => value ? format.date(value) : "—";
  const newDietDescription = hasCurrentDiet
    ? t("nutritionMyDiets.newDiet.hasCurrent")
    : hasPendingDietRequest
      ? t("nutritionMyDiets.newDiet.hasPending")
      : !profileCompleted
        ? t("nutritionMyDiets.newDiet.incompleteProfile")
        : !hasUsableSubscription
          ? t("nutritionMyDiets.newDiet.noPackage")
          : !hasDietHistory && !profile?.mindsetCompletedAt
            ? t("nutritionMyDiets.newDiet.firstDiet")
            : t("nutritionMyDiets.newDiet.ready");

  const tabs: Array<{
    key: DietRequestTab;
    title: string;
    dotClassName: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyIcon: LucideIcon;
    emptyIconClassName: string;
    emptyIconBoxClassName: string;
    items: NutritionDietPrescription[];
  }> = [
    {
      key: "current",
      title: t("nutritionMyDiets.tabs.current"),
      dotClassName: "bg-emerald-300",
      emptyTitle: t("nutritionMyDiets.empty.currentTitle"),
      emptyDescription: t("nutritionMyDiets.empty.currentDescription"),
      emptyIcon: CheckCircle2,
      emptyIconClassName: "text-emerald-300",
      emptyIconBoxClassName: "border-emerald-300/25 bg-emerald-400/10",
      items: currentItems,
    },
    {
      key: "archived",
      title: t("nutritionMyDiets.tabs.archived"),
      dotClassName: "bg-sky-500/75",
      emptyTitle: t("nutritionMyDiets.empty.archivedTitle"),
      emptyDescription: t("nutritionMyDiets.empty.archivedDescription"),
      emptyIcon: History,
      emptyIconClassName: "text-sky-300",
      emptyIconBoxClassName: "border-sky-300/25 bg-sky-400/10",
      items: archivedItems,
    },
    {
      key: "expired",
      title: t("nutritionMyDiets.tabs.expired"),
      dotClassName: "bg-amber-600/75",
      emptyTitle: t("nutritionMyDiets.empty.expiredTitle"),
      emptyDescription: t("nutritionMyDiets.empty.expiredDescription"),
      emptyIcon: TimerOff,
      emptyIconClassName: "text-amber-300",
      emptyIconBoxClassName: "border-amber-300/25 bg-amber-400/10",
      items: expiredItems,
    },
  ];
  const activeTabMeta = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const showActiveRequestCard = activeTab === "current" && Boolean(activeDietRequest);
  const showEmptyState = activeTabMeta.items.length === 0 && !showActiveRequestCard;

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#070b12] px-4 py-4 pb-24 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.09),transparent_24%),linear-gradient(180deg,#070b12_0%,#0a0f18_48%,#070b12_100%)]" />
      <div className="relative z-10 mx-auto max-w-[390px] space-y-4">
        <div className="space-y-4">
          <NutritionTopbar backHref="/nutrition/profile" title={t("nutritionMyDiets.topbarTitle")} variant="hero" />

          <h1 className="text-start text-[20px] font-black leading-8 tracking-[-0.02em] text-slate-100">
            {t("nutritionMyDiets.title")}
          </h1>
        </div>

        <section className="rounded-[24px] border border-white/10 bg-[#11161d]/95 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_24px_70px_-50px_rgba(0,0,0,0.95)]">
          <div className="grid grid-cols-3 gap-1.5 text-[12px] font-black">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex h-[48px] items-center justify-center gap-2 rounded-[19px] transition",
                    active
                      ? "bg-[#352b1e] text-amber-200 shadow-[0_16px_38px_-30px_rgba(245,158,11,0.9)]"
                      : "text-slate-400 hover:bg-white/[0.03]",
                  )}
                >
                  <span>{tab.title}</span>
                  <span className={cn("h-2 w-2 rounded-full", tab.dotClassName)} />
                </button>
              );
            })}
          </div>
        </section>

        {showActiveRequestCard ? (
          <section className="rounded-[28px] border border-amber-500/35 bg-[linear-gradient(160deg,rgba(34,27,20,0.72),rgba(13,17,24,0.97)_42%,rgba(10,14,20,0.98))] p-4 shadow-[0_28px_90px_-58px_rgba(245,158,11,0.85)]">
            <div className="text-center" aria-live="polite">
              <div className="min-w-0 pt-1">
                <div className="inline-flex min-h-[31px] items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/12 px-3 py-1.5 text-[11px] font-black text-amber-300">
                  {activeDietRequest?.statusLabel || t("nutritionMyDiets.pending.statusFallback")}
                  <span className="inline-flex items-center gap-1" aria-hidden="true">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300"
                        style={{ animationDelay: `${dot * 180}ms` }}
                      />
                    ))}
                  </span>
                </div>
                <div className="mt-4 text-[18px] font-black leading-7 text-white">{t("nutritionMyDiets.pending.title")}</div>
                <div className="mx-auto mt-3 h-1.5 max-w-[210px] overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-amber-300/80 shadow-[0_0_22px_rgba(251,191,36,0.45)]" />
                </div>
                <div className="mx-auto mt-3 max-w-[310px] text-[12px] font-medium leading-7 text-slate-400">
                  {t("nutritionMyDiets.pending.description")}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.035] p-3.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] font-black text-slate-400">{t("nutritionMyDiets.requestType")}</span>
                <span className="text-[14px] font-black text-amber-300">{activeDietRequest?.requestTypeLabel}</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-[18px] border border-white/10 bg-[#11161d]/90 px-3.5 py-3.5 text-start">
                <div className="text-[11px] font-black text-slate-400">{t("nutritionMyDiets.requestCreatedAt")}</div>
                <div className="mt-2.5 text-[13px] font-black text-white">{formatDate(activeDietRequest?.createdAt)}</div>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-[#11161d]/90 px-3.5 py-3.5 text-start">
                <div className="text-[11px] font-black text-slate-400">{t("nutritionMyDiets.dietTemplate")}</div>
                <div className="mt-2.5 truncate text-[13px] font-black text-white">{activeDietRequest?.dietTemplateName || t("nutritionMyDiets.customDiet")}</div>
              </div>
            </div>

          </section>
        ) : null}

        {showEmptyState ? (
          <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(17,22,29,0.98),rgba(10,14,21,0.98))] px-5 py-10 text-center shadow-[0_30px_80px_-55px_rgba(0,0,0,0.95)]">
            <div className={cn("mx-auto flex h-[56px] w-[56px] items-center justify-center rounded-[20px] border", activeTabMeta.emptyIconBoxClassName)}>
              <activeTabMeta.emptyIcon className={cn("h-9 w-9", activeTabMeta.emptyIconClassName)} />
            </div>
            <div className="mt-7 text-[19px] font-black leading-8 text-white">{activeTabMeta.emptyTitle}</div>
            <div className="mx-auto mt-4 max-w-[300px] text-[13px] font-medium leading-8 text-slate-400">
              {activeTabMeta.emptyDescription}
            </div>
          </section>
        ) : null}

        {activeTabMeta.items.length > 0 ? (
          <section className="space-y-3">
            {activeTabMeta.items.map((item) => {
              const isOldExpiredDiet = activeTab === "expired";
              const currentWeight = Number(item.currentWeightKg ?? 0);
              const targetWeight = Number(item.targetWeightKg ?? 0);
              const hasWeight = currentWeight > 0;
              const hasWeightGap = hasWeight && targetWeight > 0;
              const weightGap = hasWeightGap ? Math.abs(currentWeight - targetWeight) : 0;
              const isExcessWeight = hasWeightGap && currentWeight > targetWeight;
              const isWeightDeficit = hasWeightGap && currentWeight < targetWeight;
              const WeightGapIcon = isExcessWeight ? TrendingUp : isWeightDeficit ? TrendingDown : CheckCircle2;
              const weightGapLabel = !hasWeightGap
                ? t("nutritionMyDiets.weightGapUnavailable")
                : weightGap < 0.05
                  ? t("nutritionMyDiets.atTargetWeight")
                  : t(isExcessWeight ? "nutritionMyDiets.excessWeight" : "nutritionMyDiets.weightDeficit");
              return (
                <article
                  key={item.id}
                  className={cn("w-full rounded-[24px] border bg-[linear-gradient(160deg,rgba(17,22,29,0.98),rgba(10,14,21,0.98))] p-4 text-start shadow-[0_30px_80px_-55px_rgba(0,0,0,0.95)]", item.isCurrent ? "border-emerald-300/25" : "border-white/10")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-slate-400">{t("nutritionMyDiets.dietName")}</div>
                      <h2 className="mt-1 text-[17px] font-black leading-7 text-white">{dietDisplayName(item, t)}</h2>
                    </div>
                    <span className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black",
                      item.isCurrent
                        ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                        : isOldExpiredDiet
                          ? "border-rose-300/30 bg-rose-400/12 text-rose-200"
                          : "border-sky-300/25 bg-sky-400/10 text-sky-200",
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", item.isCurrent ? "bg-emerald-300" : isOldExpiredDiet ? "bg-rose-400" : "bg-sky-400")} />
                      {item.isCurrent ? t("nutritionMyDiets.status.inUse") : t("nutritionMyDiets.status.finished")}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-[15px] border border-white/10 bg-white/[0.035] px-3 py-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><CalendarDays className="h-3.5 w-3.5 text-amber-300" />{t("nutritionMyDiets.startDate")}</div>
                      <div className="mt-1.5 text-[12px] font-black text-white">{formatDate(item.startedAt)}</div>
                    </div>
                    <div className="rounded-[15px] border border-white/10 bg-white/[0.035] px-3 py-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><CalendarDays className="h-3.5 w-3.5 text-amber-300" />{t("nutritionMyDiets.endDate")}</div>
                      <div className="mt-1.5 text-[12px] font-black text-white">{formatDate(item.endsAt)}</div>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-[15px] border border-white/10 bg-white/[0.035] px-3 py-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><Scale className="h-3.5 w-3.5 text-sky-300" />{t("nutritionMyDiets.dietWeight")}</div>
                      <div className="mt-1.5 text-[12px] font-black text-white">{hasWeight ? t("nutritionMyDiets.kilogramValue", { value: format.number(currentWeight, { maximumFractionDigits: 1 }) }) : "—"}</div>
                    </div>
                    <div className="rounded-[15px] border border-white/10 bg-white/[0.035] px-3 py-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><WeightGapIcon className="h-3.5 w-3.5 text-rose-300" />{weightGapLabel}</div>
                      <div className="mt-1.5 text-[12px] font-black text-white">{hasWeightGap && weightGap >= 0.05 ? t("nutritionMyDiets.kilogramValue", { value: format.number(weightGap, { maximumFractionDigits: 1 }) }) : hasWeightGap ? t("nutritionMyDiets.atTargetWeight") : "—"}</div>
                    </div>
                  </div>

                  <button type="button" onClick={() => setLocation(`/nutrition/my-diets/${item.id}`)} className={cn("mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[15px] text-[12px] font-black transition", item.isCurrent ? "bg-emerald-400 text-emerald-950 hover:bg-emerald-300" : "bg-amber-400 text-slate-950 hover:bg-amber-300")}>
                    <Eye className="h-4 w-4" />
                    {t("nutritionMyDiets.viewDiet")}
                    <ChevronLeft className={cn("h-4 w-4", !isRtl && "rotate-180")} />
                  </button>
                </article>
              );
            })}
          </section>
        ) : null}

        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,rgba(17,22,29,0.98),rgba(10,14,21,0.98))] p-4 shadow-[0_30px_80px_-55px_rgba(0,0,0,0.95)]">
          <div className="space-y-2 text-start">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[18px] font-black leading-7 text-white">{t("nutritionMyDiets.newDiet.title")}</div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-amber-400/12 text-amber-300">
                <Plus className="h-4 w-4" />
              </span>
            </div>
            <div className="text-[12px] leading-7 text-slate-400">
              {newDietDescription}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (hasCurrentDiet) {
                toast({
                  title: t("nutritionMyDiets.toast.currentTitle"),
                  description: t("nutritionMyDiets.toast.currentDescription"),
                });
                return;
              }

              if (hasPendingDietRequest) {
                toast({
                  variant: "destructive",
                  title: t("nutritionMyDiets.toast.pendingTitle"),
                  description: t("nutritionMyDiets.toast.pendingDescription"),
                });
                return;
              }

              setLocation(dietStartHref);
            }}
            className={cn(
              "mt-4 flex h-[50px] w-full items-center justify-center gap-2 rounded-[18px] px-4 text-[13px] font-black transition",
              hasCurrentDiet || hasPendingDietRequest
                ? "border border-white/10 bg-white/5 text-white/70"
                : "bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] text-slate-950 shadow-[0_24px_52px_-34px_rgba(245,158,11,0.9)]",
            )}
          >
            <ChevronLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
            {t("nutritionMyDiets.newDiet.title")}
          </button>
        </section>
      </div>
    </div>
  );
}
