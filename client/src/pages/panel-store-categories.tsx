import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, FolderKanban, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { StoreCategoryItem } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-");
}

export default function PanelStoreCategoriesPage() {
  const { isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<StoreCategoryItem | null>(null);
  const [items, setItems] = useState<StoreCategoryItem[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [showOnHome, setShowOnHome] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [editItem, setEditItem] = useState<StoreCategoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [editActive, setEditActive] = useState(true);
  const [editShowOnHome, setEditShowOnHome] = useState(true);
  const [editRemoveImage, setEditRemoveImage] = useState(false);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState("");

  const loadItems = async () => {
    setLoading(true);
    const res = await api.store.listCategories();
    if (res.success) {
      setItems(res.data.items);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isPrimaryAdmin) {
      return;
    }

    loadItems();
  }, [isPrimaryAdmin]);

  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelStore.categories.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelStore.categories.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelStore.categories.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder || (b.createdAt || "").localeCompare(a.createdAt || "")),
    [items],
  );

  const resetCreateForm = () => {
    setName("");
    setSlug("");
    setSortOrder("0");
    setShowOnHome(true);
    setImageFile(null);
    setImagePreview("");
  };

  const handleDeleteCategory = async () => {
    if (!deleteItem) {
      return;
    }

    setDeletingId(deleteItem.id);
    const res = await api.store.deleteCategory(deleteItem.id);
    setDeletingId(null);
    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }
    toast({ title: t("panelStore.categories.toast.deleted"), description: res.message });
    setDeleteItem(null);
    await loadItems();
  };

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("panelStore.categories.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelStore.categories.description")}</p>
          </div>
          <Link href="/panel/store-settings">
            <Button variant="outline" size="icon" title={t("panelStore.categories.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("panelStore.categories.create.title")}</CardTitle>
              <CardDescription>{t("panelStore.categories.create.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">{t("panelStore.categories.name")}</Label>
                <Input
                  id="category-name"
                  value={name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setName(nextName);
                    setSlug((current) => (current ? current : slugify(nextName)));
                  }}
                  placeholder={t("panelStore.categories.namePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-slug">{t("panelStore.categories.slug")}</Label>
                <Input
                  id="category-slug"
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder="hair-care"
                  className="text-start [direction:ltr]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-sort-order">{t("panelStore.categories.sortOrder")}</Label>
                <Input id="category-sort-order" type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>

              <div className="flex items-center justify-between rounded-[18px] border border-border/70 bg-background/35 px-4 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-bold">{t("panelStore.categories.showOnHome")}</div>
                  <div className="text-xs text-muted-foreground">{t("panelStore.categories.showOnHomeDescription")}</div>
                </div>
                <Switch checked={showOnHome} onCheckedChange={setShowOnHome} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-image">{t("panelStore.categories.image")}</Label>
                <Input
                  id="category-image"
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.avif,image/jpeg,image/png,image/gif,image/webp,image/avif"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setImageFile(file);
                    setImagePreview(file ? URL.createObjectURL(file) : "");
                  }}
                />
              </div>

              {imagePreview ? (
                <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/40">
                  <img src={imagePreview} alt={t("panelStore.categories.previewAlt")} className="h-48 w-full object-cover" />
                </div>
              ) : null}

              <Button
                className="w-full"
                disabled={!name.trim() || !slug.trim() || submitting}
                onClick={async () => {
                  setSubmitting(true);
                  const res = await api.store.createCategory({
                    name,
                    slug,
                    sortOrder: Number(sortOrder) || 0,
                    isActive: true,
                    showOnHome,
                    image: imageFile,
                  });
                  setSubmitting(false);
                  if (!res.success) {
                    toast({ variant: "destructive", title: t("common.error"), description: res.message });
                    return;
                  }
                  toast({ title: t("panelStore.categories.toast.created"), description: res.message });
                  resetCreateForm();
                  await loadItems();
                }}
              >
                {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
                {t("panelStore.categories.create.submit")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("panelStore.categories.list.title")}</CardTitle>
              <CardDescription>{t("panelStore.categories.list.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-52 items-center justify-center text-muted-foreground">
                  <Loader2 className="me-2 h-5 w-5 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : sortedItems.length === 0 ? (
                <div className="flex h-52 flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/70 bg-background/20 text-center">
                  <FolderKanban className="mb-3 h-10 w-10 text-primary/70" />
                  <div className="font-bold">{t("panelStore.categories.empty")}</div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {sortedItems.map((item) => (
                    <div key={item.id} className="overflow-hidden rounded-[2rem] border border-border/70 bg-background/30">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="h-44 w-full object-cover" />
                      ) : (
                        <div className="flex h-44 items-center justify-center bg-background/50 text-sm text-muted-foreground">{t("panelStore.categories.noImage")}</div>
                      )}
                      <div className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-bold">{item.name}</div>
                            <CodeText className="text-xs text-muted-foreground">{item.slug}</CodeText>
                            <div className="text-xs text-muted-foreground">{t("panelStore.categories.sortOrderValue", { value: format.number(item.sortOrder) })}</div>
                            <div className="text-xs text-muted-foreground">
                              {t("panelStore.categories.homeVisibility", {
                                value: item.showOnHome !== false ? t("panelStore.categories.visible") : t("panelStore.categories.hidden"),
                              })}
                            </div>
                          </div>
                          <div className={`rounded-full px-3 py-1 text-xs ${item.isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {item.isActive ? t("panelStore.categories.active") : t("panelStore.categories.inactive")}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              setEditItem(item);
                              setEditName(item.name);
                              setEditSlug(item.slug);
                              setEditSortOrder(String(item.sortOrder));
                              setEditActive(item.isActive);
                              setEditShowOnHome(item.showOnHome !== false);
                              setEditRemoveImage(false);
                              setEditImageFile(null);
                              setEditImagePreview(item.imageUrl || "");
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            {t("panelStore.categories.edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={deletingId === item.id}
                            onClick={() => setDeleteItem(item)}
                          >
                            {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-xl" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t("panelStore.categories.editTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category-name">{t("panelStore.categories.name")}</Label>
              <Input id="edit-category-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category-slug">{t("panelStore.categories.slug")}</Label>
              <Input
                id="edit-category-slug"
                value={editSlug}
                onChange={(e) => setEditSlug(slugify(e.target.value))}
                className="text-start [direction:ltr]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-category-sort-order">{t("panelStore.categories.sortOrder")}</Label>
                <Input id="edit-category-sort-order" type="number" min="0" value={editSortOrder} onChange={(e) => setEditSortOrder(e.target.value)} />
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-border/70 bg-background/35 px-4 py-3">
                <div className="text-sm font-bold">{editActive ? t("panelStore.categories.active") : t("panelStore.categories.inactive")}</div>
                <Switch checked={editActive} onCheckedChange={setEditActive} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[18px] border border-border/70 bg-background/35 px-4 py-3">
              <div className="space-y-1">
                <div className="text-sm font-bold">{t("panelStore.categories.showOnHome")}</div>
                <div className="text-xs text-muted-foreground">{t("panelStore.categories.editShowOnHomeDescription")}</div>
              </div>
              <Switch checked={editShowOnHome} onCheckedChange={setEditShowOnHome} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category-image">{t("panelStore.categories.image")}</Label>
              <Input
                id="edit-category-image"
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.avif,image/jpeg,image/png,image/gif,image/webp,image/avif"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setEditImageFile(file);
                  setEditImagePreview(file ? URL.createObjectURL(file) : editItem?.imageUrl || "");
                  if (file) {
                    setEditRemoveImage(false);
                  }
                }}
              />
            </div>

            {editImagePreview && !editRemoveImage ? (
              <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/40">
                <img src={editImagePreview} alt={t("panelStore.categories.previewAlt")} className="h-48 w-full object-cover" />
              </div>
            ) : null}

            {editItem?.imageUrl ? (
              <div className="flex items-center justify-between rounded-[18px] border border-border/70 bg-background/35 px-4 py-3">
                <div className="text-sm font-bold">{t("panelStore.categories.removeCurrentImage")}</div>
                <Switch checked={editRemoveImage} onCheckedChange={setEditRemoveImage} />
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                onClick={async () => {
                  if (!editItem) {
                    return;
                  }

                  setSubmitting(true);
                  const res = await api.store.updateCategory(editItem.id, {
                    name: editName,
                    slug: editSlug,
                    sortOrder: Number(editSortOrder) || 0,
                    isActive: editActive,
                    showOnHome: editShowOnHome,
                    image: editImageFile,
                    removeImage: editRemoveImage,
                  });
                  setSubmitting(false);

                  if (!res.success) {
                    toast({ variant: "destructive", title: t("common.error"), description: res.message });
                    return;
                  }

                  toast({ title: t("panelStore.categories.toast.updated"), description: res.message });
                  setEditItem(null);
                  await loadItems();
                }}
                disabled={!editName.trim() || !editSlug.trim() || submitting}
              >
                {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {t("panelStore.categories.saveChanges")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && deletingId === null && setDeleteItem(null)}>
        <AlertDialogContent dir={dir} className="rounded-[1.25rem] border-border bg-card text-start">
          <AlertDialogHeader className="items-stretch text-start sm:text-start">
            <AlertDialogTitle className="text-start">{t("panelStore.categories.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-start leading-7">
              {t("panelStore.categories.deleteDescription", { name: deleteItem?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start sm:space-x-0">
            <Button variant="destructive" onClick={handleDeleteCategory} disabled={!deleteItem || deletingId !== null}>
              {deletingId !== null ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />}
              {t("panelStore.categories.confirmDelete")}
            </Button>
            <AlertDialogCancel disabled={deletingId !== null} className="mt-0">
              {t("common.cancel")}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
