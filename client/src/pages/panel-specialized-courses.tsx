import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BadgePercent, BookOpenText, ChevronLeft, ChevronRight, Clock3, GraduationCap, PlayCircle, Search, Sparkles, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { CodeText } from "@/i18n/ltr-text";
import { CourseItem, specializedCourseCards, specializedCourseCategories } from "@/lib/specialized-courses-data";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type {
  SpecializedCourseCatalogCategory,
  SpecializedCourseCatalogCourse,
  SpecializedCourseHomePayload,
  SpecializedCoursePageSettings,
  SpecializedCoursePageSlide,
  SpecializedCoursePageSection,
} from "@/lib/types";

type HeroSlidePresentation = SpecializedCoursePageSlide & {
  gradient: string;
  imageUrl: string;
  imagePosition?: string;
};

type PanelSpecializedCoursesPageProps = {
  demoMode?: boolean;
};

const SPECIALIZED_DISCOUNT_CODE_KEY = "specialized-course-discount-code";
const purchasedCourseAccents = [
  "from-sky-600 via-blue-600 to-indigo-700",
  "from-violet-600 via-fuchsia-600 to-indigo-800",
  "from-rose-500 via-pink-500 to-orange-500",
];

const categoryPresentation = {
  all: {
    icon: specializedCourseCategories[0].icon,
    tone: specializedCourseCategories[0].tone,
    imageGradient: "from-slate-900 via-slate-800 to-slate-700",
    imageUrl: "https://images.pexels.com/photos/6474473/pexels-photo-6474473.jpeg?auto=compress&cs=tinysrgb&w=1200",
    imageAccentKey: "specializedCourseCategory.categories.all.imageAccent",
  },
  cut: {
    icon: specializedCourseCategories[1].icon,
    tone: specializedCourseCategories[1].tone,
    imageGradient: "from-slate-900 via-sky-950 to-slate-800",
    imageUrl: "https://images.pexels.com/photos/7697645/pexels-photo-7697645.jpeg?auto=compress&cs=tinysrgb&w=1200",
    imageAccentKey: "specializedCourseCategory.categories.cut.imageAccent",
  },
  color: {
    icon: specializedCourseCategories[2].icon,
    tone: specializedCourseCategories[2].tone,
    imageGradient: "from-rose-600 via-pink-500 to-orange-500",
    imageUrl: "https://images.pexels.com/photos/3993311/pexels-photo-3993311.jpeg?auto=compress&cs=tinysrgb&w=1200",
    imageAccentKey: "specializedCourseCategory.categories.color.imageAccent",
  },
  skin: {
    icon: specializedCourseCategories[3].icon,
    tone: specializedCourseCategories[3].tone,
    imageGradient: "from-emerald-500 via-teal-500 to-cyan-700",
    imageUrl: "https://images.pexels.com/photos/3993301/pexels-photo-3993301.jpeg?auto=compress&cs=tinysrgb&w=1200",
    imageAccentKey: "specializedCourseCategory.categories.skin.imageAccent",
  },
  management: {
    icon: specializedCourseCategories[4].icon,
    tone: specializedCourseCategories[4].tone,
    imageGradient: "from-violet-700 via-indigo-700 to-slate-900",
    imageUrl: "https://images.pexels.com/photos/33867518/pexels-photo-33867518.jpeg?auto=compress&cs=tinysrgb&w=1200",
    imageAccentKey: "specializedCourseCategory.categories.management.imageAccent",
  },
  content: {
    icon: specializedCourseCategories[5].icon,
    tone: specializedCourseCategories[5].tone,
    imageGradient: "from-orange-500 via-amber-500 to-yellow-400",
    imageUrl: "https://images.pexels.com/photos/3184306/pexels-photo-3184306.jpeg?auto=compress&cs=tinysrgb&w=1200",
    imageAccentKey: "specializedCourseCategory.categories.content.imageAccent",
  },
} as const;

function buildLiveDefaultSpecializedCourseSettings(t: ReturnType<typeof useT>): SpecializedCoursePageSettings {
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
    learning_status_text: t("specializedCourses.labels.learningStatus"),
    more_button: t("specializedCourses.labels.more"),
    empty_state: t("specializedCourses.emptyState"),
    active_courses_suffix: t("specializedCourses.labels.activeCoursesShortSuffix"),
  },
  hero: {
    enabled: false,
    badge: "",
    title: "",
    description: "",
    stats: [],
  },
  purchased: {
    enabled: true,
    title: t("specializedCourses.purchasedTitle"),
    description: t("specializedCourses.purchasedDescription"),
  },
  carousel: {
    enabled: false,
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
    enabled: false,
    title: "",
    description: "",
    items: [],
  },
  };
}

