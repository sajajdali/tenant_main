import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Coins, Gem, Gift, Loader2, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { CustomerClubMePayload } from "@/lib/types";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

export default function CustomerClubPage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<CustomerClubMePayload | null>(null);
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await api.customerClub.me();
    setLoading(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setPayload(res.data);
  };

  useEffect(() => {
    if (!isLoading && user) {
      void load();
    }
  }, [isLoading, user]);

  const redeemReward = async (rewardId: string) => {
    setRedeemingRewardId(rewardId);
    const res = await api.customerClub.redeemReward(rewardId);
    setRedeemingRewardId(null);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    toast({
      title: t("customerClub.toast.rewardRedeemed"),
      description: res.data.redemption.issuedCode
        ? t("customerClub.toast.rewardCode", { code: res.data.redemption.issuedCode })
        : t("customerClub.toast.rewardRedeemedDescription"),
    });
    void load();
  };

  if (isLoading || loading) {
    return (
      <div className="customer-club-page min-h-screen bg-background p-4 text-foreground" dir={dir}>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="me-2 h-5 w-5 animate-spin" />
          {t("customerClub.loading")}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="customer-club-page min-h-screen bg-background p-4 text-foreground" dir={dir}>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
          <Coins className="h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("customerClub.loginRequired.title")}</h1>
          <p className="text-sm leading-7 text-muted-foreground">{t("customerClub.loginRequired.description")}</p>
          <Link href="/">
            <Button>{t("customerClub.back")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!payload?.moduleActive) {
    return (
      <div className="customer-club-page min-h-screen bg-background p-4 text-foreground" dir={dir}>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-xl font-bold">{t("customerClub.inactive.title")}</h1>
          <p className="text-sm leading-7 text-muted-foreground">{t("customerClub.inactive.description")}</p>
          <Link href="/">
            <Button>{t("customerClub.back")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const account = payload.account;

  return (
    <div className="customer-club-page min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="customer-club-header sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("customerClub.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("customerClub.description")}</p>
          </div>
          <Link href="/">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          {payload.settings.showPointsToCustomer && (
            <Card className="border-border/70 bg-card/60">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <div className="text-sm text-muted-foreground">{t("customerClub.summary.points")}</div>
                  <div className="mt-2 text-lg font-black">{format.number(account.pointsBalance)}</div>
                </div>
                <Sparkles className="h-8 w-8 text-primary" />
              </CardContent>
            </Card>
          )}
          {payload.settings.showWalletToCustomer && (
            <Card className="border-border/70 bg-card/60">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <div className="text-sm text-muted-foreground">{t("customerClub.summary.wallet")}</div>
                  <div className="mt-2 text-lg font-black">{format.currency(account.walletBalance)}</div>
                </div>
                <Coins className="h-8 w-8 text-primary" />
              </CardContent>
            </Card>
          )}
          {payload.settings.showTierToCustomer && (
            <Card className="border-border/70 bg-card/60">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <div className="text-sm text-muted-foreground">{t("customerClub.summary.tier")}</div>
                  <div className="mt-2 flex items-center gap-2 text-lg font-black">
                    {account.currentTier?.title || t("customerClub.summary.noTier")}
                    {account.isVip && (
                      <Badge className="border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
                        <Gem className="me-1 h-3 w-3" />
                        VIP
                      </Badge>
                    )}
                  </div>
                </div>
                <Trophy className="h-8 w-8 text-primary" />
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>{t("customerClub.rewards.title")}</CardTitle>
            <CardDescription>{t("customerClub.rewards.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {payload.rewards.map((reward) => (
              <div key={reward.id} className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold">{reward.title}</div>
                  <Badge variant="outline">{t("customerClub.points", { count: format.number(reward.costPoints) })}</Badge>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">{reward.description || t("customerClub.noDescription")}</div>
                <div className="mt-4 rounded-xl border border-border/70 bg-background/40 p-3 text-sm">
                  {reward.rewardType === "wallet_credit" && t("customerClub.reward.walletCredit", { amount: format.currency(reward.walletAmount) })}
                  {reward.rewardType === "bonus_points" && t("customerClub.reward.bonusPoints", { count: format.number(reward.bonusPoints) })}
                  {reward.rewardType === "vip_access" && t("customerClub.reward.vipDays", { count: format.number(reward.vipDays) })}
                </div>
                <Button className="mt-4 w-full" disabled={!reward.canRedeem || redeemingRewardId === reward.id} onClick={() => redeemReward(reward.id)}>
                  {redeemingRewardId === reward.id ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Gift className="me-2 h-4 w-4" />}
                  {reward.canRedeem ? t("customerClub.rewards.redeem") : t("customerClub.rewards.notEnoughPoints")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("customerClub.ledger.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {payload.recentLedger.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border/70 bg-background/35 p-4">
                  <div className="font-bold">{entry.title}</div>
                  <div className="mt-2 flex gap-2 text-sm">
                    <Badge variant="outline">{t("customerClub.pointsDelta", { sign: entry.pointsDelta >= 0 ? "+" : "", count: format.number(entry.pointsDelta) })}</Badge>
                    <Badge variant="outline">{entry.walletDelta >= 0 ? "+" : ""}{format.currency(entry.walletDelta)}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("customerClub.redemptions.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {payload.recentRedemptions.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border/70 bg-background/35 p-4">
                  <div className="font-bold">{item.reward?.title || t("customerClub.redemptions.rewardFallback")}</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {item.issuedCode
                      ? (
                        <>
                          {t("customerClub.redemptions.issuedCode")} <CodeText>{item.issuedCode}</CodeText>
                        </>
                      )
                      : t("customerClub.redemptions.registered")}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
