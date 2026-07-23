export type SpecializedLessonItem = {
  id: string;
  title: string;
  duration: string;
  isFree?: boolean;
  videoUrl: string;
};

export type SpecializedChapterItem = {
  id: string;
  title: string;
  lessons: SpecializedLessonItem[];
};

export type SpecializedCourseDetail = {
  id: string;
  title: string;
  instructor: string;
  heroImage: string;
  heroImagePosition?: string;
  previewVideoUrl: string;
  previewDuration: string;
  description: string;
  students: number;
  rating: number;
  reviewsCount: number;
  chapterCount: number;
  totalDuration: string;
  price: number;
  discountedPrice: number;
  discountPercent: number;
  countdownTargetAt: string;
  learningPoints: string[];
  requirements: string[];
  about: string;
  reviews: Array<{
    id: string;
    reviewerName: string;
    rating: number;
    body: string;
    createdAt: string;
    adminReply?: string;
  }>;
  faq: Array<{ id: string; question: string; answer: string }>;
  chapters: SpecializedChapterItem[];
};

export const specializedCourseCatalog: SpecializedCourseDetail[] = [
  {
    id: "course-1",
    title: "آموزش جامع کوتاهی کلاسیک و مدرن",
    instructor: "مهرداد کاظمی",
    heroImage: "https://images.pexels.com/photos/7697645/pexels-photo-7697645.jpeg?auto=compress&cs=tinysrgb&w=1600",
    heroImagePosition: "center top",
    previewVideoUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
    previewDuration: "۵:۳۷",
    description: "این دوره برای آرایشگرانی طراحی شده که می‌خواهند از کوتاهی پایه و کلاسیک وارد اجرای تمیز، فید حرفه‌ای، فرم‌سازی چهره و تحویل استاندارد مشتری شوند. ساختار دوره کاملاً مرحله‌به‌مرحله است و حتی در حالت تستی فعلی هم برای نمایش نهایی صفحه با محتوای واقعی طراحی شده است.",
    students: 1240,
    rating: 4.9,
    reviewsCount: 214,
    chapterCount: 19,
    totalDuration: "۱۲ ساعت",
    price: 3490000,
    discountedPrice: 2890000,
    discountPercent: 17,
    countdownTargetAt: "2026-04-02T23:59:59+03:30",
    learningPoints: [
      "آشنایی با فرم صورت و انتخاب مدل مناسب برای هر مشتری",
      "اجرای فید تمیز، تیپر، لاین‌سازی و تحویل حرفه‌ای",
      "مدیریت گفت‌وگو با مشتری و افزایش رضایت در پایان کار",
      "ساخت یک روند کاری سریع و استاندارد برای سالن شلوغ",
    ],
    requirements: [
      "این دوره از سطح مقدماتی قابل شروع است و نیاز به پیش‌نیاز خاصی ندارد.",
      "اگر آرایشگر فعال سالن هستید، از همان بخش‌های ابتدایی هم می‌توانید نکات کاربردی اجرا را استفاده کنید.",
    ],
    about: "تمرکز اصلی این صفحه روی UI نهایی است، اما ساختار آن برای سناریوی واقعی طراحی شده؛ یعنی معرفی، سرفصل، نظرات، سوالات متداول و نوار خرید ثابت همگی آماده‌اند تا بعداً به دیتای واقعی دوره متصل شوند.",
    reviews: [
      {
        id: "review-1",
        reviewerName: "امین مرادی",
        rating: 5,
        body: "بیان مدرس خیلی واضح بود و مخصوصاً بخش اصلاح فرم صورت برای من خیلی کاربردی بود. از حالت صرفاً تئوری هم بیرون آمده و حس اجرای واقعی دارد.",
        createdAt: "2026-03-22",
        adminReply: "خوشحالیم که این بخش برای شما مفید بوده. در نسخه واقعی، ویدئوهای تکمیلی هم به همین دوره اضافه می‌شود.",
      },
      {
        id: "review-2",
        reviewerName: "رضا محمدی",
        rating: 4,
        body: "ساختار دوره خوبه و اینکه ویدئوهای رایگان اول باز هستند خیلی خوبه چون قبل از خرید حس دوره را می‌گیری.",
        createdAt: "2026-03-18",
      },
    ],
    faq: [
      {
        id: "faq-1",
        question: "آیا بعضی ویدئوها قبل از خرید قابل مشاهده هستند؟",
        answer: "بله، در این طراحی چند ویدئوی ابتدایی به‌صورت آزاد نمایش داده می‌شوند و باقی سرفصل‌ها قفل هستند تا کاربر قبل از خرید فضای دوره را ببیند.",
      },
      {
        id: "faq-2",
        question: "بعد از خرید، دسترسی دوره چطور نمایش داده می‌شود؟",
        answer: "در نسخه نهایی، قفل ویدئوها باز می‌شود و کاربر می‌تواند از همین صفحه وارد درس‌ها و پیشرفت خود شود.",
      },
    ],
    chapters: [
      {
        id: "chapter-1",
        title: "مقدمه و شروع مسیر",
        lessons: [
          { id: "lesson-1", title: "معرفی دوره و نقشه راه", duration: "۵:۳۷", isFree: true, videoUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4" },
          { id: "lesson-2", title: "چرا فرم صورت مهم است؟", duration: "۶:۱۲", isFree: true, videoUrl: "https://samplelib.com/lib/preview/mp4/sample-10s.mp4" },
          { id: "lesson-3", title: "چطور از این دوره بیشترین استفاده را بکنیم", duration: "۴:۵۵", videoUrl: "https://samplelib.com/lib/preview/mp4/sample-15s.mp4" },
        ],
      },
      {
        id: "chapter-2",
        title: "فید و تیپر اصولی",
        lessons: [
          { id: "lesson-4", title: "درک مرزها و خطوط اولیه", duration: "۸:۲۰", videoUrl: "https://samplelib.com/lib/preview/mp4/sample-20s.mp4" },
          { id: "lesson-5", title: "ساخت فید متوسط و نرم", duration: "۹:۴۰", videoUrl: "https://samplelib.com/lib/preview/mp4/sample-30s.mp4" },
          { id: "lesson-6", title: "تمیزکاری نهایی و کنترل جزئیات", duration: "۷:۱۸", videoUrl: "https://samplelib.com/lib/preview/mp4/sample-5mb.mp4" },
        ],
      },
      {
        id: "chapter-3",
        title: "تحویل حرفه‌ای و تجربه مشتری",
        lessons: [
          { id: "lesson-7", title: "گفت‌وگو با مشتری و مدیریت انتظارات", duration: "۵:۳۰", videoUrl: "https://samplelib.com/lib/preview/mp4/sample-10mb.mp4" },
          { id: "lesson-8", title: "پایان‌بندی حرفه‌ای و معرفی خدمات بعدی", duration: "۶:۴۸", videoUrl: "https://samplelib.com/lib/preview/mp4/sample-15mb.mp4" },
        ],
      },
    ],
  },
  {
    id: "course-2",
    title: "فرمول‌خوانی رنگ و لایت از پایه تا پیشرفته",
    instructor: "سمیه مرادی",
    heroImage: "https://images.pexels.com/photos/3993311/pexels-photo-3993311.jpeg?auto=compress&cs=tinysrgb&w=1600",
    heroImagePosition: "center center",
    previewVideoUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
    previewDuration: "۴:۵۰",
    description: "دوره‌ای برای کسانی که می‌خواهند تشخیص پایه، ترکیب رنگ، انتخاب مواد و اجرای اصولی رنگ و لایت را به‌صورت ساختاریافته یاد بگیرند.",
    students: 980,
    rating: 4.8,
    reviewsCount: 162,
    chapterCount: 16,
    totalDuration: "۹ ساعت",
    price: 4290000,
    discountedPrice: 3590000,
    discountPercent: 16,
    countdownTargetAt: "2026-04-03T20:00:00+03:30",
    learningPoints: [
      "تشخیص پایه مو و انتخاب مسیر صحیح اجرا",
      "خواندن فرمول‌ها و ترکیب منطقی مواد",
      "جلوگیری از خطاهای رایج در رنگ و لایت",
      "مدیریت زمان و کیفیت خروجی در سالن",
    ],
    requirements: ["برای شروع این دوره، فقط آشنایی مقدماتی با خدمات رنگ کافی است."],
    about: "این صفحه برای نمایش نهایی ساختار دوره طراحی شده و بعداً محتوای دقیق هر درس، مدرس و پیش‌نمایش واقعی به آن متصل می‌شود.",
    reviews: [],
    faq: [
      { id: "faq-1", question: "این دوره برای رنگ‌کار مبتدی مناسب است؟", answer: "بله، ساختار آن از پایه چیده شده و به‌تدریج وارد سطوح بالاتر می‌شود." },
    ],
    chapters: [
      { id: "chapter-1", title: "مقدمه", lessons: [{ id: "lesson-1", title: "معرفی مسیر یادگیری", duration: "۴:۵۰", isFree: true, videoUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4" }] },
      { id: "chapter-2", title: "شناخت پایه‌ها", lessons: [{ id: "lesson-2", title: "درک پایه مو", duration: "۸:۱۲", videoUrl: "https://samplelib.com/lib/preview/mp4/sample-10s.mp4" }] },
    ],
  },
];

const STORAGE_PREFIX = "specialized-course-watched";

export function getSpecializedCourseById(courseId: string) {
  return specializedCourseCatalog.find((item) => item.id === courseId) ?? null;
}

export function getSpecializedLesson(courseId: string, lessonId: string) {
  const course = getSpecializedCourseById(courseId);
  if (!course) {
    return { course: null, chapter: null, lesson: null };
  }

  for (const chapter of course.chapters) {
    const lesson = chapter.lessons.find((item) => item.id === lessonId);
    if (lesson) {
      return { course, chapter, lesson };
    }
  }

  return { course, chapter: null, lesson: null };
}

export function formatSpecializedCountdown(targetAt: string) {
  const targetTime = new Date(targetAt).getTime();
  const diff = Math.max(0, targetTime - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours,
    minutes,
    seconds,
  };
}

export function getWatchedLessons(courseId: string) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:${courseId}`);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markLessonAsWatched(courseId: string, lessonId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const current = new Set(getWatchedLessons(courseId));
  current.add(lessonId);
  window.localStorage.setItem(`${STORAGE_PREFIX}:${courseId}`, JSON.stringify(Array.from(current)));
}
