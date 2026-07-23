import type { MessageKey } from "@/i18n/messages";

export type AppointmentAlertSoundKey =
  | "silent"
  | "classic"
  | "bright"
  | "soft"
  | "glass"
  | "alert"
  | "warm";

export const DEFAULT_APPOINTMENT_ALERT_SOUND: AppointmentAlertSoundKey = "classic";

export const APPOINTMENT_ALERT_SOUNDS: Array<{
  key: AppointmentAlertSoundKey;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  file?: string;
}> = [
  {
    key: "silent",
    labelKey: "settings.appointmentAlert.sound.silent.label",
    descriptionKey: "settings.appointmentAlert.sound.silent.description",
  },
  {
    key: "classic",
    labelKey: "settings.appointmentAlert.sound.classic.label",
    descriptionKey: "settings.appointmentAlert.sound.classic.description",
    file: "/booking-app/sounds/appointment-chime-classic.ogg",
  },
  {
    key: "bright",
    labelKey: "settings.appointmentAlert.sound.bright.label",
    descriptionKey: "settings.appointmentAlert.sound.bright.description",
    file: "/booking-app/sounds/appointment-chime-bright.ogg",
  },
  {
    key: "soft",
    labelKey: "settings.appointmentAlert.sound.soft.label",
    descriptionKey: "settings.appointmentAlert.sound.soft.description",
    file: "/booking-app/sounds/appointment-chime-soft.ogg",
  },
  {
    key: "glass",
    labelKey: "settings.appointmentAlert.sound.glass.label",
    descriptionKey: "settings.appointmentAlert.sound.glass.description",
    file: "/booking-app/sounds/appointment-chime-glass.ogg",
  },
  {
    key: "alert",
    labelKey: "settings.appointmentAlert.sound.alert.label",
    descriptionKey: "settings.appointmentAlert.sound.alert.description",
    file: "/booking-app/sounds/appointment-chime-alert.ogg",
  },
  {
    key: "warm",
    labelKey: "settings.appointmentAlert.sound.warm.label",
    descriptionKey: "settings.appointmentAlert.sound.warm.description",
    file: "/booking-app/sounds/appointment-chime-warm.ogg",
  },
];

export const getAppointmentAlertSound = (key?: string | null) =>
  APPOINTMENT_ALERT_SOUNDS.find((item) => item.key === key) ??
  APPOINTMENT_ALERT_SOUNDS.find((item) => item.key === DEFAULT_APPOINTMENT_ALERT_SOUND)!;
