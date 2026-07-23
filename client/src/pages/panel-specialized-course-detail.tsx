import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowRight, Check, Clock3, Lock, PlayCircle, ShoppingCart, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { formatSpecializedCountdown, getSpecializedCourseById, getWatchedLessons } from "@/lib/specialized-course-detail-data";
import { useFormat, useLocale, useT } from "@/i18n/locale";

export default function PanelSpecializedCourseDetailPage() {
  const { isAdmin, isBarber } = useAuth();
  const { dir, isRtl } = useLocale();
  const format = useFormat();
  const t = useT();
  const [match, params] = useRoute("/panel/specialized-courses/:courseId");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [countdown, setCountdown] = useState(() => formatSpecializedCountdown(new Date().toISOString()));
  const [watchedLessons, setWatchedLessons] = useState<string[]>([]);

  const course = useMemo(() => {
    if (!match) {
      return null;
    }

    return getSpecializedCourseById(params.courseId);
  }, [match, params?.courseId]);

  useEffect(() => {
    if (!course) {
      return;
    }

    setCountdown(formatSpecializedCountdown(course.countdownTargetAt));
    setWatchedLessons(getWatchedLessons(course.id));

    const interval = window.setInterval(() => {
      setCountdown(formatSpecializedCountdown(course.countdownTargetAt));
      setWatchedLessons(getWatchedLessons(course.id));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [course]);

  const formatCountdownPart = (value: number) => format.number(value, { minimumIntegerDigits: 2, useGrouping: false });
  const formatProductToman = (amount: number) => t("specializedCourseDetail.priceToman", { amount: format.number(amount) });
  const lessonCount = course?.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0) ?? 0;

  if (!isAdmin && !isBarber) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <Lock className="w-12 h-12 mx-auto text-destructive" />
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
          <h1 className="text-xl font-bold">{t("specializedCourseDetail.notFound.title")}</h1>
          <Link href="/panel/specialized-courses">
            <Button>{t("specializedCourseDetail.backToCourseList")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-36 text-foreground" dir={dir}>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("specializedCourseDetail.headerLabel")}</div>
            <h1 className="text-xl font-black">{course.title}</h1>
          </div>
          <Link href="/panel/specialized-courses">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/50">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-8 px-4 py-6">
        <Card className="rounded-[30px] border-border/70 bg-card/60">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="text-start text-lg font-black text-primary sm:text-xl">{t("specializedCourseDetail.discountCountdownTitle")}</div>
            <div className="flex items-center gap-3 text-sm font-bold sm:gap-4 sm:text-base">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-primary sm:text-2xl">{formatCountdownPart(countdown.hours)}</span>
                <span className="text-muted-foreground">{t("specializedCourseDetail.countdown.hours")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-foreground sm:text-2xl">{formatCountdownPart(countdown.minutes)}</span>
                <span className="text-muted-foreground">{t("specializedCourseDetail.countdown.minutes")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-foreground sm:text-2xl">{formatCountdownPart(countdown.seconds)}</span>
                <span className="text-muted-foreground">{t("specializedCourseDetail.countdown.seconds")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-6">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="group relative block w-full overflow-hidden rounded-[34px] border border-border/70"
          >
            <img
              src={course.heroImage}
              alt={course.title}
              className="h-[320px] w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-[430px]"
              style={{ objectPosition: course.heroImagePosition ?? "center center" }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.18),rgba(15,23,42,0.72))]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur">
                <PlayCircle className="h-10 w-10" />
              </div>
              <div className="text-3xl font-black text-white">{t("specializedCourseDetail.previewTitle")}</div>
              <div className="rounded-full bg-black/35 px-4 py-2 text-sm text-white/90">{course.previewDuration}</div>
            </div>
          </button>

          <div className="space-y-4 text-start">
            <div className="text-4xl font-black leading-[3.6rem]">{course.title}</div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/55 px-3 py-1">
                <Users className="h-4 w-4 text-primary" />
                {t("specializedCourseDetail.studentsCount", { count: format.number(course.students) })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/55 px-3 py-1">
                <Star className="h-4 w-4 fill-current text-amber-400" />
                {t("specializedCourseDetail.ratingSummary", { rating: format.number(course.rating), count: format.number(course.reviewsCount) })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/55 px-3 py-1">
                <Clock3 className="h-4 w-4 text-primary" />
                {course.totalDuration}
              </span>
            </div>
            <p className="text-base leading-9 text-muted-foreground">{course.description}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="rounded-[30px] border-border/70 bg-card/60">
            <CardContent className="space-y-5 p-6">
              <h2 className="text-2xl font-black">{t("specializedCourseDetail.learningTitle")}</h2>
              <div className="space-y-4">
                {course.learningPoints.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-1 rounded-full bg-primary/15 p-1 text-primary">
                      <Check className="h-4 w-4" />
                    </div>
                    <div className="text-sm leading-8 text-muted-foreground">{item}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border-border/70 bg-card/60">
            <CardContent className="space-y-5 p-6">
              <h2 className="text-2xl font-black">{t("specializedCourseDetail.curriculumTitle")}</h2>
              <div className="text-sm text-muted-foreground">
                {t("specializedCourseDetail.chapterCount", { count: format.number(course.chapterCount) })}
                <span className="mx-2">•</span>
                {t("specializedCourseDetail.lessonCount", { count: format.number(lessonCount) })}
                <span className="mx-2">•</span>
                {course.totalDuration}
              </div>
              <Accordion type="multiple" defaultValue={course.chapters[0] ? [course.chapters[0].id] : []} className="space-y-4">
                {course.chapters.map((chapter, chapterIndex) => (
                  <AccordionItem key={chapter.id} value={chapter.id} className="overflow-hidden rounded-[24px] border border-border/70 bg-background/35 px-4 sm:px-5">
                    <AccordionTrigger className="py-5 text-start text-base font-bold hover:no-underline">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-black text-primary">{format.number(chapterIndex + 1)}.</span>
                        <span className="text-lg">{chapter.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-5">
                      {chapter.lessons.map((lesson) => {
                        const watched = watchedLessons.includes(lesson.id);

                        return (
                          <div key={lesson.id} className="space-y-4 rounded-[22px] border border-border/60 bg-card/55 px-4 py-4 sm:px-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 text-base leading-8 text-foreground">{lesson.title}</div>
                              <div className="flex flex-wrap items-center gap-2">
                                {lesson.isFree ? (
                                  <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10">{t("specializedCourseDetail.freeBadge")}</Badge>
                                ) : (
                                  <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-300">
                                    <Lock className="me-1 h-3.5 w-3.5" />
                                    {t("specializedCourseDetail.lockedBadge")}
                                  </Badge>
                                )}
                                {watched ? (
                                  <Badge className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">{t("specializedCourseDetail.watchedBadge")}</Badge>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <div className="text-base text-muted-foreground">{lesson.duration}</div>
                              {lesson.isFree ? (
                                <Link href={`/panel/specialized-courses/${course.id}/lessons/${lesson.id}`}>
                                  <Button className="h-11 rounded-[18px] px-6 text-base font-bold">{t("specializedCourseDetail.watchLesson")}</Button>
                                </Link>
                              ) : (
                                <Button variant="outline" disabled className="h-11 rounded-[18px] px-6 text-base">{t("specializedCourseDetail.lockedBadge")}</Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-[30px] border-border/70 bg-card/60">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-2xl font-black">{t("specializedCourseDetail.requirementsTitle")}</h2>
              {course.requirements.map((item) => (
                <p key={item} className="text-sm leading-8 text-muted-foreground">{item}</p>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border-border/70 bg-card/60">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-2xl font-black">{t("specializedCourseDetail.aboutTitle")}</h2>
              <p className="text-sm leading-8 text-muted-foreground">{course.about}</p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-black">{t("specializedCourseDetail.reviewsTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("specializedCourseDetail.reviewsDescription")}</p>
          </div>
          {course.reviews.length === 0 ? (
            <Card className="rounded-[28px] border-dashed border-border/70 bg-card/40">
              <CardContent className="p-6 text-sm leading-8 text-muted-foreground">
                {t("specializedCourseDetail.reviewsEmpty")}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {course.reviews.map((review) => (
                <Card key={review.id} className="rounded-[28px] border-border/70 bg-card/60">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold">{review.reviewerName}</div>
                      <div className="text-xs text-muted-foreground">{format.date(review.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400">
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star key={`${review.id}-${index}`} className={`h-4 w-4 ${index < review.rating ? "fill-current" : ""}`} />
                      ))}
                    </div>
                    <p className="text-sm leading-8 text-muted-foreground">{review.body}</p>
                    {review.adminReply ? (
                      <div className="rounded-[18px] border border-primary/20 bg-primary/10 p-3 text-sm text-muted-foreground">
                        <div className="mb-1 font-bold text-primary">{t("specializedCourseDetail.adminReply")}</div>
                        {review.adminReply}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-black">{t("specializedCourseDetail.faqTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("specializedCourseDetail.faqDescription")}</p>
          </div>
          <Card className="rounded-[30px] border-border/70 bg-card/60">
            <CardContent className="p-4 sm:p-6">
              <Accordion type="single" collapsible className="w-full">
                {course.faq.map((item) => (
                  <AccordionItem key={item.id} value={item.id} className="border-border/70">
                    <AccordionTrigger className="text-start text-base font-bold hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-start text-sm leading-8 text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/92 backdrop-blur-xl">
        <div className="container mx-auto max-w-5xl px-4 py-3">
          <div className="rounded-[24px] border border-border/70 bg-card/70 p-3 shadow-[0_-24px_70px_-50px_rgba(0,0,0,0.85)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Badge className="rounded-full bg-primary px-3 py-1 text-primary-foreground hover:bg-primary">
                  {format.percent(course.discountPercent / 100)}
                </Badge>
                <div className="flex min-w-0 items-center gap-3 whitespace-nowrap">
                  <div className="text-xl font-black text-foreground">{formatProductToman(course.discountedPrice)}</div>
                  <div className="text-sm text-muted-foreground line-through">{formatProductToman(course.price)}</div>
                </div>
              </div>
            </div>

            <Link href={`/panel/specialized-courses/${course.id}/checkout`}>
              <Button className="h-10 w-full rounded-[18px] px-5 text-sm font-black">
                <ShoppingCart className="me-2 h-5 w-5" />
                {t("specializedCourseDetail.buyCourse")}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl border-border/70 bg-card/95 p-3 sm:p-4" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t("specializedCourseDetail.previewDialogTitle")}</DialogTitle>
            <DialogDescription>{t("specializedCourseDetail.previewDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-black">
            <video
              src={course.previewVideoUrl}
              controls
              autoPlay={previewOpen}
              playsInline
              className="max-h-[70vh] w-full object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
