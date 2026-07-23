import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { normalizeDigits, normalizePhoneInput } from "@/lib/normalize";
import { Loader2, LockKeyhole, User } from "lucide-react";
import { UserProfileForm } from "@/components/user-profile-form";
import {
  buildUserProfilePayload,
  getDefaultRegistrationRequirements,
  getUserProfileFormDefaults,
  isUserProfileComplete,
  normalizeRegistrationRequirements,
  RegistrationRequirements,
  UserProfileFormValues,
  validateUserProfileForm,
} from "@/lib/membership";
import { useLocation } from "wouter";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { PhoneText } from "@/i18n/ltr-text";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  onSuccess?: () => void;
  phoneStepDescription?: string;
}

export function LoginModal({ isOpen, onClose, onDismiss, onSuccess, phoneStepDescription }: LoginModalProps) {
  const { sendOtp, login, updateProfile, user } = useAuth();
  const [, setLocation] = useLocation();
  const { dir } = useLocale();
  const t = useT();
  const format = useFormat();
  const [step, setStep] = useState<"phone" | "otp" | "profile">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [demoFixedCodeActive, setDemoFixedCodeActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(0);
  const [requirements, setRequirements] = useState<RegistrationRequirements>(getDefaultRegistrationRequirements());
  const [profileForm, setProfileForm] = useState<UserProfileFormValues>(getUserProfileFormDefaults());
  const [profileErrors, setProfileErrors] = useState<Partial<Record<keyof UserProfileFormValues, string>>>({});
  const initializedProfileUserRef = useRef<string | null>(null);
  const phoneAutoSubmittedRef = useRef(false);
  const otpAutoSubmittedRef = useRef(false);
  const resendInFlightRef = useRef(false);
  const phoneRef = useRef("");
  const otpRef = useRef("");

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (!isOpen) return;

    api.payment.getSettings().then((res) => {
      if (res.success) {
        setRequirements(normalizeRegistrationRequirements(res.data.registrationRequirements));
      }
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      initializedProfileUserRef.current = null;
      phoneAutoSubmittedRef.current = false;
      otpAutoSubmittedRef.current = false;
      return;
    }

    if (user && isManagementUser(user)) {
      onClose();
      setLocation("/panel");
      return;
    }

    if (user && !isUserProfileComplete(user, requirements)) {
      const userKey = user.id || user.phone || phone;
      setStep("profile");
      if (initializedProfileUserRef.current !== userKey) {
        setProfileForm(getUserProfileFormDefaults(user));
        setProfileErrors({});
        initializedProfileUserRef.current = userKey;
      }
      return;
    }

    if (user && isUserProfileComplete(user, requirements)) {
      onSuccess?.();
      onClose();
    }
  }, [isOpen, user, requirements, onClose, onSuccess]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendOtpForPhone(phoneRef.current || phone);
  };

  const sendOtpForPhone = async (targetPhone: string) => {
    if (loading) return;
    if (targetPhone.length !== 11) return;

    setLoading(true);
    const success = await sendOtp(targetPhone);
    setLoading(false);

    if (success.ok) {
      setDemoFixedCodeActive(!!success.codeHint);
      if (success.codeHint) {
        setOtp(success.codeHint);
      }
      setStep("otp");
      setTimer(60);
    } else {
      phoneAutoSubmittedRef.current = false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithOtp(otpRef.current || otp);
  };

  const loginWithOtp = async (targetOtp: string) => {
    if (loading) return;
    if (targetOtp.length !== 4) return;

    setLoading(true);
    const success = await login(phoneRef.current || phone, targetOtp);
    setLoading(false);

    if (success) {
      const latestUser = readStoredUser();
      if (latestUser && isManagementUser(latestUser)) {
        onClose();
        setLocation("/panel");
        return;
      }

      if (demoFixedCodeActive) {
        onSuccess?.();
        onClose();
        return;
      }
      setStep("profile");
    } else {
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

  const handlePhoneFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    const input = event.currentTarget;

    window.requestAnimationFrame(() => {
      if (document.activeElement !== input) {
        return;
      }

      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
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
      void loginWithOtp(nextOtp);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateUserProfileForm(profileForm, requirements, {
      t,
      formatNumber: format.number,
    });
    setProfileErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);
    const success = await updateProfile(buildUserProfilePayload(profileForm));
    setLoading(false);

    if (!success) {
      return;
    }

    onSuccess?.();
    onClose();
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

  const profileDescription = useMemo(() => {
    const hasExtraRequiredField = Object.values(requirements).some((field) => field.required);
    return hasExtraRequiredField
      ? t("auth.login.profileDescription.full")
      : t("auth.login.profileDescription.nameOnly");
  }, [requirements, t]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          (onDismiss ?? onClose)();
        }
      }}
    >
      <DialogContent className="pretty-scrollbar max-h-[88vh] overflow-y-auto sm:max-w-[520px]" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "profile" ? <User className="w-5 h-5 text-primary" /> : <LockKeyhole className="w-5 h-5 text-primary" />}
            {step === "profile" ? t("auth.login.profileTitle") : t("auth.login.title")}
          </DialogTitle>
          <DialogDescription>
            {step === "phone"
              ? (phoneStepDescription || t("auth.login.phoneDescription"))
              : step === "otp"
                ? (
                  <>
                    {t("auth.login.otpDescription.beforePhone")} <PhoneText>{phone}</PhoneText> {t("auth.login.otpDescription.afterPhone")}
                  </>
                )
                : profileDescription}
          </DialogDescription>
        </DialogHeader>

        {step === "phone" && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("auth.login.phoneLabel")}</Label>
              <Input
                value={phone}
                onChange={handlePhoneChange}
                onFocus={handlePhoneFocus}
                placeholder="0912..."
                dir="ltr"
                inputMode="numeric"
                className="text-start font-mono"
                style={{ direction: "ltr" }}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || phone.length !== 11}>
              {loading ? <Loader2 className="animate-spin" /> : t("auth.login.sendOtp")}
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleLogin} className="space-y-4">
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
              {loading ? <Loader2 className="animate-spin" /> : t("auth.login.submit")}
            </Button>

            <div className="text-center text-sm">
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
            <Button variant="ghost" size="sm" type="button" onClick={() => setStep("phone")} className="w-full text-xs text-muted-foreground mt-2">
              {t("auth.login.editPhone")}
            </Button>
          </form>
        )}

        {step === "profile" && (
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <UserProfileForm
              form={profileForm}
              onChange={setProfileForm}
              requirements={requirements}
              errors={profileErrors}
              cardless
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : t("auth.login.completeProfileSubmit")}
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
    return JSON.parse(window.localStorage.getItem("barber_user") || "null") as { role?: string | null } | null;
  } catch {
    return null;
  }
}

function isManagementUser(user: { role?: string | null }) {
  return user.role === "admin" || user.role === "barber";
}
