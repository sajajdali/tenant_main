import type { AppearanceSettings } from "./types";
import { translate } from "@/i18n/messages";
import { DEFAULT_LOCALE, normalizeLocale } from "@/i18n/registry";

export const APPEARANCE_CACHE_KEY = "barberbook.appearance";

const PRIMARY_THEME_MAP: Record<AppearanceSettings["primaryTheme"], { primary: string; foreground: string }> = {
  amber: { primary: "35 92% 50%", foreground: "222 47% 11%" },
  rose: { primary: "347 77% 60%", foreground: "210 40% 98%" },
  emerald: { primary: "160 84% 39%", foreground: "210 40% 98%" },
  sky: { primary: "199 89% 48%", foreground: "210 40% 98%" },
  violet: { primary: "262 83% 58%", foreground: "210 40% 98%" },
  copper: { primary: "24 75% 48%", foreground: "210 40% 98%" },
  teal: { primary: "174 84% 37%", foreground: "210 40% 98%" },
  indigo: { primary: "239 84% 67%", foreground: "210 40% 98%" },
  pink: { primary: "330 81% 60%", foreground: "210 40% 98%" },
  lime: { primary: "84 81% 44%", foreground: "222 47% 11%" },
  ruby: { primary: "0 72% 52%", foreground: "210 40% 98%" },
  cyan: { primary: "188 94% 43%", foreground: "222 47% 11%" },
  orange: { primary: "24 95% 53%", foreground: "222 47% 11%" },
  blue: { primary: "221 83% 53%", foreground: "210 40% 98%" },
};

