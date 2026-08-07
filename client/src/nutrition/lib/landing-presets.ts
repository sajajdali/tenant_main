import type { TenantMeta } from "@/lib/types";

export type NutritionLandingVariant = "classic" | "diet" | "all_features" | "diet_priority";

export type NutritionLandingVariantPayload = {
  content: Record<string, string>;
  imageUrl?: string | null;
};

export type NutritionLandingSettingsPayload = {
  available?: boolean;
  preferAsDefault?: boolean;
  activeVariant?: NutritionLandingVariant;
  variants?: Partial<Record<NutritionLandingVariant, NutritionLandingVariantPayload>>;
  bookingBanner?: {
    enabled?: boolean;
    content?: Record<string, string>;
    imageUrl?: string | null;
  };
};

export type NutritionLandingField = {
  key: string;
  label: string;
  multiline?: boolean;
  placeholder?: string;
};

export const NUTRITION_LANDING_VARIANTS: Array<{
  key: NutritionLandingVariant;
  label: string;
  previewPath: string;
  description: string;
}> = [
  {
    key: "classic",
    label: "لندینگ پیش فرض رژیم",
    previewPath: "/nutrition/landing-classic",
    description: "طرح فعلی که الان در پروژه وجود دارد.",
  },
  {
    key: "diet",
    label: "لندینگ رژیم درمانی",
    previewPath: "/nutrition/landing-diet",
    description: "نسخه متمرکز روی شروع دریافت رژیم.",
  },
  {
    key: "all_features",
    label: "لندینگ همه امکانات",
    previewPath: "/nutrition/landing-all-features",
    description: "نمایش همزمان رژیم، نوبت دهی و فروشگاه.",
  },
  {
    key: "diet_priority",
    label: "لندینگ رژیم برجسته",
    previewPath: "/nutrition/landing-diet-priority",
    description: "نسخه موبایل‌محور با تمرکز تصویری قوی روی رژیم درمانی.",
  },
];

export const NUTRITION_LANDING_FIELD_DEFS: Record<NutritionLandingVariant, NutritionLandingField[]> = {
  classic: [
    { key: "topbar_badge", label: "برچسب بالای صفحه" },
    { key: "eyebrow", label: "تیتر کوچک بالا" },
    { key: "title_intro", label: "تیتر خط اول" },
    { key: "title_highlight", label: "تیتر بخش بولد" },
    { key: "title_outro", label: "تیتر خط آخر" },
    { key: "description", label: "متن معرفی", multiline: true },
    { key: "quote_label", label: "عنوان باکس شعار" },
    { key: "quote_text", label: "متن اصلی شعار", multiline: true },
    { key: "quote_subtext", label: "متن دوم شعار", multiline: true },
    { key: "cta_title", label: "عنوان دکمه اصلی" },
    { key: "cta_subtitle", label: "زیرعنوان دکمه اصلی" },
  ],
  diet: [
    { key: "badge", label: "برچسب نسخه" },
    { key: "eyebrow", label: "تیتر کوچک بالا" },
    { key: "title", label: "تیتر اصلی" },
    { key: "highlight", label: "بخش رنگی تیتر" },
    { key: "description", label: "متن معرفی", multiline: true },
    { key: "feature_title", label: "عنوان مزیت" },
    { key: "feature_body", label: "متن مزیت", multiline: true },
    { key: "quote_title", label: "عنوان شعار" },
    { key: "quote_body", label: "متن شعار", multiline: true },
    { key: "cta_label", label: "عنوان CTA" },
    { key: "cta_body", label: "متن CTA", multiline: true },
  ],
  all_features: [
    { key: "badge", label: "برچسب نسخه" },
    { key: "title", label: "تیتر اصلی" },
    { key: "subtitle", label: "زیرتیتر اصلی" },
    { key: "description", label: "متن معرفی", multiline: true },
    { key: "insight_title", label: "عنوان باکس اول" },
    { key: "insight_body", label: "متن باکس اول", multiline: true },
    { key: "behavior_title", label: "عنوان باکس دوم" },
    { key: "behavior_body", label: "متن باکس دوم", multiline: true },
    { key: "nutrition_title", label: "عنوان کارت رژیم" },
    { key: "nutrition_description", label: "توضیح کارت رژیم", multiline: true },
    { key: "booking_title", label: "عنوان کارت نوبت دهی" },
    { key: "booking_description", label: "توضیح کارت نوبت دهی", multiline: true },
    { key: "store_title", label: "عنوان کارت فروشگاه" },
    { key: "store_description", label: "توضیح کارت فروشگاه", multiline: true },
  ],
  diet_priority: [
    { key: "hero_badge", label: "برچسب هیرو" },
    { key: "hero_title", label: "تیتر هیرو" },
    { key: "hero_description", label: "توضیح هیرو", multiline: true },
    { key: "chip_one", label: "چیپ اول" },
    { key: "chip_two", label: "چیپ دوم" },
    { key: "cta_title", label: "عنوان CTA اصلی" },
    { key: "cta_subtitle", label: "زیرعنوان CTA اصلی" },
    { key: "booking_title", label: "عنوان کارت نوبت دهی" },
    { key: "booking_description", label: "توضیح کارت نوبت دهی", multiline: true },
    { key: "store_title", label: "عنوان کارت فروشگاه" },
    { key: "store_description", label: "توضیح کارت فروشگاه", multiline: true },
    { key: "summary_title", label: "عنوان باکس جمع‌بندی" },
    { key: "summary_description", label: "متن باکس جمع‌بندی", multiline: true },
  ],
};

