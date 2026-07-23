import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Bell, Calculator, Gauge, Menu, Minus, Plus, Ruler, Sparkles, UserRound, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import { api } from "@/lib/api";

type BmiGender = "male" | "female" | "";

type BmiMeta = {
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  chipClassName: string;
  resultClassName: string;
  progress: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBmiMeta(bmi: number): BmiMeta {
  if (bmi < 18.5) {
    return {
      labelKey: "nutritionBmi.result.underweight",
      descriptionKey: "nutritionBmi.result.underweightDescription",
      chipClassName: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
      resultClassName: "text-cyan-300",
      progress: clamp((bmi / 18.5) * 30, 5, 30),
    };
  }

  if (bmi < 25) {
    return {
      labelKey: "nutritionBmi.result.normal",
      descriptionKey: "nutritionBmi.result.normalDescription",
      chipClassName: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
      resultClassName: "text-emerald-300",
      progress: 30 + ((bmi - 18.5) / 6.5) * 24,
    };
  }

  if (bmi < 30) {
    return {
      labelKey: "nutritionBmi.result.overweight",
      descriptionKey: "nutritionBmi.result.overweightDescription",
      chipClassName: "border-amber-300/25 bg-amber-300/10 text-amber-100",
      resultClassName: "text-amber-300",
      progress: 54 + ((bmi - 25) / 5) * 18,
    };
  }

  return {
    labelKey: "nutritionBmi.result.obesity",
    descriptionKey: "nutritionBmi.result.obesityDescription",
    chipClassName: "border-orange-300/25 bg-orange-300/10 text-orange-100",
    resultClassName: "text-[#ff8a35]",
    progress: 72 + clamp(((bmi - 30) / 10) * 28, 0, 28),
  };
}

function normalizeNumber(value: string) {
  const normalized = value.replace(/[^\d.]/g, "");
  const parts = normalized.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : normalized;
}

function formatInputNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? String(Number(numeric.toFixed(1))) : "";
}

function adjustValue(value: string, delta: number, fallback: number | null, min: number, max: number) {
  const numericValue = Number(value);
  const base = Number.isFinite(numericValue) && value.trim() !== "" ? numericValue : fallback;

  if (base === null || !Number.isFinite(base)) {
    return "";
  }

  const next = clamp(base + delta, min, max);
  return String(Number(next.toFixed(1)));
}

