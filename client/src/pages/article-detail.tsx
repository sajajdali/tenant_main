import { useEffect, useState } from "react";
import { ArrowLeft, BookOpenText, CalendarDays, Eye, Menu, Share2, User2 } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileSiteMenu } from "@/components/mobile-site-menu";
import { useAuth } from "@/lib/auth";
import { isAppointmentBookingDisabled } from "@/lib/audience";
import { api } from "@/lib/api";
import { usePublicSiteMenuItems } from "@/hooks/use-public-site-menu-items";
import type { ArticlePostItem } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";

function ArticleImage({ article, className }: { article: ArticlePostItem; className: string }) {
  const t = useT();

  if (article.imageUrl) {
    return <img src={article.imageUrl} alt={article.title} className={className} />;
  }

  return (
    <div className={`article-image-placeholder flex items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),linear-gradient(180deg,rgba(9,20,31,0.95),rgba(8,18,29,0.98))] ${className}`}>
      <div className="text-center text-slate-300">
        <BookOpenText className="mx-auto h-9 w-9 text-amber-300" />
        <div className="mt-3 text-sm font-bold">{t("articleDetail.imageMissing")}</div>
      </div>
    </div>
  );
}

export default function ArticleDetailPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/articles/:id");
  const { user, logout } = useAuth();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const { tenantMeta, publicMenuItems } = usePublicSiteMenuItems({
    includeBooking: true,
    showCustomerClub: !!user && user.role !== "admin" && user.role !== "barber",
  });
  const appointmentBookingDisabled = isAppointmentBookingDisabled(tenantMeta);
  const [article, setArticle] = useState<ArticlePostItem | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<ArticlePostItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const articleSectionEnabled = tenantMeta?.articlesSettings?.enabled ?? false;

  useEffect(() => {
    if (!params?.id) {
      setLoading(false);
      return;
    }

    api.articles.publicDetail(params.id).then((res) => {
      if (res.success) {
        setArticle(res.data.item);
        setRelatedArticles(res.data.related);
      } else {
        setArticle(null);
        setRelatedArticles([]);
      }
      setLoading(false);
    });
  }, [params?.id]);

  const navigateFromMenu = (href: string) => {
    setMenuOpen(false);
    setLocation(href);
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }

    setLocation("/articles");
  };

  const formatPublishedDate = (value?: string | null) => {
    return value ? format.date(value) : t("articleDetail.dateMissing");
  };

  if (!articleSectionEnabled) {
    return (
      <div className="article-detail-page articles-page flex min-h-screen items-center justify-center bg-[#06131d] px-4 text-white" dir={dir}>
        <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-8 text-center shadow-[0_30px_90px_-60px_rgba(0,0,0,0.55)]">
          <div className="text-2xl font-black text-white">{t("articleDetail.disabled.title")}</div>
          <p className="mt-3 text-sm leading-7 text-slate-300">{t("articleDetail.disabled.description")}</p>
          <Link href={appointmentBookingDisabled ? "/nutrition" : "/booking"}>
            <Button className="mt-6 rounded-full bg-amber-400 px-6 text-slate-950 hover:bg-amber-300">{t("articleDetail.backToSite")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="article-detail-page articles-page flex min-h-screen items-center justify-center bg-[#06131d] px-4 text-white" dir={dir}>
        <div className="text-slate-300">{t("articleDetail.loading")}</div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="article-detail-page articles-page flex min-h-screen items-center justify-center bg-[#06131d] px-4 text-white" dir={dir}>
        <div className="w-full max-w-lg rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-8 text-center shadow-[0_30px_90px_-60px_rgba(0,0,0,0.55)]">
          <div className="text-2xl font-black text-white">{t("articleDetail.notFound.title")}</div>
          <p className="mt-3 text-sm leading-7 text-slate-300">{t("articleDetail.notFound.description")}</p>
          <Link href="/articles">
            <Button className="mt-6 rounded-full bg-amber-400 px-6 text-slate-950 hover:bg-amber-300">{t("articleDetail.backToArticles")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="article-detail-page articles-page min-h-screen bg-[#06131d] text-white" dir={dir}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-8 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_34%),linear-gradient(180deg,rgba(9,20,31,0.92),rgba(5,12,20,0.9))] px-4 py-4 shadow-[0_24px_70px_-55px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={handleBack} className="h-11 rounded-2xl border-white/10 bg-white/5 px-4 text-white hover:bg-white/10">
              {t("articleDetail.back")}
              <ArrowLeft className={`ms-2 h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
            <div className="text-center">
              <div className="text-sm text-cyan-200">{t("articleDetail.eyebrow")}</div>
              <div className="mt-1 text-lg font-black text-white sm:text-xl">{t("articleDetail.headerTitle")}</div>
            </div>
            <Button type="button" variant="outline" size="icon" title={t("common.menu")} onClick={() => setMenuOpen(true)} className="h-11 w-11 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <article className="overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,23,35,0.96),rgba(8,18,29,0.96))] shadow-[0_40px_120px_-65px_rgba(0,0,0,0.65)]">
          <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_26%),radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_28%),linear-gradient(180deg,rgba(9,20,31,0.96),rgba(8,18,29,0.98))] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
            <div className="absolute start-0 top-0 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl" />
            <div className="absolute end-0 top-10 h-36 w-36 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="relative max-w-4xl space-y-5">
              <Badge className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1.5 text-cyan-100 hover:bg-cyan-300/10">{article.categoryName || t("articleDetail.noCategory")}</Badge>
              <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">{article.title}</h1>
              <p className="max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">{article.excerpt || t("articleDetail.excerptMissing")}</p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2">
                  <User2 className="h-4 w-4" />
                  {article.authorName}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2">
                  <CalendarDays className="h-4 w-4" />
                  {formatPublishedDate(article.publishedAt)}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2">
                  <Eye className="h-4 w-4" />
                  {t("articleDetail.views", { count: format.number(article.viewCount) })}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/12 px-4 py-2 text-amber-100">
                  <Share2 className="h-4 w-4" />
                  {t("articleDetail.share")}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-8 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:px-12 lg:py-10">
            <div className="space-y-8">
              {article.imageUrl ? (
                <div className="overflow-hidden rounded-[28px] border border-white/10">
                  <ArticleImage article={article} className="h-[260px] w-full object-cover sm:h-[360px]" />
                </div>
              ) : (
                <div className="overflow-hidden rounded-[28px] border border-white/10">
                  <ArticleImage article={article} className="h-[260px] w-full sm:h-[360px]" />
                </div>
              )}

              {(article.keyPoints ?? []).length > 0 ? (
                <section className="rounded-[28px] border border-amber-300/20 bg-amber-300/[0.07] p-5">
                  <div className="text-lg font-black text-amber-100">{t("articleDetail.keyPoints")}</div>
                  <ul className="mt-4 space-y-3">
                    {(article.keyPoints ?? []).map((point, index) => (
                      <li key={`${point}-${index}`} className="flex gap-3 text-sm font-semibold leading-7 text-amber-50/90">
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-300" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="space-y-6 whitespace-pre-wrap text-[17px] leading-9 text-slate-200">
                {article.content || t("articleDetail.contentMissing")}
              </div>
            </div>

            <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
              <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <div className="text-lg font-black text-white">{t("articleDetail.info.title")}</div>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>{t("articleDetail.info.author")}</span>
                    <span className="font-bold text-white">{article.authorName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{t("articleDetail.info.category")}</span>
                    <Link href={article.categorySlug ? `/articles?category=${article.categorySlug}` : "/articles"}>
                      <span className="font-bold text-cyan-200">{article.categoryName || t("articleDetail.noCategory")}</span>
                    </Link>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{t("articleDetail.info.publishedAt")}</span>
                    <span className="font-bold text-white">{formatPublishedDate(article.publishedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{t("articleDetail.info.views")}</span>
                    <span className="font-bold text-white">{format.number(article.viewCount)}</span>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <div className="text-lg font-black text-white">{t("articleDetail.tags")}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <Link key={tag.id} href={`/articles?tag=${tag.slug}`}>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">#{tag.name}</span>
                    </Link>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </article>

        <section className="mt-10 space-y-5">
          <div>
            <h2 className="text-2xl font-black text-white">{t("articleDetail.related.title")}</h2>
            <p className="mt-1 text-sm text-slate-400">{t("articleDetail.related.description")}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {relatedArticles.map((relatedArticle) => (
              <Link key={relatedArticle.id} href={`/articles/${relatedArticle.id}`}>
                <article className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] shadow-[0_24px_70px_-55px_rgba(0,0,0,0.55)] transition hover:-translate-y-1">
                  <ArticleImage article={relatedArticle} className="h-52 w-full object-cover" />
                  <div className="space-y-3 p-5">
                    <Badge className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100 hover:bg-cyan-300/10">{relatedArticle.categoryName || t("articleDetail.noCategory")}</Badge>
                    <div className="text-xl font-black leading-8 text-white">{relatedArticle.title}</div>
                    <div className="text-sm leading-7 text-slate-300">{relatedArticle.excerpt || t("articleDetail.relatedExcerptMissing")}</div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <MobileSiteMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={t("articleDetail.menuTitle")}
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
