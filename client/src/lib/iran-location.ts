import { ostan, shahr } from "iran-cities-json";

type RawProvince = {
  id: number;
  name: string;
};

type RawCity = {
  id: number;
  name: string;
  ostan: number;
};

export type IranProvince = {
  id: number;
  name: string;
};

export type IranCity = {
  id: number;
  name: string;
  provinceId: number;
};

export const IRAN_PROVINCES: IranProvince[] = (ostan as RawProvince[])
  .map((item) => ({ id: Number(item.id), name: item.name }))
  .sort((a, b) => a.name.localeCompare(b.name, "fa"));

export const IRAN_CITIES: IranCity[] = (shahr as RawCity[])
  .map((item) => ({ id: Number(item.id), name: item.name, provinceId: Number(item.ostan) }))
  .sort((a, b) => a.name.localeCompare(b.name, "fa"));

export const getCitiesByProvince = (provinceId?: number | null) =>
  IRAN_CITIES.filter((item) => item.provinceId === provinceId);

export const getProvinceName = (provinceId?: number | null) =>
  IRAN_PROVINCES.find((item) => item.id === provinceId)?.name || "";

export const getCityName = (cityId?: number | null) =>
  IRAN_CITIES.find((item) => item.id === cityId)?.name || "";

function normalizeLocationText(value: string) {
  return value
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const geocodeCache = new Map<string, { lat: number; lng: number }>();

async function requestGeocode(query: string) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`geocode_failed:${response.status}`);
  }

  const payload = (await response.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: { countrycode?: string; state?: string };
    }>;
  };

  const feature = payload.features?.find((item) => item.properties?.countrycode?.toUpperCase() === "IR");
  const coordinates = feature?.geometry?.coordinates;
  const lng = coordinates?.[0];
  const lat = coordinates?.[1];

  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("geocode_not_found");
  }

  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

export async function geocodeIranCity(cityName: string, provinceName: string) {
  const normalizedCity = normalizeLocationText(cityName);
  const normalizedProvince = normalizeLocationText(provinceName);
  const cacheKey = `${normalizedProvince}:${normalizedCity}`;

  const cached = geocodeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const queries = [
    `${normalizedCity}، ${normalizedProvince}، ایران`,
    `${normalizedCity} ${normalizedProvince} ایران`,
    `${normalizedCity}, ${normalizedProvince}, Iran`,
  ];

  let lastError: unknown = null;

  for (const query of queries) {
    try {
      const point = await requestGeocode(query);
      geocodeCache.set(cacheKey, point);
      return point;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("geocode_not_found");
}
