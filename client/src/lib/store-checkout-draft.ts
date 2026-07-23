export type StoreCheckoutDraftItem = {
  id: string;
  productId?: string;
  title: string;
  subtitle?: string;
  imageLabel?: string;
  gradient?: string;
  price: string;
  unitAmount?: number;
  quantity: number;
};

export type StoreCheckoutDraftAddress = {
  title: string;
  provinceId?: number | null;
  provinceName?: string;
  cityId?: number | null;
  cityName?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
} | null;

export type StoreCheckoutDraft = {
  customerName: string;
  customerPhone: string;
  shippingMethod: "courier" | "express" | "pickup";
  notes: string;
  items: StoreCheckoutDraftItem[];
  address: StoreCheckoutDraftAddress;
  summary: {
    itemsCount: number;
    subtotal: number;
    shipping: number;
    discount: number;
    total: number;
  };
};

const STORAGE_KEY = "store-checkout-draft-v1";

export function saveStoreCheckoutDraft(draft: StoreCheckoutDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function getStoreCheckoutDraft(): StoreCheckoutDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoreCheckoutDraft;
  } catch {
    return null;
  }
}

export function clearStoreCheckoutDraft() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
}
