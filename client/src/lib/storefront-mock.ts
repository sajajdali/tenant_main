export type StorefrontCategory = {
  id: string;
  title: string;
  subtitle: string;
  imageLabel: string;
  gradient: string;
};

export type StorefrontProduct = {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  originalPrice?: string;
  discountPercent?: number;
  badge?: string;
  imageLabel: string;
  gradient: string;
  categoryId: string;
};

export type StorefrontProductDetail = StorefrontProduct & {
  categoryTitle: string;
  breadcrumbs: string[];
  description: string;
  gallery: Array<{
    id: string;
    label: string;
    gradient: string;
  }>;
  highlights: string[];
};

export type StorefrontCartItem = {
  id: string;
  productId: string;
  title: string;
  subtitle: string;
  price: string;
  quantity: number;
  imageLabel: string;
  gradient: string;
};

export const storefrontCategories: StorefrontCategory[] = [
  {
    id: "care",
    title: "مراقبت مو",
    subtitle: "روتین روزانه",
    imageLabel: "Care",
    gradient: "linear-gradient(135deg, #3b2f52 0%, #f59e0b 100%)",
  },
  {
    id: "color",
    title: "رنگ و تثبیت",
    subtitle: "درخشش ماندگار",
    imageLabel: "Color",
    gradient: "linear-gradient(135deg, #1c3557 0%, #ffb347 100%)",
  },
  {
    id: "skin",
    title: "پوست و صورت",
    subtitle: "شفاف و سالم",
    imageLabel: "Skin",
    gradient: "linear-gradient(135deg, #2f4858 0%, #f7c873 100%)",
  },
  {
    id: "tools",
    title: "ابزار حرفه‌ای",
    subtitle: "برای متخصص‌ها",
    imageLabel: "Tools",
    gradient: "linear-gradient(135deg, #20283d 0%, #ff9f1c 100%)",
  },
];

export const bestSellerProducts: StorefrontProduct[] = [
  {
    id: "bs-1",
    title: "شامپو تقویت‌کننده",
    subtitle: "برای موهای حساس و رنگ‌شده",
    price: "۳۹۸٬۰۰۰ تومان",
    badge: "پرفروش",
    imageLabel: "Shampoo",
    gradient: "linear-gradient(135deg, #17324d 0%, #f59e0b 100%)",
    categoryId: "care",
  },
  {
    id: "bs-2",
    title: "ماسک تثبیت رنگ",
    subtitle: "نرمی و براقیت بعد از رنگ",
    price: "۵۴۰٬۰۰۰ تومان",
    originalPrice: "۶۸۰٬۰۰۰ تومان",
    discountPercent: 21,
    badge: "ویژه",
    imageLabel: "Mask",
    gradient: "linear-gradient(135deg, #3f234f 0%, #ffb347 100%)",
    categoryId: "color",
  },
  {
    id: "bs-3",
    title: "سرم آبرسان صورت",
    subtitle: "سبک، سریع و موثر",
    price: "۶۸۵٬۰۰۰ تومان",
    imageLabel: "Serum",
    gradient: "linear-gradient(135deg, #224b45 0%, #ffcf66 100%)",
    categoryId: "skin",
  },
  {
    id: "bs-4",
    title: "ماشین اصلاح حرفه‌ای",
    subtitle: "قدرت بالا و صدای کم",
    price: "۲٬۴۹۰٬۰۰۰ تومان",
    badge: "جدید",
    imageLabel: "Clipper",
    gradient: "linear-gradient(135deg, #2f3347 0%, #f5a623 100%)",
    categoryId: "tools",
  },
  {
    id: "bs-5",
    title: "روغن آرگان خالص",
    subtitle: "محبوب برای نرمی و براقیت مو",
    price: "۵۸۰٬۰۰۰ تومان",
    badge: "پرطرفدار",
    imageLabel: "Argan",
    gradient: "linear-gradient(135deg, #1d4564 0%, #f9a826 100%)",
    categoryId: "care",
  },
  {
    id: "bs-6",
    title: "ژل آبرسان صورت",
    subtitle: "سبک و مناسب استفاده روزانه",
    price: "۴۱۰٬۰۰۰ تومان",
    imageLabel: "Hydra",
    gradient: "linear-gradient(135deg, #24534c 0%, #f4c95d 100%)",
    categoryId: "skin",
  },
  {
    id: "bs-7",
    title: "رنگ موی حرفه‌ای",
    subtitle: "پوشش بالا با ماندگاری بیشتر",
    price: "۷۶۵٬۰۰۰ تومان",
    badge: "پیشنهاد ویژه",
    imageLabel: "Color+",
    gradient: "linear-gradient(135deg, #45284c 0%, #ffb05c 100%)",
    categoryId: "color",
  },
  {
    id: "bs-8",
    title: "سشوار حرفه‌ای",
    subtitle: "توان بالا با موتور کم‌صدا",
    price: "۳٬۲۹۰٬۰۰۰ تومان",
    imageLabel: "Dryer",
    gradient: "linear-gradient(135deg, #243249 0%, #f5a524 100%)",
    categoryId: "tools",
  },
];

