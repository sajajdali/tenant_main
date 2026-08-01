import { useState } from "react";
import { useRoute } from "wouter";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { PellehBrandLogo } from "@/components/pelleh-brand-logo";

const defaultHeroImage = "http://127.0.0.1:8000/booking-app/assets/hero-photo-Nr4dc0GO.webp";

type Feature = { title: string; badge: string; short: string; detail: string; url: string; images: string[]; videoUrl: string; coverUrl: string; benefits: string[] };

function features(): Feature[] {
  const meta = getInitialTenantMeta();
  const records = meta?.landingFeatures;
  if (Array.isArray(records) && records.length) return records.map((item) => ({ title: item.title, badge: item.badgeText || "", short: item.short || "", detail: item.detail || item.short || "", url: item.url, images: item.imageUrl ? [item.imageUrl] : [], videoUrl: item.videoUrl || "", coverUrl: item.coverUrl || "", benefits: item.benefits || [] }));
  const value = meta?.landingSections?.feature_grid?.content?.items;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const data = item as Record<string, unknown>;
    const title = typeof data.title === "string" ? data.title.trim() : "";
    if (!title) return [];
    return [{
      title,
      badge: "",
      short: typeof data.short === "string" ? data.short : "",
      detail: typeof data.detail === "string" && data.detail.trim() ? data.detail : (typeof data.short === "string" ? data.short : ""),
      url: typeof data.url === "string" && data.url.trim() ? data.url : "/features",
      images: Array.isArray(data.imageUrls) ? data.imageUrls.filter((image): image is string => typeof image === "string" && image !== "") : [],
      videoUrl: "", coverUrl: "", benefits: [],
    }];
  });
}

export default function PellehFeatureDetailPage() {
  const [, params] = useRoute("/features/:slug");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const items = features();
  const path = `/features/${params?.slug ?? ""}`;
  const index = Math.max(0, items.findIndex((item) => item.url === path || item.url.replace(/\/$/, "") === path));
  const item = items[index];
  if (!item) return <div dir="rtl" className="min-h-screen bg-[#0e0d0b] p-10 text-center text-white">این امکان پیدا نشد.</div>;
  const previous = index > 0 ? items[index - 1] : null;
  const next = index < items.length - 1 ? items[index + 1] : null;
  const number = new Intl.NumberFormat("fa-IR").format(index + 1);
  const total = new Intl.NumberFormat("fa-IR").format(items.length);

  return <div dir="rtl" lang="fa" className="min-h-screen bg-[#0e0d0b] text-[#f4f2ee]">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0e0d0bd9] backdrop-blur-xl"><div className="mx-auto flex max-w-[1200px] items-center justify-between px-8 py-5"><PellehBrandLogo imageClassName="h-14 w-auto max-w-[230px] object-contain sm:h-16 sm:max-w-[280px]" /><a href="/plans" className="rounded-full border border-[#c9a24a] px-5 py-2.5 text-sm text-[#e0c06e]">شروع خرید پکیج</a></div></header>
    <main>
      <section className="mx-auto flex max-w-[640px] items-center justify-center gap-2.5 px-5 pt-[clamp(36px,6vw,56px)]"><span dir="ltr" className="text-xs font-semibold tracking-wider text-[#e0c06e]">{number} / {total}</span><div className="h-px max-w-[120px] flex-1 bg-white/10"/><span className="text-xs tracking-[1.5px] text-[#9c988d]">امکانات پله</span><div className="h-px max-w-[120px] flex-1 bg-white/10"/></section>
      <section className="mx-auto max-w-[760px] px-5 pt-[clamp(24px,5vw,40px)] text-center"><span className="mb-5 inline-flex rounded-full border border-[#c9a24a]/30 bg-[#c9a24a]/10 px-4 py-1.5 text-xs font-semibold text-[#e0c06e]">{item.badge || item.short}</span><h1 className="mb-4 text-[clamp(26px,4.4vw,38px)] font-extrabold leading-[1.4]">{item.title}</h1><p className="mx-auto max-w-[540px] text-[15px] leading-8 text-[#9c988d]">{item.detail}</p></section>
      {item.videoUrl && <section className="mx-auto max-w-[1000px] px-5 pt-12"><video src={item.videoUrl} poster={item.coverUrl || undefined} controls playsInline className="aspect-video w-full rounded-[22px] border border-white/10 bg-black object-cover" /></section>}
      <section className="mx-auto grid max-w-[1000px] grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6 px-5 pt-12"><button type="button" onClick={() => setPreviewImage(item.images[0] || defaultHeroImage)} className="group relative min-h-60 overflow-hidden rounded-[20px] border border-white/10 text-start outline-none transition hover:border-[#e0c06e]/50 focus-visible:ring-2 focus-visible:ring-[#e0c06e]"><img src={item.images[0] || defaultHeroImage} alt={item.title} className="h-full min-h-60 w-full object-cover transition duration-300 group-hover:scale-[1.03]"/><span className="absolute bottom-4 right-4 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-xs font-bold text-white backdrop-blur">مشاهده بزرگ</span></button><div className="flex flex-col justify-center">{(item.benefits.length ? item.benefits : [item.short, "مدیریت ساده و یکپارچه از پنل پله"]).filter(Boolean).map((benefit, benefitIndex)=><div key={benefitIndex} className="flex gap-3 border-b border-white/10 py-3.5 text-sm leading-7"><span className="text-[#e0c06e]">✓</span><span>{benefit}</span></div>)}</div></section>
      <section className="mx-auto mt-16 flex max-w-[1000px] justify-between gap-4 border-t border-white/10 px-5">{previous ? <a href={previous.url} className="flex-1 pt-7 text-start"><small className="text-[#9c988d]">ویژگی قبلی</small><div className="mt-1.5 font-bold text-[#e0c06e]">{previous.title}</div></a> : <span/>}{next && <a href={next.url} className="flex-1 pt-7 text-end"><small className="text-[#9c988d]">ویژگی بعدی</small><div className="mt-1.5 font-bold text-[#e0c06e]">{next.title}</div></a>}</section>
      <section className="mx-auto mt-16 max-w-[1200px] border-t border-white/10 px-5 py-20 text-center"><h2 className="mb-5 text-xl font-extrabold">یک استپ بالاتر باشید</h2><a href="/plans" className="inline-block rounded-full bg-[#c9a24a] px-7 py-3.5 text-sm font-bold text-[#0e0d0b]">شروع خرید پکیج</a></section>
    </main>
    {previewImage && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 pt-20 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setPreviewImage(null)}><button type="button" onClick={() => setPreviewImage(null)} className="fixed left-5 top-5 z-[90] rounded-full border border-white/25 bg-black/80 px-5 py-2.5 text-sm font-bold text-white shadow-xl backdrop-blur transition hover:bg-white hover:text-black">بستن</button><div className="relative max-h-[88vh] w-full max-w-[1200px]" onClick={(event) => event.stopPropagation()}><img src={previewImage} alt={item.title} className="mx-auto max-h-[88vh] w-full rounded-[22px] border border-white/10 object-contain shadow-2xl"/></div></div>}
  </div>;
}
