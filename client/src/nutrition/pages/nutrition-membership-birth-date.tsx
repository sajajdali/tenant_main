import { ArrowLeft, CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { MembershipStepProgress } from "@/nutrition/components/membership-step-progress";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { PROFILE_HOME_REVIEW_HREF, appendProfileHomeReviewReturn, isReturningToProfileHomeReview, resolveProfileHomeReviewAwareHref } from "@/nutrition/lib/membership-edit-navigation";
import { saveMembershipProfileEdit } from "@/nutrition/lib/membership-edit-persistence";
import { MEMBERSHIP_STEPS, MEMBERSHIP_TOTAL_STEPS } from "@/nutrition/lib/membership-progress";
import { toGregorianFromJalali, toJalaliFromGregorian } from "@/nutrition/lib/jalali-date";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const PERSIAN_YEARS = Array.from({ length: 90 }, (_, index) => 1405 - index);
const GREGORIAN_YEARS = Array.from({ length: 90 }, (_, index) => new Date().getFullYear() - index);
const JALALI_MONTH_KEYS = [
  "nutritionMembershipBirthDate.month.1",
  "nutritionMembershipBirthDate.month.2",
  "nutritionMembershipBirthDate.month.3",
  "nutritionMembershipBirthDate.month.4",
  "nutritionMembershipBirthDate.month.5",
  "nutritionMembershipBirthDate.month.6",
  "nutritionMembershipBirthDate.month.7",
  "nutritionMembershipBirthDate.month.8",
  "nutritionMembershipBirthDate.month.9",
  "nutritionMembershipBirthDate.month.10",
  "nutritionMembershipBirthDate.month.11",
  "nutritionMembershipBirthDate.month.12",
] as const;
const PROFILE_SETUP_STEP = MEMBERSHIP_STEPS.birthDate;
const PROFILE_SETUP_TOTAL_STEPS = MEMBERSHIP_TOTAL_STEPS;

const getDaysInMonth = (month: number) => {
  if (month <= 6) {
    return 31;
  }

  if (month <= 11) {
    return 30;
  }

  return 29;
};

function getInitialDate(value: string | null | undefined, calendar: "jalali" | "gregorian" | "hijri") {
  if (!value) {
    return calendar === "jalali" ? { year: 1367, month: 9, day: 10 } : { year: 1990, month: 12, day: 1 };
  }

  const [yearPart, monthPart, dayPart] = value.split("-").map((part) => Number(part));

  if (!yearPart || !monthPart || !dayPart) {
    return calendar === "jalali" ? { year: 1367, month: 9, day: 10 } : { year: 1990, month: 12, day: 1 };
  }

  if (calendar !== "jalali") {
    return {
      year: yearPart,
      month: monthPart,
      day: dayPart,
    };
  }

  const jalali = toJalaliFromGregorian(yearPart, monthPart, dayPart);
  return {
    year: jalali.jy,
    month: jalali.jm,
    day: jalali.jd,
  };
}

export default function NutritionMembershipBirthDatePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { calendar, dateLocale, dir, isRtl } = useLocale();
  const { user, isLoading } = useAuth();
  const formState = useMemo(() => getNutritionFormState(), []);
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isJalaliCalendar = calendar === "jalali";
  const initialDate = useMemo(() => getInitialDate(formState.birthDate, calendar), [calendar, formState.birthDate]);
  const [selectedYear, setSelectedYear] = useState<number>(initialDate.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialDate.month);
  const [selectedDay, setSelectedDay] = useState<number>(initialDate.day);
  const shouldPersistEdit = isReturningToProfileHomeReview(searchParams);
  const backHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/activity", searchParams);
  const nextHref = appendProfileHomeReviewReturn("/nutrition/membership/height", backHref !== "/nutrition/membership/activity");

  const availableDays = useMemo(
    () => {
      const daysInMonth = isJalaliCalendar
        ? getDaysInMonth(selectedMonth)
        : new Date(selectedYear, selectedMonth, 0).getDate();

      return Array.from({ length: daysInMonth }, (_, index) => index + 1);
    },
    [isJalaliCalendar, selectedMonth, selectedYear],
  );
  const yearOptions = isJalaliCalendar ? PERSIAN_YEARS : GREGORIAN_YEARS;
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => ({
      value: index + 1,
      label: isJalaliCalendar
        ? t(JALALI_MONTH_KEYS[index])
        : new Intl.DateTimeFormat(dateLocale, { month: "long" }).format(new Date(2026, index, 1)),
    })),
    [dateLocale, isJalaliCalendar, t],
  );

  useEffect(() => {
    const maxDay = isJalaliCalendar
      ? getDaysInMonth(selectedMonth)
      : new Date(selectedYear, selectedMonth, 0).getDate();
    if (selectedDay > maxDay) {
      setSelectedDay(maxDay);
    }
  }, [isJalaliCalendar, selectedDay, selectedMonth, selectedYear]);

  useEffect(() => {
    setSelectedYear(initialDate.year);
    setSelectedMonth(initialDate.month);
    setSelectedDay(initialDate.day);
  }, [initialDate.day, initialDate.month, initialDate.year]);

  useEffect(() => {
    if (isLoading || !user) {
      return;
    }

    api.nutrition.getProfile().then((result) => {
      const profileBirthDate = result.data?.profile?.birthDate;

      if (!result.success || !profileBirthDate) {
        return;
      }

      const nextDate = getInitialDate(profileBirthDate, calendar);
      updateNutritionFormState({ birthDate: profileBirthDate });
      setSelectedYear(nextDate.year);
      setSelectedMonth(nextDate.month);
      setSelectedDay(nextDate.day);
    });
  }, [calendar, isLoading, user]);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (!shouldPersistEdit && !formState.gender) {
      setLocation("/nutrition/membership/gender");
      return;
    }

    if (!shouldPersistEdit && (!formState.athleteMode || !formState.activityLevel)) {
      setLocation("/nutrition/membership/activity");
    }
  }, [formState.activityLevel, formState.athleteMode, formState.gender, isLoading, setLocation, shouldPersistEdit, user]);

  const handleContinue = async () => {
    const { gy, gm, gd } = isJalaliCalendar
      ? toGregorianFromJalali(selectedYear, selectedMonth, selectedDay)
      : { gy: selectedYear, gm: selectedMonth, gd: selectedDay };
    const birthDate = `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;

    updateNutritionFormState({
      birthDate,
    });
    if (shouldPersistEdit) {
      const result = await saveMembershipProfileEdit({ step: "birth-date", birthDate });
      if (!result.success) {
        toast({ variant: "destructive", title: t("nutritionMembershipShared.toast.saveFailed"), description: result.message });
        return;
      }

      setLocation(PROFILE_HOME_REVIEW_HREF);
      return;
    }

    setLocation(nextHref);
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[390px] flex-col px-5 pb-10 pt-8">
        <NutritionTopbar backHref={backHref} title={t("nutritionMembershipShared.topbarTitle")} description={t("nutritionMembershipBirthDate.topbarDescription")} variant="hero" />

        <MembershipStepProgress step={PROFILE_SETUP_STEP} totalSteps={PROFILE_SETUP_TOTAL_STEPS} className="mt-8 space-y-3" itemClassName="h-1.5" />

        <main className="flex flex-1 flex-col pt-9">
          <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[23px] border border-amber-300/22 bg-amber-400/12 text-amber-300 shadow-[0_24px_55px_-38px_rgba(251,191,36,0.9)]">
            <CalendarDays className="h-8 w-8" />
          </div>

          <div className="mt-7 space-y-3 text-center">
            <h1 className="text-[24px] font-black leading-[1.45] text-white">{t("nutritionMembershipBirthDate.title")}</h1>
          </div>

          <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.025] p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <div className="text-center text-[12px] font-bold text-slate-400">{t("nutritionMembershipBirthDate.year")}</div>
                <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
                  <SelectTrigger className="h-[50px] rounded-[17px] border-white/10 bg-white/5 px-3 text-center text-[16px] font-black text-white">
                    <SelectValue placeholder={t("nutritionMembershipBirthDate.year")} />
                  </SelectTrigger>
                  <SelectContent dir={dir}>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {format.number(year, { useGrouping: false })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-center text-[12px] font-bold text-slate-400">{t("nutritionMembershipBirthDate.month")}</div>
                <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(Number(value))}>
                  <SelectTrigger className="h-[50px] rounded-[17px] border-white/10 bg-white/5 px-3 text-center text-[16px] font-black text-white">
                    <SelectValue placeholder={t("nutritionMembershipBirthDate.month")} />
                  </SelectTrigger>
                  <SelectContent dir={dir}>
                    {monthOptions.map((month) => (
                      <SelectItem key={month.value} value={String(month.value)}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-center text-[12px] font-bold text-slate-400">{t("nutritionMembershipBirthDate.day")}</div>
                <Select value={String(selectedDay)} onValueChange={(value) => setSelectedDay(Number(value))}>
                  <SelectTrigger className="h-[50px] rounded-[17px] border-white/10 bg-white/5 px-3 text-center text-[16px] font-black text-white">
                    <SelectValue placeholder={t("nutritionMembershipBirthDate.day")} />
                  </SelectTrigger>
                  <SelectContent dir={dir}>
                    {availableDays.map((day) => (
                      <SelectItem key={day} value={String(day)}>
                        {format.number(day, { useGrouping: false })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void handleContinue()}
            className="mt-auto h-[56px] w-full shrink-0 rounded-[18px] bg-[linear-gradient(135deg,#f8c45a,#f59e0b)] text-[16px] font-black text-slate-950 shadow-[0_22px_55px_-34px_rgba(251,191,36,0.95)] hover:opacity-95"
          >
            {shouldPersistEdit ? t("nutritionMembershipShared.saveChanges") : t("common.continue")}
            <ArrowLeft className={`h-[18px] w-[18px] ${isRtl ? "ms-2" : "me-2 rotate-180"}`} />
          </Button>
        </main>
      </div>
    </div>
  );
}
