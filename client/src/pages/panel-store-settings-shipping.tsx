import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Loader2, MapPin, Plus, Store, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { IRAN_PROVINCES, getCitiesByProvince, getCityName, getProvinceName } from "@/lib/iran-location";
import type { StoreShippingCity, StoreShippingCityAmount, StoreShippingSettings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/i18n/locale";

const defaultSettings: StoreShippingSettings = {
  postalEnabled: true,
  postalBaseAmount: 0,
  postalCityOverrides: [],
  expressEnabled: false,
  expressAmount: 0,
  expressCities: [],
  pickupEnabled: false,
};

const createDraftId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function parseAmount(value: string) {
  const normalized = value.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (digit) => {
    const code = digit.charCodeAt(0);

    return String(code >= 0x06F0 ? code - 0x06F0 : code - 0x0660);
  }).replace(/[^\d]/g, "");

  return Number(normalized || "0");
}

export default function PanelStoreSettingsShippingPage() {
  const { toast } = useToast();
  const { dir, isRtl, t, format } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<StoreShippingSettings>(defaultSettings);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const [postalProvinceId, setPostalProvinceId] = useState<number | null>(null);
  const [postalCityId, setPostalCityId] = useState<number | null>(null);
  const [postalAmount, setPostalAmount] = useState("");

  const [expressProvinceId, setExpressProvinceId] = useState<number | null>(null);
  const [expressCityId, setExpressCityId] = useState<number | null>(null);

  useEffect(() => {
    api.store.getShippingSettings().then((res) => {
      if (res.success) {
        setSettings(res.data);
      }

      setLoading(false);
    });
  }, []);

  const postalCities = useMemo(() => getCitiesByProvince(postalProvinceId), [postalProvinceId]);
  const expressCities = useMemo(() => getCitiesByProvince(expressProvinceId), [expressProvinceId]);

  const addPostalOverride = () => {
    if (!postalProvinceId || !postalCityId) {
      toast({
        variant: "destructive",
        title: t("panelStore.shipping.toast.cityIncompleteTitle"),
        description: t("panelStore.shipping.toast.postalCityIncompleteDescription"),
      });
      return;
    }

    const amount = parseAmount(postalAmount);

    if (amount <= 0) {
      toast({
        variant: "destructive",
        title: t("panelStore.shipping.toast.invalidAmountTitle"),
        description: t("panelStore.shipping.toast.invalidPostalAmountDescription"),
      });
      return;
    }

    if (settings.postalCityOverrides.some((item) => item.cityId === postalCityId)) {
      toast({
        variant: "destructive",
        title: t("panelStore.shipping.toast.postalCityDuplicateTitle"),
        description: t("panelStore.shipping.toast.postalCityDuplicateDescription"),
      });
      return;
    }

    const nextItem: StoreShippingCityAmount = {
      id: createDraftId("postal-city"),
      provinceId: postalProvinceId,
      provinceName: getProvinceName(postalProvinceId),
      cityId: postalCityId,
      cityName: getCityName(postalCityId),
      amount,
    };

    setSettings((current) => ({
      ...current,
      postalCityOverrides: [...current.postalCityOverrides, nextItem],
    }));
    setPostalProvinceId(null);
    setPostalCityId(null);
    setPostalAmount("");
  };

  const addExpressCity = () => {
    if (!expressProvinceId || !expressCityId) {
      toast({
        variant: "destructive",
        title: t("panelStore.shipping.toast.cityIncompleteTitle"),
        description: t("panelStore.shipping.toast.expressCityIncompleteDescription"),
      });
      return;
    }

    if (settings.expressCities.some((item) => item.cityId === expressCityId)) {
      toast({
        variant: "destructive",
        title: t("panelStore.shipping.toast.expressCityDuplicateTitle"),
        description: t("panelStore.shipping.toast.expressCityDuplicateDescription"),
      });
      return;
    }

    const nextItem: StoreShippingCity = {
      id: createDraftId("express-city"),
      provinceId: expressProvinceId,
      provinceName: getProvinceName(expressProvinceId),
      cityId: expressCityId,
      cityName: getCityName(expressCityId),
    };

    setSettings((current) => ({
      ...current,
      expressCities: [...current.expressCities, nextItem],
    }));
    setExpressProvinceId(null);
    setExpressCityId(null);
  };

  const removePostalOverride = (id: string) => {
    setSettings((current) => ({
      ...current,
      postalCityOverrides: current.postalCityOverrides.filter((item) => item.id !== id),
    }));
  };

  const removeExpressCity = (id: string) => {
    setSettings((current) => ({
      ...current,
      expressCities: current.expressCities.filter((item) => item.id !== id),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await api.store.updateShippingSettings(settings);
    setSaving(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("panelStore.shipping.toast.saveFailedTitle"),
        description: res.message || t("panelStore.shipping.toast.saveFailedDescription"),
      });
      return;
    }

    setSettings(res.data);
    toast({
      title: t("panelStore.shipping.toast.savedTitle"),
      description: t("panelStore.shipping.toast.savedDescription"),
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_40%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("panelStore.shipping.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("panelStore.shipping.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelStore.shipping.description")}</p>
          </div>

          <Link href="/panel/store-settings/general">
            <Button variant="outline" size="icon" title={t("panelStore.shell.back")} className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <BackIcon className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-5 px-4 py-6">
        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-[30px] border border-border/70 bg-card/50 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelStore.shipping.loading")}
          </div>
        ) : (
          <>
            <div className="grid gap-5 xl:grid-cols-3">
              <Card className="border-border/70 bg-card/60 xl:col-span-2">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                        <Truck className="h-6 w-6" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-xl font-black">{t("panelStore.shipping.postal.title")}</h2>
                        <p className="text-sm leading-8 text-muted-foreground">
                          {t("panelStore.shipping.postal.description")}
                        </p>
                      </div>
                    </div>

                  <div className="flex items-center gap-3 rounded-[22px] border border-border/70 bg-background/35 px-4 py-3">
                      <div className="text-sm font-bold">{settings.postalEnabled ? t("panelStore.shipping.status.active") : t("panelStore.shipping.status.inactive")}</div>
                      <Switch
                        checked={settings.postalEnabled}
                        onCheckedChange={(checked) => setSettings((current) => ({ ...current, postalEnabled: checked }))}
                      />
                    </div>
                  </div>

                  <div className={`space-y-5 transition-opacity ${settings.postalEnabled ? "opacity-100" : "pointer-events-none opacity-45"}`}>
                    <div className="space-y-2">
                      <div className="text-sm font-bold">{t("panelStore.shipping.postal.baseAmount")}</div>
                      <Input
                        value={settings.postalBaseAmount ? format.number(settings.postalBaseAmount) : ""}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            postalBaseAmount: parseAmount(event.target.value),
                          }))
                        }
                        placeholder={t("panelStore.shipping.postal.baseAmountPlaceholder")}
                        className="h-12 rounded-[18px]"
                      />
                      <div className="text-xs text-muted-foreground">{t("panelStore.shipping.postal.baseAmountHint")}</div>
                    </div>

                    <div className="rounded-[24px] border border-border/70 bg-background/30 p-4">
                      <div className="mb-4 text-sm font-bold">{t("panelStore.shipping.postal.overrideTitle")}</div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <select
                          value={postalProvinceId ?? ""}
                          onChange={(event) => {
                            const value = event.target.value ? Number(event.target.value) : null;
                            setPostalProvinceId(value);
                            setPostalCityId(null);
                          }}
                          className="h-12 w-full rounded-[18px] border border-input bg-background px-3 py-2 text-start"
                        >
                          <option value="">{t("panelStore.shipping.selectProvince")}</option>
                          {IRAN_PROVINCES.map((province) => (
                            <option key={province.id} value={province.id}>
                              {province.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={postalCityId ?? ""}
                          onChange={(event) => setPostalCityId(event.target.value ? Number(event.target.value) : null)}
                          disabled={!postalProvinceId}
                          className="h-12 w-full rounded-[18px] border border-input bg-background px-3 py-2 text-start disabled:opacity-50"
                        >
                          <option value="">{t("panelStore.shipping.selectCity")}</option>
                          {postalCities.map((city) => (
                            <option key={city.id} value={city.id}>
                              {city.name}
                            </option>
                          ))}
                        </select>

                        <Input
                          value={postalAmount}
                          onChange={(event) => setPostalAmount(event.target.value)}
                          placeholder={t("panelStore.shipping.postal.cityAmountPlaceholder")}
                          className="h-12 rounded-[18px]"
                        />

                        <Button type="button" className="h-12 rounded-[18px]" onClick={addPostalOverride}>
                          <Plus className="me-2 h-4 w-4" />
                          {t("panelStore.shipping.add")}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {settings.postalCityOverrides.length > 0 ? settings.postalCityOverrides.map((item) => (
                        <div key={item.id} className="flex flex-col gap-3 rounded-[22px] border border-border/70 bg-background/35 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <div className="font-bold">{t("panelStore.shipping.cityWithProvince", { city: item.cityName, province: item.provinceName })}</div>
                            <div className="text-sm text-primary">{format.currency(item.amount)}</div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => removePostalOverride(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )) : (
                        <div className="rounded-[22px] border border-dashed border-border/70 bg-background/20 px-4 py-6 text-center text-sm text-muted-foreground">
                          {t("panelStore.shipping.postal.emptyOverrides")}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/60">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                        <MapPin className="h-6 w-6" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-xl font-black">{t("panelStore.shipping.pickup.title")}</h2>
                        <p className="text-sm leading-8 text-muted-foreground">{t("panelStore.shipping.pickup.description")}</p>
                      </div>
                    </div>

                    <Switch
                      checked={settings.pickupEnabled}
                      onCheckedChange={(checked) => setSettings((current) => ({ ...current, pickupEnabled: checked }))}
                    />
                  </div>

                  <div className={`rounded-[22px] border px-4 py-4 text-sm leading-7 ${settings.pickupEnabled ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
                    {settings.pickupEnabled
                      ? t("panelStore.shipping.pickup.enabledDescription")
                      : t("panelStore.shipping.pickup.disabledDescription")}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/70 bg-card/60">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                      <Store className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-black">{t("panelStore.shipping.express.title")}</h2>
                      <p className="text-sm leading-8 text-muted-foreground">
                        {t("panelStore.shipping.express.description")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-[22px] border border-border/70 bg-background/35 px-4 py-3">
                    <div className="text-sm font-bold">{settings.expressEnabled ? t("panelStore.shipping.status.active") : t("panelStore.shipping.status.inactive")}</div>
                    <Switch
                      checked={settings.expressEnabled}
                      onCheckedChange={(checked) => setSettings((current) => ({ ...current, expressEnabled: checked }))}
                    />
                  </div>
                </div>

                <div className={`space-y-5 transition-opacity ${settings.expressEnabled ? "opacity-100" : "pointer-events-none opacity-45"}`}>
                  <div className="space-y-2">
                    <div className="text-sm font-bold">{t("panelStore.shipping.express.amount")}</div>
                    <Input
                      value={settings.expressAmount ? format.number(settings.expressAmount) : ""}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          expressAmount: parseAmount(event.target.value),
                        }))
                      }
                      placeholder={t("panelStore.shipping.express.amountPlaceholder")}
                      className="h-12 rounded-[18px]"
                    />
                    <div className="text-xs text-muted-foreground">{t("panelStore.shipping.express.amountHint")}</div>
                  </div>

                  <div className="rounded-[24px] border border-border/70 bg-background/30 p-4">
                    <div className="mb-4 text-sm font-bold">{t("panelStore.shipping.express.citySelectorTitle")}</div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <select
                        value={expressProvinceId ?? ""}
                        onChange={(event) => {
                          const value = event.target.value ? Number(event.target.value) : null;
                          setExpressProvinceId(value);
                          setExpressCityId(null);
                        }}
                        className="h-12 w-full rounded-[18px] border border-input bg-background px-3 py-2 text-start"
                      >
                        <option value="">{t("panelStore.shipping.selectProvince")}</option>
                        {IRAN_PROVINCES.map((province) => (
                          <option key={province.id} value={province.id}>
                            {province.name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={expressCityId ?? ""}
                        onChange={(event) => setExpressCityId(event.target.value ? Number(event.target.value) : null)}
                        disabled={!expressProvinceId}
                        className="h-12 w-full rounded-[18px] border border-input bg-background px-3 py-2 text-start disabled:opacity-50"
                      >
                        <option value="">{t("panelStore.shipping.selectCity")}</option>
                        {expressCities.map((city) => (
                          <option key={city.id} value={city.id}>
                            {city.name}
                          </option>
                        ))}
                      </select>

                      <Button type="button" className="h-12 rounded-[18px]" onClick={addExpressCity}>
                        <Plus className="me-2 h-4 w-4" />
                        {t("panelStore.shipping.addCity")}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {settings.expressCities.length > 0 ? settings.expressCities.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-[22px] border border-border/70 bg-background/35 p-4">
                        <div className="space-y-1">
                          <div className="font-bold">{item.cityName}</div>
                          <div className="text-sm text-muted-foreground">{item.provinceName}</div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeExpressCity(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )) : (
                      <div className="rounded-[22px] border border-dashed border-border/70 bg-background/20 px-4 py-6 text-center text-sm text-muted-foreground md:col-span-2">
                        {t("panelStore.shipping.express.emptyCities")}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="button" className="rounded-[20px] px-6" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {t("panelStore.shipping.save")}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
