import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowRight, GraduationCap, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { SpecializedCourseCatalogCategory, SpecializedCourseCatalogCourse, SpecializedCourseHomePayload, SpecializedCoursePageSettings } from "@/lib/types";

const SPECIALIZED_DISCOUNT_CODE_KEY = "specialized-course-discount-code";

const categoryPresentation = {
  all: {
    titleKey: "specializedCourseCategory.categories.all.title",
    subtitleKey: "specializedCourseCategory.categories.all.subtitle",
    imageAccentKey: "specializedCourseCategory.categories.all.imageAccent",
  },
  cut: {
    titleKey: "specializedCourseCategory.categories.cut.title",
    subtitleKey: "specializedCourseCategory.categories.cut.subtitle",
    imageAccentKey: "specializedCourseCategory.categories.cut.imageAccent",
  },
  color: {
    titleKey: "specializedCourseCategory.categories.color.title",
    subtitleKey: "specializedCourseCategory.categories.color.subtitle",
    imageAccentKey: "specializedCourseCategory.categories.color.imageAccent",
  },
  skin: {
    titleKey: "specializedCourseCategory.categories.skin.title",
    subtitleKey: "specializedCourseCategory.categories.skin.subtitle",
    imageAccentKey: "specializedCourseCategory.categories.skin.imageAccent",
  },
  management: {
    titleKey: "specializedCourseCategory.categories.management.title",
    subtitleKey: "specializedCourseCategory.categories.management.subtitle",
    imageAccentKey: "specializedCourseCategory.categories.management.imageAccent",
  },
  content: {
    titleKey: "specializedCourseCategory.categories.content.title",
    subtitleKey: "specializedCourseCategory.categories.content.subtitle",
    imageAccentKey: "specializedCourseCategory.categories.content.imageAccent",
  },
} as const;

function buildDefaultSpecializedCourseSettings(t: ReturnType<typeof useT>): SpecializedCoursePageSettings {
  return {
  enabled: false,
  disabled: {
    title: t("specializedCourses.defaultTitle"),
    description: t("specializedCourses.disabledDescription"),
  },
  header: { eyebrow: t("specializedCourses.defaultTitle"), title: t("specializedCourses.defaultTitle") },
  search: { placeholder: t("specializedCourses.searchPlaceholder") },
  access: { title: t("specializedCourseDetail.accessDenied.title"), description: t("specializedCourses.accessDescription") },
  labels: {
    course_video_label: t("specializedCourses.labels.courseVideo"),
    students_label: t("specializedCourses.labels.students"),
    certificate_badge: t("specializedCourses.labels.certificate"),
    popular_badge: t("specializedCourses.labels.popular"),
    view_course_cta: t("specializedCourses.labels.viewCourse"),
    purchased_badge: t("specializedCourses.labels.purchased"),
    progress_label: t("specializedCourses.labels.progress"),
    continue_path_label: t("specializedCourses.labels.continuePath"),
    continue_learning_cta: t("specializedCourses.labels.continueLearning"),
    learning_status_text: t("specializedCourses.labels.learningStatusSaved"),
    more_button: t("specializedCourses.labels.more"),
    empty_state: t("specializedCourseCategory.emptyState"),
    active_courses_suffix: t("specializedCourses.labels.activeCoursesSuffix"),
  },
  hero: {
    enabled: true,
    badge: "",
    title: "",
    description: "",
    stats: [],
  },
  purchased: {
    enabled: true,
    title: "",
    description: "",
  },
  carousel: {
    enabled: true,
    title: "",
    description: "",
    side_cards: [],
    slides: [],
  },
  categories: {
    enabled: true,
    title: t("specializedCourses.categoriesTitle"),
    description: t("specializedCourses.categoriesDescription"),
  },
  sections: [],
  highlight_banner: {
    enabled: false,
    badge: "",
    title: "",
    description: "",
    items: [],
  },
  faq: {
    enabled: true,
    title: "",
    description: "",
    items: [],
  },
  };
}

function getActiveDiscountCode() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  const queryCode = (params.get("discount_code") ?? params.get("discountCode") ?? "").trim();

  if (queryCode) {
    window.sessionStorage.setItem(SPECIALIZED_DISCOUNT_CODE_KEY, queryCode);
    return queryCode;
  }

  return (window.sessionStorage.getItem(SPECIALIZED_DISCOUNT_CODE_KEY) ?? "").trim();
}

function mapCategory(item: SpecializedCourseCatalogCategory, t: ReturnType<typeof useT>) {
  const presentation = categoryPresentation[item.slug as keyof typeof categoryPresentation] ?? categoryPresentation.all;

  return {
    id: item.slug,
    title: item.title || t(presentation.titleKey),
    subtitle: item.subtitle || t(presentation.subtitleKey),
  };
}