export const NUTRITION_LANDING_DEFAULTS: Record<NutritionLandingVariant, NutritionLandingVariantPayload> = {
  classic: {
    content: {
      topbar_badge: "وب اپلیکیشن دریافت رژیم",
      eyebrow: "شروع سبک زندگی دقیق‌تر",
      title_intro: "برای دریافت رژیم اختصاصی",
      title_highlight: "نسخه اختصاصی رژیم",
      title_outro: "شروع کنید",
      description: "برنامه غذایی شما می‌تواند بر اساس شرایط بدنی، سبک زندگی و هدف شخصی‌تان تنظیم شود. برای شروع فقط کافی است وارد مرحله دریافت رژیم شوید.",
      quote_label: "شعار پیشنهادی",
      quote_text: "رژیمی که فقط یک لیست غذا نیست؛",
      quote_subtext: "نقشه راهی برای سبک زندگی پایدار شماست.",
      cta_title: "دریافت رژیم و شروع سلامتی",
      cta_subtitle: "ورود به مرحله ثبت اطلاعات اولیه",
    },
    imageUrl: "/booking-app/nutrition-hero.jpg",
  },
  diet: {
    content: {
      badge: "لندینگ رژیم درمانی",
      eyebrow: "شروع مسیر سلامت شخصی",
      title: "اینجا شروع رژیم",
      highlight: "از یک فرم ساده بیشتر است",
      description: "کاربر وارد صفحه‌ای می‌شود که فقط برای یک کار ساخته شده: شروع نسخه اختصاصی رژیم. همه چیز مینیمال اما لوکس طراحی شده تا تمرکز ذهنی کامل روی ورود به مسیر تغذیه باشد.",
      feature_title: "تمرکز کامل روی رژیم درمانی",
      feature_body: "هیچ شلوغی اضافه‌ای برای کاربر وجود ندارد و CTA اصلی مستقیم او را وارد مسیر عضویت و دریافت رژیم می‌کند.",
      quote_title: "رژیمی برای زندگی، نه فقط یک لیست غذا",
      quote_body: "این نسخه برای کسب‌وکارهایی مناسب است که می‌خواهند کاربر در اولین برخورد، مستقیم وارد funnel رژیم درمانی شود.",
      cta_label: "دریافت رژیم اختصاصی",
      cta_body: "شروع مستقیم مسیر عضویت و دریافت برنامه شخصی",
    },
    imageUrl: "/booking-app/nutrition-hero.jpg",
  },
  all_features: {
    content: {
      badge: "لندینگ همه امکانات",
      title: "کاربر از همان ورود اول",
      subtitle: "انتخاب می‌کند از کدام در وارد شود",
      description: "این نسخه شبیه یک صفحه انتخاب هوشمند طراحی شده. سه امکان اصلی با شخصیت بصری مستقل دیده می‌شوند و کاربر لازم نیست حدس بزند از کجا باید شروع کند.",
      insight_title: "وقتی می‌خواهی هر سه مسیر دیده شوند",
      insight_body: "برای برندهایی که فروشگاه، نوبت دهی و رژیم درمانی را همزمان ارائه می‌دهند.",
      behavior_title: "انتخاب سریع بین مسیر درمان، رزرو یا خرید",
      behavior_body: "کاربر بدون گیجی می‌تواند مستقیماً وارد بخش دلخواهش شود.",
      nutrition_title: "رژیم درمانی",
      nutrition_description: "شروع دریافت رژیم اختصاصی، تکمیل پروفایل و پیگیری مسیر درمان تغذیه.",
      booking_title: "نوبت دهی",
      booking_description: "انتخاب زمان مناسب برای رزرو مشاوره آنلاین یا مراجعه حضوری.",
      store_title: "فروشگاه",
      store_description: "مشاهده محصولات، مکمل‌ها و بسته‌های پیشنهادی سبک زندگی سالم.",
    },
    imageUrl: "/booking-app/nutrition-hero.jpg",
  },
  diet_priority: {
    content: {
      hero_badge: "مسیر اصلی پیشنهادی",
      hero_title: "رژیم درمانی",
      hero_description: "این نسخه برای زمانی است که می‌خواهی کاربر اول از همه رژیم درمانی را ببیند، اما همچنان بداند دو قابلیت مهم دیگر هم وجود دارند.",
      chip_one: "CTA اصلی: شروع رژیم اختصاصی",
      chip_two: "نسخه مناسب برندهای nutrition-first",
      cta_title: "شروع دریافت رژیم",
      cta_subtitle: "ورود فوری به مسیر عضویت و برنامه شخصی",
      booking_title: "نوبت دهی",
      booking_description: "اگر کاربر فعلاً قصد رزرو جلسه دارد، از همین‌جا سریع وارد نوبت دهی می‌شود.",
      store_title: "فروشگاه",
      store_description: "برای برندهایی که محصولات مکمل هم دارند، فروشگاه همچنان در دسترس و دیده‌شده باقی می‌ماند.",
      summary_title: "لندینگ رژیم درمانی برجسته",
      summary_description: "نسخه موبایل‌محور با یک هیرو قوی برای رژیم درمانی و دو مسیر مکمل جمع‌وجور و واضح.",
    },
    imageUrl: "/booking-app/nutrition-hero.jpg",
  },
};

