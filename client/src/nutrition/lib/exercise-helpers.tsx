import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bike,
  BrainCircuit,
  CircleDot,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Gauge,
  Home,
  Mountain,
  Orbit,
  PersonStanding,
  RefreshCcw,
  Shield,
  Sparkles,
  Trees,
  Volleyball,
  Waves,
} from "lucide-react";
import type { NutritionExerciseItem } from "@/lib/types";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { translate, type MessageKey } from "@/i18n/messages";
import { DEFAULT_LOCALE, normalizeLocale } from "@/i18n/registry";

export const EXERCISE_ICON_OPTIONS = [
  "Activity",
  "Flame",
  "Footprints",
  "Dumbbell",
  "Volleyball",
  "Waves",
  "Shield",
  "Bike",
  "Sparkles",
  "Mountain",
  "Activity",
  "PersonStanding",
  "Home",
  "RefreshCcw",
  "Trees",
  "Gauge",
  "Droplets",
  "CircleDot",
  "BrainCircuit",
  "Orbit",
] as const;

const ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  Flame,
  Footprints,
  Dumbbell,
  Volleyball,
  Waves,
  Shield,
  Bike,
  Mountain,
  PersonStanding,
  Home,
  RefreshCcw,
  Trees,
  Gauge,
  Droplets,
  CircleDot,
  BrainCircuit,
  Orbit,
  Focus: Sparkles,
  AudioLines: Activity,
  Badge: CircleDot,
  BadgeAlert: Shield,
  Fish: Waves,
  FlameKindling: Flame,
  GaugeCircle: Gauge,
  HandMetal: Shield,
  MountainSnow: Mountain,
  Racket: CircleDot,
  ShieldEllipsis: Shield,
  ShipWheel: Activity,
  StepForward: PersonStanding,
  TimerReset: Activity,
  Worm: Sparkles,
  Flower2: Sparkles,
  Music4: Activity,
  Anvil: Dumbbell,
  Cable: Dumbbell,
  Disc3: Activity,
  Swords: Shield,
  Goal: Activity,
};

export function getNutritionExerciseIcon(iconKey?: string | null): LucideIcon {
  return ICON_MAP[String(iconKey ?? "").trim()] ?? Activity;
}

export function estimateExerciseCalories(
  exercise: NutritionExerciseItem | null | undefined,
  payload: {
    weightKg: number;
    durationMinutes: number;
    intensity?: "light" | "moderate" | "vigorous" | string;
    distanceKm?: number | null;
    speedKmh?: number | null;
  },
): number {
  if (!exercise || payload.weightKg <= 0 || payload.durationMinutes <= 0) {
    return 0;
  }

  const resolvedSpeed = (payload.speedKmh && payload.speedKmh > 0)
    ? payload.speedKmh
    : (payload.distanceKm && payload.distanceKm > 0 && payload.durationMinutes > 0)
      ? (payload.distanceKm / payload.durationMinutes) * 60
      : 0;

  const slug = (exercise.slug || "").toLowerCase();
  let met = 0;

  if (resolvedSpeed > 0) {
    if (slug.includes("running") || slug.includes("jogging")) {
      met = resolvedSpeed < 6 ? 4.5 : resolvedSpeed < 8 ? 7 : resolvedSpeed < 9.5 ? 8.3 : resolvedSpeed < 10.8 ? 9.8 : resolvedSpeed < 12.2 ? 11 : resolvedSpeed < 14 ? 11.8 : 12.8;
    } else if (slug.includes("cycling") || slug.includes("biking") || slug.includes("spinning")) {
      met = resolvedSpeed < 16 ? 4 : resolvedSpeed < 19 ? 6.8 : resolvedSpeed < 22 ? 8 : resolvedSpeed < 25 ? 10 : resolvedSpeed < 30 ? 12 : 15.8;
    } else if (slug.includes("walking") || slug.includes("hiking")) {
      met = resolvedSpeed < 3.5 ? 2.5 : resolvedSpeed < 5 ? 3.5 : resolvedSpeed < 6.5 ? 4.3 : 6;
    }
  }

  if (met <= 0) {
    const intensity = (payload.intensity ?? exercise.defaultIntensity ?? "moderate").toLowerCase();
    met = intensity === "light"
      ? Number(exercise.metLight ?? 0)
      : intensity === "vigorous"
        ? Number(exercise.metVigorous ?? 0)
        : Number(exercise.metModerate ?? 0);
  }

  if (met <= 0) {
    met = Number(exercise.metModerate ?? exercise.metLight ?? exercise.metVigorous ?? 4);
  }

  return Math.max(1, Math.round(met * payload.weightKg * (payload.durationMinutes / 60)));
}

function translateExerciseHelper(key: MessageKey) {
  const locale = normalizeLocale(getInitialTenantMeta()?.locale) ?? DEFAULT_LOCALE;
  return translate(locale, key);
}

export function exerciseIntensityLabel(value?: string | null) {
  switch (String(value ?? "").toLowerCase()) {
    case "light":
      return translateExerciseHelper("nutritionExerciseLogger.intensity.light");
    case "vigorous":
      return translateExerciseHelper("nutritionExerciseLogger.intensity.vigorous");
    default:
      return translateExerciseHelper("nutritionExerciseLogger.intensity.moderate");
  }
}
