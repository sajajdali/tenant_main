import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Check, ChevronLeft, Laptop, Loader2, LogOut, MonitorSmartphone, Smartphone } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { normalizeDigits } from "@/lib/normalize";

const RESEND_SECONDS = 120;
const emptyCodeDigits = () => ["", "", "", ""];
const normalizeNumericInput = (value: string, maxLength: number) =>
  normalizeDigits(value).replace(/\D/g, "").slice(0, maxLength);

export default function CustomLandingWelcomePage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { sendOtp, login, logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const settings = getInitialTenantMeta()?.customLandingSettings;
  const title = settings?.title?.trim() || "";
  const headline = settings?.headline?.trim() || "";
  const description = settings?.description?.trim() || "";
  const buttonLabel = settings?.buttonLabel?.trim() || "ورود به اپلیکیشن";
  const [mobile, setMobile] = useState("");
  const [codeDigits, setCodeDigits] = useState<string[]>(emptyCodeDigits);
  const [step, setStep] = useState<"mobile" | "code" | "success">("mobile");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [appToken, setAppToken] = useState("");
  const [appTokenLoading, setAppTokenLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const submittedMobileRef = useRef("");
  const autoSubmittedCodeRef = useRef("");
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const issuedAppTokenRef = useRef(false);
  const code = codeDigits.join("");

  const issueAppToken = async () => {
    if (!settings?.autoTokenEnabled || issuedAppTokenRef.current) {
      return;
    }

    issuedAppTokenRef.current = true;
    setAppTokenLoading(true);
    const tokenResult = await api.customLanding.issueAppToken();
    setAppTokenLoading(false);

    if (tokenResult.success) {
      setAppToken(tokenResult.data.accessToken);
      return;
    }

    issuedAppTokenRef.current = false;
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    setStep("success");
    setResendSeconds(0);
    void issueAppToken();
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (step !== "code" || resendSeconds <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [step, resendSeconds]);

  const send = async (nextMobile = mobile, force = false) => {
    const targetMobile = normalizeNumericInput(nextMobile, 11);
    if (targetMobile.length !== 11 || loading || resending) {
      return;
    }

    if (!force && submittedMobileRef.current === targetMobile) {
      return;
    }

    submittedMobileRef.current = targetMobile;
    setMobile(targetMobile);
    setLoading(!force);
    setResending(force);

    try {
      const result = await sendOtp(targetMobile);
      if (!result.ok) {
        submittedMobileRef.current = "";
        return;
      }

      setStep("code");
      setCodeDigits(emptyCodeDigits());
      setResendSeconds(RESEND_SECONDS);
      window.requestAnimationFrame(() => codeInputRefs.current[0]?.focus());
    } finally {
      setLoading(false);
      setResending(false);
    }
  };

  const verify = async (targetCode = code) => {
    if (targetCode.length !== 4 || loading) {
      return;
    }

    setLoading(true);
    const ok = await login(mobile, targetCode);
    setLoading(false);
    if (!ok) {
      setCodeDigits(emptyCodeDigits());
      autoSubmittedCodeRef.current = "";
      window.requestAnimationFrame(() => codeInputRefs.current[0]?.focus());
      return;
    }

    setStep("success");
    setResendSeconds(0);
    void issueAppToken();
  };

  const appendTokenToUrl = (url: string, token: string) => {
    if (!token) return url;

    try {
      const target = new URL(url, window.location.origin);
      target.pathname = `${target.pathname.replace(/\/?$/, "/")}${encodeURIComponent(token)}`;
      return target.toString();
    } catch {
      const [beforeHash, hash = ""] = url.split("#", 2);
      const [beforeQuery, query = ""] = beforeHash.split("?", 2);
      const base = `${beforeQuery.replace(/\/?$/, "/")}${encodeURIComponent(token)}`;
      return `${base}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
    }
  };

  const openUrl = (url: string) => {
    if (!url) return;

    try {
      const target = new URL(url, window.location.origin);
      if (target.origin === window.location.origin) {
        setLocation(`${target.pathname}${target.search}`);
      } else {
        window.location.href = target.toString();
      }
    } catch {
      setLocation(url.startsWith("/") ? url : "/nutrition");
    }
  };

  const destinationLinks = [
    { label: "اپلیکیشن اندروید", description: "دانلود مستقیم APK", icon: Smartphone, url: settings?.androidUrl || "", subtle: false, appendToken: false },
    { label: "اپلیکیشن iOS", description: "دانلود از App Store", icon: MonitorSmartphone, url: settings?.iosUrl || "", subtle: false, appendToken: true },
    { label: "نسخه وب", description: "همین‌جا در مرورگر ادامه بده", icon: Laptop, url: settings?.webAppUrl || "", subtle: true, appendToken: true },
    { label: "مشاهده اپلیکیشن", description: "ورود به محیط دریافت رژیم", icon: MonitorSmartphone, url: settings?.appViewUrl || "", subtle: false, appendToken: false },
  ].filter((item) => item.url.trim() !== "");

  useEffect(() => {
    if (step !== "code" || code.length < 4) {
      autoSubmittedCodeRef.current = "";
      return;
    }

    if (loading || autoSubmittedCodeRef.current === code) {
      return;
    }

    autoSubmittedCodeRef.current = code;
    codeInputRefs.current[3]?.blur();
    void verify(code);
  }, [code, loading, step]);

  const handleMobileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextMobile = normalizeNumericInput(event.target.value, 11);
    setMobile(nextMobile);

    if (nextMobile.length < 11) {
      submittedMobileRef.current = "";
      return;
    }

    event.currentTarget.blur();
    void send(nextMobile);
  };

  const handleCodeChange = (index: number, value: string) => {
    const digits = normalizeNumericInput(value, 4).split("");
    setCodeDigits((current) => {
      const next = [...current];

      if (digits.length === 0) {
        next[index] = "";
      } else {
        digits.forEach((digit, offset) => {
          const targetIndex = index + offset;
          if (targetIndex < next.length) {
            next[targetIndex] = digit;
          }
        });
      }

      return next;
    });

    if (digits.length > 0) {
      const nextIndex = Math.min(3, index + digits.length);
      window.requestAnimationFrame(() => codeInputRefs.current[nextIndex]?.focus());
    }
  };

  const handleCodeKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !codeDigits[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const resetToMobileStep = () => {
    setStep("mobile");
    setCodeDigits(emptyCodeDigits());
    setResendSeconds(0);
    submittedMobileRef.current = "";
    autoSubmittedCodeRef.current = "";
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#101a16] text-white" dir="rtl">
      <img src="/booking-app/nutrition-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-black/60" />
      {isAuthenticated ? (
        <button
          type="button"
          onClick={() => void logout()}
          className="absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-black/25 text-white/80 shadow-lg backdrop-blur transition hover:border-white/35 hover:bg-white/10 hover:text-white"
          title="خروج"
          aria-label="خروج"
        >
          <LogOut className="h-5 w-5" />
        </button>
      ) : null}
      <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-10">
        <div className="mb-8 text-center">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt={title || "لوگو"} className="mx-auto max-h-24 w-auto max-w-[220px] object-contain" />
          ) : null}
          {title ? <div className="mt-4 text-lg font-black text-white">{title}</div> : null}
        </div>

        <section className="border border-white/15 bg-[#14231e]/95 p-7 shadow-2xl backdrop-blur sm:rounded-[28px]">
          {step !== "success" && headline ? <h1 className="text-center text-3xl font-black">{headline}</h1> : null}
          {step !== "success" && description ? <p className="mt-6 text-center text-lg leading-8 text-white/80">{description}</p> : null}

          {authLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
            </div>
          ) : step === "success" ? (
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                  <Check className="h-9 w-9 stroke-[4]" />
                </span>
              </div>
              <h2 className="mt-6 text-3xl font-black">خوش آمدی!</h2>
              {destinationLinks.length > 0 ? (
                <p className="mt-4 text-lg font-semibold text-white/70">می‌خوای از کدوم نسخه استفاده کنی؟</p>
              ) : (
                <p className="mt-4 text-lg font-semibold text-white/70">لینکی برای ادامه مسیر تنظیم نشده است.</p>
              )}

              <div className="mt-8 flex flex-col gap-3 text-start">
                {destinationLinks.map((item) => {
                  const Icon = item.icon;
                  const needsToken = Boolean(settings?.autoTokenEnabled) && item.appendToken;
                  const href = needsToken ? appendTokenToUrl(item.url, appToken) : item.url;
                  const blocked = appTokenLoading || (needsToken && !appToken);

                  return (
                    <a
                      key={`${item.label}-${item.url}`}
                      href={href}
                      onClick={(event) => {
                        event.preventDefault();
                        if (blocked) return;
                        openUrl(href);
                      }}
                      className={[
                        "group flex w-full items-center gap-3.5 rounded-2xl px-[18px] py-4 text-start transition",
                        item.subtle
                          ? "border border-dashed border-white/30 bg-transparent text-[#e7ece5] hover:border-emerald-300/60 hover:bg-white/[0.04]"
                          : "border border-white/20 bg-white/[0.08] text-white hover:border-emerald-300/60 hover:bg-white/[0.11]",
                        blocked ? "cursor-wait opacity-60" : "",
                      ].join(" ")}
                    >
                      <span className={[
                        "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] text-emerald-300",
                        item.subtle ? "bg-white/[0.06]" : "bg-white/10",
                      ].join(" ")}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold leading-6 text-white">{item.label}</span>
                        <span className="block text-[12.5px] font-semibold leading-5 text-[#b9c4bc]">{item.description}</span>
                      </span>
                      {blocked ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-300" />
                      ) : (
                        <ChevronLeft className="h-4 w-4 shrink-0 text-emerald-300 transition group-hover:-translate-x-1" />
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          ) : step === "mobile" ? (
            <div className="mt-9 space-y-5">
              <Input
                dir="ltr"
                inputMode="numeric"
                value={mobile}
                onChange={handleMobileChange}
                placeholder="09123456789"
                className="h-16 border-white/25 bg-white/10 text-center text-xl text-white placeholder:text-white/45"
              />
              <Button
                className="h-16 w-full bg-emerald-500 text-lg font-black text-white hover:bg-emerald-400"
                disabled={loading || mobile.length !== 11}
                onClick={() => void send(mobile)}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "دریافت کد تایید"}
              </Button>
            </div>
          ) : (
            <div className="mt-9 space-y-5">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2" dir="ltr">
                {codeDigits.map((digit, index) => (
                  <div key={index} className="flex items-center gap-1.5 sm:gap-2">
                    {index > 0 ? <span className="text-xl font-black text-white/35">-</span> : null}
                    <Input
                      ref={(element) => {
                        codeInputRefs.current[index] = element;
                      }}
                      dir="ltr"
                      inputMode="numeric"
                      value={digit}
                      onChange={(event) => handleCodeChange(index, event.target.value)}
                      onKeyDown={(event) => handleCodeKeyDown(index, event)}
                      maxLength={4}
                      aria-label={`رقم ${index + 1} کد تایید`}
                      className="h-14 w-12 rounded-2xl border-white/20 bg-white/[0.07] text-center text-xl font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition focus:border-emerald-300/80 focus:bg-white/10 focus:ring-2 focus:ring-emerald-300/25 sm:h-15 sm:w-13"
                    />
                  </div>
                ))}
              </div>

              <Button
                className="h-16 w-full bg-emerald-500 text-lg font-black text-white hover:bg-emerald-400"
                disabled={loading || code.length !== 4}
                onClick={() => void verify()}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : buttonLabel}
              </Button>

              <div className="text-center text-sm">
                {resendSeconds > 0 ? (
                  <span className="text-white/60">ارسال مجدد کد تا {resendSeconds} ثانیه دیگر</span>
                ) : (
                  <Button
                    variant="link"
                    className="h-auto p-0 text-emerald-300"
                    disabled={resending || loading}
                    onClick={() => void send(mobile, true)}
                  >
                    {resending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        در حال ارسال
                      </>
                    ) : (
                      "ارسال مجدد کد"
                    )}
                  </Button>
                )}
              </div>

              <button className="w-full text-sm text-white/65 underline" onClick={resetToMobileStep}>
                تغییر شماره
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
