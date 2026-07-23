import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Hash, Loader2, PencilLine, Plus, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { ArticleTagItem, TenantMeta } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type TagFormState = {
  name: string;
  slug: string;
};

const defaultFormState: TagFormState = {
  name: "",
  slug: "",
};

function normalizeSlugInput(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function PanelArticlesTagsPage() {
  const { isAdmin, isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tags, setTags] = useState<ArticleTagItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ArticleTagItem | null>(null);
  const [editingTag, setEditingTag] = useState<ArticleTagItem | null>(null);
  const [form, setForm] = useState<TagFormState>(defaultFormState);
  const labels = getAudienceLabels(tenantMeta);

  useEffect(() => {
    Promise.all([api.articles.tags.list(), api.meta.get()]).then(([tagsRes, metaRes]) => {
      if (tagsRes.success) {
        setTags(tagsRes.data.items);
      }

      if (metaRes.success) {
        setTenantMeta(metaRes.data);
      }

      setLoading(false);
    });
  }, []);

  const activeTagCount = format.number(tags.length);
  const hasDuplicateSlug = useMemo(() => {
    const normalizedSlug = normalizeSlugInput(form.slug);
    if (normalizedSlug === "") {
      return false;
    }

    return tags.some((item) => item.slug === normalizedSlug && item.id !== editingTag?.id);
  }, [editingTag?.id, form.slug, tags]);

  if (!isPrimaryAdmin) {
    return null;
  }

  if (tenantMeta?.supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  const openCreateDialog = () => {
    setEditingTag(null);
    setForm(defaultFormState);
    setDialogOpen(true);
  };

  const openEditDialog = (tag: ArticleTagItem) => {
    setEditingTag(tag);
    setForm({
      name: tag.name,
      slug: tag.slug,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({
        variant: "destructive",
        title: t("panelArticlesTags.toast.nameRequired"),
        description: t("panelArticlesTags.toast.nameRequiredDescription"),
      });
      return;
    }

    if (hasDuplicateSlug) {
      toast({
        variant: "destructive",
        title: t("panelArticlesTags.toast.duplicateSlug"),
        description: t("panelArticlesTags.toast.duplicateSlugDescription"),
      });
      return;
    }

    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      slug: normalizeSlugInput(form.slug),
    };

    const res = editingTag
      ? await api.articles.tags.update(editingTag.id, payload)
      : await api.articles.tags.create(payload);

    setSubmitting(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("panelArticlesTags.toast.saveFailed"),
        description: res.message || t("panelArticlesTags.toast.saveFailedDescription"),
      });
      return;
    }

    setTags((current) => {
      if (editingTag) {
        return current.map((item) => (item.id === res.data.id ? res.data : item));
      }

      return [res.data, ...current];
    });
    setDialogOpen(false);
    setEditingTag(null);
    setForm(defaultFormState);
    toast({
      title: editingTag ? t("panelArticlesTags.toast.updated") : t("panelArticlesTags.toast.created"),
      description: editingTag ? t("panelArticlesTags.toast.updatedDescription") : t("panelArticlesTags.toast.createdDescription"),
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setSubmitting(true);
    const res = await api.articles.tags.remove(deleteTarget.id);
    setSubmitting(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("panelArticlesTags.toast.deleteFailed"),
        description: res.message || t("panelArticlesTags.toast.deleteFailedDescription"),
      });
      return;
    }

    setTags((current) => current.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast({
      title: t("panelArticlesTags.toast.deleted"),
      description: t("panelArticlesTags.toast.deletedDescription"),
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_40%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("panelArticlesTags.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("panelArticlesTags.title")}</h1>
          </div>

          <Link href="/panel/articles">
            <Button variant="outline" size="icon" title={t("panelArticlesTags.back")} className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-5 px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Tags className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-black">{t("panelArticlesTags.hero.title")}</h2>
                  <p className="text-sm leading-7 text-muted-foreground">{t("panelArticlesTags.hero.description")}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:justify-items-end">
              <div className="w-full rounded-[24px] border border-primary/20 bg-primary/10 p-4 text-start sm:max-w-[220px]">
                <div className="text-xs font-bold text-primary/80">{t("panelArticlesTags.countLabel")}</div>
                <div className="mt-2 text-3xl font-black text-primary">{activeTagCount}</div>
              </div>
              <Button className="rounded-[18px] px-5" onClick={openCreateDialog}>
                <Plus className="me-2 h-4 w-4" />
                {t("panelArticlesTags.add")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-[30px] border border-border/70 bg-card/50 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelArticlesTags.loading")}
          </div>
        ) : tags.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-card/40">
            <CardContent className="space-y-3 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <Hash className="h-6 w-6" />
              </div>
              <div className="text-xl font-black">{t("panelArticlesTags.empty.title")}</div>
              <p className="mx-auto max-w-2xl text-sm leading-8 text-muted-foreground">{t("panelArticlesTags.empty.description")}</p>
              <div className="pt-2">
                <Button className="rounded-[18px] px-6" onClick={openCreateDialog}>
                  <Plus className="me-2 h-4 w-4" />
                  {t("panelArticlesTags.empty.create")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tags.map((tag) => (
              <Card key={tag.id} className="border-border/70 bg-gradient-to-br from-card via-card to-background/60">
                <CardContent className="space-y-5 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="text-lg font-black">{tag.name}</div>
                      <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        <Hash className="me-1 h-3.5 w-3.5" />
                        <CodeText className="text-xs">{tag.slug}</CodeText>
                      </div>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-primary/20 bg-primary/10 text-primary">
                      <Tags className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-border/60 bg-background/35 px-4 py-3 text-sm leading-7 text-muted-foreground">
                    {t("panelArticlesTags.card.description")}
                  </div>

                  <div className="flex items-center gap-3">
                    <Button variant="outline" className="flex-1 rounded-[18px]" onClick={() => openEditDialog(tag)}>
                      <PencilLine className="me-2 h-4 w-4" />
                      {t("panelArticlesTags.edit")}
                    </Button>
                    <Button variant="outline" className="rounded-[18px] border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteTarget(tag)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir={dir} className="border-border bg-card text-start sm:max-w-lg">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{editingTag ? t("panelArticlesTags.dialog.editTitle") : t("panelArticlesTags.dialog.createTitle")}</DialogTitle>
            <DialogDescription className="text-start leading-8">
              {editingTag
                ? t("panelArticlesTags.dialog.editDescription")
                : t("panelArticlesTags.dialog.createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="article-tag-name">{t("panelArticlesTags.form.name")}</Label>
              <Input
                id="article-tag-name"
                value={form.name}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setForm((current) => ({
                    ...current,
                    name: nextName,
                    slug: current.slug === "" || current.slug === normalizeSlugInput(current.name) ? normalizeSlugInput(nextName) : current.slug,
                  }));
                }}
                placeholder={t("panelArticlesTags.form.namePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="article-tag-slug">{t("panelArticlesTags.form.slug")}</Label>
              <Input
                id="article-tag-slug"
                value={form.slug}
                onChange={(event) => setForm((current) => ({ ...current, slug: normalizeSlugInput(event.target.value) }))}
                placeholder={t("panelArticlesTags.form.slugPlaceholder")}
                dir="ltr"
                className="text-start"
              />
              <div className={`text-xs ${hasDuplicateSlug ? "text-destructive" : "text-muted-foreground"}`}>
                {hasDuplicateSlug ? t("panelArticlesTags.form.slugDuplicate") : t("panelArticlesTags.form.slugHint")}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-3 sm:justify-start">
            <Button variant="outline" className="rounded-[18px]" onClick={() => setDialogOpen(false)} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button className="rounded-[18px]" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {editingTag ? t("panelArticlesTags.form.saveChanges") : t("panelArticlesTags.form.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir={dir} className="text-start">
          <AlertDialogHeader className="text-start sm:text-start">
            <AlertDialogTitle className="text-start">{t("panelArticlesTags.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription className="text-start leading-8">
              {deleteTarget ? t("panelArticlesTags.delete.description", { name: deleteTarget.name }) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:justify-start">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 text-white hover:bg-red-500/90 hover:text-white" onClick={handleDelete}>
              {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t("panelArticlesTags.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
