import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Bell, ChevronLeft, ClipboardList, Layers3, LogIn, Menu, Minus, Plus, Search, Settings, ShoppingCart, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MobileSiteMenu } from "@/components/mobile-site-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { isAppointmentBookingDisabled } from "@/lib/audience";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "@/components/notification-bell";
import { usePublicSiteMenuItems } from "@/hooks/use-public-site-menu-items";
import type { StoreCategoryItem, StoreProductItem } from "@/lib/types";
import { getStoreCart, getStoreCartSummary, removeFromStoreCart, type StoreCartItem, updateStoreCartQuantity } from "@/lib/store-cart";
import { getStorefrontCacheClearedEventName, isStorefrontCacheFresh, readStorefrontCache, writeStorefrontCache } from "@/lib/storefront-cache";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type StoreShowcaseProduct = {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  originalPrice?: string;
  discountPercent?: number;
  badges: string[];
  imageLabel: string;
  gradient: string;
  imageUrl?: string | null;
};

const gradients = [
  "linear-gradient(135deg, #17324d 0%, #f59e0b 100%)",
  "linear-gradient(135deg, #3f234f 0%, #ffb347 100%)",
  "linear-gradient(135deg, #224b45 0%, #ffcf66 100%)",
  "linear-gradient(135deg, #2f3347 0%, #f5a623 100%)",
  "linear-gradient(135deg, #1d4564 0%, #f9a826 100%)",
];

