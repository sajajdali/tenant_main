import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, BookOpenText, CircleHelp, Loader2, PlayCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { HelpTopic } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CodeText } from "@/i18n/ltr-text";
import { useLocale, useT } from "@/i18n/locale";

const INTRO_TOPIC_KEY = "panel/help:intro";

function topicHref(topicKey: string, from?: string) {
  const params = new URLSearchParams({ topic: topicKey });

  if (from?.startsWith("/")) {
    params.set("from", from);
  }

  return `/panel/help?${params.toString()}`;
}

function normalizeTopicIdentifier(value?: string | null) {
  return (value ?? "").split("?")[0].replace(/^\/+|\/+$/g, "");
}

function textToParagraphs(value?: string | null) {
  return (value ?? "")
    .split(/\n{2,}|\r\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function PanelHelpPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<HelpTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const { selectedTopicKey, returnTo, isContextualHelp } = useMemo(() => {
    const query = location.includes("?") ? location.slice(location.indexOf("?")) : "";
    const params = new URLSearchParams(query);
    const from = params.get("from") ?? "";
    const storedReturnTo =
      typeof window !== "undefined" ? window.sessionStorage.getItem("panel-help:return-to") ?? "" : "";
    const safeReturnTo = from.startsWith("/") ? from : storedReturnTo.startsWith("/") ? storedReturnTo : "/panel";
    const normalizedTopicKey = normalizeTopicIdentifier(params.get("topic") ?? "");

    return {
      selectedTopicKey: normalizedTopicKey,
      returnTo: safeReturnTo,
      isContextualHelp: Boolean(normalizedTopicKey),
    };
  }, [location]);

  useEffect(() => {
    let mounted = true;
    api.helpTopics.list().then((result) => {
      if (!mounted) {
        return;
      }

      if (result.success) {
        setTopics(result.data.items);
      } else {
        toast({ variant: "destructive", title: t("panelHelp.toast.loadFailed"), description: result.message });
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [toast]);

  const contextualTopic = useMemo(() => {
    if (!selectedTopicKey) {
      return null;
    }

    return (
      topics.find((topic) => {
        const topicKey = normalizeTopicIdentifier(topic.topicKey);
        return topicKey === selectedTopicKey;
      }) ?? null
    );
  }, [selectedTopicKey, topics]);

  useEffect(() => {
    const effectiveTopicKey = isContextualHelp ? contextualTopic?.topicKey ?? "" : selectedTopicKey;

    if (!effectiveTopicKey) {
      setSelectedTopic(null);
      return;
    }

    let mounted = true;

    api.helpTopics.show(effectiveTopicKey).then((result) => {
      if (!mounted) {
        return;
      }

      if (result.success) {
        setSelectedTopic(result.data.topic);
      } else {
        setSelectedTopic(null);
        toast({ variant: "destructive", title: t("panelHelp.toast.topicNotFound"), description: result.message });
      }
    });

    return () => {
      mounted = false;
    };
  }, [contextualTopic?.topicKey, isContextualHelp, selectedTopicKey, toast]);

  const matchedTopicFromList = useMemo(() => {
    const effectiveKey = isContextualHelp ? contextualTopic?.topicKey ?? "" : selectedTopicKey;

    if (!effectiveKey) {
      return null;
    }

    const normalizedSelectedTopicKey = normalizeTopicIdentifier(effectiveKey);

    return (
      topics.find((topic) => {
        const topicKey = normalizeTopicIdentifier(topic.topicKey);
        const moduleKey = normalizeTopicIdentifier(topic.moduleKey);

        return topic.topicKey === effectiveKey || topicKey === normalizedSelectedTopicKey || (!!moduleKey && moduleKey === normalizedSelectedTopicKey);
      }) ?? null
    );
  }, [contextualTopic?.topicKey, isContextualHelp, selectedTopicKey, topics]);

  const introTopic = topics.find((topic) => topic.topicKey === INTRO_TOPIC_KEY) ?? topics[0] ?? null;
  const cardTopics = isContextualHelp ? [] : topics.filter((topic) => topic.topicKey !== introTopic?.topicKey);
  const heroTopic = isContextualHelp ? selectedTopic ?? matchedTopicFromList : selectedTopic ?? introTopic;
  const paragraphs = textToParagraphs(heroTopic?.body || heroTopic?.summary);

  const handleBack = () => {
    if (typeof window !== "undefined" && returnTo.startsWith("/")) {
      window.location.assign(returnTo);
      return;
    }

    setLocation(returnTo);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("panelHelp.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CircleHelp className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-black">{t("panelHelp.title")}</h1>
          </div>
          <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl" onClick={handleBack}>
            <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        {heroTopic ? (
          <Card className="overflow-hidden border-border/70 bg-card/60">
            <CardContent className="grid gap-0 p-0 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4 p-5 lg:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{heroTopic.moduleKey ? <CodeText>{heroTopic.moduleKey}</CodeText> : t("panelHelp.generalModule")}</Badge>
                  {heroTopic.audience ? <Badge variant="outline">{heroTopic.audience.name}</Badge> : null}
                </div>
                <div>
                  <h2 className="text-2xl font-black leading-10">{heroTopic.title}</h2>
                  {heroTopic.summary ? (
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{heroTopic.summary}</p>
                  ) : null}
                </div>
                {paragraphs.length ? (
                  <div className="space-y-3 text-sm leading-8 text-foreground/85">
                    {paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="min-h-[260px] bg-background/35 p-4">
                {heroTopic.videoUrl ? (
                  <video
                    key={heroTopic.videoUrl}
                    controls
                    poster={heroTopic.coverImageUrl ?? undefined}
                    className="h-full min-h-[260px] w-full rounded-[22px] bg-black object-cover"
                    src={heroTopic.videoUrl}
                  />
                ) : heroTopic.coverImageUrl ? (
                  <img src={heroTopic.coverImageUrl} alt={heroTopic.title} className="h-full min-h-[260px] w-full rounded-[22px] object-cover" />
                ) : (
                  <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-[22px] border border-dashed border-border bg-card/40 text-center text-muted-foreground">
                    <PlayCircle className="mb-3 h-10 w-10" />
                    {t("panelHelp.videoMissing")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="px-4 py-12 text-center text-muted-foreground">
              {t("panelHelp.empty")}
            </CardContent>
          </Card>
        )}

        {cardTopics.length ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cardTopics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => setLocation(topicHref(topic.topicKey, returnTo))}
                className="rounded-[24px] border border-border/70 bg-card/60 p-4 text-start transition hover:border-primary/40 hover:bg-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-lg font-black">{topic.title}</div>
                    <div className="mt-2 max-h-20 overflow-hidden text-sm leading-7 text-muted-foreground">
                      {topic.summary || t("panelHelp.cardSummaryFallback")}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">{topic.moduleKey ? <CodeText>{topic.moduleKey}</CodeText> : t("panelHelp.publicModule")}</Badge>
                      {topic.videoUrl ? <Badge variant="outline">{t("panelHelp.hasVideo")}</Badge> : null}
                    </div>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <BookOpenText className="h-5 w-5" />
                  </div>
                </div>
              </button>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