const demoSpecializedCourseSettings: SpecializedCoursePageSettings = {
  enabled: true,
  disabled: {
    title: "دوره‌های تخصصی",
    description: "به زودی تو این قسمت دوره‌های تخصصی ویژه صنف شما قرار خواهد گرفت.",
  },
  header: { eyebrow: "کتابخانه اختصاصی رشد سالن", title: "دوره‌های تخصصی" },
  search: { placeholder: "جستجو در بین دوره‌ها، مدرس‌ها و سرفصل‌ها" },
  access: { title: "عدم دسترسی", description: "این بخش فقط برای مدیران و اعضای تخصصی همین سامانه قابل مشاهده است." },
  labels: {
    course_video_label: "ویدیوهای مرحله‌به‌مرحله",
    students_label: "دانشجو",
    certificate_badge: "گواهی‌نامه",
    popular_badge: "محبوب کاربران",
    view_course_cta: "مشاهده دوره",
    purchased_badge: "خریداری‌شده",
    progress_label: "پیشرفت",
    continue_path_label: "ادامه مسیر:",
    continue_learning_cta: "ادامه یادگیری",
    learning_status_text: "آخرین وضعیت یادگیری ذخیره شده",
    more_button: "بیشتر",
    empty_state: "با فیلترهای فعلی دوره‌ای پیدا نشد. دسته‌بندی یا عبارت جستجو را تغییر بده.",
    active_courses_suffix: "دوره فعال",
  },
  hero: {
    enabled: true,
    badge: "ویژه مدیر و آرایشگر",
    title: "کتابخانه آموزش‌های کاربردی برای رشد واقعی سالن",
    description: "این صفحه می‌تواند برای طیف آرایشگران با بنرها، FAQها و متن‌های اختصاصی مدیریت شود و محتوای هر بخش کاملاً داینامیک است.",
    stats: [
      { id: "hero-stat-1", value: "+۳۵", label: "دوره قابل نمایش" },
      { id: "hero-stat-2", value: "+۱۸", label: "مدرس حرفه‌ای" },
      { id: "hero-stat-3", value: "۴.۹", label: "رضایت کاربران" },
    ],
  },
  purchased: {
    enabled: true,
    title: "دوره‌های خریداری‌شده",
    description: "لیست دوره‌های خریداری‌شده تا کاربر سریع به ادامه آموزش‌های خودش برگردد.",
  },
  carousel: {
    enabled: true,
    title: "پیشنهادهای منتخب",
    description: "اسلایدهای منتخب برای معرفی دوره‌ها که بعداً با بنرها و پیشنهادهای واقعی جایگزین می‌شوند.",
    side_cards: [
      { id: "carousel-card-1", eyebrow: "مسیر یادگیری", title: "قدم‌به‌قدم و قابل اجرا", description: "پروژه‌محور و مناسب اجرا در سالن" },
      { id: "carousel-card-2", eyebrow: "خروجی نهایی", title: "افزایش مهارت و فروش", description: "یادگیری برای رشد واقعی کسب‌وکار" },
    ],
    slides: [
      { id: "slide-1", enabled: true, eyebrow: "دوره ویژه این ماه", title: "رنگ، لایت و تشخیص پایه مو", description: "از مشاوره تا اجرای حرفه‌ای رنگ و لایت را با سناریوی واقعی سالن یاد بگیرید.", cta: "مشاهده دوره", stat: "۳۸ جلسه ویدیویی" },
      { id: "slide-2", enabled: true, eyebrow: "پرفروش سالن‌ها", title: "کوتاهی حرفه‌ای مردانه و استایل مدرن", description: "فید، تیپر، لاین‌سازی و تحویل حرفه‌ای مشتری با استاندارد قابل اجرا در سالن.", cta: "شروع یادگیری", stat: "۱۶ ساعت آموزش" },
      { id: "slide-3", enabled: true, eyebrow: "ویژه مدیران", title: "مدیریت سالن، افزایش فروش و حفظ مشتری", description: "سیستم قیمت‌گذاری، تیم‌سازی، رضایت مشتری و رشد درآمد را مرحله‌به‌مرحله بچینید.", cta: "دیدن سرفصل‌ها", stat: "پکیج جامع مدیریتی" },
    ],
  },
  categories: {
    enabled: true,
    title: "دسته‌بندی‌های منتخب",
    description: "فقط با یک نگاه مسیر آموزشی دلخواهت را پیدا کن.",
  },
  sections: [
    { id: "featured", enabled: true, title: "محبوب‌ترین دوره‌های آموزشی", description: "پرفروش‌ترین و کاربردی‌ترین آموزش‌هایی که برای سالن‌ها بیشترین بازده را داشته‌اند." },
    { id: "latest", enabled: true, title: "جدیدترین دوره‌ها", description: "دوره‌های تازه‌منتشرشده با سرفصل‌های به‌روز و قابل اجرا در سالن." },
    { id: "management-focus", enabled: true, title: "رشد سالن و جذب مشتری", description: "برای مدیرانی که می‌خواهند فروش، تیم و تجربه مشتری را حرفه‌ای‌تر بچینند." },
    { id: "color-focus", enabled: true, title: "رنگ، لایت و ترکیب رنگ", description: "آموزش‌های متمرکز روی تشخیص پایه، ترکیب مواد و اجرای حرفه‌ای رنگ." },
  ],
  highlight_banner: {
    enabled: true,
    badge: "مسیر رشد حرفه‌ای",
    title: "برای هر نقش، یک مسیر یادگیری منظم و قابل توسعه",
    description: "این بخش برای نمایش بنرهای مناسبتی، پکیج‌های ویژه و معرفی دوره‌های شاخص طراحی شده و بعداً با محتوای واقعی شما کامل می‌شود.",
    items: [
      { id: "highlight-item-1", label: "مسیر اختصاصی مدیر سالن" },
      { id: "highlight-item-2", label: "مسیر کوتاهی و استایل" },
      { id: "highlight-item-3", label: "مسیر رنگ و خدمات تکمیلی" },
    ],
  },
  faq: {
    enabled: true,
    title: "سوالات متداول",
    description: "پاسخ‌های پیش‌فرض این بخش را می‌توانید برای طیف آرایشگران از پنل مرکزی تغییر دهید.",
    items: [
      { id: "faq-1", question: "این بخش الان به سیستم واقعی دوره‌ها وصل شده است؟", answer: "فعلاً این صفحه به‌صورت UI و زیرساخت محتوایی آماده شده تا بعداً به دیتای واقعی دوره‌ها متصل شود." },
      { id: "faq-2", question: "چه کسانی می‌توانند این صفحه را ببینند؟", answer: "در این نسخه فقط مدیران و اعضای تخصصی سامانه به این بخش دسترسی دارند و برای سایر کاربران نمایش داده نمی‌شود." },
      { id: "faq-3", question: "بعداً چه چیزهایی به این صفحه اضافه می‌شود؟", answer: "در مرحله بعد می‌توانیم جزئیات هر دوره، مدرس، سرفصل‌ها، ویدیوها، پیشرفت کاربر، خرید و جستجوی واقعی را اضافه کنیم." },
      { id: "faq-4", question: "متن‌ها و بنرها الان واقعی هستند یا تستی؟", answer: "این متن‌ها به‌عنوان پیش‌فرض هر طیف قرار گرفته‌اند و هر زمان بخواهید می‌توانید از پنل مرکزی آن‌ها را تغییر دهید." },
    ],
  },
};

