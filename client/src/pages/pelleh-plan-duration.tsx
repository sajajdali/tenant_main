import { Check, Clock3, Sparkles } from "lucide-react";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { PellehCheckoutSteps } from "@/components/pelleh-checkout-steps";
import { PellehLandingHeader } from "@/components/pelleh-landing-header";

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
      <PellehLandingHeader />

      <main className="relative mx-auto max-w-[900px] px-4 pb-14 pt-6 sm:px-8 sm:pt-10">
        <div className="mb-6 sm:mb-8"><PellehCheckoutSteps current={1} /></div>
        <section className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl border border-[#e0c06e]/25 bg-[#e0c06e]/10 text-[#e0c06e]"><Clock3 className="size-5" /></div>
          <span className="text-xs font-bold tracking-[1.5px] text-[#e0c06e]">مرحله دوم خرید</span>
          <h1 className="mt-2 text-[clamp(20px,5.6vw,30px)] font-black leading-[1.45]">برای چه مدتی می‌خواهید؟</h1>
          <p className="mt-2 text-sm leading-6 text-[#9c988d]">پلن انتخابی: <strong className="text-[#f4f2ee]">{accountLabel}</strong></p>
        </section>

        {packages.length ? (
          <section className="mt-6 overflow-hidden rounded-[22px] border border-white/10 bg-[#15130f] shadow-[0_24px_70px_-50px_rgba(0,0,0,.8)] sm:mt-7">
            <div className="hidden grid-cols-[1fr_1.35fr_1.25fr_120px] gap-5 border-b border-white/10 bg-white/[.035] px-6 py-3 text-xs font-bold text-[#817d74] sm:grid">
              <span>مدت اشتراک</span><span>قیمت و تخفیف</span><span>مبلغ نهایی</span><span className="text-center">انتخاب</span>
            </div>
            {packages.map((pkg, index) => {
              const hasDiscount = pkg.discountAmount > 0;
              const discountPercent = hasDiscount && pkg.priceAmount > 0 ? Math.round((pkg.discountAmount / pkg.priceAmount) * 100) : 0;
              const featured = pkg.isLandingRecommended || (packages.length > 2 && index === 1);
              const href = `/landing-preview/plans?users=${encodeURIComponent(userLimitKey(pkg.userLimit))}&duration=${pkg.durationDays}`;

              return (
                <article key={pkg.id} className={`group relative flex flex-col gap-4 border-b border-white/10 px-5 py-6 transition last:border-b-0 sm:grid sm:grid-cols-[1fr_1.35fr_1.25fr_120px] sm:items-center sm:gap-5 sm:px-6 sm:py-4 ${featured ? "bg-[#c9a24a]/[.08]" : "hover:bg-white/[.025]"}`}>
                  <div className="flex items-center justify-between gap-3 sm:justify-start">
                    <div>
                      <h2 className="text-2xl font-black leading-8 sm:text-lg">{durationLabel(pkg.durationDays)}</h2>
                      {featured && <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#e0c06e] sm:text-[10px]"><Sparkles className="size-3 sm:size-2.5" /> پیشنهاد ویژه</span>}
                    </div>
                    <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl sm:size-9 sm:rounded-xl ${featured ? "bg-[#e0c06e] text-[#0e0d0b]" : "bg-white/[.06] text-[#e0c06e]"}`}><Clock3 className="size-5 sm:size-4" /></div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 sm:border-0 sm:bg-transparent sm:p-0">
                    {hasDiscount ? <><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-[#817d74] line-through">{number.format(pkg.priceAmount)} تومان</span>{discountPercent > 0 && <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-bold leading-4 text-emerald-300">{number.format(discountPercent)}٪ تخفیف</span>}</div><div className="mt-2 flex items-center gap-1.5 text-xs leading-5 text-emerald-300 sm:mt-1 sm:text-[11px]"><Check className="size-3.5 sm:size-3" /> {number.format(pkg.discountAmount)} تومان صرفه‌جویی</div></> : <span className="text-xs text-[#817d74]">بدون تخفیف</span>}
                  </div>

                  <div className="text-center sm:text-start"><div className="text-3xl font-black leading-10 text-[#e0c06e] sm:text-xl sm:leading-normal">{number.format(pkg.payableAmount)} <small className="text-sm font-normal text-[#9c988d] sm:text-xs">تومان</small></div><div className="mt-1 text-xs text-[#817d74] sm:text-[11px]">پرداخت نهایی</div></div>

                  <a href={href} className={`block whitespace-nowrap rounded-full px-4 py-3.5 text-center text-base font-black transition sm:py-2.5 sm:text-sm ${featured ? "bg-[#c9a24a] text-[#0e0d0b] hover:bg-[#e0c06e]" : "border border-white/15 text-white hover:border-[#c9a24a] hover:text-[#e0c06e]"}`}>خرید و سفارش</a>
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
