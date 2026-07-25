import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Crown, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { NutritionDietTemplateOption, NutritionDietTemplateParentOption, NutritionPackageItem } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-");
}

type Translator = ReturnType<typeof useT>;
type Formatter = ReturnType<typeof useFormat>;
type PackageFeatureRow = { icon: string; text: string };

const EMPTY_FEATURE_ROWS: PackageFeatureRow[] = Array.from({ length: 6 }, () => ({ icon: "clipboard", text: "" }));
const PACKAGE_FEATURE_ICON_OPTIONS = [
  { value: "clipboard", label: "برنامه" },
  { value: "user", label: "کاربر" },
  { value: "target", label: "هدف" },
  { value: "chart", label: "پیشرفت" },
  { value: "headphones", label: "پشتیبانی" },
  { value: "utensils", label: "غذا" },
  { value: "camera", label: "ثبت وعده" },
  { value: "apple", label: "ارزش غذایی" },
  { value: "shield", label: "سلامت" },
  { value: "sparkles", label: "ویژه" },
];

function normalizeFeatureRows(rows: PackageFeatureRow[]) {
  return rows.map((row) => ({ icon: row.icon || "clipboard", text: row.text.trim() })).filter((row) => row.text !== "");
}

function featureRowsFromItem(item?: NutritionPackageItem | null): PackageFeatureRow[] {
  const rows = (item?.features ?? []).map((feature) => ({ icon: feature.icon || "clipboard", text: feature.text || "" }));
  return [...rows, ...EMPTY_FEATURE_ROWS].slice(0, EMPTY_FEATURE_ROWS.length);
}

function formatTomans(value: number, t: Translator, format: Formatter) {
  return t("panelNutritionPackages.tomanAmount", { amount: format.number(Math.max(0, value)) });
}

function formatDuration(days: number, t: Translator, format: Formatter) {
  if (days % 30 === 0) {
    const months = days / 30;
    return months === 1
      ? t("panelNutritionPackages.duration.oneMonth")
      : t("panelNutritionPackages.duration.months", { count: format.number(months) });
  }

  return t("panelNutritionPackages.duration.days", { count: format.number(days) });
}