const heroSlidePresentation: Array<Pick<HeroSlidePresentation, "gradient" | "imageUrl" | "imagePosition">> = [
  { gradient: "from-sky-500 via-cyan-500 to-indigo-700", imageUrl: "https://images.pexels.com/photos/3993311/pexels-photo-3993311.jpeg?auto=compress&cs=tinysrgb&w=1400", imagePosition: "center center" },
  { gradient: "from-amber-500 via-orange-500 to-rose-600", imageUrl: "https://images.pexels.com/photos/7697645/pexels-photo-7697645.jpeg?auto=compress&cs=tinysrgb&w=1400", imagePosition: "center top" },
  { gradient: "from-violet-600 via-fuchsia-600 to-slate-800", imageUrl: "https://images.pexels.com/photos/33867518/pexels-photo-33867518.jpeg?auto=compress&cs=tinysrgb&w=1400", imagePosition: "center center" },
];

const demoPurchasedCourses = [
  {
    id: "owned-1",
    title: "آموزش جامع کوتاهی کلاسیک و مدرن",
    progress: 68,
    nextLesson: "جلسه ۹: فید متوسط و تمیزکاری نهایی",
    accent: "from-sky-600 via-blue-600 to-indigo-700",
  },
  {
    id: "owned-2",
    title: "مدیریت تیم، قیمت‌گذاری و افزایش فروش سالن",
    progress: 24,
    nextLesson: "جلسه ۳: طراحی پلن افزایش فروش",
    accent: "from-violet-600 via-fuchsia-600 to-indigo-800",
  },
  {
    id: "owned-3",
    title: "فرمول‌خوانی رنگ و لایت از پایه تا پیشرفته",
    progress: 82,
    nextLesson: "جلسه ۱۴: ترکیب رنگ‌های پایه سرد",
    accent: "from-rose-500 via-pink-500 to-orange-500",
  },
];

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

