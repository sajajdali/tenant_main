import { Link } from "wouter";
import { ArrowRight, Settings2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import { useAuth } from "@/lib/auth";
import type { LucideIcon } from "lucide-react";

type StoreSettingsCardItem = {
  key: string;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  href: string;
  icon: LucideIcon;
  accent: string;
};

type PanelStoreSettingsShellProps = {
  eyebrowKey: MessageKey;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  cards: readonly StoreSettingsCardItem[];
};

export function PanelStoreSettingsShell({
  eyebrowKey,
  titleKey,
  descriptionKey,
  cards,
}: PanelStoreSettingsShellProps) {
  const { isPrimaryAdmin } = useAuth();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const eyebrow = t(eyebrowKey);
  const title = t(titleKey);
  const description = t(descriptionKey);

  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelStore.shell.accessDeniedTitle")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelStore.shell.accessDeniedDescription")}</p>
          <Link href="/panel">
            <Button>{t("panelStore.shell.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_40%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{eyebrow}</div>
            <h1 className="text-2xl font-black">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <Link href="/panel/store-settings">
            <Button variant="outline" size="icon" title={t("panelStore.shell.back")} className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-5 px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardContent className="space-y-3 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Settings2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black">{title}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("panelStore.shell.description")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
          {cards.map((item) => {
            const Icon = item.icon;

            return (
              <Link key={item.key} href={item.href}>
                <Card className={`h-full cursor-pointer border-border/70 bg-gradient-to-br ${item.accent} transition-all hover:border-primary/40 hover:shadow-[0_24px_60px_-40px_rgba(245,158,11,0.45)]`}>
                  <CardContent className="flex min-h-[220px] flex-col justify-between p-5 sm:p-6">
                    <div className="space-y-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-black">{t(item.titleKey)}</h3>
                        <p className="text-sm leading-8 text-muted-foreground">{t(item.descriptionKey)}</p>
                      </div>
                    </div>

                    <div className="pt-5">
                      <Button variant="outline" className="rounded-[18px] border-border bg-background/40">
                        {t("panelStore.shell.openSection")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
