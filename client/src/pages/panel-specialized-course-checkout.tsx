import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowRight, BookOpenCheck, CreditCard, GraduationCap, ShieldCheck, TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { getSpecializedCourseById } from "@/lib/specialized-course-detail-data";
import { DiscountCodeDialog } from "@/components/discount-code-dialog";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type DiscountQuote = {
  code: string;
  discountAmount: number;
  discountType: "percent" | "fixed";
  discountValue: number;
};

function getMockDiscountQuote(code: string, subtotal: number): DiscountQuote | null {
  const normalized = code.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "COURSE20") {
    return {
      code: normalized,
      discountAmount: Math.floor(subtotal * 0.2),
      discountType: "percent",
      discountValue: 20,
    };
  }

  if (normalized === "BARBER500") {
    return {
      code: normalized,
      discountAmount: Math.min(500_000, subtotal),
      discountType: "fixed",
      discountValue: 500_000,
    };
  }

  if (normalized === "VIPTRAIN") {
    return {
      code: normalized,
      discountAmount: Math.min(350_000, subtotal),
      discountType: "fixed",
      discountValue: 350_000,
    };
  }

  return null;
}

export default function PanelSpecializedCourseCheckoutPage() {
  const { isAdmin, isBarber } = useAuth();
  const { toast } = useToast();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const [match, params] = useRoute("/panel/specialized-courses/:courseId/checkout");
  const [discountCode, setDiscountCode] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountQuote | null>(null);

  const course = useMemo(() => {
    if (!match) {
      return null;
    }

    return getSpecializedCourseById(params.courseId);
  }, [match, params?.courseId]);

  if (!isAdmin && !isBarber) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <ShieldCheck className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{t("specializedCourseDetail.accessDenied.title")}</h1>
          <p className="text-muted-foreground leading-7">{t("specializedCourseDetail.accessDenied.description")}</p>
          <Link href="/panel/specialized-courses">
            <Button>{t("specializedCourseDetail.backToCourses")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{t("specializedCourseDetail.notFound.title")}</h1>
          <Link href="/panel/specialized-courses">
            <Button>{t("specializedCourseDetail.backToCourses")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = course.price;
  const courseDiscount = Math.max(0, course.price - course.discountedPrice);
  const promoDiscount = appliedDiscount?.discountAmount ?? 0;
  const payable = Math.max(0, course.discountedPrice - promoDiscount);
  const lessonCount = course.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
  const formatCourseMoney = (amount: number) => t("specializedCourseDetail.priceToman", { amount: format.number(amount) });

  const handleApplyDiscountCode = async (nextCode: string) => {
    setDiscountLoading(true);
    const quote = getMockDiscountQuote(nextCode, course.discountedPrice);

    if (quote) {
      setAppliedDiscount(quote);
      setDiscountCode(quote.code);
      setDiscountError(null);
    } else {
      setDiscountError(t("specializedCourseCheckout.discountInvalid"));
    }

    setDiscountLoading(false);
  };

  const handleFinalOrder = () => {
    toast({
      title: t("specializedCourseCheckout.orderToast.title"),
      description: t("specializedCourseCheckout.orderToast.description"),
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("specializedCourseCheckout.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("specializedCourseCheckout.description")}</p>
          </div>
          <Link href={`/panel/specialized-courses/${course.id}`}>
            <Button variant="outline" size="icon" title={t("common.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`w-5 h-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-base">{course.title}</CardTitle>
                <CardDescription>
                  {t("specializedCourseCheckout.courseSummary", {
                    instructor: course.instructor,
                    chapters: format.number(course.chapterCount),
                    lessons: format.number(lessonCount),
                  })}
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-primary">{t("specializedCourseCheckout.purchaseBadge")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="text-sm text-muted-foreground">{t("specializedCourseCheckout.instructorLabel")}</div>
              <div className="mt-2 font-bold">{course.instructor}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="text-sm text-muted-foreground">{t("specializedCourseCheckout.durationLabel")}</div>
              <div className="mt-2 font-bold">{course.totalDuration}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="text-sm text-muted-foreground">{t("specializedCourseCheckout.studentsLabel")}</div>
              <div className="mt-2 font-bold">{t("specializedCourseCheckout.peopleCount", { count: format.number(course.students) })}</div>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="text-sm text-muted-foreground">{t("specializedCourseCheckout.currentPayableLabel")}</div>
              <div className="mt-2 text-lg font-black text-primary">{formatCourseMoney(payable)}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("specializedCourseCheckout.summaryTitle")}</CardTitle>
            <CardDescription>{t("specializedCourseCheckout.summaryDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DiscountCodeDialog
              value={discountCode}
              applied={appliedDiscount ? {
                code: appliedDiscount.code,
                discountAmount: appliedDiscount.discountAmount,
                discountType: appliedDiscount.discountType,
                discountValue: appliedDiscount.discountValue,
              } : null}
              loading={discountLoading}
              error={discountError}
              onApply={handleApplyDiscountCode}
              onClear={() => {
                setDiscountCode("");
                setDiscountError(null);
                setAppliedDiscount(null);
              }}
            />

            <div className="space-y-3 rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
                <div>
                  <div className="font-semibold">{t("specializedCourseCheckout.basePriceTitle")}</div>
                  <div className="text-sm text-muted-foreground">{t("specializedCourseCheckout.basePriceDescription")}</div>
                </div>
                <div className="font-bold text-primary">{formatCourseMoney(subtotal)}</div>
              </div>

              {courseDiscount > 0 ? (
                <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
                  <div>
                    <div className="font-semibold">{t("specializedCourseCheckout.courseDiscountTitle")}</div>
                    <div className="text-sm text-muted-foreground">{t("specializedCourseCheckout.courseDiscountDescription")}</div>
                  </div>
                  <div className="font-bold text-emerald-300">-{formatCourseMoney(courseDiscount)}</div>
                </div>
              ) : null}

              {promoDiscount > 0 ? (
                <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
                  <div>
                    <div className="font-semibold">{t("specializedCourseCheckout.promoCodeTitle", { code: appliedDiscount?.code ?? "" })}</div>
                    <div className="text-sm text-muted-foreground">{t("specializedCourseCheckout.promoCodeDescription")}</div>
                  </div>
                  <div className="font-bold text-emerald-300">-{formatCourseMoney(promoDiscount)}</div>
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{t("specializedCourseCheckout.finalAccessTitle")}</div>
                  <div className="text-sm text-muted-foreground">{t("specializedCourseCheckout.finalAccessDescription")}</div>
                </div>
                <div className="text-start text-sm text-muted-foreground">
                  {t("specializedCourseCheckout.fullAccess")}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="text-sm text-muted-foreground">{t("specializedCourseCheckout.finalPayableLabel")}</div>
                <div className="mt-2 text-lg font-black text-primary">{formatCourseMoney(payable)}</div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge className="rounded-full border-0 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10">
                  <BookOpenCheck className="me-1 h-4 w-4" />
                  {t("specializedCourseCheckout.fullCourseAccessBadge")}
                </Badge>
                <Badge className="rounded-full border-0 bg-background/60 text-muted-foreground hover:bg-background/60">
                  <TicketPercent className="me-1 h-4 w-4 text-primary" />
                  {t("specializedCourseCheckout.discountCodeBadge")}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("specializedCourseCheckout.orderTitle")}</CardTitle>
            <CardDescription>{t("specializedCourseCheckout.orderDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm leading-8 text-muted-foreground">
              {t("specializedCourseCheckout.paymentHint")}
            </div>
            <Button className="h-11 rounded-2xl px-6 text-sm font-bold" onClick={handleFinalOrder}>
              <CreditCard className="me-2 h-4 w-4" />
              {t("specializedCourseCheckout.submit")}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 text-sm leading-8 text-muted-foreground">
            {t("specializedCourseCheckout.testCodesLabel")}{" "}
            <CodeText className="font-bold text-foreground">COURSE20</CodeText>
            <span aria-hidden="true">، </span>
            <CodeText className="font-bold text-foreground">BARBER500</CodeText>
            <span aria-hidden="true">، </span>
            <CodeText className="font-bold text-foreground">VIPTRAIN</CodeText>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
