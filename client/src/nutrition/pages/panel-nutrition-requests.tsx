import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, BrainCircuit, Loader2, Search, Sparkles, Trash2, Wand2, Eye, Clock3, CheckCircle2, AlertTriangle, FileArchive, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { NutritionDietRequest, NutritionDietRequestAdminSettings, NutritionDietRequestAdminStats } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type QuickFilterKey = "all" | "ai" | "expert" | "queued_ai" | "processing_ai" | "generated_ai" | "not_generated" | "pending_approval" | "expert_manual_delivery" | "failed_ai";

const QUICK_FILTER_KEYS: QuickFilterKey[] = ["all", "ai", "expert", "queued_ai", "processing_ai", "generated_ai", "not_generated", "pending_approval", "expert_manual_delivery", "failed_ai"];

function getInitialQuickFilter(): QuickFilterKey {
  if (typeof window === "undefined") {
    return "all";
  }

  const value = new URLSearchParams(window.location.search).get("quick_filter");

  return QUICK_FILTER_KEYS.includes(value as QuickFilterKey) ? (value as QuickFilterKey) : "all";
}

const EMPTY_STATS: NutritionDietRequestAdminStats = {
  total: 0,
  aiRequests: 0,
  expertRequests: 0,
  activeRequests: 0,
  finishedRequests: 0,
  cancelledRequests: 0,
  queuedAi: 0,
  processingAi: 0,
  generatedAi: 0,
  failedAi: 0,
  notGeneratedAi: 0,
  pendingManualApprovals: 0,
  expertManualDelivery: 0,
};

