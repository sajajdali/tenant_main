import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, CalendarDays, History, Loader2, MessageSquareText, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { getAudienceLabels } from "@/lib/audience";
import type { PaginatedSmsOutbounds, SmsOutboundItem } from "@/lib/types";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

const EMPTY_SMS_OUTBOUNDS: PaginatedSmsOutbounds = {
  items: [],
  currentPage: 1,
  lastPage: 1,
  perPage: 10,
  total: 0,
  search: "",
};

const statCards = [
  {
    key: "totalSent",
    titleKey: "panelSmsOutbounds.stats.totalSent.title",
    descriptionKey: "panelSmsOutbounds.stats.totalSent.description",
    icon: History,
    accent: "from-amber-500/20 via-amber-500/10 to-transparent",
    iconClass: "bg-amber-500/15 text-amber-300",
  },
  {
    key: "sentToday",
    titleKey: "panelSmsOutbounds.stats.sentToday.title",
    descriptionKey: "panelSmsOutbounds.stats.sentToday.description",
    icon: Sparkles,
    accent: "from-sky-500/20 via-sky-500/10 to-transparent",
    iconClass: "bg-sky-500/15 text-sky-300",
  },
  {
    key: "sentYesterday",
    titleKey: "panelSmsOutbounds.stats.sentYesterday.title",
    descriptionKey: "panelSmsOutbounds.stats.sentYesterday.description",
    icon: MessageSquareText,
    accent: "from-violet-500/20 via-violet-500/10 to-transparent",
    iconClass: "bg-violet-500/15 text-violet-300",
  },
  {
    key: "sentThisWeek",
    titleKey: "panelSmsOutbounds.stats.sentThisWeek.title",
    descriptionKey: "panelSmsOutbounds.stats.sentThisWeek.description",
    icon: CalendarDays,
    accent: "from-emerald-500/20 via-emerald-500/10 to-transparent",
    iconClass: "bg-emerald-500/15 text-emerald-300",
  },
] as const satisfies ReadonlyArray<{
  key: keyof NonNullable<PaginatedSmsOutbounds["stats"]>;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  icon: typeof History;
  accent: string;
  iconClass: string;
}>;

export default function PanelSmsOutboundsPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const { isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const tenantMeta = getInitialTenantMeta();
  const labels = getAudienceLabels(tenantMeta);
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<PaginatedSmsOutbounds>(EMPTY_SMS_OUTBOUNDS);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const formatSmsDate = (value?: string | null) => value ? format.dateTime(value) : "—";

  const loadHistory = async (page = 1, nextSearch = search) => {
    setLoading(true);
    const res = await api.sms.listOutbounds(page, 10, nextSearch);
    setLoading(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("panelSmsOutbounds.toast.loadFailed"),
        description: res.message,
      });
      return;
    }

    setHistory(res.data);
  };

  useEffect(() => {
    loadHistory(1, "");
  }, []);

  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <MessageSquareText className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelSmsOutbounds.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelSmsOutbounds.accessDenied.description")}</p>
          <Link href="/panel/sms-settings">
            <Button>{t("panelSmsOutbounds.accessDenied.back")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin />;
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black">{t("panelSmsOutbounds.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelSmsOutbounds.description")}</p>
          </div>
          <Link href="/panel/sms-settings">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl">
              <BackIcon className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-5 px-4 py-6">
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {statCards.map((item) => {
            const Icon = item.icon;
            const value = history.stats?.[item.key] ?? 0;

            return (
              <Card key={item.key} className="relative overflow-hidden border-border/70 bg-card/70 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)]">
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.accent}`} />
                <CardContent className="relative p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-bold text-muted-foreground">{t(item.titleKey)}</div>
                      <div className="text-4xl font-black tracking-tight text-foreground">
                        {format.number(value)}
                      </div>
                      <div className="text-xs leading-6 text-muted-foreground">{t(item.descriptionKey)}</div>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 ${item.iconClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>{t("panelSmsOutbounds.list.title")}</CardTitle>
            <CardDescription>{t("panelSmsOutbounds.list.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("panelSmsOutbounds.search.placeholder")}
                  className="ps-10"
                />
              </div>
              <Button variant="outline" className="rounded-2xl" onClick={() => loadHistory(1, search)}>
                {t("panelSmsOutbounds.search.button")}
              </Button>
            </div>

            {loading ? (
              <div className="flex h-32 items-center justify-center rounded-[24px] border border-border/70 bg-background/25 text-sm text-muted-foreground">
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t("panelSmsOutbounds.list.loading")}
              </div>
            ) : history.items.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-background/20 p-6 text-center text-sm text-muted-foreground">
                {t("panelSmsOutbounds.list.empty")}
              </div>
            ) : (
              <div className="space-y-3">
                {history.items.map((item: SmsOutboundItem) => (
                  <div key={item.id} className="rounded-[22px] border border-border/70 bg-background/35 p-4">
                    <div className="mb-2 text-sm text-muted-foreground">
                      <PhoneText>{item.recipientMobile}</PhoneText>
                    </div>
                    <div className="mb-3 whitespace-pre-wrap text-sm leading-8">{item.message}</div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <div>{format.currency(item.totalPrice)}</div>
                      <div>{formatSmsDate(item.sentAt ?? item.createdAt)}</div>
                    </div>
                  </div>
                ))}

                <div className="flex flex-col gap-3 border-t border-border/70 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-muted-foreground">
                    {t("panelSmsOutbounds.total", { count: format.number(history.total) })}
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      disabled={history.currentPage <= 1 || loading}
                      onClick={() => loadHistory(history.currentPage - 1, search)}
                    >
                      {t("common.pagination.previous")}
                    </Button>
                    <div className="min-w-[90px] text-center text-muted-foreground">
                      {t("panelSmsOutbounds.pagination.short", {
                        current: format.number(history.currentPage),
                        total: format.number(history.lastPage),
                      })}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      disabled={history.currentPage >= history.lastPage || loading}
                      onClick={() => loadHistory(history.currentPage + 1, search)}
                    >
                      {t("common.pagination.next")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
