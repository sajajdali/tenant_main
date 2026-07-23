import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, BrainCircuit, Loader2, Search, Sparkles, Trash2, Wand2, Eye, Users, Clock3, CheckCircle2, AlertTriangle, FileArchive, ShieldAlert, SlidersHorizontal } from "lucide-react";
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

type QuickFilterKey = "all" | "not_generated" | "pending_approval" | "expert_manual_delivery" | "failed_ai";

const QUICK_FILTER_KEYS: QuickFilterKey[] = ["all", "not_generated", "pending_approval", "expert_manual_delivery", "failed_ai"];

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

const MODE_LABELS: Record<string, string> = {
  daily_prescription: "تجویز روزانه",
  user_choice: "انتخاب وعده توسط کاربر",
  fixed_text: "تجویز متن ثابت",
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("fa-IR") : "—");
const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

export default function PanelNutritionRequestsPage() {
  const PER_PAGE = 20;
  const { isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
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
      toast({ variant: "destructive", title: "بارگذاری درخواست‌ها انجام نشد", description: result.message });
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
      title: "تنظیمات بارگذاری نشد",
      description: result.message || "تنظیمات تایید دستی رژیم دریافت نشد.",
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
        title: "تنظیمات ذخیره شد",
        description: "رفتار ارسال رژیم‌های AI به‌روزرسانی شد.",
      });
      setSettingsOpen(false);
      return;
    }

    toast({
      variant: "destructive",
      title: "ذخیره تنظیمات انجام نشد",
      description: result.message || "لطفاً دوباره تلاش کنید.",
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
        title: "درخواست حذف شد",
        description: result.message || "درخواست رژیم با موفقیت حذف شد.",
      });
      setDeletingItem(null);
      setRefundBalance(false);
      await loadRequests(activeQuery, page, activeQuickFilter);
    } else {
      toast({
        variant: "destructive",
        title: "حذف درخواست انجام نشد",
        description: result.message || "حذف درخواست با خطا مواجه شد.",
      });
    }

    setSubmittingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir="rtl">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          در حال آماده‌سازی فهرست درخواست‌ها...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir="rtl">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">عدم دسترسی</h1>
          <p className="leading-7 text-muted-foreground">فقط مدیر سامانه می‌تواند درخواست‌های رژیم را ببیند.</p>
          <Link href="/panel">
            <Button>بازگشت به پنل</Button>
          </Link>
        </div>
      </div>
    );
  }

  const quickFilterCounts: Record<QuickFilterKey, number> = {
    all: stats.total,
    not_generated: stats.notGeneratedAi,
    pending_approval: stats.pendingManualApprovals,
    expert_manual_delivery: stats.expertManualDelivery,
    failed_ai: stats.failedAi,
  };
  const filteredItems = items;
  const statCards = [
    { title: "کل درخواست‌ها", value: stats.total, icon: BrainCircuit, tone: "from-primary/20 to-primary/5" },
    { title: "در حال تجویز", value: stats.activeRequests, icon: Clock3, tone: "from-amber-400/20 to-amber-400/5" },
    { title: "رژیم‌های آماده", value: stats.finishedRequests, icon: CheckCircle2, tone: "from-emerald-400/20 to-emerald-400/5" },
    { title: "منتظر تایید ارسال", value: stats.pendingManualApprovals, icon: ShieldAlert, tone: "from-sky-400/20 to-sky-400/5" },
    { title: "خطای AI", value: stats.failedAi, icon: AlertTriangle, tone: "from-rose-400/20 to-rose-400/5", quickFilter: "failed_ai" as QuickFilterKey },
  ];

  const expertItems = filteredItems.filter((item) => item.requestType === "expert");
  const regularItems = filteredItems.filter((item) => item.requestType !== "expert");
  const quickFilters: Array<{ key: QuickFilterKey; label: string; description: string }> = [
    { key: "all", label: "همه درخواست‌ها", description: "نمایش همه موارد" },
    { key: "not_generated", label: "تولید نشده", description: "درخواست‌های AI که هنوز generated نشده‌اند" },
    { key: "pending_approval", label: "منتظر تایید", description: "نسخه‌های AI که آماده‌اند ولی هنوز برای کاربر تایید نشده‌اند" },
    { key: "expert_manual_delivery", label: "ارسال دستی کارشناس", description: "درخواست‌های اختصاصی که هنوز باید توسط کارشناس برای کاربر ارسال شوند" },
    { key: "failed_ai", label: "AI ناموفق", description: "درخواست‌هایی که تولید AI آن‌ها خطا خورده و نیاز به اقدام مجدد دارند" },
  ];

  const renderRequestCard = (item: NutritionDietRequest, emphasis: "expert" | "regular" = "regular") => (
    <div
      key={item.id}
      className={`rounded-[2rem] border p-5 shadow-sm ${
        item.aiGenerationStatus === "failed"
          ? "border-rose-400/35 bg-[linear-gradient(160deg,rgba(127,29,29,0.22),rgba(36,17,25,0.4))]"
          : 
        emphasis === "expert"
          ? "border-amber-400/30 bg-[linear-gradient(160deg,rgba(120,53,15,0.18),rgba(24,24,27,0.42))]"
          : "border-border/70 bg-background/30"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-lg font-black">{item.dietTemplateName ?? "رژیم بدون عنوان"}</div>
            <Badge variant={item.status === "finished" ? "default" : "secondary"}>{item.statusLabel}</Badge>
            <Badge variant="outline">{item.requestTypeLabel}</Badge>
            {item.askAiEnabled ? <Badge variant="outline">{item.aiGenerationStatusLabel ?? "ثبت نشده"}</Badge> : null}
            {item.manualApprovalPending ? <Badge className="bg-amber-500/15 text-amber-200 hover:bg-amber-500/15">منتظر تایید ارسال</Badge> : null}
            {item.aiGenerationStatus === "failed" ? <Badge className="bg-rose-500/15 text-rose-100 hover:bg-rose-500/15">خطای AI</Badge> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-4 w-4" />
              {item.user?.name || "کاربر بدون نام"}
            </span>
            <span>{item.user?.mobile || "بدون شماره"}</span>
          </div>
        </div>
        <div className="rounded-3xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
          #{item.id}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card/60 p-3">
          <div className="text-xs text-muted-foreground">نوع تجویز</div>
          <div className="mt-1 font-bold">{MODE_LABELS[item.prescriptionMode ?? ""] ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/60 p-3">
          <div className="text-xs text-muted-foreground">بازه رژیم</div>
          <div className="mt-1 font-bold">{formatDate(item.startedAt)} تا {formatDate(item.endsAt)}</div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/60 p-3">
          <div className="text-xs text-muted-foreground">وزن فعلی / هدف</div>
          <div className="mt-1 font-bold">
            {(item.currentWeightKg ?? 0).toLocaleString("fa-IR")} / {(item.targetWeightKg ?? 0).toLocaleString("fa-IR")} کیلو
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/60 p-3">
          <div className="text-xs text-muted-foreground">اشتراک</div>
          <div className="mt-1 font-bold">{item.subscription?.packageName ?? "—"}</div>
        </div>
      </div>

      <div className={`mt-4 flex items-center justify-between rounded-2xl px-4 py-3 text-sm ${
        item.aiGenerationStatus === "failed"
          ? "border border-rose-300/25 bg-rose-400/10"
          : item.manualApprovalPending
          ? "border border-amber-300/25 bg-amber-300/10"
          : item.askAiEnabled
          ? "border border-amber-400/20 bg-amber-400/8"
          : "border border-cyan-400/20 bg-cyan-400/8"
      }`}>
        <div className={item.aiGenerationStatus === "failed" ? "flex items-center gap-2 text-rose-100" : item.manualApprovalPending ? "flex items-center gap-2 text-amber-100" : item.askAiEnabled ? "flex items-center gap-2 text-amber-200" : "flex items-center gap-2 text-cyan-100"}>
          {item.aiGenerationStatus === "failed" ? <AlertTriangle className="h-4 w-4" /> : item.manualApprovalPending ? <ShieldAlert className="h-4 w-4" /> : item.askAiEnabled ? <Sparkles className="h-4 w-4" /> : <FileArchive className="h-4 w-4" />}
          {item.aiGenerationStatus === "failed"
            ? "این درخواست در تولید AI ناموفق بوده است. وارد جزئیات شوید و دوباره برای AI ارسال کنید."
            : item.manualApprovalPending
            ? "این رژیم توسط AI ساخته شده ولی هنوز برای کاربر تایید و ارسال نشده است."
            : item.askAiEnabled
            ? "این درخواست قابلیت ارسال به AI دارد."
            : "این درخواست برای رژیم اختصاصی فایل‌محور کارشناس است."}
        </div>
        <div className="text-xs text-white/70">{formatDateTime(item.createdAt)}</div>
      </div>

      {item.aiGenerationStatus === "failed" && item.aiGenerationError ? (
        <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-950/30 px-4 py-3 text-sm leading-7 text-rose-50">
          <div className="font-black text-rose-100">جزئیات خطای AI</div>
          <div className="mt-1">{item.aiGenerationError}</div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button className="rounded-2xl" onClick={() => setLocation(`/panel/nutrition/requests/${item.id}`)}>
          <Eye className="ml-2 h-4 w-4" />
          مشاهده جزئیات
        </Button>
        {item.askAiEnabled ? (
          <Button variant={item.aiGenerationStatus === "failed" ? "default" : "outline"} className="rounded-2xl" onClick={() => setLocation(`/panel/nutrition/requests/${item.id}`)}>
            <Wand2 className="ml-2 h-4 w-4" />
            {item.aiGenerationStatus === "failed" ? "درخواست مجدد به AI" : "مدیریت AI"}
          </Button>
        ) : null}
        <Button
          variant="destructive"
          className="rounded-2xl"
          onClick={() => {
            setDeletingItem(item);
            setRefundBalance(false);
          }}
        >
          <Trash2 className="ml-2 h-4 w-4" />
          حذف درخواست
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir="rtl">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-black">مدیریت درخواست های رژیم</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" title="تنظیمات" className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70" onClick={() => setSettingsOpen(true)}>
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
            <Link href="/panel">
              <Button variant="outline" size="icon" title="بازگشت" className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          {statCards.map((item) => (
            <Card
              key={item.title}
              role={item.quickFilter ? "button" : undefined}
              tabIndex={item.quickFilter ? 0 : undefined}
              onClick={item.quickFilter ? () => void handleQuickFilterChange(item.quickFilter) : undefined}
              onKeyDown={item.quickFilter ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void handleQuickFilterChange(item.quickFilter!);
                }
              } : undefined}
              className={`overflow-hidden border-border/70 bg-gradient-to-br ${item.tone} ${item.quickFilter ? "cursor-pointer transition hover:border-primary/30 hover:bg-primary/5" : ""}`}
            >
              <CardContent className="flex items-center justify-between p-5">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">{item.title}</div>
                  <div className="text-3xl font-black">{item.value.toLocaleString("fa-IR")}</div>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-background/70">
                  <item.icon className={`h-6 w-6 ${item.quickFilter === "failed_ai" ? "text-rose-300" : "text-primary"}`} />
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
            className="cursor-pointer border-amber-300/20 bg-amber-400/10 transition hover:border-amber-300/40 hover:bg-amber-400/15"
          >
            <CardContent className="flex flex-col gap-3 p-5 text-sm leading-8 text-amber-50 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-black">تایید دستی رژیم‌های اتوماتیک فعال است</div>
                <div className="text-amber-100/80">بعد از ساخت رژیم توسط AI، تا زمانی که مدیر آن را تایید نکند کاربر نسخه را دریافت نمی‌کند و تاریخ شروع و پایان هم از روز تایید محاسبه می‌شود.</div>
              </div>
              <Badge className="w-fit bg-amber-500/20 text-amber-100 hover:bg-amber-500/20">
                {stats.pendingManualApprovals.toLocaleString("fa-IR")} مورد منتظر تایید
              </Badge>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>جستجو و وضعیت صف</CardTitle>
            <CardDescription>درخواست‌ها را با نام کاربر، شماره موبایل، نام رژیم یا شناسه جستجو کن و با فیلترهای سریع همان لحظه فقط موارد مهم را ببین.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="جستجو با نام، شماره، رژیم یا شناسه درخواست"
                  className="h-12 rounded-2xl pr-11"
                />
              </div>
              <Button type="submit" className="h-12 rounded-2xl px-6">جستجو</Button>
              {activeQuery ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl px-6"
                  onClick={() => {
                    setSearchTerm("");
                    void loadRequests("", 1, activeQuickFilter);
                  }}
                >
                  پاک کردن
                </Button>
              ) : null}
            </form>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">AI: {stats.aiRequests.toLocaleString("fa-IR")}</Badge>
              <Badge variant="secondary">کارشناس: {stats.expertRequests.toLocaleString("fa-IR")}</Badge>
              <Badge variant="outline">در صف AI: {stats.queuedAi.toLocaleString("fa-IR")}</Badge>
              <Badge variant="outline">در حال تولید: {stats.processingAi.toLocaleString("fa-IR")}</Badge>
              <Badge variant="outline">تولید شده: {stats.generatedAi.toLocaleString("fa-IR")}</Badge>
              <button type="button" onClick={() => void handleQuickFilterChange("failed_ai")}>
                <Badge variant="destructive">ناموفق: {stats.failedAi.toLocaleString("fa-IR")}</Badge>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              {quickFilters.map((filter) => {
                const isActive = activeQuickFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => void handleQuickFilterChange(filter.key)}
                    className={`rounded-2xl border p-4 text-right transition ${
                      isActive
                        ? "border-primary/40 bg-primary/10 shadow-sm"
                        : "border-border/70 bg-background/30 hover:bg-background/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-black">{filter.label}</div>
                      <Badge variant={isActive ? "default" : "secondary"}>
                        {quickFilterCounts[filter.key].toLocaleString("fa-IR")}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs leading-6 text-muted-foreground">{filter.description}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>فهرست درخواست‌ها</CardTitle>
            <CardDescription>روی هر درخواست بزن تا صفحه جزئیات کامل باز شود و همه snapshotها و ورودی‌های AI را ببینی.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                در حال بارگذاری...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-border/70 bg-background/20 px-6 py-16 text-center text-muted-foreground">
                موردی با این فیلتر پیدا نشد.
              </div>
            ) : (
              <div className="space-y-6">
                {expertItems.length ? (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-black text-amber-200">رژیم های اختصاصی توسط کارشناس</div>
                        <div className="mt-1 text-sm text-muted-foreground">این درخواست‌ها به‌جای AI نیاز به ارسال فایل یا نسخه اختصاصی از سمت کارشناس دارند.</div>
                      </div>
                      <Badge className="bg-amber-500/15 text-amber-200 hover:bg-amber-500/15">
                        {expertItems.length.toLocaleString("fa-IR")} مورد
                      </Badge>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {expertItems.map((item) => renderRequestCard(item, "expert"))}
                    </div>
                  </section>
                ) : null}

                {regularItems.length ? (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-black">سایر درخواست‌ها</div>
                        <div className="mt-1 text-sm text-muted-foreground">درخواست‌های آنلاین و سایر پرونده‌های رژیم از این بخش مدیریت می‌شوند.</div>
                      </div>
                      <Badge variant="secondary">
                        {regularItems.length.toLocaleString("fa-IR")} مورد
                      </Badge>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {regularItems.map((item) => renderRequestCard(item, "regular"))}
                    </div>
                  </section>
                ) : null}

                {lastPage > 1 ? (
                  <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                      صفحه {page.toLocaleString("fa-IR")} از {lastPage.toLocaleString("fa-IR")} • مجموع {totalItems.toLocaleString("fa-IR")} درخواست
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
                          {page.toLocaleString("fa-IR")} / {lastPage.toLocaleString("fa-IR")}
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
        <DialogContent dir="rtl" className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>حذف درخواست رژیم</DialogTitle>
            <DialogDescription className="leading-8">
              {deletingItem
                ? `درخواست «${deletingItem.dietTemplateName ?? "بدون عنوان"}» برای ${deletingItem.user?.name || "کاربر"} حذف می‌شود.`
                : "در حال آماده‌سازی..."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm leading-7 text-muted-foreground">
            اگر تیک زیر را فعال کنی، یک سهم از همان نوع درخواست به اشتراک کاربر برگردانده می‌شود.
            پیش‌فرض خاموش است تا ناخواسته موجودی اضافه نشود.
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <Checkbox id="refund-balance" checked={refundBalance} onCheckedChange={(checked) => setRefundBalance(Boolean(checked))} />
            <div className="space-y-1">
              <Label htmlFor="refund-balance" className="cursor-pointer text-sm font-bold">بعد از حذف، سهم رژیم به حساب کاربر برگردد</Label>
              <div className="text-xs leading-6 text-muted-foreground">
                برای درخواست آنلاین، از `رژیم آنلاین استفاده‌شده` کم می‌شود و برای درخواست اختصاصی، از `رژیم اختصاصی استفاده‌شده`.
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setDeletingItem(null)} className="rounded-2xl">انصراف</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submittingId === deletingItem?.id} className="rounded-2xl">
              {submittingId === deletingItem?.id ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Trash2 className="ml-2 h-4 w-4" />}
              حذف نهایی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader className="text-right">
            <DialogTitle>تنظیمات درخواست‌های رژیم</DialogTitle>
            <DialogDescription>
              این بخش مشخص می‌کند رژیم‌های اتوماتیک بعد از ساخت توسط AI مستقیم برای کاربر منتشر شوند یا قبل از ارسال، منتظر تایید دستی مدیر بمانند.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 text-right">
                <Label className="text-base font-black">نیاز به تایید دستی رژیم های اتوماتیک</Label>
                <p className="text-sm leading-7 text-muted-foreground">
                  اگر این گزینه روشن باشد، بعد از آماده شدن نسخه AI، مدیر باید داخل جزئیات درخواست تایید کند که رژیم برای کاربر ارسال شود. تا قبل از تایید، نسخه برای کاربر نمایش داده نمی‌شود.
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
              بستن
            </Button>
            <Button type="button" className="rounded-2xl" onClick={saveAdminSettings} disabled={loadingSettings || savingSettings}>
              {savingSettings ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
              ذخیره تنظیمات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
