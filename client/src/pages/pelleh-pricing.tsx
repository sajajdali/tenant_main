import { getInitialTenantMeta } from "@/lib/bootstrap";
import { PellehCheckoutSteps } from "@/components/pelleh-checkout-steps";
import { PellehBrandLogo } from "@/components/pelleh-brand-logo";

const userLimitKey = (value?: number | null) => value == null ? "unlimited" : String(value);
type PlanFeature = { title: string; url: string; enabled: boolean };

function planFeatures(value: unknown): PlanFeature[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): PlanFeature[] => {
    if (typeof item === "string" && item.trim()) return [{ title: item, url: "", enabled: true }];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!title) return [];
    return [{
      title,
      url: typeof record.url === "string" ? record.url.trim() : "",
      enabled: record.enabled !== false,
    }];
  });
}

function FeatureInfoLink({ feature }: { feature: PlanFeature }) {
  const title = <span className="whitespace-pre-line">{feature.title}</span>;

  if (!feature.url) return title;

  return <span className="inline-flex items-start gap-1.5">
    <a href={feature.url} className="whitespace-pre-line underline-offset-4 hover:text-[#e0c06e] hover:underline">{feature.title}</a>
    <a href={feature.url} aria-label={`اطلاعات بیشتر درباره ${feature.title.replace(/\s+/g, " ")}`} className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-[#e0c06e]/45 text-[10px] font-black leading-none text-[#e0c06e]/90 transition hover:border-[#e0c06e] hover:bg-[#e0c06e] hover:text-[#0e0d0b]">i</a>
  </span>;
}

export default function PellehPricingPage() {
  const meta = getInitialTenantMeta();
  const plansContent = meta?.landingSections?.plans?.content ?? {};
  const cards = Array.isArray(plansContent.cards) ? plansContent.cards as Array<Record<string, unknown>> : [];
  const packages = [...(meta?.landingPackages ?? [])].filter((item) => item.showOnLandingHome).sort((a,b)=>(a.landingSortOrder??0)-(b.landingSortOrder??0)).slice(0,3);
  const number = new Intl.NumberFormat("fa-IR");
  const unit = meta?.audience?.singularLabel?.trim() || "آرایشگر";
  const planData = packages.map((pkg) => { const card=cards.find((item)=>String(item.packageId??"")===pkg.id); return { pkg, title: typeof card?.title==="string"&&card.title?card.title:pkg.name, desc: typeof card?.description==="string"?card.description:"", features:planFeatures(card?.features), recommended:pkg.isLandingRecommended===true }; });
  const featureLabels = Array.from(new Map(planData.flatMap((plan)=>plan.features).map((feature)=>[feature.title, feature])).values());
  const limit = (value?:number|null)=>value==null?`نامحدود ${unit}`:`${number.format(value)} ${unit}`;

  return <div dir="rtl" className="min-h-screen bg-[#0e0d0b] text-[#f4f2ee] [font-family:Vazirmatn,system-ui,sans-serif]">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0e0d0bd9] backdrop-blur-xl"><div className="mx-auto flex max-w-[1200px] items-center justify-between px-8 py-5"><PellehBrandLogo imageClassName="h-14 w-auto max-w-[230px] object-contain sm:h-16 sm:max-w-[280px]" /><a href="/" className="rounded-full border border-[#c9a24a] px-5 py-2.5 text-sm text-[#e0c06e]">صفحه اصلی</a></div></header>
    <main>
      <div className="mx-auto max-w-[1000px] px-5 pt-8"><PellehCheckoutSteps current={1} /></div>
      <section className="mx-auto max-w-[900px] px-5 py-[clamp(40px,7vw,64px)] text-center"><span className="text-xs tracking-[1.5px] text-[#e0c06e]">لیست قیمت</span><h1 className="my-3.5 text-[clamp(24px,4vw,30px)] font-extrabold">پلن‌ها و امکانات هر پلن</h1><p className="text-sm leading-7 text-[#9c988d]">تفاوت پلن‌ها را شفاف ببینید و براساس اندازه مجموعه خودتان تصمیم بگیرید.</p></section>
      {planData.length ? <>
        <section className="mx-auto hidden max-w-[1000px] overflow-x-auto px-5 pb-20 pt-5 md:block"><div className="grid min-w-[700px]" style={{gridTemplateColumns:`minmax(170px,1.2fr) repeat(${planData.length},minmax(160px,1fr))`}}><div/>{planData.map((plan)=><div key={plan.pkg.id} className={`relative rounded-t-2xl p-5 text-center ${plan.recommended?"bg-[#211c14]":"bg-[#171512]"}`}>{plan.recommended&&<span className="absolute start-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#c9a24a] px-4 py-1 text-[11px] font-extrabold leading-5 text-[#0e0d0b]">پیشنهادی</span>}<div className="mb-2 font-extrabold">{plan.title}</div>{plan.pkg.discountAmount>0&&<div className="text-xs text-[#817d74] line-through">{number.format(plan.pkg.priceAmount)} تومان</div>}<div className="text-xl font-black text-[#e0c06e]">{number.format(plan.pkg.payableAmount)} <small className="text-[11px] font-normal text-[#9c988d]">تومان</small></div><div className="mt-1 text-xs text-[#9c988d]">{plan.desc}</div></div>)}
          <div className="border-b border-white/10 p-4 text-sm">تعداد</div>{planData.map(p=><div key={`limit-${p.pkg.id}`} className={`border-b border-white/10 p-4 text-center text-sm ${p.recommended?"bg-[#c9a24a]/5":""}`}>{limit(p.pkg.userLimit)}</div>)}
          <div className="border-b border-white/10 p-4 text-sm">مدت</div>{planData.map(p=><div key={`days-${p.pkg.id}`} className={`border-b border-white/10 p-4 text-center text-sm ${p.recommended?"bg-[#c9a24a]/5":""}`}>{number.format(p.pkg.durationDays)} روز</div>)}
          {featureLabels.map(feature=><div className="contents" key={feature.title}><div className="border-b border-white/10 p-4 text-sm"><FeatureInfoLink feature={feature} /></div>{planData.map(p=>{ const current=p.features.find((item)=>item.title===feature.title); return <div key={`${p.pkg.id}-${feature.title}`} className={`border-b border-white/10 p-4 text-center font-bold ${current?.enabled ? "text-[#e0c06e]" : "text-[#817d74]"} ${p.recommended?"bg-[#c9a24a]/5":""}`}>{current?.enabled?"✓":"—"}</div>; })}</div>)}
          <div/>{planData.map(p=><div key={`cta-${p.pkg.id}`} className={`rounded-b-2xl p-5 text-center ${p.recommended?"bg-[#211c14]":"bg-[#171512]"}`}><a href={`/plans/duration?users=${encodeURIComponent(userLimitKey(p.pkg.userLimit))}`} className={`inline-block rounded-full px-6 py-3 text-sm font-bold ${p.recommended?"bg-[#c9a24a] text-[#0e0d0b]":"border border-white/15"}`}>انتخاب مدت</a></div>)}
        </div></section>
        <section className="mx-auto flex max-w-[520px] flex-col gap-5 px-4 pb-20 md:hidden">{planData.map(plan=><article key={plan.pkg.id} className="relative overflow-hidden rounded-[18px] border border-white/10 bg-[#171512]">{plan.recommended&&<span className="absolute start-1/2 top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-b-full bg-[#e0c06e] px-4 py-1 text-[11px] font-extrabold leading-5 text-[#0e0d0b] shadow-[0_6px_18px_rgba(224,192,110,0.28)]">پیشنهادی</span>}<div className={`p-6 text-center ${plan.recommended?"bg-[#211c14]":""}`}><h2 className="mb-2 text-lg font-extrabold">{plan.title}</h2>{plan.pkg.discountAmount>0&&<div className="text-xs text-[#817d74] line-through">{number.format(plan.pkg.priceAmount)} تومان</div>}<div className="text-2xl font-black text-[#e0c06e]">{number.format(plan.pkg.payableAmount)} <small className="text-xs font-normal">تومان</small></div></div><div className="divide-y divide-white/10 text-sm"><div className="flex justify-between p-4"><span>تعداد</span><b className="text-[#e0c06e]">{limit(plan.pkg.userLimit)}</b></div><div className="flex justify-between p-4"><span>مدت</span><b className="text-[#e0c06e]">{number.format(plan.pkg.durationDays)} روز</b></div>{featureLabels.map(feature=>{ const current=plan.features.find((item)=>item.title===feature.title); return <div key={feature.title} className="flex justify-between gap-4 p-4"><span><FeatureInfoLink feature={feature} /></span><b className={current?.enabled ? "text-[#e0c06e]" : "text-[#817d74]"}>{current?.enabled?"✓":"—"}</b></div>; })}</div><div className="p-5"><a href={`/plans/duration?users=${encodeURIComponent(userLimitKey(plan.pkg.userLimit))}`} className={`block rounded-full py-3 text-center font-bold ${plan.recommended?"bg-[#c9a24a] text-[#0e0d0b]":"border border-white/15"}`}>انتخاب مدت</a></div></article>)}</section>
      </>:<div className="pb-24 text-center text-[#9c988d]">هنوز پلنی برای این طیف انتخاب نشده است.</div>}
    </main>
    <footer className="border-t border-white/10 py-20 text-center"><h2 className="mb-5 text-xl font-extrabold">یک استپ بالاتر باشید</h2><a href="/" className="inline-block rounded-full bg-[#c9a24a] px-8 py-4 font-bold text-[#0e0d0b]">شروع خرید پکیج</a><p className="mt-20 text-sm text-[#928d82]">© استپ — تمامی حقوق محفوظ است.</p></footer>
  </div>;
}
