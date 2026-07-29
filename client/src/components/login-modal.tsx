import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import * as CountryFlagIcons from "country-flag-icons/react/3x2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { normalizeDigits } from "@/lib/normalize";
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
import {
  countryDialCode,
  countryShortCode,
  countryPhoneExample,
  normalizeNationalPhoneInput,
  PHONE_COUNTRIES,
  phoneForDisplay,
  phoneForSubmission,
  resolvePhoneCountry,
} from "@/lib/international-phone";
import type { CountryCode } from "libphonenumber-js/max";

const countryFlagIcons = CountryFlagIcons as Record<string, ComponentType<SVGProps<SVGSVGElement>>>;

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
  const { country, dir, htmlLang } = useLocale();
  const t = useT();
  const format = useFormat();
  const [step, setStep] = useState<"phone" | "otp" | "profile">("phone");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(() => resolvePhoneCountry(country));
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [demoFixedCodeActive, setDemoFixedCodeActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(0);
  const [requirements, setRequirements] = useState<RegistrationRequirements>(getDefaultRegistrationRequirements());
  const [showCountryPrefix, setShowCountryPrefix] = useState(false);
  const [configuredPhoneCountry, setConfiguredPhoneCountry] = useState<CountryCode>(() => resolvePhoneCountry(country));
  const [authenticationSettingsLoaded, setAuthenticationSettingsLoaded] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [profileForm, setProfileForm] = useState<UserProfileFormValues>(getUserProfileFormDefaults());
  const [profileErrors, setProfileErrors] = useState<Partial<Record<keyof UserProfileFormValues, string>>>({});
  const initializedProfileUserRef = useRef<string | null>(null);
  const phoneAutoSubmittedRef = useRef(false);
  const otpAutoSubmittedRef = useRef(false);
  const resendInFlightRef = useRef(false);
  const phoneRef = useRef("");
  const otpRef = useRef("");
  const phoneCountryOptions = useMemo(() => {
    const displayNames = typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames([htmlLang], { type: "region" })
      : null;

    return PHONE_COUNTRIES
      .map((code) => ({
        code,
        label: displayNames?.of(code) || code,
      }))
      .sort((first, second) => first.label.localeCompare(second.label, htmlLang));
  }, [htmlLang]);
  const validationPhoneCountry = showCountryPrefix ? phoneCountry : configuredPhoneCountry;
  const submittedPhone = phoneForSubmission(phone, validationPhoneCountry);
  const displayedPhone = phoneForDisplay(phone, validationPhoneCountry);
  const validationCountryLabel = useMemo(() => {
    if (typeof Intl.DisplayNames !== "function") {
      return validationPhoneCountry;
    }

    return new Intl.DisplayNames([htmlLang], { type: "region" }).of(validationPhoneCountry)
      || validationPhoneCountry;
  }, [htmlLang, validationPhoneCountry]);
  const showPhoneValidationError = phoneTouched && phone.length > 0 && !submittedPhone;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const fallbackCountry = resolvePhoneCountry(country);

    setAuthenticationSettingsLoaded(false);
    setShowCountryPrefix(false);
    setConfiguredPhoneCountry(fallbackCountry);
    setPhoneCountry(fallbackCountry);
    setPhone("");
    setPhoneTouched(false);
    phoneRef.current = "";
    phoneAutoSubmittedRef.current = false;

    api.payment.getSettings().then((res) => {
      if (!cancelled && res.success) {
        const settingsCountry = resolvePhoneCountry(
          res.data.country ?? res.data.localization?.country ?? country,
        );

        setRequirements(normalizeRegistrationRequirements(res.data.registrationRequirements));
        setConfiguredPhoneCountry(settingsCountry);
        setPhoneCountry(settingsCountry);
        setShowCountryPrefix(res.data.showCountryPrefixInAuthenticationForm === true);
      }
    }).finally(() => {
      if (!cancelled) {
        setAuthenticationSettingsLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [country, isOpen]);

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
    setPhoneTouched(true);
    await sendOtpForPhone(phoneRef.current || submittedPhone);
  };

  const sendOtpForPhone = async (targetPhone: string) => {
    if (loading) return;
    if (!targetPhone) return;

    setLoading(true);
    try {
      const success = await sendOtp(targetPhone);

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
    } finally {
      setLoading(false);
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
    const success = await login(phoneRef.current || submittedPhone, targetOtp);
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
    if (!authenticationSettingsLoaded) return;

    const nextPhone = normalizeNationalPhoneInput(event.target.value, validationPhoneCountry);
    const nextSubmittedPhone = phoneForSubmission(nextPhone, validationPhoneCountry);
    phoneRef.current = nextSubmittedPhone;
    setPhone(nextPhone);
    setPhoneTouched(nextPhone.length > 0);

    if (!nextSubmittedPhone) {
      phoneAutoSubmittedRef.current = false;
      return;
    }

    if (!loading && !phoneAutoSubmittedRef.current) {
      phoneAutoSubmittedRef.current = true;
      event.currentTarget.blur();
      void sendOtpForPhone(nextSubmittedPhone);
    }
  };

  const handlePhoneCountryChange = (nextCountry: string) => {
    setPhoneCountry(resolvePhoneCountry(nextCountry));
    setPhone("");
    setPhoneTouched(false);
    phoneRef.current = "";
    phoneAutoSubmittedRef.current = false;
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
      const result = await sendOtp(phoneRef.current || submittedPhone);
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
      <DialogContent
        className={`pretty-scrollbar max-h-[88vh] overflow-y-auto sm:max-w-[520px] ${
          dir === "ltr"
            ? "[&>button[data-dialog-close]]:!left-auto [&>button[data-dialog-close]]:!right-4"
            : "[&>button[data-dialog-close]]:!left-4 [&>button[data-dialog-close]]:!right-auto"
        }`}
        dir={dir}
      >
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
                    {t("auth.login.otpDescription.beforePhone")} <PhoneText>{displayedPhone}</PhoneText> {t("auth.login.otpDescription.afterPhone")}
                  </>
                )
                : profileDescription}
          </DialogDescription>
        </DialogHeader>

        {step === "phone" && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("auth.login.phoneLabel")}</Label>
              <div className="flex gap-2" dir="ltr">
                {showCountryPrefix && (
                  <Select value={phoneCountry} onValueChange={handlePhoneCountryChange}>
                    <SelectTrigger
                      className="h-10 w-24 shrink-0 px-2 font-mono [&>span]:w-full"
                      aria-label={t("auth.login.countryCodeLabel")}
                      dir="ltr"
                    >
                      <SelectValue>
                        <span className="grid grid-cols-[1.5rem_1fr] items-center gap-1 text-start" dir="ltr">
                          <CountryFlagIcon country={phoneCountry} />
                          <span className="justify-self-end text-end tabular-nums">{countryDialCode(phoneCountry)}</span>
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-32 max-w-[calc(100vw-2rem)]" dir="ltr">
                      {phoneCountryOptions.map((option) => (
                        <SelectItem
                          key={option.code}
                          value={option.code}
                          className="font-mono [&>span:last-child]:block [&>span:last-child]:w-full"
                          aria-label={`${option.label}, ${countryDialCode(option.code)}`}
                        >
                          <span className="grid w-full grid-cols-[1.5rem_1.75rem_1fr] items-center gap-1 text-start" dir="ltr">
                            <CountryFlagIcon country={option.code} />
                            <span className="text-center font-semibold">{countryShortCode(option.code)}</span>
                            <span className="justify-self-end text-end tabular-nums">{countryDialCode(option.code)}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Input
                  value={phone}
                  onChange={handlePhoneChange}
                  onFocus={handlePhoneFocus}
                  onBlur={() => setPhoneTouched(phone.length > 0)}
                  placeholder={countryPhoneExample(validationPhoneCountry) || t("auth.login.nationalPhonePlaceholder")}
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel-national"
                  className="min-w-0 flex-1 text-start font-mono"
                  style={{ direction: "ltr" }}
                  disabled={!authenticationSettingsLoaded}
                  autoFocus
                />
              </div>
              {showPhoneValidationError && (
                <p className="text-sm text-destructive">
                  {t("auth.login.invalidPhoneForCountry", { country: validationCountryLabel })}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !authenticationSettingsLoaded || !submittedPhone}
            >
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

function CountryFlagIcon({ country }: { country: CountryCode }) {
  const FlagIcon = countryFlagIcons[country];

  if (!FlagIcon) {
    return <span className="text-center text-[10px] font-bold">{country}</span>;
  }

  return (
    <span className="flex h-4 w-6 justify-self-start items-center justify-center overflow-hidden rounded-[3px] shadow-sm ring-1 ring-border/70" aria-hidden="true">
      <FlagIcon className="h-full w-full" />
    </span>
  );
}
