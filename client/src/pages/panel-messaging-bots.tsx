import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, ImageIcon, Loader2, RefreshCw, Save, Send, ShieldAlert, Trash2, Upload, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { MessagingBotChannelSettings, MessagingBotSettings, TelegramWebhookInfo } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type BotChannel = "telegram" | "bale";

const botChannels: Array<{ key: BotChannel; titleKey: MessageKey; nameKey: MessageKey; descriptionKey: MessageKey; tokenPlaceholderKey: MessageKey }> = [
  {
    key: "telegram",
    titleKey: "panelMessagingBots.channels.telegram.title",
    nameKey: "panelMessagingBots.channels.telegram.name",
    descriptionKey: "panelMessagingBots.channels.telegram.description",
    tokenPlaceholderKey: "panelMessagingBots.channels.telegram.tokenPlaceholder",
  },
  {
    key: "bale",
    titleKey: "panelMessagingBots.channels.bale.title",
    nameKey: "panelMessagingBots.channels.bale.name",
    descriptionKey: "panelMessagingBots.channels.bale.description",
    tokenPlaceholderKey: "panelMessagingBots.channels.bale.tokenPlaceholder",
  },
];

const emptyChannel: MessagingBotChannelSettings = {
  enabled: false,
  token: "",
  tokenConfigured: false,
  tokenMasked: "",
  apiBaseUrl: "",
  webhookUrl: "",
  welcomeText: "",
  welcomeImageUrl: null,
  removeWelcomeImage: false,
};

const emptySettings: MessagingBotSettings = {
  telegram: { ...emptyChannel, apiBaseUrl: "https://api.telegram.org/bot" },
  bale: { ...emptyChannel, apiBaseUrl: "https://tapi.bale.ai/bot" },
};

