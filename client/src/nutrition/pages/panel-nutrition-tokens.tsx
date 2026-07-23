import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Bot, Coins, CreditCard, Loader2, ReceiptText, Search, WalletCards } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NutritionTokenDashboardPayload, NutritionTokenHistoryPayload } from "@/lib/types";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const EMPTY_DASHBOARD: NutritionTokenDashboardPayload = {
  stats: {
    newOfflineRequests: 0,
    prescribedToday: 0,
    currentTokens: 0,
    usedTokens: 0,
    purchasedTokens: 0,
    aiDietRequestCost: 0,
    aiQuestionCost: 0,
    tokenUnitPriceToman: 0,
  },
  filters: {
    q: "",
  },
  recentEntries: [],
  byUsers: [],
};

const EMPTY_HISTORY: NutritionTokenHistoryPayload = {
  stats: {
    total: 0,
    consumedTokens: 0,
    chargedTokens: 0,
  },
  filters: {
    q: "",
  },
  items: [],
  page: 1,
  perPage: 12,
  total: 0,
  lastPage: 1,
};

export default function PanelNutritionTokensPage() {
  const { isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<NutritionTokenDashboardPayload>(EMPTY_DASHBOARD);
  const [history, setHistory] = useState<NutritionTokenHistoryPayload>(EMPTY_HISTORY);
  const [searchTerm, setSearchTerm] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const loadDashboard = async (q = "", page = 1) => {
    setLoading(true);
    const [result, historyResult] = await Promise.all([
      api.nutritionTokens.dashboard(q),
      api.nutritionTokens.history(q, page, 12),
    ]);

    if (result.success) {
      setDashboard(result.data);
      setSearchTerm(result.data.filters.q);
    } else {
      toast({ variant: "destructive", title: t("nutritionTokens.toast.dashboardFailed"), description: result.message });
    }

    if (historyResult.success) {
      setHistory(historyResult.data);
      setHistoryPage(historyResult.data.page);
      setSearchTerm(historyResult.data.filters.q);
    } else {
      toast({ variant: "destructive", title: t("nutritionTokens.toast.historyFailed"), description: historyResult.message });
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isLoading || !isAdmin) {
      return;
    }

    void loadDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isLoading]);

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    await loadDashboard(searchTerm, 1);
  };

  const goToHistoryPage = async (page: number) => {
    const nextPage = Math.max(1, Math.min(page, history.lastPage || 1));
    await loadDashboard(searchTerm, nextPage);
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("nutritionTokens.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.18),_transparent_42%),linear-gradient(180deg,rgba(9,28,37,0.96),rgba(15,23,42,0))]" />

      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-black">{t("nutritionTokens.title")}</h1>
          <Link href="/panel">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{t("nutritionTokens.stats.newOfflineRequests")}</div>
                  <div className="mt-2 text-3xl font-black">{format.number(dashboard.stats.newOfflineRequests)}</div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <WalletCards className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{t("nutritionTokens.stats.prescribedToday")}</div>
                  <div className="mt-2 text-3xl font-black">{format.number(dashboard.stats.prescribedToday)}</div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
                  <Bot className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{t("nutritionTokens.stats.currentTokens")}</div>
                  <div className="mt-2 text-3xl font-black">{format.number(dashboard.stats.currentTokens)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t("nutritionTokens.tokenUnit")}</div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <Coins className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{t("nutritionTokens.tools.title")}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/panel/nutrition/tokens/top-up">
                      <Button className="rounded-2xl bg-teal-600 hover:bg-teal-500">
                        <CreditCard className="me-2 h-4 w-4" />
                        {t("nutritionTokens.tools.buy")}
                      </Button>
                    </Link>
                    <Link href="/panel/nutrition/tokens/history">
                      <Button variant="outline" className="rounded-2xl">
                        <ReceiptText className="me-2 h-4 w-4" />
                        {t("nutritionTokens.tools.history")}
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-400">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("nutritionTokens.history.title")}</CardTitle>
              <CardDescription>{t("nutritionTokens.history.description")}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-border bg-background/40 ps-11 pe-4 text-sm outline-none ring-0 placeholder:text-muted-foreground"
                    placeholder={t("nutritionTokens.history.searchPlaceholder")}
                  />
                </div>
                <Button type="submit" className="h-12 rounded-2xl px-6">{t("nutritionTokens.history.search")}</Button>
              </form>
            </CardContent>
            <CardContent className="space-y-3">
              {history.items.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-border/70 bg-background/20 px-4 py-10 text-center text-muted-foreground">
                  {t("nutritionTokens.history.empty")}
                </div>
              ) : (
                history.items.map((entry) => (
                  <div key={entry.id} className="rounded-[24px] border border-border/70 bg-background/25 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-black">{entry.reasonTitle}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {entry.subjectUser?.name || t("nutritionTokens.user.noUser")} {entry.subjectUser?.mobile ? <><span>• </span><PhoneText>{entry.subjectUser.mobile}</PhoneText></> : ""}
                        </div>
                        <div className="mt-2 text-sm font-medium text-foreground/90">
                          {entry.summary || entry.eventTypeLabel || t("nutritionTokens.valueMissing")}
                        </div>
                      </div>
                      <Badge variant={entry.direction === "credit" ? "default" : "secondary"}>
                        {entry.direction === "credit" ? `+${format.number(entry.tokensAmount)}` : `-${format.number(entry.tokensAmount)}`}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("nutritionTokens.history.balanceAfter")}</span>
                      <span className="font-bold">{t("nutritionTokens.tokensCount", { count: format.number(entry.balanceAfter) })}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("nutritionTokens.history.time")}</span>
                      <span className="font-bold">{entry.occurredAt ? format.dateTime(entry.occurredAt) : t("nutritionTokens.valueMissing")}</span>
                    </div>
                    {entry.actorUser?.name || entry.actorUser?.mobile ? (
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("nutritionTokens.history.actor")}</span>
                        <span className="font-bold">{entry.actorUser?.name || t("nutritionTokens.valueMissing")} {entry.actorUser?.mobile ? <><span>• </span><PhoneText>{entry.actorUser.mobile}</PhoneText></> : ""}</span>
                      </div>
                    ) : null}
                    {entry.dietRequest?.dietTemplateName ? (
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("nutritionTokens.history.relatedDiet")}</span>
                        <span className="font-bold">{entry.dietRequest.dietTemplateName}</span>
                      </div>
                    ) : null}
                    {(entry.meta?.model || entry.meta?.slot_title || (entry.meta?.usage as Record<string, unknown> | undefined)?.total_tokens) ? (
                      <div className="mt-3 rounded-2xl border border-border/60 bg-card/50 p-3 text-xs leading-6 text-muted-foreground">
                        {entry.meta?.model ? <div>{t("nutritionTokens.history.model")}: <span className="font-bold text-foreground">{String(entry.meta.model)}</span></div> : null}
                        {entry.meta?.slot_title ? <div>{t("nutritionTokens.history.relatedSlot")}: <span className="font-bold text-foreground">{String(entry.meta.slot_title)}</span></div> : null}
                        {entry.meta?.usage && typeof entry.meta.usage === "object" ? (
                          <div>
                            {t("nutritionTokens.history.actualUsage")}:
                            <span className="font-bold text-foreground"> {format.number(Number((entry.meta.usage as Record<string, unknown>).total_tokens ?? 0))} </span>
                            {t("nutritionTokens.tokenUnit")}
                            <span> (prompt: {format.number(Number((entry.meta.usage as Record<string, unknown>).prompt_tokens ?? 0))} / completion: {format.number(Number((entry.meta.usage as Record<string, unknown>).completion_tokens ?? 0))})</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
              {history.total > history.perPage ? (
                <div className="flex flex-col gap-3 rounded-[22px] border border-border/70 bg-background/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    {t("nutritionTokens.history.pageOf", { page: format.number(history.page), total: format.number(history.lastPage), rows: format.number(history.total) })}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      disabled={historyPage <= 1}
                      onClick={() => goToHistoryPage(historyPage - 1)}
                    >
                      {t("common.pagination.previous")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      disabled={historyPage >= history.lastPage}
                      onClick={() => goToHistoryPage(historyPage + 1)}
                    >
                      {t("common.pagination.next")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle>{t("nutritionTokens.byUsers.title")}</CardTitle>
                <CardDescription>{t("nutritionTokens.byUsers.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.byUsers.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-border/70 bg-background/20 px-4 py-8 text-center text-muted-foreground">
                    {t("nutritionTokens.byUsers.empty")}
                  </div>
                ) : (
                  dashboard.byUsers.map((item) => (
                    <div key={`${item.userId}-${item.mobile}`} className="rounded-[22px] border border-border/70 bg-background/25 p-4">
                      <div className="font-black">{item.name || t("nutritionTokens.user.noName")}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{item.mobile ? <PhoneText>{item.mobile}</PhoneText> : t("nutritionTokens.user.noPhone")}</div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("nutritionTokens.byUsers.consumedTokens")}</span>
                        <span className="font-bold">{t("nutritionTokens.tokensCount", { count: format.number(item.consumedTokens) })}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("nutritionTokens.byUsers.entriesCount")}</span>
                        <span className="font-bold">{format.number(item.entriesCount)}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