const CARD_THEME_MAP: Record<AppearanceSettings["themeMode"], Record<AppearanceSettings["cardTheme"], { card: string; popover: string; secondary: string; muted: string; border: string; input: string }>> = {
  dark: {
    slate: { card: "222 47% 14%", popover: "222 47% 14%", secondary: "217 33% 17%", muted: "217 33% 17%", border: "217 33% 20%", input: "217 33% 20%" },
    navy: { card: "223 45% 16%", popover: "223 45% 16%", secondary: "223 36% 19%", muted: "223 36% 19%", border: "223 28% 24%", input: "223 28% 24%" },
    graphite: { card: "215 19% 17%", popover: "215 19% 17%", secondary: "215 16% 20%", muted: "215 16% 20%", border: "215 14% 26%", input: "215 14% 26%" },
    plum: { card: "270 24% 16%", popover: "270 24% 16%", secondary: "270 18% 20%", muted: "270 18% 20%", border: "270 16% 26%", input: "270 16% 26%" },
    forest: { card: "162 35% 14%", popover: "162 35% 14%", secondary: "162 26% 18%", muted: "162 26% 18%", border: "162 20% 24%", input: "162 20% 24%" },
    midnight: { card: "224 39% 10%", popover: "224 39% 10%", secondary: "224 31% 15%", muted: "224 31% 15%", border: "224 24% 21%", input: "224 24% 21%" },
    charcoal: { card: "210 12% 15%", popover: "210 12% 15%", secondary: "210 10% 19%", muted: "210 10% 19%", border: "210 8% 25%", input: "210 8% 25%" },
    ocean: { card: "201 54% 14%", popover: "201 54% 14%", secondary: "201 44% 18%", muted: "201 44% 18%", border: "201 30% 24%", input: "201 30% 24%" },
    sand: { card: "30 26% 16%", popover: "30 26% 16%", secondary: "30 18% 20%", muted: "30 18% 20%", border: "30 16% 26%", input: "30 16% 26%" },
    mocha: { card: "18 24% 16%", popover: "18 24% 16%", secondary: "18 18% 20%", muted: "18 18% 20%", border: "18 14% 26%", input: "18 14% 26%" },
    steel: { card: "215 22% 16%", popover: "215 22% 16%", secondary: "215 18% 20%", muted: "215 18% 20%", border: "215 14% 26%", input: "215 14% 26%" },
    wine: { card: "344 28% 16%", popover: "344 28% 16%", secondary: "344 20% 20%", muted: "344 20% 20%", border: "344 16% 26%", input: "344 16% 26%" },
  },
  light: {
    slate: { card: "210 40% 99%", popover: "210 40% 99%", secondary: "210 30% 96%", muted: "210 30% 96%", border: "215 25% 87%", input: "215 25% 87%" },
    navy: { card: "213 48% 97%", popover: "213 48% 97%", secondary: "213 34% 94%", muted: "213 34% 94%", border: "214 30% 86%", input: "214 30% 86%" },
    graphite: { card: "210 18% 97%", popover: "210 18% 97%", secondary: "210 16% 94%", muted: "210 16% 94%", border: "210 14% 85%", input: "210 14% 85%" },
    plum: { card: "286 38% 97%", popover: "286 38% 97%", secondary: "286 27% 94%", muted: "286 27% 94%", border: "286 18% 86%", input: "286 18% 86%" },
    forest: { card: "156 36% 97%", popover: "156 36% 97%", secondary: "156 24% 94%", muted: "156 24% 94%", border: "156 16% 84%", input: "156 16% 84%" },
    midnight: { card: "223 44% 96%", popover: "223 44% 96%", secondary: "223 28% 93%", muted: "223 28% 93%", border: "223 20% 84%", input: "223 20% 84%" },
    charcoal: { card: "210 12% 97%", popover: "210 12% 97%", secondary: "210 10% 94%", muted: "210 10% 94%", border: "210 8% 85%", input: "210 8% 85%" },
    ocean: { card: "196 55% 96%", popover: "196 55% 96%", secondary: "196 40% 93%", muted: "196 40% 93%", border: "196 28% 84%", input: "196 28% 84%" },
    sand: { card: "36 60% 97%", popover: "36 60% 97%", secondary: "36 42% 93%", muted: "36 42% 93%", border: "36 28% 84%", input: "36 28% 84%" },
    mocha: { card: "24 38% 97%", popover: "24 38% 97%", secondary: "24 28% 93%", muted: "24 28% 93%", border: "24 18% 84%", input: "24 18% 84%" },
    steel: { card: "216 30% 97%", popover: "216 30% 97%", secondary: "216 24% 93%", muted: "216 24% 93%", border: "216 18% 84%", input: "216 18% 84%" },
    wine: { card: "344 42% 97%", popover: "344 42% 97%", secondary: "344 30% 93%", muted: "344 30% 93%", border: "344 18% 84%", input: "344 18% 84%" },
  },
};

