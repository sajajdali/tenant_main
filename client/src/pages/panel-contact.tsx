import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Loader2, MapPin, PhoneCall, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ContactPhone, ContactSettings, TenantMeta } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { CodeText } from "@/i18n/ltr-text";
import { useLocale, useT } from "@/i18n/locale";
import {
  IRAN_PROVINCES,
  getCitiesByProvince,
  getCityName,
  getProvinceName,
  geocodeIranCity,
} from "@/lib/iran-location";
const ContactLocationMap = lazy(async () => {
  const module = await import("@/components/contact-location-map");
  return { default: module.ContactLocationMap };
});

const createClientId = () => {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `contact-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const defaultPhone = (): ContactPhone => ({
  id: createClientId(),
  title: "",
  number: "",
});

const defaultState: ContactSettings = {
  enabled: false,
  phones: [defaultPhone()],
  locationEnabled: false,
  provinceId: null,
  provinceName: "",
  cityId: null,
  cityName: "",
  latitude: null,
  longitude: null,
  address: "",
};

const PANEL_CONTACT_DRAFT_KEY = "panel-contact-draft";

function readContactDraft(): ContactSettings | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(PANEL_CONTACT_DRAFT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<ContactSettings>;
    return {
      ...defaultState,
      ...parsed,
      phones: parsed.phones?.length ? parsed.phones : [defaultPhone()],
    };
  } catch {
    return null;
  }
}

function writeContactDraft(draft: ContactSettings, pickedKey?: string | null, geocodedKey?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const locationKey = draft.provinceId && draft.cityId ? `${draft.provinceId}:${draft.cityId}` : null;
  const shouldKeepCoordinates = locationKey && (pickedKey === locationKey || geocodedKey === locationKey);

  window.sessionStorage.setItem(PANEL_CONTACT_DRAFT_KEY, JSON.stringify({
    ...draft,
    ...(shouldKeepCoordinates
      ? {}
      : {
          latitude: null,
          longitude: null,
        }),
  }));
}

function clearContactDraft() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PANEL_CONTACT_DRAFT_KEY);
}

export default function PanelContactPage() {
  const { isAdmin, isPrimaryAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const { dir, isRtl } = useLocale();
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [findingCity, setFindingCity] = useState(false);
  const [pickedLocationKey, setPickedLocationKey] = useState<string | null>(null);
  const [geocodedLocationKey, setGeocodedLocationKey] = useState<string | null>(null);
  const [state, setState] = useState<ContactSettings>(() => readContactDraft() ?? defaultState);
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const labels = getAudienceLabels(tenantMeta);

  useEffect(() => {
    if (authLoading || hasLoadedRef.current) {
      return;
    }

    if (!isPrimaryAdmin) {
      if (typeof window !== "undefined") {
        window.location.replace("/panel");
      }
      return;
    }

    hasLoadedRef.current = true;

    api.contact.get().then((res) => {
      if (res.success) {
        const draft = readContactDraft();
        if (!draft && res.data.provinceId && res.data.cityId && res.data.latitude && res.data.longitude) {
          setPickedLocationKey(`${res.data.provinceId}:${res.data.cityId}`);
        }
        setState(draft ?? {
          ...defaultState,
          ...res.data,
          phones: res.data.phones?.length ? res.data.phones : [defaultPhone()],
        });
      }
      setLoading(false);
    });

    api.meta.get().then((res) => {
      if (res.success) {
        setTenantMeta(res.data);
      }
    });
  }, [authLoading, isPrimaryAdmin]);

  useEffect(() => {
    if (loading) {
      return;
    }

    writeContactDraft(state, pickedLocationKey, geocodedLocationKey);
  }, [geocodedLocationKey, loading, pickedLocationKey, state]);

  useEffect(() => {
    if (!state.locationEnabled || !state.provinceId || !state.cityId) {
      return;
    }

    const locationKey = `${state.provinceId}:${state.cityId}`;

    if ((pickedLocationKey === locationKey || geocodedLocationKey === locationKey) && state.latitude && state.longitude) {
      return;
    }

    const provinceName = state.provinceName || getProvinceName(state.provinceId);
    const cityName = state.cityName || getCityName(state.cityId);

    if (!provinceName || !cityName) {
      return;
    }

    setFindingCity(true);
    geocodeIranCity(cityName, provinceName)
      .then((point) => {
        setGeocodedLocationKey(locationKey);
        setState((current) => ({
          ...current,
          provinceName,
          cityName,
          latitude: point.lat,
          longitude: point.lng,
        }));
      })
      .catch(() => undefined)
      .finally(() => setFindingCity(false));
  }, [geocodedLocationKey, pickedLocationKey, state.locationEnabled, state.provinceId, state.cityId, state.latitude, state.longitude, state.provinceName, state.cityName, toast]);

  const cities = useMemo(() => getCitiesByProvince(state.provinceId), [state.provinceId]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
        <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
          <div className="text-muted-foreground">{t("panelContact.authChecking")}</div>
        </div>
      </div>
    );
  }

  if (!isPrimaryAdmin) {
    return null;
  }

  if (tenantMeta?.supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("panelContact.title")}</h1>
          </div>
          <Link href="/panel">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            >
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("common.loading")}
          </div>
        ) : (
          <>
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle>{t("panelContact.enableTitle")}</CardTitle>
                    <CardDescription>{t("panelContact.enableDescription")}</CardDescription>
                  </div>
                  <Switch
                    checked={state.enabled}
                    onCheckedChange={(checked) => setState((current) => ({ ...current, enabled: checked }))}
                  />
                </div>
              </CardHeader>
            </Card>

            {state.enabled ? (
            <>
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle>{t("panelContact.phonesTitle")}</CardTitle>
                <CardDescription>{t("panelContact.phonesDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {state.phones.map((phone, index) => (
                  <div key={phone.id} className="grid gap-3 rounded-[1.5rem] border border-border/70 bg-background/30 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_56px]">
                    <div className="space-y-2">
                      <Label htmlFor={`contact-phone-title-${phone.id}`}>{t("panelContact.phoneTitleLabel")}</Label>
                      <Input
                        id={`contact-phone-title-${phone.id}`}
                        value={phone.title}
                        onChange={(event) =>
                          setState((current) => ({
                            ...current,
                            phones: current.phones.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, title: event.target.value } : item,
                            ),
                          }))
                        }
                        placeholder={t("panelContact.phoneTitlePlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`contact-phone-number-${phone.id}`}>{t("panelContact.phoneNumberLabel")}</Label>
                      <Input
                        id={`contact-phone-number-${phone.id}`}
                        value={phone.number}
                        dir="ltr"
                        onChange={(event) =>
                          setState((current) => ({
                            ...current,
                            phones: current.phones.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, number: event.target.value } : item,
                            ),
                          }))
                        }
                        placeholder={t("panelContact.phoneNumberPlaceholder")}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-xl"
                        onClick={() =>
                          setState((current) => ({
                            ...current,
                            phones: current.phones.length > 1 ? current.phones.filter((item) => item.id !== phone.id) : [defaultPhone()],
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setState((current) => ({ ...current, phones: [...current.phones, defaultPhone()] }))}
                >
                  <Plus className="h-4 w-4" />
                  {t("panelContact.addPhone")}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle>{t("panelContact.locationTitle")}</CardTitle>
                    <CardDescription>{t("panelContact.locationDescription")}</CardDescription>
                  </div>
                  <Switch
                    checked={state.locationEnabled}
                    onCheckedChange={(checked) =>
                      setState((current) => ({
                        ...current,
                        locationEnabled: checked,
                        ...(checked
                          ? {}
                          : {
                              provinceId: null,
                              provinceName: "",
                              cityId: null,
                              cityName: "",
                              latitude: null,
                              longitude: null,
                              address: "",
                            }),
                      }))
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className={`space-y-5 transition-opacity ${state.locationEnabled ? "opacity-100" : "pointer-events-none opacity-45"}`}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact-province">{t("panelContact.provinceLabel")}</Label>
                    <select
                      id="contact-province"
                      value={state.provinceId ?? ""}
                      onChange={(event) => {
                        const provinceId = event.target.value ? Number(event.target.value) : null;
                        setPickedLocationKey(null);
                        setGeocodedLocationKey(null);
                        setState((current) => ({
                          ...current,
                          provinceId,
                          provinceName: getProvinceName(provinceId),
                          cityId: null,
                          cityName: "",
                          latitude: null,
                          longitude: null,
                        }));
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                    >
                      <option value="">{t("panelContact.provincePlaceholder")}</option>
                      {IRAN_PROVINCES.map((province) => (
                        <option key={province.id} value={province.id}>
                          {province.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-city">{t("panelContact.cityLabel")}</Label>
                    <select
                      id="contact-city"
                      value={state.cityId ?? ""}
                      onChange={(event) => {
                        const cityId = event.target.value ? Number(event.target.value) : null;
                        setPickedLocationKey(null);
                        setGeocodedLocationKey(null);
                        setState((current) => ({
                          ...current,
                          cityId,
                          cityName: getCityName(cityId),
                          latitude: null,
                          longitude: null,
                        }));
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                      disabled={!state.provinceId}
                    >
                      <option value="">{t("panelContact.cityPlaceholder")}</option>
                      {cities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {state.cityId ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      {findingCity ? t("panelContact.mapFindingCity") : t("panelContact.mapPickHint")}
                    </div>
                    <Suspense
                      fallback={
                        <div className="flex h-[320px] items-center justify-center rounded-[1.75rem] border border-border/70 bg-background/30 text-muted-foreground">
                          {t("panelContact.mapLoading")}
                        </div>
                      }
                    >
                      <ErrorBoundary
                        fallback={
                          <div className="flex h-[320px] items-center justify-center rounded-[1.75rem] border border-border/70 bg-background/30 text-muted-foreground">
                            {t("panelContact.mapError")}
                          </div>
                        }
                      >
                        <ContactLocationMap
                          center={{
                            lat: state.latitude ?? 32.4279,
                            lng: state.longitude ?? 53.688,
                          }}
                          marker={
                            state.latitude && state.longitude
                              ? { lat: state.latitude, lng: state.longitude }
                              : null
                          }
                          onPick={(point) => {
                            setPickedLocationKey(state.provinceId && state.cityId ? `${state.provinceId}:${state.cityId}` : null);
                            setState((current) => ({
                              ...current,
                              latitude: point.lat,
                              longitude: point.lng,
                            }));
                          }}
                        />
                      </ErrorBoundary>
                    </Suspense>
                    {state.latitude && state.longitude && (
                      <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
                        {t("panelContact.coordinatesLabel")} <CodeText>{`${state.latitude.toFixed(6)} , ${state.longitude.toFixed(6)}`}</CodeText>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-background/20 px-6 py-10 text-center text-muted-foreground">
                    {t("panelContact.mapDisabledHint")}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="contact-address">{t("panelContact.addressLabel")}</Label>
                  <Textarea
                    id="contact-address"
                    value={state.address || ""}
                    onChange={(event) => setState((current) => ({ ...current, address: event.target.value }))}
                    placeholder={t("panelContact.addressPlaceholder")}
                    className="min-h-32 text-start leading-8"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                disabled={saving}
                className="min-w-40"
                onClick={async () => {
                  setSaving(true);
                  const res = await api.contact.update({
                    ...state,
                    phones: state.phones.filter((item) => item.title.trim() || item.number.trim()),
                    provinceName: state.provinceName || getProvinceName(state.provinceId),
                    cityName: state.cityName || getCityName(state.cityId),
                  });
                  setSaving(false);

                  if (!res.success) {
                    toast({ variant: "destructive", title: t("common.error"), description: res.message });
                    return;
                  }

                  setState({
                    ...defaultState,
                    ...res.data,
                    phones: res.data.phones?.length ? res.data.phones : [defaultPhone()],
                  });
                  if (res.data.provinceId && res.data.cityId && res.data.latitude && res.data.longitude) {
                    setPickedLocationKey(`${res.data.provinceId}:${res.data.cityId}`);
                  }
                  clearContactDraft();
                  toast({ title: t("panelContact.toast.saved"), description: res.message });
                }}
              >
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <PhoneCall className="me-2 h-4 w-4" />}
                {t("panelContact.save")}
              </Button>
            </div>
            </>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