export const popularProducts: StorefrontProduct[] = [
  {
    id: "pp-1",
    title: "اسپری محافظ حرارت",
    subtitle: "قبل از سشوار و اتو",
    price: "۴۴۰٬۰۰۰ تومان",
    badge: "محبوب",
    imageLabel: "Spray",
    gradient: "linear-gradient(135deg, #18364b 0%, #eab308 100%)",
    categoryId: "care",
  },
  {
    id: "pp-2",
    title: "کرم ترمیم‌کننده پوست",
    subtitle: "جذب سریع و لطافت بالا",
    price: "۳۲۰٬۰۰۰ تومان",
    imageLabel: "Cream",
    gradient: "linear-gradient(135deg, #47335b 0%, #fbbf24 100%)",
    categoryId: "skin",
  },
  {
    id: "pp-3",
    title: "رنگ موی بدون آمونیاک",
    subtitle: "پوشش بالا و درخشش طبیعی",
    price: "۷۱۰٬۰۰۰ تومان",
    originalPrice: "۸۹۰٬۰۰۰ تومان",
    discountPercent: 20,
    badge: "ترند",
    imageLabel: "Color",
    gradient: "linear-gradient(135deg, #1f3f5b 0%, #ff9f43 100%)",
    categoryId: "color",
  },
  {
    id: "pp-4",
    title: "قیچی اصلاح حرفه‌ای",
    subtitle: "سبک، دقیق و خوش‌دست",
    price: "۱٬۱۸۰٬۰۰۰ تومان",
    imageLabel: "Scissor",
    gradient: "linear-gradient(135deg, #20283d 0%, #ffd166 100%)",
    categoryId: "tools",
  },
  {
    id: "pp-5",
    title: "واکس مو نیمه‌مات",
    subtitle: "استایل تمیز و طبیعی",
    price: "۳۵۵٬۰۰۰ تومان",
    imageLabel: "Wax",
    gradient: "linear-gradient(135deg, #17334a 0%, #f2aa4c 100%)",
    categoryId: "care",
  },
  {
    id: "pp-6",
    title: "کرم ضدآفتاب رنگی",
    subtitle: "پوشش سبک و محافظت روزانه",
    price: "۴۶۵٬۰۰۰ تومان",
    badge: "محبوب",
    imageLabel: "Sun",
    gradient: "linear-gradient(135deg, #3f3159 0%, #ffc857 100%)",
    categoryId: "skin",
  },
  {
    id: "pp-7",
    title: "پودر دکلره حرفه‌ای",
    subtitle: "روشن‌کنندگی یکنواخت و تمیز",
    price: "۸۹۰٬۰۰۰ تومان",
    imageLabel: "Bleach",
    gradient: "linear-gradient(135deg, #1e405b 0%, #ffb347 100%)",
    categoryId: "color",
  },
  {
    id: "pp-8",
    title: "ماشین خط‌زن",
    subtitle: "دقت بالا برای فینیش حرفه‌ای",
    price: "۱٬۷۸۰٬۰۰۰ تومان",
    badge: "ترند",
    imageLabel: "Line",
    gradient: "linear-gradient(135deg, #2a3144 0%, #ffd166 100%)",
    categoryId: "tools",
  },
];