const BACKGROUND_THEME_MAP: Record<AppearanceSettings["themeMode"], Record<AppearanceSettings["backgroundTheme"], { background: string; sidebar: string; scrollbarTrack: string; scrollbarTrackBorder: string }>> = {
  dark: {
    slate: { background: "222 47% 11%", sidebar: "222 47% 11%", scrollbarTrack: "rgba(17, 24, 39, 0.92)", scrollbarTrackBorder: "rgba(51, 65, 85, 0.8)" },
    midnight: { background: "224 39% 9%", sidebar: "224 39% 9%", scrollbarTrack: "rgba(11, 18, 33, 0.92)", scrollbarTrackBorder: "rgba(55, 65, 81, 0.8)" },
    ocean: { background: "203 57% 12%", sidebar: "203 57% 12%", scrollbarTrack: "rgba(10, 30, 39, 0.92)", scrollbarTrackBorder: "rgba(46, 93, 112, 0.72)" },
    forest: { background: "161 44% 11%", sidebar: "161 44% 11%", scrollbarTrack: "rgba(10, 34, 27, 0.92)", scrollbarTrackBorder: "rgba(52, 93, 79, 0.7)" },
    plum: { background: "268 31% 12%", sidebar: "268 31% 12%", scrollbarTrack: "rgba(28, 18, 39, 0.92)", scrollbarTrackBorder: "rgba(83, 64, 104, 0.78)" },
    charcoal: { background: "214 14% 10%", sidebar: "214 14% 10%", scrollbarTrack: "rgba(20, 24, 29, 0.92)", scrollbarTrackBorder: "rgba(74, 85, 104, 0.74)" },
    dusk: { background: "233 32% 12%", sidebar: "233 32% 12%", scrollbarTrack: "rgba(20, 24, 46, 0.92)", scrollbarTrackBorder: "rgba(88, 99, 145, 0.72)" },
    espresso: { background: "22 28% 11%", sidebar: "22 28% 11%", scrollbarTrack: "rgba(35, 22, 17, 0.92)", scrollbarTrackBorder: "rgba(110, 84, 71, 0.74)" },
    aurora: { background: "188 40% 11%", sidebar: "188 40% 11%", scrollbarTrack: "rgba(12, 37, 40, 0.92)", scrollbarTrackBorder: "rgba(68, 126, 126, 0.72)" },
    stone: { background: "210 10% 12%", sidebar: "210 10% 12%", scrollbarTrack: "rgba(28, 31, 35, 0.92)", scrollbarTrackBorder: "rgba(99, 107, 116, 0.72)" },
  },
  light: {
    slate: { background: "210 40% 98%", sidebar: "210 40% 99%", scrollbarTrack: "rgba(226, 232, 240, 0.95)", scrollbarTrackBorder: "rgba(203, 213, 225, 0.9)" },
    midnight: { background: "220 33% 97%", sidebar: "220 33% 98%", scrollbarTrack: "rgba(226, 232, 240, 0.95)", scrollbarTrackBorder: "rgba(191, 200, 214, 0.9)" },
    ocean: { background: "196 55% 97%", sidebar: "196 55% 98%", scrollbarTrack: "rgba(214, 234, 240, 0.95)", scrollbarTrackBorder: "rgba(176, 209, 219, 0.88)" },
    forest: { background: "156 34% 97%", sidebar: "156 34% 98%", scrollbarTrack: "rgba(220, 236, 229, 0.95)", scrollbarTrackBorder: "rgba(180, 208, 196, 0.88)" },
    plum: { background: "286 37% 97%", sidebar: "286 37% 98%", scrollbarTrack: "rgba(235, 228, 242, 0.95)", scrollbarTrackBorder: "rgba(206, 192, 224, 0.88)" },
    charcoal: { background: "210 12% 96%", sidebar: "210 12% 97%", scrollbarTrack: "rgba(229, 231, 235, 0.95)", scrollbarTrackBorder: "rgba(209, 213, 219, 0.9)" },
    dusk: { background: "232 45% 97%", sidebar: "232 45% 98%", scrollbarTrack: "rgba(228, 232, 248, 0.95)", scrollbarTrackBorder: "rgba(196, 203, 234, 0.88)" },
    espresso: { background: "28 45% 96%", sidebar: "28 45% 97%", scrollbarTrack: "rgba(238, 228, 220, 0.95)", scrollbarTrackBorder: "rgba(214, 194, 182, 0.88)" },
    aurora: { background: "186 42% 96%", sidebar: "186 42% 97%", scrollbarTrack: "rgba(221, 239, 240, 0.95)", scrollbarTrackBorder: "rgba(186, 220, 220, 0.88)" },
    stone: { background: "210 14% 95%", sidebar: "210 14% 96%", scrollbarTrack: "rgba(228, 231, 235, 0.95)", scrollbarTrackBorder: "rgba(199, 206, 214, 0.88)" },
  },
};

const DEFAULTS = {
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  themeColor: "#0f172a",
};

function getDefaultTitle() {
  const locale =
    normalizeLocale(document.documentElement.lang) ||
    normalizeLocale(window.localStorage.getItem("barberbook.locale")) ||
    DEFAULT_LOCALE;

  return translate(locale, "appearance.defaultTitle");
}

