import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ImagePlus, Images, Loader2, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { GalleryImage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { TenantMeta } from "@/lib/types";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { useFormat, useLocale, useT } from "@/i18n/locale";

export default function PanelGalleryPage() {
  const { isAdmin, isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<GalleryImage[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [editItem, setEditItem] = useState<GalleryImage | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [editActive, setEditActive] = useState(true);
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const labels = getAudienceLabels(tenantMeta);

  useEffect(() => {
    if (!isPrimaryAdmin) {
      if (typeof window !== "undefined") {
        window.location.replace("/panel");
      }
      return;
    }
  }, [isPrimaryAdmin]);

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) {
        setTenantMeta(res.data);
      }
    });
  }, []);

  const loadGallery = async () => {
    setLoading(true);
    const res = await api.gallery.adminList();
    if (res.success) {
      setEnabled(res.data.enabled);
      setItems(res.data.items);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isPrimaryAdmin) {
      loadGallery();
    }
  }, [isPrimaryAdmin]);

  const resetForm = () => {
    setImageFile(null);
    setImagePreview("");
    setTitle("");
    setDescription("");
    setSortOrder("0");
  };

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder || (b.createdAt || "").localeCompare(a.createdAt || "")),
    [items],
  );

  if (!isPrimaryAdmin) {
    return null;
  }

  if (tenantMeta?.supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  return (
    <div className="panel-gallery-page min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("panelGallery.title")}</h1>
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

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>{t("panelGallery.settings.title")}</CardTitle>
                <CardDescription>
                  {t("panelGallery.settings.description")}
                </CardDescription>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={async (checked) => {
                  setEnabled(checked);
                  setSavingSettings(true);
                  const res = await api.gallery.updateSettings(checked);
                  setSavingSettings(false);
                  if (!res.success) {
                    setEnabled(!checked);
                    toast({ variant: "destructive", title: t("common.error"), description: res.message });
                    return;
                  }
                  toast({ title: t("panelGallery.toast.saved"), description: res.message });
                }}
              />
            </div>
            {savingSettings && <div className="text-xs text-muted-foreground">{t("common.saving")}</div>}
          </CardHeader>
        </Card>

        {enabled ? (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("panelGallery.add.title")}</CardTitle>
              <CardDescription>{t("panelGallery.add.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gallery-image">{t("panelGallery.form.image")}</Label>
                <Input
                  id="gallery-image"
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.avif,image/jpeg,image/png,image/gif,image/webp,image/avif"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setImageFile(file);
                    setImagePreview(file ? URL.createObjectURL(file) : "");
                  }}
                />
              </div>

              {imagePreview && (
                <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/40">
                  <img src={imagePreview} alt={t("panelGallery.form.previewAlt")} className="h-auto w-full object-cover" />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="gallery-title">{t("panelGallery.form.title")}</Label>
                <Input id="gallery-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("panelGallery.form.titlePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gallery-description">{t("panelGallery.form.description")}</Label>
                <Textarea
                  id="gallery-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("panelGallery.form.descriptionPlaceholder")}
                  className="min-h-28"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gallery-sort">{t("panelGallery.form.sortOrder")}</Label>
                <Input id="gallery-sort" type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>

              <Button
                className="panel-gallery-add-button w-full"
                disabled={!imageFile || submitting}
                onClick={async () => {
                  if (!imageFile) return;
                  setSubmitting(true);
                  const res = await api.gallery.create({
                    image: imageFile,
                    title,
                    description,
                    sortOrder: Number(sortOrder) || 0,
                    isActive: true,
                  });
                  setSubmitting(false);
                  if (!res.success) {
                    toast({ variant: "destructive", title: t("common.error"), description: res.message });
                    return;
                  }
                  toast({ title: t("panelGallery.toast.created"), description: res.message });
                  resetForm();
                  await loadGallery();
                }}
              >
                {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ImagePlus className="me-2 h-4 w-4" />}
                {t("panelGallery.add.submit")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("panelGallery.list.title")}</CardTitle>
              <CardDescription>{t("panelGallery.list.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-52 items-center justify-center text-muted-foreground">
                  <Loader2 className="me-2 h-5 w-5 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : sortedItems.length === 0 ? (
                <div className="flex h-52 flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/70 bg-background/20 text-center">
                  <Images className="mb-3 h-10 w-10 text-primary/70" />
                  <div className="font-bold">{t("panelGallery.list.empty")}</div>
                </div>
              ) : (
                <div className="columns-1 gap-4 sm:columns-2">
                  {sortedItems.map((item) => (
                    <div key={item.id} className="mb-4 break-inside-avoid overflow-hidden rounded-[2rem] border border-border/70 bg-background/30">
                      <img src={item.imageUrl} alt={item.title || t("panelGallery.imageAltFallback")} className="h-auto w-full object-cover" />
                      <div className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 text-start">
                            <div className="font-bold">{item.title || t("panelGallery.untitled")}</div>
                            <div className="text-xs text-muted-foreground">{t("panelGallery.sortOrderValue", { value: format.number(item.sortOrder) })}</div>
                          </div>
                          <div className={`rounded-full px-3 py-1 text-xs ${item.isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {item.isActive ? t("panelGallery.status.active") : t("panelGallery.status.inactive")}
                          </div>
                        </div>
                        {item.description && <p className="text-sm leading-7 text-muted-foreground whitespace-pre-wrap">{item.description}</p>}
                        <div className="flex items-center justify-between gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              setEditItem(item);
                              setEditTitle(item.title || "");
                              setEditDescription(item.description || "");
                              setEditSortOrder(String(item.sortOrder));
                              setEditActive(item.isActive);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            {t("panelGallery.actions.edit")}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-2"
                            disabled={deletingId === item.id}
                            onClick={async () => {
                              setDeletingId(item.id);
                              const res = await api.gallery.remove(item.id);
                              setDeletingId(null);
                              if (!res.success) {
                                toast({ variant: "destructive", title: t("common.error"), description: res.message });
                                return;
                              }
                              toast({ title: t("panelGallery.toast.deleted"), description: res.message });
                              await loadGallery();
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            {t("panelGallery.actions.delete")}
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
        ) : null}
      </main>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-xl" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t("panelGallery.edit.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editItem && <img src={editItem.imageUrl} alt={editItem.title || t("panelGallery.imageAltFallback")} className="max-h-72 w-full rounded-[1.5rem] object-cover" />}
            <div className="space-y-2">
              <Label>{t("panelGallery.form.title")}</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("panelGallery.form.description")}</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="min-h-28" />
            </div>
            <div className="space-y-2">
              <Label>{t("panelGallery.form.sortOrder")}</Label>
              <Input type="number" min="0" value={editSortOrder} onChange={(e) => setEditSortOrder(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/30 p-4">
              <div className="space-y-1">
                <div className="font-medium">{t("panelGallery.edit.visibleTitle")}</div>
                <div className="text-sm text-muted-foreground">{t("panelGallery.edit.visibleDescription")}</div>
              </div>
              <Switch checked={editActive} onCheckedChange={setEditActive} />
            </div>
            <Button
              className="w-full"
              onClick={async () => {
                if (!editItem) return;
                const res = await api.gallery.update(editItem.id, {
                  title: editTitle,
                  description: editDescription,
                  sortOrder: Number(editSortOrder) || 0,
                  isActive: editActive,
                });
                if (!res.success) {
                  toast({ variant: "destructive", title: t("common.error"), description: res.message });
                  return;
                }
                toast({ title: t("panelGallery.toast.saved"), description: res.message });
                setEditItem(null);
                await loadGallery();
              }}
            >
              {t("panelGallery.edit.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