export default function PanelNutritionRequestsPage() {
  const PER_PAGE = 20;
  const { isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NutritionDietRequest[]>([]);
  const [stats, setStats] = useState<NutritionDietRequestAdminStats>(EMPTY_STATS);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilterKey>(getInitialQuickFilter);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<NutritionDietRequest | null>(null);
  const [refundBalance, setRefundBalance] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [adminSettings, setAdminSettings] = useState<NutritionDietRequestAdminSettings>({
    manualAiApprovalRequired: false,
  });
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const formatDate = (value?: string | null) => (value ? format.date(value) : "—");
  const formatDateTime = (value?: string | null) => (value ? format.dateTime(value) : "—");
  const formatNumber = (value: number) => format.number(value);
  const formatWeight = (value?: number | null) => t("panelNutritionRequests.kgValue", { value: formatNumber(Number(value ?? 0)) });
  const modeLabel = (mode?: string | null) => {
    if (mode === "daily_prescription") return t("panelNutritionRequests.mode.dailyPrescription");
    if (mode === "user_choice") return t("panelNutritionRequests.mode.userChoice");
    if (mode === "fixed_text") return t("panelNutritionRequests.mode.fixedText");
    return t("panelNutritionRequests.mode.unknown");
  };

  const loadRequests = async (q = activeQuery, nextPage = page, quickFilter = activeQuickFilter) => {
    setLoading(true);
    const result = await api.nutritionDietRequests.adminList(q, nextPage, PER_PAGE, quickFilter);

    if (result.success) {
      setItems(result.data.items);
      setStats(result.data.stats);
      setActiveQuery(result.data.filters.q);
      setSearchTerm(result.data.filters.q);
      setPage(result.data.page);
      setLastPage(result.data.lastPage);
      setTotalItems(result.data.total);
    } else {
      toast({ variant: "destructive", title: t("panelNutritionRequests.toast.loadFailed"), description: result.message });
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isLoading || !isAdmin) {
      return;
    }

    loadRequests("", 1, getInitialQuickFilter());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isLoading]);

  const loadAdminSettings = async () => {
    setLoadingSettings(true);
    const result = await api.nutritionDietRequests.adminSettings();
    setLoadingSettings(false);

    if (result.success) {
      setAdminSettings(result.data);
      return;
    }

    toast({
      variant: "destructive",
      title: t("panelNutritionRequests.toast.settingsLoadFailed"),
      description: result.message || t("panelNutritionRequests.toast.settingsLoadFailedDescription"),
    });
  };

  useEffect(() => {
    if (isLoading || !isAdmin) {
      return;
    }

    void loadAdminSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isLoading]);

  const saveAdminSettings = async () => {
    setSavingSettings(true);
    const result = await api.nutritionDietRequests.updateAdminSettings(adminSettings);
    setSavingSettings(false);

    if (result.success) {
      setAdminSettings(result.data);
      toast({
        title: t("panelNutritionRequests.toast.settingsSaved"),
        description: t("panelNutritionRequests.toast.settingsSavedDescription"),
      });
      setSettingsOpen(false);
      return;
    }

    toast({
      variant: "destructive",
      title: t("panelNutritionRequests.toast.settingsSaveFailed"),
      description: result.message || t("common.tryAgain"),
    });
  };

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    await loadRequests(searchTerm, 1, activeQuickFilter);
  };

  const handleQuickFilterChange = async (quickFilter: QuickFilterKey) => {
    setActiveQuickFilter(quickFilter);
    setLocation(`/panel/nutrition/requests${quickFilter === "all" ? "" : `?quick_filter=${quickFilter}`}`);
    await loadRequests(activeQuery, 1, quickFilter);
  };

  const handleDelete = async () => {
    if (!deletingItem) {
      return;
    }

    setSubmittingId(deletingItem.id);
    const result = await api.nutritionDietRequests.adminDelete(deletingItem.id, { refundBalance });

    if (result.success) {
      toast({
        title: t("panelNutritionRequests.toast.deleted"),
        description: result.message || t("panelNutritionRequests.toast.deletedDescription"),
      });
      setDeletingItem(null);
      setRefundBalance(false);
      await loadRequests(activeQuery, page, activeQuickFilter);
    } else {
      toast({
        variant: "destructive",
        title: t("panelNutritionRequests.toast.deleteFailed"),
        description: result.message || t("panelNutritionRequests.toast.deleteFailedDescription"),
      });
    }

    setSubmittingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("panelNutritionRequests.loading.prepare")}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelNutritionRequests.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelNutritionRequests.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelNutritionRequests.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const quickFilterCounts: Record<QuickFilterKey, number> = {
    all: stats.total,
    ai: stats.aiRequests,
    expert: stats.expertRequests,
    queued_ai: stats.queuedAi,
    processing_ai: stats.processingAi,
    generated_ai: stats.generatedAi,
    not_generated: stats.notGeneratedAi,
    pending_approval: stats.pendingManualApprovals,
    expert_manual_delivery: stats.expertManualDelivery,
    failed_ai: stats.failedAi,
  };
  const filteredItems = items;
  const statCards = [
    { titleKey: "panelNutritionRequests.stats.total" as MessageKey, value: stats.total, icon: BrainCircuit, tone: "from-primary/20 to-primary/5" },
    { titleKey: "panelNutritionRequests.stats.activeRequests" as MessageKey, value: stats.activeRequests, icon: Clock3, tone: "from-amber-400/20 to-amber-400/5" },
    { titleKey: "panelNutritionRequests.stats.finishedRequests" as MessageKey, value: stats.finishedRequests, icon: CheckCircle2, tone: "from-emerald-400/20 to-emerald-400/5" },
    { titleKey: "panelNutritionRequests.stats.pendingManualApprovals" as MessageKey, value: stats.pendingManualApprovals, icon: ShieldAlert, tone: "from-sky-400/20 to-sky-400/5", quickFilter: "pending_approval" as QuickFilterKey },
    { titleKey: "panelNutritionRequests.stats.failedAi" as MessageKey, value: stats.failedAi, icon: AlertTriangle, tone: "from-rose-400/20 to-rose-400/5", quickFilter: "failed_ai" as QuickFilterKey },
  ];

  const expertItems = filteredItems.filter((item) => item.requestType === "expert");
  const regularItems = filteredItems.filter((item) => item.requestType !== "expert");
  const quickFilters: Array<{ key: QuickFilterKey; labelKey: MessageKey; descriptionKey: MessageKey }> = [
    { key: "all", labelKey: "panelNutritionRequests.filter.all", descriptionKey: "panelNutritionRequests.filter.allDescription" },
    { key: "not_generated", labelKey: "panelNutritionRequests.filter.notGenerated", descriptionKey: "panelNutritionRequests.filter.notGeneratedDescription" },
    { key: "pending_approval", labelKey: "panelNutritionRequests.filter.pendingApproval", descriptionKey: "panelNutritionRequests.filter.pendingApprovalDescription" },
    { key: "expert_manual_delivery", labelKey: "panelNutritionRequests.filter.expertManualDelivery", descriptionKey: "panelNutritionRequests.filter.expertManualDeliveryDescription" },
    { key: "failed_ai", labelKey: "panelNutritionRequests.filter.failedAi", descriptionKey: "panelNutritionRequests.filter.failedAiDescription" },
  ];

  const renderRequestCard = (item: NutritionDietRequest, emphasis: "expert" | "regular" = "regular") => {
    const isFailed = item.aiGenerationStatus === "failed";
    const isExpert = emphasis === "expert";
    const isPendingApproval = Boolean(item.manualApprovalPending);
    const statusTone = isFailed
      ? "border-rose-400/55 bg-rose-500/10 text-rose-100"
      : isPendingApproval
      ? "border-amber-300/45 bg-amber-400/10 text-amber-100"
      : item.status === "finished"
      ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"
      : "border-slate-500/35 bg-slate-500/10 text-slate-200";

    return (
    <div
      key={item.id}
      className={`group relative overflow-hidden rounded-[22px] border bg-[#111827]/85 p-4 shadow-2xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-amber-300/35 ${
        isFailed
          ? "border-rose-400/45"
          : isExpert
          ? "border-violet-300/35"
          : "border-emerald-300/28"
      }`}
    >
      <div className={`absolute inset-y-0 end-0 w-1 ${isFailed ? "bg-rose-400" : isExpert ? "bg-violet-400" : "bg-emerald-400"}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="border-violet-300/25 bg-violet-400/15 text-[10px] text-violet-100 hover:bg-violet-400/15">
              #{item.id}
            </Badge>
            <Badge className={`border text-[10px] hover:bg-transparent ${statusTone}`}>{item.statusLabel}</Badge>
            <Badge className="border-white/10 bg-white/5 text-[10px] text-slate-300 hover:bg-white/5">{item.requestTypeLabel}</Badge>
            {item.askAiEnabled ? (
              <Badge className="border-cyan-300/20 bg-cyan-400/10 text-[10px] text-cyan-100 hover:bg-cyan-400/10">
                {item.aiGenerationStatusLabel ?? t("panelNutritionRequests.aiStatus.notRegistered")}
              </Badge>
            ) : null}
          </div>
          <div>
            <div className="truncate text-base font-black text-white">{item.dietTemplateName ?? t("panelNutritionRequests.untitledDiet")}</div>
            <div className="mt-1 text-[11px] text-slate-400">
              {modeLabel(item.prescriptionMode)}
            </div>
          </div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/15 bg-amber-400/10 text-amber-200">
          {isExpert ? <FileArchive className="h-4 w-4" /> : item.askAiEnabled ? <Sparkles className="h-4 w-4" /> : <BrainCircuit className="h-4 w-4" />}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/7 bg-[#0b1220]/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">{item.user?.name || t("panelNutritionRequests.unknownUser")}</div>
            <div className="mt-1 text-[11px] text-slate-500">{item.user?.mobile ? <PhoneText>{item.user.mobile}</PhoneText> : t("panelNutritionRequests.noPhone")}</div>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-xs font-black text-violet-100">
            {(item.user?.name || t("panelNutritionRequests.userInitialFallback")).slice(0, 1)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/7 bg-[#0b1220]/55 p-3">
          <div className="text-[10px] text-slate-500">{t("panelNutritionRequests.card.status")}</div>
          <div className="mt-1 text-xs font-bold text-slate-100">{item.statusLabel}</div>
        </div>
        <div className="rounded-2xl border border-white/7 bg-[#0b1220]/55 p-3">
          <div className="text-[10px] text-slate-500">{t("panelNutritionRequests.card.dietRange")}</div>
          <div className="mt-1 text-xs font-bold text-slate-100">{formatDate(item.startedAt)} - {formatDate(item.endsAt)}</div>
        </div>
        <div className="rounded-2xl border border-white/7 bg-[#0b1220]/55 p-3">
          <div className="text-[10px] text-slate-500">{t("panelNutritionRequests.card.weight")}</div>
          <div className="mt-1 text-xs font-bold text-slate-100">
            {formatWeight(item.currentWeightKg)} / {formatWeight(item.targetWeightKg)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/7 bg-[#0b1220]/55 p-3">
          <div className="text-[10px] text-slate-500">{t("panelNutritionRequests.card.subscription")}</div>
          <div className="mt-1 truncate text-xs font-bold text-slate-100">{item.subscription?.packageName ?? "—"}</div>
        </div>
      </div>

      <div className={`mt-3 rounded-2xl border px-3 py-2.5 text-[11px] leading-6 ${
        isFailed
          ? "border-rose-300/25 bg-rose-500/10 text-rose-100"
          : isPendingApproval
          ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
          : item.askAiEnabled
          ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
          : "border-violet-300/20 bg-violet-400/10 text-violet-100"
      }`}>
        <div className="flex items-start gap-2">
          {isFailed ? <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0" /> : isPendingApproval ? <ShieldAlert className="mt-1 h-3.5 w-3.5 shrink-0" /> : item.askAiEnabled ? <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0" /> : <FileArchive className="mt-1 h-3.5 w-3.5 shrink-0" />}
          <span>
          {isFailed
            ? t("panelNutritionRequests.card.notice.failed")
            : isPendingApproval
            ? t("panelNutritionRequests.card.notice.pendingApproval")
            : item.askAiEnabled
            ? t("panelNutritionRequests.card.notice.aiEnabled")
            : t("panelNutritionRequests.card.notice.expert")}
          </span>
        </div>
      </div>

      {isFailed && item.aiGenerationError ? (
        <div className="mt-3 rounded-2xl border border-rose-300/25 bg-rose-950/35 px-3 py-2.5 text-[11px] leading-6 text-rose-50">
          <div className="font-black text-rose-100">{t("panelNutritionRequests.card.aiErrorDetails")}</div>
          <div className="mt-1">{item.aiGenerationError}</div>
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
        <Clock3 className="h-3.5 w-3.5 text-cyan-300" />
        {t("panelNutritionRequests.card.createdAt", { date: formatDateTime(item.createdAt) })}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button className="h-10 flex-1 rounded-xl bg-[#f59e0b] px-4 text-xs font-black text-slate-950 hover:bg-[#fbbf24]" onClick={() => setLocation(`/panel/nutrition/requests/${item.id}`)}>
          <Eye className="me-1.5 h-3.5 w-3.5" />
          {t("panelNutritionRequests.card.viewDetails")}
        </Button>
        {item.askAiEnabled ? (
          <Button variant="outline" className="h-10 rounded-xl border-white/10 bg-[#0b1220]/75 px-3 text-[11px] text-slate-200 hover:bg-white/10" onClick={() => setLocation(`/panel/nutrition/requests/${item.id}`)}>
            <Wand2 className="me-1 h-3.5 w-3.5" />
            {isFailed ? "AI" : "AI"}
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="h-10 w-10 rounded-xl border-rose-400/25 bg-rose-500/5 p-0 text-rose-300 hover:bg-rose-500/15"
          onClick={() => {
            setDeletingItem(item);
            setRefundBalance(false);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#070b12] pb-16 text-slate-50" dir={dir}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_75%_0%,rgba(245,158,11,0.12),transparent_32%),linear-gradient(180deg,#0b1019_0%,#05070b_100%)]" />
      <header className="border-b border-white/7 bg-[#070b12]/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
          <div className="min-w-0 text-start">
            <div className="text-[10px] text-slate-500">{t("panelNutritionRequests.eyebrow")}</div>
            <h1 className="mt-1 text-xl font-black text-white">{t("panelNutritionRequests.title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/panel">
              <Button variant="outline" size="icon" title={t("common.back")} className="h-9 w-9 rounded-xl border-white/10 bg-[#111827] text-slate-200 hover:bg-white/10">
                <BackIcon className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
              </Button>
            </Link>
            <Button variant="outline" title={t("panelNutritionRequests.settings.title")} className="h-9 rounded-xl border-white/10 bg-[#111827] px-3 text-xs text-slate-200 hover:bg-white/10" onClick={() => setSettingsOpen(true)}>
              <SlidersHorizontal className="me-1.5 h-3.5 w-3.5" />
              {t("panelNutritionRequests.settings.button")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {statCards.map((item) => (
            <Card
              key={item.titleKey}
              role={item.quickFilter ? "button" : undefined}
              tabIndex={item.quickFilter ? 0 : undefined}
              onClick={item.quickFilter ? () => void handleQuickFilterChange(item.quickFilter) : undefined}
              onKeyDown={item.quickFilter ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void handleQuickFilterChange(item.quickFilter!);
                }
              } : undefined}
              className={`overflow-hidden rounded-2xl border border-white/10 bg-[#111827]/85 shadow-2xl shadow-black/10 ${item.quickFilter ? "cursor-pointer transition hover:border-amber-300/35 hover:bg-[#161f2e]" : ""}`}
            >
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">{t(item.titleKey)}</div>
                  <div className={`text-3xl font-black ${item.quickFilter === "failed_ai" ? "text-rose-300" : "text-white"}`}>{formatNumber(item.value)}</div>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                  item.quickFilter === "failed_ai"
                    ? "border-rose-300/20 bg-rose-400/10 text-rose-300"
                    : item.quickFilter === "pending_approval"
                    ? "border-amber-300/20 bg-amber-400/10 text-amber-300"
                    : "border-cyan-300/15 bg-cyan-400/10 text-cyan-300"
                }`}>
                  <item.icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {adminSettings.manualAiApprovalRequired ? (
          <Card
            role="button"
            tabIndex={0}
            onClick={() => void handleQuickFilterChange("pending_approval")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void handleQuickFilterChange("pending_approval");
              }
            }}
            className="cursor-pointer rounded-2xl border border-amber-300/20 bg-[#1b170c]/90 transition hover:border-amber-300/40"
          >
            <CardContent className="flex flex-col gap-3 p-4 text-xs leading-7 text-amber-50 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-black text-amber-200">{t("panelNutritionRequests.manualApprovalNotice.title")}</div>
                <div className="text-amber-100/80">{t("panelNutritionRequests.manualApprovalNotice.description")}</div>
              </div>
              <Badge className="w-fit border border-amber-300/20 bg-amber-500/20 text-amber-100 hover:bg-amber-500/20">
                {t("panelNutritionRequests.manualApprovalNotice.count", { count: formatNumber(stats.pendingManualApprovals) })}
              </Badge>
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-2xl border border-white/10 bg-[#111827]/85 shadow-2xl shadow-black/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">{t("panelNutritionRequests.search.title")}</CardTitle>
            <CardDescription className="text-xs leading-6 text-slate-400">{t("panelNutritionRequests.search.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t("panelNutritionRequests.search.placeholder")}
                  className="h-11 rounded-xl border-white/10 bg-[#0b1220]/80 pe-11 text-sm text-white placeholder:text-slate-600"
                />
              </div>
              <Button type="submit" className="h-11 rounded-xl bg-[#f59e0b] px-6 text-xs font-black text-slate-950 hover:bg-[#fbbf24]">{t("panelNutritionRequests.search.submit")}</Button>
              {activeQuery ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl border-white/10 bg-white/5 px-6 text-xs text-slate-200 hover:bg-white/10"
                  onClick={() => {
                    setSearchTerm("");
                    void loadRequests("", 1, activeQuickFilter);
                  }}
                >
                  {t("common.clear")}
                </Button>
              ) : null}
            </form>

            <div className="flex flex-wrap gap-2 text-xs">
              {([
                { key: "ai", label: t("panelNutritionRequests.badges.ai", { count: formatNumber(stats.aiRequests) }), tone: "border-slate-300/20 bg-slate-400/10 text-slate-200" },
                { key: "expert", label: t("panelNutritionRequests.badges.expert", { count: formatNumber(stats.expertRequests) }), tone: "border-violet-300/20 bg-violet-400/10 text-violet-100" },
                { key: "queued_ai", label: t("panelNutritionRequests.badges.queuedAi", { count: formatNumber(stats.queuedAi) }), tone: "border-cyan-300/20 bg-cyan-400/10 text-cyan-100" },
                { key: "processing_ai", label: t("panelNutritionRequests.badges.processingAi", { count: formatNumber(stats.processingAi) }), tone: "border-blue-300/20 bg-blue-400/10 text-blue-100" },
                { key: "generated_ai", label: t("panelNutritionRequests.badges.generatedAi", { count: formatNumber(stats.generatedAi) }), tone: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" },
                { key: "failed_ai", label: t("panelNutritionRequests.badges.failedAi", { count: formatNumber(stats.failedAi) }), tone: "border-rose-300/20 bg-rose-500/15 text-rose-100" },
              ] as Array<{ key: QuickFilterKey; label: string; tone: string }>).map((filter) => {
                const isActive = activeQuickFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => void handleQuickFilterChange(isActive ? "all" : filter.key)}
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                  >
                    <Badge className={`cursor-pointer border transition hover:brightness-125 ${filter.tone} ${isActive ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-[#111827]" : ""}`}>
                      {filter.label}
                    </Badge>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
              {quickFilters.map((filter) => {
                const isActive = activeQuickFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => void handleQuickFilterChange(filter.key)}
                    className={`rounded-xl border px-3 py-2.5 text-start transition ${
                      isActive
                        ? "border-amber-300/35 bg-amber-400/15 shadow-sm"
                        : "border-white/10 bg-[#0b1220]/60 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className={`text-xs font-black ${isActive ? "text-amber-100" : "text-slate-200"}`}>{t(filter.labelKey)}</div>
                      <Badge className={isActive ? "bg-amber-400/20 text-amber-100 hover:bg-amber-400/20" : "bg-white/5 text-slate-300 hover:bg-white/5"}>
                        {formatNumber(quickFilterCounts[filter.key])}
                      </Badge>
                    </div>
                    <div className="mt-1.5 line-clamp-2 text-[10px] leading-5 text-slate-500">{t(filter.descriptionKey)}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-transparent shadow-none">
          <CardHeader className="px-0 pb-1">
            <CardTitle className="text-base text-white">{t("panelNutritionRequests.list.title")}</CardTitle>
            <CardDescription className="text-xs leading-6 text-slate-500">{t("panelNutritionRequests.list.description")}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {loading ? (
              <div className="flex h-40 items-center justify-center rounded-2xl border border-white/10 bg-[#111827]/70 text-slate-400">
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("common.loading")}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#111827]/70 px-6 py-16 text-center text-slate-400">
                {t("panelNutritionRequests.list.empty")}
              </div>
            ) : (
              <div className="space-y-8">
                {expertItems.length ? (
                  <section className="space-y-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="h-5 w-1 rounded-full bg-violet-400" />
                          <div className="text-lg font-black text-white">{t("panelNutritionRequests.sections.expertTitle")}</div>
                        </div>
                        <div className="mt-1 ps-3 text-xs text-slate-500">{t("panelNutritionRequests.sections.expertDescription")}</div>
                      </div>
                      <Badge className="border border-violet-300/20 bg-violet-400/15 text-violet-100 hover:bg-violet-400/15">
                        {t("panelNutritionRequests.itemsCount", { count: formatNumber(expertItems.length) })}
                      </Badge>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {expertItems.map((item) => renderRequestCard(item, "expert"))}
                    </div>
                  </section>
                ) : null}

                {regularItems.length ? (
                  <section className="space-y-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="h-5 w-1 rounded-full bg-amber-400" />
                          <div className="text-lg font-black text-white">{t("panelNutritionRequests.sections.regularTitle")}</div>
                        </div>
                        <div className="mt-1 ps-3 text-xs text-slate-500">{t("panelNutritionRequests.sections.regularDescription")}</div>
                      </div>
                      <Badge className="border border-amber-300/20 bg-amber-400/15 text-amber-100 hover:bg-amber-400/15">
                        {t("panelNutritionRequests.itemsCount", { count: formatNumber(regularItems.length) })}
                      </Badge>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {regularItems.map((item) => renderRequestCard(item, "regular"))}
                    </div>
                  </section>
                ) : null}

                {lastPage > 1 ? (
                  <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-500">
                      {t("panelNutritionRequests.pagination.summary", { page: formatNumber(page), lastPage: formatNumber(lastPage), total: formatNumber(totalItems) })}
                    </div>
                    <Pagination className="mx-0 w-auto justify-start">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              if (page > 1) {
                                void loadRequests(activeQuery, page - 1, activeQuickFilter);
                              }
                            }}
                            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        <PaginationItem className="px-3 text-sm text-muted-foreground">
                          {formatNumber(page)} / {formatNumber(lastPage)}
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              if (page < lastPage) {
                                void loadRequests(activeQuery, page + 1, activeQuickFilter);
                              }
                            }}
                            className={page >= lastPage ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <DialogContent dir={dir} className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>{t("panelNutritionRequests.delete.title")}</DialogTitle>
            <DialogDescription className="leading-8">
              {deletingItem
                ? t("panelNutritionRequests.delete.description", {
                    diet: deletingItem.dietTemplateName ?? t("panelNutritionRequests.untitledDiet"),
                    user: deletingItem.user?.name || t("panelNutritionRequests.unknownUser"),
                  })
                : t("common.loading")}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm leading-7 text-muted-foreground">
            {t("panelNutritionRequests.delete.refundNotice")}
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <Checkbox id="refund-balance" checked={refundBalance} onCheckedChange={(checked) => setRefundBalance(Boolean(checked))} />
            <div className="space-y-1">
              <Label htmlFor="refund-balance" className="cursor-pointer text-sm font-bold">{t("panelNutritionRequests.delete.refundLabel")}</Label>
              <div className="text-xs leading-6 text-muted-foreground">
                {t("panelNutritionRequests.delete.refundDescription")}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setDeletingItem(null)} className="rounded-2xl">{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submittingId === deletingItem?.id} className="rounded-2xl">
              {submittingId === deletingItem?.id ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />}
              {t("panelNutritionRequests.delete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent dir={dir} className="sm:max-w-lg">
          <DialogHeader className="text-start">
            <DialogTitle>{t("panelNutritionRequests.settings.title")}</DialogTitle>
            <DialogDescription>
              {t("panelNutritionRequests.settings.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 text-start">
                <Label className="text-base font-black">{t("panelNutritionRequests.settings.manualApprovalLabel")}</Label>
                <p className="text-sm leading-7 text-muted-foreground">
                  {t("panelNutritionRequests.settings.manualApprovalDescription")}
                </p>
              </div>
              <Switch
                checked={adminSettings.manualAiApprovalRequired}
                onCheckedChange={(checked) => setAdminSettings((current) => ({ ...current, manualAiApprovalRequired: checked }))}
                disabled={loadingSettings || savingSettings}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setSettingsOpen(false)} disabled={savingSettings}>
              {t("common.close")}
            </Button>
            <Button type="button" className="rounded-2xl" onClick={saveAdminSettings} disabled={loadingSettings || savingSettings}>
              {savingSettings ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t("panelNutritionRequests.settings.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
