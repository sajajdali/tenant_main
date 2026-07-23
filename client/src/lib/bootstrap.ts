import type { TenantMeta } from "./types";

declare global {
  interface Window {
    __BOOKING_BOOTSTRAP__?: {
      meta?: TenantMeta;
    };
  }
}

export function getInitialTenantMeta(): TenantMeta | null {
  return window.__BOOKING_BOOTSTRAP__?.meta ?? null;
}
