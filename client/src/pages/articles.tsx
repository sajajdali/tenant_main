import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenText, CalendarDays, ChevronLeft, ChevronRight, Eye, Menu, Search, Sparkles, Tag, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileSiteMenu } from "@/components/mobile-site-menu";
import { useAuth } from "@/lib/auth";
import { isAppointmentBookingDisabled } from "@/lib/audience";
import { api } from "@/lib/api";
import { usePublicSiteMenuItems } from "@/hooks/use-public-site-menu-items";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import type { ArticleCategoryItem, ArticlePostItem, ArticlePostPublicListPayload, ArticleTagItem } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type ArticleListFilters = {
  q?: string;
  category?: string;
  tag?: string;
  page?: number;
};

function flattenCategoryOptions(items: ArticleCategoryItem[], depth = 0): Array<{ id: string; label: string; slug: string }> {
  return items.flatMap((item) => [
    { id: item.id, label: `${"— ".repeat(depth)}${item.name}`, slug: item.slug },
    ...flattenCategoryOptions(item.children ?? [], depth + 1),
  ]);
}

function parseFiltersFromWindow(): ArticleListFilters {
  if (typeof window === "undefined") {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get("page") || "1");

  return {
    q: params.get("q")?.trim() || undefined,
    category: params.get("category")?.trim() || undefined,
    tag: params.get("tag")?.trim() || undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function buildArticlesUrl(filters: ArticleListFilters): string {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.tag) {
    params.set("tag", filters.tag);
  }

  if ((filters.page ?? 1) > 1) {
    params.set("page", String(filters.page));
  }

  const query = params.toString();
  return query ? `/articles?${query}` : "/articles";
}

function ArticleImage({ article, className }: { article: ArticlePostItem; className: string }) {
  const t = useT();

  if (article.imageUrl) {
    return <img src={article.imageUrl} alt={article.title} className={className} />;
  }

  return (
    <div className={`article-image-placeholder flex items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),linear-gradient(180deg,rgba(9,20,31,0.95),rgba(8,18,29,0.98))] ${className}`}>
      <div className="text-center text-slate-300">
        <BookOpenText className="mx-auto h-9 w-9 text-amber-300" />
        <div className="mt-3 text-sm font-bold">{t("articlesPage.imageMissing")}</div>
      </div>
    </div>
  );
}

export default function ArticlesPage() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const { tenantMeta, publicMenuItems } = usePublicSiteMenuItems({
    includeBooking: true,
    showCustomerClub: !!user && user.role !== "admin" && user.role !== "barber",
  });
  const appointmentBookingDisabled = isAppointmentBookingDisabled(tenantMeta);
  const [draftSearch, setDraftSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeQuickSlide, setActiveQuickSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ArticlePostPublicListPayload | null>(null);
  const routeKey = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : location;

  useEffect(() => {
    const filters = parseFiltersFromWindow();

    setDraftSearch(filters.q ?? "");
    setLoading(true);

    api.articles.publicList({
      q: filters.q,
      category: filters.category,
      tag: filters.tag,
      page: filters.page ?? 1,
      perPage: 6,
    }).then((res) => {
      if (res.success) {
        setPayload(res.data);
      } else {
        setPayload(null);
      }

      setLoading(false);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }, [routeKey]);

  const navigateFromMenu = (href: string) => {
    setMenuOpen(false);
    setLocation(href);
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }

    setLocation(appointmentBookingDisabled ? "/nutrition" : "/booking");
  };

  const navigateWithFilters = (nextFilters: ArticleListFilters) => {
    setLocation(buildArticlesUrl(nextFilters));
  };

  const formatPublishedDate = (value?: string | null) => {
    return value ? format.date(value) : t("articlesPage.dateMissing");
  };

  const listingTitle = () => {
    if (!payload) {
      return t("articlesPage.listTitle");
    }

    if (payload.query) {
      return t("articlesPage.searchTitle", { query: payload.query });
    }

    if (payload.activeCategory) {
      return t("articlesPage.categoryTitle", { category: payload.activeCategory.name });
    }

    if (payload.activeTag) {
      return t("articlesPage.tagTitle", { tag: payload.activeTag.name });
    }

    return t("articlesPage.listTitle");
  };

  const listingDescription = () => {
    if (!payload) {
      return "";
    }

    if (payload.query) {
      return t("articlesPage.searchDescription");
    }

    if (payload.activeCategory) {
      return t("articlesPage.categoryDescription");
    }

    if (payload.activeTag) {
      return t("articlesPage.tagDescription");
    }

    return t("articlesPage.defaultDescription");
  };

  const articleSectionEnabled = tenantMeta?.articlesSettings?.enabled ?? false;
  const categoryOptions = useMemo(() => flattenCategoryOptions(payload?.categories ?? []), [payload?.categories]);
  const visibleTags = (payload?.tags ?? []).slice(0, 12);
  const quickSlides = payload?.slider ?? [];
  const hasListingContext = !!(payload?.query || payload?.activeCategory || payload?.activeTag || (payload?.currentPage ?? 1) > 1);
  const featuredArticle = payload?.featured ?? null;
  const importantArticle = payload?.important ?? null;
  const shouldShowFeaturedArticle = !!featuredArticle && featuredArticle.id !== importantArticle?.id;

  useEffect(() => {
    setActiveQuickSlide((current) => {
      if (quickSlides.length === 0) {
        return 0;
      }

      return current >= quickSlides.length ? 0 : current;
    });
  }, [quickSlides.length]);

  useEffect(() => {
    if (quickSlides.length <= 1 || hasListingContext) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveQuickSlide((current) => (current + 1) % quickSlides.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [hasListingContext, quickSlides.length]);

  if (!articleSectionEnabled) {
    return (
      <div className="articles-page flex min-h-screen items-center justify-center bg-[#06131d] px-4 text-white" dir={dir}>
        <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-8 text-center shadow-[0_30px_90px_-60px_rgba(0,0,0,0.55)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/25 bg-amber-300/10 text-amber-300">
            <BookOpenText className="h-7 w-7" />
          </div>
          <div className="text-2xl font-black text-white">{t("articlesPage.disabled.title")}</div>
          <p className="mt-3 text-sm leading-8 text-slate-300">{t("articlesPage.disabled.description")}</p>
          <div className="mt-6">
            <Link href={appointmentBookingDisabled ? "/nutrition" : "/booking"}>
              <Button className="rounded-full bg-amber-400 px-6 text-slate-950 hover:bg-amber-300">{t("articlesPage.backToSite")}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="articles-page flex min-h-screen items-center justify-center bg-[#06131d] px-4 text-white" dir={dir}>
        <div className="flex items-center gap-2 text-slate-300">
          <Search className="h-4 w-4 animate-pulse" />
          {t("articlesPage.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="articles-page min-h-screen bg-[#06131d] text-white" dir={dir}>
      <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_24%),radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_28%),linear-gradient(180deg,rgba(9,20,31,0.98)_0%,rgba(5,12,20,1)_100%)]">
        <div className="absolute end-10 top-16 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute start-10 top-8 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <header className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_34%),linear-gradient(180deg,rgba(9,20,31,0.92),rgba(5,12,20,0.9))] px-4 py-4 shadow-[0_24px_70px_-55px_rgba(0,0,0,0.55)] backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={handleBack} className="h-11 rounded-2xl border-white/10 bg-white/5 px-4 text-white hover:bg-white/10">
                {t("articlesPage.back")}
                <ArrowLeft className={`ms-2 h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />
              </Button>
              <div className="text-center">
                <div className="text-sm text-cyan-200">{t("articlesPage.eyebrow")}</div>
                <div className="mt-1 text-lg font-black text-white sm:text-xl">{t("articlesPage.headerTitle")}</div>
              </div>
              <Button type="button" variant="outline" size="icon" title={t("common.menu")} onClick={() => setMenuOpen(true)} className="h-11 w-11 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10">
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </header>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8 lg:pb-14">
          <div className={`grid gap-8 ${hasListingContext ? "lg:grid-cols-1" : "lg:grid-cols-[1.4fr_0.9fr] lg:items-start"}`}>
            <div className="space-y-5 lg:self-start">
              <Badge className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1.5 text-sm text-cyan-100 hover:bg-cyan-300/10">
                {hasListingContext ? t("articlesPage.archiveBadge") : t("articlesPage.eyebrow")}
              </Badge>
              <div className="space-y-3">
                <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">{listingTitle()}</h1>
                <p className="max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{listingDescription()}</p>
              </div>
            </div>

            {!hasListingContext ? (
              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_30px_90px_-50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    {t("articlesPage.slider.title")}
                  </div>
                  {quickSlides.length > 1 ? (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setActiveQuickSlide((current) => (current - 1 + quickSlides.length) % quickSlides.length)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10" aria-label={t("articlesPage.slider.previous")}>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setActiveQuickSlide((current) => (current + 1) % quickSlides.length)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10" aria-label={t("articlesPage.slider.next")}>
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="relative h-[280px] overflow-hidden rounded-[24px]">
                  <div className="relative h-full w-full">
                    {quickSlides.length > 0 ? quickSlides.map((article, index) => (
                      <Link
                        key={article.id}
                        href={`/articles/${article.id}`}
                        className={`absolute inset-0 block transition-all duration-500 ease-out ${index === activeQuickSlide ? "translate-x-0 opacity-100" : index < activeQuickSlide ? "-translate-x-6 pointer-events-none opacity-0" : "pointer-events-none translate-x-6 opacity-0"}`}
                      >
                        <article className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/30">
                          <ArticleImage article={article} className="h-[280px] w-full object-cover transition duration-500 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,19,29,0.08),rgba(6,19,29,0.72)_55%,rgba(6,19,29,0.96)_100%)]" />
                          <div className="absolute inset-x-0 bottom-0 p-5">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <Badge className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100 hover:bg-cyan-300/10">{article.categoryName || t("articlesPage.noCategory")}</Badge>
                              <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-slate-200 backdrop-blur">{formatPublishedDate(article.publishedAt)}</div>
                            </div>
                            <h3 className="line-clamp-2 text-2xl font-black leading-9 text-white">{article.title}</h3>
                            <p className="mt-3 line-clamp-2 text-sm leading-7 text-slate-200/90">{article.excerpt || t("articlesPage.excerptMissing")}</p>
                            <div className="mt-4 flex items-center justify-between gap-3">
                              <div className="text-xs text-slate-300">{t("articlesPage.views", { count: format.number(article.viewCount) })}</div>
                              <div className="inline-flex items-center gap-2 text-sm font-bold text-amber-300">
                                {t("articlesPage.viewPost")}
                                <ArrowLeft className={`h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />
                              </div>
                            </div>
                          </div>
                        </article>
                      </Link>
                    )) : (
                      <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.04] px-6 text-center text-sm leading-8 text-slate-300">
                        {t("articlesPage.slider.empty")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2">
                  {quickSlides.map((article, index) => (
                    <button key={article.id} type="button" onClick={() => setActiveQuickSlide(index)} className={`h-2.5 rounded-full transition-all ${index === activeQuickSlide ? "w-8 bg-amber-300" : "w-2.5 bg-white/20"}`} aria-label={t("articlesPage.slider.goTo", { index: format.number(index + 1) })} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-8">
            <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 shadow-[0_24px_70px_-55px_rgba(0,0,0,0.55)] sm:p-5">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const current = parseFiltersFromWindow();
                  navigateWithFilters({
                    q: draftSearch.trim() || undefined,
                    category: current.category,
                    tag: current.tag,
                    page: 1,
                  });
                }}
                className="flex w-full items-stretch"
              >
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder={t("articlesPage.searchPlaceholder")} className="h-11 rounded-e-none rounded-s-[18px] border-white/10 bg-white/5 pe-11 text-sm text-white shadow-none placeholder:text-slate-400" />
                </div>
                <Button type="submit" className="h-11 shrink-0 rounded-e-[18px] rounded-s-none border border-amber-300/20 bg-amber-400 px-4 text-slate-950 hover:bg-amber-300">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
            </section>

            {hasListingContext ? (
              <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_24px_70px_-55px_rgba(0,0,0,0.55)]">
                <div className="flex flex-wrap items-center gap-3">
                  {payload?.query ? <Badge className="rounded-full bg-amber-400 px-4 py-1.5 text-slate-950">{t("articlesPage.filter.query", { query: payload.query })}</Badge> : null}
                  {payload?.activeCategory ? <Badge className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1.5 text-cyan-100">{t("articlesPage.filter.category", { category: payload.activeCategory.name })}</Badge> : null}
                  {payload?.activeTag ? <Badge className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-4 py-1.5 text-fuchsia-100">{t("articlesPage.filter.tag", { tag: payload.activeTag.name })}</Badge> : null}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDraftSearch("");
                      navigateWithFilters({ page: 1 });
                    }}
                    className="h-10 rounded-full border-white/10 bg-white/5 px-4 text-white hover:bg-white/10"
                  >
                    {t("articlesPage.filter.clear")}
                    <X className="ms-2 h-4 w-4" />
                  </Button>
                </div>
              </section>
            ) : null}

            {!hasListingContext && importantArticle ? (
              <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,23,35,0.96),rgba(8,18,29,0.96))] shadow-[0_36px_100px_-60px_rgba(0,0,0,0.65)]">
                <div className="grid lg:grid-cols-[1.15fr_1fr]">
                  <div className="order-2 p-6 sm:p-8 lg:order-1">
                    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                      <Badge className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1 text-fuchsia-100 hover:bg-fuchsia-300/10">{t("articlesPage.importantBadge")}</Badge>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-4 w-4" />
                        {formatPublishedDate(importantArticle.publishedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {t("articlesPage.views", { count: format.number(importantArticle.viewCount) })}
                      </span>
                    </div>
                    <h2 className="text-2xl font-black leading-tight text-white sm:text-3xl">{importantArticle.title}</h2>
                    <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">{importantArticle.excerpt || t("articlesPage.excerptMissing")}</p>
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <Link href={`/articles/${importantArticle.id}`}>
                        <Button className="h-12 rounded-full bg-amber-400 px-6 text-slate-950 hover:bg-amber-300">
                          {t("articlesPage.readMore")}
                          <ArrowLeft className={`ms-2 h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />
                        </Button>
                      </Link>
                      <div className="text-sm text-slate-400">{t("articlesPage.author", { author: importantArticle.authorName })}</div>
                    </div>
                  </div>
                  <div className="order-1 lg:order-2">
                    <ArticleImage article={importantArticle} className="h-full min-h-[280px] w-full object-cover" />
                  </div>
                </div>
              </section>
            ) : null}

            {!hasListingContext && shouldShowFeaturedArticle && featuredArticle ? (
              <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,23,35,0.96),rgba(8,18,29,0.96))] shadow-[0_36px_100px_-60px_rgba(0,0,0,0.65)]">
                <div className="grid lg:grid-cols-[1.15fr_1fr]">
                  <div className="order-2 p-6 sm:p-8 lg:order-1">
                    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                      <Badge className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100 hover:bg-cyan-300/10">{featuredArticle.categoryName || t("articlesPage.noCategory")}</Badge>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-4 w-4" />
                        {formatPublishedDate(featuredArticle.publishedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {t("articlesPage.views", { count: format.number(featuredArticle.viewCount) })}
                      </span>
                    </div>
                    <h2 className="text-2xl font-black leading-tight text-white sm:text-3xl">{featuredArticle.title}</h2>
                    <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">{featuredArticle.excerpt || t("articlesPage.excerptMissing")}</p>
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <Link href={`/articles/${featuredArticle.id}`}>
                        <Button className="h-12 rounded-full bg-amber-400 px-6 text-slate-950 hover:bg-amber-300">
                          {t("articlesPage.readMore")}
                          <ArrowLeft className={`ms-2 h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />
                        </Button>
                      </Link>
                      <div className="text-sm text-slate-400">{t("articlesPage.author", { author: featuredArticle.authorName })}</div>
                    </div>
                  </div>
                  <div className="order-1 lg:order-2">
                    <ArticleImage article={featuredArticle} className="h-full min-h-[280px] w-full object-cover" />
                  </div>
                </div>
              </section>
            ) : null}

            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-white">{listingTitle()}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {t("articlesPage.resultCount", { shown: format.number(payload?.items.length ?? 0), total: format.number(payload?.total ?? 0) })}
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {(payload?.items ?? []).map((article) => (
                  <article key={article.id} className="group overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] shadow-[0_24px_70px_-55px_rgba(0,0,0,0.55)] transition hover:-translate-y-1 hover:shadow-[0_35px_90px_-50px_rgba(0,0,0,0.62)]">
                    <div className="relative overflow-hidden">
                      <ArticleImage article={article} className="h-56 w-full object-cover transition duration-500 group-hover:scale-105" />
                      <div className="absolute inset-x-4 top-4 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => navigateWithFilters({ category: article.categorySlug ?? undefined, page: 1 })}
                          className="rounded-full border border-white/10 bg-[#06131d]/85 px-3 py-1 text-xs text-cyan-100 transition hover:bg-[#06131d]"
                        >
                          {article.categoryName || t("articlesPage.noCategory")}
                        </button>
                        <div className="rounded-full bg-slate-950/70 px-3 py-1 text-xs text-white backdrop-blur">{article.authorName}</div>
                      </div>
                    </div>
                    <div className="space-y-4 p-5">
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{formatPublishedDate(article.publishedAt)}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-500" />
                        <span>{t("articlesPage.views", { count: format.number(article.viewCount) })}</span>
                      </div>
                      <h4 className="line-clamp-2 text-xl font-black leading-8 text-white">{article.title}</h4>
                      <p className="line-clamp-3 text-sm leading-7 text-slate-300">{article.excerpt || t("articlesPage.excerptMissing")}</p>
                      <Link href={`/articles/${article.id}`}>
                        <div className="inline-flex items-center gap-2 text-sm font-bold text-amber-300">
                          {t("articlesPage.readMore")}
                          <ChevronLeft className={`h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />
                        </div>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              {(payload?.total ?? 0) === 0 ? (
                <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center">
                  <div className="text-xl font-black text-white">{t("articlesPage.empty.title")}</div>
                  <p className="mt-3 text-sm leading-8 text-slate-300">{t("articlesPage.empty.description")}</p>
                </div>
              ) : null}

              {(payload?.lastPage ?? 1) > 1 ? (
                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] px-5 py-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-slate-300">
                      {t("articlesPage.pagination.page", { current: format.number(payload?.currentPage ?? 1), total: format.number(payload?.lastPage ?? 1) })}
                    </div>
                    <Pagination className="mx-0 w-auto justify-start">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              if ((payload?.currentPage ?? 1) > 1) {
                                const current = parseFiltersFromWindow();
                                navigateWithFilters({ ...current, page: (payload?.currentPage ?? 1) - 1 });
                              }
                            }}
                            className={(payload?.currentPage ?? 1) <= 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        <PaginationItem>
                          <span className="px-3 text-sm text-slate-300">
                            {t("articlesPage.pagination.total", { total: format.number(payload?.total ?? 0) })}
                          </span>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              if ((payload?.currentPage ?? 1) < (payload?.lastPage ?? 1)) {
                                const current = parseFiltersFromWindow();
                                navigateWithFilters({ ...current, page: (payload?.currentPage ?? 1) + 1 });
                              }
                            }}
                            className={(payload?.currentPage ?? 1) >= (payload?.lastPage ?? 1) ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_24px_70px_-55px_rgba(0,0,0,0.55)]">
              <div className="text-lg font-black text-white">{t("articlesPage.popular.title")}</div>
              <div className="mt-5 space-y-5">
                {(payload?.popular ?? []).map((article, index) => (
                  <Link key={article.id} href={`/articles/${article.id}`} className="block">
                    <div className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/20 hover:bg-white/[0.06]">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-slate-950">{format.number(index + 1)}</div>
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-sm font-bold leading-7 text-white">{article.title}</div>
                        <div className="mt-1 text-xs text-slate-400">{t("articlesPage.views", { count: format.number(article.viewCount) })}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_24px_70px_-55px_rgba(0,0,0,0.55)]">
              <div className="flex items-center gap-2 text-lg font-black text-white">
                <Tag className="h-5 w-5 text-amber-300" />
                {t("articlesPage.tags.title")}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const current = parseFiltersFromWindow();
                    navigateWithFilters({ q: current.q, category: current.category, page: 1 });
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs ${!payload?.activeTag ? "bg-amber-400 text-slate-950" : "border border-white/10 bg-white/[0.04] text-slate-300"}`}
                >
                  {t("articlesPage.tags.all")}
                </button>
                {visibleTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      const current = parseFiltersFromWindow();
                      navigateWithFilters({ q: current.q, category: current.category, tag: tag.slug, page: 1 });
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs ${payload?.activeTag?.slug === tag.slug ? "bg-amber-400 text-slate-950" : "border border-white/10 bg-white/[0.04] text-slate-300"}`}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_24px_70px_-55px_rgba(0,0,0,0.55)]">
              <div className="text-lg font-black text-white">{t("articlesPage.categories.title")}</div>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const current = parseFiltersFromWindow();
                    navigateWithFilters({ q: current.q, tag: current.tag, page: 1 });
                  }}
                  className={`w-full rounded-2xl px-4 py-3 text-start text-sm font-bold ${!payload?.activeCategory ? "bg-amber-400 text-slate-950" : "border border-white/10 bg-white/[0.04] text-slate-300"}`}
                >
                  {t("articlesPage.categories.all")}
                </button>
                {categoryOptions.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      const current = parseFiltersFromWindow();
                      navigateWithFilters({ q: current.q, tag: current.tag, category: category.slug, page: 1 });
                    }}
                    className={`w-full rounded-2xl px-4 py-3 text-start text-sm font-bold ${payload?.activeCategory?.slug === category.slug ? "bg-amber-400 text-slate-950" : "border border-white/10 bg-white/[0.04] text-slate-300"}`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <MobileSiteMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={t("articlesPage.menuTitle")}
        user={user}
        items={publicMenuItems.map((item) => ({
          key: item.key,
          title: item.title,
          icon: item.icon,
          onSelect: () => navigateFromMenu(item.href),
        }))}
        logoutAction={user ? logout : null}
      />
    </div>
  );
}
