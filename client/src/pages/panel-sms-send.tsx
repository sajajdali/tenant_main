import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Loader2, MessageSquareText, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { getAudienceLabels } from "@/lib/audience";
import type { PaginatedSmsOutbounds, PaymentSettings, SmsBulkRecipientInput, SmsOutboundItem } from "@/lib/types";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { CodeText, PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

const EMPTY_HISTORY: PaginatedSmsOutbounds = {
  items: [],
  currentPage: 1,
  lastPage: 1,
  perPage: 20,
  total: 0,
};

const STATUS_LABEL_KEYS: Record<string, MessageKey> = {
  cancelled: "panelSmsSend.status.cancelled",
  failed: "panelSmsSend.status.failed",
  pending: "panelSmsSend.status.pending",
  sent: "panelSmsSend.status.sent",
};

function statusLabel(status: string, t: (key: MessageKey) => string) {
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(key) : status;
}

function parseRecipients(raw: string): SmsBulkRecipientInput[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [mobile, ...rest] = line.split(",");
      return {
        mobile: mobile?.trim() ?? "",
        name: rest.join(",").trim() || undefined,
      };
    })
    .filter((item) => item.mobile !== "");
}

export default function PanelSmsSendPage() {
  const { isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const tenantMeta = getInitialTenantMeta();
  const labels = getAudienceLabels(tenantMeta);
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [history, setHistory] = useState<PaginatedSmsOutbounds>(EMPTY_HISTORY);
  const [loading, setLoading] = useState(true);
  const [singleSending, setSingleSending] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [singleForm, setSingleForm] = useState({ mobile: "", name: "", message: "", sender: "" });
  const [bulkForm, setBulkForm] = useState({ recipients: "", message: "", sender: "" });

  const senderOptions = useMemo(() => settings?.smsAvailableSenders ?? [], [settings]);

  const loadData = async () => {
    setLoading(true);
    const [settingsRes, historyRes] = await Promise.all([api.payment.getSettings(), api.sms.listOutbounds(1, 20)]);

    if (settingsRes.success) {
      setSettings(settingsRes.data);
      const fallbackSender = settingsRes.data.smsSender ?? "";
      setSingleForm((current) => ({ ...current, sender: current.sender || fallbackSender }));
      setBulkForm((current) => ({ ...current, sender: current.sender || fallbackSender }));
    }

    if (historyRes.success) {
      setHistory(historyRes.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const sendSingle = async () => {
    setSingleSending(true);
    const res = await api.sms.sendSingle(singleForm);
    setSingleSending(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("panelSmsSend.toast.singleFailed"), description: res.message });
      return;
    }

    toast({ title: t("panelSmsSend.toast.singleSent"), description: res.message || t("panelSmsSend.toast.singleSentDescription") });
    setSingleForm((current) => ({ ...current, mobile: "", name: "", message: "" }));
    await loadData();
  };

  const sendBulk = async () => {
    const recipients = parseRecipients(bulkForm.recipients);

    if (recipients.length === 0) {
      toast({ variant: "destructive", title: t("panelSmsSend.toast.emptyRecipients"), description: t("panelSmsSend.toast.emptyRecipientsDescription") });
      return;
    }

    setBulkSending(true);
    const res = await api.sms.sendBulk({
      recipients,
      message: bulkForm.message,
      sender: bulkForm.sender,
    });
    setBulkSending(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("panelSmsSend.toast.bulkFailed"), description: res.message });
    } else {
      toast({
        title: t("panelSmsSend.toast.bulkSent"),
        description: t("panelSmsSend.toast.bulkSentDescription", {
          sent: format.number(res.data.sentCount),
          failed: format.number(res.data.failedCount),
        }),
      });
    }

    setBulkForm((current) => ({ ...current, recipients: "", message: "" }));
    await loadData();
  };

  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <MessageSquareText className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelSmsSend.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelSmsSend.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelSmsSend.backToPanel")}</Button>
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
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black">{t("panelSmsSend.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelSmsSend.description")}</p>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-5 px-4 py-6">
        {loading ? (
          <div className="flex h-40 items-center justify-center rounded-[28px] border border-border/70 bg-card/50">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("common.loading")}
          </div>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle>{t("panelSmsSend.single.title")}</CardTitle>
                  <CardDescription>{t("panelSmsSend.single.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input value={singleForm.mobile} onChange={(e) => setSingleForm((c) => ({ ...c, mobile: e.target.value }))} placeholder={t("panelSmsSend.mobilePlaceholder")} dir="ltr" />
                  <Input value={singleForm.name} onChange={(e) => setSingleForm((c) => ({ ...c, name: e.target.value }))} placeholder={t("panelSmsSend.namePlaceholder")} />
                  <select
                    value={singleForm.sender}
                    onChange={(e) => setSingleForm((c) => ({ ...c, sender: e.target.value }))}
                    className="w-full rounded-2xl border border-border bg-background/50 px-3 py-2 text-sm"
                    dir={dir}
                  >
                    <option value="">{t("panelSmsSend.senderPlaceholder")}</option>
                    {senderOptions.map((sender) => (
                      <option key={sender.number} value={sender.number}>
                        {sender.label?.trim() ? `${sender.label} - ${sender.number}` : sender.number}
                      </option>
                    ))}
                  </select>
                  <Textarea value={singleForm.message} onChange={(e) => setSingleForm((c) => ({ ...c, message: e.target.value }))} rows={6} placeholder={t("panelSmsSend.messagePlaceholder")} />
                  <Button onClick={sendSingle} disabled={singleSending || !singleForm.mobile.trim() || !singleForm.message.trim()}>
                    {singleSending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4" />}
                    {t("panelSmsSend.single.submit")}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle>{t("panelSmsSend.bulk.title")}</CardTitle>
                  <CardDescription>{t("panelSmsSend.bulk.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={bulkForm.recipients}
                    onChange={(e) => setBulkForm((c) => ({ ...c, recipients: e.target.value }))}
                    rows={6}
                    placeholder={t("panelSmsSend.bulk.recipientsPlaceholder")}
                    dir="ltr"
                  />
                  <select
                    value={bulkForm.sender}
                    onChange={(e) => setBulkForm((c) => ({ ...c, sender: e.target.value }))}
                    className="w-full rounded-2xl border border-border bg-background/50 px-3 py-2 text-sm"
                    dir={dir}
                  >
                    <option value="">{t("panelSmsSend.senderPlaceholder")}</option>
                    {senderOptions.map((sender) => (
                      <option key={sender.number} value={sender.number}>
                        {sender.label?.trim() ? `${sender.label} - ${sender.number}` : sender.number}
                      </option>
                    ))}
                  </select>
                  <Textarea value={bulkForm.message} onChange={(e) => setBulkForm((c) => ({ ...c, message: e.target.value }))} rows={6} placeholder={t("panelSmsSend.messagePlaceholder")} />
                  <Button onClick={sendBulk} disabled={bulkSending || !bulkForm.recipients.trim() || !bulkForm.message.trim()}>
                    {bulkSending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Users className="me-2 h-4 w-4" />}
                    {t("panelSmsSend.bulk.submit")}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle>{t("panelSmsSend.history.title")}</CardTitle>
                <CardDescription>{t("panelSmsSend.history.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {history.items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-6 text-center text-sm text-muted-foreground">
                    {t("panelSmsSend.history.empty")}
                  </div>
                ) : (
                  history.items.map((item: SmsOutboundItem) => (
                    <div key={item.id} className="rounded-2xl border border-border/70 bg-background/25 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2 text-start">
                          <div className="font-bold">{item.recipientName || item.recipientMobile}</div>
                          <div className="text-sm text-muted-foreground">
                            <PhoneText>{item.recipientMobile}</PhoneText> | {item.sender ? <CodeText>{item.sender}</CodeText> : t("panelSmsSend.valueMissing")} | {format.currency(item.totalPrice)}
                          </div>
                          <div className="text-sm text-muted-foreground">{item.message}</div>
                          <div className="text-xs text-muted-foreground">
                            {t("panelSmsSend.history.createdAt", { date: format.dateTime(item.createdAt) || t("panelSmsSend.valueMissing") })} | {t("panelSmsSend.history.sentAt", { date: format.dateTime(item.sentAt) || t("panelSmsSend.valueMissing") })}
                          </div>
                          {item.errorMessage ? <div className="text-sm text-destructive">{item.errorMessage}</div> : null}
                        </div>
                        <div className="space-y-2 text-end">
                          <Badge variant={item.status === "sent" ? "default" : item.status === "failed" ? "destructive" : "secondary"}>
                            {statusLabel(item.status, t)}
                          </Badge>
                          <div className="text-xs text-muted-foreground">{t("panelSmsSend.history.parts", { count: format.number(item.partsCount) })}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
