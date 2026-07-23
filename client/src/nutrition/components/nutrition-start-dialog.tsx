import { useEffect, useRef, useState } from "react";
import { Loader2, LockKeyhole, User } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { useAuth } from "@/lib/auth";
import { normalizeDigits, normalizePhoneInput } from "@/lib/normalize";
import { useLocation } from "wouter";

interface NutritionStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void | Promise<void>;
}

type Step = "phone" | "otp" | "profile";

export function NutritionStartDialog({ open, onOpenChange, onComplete }: NutritionStartDialogProps) {
  const { user, sendOtp, login, updateProfile } = useAuth();
  const t = useT();
  const format = useFormat();
  const { dir } = useLocale();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [demoFixedCodeActive, setDemoFixedCodeActive] = useState(false);
  const phoneAutoSubmittedRef = useRef(false);
  const otpAutoSubmittedRef = useRef(false);
  const resendInFlightRef = useRef(false);
  const phoneRef = useRef("");
  const otpRef = useRef("");

  useEffect(() => {
    if (!open) {
      setStep("phone");
      setPhone("");
      setOtp("");
      setFullName("");
      setTimer(0);
      setLoading(false);
      setResending(false);
      setDemoFixedCodeActive(false);
      phoneRef.current = "";
      otpRef.current = "";
      phoneAutoSubmittedRef.current = false;
      otpAutoSubmittedRef.current = false;
      resendInFlightRef.current = false;
      return;
    }

    if (user?.phone) {
      phoneRef.current = user.phone;
      setPhone(user.phone);
    }

    if (isManagementUser(user)) {
      onOpenChange(false);
      setLocation("/panel");
      return;
    }

    if (user?.name?.trim()) {
      onOpenChange(false);
      onComplete();
      return;
    }

    if (user && !user.name?.trim()) {
      setStep("profile");
    }
  }, [onComplete, onOpenChange, open, user]);

  useEffect(() => {
    if (timer <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setTimer((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timer]);

  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendOtpForPhone(phoneRef.current || phone);
  };

  const sendOtpForPhone = async (targetPhone: string) => {
    if (loading) {
      return;
    }

    if (targetPhone.length !== 11) {
      return;
    }

    setLoading(true);
    const result = await sendOtp(targetPhone);
    setLoading(false);

    if (!result.ok) {
      phoneAutoSubmittedRef.current = false;
      return;
    }

    setDemoFixedCodeActive(!!result.codeHint);
    if (result.codeHint) {
      setOtp(result.codeHint);
    }
    setStep("otp");
    setTimer(60);
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    await verifyOtp(otpRef.current || otp);
  };

  const verifyOtp = async (targetOtp: string) => {
    if (loading) {
      return;
    }

    if (targetOtp.length !== 4) {
      return;
    }

    setLoading(true);
    const ok = await login(phoneRef.current || phone, targetOtp);
    setLoading(false);

    if (!ok) {
      otpAutoSubmittedRef.current = false;
      return;
    }

    const latestUser = readStoredUser();
    if (latestUser && isManagementUser(latestUser)) {
      onOpenChange(false);
      setLocation("/panel");
      return;
    }

    const hasName = !!latestUser?.name?.trim();
    if (hasName) {
      onOpenChange(false);
      onComplete();
      return;
    }

    setStep("profile");
  };

  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextPhone = normalizePhoneInput(event.target.value);
    phoneRef.current = nextPhone;
    setPhone(nextPhone);

    if (nextPhone.length < 11) {
      phoneAutoSubmittedRef.current = false;
      return;
    }

    if (nextPhone.length === 11 && !loading && !phoneAutoSubmittedRef.current) {
      phoneAutoSubmittedRef.current = true;
      event.currentTarget.blur();
      void sendOtpForPhone(nextPhone);
    }
  };

  const handleOtpChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextOtp = normalizeDigits(event.target.value).replace(/\D/g, "").slice(0, 4);
    otpRef.current = nextOtp;
    setOtp(nextOtp);

    if (nextOtp.length < 4) {
      otpAutoSubmittedRef.current = false;
      return;
    }

    if (nextOtp.length === 4 && !loading && !otpAutoSubmittedRef.current) {
      otpAutoSubmittedRef.current = true;
      event.currentTarget.blur();
      void verifyOtp(nextOtp);
    }
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedName = fullName.trim();
    if (normalizedName.length < 3) {
      return;
    }

    setLoading(true);
    const ok = await updateProfile({ name: normalizedName });
    setLoading(false);

    if (!ok) {
      return;
    }

    onOpenChange(false);
    onComplete();
  };

  const handleResend = async () => {
    if (timer > 0 || loading || resending || resendInFlightRef.current) {
      return;
    }

    resendInFlightRef.current = true;
    setResending(true);

    try {
      const result = await sendOtp(phoneRef.current || phone);
      if (!result.ok) {
        return;
      }

      setDemoFixedCodeActive(!!result.codeHint);
      if (result.codeHint) {
        setOtp(result.codeHint);
      }
      setTimer(60);
    } finally {
      resendInFlightRef.current = false;
      setResending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pretty-scrollbar max-h-[88vh] overflow-y-auto sm:max-w-[520px]" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "profile" ? <User className="h-5 w-5 text-primary" /> : <LockKeyhole className="h-5 w-5 text-primary" />}
            {step === "profile" ? t("nutritionStart.profileTitle") : t("nutritionStart.loginTitle")}
          </DialogTitle>
          <DialogDescription>
            {step === "phone" && t("nutritionStart.phoneDescription")}
            {step === "otp" && (
              <>
                {t("nutritionStart.otpDescription.beforePhone")}
                <PhoneText className="mx-1">{phone}</PhoneText>
                {t("nutritionStart.otpDescription.afterPhone")}
              </>
            )}
            {step === "profile" && t("nutritionStart.profileDescription")}
          </DialogDescription>
        </DialogHeader>

        {step === "phone" && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("auth.login.phoneLabel")}</Label>
              <Input
                value={phone}
                onChange={handlePhoneChange}
                placeholder="0912..."
                dir="ltr"
                inputMode="numeric"
                className="text-start font-mono"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || phone.length !== 11}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("auth.login.sendOtp")}
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("auth.login.otpLabel")}</Label>
              <Input
                value={otp}
                onChange={handleOtpChange}
                placeholder="----"
                maxLength={4}
                inputMode="numeric"
                className="text-center text-2xl tracking-widest font-mono"
                autoFocus
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || otp.length !== 4}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("nutritionStart.verifySubmit")}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <Button variant="ghost" size="sm" type="button" onClick={() => setStep("phone")} className="px-0 text-xs text-muted-foreground">
                {t("auth.login.editPhone")}
              </Button>
              {timer > 0 ? (
                <span className="text-muted-foreground">{t("auth.login.resendCountdown", { seconds: format.number(timer) })}</span>
              ) : (
                <Button
                  variant="link"
                  type="button"
                  onClick={handleResend}
                  disabled={resending || loading}
                  aria-busy={resending}
                  className="h-auto gap-2 p-0 text-primary"
                >
                  {resending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("auth.login.sending")}
                    </>
                  ) : (
                    t("auth.login.resendCode")
                  )}
                </Button>
              )}
            </div>
          </form>
        )}

        {step === "profile" && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("nutritionStart.nameLabel")}</Label>
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder={t("nutritionStart.namePlaceholder")}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || fullName.trim().length < 3}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("auth.login.completeProfileSubmit")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function readStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(window.localStorage.getItem("barber_user") || "null") as { name?: string | null; role?: string | null } | null;
  } catch {
    return null;
  }
}

function isManagementUser(user: { role?: string | null } | null | undefined) {
  return user?.role === "admin" || user?.role === "barber";
}
