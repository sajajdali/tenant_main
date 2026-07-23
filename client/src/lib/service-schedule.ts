import type { Section } from "@/lib/types";

export type EffectiveSectionSchedule = {
  startHour: string;
  endHour: string;
  slotDurationMinutes: number;
  hasOverride: boolean;
};

export function getEffectiveSectionSchedule(section: Section, date?: string): EffectiveSectionSchedule {
  const base = {
    startHour: section.startHour,
    endHour: section.endHour,
    slotDurationMinutes: Math.max(5, section.slotDurationMinutes || 30),
    hasOverride: false,
  };

  if (!date) {
    return base;
  }

  const override = getMatchingScheduleOverride(section, date);

  if (!override) {
    return base;
  }

  return {
    startHour: override.startHour || base.startHour,
    endHour: override.endHour || base.endHour,
    slotDurationMinutes: Math.max(5, override.slotDurationMinutes || base.slotDurationMinutes),
    hasOverride: true,
  };
}

export function hasSectionScheduleOverrideForDate(section: Section, date: string) {
  return !!getMatchingScheduleOverride(section, date);
}

function getMatchingScheduleOverride(section: Section, date: string) {
  const overrides = section.scheduleOverrides || [];
  const weekday = new Date(`${date}T12:00:00`).getDay();

  const dateOverride = overrides.find((item) => item.scope === "dates" && (item.dates || []).includes(date));

  if (dateOverride) {
    return dateOverride;
  }

  return overrides.find((item) => item.scope === "weekdays" && (item.weekdays || []).map(Number).includes(weekday));
}
