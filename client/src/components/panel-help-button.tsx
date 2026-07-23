import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import { api } from "@/lib/api";
import type { HelpTopic } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale";

const DYNAMIC_SEGMENT = ":id";

function normalizePath(location: string) {
  return location.split("?")[0].replace(/^\/+|\/+$/g, "");
}

function normalizeTopicIdentifier(value?: string | null) {
  return (value ?? "").split("?")[0].replace(/^\/+|\/+$/g, "");
}

function isDynamicSegment(segment: string) {
  return /^\d+$/.test(segment) || /^09\d{9}$/.test(segment);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getTopicCandidates(location: string) {
  const path = normalizePath(location);

  if (!path || path === "panel/help" || (!path.startsWith("panel") && !path.startsWith("settings"))) {
    return [];
  }

  const segments = path.split("/");
  const dynamicPath = segments.map((segment) => (isDynamicSegment(segment) ? DYNAMIC_SEGMENT : segment)).join("/");
  const candidates = [path, dynamicPath];

  for (let index = segments.length - 1; index > 1; index -= 1) {
    const parentSegments = segments.slice(0, index);
    candidates.push(parentSegments.join("/"));
    candidates.push(parentSegments.map((segment) => (isDynamicSegment(segment) ? DYNAMIC_SEGMENT : segment)).join("/"));
  }

  return unique(candidates);
}

function topicMatches(topic: HelpTopic, candidates: string[]) {
  const topicKey = normalizeTopicIdentifier(topic.topicKey);
  const moduleKey = normalizeTopicIdentifier(topic.moduleKey);

  return candidates.includes(topicKey) || (!!moduleKey && candidates.includes(moduleKey));
}

export function PanelHelpButton() {
  const [location, setLocation] = useLocation();
  const t = useT();
  const [topics, setTopics] = useState<HelpTopic[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [mountElement, setMountElement] = useState<HTMLElement | null>(null);
  const candidates = useMemo(() => getTopicCandidates(location), [location]);

  useEffect(() => {
    if (!candidates.length || hasLoaded) {
      return;
    }

    let mounted = true;

    api.helpTopics.list(undefined, true).then((result) => {
      if (!mounted) {
        return;
      }

      setTopics(result.success ? result.data.items.filter((topic) => topic.showInPageHeader) : []);
      setHasLoaded(true);
    });

    return () => {
      mounted = false;
    };
  }, [candidates.length, hasLoaded]);

  const topic = useMemo(() => {
    if (!candidates.length) {
      return null;
    }

    return topics.find((item) => topicMatches(item, candidates)) ?? null;
  }, [candidates, topics]);

  useEffect(() => {
    if (typeof document === "undefined" || !candidates.length) {
      setMountElement(null);
      return;
    }

    let hostElement: HTMLSpanElement | null = null;
    let controlGroup: HTMLSpanElement | null = null;
    let backControl: HTMLElement | null = null;
    let originalParent: HTMLElement | null = null;
    let originalNextSibling: ChildNode | null = null;

    const frame = window.requestAnimationFrame(() => {
      const backLabel = t("common.back");
      const backTrigger = document.querySelector<HTMLElement>(
        `header [title="${backLabel}"], header [aria-label="${backLabel}"]`,
      );
      backControl = backTrigger?.closest("a") ?? backTrigger?.closest("button") ?? null;

      if (backControl?.parentElement) {
        originalParent = backControl.parentElement;
        originalNextSibling = backControl.nextSibling;

        controlGroup = document.createElement("span");
        controlGroup.className = "inline-flex items-center gap-1.5";

        hostElement = document.createElement("span");
        hostElement.className = "inline-flex shrink-0 items-center";

        controlGroup.appendChild(hostElement);
        controlGroup.appendChild(backControl);
        originalParent.insertBefore(controlGroup, originalNextSibling);
        setMountElement(hostElement);
        return;
      }

      setMountElement(null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      setMountElement(null);
      if (controlGroup && originalParent && backControl) {
        originalParent.insertBefore(backControl, originalNextSibling);
        controlGroup.remove();
      }
      hostElement?.remove();
    };
  }, [candidates, location, t]);

  if (!topic) {
    return null;
  }

  const normalizedLocation = normalizePath(location);
  const href = `/panel/help?topic=${encodeURIComponent(normalizedLocation)}&from=${encodeURIComponent(location)}`;
  const handleOpenHelp = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("panel-help:return-to", location);
    }

    setLocation(href);
  };

  const button = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title={t("panelHelpButton.title")}
      aria-label={t("panelHelpButton.title")}
      onClick={handleOpenHelp}
      className="h-10 w-10 rounded-2xl border-border/70 bg-background/75 text-foreground shadow-sm backdrop-blur transition hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
    >
      <CircleHelp className="h-5 w-5" />
    </Button>
  );

  if (mountElement) {
    return createPortal(
      <div className="inline-flex items-center">
        {button}
      </div>,
      mountElement,
    );
  }

  return (
    <div className="fixed start-4 top-4 z-50 sm:start-6 sm:top-6">
      {button}
    </div>
  );
}
