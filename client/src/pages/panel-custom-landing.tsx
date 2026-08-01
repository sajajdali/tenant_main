import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import DatePicker, { DateObject } from "react-multi-date-picker";
import arabic from "react-date-object/calendars/arabic";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";
import arabic_ar from "react-date-object/locales/arabic_ar";
import gregorian_en from "react-date-object/locales/gregorian_en";
import persian_fa from "react-date-object/locales/persian_fa";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, Copy, CreditCard, ExternalLink, ImagePlus, Link2, NotebookPen, Plus, Power, Search, Settings2, Trash2, Users, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import type { CustomLandingOverview, CustomLandingPartnerDashboard, CustomLandingSettings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/i18n/locale";

const emptyPartner = { name: "", mobile: "", first_payment_percent: "90", recurring_payment_percent: "20", status: "active", notes: "" };
const emptySettlement = { amount: "", payment_method: "", payment_reference: "", paid_at: new Date().toISOString().slice(0, 10), note: "" };
const emptySettings: CustomLandingSettings = { title: "", headline: "", description: "", buttonLabel: "ورود به اپلیکیشن", autoTokenEnabled: false, redirectHomeEnabled: false, logoUrl: "", appViewUrl: "", webAppUrl: "", androidUrl: "", iosUrl: "" };
const toSafeDate = (value: string) => new Date(`${value}T12:00:00`);

export default function PanelCustomLandingPage() {
  const [location, setLocation] = useLocation();
  const settingsMatch = location === "/panel/custom-landing/settings";
  const deleteRouteMatch = location.match(/^\/panel\/custom-landing\/([^/]+)\/delete$/);
  const detailRouteMatch = location.match(/^\/panel\/custom-landing\/([^/]+)$/);
  const deleteMatch = Boolean(deleteRouteMatch);
  const routePartnerId = detailRouteMatch?.[1] ?? "";
  const deletePartnerId = deleteRouteMatch?.[1] ?? "";
  const { isAdmin, isLoading } = useAuth();
  const { calendar, isRtl, locale } = useLocale();
  const { toast } = useToast();
  const [data, setData] = useState<CustomLandingOverview | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [dashboard, setDashboard] = useState<CustomLandingPartnerDashboard | null>(null);
  const [form, setForm] = useState(emptyPartner);
  const [editForm, setEditForm] = useState(emptyPartner);
  const [settlementForm, setSettlementForm] = useState(emptySettlement);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [settingsForm, setSettingsForm] = useState<CustomLandingSettings>(emptySettings);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const [firstDeleteConfirmed, setFirstDeleteConfirmed] = useState(false);
  const [deleteName, setDeleteName] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deletingPartner, setDeletingPartner] = useState(false);

  const money = (value: number) => `${new Intl.NumberFormat("fa-IR").format(value || 0)} تومان`;
  const date = (value?: string | null) => value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "-";
  const pickerCalendar = calendar === "hijri" ? arabic : calendar === "jalali" ? persian : gregorian;
  const pickerLocale = calendar === "hijri" ? arabic_ar : locale === "fa" ? persian_fa : gregorian_en;
  const calendarPosition = isRtl ? "bottom-right" : "bottom-left";

  const load = async () => {
    const res = await api.customLanding.overview();
    if (res.success) {
      setData(res.data);
      if (res.data.settings) setSettingsForm(res.data.settings);
    }
    else toast({ variant: "destructive", title: "خطا", description: res.message });
  };

  const loadSettings = async () => {
    const res = await api.customLanding.settings();
    if (res.success) setSettingsForm(res.data);
    else toast({ variant: "destructive", title: "خطا", description: res.message });
  };

  const loadDashboard = async (partnerId = selectedId, term = search) => {
    if (!partnerId) return;
    setDashboardLoading(true);
    setDashboardError("");
    try {
      const res = await api.customLanding.partnerDashboard(partnerId, term);
      if (!res.success) {
        setDashboard(null);
        setDashboardError(res.message || "دریافت گزارش همکار با خطا روبه‌رو شد.");
        toast({ variant: "destructive", title: "خطا", description: res.message });
        return;
      }
      setSelectedId(partnerId);
      setDashboard(res.data);
      setEditForm({
        name: res.data.partner.name,
        mobile: res.data.partner.mobile,
        first_payment_percent: String(res.data.partner.firstPaymentPercent),
        recurring_payment_percent: String(res.data.partner.recurringPaymentPercent),
        status: res.data.partner.status,
        notes: res.data.partner.notes ?? "",
      });
    } catch {
      setDashboard(null);
      setDashboardError("ارتباط با سرور برای دریافت گزارش برقرار نشد.");
      toast({ variant: "destructive", title: "خطا", description: "ارتباط با سرور برای دریافت گزارش برقرار نشد." });
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);
  useEffect(() => { if (isAdmin && settingsMatch) void loadSettings(); }, [isAdmin, settingsMatch]);
  useEffect(() => {
    if (!isAdmin) return;
    if (settingsMatch) {
      setSelectedId("");
      setDashboard(null);
      setDashboardError("");
      return;
    }
    if (deleteMatch && deletePartnerId) {
      void loadDashboard(deletePartnerId, "");
      setFirstDeleteConfirmed(false);
      setDeleteName("");
      setDeletePhrase("");
      return;
    }
    if (routePartnerId) {
      void loadDashboard(routePartnerId, "");
      return;
    }
    setSelectedId("");
    setDashboard(null);
    setDashboardError("");
  }, [isAdmin, routePartnerId, settingsMatch, deleteMatch, deletePartnerId]);

  const filteredPartners = useMemo(() => {
    const term = search.trim();
    if (!term) return data?.partners ?? [];
    return (data?.partners ?? []).filter((partner) => `${partner.name} ${partner.mobile}`.includes(term));
  }, [data?.partners, search]);

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground" dir="rtl">در حال بارگذاری...</main>;
  }

  if (!isAdmin) {
    return <main className="flex min-h-screen items-center justify-center bg-background p-4 text-center text-sm text-muted-foreground" dir="rtl">برای مشاهده این بخش باید با حساب مدیر وارد شوید.</main>;
  }

  const partnerPayload = (source: typeof emptyPartner) => ({
    ...source,
    first_payment_percent: Number(source.first_payment_percent),
    recurring_payment_percent: Number(source.recurring_payment_percent),
  });

  const submit = async () => {
    setSaving(true);
    const res = await api.customLanding.createPartner(partnerPayload(form));
    setSaving(false);
    if (!res.success) return toast({ variant: "destructive", title: "خطا", description: res.message });
    setForm(emptyPartner);
    toast({ title: "همکار ایجاد شد" });
    await load();
  };

  const updatePartner = async () => {
    if (!dashboard) return;
    setUpdating(true);
    const res = await api.customLanding.updatePartner(dashboard.partner.id, partnerPayload(editForm));
    setUpdating(false);
    if (!res.success) return toast({ variant: "destructive", title: "خطا", description: res.message });
    toast({ title: "اطلاعات همکار ذخیره شد" });
    await load();
    await loadDashboard(dashboard.partner.id);
  };

  const settle = async () => {
    if (!dashboard) return;
    const res = await api.customLanding.settle(dashboard.partner.id, { ...settlementForm, amount: Number(settlementForm.amount) });
    if (!res.success) return toast({ variant: "destructive", title: "خطا", description: res.message });
    setSettlementForm(emptySettlement);
    toast({ title: "واریز ثبت شد" });
    await load();
    await loadDashboard(dashboard.partner.id);
  };

  const refreshAfterAction = async (message: string) => {
    toast({ title: message });
    await load();
    if (selectedId) await loadDashboard(selectedId, search);
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    const res = await api.customLanding.updateSettings({
      title: settingsForm.title,
      headline: settingsForm.headline,
      description: settingsForm.description,
      button_label: settingsForm.buttonLabel,
      auto_token_enabled: settingsForm.autoTokenEnabled,
      redirect_home_enabled: settingsForm.redirectHomeEnabled,
      app_view_url: settingsForm.appViewUrl,
      web_app_url: settingsForm.webAppUrl,
      android_url: settingsForm.androidUrl,
      ios_url: settingsForm.iosUrl,
    });
    setSettingsSaving(false);
    if (!res.success) return toast({ variant: "destructive", title: "خطا", description: res.message });
    setSettingsForm(res.data);
    toast({ title: "تنظیمات لندینگ ذخیره شد" });
  };

  const uploadLogo = async (file: File | null) => {
    if (!file) return;
    setLogoSaving(true);
    const res = await api.customLanding.updateLogo({ logo: file });
    setLogoSaving(false);
    if (!res.success) return toast({ variant: "destructive", title: "خطا", description: res.message });
    setSettingsForm(res.data);
    toast({ title: "لوگو به روز شد" });
  };

  const setPartnerStatus = async (partnerId: string, status: "active" | "inactive") => {
    const partner = data?.partners.find((item) => item.id === partnerId);
    if (!partner) return;
    const res = await api.customLanding.updatePartner(partnerId, {
      name: partner.name,
      mobile: partner.mobile,
      status,
      first_payment_percent: partner.firstPaymentPercent,
      recurring_payment_percent: partner.recurringPaymentPercent,
      notes: partner.notes ?? "",
    });
    if (!res.success) return toast({ variant: "destructive", title: "خطا", description: res.message });
    toast({ title: status === "inactive" ? "همکار غیر فعال شد" : "همکار فعال شد" });
    await load();
  };

  const deletePartner = async () => {
    if (!dashboard) return;
    setDeletingPartner(true);
    const res = await api.customLanding.deletePartner(dashboard.partner.id, {
      confirm_partner_id: dashboard.partner.id,
      confirm_name: deleteName,
      confirm_phrase: deletePhrase,
    });
    setDeletingPartner(false);
    if (!res.success) return toast({ variant: "destructive", title: "خطا", description: res.message });
    toast({ title: "همکار حذف شد" });
    await load();
    setLocation("/panel/custom-landing");
  };

  const openPartnerDashboard = (partnerId: string) => {
    setLocation(`/panel/custom-landing/${partnerId}`);
  };

  const statCards: Array<[string, string | number, LucideIcon]> = [
    ["موجودی قابل برداشت", money(dashboard?.stats.availableAmount ?? data?.stats.availableAmount ?? 0), WalletCards],
    ["مجموع درآمد", money(dashboard?.stats.totalIncome ?? data?.stats.creditedAmount ?? 0), CreditCard],
    ["کاربران معرفی شده", dashboard?.stats.referredUsers ?? data?.stats.attributions ?? 0, Users],
    ["کاربرانی که رژیم گرفتند", dashboard?.stats.dietUsers ?? data?.stats.firstPayments ?? 0, NotebookPen],
  ];
  const waitingForPartnerDashboard = Boolean((routePartnerId || deletePartnerId) && !dashboard && !dashboardError);

  return (
    <main className="min-h-screen bg-background pb-10 text-foreground" dir="rtl">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <div>
            <h1 className="text-2xl font-black">{deleteMatch ? "حذف همکار" : settingsMatch ? "تنظیمات لندینگ" : dashboard ? `گزارش ${dashboard.partner.name}` : "لندینگ اختصاصی"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{deleteMatch ? "حذف کامل همکار فقط بعد از دو تایید انجام می‌شود" : settingsMatch ? "متن‌ها، لوگو و لینک‌های اپلیکیشن لندینگ اختصاصی" : dashboard ? "گزارش درآمد، کاربران، تراکنش‌ها و تسویه‌های همکار" : "لیست همکاران، ایجاد لینک اختصاصی و دسترسی به گزارش هر همکار"}</p>
          </div>
          {routePartnerId || settingsMatch || deleteMatch ? (
            <Button variant="outline" onClick={() => setLocation("/panel/custom-landing")}>بازگشت به لیست</Button>
          ) : (
            <Link href="/panel"><Button variant="outline" size="icon" title="بازگشت"><ArrowLeft className="h-5 w-5" /></Button></Link>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map(([label, value, Icon]) => (
            <Card key={String(label)}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div>
                <div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-lg font-black">{value}</div></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {deleteMatch ? (
          dashboardLoading || waitingForPartnerDashboard ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">در حال دریافت اطلاعات حذف...</CardContent></Card>
          ) : dashboardError ? (
            <Card>
              <CardContent className="space-y-4 p-8 text-center">
                <div className="font-bold text-destructive">اطلاعات حذف باز نشد</div>
                <div className="text-sm text-muted-foreground">{dashboardError}</div>
                <Button variant="outline" onClick={() => setLocation("/panel/custom-landing")}>بازگشت به لیست همکاران</Button>
              </CardContent>
            </Card>
          ) : dashboard ? (
            <section className="mx-auto max-w-3xl space-y-5">
              <Card className="border-destructive/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />حذف کامل {dashboard.partner.name}</CardTitle>
                  <CardDescription>این عملیات برگشت‌پذیر نیست و همه داده‌های مالی و معرفی این همکار پاک می‌شود.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoBox label="کاربران معرفی شده" value={`${dashboard.stats.referredUsers} نفر`} />
                    <InfoBox label="کاربرانی که رژیم گرفتند" value={`${dashboard.stats.dietUsers} نفر`} />
                    <InfoBox label="موجودی قابل برداشت" value={money(dashboard.stats.availableAmount)} />
                    <InfoBox label="مجموع درآمد" value={money(dashboard.stats.totalIncome)} />
                    <InfoBox label="کل تسویه شده" value={money(dashboard.stats.settledAmount)} />
                    <InfoBox label="تراکنش‌های حذف شده" value={money(dashboard.stats.reversedAmount)} />
                  </div>
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm leading-8 text-destructive">
                    با حذف این همکار، لینک دعوت، کاربران معرفی شده، تراکنش‌ها، تسویه‌ها و گزارش‌های وابسته به این همکار حذف می‌شود.
                  </div>
                  <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <input type="checkbox" checked={firstDeleteConfirmed} onChange={(event) => setFirstDeleteConfirmed(event.target.checked)} />
                    <span>تایید می‌کنم که خلاصه اطلاعات بالا را بررسی کرده‌ام.</span>
                  </label>
                  <div className="space-y-2">
                    <div className="text-sm font-bold">تایید دوم: نام همکار را دقیق وارد کنید</div>
                    <Input value={deleteName} onChange={(event) => setDeleteName(event.target.value)} placeholder={dashboard.partner.name} />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-bold">تایید نهایی: عبارت «حذف کامل» را وارد کنید</div>
                    <Input value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} placeholder="حذف کامل" />
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={!firstDeleteConfirmed || deleteName.trim() !== dashboard.partner.name.trim() || deletePhrase.trim() !== "حذف کامل" || deletingPartner}
                    onClick={deletePartner}
                  >
                    {deletingPartner ? "در حال حذف..." : "حذف کامل همکار و تمام داده‌ها"}
                  </Button>
                </CardContent>
              </Card>
            </section>
          ) : null
        ) : settingsMatch ? (
          <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>محتوای لندینگ</CardTitle>
                <CardDescription>این بخش برای تنظیمات فعلی و گزینه‌هایی است که بعداً اضافه می‌شوند.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="متن عنوان" value={settingsForm.title} onChange={(event) => setSettingsForm({ ...settingsForm, title: event.target.value })} />
                <Input placeholder="تیتر" value={settingsForm.headline} onChange={(event) => setSettingsForm({ ...settingsForm, headline: event.target.value })} />
                <Textarea rows={5} placeholder="توضیحات" value={settingsForm.description} onChange={(event) => setSettingsForm({ ...settingsForm, description: event.target.value })} />
                <Input placeholder="متن کلید ورود" value={settingsForm.buttonLabel} onChange={(event) => setSettingsForm({ ...settingsForm, buttonLabel: event.target.value })} />
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/35 p-4">
                  <div>
                    <div className="text-sm font-black text-foreground">ایجاد توکن اتوماتیک</div>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">اگر فعال باشد، بعد از تایید کد برای کاربر توکن اپلیکیشن ساخته می‌شود و به انتهای لینک وب‌اپلیکیشن و iOS اضافه می‌گردد تا کاربر دوباره لاگین نکند.</p>
                  </div>
                  <Switch checked={settingsForm.autoTokenEnabled} onCheckedChange={(checked) => setSettingsForm({ ...settingsForm, autoTokenEnabled: checked })} />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/35 p-4">
                  <div>
                    <div className="text-sm font-black text-foreground">نمایش به عنوان ریدایرکت به صفحه لندینگ</div>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">اگر فعال باشد، بازدیدکننده با باز کردن آدرس اصلی سایت به صورت خودکار وارد لندینگ اختصاصی می‌شود. ورود مدیر همیشه از مسیر /admin_login در دسترس است.</p>
                  </div>
                  <Switch checked={settingsForm.redirectHomeEnabled} onCheckedChange={(checked) => setSettingsForm({ ...settingsForm, redirectHomeEnabled: checked })} />
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-black text-foreground">لینک‌های انتخاب نسخه بعد از تایید کد</div>
                    <p className="mt-1 text-xs text-muted-foreground">هر لینکی خالی باشد، گزینه‌اش در صفحه کاربر نمایش داده نمی‌شود.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input dir="ltr" className="text-start" placeholder="آدرس اپلیکیشن برای مشاهده" value={settingsForm.appViewUrl} onChange={(event) => setSettingsForm({ ...settingsForm, appViewUrl: event.target.value })} />
                    <Input dir="ltr" className="text-start" placeholder="لینک وب اپلیکیشن" value={settingsForm.webAppUrl} onChange={(event) => setSettingsForm({ ...settingsForm, webAppUrl: event.target.value })} />
                    <Input dir="ltr" className="text-start" placeholder="لینک اندروید" value={settingsForm.androidUrl} onChange={(event) => setSettingsForm({ ...settingsForm, androidUrl: event.target.value })} />
                    <Input dir="ltr" className="text-start" placeholder="لینک iOS" value={settingsForm.iosUrl} onChange={(event) => setSettingsForm({ ...settingsForm, iosUrl: event.target.value })} />
                  </div>
                </div>
                <Button onClick={saveSettings} disabled={settingsSaving}>{settingsSaving ? "در حال ذخیره..." : "ذخیره تنظیمات"}</Button>
              </CardContent>
            </Card>

            <aside className="space-y-5">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ImagePlus className="h-5 w-5" />لوگوی لندینگ</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
                    {settingsForm.logoUrl ? <img src={settingsForm.logoUrl} alt="لوگو" className="h-16 w-16 rounded-lg object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary"><ImagePlus className="h-7 w-7" /></div>}
                    <div className="min-w-0 text-sm text-muted-foreground">لوگوی اختصاصی برای صفحه ورود لندینگ.</div>
                  </div>
                  <Input type="file" accept="image/*" disabled={logoSaving} onChange={(event) => void uploadLogo(event.target.files?.[0] ?? null)} />
                  {settingsForm.logoUrl ? <Button variant="outline" className="w-full" disabled={logoSaving} onClick={async () => { setLogoSaving(true); const res = await api.customLanding.updateLogo({ removeLogo: true }); setLogoSaving(false); if (res.success) { setSettingsForm(res.data); toast({ title: "لوگو حذف شد" }); } else toast({ variant: "destructive", title: "خطا", description: res.message }); }}>حذف لوگو</Button> : null}
                </CardContent>
              </Card>
              <Card className="overflow-hidden border-primary/30 bg-primary/5">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div><div className="font-black">پیش‌نمایش لینک‌ها</div><div className="mt-1 text-xs text-muted-foreground">برای کنترل سریع آدرس‌ها</div></div>
                    <ExternalLink className="h-5 w-5 text-primary" />
                  </div>
                  {[settingsForm.appViewUrl, settingsForm.webAppUrl, settingsForm.androidUrl, settingsForm.iosUrl].filter(Boolean).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="block truncate rounded-lg border bg-card px-3 py-2 text-sm" dir="ltr">{url}</a>)}
                </CardContent>
              </Card>
            </aside>
          </section>
        ) : dashboardLoading || waitingForPartnerDashboard ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">در حال دریافت گزارش همکار...</CardContent></Card>
        ) : dashboardError ? (
          <Card>
            <CardContent className="space-y-4 p-8 text-center">
              <div className="font-bold text-destructive">گزارش همکار باز نشد</div>
              <div className="text-sm text-muted-foreground">{dashboardError}</div>
              <Button variant="outline" onClick={() => setLocation("/panel/custom-landing")}>بازگشت به لیست همکاران</Button>
            </CardContent>
          </Card>
        ) : !dashboard ? (
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <aside className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />افزودن همکار</CardTitle>
                  <CardDescription>بعد از ثبت، همکار در لیست اصلی نمایش داده می‌شود.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="نام و نام خانوادگی" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <Input dir="ltr" placeholder="0912xxxxxxx" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input type="number" placeholder="درصد رژیم اول" value={form.first_payment_percent} onChange={(e) => setForm({ ...form, first_payment_percent: e.target.value })} />
                    <Input type="number" placeholder="درصد بعدی" value={form.recurring_payment_percent} onChange={(e) => setForm({ ...form, recurring_payment_percent: e.target.value })} />
                  </div>
                  <Textarea rows={3} placeholder="نوت مدیر" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  <Button className="w-full" disabled={saving || !form.name || !form.mobile} onClick={submit}>{saving ? "در حال ثبت..." : "ایجاد لینک اختصاصی"}</Button>
                </CardContent>
              </Card>

              <button type="button" onClick={() => setLocation("/panel/custom-landing/settings")} className="group relative w-full overflow-hidden rounded-xl border border-primary/30 bg-card p-5 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg">
                <div className="absolute inset-y-0 start-0 w-1 bg-primary" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-primary">قابل توسعه</div>
                    <div className="mt-2 text-xl font-black">تنظیمات لندینگ</div>
                    <div className="mt-2 text-sm leading-7 text-muted-foreground">متن‌ها، لوگو و لینک‌های اپلیکیشن را از اینجا مدیریت کنید.</div>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-3 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground"><Settings2 className="h-6 w-6" /></div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md border bg-background px-2 py-1 text-center">عنوان</span>
                  <span className="rounded-md border bg-background px-2 py-1 text-center">لوگو</span>
                  <span className="rounded-md border bg-background px-2 py-1 text-center">لینک‌ها</span>
                </div>
              </button>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />جستجو</CardTitle></CardHeader>
                <CardContent>
                  <Input placeholder="نام یا موبایل همکار" value={search} onChange={(e) => setSearch(e.target.value)} />
                </CardContent>
              </Card>
            </aside>

            <Card>
              <CardHeader>
                <CardTitle>همکاران</CardTitle>
                <CardDescription>برای مشاهده داشبورد کامل، روی ردیف همکار کلیک کنید.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredPartners.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">هنوز همکاری ثبت نشده است.</div>
                ) : filteredPartners.map((partner) => (
                  <div
                    key={partner.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openPartnerDashboard(partner.id)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openPartnerDashboard(partner.id); }}
                    className="grid w-full cursor-pointer gap-3 rounded-lg border bg-card p-4 text-start transition hover:border-primary/50 hover:bg-muted/40 md:grid-cols-[1.3fr_1fr_1fr_auto] md:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong>{partner.name}</strong>
                        {partner.isDirect ? <Badge variant="secondary">سیستمی</Badge> : null}
                        <Badge variant={partner.status === "active" ? "default" : "secondary"}>{partner.status === "active" ? "فعال" : "غیرفعال"}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground" dir="ltr">{partner.mobile}</div>
                    </div>
                    <Info label="کاربران" value={`${partner.attributionsCount} نفر`} />
                    <Info label="موجودی" value={money(partner.availableAmount)} />
                    <div className="flex flex-wrap gap-2">
                      {!partner.isDirect ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title={partner.status === "active" ? "غیر فعال کردن" : "فعال کردن"}
                            onClick={(event) => { event.stopPropagation(); void setPartnerStatus(partner.id, partner.status === "active" ? "inactive" : "active"); }}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="حذف همکار"
                            onClick={(event) => { event.stopPropagation(); setLocation(`/panel/custom-landing/${partner.id}/delete`); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="outline" size="icon" title="کپی لینک دعوت" onClick={(event) => { event.stopPropagation(); void navigator.clipboard.writeText(partner.url); toast({ title: "لینک دعوت کپی شد" }); }}><Copy className="h-4 w-4" /></Button>
                          <a href={partner.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><Button type="button" variant="outline" size="icon" title="باز کردن لینک"><Link2 className="h-4 w-4" /></Button></a>
                        </>
                      ) : <span className="text-xs text-muted-foreground">گروه پیش‌فرض بدون لینک دعوت</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <section className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
              <Card>
                <CardHeader><CardTitle>جزئیات و مدیریت همکار</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  <Input dir="ltr" value={editForm.mobile} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} />
                  <Input type="number" value={editForm.first_payment_percent} onChange={(e) => setEditForm({ ...editForm, first_payment_percent: e.target.value })} />
                  <Input type="number" value={editForm.recurring_payment_percent} onChange={(e) => setEditForm({ ...editForm, recurring_payment_percent: e.target.value })} />
                  <select className="h-10 rounded-md border bg-background px-3 text-sm" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="active">فعال</option>
                    <option value="inactive">غیرفعال</option>
                  </select>
                  <div className="flex gap-2">
                    {!dashboard.partner.isDirect ? (
                      <>
                        <Button variant="outline" size="icon" title="کپی لینک دعوت" onClick={() => { void navigator.clipboard.writeText(dashboard.partner.url); toast({ title: "لینک دعوت کپی شد" }); }}><Copy className="h-4 w-4" /></Button>
                        <a href={dashboard.partner.url} target="_blank" rel="noreferrer"><Button variant="outline" size="icon" title="باز کردن لینک"><Link2 className="h-4 w-4" /></Button></a>
                      </>
                    ) : null}
                    <Button className="flex-1" disabled={updating} onClick={updatePartner}>{updating ? "در حال ذخیره..." : "ذخیره تغییرات"}</Button>
                  </div>
                  <Textarea className="md:col-span-2" rows={4} placeholder="نوت مدیر" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>ثبت واریز</CardTitle><CardDescription>برداشت/تسویه از موجودی قابل پرداخت</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  <Input type="number" placeholder="مبلغ" value={settlementForm.amount} onChange={(e) => setSettlementForm({ ...settlementForm, amount: e.target.value })} />
                  <Input placeholder="روش پرداخت" value={settlementForm.payment_method} onChange={(e) => setSettlementForm({ ...settlementForm, payment_method: e.target.value })} />
                  <Input placeholder="شماره پیگیری" value={settlementForm.payment_reference} onChange={(e) => setSettlementForm({ ...settlementForm, payment_reference: e.target.value })} />
                  <DatePicker
                    value={settlementForm.paid_at ? new DateObject({ date: toSafeDate(settlementForm.paid_at), calendar: pickerCalendar, locale: pickerLocale }) : null}
                    onChange={(value) => {
                      const selected = value as DateObject | null;
                      setSettlementForm({
                        ...settlementForm,
                        paid_at: selected?.isValid ? format(selected.toDate(), "yyyy-MM-dd") : "",
                      });
                    }}
                    calendar={pickerCalendar}
                    locale={pickerLocale}
                    calendarPosition={calendarPosition}
                    format="YYYY/MM/DD"
                    containerClassName="w-full"
                    inputClass="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-start text-sm text-foreground"
                  />
                  <Textarea rows={2} placeholder="توضیح" value={settlementForm.note} onChange={(e) => setSettlementForm({ ...settlementForm, note: e.target.value })} />
                  <Button className="w-full" disabled={!settlementForm.amount} onClick={settle}>ثبت واریز</Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />جستجو در گزارش</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2 sm:flex-row">
                <Input placeholder="نام، موبایل، رسید یا نوت" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void loadDashboard(); }} />
                <Button variant="outline" onClick={() => void loadDashboard()}>اعمال جستجو</Button>
              </CardContent>
            </Card>

            <div className="grid gap-5 xl:grid-cols-2">
              <ListCard title="آخرین کاربران">
                {dashboard.users.map((user) => (
                  <Row key={user.id} title={user.name || "بدون نام"} subtitle={`${user.mobile || "-"} | ثبت: ${date(user.registeredAt)} | اولین رژیم: ${date(user.firstPaidAt)}`} action={<Button variant="ghost" size="icon" title="حذف کاربر" onClick={async () => { const res = await api.customLanding.deleteAttribution(user.id); if (res.success) await refreshAfterAction("کاربر حذف شد"); else toast({ variant: "destructive", title: "خطا", description: res.message }); }}><Trash2 className="h-4 w-4" /></Button>} />
                ))}
              </ListCard>
              <ListCard title="آخرین تراکنش‌ها">
                {dashboard.commissions.map((item) => (
                  <Row key={item.id} title={`${item.userName || item.userMobile || "-"} | ${item.paymentKind === "first_payment" ? "رژیم اول" : "رژیم بعدی"}`} subtitle={`${money(item.amount)} از ${money(item.grossAmount)} | ${item.percent}% | ${date(item.paidAt)} | ${item.status === "credited" ? "موثر" : "حذف شده"}`} action={item.status === "credited" ? <Button variant="ghost" size="icon" title="حذف تراکنش" onClick={async () => { const res = await api.customLanding.deleteCommission(item.id, "حذف از داشبورد مدیر"); if (res.success) await refreshAfterAction("تراکنش حذف شد"); else toast({ variant: "destructive", title: "خطا", description: res.message }); }}><Trash2 className="h-4 w-4" /></Button> : null} />
                ))}
              </ListCard>
              <ListCard title="آخرین واریزها / برداشت‌ها">
                {dashboard.settlements.map((item) => (
                  <Row key={item.id} title={money(item.amount)} subtitle={`${item.paymentMethod || "-"} | ${item.paymentReference || "-"} | ${date(item.paidAt)}${item.note ? ` | ${item.note}` : ""}`} action={<Button variant="ghost" size="icon" title="حذف واریز" onClick={async () => { const res = await api.customLanding.deleteSettlement(item.id); if (res.success) await refreshAfterAction("واریز حذف شد"); else toast({ variant: "destructive", title: "خطا", description: res.message }); }}><Trash2 className="h-4 w-4" /></Button>} />
                ))}
              </ListCard>
              <ListCard title="خلاصه درآمد">
                <Row title="واریزی بابت رژیم اول" subtitle={money(dashboard.stats.firstPaymentIncome)} />
                <Row title="واریزی رژیم اول به بعد" subtitle={money(dashboard.stats.recurringPaymentIncome)} />
                <Row title="کل تسویه شده" subtitle={money(dashboard.stats.settledAmount)} />
                <Row title="تراکنش‌های حذف شده" subtitle={money(dashboard.stats.reversedAmount)} />
              </ListCard>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-bold">{value}</div></div>;
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-lg font-black">{value}</div>
    </div>
  );
}

function ListCard({ title, children }: { title: string; children: ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-2">{children}</CardContent></Card>;
}

function Row({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
      <div className="min-w-0"><div className="truncate font-bold">{title}</div><div className="mt-1 text-xs text-muted-foreground">{subtitle}</div></div>
      {action}
    </div>
  );
}
