import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BadgePercent, Coins, Crown, Gem, Gift, Loader2, Pencil, Plus, Save, Sparkles, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import type {
  CustomerClubAdminMember,
  CustomerClubAdminOverview,
  CustomerClubReward,
  CustomerClubRewardType,
  CustomerClubSettings,
  CustomerClubTier,
} from "@/lib/types";

const tierBadgeClass = (color?: string) => {
  switch (color) {
    case "amber":
    case "yellow":
      return "border-amber-400/30 bg-amber-500/10 text-amber-200";
    case "cyan":
      return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
    case "slate":
      return "border-slate-400/30 bg-slate-500/10 text-slate-200";
    default:
      return "border-primary/30 bg-primary/10 text-primary";
  }
};

const emptyTier = {
  title: "",
  slug: "",
  badgeColor: "amber",
  icon: "",
  minimumPoints: 0,
  minimumWallet: 0,
  sortOrder: 0,
  isActive: true,
  benefitsText: "",
};

const emptyReward = {
  title: "",
  slug: "",
  rewardType: "wallet_credit" as CustomerClubRewardType,
  costPoints: 0,
  walletAmount: 0,
  bonusPoints: 0,
  vipDays: 30,
  perUserLimit: 1,
  totalLimit: "",
  sortOrder: 0,
  isActive: true,
  description: "",
};

const settingToggleKeys: Array<[keyof CustomerClubSettings, MessageKey]> = [
  ["isEnabled", "panelCustomerClub.settings.toggle.isEnabled"],
  ["pointsEnabled", "panelCustomerClub.settings.toggle.pointsEnabled"],
  ["walletEnabled", "panelCustomerClub.settings.toggle.walletEnabled"],
  ["tiersEnabled", "panelCustomerClub.settings.toggle.tiersEnabled"],
  ["rewardsEnabled", "panelCustomerClub.settings.toggle.rewardsEnabled"],
  ["autoTierUpgradeEnabled", "panelCustomerClub.settings.toggle.autoTierUpgradeEnabled"],
  ["manualAdjustmentsEnabled", "panelCustomerClub.settings.toggle.manualAdjustmentsEnabled"],
  ["showWalletToCustomer", "panelCustomerClub.settings.toggle.showWalletToCustomer"],
  ["showPointsToCustomer", "panelCustomerClub.settings.toggle.showPointsToCustomer"],
  ["showTierToCustomer", "panelCustomerClub.settings.toggle.showTierToCustomer"],
];

