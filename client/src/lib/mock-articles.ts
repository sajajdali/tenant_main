export type MockArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading2"; text: string }
  | { type: "heading3"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string; author?: string }
  | { type: "image"; src: string; alt: string; caption?: string };

export type MockArticle = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: "اخبار" | "آموزش" | "تحلیل";
  publishedAt: string;
  readTime: string;
  author: string;
  views: number;
  coverImage: string;
  coverAlt: string;
  featured?: boolean;
  tags: string[];
  content: MockArticleBlock[];
};

export const articleCategories = ["همه", "اخبار", "آموزش", "تحلیل"] as const;

export const mockArticles: MockArticle[] = [
  {
    id: 1,
    slug: "digital-trends-1405",
    title: "۵ روند مهمی که تجربه دیجیتال کاربران را در ۱۴۰۵ تغییر می‌دهد",
    excerpt: "از طراحی محتوای سریع‌خوان تا شخصی‌سازی مبتنی بر رفتار کاربر، این روندها مستقیماً روی نرخ تعامل و ماندگاری مخاطب اثر می‌گذارند.",
    category: "تحلیل",
    publishedAt: "۱۴۰۵/۰۱/۱۸",
    readTime: "۸ دقیقه",
    author: "نسترن مرادی",
    views: 3240,
    featured: true,
    coverImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    coverAlt: "تحلیل روندهای دیجیتال",
    tags: ["طراحی تجربه", "استراتژی محتوا", "دیجیتال"],
    content: [
      { type: "paragraph", text: "در سال ۱۴۰۵ دیگر صرفاً داشتن یک وبسایت زیبا کافی نیست. مخاطب به دنبال سرعت، شفافیت و تجربه‌ای است که بدون اصطکاک او را به پاسخ برساند." },
      { type: "heading2", text: "چرا این روندها مهم هستند؟" },
      { type: "paragraph", text: "کسب‌وکارهایی که زودتر به این الگوها واکنش نشان می‌دهند، معمولاً در نرخ تبدیل، زمان ماندگاری و اعتماد کاربر عملکرد بهتری خواهند داشت." },
      { type: "list", items: ["تمرکز بر متن‌های کوتاه و ساختاریافته", "افزایش استفاده از ماژول‌های تعاملی", "بهینه‌سازی برای موبایل به‌عنوان نسخه اصلی", "استفاده از داده برای شخصی‌سازی محتوا"] },
      { type: "image", src: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80", alt: "میز کار مدرن برای تولید محتوا", caption: "محیط‌های کاری ساده و ساختاریافته، تصمیم‌گیری محتوا را سریع‌تر می‌کنند." },
      { type: "heading3", text: "جمع‌بندی" },
      { type: "paragraph", text: "اگر قرار است فقط یک چیز را تغییر دهید، روی وضوح مسیر کاربر تمرکز کنید. هر چه کاربر سریع‌تر بفهمد کجا هست و قدم بعدی چیست، احتمال تعامل بیشتر می‌شود." },
    ],
  },
  {
    id: 2,
    slug: "content-writing-checklist",
    title: "چک‌لیست ساده برای نوشتن مقاله‌ای که واقعاً خوانده شود",
    excerpt: "ساختار تیترها، پاراگراف‌های کوتاه، CTA روشن و لحن همدلانه از مهم‌ترین عواملی هستند که مقاله را خواندنی‌تر می‌کنند.",
    category: "آموزش",
    publishedAt: "۱۴۰۵/۰۱/۱۱",
    readTime: "۶ دقیقه",
    author: "سارا پاک‌نژاد",
    views: 2760,
    coverImage: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
    coverAlt: "آموزش نگارش محتوا",
    tags: ["مقاله‌نویسی", "کپی‌رایتینگ", "آموزش"],
    content: [
      { type: "paragraph", text: "نوشتن مقاله‌ای که تا انتها خوانده شود، بیشتر از هر چیز به ساختار بستگی دارد. کاربر اگر در چند ثانیه اول سردرگم شود، صفحه را می‌بندد." },
      { type: "heading2", text: "از تیتر شروع کنید" },
      { type: "paragraph", text: "تیتر خوب باید هم شفاف باشد و هم کنجکاوی ایجاد کند. قولی که در تیتر می‌دهید، باید در متن به‌وضوح پاسخ داده شود." },
      { type: "list", items: ["تیتر روشن و بدون ابهام", "پاراگراف‌های ۲ تا ۴ خطی", "استفاده از زیرتیتر برای اسکن سریع", "دعوت به اقدام در پایان متن"] },
      { type: "quote", text: "مقاله خوب فقط اطلاعات نمی‌دهد؛ خواننده را تا قدم بعدی همراهی می‌کند.", author: "تیم محتوا" },
    ],
  },
  {
    id: 3,
    slug: "product-launch-news",
    title: "نسخه جدید پلتفرم با تمرکز بر سرعت و خوانایی منتشر شد",
    excerpt: "در نسخه جدید، ساختار صفحه‌ها سبک‌تر شده، جستجو سریع‌تر کار می‌کند و تجربه مطالعه روی موبایل به‌طور کامل بازطراحی شده است.",
    category: "اخبار",
    publishedAt: "۱۴۰۵/۰۱/۰۶",
    readTime: "۴ دقیقه",
    author: "تحریریه",
    views: 4120,
    coverImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    coverAlt: "خبر انتشار نسخه جدید",
    tags: ["محصول", "انتشار نسخه", "اخبار"],
    content: [
      { type: "paragraph", text: "در این به‌روزرسانی، چند بخش کلیدی با هدف کاهش زمان رسیدن کاربر به محتوا بازنویسی شده‌اند. تمرکز اصلی روی تجربه موبایل، عملکرد سریع‌تر و طراحی مینیمال بوده است." },
      { type: "heading2", text: "چه چیزهایی تغییر کرده است؟" },
      { type: "list", items: ["بهبود سرعت بارگذاری صفحه‌های محتوایی", "بازطراحی لیست مقالات", "افزایش خوانایی فونت و فاصله‌ها", "مرتب‌سازی بهتر محتوای مرتبط"] },
    ],
  },
  {
    id: 4,
    slug: "seo-and-user-intent",
    title: "سئو بدون درک نیت کاربر، فقط ترافیک می‌آورد نه نتیجه",
    excerpt: "اگر مقاله دقیقاً به سؤال کاربر جواب ندهد، حتی رتبه خوب هم به تبدیل منجر نمی‌شود. اینجا از نیت جستجو و ساختار پاسخ می‌گوییم.",
    category: "تحلیل",
    publishedAt: "۱۴۰۴/۱۲/۲۷",
    readTime: "۷ دقیقه",
    author: "حمید رستگار",
    views: 1980,
    coverImage: "https://images.unsplash.com/photo-1487014679447-9f8336841d58?auto=format&fit=crop&w=1200&q=80",
    coverAlt: "تحلیل سئو و نیت کاربر",
    tags: ["سئو", "تحلیل رفتار", "محتوا"],
    content: [
      { type: "paragraph", text: "گاهی صفحه شما بازدید خوبی می‌گیرد اما خروجی ندارد. دلیل اصلی معمولاً ناهماهنگی بین نیت جستجو و پاسخ محتوایی است." },
      { type: "heading2", text: "نیت کاربر را از کجا بفهمیم؟" },
      { type: "paragraph", text: "نوع کلمات کلیدی، ساختار نتایج گوگل و سؤال‌هایی که در کامنت‌ها یا تماس‌های فروش می‌شنوید، بهترین منبع برای درک نیت هستند." },
    ],
  },
  {
    id: 5,
    slug: "building-a-content-calendar",
    title: "چطور یک تقویم محتوایی سبک اما قابل اجرا بسازیم؟",
    excerpt: "تقویم محتوا وقتی ارزشمند است که واقعی، قابل نگهداری و متناسب با ظرفیت تیم باشد. در این راهنما یک مدل ساده و مؤثر را مرور می‌کنیم.",
    category: "آموزش",
    publishedAt: "۱۴۰۴/۱۲/۲۰",
    readTime: "۵ دقیقه",
    author: "الهام صادقی",
    views: 1650,
    coverImage: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1200&q=80",
    coverAlt: "تقویم محتوایی",
    tags: ["برنامه‌ریزی", "تقویم محتوا", "آموزش"],
    content: [
      { type: "paragraph", text: "بسیاری از تیم‌ها با تقویم‌های پیچیده شروع می‌کنند اما بعد از چند هفته آن را کنار می‌گذارند. راه‌حل، طراحی یک سیستم سبک و تکرارپذیر است." },
      { type: "list", items: ["تعداد موضوعات ماهانه را محدود کنید", "برای هر مقاله هدف مشخص تعریف کنید", "وضعیت هر محتوا را شفاف نگه دارید"] },
    ],
  },
  {
    id: 6,
    slug: "newsroom-design-patterns",
    title: "الگوهای طراحی اتاق خبر دیجیتال برای وبسایت‌های فارسی",
    excerpt: "از سلسله‌مراتب بصری گرفته تا فاصله‌گذاری و ماژول‌های مرور سریع، این الگوها برای صفحه‌های خبری و مجله‌ای بسیار مؤثر هستند.",
    category: "تحلیل",
    publishedAt: "۱۴۰۴/۱۲/۱۲",
    readTime: "۹ دقیقه",
    author: "مانی نعمتی",
    views: 2210,
    coverImage: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80",
    coverAlt: "طراحی اتاق خبر دیجیتال",
    tags: ["UI", "اخبار", "تجربه مطالعه"],
    content: [
      { type: "paragraph", text: "در وبسایت‌های محتوایی فارسی، ترکیب خوانایی، نظم بصری و راست‌چین بودن استانداردها اهمیت زیادی دارد. صفحه باید سریع اسکن شود و در عین حال حس حرفه‌ای بدهد." },
      { type: "heading2", text: "سه اصل کلیدی" },
      { type: "list", items: ["هدر آرام و بدون شلوغی", "فاصله‌گذاری سخاوتمندانه", "کارت‌های هم‌اندازه با CTA واضح"] },
    ],
  },
];

export function getArticleBySlug(slug?: string | null) {
  return mockArticles.find((article) => article.slug === slug) ?? null;
}

export function getRelatedArticles(slug?: string | null, limit = 3) {
  const article = getArticleBySlug(slug);
  if (!article) {
    return mockArticles.slice(0, limit);
  }

  return mockArticles.filter((item) => item.slug !== article.slug && item.category === article.category).slice(0, limit);
}
