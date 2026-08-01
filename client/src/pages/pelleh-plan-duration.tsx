import { ArrowRight, Check, Clock3, Sparkles } from "lucide-react";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { PellehCheckoutSteps } from "@/components/pelleh-checkout-steps";
import { PellehBrandLogo } from "@/components/pelleh-brand-logo";

const userLimitKey = (value?: number | null) => value == null ? "unlimited" : String(value);

export default function PellehPlanDurationPage() {
  const meta = getInitialTenantMeta();
  const params = new URLSearchParams(window.location.search);
  const selectedUsers = params.get("users") ?? "";
  const allPackages = meta?.landingPackages ?? [];
  const packages = allPackages
    .filter((item) => userLimitKey(item.userLimit) === selectedUsers)
    .sort((a, b) => a.durationDays - b.durationDays);
  const number = new Intl.NumberFormat("fa-IR");
  const unit = meta?.audience?.singularLabel?.trim() || "اکانت";
  const selectedLimit = packages[0]?.userLimit;
  const accountLabel = selectedLimit == null ? `اکانت ${unit} نامحدود` : `${number.format(selectedLimit)} اکانت ${unit}`;

  const durationLabel = (days: number) => {
    if (days % 365 === 0) return `${number.format(days / 365)} ساله`;
    if (days % 30 === 0) return `${number.format(days / 30)} ماهه`;
    return `${number.format(days)} روزه`;
  };

  return (
    <div dir="rtl" className="min-h-screen overflow-hidden bg-[#0e0d0b] text-[#f4f2ee] [font-family:Vazirmatn,system-ui,sans-serif]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_5%,rgba(201,162,74,.16),transparent_28%),radial-gradient(circle_at_85%_55%,rgba(224,192,110,.08),transparent_25%)]" />
      <header className="relative border-b border-white/10 bg-[#0e0d0b]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-5 sm:px-8">
          <a href="/plans" className="inline-flex items-center gap-2 text-sm text-[#d7d2c8] transition hover:text-white"><ArrowRight className="size-4" /> بازگشت به پلن‌ها</a>
          <PellehBrandLogo imageClassName="h-14 w-auto max-w-[230px] object-contain sm:h-16 sm:max-w-[280px]" />
        </div>
      </header>

      <main className="relative mx-auto max-w-[900px] px-4 pb-14 pt-8 sm:px-8 sm:pt-10">
        <div className="mb-8"><PellehCheckoutSteps current={1} /></div>
        <section className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl border border-[#e0c06e]/25 bg-[#e0c06e]/10 text-[#e0c06e]"><Clock3 className="size-5" /></div>
          <span className="text-xs font-bold tracking-[1.5px] text-[#e0c06e]">مرحله دوم خرید</span>
          <h1 className="mt-2 text-[clamp(22px,4vw,30px)] font-black leading-tight">برای چه مدتی می‌خواهید؟</h1>
          <p className="mt-2 text-sm leading-6 text-[#9c988d]">پلن انتخابی: <strong className="text-[#f4f2ee]">{accountLabel}</strong></p>
        </section>

        {packages.length ? (
          <section className="mt-7 overflow-hidden rounded-[22px] border border-white/10 bg-[#15130f] shadow-[0_24px_70px_-50px_rgba(0,0,0,.8)]">
            <div className="hidden grid-cols-[1fr_1.35fr_1.25fr_120px] gap-5 border-b border-white/10 bg-white/[.035] px-6 py-3 text-xs font-bold text-[#817d74] sm:grid">
              <span>مدت اشتراک</span><span>قیمت و تخفیف</span><span>مبلغ نهایی</span><span className="text-center">انتخاب</span>
            </div>
            {packages.map((pkg, index) => {
              const hasDiscount = pkg.discountAmount > 0;
              const discountPercent = hasDiscount && pkg.priceAmount > 0 ? Math.round((pkg.discountAmount / pkg.priceAmount) * 100) : 0;
              const featured = pkg.isLandingRecommended || (packages.length > 2 && index === 1);
              const href = `/landing-preview/plans?users=${encodeURIComponent(userLimitKey(pkg.userLimit))}&duration=${pkg.durationDays}`;

              return (
                <article key={pkg.id} className={`group relative grid gap-4 border-b border-white/10 px-5 py-5 transition last:border-b-0 sm:grid-cols-[1fr_1.35fr_1.25fr_120px] sm:items-center sm:gap-5 sm:px-6 sm:py-4 ${featured ? "bg-[#c9a24a]/[.08]" : "hover:bg-white/[.025]"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${featured ? "bg-[#e0c06e] text-[#0e0d0b]" : "bg-white/[.06] text-[#e0c06e]"}`}><Clock3 className="size-4" /></div>
                    <div><h2 className="text-lg font-black">{durationLabel(pkg.durationDays)}</h2>{featured && <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#e0c06e]"><Sparkles className="size-2.5" /> پیشنهاد ویژه</span>}</div>
                  </div>

                  <div>
                    {hasDiscount ? <><div className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap"><span className="text-[11px] text-[#817d74] line-through sm:text-xs">{number.format(pkg.priceAmount)} تومان</span>{discountPercent > 0 && <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 sm:px-2 sm:text-[10px]">{number.format(discountPercent)}٪ تخفیف</span>}</div><div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-300"><Check className="size-3" /> {number.format(pkg.discountAmount)} تومان صرفه‌جویی</div></> : <span className="text-xs text-[#817d74]">بدون تخفیف</span>}
                  </div>

                  <div><div className="text-xl font-black text-[#e0c06e]">{number.format(pkg.payableAmount)} <small className="text-xs font-normal text-[#9c988d]">تومان</small></div><div className="mt-1 text-[11px] text-[#817d74]">پرداخت نهایی</div></div>

                  <a href={href} className={`block whitespace-nowrap rounded-full px-4 py-2.5 text-center text-sm font-black transition ${featured ? "bg-[#c9a24a] text-[#0e0d0b] hover:bg-[#e0c06e]" : "border border-white/15 text-white hover:border-[#c9a24a] hover:text-[#e0c06e]"}`}>خرید و سفارش</a>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="mx-auto mt-12 max-w-xl rounded-[26px] border border-white/10 bg-white/[.04] p-8 text-center">
            <p className="text-[#b4afa5]">برای این پلن هنوز مدت قابل خریدی تعریف نشده است.</p>
            <a href="/plans" className="mt-6 inline-block rounded-full border border-[#c9a24a] px-6 py-3 text-sm font-bold text-[#e0c06e]">انتخاب پلن دیگر</a>
          </section>
        )}
      </main>
    </div>
  );
}
