import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, CalendarClock, ImagePlus, Loader2, Newspaper, PencilLine, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { ArticleCategoryItem, ArticlePostItem, ArticleTagItem, TenantMeta } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const PANEL_ARTICLE_POSTS_PINK_STYLES = `
  :is(body[data-booking-template="pink"], .site-template-pink) .panel-article-posts-page {
    background:
      radial-gradient(circle at 12% -8%, rgba(255, 255, 255, 0.98), transparent 28rem),
      radial-gradient(circle at 92% 8%, rgba(216, 116, 155, 0.15), transparent 24rem),
      linear-gradient(180deg, #fff8fb 0%, #fff1f6 48%, #fde8f0 100%) !important;
    color: #704357 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-article-posts-glow {
    background:
      radial-gradient(circle at top, rgba(216, 116, 155, 0.16), transparent 44%),
      linear-gradient(180deg, rgba(255, 248, 251, 0.98), rgba(255, 241, 246, 0)) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-article-posts-header {
    border-color: rgba(239, 202, 216, 0.92) !important;
    background: rgba(255, 250, 252, 0.94) !important;
    box-shadow: 0 12px 34px rgba(185, 47, 102, 0.09) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-article-posts-page h1,
  :is(body[data-booking-template="pink"], .site-template-pink) .panel-article-posts-page h2,
  :is(body[data-booking-template="pink"], .site-template-pink) .panel-article-posts-page h3 {
    color: #704357 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .panel-article-posts-page .text-muted-foreground {
    color: #986b7c !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-stat {
    border-color: rgba(231, 174, 196, 0.9) !important;
    background: rgba(255, 253, 254, 0.95) !important;
    box-shadow: 0 16px 38px rgba(185, 47, 102, 0.1) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-stat--total div {
    color: #b92f66 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-stat--published div {
    color: #19724f !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-stat--featured div {
    color: #9a5c08 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-stat--slider div:not(.text-muted-foreground) {
    color: #166782 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-dashboard {
    border-color: rgba(231, 174, 196, 0.9) !important;
    background: rgba(255, 253, 254, 0.94) !important;
    box-shadow: 0 18px 44px rgba(185, 47, 102, 0.1) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-dashboard-icon {
    border-color: rgba(216, 116, 155, 0.38) !important;
    background: #fff1f6 !important;
    color: #c74678 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-item {
    border-color: rgba(231, 174, 196, 0.94) !important;
    background: linear-gradient(145deg, #fffefd 0%, #fff9fb 58%, #f9e1ea 100%) !important;
    color: #704357 !important;
    box-shadow: 0 18px 44px rgba(185, 47, 102, 0.1) !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-item-image {
    background: #fff5f8 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-badge {
    font-weight: 900 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-badge--featured {
    border-color: rgba(217, 119, 6, 0.34) !important;
    background: #fff5dc !important;
    color: #925607 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-badge--slider {
    border-color: rgba(2, 132, 199, 0.3) !important;
    background: #e7f6fc !important;
    color: #166782 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-badge--important {
    border-color: rgba(192, 38, 211, 0.28) !important;
    background: #faeafa !important;
    color: #8a368f !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-badge--published {
    border-color: rgba(5, 150, 105, 0.3) !important;
    background: #e6f8f1 !important;
    color: #19724f !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-badge--inactive {
    border-color: rgba(152, 107, 124, 0.28) !important;
    background: #f5e9ee !important;
    color: #865b6c !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-tag {
    border-color: rgba(199, 70, 120, 0.3) !important;
    background: #fff0f5 !important;
    color: #a9315f !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-edit-button {
    border-color: #c75d86 !important;
    background: rgba(255, 253, 254, 0.96) !important;
    color: #7a3e55 !important;
    font-weight: 900 !important;
  }

  :is(body[data-booking-template="pink"], .site-template-pink) .article-posts-delete-button {
    border-color: rgba(190, 24, 93, 0.36) !important;
    background: #fff0f4 !important;
    color: #a7184f !important;
    font-weight: 900 !important;
  }
`;

type PostFormState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  keyPoints: string;
  authorName: string;
  articleCategoryId: string;
  tagIds: string[];
  sortOrder: string;
  publishedAt: string;
  isActive: boolean;
  isFeatured: boolean;
  showInFeaturedSlider: boolean;
  isImportant: boolean;
  imageFile: File | null;
  imagePreview: string;
  removeImage: boolean;
};

