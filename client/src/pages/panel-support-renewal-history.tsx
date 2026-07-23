import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, FileText, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { PaginatedSupportRenewalPayments } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { CodeText } from "@/i18n/ltr-text";

const STATUS_LABELS = {
  pending: "supportRenewalHistory.status.pending",
  paid: "supportRenewalHistory.status.paid",
  failed: "supportRenewalHistory.status.failed",
  cancelled: "supportRenewalHistory.status.cancelled",
} as const;

export default function PanelSupportRenewalHistoryPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const format = useFormat();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PaginatedSupportRenewalPayments>({
    items: [],
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  });

  const loadHistory = async (page = 1) => {
    setLoading(true);
    const res = await api.supportRenewal.history(page, 10);
    if (res.success) {
      setHistory(res.data);
    }
    setLoading(false);
  };

  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const paymentStatus = search.get("payment");
  const paymentMessage = search.get("message");

  useEffect(() => {
    if (isAdmin) {
      loadHistory(1);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!paymentStatus) {
      return;
    }

    if (paymentStatus === "success") {
      toast({ title: t("supportRenewalHistory.toast.successTitle"), description: paymentMessage || t("supportRenewalHistory.toast.successDescription") });
      return;
    }

    if (paymentStatus === "cancelled") {
      toast({ variant: "destructive", title: t("supportRenewalHistory.toast.cancelledTitle"), description: paymentMessage || t("supportRenewalHistory.toast.cancelledDescription") });
      return;
    }

    if (paymentStatus === "failed") {
      toast({ variant: "destructive", title: t("supportRenewalHistory.toast.failedTitle"), description: paymentMessage || t("supportRenewalHistory.toast.failedDescription") });
    }
  }, [paymentMessage, paymentStatus, toast, t]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <ShieldCheck className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{t("supportRenewalHistory.accessDeniedTitle")}</h1>
          <p className="text-muted-foreground leading-7">{t("supportRenewalHistory.accessDeniedDescription")}</p>
          <Link href="/panel">
            <Button>{t("supportRenewalHistory.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("supportRenewalHistory.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("supportRenewalHistory.description")}</p>
          </div>
          <Link href="/panel/support-renewal">
            <Button variant="outline" size="icon" title={t("supportRenewalHistory.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`w-5 h-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-base">{t("supportRenewalHistory.listTitle")}</CardTitle>
                <CardDescription>{t("supportRenewalHistory.listDescription")}</CardDescription>
              </div>
              <Badge variant="secondary">{t("supportRenewalHistory.totalBadge", { count: format.number(history.total) })}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex h-48 items-center justify-center text-muted-foreground">
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("common.loading")}
              </div>
            ) : history.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-10 text-center text-muted-foreground">
                {t("supportRenewalHistory.empty")}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {history.items.map((payment) => (
                    <div key={payment.id} className="rounded-3xl border border-border/70 bg-background/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 text-start">
                          <div className="font-bold">{payment.packageName || t("supportRenewalHistory.defaultPackage")}</div>
                          <div className="text-sm text-muted-foreground">
                            {t("supportRenewalHistory.invoice")} <CodeText>{payment.invoiceNumber}</CodeText> • {payment.createdAt ? format.date(payment.createdAt) : t("supportRenewal.notSet")}
                          </div>
                        </div>
                        <Badge variant={payment.status === "paid" ? "secondary" : payment.status === "pending" ? "outline" : "destructive"}>
                          {t(STATUS_LABELS[payment.status])}
                        </Badge>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                          <div className="text-xs text-muted-foreground">{t("supportRenewalHistory.payableAmount")}</div>
                          <div className="mt-1 font-bold">{format.currency(payment.payableAmount)}</div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                          <div className="text-xs text-muted-foreground">{t("supportRenewalHistory.newSupportEndsAt")}</div>
                          <div className="mt-1 font-bold">{payment.newSupportEndsAt ? format.date(payment.newSupportEndsAt) : t("supportRenewal.notSet")}</div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                          <div className="text-xs text-muted-foreground">{t("supportRenewalHistory.initiatedBy")}</div>
                          <div className="mt-1 font-bold">{payment.initiatedByName || t("supportRenewalHistory.defaultInitiator")}</div>
                        </div>
                      </div>
                      {payment.failureReason ? (
                        <div className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                          {payment.failureReason}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {history.lastPage > 1 ? (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (history.currentPage > 1) {
                              loadHistory(history.currentPage - 1);
                            }
                          }}
                          className={history.currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-3 text-sm text-muted-foreground">
                          {t("supportRenewalHistory.pageOf", { page: format.number(history.currentPage), total: format.number(history.lastPage) })}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (history.currentPage < history.lastPage) {
                              loadHistory(history.currentPage + 1);
                            }
                          }}
                          className={history.currentPage >= history.lastPage ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
