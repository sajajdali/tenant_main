import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, FileArchive, FileText, Film, FolderOpen, HardDrive, ImageIcon, Music2, Play, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { TenantFileCategory, TenantFileItem, TenantFileManagerPayload, TenantStorageUsage } from "@/lib/types";

function formatStorageBytes(
  bytes: number | null | undefined,
  number: ReturnType<typeof useFormat>["number"],
  t: ReturnType<typeof useT>,
) {
  const safeBytes = Math.max(0, Number(bytes ?? 0));
  const gb = safeBytes / 1024 / 1024 / 1024;

  if (gb >= 1) {
    return t("panelFiles.storage.gigabytes", { value: number(gb, { maximumFractionDigits: gb >= 10 ? 0 : 1 }) });
  }

  const mb = safeBytes / 1024 / 1024;

  if (mb >= 1) {
    return t("panelFiles.storage.megabytes", { value: number(mb, { maximumFractionDigits: mb >= 10 ? 0 : 1 }) });
  }

  const kb = safeBytes / 1024;

  if (kb >= 1) {
    return t("panelFiles.storage.kilobytes", { value: number(kb, { maximumFractionDigits: kb >= 10 ? 0 : 1 }) });
  }

  return t("panelFiles.storage.bytes", { value: number(safeBytes) });
}

const filters: Array<{ key: TenantFileCategory | "all"; labelKey: Parameters<ReturnType<typeof useT>>[0] }> = [
  { key: "all", labelKey: "panelFiles.filter.all" },
  { key: "image", labelKey: "panelFiles.category.image" },
  { key: "audio", labelKey: "panelFiles.category.audio" },
  { key: "video", labelKey: "panelFiles.category.video" },
  { key: "document", labelKey: "panelFiles.category.document" },
  { key: "other", labelKey: "panelFiles.category.other" },
];

const categoryLabelKeys: Record<TenantFileCategory, Parameters<ReturnType<typeof useT>>[0]> = {
  image: "panelFiles.category.image",
  audio: "panelFiles.category.audio",
  video: "panelFiles.category.video",
  document: "panelFiles.category.document",
  other: "panelFiles.category.other",
};

function FileIcon({ category }: { category: TenantFileCategory }) {
  if (category === "image") return <ImageIcon className="h-5 w-5" />;
  if (category === "audio") return <Music2 className="h-5 w-5" />;
  if (category === "video") return <Film className="h-5 w-5" />;
  if (category === "document") return <FileText className="h-5 w-5" />;
  return <FileArchive className="h-5 w-5" />;
}

