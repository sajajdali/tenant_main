import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, UserRound } from "lucide-react";
import { normalizeDigits, normalizePhoneInput } from "@/lib/normalize";
import { useLandingAuth } from "@/lib/landing-auth";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { PhoneText } from "@/i18n/ltr-text";

interface LandingAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LandingAuthDialog({ open, onOpenChange, onSuccess }: LandingAuthDialogProps) {
  const { customer, sendOtp, login, updateProfile } = useLandingAuth();
  const t = useT();
  const formatValue = useFormat();
  const { dir } = useLocale();
  const [step, setStep] = useState<"phone" | "otp" | "profile">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const phoneAutoSubmittedRef = useRef(false);
  const otpAutoSubmittedRef = useRef(false);
  const phoneRef = useRef("");
  const otpRef = useRef("");

  useEffect(() => {
    if (!open) {
      setStep("phone");
      setPhone("");
      setOtp("");
      setFirstName("");
      setLastName("");
      setTimer(0);
      setLoading(false);
      phoneRef.current = "";
      otpRef.current = "";
      phoneAutoSubmittedRef.current = false;
      otpAutoSubmittedRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !customer) return;

    if (!customer.firstName || !customer.lastName) {
      setFirstName(customer.firstName ?? "");
      setLastName(customer.lastName ?? "");
      setStep("profile");
      return;
    }

    onSuccess?.();
    onOpenChange(false);
  }, [customer, onOpenChange, onSuccess, open]);

  useEffect(() => {
    if (timer <= 0) return;
    const id = window.setInterval(() => setTimer((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendOtpForPhone(phoneRef.current || phone);
  };

  const sendOtpForPhone = async (targetPhone: string) => {
    if (loading) return;
    if (targetPhone.length !== 11) return;
    setLoading(true);
    const result = await sendOtp(targetPhone);
    setLoading(false);
    if (result.ok) {
      if (result.codeHint) {
        otpRef.current = result.codeHint;
        setOtp(result.codeHint);
      }
      setTimer(60);
      setStep("otp");
    } else {
      phoneAutoSubmittedRef.current = false;
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    await verifyOtp(otpRef.current || otp);
  };

  const verifyOtp = async (targetOtp: string) => {
    if (loading) return;
    if (targetOtp.length !== 4) return;
    setLoading(true);
    const ok = await login(phoneRef.current || phone, targetOtp);
    setLoading(false);
    if (ok && customer?.firstName && customer?.lastName) {
      onSuccess?.();
      onOpenChange(false);
    } else if (!ok) {
      otpAutoSubmittedRef.current = false;
    }
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

  const handleProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setLoading(true);
    const ok = await updateProfile({
      firstName,
      lastName,
    });
    setLoading(false);
    if (ok) {
      onSuccess?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[420px] ${dir === "rtl" ? "[&>button]:!left-4 [&>button]:!right-auto" : ""}`} dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "profile" ? <UserRound className="h-5 w-5 text-primary" /> : <LogIn className="h-5 w-5 text-primary" />}
            {step === "profile" ? t("auth.landing.profileTitle") : t("auth.landing.title")}
          </DialogTitle>
          {step === "otp" ? (
            <DialogDescription asChild>
              <div>
                {t("auth.landing.otpDescriptionBefore")} <PhoneText>{phone}</PhoneText> {t("auth.landing.otpDescriptionAfter")}
              </div>
            </DialogDescription>
          ) : (
            <DialogDescription>
              {step === "phone" ? t("auth.landing.phoneDescription") : t("auth.landing.profileDescription")}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === "phone" ? (
          <form className="space-y-4" onSubmit={handleSendOtp}>
            <div className="space-y-2">
              <Label htmlFor="landing-auth-phone">{t("auth.login.phoneLabel")}</Label>
              <Input
                id="landing-auth-phone"
                dir="ltr"
                inputMode="numeric"
                className="text-start font-mono"
                placeholder="0912..."
                value={phone}
                onChange={handlePhoneChange}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || phone.length !== 11}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.login.sendOtp")}
            </Button>
          </form>
        ) : null}

        {step === "otp" ? (
          <form className="space-y-4" onSubmit={handleVerify}>
            <div className="space-y-2">
              <Label htmlFor="landing-auth-otp">{t("auth.login.otpLabel")}</Label>
              <Input
                id="landing-auth-otp"
                maxLength={4}
                inputMode="numeric"
                className="text-center text-2xl tracking-[0.45em] font-mono"
                placeholder="----"
                value={otp}
                onChange={handleOtpChange}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || otp.length !== 4}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.landing.verifySubmit")}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              {timer > 0 ? t("auth.login.resendCountdown", { seconds: formatValue.number(timer) }) : null}
            </div>
            <Button variant="ghost" type="button" className="w-full text-xs" onClick={() => setStep("phone")}>
              {t("auth.login.editPhone")}
            </Button>
          </form>
        ) : null}

        {step === "profile" ? (
          <form className="space-y-4" onSubmit={handleProfile}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="landing-auth-first-name">{t("auth.landing.firstNameLabel")}</Label>
                <Input id="landing-auth-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="landing-auth-last-name">{t("auth.landing.lastNameLabel")}</Label>
                <Input id="landing-auth-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading || !firstName.trim() || !lastName.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.landing.profileSubmit")}
            </Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
