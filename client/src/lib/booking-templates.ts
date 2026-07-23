import type { BookingTemplate } from "./types";
import type { MessageKey } from "@/i18n/messages";

export type BookingTemplateOption = {
  id: BookingTemplate;
  nameKey: MessageKey;
  descriptionKey: MessageKey;
  accent: string;
};

export const BOOKING_TEMPLATES: BookingTemplateOption[] = [
  {
    id: "default",
    nameKey: "bookingTemplates.default.name",
    descriptionKey: "bookingTemplates.default.description",
    accent: "#172033",
  },
  {
    id: "pink",
    nameKey: "bookingTemplates.pink.name",
    descriptionKey: "bookingTemplates.pink.description",
    accent: "#dc7b9f",
  },
  {
    id: "blue",
    nameKey: "bookingTemplates.blue.name",
    descriptionKey: "bookingTemplates.blue.description",
    accent: "#3498d4",
  },
  {
    id: "green",
    nameKey: "bookingTemplates.green.name",
    descriptionKey: "bookingTemplates.green.description",
    accent: "#40bd8a",
  },
  {
    id: "red",
    nameKey: "bookingTemplates.red.name",
    descriptionKey: "bookingTemplates.red.description",
    accent: "#df4054",
  },
  {
    id: "purple",
    nameKey: "bookingTemplates.purple.name",
    descriptionKey: "bookingTemplates.purple.description",
    accent: "#5964d8",
  },
  {
    id: "yellow",
    nameKey: "bookingTemplates.yellow.name",
    descriptionKey: "bookingTemplates.yellow.description",
    accent: "#e9891c",
  },
  {
    id: "olive",
    nameKey: "bookingTemplates.olive.name",
    descriptionKey: "bookingTemplates.olive.description",
    accent: "#8d9f37",
  },
];

export const isBookingTemplate = (value: unknown): value is BookingTemplate =>
  BOOKING_TEMPLATES.some((template) => template.id === value);
