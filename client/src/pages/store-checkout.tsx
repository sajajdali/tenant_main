import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Loader2, MapPin, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { LoginModal } from "@/components/login-modal";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { IRAN_PROVINCES, geocodeIranCity, getCitiesByProvince, getCityName, getProvinceName } from "@/lib/iran-location";
import { saveStoreCheckoutDraft } from "@/lib/store-checkout-draft";
import { getStoreCart, removeFromStoreCart, type StoreCartItem, updateStoreCartQuantity } from "@/lib/store-cart";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { StoreShippingSettings } from "@/lib/types";

const ContactLocationMap = lazy(async () => {
  const module = await import("@/components/contact-location-map");
  return { default: module.ContactLocationMap };
});

type Step = "cart" | "details";

type AddressBookItem = {
  id: string;
  title: string;
  provinceId: number;
  provinceName: string;
  cityId: number;
  cityName: string;
  latitude: number;
  longitude: number;
  address: string;
};

type DraftAddress = {
  title: string;
  provinceId: number | null;
  provinceName: string;
  cityId: number | null;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
  address: string;
};

const defaultDraftAddress: DraftAddress = {
  title: "",
  provinceId: null,
  provinceName: "",
  cityId: null,
  cityName: "",
  latitude: null,
  longitude: null,
  address: "",
};