const defaultFormState: PostFormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  keyPoints: "",
  authorName: "",
  articleCategoryId: "",
  tagIds: [],
  sortOrder: "0",
  publishedAt: "",
  isActive: true,
  isFeatured: false,
  showInFeaturedSlider: false,
  isImportant: false,
  imageFile: null,
  imagePreview: "",
  removeImage: false,
};

function normalizeSlugInput(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function flattenCategoryOptions(items: ArticleCategoryItem[], depth = 0): Array<{ id: string; label: string }> {
  return items.flatMap((item) => [
    { id: item.id, label: `${"— ".repeat(depth)}${item.name}` },
    ...flattenCategoryOptions(item.children ?? [], depth + 1),
  ]);
}

function toLocalDatetimeValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function PanelArticlesPostsPage() {
  const { isAdmin, isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ArticlePostItem[]>([]);
  const [tagOptions, setTagOptions] = useState<ArticleTagItem[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<ArticleCategoryItem[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    published: number;
    featuredTitle?: string | null;
    importantTitle?: string | null;
    sliderCount: number;
  }>({
    total: 0,
    published: 0,
    featuredTitle: null,
    importantTitle: null,
    sliderCount: 0,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ArticlePostItem | null>(null);
  const [editingItem, setEditingItem] = useState<ArticlePostItem | null>(null);
  const [form, setForm] = useState<PostFormState>(defaultFormState);
  const labels = getAudienceLabels(tenantMeta);

  const loadData = async () => {
    setLoading(true);
    const [postsRes, metaRes] = await Promise.all([api.articles.posts.list(), api.meta.get()]);

    if (postsRes.success) {
      setItems(postsRes.data.items);
      setTagOptions(postsRes.data.tagOptions);
      setCategoryOptions(postsRes.data.categoryOptions);
      setStats(postsRes.data.stats);
    }

    if (metaRes.success) {
      setTenantMeta(metaRes.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const categorySelectOptions = useMemo(() => flattenCategoryOptions(categoryOptions), [categoryOptions]);
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || "") || b.sortOrder - a.sortOrder),
    [items],
  );

  if (!isPrimaryAdmin) {
    return null;
  }

  if (tenantMeta?.supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  const resetForm = () => {
    setEditingItem(null);
    setForm(defaultFormState);
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setForm({
      ...defaultFormState,
      publishedAt: toLocalDatetimeValue(new Date().toISOString()),
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: ArticlePostItem) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      slug: item.slug,
      excerpt: item.excerpt ?? "",
      content: item.content ?? "",
      keyPoints: (item.keyPoints ?? []).join("\n"),
      authorName: item.authorName,
      articleCategoryId: item.categoryId ?? "",
      tagIds: item.tagIds,
      sortOrder: String(item.sortOrder),
      publishedAt: toLocalDatetimeValue(item.publishedAt),
      isActive: item.isActive,
      isFeatured: item.isFeatured,
      showInFeaturedSlider: item.showInFeaturedSlider,
      isImportant: item.isImportant,
      imageFile: null,
      imagePreview: item.imageUrl ?? "",
      removeImage: false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.authorName.trim()) {
      toast({
        variant: "destructive",
        title: t("panelArticlePosts.toast.incompleteTitle"),
        description: t("panelArticlePosts.toast.incompleteDescription"),
      });
      return;
    }

    setSubmitting(true);

    const payload = {
      articleCategoryId: form.articleCategoryId || null,
      title: form.title.trim(),
      slug: normalizeSlugInput(form.slug),
      excerpt: form.excerpt.trim(),
      content: form.content.trim(),
      keyPoints: form.keyPoints
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 10),
      authorName: form.authorName.trim(),
      image: form.imageFile,
      removeImage: form.removeImage,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      showInFeaturedSlider: form.showInFeaturedSlider,
      isImportant: form.isImportant,
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
      tagIds: form.tagIds,
    };

    const res = editingItem
      ? await api.articles.posts.update(editingItem.id, payload)
      : await api.articles.posts.create(payload);

    setSubmitting(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("panelArticlePosts.toast.saveFailedTitle"),
        description: res.message || t("panelArticlePosts.toast.saveFailedDescription"),
      });
      return;
    }

    setDialogOpen(false);
    resetForm();
    await loadData();
    toast({
      title: editingItem ? t("panelArticlePosts.toast.updatedTitle") : t("panelArticlePosts.toast.createdTitle"),
      description: editingItem ? t("panelArticlePosts.toast.updatedDescription") : t("panelArticlePosts.toast.createdDescription"),
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setSubmitting(true);
    const res = await api.articles.posts.remove(deleteTarget.id);
    setSubmitting(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("panelArticlePosts.toast.deleteFailedTitle"),
        description: res.message || t("panelArticlePosts.toast.deleteFailedDescription"),
      });
      return;
    }

    setDeleteTarget(null);
    await loadData();
    toast({
      title: t("panelArticlePosts.toast.deletedTitle"),
      description: t("panelArticlePosts.toast.deletedDescription"),
    });
  };

  return (
    <div className="panel-article-posts-page min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <style>{PANEL_ARTICLE_POSTS_PINK_STYLES}</style>
      <div className="panel-article-posts-glow absolute inset-x-0 top-0 -z-10 h-[340px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_40%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="panel-article-posts-header sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("panelArticlePosts.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("panelArticlePosts.title")}</h1>
          </div>

          <Link href="/panel/articles">
            <Button variant="outline" size="icon" title={t("common.back")} className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="article-posts-stat article-posts-stat--total border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="text-xs font-bold text-primary/80">{t("panelArticlePosts.stats.total")}</div>
              <div className="mt-3 text-3xl font-black text-primary">{format.number(stats.total)}</div>
            </CardContent>
          </Card>
          <Card className="article-posts-stat article-posts-stat--published border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="text-xs font-bold text-emerald-200/90">{t("panelArticlePosts.stats.published")}</div>
              <div className="mt-3 text-3xl font-black text-emerald-300">{format.number(stats.published)}</div>
            </CardContent>
          </Card>
          <Card className="article-posts-stat article-posts-stat--featured border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="text-xs font-bold text-amber-200/90">{t("panelArticlePosts.stats.featuredTitle")}</div>
              <div className="mt-3 line-clamp-2 text-sm font-bold leading-7 text-amber-100">{stats.featuredTitle || t("panelArticlePosts.stats.notSet")}</div>
            </CardContent>
          </Card>
          <Card className="article-posts-stat article-posts-stat--slider border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="text-xs font-bold text-sky-200/90">{t("panelArticlePosts.stats.sliderCount")}</div>
              <div className="mt-3 text-3xl font-black text-sky-300">{format.number(stats.sliderCount)}</div>
              <div className="mt-2 text-xs text-muted-foreground">{t("panelArticlePosts.stats.sliderHint", { count: format.number(5) })}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="article-posts-dashboard border-border/70 bg-card/60">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="article-posts-dashboard-icon flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Newspaper className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black">{t("panelArticlePosts.dashboard.title")}</h2>
                  <p className="text-sm leading-7 text-muted-foreground">{t("panelArticlePosts.dashboard.description")}</p>
                </div>
              </div>
            </div>
            <Button className="rounded-[18px] px-5" onClick={openCreateDialog}>
              <Plus className="me-2 h-4 w-4" />
              {t("panelArticlePosts.create")}
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-[30px] border border-border/70 bg-card/50 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelArticlePosts.loading")}
          </div>
        ) : sortedItems.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-card/40">
            <CardContent className="space-y-3 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <Newspaper className="h-6 w-6" />
              </div>
              <div className="text-xl font-black">{t("panelArticlePosts.empty.title")}</div>
              <p className="mx-auto max-w-2xl text-sm leading-8 text-muted-foreground">{t("panelArticlePosts.empty.description")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {sortedItems.map((item) => (
              <Card key={item.id} className="article-posts-item overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-background/60">
                <CardContent className="p-0">
                  <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="article-posts-item-image bg-background/40">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="h-full min-h-[220px] w-full object-cover" />
                      ) : (
                        <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">{t("panelArticlePosts.imageMissing")}</div>
                      )}
                    </div>
                    <div className="space-y-4 p-5">
                      <div className="flex flex-wrap gap-2">
                        {item.isFeatured ? <span className="article-posts-badge article-posts-badge--featured rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200">{t("panelArticlePosts.badges.featured")}</span> : null}
                        {item.showInFeaturedSlider ? <span className="article-posts-badge article-posts-badge--slider rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-200">{t("panelArticlePosts.badges.slider")}</span> : null}
                        {item.isImportant ? <span className="article-posts-badge article-posts-badge--important rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-xs font-bold text-fuchsia-200">{t("panelArticlePosts.badges.important")}</span> : null}
                        <span className={`article-posts-badge ${item.isActive ? "article-posts-badge--published border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "article-posts-badge--inactive border-border/70 bg-background/50 text-muted-foreground"} rounded-full border px-3 py-1 text-xs font-bold`}>
                          {item.isActive ? t("panelArticlePosts.status.published") : t("panelArticlePosts.status.inactive")}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-xl font-black leading-8">{item.title}</h3>
                        <p className="line-clamp-3 text-sm leading-7 text-muted-foreground">{item.excerpt || t("panelArticlePosts.excerptMissing")}</p>
                      </div>

                      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <div>{t("panelArticlePosts.item.author")}: <span className="font-bold text-foreground">{item.authorName}</span></div>
                        <div>{t("panelArticlePosts.item.category")}: <span className="font-bold text-foreground">{item.categoryName || t("panelArticlePosts.noCategory")}</span></div>
                        <div>{t("panelArticlePosts.item.tags")}: <span className="font-bold text-foreground">{format.number(item.tags.length)}</span></div>
                        <div>{t("panelArticlePosts.item.views")}: <span className="font-bold text-foreground">{format.number(item.viewCount)}</span></div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {item.tags.map((tag) => (
                          <span key={tag.id} className="article-posts-tag rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                            #{tag.name}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button variant="secondary" className="article-posts-edit-button rounded-[16px] border-border bg-background/40" onClick={() => openEditDialog(item)}>
                          <PencilLine className="me-2 h-4 w-4" />
                          {t("panelArticlePosts.actions.edit")}
                        </Button>
                        <Button variant="destructive" className="article-posts-delete-button rounded-[16px] border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(item)}>
                          <Trash2 className="me-2 h-4 w-4" />
                          {t("panelArticlePosts.actions.delete")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl" dir={dir}>
          <DialogHeader>
            <DialogTitle>{editingItem ? t("panelArticlePosts.dialog.editTitle") : t("panelArticlePosts.dialog.createTitle")}</DialogTitle>
            <DialogDescription>{t("panelArticlePosts.dialog.description")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="article-post-title">{t("panelArticlePosts.form.title")}</Label>
                <Input
                  id="article-post-title"
                  value={form.title}
                  onChange={(e) => {
                    const nextTitle = e.target.value;
                    setForm((current) => ({
                      ...current,
                      title: nextTitle,
                      slug: current.slug ? current.slug : normalizeSlugInput(nextTitle),
                    }));
                  }}
                  placeholder={t("panelArticlePosts.form.titlePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="article-post-slug">{t("panelArticlePosts.form.slug")}</Label>
                <Input
                  id="article-post-slug"
                  value={form.slug}
                  onChange={(e) => setForm((current) => ({ ...current, slug: normalizeSlugInput(e.target.value) }))}
                  placeholder="new-special-service-launch"
                  className="text-start [direction:ltr]"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="article-post-author">{t("panelArticlePosts.form.author")}</Label>
                  <Input id="article-post-author" value={form.authorName} onChange={(e) => setForm((current) => ({ ...current, authorName: e.target.value }))} placeholder={t("panelArticlePosts.form.authorPlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="article-post-published-at">{t("panelArticlePosts.form.publishedAt")}</Label>
                  <Input id="article-post-published-at" type="datetime-local" value={form.publishedAt} onChange={(e) => setForm((current) => ({ ...current, publishedAt: e.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="article-post-category">{t("panelArticlePosts.form.category")}</Label>
                  <select
                    id="article-post-category"
                    value={form.articleCategoryId}
                    onChange={(e) => setForm((current) => ({ ...current, articleCategoryId: e.target.value }))}
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
                  >
                    <option value="">{t("panelArticlePosts.noCategory")}</option>
                    {categorySelectOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="article-post-sort-order">{t("panelArticlePosts.form.sortOrder")}</Label>
                  <Input id="article-post-sort-order" type="number" min="0" value={form.sortOrder} onChange={(e) => setForm((current) => ({ ...current, sortOrder: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="article-post-excerpt">{t("panelArticlePosts.form.excerpt")}</Label>
                <Textarea id="article-post-excerpt" value={form.excerpt} onChange={(e) => setForm((current) => ({ ...current, excerpt: e.target.value }))} className="min-h-28" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="article-post-content">{t("panelArticlePosts.form.content")}</Label>
                <Textarea id="article-post-content" value={form.content} onChange={(e) => setForm((current) => ({ ...current, content: e.target.value }))} className="min-h-52" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="article-post-key-points">{t("panelArticlePosts.form.keyPoints")}</Label>
                <Textarea
                  id="article-post-key-points"
                  value={form.keyPoints}
                  onChange={(e) => setForm((current) => ({ ...current, keyPoints: e.target.value }))}
                  className="min-h-32"
                  placeholder={t("panelArticlePosts.form.keyPointsPlaceholder", { count: format.number(10) })}
                />
                <div className="text-xs leading-6 text-muted-foreground">
                  {t("panelArticlePosts.form.keyPointsHint")}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("panelArticlePosts.form.tags")}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {tagOptions.map((tag) => {
                    const active = form.tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => setForm((current) => ({
                          ...current,
                          tagIds: active ? current.tagIds.filter((item) => item !== tag.id) : [...current.tagIds, tag.id],
                        }))}
                        className={`rounded-2xl border px-4 py-3 text-start text-sm font-bold transition ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/70 bg-background/40 text-foreground hover:bg-background/70"}`}
                      >
                        #{tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="article-post-image">{t("panelArticlePosts.form.image")}</Label>
                <Input
                  id="article-post-image"
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.avif,image/jpeg,image/png,image/gif,image/webp,image/avif"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setForm((current) => ({
                      ...current,
                      imageFile: file,
                      imagePreview: file ? URL.createObjectURL(file) : current.imagePreview,
                      removeImage: false,
                    }));
                  }}
                />
              </div>

              {form.imagePreview && !form.removeImage ? (
                <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/40">
                  <img src={form.imagePreview} alt={t("panelArticlePosts.form.imagePreviewAlt")} className="h-56 w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center rounded-[1.5rem] border border-dashed border-border/70 bg-background/30 text-sm text-muted-foreground">
                  <ImagePlus className="me-2 h-5 w-5" />
                  {t("panelArticlePosts.form.imageNotSelected")}
                </div>
              )}

              {editingItem?.imageUrl ? (
                <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
                  <div className="text-sm text-muted-foreground">{t("panelArticlePosts.form.removeImageHint")}</div>
                  <Switch checked={form.removeImage} onCheckedChange={(checked) => setForm((current) => ({ ...current, removeImage: checked }))} />
                </div>
              ) : null}

              <div className="space-y-3 rounded-[28px] border border-border/70 bg-background/35 p-4">
                <div className="flex items-start gap-3">
                  <Star className="mt-1 h-5 w-5 text-amber-300" />
                  <div>
                    <div className="font-bold">{t("panelArticlePosts.form.featuredTitle")}</div>
                    <div className="text-xs leading-6 text-muted-foreground">{t("panelArticlePosts.form.featuredHint")}</div>
                  </div>
                </div>
                <Switch checked={form.isFeatured} onCheckedChange={(checked) => setForm((current) => ({ ...current, isFeatured: checked }))} />
              </div>

              <div className="space-y-3 rounded-[28px] border border-border/70 bg-background/35 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-1 h-5 w-5 text-sky-300" />
                  <div>
                    <div className="font-bold">{t("panelArticlePosts.form.sliderTitle")}</div>
                    <div className="text-xs leading-6 text-muted-foreground">{t("panelArticlePosts.form.sliderHint", { count: format.number(5) })}</div>
                  </div>
                </div>
                <Switch checked={form.showInFeaturedSlider} onCheckedChange={(checked) => setForm((current) => ({ ...current, showInFeaturedSlider: checked }))} />
              </div>

              <div className="space-y-3 rounded-[28px] border border-border/70 bg-background/35 p-4">
                <div className="flex items-start gap-3">
                  <CalendarClock className="mt-1 h-5 w-5 text-fuchsia-300" />
                  <div>
                    <div className="font-bold">{t("panelArticlePosts.form.importantTitle")}</div>
                    <div className="text-xs leading-6 text-muted-foreground">{t("panelArticlePosts.form.importantHint")}</div>
                  </div>
                </div>
                <Switch checked={form.isImportant} onCheckedChange={(checked) => setForm((current) => ({ ...current, isImportant: checked }))} />
              </div>

              <div className="flex items-center justify-between rounded-[28px] border border-border/70 bg-background/35 p-4">
                <div>
                  <div className="font-bold">{t("panelArticlePosts.form.publishStatus")}</div>
                  <div className="text-xs text-muted-foreground">{t("panelArticlePosts.form.publishStatusHint")}</div>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
              {editingItem ? t("panelArticlePosts.form.saveChanges") : t("panelArticlePosts.form.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("panelArticlePosts.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? t("panelArticlePosts.deleteDialog.descriptionWithTitle", { title: deleteTarget.title }) : t("panelArticlePosts.deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t("panelArticlePosts.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
