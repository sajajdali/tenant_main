import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, ChevronDown, ChevronLeft, FolderTree, Loader2, PencilLine, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { ArticleCategoryItem, TenantMeta } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type CategoryFormState = {
  name: string;
  slug: string;
  parentId: string;
  sortOrder: string;
  isActive: boolean;
};

const defaultFormState: CategoryFormState = {
  name: "",
  slug: "",
  parentId: "",
  sortOrder: "0",
  isActive: true,
};

function normalizeSlugInput(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function collectDescendantIds(item: ArticleCategoryItem): string[] {
  return (item.children ?? []).flatMap((child) => [child.id, ...collectDescendantIds(child)]);
}

function buildParentOptions(nodes: ArticleCategoryItem[], depth = 0): Array<{ id: string; label: string }> {
  return nodes.flatMap((item) => [
    { id: item.id, label: `${"— ".repeat(depth)}${item.name}` },
    ...buildParentOptions(item.children ?? [], depth + 1),
  ]);
}

function removeItem(items: ArticleCategoryItem[], targetId: string): ArticleCategoryItem[] {
  return items
    .filter((item) => item.id !== targetId)
    .map((item) => ({
      ...item,
      children: item.children ? removeItem(item.children, targetId) : item.children,
    }));
}

export default function PanelArticlesCategoriesPage() {
  const { isAdmin, isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ArticleCategoryItem[]>([]);
  const [tree, setTree] = useState<ArticleCategoryItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ArticleCategoryItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<ArticleCategoryItem | null>(null);
  const [form, setForm] = useState<CategoryFormState>(defaultFormState);
  const labels = getAudienceLabels(tenantMeta);

  const loadData = async () => {
    setLoading(true);

    const [categoriesRes, metaRes] = await Promise.all([api.articles.categories.list(), api.meta.get()]);

    if (categoriesRes.success) {
      setItems(categoriesRes.data.items);
      setTree(categoriesRes.data.tree);
      setExpandedIds(categoriesRes.data.items.map((item) => item.id));
    }

    if (metaRes.success) {
      setTenantMeta(metaRes.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const categoryCount = format.number(items.length);
  const activeCount = format.number(items.filter((item) => item.isActive).length);

  const blockedParentIds = useMemo(() => {
    if (!editingCategory) {
      return new Set<string>();
    }

    return new Set([editingCategory.id, ...collectDescendantIds(editingCategory)]);
  }, [editingCategory]);

  const parentOptions = useMemo(() => {
    return buildParentOptions(tree).filter((item) => !blockedParentIds.has(item.id));
  }, [blockedParentIds, tree]);

  if (!isPrimaryAdmin) {
    return null;
  }

  if (tenantMeta?.supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  const resetForm = () => {
    setEditingCategory(null);
    setForm(defaultFormState);
  };

  const openCreateDialog = (parentId = "") => {
    setEditingCategory(null);
    setForm({
      ...defaultFormState,
      parentId,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (category: ArticleCategoryItem) => {
    setEditingCategory(category);
    setForm({
      name: category.name,
      slug: category.slug,
      parentId: category.parentId ?? "",
      sortOrder: String(category.sortOrder ?? 0),
      isActive: category.isActive,
    });
    setDialogOpen(true);
  };

  const hasDuplicateSlug = items.some((item) => item.slug === normalizeSlugInput(form.slug) && item.id !== editingCategory?.id);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({
        variant: "destructive",
        title: t("panelArticlesCategories.toast.nameRequired"),
        description: t("panelArticlesCategories.toast.nameRequiredDescription"),
      });
      return;
    }

    if (hasDuplicateSlug) {
      toast({
        variant: "destructive",
        title: t("panelArticlesCategories.toast.duplicateSlug"),
        description: t("panelArticlesCategories.toast.duplicateSlugDescription"),
      });
      return;
    }

    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      slug: normalizeSlugInput(form.slug),
      parentId: form.parentId || null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    const res = editingCategory
      ? await api.articles.categories.update(editingCategory.id, payload)
      : await api.articles.categories.create(payload);

    setSubmitting(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("panelArticlesCategories.toast.saveFailed"),
        description: res.message || t("panelArticlesCategories.toast.saveFailedDescription"),
      });
      return;
    }

    setDialogOpen(false);
    resetForm();
    await loadData();
    toast({
      title: editingCategory ? t("panelArticlesCategories.toast.updated") : t("panelArticlesCategories.toast.created"),
      description: editingCategory ? t("panelArticlesCategories.toast.updatedDescription") : t("panelArticlesCategories.toast.createdDescription"),
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setSubmitting(true);
    const res = await api.articles.categories.remove(deleteTarget.id);
    setSubmitting(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("panelArticlesCategories.toast.deleteFailed"),
        description: res.message || t("panelArticlesCategories.toast.deleteFailedDescription"),
      });
      return;
    }

    setTree((current) => removeItem(current, deleteTarget.id));
    setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
    await loadData();
    toast({
      title: t("panelArticlesCategories.toast.deleted"),
      description: t("panelArticlesCategories.toast.deletedDescription"),
    });
  };

  const renderTree = (nodes: ArticleCategoryItem[], depth = 0): ReactNode[] =>
    nodes.map((node) => {
      const hasChildren = (node.children?.length ?? 0) > 0;
      const isExpanded = expandedIds.includes(node.id);

      return (
        <div key={node.id} className="space-y-3">
          <div className="article-categories-tree-item rounded-[24px] border border-border/70 bg-background/30 p-4" style={{ marginInlineStart: `${depth * 20}px` }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {hasChildren ? (
                    <button
                      type="button"
                      className="article-categories-expand-button flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-background/40"
                      onClick={() =>
                        setExpandedIds((current) => (current.includes(node.id) ? current.filter((item) => item !== node.id) : [...current, node.id]))
                      }
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className={`h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />}
                    </button>
                  ) : (
                    <div className="h-8 w-8" />
                  )}
                  <div>
                    <div className="text-lg font-black">{node.name}</div>
                    <CodeText className="mt-1 text-xs text-muted-foreground">/{node.slug}</CodeText>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="article-categories-badge article-categories-badge--sort rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary">{t("panelArticlesCategories.tree.sortOrder", { value: format.number(node.sortOrder) })}</span>
                  <span className={`article-categories-badge rounded-full border px-3 py-1 ${node.isActive ? "article-categories-badge--active border-emerald-400/20 bg-emerald-500/10 text-emerald-300" : "article-categories-badge--inactive border-border/70 bg-background/50 text-muted-foreground"}`}>
                    {node.isActive ? t("panelArticlesCategories.status.active") : t("panelArticlesCategories.status.inactive")}
                  </span>
                  <span className="article-categories-badge article-categories-badge--children rounded-full border border-border/70 bg-background/40 px-3 py-1 text-muted-foreground">
                    {t("panelArticlesCategories.tree.childrenCount", { count: format.number(node.children?.length ?? 0) })}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="article-categories-action article-categories-action--sub rounded-[16px] border-border bg-background/40" onClick={() => openCreateDialog(node.id)}>
                  <Plus className="me-2 h-4 w-4" />
                  {t("panelArticlesCategories.tree.addSubcategory")}
                </Button>
                <Button variant="outline" className="article-categories-action article-categories-action--edit rounded-[16px] border-border bg-background/40" onClick={() => openEditDialog(node)}>
                  <PencilLine className="me-2 h-4 w-4" />
                  {t("panelArticlesCategories.edit")}
                </Button>
                <Button variant="outline" className="article-categories-action article-categories-action--delete rounded-[16px] border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(node)}>
                  <Trash2 className="me-2 h-4 w-4" />
                  {t("panelArticlesCategories.delete.action")}
                </Button>
              </div>
            </div>
          </div>

          {hasChildren && isExpanded ? renderTree(node.children ?? [], depth + 1) : null}
        </div>
      );
    });

  return (
    <div className="panel-article-categories-page min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="panel-article-categories-glow absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_40%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="panel-article-categories-header sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("panelArticlesCategories.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("panelArticlesCategories.title")}</h1>
          </div>

          <Link href="/panel/articles">
            <Button variant="outline" size="icon" title={t("panelArticlesCategories.back")} className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-5 px-4 py-6">
        <Card className="article-categories-hero border-border/70 bg-card/60">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_260px] sm:p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="article-categories-icon flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <FolderTree className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-black">{t("panelArticlesCategories.hero.title")}</h2>
                  <p className="text-sm leading-7 text-muted-foreground">{t("panelArticlesCategories.hero.description")}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:justify-items-end">
              <div className="grid w-full gap-3 sm:max-w-[260px] sm:grid-cols-2">
                <div className="article-categories-stat article-categories-stat--total rounded-[24px] border border-primary/20 bg-primary/10 p-4 text-start">
                  <div className="text-xs font-bold text-primary/80">{t("panelArticlesCategories.stats.total")}</div>
                  <div className="mt-2 text-3xl font-black text-primary">{categoryCount}</div>
                </div>
                <div className="article-categories-stat article-categories-stat--active rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 p-4 text-start">
                  <div className="text-xs font-bold text-emerald-200/90">{t("panelArticlesCategories.stats.active")}</div>
                  <div className="mt-2 text-3xl font-black text-emerald-300">{activeCount}</div>
                </div>
              </div>
              <Button className="article-categories-primary-button rounded-[18px] px-5" onClick={() => openCreateDialog()}>
                <Plus className="me-2 h-4 w-4" />
                {t("panelArticlesCategories.add")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-[30px] border border-border/70 bg-card/50 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelArticlesCategories.loading")}
          </div>
        ) : tree.length === 0 ? (
          <Card className="article-categories-empty border-dashed border-border/70 bg-card/40">
            <CardContent className="space-y-3 p-8 text-center">
              <div className="article-categories-icon mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <FolderTree className="h-6 w-6" />
              </div>
              <div className="text-xl font-black">{t("panelArticlesCategories.empty.title")}</div>
              <p className="mx-auto max-w-2xl text-sm leading-8 text-muted-foreground">{t("panelArticlesCategories.empty.description")}</p>
              <div className="pt-2">
                <Button className="article-categories-primary-button rounded-[18px] px-6" onClick={() => openCreateDialog()}>
                  <Plus className="me-2 h-4 w-4" />
                  {t("panelArticlesCategories.empty.create")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">{renderTree(tree)}</div>
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
        <DialogContent className="article-categories-dialog sm:max-w-xl" dir={dir}>
          <DialogHeader>
            <DialogTitle>{editingCategory ? t("panelArticlesCategories.dialog.editTitle") : t("panelArticlesCategories.dialog.createTitle")}</DialogTitle>
            <DialogDescription>
              {editingCategory ? t("panelArticlesCategories.dialog.editDescription") : t("panelArticlesCategories.dialog.createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="article-category-name">{t("panelArticlesCategories.form.name")}</Label>
              <Input
                id="article-category-name"
                value={form.name}
                onChange={(e) => {
                  const nextName = e.target.value;
                  setForm((current) => ({
                    ...current,
                    name: nextName,
                    slug: current.slug ? current.slug : normalizeSlugInput(nextName),
                  }));
                }}
                placeholder={t("panelArticlesCategories.form.namePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="article-category-slug">{t("panelArticlesCategories.form.slug")}</Label>
              <Input
                id="article-category-slug"
                value={form.slug}
                onChange={(e) => setForm((current) => ({ ...current, slug: normalizeSlugInput(e.target.value) }))}
                placeholder={t("panelArticlesCategories.form.slugPlaceholder")}
                className="text-start [direction:ltr]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="article-category-parent">{t("panelArticlesCategories.form.parent")}</Label>
              <select
                id="article-category-parent"
                value={form.parentId}
                onChange={(e) => setForm((current) => ({ ...current, parentId: e.target.value }))}
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
              >
                <option value="">{t("panelArticlesCategories.form.noParent")}</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="article-category-sort-order">{t("panelArticlesCategories.form.sortOrder")}</Label>
              <Input
                id="article-category-sort-order"
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(e) => setForm((current) => ({ ...current, sortOrder: e.target.value }))}
              />
            </div>

            <div className="article-categories-dialog-switch flex items-center justify-between rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
              <div className="space-y-1">
                <div className="font-bold">{t("panelArticlesCategories.form.active")}</div>
                <div className="text-xs text-muted-foreground">{t("panelArticlesCategories.form.activeDescription")}</div>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
              {editingCategory ? t("panelArticlesCategories.form.saveChanges") : t("panelArticlesCategories.form.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("panelArticlesCategories.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t("panelArticlesCategories.delete.description", { name: deleteTarget.name })
                : t("panelArticlesCategories.delete.fallbackDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t("panelArticlesCategories.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