export default function PanelNutritionPackagesPage() {
  const { isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl, locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [items, setItems] = useState<NutritionPackageItem[]>([]);
  const [parentOptions, setParentOptions] = useState<NutritionDietTemplateParentOption[]>([]);
  const [goalOptions, setGoalOptions] = useState<NutritionDietTemplateOption[]>([]);

  const [name, setName] = useState("");
  const [shortTitle, setShortTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [featureRows, setFeatureRows] = useState<PackageFeatureRow[]>(featureRowsFromItem());
  const [onlineDietCount, setOnlineDietCount] = useState("0");
  const [offlineDietCount, setOfflineDietCount] = useState("0");
  const [durationDays, setDurationDays] = useState("30");
  const [priceAmount, setPriceAmount] = useState("0");
  const [discountedPriceAmount, setDiscountedPriceAmount] = useState("");
  const [badgeTitle, setBadgeTitle] = useState("");
  const [isRecommended, setIsRecommended] = useState(false);
  const [visualStyle, setVisualStyle] = useState("normal");
  const [actionLabel, setActionLabel] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [applicableGoals, setApplicableGoals] = useState<string[]>([]);

  const [editItem, setEditItem] = useState<NutritionPackageItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editShortTitle, setEditShortTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFeatureRows, setEditFeatureRows] = useState<PackageFeatureRow[]>(featureRowsFromItem());
  const [editOnlineDietCount, setEditOnlineDietCount] = useState("0");
  const [editOfflineDietCount, setEditOfflineDietCount] = useState("0");
  const [editDurationDays, setEditDurationDays] = useState("30");
  const [editPriceAmount, setEditPriceAmount] = useState("0");
  const [editDiscountedPriceAmount, setEditDiscountedPriceAmount] = useState("");
  const [editBadgeTitle, setEditBadgeTitle] = useState("");
  const [editIsRecommended, setEditIsRecommended] = useState(false);
  const [editVisualStyle, setEditVisualStyle] = useState("normal");
  const [editActionLabel, setEditActionLabel] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState("");
  const [editRemoveImage, setEditRemoveImage] = useState(false);
  const [editParentId, setEditParentId] = useState<string>("none");
  const [editApplicableGoals, setEditApplicableGoals] = useState<string[]>([]);

  const loadItems = async () => {
    setLoading(true);
    const res = await api.nutritionPackages.list();
    if (res.success) {
      setItems(res.data.items);
      setParentOptions(res.data.parentOptions ?? []);
      setGoalOptions(res.data.goalOptions ?? []);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isLoading || !isAdmin) {
      return;
    }

    void loadItems();
  }, [isAdmin, isLoading]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, locale)),
    [items, locale],
  );

  const resetCreateForm = () => {
    setName("");
    setShortTitle("");
    setSubtitle("");
    setSlug("");
    setDescription("");
    setFeatureRows(featureRowsFromItem());
    setOnlineDietCount("0");
    setOfflineDietCount("0");
    setDurationDays("30");
    setPriceAmount("0");
    setDiscountedPriceAmount("");
    setBadgeTitle("");
    setIsRecommended(false);
    setVisualStyle("normal");
    setActionLabel("");
    setSortOrder("0");
    setIsActive(true);
    setImageFile(null);
    setImagePreview("");
    setParentId("none");
    setApplicableGoals([]);
  };

  const availableParentOptions = useMemo(
    () => parentOptions.filter((option) => option.canHaveChild),
    [parentOptions],
  );

  const availableEditParentOptions = useMemo(() => {
    if (!editItem) {
      return [];
    }

    return parentOptions.filter((option) => option.id !== editItem.id && option.canHaveChild);
  }, [editItem, parentOptions]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("panelNutritionPackages.loading")}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelNutritionPackages.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelNutritionPackages.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelNutritionPackages.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("panelNutritionPackages.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("panelNutritionPackages.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("panelNutritionPackages.create.title")}</CardTitle>
              <CardDescription>{t("panelNutritionPackages.create.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="package-name">{t("panelNutritionPackages.fields.name")}</Label>
                <Input
                  id="package-name"
                  value={name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setName(nextName);
                    setSlug((current) => (current ? current : slugify(nextName)));
                  }}
                  placeholder={t("panelNutritionPackages.fields.namePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="package-slug">{t("panelNutritionPackages.fields.slug")}</Label>
                <Input
                  id="package-slug"
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder="diamond-package"
                  className="text-start [direction:ltr]"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="package-short-title">{t("panelNutritionPackages.fields.shortTitle")}</Label>
                  <Input id="package-short-title" value={shortTitle} onChange={(e) => setShortTitle(e.target.value)} placeholder={t("panelNutritionPackages.optional")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="package-subtitle">{t("panelNutritionPackages.fields.subtitle")}</Label>
                  <Input id="package-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder={t("panelNutritionPackages.optional")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="package-description">{t("panelNutritionPackages.fields.description")}</Label>
                <Textarea
                  id="package-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t("panelNutritionPackages.fields.descriptionPlaceholder")}
                  className="min-h-32 resize-y leading-7"
                />
                <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.descriptionHint")}</div>
              </div>

              <PackageFeatureEditor rows={featureRows} onChange={setFeatureRows} t={t} />

              <div className="space-y-2">
                <Label>{t("panelNutritionPackages.fields.parent")}</Label>
                <select
                  value={parentId}
                  onChange={(event) => setParentId(event.target.value)}
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="none">{t("panelNutritionPackages.noParent")}</option>
                  {availableParentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {`${"— ".repeat(option.depth ?? 0)}${option.name}`}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.parentDepthHint")}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="package-image">{t("panelNutritionPackages.fields.image")}</Label>
                <Input
                  id="package-image"
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
                  <img src={imagePreview} alt={t("panelNutritionPackages.previewAlt")} className="h-48 w-full object-cover" />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>{t("panelNutritionPackages.fields.goals")}</Label>
                <div className="grid gap-2">
                  {goalOptions.map((goal) => {
                    const active = applicableGoals.includes(goal.value);
                    return (
                      <button
                        key={goal.value}
                        type="button"
                        onClick={() => setApplicableGoals((current) => active ? current.filter((item) => item !== goal.value) : [...current, goal.value])}
                        className={`rounded-2xl border px-4 py-3 text-start text-sm font-bold transition ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/70 bg-background/40 text-foreground hover:bg-background/70"}`}
                      >
                        {goal.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="package-online-count">{t("panelNutritionPackages.fields.onlineDietCount")}</Label>
                  <Input id="package-online-count" type="number" min="0" value={onlineDietCount} onChange={(e) => setOnlineDietCount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="package-offline-count">{t("panelNutritionPackages.fields.offlineDietCount")}</Label>
                  <Input id="package-offline-count" type="number" min="0" value={offlineDietCount} onChange={(e) => setOfflineDietCount(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="package-duration">{t("panelNutritionPackages.fields.durationDays")}</Label>
                  <Input id="package-duration" type="number" min="1" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="package-sort">{t("panelNutritionPackages.fields.sortOrder")}</Label>
                  <Input id="package-sort" type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="package-price">{t("panelNutritionPackages.fields.price")}</Label>
                  <Input id="package-price" type="number" min="0" value={priceAmount} onChange={(e) => setPriceAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="package-discounted-price">{t("panelNutritionPackages.fields.discountedPrice")}</Label>
                  <Input id="package-discounted-price" type="number" min="0" value={discountedPriceAmount} onChange={(e) => setDiscountedPriceAmount(e.target.value)} placeholder={t("panelNutritionPackages.optional")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="package-badge-title">{t("panelNutritionPackages.fields.badgeTitle")}</Label>
                <Input
                  id="package-badge-title"
                  value={badgeTitle}
                  onChange={(e) => setBadgeTitle(e.target.value)}
                  placeholder={t("panelNutritionPackages.fields.badgePlaceholder")}
                />
                <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.badgeHint")}</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="package-visual-style">{t("panelNutritionPackages.fields.visualStyle")}</Label>
                  <select id="package-visual-style" value={visualStyle} onChange={(event) => setVisualStyle(event.target.value)} className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                    <option value="normal">{t("panelNutritionPackages.visualStyle.normal")}</option>
                    <option value="gold">{t("panelNutritionPackages.visualStyle.gold")}</option>
                    <option value="vip">{t("panelNutritionPackages.visualStyle.vip")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="package-action-label">{t("panelNutritionPackages.fields.actionLabel")}</Label>
                  <Input id="package-action-label" value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} placeholder={t("panelNutritionPackages.optional")} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/30 px-4 py-3">
                <div>
                  <div className="font-bold">{t("panelNutritionPackages.fields.recommended")}</div>
                  <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.recommendedHint")}</div>
                </div>
                <Switch checked={isRecommended} onCheckedChange={setIsRecommended} />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/30 px-4 py-3">
                <div>
                  <div className="font-bold">{t("panelNutritionPackages.fields.active")}</div>
                  <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.create.activeHint")}</div>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <Button
                className="w-full"
                disabled={!name.trim() || Number(durationDays) <= 0 || applicableGoals.length === 0 || submitting}
                onClick={async () => {
                  setSubmitting(true);
                  const res = await api.nutritionPackages.create({
                    name,
                    shortTitle: shortTitle.trim() || null,
                    subtitle: subtitle.trim() || null,
                    slug,
                    description: description.trim() || null,
                    features: normalizeFeatureRows(featureRows),
                    image: imageFile,
                    parentId: parentId === "none" ? null : parentId,
                    applicableGoals,
                    onlineDietCount: Number(onlineDietCount) || 0,
                    offlineDietCount: Number(offlineDietCount) || 0,
                    durationDays: Number(durationDays) || 30,
                    priceAmount: Number(priceAmount) || 0,
                    discountedPriceAmount: discountedPriceAmount.trim() === "" ? null : Number(discountedPriceAmount) || 0,
                    badgeTitle: badgeTitle.trim() || null,
                    isRecommended,
                    visualStyle,
                    actionLabel: actionLabel.trim() || null,
                    sortOrder: Number(sortOrder) || 0,
                    isActive,
                  });
                  setSubmitting(false);
                  if (!res.success) {
                    toast({ variant: "destructive", title: t("common.error"), description: res.message });
                    return;
                  }
                  toast({ title: t("panelNutritionPackages.toast.created"), description: res.message });
                  resetCreateForm();
                  await loadItems();
                }}
              >
                {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
                {t("panelNutritionPackages.create.submit")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("panelNutritionPackages.list.title")}</CardTitle>
              <CardDescription>{t("panelNutritionPackages.list.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-52 items-center justify-center text-muted-foreground">
                  <Loader2 className="me-2 h-5 w-5 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : sortedItems.length === 0 ? (
                <div className="flex h-52 flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/70 bg-background/20 text-center">
                  <Crown className="mb-3 h-10 w-10 text-primary/70" />
                  <div className="font-bold">{t("panelNutritionPackages.list.empty")}</div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {sortedItems.map((item) => (
                    <PackageAdminCard
                      key={item.id}
                      item={item}
                      deletingId={deletingId}
                      t={t}
                      format={format}
                      onEdit={(selected) => {
                        setEditItem(selected);
                        setEditName(selected.name);
                        setEditShortTitle(selected.shortTitle ?? "");
                        setEditSubtitle(selected.subtitle ?? "");
                        setEditSlug(selected.slug);
                        setEditDescription(selected.description ?? "");
                        setEditFeatureRows(featureRowsFromItem(selected));
                        setEditOnlineDietCount(String(selected.onlineDietCount));
                        setEditOfflineDietCount(String(selected.offlineDietCount));
                        setEditDurationDays(String(selected.durationDays));
                        setEditPriceAmount(String(selected.priceAmount));
                        setEditDiscountedPriceAmount(selected.discountedPriceAmount !== null && selected.discountedPriceAmount !== undefined ? String(selected.discountedPriceAmount) : "");
                        setEditBadgeTitle(selected.badgeTitle ?? "");
                        setEditIsRecommended(Boolean(selected.isRecommended));
                        setEditVisualStyle(selected.visualStyle ?? "normal");
                        setEditActionLabel(selected.actionLabel ?? "");
                        setEditSortOrder(String(selected.sortOrder));
                        setEditIsActive(selected.isActive);
                        setEditImageFile(null);
                        setEditImagePreview(selected.imageUrl ?? "");
                        setEditRemoveImage(false);
                        setEditParentId(selected.parentId ?? "none");
                        setEditApplicableGoals(selected.applicableGoals ?? []);
                      }}
                      onDelete={async (selected) => {
                        setDeletingId(selected.id);
                        const res = await api.nutritionPackages.delete(selected.id);
                        setDeletingId(null);
                        if (!res.success) {
                          toast({ variant: "destructive", title: t("common.error"), description: res.message });
                          return;
                        }
                        toast({ title: t("panelNutritionPackages.toast.deleted"), description: res.message });
                        await loadItems();
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl" dir={dir}>
          <DialogHeader className="shrink-0">
            <DialogTitle>{t("panelNutritionPackages.edit.title")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>{t("panelNutritionPackages.fields.name")}</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("panelNutritionPackages.fields.slug")}</Label>
              <Input value={editSlug} onChange={(e) => setEditSlug(slugify(e.target.value))} className="text-start [direction:ltr]" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("panelNutritionPackages.fields.shortTitle")}</Label>
                <Input value={editShortTitle} onChange={(e) => setEditShortTitle(e.target.value)} placeholder={t("panelNutritionPackages.optional")} />
              </div>
              <div className="space-y-2">
                <Label>{t("panelNutritionPackages.fields.subtitle")}</Label>
                <Input value={editSubtitle} onChange={(e) => setEditSubtitle(e.target.value)} placeholder={t("panelNutritionPackages.optional")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("panelNutritionPackages.fields.description")}</Label>
              <Textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                placeholder={t("panelNutritionPackages.fields.descriptionPlaceholder")}
                className="min-h-32 resize-y leading-7"
              />
              <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.descriptionHint")}</div>
            </div>
            <PackageFeatureEditor rows={editFeatureRows} onChange={setEditFeatureRows} t={t} />
            <div className="space-y-2">
              <Label>{t("panelNutritionPackages.fields.parent")}</Label>
              <select
                value={editParentId}
                onChange={(event) => setEditParentId(event.target.value)}
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="none">{t("panelNutritionPackages.noParent")}</option>
                {availableEditParentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {`${"— ".repeat(option.depth ?? 0)}${option.name}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("panelNutritionPackages.fields.image")}</Label>
              <Input
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.avif,image/jpeg,image/png,image/gif,image/webp,image/avif"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setEditImageFile(file);
                  setEditImagePreview(file ? URL.createObjectURL(file) : (editItem?.imageUrl ?? ""));
                  if (file) {
                    setEditRemoveImage(false);
                  }
                }}
              />
              {editImagePreview ? (
                <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/40">
                  <img src={editImagePreview} alt={t("panelNutritionPackages.previewAlt")} className="h-44 w-full object-cover" />
                </div>
              ) : null}
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/30 px-4 py-3">
                <div>
                  <div className="font-bold">{t("panelNutritionPackages.edit.removeImage")}</div>
                  <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.edit.removeImageHint")}</div>
                </div>
                <Switch
                  checked={editRemoveImage}
                  onCheckedChange={(checked) => {
                    setEditRemoveImage(checked);
                    if (checked) {
                      setEditImageFile(null);
                      setEditImagePreview("");
                    } else {
                      setEditImagePreview(editItem?.imageUrl ?? "");
                    }
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("panelNutritionPackages.fields.goals")}</Label>
              <div className="grid gap-2">
                {goalOptions.map((goal) => {
                  const active = editApplicableGoals.includes(goal.value);
                  return (
                    <button
                      key={goal.value}
                      type="button"
                      onClick={() => setEditApplicableGoals((current) => active ? current.filter((item) => item !== goal.value) : [...current, goal.value])}
                      className={`rounded-2xl border px-4 py-3 text-start text-sm font-bold transition ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/70 bg-background/40 text-foreground hover:bg-background/70"}`}
                    >
                      {goal.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("panelNutritionPackages.fields.onlineDietCount")}</Label>
                <Input type="number" min="0" value={editOnlineDietCount} onChange={(e) => setEditOnlineDietCount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("panelNutritionPackages.fields.offlineDietCount")}</Label>
                <Input type="number" min="0" value={editOfflineDietCount} onChange={(e) => setEditOfflineDietCount(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("panelNutritionPackages.fields.durationDays")}</Label>
                <Input type="number" min="1" value={editDurationDays} onChange={(e) => setEditDurationDays(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("panelNutritionPackages.fields.sortOrder")}</Label>
                <Input type="number" min="0" value={editSortOrder} onChange={(e) => setEditSortOrder(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("panelNutritionPackages.fields.price")}</Label>
                <Input type="number" min="0" value={editPriceAmount} onChange={(e) => setEditPriceAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("panelNutritionPackages.fields.discountedPrice")}</Label>
                <Input type="number" min="0" value={editDiscountedPriceAmount} onChange={(e) => setEditDiscountedPriceAmount(e.target.value)} placeholder={t("panelNutritionPackages.optional")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("panelNutritionPackages.fields.badgeTitle")}</Label>
              <Input
                value={editBadgeTitle}
                onChange={(e) => setEditBadgeTitle(e.target.value)}
                placeholder={t("panelNutritionPackages.fields.badgePlaceholder")}
              />
              <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.badgeHint")}</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("panelNutritionPackages.fields.visualStyle")}</Label>
                <select value={editVisualStyle} onChange={(event) => setEditVisualStyle(event.target.value)} className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                  <option value="normal">{t("panelNutritionPackages.visualStyle.normal")}</option>
                  <option value="gold">{t("panelNutritionPackages.visualStyle.gold")}</option>
                  <option value="vip">{t("panelNutritionPackages.visualStyle.vip")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("panelNutritionPackages.fields.actionLabel")}</Label>
                <Input value={editActionLabel} onChange={(e) => setEditActionLabel(e.target.value)} placeholder={t("panelNutritionPackages.optional")} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/30 px-4 py-3">
              <div>
                <div className="font-bold">{t("panelNutritionPackages.fields.recommended")}</div>
                <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.recommendedHint")}</div>
              </div>
              <Switch checked={editIsRecommended} onCheckedChange={setEditIsRecommended} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/30 px-4 py-3">
              <div>
                <div className="font-bold">{t("panelNutritionPackages.fields.active")}</div>
                <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.edit.activeHint")}</div>
              </div>
              <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
            </div>
            <Button
              disabled={!editName.trim() || Number(editDurationDays) <= 0 || editApplicableGoals.length === 0}
              onClick={async () => {
                if (!editItem) return;
                const res = await api.nutritionPackages.update(editItem.id, {
                  name: editName,
                  shortTitle: editShortTitle.trim() || null,
                  subtitle: editSubtitle.trim() || null,
                  slug: editSlug,
                  description: editDescription.trim() || null,
                  features: normalizeFeatureRows(editFeatureRows),
                  image: editImageFile,
                  removeImage: editRemoveImage,
                  parentId: editParentId === "none" ? null : editParentId,
                  applicableGoals: editApplicableGoals,
                  onlineDietCount: Number(editOnlineDietCount) || 0,
                  offlineDietCount: Number(editOfflineDietCount) || 0,
                  durationDays: Number(editDurationDays) || 30,
                  priceAmount: Number(editPriceAmount) || 0,
                  discountedPriceAmount: editDiscountedPriceAmount.trim() === "" ? null : Number(editDiscountedPriceAmount) || 0,
                  badgeTitle: editBadgeTitle.trim() || null,
                  isRecommended: editIsRecommended,
                  visualStyle: editVisualStyle,
                  actionLabel: editActionLabel.trim() || null,
                  sortOrder: Number(editSortOrder) || 0,
                  isActive: editIsActive,
                });
                if (!res.success) {
                  toast({ variant: "destructive", title: t("common.error"), description: res.message });
                  return;
                }
                toast({ title: t("panelNutritionPackages.toast.saved"), description: res.message });
                setEditItem(null);
                await loadItems();
              }}
            >
              {t("panelNutritionPackages.edit.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PackageFeatureEditor({ rows, onChange, t }: { rows: PackageFeatureRow[]; onChange: (rows: PackageFeatureRow[]) => void; t: Translator }) {
  const updateRow = (index: number, patch: Partial<PackageFeatureRow>) => {
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-background/25 p-4">
      <div>
        <Label>{t("panelNutritionPackages.fields.features")}</Label>
        <div className="mt-1 text-xs text-muted-foreground">{t("panelNutritionPackages.featuresHint")}</div>
      </div>
      <div className="grid gap-3">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)]">
            <select value={row.icon} onChange={(event) => updateRow(index, { icon: event.target.value })} className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
              {PACKAGE_FEATURE_ICON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Input value={row.text} onChange={(event) => updateRow(index, { text: event.target.value })} placeholder={t("panelNutritionPackages.fields.featurePlaceholder")} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PackageAdminCard({
  item,
  deletingId,
  t,
  format,
  onEdit,
  onDelete,
}: {
  item: NutritionPackageItem;
  deletingId: string | null;
  t: Translator;
  format: Formatter;
  onEdit: (item: NutritionPackageItem) => void;
  onDelete: (item: NutritionPackageItem) => Promise<void>;
}) {
  return (
    <>
      <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-background/30">
        <div className="space-y-4 p-5">
          {item.imageUrl ? (
            <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/40">
              <img src={item.imageUrl} alt={item.name} className="h-44 w-full object-cover" />
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-lg font-black">{item.name}</div>
                <Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? t("panelNutritionPackages.status.active") : t("panelNutritionPackages.status.inactive")}</Badge>
                <Badge variant="outline">{formatDuration(item.durationDays, t, format)}</Badge>
                {item.badgeTitle ? <Badge variant="outline">{item.badgeTitle}</Badge> : null}
                {item.isRecommended ? <Badge variant="outline">{t("panelNutritionPackages.fields.recommended")}</Badge> : null}
                {item.visualStyle && item.visualStyle !== "normal" ? <Badge variant="outline">{t(`panelNutritionPackages.visualStyle.${item.visualStyle}` as any)}</Badge> : null}
                {(item.depth ?? 0) > 0 ? <Badge variant="outline">{t("panelNutritionPackages.card.childLevel", { level: format.number(item.depth ?? 0) })}</Badge> : null}
              </div>
              {item.shortTitle || item.subtitle ? (
                <div className="text-sm font-bold text-muted-foreground">{[item.shortTitle, item.subtitle].filter(Boolean).join(" - ")}</div>
              ) : null}
              <div className="text-xs text-muted-foreground text-start [direction:ltr]">{item.slug}</div>
              {item.description ? (
                <div className="line-clamp-2 text-sm leading-6 text-muted-foreground">{item.description}</div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {(item.applicableGoalLabels ?? []).map((goal) => (
                  <Badge key={goal} variant="outline">{goal}</Badge>
                ))}
              </div>
              {(item.features ?? []).length > 0 ? (
                <div className="grid gap-1.5 text-xs text-muted-foreground">
                  {(item.features ?? []).slice(0, 4).map((feature, index) => (
                    <div key={`${feature.icon}-${index}`}>{feature.text}</div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => onEdit(item)}>
                <Pencil className="h-4 w-4" />
                {t("panelNutritionPackages.actions.edit")}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={deletingId === item.id}
                aria-label={t("panelNutritionPackages.actions.delete")}
                onClick={() => void onDelete(item)}
              >
                {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.card.onlineDiet")}</div>
              <div className="mt-2 text-2xl font-black text-primary">{format.number(item.onlineDietCount)}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.card.offlineDiet")}</div>
              <div className="mt-2 text-2xl font-black text-primary">{format.number(item.offlineDietCount)}</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.fields.price")}</div>
              <div className="mt-2 text-lg font-black">{formatTomans(item.priceAmount, t, format)}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.fields.discountedPrice")}</div>
              <div className="mt-2 text-lg font-black text-primary">{item.discountedPriceAmount ? formatTomans(item.discountedPriceAmount, t, format) : t("panelNutritionPackages.noDiscount")}</div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">{t("panelNutritionPackages.card.sortOrder", { value: format.number(item.sortOrder) })}</div>
        </div>
      </div>

      {(item.children ?? []).map((child) => (
        <div key={child.id} className="md:ms-8">
          <PackageAdminCard item={child} deletingId={deletingId} t={t} format={format} onEdit={onEdit} onDelete={onDelete} />
        </div>
      ))}
    </>
  );
}