export const latestProducts: StorefrontProduct[] = [
  {
    id: "lp-1",
    title: "روغن مو آرگان",
    subtitle: "درخشش و نرمی روزانه",
    price: "۴۹۵٬۰۰۰ تومان",
    imageLabel: "Argan",
    gradient: "linear-gradient(135deg, #1f3d5a 0%, #f6b73c 100%)",
    categoryId: "care",
  },
  {
    id: "lp-2",
    title: "ماسک کراتین",
    subtitle: "حس ابریشمی بعد از حمام",
    price: "۶۲۵٬۰۰۰ تومان",
    imageLabel: "Keratin",
    gradient: "linear-gradient(135deg, #4a2d52 0%, #f7b955 100%)",
    categoryId: "care",
  },
  {
    id: "lp-3",
    title: "ژل شست‌وشوی صورت",
    subtitle: "پاکسازی سبک و روزانه",
    price: "۲۸۵٬۰۰۰ تومان",
    imageLabel: "Face",
    gradient: "linear-gradient(135deg, #204f49 0%, #ffd166 100%)",
    categoryId: "skin",
  },
  {
    id: "lp-4",
    title: "برس حرارتی",
    subtitle: "استایل سریع‌تر در خانه",
    price: "۱٬۳۹۰٬۰۰۰ تومان",
    imageLabel: "Brush",
    gradient: "linear-gradient(135deg, #263248 0%, #ffb703 100%)",
    categoryId: "tools",
  },
  {
    id: "lp-5",
    title: "رژلب مخملی",
    subtitle: "رنگ ماندگار و سبک",
    price: "۳۷۵٬۰۰۰ تومان",
    imageLabel: "Velvet",
    gradient: "linear-gradient(135deg, #4f2446 0%, #ff9f68 100%)",
    categoryId: "color",
  },
  {
    id: "lp-6",
    title: "اسپری براق‌کننده مو",
    subtitle: "فینیش نهایی و حرفه‌ای",
    price: "۳۱۰٬۰۰۰ تومان",
    imageLabel: "Gloss",
    gradient: "linear-gradient(135deg, #17324d 0%, #ffc857 100%)",
    categoryId: "care",
  },
];

export const storefrontCartItems: StorefrontCartItem[] = [
  {
    id: "cart-1",
    productId: "bs-1",
    title: "شامپو تقویت‌کننده",
    subtitle: "برای موهای حساس و رنگ‌شده",
    price: "۳۹۸٬۰۰۰ تومان",
    quantity: 1,
    imageLabel: "Shampoo",
    gradient: "linear-gradient(135deg, #17324d 0%, #f59e0b 100%)",
  },
  {
    id: "cart-2",
    productId: "bs-2",
    title: "ماسک تثبیت رنگ",
    subtitle: "نرمی و براقیت بعد از رنگ",
    price: "۵۴۰٬۰۰۰ تومان",
    quantity: 1,
    imageLabel: "Mask",
    gradient: "linear-gradient(135deg, #3f234f 0%, #ffb347 100%)",
  },
];

export const storefrontFaqs = [
  {
    id: "faq-1",
    question: "ارسال سفارش‌ها از چه زمانی انجام می‌شود؟",
    answer: "اگر فروشگاه اطلاعیه فعال داشته باشد، زمان شروع ارسال دقیقاً در همان پیام مشخص می‌شود. در حالت عادی سفارش‌ها بعد از نهایی شدن خرید وارد صف آماده‌سازی می‌شوند.",
  },
  {
    id: "faq-2",
    question: "آیا امکان ثبت سفارش برای شهرهای دیگر هم وجود دارد؟",
    answer: "بله، ساختار فروشگاه برای ارسال سراسری در نظر گرفته شده و بعداً می‌توان روش‌های مختلف ارسال را هم به آن اضافه کرد.",
  },
  {
    id: "faq-3",
    question: "چطور می‌توانم وضعیت سفارش خودم را پیگیری کنم؟",
    answer: "در مرحله بعدی، بخش پیگیری سفارش به فروشگاه اضافه می‌شود تا کاربر با شماره موبایل خودش وضعیت خرید را ببیند.",
  },
  {
    id: "faq-4",
    question: "آیا محصولات جدید سریع به صفحه اصلی اضافه می‌شوند؟",
    answer: "بله، سکشن آخرین محصولات برای همین ساخته شده تا جدیدترین آیتم‌ها با یک ظاهر جمع‌وجور و سریع در صفحه اصلی نمایش داده شوند.",
  },
];

export const storefrontCollections = {
  bestsellers: {
    title: "پرفروش‌ترین‌ها",
    description: "محصولاتی که بیشتر از بقیه مورد استقبال قرار گرفته‌اند.",
    items: bestSellerProducts,
  },
  popular: {
    title: "محبوب‌ترین‌ها",
    description: "محصولاتی که بیشتر از همه توجه کاربران را جلب کرده‌اند.",
    items: popularProducts,
  },
} as const;

