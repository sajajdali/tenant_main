import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IRAN_PROVINCES } from "@/lib/iran-location";
import {
  GENDER_OPTIONS,
  getCitiesForProfileForm,
  normalizeRegistrationRequirements,
  RegistrationRequirements,
  shouldShowMembershipField,
  UserProfileFormValues,
} from "@/lib/membership";
import { normalizeDigits, normalizePhoneInput } from "@/lib/normalize";
import { cn } from "@/lib/utils";
import { useFormat, useT } from "@/i18n/locale";

interface UserProfileFormProps {
  form: UserProfileFormValues;
  onChange: (updater: (current: UserProfileFormValues) => UserProfileFormValues) => void;
  requirements?: Partial<RegistrationRequirements> | null;
  errors?: Partial<Record<keyof UserProfileFormValues, string>>;
  showMobile?: boolean;
  mobileReadOnly?: boolean;
  nameLabel?: string;
  cardless?: boolean;
}

const MONTH_OPTIONS = [
  { value: "01", key: "profile.month.01" },
  { value: "02", key: "profile.month.02" },
  { value: "03", key: "profile.month.03" },
  { value: "04", key: "profile.month.04" },
  { value: "05", key: "profile.month.05" },
  { value: "06", key: "profile.month.06" },
  { value: "07", key: "profile.month.07" },
  { value: "08", key: "profile.month.08" },
  { value: "09", key: "profile.month.09" },
  { value: "10", key: "profile.month.10" },
  { value: "11", key: "profile.month.11" },
  { value: "12", key: "profile.month.12" },
] as const;

const DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const value = String(index + 1).padStart(2, "0");
  return { value, label: `${index + 1}` };
});

const YEAR_OPTIONS = Array.from({ length: 151 }, (_, index) => {
  const year = 1450 - index;
  return { value: String(year), label: String(year) };
});