function mapCourse(item: SpecializedCourseCatalogCourse, t: ReturnType<typeof useT>) {
  const presentation = categoryPresentation[item.categoryId as keyof typeof categoryPresentation] ?? categoryPresentation.all;

  return {
    id: item.id,
    title: item.title,
    instructor: item.instructor,
    students: item.students,
    duration: item.duration,
    rating: item.rating,
    reviews: item.reviews,
    price: item.price,
    previousPrice: item.previousPrice ?? undefined,
    badge: item.badge ?? undefined,
    categoryId: item.categoryId,
    imageAccent: item.imageAccent ?? t(presentation.imageAccentKey),
    imageUrl: item.imageUrl,
    imagePosition: item.imagePosition ?? undefined,
  };
}

export default function PanelSpecializedCourseCategoryPage() {
  const { isAdmin, isBarber } = useAuth();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const tenantMeta = getInitialTenantMeta();
  const [match, params] = useRoute("/panel/specialized-courses/category/:categoryId");
  const [homePayload, setHomePayload] = useState<SpecializedCourseHomePayload | null>(null);

  useEffect(() => {
    const discountCode = getActiveDiscountCode();

    api.specializedCourses.home(discountCode || undefined).then((res) => {
      if (res.success) {
        setHomePayload(res.data);
      }
    });
  }, []);

  const defaultSpecializedCourseSettings = useMemo(() => buildDefaultSpecializedCourseSettings(t), [t]);
  const settings = homePayload?.settings ?? tenantMeta?.audience?.specializedCourseSettings ?? defaultSpecializedCourseSettings;
  const labels = settings.labels;
  const formatCourseMoney = (amount: number) => t("specializedCourseDetail.priceToman", { amount: format.number(amount) });

  const dynamicCategories = useMemo(() => {
    if (homePayload) {
      return [
        mapCategory({
          id: "all",
          slug: "all",
          title: t("specializedCourseCategory.allCoursesTitle"),
          subtitle: t("specializedCourseCategory.completePathSubtitle"),
          courseCount: homePayload.courses.length,
        }, t),
        ...(homePayload.categories ?? []).map((item) => mapCategory(item, t)),
      ];
    }

    return [
      {
        id: "all",
        title: t("specializedCourseCategory.allCoursesTitle"),
        subtitle: t("specializedCourseCategory.allCoursesSubtitle"),
      },
    ];
  }, [homePayload, t]);

  const selectedCategory = useMemo(() => {
    if (!match) {
      return null;
    }

    return dynamicCategories.find((item) => item.id === params.categoryId) ?? null;
  }, [dynamicCategories, match, params?.categoryId]);

  const courses = useMemo(() => {
    if (homePayload) {
      const allCourses = (homePayload.courses ?? []).map((item) => mapCourse(item, t));

      if (!selectedCategory || selectedCategory.id === "all") {
        return allCourses;
      }

      return allCourses.filter((item) => item.categoryId === selectedCategory.id);
    }

    return [];
  }, [homePayload, selectedCategory, t]);

  if (!isAdmin && !isBarber) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <GraduationCap className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{settings.access.title}</h1>
          <p className="text-muted-foreground leading-7">{settings.access.description}</p>
          <Link href="/panel/specialized-courses">
            <Button>{t("common.back")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!settings.enabled) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground flex items-center justify-center" dir={dir}>
        <Card className="w-full max-w-2xl rounded-[28px] border-border/70 bg-card/80 text-center">
          <CardContent className="space-y-5 p-8 sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/25 bg-primary/10 text-primary">
              <GraduationCap className="h-8 w-8" />
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl font-black">{settings.disabled?.title || t("specializedCourses.defaultTitle")}</h1>
              <p className="text-base leading-8 text-muted-foreground">
                {settings.disabled?.description || t("specializedCourses.disabledDescription")}
              </p>
            </div>
            <Link href="/panel">
              <Button className="h-12 rounded-2xl px-6">{t("specializedCourses.backToPanel")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedCategory) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-bold">{t("specializedCourseCategory.notFoundTitle")}</h1>
          <p className="text-muted-foreground leading-7">{t("specializedCourseCategory.notFoundDescription")}</p>
          <Link href="/panel/specialized-courses">
            <Button>{t("specializedCourseCategory.backToCourses")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground" dir={dir}>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("specializedCourseCategory.headerLabel")}</div>
            <h1 className="text-2xl font-black">
              {selectedCategory.title}
            </h1>
            <p className="text-sm text-muted-foreground">{selectedCategory.subtitle}</p>
          </div>
          <Link href="/panel/specialized-courses">
            <Button
              variant="outline"
              size="icon"
              title={t("common.back")}
              className="h-11 w-11 rounded-2xl border-border bg-background/50 hover:bg-background/80"
            >
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-8 px-4 py-6 lg:space-y-10 lg:py-8">
        <Card className="rounded-[28px] border-border/70 bg-card/70">
          <CardContent className="flex flex-col gap-3 p-6 text-start lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-black">{t("specializedCourseCategory.listTitle")}</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                {selectedCategory.id === "all"
                  ? t("specializedCourseCategory.listDescriptionAll")
                  : t("specializedCourseCategory.listDescriptionCategory", { category: selectedCategory.title })}
              </p>
            </div>
            <Badge className="w-fit rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
              {format.number(courses.length)} {labels.active_courses_suffix}
            </Badge>
          </CardContent>
        </Card>

        {homePayload?.discountContext?.restrictToTeacherCourses ? (
          <Card className="rounded-[24px] border border-amber-500/20 bg-amber-500/10">
            <CardContent className="p-5 text-start">
              <div className="font-bold text-amber-200">{t("specializedCourses.teacherFilterActive")}</div>
              <div className="mt-1 text-sm leading-7 text-amber-100/80">
                {t("specializedCourseCategory.discountRestrictedPrefix")}{" "}
                <CodeText className="font-bold text-amber-50">{homePayload.discountContext.code}</CodeText>{" "}
                {homePayload.discountContext.salesUserName
                  ? t("specializedCourseCategory.discountRestrictedWithTeacherSuffix", { teacher: homePayload.discountContext.salesUserName })
                  : t("specializedCourseCategory.discountRestrictedSuffix")}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {courses.length === 0 ? (
          <Card className="rounded-[28px] border-dashed border-border/70 bg-card/40">
            <CardContent className="p-10 text-center text-sm leading-7 text-muted-foreground">
              {labels.empty_state}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => (
              <Link key={course.id} href={`/panel/specialized-courses/${course.id}`} className="block">
                <Card className="overflow-hidden rounded-[32px] border-border/70 bg-card/65 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
                  <CardContent className="grid gap-7 p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:gap-9 lg:p-9">
                    <div className="order-1 lg:order-2">
                      <img
                        src={course.imageUrl}
                        alt={course.title}
                        className="h-56 w-full rounded-[24px] object-cover lg:h-[240px]"
                        style={{ objectPosition: course.imagePosition ?? "center center" }}
                      />
                    </div>

                    <div className="order-2 space-y-6 text-start lg:order-1">
                      <div className="space-y-4">
                        <div className="inline-flex rounded-full border border-border/70 bg-background/60 px-4 py-2 text-xs text-muted-foreground">
                          {course.imageAccent}
                        </div>
                        <h2 className="text-2xl font-black leading-[3.2rem] lg:max-w-3xl lg:text-[2.15rem]">{course.title}</h2>
                        <p className="text-lg text-muted-foreground lg:text-xl">{course.instructor}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 gap-y-3 text-sm lg:gap-3">
                        <span className="rounded-full bg-background/80 px-4 py-2 text-muted-foreground">
                          {course.duration}
                        </span>
                        <span className="rounded-full bg-background/80 px-4 py-2 text-muted-foreground">
                          {t("specializedCourseCategory.reviewCount", { count: format.number(course.reviews) })}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-4 py-2 text-amber-300">
                          <Star className="h-4 w-4 fill-current" />
                          {format.number(course.rating)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-4 py-2 text-muted-foreground">
                          <Users className="h-4 w-4 text-primary" />
                          {format.number(course.students)} {labels.students_label}
                        </span>
                        <Badge variant="outline" className="rounded-full border-border/70 bg-background/70 px-4 py-2 text-muted-foreground">
                          {labels.certificate_badge}
                        </Badge>
                        <Badge className="rounded-full bg-violet-500/10 px-4 py-2 text-violet-300 hover:bg-violet-500/10">
                          {course.badge ?? labels.popular_badge}
                        </Badge>
                      </div>

                      <div className="flex flex-col gap-5 pt-1 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3 gap-y-2">
                          {course.previousPrice ? (
                            <Badge className="rounded-full bg-primary text-primary-foreground hover:bg-primary">
                              {format.percent(1 - course.price / course.previousPrice)}
                            </Badge>
                          ) : null}
                          <div className="text-2xl font-black">{formatCourseMoney(course.price)}</div>
                          {course.previousPrice ? (
                            <div className="text-lg text-muted-foreground line-through">{formatCourseMoney(course.previousPrice)}</div>
                          ) : null}
                        </div>

                        <span className="inline-flex h-11 items-center justify-center rounded-[18px] bg-primary px-5 text-sm font-bold text-primary-foreground">
                          {labels.view_course_cta}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
