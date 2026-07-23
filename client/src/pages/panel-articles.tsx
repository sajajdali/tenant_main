import { Link } from "wouter";
import { ArrowRight, BookOpenText, FolderTree, Newspaper, Settings2, ShieldCheck, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useLocale, useT } from "@/i18n/locale";

const PANEL_ARTICLES_PINK_STYLES = `
  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-page {
    background:
      radial-gradient(circle at 12% -8%, rgba(255, 255, 255, 0.98), transparent 28rem),
      radial-gradient(circle at 92% 8%, rgba(216, 116, 155, 0.16), transparent 24rem),
      linear-gradient(180deg, #fff8fb 0%, #fff1f6 48%, #fde8f0 100%) !important;
    color: #704357 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-glow {
    background:
      radial-gradient(circle at top, rgba(216, 116, 155, 0.16), transparent 44%),
      linear-gradient(180deg, rgba(255, 248, 251, 0.98), rgba(255, 241, 246, 0)) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-header {
    border-color: rgba(239, 202, 216, 0.92) !important;
    background: rgba(255, 250, 252, 0.94) !important;
    box-shadow: 0 12px 34px rgba(185, 47, 102, 0.09) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-page h1,
  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-page h2,
  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-page h3 {
    color: #704357 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-page .text-primary {
    color: #c74678 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-page .text-muted-foreground,
  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-page p {
    color: #986b7c !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-hero {
    border-color: rgba(231, 174, 196, 0.88) !important;
    background: rgba(255, 253, 254, 0.94) !important;
    box-shadow: 0 18px 44px rgba(185, 47, 102, 0.1) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-module-card {
    border-color: rgba(231, 174, 196, 0.9) !important;
    color: #704357 !important;
    box-shadow: 0 18px 42px rgba(185, 47, 102, 0.1) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-module-card--posts {
    background: linear-gradient(145deg, #fffdfd 0%, #fff7fa 52%, #f9dce8 100%) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-module-card--settings {
    background: linear-gradient(145deg, #fffdfd 0%, #fff8fa 52%, #f5e1e9 100%) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-module-card--categories {
    background: linear-gradient(145deg, #fffdfd 0%, #fff6fa 52%, #f6dfe9 100%) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-module-card--tags {
    background: linear-gradient(145deg, #fffdfd 0%, #fff8fb 52%, #f2e0e8 100%) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-module-card:hover {
    border-color: rgba(199, 70, 120, 0.58) !important;
    transform: translateY(-2px);
    box-shadow: 0 24px 52px rgba(185, 47, 102, 0.16) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-icon {
    border-color: rgba(216, 116, 155, 0.38) !important;
    background: rgba(255, 241, 246, 0.96) !important;
    color: #c74678 !important;
    box-shadow: 0 10px 24px rgba(185, 47, 102, 0.09) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-entry-button {
    border-color: #c75d86 !important;
    background: rgba(255, 253, 254, 0.96) !important;
    color: #7a3e55 !important;
    font-weight: 900 !important;
    box-shadow: 0 8px 20px rgba(185, 47, 102, 0.11) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-articles-entry-button:hover {
    border-color: #a72759 !important;
    background: linear-gradient(135deg, #cf4f80, #b92f66) !important;
    color: #ffffff !important;
    box-shadow: 0 12px 26px rgba(185, 47, 102, 0.22) !important;
  }
`;

const CARDS = [
  {
    key: "posts",
    titleKey: "panelArticlesHub.cards.posts.title",
    descriptionKey: "panelArticlesHub.cards.posts.description",
    href: "/panel/articles/posts",
    icon: Newspaper,
    accent: "from-[#123a56]/90 via-card to-card",
  },
  {
    key: "settings",
    titleKey: "panelArticlesHub.cards.settings.title",
    descriptionKey: "panelArticlesHub.cards.settings.description",
    href: "/panel/articles/settings",
    icon: Settings2,
    accent: "from-[#3d2f35]/80 via-card to-card",
  },
  {
    key: "categories",
    titleKey: "panelArticlesHub.cards.categories.title",
    descriptionKey: "panelArticlesHub.cards.categories.description",
    href: "/panel/articles/categories",
    icon: FolderTree,
    accent: "from-[#123f4f]/90 via-card to-card",
  },
  {
    key: "tags",
    titleKey: "panelArticlesHub.cards.tags.title",
    descriptionKey: "panelArticlesHub.cards.tags.description",
    href: "/panel/articles/tags",
    icon: Tags,
    accent: "from-[#2d3348]/90 via-card to-card",
  },
] as const;

export default function PanelArticlesPage() {
  const { isPrimaryAdmin } = useAuth();
  const t = useT();
  const { dir, isRtl } = useLocale();

  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelArticlesHub.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelArticlesHub.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelArticlesHub.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-articles-page min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <style>{PANEL_ARTICLES_PINK_STYLES}</style>
      <div className="panel-articles-glow absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_40%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="panel-articles-header sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("panelArticlesHub.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("panelArticlesHub.title")}</h1>
          </div>

          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("panelArticlesHub.back")} className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-5 px-4 py-6">
        <Card className="panel-articles-hero border-border/70 bg-card/60">
          <CardContent className="space-y-3 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="panel-articles-icon flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <BookOpenText className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black">{t("panelArticlesHub.hero.title")}</h2>
                <p className="text-sm text-muted-foreground">{t("panelArticlesHub.hero.description")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {CARDS.map((item) => {
            const Icon = item.icon;

            return (
              <Link key={item.key} href={item.href}>
                <Card className={`panel-articles-module-card panel-articles-module-card--${item.key} h-full cursor-pointer border-border/70 bg-gradient-to-br ${item.accent} transition-all hover:border-primary/40 hover:shadow-[0_24px_60px_-40px_rgba(245,158,11,0.45)]`}>
                  <CardContent className="flex min-h-[220px] flex-col justify-between p-5 sm:p-6">
                    <div className="space-y-4">
                      <div className="panel-articles-icon flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-black">{t(item.titleKey)}</h3>
                        <p className="text-sm leading-8 text-muted-foreground">{t(item.descriptionKey)}</p>
                      </div>
                    </div>

                    <div className="pt-5">
                      <Button variant="outline" className="panel-articles-entry-button rounded-[18px] border-border bg-background/40">
                        {t("panelArticlesHub.enter")}
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