function FieldLabel({
  children,
  required,
}: {
  children: string;
  required?: boolean;
}) {
  const t = useT();

  return (
    <Label className="flex items-center gap-2 text-sm font-semibold">
      <span>{children}</span>
      {required ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{t("common.required")}</span> : null}
    </Label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function UserProfileForm({
  form,
  onChange,
  requirements,
  errors,
  showMobile = false,
  mobileReadOnly = false,
  nameLabel,
  cardless = false,
}: UserProfileFormProps) {
  const t = useT();
  const formatValue = useFormat();
  const normalizedRequirements = normalizeRegistrationRequirements(requirements);
  const cities = getCitiesForProfileForm(form.provinceId);
  const resolvedNameLabel = nameLabel ?? t("profile.nameLabel");
  const wrapperClassName = cardless
    ? "space-y-4"
    : "space-y-4 rounded-2xl border border-border/70 bg-card/40 p-4";

  const setField = <K extends keyof UserProfileFormValues>(field: K, value: UserProfileFormValues[K]) => {
    onChange((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className={wrapperClassName}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <FieldLabel required>{resolvedNameLabel}</FieldLabel>
          <Input
            value={form.name}
            onChange={(event) => setField("name", event.target.value)}
            placeholder={t("profile.namePlaceholder")}
            className="h-11 rounded-xl"
          />
          <FieldError message={errors?.name} />
        </div>

        {showMobile ? (
          <div className="space-y-2 md:col-span-2">
            <FieldLabel required>{t("auth.login.phoneLabel")}</FieldLabel>
            <Input
              value={form.mobile}
              onChange={(event) => setField("mobile", normalizePhoneInput(event.target.value))}
              placeholder="0912..."
              dir="ltr"
              inputMode="numeric"
              readOnly={mobileReadOnly}
              className={cn("h-11 rounded-xl text-start", mobileReadOnly && "opacity-80")}
            />
            <FieldError message={errors?.mobile} />
          </div>
        ) : null}

        {shouldShowMembershipField("email", normalizedRequirements, form.email) ? (
          <div className="space-y-2 md:col-span-2">
            <FieldLabel required={normalizedRequirements.email.required}>{t("profile.emailLabel")}</FieldLabel>
            <Input
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              placeholder="example@email.com"
              dir="ltr"
              inputMode="email"
              className="h-11 rounded-xl text-start"
            />
            <FieldError message={errors?.email} />
          </div>
        ) : null}

        {shouldShowMembershipField("gender", normalizedRequirements, form.gender) ? (
          <div className="space-y-3 md:col-span-2">
            <FieldLabel required={normalizedRequirements.gender.required}>{t("profile.genderLabel")}</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {GENDER_OPTIONS.map((option) => {
                const active = form.gender === option.value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-12 rounded-2xl border-border/70 bg-background/50 text-base font-semibold tracking-tight",
                      active && "border-primary bg-primary/10 text-primary",
                    )}
                    onClick={() => setField("gender", option.value)}
                  >
                    {option.value === "male" ? t("profile.gender.male") : t("profile.gender.female")}
                  </Button>
                );
              })}
            </div>
            <FieldError message={errors?.gender} />
          </div>
        ) : null}

        {shouldShowMembershipField("nationalCode", normalizedRequirements, form.nationalCode) ? (
          <div className="space-y-2">
            <FieldLabel required={normalizedRequirements.nationalCode.required}>{t("profile.nationalCodeLabel")}</FieldLabel>
            <Input
              value={form.nationalCode}
              onChange={(event) => setField("nationalCode", normalizeDigits(event.target.value).slice(0, 10))}
              placeholder="0012345678"
              dir="ltr"
              inputMode="numeric"
              className="h-11 rounded-xl text-start"
            />
            <FieldError message={errors?.nationalCode} />
          </div>
        ) : null}

        {shouldShowMembershipField("jobTitle", normalizedRequirements, form.jobTitle) ? (
          <div className="space-y-2">
            <FieldLabel required={normalizedRequirements.jobTitle.required}>{t("profile.jobTitleLabel")}</FieldLabel>
            <Input
              value={form.jobTitle}
              onChange={(event) => setField("jobTitle", event.target.value)}
              placeholder={t("profile.jobTitlePlaceholder")}
              className="h-11 rounded-xl"
            />
            <FieldError message={errors?.jobTitle} />
          </div>
        ) : null}

        {shouldShowMembershipField("birthDate", normalizedRequirements, form.birthYear || form.birthMonth || form.birthDay) ? (
          <div className="space-y-2 md:col-span-2">
            <FieldLabel required={normalizedRequirements.birthDate.required}>{t("profile.birthDateLabel")}</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              <Select value={form.birthDay || undefined} onValueChange={(value) => setField("birthDay", value)}>
                <SelectTrigger className="h-11 rounded-xl text-start">
                  <SelectValue placeholder={t("profile.birthDayPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {formatValue.number(Number(day.label))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.birthMonth || undefined} onValueChange={(value) => setField("birthMonth", value)}>
                <SelectTrigger className="h-11 rounded-xl text-start">
                  <SelectValue placeholder={t("profile.birthMonthPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {t(month.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.birthYear || undefined} onValueChange={(value) => setField("birthYear", value)}>
                <SelectTrigger className="h-11 rounded-xl text-start">
                  <SelectValue placeholder={t("profile.birthYearPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      {formatValue.number(Number(year.label))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FieldError message={errors?.birthYear} />
          </div>
        ) : null}

        {shouldShowMembershipField("location", normalizedRequirements, form.provinceId || form.cityId) ? (
          <div className="space-y-2 md:col-span-2">
            <FieldLabel required={normalizedRequirements.location.required}>{t("profile.locationLabel")}</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Select
                  value={form.provinceId || undefined}
                  onValueChange={(value) =>
                    onChange((current) => ({ ...current, provinceId: value, cityId: "" }))
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl text-start">
                    <SelectValue placeholder={t("profile.provincePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {IRAN_PROVINCES.map((province) => (
                      <SelectItem key={province.id} value={String(province.id)}>
                        {province.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Select
                  value={form.cityId || undefined}
                  onValueChange={(value) => setField("cityId", value)}
                  disabled={!form.provinceId}
                >
                  <SelectTrigger className="h-11 rounded-xl text-start">
                    <SelectValue placeholder={form.provinceId ? t("profile.cityPlaceholder") : t("profile.cityRequiresProvince")} />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city.id} value={String(city.id)}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <FieldError message={errors?.provinceId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