function buildDisplayCategories(items: SpecializedCourseCatalogCategory[]) {
  return [
    specializedCourseCategories[0],
    ...items.map((item) => {
      const presentation = categoryPresentation[item.slug as keyof typeof categoryPresentation] ?? categoryPresentation.all;

      return {
        id: item.slug,
        title: item.title,
        subtitle: item.subtitle,
        icon: presentation.icon,
        tone: presentation.tone,
      };
    }),
  ];
}

function buildDisplayCourses(items: SpecializedCourseCatalogCourse[], t: ReturnType<typeof useT>): CourseItem[] {
  return items.map((item) => {
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
      sectionIds: item.sectionIds,
      imageGradient: presentation.imageGradient,
      imageAccent: item.imageAccent ?? t(presentation.imageAccentKey),
      imageUrl: item.imageUrl || presentation.imageUrl,
      imagePosition: item.imagePosition ?? undefined,
    };
  });
}

function SpecializedCourseCard({
  course,
  labels,
  formatCourseMoney,
  formatNumber,
  formatPercent,
}: {
  course: CourseItem;
  labels: SpecializedCoursePageSettings["labels"];
  formatCourseMoney: (amount: number) => string;
  formatNumber: (value: number) => string;
  formatPercent: (value: number) => string;
}) {
  return (
    <Card className="group overflow-hidden rounded-[28px] border-border/70 bg-card/70 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10">
      <CardContent className="p-0">
        <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${course.imageGradient}`}>
          <img
            src={course.imageUrl}
            alt={course.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ objectPosition: course.imagePosition ?? "center center" }}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.68)),radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_26%)]" />
          <div className="absolute start-4 top-4 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            {course.imageAccent}
          </div>
          {course.badge ? (
            <div className="absolute bottom-4 end-4 rounded-full bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              {course.badge}
            </div>
          ) : null}
          <div className="absolute inset-x-5 bottom-5">
            <div className="flex items-center gap-2 text-white/85">
              <PlayCircle className="h-5 w-5" />
              <span className="text-sm font-medium">{labels.course_video_label}</span>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6 text-start">
          <div className="space-y-3">
            <h3 className="line-clamp-2 text-lg font-bold leading-8 text-foreground">{course.title}</h3>
            <p className="text-sm text-muted-foreground">{course.instructor}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 gap-y-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/50 px-3 py-1">
              <Star className="h-3.5 w-3.5 text-amber-400" />
              {formatNumber(course.rating)} ({formatNumber(course.reviews)})
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/50 px-3 py-1">
              <Users className="h-3.5 w-3.5 text-primary" />
              {formatNumber(course.students)} {labels.students_label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/50 px-3 py-1">
              <Clock3 className="h-3.5 w-3.5 text-primary" />
              {course.duration}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="rounded-full border-border/70 bg-background/40 px-4 py-2 text-muted-foreground">{labels.certificate_badge}</Badge>
            <Badge className="rounded-full bg-violet-500/10 px-4 py-2 text-violet-300 hover:bg-violet-500/10">{labels.popular_badge}</Badge>
          </div>

          <div className="space-y-4 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              {course.previousPrice ? (
                <Badge className="rounded-full bg-primary px-3 py-1 text-primary-foreground hover:bg-primary">
                  {formatPercent(1 - course.price / course.previousPrice)}
                </Badge>
              ) : null}
              <div className="text-lg font-black text-primary">{formatCourseMoney(course.price)}</div>
              {course.previousPrice ? (
                <div className="text-xs text-muted-foreground line-through">{formatCourseMoney(course.previousPrice)}</div>
              ) : null}
            </div>

            <Link href={`/panel/specialized-courses/${course.id}`}>
              <Button className="h-12 w-full rounded-[20px] text-base font-bold">{labels.view_course_cta}</Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PanelSpecializedCoursesPage({ demoMode = false }: PanelSpecializedCoursesPageProps) {
  const { isAdmin, isBarber } = useAuth();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const tenantMeta = getInitialTenantMeta();
  const [homePayload, setHomePayload] = useState<SpecializedCourseHomePayload | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sectionFilters, setSectionFilters] = useState<Record<string, string>>({});
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (demoMode) {
      return;
    }

    const discountCode = getActiveDiscountCode();

    api.specializedCourses.home(discountCode || undefined)
      .then((res) => {
        if (res.success) {
          setHomePayload(res.data);
        }
      });
  }, [demoMode]);

  const liveDefaultSpecializedCourseSettings = useMemo(() => buildLiveDefaultSpecializedCourseSettings(t), [t]);
  const settings = demoMode
    ? demoSpecializedCourseSettings
    : homePayload?.settings ?? tenantMeta?.audience?.specializedCourseSettings ?? liveDefaultSpecializedCourseSettings;
  const labels = settings.labels;
  const formatCourseMoney = (amount: number) => t("specializedCourseDetail.priceToman", { amount: format.number(amount) });
  const formatNumber = (value: number) => format.number(value);
  const formatPercent = (value: number) => format.percent(value);
  const usesDemoFallback = demoMode;
  const categories = useMemo(
    () => {
      if (demoMode) {
        return specializedCourseCategories;
      }

      if (homePayload) {
        return buildDisplayCategories(homePayload.categories ?? []);
      }

      return [specializedCourseCategories[0]];
    },
    [demoMode, homePayload],
  );
  const courses = useMemo(
    () => {
      if (demoMode) {
        return specializedCourseCards;
      }

      return homePayload ? buildDisplayCourses(homePayload.courses ?? [], t) : [];
    },
    [demoMode, homePayload, t],
  );
  const purchasedCourseItems = useMemo(
    () => (demoMode
      ? demoPurchasedCourses
      : (homePayload?.purchasedCourses ?? []).map((item, index) => ({
          ...item,
          accent: purchasedCourseAccents[index % purchasedCourseAccents.length],
        }))),
    [demoMode, homePayload?.purchasedCourses],
  );
  const sectionCourseIds = useMemo(
    () => new Map((homePayload?.sections ?? []).map((section) => [section.id, new Set(section.courseIds)])),
    [homePayload?.sections],
  );
  const courseSections = useMemo<SpecializedCoursePageSection[]>(
    () => (demoMode
      ? (settings.sections ?? []).filter((section) => section.enabled)
      : (homePayload?.sections?.length
      ? homePayload.sections.map((section) => ({
          id: section.id,
          enabled: true,
          title: section.title,
          description: section.description,
        }))
      : (settings.sections ?? []).filter((section) => section.enabled))),
    [demoMode, homePayload?.sections, settings.sections],
  );
  const heroSlides = useMemo<HeroSlidePresentation[]>(
    () =>
      (settings.carousel.slides ?? [])
        .filter((slide) => slide.enabled)
        .map((slide, index) => ({
          ...slide,
          gradient: heroSlidePresentation[index]?.gradient ?? heroSlidePresentation[0].gradient,
          imageUrl: slide.image_url || heroSlidePresentation[index]?.imageUrl || heroSlidePresentation[0].imageUrl,
          imagePosition: slide.image_position || heroSlidePresentation[index]?.imagePosition || heroSlidePresentation[0].imagePosition,
        })),
    [settings.carousel.slides],
  );
  const slideTargetCourseIds = useMemo(
    () => heroSlides.map((slide, index) => slide.linked_course_id ?? courses[index]?.id ?? ""),
    [courses, heroSlides],
  );

  useEffect(() => {
    setSectionFilters((current) => Object.fromEntries(courseSections.map((section) => [section.id, current[section.id] ?? "all"])));
  }, [courseSections]);

  useEffect(() => {
    if (!categories.some((category) => category.id === selectedCategory)) {
      setSelectedCategory("all");
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    const syncCurrentSlide = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };

    syncCurrentSlide();
    carouselApi.on("select", syncCurrentSlide);

    const interval = window.setInterval(() => {
      if (carouselApi.canScrollNext()) {
        carouselApi.scrollNext();
        return;
      }

      carouselApi.scrollTo(0);
    }, 5000);

    return () => {
      window.clearInterval(interval);
      carouselApi.off("select", syncCurrentSlide);
    };
  }, [carouselApi]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesCategory = selectedCategory === "all" || course.categoryId === selectedCategory;
      if (!matchesCategory) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = `${course.title} ${course.instructor}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [courses, normalizedSearch, selectedCategory]);

  if (!isAdmin && !isBarber) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <GraduationCap className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{settings.access.title}</h1>
          <p className="text-muted-foreground leading-7">
            {settings.access.description}
          </p>
          <Link href="/panel">
            <Button>{t("specializedCourses.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!demoMode && !settings.enabled) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <Card className="w-full max-w-2xl rounded-[28px] border-border/70 bg-card/80 text-center shadow-[0_24px_80px_-50px_rgba(245,158,11,0.55)]">
          <CardContent className="space-y-6 p-8 sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/25 bg-primary/10 text-primary">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl font-black">{settings.disabled?.title || t("specializedCourses.defaultTitle")}</h1>
              <p className="mx-auto max-w-xl text-base leading-8 text-muted-foreground">
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

  return (
    <div className="min-h-screen bg-background text-foreground pb-24" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[340px] bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.45),transparent)]" />

      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <BookOpenText className="h-5 w-5" />
              <span className="text-sm font-medium">{settings.header.eyebrow}</span>
            </div>
            <h1 className="text-xl font-black">{settings.header.title}</h1>
          </div>

          <Link href="/panel">
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

      <main className="container mx-auto max-w-6xl space-y-10 px-4 pt-6">
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden rounded-[30px] border-border/70 bg-card/70 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.85)]">
            <CardContent className="p-4 sm:p-5">
              <div className="relative rounded-[24px] border border-border/60 bg-background/40 p-1">
                <Search className="pointer-events-none absolute start-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={settings.search.placeholder}
                  className="h-14 rounded-[20px] border-0 bg-transparent ps-12 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {settings.hero.enabled ? (
            <Card className="overflow-hidden rounded-[30px] border border-primary/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(15,23,42,0.88))] shadow-[0_24px_80px_-48px_rgba(245,158,11,0.55)]">
              <CardContent className="flex h-full flex-col justify-between gap-5 p-6">
                <div className="space-y-3">
                  <Badge className="w-fit rounded-full border-0 bg-white/10 text-white hover:bg-white/10">{settings.hero.badge}</Badge>
                  <div className="text-2xl font-black leading-10 text-white">{settings.hero.title}</div>
                  <p className="text-sm leading-7 text-white/78">
                    {settings.hero.description}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  {settings.hero.stats.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-white/8 px-3 py-3 text-white">
                      <div className="text-lg font-black">{item.value}</div>
                      <div className="mt-1 text-xs text-white/70">{item.label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </section>

        {homePayload?.discountContext?.restrictToTeacherCourses ? (
          <Card className="rounded-[24px] border border-amber-500/20 bg-amber-500/10">
            <CardContent className="flex flex-col gap-2 p-5 text-start sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="font-bold text-amber-200">{t("specializedCourses.discountRestrictedTitle")}</div>
                <div className="text-sm leading-7 text-amber-100/80">
                  {t("specializedCourses.discountRestrictedPrefix")}{" "}
                  <CodeText className="font-bold text-amber-50">{homePayload.discountContext.code}</CodeText>{" "}
                  {homePayload.discountContext.salesUserName
                    ? t("specializedCourses.discountRestrictedWithTeacherSuffix", { teacher: homePayload.discountContext.salesUserName })
                    : t("specializedCourses.discountRestrictedSuffix")}
                </div>
              </div>
              <Badge className="w-fit rounded-full border-0 bg-amber-500/15 text-amber-100 hover:bg-amber-500/15">
                {t("specializedCourses.teacherFilterActive")}
              </Badge>
            </CardContent>
          </Card>
        ) : null}

        {settings.purchased.enabled ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-black">{settings.purchased.title}</h2>
              <p className="text-sm text-muted-foreground">{settings.purchased.description}</p>
            </div>
            <Badge className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
              {formatNumber(purchasedCourseItems.length)} {labels.active_courses_suffix}
            </Badge>
          </div>

          {purchasedCourseItems.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {purchasedCourseItems.map((course) => (
              <Card key={course.id} className="overflow-hidden rounded-[28px] border-border/70 bg-card/70">
                <CardContent className="p-0">
                  <div className={`bg-gradient-to-br ${course.accent} p-5 text-white`}>
                    <div className="flex items-center justify-between gap-3">
                      <Badge className="rounded-full border-0 bg-white/12 text-white hover:bg-white/12">{labels.purchased_badge}</Badge>
                      <div className="text-xs text-white/75">{labels.progress_label} {formatPercent(course.progress / 100)}</div>
                    </div>
                    <div className="mt-5 text-lg font-black leading-8">{course.title}</div>
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="space-y-2">
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {labels.continue_path_label} {course.nextLesson}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-foreground">{labels.learning_status_text}</div>
                      <Link href={`/panel/specialized-courses/${course.id}`}>
                        <Button className="rounded-2xl px-5">{labels.continue_learning_cta}</Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          ) : (
          <Card className="rounded-[28px] border-dashed border-border/70 bg-card/40">
            <CardContent className="p-8 text-center text-sm leading-7 text-muted-foreground">
              {t("specializedCourses.purchasedEmpty")}
            </CardContent>
          </Card>
          )}
        </section>
        ) : null}

        {settings.carousel.enabled && heroSlides.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-black">{settings.carousel.title}</h2>
              <p className="text-sm text-muted-foreground">{settings.carousel.description}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-2xl border-border/70 bg-card/60"
                onClick={() => carouselApi?.scrollPrev()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {heroSlides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => carouselApi?.scrollTo(index)}
                  className={`h-2.5 rounded-full transition-all ${currentSlide === index ? "w-8 bg-primary" : "w-2.5 bg-border"}`}
                  aria-label={t("specializedCourses.goToSlide", { index: formatNumber(index + 1) })}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-2xl border-border/70 bg-card/60"
                onClick={() => carouselApi?.scrollNext()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Carousel setApi={setCarouselApi} opts={{ align: "start", loop: true, direction: "ltr" }} className="w-full" dir="ltr">
            <CarouselContent>
              {heroSlides.map((slide, index) => (
                <CarouselItem key={slide.id}>
                  <div className={`relative overflow-hidden rounded-[34px] border border-white/10 bg-gradient-to-br ${slide.gradient} p-6 sm:p-8`} dir={dir}>
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ objectPosition: slide.imagePosition ?? "center center" }}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.88),rgba(15,23,42,0.46),rgba(15,23,42,0.22)),radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_28%)]" />
                    <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                      <div className="space-y-5 text-start text-white">
                        <Badge className="rounded-full border-0 bg-black/20 text-white hover:bg-black/20">{slide.eyebrow}</Badge>
                        <div className="max-w-xl text-3xl font-black leading-[3.2rem] sm:text-4xl">{slide.title}</div>
                        <p className="max-w-lg text-sm leading-8 text-white/82 sm:text-base">{slide.description}</p>
                        <div className="flex flex-wrap items-center gap-3">
                          {slideTargetCourseIds[index] ? (
                            <Link href={`/panel/specialized-courses/${slideTargetCourseIds[index]}`}>
                              <Button className="rounded-2xl bg-white text-slate-900 hover:bg-white/90">{slide.cta}</Button>
                            </Link>
                          ) : (
                            <Button disabled className="rounded-2xl bg-white text-slate-900 hover:bg-white">
                              {slide.cta}
                            </Button>
                          )}
                          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/86">
                            {slide.stat}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {settings.carousel.side_cards.map((item, index) => (
                          <div key={item.id} className="rounded-[28px] border border-white/16 bg-black/18 p-5 text-white backdrop-blur">
                            <div className="text-sm text-white/70">{item.eyebrow}</div>
                            <div className="mt-2 text-xl font-black">{item.title}</div>
                            <div className="mt-4 flex items-center gap-2 text-sm text-white/78">
                              {index === 0 ? <Sparkles className="h-4 w-4" /> : <BadgePercent className="h-4 w-4" />}
                              {item.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </section>
        ) : null}

        {settings.categories.enabled ? (
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-black">{settings.categories.title}</h2>
              <p className="text-sm text-muted-foreground">{settings.categories.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {categories.map((category) => {
              const Icon = category.icon;
              const active = selectedCategory === category.id;

              return (
                <Link
                  key={category.id}
                  href={`/panel/specialized-courses/category/${category.id}`}
                  className={`group relative block overflow-hidden rounded-[26px] border p-4 text-start transition-all ${
                    active
                      ? "border-primary/50 bg-primary/10 shadow-lg shadow-primary/10"
                      : "border-border/70 bg-card/60 hover:border-primary/30 hover:bg-card"
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${category.tone} opacity-80`} />
                  <div className="relative space-y-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${active ? "bg-primary text-primary-foreground" : "bg-background/70 text-primary"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold">{category.title}</div>
                      <div className="mt-1 text-xs leading-6 text-muted-foreground">{category.subtitle}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
        ) : null}

        {courseSections.map((section, index) => {
          const currentFilter = sectionFilters[section.id] ?? "all";
          const sectionCourses = filteredCourses.filter((course) => {
            const inSection = usesDemoFallback
              ? course.sectionIds.includes(section.id)
              : (sectionCourseIds.get(section.id)?.has(course.id) ?? false);
            const categoryMatch = currentFilter === "all" || course.categoryId === currentFilter;
            return inSection && categoryMatch;
          });

          return (
            <section key={section.id} className="space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-black">{section.title}</h2>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{section.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {categories.slice(0, 5).map((category) => (
                    <button
                      key={`${section.id}-${category.id}`}
                      type="button"
                      onClick={() => setSectionFilters((current) => ({ ...current, [section.id]: category.id }))}
                      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                        currentFilter === category.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/70 bg-card/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {category.title}
                    </button>
                  ))}
                  <Button variant="ghost" className="rounded-full px-0 text-sm text-primary">
                    {labels.more_button}
                    <ChevronLeft className="ms-1 h-4 w-4" />
                  </Button>
                </div>
              </div>

              {sectionCourses.length === 0 ? (
                <Card className="rounded-[28px] border-dashed border-border/70 bg-card/40">
                  <CardContent className="p-8 text-center text-sm leading-7 text-muted-foreground">
                    {labels.empty_state}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {sectionCourses.map((course) => (
                    <SpecializedCourseCard
                      key={course.id}
                      course={course}
                      labels={labels}
                      formatCourseMoney={formatCourseMoney}
                      formatNumber={formatNumber}
                      formatPercent={formatPercent}
                    />
                  ))}
                </div>
              )}

              {index === 1 && settings.highlight_banner.enabled ? (
                <Card className="overflow-hidden rounded-[32px] border border-primary/20 bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(15,23,42,0.92),rgba(245,158,11,0.14))]">
                  <CardContent className="grid gap-6 p-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
                    <div className="space-y-3 text-start">
                      <Badge className="w-fit rounded-full border-0 bg-white/10 text-white hover:bg-white/10">{settings.highlight_banner.badge}</Badge>
                      <div className="text-2xl font-black leading-10 text-white">{settings.highlight_banner.title}</div>
                      <p className="text-sm leading-8 text-white/78">
                        {settings.highlight_banner.description}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {settings.highlight_banner.items.map((item) => (
                        <div key={item.id} className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-5 text-sm font-medium leading-7 text-white backdrop-blur">
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </section>
          );
        })}

        {settings.faq.enabled ? (
        <section className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-black">{settings.faq.title}</h2>
            <p className="text-sm text-muted-foreground">{settings.faq.description}</p>
          </div>

          <Card className="rounded-[30px] border-border/70 bg-card/70">
            <CardContent className="p-4 sm:p-6">
              <Accordion type="single" collapsible className="w-full">
                {settings.faq.items.map((item) => (
                  <AccordionItem key={item.id} value={item.id} className="border-border/70">
                    <AccordionTrigger className="text-start text-base font-bold leading-8 hover:no-underline">
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
        ) : null}
      </main>
    </div>
  );
}