export default function PanelMessagingBotsPage() {
  const { isPrimaryAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [settings, setSettings] = useState<MessagingBotSettings>(emptySettings);
  const [webhookInfo, setWebhookInfo] = useState<Record<BotChannel, TelegramWebhookInfo | null>>({ telegram: null, bale: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingWebhook, setCheckingWebhook] = useState<BotChannel | null>(null);
  const [welcomeImageFiles, setWelcomeImageFiles] = useState<Record<BotChannel, File | null>>({ telegram: null, bale: null });
  const [welcomeImagePreviews, setWelcomeImagePreviews] = useState<Record<BotChannel, string | null>>({ telegram: null, bale: null });

  useEffect(() => {
    if (!isPrimaryAdmin) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    api.messagingBots.settings().then((res) => {
      if (cancelled) return;

      if (res.success) {
        setSettings({
          telegram: { ...emptySettings.telegram, ...res.data.telegram, token: "" },
          bale: { ...emptySettings.bale, ...res.data.bale, token: "" },
          moduleActive: res.data.moduleActive,
        });
        setWelcomeImageFiles({ telegram: null, bale: null });
        setWelcomeImagePreviews({ telegram: null, bale: null });
      } else {
        toast({ title: t("common.error"), description: res.message || t("panelMessagingBots.toast.loadFailed"), variant: "destructive" });
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    botChannels.forEach(({ key }) => {
      api.messagingBots.botWebhookInfo(key).then((res) => {
        if (!cancelled && res.success) {
          setWebhookInfo((current) => ({ ...current, [key]: res.data }));
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isPrimaryAdmin, toast]);

  if (!isLoading && !isPrimaryAdmin && typeof window !== "undefined") {
    window.location.replace("/panel");
  }

  const saveSettings = async () => {
    setSaving(true);
    const formData = new FormData();

    botChannels.forEach(({ key }) => {
      const channel = settings[key];
      formData.append(`${key}[enabled]`, channel.enabled ? "1" : "0");
      formData.append(`${key}[token]`, channel.token || "");
      formData.append(`${key}[api_base_url]`, channel.apiBaseUrl || "");
      formData.append(`${key}[welcome_text]`, channel.welcomeText || "");
      formData.append(`${key}[remove_welcome_image]`, channel.removeWelcomeImage ? "1" : "0");

      const imageFile = welcomeImageFiles[key];
      if (imageFile) {
        formData.append(`${key}[welcome_image]`, imageFile);
      }
    });

    const res = await api.messagingBots.updateSettings(formData);
    setSaving(false);

    if (!res.success) {
      toast({ title: t("panelMessagingBots.toast.saveFailedTitle"), description: res.message || t("panelMessagingBots.toast.saveFailedDescription"), variant: "destructive" });
      return;
    }

    setSettings({
      telegram: { ...emptySettings.telegram, ...res.data.telegram, token: "" },
      bale: { ...emptySettings.bale, ...res.data.bale, token: "" },
      moduleActive: res.data.moduleActive,
    });
    setWelcomeImageFiles({ telegram: null, bale: null });
    setWelcomeImagePreviews({ telegram: null, bale: null });
    toast({ title: t("panelMessagingBots.toast.savedTitle"), description: res.message || t("panelMessagingBots.toast.savedDescription") });

    botChannels.forEach(async ({ key }) => {
      const webhookRes = await api.messagingBots.botWebhookInfo(key);
      if (webhookRes.success) {
        setWebhookInfo((current) => ({ ...current, [key]: webhookRes.data }));
      }
    });
  };

  const checkWebhook = async (channel: BotChannel) => {
    setCheckingWebhook(channel);
    const res = await api.messagingBots.botWebhookInfo(channel);
    setCheckingWebhook(null);

    if (res.success) {
      setWebhookInfo((current) => ({ ...current, [channel]: res.data }));
      toast({ title: t("panelMessagingBots.toast.webhookLoaded"), description: res.data.configured ? t("panelMessagingBots.webhook.configured") : t("panelMessagingBots.webhook.notConfigured") });
      return;
    }

    toast({ title: t("panelMessagingBots.toast.webhookFailedTitle"), description: res.message || t("panelMessagingBots.toast.webhookFailedDescription"), variant: "destructive" });
  };

  const updateChannel = (channel: BotChannel, changes: Partial<MessagingBotChannelSettings>) => {
    setSettings((current) => ({
      ...current,
      [channel]: { ...current[channel], ...changes },
    }));
  };

  const renderBotCard = (channel: BotChannel, title: string, channelName: string, description: string, tokenPlaceholder: string) => {
    const channelSettings = settings[channel];
    const info = webhookInfo[channel];
    const webhookConfigured = info?.configured === true;
    const effectiveWelcomeImage = welcomeImagePreviews[channel] || (!channelSettings.removeWelcomeImage ? channelSettings.welcomeImageUrl : null);

    return (
      <div className="grid gap-4" key={channel}>
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Send className="h-5 w-5 text-primary" />
                    {title}
                  </CardTitle>
                  <Badge variant="outline" className={channelSettings.enabled ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-white/10 bg-white/5 text-muted-foreground"}>
                    {channelSettings.enabled ? t("panelMessagingBots.status.active") : t("panelMessagingBots.status.inactive")}
                  </Badge>
                  {channelSettings.tokenConfigured && (
                    <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                      {t("panelMessagingBots.token.configured")}
                    </Badge>
                  )}
                </div>
                <CardDescription className="leading-7">{description}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={`${channel}-enabled`} className="text-sm text-muted-foreground">{t("panelMessagingBots.status.active")}</Label>
                <Switch id={`${channel}-enabled`} checked={channelSettings.enabled} onCheckedChange={(checked) => updateChannel(channel, { enabled: checked })} />
                {!channelSettings.enabled && (
                  <Button type="button" size="sm" className="gap-2" onClick={saveSettings} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {t("common.save")}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          {channelSettings.enabled && (
            <CardContent className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor={`${channel}-token`}>{t("panelMessagingBots.token.label")}</Label>
                <Input
                  id={`${channel}-token`}
                  dir="ltr"
                  value={channelSettings.token}
                  placeholder={channelSettings.tokenConfigured ? channelSettings.tokenMasked || t("panelMessagingBots.token.previousToken") : tokenPlaceholder}
                  onChange={(event) => updateChannel(channel, { token: event.target.value })}
                />
                <p className="text-xs leading-6 text-muted-foreground">{t("panelMessagingBots.token.keepPreviousHint")}</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`${channel}-api-base-url`}>{t("panelMessagingBots.apiBaseUrl")}</Label>
                <Input
                  id={`${channel}-api-base-url`}
                  dir="ltr"
                  value={channelSettings.apiBaseUrl || ""}
                  placeholder={channel === "bale" ? "https://tapi.bale.ai/bot" : "https://api.telegram.org/bot"}
                  onChange={(event) => updateChannel(channel, { apiBaseUrl: event.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`${channel}-welcome-text`}>{t("panelMessagingBots.welcomeText.label")}</Label>
                <Textarea
                  id={`${channel}-welcome-text`}
                  value={channelSettings.welcomeText || ""}
                  rows={4}
                  placeholder={t("panelMessagingBots.welcomeText.placeholder")}
                  onChange={(event) => updateChannel(channel, { welcomeText: event.target.value })}
                />
                <p className="text-xs leading-6 text-muted-foreground">{t("panelMessagingBots.welcomeText.hint", { token: "{{name}}" })}</p>
              </div>

              <div className="grid gap-3">
                <Label>{t("panelMessagingBots.welcomeImage.label")}</Label>
                <div className="grid gap-3 rounded-lg border border-border/70 bg-background/40 p-3 sm:grid-cols-[160px_1fr]">
                  <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md border border-border/70 bg-muted/30">
                    {effectiveWelcomeImage ? <img src={effectiveWelcomeImage} alt={t("panelMessagingBots.welcomeImage.alt")} className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
                  </div>
                  <div className="flex flex-col justify-center gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="gap-2" asChild>
                        <label htmlFor={`${channel}-welcome-image`} className="cursor-pointer">
                          <Upload className="h-4 w-4" />
                          {t("panelMessagingBots.welcomeImage.choose")}
                        </label>
                      </Button>
                      {(effectiveWelcomeImage || welcomeImageFiles[channel]) && (
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 text-destructive hover:text-destructive"
                          onClick={() => {
                            setWelcomeImageFiles((current) => ({ ...current, [channel]: null }));
                            setWelcomeImagePreviews((current) => ({ ...current, [channel]: null }));
                            updateChannel(channel, { welcomeImageUrl: null, removeWelcomeImage: true });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("panelMessagingBots.welcomeImage.remove")}
                        </Button>
                      )}
                    </div>
                    <input
                      id={`${channel}-welcome-image`}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setWelcomeImageFiles((current) => ({ ...current, [channel]: file }));
                        setWelcomeImagePreviews((current) => ({ ...current, [channel]: file ? URL.createObjectURL(file) : null }));
                        updateChannel(channel, { removeWelcomeImage: false });
                      }}
                    />
                    <p className="text-xs leading-6 text-muted-foreground">{t("panelMessagingBots.welcomeImage.hint")}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" className="gap-2" onClick={saveSettings} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t("panelMessagingBots.saveSettings")}
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={() => checkWebhook(channel)} disabled={checkingWebhook === channel || !channelSettings.tokenConfigured && channelSettings.token.trim() === ""}>
                  {checkingWebhook === channel ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t("panelMessagingBots.checkWebhook")}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {channelSettings.enabled && (
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {webhookConfigured ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <ShieldAlert className="h-5 w-5 text-amber-300" />}
                {t("panelMessagingBots.webhook.title", { channel: channelName })}
              </CardTitle>
              <CardDescription className="leading-7">{t("panelMessagingBots.webhook.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`rounded-lg border p-4 ${webhookConfigured ? "border-emerald-300/20 bg-emerald-300/10" : "border-amber-300/20 bg-amber-300/10"}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {webhookConfigured ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <XCircle className="h-5 w-5 text-amber-300" />}
                  {webhookConfigured ? t("panelMessagingBots.webhook.configured") : t("panelMessagingBots.webhook.notConfigured")}
                </div>
              </div>

              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-background/40 p-3">
                  <div className="text-muted-foreground">{t("panelMessagingBots.webhook.pendingUpdates")}</div>
                  <div className="mt-1 font-semibold">{format.number(info?.pendingUpdateCount ?? 0)}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/40 p-3">
                  <div className="text-muted-foreground">{t("panelMessagingBots.webhook.lastError")}</div>
                  <div className="mt-1 leading-6">{info?.lastErrorMessage || "—"}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/40 p-3">
                  <div className="text-muted-foreground">{t("panelMessagingBots.webhook.lastErrorDate")}</div>
                  <div className="mt-1">{info?.lastErrorDate ? format.dateTime(info.lastErrorDate * 1000) : "—"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1 text-start">
            <h1 className="text-xl font-bold text-start">{t("panelMessagingBots.title")}</h1>
            <p className="text-sm text-muted-foreground text-start">{t("panelMessagingBots.description")}</p>
          </div>
          <Link href="/panel">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            >
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        {loading ? (
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardContent className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("panelMessagingBots.loading")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {botChannels.map(({ key, titleKey, nameKey, descriptionKey, tokenPlaceholderKey }) =>
              renderBotCard(key, t(titleKey), t(nameKey), t(descriptionKey), t(tokenPlaceholderKey)),
            )}
          </div>
        )}
      </main>
    </div>
  );
}
