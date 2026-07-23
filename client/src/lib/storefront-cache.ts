import type { StoreCategoryItem, StoreProductItem, TenantMeta } from "./types";

const STOREFRONT_CACHE_VERSION = 1;
const STOREFRONT_CACHE_TTL_MS = 15 * 60 * 1000;
const STOREFRONT_CACHE_CLEARED_EVENT = "storefront:cache-cleared";

type StorefrontCacheSnapshot = {
  version: number;
  updatedAt: number;
  products: StoreProductItem[];
  categories: StoreCategoryItem[];
};

const isBrowser = () => typeof window !== "undefined";

const getStorefrontCacheScope = (tenantMeta?: TenantMeta | null) =>
  tenantMeta?.tenant_id || (isBrowser() ? window.location.host : "storefront");

const getStorefrontCacheKey = (tenantMeta?: TenantMeta | null) =>
  `storefront-cache:${getStorefrontCacheScope(tenantMeta)}:v${STOREFRONT_CACHE_VERSION}`;

export const getStorefrontCacheTtlMs = () => STOREFRONT_CACHE_TTL_MS;

export function readStorefrontCache(tenantMeta?: TenantMeta | null): StorefrontCacheSnapshot | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(getStorefrontCacheKey(tenantMeta));
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<StorefrontCacheSnapshot>;
    if (
      parsed.version !== STOREFRONT_CACHE_VERSION ||
      !Array.isArray(parsed.products) ||
      !Array.isArray(parsed.categories) ||
      typeof parsed.updatedAt !== "number"
    ) {
      return null;
    }

    return {
      version: STOREFRONT_CACHE_VERSION,
      updatedAt: parsed.updatedAt,
      products: parsed.products,
      categories: parsed.categories,
    };
  } catch {
    return null;
  }
}

export function writeStorefrontCache(
  tenantMeta: TenantMeta | null | undefined,
  payload: { products: StoreProductItem[]; categories: StoreCategoryItem[] },
) {
  if (!isBrowser()) {
    return;
  }

  try {
    const snapshot: StorefrontCacheSnapshot = {
      version: STOREFRONT_CACHE_VERSION,
      updatedAt: Date.now(),
      products: payload.products,
      categories: payload.categories,
    };
    window.localStorage.setItem(getStorefrontCacheKey(tenantMeta), JSON.stringify(snapshot));
  } catch {
    // Ignore localStorage quota and serialization errors.
  }
}

export function clearStorefrontCache(tenantMeta?: TenantMeta | null) {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(getStorefrontCacheKey(tenantMeta));
    window.dispatchEvent(new CustomEvent(STOREFRONT_CACHE_CLEARED_EVENT));
  } catch {
    // Ignore localStorage and event errors.
  }
}

export function isStorefrontCacheFresh(snapshot: StorefrontCacheSnapshot | null) {
  if (!snapshot) {
    return false;
  }

  return Date.now() - snapshot.updatedAt < STOREFRONT_CACHE_TTL_MS;
}

export function getStorefrontCacheClearedEventName() {
  return STOREFRONT_CACHE_CLEARED_EVENT;
}