function ProductCarousel({
  title,
  description,
  href,
  items,
  onOpenProduct,
}: {
  title: string;
  description: string;
  href: string;
  items: StoreShowcaseProduct[];
  onOpenProduct: (id: string) => void;
}) {
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { isRtl } = useLocale();
  const t = useT();

  const scrollToIndex = (index: number, behavior: ScrollBehavior = "smooth") => {
    const container = sliderRef.current;
    const nextItem = container?.children.item(index) as HTMLElement | null;

    if (!container || !nextItem) {
      return;
    }

    setActiveIndex(index);
    nextItem.scrollIntoView({
      behavior,
      inline: "start",
      block: "nearest",
    });
  };

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const container = sliderRef.current;
      if (!container) {
        return;
      }

      setActiveIndex(0);
      container.scrollTo({
        left: 0,
        behavior: "auto",
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [items.length]);

  const handleNext = () => {
    const nextIndex = activeIndex === items.length - 1 ? 0 : activeIndex + 1;
    scrollToIndex(nextIndex);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card className="overflow-hidden border-border/70 bg-card/60">
        <CardContent className="space-y-4 p-4">
          <div
            ref={sliderRef}
            className="pretty-scrollbar pretty-scrollbar-x flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
          >
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenProduct(item.id)}
                className={`min-w-[240px] max-w-[240px] snap-start overflow-hidden rounded-[28px] border text-start transition-all sm:min-w-[260px] sm:max-w-[260px] ${activeIndex === index ? "border-primary/40 bg-primary/10" : "border-border/70 bg-background/35 hover:border-primary/30"}`}
              >
                <div
                  className="relative flex h-52 items-start justify-between overflow-hidden p-4 text-white"
                  style={item.imageUrl ? undefined : { background: item.gradient }}
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className="absolute inset-0 h-full w-full object-cover" />
                  ) : null}
                  {item.imageUrl ? (
                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 via-black/15 to-transparent" />
                  ) : null}
                  {!item.imageUrl ? (
                    <div className="absolute inset-y-0 start-0 w-24 bg-white/10 blur-2xl" />
                  ) : null}
                  <div className="relative flex flex-wrap items-center gap-2">
                    {item.badges.length > 0 ? item.badges.map((badge) => (
                      <div key={`${item.id}-${badge}`} className="rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs font-semibold text-white shadow-[0_8px_24px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md">
                        {badge}
                      </div>
                    )) : (
                      <div className="rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs font-semibold text-white shadow-[0_8px_24px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md">
                        {t("storePage.productFallbackBadge")}
                      </div>
                    )}
                  </div>
                  <div className="relative rounded-2xl border border-white/20 bg-black/35 px-3 py-2 text-xs text-white shadow-[0_8px_24px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md">
                    {item.imageLabel}
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div className="space-y-1">
                    <div className="line-clamp-2 min-h-[3.4rem] text-base font-black text-foreground">{item.title}</div>
                    <div className="line-clamp-2 min-h-[2.8rem] text-sm text-muted-foreground">{item.subtitle}</div>
                  </div>
                  <div className="text-lg font-black text-primary">{item.price}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToIndex(index)}
                  className={`h-2.5 rounded-full transition-all ${activeIndex === index ? "w-10 bg-primary" : "w-2.5 bg-border"}`}
                  aria-label={item.title}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-border bg-background/40"
              onClick={handleNext}
            >
              <ChevronLeft className={`me-2 h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />
              {t("storePage.carousel.next")}
            </Button>
          </div>

          <div className="pt-1">
            <Link href={href}>
              <Button className="w-full rounded-[22px]">
                {t("storePage.viewAll")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default function StorePage() {
  const { user, isAdmin, logout } = useAuth();
  const { dir, isRtl } = useLocale();
  const format = useFormat();
  const t = useT();
  const { tenantMeta, publicMenuItems } = usePublicSiteMenuItems({
    showCustomerClub: !!user && user.role !== "admin" && user.role !== "barber",
  });
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [noticeAcknowledged, setNoticeAcknowledged] = useState(false);
  const [search, setSearch] = useState("");
  const [storeProducts, setStoreProducts] = useState<StoreProductItem[]>([]);
  const [storeCategories, setStoreCategories] = useState<StoreCategoryItem[]>([]);
  const [cartItems, setCartItems] = useState<StoreCartItem[]>([]);
  const faqItems = useMemo(() => (
    Array.isArray(tenantMeta?.storeFaqItems) ? tenantMeta.storeFaqItems : [
      {
        id: "fallback-shipping-time",
        question: t("storePage.faq.fallback.shippingTime.question"),
        answer: t("storePage.faq.fallback.shippingTime.answer"),
      },
      {
        id: "fallback-other-cities",
        question: t("storePage.faq.fallback.otherCities.question"),
        answer: t("storePage.faq.fallback.otherCities.answer"),
      },
      {
        id: "fallback-order-tracking",
        question: t("storePage.faq.fallback.orderTracking.question"),
        answer: t("storePage.faq.fallback.orderTracking.answer"),
      },
      {
        id: "fallback-new-products",
        question: t("storePage.faq.fallback.newProducts.question"),
        answer: t("storePage.faq.fallback.newProducts.answer"),
      },
    ]
  ), [tenantMeta?.storeFaqItems, t]);

  useEffect(() => {
    const cachedStorefront = readStorefrontCache(tenantMeta);
    if (cachedStorefront) {
      setStoreProducts(cachedStorefront.products);
      setStoreCategories(cachedStorefront.categories);
    }

    const shouldRefreshStorefront = !isStorefrontCacheFresh(cachedStorefront);

    if (shouldRefreshStorefront) {
      Promise.all([api.store.listPublicProducts(), api.store.listPublicCategories()]).then(([productsRes, categoriesRes]) => {
        const nextProducts = productsRes.success ? productsRes.data.items : cachedStorefront?.products ?? [];
        const nextCategories = categoriesRes.success ? categoriesRes.data.items : cachedStorefront?.categories ?? [];

        if (productsRes.success) {
          setStoreProducts(nextProducts);
        }
        if (categoriesRes.success) {
          setStoreCategories(nextCategories);
        }
        if (productsRes.success && categoriesRes.success) {
          writeStorefrontCache(tenantMeta, {
            products: nextProducts,
            categories: nextCategories,
          });
        }
      });
    }

    const syncCart = () => setCartItems(getStoreCart());
    const clearStorefrontState = () => {
      setStoreProducts([]);
      setStoreCategories([]);
    };
    syncCart();
    window.addEventListener("store:cart-updated", syncCart);
    window.addEventListener(getStorefrontCacheClearedEventName(), clearStorefrontState);
    return () => {
      window.removeEventListener("store:cart-updated", syncCart);
      window.removeEventListener(getStorefrontCacheClearedEventName(), clearStorefrontState);
    };
  }, [tenantMeta]);

  useEffect(() => {
    if (!location.startsWith("/store")) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const shouldOpenCart = params.get("openCart") === "1";

    if (!shouldOpenCart) {
      return;
    }

    setCartSheetOpen(true);
    params.delete("openCart");
    const nextQuery = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
  }, [location]);

  const homeSettings = tenantMeta?.storeHomeSettings;
  const storeFeatureEnabled = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-store") ?? false;
  const appointmentBookingDisabled = isAppointmentBookingDisabled(tenantMeta);
  const showBookingEntryOnStore = homeSettings?.showBookingEntryOnStore === true && !appointmentBookingDisabled;
  const storePrivateMenuItems = user ? [
    { key: "orders", title: t("storePage.menu.orders"), icon: ClipboardList, href: "/store/orders" },
    { key: "notifications", title: t("storePage.menu.notifications"), icon: Bell, href: "/notifications" },
  ] : [];
  const canOpenSettings = isAdmin;
  const hasMenu = canOpenSettings || !user || publicMenuItems.length > 0 || storePrivateMenuItems.length > 0 || showBookingEntryOnStore;
  const navigateFromMenu = (href: string) => {
    setMenuOpen(false);
    setLocation(href);
  };
  const mapStoreProduct = (item: StoreProductItem, index: number): StoreShowcaseProduct => {
    const discountPercent =
      item.discountedPriceAmount && item.priceAmount > item.discountedPriceAmount
        ? Math.round(((item.priceAmount - item.discountedPriceAmount) / item.priceAmount) * 100)
        : undefined;

    const badges = [
      item.isBestseller ? t("storePage.badge.bestseller") : null,
      item.isFeatured ? t("storePage.badge.featured") : null,
      item.isPopular ? t("storePage.badge.popular") : null,
    ].filter(Boolean) as string[];

    return {
      id: item.id,
      title: item.title,
      subtitle: item.subtitle || item.description || t("storePage.productFallbackSubtitle"),
      price: format.currency(item.discountedPriceAmount ?? item.priceAmount),
      originalPrice: item.discountedPriceAmount ? format.currency(item.priceAmount) : undefined,
      discountPercent,
      badges,
      imageLabel: item.title.slice(0, 14) || t("storePage.productImageFallback"),
      gradient: gradients[index % gradients.length],
      imageUrl: item.imageUrl,
    };
  };
  const bestSellerItems = useMemo(
    () => storeProducts.filter((item) => item.isBestseller).map(mapStoreProduct),
    [storeProducts, format, t],
  );
  const popularItems = useMemo(
    () => storeProducts.filter((item) => item.isPopular).map(mapStoreProduct),
    [storeProducts, format, t],
  );
  const latestItems = useMemo(
    () =>
      [...storeProducts]
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 6)
        .map(mapStoreProduct),
    [storeProducts, format, t],
  );
  const homeCategoryItems = useMemo(
    () => storeCategories.filter((category) => category.showOnHome !== false),
    [storeCategories],
  );
  const cartSummary = useMemo(() => getStoreCartSummary(cartItems), [cartItems]);
  const submitStoreSearch = () => {
    const params = new URLSearchParams();
    const query = search.trim();
    if (query) {
      params.set("q", query);
    }
    params.set("page", "1");
    setLocation(`/store/search?${params.toString()}`);
  };
  const openGraphicBannerLink = () => {
    const href = homeSettings?.graphicBannerLink?.trim();

    if (!href) {
      return;
    }

    if (/^https?:\/\//i.test(href)) {
      window.location.href = href;
      return;
    }

    setLocation(href.startsWith("/") ? href : `/${href}`);
  };

  if (!storeFeatureEnabled || tenantMeta?.storeEnabled === false) {
    return (
      <div className="store-page min-h-screen bg-background text-foreground" dir={dir}>
        <div className="container mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-10">
          <Card className="w-full border-border/70 bg-card/60">
            <CardContent className="space-y-5 p-6 text-center sm:p-8">
              <div className="text-2xl font-black">{t("storePage.disabled.title")}</div>
              <p className="text-sm leading-8 text-muted-foreground">
                {t("storePage.disabled.description")}
              </p>
              <div className="flex justify-center">
                <Link href="/nutrition/profile">
                  <Button className="rounded-[20px] px-6">
                    {t("common.back")}
                    <ArrowLeft className={`ms-2 h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="store-page min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.22),_transparent_48%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="border-b border-border/70 bg-card/40 backdrop-blur-md">
        <div className="container mx-auto max-w-6xl px-4 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm text-primary">{t("storePage.eyebrow")}</div>
              <h1 className="text-2xl font-black text-foreground">{t("storePage.title")}</h1>
            </div>
            <div className="flex items-center gap-2">
              {user ? <NotificationBell onClick={() => setLocation("/notifications")} className="h-11 w-11" /> : null}
              {isAdmin ? (
                <Link href="/panel">
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40" title={t("storePage.backToPanel")}>
                    <Settings className="h-5 w-5" />
                  </Button>
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setCartSheetOpen(true)}
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/40 text-foreground transition-colors hover:bg-background/70"
                aria-label={t("storePage.cart.title")}
              >
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -end-1.5 -top-1.5 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-black text-primary-foreground shadow-[0_10px_22px_-10px_rgba(245,158,11,0.9)]">
                  {format.number(cartSummary.itemsCount)}
                </span>
              </button>
              {hasMenu ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={t("common.menu")}
                  onClick={() => setMenuOpen(true)}
                  className="h-11 w-11 rounded-2xl border-border bg-background/40"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-8 px-4 py-6">
        {showBookingEntryOnStore ? (
          <section className="rounded-[30px] border border-border/70 bg-card/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-black text-foreground">{t("storePage.bookingEntry.title")}</h2>
                <p className="text-sm text-muted-foreground">{t("storePage.bookingEntry.description")}</p>
              </div>
              <Button
                variant="outline"
                className="h-11 rounded-2xl border-border bg-background/40 px-4"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.sessionStorage.setItem("skip_store_default_redirect_once", "1");
                  }
                  setLocation("/booking");
                }}
              >
                <ArrowLeft className={`me-2 h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
                {t("storePage.bookingEntry.title")}
              </Button>
            </div>
          </section>
        ) : null}

        <section className="rounded-[32px] border border-border/70 bg-card/55 p-4 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.75)] sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submitStoreSearch();
                  }
                }}
                placeholder={t("storePage.search.placeholder")}
                className="h-14 rounded-[22px] border-border bg-background/60 ps-12 text-base"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-14 rounded-[22px] border-border bg-background/50 px-5"
                onClick={submitStoreSearch}
              >
                <Search className="me-2 h-5 w-5" />
                {t("storePage.search.submit")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-14 rounded-[22px] border-border bg-background/50 px-5"
                onClick={() => setCategorySheetOpen(true)}
              >
                <Layers3 className="me-2 h-5 w-5" />
                {t("storePage.categories.button")}
              </Button>
            </div>
          </div>
        </section>

        {!noticeAcknowledged ? (
          <section className="overflow-hidden rounded-[32px] border border-primary/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(24,35,61,0.92))] p-5 shadow-[0_24px_70px_-36px_rgba(245,158,11,0.45)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {t("storePage.notice.badge")}
                </div>
                <h2 className="text-lg font-black text-foreground">{t("storePage.notice.title")}</h2>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                  {t("storePage.notice.description")}
                </p>
              </div>
              <Button className="rounded-[20px] px-6" onClick={() => setNoticeAcknowledged(true)}>
                {t("storePage.notice.acknowledge")}
              </Button>
            </div>
          </section>
        ) : null}

        {homeSettings?.showCategories !== false && homeCategoryItems.length > 0 ? (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-base font-black text-foreground">{t("storePage.categories.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("storePage.categories.description")}</p>
          </div>

          <div className="pretty-scrollbar pretty-scrollbar-x flex gap-4 overflow-x-auto pb-3 sm:gap-6">
            {homeCategoryItems.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setLocation(`/store/collection/${category.slug}`)}
                className="group flex min-w-[112px] max-w-[112px] flex-col items-center gap-2 rounded-[18px] border border-transparent p-2 text-center transition-all hover:border-border/70 hover:bg-card/45 sm:min-w-[132px] sm:max-w-[132px]"
              >
                <div
                  className="flex h-24 w-full items-center justify-center overflow-hidden rounded-[16px] bg-white p-2 shadow-[0_16px_36px_-30px_rgba(0,0,0,0.8)] ring-1 ring-border/45 transition-transform group-hover:-translate-y-0.5 sm:h-28"
                  style={category.imageUrl ? undefined : { background: gradients[Number(category.sortOrder || 0) % gradients.length] }}
                >
                  {category.imageUrl ? (
                    <img src={category.imageUrl} alt={category.name} className="h-full w-full object-contain" />
                  ) : (
                    <span className="px-2 text-xs font-bold leading-6 text-white">{category.name.slice(0, 10)}</span>
                  )}
                </div>
                <div className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-5 text-foreground sm:text-[15px]">
                  {category.name}
                </div>
              </button>
            ))}
          </div>
        </section>
        ) : null}

        {homeSettings?.showBestsellers !== false ? (
        <ProductCarousel
          title={t("storePage.bestsellers.title")}
          description={t("storePage.bestsellers.description")}
          href="/store/bestsellers"
          items={bestSellerItems}
          onOpenProduct={(id) => setLocation(`/store/product/${id}`)}
        />
        ) : null}

        {homeSettings?.showGraphicBanner !== false ? (
        <section
          className="overflow-hidden rounded-[34px] border border-dashed border-primary/35 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(24,35,61,0.9))] p-6 shadow-[0_24px_70px_-36px_rgba(245,158,11,0.4)]"
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
                {homeSettings?.graphicBannerBadge || t("storePage.graphicBanner.badgeFallback")}
              </div>
              <h2 className="text-2xl font-black text-foreground">
                {homeSettings?.graphicBannerTitle || t("storePage.graphicBanner.titleFallback")}
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                {homeSettings?.graphicBannerDescription || t("storePage.graphicBanner.descriptionFallback")}
              </p>
              {homeSettings?.graphicBannerLink ? (
                <Button type="button" className="rounded-[20px] px-5" onClick={openGraphicBannerLink}>
                  {homeSettings?.graphicBannerButtonLabel || t("storePage.graphicBanner.buttonFallback")}
                </Button>
              ) : null}
            </div>
            {homeSettings?.graphicBannerImageUrl ? (
              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/10 lg:w-[260px]">
                <img
                  src={homeSettings.graphicBannerImageUrl}
                  alt={homeSettings?.graphicBannerTitle || t("storePage.graphicBanner.imageAlt")}
                  className="h-28 w-full object-cover lg:w-[260px]"
                />
              </div>
            ) : (
              <div className="flex h-28 w-full items-center justify-center rounded-[28px] border border-white/10 bg-black/10 px-6 text-sm text-muted-foreground backdrop-blur lg:w-[260px]">
                {t("storePage.graphicBanner.previewFallback")}
              </div>
            )}
          </div>
        </section>
        ) : null}

        {homeSettings?.showPopularProducts !== false ? (
        <ProductCarousel
          title={t("storePage.popular.title")}
          description={t("storePage.popular.description")}
          href="/store/popular"
          items={popularItems}
          onOpenProduct={(id) => setLocation(`/store/product/${id}`)}
        />
        ) : null}

        {homeSettings?.showLatestProducts !== false ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">{t("storePage.latest.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("storePage.latest.description")}</p>
            </div>
          </div>

          <Card className="overflow-hidden border-border/70 bg-card/60">
            <CardContent className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {latestItems.map((item) => (
                  <Link key={item.id} href={`/store/product/${item.id}`}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-[24px] border border-border/70 bg-background/35 p-3 text-start transition-all hover:border-primary/30"
                    >
                      <div
                        className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-[18px] text-[11px] font-semibold text-white"
                        style={item.imageUrl ? undefined : { background: item.gradient }}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                        ) : (
                          item.imageLabel
                        )}
                        {item.discountPercent ? (
                          <span className="absolute start-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-black text-white backdrop-blur">
                            {t("storePage.discountPercent", { value: format.number(item.discountPercent) })}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="truncate font-bold text-foreground">{item.title}</div>
                        <div className="line-clamp-2 text-xs leading-6 text-muted-foreground">{item.subtitle}</div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <div className="text-sm font-black text-primary">{item.price}</div>
                          {item.originalPrice ? (
                            <div className="text-xs text-muted-foreground line-through">{item.originalPrice}</div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </Link>
                ))}
              </div>

              <Link href="/store/latest">
                <Button variant="outline" className="w-full rounded-[20px] border-border bg-background/40">
                  {t("storePage.viewAll")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
        ) : null}

        {homeSettings?.showFaq !== false ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">{t("storePage.faq.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("storePage.faq.description")}</p>
          </div>

          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-4">
              {faqItems.length > 0 ? (
                <Accordion type="single" collapsible className="space-y-3">
                  {faqItems.map((item) => (
                    <AccordionItem
                      key={item.id}
                      value={item.id}
                      className="overflow-hidden rounded-[22px] border border-border/70 bg-background/35 px-4"
                    >
                      <AccordionTrigger className="py-4 text-start text-base font-bold text-foreground hover:no-underline">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 text-sm leading-7 text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="rounded-[22px] border border-dashed border-border/70 bg-background/25 px-4 py-8 text-center text-sm leading-7 text-muted-foreground">
                  {t("storePage.faq.empty")}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
        ) : null}
      </main>

      <Sheet open={categorySheetOpen} onOpenChange={setCategorySheetOpen}>
        <SheetContent
          side={isRtl ? "right" : "left"}
          className="flex h-full w-full max-w-md flex-col overflow-hidden border-border bg-card/95"
          closeClassName="end-4"
          dir={dir}
        >
          <SheetHeader className="space-y-1 text-start">
            <SheetTitle className="text-base font-black">{t("storePage.categories.title")}</SheetTitle>
            <p className="text-xs text-muted-foreground">{t("storePage.categories.sheetDescription")}</p>
          </SheetHeader>
          <div className="pretty-scrollbar mt-5 min-h-0 flex-1 overflow-y-auto pb-2">
            <div className="grid grid-cols-2 gap-3">
            {storeCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setCategorySheetOpen(false);
                  setLocation(`/store/collection/${category.slug}`);
                }}
                className="group flex w-full flex-col items-center gap-2 rounded-[18px] border border-transparent p-2 text-center transition-all hover:border-border/70 hover:bg-background/35"
              >
                <div
                  className="flex h-24 w-full items-center justify-center overflow-hidden rounded-[16px] bg-white p-2 shadow-[0_16px_36px_-30px_rgba(0,0,0,0.8)] ring-1 ring-border/45 transition-transform group-hover:-translate-y-0.5"
                  style={category.imageUrl ? undefined : { background: gradients[Number(category.sortOrder || 0) % gradients.length] }}
                >
                  {category.imageUrl ? (
                    <img src={category.imageUrl} alt={category.name} className="h-full w-full object-contain" />
                  ) : (
                    <span className="px-2 text-xs font-bold leading-6 text-white">{category.name.slice(0, 10)}</span>
                  )}
                </div>
                <div className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-5 text-foreground">
                  {category.name}
                </div>
              </button>
            ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <MobileSiteMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        user={user}
        items={[
          ...publicMenuItems.map((item) => ({
            key: item.key,
            title: item.title,
            icon: item.icon,
            onSelect: () => navigateFromMenu(item.href),
          })),
          ...storePrivateMenuItems.map((item) => ({
            key: item.key,
            title: item.title,
            icon: item.icon,
            onSelect: () => navigateFromMenu(item.href),
          })),
          ...(showBookingEntryOnStore ? [{
            key: "booking",
            title: t("storePage.bookingEntry.title"),
            icon: ArrowLeft,
            onSelect: () => {
              setMenuOpen(false);
              if (typeof window !== "undefined") {
                window.sessionStorage.setItem("skip_store_default_redirect_once", "1");
              }
              setLocation("/booking");
            },
          }] : []),
          ...(canOpenSettings ? [{
            key: "settings",
            title: t("storePage.menu.settings"),
            icon: Settings,
            onSelect: () => navigateFromMenu("/panel"),
          }] : []),
        ]}
        loginAction={!user ? {
          label: t("storePage.menu.login"),
          icon: LogIn,
          onSelect: () => {
            setMenuOpen(false);
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem("skip_store_default_redirect_once", "1");
            }
            setLocation(appointmentBookingDisabled ? "/nutrition" : "/booking");
          },
        } : null}
        logoutAction={user ? async () => {
          setMenuOpen(false);
          await logout();
        } : null}
      />

      <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
        <SheetContent
          side={isRtl ? "left" : "right"}
          className="flex h-full w-full max-w-md flex-col overflow-hidden border-border bg-card/95"
          closeClassName="end-4"
          dir={dir}
        >
          <SheetHeader className="items-start text-start sm:text-start">
            <SheetTitle className="w-full text-start">{t("storePage.cart.title")}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4">
            <div className="rounded-[24px] border border-border/70 bg-background/35 p-4 text-sm leading-7 text-muted-foreground">
              {t("storePage.cart.description")}
            </div>

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
                        <button type="button" className="rounded-md p-1 hover:bg-muted" aria-label={t("storePage.cart.decrease")} onClick={() => updateStoreCartQuantity(item.productId, item.quantity - 1, item.stockQuantity)}>
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span>{format.number(item.quantity)}</span>
                        <button type="button" className="rounded-md p-1 hover:bg-muted" aria-label={t("storePage.cart.increase")} onClick={() => updateStoreCartQuantity(item.productId, item.quantity + 1, item.stockQuantity)}>
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" className="rounded-md p-1 text-destructive hover:bg-destructive/10" aria-label={t("storePage.cart.remove")} onClick={() => removeFromStoreCart(item.productId)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-[22px] border border-dashed border-border/70 bg-background/25 px-4 py-10 text-center text-sm text-muted-foreground">
                  {t("storePage.cart.empty")}
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-border/70 bg-card/95 pt-4 pb-1">
              <div className="flex items-center justify-between rounded-[22px] border border-primary/20 bg-primary/5 p-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">{t("storePage.cart.total")}</div>
                  <div className="text-lg font-black text-primary">{format.currency(cartSummary.subtotal)}</div>
                </div>
                <div className="rounded-full bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                  {t("storePage.cart.itemsCount", { count: format.number(cartSummary.itemsCount) })}
                </div>
              </div>

              <Link href="/store/checkout">
                <Button className="h-12 w-full rounded-[20px]" disabled={cartItems.length === 0}>
                  {t("storePage.cart.checkout")}
                </Button>
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
