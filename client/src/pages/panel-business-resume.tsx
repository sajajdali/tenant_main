import { Link } from "wouter";
import { ArrowRight, Eye, IdCard, Settings2, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocale, useT } from "@/i18n/locale";

export default function PanelBusinessResumePage() {
  const t = useT();
  const { dir, isRtl } = useLocale();

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("panelBusinessResume.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelBusinessResume.description")}</p>
          </div>
          <Link href="/panel">
            <Button
              variant="outline"
              size="icon"
              title={t("common.back")}
              className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            >
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        <Card className="border-primary/20 bg-card/60">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <IdCard className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-lg">{t("panelBusinessResume.card.title")}</CardTitle>
                    <Badge variant="secondary">{t("panelBusinessResume.card.badge")}</Badge>
                  </div>
                  <CardDescription className="max-w-2xl leading-7">
                    {t("panelBusinessResume.card.description")}
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <Settings2 className="mb-3 h-5 w-5 text-primary" />
              <div className="font-bold">{t("panelBusinessResume.steps.content.title")}</div>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("panelBusinessResume.steps.content.description")}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <Eye className="mb-3 h-5 w-5 text-primary" />
              <div className="font-bold">{t("panelBusinessResume.steps.preview.title")}</div>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("panelBusinessResume.steps.preview.description")}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <ToggleRight className="mb-3 h-5 w-5 text-primary" />
              <div className="font-bold">{t("panelBusinessResume.steps.publish.title")}</div>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("panelBusinessResume.steps.publish.description")}</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
