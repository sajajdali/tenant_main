import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Gift, Loader2, Phone, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PaginatedReferralLeads } from "@/lib/types";
import { normalizePhoneInput } from "@/lib/normalize";
import { useAuth } from "@/lib/auth";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { PhoneText } from "@/i18n/ltr-text";

const statusLabelKeys = {
  pending: "panelReferrals.status.pending",
  rewarded: "panelReferrals.status.rewarded",
} as const;

export default function PanelReferralsPage() {
  const { isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const formatValue = useFormat();
  const { dir, isRtl } = useLocale();
  const [mobile, setMobile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedReferralLeads>({
    stats: { total: 0, pending: 0, rewarded: 0, rewardDays: 0 },
    items: [],
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  });

  const load = async (nextPage = page) => {
    setLoading(true);
    const res = await api.referrals.list(nextPage, 10);
    if (res.success) {
      setData(res.data);
      setPage(res.data.currentPage);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isPrimaryAdmin) {
      if (typeof window !== "undefined") {
        window.location.replace("/panel");
      }
      return;
    }
  }, [isPrimaryAdmin]);

  useEffect(() => {
    load(1);
  }, []);

  const rewardMonthsEstimate = useMemo(() => Math.floor(data.stats.rewardDays / 30), [data.stats.rewardDays]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const res = await api.referrals.create(mobile);
    if (res.success) {
      toast({ title: t("panelReferrals.toast.createdTitle"), description: t("panelReferrals.toast.createdDescription") });
      setMobile("");
      await load(1);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setSubmitting(false);
  };

  const formatDate = (value?: string | null) => value ? formatValue.date(`${value}T12:00:00`) : t("panelReferrals.notSet");
  const formatDays = (days?: number | null) => t("panelReferrals.days", { count: formatValue.number(days ?? 0) });

  if (!isPrimaryAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-10 text-start" dir={dir}>
      <div className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
          <div className="space-y-1 text-start">
            <h1 className="text-2xl font-black">{t("panelReferrals.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("common.back")} className="h-12 w-12 shrink-0 rounded-2xl">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-6xl space-y-6 px-4">
        <Card className="mx-auto max-w-4xl border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("panelReferrals.heroTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm leading-7 text-muted-foreground">
              {t("panelReferrals.heroDescription", { packageMonths: formatValue.number(6), rewardMonths: formatValue.number(3) })}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{t("panelReferrals.mobileLabel")}</label>
              <Input
                dir="ltr"
                inputMode="numeric"
                placeholder="0912xxxxxxx"
                value={mobile}
                onChange={(event) => setMobile(normalizePhoneInput(event.target.value))}
                className="text-start [direction:ltr]"
              />
            </div>
            <Button className="w-full" disabled={submitting || mobile.length !== 11} onClick={handleSubmit}>
              {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Phone className="me-2 h-4 w-4" />}
              {t("panelReferrals.submit")}
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Card>
            <CardContent className="flex items-center justify-between p-5">
              <div className="space-y-1 text-start">
                <div className="text-sm text-muted-foreground">{t("panelReferrals.stats.total")}</div>
                <div className="text-3xl font-black">{formatValue.number(data.stats.total)}</div>
              </div>
              <Users className="h-10 w-10 text-primary" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-5">
              <div className="space-y-1 text-start">
                <div className="text-sm text-muted-foreground">{t("panelReferrals.stats.rewarded")}</div>
                <div className="text-3xl font-black">{formatValue.number(data.stats.rewarded)}</div>
              </div>
              <Gift className="h-10 w-10 text-primary" />
            </CardContent>
          </Card>
          <Card className="col-span-2 lg:col-span-1">
            <CardContent className="p-5 text-start">
              <div className="text-sm text-muted-foreground">{t("panelReferrals.stats.rewardDays")}</div>
              <div className="mt-2 text-3xl font-black text-primary">{formatDays(data.stats.rewardDays)}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                {t("panelReferrals.stats.rewardMonthsEstimate", { count: formatValue.number(rewardMonthsEstimate) })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-6xl px-4">
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-start">
              <CardTitle>{t("panelReferrals.history.title")}</CardTitle>
              <CardDescription>{t("panelReferrals.history.description")}</CardDescription>
            </div>
            <Badge variant="outline" className="w-fit self-start px-3 py-1 text-xs sm:self-auto">
              {t("panelReferrals.history.total", { count: formatValue.number(data.total) })}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">{t("panelReferrals.history.loading")}</div>
            ) : data.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                {t("panelReferrals.history.empty")}
              </div>
            ) : (
              data.items.map((item) => (
                <div key={item.id} className="rounded-3xl border border-border bg-card/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2 text-start">
                      <div className="text-base font-bold"><PhoneText>{item.mobile}</PhoneText></div>
                      <div className="text-sm text-muted-foreground">
                        {t("panelReferrals.history.createdAt", { date: formatDate(item.createdAt?.slice(0, 10) ?? null) })}
                      </div>
                      {item.status === "rewarded" && (
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div>{t("panelReferrals.history.purchasedDuration", { days: formatDays(item.purchasedDurationDays) })}</div>
                          <div className="text-primary">{t("panelReferrals.history.rewardDuration", { days: formatDays(item.rewardDurationDays) })}</div>
                          <div>
                            {t("panelReferrals.history.supportRange", { from: formatDate(item.previousSupportEndsAt), to: formatDate(item.newSupportEndsAt) })}
                          </div>
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={item.status === "rewarded" ? "secondary" : "outline"}
                      className="shrink-0 self-start text-xs"
                    >
                      {t(statusLabelKeys[item.status])}
                    </Badge>
                  </div>
                </div>
              ))
            )}

            {data.lastPage > 1 && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button variant="outline" disabled={page >= data.lastPage} onClick={() => load(page + 1)}>
                  {t("common.pagination.next")}
                </Button>
                <div className="text-sm text-muted-foreground">
                  {t("common.pagination.pageOf", { current: formatValue.number(page), total: formatValue.number(data.lastPage) })}
                </div>
                <Button variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}>
                  {t("common.pagination.previous")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
