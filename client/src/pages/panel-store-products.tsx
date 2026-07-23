import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Box, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import type { StoreCategoryItem, StoreProductItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/\s+/g, " ")
    .trim();
}

export default function PanelStoreProductsPage() {
  const { isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const { dir, isRtl } = useLocale();
  const format = useFormat();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [categories, setCategories] = useState<StoreCategoryItem[]>([]);
  const [items, setItems] = useState<StoreProductItem[]>([]);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState("all");
  const [placement, setPlacement] = useState("all");

  const loadData = async () => {
    setLoading(true);
    const [categoriesRes, productsRes] = await Promise.all([api.store.listCategories(), api.store.listProducts()]);

    if (categoriesRes.success) {
      setCategories(categoriesRes.data.items);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: categoriesRes.message || t("panelStoreProducts.toast.categoriesFailed") });
    }

    if (productsRes.success) {
      setItems(productsRes.data.items);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: productsRes.message || t("panelStoreProducts.toast.productsFailed") });
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!isPrimaryAdmin) {
      return;
    }

    loadData();
  }, [isPrimaryAdmin]);

  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    return [...items]
      .filter((item) => {
        if (categoryId !== "all" && (item.categoryId || "none") !== categoryId) {
          return false;
        }

        if (status === "active" && !item.isActive) {
          return false;
        }
        if (status === "inactive" && item.isActive) {
          return false;
        }
        if (status === "discounted" && !item.discountedPriceAmount) {
          return false;
        }
        if (status === "out-of-stock" && item.stockQuantity > 0) {
          return false;
        }

        if (placement === "featured" && !item.isFeatured) {
          return false;
        }
        if (placement === "bestseller" && !item.isBestseller) {
          return false;
        }
        if (placement === "popular" && !item.isPopular) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystack = normalizeSearch(
          [
            item.title,
            item.slug,
            item.subtitle || "",
            item.categoryName || categoryById.get(item.categoryId || "") || "",
            String(item.priceAmount),
            item.discountedPriceAmount ? String(item.discountedPriceAmount) : "",
          ].join(" "),
        );

        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [categoryById, categoryId, items, placement, query, status]);

  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelStoreProducts.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelStoreProducts.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelStoreProducts.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const hasFilters = Boolean(query.trim()) || categoryId !== "all" || status !== "all" || placement !== "all";

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="space-y-1 text-start">
            <h1 className="text-xl font-bold">{t("panelStoreProducts.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelStoreProducts.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/panel/store-settings/products/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {t("panelStoreProducts.addProduct")}
              </Button>
            </Link>
            <Link href="/panel/store-settings">
              <Button variant="outline" size="icon" title={t("common.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
                <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>{t("panelStoreProducts.filters.title")}</CardTitle>
            <CardDescription>{t("panelStoreProducts.filters.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(180px,1fr))_auto]">
              <div className="space-y-2">
                <Label htmlFor="product-search">{t("panelStoreProducts.search.label")}</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="product-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("panelStoreProducts.search.placeholder")}
                    className="ps-9 text-start"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-category-filter">{t("panelStoreProducts.category.label")}</Label>
                <select
                  id="product-category-filter"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-start"
                >
                  <option value="all">{t("panelStoreProducts.category.all")}</option>
                  <option value="none">{t("panelStoreProducts.category.none")}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-status-filter">{t("panelStoreProducts.status.label")}</Label>
                <select
                  id="product-status-filter"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-start"
                >
                  <option value="all">{t("panelStoreProducts.status.all")}</option>
                  <option value="active">{t("panelStoreProducts.status.active")}</option>
                  <option value="inactive">{t("panelStoreProducts.status.inactive")}</option>
                  <option value="discounted">{t("panelStoreProducts.status.discounted")}</option>
                  <option value="out-of-stock">{t("panelStoreProducts.status.outOfStock")}</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-placement-filter">{t("panelStoreProducts.placement.label")}</Label>
                <select
                  id="product-placement-filter"
                  value={placement}
                  onChange={(event) => setPlacement(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-start"
                >
                  <option value="all">{t("panelStoreProducts.placement.all")}</option>
                  <option value="featured">{t("panelStoreProducts.badge.featured")}</option>
                  <option value="bestseller">{t("panelStoreProducts.badge.bestseller")}</option>
                  <option value="popular">{t("panelStoreProducts.badge.popular")}</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  disabled={!hasFilters}
                  onClick={() => {
                    setQuery("");
                    setCategoryId("all");
                    setStatus("all");
                    setPlacement("all");
                  }}
                >
                  <X className="h-4 w-4" />
                  {t("panelStoreProducts.clearFilters")}
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              {t("panelStoreProducts.filters.resultCount", { count: format.number(filteredItems.length), total: format.number(items.length) })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>{t("panelStoreProducts.list.title")}</CardTitle>
            <CardDescription>{t("panelStoreProducts.list.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-52 items-center justify-center text-muted-foreground">
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("common.loading")}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex h-52 flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/70 bg-background/20 text-center">
                <Box className="mb-3 h-10 w-10 text-primary/70" />
                <div className="font-bold">{items.length === 0 ? t("panelStoreProducts.empty.noProducts") : t("panelStoreProducts.empty.noResults")}</div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-[2rem] border border-border/70 bg-background/30">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="h-44 w-full object-cover" />
                    ) : (
                      <div className="flex h-44 items-center justify-center bg-background/50 text-sm text-muted-foreground">{t("panelStoreProducts.imageMissing")}</div>
                    )}
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1 text-start">
                          <div className="truncate font-bold">{item.title}</div>
                          <CodeText className="block truncate text-xs text-muted-foreground">{item.slug}</CodeText>
                          <div className="text-xs text-muted-foreground">
                            {t("panelStoreProducts.card.meta", {
                              category: item.categoryName || categoryById.get(item.categoryId || "") || t("panelStoreProducts.category.none"),
                              sortOrder: format.number(item.sortOrder),
                            })}
                          </div>
                        </div>
                        <div className={`shrink-0 rounded-full px-3 py-1 text-xs ${item.isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {item.isActive ? t("panelStoreProducts.status.active") : t("panelStoreProducts.status.inactive")}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        {item.isFeatured ? <span className="rounded-full bg-primary/15 px-3 py-1 text-primary">{t("panelStoreProducts.badge.featured")}</span> : null}
                        {item.isBestseller ? <span className="rounded-full bg-primary/15 px-3 py-1 text-primary">{t("panelStoreProducts.badge.bestseller")}</span> : null}
                        {item.isPopular ? <span className="rounded-full bg-primary/15 px-3 py-1 text-primary">{t("panelStoreProducts.badge.popular")}</span> : null}
                        {item.stockQuantity <= 0 ? <span className="rounded-full bg-destructive/15 px-3 py-1 text-destructive">{t("panelStoreProducts.status.outOfStock")}</span> : null}
                        {!item.reviewsEnabled ? <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">{t("panelStoreProducts.badge.reviewsDisabled")}</span> : null}
                      </div>

                      <div className="space-y-1">
                        {item.discountedPriceAmount ? (
                          <>
                            <div className="text-xs text-muted-foreground line-through">{format.currency(item.priceAmount)}</div>
                            <div className="text-lg font-black text-primary">{format.currency(item.discountedPriceAmount)}</div>
                          </>
                        ) : (
                          <div className="text-lg font-black text-primary">{format.currency(item.priceAmount)}</div>
                        )}
                        <div className="text-xs text-muted-foreground">{t("panelStoreProducts.card.stock", { count: format.number(item.stockQuantity) })}</div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/panel/store-settings/products/${item.id}/edit`}>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Pencil className="h-4 w-4" />
                            {t("panelStoreProducts.actions.edit")}
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={deletingId === item.id}
                          onClick={async () => {
                            const shouldDelete = window.confirm(t("panelStoreProducts.confirmDelete", { title: item.title }));
                            if (!shouldDelete) {
                              return;
                            }
                            setDeletingId(item.id);
                            const res = await api.store.deleteProduct(item.id);
                            setDeletingId(null);
                            if (!res.success) {
                              toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelStoreProducts.toast.deleteFailed") });
                              return;
                            }
                            toast({ title: t("panelStoreProducts.toast.deleteSuccess"), description: res.message });
                            await loadData();
                          }}
                          title={t("panelStoreProducts.actions.delete")}
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
      </main>
    </div>
  );
}
