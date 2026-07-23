import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Box, FolderKanban, LayoutDashboard, Loader2, MessageSquareText, PackagePlus, Settings2, ShieldCheck, ShoppingBag, ShoppingCart, Star, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { StoreDashboardOrder, StoreDashboardPayload, StoreDashboardReview } from "@/lib/types";
import { CodeText, PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

function paymentMethodKey(method: StoreDashboardOrder["paymentMethod"]): MessageKey | null {
  switch (method) {
    case "online":
      return "storeOrders.payment.online";
    case "card":
      return "storeOrders.payment.card";
    case "cod":
      return "storeOrders.payment.cod";
    default:
      return null;
  }
}

function orderStatusKey(status: string): MessageKey | null {
  switch (status) {
    case "pending_payment":
      return "storeOrders.status.pendingPayment";
    case "awaiting_card_transfer":
      return "storeOrders.status.awaitingCardTransfer";
    case "placed":
      return "storeOrders.status.placed";
    case "paid":
      return "storeOrders.status.paid";
    case "processing":
      return "storeOrders.status.processing";
    case "shipped":
      return "storeOrders.status.shipped";
    case "returned":
      return "storeOrders.status.returned";
    case "rejected":
      return "storeOrders.status.rejected";
    case "cancelled":
      return "storeOrders.status.cancelled";
    case "failed":
      return "storeOrders.status.failed";
    default:
      return null;
  }
}

function shippingMethodKey(method: StoreDashboardOrder["shippingMethod"]): MessageKey {
  if (method === "pickup") return "panelStoreOrders.shipping.pickup";
  if (method === "express") return "panelStoreOrders.shipping.express";
  return "panelStoreOrders.shipping.courier";
}

function orderStatusClass(status: string) {
  switch (status) {
    case "pending_payment":
    case "awaiting_card_transfer":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "placed":
    case "paid":
    case "processing":
    case "shipped":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "returned":
    case "rejected":
    case "cancelled":
    case "failed":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    default:
      return "border-border/70 bg-background/40 text-muted-foreground";
  }
}

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <Star
      key={index}
      className={`h-4 w-4 ${index < rating ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
    />
  ));
}

const ACTIONS = [
  {
    key: "dashboard",
    titleKey: "panelStoreSettings.actions.dashboard.title",
    descriptionKey: "panelStoreSettings.actions.dashboard.description",
    icon: LayoutDashboard,
    href: "/panel/store-settings",
  },
  {
    key: "orders",
    titleKey: "panelStoreSettings.actions.orders.title",
    descriptionKey: "panelStoreSettings.actions.orders.description",
    icon: ShoppingCart,
    href: "/panel/store-settings/orders",
  },
  {
    key: "products",
    titleKey: "panelStoreSettings.actions.products.title",
    descriptionKey: "panelStoreSettings.actions.products.description",
    icon: PackagePlus,
    href: "/panel/store-settings/products",
  },
  {
    key: "categories",
    titleKey: "panelStoreSettings.actions.categories.title",
    descriptionKey: "panelStoreSettings.actions.categories.description",
    icon: FolderKanban,
    href: "/panel/store-settings/categories",
  },
  {
    key: "reviews",
    titleKey: "panelStoreSettings.actions.reviews.title",
    descriptionKey: "panelStoreSettings.actions.reviews.description",
    icon: MessageSquareText,
    href: "/panel/store-settings/reviews",
  },
  {
    key: "settings",
    titleKey: "panelStoreSettings.actions.settings.title",
    descriptionKey: "panelStoreSettings.actions.settings.description",
    icon: Settings2,
    href: "/panel/store-settings/general",
  },
] as const satisfies Array<{ key: string; titleKey: MessageKey; descriptionKey: MessageKey; icon: typeof LayoutDashboard; href: string }>;

export default function PanelStoreSettingsPage() {
  const { isPrimaryAdmin } = useAuth();
  const { dir, isRtl } = useLocale();
  const format = useFormat();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StoreDashboardPayload | null>(null);
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const activeSection = search.get("section") || "dashboard";

  useEffect(() => {
    if (!isPrimaryAdmin) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    api.store.dashboard().then((res) => {
      if (res.success) {
        setData(res.data);
      }

      setLoading(false);
    });
  }, [isPrimaryAdmin]);

  const stats = useMemo(() => {
    return data?.stats ?? {
      productsCount: 0,
      ordersCount: 0,
      newOrdersCount: 0,
      reviewsCount: 0,
    };
  }, [data]);
  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelStoreSettings.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelStoreSettings.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelStoreSettings.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_40%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("panelStoreSettings.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("panelStoreSettings.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelStoreSettings.description")}</p>
          </div>

          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("common.back")} className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="overflow-hidden rounded-[34px] border border-border/70 bg-card/60 p-5 shadow-[0_30px_90px_-55px_rgba(0,0,0,0.8)] sm:p-6">
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-bold text-primary">
                <ShoppingBag className="h-4 w-4" />
                {t("panelStoreSettings.heroBadge")}
              </div>
              <div className="space-y-3">
                <h2 className="max-w-3xl text-3xl font-black leading-tight sm:text-4xl">{t("panelStoreSettings.heroTitle")}</h2>
                <p className="max-w-3xl text-sm leading-8 text-muted-foreground sm:text-base">
                  {t("panelStoreSettings.heroDescription")}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                {ACTIONS.map((action) => {
                  const Icon = action.icon;
                  const active = activeSection === action.key;

                  return (
                    <Link key={action.key} href={action.href}>
                      <button
                        type="button"
                        className={`flex min-h-[104px] w-full items-start gap-3 rounded-[24px] border p-4 text-start transition-all xl:min-h-[110px] ${active ? "border-primary bg-primary/10 shadow-[0_20px_50px_-35px_rgba(245,158,11,0.45)]" : "border-border/70 bg-background/35 hover:border-primary/30"}`}
                      >
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="space-y-1.5 xl:max-w-[240px]">
                          <div className="font-bold">{t(action.titleKey)}</div>
                          <div className="text-xs leading-6 text-muted-foreground">{t(action.descriptionKey)}</div>
                        </div>
                      </button>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border-primary/20 bg-gradient-to-br from-primary/20 via-card to-card">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">{t("panelStoreSettings.stats.products")}</div>
                    <Box className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-3xl font-black">{format.number(stats.productsCount)}</div>
                  <div className="text-xs leading-6 text-muted-foreground">{t("panelStoreSettings.stats.productsDescription")}</div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/70">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">{t("panelStoreSettings.stats.orders")}</div>
                    <ShoppingCart className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-3xl font-black">{format.number(stats.ordersCount)}</div>
                  <div className="text-xs leading-6 text-muted-foreground">{t("panelStoreSettings.stats.ordersDescription")}</div>
                </CardContent>
              </Card>

              <Card className="border-amber-500/20 bg-amber-500/10">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-amber-200/80">{t("panelStoreSettings.stats.newOrders")}</div>
                    <Truck className="h-5 w-5 text-amber-300" />
                  </div>
                  <div className="text-3xl font-black text-amber-200">{format.number(stats.newOrdersCount)}</div>
                  <div className="text-xs leading-6 text-amber-100/70">{t("panelStoreSettings.stats.newOrdersDescription")}</div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/70">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">{t("panelStoreSettings.stats.reviews")}</div>
                    <MessageSquareText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-3xl font-black">{format.number(stats.reviewsCount)}</div>
                  <div className="text-xs leading-6 text-muted-foreground">{t("panelStoreSettings.stats.reviewsDescription")}</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-[30px] border border-border/70 bg-card/50 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelStoreSettings.loading")}
          </div>
                ) : (
          <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
            <Card className="border-border/70 bg-card/60">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black">{t("panelStoreSettings.latestOrders.title")}</h3>
                    <p className="text-sm text-muted-foreground">{t("panelStoreSettings.latestOrders.description")}</p>
                  </div>
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {t("panelStoreSettings.latestOrders.badge", { count: format.number(data?.latestOrders.length ?? 0) })}
                  </Badge>
                </div>

                {data?.latestOrders.length ? (
                  <div className="space-y-4">
                    {data.latestOrders.map((order) => (
                      <div key={order.id} className="rounded-[28px] border border-border/70 bg-background/35 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <CodeText className="text-lg font-black">{order.orderNumber}</CodeText>
                              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${orderStatusClass(order.status)}`}>
                                {orderStatusKey(order.status) ? t(orderStatusKey(order.status)!) : order.status}
                              </span>
                              <span className="rounded-full border border-border/70 bg-background/50 px-3 py-1 text-xs text-muted-foreground">
                                {paymentMethodKey(order.paymentMethod) ? t(paymentMethodKey(order.paymentMethod)!) : order.paymentMethod}
                              </span>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
                                <div className="text-xs text-muted-foreground">{t("panelStoreSettings.latestOrders.customer")}</div>
                                <div className="mt-1 font-bold">{order.customerName}</div>
                                <PhoneText className="text-xs text-muted-foreground">{order.customerPhone}</PhoneText>
                              </div>
                              <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
                                <div className="text-xs text-muted-foreground">{t("panelStoreSettings.latestOrders.itemsCount")}</div>
                                <div className="mt-1 font-bold">{t("panelStoreSettings.latestOrders.itemsCountValue", { count: format.number(order.itemsCount) })}</div>
                              </div>
                              <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
                                <div className="text-xs text-muted-foreground">{t("panelStoreSettings.latestOrders.total")}</div>
                                <div className="mt-1 font-bold text-primary">{format.currency(order.totalAmount)}</div>
                              </div>
                              <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
                                <div className="text-xs text-muted-foreground">{t("panelStoreSettings.latestOrders.shippingMethod")}</div>
                                <div className="mt-1 font-bold">{t(shippingMethodKey(order.shippingMethod))}</div>
                              </div>
                            </div>
                          </div>

                          <div className="min-w-[220px] rounded-[24px] border border-border/60 bg-background/30 p-4">
                            <div className="mb-3 text-sm font-bold">{t("panelStoreSettings.latestOrders.orderItems")}</div>
                            <div className="space-y-2 text-sm text-muted-foreground">
                              {order.items.map((item, index) => (
                                <div key={`${item.title}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-background/35 px-3 py-2">
                                  <span className="line-clamp-1">{item.title}</span>
                                  <span className="flex-shrink-0 text-xs">{t("panelStoreSettings.latestOrders.quantity", { count: format.number(item.quantity) })}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-border/70 bg-background/20 p-10 text-center text-muted-foreground">
                    {t("panelStoreSettings.latestOrders.empty")}
                  </div>
                )}

                <div className="border-t border-border/70 pt-3">
                  <Link href="/panel/store-settings/orders">
                    <Button variant="outline" className="w-full rounded-2xl border-border bg-background/40">
                      {t("panelStoreSettings.latestOrders.viewAll")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/60">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black">{t("panelStoreSettings.latestReviews.title")}</h3>
                    <p className="text-sm text-muted-foreground">{t("panelStoreSettings.latestReviews.description", { count: format.number(10) })}</p>
                  </div>
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {t("panelStoreSettings.latestReviews.badge", { count: format.number(data?.latestReviews.length ?? 0) })}
                  </Badge>
                </div>

                {data?.latestReviews.length ? (
                  <div className="space-y-2">
                    {data.latestReviews.map((review: StoreDashboardReview) => (
                      <div key={review.id} className="rounded-[16px] border border-border/70 bg-background/35 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="truncate text-sm font-bold">{review.reviewerName}</div>
                            <div className="truncate text-xs text-muted-foreground">{review.product.title}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            {renderStars(review.rating)}
                          </div>
                        </div>
                        <div className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">
                          {review.body}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                          {review.isApproved ? (
                            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">{t("panelStoreSettings.latestReviews.approved")}</span>
                          ) : (
                            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-amber-300">{t("panelStoreSettings.latestReviews.unapproved")}</span>
                          )}
                          {review.adminReply ? (
                            <span className="text-primary">{t("panelStoreSettings.latestReviews.hasReply")}</span>
                          ) : (
                            <span className="text-muted-foreground">{t("panelStoreSettings.latestReviews.noReply")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-border/70 bg-background/20 p-10 text-center text-muted-foreground">
                    {t("panelStoreSettings.latestReviews.empty")}
                  </div>
                )}

                <div className="border-t border-border/70 pt-3">
                  <Link href="/panel/store-settings/reviews">
                    <Button variant="outline" className="w-full rounded-2xl border-border bg-background/40">
                      {t("panelStoreSettings.latestReviews.viewAll")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
