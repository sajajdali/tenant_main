import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Coins, Loader2, ReceiptText, Search, WalletCards } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { NutritionTokenHistoryPayload } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const EMPTY_PAYLOAD: NutritionTokenHistoryPayload = {
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
  perPage: 25,
  total: 0,
  lastPage: 1,
};

export default function PanelNutritionTokenHistoryPage() {
  const { isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<NutritionTokenHistoryPayload>(EMPTY_PAYLOAD);
  const [searchTerm, setSearchTerm] = useState("");

  const load = async (q = "") => {
    setLoading(true);
    const result = await api.nutritionTokens.history(q);

    if (result.success) {
      setPayload(result.data);
      setSearchTerm(result.data.filters.q);
    } else {
      toast({ variant: "destructive", title: t("nutritionTokens.toast.historyFailed"), description: result.message });
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isLoading || !isAdmin) {
      return;
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isLoading]);

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    await load(searchTerm);
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("nutritionTokens.history.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-black">{t("nutritionTokens.history.title")}</h1>
          <Link href="/panel/nutrition/tokens">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{t("nutritionTokens.history.stats.total")}</div>
                  <div className="mt-2 text-3xl font-black">{format.number(payload.stats.total)}</div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ReceiptText className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{t("nutritionTokens.history.stats.consumed")}</div>
                  <div className="mt-2 text-3xl font-black">{format.number(payload.stats.consumedTokens)}</div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
                  <Coins className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{t("nutritionTokens.history.stats.charged")}</div>
                  <div className="mt-2 text-3xl font-black">{format.number(payload.stats.chargedTokens)}</div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <WalletCards className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>{t("nutritionTokens.history.searchTitle")}</CardTitle>
            <CardDescription>{t("nutritionTokens.history.searchDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="h-12 rounded-2xl ps-11" placeholder={t("nutritionTokens.history.searchPlaceholder")} />
              </div>
              <Button type="submit" className="h-12 rounded-2xl px-6">{t("nutritionTokens.history.search")}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>{t("nutritionTokens.history.listTitle")}</CardTitle>
            <CardDescription>{t("nutritionTokens.history.listDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {payload.items.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-background/20 px-4 py-12 text-center text-muted-foreground">
                {t("nutritionTokens.history.empty")}
              </div>
            ) : (
              payload.items.map((entry) => (
                <div key={entry.id} className="rounded-[24px] border border-border/70 bg-background/25 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-black">{entry.reasonTitle}</div>
                        <Badge variant={entry.direction === "credit" ? "default" : "secondary"}>
                          {entry.direction === "credit" ? `+${format.number(entry.tokensAmount)}` : `-${format.number(entry.tokensAmount)}`}
                        </Badge>
                        <Badge variant="outline">{entry.eventTypeLabel ?? entry.eventType}</Badge>
                      </div>
                      <div className="text-sm font-medium text-foreground/90">{entry.summary || t("nutritionTokens.valueMissing")}</div>
                      <div className="text-sm text-muted-foreground">
                        {entry.subjectUser?.name || t("nutritionTokens.user.noName")} {entry.subjectUser?.mobile ? <><span>• </span><PhoneText>{entry.subjectUser.mobile}</PhoneText></> : ""}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">{entry.occurredAt ? format.dateTime(entry.occurredAt) : t("nutritionTokens.valueMissing")}</div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/70 bg-card/50 p-3">
                      <div className="text-xs text-muted-foreground">{t("nutritionTokens.history.balanceAfter")}</div>
                      <div className="mt-1 font-bold">{t("nutritionTokens.tokensCount", { count: format.number(entry.balanceAfter) })}</div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/50 p-3">
                      <div className="text-xs text-muted-foreground">{t("nutritionTokens.history.operationType")}</div>
                      <div className="mt-1 font-bold">{entry.directionLabel ?? t("nutritionTokens.valueMissing")}</div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/50 p-3">
                      <div className="text-xs text-muted-foreground">{t("nutritionTokens.history.relatedDiet")}</div>
                      <div className="mt-1 font-bold">{entry.dietRequest?.dietTemplateName ?? t("nutritionTokens.valueMissing")}</div>
                    </div>
                  </div>

                  {(entry.actorUser?.name || entry.meta?.model || entry.meta?.slot_title || (entry.meta?.usage as Record<string, unknown> | undefined)?.total_tokens) ? (
                    <div className="mt-3 rounded-2xl border border-border/70 bg-card/40 p-3 text-xs leading-6 text-muted-foreground">
                      {entry.actorUser?.name || entry.actorUser?.mobile ? (
                        <div>{t("nutritionTokens.history.actor")}: <span className="font-bold text-foreground">{entry.actorUser?.name || t("nutritionTokens.valueMissing")} {entry.actorUser?.mobile ? <><span>• </span><PhoneText>{entry.actorUser.mobile}</PhoneText></> : ""}</span></div>
                      ) : null}
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
