import { BriefcaseBusiness, Gem, GraduationCap, PlayCircle, Sparkles, Star } from "lucide-react";

export type CourseCategory = {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof GraduationCap;
  tone: string;
};

export type CourseItem = {
  id: string;
  title: string;
  instructor: string;
  students: number;
  duration: string;
  rating: number;
  reviews: number;
  price: number;
  previousPrice?: number;
  badge?: string;
  categoryId: string;
  sectionIds: string[];
  imageGradient: string;
  imageAccent: string;
  imageUrl: string;
  imagePosition?: string;
};

export const specializedCourseCategories: CourseCategory[] = [
  { id: "all", title: "همه دوره‌ها", subtitle: "مسیر کامل یادگیری", icon: GraduationCap, tone: "from-amber-500/25 via-amber-400/10 to-transparent" },
  { id: "cut", title: "کوتاهی و استایل", subtitle: "مدل‌های روز و فید", icon: Sparkles, tone: "from-sky-500/25 via-sky-400/10 to-transparent" },
  { id: "color", title: "رنگ و لایت", subtitle: "فرمول و تکنیک اجرا", icon: Gem, tone: "from-pink-500/25 via-rose-400/10 to-transparent" },
  { id: "skin", title: "پوست و مراقبت", subtitle: "خدمات تکمیلی سالن", icon: Star, tone: "from-emerald-500/25 via-emerald-400/10 to-transparent" },
  { id: "management", title: "مدیریت سالن", subtitle: "فروش، وفادارسازی، رشد", icon: BriefcaseBusiness, tone: "from-violet-500/25 via-violet-400/10 to-transparent" },
  { id: "content", title: "تولید محتوا", subtitle: "اینستاگرام و تبلیغات", icon: PlayCircle, tone: "from-orange-500/25 via-orange-400/10 to-transparent" },
];

export const specializedCourseCards: CourseItem[] = [
  {
    id: "course-1",
    title: "آموزش جامع کوتاهی کلاسیک و مدرن",
    instructor: "مهرداد کاظمی",
    students: 1240,
    duration: "۱۲ ساعت",
    rating: 4.9,
    reviews: 214,
    price: 2890000,
    previousPrice: 3490000,
    badge: "پرفروش",
    categoryId: "cut",
    sectionIds: ["featured", "latest"],
    imageGradient: "from-slate-900 via-sky-950 to-slate-800",
    imageAccent: "فید و استایل",
    imageUrl: "https://images.pexels.com/photos/7697645/pexels-photo-7697645.jpeg?auto=compress&cs=tinysrgb&w=1200",
    imagePosition: "center top",
  },
  {
    id: "course-2",
    title: "فرمول‌خوانی رنگ و لایت از پایه تا پیشرفته",
    instructor: "سمیه مرادی",
    students: 980,
    duration: "۹ ساعت",
    rating: 4.8,
    reviews: 162,
    price: 3590000,
    previousPrice: 4290000,
    badge: "جدید",
    categoryId: "color",
    sectionIds: ["featured", "color-focus"],
    imageGradient: "from-rose-600 via-pink-500 to-orange-500",
    imageAccent: "رنگ و لایت",
    imageUrl: "https://images.pexels.com/photos/3993311/pexels-photo-3993311.jpeg?auto=compress&cs=tinysrgb&w=1200",
    imagePosition: "center center",
  },
  {
    id: "course-3",
    title: "پاکسازی پوست و خدمات مکمل سالن",
    instructor: "الهام فرهمند",
    students: 620,
    duration: "۶ ساعت",
    rating: 4.7,
    reviews: 91,
    price: 1980000,
    categoryId: "skin",
    sectionIds: ["latest"],
    imageGradient: "from-emerald-500 via-teal-500 to-cyan-700",
    imageAccent: "اسکین‌کر",
    imageUrl: "https://images.pexels.com/photos/3993301/pexels-photo-3993301.jpeg?auto=compress&cs=tinysrgb&w=1200",
    imagePosition: "center center",
  },
  {
    id: "course-4",
    title: "مدیریت تیم، قیمت‌گذاری و افزایش فروش سالن",
    instructor: "آرمان واحدی",
    students: 710,
    duration: "۷ ساعت",
    rating: 4.9,
    reviews: 133,
    price: 2490000,
    previousPrice: 3190000,
    badge: "ویژه مدیران",
    categoryId: "management",
    sectionIds: ["featured", "management-focus"],
    imageGradient: "from-violet-700 via-indigo-700 to-slate-900",
    imageAccent: "مدیریت سالن",
    imageUrl: "https://images.pexels.com/photos/33867518/pexels-photo-33867518.jpeg?auto=compress&cs=tinysrgb&w=1200",
    imagePosition: "center center",
  },
  {
    id: "course-5",
    title: "تولید محتوای حرفه‌ای برای جذب مشتری سالن",
    instructor: "ندا قاسمی",
    students: 540,
    duration: "۵ ساعت",
    rating: 4.6,
    reviews: 74,
    price: 1690000,
    categoryId: "content",
    sectionIds: ["latest", "management-focus"],
    imageGradient: "from-orange-500 via-amber-500 to-yellow-400",
    imageAccent: "تبلیغات سالن",
    imageUrl: "https://images.pexels.com/photos/3184306/pexels-photo-3184306.jpeg?auto=compress&cs=tinysrgb&w=1200",
    imagePosition: "center center",
  },
  {
    id: "course-6",
    title: "اصلاح فرم صورت و پیشنهاد مدل متناسب با مشتری",
    instructor: "رضا هاشمی",
    students: 860,
    duration: "۴ ساعت",
    rating: 4.8,
    reviews: 119,
    price: 1450000,
    categoryId: "cut",
    sectionIds: ["featured"],
    imageGradient: "from-sky-700 via-blue-600 to-indigo-800",
    imageAccent: "آنالیز چهره",
    imageUrl: "https://images.pexels.com/photos/7697645/pexels-photo-7697645.jpeg?auto=compress&cs=tinysrgb&w=1200",
    imagePosition: "center top",
  },
];