const createAddressId = () => `address-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const getAddressStorageKey = (userKey: string) => `store_checkout_addresses_${userKey}`;
const defaultShippingSettings: StoreShippingSettings = {
  postalEnabled: true,
  postalBaseAmount: 0,
  postalCityOverrides: [],
  expressEnabled: false,
  expressAmount: 0,
  expressCities: [],
  pickupEnabled: false,
};

const STORE_CHECKOUT_FORM_DRAFT_KEY = "store-checkout-form-draft-v1";

type StoreCheckoutFormDraft = {
  step?: Step;
  notes?: string;
  shippingMethod?: string;
  selectedAddressId?: string;
  addingAddress?: boolean;
  draftAddress?: DraftAddress;
};

function readStoreCheckoutFormDraft(): StoreCheckoutFormDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(STORE_CHECKOUT_FORM_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as StoreCheckoutFormDraft) : null;
  } catch {
    return null;
  }
}

function writeStoreCheckoutFormDraft(draft: StoreCheckoutFormDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORE_CHECKOUT_FORM_DRAFT_KEY, JSON.stringify(draft));
}

export default function StoreCheckoutPage() {
  const initialDraft = readStoreCheckoutFormDraft();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const format = useFormat();
  const [step, setStep] = useState<Step>(initialDraft?.step === "details" ? "details" : "cart");
  const [loginOpen, setLoginOpen] = useState(false);
  const [items, setItems] = useState<StoreCartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState(initialDraft?.notes ?? "");
  const [shippingMethod, setShippingMethod] = useState(initialDraft?.shippingMethod || "courier");
  const [addresses, setAddresses] = useState<AddressBookItem[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState(initialDraft?.selectedAddressId ?? "");
  const [addingAddress, setAddingAddress] = useState(initialDraft?.addingAddress ?? false);
  const [findingAddressCity, setFindingAddressCity] = useState(false);
  const [draftAddress, setDraftAddress] = useState<DraftAddress>(initialDraft?.draftAddress ?? defaultDraftAddress);
  const [shippingSettings, setShippingSettings] = useState<StoreShippingSettings>(defaultShippingSettings);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const ContinueIcon = isRtl ? ChevronLeft : ChevronRight;

  useEffect(() => {
    document.title = t("storeCheckout.documentTitle");

    const syncCart = () => {
      setItems(getStoreCart());
    };

    syncCart();
    window.addEventListener("store:cart-updated", syncCart);

    return () => {
      window.removeEventListener("store:cart-updated", syncCart);
    };
  }, [t]);

  useEffect(() => {
    if (!user) {
      setCustomerName("");
      setCustomerPhone("");
      setAddresses([]);
      setSelectedAddressId("");
      if (step === "details") {
        setStep("cart");
      }
      return;
    }

    setCustomerName((user.name || "").trim());
    setCustomerPhone((user.phone || "").trim());
  }, [user, step]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const userKey = user.id || user.phone;
    if (!userKey || typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(getAddressStorageKey(userKey));
    if (!raw) {
      setAddresses([]);
      setSelectedAddressId("");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AddressBookItem[];
      const nextAddresses = Array.isArray(parsed) ? parsed : [];
      setAddresses(nextAddresses);
      setSelectedAddressId((current) => nextAddresses.some((item) => item.id === current) ? current : "");
    } catch {
      setAddresses([]);
      setSelectedAddressId("");
    }
  }, [user?.id, user?.phone]);

  useEffect(() => {
    if (!user || typeof window === "undefined") {
      return;
    }

    const userKey = user.id || user.phone;
    if (!userKey) {
      return;
    }

    window.localStorage.setItem(getAddressStorageKey(userKey), JSON.stringify(addresses));
  }, [addresses, user?.id, user?.phone]);

  useEffect(() => {
    if (!user) {
      return;
    }

    api.store.getShippingSettings().then((res) => {
      if (res.success) {
        setShippingSettings(res.data);
      }
    });
  }, [user?.id]);

  useEffect(() => {
    if (shippingMethod === "pickup") {
      setAddingAddress(false);
    }
  }, [shippingMethod]);

  useEffect(() => {
    if (!user || shippingMethod === "pickup") {
      return;
    }

    if (addresses.length === 1 && !selectedAddressId) {
      setSelectedAddressId(addresses[0].id);
    }
  }, [addresses, selectedAddressId, shippingMethod, user]);

  useEffect(() => {
    writeStoreCheckoutFormDraft({
      step,
      notes,
      shippingMethod,
      selectedAddressId,
      addingAddress,
      draftAddress,
    });
  }, [addingAddress, draftAddress, notes, selectedAddressId, shippingMethod, step]);

  useEffect(() => {
    if (!addingAddress || !draftAddress.provinceId || !draftAddress.cityId) {
      return;
    }

    if (draftAddress.latitude && draftAddress.longitude) {
      return;
    }

    const provinceName = draftAddress.provinceName || getProvinceName(draftAddress.provinceId);
    const cityName = draftAddress.cityName || getCityName(draftAddress.cityId);

    if (!provinceName || !cityName) {
      return;
    }

    setFindingAddressCity(true);
    geocodeIranCity(cityName, provinceName)
      .then((point) => {
        setDraftAddress((current) => ({
          ...current,
          provinceName,
          cityName,
          latitude: point.lat,
          longitude: point.lng,
        }));
      })
      .catch(() => {
        toast({
          variant: "destructive",
          title: t("storeCheckout.toast.cityLocationNotFoundTitle"),
          description: t("storeCheckout.toast.cityLocationNotFoundDescription"),
        });
      })
      .finally(() => setFindingAddressCity(false));
  }, [addingAddress, draftAddress.cityId, draftAddress.cityName, draftAddress.latitude, draftAddress.longitude, draftAddress.provinceId, draftAddress.provinceName, t, toast]);

  const updateQuantity = (productId: string, delta: number) => {
    const target = items.find((item) => item.productId === productId);
    if (!target) {
      return;
    }

    const nextQty = Math.max(1, target.quantity + delta);
    if ((target.stockQuantity ?? 0) > 0 && nextQty > (target.stockQuantity ?? 0)) {
      toast({
        variant: "destructive",
        title: t("storeCheckout.toast.stockLimitTitle"),
        description: t("storeCheckout.toast.stockLimitDescription", { count: format.number(target.stockQuantity ?? 0) }),
      });
      return;
    }

    updateStoreCartQuantity(productId, nextQty, target.stockQuantity);
  };

  const removeItem = (productId: string) => {
    removeFromStoreCart(productId);
  };

  const removeAddress = (addressId: string) => {
    setAddresses((current) => {
      const next = current.filter((item) => item.id !== addressId);

      if (selectedAddressId === addressId) {
        setSelectedAddressId("");
      }

      return next;
    });
  };

  const selectedAddress = addresses.find((item) => item.id === selectedAddressId) ?? null;
  const addressCities = useMemo(() => getCitiesByProvince(draftAddress.provinceId), [draftAddress.provinceId]);
  const expressAvailableForSelectedAddress = useMemo(() => {
    if (!selectedAddress) {
      return false;
    }

    return shippingSettings.expressCities.some(
      (city) => city.provinceId === selectedAddress.provinceId && city.cityId === selectedAddress.cityId,
    );
  }, [selectedAddress, shippingSettings.expressCities]);
  const availableShippingMethods = useMemo(() => {
    const methods: Array<{ value: string; label: string; disabled?: boolean; description?: string }> = [];

    if (shippingSettings.postalEnabled) {
      methods.push({ value: "courier", label: t("storeCheckout.shipping.courier") });
    }

    if (shippingSettings.expressEnabled) {
      methods.push({
        value: "express",
        label: t("storeCheckout.shipping.express"),
        disabled: !!selectedAddress && !expressAvailableForSelectedAddress,
        description: selectedAddress && !expressAvailableForSelectedAddress ? t("storeCheckout.shipping.unavailableForCity") : undefined,
      });
    }

    if (shippingSettings.pickupEnabled) {
      methods.push({ value: "pickup", label: t("storeCheckout.shipping.pickup") });
    }

    return methods;
  }, [shippingSettings, selectedAddress, expressAvailableForSelectedAddress, t]);
  const computedShippingAmount = useMemo(() => {
    if (shippingMethod === "pickup") {
      return 0;
    }

    if (shippingMethod === "courier") {
      if (!shippingSettings.postalEnabled) {
        return 0;
      }
      if (!selectedAddress) {
        return shippingSettings.postalBaseAmount;
      }
      const override = shippingSettings.postalCityOverrides.find(
        (item) => item.provinceId === selectedAddress.provinceId && item.cityId === selectedAddress.cityId,
      );
      return override?.amount ?? shippingSettings.postalBaseAmount;
    }

    if (shippingMethod === "express") {
      if (!shippingSettings.expressEnabled) {
        return 0;
      }
      if (!selectedAddress) {
        return shippingSettings.expressAmount;
      }
      return expressAvailableForSelectedAddress ? shippingSettings.expressAmount : 0;
    }

    return 0;
  }, [shippingMethod, shippingSettings, selectedAddress, expressAvailableForSelectedAddress]);
  const summary = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.priceAmount * item.quantity, 0);
    const shipping = computedShippingAmount;
    const discount = items.length >= 2 ? 30000 : 0;
    const total = Math.max(0, subtotal + shipping - discount);

    return {
      itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      shipping,
      discount,
      total,
    };
  }, [computedShippingAmount, items]);
  useEffect(() => {
    const availableValues = availableShippingMethods.map((method) => method.value);

    if (availableValues.length === 0) {
      return;
    }

    if (!availableValues.includes(shippingMethod)) {
      setShippingMethod(availableValues[0]);
    }
  }, [availableShippingMethods, shippingMethod]);
  const needsDeliveryAddress = shippingMethod !== "pickup";
  const isCartEmpty = items.length === 0;
  const canSaveDraftAddress =
    !!draftAddress.title.trim() &&
    !!draftAddress.provinceId &&
    !!draftAddress.cityId &&
    !!draftAddress.latitude &&
    !!draftAddress.longitude &&
    !!draftAddress.address.trim();
  const canSubmitOrder = (!needsDeliveryAddress || !!selectedAddress) && (shippingMethod !== "express" || expressAvailableForSelectedAddress);

  const handleSubmitOrder = () => {
    if (!user) {
      setLoginOpen(true);
      return;
    }

    if (isCartEmpty) {
      toast({
        variant: "destructive",
        title: t("storeCheckout.toast.emptyCartTitle"),
        description: t("storeCheckout.toast.emptyCartDescription"),
      });
      return;
    }

    if (!canSubmitOrder) {
      toast({
        variant: "destructive",
        title: t("storeCheckout.toast.addressRequiredTitle"),
        description: shippingMethod === "express"
          ? t("storeCheckout.toast.expressUnavailableDescription")
          : t("storeCheckout.toast.addressRequiredDescription"),
      });
      return;
    }

    saveStoreCheckoutDraft({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      shippingMethod: shippingMethod as "courier" | "express" | "pickup",
      notes: notes.trim(),
      address: needsDeliveryAddress && selectedAddress
        ? {
            title: selectedAddress.title,
            provinceId: selectedAddress.provinceId,
            provinceName: selectedAddress.provinceName,
            cityId: selectedAddress.cityId,
            cityName: selectedAddress.cityName,
            latitude: selectedAddress.latitude,
            longitude: selectedAddress.longitude,
            address: selectedAddress.address,
          }
        : null,
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId,
        title: item.title,
        subtitle: item.subtitle,
        imageLabel: item.title.slice(0, 8),
        gradient: "linear-gradient(135deg, #17324d 0%, #f59e0b 100%)",
        price: format.currency(item.priceAmount),
        unitAmount: item.priceAmount,
        quantity: item.quantity,
      })),
      summary,
    });

    setLocation("/store/checkout/payment");
  };

  const saveDraftAddress = () => {
    if (
      !draftAddress.title.trim() ||
      !draftAddress.provinceId ||
      !draftAddress.cityId ||
      !draftAddress.latitude ||
      !draftAddress.longitude ||
      !draftAddress.address.trim()
    ) {
      return;
    }

    const nextAddress: AddressBookItem = {
      id: createAddressId(),
      title: draftAddress.title.trim(),
      provinceId: draftAddress.provinceId,
      provinceName: draftAddress.provinceName || getProvinceName(draftAddress.provinceId),
      cityId: draftAddress.cityId,
      cityName: draftAddress.cityName || getCityName(draftAddress.cityId),
      latitude: draftAddress.latitude,
      longitude: draftAddress.longitude,
      address: draftAddress.address.trim(),
    };

    setAddresses((current) => [...current, nextAddress]);
    setSelectedAddressId(nextAddress.id);
    setAddingAddress(false);
    setDraftAddress(defaultDraftAddress);
    window.setTimeout(() => {
      document.getElementById("order-notes")?.focus();
    }, 0);
  };

  return (
    <div className="store-page min-h-screen bg-background pb-16 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_45%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="border-b border-border/70 bg-card/40 backdrop-blur-md">
        <div className="container mx-auto max-w-6xl px-4 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm text-primary">{t("storeCheckout.eyebrow")}</div>
              <h1 className="text-2xl font-black">{t("storeCheckout.title")}</h1>
            </div>

            <Link href="/store">
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40" aria-label={t("storeCheckout.backToStore")}>
                <BackIcon className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="rounded-[30px] border border-border/70 bg-card/60 p-4 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.75)] sm:p-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStep("cart")}
              className={`rounded-[22px] border px-3 py-3 text-start transition-all sm:px-4 sm:py-4 ${step === "cart" ? "border-primary bg-primary/10" : "border-border/70 bg-background/35 hover:border-primary/30"}`}
            >
              <div className="mb-1 text-[11px] text-muted-foreground sm:text-xs">{t("storeCheckout.step.cartNumber")}</div>
              <div className="text-lg font-black sm:text-xl">{t("storeCheckout.step.cartTitle")}</div>
              <div className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground sm:text-sm">
                {t("storeCheckout.step.cartDescription")}
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  setLoginOpen(true);
                  return;
                }
                setStep("details");
              }}
              className={`rounded-[22px] border px-3 py-3 text-start transition-all sm:px-4 sm:py-4 ${step === "details" ? "border-primary bg-primary/10" : "border-border/70 bg-background/35 hover:border-primary/30"} ${!user ? "opacity-75" : ""}`}
            >
              <div className="mb-1 text-[11px] text-muted-foreground sm:text-xs">{t("storeCheckout.step.detailsNumber")}</div>
              <div className="text-lg font-black sm:text-xl">{t("storeCheckout.step.detailsTitle")}</div>
              <div className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground sm:text-sm">
                {user ? t("storeCheckout.step.detailsDescription") : t("storeCheckout.step.loginFirst")}
              </div>
            </button>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            {step === "cart" ? (
              <Card className="border-border/70 bg-card/60">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-xl font-black">{t("storeCheckout.cart.title")}</h2>
                      <p className="text-sm text-muted-foreground">{t("storeCheckout.cart.description")}</p>
                    </div>
                    <div className="rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-bold text-primary">
                      {t("storeCheckout.cart.itemsCount", { count: format.number(summary.itemsCount) })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {items.map((item) => (
                      <div key={item.id} className="rounded-[28px] border border-border/70 bg-background/35 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-[24px] border border-border/70 bg-background/45">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">{item.title.slice(0, 8)}</div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="font-black text-foreground">{item.title}</div>
                                <div className="text-sm leading-7 text-muted-foreground">{item.subtitle}</div>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeItem(item.productId)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/15"
                                aria-label={t("storeCheckout.cart.removeItem")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                              <div className="text-lg font-black text-primary">{format.currency(item.priceAmount)}</div>

                              <div className="flex items-center gap-2 rounded-full border border-border bg-background/60 p-1">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.productId, -1)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background"
                                  aria-label={t("storeCheckout.cart.decreaseQuantity")}
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <div className="min-w-[2rem] text-center text-sm font-black">
                                  {format.number(item.quantity)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.productId, 1)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background"
                                  aria-label={t("storeCheckout.cart.increaseQuantity")}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      className="rounded-[20px] px-6"
                      onClick={() => {
                        if (!user) {
                          setLoginOpen(true);
                          return;
                        }
                        setStep("details");
                      }}
                    >
                      {t("storeCheckout.continue")}
                      <ContinueIcon className="ms-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : !user ? (
              <Card className="border-border/70 bg-card/60">
                <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-5 p-6 text-center">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black">{t("storeCheckout.loginRequired.title")}</h2>
                    <p className="text-sm leading-7 text-muted-foreground">
                      {t("storeCheckout.loginRequired.description")}
                    </p>
                  </div>
                  <Button className="rounded-[20px] px-6" onClick={() => setLoginOpen(true)}>
                    {t("storeCheckout.loginRequired.button")}
                  </Button>
                </CardContent>
              </Card>
            ) : isCartEmpty ? (
              <Card className="border-border/70 bg-card/60">
                <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-5 p-6 text-center">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black">{t("storeCheckout.empty.title")}</h2>
                    <p className="text-sm leading-7 text-muted-foreground">
                      {t("storeCheckout.empty.description")}
                    </p>
                  </div>

                  <Link href="/store">
                    <Button className="rounded-[20px] px-6">
                      {t("storeCheckout.backToStore")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/70 bg-card/60">
                <CardContent className="space-y-6 p-5 sm:p-6">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black">{t("storeCheckout.details.title")}</h2>
                    <p className="text-sm text-muted-foreground">{t("storeCheckout.details.description")}</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="customer-name">{t("storeCheckout.details.customerName")}</Label>
                      <Input
                        id="customer-name"
                        value={customerName}
                        readOnly
                        placeholder={t("storeCheckout.details.customerNamePlaceholder")}
                        className="h-12 rounded-[18px] border-border bg-background/45 text-muted-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer-phone">{t("storeCheckout.details.customerPhone")}</Label>
                      <Input
                        id="customer-phone"
                        value={customerPhone}
                        readOnly
                        placeholder="09xxxxxxxxx"
                        className="h-12 rounded-[18px] border-border bg-background/45 text-start text-muted-foreground [direction:ltr]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("storeCheckout.details.paymentMethod")}</Label>
                    <div className="rounded-[24px] border border-primary/20 bg-primary/10 p-4 text-sm leading-7 text-muted-foreground">
                      {t("storeCheckout.details.paymentDescriptionBefore")}{" "}
                      <span className="font-bold text-foreground">{t("storeCheckout.payment.card")}</span>
                      {" "}{t("storeCheckout.details.paymentDescriptionMiddle")}{" "}
                      <span className="font-bold text-foreground">{t("storeCheckout.payment.online")}</span>
                      {" "}{t("storeCheckout.details.paymentDescriptionAfter")}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("storeCheckout.details.shippingMethod")}</Label>
                      <Select value={shippingMethod} onValueChange={setShippingMethod}>
                        <SelectTrigger className="h-12 rounded-[18px] border-border bg-background/45 text-start">
                          <SelectValue placeholder={t("storeCheckout.details.shippingPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableShippingMethods.map((method) => (
                            <SelectItem key={method.value} value={method.value} disabled={method.disabled}>
                              {method.label}
                              {method.description ? ` (${method.description})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {shippingMethod !== "pickup" ? (
                    <div className="space-y-4 rounded-[26px] border border-border/70 bg-background/30 p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <Label className="text-base font-bold">{t("storeCheckout.address.title")}</Label>
                          <p className="text-sm leading-7 text-muted-foreground">
                            {t("storeCheckout.address.description")}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-[18px] border-border bg-background/40"
                          onClick={() => setAddingAddress(true)}
                        >
                          {t("storeCheckout.address.addNew")}
                        </Button>
                      </div>

                      <div className="grid gap-3">
                        {addresses.map((item) => {
                          const isActive = item.id === selectedAddressId;

                          return (
                            <div
                              key={item.id}
                              className={`rounded-[22px] border p-4 transition-all ${isActive ? "border-primary bg-primary/10" : "border-border/70 bg-background/35 hover:border-primary/30"}`}
                            >
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => setSelectedAddressId(item.id)}
                                  className="min-w-0 flex-1 text-start"
                                >
                                  <div className="mb-2 flex items-center justify-between gap-3">
                                    <div className="font-bold text-foreground">{item.title}</div>
                                    <div className="rounded-full border border-border/70 bg-background/50 px-3 py-1 text-xs text-muted-foreground">
                                      {t("storeCheckout.address.cityProvince", { city: item.cityName, province: item.provinceName })}
                                    </div>
                                  </div>
                                  <div className="text-sm leading-7 text-muted-foreground">{item.address}</div>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => removeAddress(item.id)}
                                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/15"
                                  aria-label={t("storeCheckout.address.remove")}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {selectedAddress ? (
                        <div className="rounded-[22px] border border-primary/15 bg-primary/8 p-4">
                          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
                            <MapPin className="h-4 w-4" />
                            {t("storeCheckout.address.selected")}
                          </div>
                          <div className="text-sm leading-7 text-muted-foreground">
                            {selectedAddress.title} - {selectedAddress.address}
                          </div>
                        </div>
                      ) : null}

                      {shippingMethod === "express" && selectedAddress && !expressAvailableForSelectedAddress ? (
                        <div className="rounded-[22px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                          {t("storeCheckout.toast.expressUnavailableDescription")}
                        </div>
                      ) : null}

                      <Dialog
                        open={addingAddress}
                        modal={false}
                        onOpenChange={(open) => {
                          setAddingAddress(open);
                          if (!open) {
                            const hasUnsavedValue =
                              !!draftAddress.title.trim() ||
                              !!draftAddress.provinceId ||
                              !!draftAddress.cityId ||
                              !!draftAddress.address.trim() ||
                              !!draftAddress.latitude ||
                              !!draftAddress.longitude;

                            if (!hasUnsavedValue) {
                              setDraftAddress(defaultDraftAddress);
                            }
                          }
                        }}
                      >
                        <DialogContent
                          className="pretty-scrollbar max-h-[90vh] overflow-y-auto rounded-[28px] border-border bg-card p-0 sm:max-w-3xl"
                          dir={dir}
                          onCloseAutoFocus={(event) => {
                            event.preventDefault();
                          }}
                        >
                          <div className="space-y-4 p-5 sm:p-6">
                            <DialogHeader className="space-y-2 text-start">
                              <DialogTitle>{t("storeCheckout.address.dialogTitle")}</DialogTitle>
                              <DialogDescription>
                                {t("storeCheckout.address.dialogDescription")}
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 rounded-[24px] border border-dashed border-primary/30 bg-background/40 p-4 sm:p-5">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="address-title">{t("storeCheckout.address.titleLabel")}</Label>
                              <Input
                                id="address-title"
                                value={draftAddress.title}
                                onChange={(event) => setDraftAddress((current) => ({ ...current, title: event.target.value }))}
                                placeholder={t("storeCheckout.address.titlePlaceholder")}
                                className="h-12 rounded-[18px] border-border bg-background/45"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="address-province">{t("storeCheckout.address.province")}</Label>
                              <select
                                id="address-province"
                                value={draftAddress.provinceId ?? ""}
                                onChange={(event) => {
                                  const provinceId = event.target.value ? Number(event.target.value) : null;
                                  setDraftAddress((current) => ({
                                    ...current,
                                    provinceId,
                                    provinceName: getProvinceName(provinceId),
                                    cityId: null,
                                    cityName: "",
                                    latitude: null,
                                    longitude: null,
                                  }));
                                }}
                                className="h-12 w-full rounded-[18px] border border-input bg-background px-3 py-2 text-start"
                              >
                                <option value="">{t("storeCheckout.address.provincePlaceholder")}</option>
                                {IRAN_PROVINCES.map((province) => (
                                  <option key={province.id} value={province.id}>
                                    {province.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="address-city">{t("storeCheckout.address.city")}</Label>
                              <select
                                id="address-city"
                                value={draftAddress.cityId ?? ""}
                                onChange={(event) => {
                                  const cityId = event.target.value ? Number(event.target.value) : null;
                                  setDraftAddress((current) => ({
                                    ...current,
                                    cityId,
                                    cityName: getCityName(cityId),
                                    latitude: null,
                                    longitude: null,
                                  }));
                                }}
                                disabled={!draftAddress.provinceId}
                                className="h-12 w-full rounded-[18px] border border-input bg-background px-3 py-2 text-start disabled:opacity-50"
                              >
                                <option value="">{t("storeCheckout.address.cityPlaceholder")}</option>
                                {addressCities.map((city) => (
                                  <option key={city.id} value={city.id}>
                                    {city.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <Label>{t("storeCheckout.address.mapLocation")}</Label>
                              <div className="flex h-12 items-center rounded-[18px] border border-border bg-background/45 px-4 text-sm text-muted-foreground">
                                {findingAddressCity ? (
                                  <>
                                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                                    {t("storeCheckout.address.mapPreparing")}
                                  </>
                                ) : draftAddress.latitude && draftAddress.longitude ? (
                                  t("storeCheckout.address.mapSaved")
                                ) : (
                                  t("storeCheckout.address.mapPrompt")
                                )}
                              </div>
                            </div>
                          </div>

                          {draftAddress.provinceId && draftAddress.cityId && draftAddress.latitude && draftAddress.longitude ? (
                            <Suspense
                              fallback={
                                <div className="flex h-[320px] items-center justify-center rounded-[1.75rem] border border-border/70 bg-card/40 text-sm text-muted-foreground">
                                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                                  {t("storeCheckout.address.mapLoading")}
                                </div>
                              }
                            >
                              <ErrorBoundary
                                fallback={
                                  <div className="flex h-[320px] items-center justify-center rounded-[1.75rem] border border-border/70 bg-card/40 text-sm text-muted-foreground">
                                    {t("storeCheckout.address.mapError")}
                                  </div>
                                }
                              >
                                <ContactLocationMap
                                  center={{ lat: draftAddress.latitude, lng: draftAddress.longitude }}
                                  marker={{ lat: draftAddress.latitude, lng: draftAddress.longitude }}
                                  onPick={(point) =>
                                    setDraftAddress((current) => ({
                                      ...current,
                                      latitude: point.lat,
                                      longitude: point.lng,
                                    }))
                                  }
                                />
                              </ErrorBoundary>
                            </Suspense>
                          ) : null}

                          <div className="space-y-2">
                            <Label htmlFor="address-detail">{t("storeCheckout.address.fullAddress")}</Label>
                            <Textarea
                              id="address-detail"
                              value={draftAddress.address}
                              onChange={(event) => setDraftAddress((current) => ({ ...current, address: event.target.value }))}
                              placeholder={t("storeCheckout.address.fullAddressPlaceholder")}
                              className="min-h-[120px] rounded-[20px] border-border bg-background/45 leading-8"
                            />
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-[18px] border-border bg-background/40"
                              onClick={() => {
                                setAddingAddress(false);
                                setDraftAddress(defaultDraftAddress);
                              }}
                            >
                              {t("common.cancel")}
                            </Button>
                            <Button
                              type="button"
                              className="rounded-[18px] px-6"
                              onClick={saveDraftAddress}
                              disabled={!canSaveDraftAddress}
                            >
                              {t("storeCheckout.address.save")}
                            </Button>
                          </div>
                        </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-border/70 bg-background/35 p-4 text-sm leading-7 text-muted-foreground">
                      {t("storeCheckout.address.pickupNoticeBefore")} <span className="font-bold text-foreground">{t("storeCheckout.shipping.pickup")}</span> {t("storeCheckout.address.pickupNoticeAfter")}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="order-notes">{t("storeCheckout.notes.label")}</Label>
                    <Textarea
                      id="order-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder={t("storeCheckout.notes.placeholder")}
                      className="min-h-[120px] rounded-[20px] border-border bg-background/45 leading-8"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-[18px] border-border bg-background/40"
                      onClick={() => setStep("cart")}
                    >
                      {t("storeCheckout.backToCart")}
                    </Button>
                    <Button className="rounded-[18px] px-6" onClick={handleSubmitOrder}>
                      {summary.total <= 0 ? t("storeCheckout.freeContinue") : t("storeCheckout.continueToPayment")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-5">
            <Card className="border-border/70 bg-card/60 xl:sticky xl:top-6">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex items-center gap-2 text-primary">
                  <ShoppingBag className="h-5 w-5" />
                  <div className="font-bold">{t("storeCheckout.summary.title")}</div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-[20px] border border-border/70 bg-background/35 px-4 py-3">
                    <span className="text-sm text-muted-foreground">{t("storeCheckout.summary.subtotal")}</span>
                    <span className="font-bold">{format.currency(summary.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-[20px] border border-border/70 bg-background/35 px-4 py-3">
                    <span className="text-sm text-muted-foreground">{t("storeCheckout.summary.shipping")}</span>
                    <span className="font-bold">{summary.shipping > 0 ? format.currency(summary.shipping) : t("storeCheckout.summary.free")}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-[20px] border border-border/70 bg-background/35 px-4 py-3">
                    <span className="text-sm text-muted-foreground">{t("storeCheckout.summary.discount")}</span>
                    <span className="font-bold text-green-400">{summary.discount > 0 ? t("storeCheckout.summary.negativeAmount", { amount: format.currency(summary.discount) }) : format.currency(0)}</span>
                  </div>
                </div>

                <div className="rounded-[24px] border border-primary/20 bg-primary/8 p-4">
                  <div className="mb-2 text-sm text-muted-foreground">{t("storeCheckout.summary.total")}</div>
                  <div className="text-2xl font-black text-primary">{format.currency(summary.total)}</div>
                </div>

                <div className="space-y-3 rounded-[24px] border border-border/70 bg-background/35 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Truck className="h-4 w-4 text-primary" />
                    {t("storeCheckout.summary.shippingNote")}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    {t("storeCheckout.summary.gatewayNote")}
                  </div>
                </div>

                {step === "cart" ? (
                  <Button
                    className="h-12 w-full rounded-[20px]"
                    onClick={() => {
                      if (!user) {
                        setLoginOpen(true);
                        return;
                      }
                      setStep("details");
                    }}
                  >
                    {t("storeCheckout.continue")}
                  </Button>
                ) : (
                  <Button className="h-12 w-full rounded-[20px]" onClick={handleSubmitOrder}>
                    {summary.total <= 0 ? t("storeCheckout.freeContinue") : t("storeCheckout.confirmAndPay")}
                  </Button>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        phoneStepDescription={t("storeCheckout.loginRequired.description")}
        onSuccess={() => {
          setStep("details");
          setLoginOpen(false);
        }}
      />
    </div>
  );
}