export const NUTRITION_BOOKING_BANNER_DEFAULT = {
  enabled: false,
  content: {
    badge: "ورود سریع به رژیم درمانی",
    title: "مسیر دریافت رژیم اختصاصی هم برای شما فعال است",
    description: "اگر می‌خواهید علاوه بر نوبت‌دهی، وارد بخش رژیم درمانی شوید از همین بنر شروع کنید و مرحله دریافت برنامه شخصی را ادامه دهید.",
    cta_label: "ورود به بخش رژیم",
  },
  imageUrl: "/booking-app/nutrition-hero.jpg",
};

export function getNutritionLandingVariantSettings(
  meta: TenantMeta | null | undefined,
  variant: NutritionLandingVariant,
): NutritionLandingVariantPayload {
  const storedVariant = meta?.nutritionLanding?.variants?.[variant];

  return {
    content: {
      ...NUTRITION_LANDING_DEFAULTS[variant].content,
      ...(storedVariant?.content ?? {}),
    },
    imageUrl: storedVariant?.imageUrl || NUTRITION_LANDING_DEFAULTS[variant].imageUrl || "/booking-app/nutrition-hero.jpg",
  };
}

export function getActiveNutritionLandingVariant(meta: TenantMeta | null | undefined): NutritionLandingVariant {
  return meta?.nutritionLanding?.activeVariant ?? "classic";
}

export function isNutritionLandingDefaultEnabled(meta: TenantMeta | null | undefined): boolean {
  return meta?.nutritionLanding?.preferAsDefault ?? false;
}

export function getNutritionBookingBannerSettings(meta: TenantMeta | null | undefined) {
  const storedBanner = meta?.nutritionLanding?.bookingBanner;

  return {
    enabled: storedBanner?.enabled ?? NUTRITION_BOOKING_BANNER_DEFAULT.enabled,
    content: {
      ...NUTRITION_BOOKING_BANNER_DEFAULT.content,
      ...(storedBanner?.content ?? {}),
    },
    imageUrl: storedBanner?.imageUrl || NUTRITION_BOOKING_BANNER_DEFAULT.imageUrl || "/booking-app/nutrition-hero.jpg",
  };
}
