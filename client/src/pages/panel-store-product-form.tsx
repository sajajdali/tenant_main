import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowRight, Loader2, Save, Star, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import type { StoreCategoryItem, StoreProductItem, StoreProductReviewItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useFormat, useLocale, useT } from "@/i18n/locale";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-");
}

function parseAmount(value: string) {
  const normalized = value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^\d]/g, "");
  return Number(normalized || "0");
}

function createClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface SelectedGalleryImage {
  id: string;
  file: File;
  preview: string;
}

export default function PanelStoreProductFormPage() {
  const { isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const { dir, isRtl } = useLocale();
  const format = useFormat();
  const t = useT();
  const [, setLocation] = useLocation();
  const [, editParams] = useRoute("/panel/store-settings/products/:productId/edit");
  const productId = editParams?.productId ?? null;
  const isEditMode = Boolean(productId);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<StoreCategoryItem[]>([]);
  const [sourceItem, setSourceItem] = useState<StoreProductItem | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [discountedPriceAmount, setDiscountedPriceAmount] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isBestseller, setIsBestseller] = useState(false);
  const [isPopular, setIsPopular] = useState(false);
  const [reviewsEnabled, setReviewsEnabled] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [galleryImages, setGalleryImages] = useState<SelectedGalleryImage[]>([]);
  const [existingGalleryImages, setExistingGalleryImages] = useState<Array<{ id: string; url: string }>>([]);

  const [reviews, setReviews] = useState<StoreProductReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewReplies, setReviewReplies] = useState<Record<string, string>>({});
  const [moderatingReviewId, setModeratingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  const activeCategories = useMemo(() => categories.filter((item) => item.isActive), [categories]);

  useEffect(() => {
    if (!isPrimaryAdmin) {
      return;
    }

    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      const [categoriesRes, productsRes] = await Promise.all([api.store.listCategories(), isEditMode ? api.store.listProducts() : Promise.resolve(null)]);

      if (cancelled) {
        return;
      }

      if (categoriesRes.success) {
        setCategories(categoriesRes.data.items);
      } else {
        toast({ variant: "destructive", title: t("common.error"), description: categoriesRes.message || t("panelStoreProductForm.toast.categoriesFailed") });
      }

      if (isEditMode && productsRes) {
        if (!productsRes.success) {
          toast({ variant: "destructive", title: t("common.error"), description: productsRes.message || t("panelStoreProductForm.toast.productsFailed") });
        } else {
          const found = productsRes.data.items.find((item) => item.id === productId) ?? null;
          setSourceItem(found);
          if (!found) {
            toast({ variant: "destructive", title: t("common.error"), description: t("panelStoreProductForm.notFound.title") });
          } else {
            setCategoryId(found.categoryId || "");
            setTitle(found.title);
            setSlug(found.slug);
            setSubtitle(found.subtitle || "");
            setDescription(found.description || "");
            setPriceAmount(String(found.priceAmount || 0));
            setDiscountedPriceAmount(found.discountedPriceAmount ? String(found.discountedPriceAmount) : "");
            setStockQuantity(String(found.stockQuantity || 0));
            setSortOrder(String(found.sortOrder || 0));
            setIsActive(found.isActive);
            setIsFeatured(found.isFeatured);
            setIsBestseller(found.isBestseller);
            setIsPopular(found.isPopular);
            setReviewsEnabled(found.reviewsEnabled);
            setImagePreview(found.imageUrl || "");
            setExistingGalleryImages(found.galleryImages || []);
          }
        }
      }

      setLoading(false);
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, isPrimaryAdmin, productId, t, toast]);

  useEffect(() => {
    if (!isEditMode || !productId) {
      return;
    }

    setReviewsLoading(true);
    api.store.listProductReviews(productId).then((res) => {
      if (res.success) {
        setReviews(res.data.items);
        setReviewReplies(Object.fromEntries(res.data.items.map((item) => [item.id, item.adminReply || ""])));
      } else {
        setReviews([]);
        setReviewReplies({});
        toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelStoreProductForm.toast.reviewsFailed") });
      }
      setReviewsLoading(false);
    });
  }, [isEditMode, productId, t, toast]);

  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelStoreProductForm.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelStoreProductForm.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelStoreProductForm.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const addGalleryImage = (file: File | null) => {
    if (!file) {
      return;
    }

    setGalleryImages((current) => [
      ...current,
      {
        id: createClientId(),
        file,
        preview: URL.createObjectURL(file),
      },
    ]);
  };

  const removeGalleryImage = (id: string) => {
    setGalleryImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.preview);
      }

      return current.filter((item) => item.id !== id);
    });
  };

  const handleSubmit = async () => {
    const price = parseAmount(priceAmount);
    const discounted = discountedPriceAmount.trim() ? parseAmount(discountedPriceAmount) : null;

    if (discounted !== null && discounted > price) {
      toast({ variant: "destructive", title: t("common.error"), description: t("panelStoreProductForm.validation.discountTooHigh") });
      return;
    }

    setSubmitting(true);
    const payload = {
      storeCategoryId: categoryId || null,
      title,
      slug,
      subtitle,
      description,
      priceAmount: price,
      discountedPriceAmount: discounted,
      stockQuantity: Number(stockQuantity) || 0,
      sortOrder: Number(sortOrder) || 0,
      isActive,
      isFeatured,
      isBestseller,
      isPopular,
      reviewsEnabled,
      image: imageFile,
      galleryImages: galleryImages.map((item) => item.file),
    };
    const res = isEditMode && productId
      ? await api.store.updateProduct(productId, {
          ...payload,
          retainedGalleryIds: existingGalleryImages.map((item) => item.id),
          removeImage,
        })
      : await api.store.createProduct(payload);
    setSubmitting(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelStoreProductForm.toast.saveFailed") });
      return;
    }

    toast({ title: isEditMode ? t("panelStoreProductForm.toast.updated") : t("panelStoreProductForm.toast.created"), description: res.message });
    setLocation("/panel/store-settings/products");
  };

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1 text-start">
            <h1 className="text-xl font-bold">{isEditMode ? t("panelStoreProductForm.title.edit") : t("panelStoreProductForm.title.create")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelStoreProductForm.description")}</p>
          </div>
          <Link href="/panel/store-settings/products">
            <Button variant="outline" size="icon" title={t("common.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        {loading ? (
          <Card className="border-border/70 bg-card/60">
            <CardContent className="flex h-72 items-center justify-center text-muted-foreground">
              <Loader2 className="me-2 h-5 w-5 animate-spin" />
              {t("common.loading")}
            </CardContent>
          </Card>
        ) : isEditMode && !sourceItem ? (
          <Card className="border-border/70 bg-card/60">
            <CardContent className="space-y-4 py-10 text-center">
              <div className="text-lg font-bold">{t("panelStoreProductForm.notFound.title")}</div>
              <Link href="/panel/store-settings/products">
                <Button>{t("panelStoreProductForm.notFound.backToList")}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle>{t("panelStoreProductForm.basic.title")}</CardTitle>
                <CardDescription>{t("panelStoreProductForm.basic.description")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-category">{t("panelStoreProductForm.fields.category")}</Label>
                  <select
                    id="product-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-start"
                  >
                    <option value="">{t("panelStoreProductForm.category.none")}</option>
                    {activeCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-title">{t("panelStoreProductForm.fields.title")}</Label>
                  <Input
                    id="product-title"
                    value={title}
                    onChange={(e) => {
                      const nextTitle = e.target.value;
                      setTitle(nextTitle);
                      setSlug((current) => (current ? current : slugify(nextTitle)));
                    }}
                    placeholder={t("panelStoreProductForm.placeholders.title")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-slug">{t("panelStoreProductForm.fields.slug")}</Label>
                  <Input id="product-slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className="text-start [direction:ltr]" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-subtitle">{t("panelStoreProductForm.fields.subtitle")}</Label>
                  <Input id="product-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="product-description">{t("panelStoreProductForm.fields.description")}</Label>
                  <Textarea id="product-description" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-36" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle>{t("panelStoreProductForm.pricing.title")}</CardTitle>
                <CardDescription>{t("panelStoreProductForm.pricing.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="product-price">{t("panelStoreProductForm.fields.price")}</Label>
                    <Input id="product-price" value={priceAmount} onChange={(e) => setPriceAmount(e.target.value)} placeholder={t("panelStoreProductForm.placeholders.price")} inputMode="numeric" className="text-start [direction:ltr]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-discounted-price">{t("panelStoreProductForm.fields.discountedPrice")}</Label>
                    <Input id="product-discounted-price" value={discountedPriceAmount} onChange={(e) => setDiscountedPriceAmount(e.target.value)} inputMode="numeric" className="text-start [direction:ltr]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-stock">{t("panelStoreProductForm.fields.stock")}</Label>
                    <Input id="product-stock" type="number" min="0" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} className="text-start [direction:ltr]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-sort-order">{t("panelStoreProductForm.fields.sortOrder")}</Label>
                    <Input id="product-sort-order" type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="text-start [direction:ltr]" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    [t("panelStoreProductForm.switches.active"), isActive, setIsActive],
                    [t("panelStoreProductForm.switches.featured"), isFeatured, setIsFeatured],
                    [t("panelStoreProductForm.switches.bestseller"), isBestseller, setIsBestseller],
                    [t("panelStoreProductForm.switches.popular"), isPopular, setIsPopular],
                    [t("panelStoreProductForm.switches.reviews"), reviewsEnabled, setReviewsEnabled],
                  ].map(([label, checked, onChange]) => (
                    <div key={String(label)} className="flex items-center justify-between rounded-[18px] border border-border/70 bg-background/35 px-4 py-3">
                      <div className="text-sm font-bold">{String(label)}</div>
                      <Switch checked={Boolean(checked)} onCheckedChange={onChange as (value: boolean) => void} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle>{t("panelStoreProductForm.images.title")}</CardTitle>
                <CardDescription>{t("panelStoreProductForm.images.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="product-image">{t("panelStoreProductForm.fields.mainImage")}</Label>
                    <Input
                      id="product-image"
                      type="file"
                      accept=".jpg,.jpeg,.png,.gif,.webp,.avif,image/jpeg,image/png,image/gif,image/webp,image/avif"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setImageFile(file);
                        setImagePreview(file ? URL.createObjectURL(file) : sourceItem?.imageUrl || "");
                        if (file) {
                          setRemoveImage(false);
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-gallery">{t("panelStoreProductForm.fields.gallery")}</Label>
                    <Input
                      id="product-gallery"
                      type="file"
                      accept=".jpg,.jpeg,.png,.gif,.webp,.avif,image/jpeg,image/png,image/gif,image/webp,image/avif"
                      onChange={(event) => {
                        addGalleryImage(event.target.files?.[0] || null);
                        event.target.value = "";
                      }}
                    />
                  </div>
                </div>

                {imagePreview && !removeImage ? (
                  <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/40">
                    <img src={imagePreview} alt={t("panelStoreProductForm.images.previewAlt")} className="h-56 w-full object-cover" />
                  </div>
                ) : null}

                {sourceItem?.imageUrl ? (
                  <div className="flex items-center justify-between rounded-[18px] border border-border/70 bg-background/35 px-4 py-3">
                    <div className="text-sm font-bold">{t("panelStoreProductForm.images.removeCurrent")}</div>
                    <Switch checked={removeImage} onCheckedChange={setRemoveImage} />
                  </div>
                ) : null}

                {(existingGalleryImages.length > 0 || galleryImages.length > 0) ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {existingGalleryImages.map((image) => (
                      <div key={image.id} className="relative overflow-hidden rounded-[14px] border border-border/70 bg-background/40">
                        <img src={image.url} alt={t("panelStoreProductForm.images.galleryAlt")} className="h-24 w-full object-cover" />
                        <button
                          type="button"
                          className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-destructive"
                          title={t("panelStoreProductForm.images.removeGallery")}
                          onClick={() => setExistingGalleryImages((current) => current.filter((item) => item.id !== image.id))}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {galleryImages.map((image) => (
                      <div key={image.id} className="relative overflow-hidden rounded-[14px] border border-border/70 bg-background/40">
                        <img src={image.preview} alt={t("panelStoreProductForm.images.galleryAlt")} className="h-24 w-full object-cover" />
                        <button
                          type="button"
                          className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-destructive"
                          title={t("panelStoreProductForm.images.removeGallery")}
                          onClick={() => removeGalleryImage(image.id)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {isEditMode ? (
              <Card className="border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle>{t("panelStoreProductForm.reviews.title")}</CardTitle>
                  <CardDescription>{t("panelStoreProductForm.reviews.count", { count: format.number(reviews.length) })}</CardDescription>
                </CardHeader>
                <CardContent>
                  {reviewsLoading ? (
                    <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      {t("panelStoreProductForm.reviews.loading")}
                    </div>
                  ) : reviews.length === 0 ? (
                    <div className="rounded-[14px] border border-dashed border-border/70 bg-background/30 p-4 text-sm text-muted-foreground">
                      {t("panelStoreProductForm.reviews.empty")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reviews.map((review) => (
                        <div key={review.id} className="space-y-3 rounded-[14px] border border-border/70 bg-background/35 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-sm font-bold">{review.reviewerName}</div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                                {t("panelStoreProductForm.reviews.rating", { rating: format.number(review.rating), max: format.number(5) })}
                                {review.createdAt ? ` | ${format.date(review.createdAt)}` : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant={review.isApproved ? "default" : "outline"}
                                size="sm"
                                disabled={moderatingReviewId === review.id}
                                onClick={async () => {
                                  setModeratingReviewId(review.id);
                                  const res = await api.store.moderateProductReview(review.id, {
                                    isApproved: !review.isApproved,
                                    adminReply: reviewReplies[review.id] ?? review.adminReply ?? "",
                                  });
                                  setModeratingReviewId(null);
                                  if (!res.success) {
                                    toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelStoreProductForm.toast.moderationFailed") });
                                    return;
                                  }
                                  setReviews((current) => current.map((item) => (item.id === review.id ? res.data : item)));
                                }}
                              >
                                {review.isApproved ? t("panelStoreProductForm.reviews.approved") : t("panelStoreProductForm.reviews.approve")}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={deletingReviewId === review.id}
                                onClick={async () => {
                                  setDeletingReviewId(review.id);
                                  const res = await api.store.deleteProductReview(review.id);
                                  setDeletingReviewId(null);
                                  if (!res.success) {
                                    toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelStoreProductForm.toast.deleteReviewFailed") });
                                    return;
                                  }
                                  setReviews((current) => current.filter((item) => item.id !== review.id));
                                }}
                              >
                                {deletingReviewId === review.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>

                          <div className="text-sm leading-7 text-muted-foreground">{review.body}</div>

                          <div className="space-y-2">
                            <Label>{t("panelStoreProductForm.reviews.adminReply")}</Label>
                            <Textarea
                              value={reviewReplies[review.id] ?? ""}
                              onChange={(event) => setReviewReplies((current) => ({ ...current, [review.id]: event.target.value }))}
                              className="min-h-20"
                            />
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={moderatingReviewId === review.id}
                                onClick={async () => {
                                  setModeratingReviewId(review.id);
                                  const res = await api.store.moderateProductReview(review.id, {
                                    isApproved: review.isApproved,
                                    adminReply: reviewReplies[review.id] ?? "",
                                  });
                                  setModeratingReviewId(null);
                                  if (!res.success) {
                                    toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelStoreProductForm.toast.replyFailed") });
                                    return;
                                  }
                                  setReviews((current) => current.map((item) => (item.id === review.id ? res.data : item)));
                                  toast({ title: t("panelStoreProductForm.toast.replySaved"), description: t("panelStoreProductForm.toast.replySavedDescription") });
                                }}
                              >
                                {t("panelStoreProductForm.reviews.saveReply")}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}

            <div className="sticky bottom-4 z-10 flex justify-end gap-3 rounded-[18px] border border-border/70 bg-card/90 p-3 backdrop-blur-md">
              <Link href="/panel/store-settings/products">
                <Button variant="outline">{t("common.cancel")}</Button>
              </Link>
              <Button onClick={handleSubmit} disabled={!title.trim() || !slug.trim() || !priceAmount.trim() || submitting}>
                {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                {isEditMode ? t("panelStoreProductForm.actions.saveChanges") : t("panelStoreProductForm.actions.create")}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
