import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ChefHat,
  Flame,
  Loader2,
  Pencil,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { cn } from "@/lib/utils";
import type { CookingRecipeFlag, CookingRecipeItem, CookingRecipeListPayload, TenantMeta } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const FLAGS: CookingRecipeFlag[] = ["important", "popular", "frequent", "low_calorie", "vegan", "affordable"];

const EMPTY_PAGINATION: CookingRecipeListPayload["pagination"] = {
  page: 1,
  perPage: 20,
  total: 0,
  totalPages: 1,
};

function pageWindow(current: number, total: number) {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

export default function PanelCookingRecipesPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [items, setItems] = useState<CookingRecipeItem[]>([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [flag, setFlag] = useState<"all" | CookingRecipeFlag>("all");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const moduleActive = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "cooking-recipes") ?? false;
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const pages = useMemo(() => pageWindow(pagination.page, pagination.totalPages), [pagination.page, pagination.totalPages]);

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) setTenantMeta(res.data);
    });
  }, []);

  useEffect(() => {
    if (!moduleActive) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    api.cookingRecipes.list({ page, search, status, flag: flag === "all" ? undefined : flag })
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setItems(res.data.items);
          setPagination(res.data.pagination);
        } else {
          setLoadError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [flag, moduleActive, page, reloadToken, search, status]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const changePage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > pagination.totalPages || nextPage === pagination.page) return;
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!moduleActive) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8" dir={dir}>
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <Button asChild variant="ghost" className="w-fit gap-2">
            <Link href="/panel"><BackIcon className="h-4 w-4" />{t("common.back")}</Link>
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <ShieldAlert className="h-10 w-10 text-muted-foreground" />
              <h1 className="text-xl font-bold">{t("panelCookingRecipes.inactive.title")}</h1>
              <p className="max-w-md text-sm text-muted-foreground">{t("panelCookingRecipes.inactive.description")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-cooking-recipes-page min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("panelCookingRecipes.title")}</h1>
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

      <main className="container mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t("panelCookingRecipes.managementDescription")}</p>
          <div className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
            <div className="text-xs text-muted-foreground">{t("panelCookingRecipes.totalRecipes")}</div>
            <div className="mt-1 text-2xl font-black text-primary">{format.number(pagination.total)}</div>
          </div>
        </div>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4 md:p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_210px]">
              <form onSubmit={submitSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder={t("panelCookingRecipes.search.placeholder")}
                    aria-label={t("panelCookingRecipes.search.label")}
                    className="h-11 ps-10"
                  />
                </div>
                <Button type="submit" className="h-11">{t("panelCookingRecipes.search.action")}</Button>
              </form>
              <Select value={status} onValueChange={(value: "all" | "active" | "inactive") => { setStatus(value); setPage(1); }}>
                <SelectTrigger className="h-11 text-start"><SelectValue /></SelectTrigger>
                <SelectContent dir={dir}>
                  <SelectItem value="all">{t("panelCookingRecipes.filters.allStatuses")}</SelectItem>
                  <SelectItem value="active">{t("panelCookingRecipes.status.active")}</SelectItem>
                  <SelectItem value="inactive">{t("panelCookingRecipes.status.inactive")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={flag} onValueChange={(value: "all" | CookingRecipeFlag) => { setFlag(value); setPage(1); }}>
                <SelectTrigger className="h-11 text-start"><SelectValue /></SelectTrigger>
                <SelectContent dir={dir}>
                  <SelectItem value="all">{t("panelCookingRecipes.filters.allFlags")}</SelectItem>
                  {FLAGS.map((item) => <SelectItem key={item} value={item}>{t(`panelCookingRecipes.flags.${item}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card><CardContent className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />{t("panelCookingRecipes.loading")}</CardContent></Card>
        ) : loadError ? (
          <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><ShieldAlert className="h-9 w-9 text-destructive" /><p>{t("panelCookingRecipes.loadError")}</p><Button variant="outline" onClick={() => setReloadToken((value) => value + 1)}>{t("panelCookingRecipes.retry")}</Button></CardContent></Card>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">{t("panelCookingRecipes.emptyFiltered")}</CardContent></Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((recipe) => (
              <Card key={recipe.id} className="group relative flex h-full flex-col overflow-hidden border-border/70 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                <div className={cn("h-1.5 w-full", recipe.isActive ? "bg-gradient-to-r from-emerald-400 via-primary to-cyan-400" : "bg-muted-foreground/30")} />
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="line-clamp-2 text-lg leading-7">{recipe.title}</CardTitle>
                    <Badge variant={recipe.isActive ? "default" : "secondary"} className="shrink-0">
                      {recipe.isActive ? t("panelCookingRecipes.status.active") : t("panelCookingRecipes.status.inactive")}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{recipe.isPublished ? t("panelCookingRecipes.status.published") : t("panelCookingRecipes.status.draft")}</Badge>
                    <Badge variant="outline">{t("panelCookingRecipes.orderBadge", { count: format.number(recipe.sortOrder) })}</Badge>
                    {recipe.flags.map((item) => (
                      <Badge key={item} className="gap-1 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        <Sparkles className="h-3 w-3" />{t(`panelCookingRecipes.flags.${item}`)}
                      </Badge>
                    ))}
                  </div>
                  {recipe.description ? <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{recipe.description}</p> : null}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-muted/60 p-2.5 text-center"><Users className="mx-auto h-4 w-4 text-primary" /><div className="mt-1 text-xs font-semibold">{t("panelCookingRecipes.servingsShort", { count: format.number(recipe.servings) })}</div></div>
                    <div className="rounded-xl bg-muted/60 p-2.5 text-center"><Flame className="mx-auto h-4 w-4 text-orange-500" /><div className="mt-1 text-xs font-semibold">{recipe.nutrition?.perServing?.calories_kcal !== undefined ? t("panelCookingRecipes.caloriesShort", { count: format.number(recipe.nutrition.perServing.calories_kcal, { maximumFractionDigits: 0 }) }) : t("panelCookingRecipes.notAvailable")}</div></div>
                    <div className="rounded-xl bg-muted/60 p-2.5 text-center"><ChefHat className="mx-auto h-4 w-4 text-emerald-600" /><div className="mt-1 text-xs font-semibold">{t("panelCookingRecipes.stepsShort", { count: format.number(recipe.instructionsJson.length) })}</div></div>
                  </div>
                  <div className="min-h-0 flex-1 rounded-xl border border-dashed bg-muted/20 p-3">
                    <div className="mb-2 text-xs font-bold text-foreground">{t("panelCookingRecipes.ingredientsPreview")}</div>
                    <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                      {recipe.ingredientsJson.slice(0, 3).map((item, index) => <li key={`${index}-${item}`} className="line-clamp-1">• {item}</li>)}
                    </ul>
                  </div>
                  <Button asChild className="w-full gap-2">
                    <Link href={`/panel/cooking-recipes/${recipe.id}/edit`}><Pencil className="h-4 w-4" />{t("panelCookingRecipes.editAction")}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && !loadError && pagination.totalPages > 1 ? (
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border bg-card p-3 sm:flex-row">
            <div className="text-sm text-muted-foreground">
              {t("panelCookingRecipes.pagination.summary", { current: format.number(pagination.page), total: format.number(pagination.totalPages), count: format.number(pagination.total) })}
            </div>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem><PaginationPrevious href="#" aria-disabled={pagination.page <= 1} className={cn(pagination.page <= 1 && "pointer-events-none opacity-50")} onClick={(event) => { event.preventDefault(); changePage(pagination.page - 1); }} /></PaginationItem>
                {pages.map((pageNumber) => (
                  <PaginationItem key={pageNumber} className="hidden sm:block">
                    <PaginationLink href="#" isActive={pageNumber === pagination.page} onClick={(event) => { event.preventDefault(); changePage(pageNumber); }}>{format.number(pageNumber)}</PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem><PaginationNext href="#" aria-disabled={pagination.page >= pagination.totalPages} className={cn(pagination.page >= pagination.totalPages && "pointer-events-none opacity-50")} onClick={(event) => { event.preventDefault(); changePage(pagination.page + 1); }} /></PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        ) : null}
      </main>
    </div>
  );
}
