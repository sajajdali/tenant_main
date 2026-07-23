import { Check } from "lucide-react";

export function PellehCheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = [{ n: 1, label: "انتخاب پلن" }, { n: 2, label: "پیش‌فاکتور" }, { n: 3, label: "پرداخت" }];
  return <div className="mx-auto flex w-full max-w-[560px] items-start justify-center px-2" dir="rtl">
    {steps.map((step, index) => { const done = step.n < current; const active = step.n === current; return <div key={step.n} className="contents">
      <div className="flex min-w-[70px] flex-col items-center text-center sm:min-w-[96px]">
        <span className={`flex size-9 items-center justify-center rounded-full border text-sm font-black sm:size-10 ${done || active ? "border-[#c9a24a] bg-[#c9a24a] text-[#0e0d0b]" : "border-white/10 text-[#716d65]"}`}>{done ? <Check className="size-4" /> : step.n}</span>
        <span className={`mt-2 text-[11px] font-bold sm:text-xs ${active ? "text-[#e0c06e]" : done ? "text-[#aaa59b]" : "text-[#716d65]"}`}>{step.label}</span>
      </div>
      {index < steps.length - 1 && <span className={`mt-[18px] h-px min-w-7 flex-1 sm:min-w-14 ${step.n < current ? "bg-[#c9a24a]" : "bg-white/10"}`} />}
    </div>; })}
  </div>;
}
