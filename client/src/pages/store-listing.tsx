import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Search, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { isStorefrontCacheFresh, readStorefrontCache, writeStorefrontCache } from "@/lib/storefront-cache";
import type { StoreCategoryItem, StoreProductItem } from "@/lib/types";

const ITEMS_PER_PAGE = 12;
const normalizeForSearch = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\u064A]/g, "\u06CC")
    .replace(/[\u0643]/g, "\u06A9")
    .replace(/\s+/g, " ")
    .trim();

export default function StoreListingPage() {
  const [, setLocation] = useLocation();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const format = useFormat();
  const tenantMeta = getInitialTenantMeta();
  const [isPopular] = useRoute("/store/popular");
  const [isLatest] = useRoute("/store/latest");
  const [isSearch] = useRoute("/store/search");
  const [, legacyParams] = useRoute("/store/collection/:slug");
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const [searchValue, setSearchValue] = useState(query);
  const [storeProducts, setStoreProducts] = useState<StoreProductItem[]>([]);
  const [storeCategories, setStoreCategories] = useState<StoreCategoryItem[]>([]);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const PreviousIcon = isRtl ? ChevronLeft : ChevronRight;
  const NextIcon = isRtl ? ChevronRight : ChevronLeft;

  useEffect(() => {
    const cachedStorefront = readStorefrontCache(tenantMeta);
    if (cachedStorefront) {
      setStoreProducts(cachedStorefront.products);
      setStoreCategories(cachedStorefront.categories);
    }

    if (isStorefrontCacheFresh(cachedStorefront)) {
      return;
    }

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
  }, [tenantMeta]);

  const config = useMemo(() => {
    const legacySlug = legacyParams?.slug;
    const normalizedQuery = normalizeForSearch(query);
    const selectedCategory = legacySlug
      ? storeCategories.find((category) => category.slug === legacySlug)
      : null;

    if (isLatest || legacySlug === "latest") {
      return {
        title: t("storeListing.latest.title"),
        description: t("storeListing.latest.description"),
        path: "/store/latest",
        items: [...storeProducts].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      };
    }

    if (isPopular || legacySlug === "popular") {
      return {
        title: t("storeListing.popular.title"),
        description: t("storeListing.popular.description"),
        path: "/store/popular",
        items: storeProducts.filter((item) => item.isPopular),
      };
    }

    if (isSearch) {
      const filtered = storeProducts.filter(
        (item) =>
          !normalizedQuery ||
          normalizeForSearch(item.title).includes(normalizedQuery) ||
          normalizeForSearch(item.slug).includes(normalizedQuery) ||
          normalizeForSearch(item.subtitle || "").includes(normalizedQuery) ||
          normalizeForSearch(item.description || "").includes(normalizedQuery) ||
          normalizeForSearch(item.categoryName || "").includes(normalizedQuery),
      );

      return {
        title: query ? t("storeListing.search.resultsTitle", { query }) : t("storeListing.search.title"),
        description: query ? t("storeListing.search.resultsDescription") : t("storeListing.search.description"),
        path: "/store/search",
        items: filtered,
      };
    }

    if (selectedCategory) {
      return {
        title: t("storeListing.category.title", { category: selectedCategory.name }),
        description: t("storeListing.category.description"),
        path: `/store/collection/${selectedCategory.slug}`,
        items: storeProducts.filter((item) => item.categoryId === selectedCategory.id),
      };
    }

    return {
      title: t("storeListing.bestsellers.title"),
      description: t("storeListing.bestsellers.description"),
      path: "/store/bestsellers",
      items: storeProducts.filter((item) => item.isBestseller),
    };
  }, [isLatest, isPopular, isSearch, legacyParams?.slug, query, storeCategories, storeProducts, t]);

  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(config.items.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const items = config.items.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => {
    document.title = t("storeListing.documentTitle", { title: config.title });
  }, [config.title, t]);

  useEffect(() => {
    if (safePage !== page) {
      const params = new URLSearchParams(window.location.search);
      params.set("page", String(safePage));
      setLocation(`${config.path}?${params.toString()}`);
    }
  }, [config.path, page, safePage, setLocation]);

  const updatePage = (nextPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(nextPage));
    const queryString = params.toString();
    setLocation(`${config.path}${queryString ? `?${queryString}` : ""}`);
  };

  const handleSearch = (value: string) => {
    const params = new URLSearchParams();
    if (value.trim()) {
      params.set("q", value.trim());
    }
    params.set("page", "1");
    setLocation(`/store/search?${params.toString()}`);
  };
  const openProductDetails = (productId: string) => {
    setLocation(`/store/product/${productId}`);
  };

  return (
    <div className="store-page min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_45%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="border-b border-border/70 bg-card/40 backdrop-blur-md">
        <div className="container mx-auto max-w-6xl px-4 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm text-primary">{t("storeListing.eyebrow")}</div>
              <h1 className="text-2xl font-black text-foreground">{config.title}</h1>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
            <Link href="/store">
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40" aria-label={t("storeListing.backToStore")}>
                <BackIcon className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="rounded-[28px] border border-border/70 bg-card/55 p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch((event.target as HTMLInputElement).value);
                  }
                }}
                placeholder={t("storeListing.search.placeholder")}
                className="h-14 rounded-[22px] border-border bg-background/60 ps-12 text-base"
              />
            </div>
            <Button variant="outline" className="h-14 rounded-[22px] border-border bg-background/40" onClick={() => handleSearch(searchValue)}>
              {t("storeListing.search.button")}
            </Button>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-end gap-3 rounded-[24px] border border-border/70 bg-card/55 p-4">
          <div className="rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">
            {t("storeListing.productCount", { count: format.number(config.items.length) })}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openProductDetails(item.id)}
              className="text-start"
            >
              <Card className="overflow-hidden border-border/70 bg-card/60 transition-all hover:border-primary/35">
                <div
                  className="relative h-40 overflow-hidden sm:h-56"
                  style={{ background: "linear-gradient(135deg, #17324d 0%, #f59e0b 100%)" }}
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className="absolute inset-0 h-full w-full object-cover opacity-35" />
                  ) : null}
                  <div className="absolute inset-y-0 start-0 w-20 bg-white/10 blur-2xl" />
                  <div className="relative flex h-full items-start justify-between p-4 text-white">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.isBestseller ? (
                        <div className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                          {t("storeListing.badge.bestseller")}
                        </div>
                      ) : null}
                      {item.isFeatured ? (
                        <div className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                          {t("storeListing.badge.featured")}
                        </div>
                      ) : null}
                      {item.discountedPriceAmount && item.priceAmount > item.discountedPriceAmount ? (
                        <div className="rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white shadow-[0_10px_25px_-12px_rgba(239,68,68,0.9)]">
                          {t("storeListing.badge.discount", { percent: format.percent((item.priceAmount - item.discountedPriceAmount) / item.priceAmount) })}
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-white/20 bg-black/10 px-3 py-2 text-xs backdrop-blur">
                      {item.title.slice(0, 14)}
                    </div>
                  </div>
                </div>
                <CardContent className="space-y-3 p-3 sm:p-5">
                  <div className="space-y-1">
                    <div className="line-clamp-2 text-sm font-black text-foreground sm:text-lg">{item.title}</div>
                    <div className="line-clamp-2 text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-7">{item.subtitle || item.description || t("storeListing.productFallback")}</div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-1">
                      {item.discountedPriceAmount ? (
                        <div className="text-xs text-muted-foreground line-through sm:text-sm">{format.currency(item.priceAmount)}</div>
                      ) : null}
                      <div className="text-sm font-black text-primary sm:text-lg">{format.currency(item.discountedPriceAmount ?? item.priceAmount)}</div>
                    </div>
                    <div className="inline-flex h-10 items-center rounded-2xl bg-primary/10 px-3 text-xs font-bold text-primary sm:text-sm">
                      <ShoppingBag className="me-1 h-4 w-4" />
                      {t("storeListing.viewDetails")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </section>
        {items.length === 0 ? (
          <section className="space-y-4 rounded-[28px] border border-dashed border-border/70 bg-card/45 p-8 text-center text-sm text-muted-foreground">
            <div>{t("storeListing.empty")}</div>
            <div className="flex justify-center">
              <Link href="/store/latest">
                <Button variant="outline" className="rounded-2xl border-border bg-background/40">
                  {t("storeListing.backToProducts")}
                </Button>
              </Link>
            </div>
          </section>
        ) : null}

        {config.items.length > 0 && totalPages > 1 ? (
          <section className="rounded-[28px] border border-border/70 bg-card/55 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {t("storeListing.pagination.page", { current: format.number(safePage), total: format.number(totalPages) })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl border-border bg-background/40"
                  onClick={() => updatePage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                >
                  <PreviousIcon className="me-2 h-4 w-4" />
                  {t("storeListing.pagination.previous")}
                </Button>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <Button
                    key={pageNumber}
                    variant={pageNumber === safePage ? "default" : "outline"}
                    className="h-11 min-w-[2.75rem] rounded-2xl"
                  onClick={() => updatePage(pageNumber)}
                >
                    {format.number(pageNumber)}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  className="rounded-2xl border-border bg-background/40"
                  onClick={() => updatePage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage >= totalPages}
                >
                  {t("storeListing.pagination.next")}
                  <NextIcon className="ms-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
