import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, Copy, CreditCard, Link2, NotebookPen, Plus, Search, Trash2, Users, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { CustomLandingOverview, CustomLandingPartnerDashboard } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const emptyPartner = { name: "", mobile: "", first_payment_percent: "90", recurring_payment_percent: "20", status: "active", notes: "" };
const emptySettlement = { amount: "", payment_method: "", payment_reference: "", paid_at: new Date().toISOString().slice(0, 10), note: "" };

export default function PanelCustomLandingPage() {
  const { isPrimaryAdmin } = useAuth();
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

  const money = (value: number) => `${new Intl.NumberFormat("fa-IR").format(value || 0)} تومان`;
  const date = (value?: string | null) => value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "-";

  const load = async () => {
    const res = await api.customLanding.overview();
    if (res.success) setData(res.data);
    else toast({ variant: "destructive", title: "خطا", description: res.message });
  };

  const loadDashboard = async (partnerId = selectedId, term = search) => {
    if (!partnerId) return;
    const res = await api.customLanding.partnerDashboard(partnerId, term);
    if (!res.success) return toast({ variant: "destructive", title: "خطا", description: res.message });
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
  };

  useEffect(() => { if (isPrimaryAdmin) void load(); }, [isPrimaryAdmin]);

  const filteredPartners = useMemo(() => {
    const term = search.trim();
    if (!term) return data?.partners ?? [];
    return (data?.partners ?? []).filter((partner) => `${partner.name} ${partner.mobile}`.includes(term));
  }, [data?.partners, search]);

  if (!isPrimaryAdmin) return null;

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

  const statCards: Array<[string, string | number, LucideIcon]> = [
    ["موجودی قابل برداشت", money(dashboard?.stats.availableAmount ?? data?.stats.availableAmount ?? 0), WalletCards],
    ["مجموع درآمد", money(dashboard?.stats.totalIncome ?? data?.stats.creditedAmount ?? 0), CreditCard],
    ["کاربران معرفی شده", dashboard?.stats.referredUsers ?? data?.stats.attributions ?? 0, Users],
    ["کاربرانی که رژیم گرفتند", dashboard?.stats.dietUsers ?? data?.stats.firstPayments ?? 0, NotebookPen],
  ];

  return (
    <main className="min-h-screen bg-background pb-10 text-foreground" dir="rtl">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <div>
            <h1 className="text-2xl font-black">{dashboard ? `گزارش ${dashboard.partner.name}` : "لندینگ اختصاصی"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{dashboard ? "گزارش درآمد، کاربران، تراکنش‌ها و تسویه‌های همکار" : "لیست همکاران، ایجاد لینک اختصاصی و دسترسی به گزارش هر همکار"}</p>
          </div>
          {dashboard ? (
            <Button variant="outline" onClick={() => { setDashboard(null); setSelectedId(""); }}>بازگشت به لیست</Button>
          ) : (
            <Link href="/panel"><Button variant="outline" size="icon" title="بازگشت"><ArrowRight className="h-5 w-5" /></Button></Link>
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

        {!dashboard ? (
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
                  <button key={partner.id} onClick={() => void loadDashboard(partner.id, "")} className="grid w-full gap-3 rounded-lg border bg-card p-4 text-start transition hover:border-primary/50 hover:bg-muted/40 md:grid-cols-[1.3fr_1fr_1fr_auto] md:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong>{partner.name}</strong>
                        <Badge variant={partner.status === "active" ? "default" : "secondary"}>{partner.status === "active" ? "فعال" : "غیرفعال"}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground" dir="ltr">{partner.mobile}</div>
                    </div>
                    <Info label="کاربران" value={`${partner.attributionsCount} نفر`} />
                    <Info label="موجودی" value={money(partner.availableAmount)} />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="icon" title="کپی لینک" onClick={(event) => { event.stopPropagation(); void navigator.clipboard.writeText(partner.url); toast({ title: "لینک کپی شد" }); }}><Copy className="h-4 w-4" /></Button>
                      <a href={partner.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><Button type="button" variant="outline" size="icon" title="باز کردن لینک"><Link2 className="h-4 w-4" /></Button></a>
                    </div>
                  </button>
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
                    <Button variant="outline" size="icon" title="کپی لینک" onClick={() => { void navigator.clipboard.writeText(dashboard.partner.url); toast({ title: "لینک کپی شد" }); }}><Copy className="h-4 w-4" /></Button>
                    <a href={dashboard.partner.url} target="_blank" rel="noreferrer"><Button variant="outline" size="icon" title="باز کردن لینک"><Link2 className="h-4 w-4" /></Button></a>
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
                  <Input type="date" value={settlementForm.paid_at} onChange={(e) => setSettlementForm({ ...settlementForm, paid_at: e.target.value })} />
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