export default function PanelFilesPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const initialStorage = getInitialTenantMeta()?.storage ?? null;
  const [payload, setPayload] = useState<TenantFileManagerPayload | null>(
    initialStorage
      ? { items: [], usage: initialStorage, pagination: { page: 1, perPage: 24, total: 0, lastPage: 1 } }
      : null,
  );
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [type, setType] = useState<TenantFileCategory | "all">("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<TenantFileItem | null>(null);

  const usage: TenantStorageUsage | null = payload?.usage ?? initialStorage;
  const usedBytes = usage?.usedBytes ?? 0;
  const totalBytes = usage?.totalQuotaBytes ?? 0;
  const percent = totalBytes > 0 ? Math.min(100, Math.max(0, (usedBytes / totalBytes) * 100)) : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const ringColor = usage?.isFull || percent >= 95 ? "stroke-destructive" : percent >= 75 ? "stroke-amber-400" : "stroke-primary";

  const stats = useMemo(() => {
    const items = payload?.items ?? [];
    return {
      images: items.filter((item) => item.category === "image").length,
      audio: items.filter((item) => item.category === "audio").length,
      video: items.filter((item) => item.category === "video").length,
    };
  }, [payload?.items]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api.files.list({ q: debouncedQuery, type, page, perPage: 24 }).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setPayload(res.data);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, type, page]);

  const handleDelete = async (item: TenantFileItem) => {
    const confirmed = window.confirm(t("panelFiles.deleteConfirm", { name: item.name }));
    if (!confirmed) return;

    setDeletingId(item.id);
    const res = await api.files.delete(item.id);
    setDeletingId(null);

    if (res.success) {
      setPayload((current) => current ? {
        ...current,
        usage: res.data.usage,
        items: current.items.filter((file) => file.id !== item.id),
        pagination: {
          ...current.pagination,
          total: Math.max(0, current.pagination.total - 1),
        },
      } : current);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 text-foreground" dir={dir}>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-black">{t("panelFiles.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelFiles.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/panel/files/upgrade">
              <Button className="gap-2 rounded-2xl">
                <Plus className="h-4 w-4" />
                {t("panelFiles.upgrade")}
              </Button>
            </Link>
            <Link href="/panel">
              <Button variant="outline" size="icon" className="rounded-full">
                <ArrowRight className={`h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />
              </Button>
            </Link>
          </div>
        </div>

        <section className="grid gap-3 lg:grid-cols-[360px_1fr]">
          <Card className="border-border/70 bg-card/60">
            <CardContent className="flex items-center gap-5 p-5">
              <div className="relative h-28 w-28 shrink-0">
                <svg className="h-28 w-28 -rotate-90" viewBox="0 0 108 108" aria-hidden="true">
                  <circle cx="54" cy="54" r={radius} className="fill-none stroke-border/70" strokeWidth="10" />
                  <circle
                    cx="54"
                    cy="54"
                    r={radius}
                    className={`fill-none transition-all duration-500 ${ringColor}`}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-xl font-black">{format.percent(percent / 100)}</div>
                  <div className="text-xs text-muted-foreground">{t("panelFiles.storage.usedPercent")}</div>
                </div>
              </div>
              <div className="min-w-0 space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">{t("panelFiles.storage.used")}</div>
                  <div className="mt-1 text-xl font-black">{formatStorageBytes(usedBytes, format.number, t)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t("panelFiles.storage.fromTotal", { total: formatStorageBytes(totalBytes, format.number, t) })}
                  </div>
                </div>
                <Badge className={usage?.isFull ? "bg-destructive text-destructive-foreground" : undefined} variant={usage?.isFull ? "destructive" : "secondary"}>
                  {usage?.isFull
                    ? t("panelFiles.storage.full")
                    : t("panelFiles.storage.remaining", { value: formatStorageBytes(usage?.remainingBytes ?? 0, format.number, t) })}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border/70 bg-card/50">
              <CardContent className="p-4 text-center">
                <ImageIcon className="mx-auto h-5 w-5 text-primary" />
                <div className="mt-2 text-xl font-black">{format.number(stats.images)}</div>
                <div className="text-xs text-muted-foreground">{t("panelFiles.stats.images")}</div>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/50">
              <CardContent className="p-4 text-center">
                <Music2 className="mx-auto h-5 w-5 text-primary" />
                <div className="mt-2 text-xl font-black">{format.number(stats.audio)}</div>
                <div className="text-xs text-muted-foreground">{t("panelFiles.stats.audio")}</div>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/50">
              <CardContent className="p-4 text-center">
                <Film className="mx-auto h-5 w-5 text-primary" />
                <div className="mt-2 text-xl font-black">{format.number(stats.video)}</div>
                <div className="text-xs text-muted-foreground">{t("panelFiles.stats.video")}</div>
              </CardContent>
            </Card>
          </div>
        </section>

        <Card className="border-border/70 bg-card/60">
          <CardHeader className="space-y-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="h-5 w-5 text-primary" />
                {t("panelFiles.list.title")}
              </CardTitle>
              <CardDescription className="mt-2">{t("panelFiles.list.description")}</CardDescription>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative lg:w-96">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("panelFiles.searchPlaceholder")}
                  className="h-11 w-full rounded-2xl border border-border bg-background pe-3 ps-10 text-sm outline-none transition focus:border-primary"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {filters.map((filter) => (
                  <Button
                    key={filter.key}
                    type="button"
                    size="sm"
                    variant={type === filter.key ? "default" : "outline"}
                    className="shrink-0 rounded-2xl"
                    onClick={() => {
                      setType(filter.key);
                      setPage(1);
                    }}
                  >
                    {t(filter.labelKey)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-44 animate-pulse rounded-2xl border border-border/70 bg-background/40" />
                ))}
              </div>
            ) : (payload?.items.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-background/40 p-8 text-center text-sm text-muted-foreground">
                {t("panelFiles.empty")}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {payload?.items.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-2xl border border-border/70 bg-background/40">
                    <div className="relative flex h-40 items-center justify-center bg-muted/20">
                      {item.category === "image" && item.url ? (
                        <button type="button" className="h-full w-full" onClick={() => setPreview(item)}>
                          <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                        </button>
                      ) : item.category === "audio" && item.url ? (
                        <div className="w-full space-y-3 px-4 text-center">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Music2 className="h-7 w-7" />
                          </div>
                          <audio controls className="w-full" src={item.url} />
                        </div>
                      ) : item.category === "video" && item.url ? (
                        <button type="button" className="flex flex-col items-center gap-3 text-primary" onClick={() => setPreview(item)}>
                          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <Play className="h-8 w-8" />
                          </span>
                          <span className="text-sm font-bold">{t("panelFiles.playVideo")}</span>
                        </button>
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-primary">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <FileIcon category={item.category} />
                          </div>
                          <span className="text-sm font-bold">{t(categoryLabelKeys[item.category])}</span>
                        </div>
                      )}
                      <Badge variant="secondary" className="absolute start-3 top-3">
                        {t(categoryLabelKeys[item.category])}
                      </Badge>
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="min-w-0">
                        <div className="truncate font-bold" title={item.name}>{item.name}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground" title={item.path}>
                          {item.directory ? <CodeText>{item.directory}</CodeText> : t("panelFiles.rootDirectory")}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div className="rounded-xl border border-border/60 bg-background/40 p-2">
                          <div>{t("panelFiles.size")}</div>
                          <div className="mt-1 font-bold text-foreground">{formatStorageBytes(item.sizeBytes, format.number, t)}</div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/40 p-2">
                          <div>{t("panelFiles.type")}</div>
                          <div className="mt-1 truncate font-bold text-foreground">
                            {item.extension || item.mimeType ? <CodeText>{item.extension || item.mimeType}</CodeText> : t("panelFiles.unknown")}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">{item.modifiedAt ? format.dateTime(item.modifiedAt) : t("panelFiles.valueMissing")}</div>
                      <div className="flex gap-2">
                        {item.url ? (
                          <Button type="button" variant="outline" className="flex-1 rounded-2xl" onClick={() => item.category === "image" || item.category === "video" ? setPreview(item) : window.open(item.url || "", "_blank")}>
                            {t("panelFiles.view")}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="destructive"
                          className="rounded-2xl"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {t("panelFiles.pagination.total", { total: format.number(payload?.pagination.total ?? 0) })}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  {t("common.pagination.previous")}
                </Button>
                <Button variant="outline" disabled={page >= (payload?.pagination.lastPage ?? 1) || loading} onClick={() => setPage((current) => current + 1)}>
                  {t("common.pagination.next")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-4xl" dir={dir}>
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.name}</DialogTitle>
            <DialogDescription className="truncate">{preview?.path}</DialogDescription>
          </DialogHeader>
          {preview?.category === "image" && preview.url ? (
            <img src={preview.url} alt={preview.name} className="max-h-[70vh] w-full rounded-2xl object-contain" />
          ) : preview?.category === "video" && preview.url ? (
            <video src={preview.url} controls autoPlay className="max-h-[70vh] w-full rounded-2xl bg-black" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
