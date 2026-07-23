import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, MessageSquareText, Search, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { StoreProductReviewItem } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const ITEMS_PER_PAGE = 12;

export default function PanelStoreReviewsPage() {
  const { isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const formatValue = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<StoreProductReviewItem[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [moderatingReviewId, setModeratingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved">("all");
  const [sortMode, setSortMode] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);

  const loadReviews = async () => {
    setLoading(true);
    const res = await api.store.listAllProductReviews();
    if (res.success) {
      setReviews(res.data.items);
      setReplies(Object.fromEntries(res.data.items.map((item) => [item.id, item.adminReply || ""])));
    } else {
      toast({ variant: "destructive", title: t("panelStoreReviews.error"), description: res.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isPrimaryAdmin) {
      return;
    }

    loadReviews();
  }, [isPrimaryAdmin]);

  const approvedCount = useMemo(() => reviews.filter((item) => item.isApproved).length, [reviews]);
  const pendingCount = useMemo(() => reviews.filter((item) => !item.isApproved).length, [reviews]);
  const filteredReviews = useMemo(() => {
    const term = search.trim().toLowerCase();

    const byStatus = reviews.filter((item) => {
      if (statusFilter === "pending") return !item.isApproved;
      if (statusFilter === "approved") return item.isApproved;
      return true;
    });

    const bySearch = byStatus.filter((item) => {
      if (!term) return true;
      return (
        (item.reviewerName || "").toLowerCase().includes(term) ||
        (item.body || "").toLowerCase().includes(term) ||
        (item.productTitle || "").toLowerCase().includes(term)
      );
    });

    const sorted = [...bySearch].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return sortMode === "newest" ? bTime - aTime : aTime - bTime;
    });

    return sorted;
  }, [reviews, search, sortMode, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedReviews = filteredReviews.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortMode]);

  useEffect(() => {
    if (safePage !== page) {
      setPage(safePage);
    }
  }, [page, safePage]);

  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelStoreReviews.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelStoreReviews.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelStoreReviews.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("panelStoreReviews.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("panelStoreReviews.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelStoreReviews.description")}</p>
          </div>
          <Link href="/panel/store-settings">
            <Button
              variant="outline"
              size="icon"
              aria-label={t("panelStoreReviews.back")}
              className="h-11 w-11 rounded-2xl border-border bg-background/40"
            >
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="grid gap-3 md:grid-cols-3">
          <Card className="border-border/70 bg-card/60">
            <CardContent className="space-y-2 p-5">
              <div className="text-sm text-muted-foreground">{t("panelStoreReviews.stats.total")}</div>
              <div className="text-3xl font-black">{formatValue.number(reviews.length)}</div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/60">
            <CardContent className="space-y-2 p-5">
              <div className="text-sm text-muted-foreground">{t("panelStoreReviews.stats.pending")}</div>
              <div className="text-3xl font-black">{formatValue.number(pendingCount)}</div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/60">
            <CardContent className="space-y-2 p-5">
              <div className="text-sm text-muted-foreground">{t("panelStoreReviews.stats.approved")}</div>
              <div className="text-3xl font-black">{formatValue.number(approvedCount)}</div>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-[24px] border border-border/70 bg-card/60 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("panelStoreReviews.searchPlaceholder")}
                className="ps-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "pending" | "approved")}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">{t("panelStoreReviews.filter.all")}</option>
              <option value="pending">{t("panelStoreReviews.filter.pending")}</option>
              <option value="approved">{t("panelStoreReviews.filter.approved")}</option>
            </select>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as "newest" | "oldest")}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="newest">{t("panelStoreReviews.sort.newest")}</option>
              <option value="oldest">{t("panelStoreReviews.sort.oldest")}</option>
            </select>
          </div>
        </section>

        <section className="space-y-4">
          {loading ? (
            <Card className="border-border/70 bg-card/60">
              <CardContent className="p-6 text-sm text-muted-foreground">{t("panelStoreReviews.loading")}</CardContent>
            </Card>
          ) : filteredReviews.length === 0 ? (
            <Card className="border-border/70 bg-card/60">
              <CardContent className="p-6 text-sm text-muted-foreground">{t("panelStoreReviews.empty")}</CardContent>
            </Card>
          ) : (
            paginatedReviews.map((review) => (
              <Card key={review.id} className="border-border/70 bg-card/60">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-bold">{review.reviewerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {review.productTitle || t("panelStoreReviews.productFallback", {
                          id: `\u2066${review.storeProductId}\u2069`,
                        })}
                        {review.createdAt ? ` • ${formatValue.date(review.createdAt)}` : ""}
                      </div>
                      <div className="flex items-center gap-1 text-amber-400">
                        {Array.from({ length: 5 }, (_, index) => (
                          <Star key={`${review.id}-${index}`} className={`h-4 w-4 ${index < review.rating ? "fill-current" : ""}`} />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={review.isApproved ? "default" : "outline"}
                        disabled={moderatingReviewId === review.id}
                        onClick={async () => {
                          setModeratingReviewId(review.id);
                          const res = await api.store.moderateProductReview(review.id, {
                            isApproved: !review.isApproved,
                            adminReply: replies[review.id] ?? "",
                          });
                          setModeratingReviewId(null);
                          if (!res.success) {
                            toast({ variant: "destructive", title: t("panelStoreReviews.error"), description: res.message });
                            return;
                          }
                          setReviews((current) => current.map((item) => (item.id === review.id ? res.data : item)));
                        }}
                      >
                        {review.isApproved ? t("panelStoreReviews.approved") : t("panelStoreReviews.approve")}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t("panelStoreReviews.deleteAria")}
                        className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={deletingReviewId === review.id}
                        onClick={async () => {
                          setDeletingReviewId(review.id);
                          const res = await api.store.deleteProductReview(review.id);
                          setDeletingReviewId(null);
                          if (!res.success) {
                            toast({ variant: "destructive", title: t("panelStoreReviews.error"), description: res.message });
                            return;
                          }
                          setReviews((current) => current.filter((item) => item.id !== review.id));
                        }}
                      >
                        {deletingReviewId === review.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-[16px] border border-border/70 bg-background/30 p-3 text-sm leading-7 text-muted-foreground">
                    {review.body}
                  </div>

                  <div className="space-y-2">
                    <Label>{t("panelStoreReviews.adminReply")}</Label>
                    <Textarea
                      value={replies[review.id] ?? ""}
                      onChange={(event) => setReplies((current) => ({ ...current, [review.id]: event.target.value }))}
                      className="min-h-24"
                      placeholder={t("panelStoreReviews.replyPlaceholder")}
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
                            adminReply: replies[review.id] ?? "",
                          });
                          setModeratingReviewId(null);
                          if (!res.success) {
                            toast({ variant: "destructive", title: t("panelStoreReviews.error"), description: res.message });
                            return;
                          }
                          setReviews((current) => current.map((item) => (item.id === review.id ? res.data : item)));
                          toast({
                            title: t("panelStoreReviews.replySavedTitle"),
                            description: t("panelStoreReviews.replySavedDescription"),
                          });
                        }}
                      >
                        {t("panelStoreReviews.saveReply")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        {totalPages > 1 ? (
          <section className="rounded-[24px] border border-border/70 bg-card/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {t("panelStoreReviews.pagination.page", {
                  current: formatValue.number(safePage),
                  total: formatValue.number(totalPages),
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                >
                  {isRtl ? <ChevronRight className="me-2 h-4 w-4" /> : <ChevronLeft className="me-2 h-4 w-4" />}
                  {t("panelStoreReviews.pagination.previous")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage >= totalPages}
                >
                  {t("panelStoreReviews.pagination.next")}
                  {isRtl ? <ChevronLeft className="ms-2 h-4 w-4" /> : <ChevronRight className="ms-2 h-4 w-4" />}
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