export function readCachedAppearance(): AppearanceSettings | null {
  try {
    const raw = window.localStorage.getItem(APPEARANCE_CACHE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as AppearanceSettings;
  } catch {
    return null;
  }
}

function setBookingTemplateDataset(template: AppearanceSettings["bookingTemplate"] | "default") {
  const root = document.documentElement;
  root.dataset.bookingTemplate = template;

  if (!document.body) {
    return;
  }

  if (template === "default") {
    delete document.body.dataset.bookingTemplate;
  } else {
    document.body.dataset.bookingTemplate = template;
  }
}

export function applyAppearance(settings: AppearanceSettings | null) {
  const root = document.documentElement;
  const themeMode: AppearanceSettings["themeMode"] = "dark";
  const primaryTheme = PRIMARY_THEME_MAP[settings?.primaryTheme ?? "amber"];
  const accentTheme = PRIMARY_THEME_MAP[settings?.accentTheme ?? "amber"];
  const backgroundTheme = BACKGROUND_THEME_MAP[themeMode][settings?.backgroundTheme ?? "slate"];
  const cardTheme = CARD_THEME_MAP[themeMode][settings?.cardTheme ?? "navy"];

  root.dataset.theme = themeMode;
  setBookingTemplateDataset(settings?.bookingTemplate ?? "default");
  root.classList.add("dark");
  root.classList.remove("light");
  root.style.colorScheme = themeMode;

  const customThemeEnabled = false;

  if (customThemeEnabled) {
    root.style.setProperty("--background", backgroundTheme.background);
    root.style.setProperty("--primary", primaryTheme.primary);
    root.style.setProperty("--primary-foreground", primaryTheme.foreground);
    root.style.setProperty("--accent", accentTheme.primary);
    root.style.setProperty("--accent-foreground", accentTheme.foreground);
    root.style.setProperty("--ring", primaryTheme.primary);
    root.style.setProperty("--card", cardTheme.card);
    root.style.setProperty("--popover", cardTheme.popover);
    root.style.setProperty("--secondary", cardTheme.secondary);
    root.style.setProperty("--muted", cardTheme.muted);
    root.style.setProperty("--border", cardTheme.border);
    root.style.setProperty("--input", cardTheme.input);
    root.style.setProperty("--sidebar-primary", primaryTheme.primary);
    root.style.setProperty("--sidebar-primary-foreground", primaryTheme.foreground);
    root.style.setProperty("--sidebar", backgroundTheme.sidebar);
    root.style.setProperty("--sidebar-accent", cardTheme.secondary);
    root.style.setProperty("--sidebar-border", cardTheme.border);
    root.style.setProperty("--scrollbar-track", backgroundTheme.scrollbarTrack);
    root.style.setProperty("--scrollbar-track-border", backgroundTheme.scrollbarTrackBorder);
  } else {
    root.style.removeProperty("--background");
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-foreground");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--card");
    root.style.removeProperty("--popover");
    root.style.removeProperty("--secondary");
    root.style.removeProperty("--muted");
    root.style.removeProperty("--border");
    root.style.removeProperty("--input");
    root.style.removeProperty("--sidebar-primary");
    root.style.removeProperty("--sidebar-primary-foreground");
    root.style.removeProperty("--sidebar");
    root.style.removeProperty("--sidebar-accent");
    root.style.removeProperty("--sidebar-border");
    root.style.removeProperty("--scrollbar-track");
    root.style.removeProperty("--scrollbar-track-border");
  }

  const title = settings?.storeName?.trim() || getDefaultTitle();
  document.title = title;

  const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) {
    appleTitle.content = title;
  }

  const themeColor = customThemeEnabled ? hslToHex(backgroundTheme.background) : DEFAULTS.themeColor;
  const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.content = themeColor;
  }

  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) {
    favicon.href = settings?.faviconUrl || "/booking-app/favicon.png";
  }

  try {
    if (settings) {
      window.localStorage.setItem(APPEARANCE_CACHE_KEY, JSON.stringify(settings));
    } else {
      window.localStorage.removeItem(APPEARANCE_CACHE_KEY);
    }
  } catch {
    // Ignore storage failures and keep runtime theme application intact.
  }
}

function hslToHex(hsl: string) {
  const [h, s, l] = hsl.split(" ").map(Number);
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
