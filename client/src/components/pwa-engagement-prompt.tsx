import { useEffect, useMemo, useState } from "react";
import { Bell, Download, Plus, Share2, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import {
  getPwaInstallPromptAllowed,
  isStandalonePwa,
  PWA_INSTALL_GATE_EVENT,
} from "@/lib/pwa";
import { APPEARANCE_CACHE_KEY } from "@/lib/appearance";
import { CodeText } from "@/i18n/ltr-text";
import { useLocale, useT } from "@/i18n/locale";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_SNOOZE_KEY = "barberbook.pwa.installPromptSnoozedAt";
const INSTALL_MARKER_KEY = "barberbook.pwa.installedAt";
const NOTIFICATION_SNOOZE_KEY = "barberbook.pwa.notificationPromptSnoozedAt";
const INSTALL_PROMPT_DELAY_MS = 12_000;
const SNOOZE_DAYS = 14;

function isRecentlySnoozed(key: string) {
  const value = Number(window.localStorage.getItem(key) || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return false;
  }

  return Date.now() - value < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
}

function snooze(key: string) {
  window.localStorage.setItem(key, String(Date.now()));
}

function markInstalled() {
  window.localStorage.setItem(INSTALL_MARKER_KEY, String(Date.now()));
}

function hasInstallMarker() {
  return Number(window.localStorage.getItem(INSTALL_MARKER_KEY) || 0) > 0;
}

async function isInstalledWebApp() {
  if (typeof window === "undefined") {
    return false;
  }

  if (isStandalonePwa() || hasInstallMarker()) {
    return true;
  }

  const relatedApps = (window.navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<Array<unknown>>;
  }).getInstalledRelatedApps;

  if (typeof relatedApps !== "function") {
    return false;
  }

  const apps = await relatedApps.call(window.navigator).catch(() => []);

  return apps.length > 0;
}

function isIosDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function getInstallAppName(fallbackName: string) {
  const fromAppleMeta = document
    .querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
    ?.content?.trim();

  if (fromAppleMeta) {
    return fromAppleMeta;
  }

  try {
    const cachedAppearance = JSON.parse(window.localStorage.getItem(APPEARANCE_CACHE_KEY) || "null") as { storeName?: string } | null;
    const storeName = cachedAppearance?.storeName?.trim();

    if (storeName) {
      return storeName;
    }
  } catch {
    // Keep the prompt usable even if localStorage is blocked or corrupted.
  }

  const pageTitle = (document.title.split("|")[0] || document.title).trim();

  return pageTitle || getInitialTenantMeta()?.name || fallbackName;
}

function getDefaultInstallGateState() {
  if (typeof window === "undefined") {
    return false;
  }

  if (isLandingSurface()) {
    return false;
  }

  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const isBookingEntryPath = path === "/" || path === "/booking";
  return getPwaInstallPromptAllowed(!isBookingEntryPath);
}

function isLandingSurface() {
  if (typeof window === "undefined") {
    return false;
  }

  const meta = getInitialTenantMeta();
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  return meta?.isLandingDomain === true || path === "/landing-preview" || path.startsWith("/landing-preview/");
}

