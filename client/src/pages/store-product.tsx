import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, ClipboardList, LogIn, Menu, MessageSquareText, Minus, Plus, Settings, ShoppingCart, Sparkles, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MobileSiteMenu } from "@/components/mobile-site-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { addToStoreCart, getStoreCart, getStoreCartSummary, removeFromStoreCart, type StoreCartItem, updateStoreCartQuantity } from "@/lib/store-cart";
import { useAuth } from "@/lib/auth";
import { isAppointmentBookingDisabled } from "@/lib/audience";
import { LoginModal } from "@/components/login-modal";
import { NotificationBell } from "@/components/notification-bell";
import { usePublicSiteMenuItems } from "@/hooks/use-public-site-menu-items";
import type { StoreProductItem } from "@/lib/types";
import { CodeText } from "@/i18n/ltr-text";
import { useLocale } from "@/i18n/locale";

const gradients = [
  "linear-gradient(135deg, #17324d 0%, #f59e0b 100%)",
  "linear-gradient(135deg, #3f234f 0%, #ffb347 100%)",
  "linear-gradient(135deg, #224b45 0%, #ffcf66 100%)",
  "linear-gradient(135deg, #2f3347 0%, #f5a623 100%)",
];

export default function StoreProductPage() {
  const [, setLocation] = useLocation();
  const { user, isAdmin, logout } = useAuth();
  const { dir, isRtl, t, format } = useLocale();
  const { tenantMeta, publicMenuItems } = usePublicSiteMenuItems({
    showCustomerClub: !!user && user.role !== "admin" && user.role !== "barber",
  });
  const appointmentBookingDisabled = isAppointmentBookingDisabled(tenantMeta);
  const [match, params] = useRoute("/store/product/:id");
  const [product, setProduct] = useState<StoreProductItem | null>(null);
  const [productLoading, setProductLoading] = useState(true);
  const [productNotFound, setProductNotFound] = useState(false);
  const [activeImageId, setActiveImageId] = useState("");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviews, setReviews] = useState<Array<{
    id: string;
    reviewerName: string;
    rating: number;
    body: string;
    adminReply?: string | null;
    createdAt?: string | null;
  }>>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [alreadyInCart, setAlreadyInCart] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [cartItems, setCartItems] = useState<StoreCartItem[]>([]);
  const { toast } = useToast();
  const BackIcon = isRtl ? ArrowLeft : ArrowRight;

  useEffect(() => {
    if (!match || !params?.id) {
      setProductLoading(false);
      setProductNotFound(true);
      setProduct(null);
      return;
    }

    setProductLoading(true);
    setProductNotFound(false);
    api.store.getPublicProduct(params.id).then((res) => {
      if (res.success) {
        setProduct(res.data);
        setProductNotFound(false);
      } else {
        setProduct(null);
        setProductNotFound(true);
      }
      setProductLoading(false);
    }).catch(() => {
      setProduct(null);
      setProductNotFound(true);
      setProductLoading(false);
    });
  }, [match, params?.id]);

  useEffect(() => {
    setActiveImageId(product?.galleryImages?.[0]?.id ?? (product?.imageUrl ? "main-image" : ""));
    setDescriptionExpanded(false);
    setReviewFormOpen(false);
    setReviewText("");
    setReviewRating(5);
  }, [product?.id, product?.galleryImages, product?.imageUrl]);

  useEffect(() => {
    if (!product?.id || !product.reviewsEnabled) {
      setReviews([]);
      return;
    }

    setReviewsLoading(true);
    api.store.listPublicProductReviews(product.id).then((res) => {
      if (res.success) {
        setReviews(res.data.items);
      } else {
        setReviews([]);
      }
      setReviewsLoading(false);
    });
  }, [product?.id, product?.reviewsEnabled]);

  useEffect(() => {
    if (product) {
      document.title = t("storeProduct.documentTitle", { title: product.title });
    }
  }, [product, t]);

  useEffect(() => {
    const syncCart = () => setCartItems(getStoreCart());
    syncCart();
    window.addEventListener("store:cart-updated", syncCart);
    return () => {
      window.removeEventListener("store:cart-updated", syncCart);
    };
  }, []);

  useEffect(() => {
    const syncCartState = () => {
      if (!product) {
        setAlreadyInCart(false);
        return;
      }

      const exists = getStoreCart().some((item) => item.productId === product.id);
      setAlreadyInCart(exists);
    };

    syncCartState();
    window.addEventListener("store:cart-updated", syncCartState);

    return () => {
      window.removeEventListener("store:cart-updated", syncCartState);
    };
  }, [product]);

  const gallery = useMemo(() => {
    if (!product) {
      return [];
    }

    const baseGallery = product.galleryImages?.length
      ? product.galleryImages.map((item, index) => ({
          id: item.id,
          label: t("storeProduct.gallery.imageLabel", { number: format.number(index + 1) }),
          gradient: gradients[index % gradients.length],
          url: item.url,
        }))
      : [];

    if (product.imageUrl) {
      return [
        {
          id: "main-image",
          label: t("storeProduct.gallery.mainImage"),
          gradient: gradients[0],
          url: product.imageUrl,
        },
        ...baseGallery,
      ];
    }

    return baseGallery;
  }, [format, product, t]);

  const activeImage = gallery.find((item) => item.id === activeImageId) ?? gallery[0];
  const activeGalleryImage = activeImage ?? {
    id: "placeholder",
    label: t("storeProduct.gallery.placeholder"),
    gradient: gradients[0],
    url: product?.imageUrl || null,
  };
  const displayedPrice = product ? product.discountedPriceAmount ?? product.priceAmount : 0;
  const hasDiscount = product ? Boolean(product.discountedPriceAmount && product.priceAmount > product.discountedPriceAmount) : false;
  const discountRatio = product && product.discountedPriceAmount && product.priceAmount > product.discountedPriceAmount
    ? (product.priceAmount - product.discountedPriceAmount) / product.priceAmount
    : 0;
  const canOrder = product ? product.isActive && (product.stockQuantity ?? 0) > 0 : false;
  const orderButtonLabel = !product?.isActive
    ? t("storeProduct.cta.unavailable")
    : ((product.stockQuantity ?? 0) <= 0
      ? t("storeProduct.cta.outOfStock")
      : (alreadyInCart ? t("storeProduct.cta.inCart") : t("storeProduct.cta.addToCart")));

  const handleAddToCart = () => {
    if (!product) {
      return;
    }

    if (!product.isActive) {
      toast({
        variant: "destructive",
        title: t("storeProduct.toast.unavailableTitle"),
        description: t("storeProduct.toast.unavailableDescription"),
      });
      return;
    }

    if ((product.stockQuantity ?? 0) <= 0) {
      toast({
        variant: "destructive",
        title: t("storeProduct.toast.outOfStockTitle"),
        description: t("storeProduct.toast.outOfStockDescription"),
      });
      return;
    }

    if (alreadyInCart) {
      setLocation("/store?openCart=1");
      return;
    }

    addToStoreCart(product);
    toast({
      title: t("storeProduct.toast.addedTitle"),
      description: t("storeProduct.toast.addedDescription", { title: product.title }),
    });
    setLocation("/store?openCart=1");
  };
  const cartSummary = useMemo(() => getStoreCartSummary(cartItems), [cartItems]);
  const storePrivateMenuItems = user ? [
    { key: "orders", title: t("storeProduct.menu.orders"), icon: ClipboardList, href: "/store/orders" },
    { key: "notifications", title: t("storeProduct.menu.notifications"), icon: MessageSquareText, href: "/notifications" },
  ] : [];

  if (productLoading) {
    return (
      <div className="store-page min-h-screen bg-background text-foreground" dir={dir}>
        <div className="container mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-5 px-4 text-center text-muted-foreground">
          <div className="flex items-center">
            <Sparkles className="me-2 h-5 w-5 animate-pulse text-primary" />
            {t("storeProduct.loading")}
          </div>
        </div>
      </div>
    );
  }

  if (productNotFound || !product) {
    return (
      <div className="store-page min-h-screen bg-background text-foreground" dir={dir}>
        <div className="container mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-5 px-4 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-black">{t("storeProduct.notFound.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("storeProduct.notFound.description")}</p>
          </div>
          <Link href="/store">
            <Button className="rounded-2xl">{t("storeProduct.backToStore")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="store-page min-h-screen bg-background pb-28 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_45%),linear-gradient(180deg,rgba(24,35,61,0.98),rgba(15,23,42,0))]" />

      <header className="border-b border-border/70 bg-card/40 backdrop-blur-md">
        <div className="container mx-auto max-w-6xl px-4 py-5">
          <div className="space-y-4">
            <div className="space-y-2 text-start">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {[product.categoryName || t("storeProduct.categoryFallback"), t("storeProduct.breadcrumb.products"), product.title].map((item, index, items) => (
                  <span key={`${item}-${index}`} className="inline-flex items-center gap-2">
                    {item}
                    {index < items.length - 1 ? <span className="text-primary/70">/</span> : null}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              {user ? <NotificationBell onClick={() => setLocation("/notifications")} className="h-11 w-11" /> : null}
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40" onClick={() => setMenuOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <button
                type="button"
                onClick={() => setCartSheetOpen(true)}
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/40 text-foreground transition-colors hover:bg-background/70"
                aria-label={t("storeProduct.cart.ariaLabel")}
              >
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -end-1.5 -top-1.5 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-black text-primary-foreground">
                  {format.number(cartSummary.itemsCount)}
                </span>
              </button>
              {isAdmin ? (
                <Link href="/panel">
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40">
                    <Settings className="h-5 w-5" />
                  </Button>
                </Link>
              ) : null}
              <Link href="/store">
                <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40">
                  <BackIcon className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <Card className="overflow-hidden border-border/70 bg-card/60">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="relative flex h-[320px] items-center justify-center overflow-hidden rounded-[30px] border border-border/60 bg-white p-5 shadow-[0_30px_70px_-45px_rgba(0,0,0,0.85)] sm:h-[420px]">
                {activeGalleryImage.url ? (
                  <img src={activeGalleryImage.url} alt={product.title} className="h-full w-full object-contain" />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center rounded-[24px] px-6 text-center text-lg font-black text-white"
                    style={{ background: activeGalleryImage.gradient }}
                  >
                    {activeGalleryImage.label}
                  </div>
                )}
              </div>

              <div className="pretty-scrollbar pretty-scrollbar-x flex gap-3 overflow-x-auto pb-2">
                {gallery.map((image) => {
                  const isActive = image.id === activeGalleryImage.id;

                  return (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setActiveImageId(image.id)}
                      className={`min-w-[96px] overflow-hidden rounded-[22px] border p-1.5 text-start transition-all sm:min-w-[112px] ${isActive ? "border-primary bg-primary/10" : "border-border/70 bg-background/40 hover:border-primary/40"}`}
                    >
                      <div className="relative h-20 overflow-hidden rounded-[18px] bg-white sm:h-24">
                        {image.url ? (
                          <img src={image.url} alt={image.label} className="absolute inset-0 h-full w-full object-contain p-1" />
                        ) : (
                          <div className="absolute inset-0" style={{ background: image.gradient }} />
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-1 text-xs font-semibold text-white">
                          {image.label}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5 lg:sticky lg:top-6">
            <Card className="border-border/70 bg-card/60">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {product.isBestseller ? (
                    <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        {t("storeProduct.badge.bestseller")}
                      </div>
                    ) : null}
                    {product.isFeatured ? (
                      <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        {t("storeProduct.badge.featured")}
                      </div>
                    ) : null}
                    {hasDiscount ? (
                      <div className="rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white shadow-[0_10px_24px_-12px_rgba(239,68,68,0.9)]">
                        {t("storeProduct.badge.discount", { percent: format.percent(discountRatio) })}
                      </div>
                    ) : null}
                    <div className="rounded-full border border-border/70 bg-background/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {product.categoryName || t("storeProduct.categoryFallback")}
                    </div>
                  </div>

                  <h2 className="text-2xl font-black leading-10">{product.title}</h2>
                  <div className="rounded-[24px] border border-border/70 bg-background/30 p-4">
                    <div
                        className={`whitespace-pre-line text-sm leading-8 text-muted-foreground transition-all ${descriptionExpanded ? "" : "line-clamp-4"}`}
                    >
                      {product.description || t("storeProduct.descriptionFallback")}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDescriptionExpanded((current) => !current)}
                      className="mt-3 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/15"
                    >
                      {descriptionExpanded ? t("storeProduct.description.close") : t("storeProduct.description.expand")}
                    </button>
                  </div>
                </div>

                <div className="rounded-[26px] border border-border/70 bg-background/40 p-4">
                  <div className="flex items-end justify-between gap-4">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">{t("storeProduct.price.label")}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-2xl font-black text-primary">
                          {format.currency(displayedPrice)}
                        </div>
                        {hasDiscount ? (
                          <div className="text-sm text-muted-foreground line-through">{format.currency(product.priceAmount)}</div>
                        ) : null}
                      </div>
                    </div>
                    <div className="hidden rounded-2xl border border-primary/25 bg-primary/10 p-3 text-primary sm:flex">
                      <ShoppingCart className="h-6 w-6" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                      (product.stockQuantity ?? 0) > 0
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    }`}>
                      {t("storeProduct.stock", { count: format.number(product.stockQuantity) })}
                    </div>
                    <div className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                      product.isActive && (product.stockQuantity ?? 0) > 0
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    }`}>
                      {canOrder ? t("storeProduct.status.orderable") : t("storeProduct.status.unavailable")}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-border/70 bg-background/35 p-4 text-sm leading-7 text-muted-foreground">
                    {product.subtitle || t("storeProduct.subtitleFallback")}
                  </div>
                </div>

                <div className="hidden lg:block">
                  <Button className="h-14 w-full rounded-[22px] text-base font-black" onClick={handleAddToCart} disabled={!canOrder}>
                    <ShoppingCart className="me-2 h-5 w-5" />
                    {orderButtonLabel}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/55">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-5 w-5" />
                  <div className="font-bold">{t("storeProduct.details.title")}</div>
                </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-border/70 bg-background/35 p-3 text-sm text-muted-foreground">
                    {t("storeProduct.details.slug")} <CodeText className="font-bold text-foreground">{product.slug}</CodeText>
                  </div>
                  <div className="rounded-[20px] border border-border/70 bg-background/35 p-3 text-sm text-muted-foreground">
                    {t("storeProduct.details.category")} <span className="font-bold text-foreground">{product.categoryName || t("storeProduct.details.noCategory")}</span>
                  </div>
                  <div className="rounded-[20px] border border-border/70 bg-background/35 p-3 text-sm text-muted-foreground">
                    {t("storeProduct.details.displayStatus")} <span className="font-bold text-foreground">{product.isActive ? t("storeProduct.status.active") : t("storeProduct.status.inactive")}</span>
                  </div>
                  <div className="rounded-[20px] border border-border/70 bg-background/35 p-3 text-sm text-muted-foreground">
                    {t("storeProduct.details.reviewStatus")} <span className="font-bold text-foreground">{product.reviewsEnabled ? t("storeProduct.status.active") : t("storeProduct.status.inactive")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <Card className="border-border/70 bg-card/60">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-black">{t("storeProduct.reviews.title")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {product.reviewsEnabled ? t("storeProduct.reviews.enabledDescription") : t("storeProduct.reviews.disabledDescription")}
                  </p>
                </div>

                {!product.reviewsEnabled ? (
                  <div className="rounded-[24px] border border-dashed border-border/70 bg-background/35 p-5 text-sm leading-8 text-muted-foreground">
                    {t("storeProduct.reviews.disabled")}
                  </div>
                ) : reviewsLoading ? (
                  <div className="rounded-[24px] border border-dashed border-border/70 bg-background/35 p-5 text-sm leading-8 text-muted-foreground">
                    {t("storeProduct.reviews.loading")}
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-border/70 bg-background/35 p-5 text-sm leading-8 text-muted-foreground">
                    {t("storeProduct.reviews.empty")}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="rounded-[24px] border border-border/70 bg-background/35 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="font-bold text-foreground">{review.reviewerName}</div>
                          <div className="text-xs text-muted-foreground">
                            {review.createdAt ? format.date(review.createdAt) : ""}
                          </div>
                        </div>
                        <div className="mb-3 flex items-center gap-1 text-amber-400">
                          {Array.from({ length: 5 }, (_, index) => (
                            <Star key={`${review.id}-${index}`} className={`h-4 w-4 ${index < review.rating ? "fill-current" : ""}`} />
                          ))}
                        </div>
                        <p className="text-sm leading-8 text-muted-foreground">{review.body}</p>
                        {review.adminReply ? (
                          <div className="mt-3 rounded-[18px] border border-primary/20 bg-primary/10 p-3 text-sm text-muted-foreground">
                            <div className="mb-1 font-bold text-primary">{t("storeProduct.reviews.adminReply")}</div>
                            {review.adminReply}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/55">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center gap-2 text-primary">
                  <MessageSquareText className="h-5 w-5" />
                  <div className="font-bold">{t("storeProduct.reviewForm.title")}</div>
                </div>

                {!product.reviewsEnabled ? (
                  <div className="rounded-[18px] border border-dashed border-border/70 bg-background/35 p-4 text-sm text-muted-foreground">
                    {t("storeProduct.reviewForm.disabled")}
                  </div>
                ) : !user ? (
                  <div className="space-y-3 rounded-[18px] border border-dashed border-border/70 bg-background/35 p-4 text-sm text-muted-foreground">
                    <div>{t("storeProduct.reviewForm.loginRequired")}</div>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-[18px]"
                      onClick={() => setLoginOpen(true)}
                    >
                      {t("storeProduct.reviewForm.loginButton")}
                    </Button>
                  </div>
                ) : !reviewFormOpen ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-[22px] border-border bg-background/40"
                    onClick={() => setReviewFormOpen(true)}
                  >
                    {t("storeProduct.reviewForm.open")}
                  </Button>
                ) : (
                  <div className="space-y-4 rounded-[24px] border border-border/70 bg-background/35 p-4">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">{t("storeProduct.reviewForm.rating")}</div>
                      <div className="flex items-center gap-1 text-amber-400">
                        {Array.from({ length: 5 }, (_, index) => {
                          const value = index + 1;
                          return (
                            <button key={value} type="button" onClick={() => setReviewRating(value)} className="p-1">
                              <Star className={`h-5 w-5 ${value <= reviewRating ? "fill-current" : ""}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <Textarea
                      value={reviewText}
                      onChange={(event) => setReviewText(event.target.value)}
                      placeholder={t("storeProduct.reviewForm.placeholder")}
                      className="min-h-[150px] rounded-[18px] border-border bg-background/50 leading-8"
                    />

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-[18px] border-border bg-background/40"
                        onClick={() => {
                          setReviewFormOpen(false);
                          setReviewText("");
                        }}
                      >
                        {t("storeProduct.reviewForm.close")}
                      </Button>
                      <Button
                        type="button"
                        className="rounded-[18px] px-6"
                        disabled={!reviewText.trim() || submittingReview}
                        onClick={async () => {
                          if (!product) {
                            return;
                          }
                          setSubmittingReview(true);
                          const res = await api.store.createPublicProductReview(product.id, {
                            rating: reviewRating,
                            body: reviewText.trim(),
                          });
                          setSubmittingReview(false);

                          if (!res.success) {
                            toast({
                              variant: "destructive",
                              title: t("storeProduct.toast.reviewFailedTitle"),
                              description: res.message,
                            });
                            return;
                          }

                          setReviewFormOpen(false);
                          setReviewText("");
                          setReviewRating(5);
                          toast({
                            title: t("storeProduct.toast.reviewSubmittedTitle"),
                            description: t("storeProduct.toast.reviewSubmittedDescription"),
                          });
                        }}
                      >
                        {submittingReview ? t("storeProduct.reviewForm.submitting") : t("storeProduct.reviewForm.submit")}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/92 backdrop-blur lg:hidden">
        <div className="container mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center gap-3 rounded-[24px] border border-border/70 bg-card/70 p-3 shadow-[0_-20px_50px_-40px_rgba(0,0,0,0.85)]">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">{t("storeProduct.finalPrice")}</div>
              <div className="truncate text-lg font-black text-primary">
                {format.currency(displayedPrice)}
              </div>
            </div>
            <Button className="h-11 rounded-[18px] px-5 text-sm font-black" onClick={handleAddToCart} disabled={!canOrder}>
              <ShoppingCart className="me-2 h-4 w-4" />
              {!product.isActive ? t("storeProduct.cta.unavailable") : ((product.stockQuantity ?? 0) <= 0 ? t("storeProduct.cta.outOfStock") : (alreadyInCart ? t("storeProduct.cta.inCart") : t("storeProduct.cta.addToCartShort")))}
            </Button>
          </div>
        </div>
      </div>

      <MobileSiteMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        user={user}
        items={[
          ...publicMenuItems.map((item) => ({
            key: item.key,
            title: item.title,
            icon: item.icon,
            onSelect: () => {
              setMenuOpen(false);
              setLocation(item.href);
            },
          })),
          ...storePrivateMenuItems.map((item) => ({
            key: item.key,
            title: item.title,
            icon: item.icon,
            onSelect: () => {
              setMenuOpen(false);
              setLocation(item.href);
            },
          })),
        ]}
        loginAction={!user ? {
          label: t("storeProduct.login"),
          icon: LogIn,
          onSelect: () => {
            setMenuOpen(false);
            setLocation(appointmentBookingDisabled ? "/nutrition" : "/booking");
          },
        } : null}
        logoutAction={user ? async () => {
          setMenuOpen(false);
          await logout();
        } : null}
      />

      <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
        <SheetContent side={isRtl ? "left" : "right"} className="flex h-full w-full max-w-md flex-col overflow-hidden border-border bg-card/95" closeClassName="end-4 start-auto" dir={dir}>
          <SheetHeader className="items-end text-start sm:text-start">
            <SheetTitle className="w-full text-start">{t("storeProduct.cart.title")}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
              {cartItems.length > 0 ? cartItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-[24px] border border-border/70 bg-background/30 p-3">
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-[20px] border border-border/70 bg-background/40">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">{item.title.slice(0, 8)}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="truncate font-bold text-foreground">{item.title}</div>
                    <div className="line-clamp-2 text-sm text-muted-foreground">{item.subtitle}</div>
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <div className="text-sm font-bold text-primary">{format.currency(item.priceAmount)}</div>
                      <div className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-2 py-1 text-xs text-muted-foreground">
                        <button type="button" className="rounded-md p-1 hover:bg-muted" onClick={() => updateStoreCartQuantity(item.productId, item.quantity - 1, item.stockQuantity)}>
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span>{format.number(item.quantity)}</span>
                        <button type="button" className="rounded-md p-1 hover:bg-muted" onClick={() => updateStoreCartQuantity(item.productId, item.quantity + 1, item.stockQuantity)}>
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" className="rounded-md p-1 text-destructive hover:bg-destructive/10" onClick={() => removeFromStoreCart(item.productId)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-[22px] border border-dashed border-border/70 bg-background/25 px-4 py-10 text-center text-sm text-muted-foreground">
                  {t("storeProduct.cart.empty")}
                </div>
              )}
            </div>
            <div className="space-y-3 border-t border-border/70 bg-card/95 pt-4 pb-1">
              <div className="flex items-center justify-between rounded-[22px] border border-primary/20 bg-primary/5 p-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">{t("storeProduct.cart.total")}</div>
                  <div className="text-lg font-black text-primary">{format.currency(cartSummary.subtotal)}</div>
                </div>
                <div className="rounded-full bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                  {t("storeProduct.cart.itemCount", { count: format.number(cartSummary.itemsCount) })}
                </div>
              </div>
              <Link href="/store/checkout">
                <Button className="h-12 w-full rounded-[20px]" disabled={cartItems.length === 0}>
                  {t("storeProduct.cart.checkout")}
                </Button>
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        phoneStepDescription={t("storeProduct.loginDescription")}
        onSuccess={() => {
          setReviewFormOpen(true);
        }}
      />
    </div>
  );
}