export default function PanelCustomerClubPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<CustomerClubAdminOverview | null>(null);
  const [settings, setSettings] = useState<CustomerClubSettings | null>(null);
  const [members, setMembers] = useState<CustomerClubAdminMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<CustomerClubTier | null>(null);
  const [editingReward, setEditingReward] = useState<CustomerClubReward | null>(null);
  const [tierForm, setTierForm] = useState(emptyTier);
  const [rewardForm, setRewardForm] = useState(emptyReward);
  const [savingTier, setSavingTier] = useState(false);
  const [savingReward, setSavingReward] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustingMember, setAdjustingMember] = useState<CustomerClubAdminMember | null>(null);
  const [adjustForm, setAdjustForm] = useState({ pointsDelta: 0, walletDelta: 0, title: "", description: "" });
  const [adjusting, setAdjusting] = useState(false);
  const tenantMeta = getInitialTenantMeta();
  const isNutritionAudience = ["nutritionists", "nutrition-doctors"].includes(tenantMeta?.audience?.slug ?? "");
  const formatIranToman = (amount: number, clamp = true) => t("panelCustomerClub.units.iranToman", {
    value: format.number(clamp ? Math.max(0, amount) : amount),
  });
  const formatPoints = (amount: number) => t("panelCustomerClub.units.points", { count: format.number(amount) });
  const formatSignedPoints = (amount: number) => t("panelCustomerClub.units.pointsDelta", {
    sign: amount >= 0 ? "+" : "",
    count: format.number(amount),
  });

  const loadOverview = async () => {
    setLoading(true);
    const res = await api.customerClub.adminOverview();
    setLoading(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setOverview(res.data);
    setSettings(res.data.settings);
  };

  const loadMembers = async (term = search) => {
    setMembersLoading(true);
    const res = await api.customerClub.members(1, 20, term);
    setMembersLoading(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setMembers(res.data.items);
  };

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    void loadOverview();
    void loadMembers("");
  }, [isAdmin]);

  const moduleActive = overview?.moduleActive ?? false;

  const openTierDialog = (tier?: CustomerClubTier) => {
    setEditingTier(tier ?? null);
    setTierForm(tier ? {
      title: tier.title,
      slug: tier.slug,
      badgeColor: tier.badgeColor,
      icon: tier.icon || "",
      minimumPoints: tier.minimumPoints,
      minimumWallet: tier.minimumWallet,
      sortOrder: tier.sortOrder,
      isActive: tier.isActive,
      benefitsText: (tier.benefits || []).join("\n"),
    } : emptyTier);
    setTierDialogOpen(true);
  };

  const openRewardDialog = (reward?: CustomerClubReward) => {
    setEditingReward(reward ?? null);
    setRewardForm(reward ? {
      title: reward.title,
      slug: reward.slug,
      rewardType: reward.rewardType,
      costPoints: reward.costPoints,
      walletAmount: reward.walletAmount,
      bonusPoints: reward.bonusPoints,
      vipDays: reward.vipDays,
      perUserLimit: reward.perUserLimit,
      totalLimit: reward.totalLimit ? String(reward.totalLimit) : "",
      sortOrder: reward.sortOrder,
      isActive: reward.isActive,
      description: reward.description || "",
    } : emptyReward);
    setRewardDialogOpen(true);
  };

  const saveSettings = async () => {
    if (!settings) {
      return;
    }

    setSavingSettings(true);
    const res = await api.customerClub.updateSettings({
      is_enabled: settings.isEnabled,
      points_enabled: settings.pointsEnabled,
      wallet_enabled: settings.walletEnabled,
      tiers_enabled: settings.tiersEnabled,
      rewards_enabled: settings.rewardsEnabled,
      auto_tier_upgrade_enabled: settings.autoTierUpgradeEnabled,
      appointment_points_enabled: settings.appointmentPointsEnabled,
      appointment_fixed_points: settings.appointmentFixedPoints,
      appointment_points_per_100k: settings.appointmentPointsPer100k,
      appointment_wallet_enabled: settings.appointmentWalletEnabled,
      appointment_fixed_wallet: settings.appointmentFixedWallet,
      store_points_enabled: settings.storePointsEnabled,
      store_fixed_points: settings.storeFixedPoints,
      store_points_per_100k: settings.storePointsPer100k,
      store_wallet_enabled: settings.storeWalletEnabled,
      store_wallet_percent: settings.storeWalletPercent,
      welcome_bonus_enabled: settings.welcomeBonusEnabled,
      welcome_bonus_points: settings.welcomeBonusPoints,
      welcome_bonus_wallet: settings.welcomeBonusWallet,
      birthday_bonus_enabled: settings.birthdayBonusEnabled,
      birthday_bonus_points: settings.birthdayBonusPoints,
      birthday_bonus_wallet: settings.birthdayBonusWallet,
      manual_adjustments_enabled: settings.manualAdjustmentsEnabled,
      show_wallet_to_customer: settings.showWalletToCustomer,
      show_points_to_customer: settings.showPointsToCustomer,
      show_tier_to_customer: settings.showTierToCustomer,
      nutrition_rewards_enabled: settings.nutritionRewardsEnabled,
      nutrition_daily_food_log_enabled: settings.nutritionDailyFoodLogEnabled,
      nutrition_daily_food_log_points: settings.nutritionDailyFoodLogPoints,
      nutrition_per_meal_log_enabled: settings.nutritionPerMealLogEnabled,
      nutrition_per_meal_log_points: settings.nutritionPerMealLogPoints,
      nutrition_daily_water_log_enabled: settings.nutritionDailyWaterLogEnabled,
      nutrition_daily_water_log_points: settings.nutritionDailyWaterLogPoints,
      nutrition_weight_loss_reward_enabled: settings.nutritionWeightLossRewardEnabled,
      nutrition_weight_loss_reward_points: settings.nutritionWeightLossRewardPoints,
      nutrition_online_diet_request_reward_enabled: settings.nutritionOnlineDietRequestRewardEnabled,
      nutrition_online_diet_request_reward_points: settings.nutritionOnlineDietRequestRewardPoints,
    });
    setSavingSettings(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setSettings(res.data);
    toast({ title: t("panelCustomerClub.toast.saved"), description: t("panelCustomerClub.toast.settingsSaved") });
  };

  const saveTier = async () => {
    setSavingTier(true);
    const payload = {
      title: tierForm.title,
      slug: tierForm.slug || undefined,
      badge_color: tierForm.badgeColor,
      icon: tierForm.icon || undefined,
      minimum_points: Number(tierForm.minimumPoints),
      minimum_wallet: Number(tierForm.minimumWallet),
      sort_order: Number(tierForm.sortOrder),
      is_active: tierForm.isActive,
      benefits: tierForm.benefitsText.split("\n").map((item) => item.trim()).filter(Boolean),
    };
    const res = editingTier
      ? await api.customerClub.updateTier(editingTier.id, payload)
      : await api.customerClub.createTier(payload);
    setSavingTier(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setTierDialogOpen(false);
    toast({ title: t("panelCustomerClub.toast.saved"), description: t("panelCustomerClub.toast.tierSaved") });
    void loadOverview();
  };

  const saveReward = async () => {
    setSavingReward(true);
    const payload = {
      title: rewardForm.title,
      slug: rewardForm.slug || undefined,
      reward_type: rewardForm.rewardType,
      cost_points: Number(rewardForm.costPoints),
      wallet_amount: Number(rewardForm.walletAmount),
      bonus_points: Number(rewardForm.bonusPoints),
      vip_days: Number(rewardForm.vipDays),
      per_user_limit: Number(rewardForm.perUserLimit),
      total_limit: rewardForm.totalLimit.trim() === "" ? null : Number(rewardForm.totalLimit),
      sort_order: Number(rewardForm.sortOrder),
      is_active: rewardForm.isActive,
      description: rewardForm.description || undefined,
    };
    const res = editingReward
      ? await api.customerClub.updateReward(editingReward.id, payload)
      : await api.customerClub.createReward(payload);
    setSavingReward(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setRewardDialogOpen(false);
    toast({ title: t("panelCustomerClub.toast.saved"), description: t("panelCustomerClub.toast.rewardSaved") });
    void loadOverview();
  };

  const removeTier = async (tier: CustomerClubTier) => {
    const res = await api.customerClub.deleteTier(tier.id);
    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }
    toast({ title: t("panelCustomerClub.toast.deleted"), description: t("panelCustomerClub.toast.tierDeleted") });
    void loadOverview();
  };

  const removeReward = async (reward: CustomerClubReward) => {
    const res = await api.customerClub.deleteReward(reward.id);
    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }
    toast({ title: t("panelCustomerClub.toast.deleted"), description: t("panelCustomerClub.toast.rewardDeleted") });
    void loadOverview();
  };

  const openAdjustDialog = (member: CustomerClubAdminMember) => {
    setAdjustingMember(member);
    setAdjustForm({
      pointsDelta: 0,
      walletDelta: 0,
      title: t("panelCustomerClub.adjust.defaultTitle", { member: member.name || member.mobile }),
      description: "",
    });
    setAdjustDialogOpen(true);
  };

  const submitAdjustment = async () => {
    if (!adjustingMember) {
      return;
    }

    setAdjusting(true);
    const res = await api.customerClub.adjustMember(adjustingMember.userId, {
      points_delta: Number(adjustForm.pointsDelta),
      wallet_delta: Number(adjustForm.walletDelta),
      title: adjustForm.title,
      description: adjustForm.description || undefined,
    });
    setAdjusting(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    setAdjustDialogOpen(false);
    toast({ title: t("panelCustomerClub.toast.registered"), description: t("panelCustomerClub.toast.adjustmentRegistered") });
    void loadMembers();
    void loadOverview();
  };

  const rewardHint = useMemo(() => {
    switch (rewardForm.rewardType) {
      case "bonus_points":
        return t("panelCustomerClub.rewards.hint.bonusPoints");
      case "vip_access":
        return t("panelCustomerClub.rewards.hint.vipAccess");
      default:
        return t("panelCustomerClub.rewards.hint.walletCredit");
    }
  }, [rewardForm.rewardType, t]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground" dir={dir}>
        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-24 text-center">
          <Users className="h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelCustomerClub.accessDenied.title")}</h1>
          <p className="text-sm leading-7 text-muted-foreground">{t("panelCustomerClub.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelCustomerClub.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-customer-club-page min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="panel-customer-club-header sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1 text-start">
            <h1 className="text-xl font-bold text-start">{t("panelCustomerClub.title")}</h1>
            <p className="text-sm text-muted-foreground text-start">{t("panelCustomerClub.description")}</p>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelCustomerClub.loading")}
          </div>
        ) : !overview ? null : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="customer-club-stat-card border-border/70 bg-card/60">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="text-start">
                    <div className="text-sm text-muted-foreground text-start">{t("panelCustomerClub.stats.moduleStatus")}</div>
                    <div className="mt-2 text-lg font-black text-start">{moduleActive ? t("panelCustomerClub.status.active") : t("panelCustomerClub.status.inactive")}</div>
                  </div>
                  <Coins className="h-8 w-8 text-primary" />
                </CardContent>
              </Card>
              <Card className="customer-club-stat-card border-border/70 bg-card/60">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="text-start">
                    <div className="text-sm text-muted-foreground text-start">{t("panelCustomerClub.stats.members")}</div>
                    <div className="mt-2 text-lg font-black text-start">{format.number(overview.stats.membersCount)}</div>
                  </div>
                  <Users className="h-8 w-8 text-primary" />
                </CardContent>
              </Card>
              <Card className="customer-club-stat-card border-border/70 bg-card/60">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="text-start">
                    <div className="text-sm text-muted-foreground text-start">{t("panelCustomerClub.stats.points")}</div>
                    <div className="mt-2 text-lg font-black text-start">{format.number(overview.stats.pointsBalance)}</div>
                  </div>
                  <Sparkles className="h-8 w-8 text-primary" />
                </CardContent>
              </Card>
              <Card className="customer-club-stat-card border-border/70 bg-card/60">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="text-start">
                    <div className="text-sm text-muted-foreground text-start">{t("panelCustomerClub.stats.wallet")}</div>
                    <div className="mt-2 text-lg font-black text-start">{formatIranToman(overview.stats.walletBalance)}</div>
                  </div>
                  <BadgePercent className="h-8 w-8 text-primary" />
                </CardContent>
              </Card>
            </div>

            {!moduleActive && (
              <Card className="border-amber-500/30 bg-amber-500/10">
                <CardContent className="p-5 text-sm leading-7 text-amber-100">
                  {t("panelCustomerClub.moduleInactiveNotice")}
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="settings" className="customer-club-tabs space-y-4">
              <TabsList className="customer-club-tabs-list grid w-full grid-cols-4">
                <TabsTrigger className="customer-club-tabs-trigger" value="settings">{t("panelCustomerClub.tabs.settings")}</TabsTrigger>
                <TabsTrigger className="customer-club-tabs-trigger" value="tiers">{t("panelCustomerClub.tabs.tiers")}</TabsTrigger>
                <TabsTrigger className="customer-club-tabs-trigger" value="rewards">{t("panelCustomerClub.tabs.rewards")}</TabsTrigger>
                <TabsTrigger className="customer-club-tabs-trigger" value="members">{t("panelCustomerClub.tabs.members")}</TabsTrigger>
              </TabsList>

              <TabsContent value="settings" className="space-y-4">
                {settings && (
                  <Card className="customer-club-panel-card border-border/70 bg-card/60">
                    <CardHeader className="text-start">
                      <CardTitle className="text-start">{t("panelCustomerClub.settings.title")}</CardTitle>
                      <CardDescription className="text-start">{t("panelCustomerClub.settings.description")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-3">
                        {settingToggleKeys.map(([key, labelKey]) => (
                          <div key={key} className="customer-club-setting-toggle flex items-center justify-between rounded-2xl border border-border/70 bg-background/40 px-4 py-3 text-start">
                            <Label>{t(labelKey)}</Label>
                            <Switch
                              checked={Boolean(settings[key])}
                              onCheckedChange={(checked) => setSettings((current) => current ? { ...current, [key]: checked } : current)}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Card className="customer-club-inner-card border-border/70 bg-background/30">
                          <CardHeader className="text-start">
                            <CardTitle className="text-base text-start">{t("panelCustomerClub.settings.appointmentRewards")}</CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-4 md:grid-cols-2">
                            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-start">
                              <Label>{t("panelCustomerClub.settings.appointmentPoints")}</Label>
                              <Switch checked={settings.appointmentPointsEnabled} onCheckedChange={(checked) => setSettings({ ...settings, appointmentPointsEnabled: checked })} />
                            </div>
                            <div className="text-start">
                              <Label>{t("panelCustomerClub.settings.fixedPoints")}</Label>
                              <Input className="text-start" type="number" value={settings.appointmentFixedPoints} onChange={(e) => setSettings({ ...settings, appointmentFixedPoints: Number(e.target.value) })} />
                            </div>
                            <div className="text-start">
                              <Label>{t("panelCustomerClub.settings.pointsPer100k")}</Label>
                              <Input className="text-start" type="number" value={settings.appointmentPointsPer100k} onChange={(e) => setSettings({ ...settings, appointmentPointsPer100k: Number(e.target.value) })} />
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-start">
                              <Label>{t("panelCustomerClub.settings.appointmentWallet")}</Label>
                              <Switch checked={settings.appointmentWalletEnabled} onCheckedChange={(checked) => setSettings({ ...settings, appointmentWalletEnabled: checked })} />
                            </div>
                            <div className="text-start">
                              <Label>{t("panelCustomerClub.settings.appointmentFixedWallet")}</Label>
                              <Input className="text-start" type="number" value={settings.appointmentFixedWallet} onChange={(e) => setSettings({ ...settings, appointmentFixedWallet: Number(e.target.value) })} />
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="customer-club-inner-card border-border/70 bg-background/30">
                          <CardHeader className="text-start">
                            <CardTitle className="text-base text-start">{t("panelCustomerClub.settings.storeAndGifts")}</CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-4 md:grid-cols-2">
                            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-start">
                              <Label>{t("panelCustomerClub.settings.storePoints")}</Label>
                              <Switch checked={settings.storePointsEnabled} onCheckedChange={(checked) => setSettings({ ...settings, storePointsEnabled: checked })} />
                            </div>
                            <div className="text-start">
                              <Label>{t("panelCustomerClub.settings.storeFixedPoints")}</Label>
                              <Input className="text-start" type="number" value={settings.storeFixedPoints} onChange={(e) => setSettings({ ...settings, storeFixedPoints: Number(e.target.value) })} />
                            </div>
                            <div className="text-start">
                              <Label>{t("panelCustomerClub.settings.pointsPer100k")}</Label>
                              <Input className="text-start" type="number" value={settings.storePointsPer100k} onChange={(e) => setSettings({ ...settings, storePointsPer100k: Number(e.target.value) })} />
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-start">
                              <Label>{t("panelCustomerClub.settings.storeWallet")}</Label>
                              <Switch checked={settings.storeWalletEnabled} onCheckedChange={(checked) => setSettings({ ...settings, storeWalletEnabled: checked })} />
                            </div>
                            <div className="text-start">
                              <Label>{t("panelCustomerClub.settings.storeWalletPercent")}</Label>
                              <Input className="text-start" type="number" value={settings.storeWalletPercent} onChange={(e) => setSettings({ ...settings, storeWalletPercent: Number(e.target.value) })} />
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-start">
                              <Label>{t("panelCustomerClub.settings.welcomeBonus")}</Label>
                              <Switch checked={settings.welcomeBonusEnabled} onCheckedChange={(checked) => setSettings({ ...settings, welcomeBonusEnabled: checked })} />
                            </div>
                            <div className="text-start">
                              <Label>{t("panelCustomerClub.settings.welcomeBonusPoints")}</Label>
                              <Input className="text-start" type="number" value={settings.welcomeBonusPoints} onChange={(e) => setSettings({ ...settings, welcomeBonusPoints: Number(e.target.value) })} />
                            </div>
                            <div className="text-start">
                              <Label>{t("panelCustomerClub.settings.welcomeBonusWallet")}</Label>
                              <Input className="text-start" type="number" value={settings.welcomeBonusWallet} onChange={(e) => setSettings({ ...settings, welcomeBonusWallet: Number(e.target.value) })} />
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {isNutritionAudience ? (
                        <Card className="customer-club-inner-card border-border/70 bg-background/30">
                          <CardHeader className="text-start">
                            <CardTitle className="text-base text-start">{t("panelCustomerClub.settings.nutritionRewards")}</CardTitle>
                            <CardDescription className="text-start">
                              {t("panelCustomerClub.settings.nutritionDescription")}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="grid gap-4 md:grid-cols-2">
                            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-start md:col-span-2">
                              <Label>{t("panelCustomerClub.settings.nutritionEnable")}</Label>
                              <Switch checked={settings.nutritionRewardsEnabled} onCheckedChange={(checked) => setSettings({ ...settings, nutritionRewardsEnabled: checked })} />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-start">
                              <Label>{t("panelCustomerClub.settings.dailyFoodLog")}</Label>
                              <Switch checked={settings.nutritionDailyFoodLogEnabled} onCheckedChange={(checked) => setSettings({ ...settings, nutritionDailyFoodLogEnabled: checked })} />
                            </div>
                            <div className="text-start">
                              <Label>{t("panelCustomerClub.settings.dailyFoodLogPoints")}</Label>
                              <Input className="text-start" type="number" value={settings.nutritionDailyFoodLogPoints} onChange={(e) => setSettings({ ...settings, nutritionDailyFoodLogPoints: Number(e.target.value) })} />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-start">
                              <Label>{t("panelCustomerClub.settings.perMealLog")}</Label>
                              <Switch checked={settings.nutritionPerMealLogEnabled} onCheckedChange={(checked) => setSettings({ ...settings, nutritionPerMealLogEnabled: checked })} />
                            </div>
                            <div className="text-start">
                              <Label>{t("panelCustomerClub.settings.perMealLogPoints")}</Label>
                              <Input className="text-start" type="number" value={settings.nutritionPerMealLogPoints} onChange={(e) => setSettings({ ...settings, nutritionPerMealLogPoints: Number(e.target.value) })} />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-start">
                              <Label>{t("panelCustomerClub.settings.dailyWaterLog")}</Label>
                              <Switch checked={settings.nutritionDailyWaterLogEnabled} onCheckedChange={(checked) => setSettings({ ...settings, nutritionDailyWaterLogEnabled: checked })} />
                            </div>
                            <div className="text-start">
                              <Label>{t("panelCustomerClub.settings.dailyWaterLogPoints")}</Label>
                              <Input className="text-start" type="number" value={settings.nutritionDailyWaterLogPoints} onChange={(e) => setSettings({ ...settings, nutritionDailyWaterLogPoints: Number(e.target.value) })} />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-start">
                              <Label>{t("panelCustomerClub.settings.weightLossReward")}</Label>
                              <Switch checked={settings.nutritionWeightLossRewardEnabled} onCheckedChange={(checked) => setSettings({ ...settings, nutritionWeightLossRewardEnabled: checked })} />
                            </div>
                            <div className="text-start">
                              <Label>{t("panelCustomerClub.settings.weightLossRewardPoints")}</Label>
                              <Input className="text-start" type="number" value={settings.nutritionWeightLossRewardPoints} onChange={(e) => setSettings({ ...settings, nutritionWeightLossRewardPoints: Number(e.target.value) })} />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-start">
                              <Label>{t("panelCustomerClub.settings.onlineDietRequest")}</Label>
                              <Switch checked={settings.nutritionOnlineDietRequestRewardEnabled} onCheckedChange={(checked) => setSettings({ ...settings, nutritionOnlineDietRequestRewardEnabled: checked })} />
                            </div>
                            <div className="text-start">
                              <Label>{t("panelCustomerClub.settings.onlineDietRequestPoints")}</Label>
                              <Input className="text-start" type="number" value={settings.nutritionOnlineDietRequestRewardPoints} onChange={(e) => setSettings({ ...settings, nutritionOnlineDietRequestRewardPoints: Number(e.target.value) })} />
                            </div>
                          </CardContent>
                        </Card>
                      ) : null}

                      <div className="flex justify-end">
                        <Button onClick={saveSettings} disabled={savingSettings}>
                          {savingSettings ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                          {t("panelCustomerClub.settings.save")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="tiers" className="space-y-4">
                <div className="flex justify-end">
                  <Button className="customer-club-primary-button" onClick={() => openTierDialog()}>
                    <Plus className="me-2 h-4 w-4" />
                    {t("panelCustomerClub.tiers.new")}
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {overview.tiers.map((tier) => (
                    <Card key={tier.id} className="customer-club-item-card customer-club-tier-card border-border/70 bg-card/60">
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2 text-start">
                          <CardTitle className="text-base text-start">{tier.title}</CardTitle>
                          <Badge className={tierBadgeClass(tier.badgeColor)}>{formatPoints(tier.minimumPoints)}</Badge>
                        </div>
                        <CardDescription className="text-start">{tier.isActive ? t("panelCustomerClub.status.active") : t("panelCustomerClub.status.inactive")}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="customer-club-item-note rounded-xl border border-border/70 bg-background/40 p-3 text-start">
                          {tier.benefits.length > 0 ? tier.benefits.join(t("panelCustomerClub.separator")) : t("panelCustomerClub.tiers.noBenefits")}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" className="customer-club-outline-button flex-1" onClick={() => openTierDialog(tier)}>
                            <Pencil className="me-2 h-4 w-4" />
                            {t("panelCustomerClub.actions.edit")}
                          </Button>
                          <Button variant="destructive" className="flex-1" onClick={() => void removeTier(tier)}>
                            <Trash2 className="me-2 h-4 w-4" />
                            {t("panelCustomerClub.actions.delete")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="rewards" className="space-y-4">
                <div className="flex justify-end">
                  <Button className="customer-club-primary-button" onClick={() => openRewardDialog()}>
                    <Plus className="me-2 h-4 w-4" />
                    {t("panelCustomerClub.rewards.new")}
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {overview.rewards.map((reward) => (
                    <Card key={reward.id} className="customer-club-item-card customer-club-reward-card border-border/70 bg-card/60">
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2 text-start">
                          <CardTitle className="text-base text-start">{reward.title}</CardTitle>
                          <Badge variant="outline">{formatPoints(reward.costPoints)}</Badge>
                        </div>
                        <CardDescription className="text-start">{reward.description || t("panelCustomerClub.noDescription")}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="customer-club-item-note rounded-xl border border-border/70 bg-background/40 p-3 text-start">
                          {reward.rewardType === "wallet_credit" && t("panelCustomerClub.reward.walletCredit", { amount: formatIranToman(reward.walletAmount) })}
                          {reward.rewardType === "bonus_points" && t("panelCustomerClub.reward.bonusPoints", { count: format.number(reward.bonusPoints) })}
                          {reward.rewardType === "vip_access" && t("panelCustomerClub.reward.vipDays", { count: format.number(reward.vipDays) })}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" className="customer-club-outline-button flex-1" onClick={() => openRewardDialog(reward)}>
                            <Pencil className="me-2 h-4 w-4" />
                            {t("panelCustomerClub.actions.edit")}
                          </Button>
                          <Button variant="destructive" className="flex-1" onClick={() => void removeReward(reward)}>
                            <Trash2 className="me-2 h-4 w-4" />
                            {t("panelCustomerClub.actions.delete")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="members" className="space-y-4">
                <Card className="customer-club-panel-card border-border/70 bg-card/60">
                  <CardHeader className="gap-3 text-start md:flex-row md:items-center md:justify-between">
                    <div className="text-start">
                      <CardTitle className="text-start">{t("panelCustomerClub.members.title")}</CardTitle>
                      <CardDescription className="text-start">{t("panelCustomerClub.members.description")}</CardDescription>
                    </div>
                    <div className="customer-club-members-search flex gap-2">
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("panelCustomerClub.members.searchPlaceholder")} className="w-56 text-start" />
                      <Button className="customer-club-outline-button" variant="outline" onClick={() => void loadMembers(search)} disabled={membersLoading}>
                        {membersLoading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                        {t("panelCustomerClub.members.search")}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {members.map((member) => (
                      <div key={member.userId} className="customer-club-member-row rounded-2xl border border-border/70 bg-background/35 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-2 text-start">
                            <div className="flex items-center gap-2 text-start">
                              <div className="font-bold text-start">{member.name || <PhoneText>{member.mobile}</PhoneText>}</div>
                              {member.currentTier && (
                                <Badge className={`customer-club-member-badge ${tierBadgeClass(member.currentTier.badgeColor)}`}>{member.currentTier.title}</Badge>
                              )}
                              {member.isVip && (
                                <Badge className="customer-club-member-badge customer-club-member-badge--vip border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
                                  <Gem className="me-1 h-3 w-3" />
                                  {t("panelCustomerClub.members.vip")}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground"><PhoneText>{member.mobile}</PhoneText></div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="customer-club-member-metric rounded-xl border border-border/70 px-3 py-2 text-start text-sm">
                              <div className="text-muted-foreground text-start">{t("panelCustomerClub.members.points")}</div>
                              <div className="mt-1 font-black text-start">{format.number(member.pointsBalance)}</div>
                            </div>
                            <div className="customer-club-member-metric rounded-xl border border-border/70 px-3 py-2 text-start text-sm">
                              <div className="text-muted-foreground text-start">{t("panelCustomerClub.members.wallet")}</div>
                              <div className="mt-1 font-black text-start">{formatIranToman(member.walletBalance)}</div>
                            </div>
                            <Button className="customer-club-primary-button" onClick={() => openAdjustDialog(member)}>
                              <Gift className="me-2 h-4 w-4" />
                              {t("panelCustomerClub.members.manualAdjustment")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Card className="customer-club-panel-card border-border/70 bg-card/60">
              <CardHeader className="text-start">
                <CardTitle className="text-start">{t("panelCustomerClub.ledger.title")}</CardTitle>
                <CardDescription className="text-start">{t("panelCustomerClub.ledger.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {overview.recentLedger.map((entry) => (
                  <div key={entry.id} className="customer-club-ledger-row flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/35 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="text-start">
                      <div className="font-bold text-start">{entry.title}</div>
                      <div className="text-sm text-muted-foreground text-start">
                        {entry.user?.name || (entry.user?.mobile ? <PhoneText>{entry.user.mobile}</PhoneText> : t("panelCustomerClub.ledger.unknownUser"))}
                      </div>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <Badge variant="outline">{formatSignedPoints(entry.pointsDelta)}</Badge>
                      <Badge variant="outline">{entry.walletDelta >= 0 ? "+" : ""}{formatIranToman(entry.walletDelta, false)}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
        <DialogContent className="customer-club-dialog max-w-2xl" dir={dir}>
          <DialogHeader className="text-start">
            <DialogTitle className="text-start">{editingTier ? t("panelCustomerClub.tiers.editTitle") : t("panelCustomerClub.tiers.newTitle")}</DialogTitle>
            <DialogDescription className="text-start">{t("panelCustomerClub.tiers.dialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="text-start">
              <Label>{t("panelCustomerClub.tiers.form.title")}</Label>
              <Input className="text-start" value={tierForm.title} onChange={(e) => setTierForm({ ...tierForm, title: e.target.value })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.form.slug")}</Label>
              <Input className="text-start" value={tierForm.slug} onChange={(e) => setTierForm({ ...tierForm, slug: e.target.value })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.tiers.form.badgeColor")}</Label>
              <Input className="text-start" value={tierForm.badgeColor} onChange={(e) => setTierForm({ ...tierForm, badgeColor: e.target.value })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.tiers.form.icon")}</Label>
              <Input className="text-start" value={tierForm.icon} onChange={(e) => setTierForm({ ...tierForm, icon: e.target.value })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.tiers.form.minimumPoints")}</Label>
              <Input className="text-start" type="number" value={tierForm.minimumPoints} onChange={(e) => setTierForm({ ...tierForm, minimumPoints: Number(e.target.value) })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.tiers.form.minimumWallet")}</Label>
              <Input className="text-start" type="number" value={tierForm.minimumWallet} onChange={(e) => setTierForm({ ...tierForm, minimumWallet: Number(e.target.value) })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.form.sortOrder")}</Label>
              <Input className="text-start" type="number" value={tierForm.sortOrder} onChange={(e) => setTierForm({ ...tierForm, sortOrder: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
              <Label>{t("panelCustomerClub.form.active")}</Label>
              <Switch checked={tierForm.isActive} onCheckedChange={(checked) => setTierForm({ ...tierForm, isActive: checked })} />
            </div>
            <div className="text-start md:col-span-2">
              <Label>{t("panelCustomerClub.tiers.form.benefits")}</Label>
              <Textarea className="text-start" value={tierForm.benefitsText} onChange={(e) => setTierForm({ ...tierForm, benefitsText: e.target.value })} placeholder={t("panelCustomerClub.tiers.form.benefitsPlaceholder")} rows={5} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveTier} disabled={savingTier}>
              {savingTier ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
              {t("panelCustomerClub.tiers.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rewardDialogOpen} onOpenChange={setRewardDialogOpen}>
        <DialogContent className="customer-club-dialog max-w-2xl" dir={dir}>
          <DialogHeader className="text-start">
            <DialogTitle className="text-start">{editingReward ? t("panelCustomerClub.rewards.editTitle") : t("panelCustomerClub.rewards.newTitle")}</DialogTitle>
            <DialogDescription className="text-start">{rewardHint}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="text-start">
              <Label>{t("panelCustomerClub.rewards.form.title")}</Label>
              <Input className="text-start" value={rewardForm.title} onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.form.slug")}</Label>
              <Input className="text-start" value={rewardForm.slug} onChange={(e) => setRewardForm({ ...rewardForm, slug: e.target.value })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.rewards.form.type")}</Label>
              <select
                value={rewardForm.rewardType}
                onChange={(e) => setRewardForm({ ...rewardForm, rewardType: e.target.value as CustomerClubRewardType })}
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-start text-sm"
                dir={dir}
              >
                <option value="wallet_credit">{t("panelCustomerClub.rewards.type.walletCredit")}</option>
                <option value="bonus_points">{t("panelCustomerClub.rewards.type.bonusPoints")}</option>
                <option value="vip_access">{t("panelCustomerClub.rewards.type.vipAccess")}</option>
              </select>
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.rewards.form.costPoints")}</Label>
              <Input className="text-start" type="number" value={rewardForm.costPoints} onChange={(e) => setRewardForm({ ...rewardForm, costPoints: Number(e.target.value) })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.rewards.form.walletAmount")}</Label>
              <Input className="text-start" type="number" value={rewardForm.walletAmount} onChange={(e) => setRewardForm({ ...rewardForm, walletAmount: Number(e.target.value) })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.rewards.form.bonusPoints")}</Label>
              <Input className="text-start" type="number" value={rewardForm.bonusPoints} onChange={(e) => setRewardForm({ ...rewardForm, bonusPoints: Number(e.target.value) })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.rewards.form.vipDays")}</Label>
              <Input className="text-start" type="number" value={rewardForm.vipDays} onChange={(e) => setRewardForm({ ...rewardForm, vipDays: Number(e.target.value) })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.rewards.form.perUserLimit")}</Label>
              <Input className="text-start" type="number" value={rewardForm.perUserLimit} onChange={(e) => setRewardForm({ ...rewardForm, perUserLimit: Number(e.target.value) })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.rewards.form.totalLimit")}</Label>
              <Input className="text-start" value={rewardForm.totalLimit} onChange={(e) => setRewardForm({ ...rewardForm, totalLimit: e.target.value })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.form.sortOrder")}</Label>
              <Input className="text-start" type="number" value={rewardForm.sortOrder} onChange={(e) => setRewardForm({ ...rewardForm, sortOrder: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3 md:col-span-2">
              <Label>{t("panelCustomerClub.form.active")}</Label>
              <Switch checked={rewardForm.isActive} onCheckedChange={(checked) => setRewardForm({ ...rewardForm, isActive: checked })} />
            </div>
            <div className="text-start md:col-span-2">
              <Label>{t("panelCustomerClub.form.description")}</Label>
              <Textarea className="text-start" value={rewardForm.description} onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })} rows={4} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveReward} disabled={savingReward}>
              {savingReward ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
              {t("panelCustomerClub.rewards.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="customer-club-dialog max-w-xl" dir={dir}>
          <DialogHeader className="text-start">
            <DialogTitle className="text-start">{t("panelCustomerClub.adjust.title")}</DialogTitle>
            <DialogDescription className="text-start">
              {t("panelCustomerClub.adjust.description", { member: adjustingMember?.name || adjustingMember?.mobile || "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="text-start">
              <Label>{t("panelCustomerClub.adjust.pointsDelta")}</Label>
              <Input className="text-start" type="number" value={adjustForm.pointsDelta} onChange={(e) => setAdjustForm({ ...adjustForm, pointsDelta: Number(e.target.value) })} />
            </div>
            <div className="text-start">
              <Label>{t("panelCustomerClub.adjust.walletDelta")}</Label>
              <Input className="text-start" type="number" value={adjustForm.walletDelta} onChange={(e) => setAdjustForm({ ...adjustForm, walletDelta: Number(e.target.value) })} />
            </div>
            <div className="text-start md:col-span-2">
              <Label>{t("panelCustomerClub.form.title")}</Label>
              <Input className="text-start" value={adjustForm.title} onChange={(e) => setAdjustForm({ ...adjustForm, title: e.target.value })} />
            </div>
            <div className="text-start md:col-span-2">
              <Label>{t("panelCustomerClub.form.note")}</Label>
              <Textarea className="text-start" value={adjustForm.description} onChange={(e) => setAdjustForm({ ...adjustForm, description: e.target.value })} rows={4} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={submitAdjustment} disabled={adjusting}>
              {adjusting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
              {t("panelCustomerClub.adjust.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
