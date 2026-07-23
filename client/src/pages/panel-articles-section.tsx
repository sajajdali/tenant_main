import { Link, useLocation } from "wouter";
import { ArrowRight, FolderTree, Newspaper, Settings2, ShieldCheck, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useLocale, useT } from "@/i18n/locale";

const SECTION_META = [
  {
    matcher: (pathname: string) => pathname === "/panel/articles/posts",
    eyebrowKey: "panelArticlesSection.posts.eyebrow",
    titleKey: "panelArticlesSection.posts.title",
    descriptionKey: "panelArticlesSection.posts.description",
    icon: Newspaper,
  },
  {
    matcher: (pathname: string) => pathname === "/panel/articles/settings",
    eyebrowKey: "panelArticlesSection.settings.eyebrow",
    titleKey: "panelArticlesSection.settings.title",
    descriptionKey: "panelArticlesSection.settings.description",
    icon: Settings2,
  },
  {
    matcher: (pathname: string) => pathname === "/panel/articles/categories",
    eyebrowKey: "panelArticlesSection.categories.eyebrow",
    titleKey: "panelArticlesSection.categories.title",
    descriptionKey: "panelArticlesSection.categories.description",
    icon: FolderTree,
  },
  {
    matcher: (pathname: string) => pathname === "/panel/articles/tags",
    eyebrowKey: "panelArticlesSection.tags.eyebrow",
    titleKey: "panelArticlesSection.tags.title",
    descriptionKey: "panelArticlesSection.tags.description",
    icon: Tags,
  },
] as const;

export default function PanelArticlesSectionPage() {
  const { isPrimaryAdmin } = useAuth();
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [location] = useLocation();
  const section = SECTION_META.find((item) => item.matcher(location)) ?? SECTION_META[0];
  const Icon = section.icon;

  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelArticlesSection.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelArticlesSection.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelArticlesSection.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[300px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_40%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t(section.eyebrowKey)}</div>
            <h1 className="text-2xl font-black">{t(section.titleKey)}</h1>
          </div>

          <Link href="/panel/articles">
            <Button variant="outline" size="icon" title={t("panelArticlesSection.back")} className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="text-xl font-black">{t(section.titleKey)}</div>
              </div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-background/35 p-5 text-sm leading-8 text-muted-foreground">
              {t(section.descriptionKey)}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