export const allStorefrontProducts = [
  ...bestSellerProducts,
  ...popularProducts,
  ...latestProducts,
];

export const storefrontProductDetails: Record<string, StorefrontProductDetail> = {
  "bs-1": {
    ...bestSellerProducts[0],
    categoryTitle: "مراقبت مو",
    breadcrumbs: ["فروشگاه", "محصولات مراقبت مو", "شامپو تقویت‌کننده"],
    description:
      "این محصول در نسخه نمایشی فروشگاه برای نمایش ساختار صفحه جزئیات در نظر گرفته شده است و متن توضیحات آن عمداً طولانی‌تر نوشته شده تا حالت واقعی‌تری از معرفی یک محصول را نشان بدهد. شما می‌توانید بعداً برای هر محصول توضیحات کامل، نکات استفاده، مزیت‌ها، مواد تشکیل‌دهنده، روش مصرف، هشدارها و هر متن بازاریابی یا معرفی که لازم دارید در همین بخش قرار بدهید.\n\nدر این طراحی، توضیح محصول به‌صورت خلاصه نمایش داده می‌شود تا صفحه از همان ابتدا شلوغ نشود. اگر متن طولانی باشد، کاربر می‌تواند روی گزینه مشاهده کامل توضیحات بزند و همان‌جا ادامه متن را باز کند. این رفتار هم برای موبایل مناسب است و هم برای دسکتاپ، چون باعث می‌شود محتوای زیاد بدون شکستن ظاهر کلی صفحه مدیریت شود.\n\nبعداً حتی می‌توان همین قسمت را به ادیتور کامل‌تر، مشخصات فنی، لیست مزایا، سوالات مرتبط با محصول یا محتوای سئویی هم وصل کرد تا صفحه محصول هم از نظر تجربه کاربری و هم از نظر ایندکس شدن در موتورهای جست‌وجو وضعیت قوی‌تری داشته باشد.",
    gallery: [
      {
        id: "bs-1-main",
        label: "نمای اصلی",
        gradient: "linear-gradient(135deg, #17324d 0%, #f59e0b 100%)",
      },
      {
        id: "bs-1-side",
        label: "زاویه کناری",
        gradient: "linear-gradient(135deg, #274664 0%, #fbbf24 100%)",
      },
      {
        id: "bs-1-use",
        label: "روی میز کار",
        gradient: "linear-gradient(135deg, #2f3654 0%, #ffb347 100%)",
      },
      {
        id: "bs-1-box",
        label: "بسته‌بندی",
        gradient: "linear-gradient(135deg, #263c52 0%, #ffd166 100%)",
      },
    ],
    highlights: [
      "فرمول سبک برای استفاده روزانه",
      "مناسب موهای رنگ‌شده و حساس",
      "طراحی آماده برای صفحه محصول فروشگاه",
    ],
  },
};

export function getStorefrontProductDetail(id: string): StorefrontProductDetail | null {
  if (storefrontProductDetails[id]) {
    return storefrontProductDetails[id];
  }

  const fallback = allStorefrontProducts.find((item) => item.id === id);

  if (!fallback) {
    return null;
  }

  const category = storefrontCategories.find((item) => item.id === fallback.categoryId);

  return {
    ...fallback,
    categoryTitle: category?.title ?? "محصولات فروشگاه",
    breadcrumbs: ["فروشگاه", category?.title ?? "محصولات فروشگاه", fallback.title],
    description:
      "این محصول فعلاً با نسخه نمایشی صفحه جزئیات نمایش داده می‌شود تا ساختار کلی فروشگاه تکمیل شود و بعداً جزئیات واقعی هر محصول روی آن قرار بگیرد.",
    gallery: [
      { id: `${fallback.id}-1`, label: "نمای اصلی", gradient: fallback.gradient },
      { id: `${fallback.id}-2`, label: "جزئیات محصول", gradient: fallback.gradient },
      { id: `${fallback.id}-3`, label: "زاویه دیگر", gradient: fallback.gradient },
    ],
    highlights: [
      "طراحی هماهنگ با تم فروشگاه",
      "آماده برای اتصال به داده‌های واقعی",
      "گالری محصول و CTA موبایل",
    ],
  };
}