export default function NutritionBmiPage() {
  const [, setLocation] = useLocation();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const format = useFormat();
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [gender, setGender] = useState<BmiGender>("");
  const [hasCalculated, setHasCalculated] = useState(false);
  const [profileDefaults, setProfileDefaults] = useState<{ heightCm: number | null; weightKg: number | null }>({
    heightCm: null,
    weightKg: null,
  });

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      const result = await api.nutrition.getProfile();

      if (cancelled || !result.success) {
        return;
      }

      const profile = result.data.profile;
      const nextHeight = Number(profile?.heightCm);
      const nextWeight = Number(profile?.weightKg);
      const defaultHeight = Number.isFinite(nextHeight) ? nextHeight : null;
      const defaultWeight = Number.isFinite(nextWeight) ? nextWeight : null;

      setProfileDefaults({ heightCm: defaultHeight, weightKg: defaultWeight });
      setHeightCm(formatInputNumber(defaultHeight));
      setWeightKg(formatInputNumber(defaultWeight));
      setGender(profile?.gender === "male" || profile?.gender === "female" ? profile.gender : "");
      setHasCalculated(false);
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const numericHeight = Number(heightCm);
  const numericWeight = Number(weightKg);
  const canCalculate = numericHeight >= 100 && numericHeight <= 230 && numericWeight >= 20 && numericWeight <= 250 && !!gender;

  const bmi = useMemo(() => {
    if (!canCalculate || !hasCalculated) {
      return null;
    }

    const heightMeters = numericHeight / 100;
    const value = numericWeight / (heightMeters * heightMeters);
    return Number.isFinite(value) ? value : null;
  }, [canCalculate, hasCalculated, numericHeight, numericWeight]);

  const bmiMeta = bmi ? getBmiMeta(bmi) : null;
  const healthyMinWeight = bmi && numericHeight ? Number((18.5 * (numericHeight / 100) ** 2).toFixed(1)) : null;
  const healthyMaxWeight = bmi && numericHeight ? Number((24.9 * (numericHeight / 100) ** 2).toFixed(1)) : null;
  const targetHint =
    bmi && healthyMinWeight && healthyMaxWeight
      ? bmi < 18.5
        ? t("nutritionBmi.target.minimum", { weight: format.number(healthyMinWeight, { maximumFractionDigits: 1 }) })
        : bmi >= 25
          ? t("nutritionBmi.target.maximum", { weight: format.number(healthyMaxWeight, { maximumFractionDigits: 1 }) })
          : t("nutritionBmi.target.normal")
      : t("nutritionBmi.target.empty");
  const resultLabel = bmiMeta ? t(bmiMeta.labelKey) : t("nutritionBmi.result.label");
  const resultDescription = bmiMeta ? t(bmiMeta.descriptionKey) : t("nutritionBmi.result.emptyDescription");

  const clearForm = () => {
    setHeightCm("");
    setWeightKg("");
    setGender("");
    setHasCalculated(false);
  };

  return (
    <div className="min-h-screen bg-[#080c13] text-[#eef3fb]" dir={dir}>
      <div className="mx-auto flex min-h-screen w-full max-w-[360px] flex-col px-4 pb-32 pt-3">
        <header className="flex flex-row-reverse items-center justify-between gap-3">
          <div className="flex flex-row-reverse items-center gap-2.5">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#151a23] text-slate-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
              aria-label={t("common.menu")}
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#151a23] text-slate-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
              aria-label={t("nutritionBmi.notifications")}
            >
              <Bell className="h-5 w-5" />
              <span className="absolute end-3 top-3 h-2.5 w-2.5 rounded-full bg-[#ffab2e]" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setLocation("/nutrition/profile")}
            className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-[#151a23] px-4 text-[14px] font-black text-slate-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
          >
            {t("common.back")}
            {isRtl ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </button>
        </header>

        <main className="mt-5 space-y-3.5">
          <section className="relative overflow-hidden rounded-[24px] border border-emerald-400/18 bg-[#10151d] px-6 pb-6 pt-6 shadow-[0_24px_90px_-64px_rgba(22,255,193,0.45)]">
            <div className="absolute start-0 top-0 h-full w-full bg-[radial-gradient(circle_at_20%_10%,rgba(33,214,162,0.14),transparent_36%),linear-gradient(140deg,rgba(18,61,52,0.28),transparent_40%)]" />
            <div className="absolute start-6 top-7 flex h-[46px] w-[46px] items-center justify-center rounded-[15px] border border-emerald-300/18 bg-emerald-300/10 text-emerald-300">
              <Calculator className="h-6 w-6" />
            </div>
            <div className="relative flex flex-col items-start text-start">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#2bd29d] px-6 py-2.5 text-[13px] font-black text-[#061313] shadow-[0_16px_40px_-24px_rgba(43,210,157,0.9)]">
                <Sparkles className="h-3.5 w-3.5" />
                {t("nutritionBmi.freeBadge")}
              </div>
              <div className="mt-6 w-full text-center text-[13px] font-black text-[#66dcca]">{t("nutritionBmi.eyebrow")}</div>
              <h1 className="mt-5 w-full text-start text-[21px] font-black leading-[1.62] text-white">{t("nutritionBmi.title")}</h1>
              <p className="mt-3 w-full text-start text-[12px] font-bold leading-7 text-slate-400">
                {t("nutritionBmi.description")}
              </p>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label={t("nutritionBmi.weight")}
              unit={t("nutritionBmi.kilogram")}
              value={weightKg}
              iconClassName="text-[#ffac2c]"
              onChange={(value) => {
                setWeightKg(normalizeNumber(value));
                setHasCalculated(false);
              }}
              onMinus={() => {
                setWeightKg((value) => adjustValue(value, -1, profileDefaults.weightKg, 20, 250));
                setHasCalculated(false);
              }}
              onPlus={() => {
                setWeightKg((value) => adjustValue(value, 1, profileDefaults.weightKg, 20, 250));
                setHasCalculated(false);
              }}
              increaseLabel={t("nutritionBmi.increase", { label: t("nutritionBmi.weight") })}
              decreaseLabel={t("nutritionBmi.decrease", { label: t("nutritionBmi.weight") })}
            />
            <MetricCard
              label={t("nutritionBmi.height")}
              unit={t("nutritionBmi.centimeter")}
              value={heightCm}
              iconClassName="text-[#49dfbf]"
              onChange={(value) => {
                setHeightCm(normalizeNumber(value));
                setHasCalculated(false);
              }}
              onMinus={() => {
                setHeightCm((value) => adjustValue(value, -1, profileDefaults.heightCm, 100, 230));
                setHasCalculated(false);
              }}
              onPlus={() => {
                setHeightCm((value) => adjustValue(value, 1, profileDefaults.heightCm, 100, 230));
                setHasCalculated(false);
              }}
              increaseLabel={t("nutritionBmi.increase", { label: t("nutritionBmi.height") })}
              decreaseLabel={t("nutritionBmi.decrease", { label: t("nutritionBmi.height") })}
            />
          </div>

          <section className="rounded-[22px] border border-white/10 bg-[#12171f] p-4">
            <div className="flex w-full items-center justify-start gap-2.5 text-start text-[14px] font-black text-slate-300">
              <UserRound className="h-6 w-6 text-[#55dfc5]" />
              {t("nutritionBmi.gender")}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { value: "female", label: t("nutritionBmi.gender.female") },
                { value: "male", label: t("nutritionBmi.gender.male") },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setGender(item.value as BmiGender);
                    setHasCalculated(false);
                  }}
                  className={`h-[46px] rounded-[14px] border text-[14px] font-black transition ${
                    gender === item.value
                      ? "border-[#33d6a0] bg-[#173c35] text-[#94f2d8]"
                      : "border-white/10 bg-[#171c24] text-slate-400"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-[#10151d] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[17px] border border-white/10 bg-[#171c24] text-slate-300">
                <Gauge className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1 text-center">
                <div className="text-[14px] font-black text-slate-500">{t("nutritionBmi.analysisTitle")}</div>
                <div className={`mt-3 text-[34px] font-black leading-none ${bmiMeta?.resultClassName ?? "text-slate-600"}`}>
                  {bmi ? format.number(bmi, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"}
                </div>
              </div>
            </div>

            <div className="mt-6 h-2.5 rounded-full bg-[linear-gradient(90deg,#2ed19a_0%,#83df5a_35%,#f3d94d_52%,#ffb03b_70%,#f54e3f_100%)]">
              {bmiMeta ? (
                <div
                  className="relative top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#080c13] shadow-[0_10px_24px_-10px_rgba(255,255,255,0.9)]"
                  style={{ marginInlineStart: `calc(${bmiMeta.progress}% - 12px)` }}
                />
              ) : null}
            </div>

            <div className="mt-6 flex justify-start gap-2.5">
              <span className={`min-w-[78px] rounded-full border px-4 py-2 text-center text-[12px] font-black ${bmiMeta?.chipClassName ?? "border-white/10 bg-[#171c24] text-slate-500"}`}>
                {resultLabel}
              </span>
              <span className="min-w-[78px] rounded-full border border-white/10 bg-[#171c24] px-4 py-2 text-center text-[12px] font-black text-slate-500">
                {gender === "female" ? t("nutritionBmi.genderForFemale") : gender === "male" ? t("nutritionBmi.genderForMale") : t("nutritionBmi.gender")}
              </span>
            </div>

            <p className="mt-6 text-center text-[12px] font-bold leading-7 text-slate-400">
              {resultDescription}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <InfoBox
                label={t("nutritionBmi.normalWeightRange")}
                value={
                  healthyMinWeight && healthyMaxWeight
                    ? t("nutritionBmi.normalWeightValue", {
                      minimum: format.number(healthyMinWeight, { maximumFractionDigits: 1 }),
                      maximum: format.number(healthyMaxWeight, { maximumFractionDigits: 1 }),
                    })
                    : "—"
                }
              />
              <InfoBox label={t("nutritionBmi.quickAnalysis")} value={bmiMeta ? resultLabel : "—"} valueClassName={bmiMeta?.resultClassName} />
            </div>

            <div className="mt-5 rounded-[18px] border border-emerald-400/15 bg-emerald-300/10 p-4">
              <div className="flex items-center justify-start gap-2.5 text-[15px] font-black text-[#69e1c8]">
                {t("nutritionBmi.quickSuggestion")}
                <Zap className="h-6 w-6" />
              </div>
              <p className="mt-3 text-center text-[12px] font-bold leading-7 text-slate-400">{targetHint}</p>
            </div>
          </section>
        </main>

        <div className="fixed inset-x-0 bottom-0 z-20 bg-[linear-gradient(180deg,rgba(8,12,19,0),#080c13_30%)] px-5 pb-5 pt-9">
          <div className="mx-auto grid max-w-[360px] grid-cols-[minmax(0,1fr)_88px] gap-3">
            <button
              type="button"
              onClick={() => setHasCalculated(true)}
              disabled={!canCalculate}
              className="flex h-[50px] items-center justify-center gap-2.5 rounded-[16px] bg-[linear-gradient(135deg,#35d39b,#24b888)] text-[15px] font-black text-[#061313] shadow-[0_18px_60px_-36px_rgba(43,210,157,0.9)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t("nutritionBmi.calculate")}
              <Calculator className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={clearForm}
              className="h-[50px] rounded-[16px] border border-white/10 bg-[#12171f] text-[14px] font-black text-slate-200"
            >
              {t("nutritionBmi.clear")}
            </button>
          </div>
          <div className="mx-auto mt-3 flex max-w-[360px] items-center justify-center gap-2 text-[11px] font-black text-slate-500">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#44dcb8] text-[#44dcb8]">✓</span>
            {t("nutritionBmi.alwaysFree")}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  unit,
  value,
  iconClassName,
  onChange,
  onMinus,
  onPlus,
  increaseLabel,
  decreaseLabel,
}: {
  label: string;
  unit: string;
  value: string;
  iconClassName: string;
  onChange: (value: string) => void;
  onMinus: () => void;
  onPlus: () => void;
  increaseLabel: string;
  decreaseLabel: string;
}) {
  return (
    <section className="h-[126px] rounded-[18px] border border-white/10 bg-[#12171f] px-4 py-3.5">
      <div className="flex items-center justify-start gap-2 text-[14px] font-black text-slate-300">
        {label}
        <Ruler className={`h-5 w-5 ${iconClassName}`} />
      </div>
      <div className="mt-5 grid grid-cols-[32px_minmax(0,1fr)_32px] items-center gap-2.5" dir="ltr">
        <button
          type="button"
          onClick={onPlus}
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/10 bg-[#1b2029] text-slate-200"
          aria-label={increaseLabel}
        >
          <Plus className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-col items-center justify-center text-center">
          <input
            inputMode="decimal"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="-"
            className="h-8 w-full border-0 bg-transparent p-0 text-center text-[24px] font-black leading-none text-white outline-none placeholder:text-slate-600"
          />
          <div className="mt-1 w-full truncate text-center text-[10px] font-bold leading-4 text-slate-500">{unit}</div>
        </div>
        <button
          type="button"
          onClick={onMinus}
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/10 bg-[#1b2029] text-slate-200"
          aria-label={decreaseLabel}
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function InfoBox({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="min-h-[78px] rounded-[16px] border border-white/10 bg-[#171c24] p-3.5 text-center">
      <div className="text-[12px] font-black text-slate-500">{label}</div>
      <div className={`mt-3 text-[14px] font-black leading-6 ${valueClassName ?? "text-white"}`}>{value}</div>
    </div>
  );
}