export function PwaEngagementPrompt() {
  const t = useT();
  const { dir } = useLocale();
  const { user, isAdmin, isBarber } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installHidden, setInstallHidden] = useState(true);
  const [notificationHidden, setNotificationHidden] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [isStandalone, setIsStandalone] = useState(true);
  const [installAppName, setInstallAppName] = useState(() => getInstallAppName(t("pwa.thisSite")));
  const [installGateAllowed, setInstallGateAllowed] = useState(() => getDefaultInstallGateState());
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [installDelayElapsed, setInstallDelayElapsed] = useState(false);
  const ios = useMemo(() => isIosDevice(), []);
  const isLanding = useMemo(() => isLandingSurface(), []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsStandalone(isStandalonePwa());
    setInstallAppName(getInstallAppName(t("pwa.thisSite")));
    setInstallHidden(isStandalonePwa() || hasInstallMarker() || isRecentlySnoozed(INSTALL_SNOOZE_KEY));
    setNotificationHidden(isRecentlySnoozed(NOTIFICATION_SNOOZE_KEY));
    void isInstalledWebApp().then((installed) => {
      if (!installed) {
        return;
      }

      markInstalled();
      setIsStandalone(true);
      setInstallHidden(true);
      setDeferredPrompt(null);
    });

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      void isInstalledWebApp().then((installed) => {
        if (installed) {
          markInstalled();
          setIsStandalone(true);
          setInstallHidden(true);
          setDeferredPrompt(null);
          return;
        }

        setDeferredPrompt(event as BeforeInstallPromptEvent);
        setInstallAppName(getInstallAppName(t("pwa.thisSite")));
        setInstallHidden(isRecentlySnoozed(INSTALL_SNOOZE_KEY));
      });
    };

    const handleAppInstalled = () => {
      markInstalled();
      setIsStandalone(true);
      setInstallHidden(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [t]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const markUserInteraction = () => {
      setHasUserInteracted(true);
    };

    window.addEventListener("pointerdown", markUserInteraction, { passive: true });
    window.addEventListener("keydown", markUserInteraction);

    return () => {
      window.removeEventListener("pointerdown", markUserInteraction);
      window.removeEventListener("keydown", markUserInteraction);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleInstallGateChange = (event: Event) => {
      const detail = (event as CustomEvent<{ allowed?: boolean }>).detail;
      setInstallGateAllowed(detail?.allowed === true);
    };

    setInstallGateAllowed(getDefaultInstallGateState());
    window.addEventListener(PWA_INSTALL_GATE_EVENT, handleInstallGateChange);

    return () => {
      window.removeEventListener(PWA_INSTALL_GATE_EVENT, handleInstallGateChange);
    };
  }, []);

  useEffect(() => {
    if (!installGateAllowed || !hasUserInteracted) {
      setInstallDelayElapsed(false);
      return;
    }

    const delayTimer = window.setTimeout(() => {
      setInstallDelayElapsed(true);
    }, INSTALL_PROMPT_DELAY_MS);

    return () => {
      window.clearTimeout(delayTimer);
    };
  }, [hasUserInteracted, installGateAllowed]);

  const canShowInstall =
    !isLanding &&
    installGateAllowed &&
    hasUserInteracted &&
    installDelayElapsed &&
    !isStandalone &&
    !installHidden &&
    (deferredPrompt !== null || ios);
  const canAskNotification = !isLanding
    && Boolean(user)
    && (isAdmin || isBarber)
    && !notificationHidden
    && notificationPermission === "default";

  if (!canShowInstall && !canAskNotification) {
    return null;
  }

  const dismissInstall = () => {
    snooze(INSTALL_SNOOZE_KEY);
    setInstallHidden(true);
  };

  const dismissNotification = () => {
    snooze(NOTIFICATION_SNOOZE_KEY);
    setNotificationHidden(true);
  };

  const installApp = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    setDeferredPrompt(null);

    if (choice?.outcome !== "accepted") {
      dismissInstall();
    } else {
      markInstalled();
      setIsStandalone(true);
      setInstallHidden(true);
    }
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      setNotificationHidden(true);
      return;
    }

    const permission = await Notification.requestPermission().catch(() => Notification.permission);
    setNotificationPermission(permission);

    if (permission !== "default") {
      setNotificationHidden(true);
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto flex max-w-[410px] flex-col gap-2 sm:bottom-5" dir={dir}>
      {canShowInstall ? (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/92 text-white shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-l from-primary via-amber-400 to-cyan-300" />
          <div className="p-3.5">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <Smartphone className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[15px] font-black leading-6">{t("pwa.install.title", { name: installAppName })}</div>
                    <p className="mt-0.5 text-xs leading-5 text-slate-300">
                      {t("pwa.install.description")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
                    onClick={dismissInstall}
                    aria-label={t("pwa.install.closeAria")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {ios && !deferredPrompt ? (
                  <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-2.5 text-xs text-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-white/10 text-primary">
                        <Share2 className="h-4 w-4" />
                      </span>
                      <span>{t("pwa.install.iosShare")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-white/10 text-primary">
                        <Plus className="h-4 w-4" />
                      </span>
                      <span>
                        {t("pwa.install.iosAddBefore")} <CodeText>Add to Home Screen</CodeText> {t("pwa.install.iosAddAfter")}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex items-center gap-2">
                  {deferredPrompt ? (
                    <Button size="sm" className="h-10 rounded-xl px-4 font-bold" onClick={() => void installApp()}>
                      <Download className="me-2 h-4 w-4" />
                      {t("pwa.install.installButton")}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 rounded-xl border-white/25 bg-white/5 px-5 font-bold text-white hover:bg-white/10 hover:text-white"
                    onClick={dismissInstall}
                  >
                    {t("pwa.later")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {canAskNotification ? (
        <section className="rounded-2xl border border-border/70 bg-card/95 p-3.5 text-card-foreground shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20">
              <Bell className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black">{t("pwa.notifications.title")}</div>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {t("pwa.notifications.description")}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="h-10 rounded-xl px-4" onClick={() => void requestNotifications()}>
                  <Bell className="me-2 h-4 w-4" />
                  {t("pwa.notifications.enableButton")}
                </Button>
                <Button size="sm" variant="outline" className="h-10 rounded-xl px-4" onClick={dismissNotification}>
                  {t("pwa.later")}
                </Button>
              </div>
            </div>
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={dismissNotification}
              aria-label={t("pwa.notifications.closeAria")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
