import type { StoreProductItem } from "./types";

export type StoreCartItem = {
  id: string;
  productId: string;
  title: string;
  subtitle: string;
  priceAmount: number;
  quantity: number;
  stockQuantity?: number;
  imageUrl?: string | null;
  categoryName?: string | null;
};

const STORAGE_KEY = "store_cart_v1";

function parseCart(raw: string | null): StoreCartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoreCartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object" && typeof item.productId === "string")
      .map((item) => ({
        ...item,
        quantity: Math.max(1, Number(item.quantity) || 1),
        stockQuantity: Math.max(0, Number(item.stockQuantity) || 0),
        priceAmount: Math.max(0, Number(item.priceAmount) || 0),
      }));
  } catch {
    return [];
  }
}

export function getStoreCart(): StoreCartItem[] {
  if (typeof window === "undefined") return [];
  return parseCart(window.localStorage.getItem(STORAGE_KEY));
}

function saveStoreCart(items: StoreCartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("store:cart-updated", { detail: items }));
}

export function clearStoreCart() {
  saveStoreCart([]);
}

export function addToStoreCart(product: StoreProductItem, quantity = 1) {
  const current = getStoreCart();
  const maxStock = Math.max(0, Number(product.stockQuantity) || 0);
  if (maxStock <= 0) {
    return;
  }
  const targetQuantity = Math.min(maxStock, Math.max(1, Number(quantity) || 1));
  const priceAmount = product.discountedPriceAmount ?? product.priceAmount;
  const existing = current.find((item) => item.productId === product.id);

  if (existing) {
    const nextQuantity = Math.min(maxStock, existing.quantity + targetQuantity);
    const next = current.map((item) =>
      item.productId === product.id ? { ...item, quantity: nextQuantity, priceAmount, stockQuantity: maxStock } : item,
    );
    saveStoreCart(next);
    return;
  }

  const nextItem: StoreCartItem = {
    id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    productId: product.id,
    title: product.title,
    subtitle: product.subtitle || product.description || product.categoryName || "",
    priceAmount,
    quantity: targetQuantity,
    stockQuantity: maxStock,
    imageUrl: product.imageUrl,
    categoryName: product.categoryName,
  };

  saveStoreCart([...current, nextItem]);
}

export function updateStoreCartQuantity(productId: string, quantity: number, maxStock?: number) {
  const current = getStoreCart();
  const currentItem = current.find((item) => item.productId === productId);
  if (!currentItem) {
    return;
  }
  const effectiveMax = Math.max(0, Number(maxStock ?? currentItem.stockQuantity ?? 0) || 0);
  const normalized = Math.max(1, Number(quantity) || 1);
  const clamped = effectiveMax > 0 ? Math.min(normalized, effectiveMax) : normalized;
  const next = current.map((item) => (item.productId === productId ? { ...item, quantity: clamped } : item));
  saveStoreCart(next);
}

export function removeFromStoreCart(productId: string) {
  const current = getStoreCart();
  saveStoreCart(current.filter((item) => item.productId !== productId));
}

export function getStoreCartSummary(items: StoreCartItem[]) {
  const subtotal = items.reduce((sum, item) => sum + item.priceAmount * item.quantity, 0);
  return {
    itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
  };
}
