import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CustomLandingWelcomePage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { sendOtp, login } = useAuth();
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"mobile" | "code">("mobile");
  const [loading, setLoading] = useState(false);
  const send = async () => { setLoading(true); const result = await sendOtp(mobile); setLoading(false); if (result.ok) setStep("code"); };
  const verify = async () => { setLoading(true); const ok = await login(mobile, code); setLoading(false); if (ok) setLocation("/nutrition"); };
  return <main className="relative min-h-screen overflow-hidden bg-[#101a16] text-white" dir="rtl"><img src="/booking-app/nutrition-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-black/60" /><div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-10"><div className="mb-8 text-center"><div className="inline-flex items-center gap-2 text-3xl font-black tracking-wide text-emerald-400"><span className="rounded-xl bg-emerald-500 px-3 py-1 text-[#102017]">ز</span> ZOOD.FIT</div></div><section className="border border-white/15 bg-[#14231e]/95 p-7 shadow-2xl backdrop-blur sm:rounded-[28px]"><h1 className="text-center text-3xl font-black">به زود فیت خوش آمدید</h1><p className="mt-6 text-center text-lg leading-8 text-white/80">برای استفاده از اپلیکیشن و رژیم، شماره تماس خود را وارد کنید</p>{step === "mobile" ? <div className="mt-9 space-y-5"><Input dir="ltr" inputMode="numeric" value={mobile} onChange={event => setMobile(event.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="09123456789" className="h-16 border-white/25 bg-white/10 text-center text-xl text-white placeholder:text-white/45"/><Button className="h-16 w-full bg-emerald-500 text-lg font-black text-white hover:bg-emerald-400" disabled={loading || mobile.length !== 11} onClick={send}>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "دریافت کد تایید"}</Button></div> : <div className="mt-9 space-y-5"><Input dir="ltr" inputMode="numeric" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="کد ۴ رقمی" className="h-16 border-white/25 bg-white/10 text-center text-xl text-white placeholder:text-white/45"/><Button className="h-16 w-full bg-emerald-500 text-lg font-black text-white hover:bg-emerald-400" disabled={loading || code.length !== 4} onClick={verify}>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "ورود به اپلیکیشن"}</Button><button className="w-full text-sm text-white/65 underline" onClick={() => setStep("mobile")}>تغییر شماره</button></div>}<p className="mt-6 text-center text-xs text-white/40">کد لینک: {token}</p></section></div></main>;
}
