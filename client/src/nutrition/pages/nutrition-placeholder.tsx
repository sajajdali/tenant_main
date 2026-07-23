import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, ClipboardList, Salad, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeText } from "@/i18n/ltr-text";
import { useLocale, useT } from "@/i18n/locale";

const PAGE_META: Array<{
  matcher: (pathname: string) => boolean;
  eyebrowKey: "nutritionPlaceholder.membership.eyebrow" | "nutritionPlaceholder.introduction.eyebrow" | "nutritionPlaceholder.resume.eyebrow" | "nutritionPlaceholder.profile.eyebrow" | "nutritionPlaceholder.panel.eyebrow";
  titleKey: "nutritionPlaceholder.membership.title" | "nutritionPlaceholder.introduction.title" | "nutritionPlaceholder.resume.title" | "nutritionPlaceholder.profile.title" | "nutritionPlaceholder.panel.title";
  descriptionKey: "nutritionPlaceholder.membership.description" | "nutritionPlaceholder.introduction.description" | "nutritionPlaceholder.resume.description" | "nutritionPlaceholder.profile.description" | "nutritionPlaceholder.panel.description";
}> = [
  {
    matcher: (pathname) => pathname === "/nutrition/membership",
    eyebrowKey: "nutritionPlaceholder.membership.eyebrow",
    titleKey: "nutritionPlaceholder.membership.title",
    descriptionKey: "nutritionPlaceholder.membership.description",
  },
  {
    matcher: (pathname) => pathname === "/nutrition/introduction",
    eyebrowKey: "nutritionPlaceholder.introduction.eyebrow",
    titleKey: "nutritionPlaceholder.introduction.title",
    descriptionKey: "nutritionPlaceholder.introduction.description",
  },
  {
    matcher: (pathname) => pathname === "/nutrition/resume",
    eyebrowKey: "nutritionPlaceholder.resume.eyebrow",
    titleKey: "nutritionPlaceholder.resume.title",
    descriptionKey: "nutritionPlaceholder.resume.description",
  },
  {
    matcher: (pathname) => pathname === "/nutrition/profile",
    eyebrowKey: "nutritionPlaceholder.profile.eyebrow",
    titleKey: "nutritionPlaceholder.profile.title",
    descriptionKey: "nutritionPlaceholder.profile.description",
  },
  {
    matcher: (pathname) => pathname.startsWith("/panel/nutrition"),
    eyebrowKey: "nutritionPlaceholder.panel.eyebrow",
    titleKey: "nutritionPlaceholder.panel.title",
    descriptionKey: "nutritionPlaceholder.panel.description",
  },
];

export default function NutritionPlaceholderPage() {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [location] = useLocation();
  const pageMeta = PAGE_META.find((item) => item.matcher(location)) ?? PAGE_META[0];
  const isPanelRoute = location.startsWith("/panel");
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground" dir={dir}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="text-sm font-bold text-primary">{t(pageMeta.eyebrowKey)}</div>
            <h1 className="text-2xl font-black">{t(pageMeta.titleKey)}</h1>
            <p className="max-w-2xl text-sm leading-8 text-muted-foreground">{t(pageMeta.descriptionKey)}</p>
          </div>
          <Link href={isPanelRoute ? "/panel" : "/nutrition"}>
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70" title={t("common.back")}>
              <BackIcon className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Salad className="h-5 w-5 text-primary" />
              {t("nutritionPlaceholder.nextStep.title")}
            </CardTitle>
            <CardDescription>
              {t("nutritionPlaceholder.nextStep.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="flex items-center gap-2 text-sm font-bold">
                <ClipboardList className="h-4 w-4 text-primary" />
                {t("nutritionPlaceholder.cards.forms.title")}
              </div>
              <div className="mt-3 text-sm leading-7 text-muted-foreground">
                {t("nutritionPlaceholder.cards.forms.description")}
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="flex items-center gap-2 text-sm font-bold">
                <UserRound className="h-4 w-4 text-primary" />
                {t("nutritionPlaceholder.cards.architecture.title")}
              </div>
              <div className="mt-3 text-sm leading-7 text-muted-foreground">
                {t("nutritionPlaceholder.cards.architecture.description")}
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="text-sm font-bold">{t("nutritionPlaceholder.cards.currentPath.title")}</div>
              <div className="mt-3 break-all text-sm leading-7 text-muted-foreground"><CodeText>{location}</CodeText></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
