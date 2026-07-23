import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bell, CheckCheck, ChevronDown, ChevronUp, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { applyAppearance, readCachedAppearance } from "@/lib/appearance";
import type { AppearanceSettings, UserNotificationItem } from "@/lib/types";
import { emitNotificationsUpdated } from "@/lib/notifications";
import { useFormat, useLocale, useT } from "@/i18n/locale";

export default function NotificationsPage() {
  const tenantMeta = getInitialTenantMeta();
  const { user } = useAuth();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [status, setStatus] = useState<"all" | "unread">("all");
  const [items, setItems] = useState<UserNotificationItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceSettings | null>(() => readCachedAppearance());
  const bookingTemplate = appearance?.bookingTemplate ?? "default";
  const activeBookingTemplate =
    bookingTemplate === "pink" ||
    bookingTemplate === "blue" ||
    bookingTemplate === "green" ||
    bookingTemplate === "red" ||
    bookingTemplate === "purple" ||
    bookingTemplate === "yellow" ||
    bookingTemplate === "olive"
      ? bookingTemplate
      : null;

  const audienceLabel = useMemo(() => {
    return tenantMeta?.audience?.pluralLabel?.trim() || tenantMeta?.audience?.name?.trim() || t("notificationsPage.audienceFallback");
  }, [tenantMeta, t]);

  const roleBadgeMap = useMemo<Record<string, string>>(
    () => ({
      customer: t("notificationsPage.role.customer"),
      barber: t("notificationsPage.role.barber"),
      admin: t("notificationsPage.role.admin"),
    }),
    [t],
  );

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const res = await api.notifications.list(status, 1, 30);
    if (res.success) {
      setItems(res.data.items || []);
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    api.appearance.get().then((res) => {
      if (res.success) {
        setAppearance(res.data);
        applyAppearance(res.data);
      }
    });
  }, []);

  useEffect(() => {
    if (activeBookingTemplate) {
      document.body.dataset.bookingTemplate = activeBookingTemplate;
    } else {
      delete document.body.dataset.bookingTemplate;
    }

    return () => {
      delete document.body.dataset.bookingTemplate;
    };
  }, [activeBookingTemplate]);

  useEffect(() => {
    void load();
  }, [status, user]);

  const toPreview = (text?: string) => {
    const value = (text || "").trim();
    if (value.length <= 90) {
      return value;
    }

    return `${value.slice(0, 90)}...`;
  };

  if (!user) {
    return (
      <div className={`notifications-page min-h-screen bg-background text-foreground ${activeBookingTemplate ? `notifications-template-${activeBookingTemplate}` : ""}`} dir={dir}>
        <div className="container mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-black">{t("notificationsPage.loginRequired")}</h1>
          <Link href="/">
            <Button className="rounded-2xl">{t("notificationsPage.back")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`notifications-page min-h-screen bg-background pb-16 text-foreground ${activeBookingTemplate ? `notifications-template-${activeBookingTemplate}` : ""}`} dir={dir}>
      <header className="notifications-header border-b border-border/70 bg-card/50 backdrop-blur-md">
        <div className="container mx-auto max-w-4xl px-4 py-5">
          <div className="flex items-center justify-between gap-3">
            <Link href="/">
              <Button variant="outline" size="icon" className="notifications-back-button rounded-2xl">
                <ArrowLeft className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
              </Button>
            </Link>
            <div className="text-end">
              <h1 className="text-lg font-black sm:text-2xl">{t("notificationsPage.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("notificationsPage.description", { audience: audienceLabel })}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-4 px-4 py-6">
        <Card className="notifications-filter-card border-border/70 bg-card/60">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="notifications-filter-tabs inline-flex rounded-2xl border border-border/70 bg-background/40 p-1">
              <button
                type="button"
                onClick={() => setStatus("all")}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${status === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {t("notificationsPage.filter.all")}
              </button>
              <button
                type="button"
                onClick={() => setStatus("unread")}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${status === "unread" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {t("notificationsPage.filter.unread")}
              </button>
            </div>

            <Button
              variant="outline"
              className="notifications-mark-all rounded-2xl"
              disabled={markingAll}
              onClick={async () => {
                setMarkingAll(true);
                await api.notifications.markAllRead();
                emitNotificationsUpdated();
                await load();
                setMarkingAll(false);
              }}
            >
              <CheckCheck className="me-2 h-4 w-4" />
              {t("notificationsPage.markAllRead")}
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <Card className="notifications-empty-card border-border/70 bg-card/55">
            <CardContent className="p-8 text-center text-muted-foreground">{t("notificationsPage.loading")}</CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card className="notifications-empty-card border-border/70 bg-card/55">
            <CardContent className="p-8 text-center text-muted-foreground">{t("notificationsPage.empty")}</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={async () => {
                  const isExpanded = expandedIds.includes(item.id);

                  setExpandedIds((current) =>
                    isExpanded ? current.filter((id) => id !== item.id) : [...current, item.id],
                  );

                  if (!item.isRead) {
                    const res = await api.notifications.markRead(item.id);
                    if (res.success) {
                      emitNotificationsUpdated();
                      setItems((current) => {
                        if (status === "unread") {
                          return current.filter((row) => row.id !== item.id);
                        }

                        return current.map((row) => (row.id === item.id ? { ...row, isRead: true, readAt: new Date().toISOString() } : row));
                      });
                    }
                  }
                }}
                data-notification-read={item.isRead ? "true" : "false"}
                className={`notification-item w-full rounded-[24px] border p-4 text-start transition ${item.isRead ? "border-border/60 bg-background/25" : "border-primary/35 bg-primary/5"}`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {!item.isRead ? <CircleDot className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4 text-muted-foreground" />}
                    <span className="font-black">{item.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{format.dateTime(item.createdAt) || t("notificationsPage.valueMissing")}</div>
                </div>
                {expandedIds.includes(item.id) ? (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{item.message}</p>
                ) : (
                  <p className="line-clamp-2 text-sm leading-7 text-muted-foreground">{toPreview(item.message)}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-border/70 bg-background/45 px-3 py-1">
                    {roleBadgeMap[item.recipientRole || "customer"] || t("notificationsPage.role.customer")}
                  </span>
                  {item.meta?.audienceName ? (
                    <span className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-primary">
                      {item.meta.audienceName}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-border/70 bg-background/45 px-3 py-1 text-muted-foreground">
                    {item.senderName ? t("notificationsPage.sender", { name: item.senderName }) : t("notificationsPage.adminMessage")}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/45 px-3 py-1 text-muted-foreground">
                    {expandedIds.includes(item.id) ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        {t("notificationsPage.collapse")}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        {t("notificationsPage.expand")}
                      </>
                    )}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
