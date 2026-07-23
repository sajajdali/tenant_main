import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Pencil, Plus, TicketPercent, Trash2, UserRound, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NutritionDiscountCodeItem } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { CodeText, PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function getStatusBadgeClass(item: NutritionDiscountCodeItem) {
  switch (item.status) {
    case "exhausted":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "manual_inactive":
      return "border-rose-400/20 bg-rose-400/10 text-rose-300";
    default:
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  }
}

export default function PanelNutritionDiscountsPage() {
  const { isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [items, setItems] = useState<NutritionDiscountCodeItem[]>([]);

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [editItem, setEditItem] = useState<NutritionDiscountCodeItem | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDiscountType, setEditDiscountType] = useState<"percent" | "fixed">("percent");
  const [editDiscountValue, setEditDiscountValue] = useState("10");
  const [editMaxUses, setEditMaxUses] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const loadItems = async () => {
    setLoading(true);
    const result = await api.nutritionDiscountCodes.list();
    if (result.success) {
      setItems(result.data.items);
    } else {
      toast({ variant: "destructive", title: t("panelNutritionDiscounts.toast.loadFailed"), description: result.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isLoading || !isAdmin) {
      return;
    }
    void loadItems();
  }, [isAdmin, isLoading]);

  const dashboard = useMemo(() => {
    const totalCodes = items.length;
    const activeCodes = items.filter((item) => item.status === "active").length;
    const exhaustedCodes = items.filter((item) => item.status === "exhausted").length;
    const manualInactiveCodes = items.filter((item) => item.status === "manual_inactive").length;
    const totalUses = items.reduce((sum, item) => sum + item.usedCount, 0);

    return { totalCodes, activeCodes, exhaustedCodes, manualInactiveCodes, totalUses };
  }, [items]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("panelNutritionDiscounts.loading.prepare")}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelNutritionDiscounts.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelNutritionDiscounts.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelNutritionDiscounts.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("panelNutritionDiscounts.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("panelNutritionDiscounts.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              {isRtl ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">{t("panelNutritionDiscounts.stats.totalCodes")}</div>
              <div className="mt-3 text-3xl font-black">{format.number(dashboard.totalCodes)}</div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="p-5">
              <div className="text-sm text-emerald-300">{t("panelNutritionDiscounts.stats.active")}</div>
              <div className="mt-3 text-3xl font-black text-emerald-200">{format.number(dashboard.activeCodes)}</div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-5">
              <div className="text-sm text-amber-300">{t("panelNutritionDiscounts.stats.exhausted")}</div>
              <div className="mt-3 text-3xl font-black text-amber-200">{format.number(dashboard.exhaustedCodes)}</div>
            </CardContent>
          </Card>
          <Card className="border-rose-500/20 bg-rose-500/5">
            <CardContent className="p-5">
              <div className="text-sm text-rose-300">{t("panelNutritionDiscounts.stats.manualInactive")}</div>
              <div className="mt-3 text-3xl font-black text-rose-200">{format.number(dashboard.manualInactiveCodes)}</div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">{t("panelNutritionDiscounts.stats.totalUses")}</div>
              <div className="mt-3 text-3xl font-black">{format.number(dashboard.totalUses)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("panelNutritionDiscounts.create.title")}</CardTitle>
              <CardDescription>{t("panelNutritionDiscounts.create.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discount-code">{t("panelNutritionDiscounts.fields.code")}</Label>
                <Input id="discount-code" dir="ltr" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder={t("panelNutritionDiscounts.placeholders.code")} className="text-start" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount-title">{t("panelNutritionDiscounts.fields.title")}</Label>
                <Input id="discount-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("panelNutritionDiscounts.placeholders.title")} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("panelNutritionDiscounts.fields.discountType")}</Label>
                  <select
                    value={discountType}
                    onChange={(event) => setDiscountType(event.target.value as "percent" | "fixed")}
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="percent">{t("panelNutritionDiscounts.discountType.percent")}</option>
                    <option value="fixed">{t("panelNutritionDiscounts.discountType.fixed")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount-value">{t("panelNutritionDiscounts.fields.discountValue")}</Label>
                  <Input id="discount-value" type="number" min="1" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount-max-uses">{t("panelNutritionDiscounts.fields.maxUses")}</Label>
                <Input id="discount-max-uses" type="number" min="1" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} placeholder={t("panelNutritionDiscounts.placeholders.optional")} />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/30 px-4 py-3">
                <div>
                  <div className="font-bold">{t("panelNutritionDiscounts.fields.active")}</div>
                  <div className="text-xs text-muted-foreground">{t("panelNutritionDiscounts.create.activeDescription")}</div>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <Button
                className="w-full"
                disabled={!code.trim() || Number(discountValue) <= 0 || submitting}
                onClick={async () => {
                  setSubmitting(true);
                  const result = await api.nutritionDiscountCodes.create({
                    code,
                    title,
                    discountType,
                    discountValue: Number(discountValue) || 0,
                    maxUses: maxUses.trim() === "" ? null : Number(maxUses),
                    isActive,
                  });
                  setSubmitting(false);

                  if (!result.success) {
                    toast({ variant: "destructive", title: t("panelNutritionDiscounts.toast.createFailed"), description: result.message });
                    return;
                  }

                  toast({ title: t("panelNutritionDiscounts.toast.createSuccess"), description: result.message });
                  setCode("");
                  setTitle("");
                  setDiscountType("percent");
                  setDiscountValue("10");
                  setMaxUses("");
                  setIsActive(true);
                  await loadItems();
                }}
              >
                <Plus className="me-2 h-4 w-4" />
                {t("panelNutritionDiscounts.create.submit")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("panelNutritionDiscounts.dashboard.title")}</CardTitle>
              <CardDescription>{t("panelNutritionDiscounts.dashboard.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  <Loader2 className="me-2 h-5 w-5 animate-spin" />
                  {t("panelNutritionDiscounts.loading.list")}
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-border/70 bg-background/20 px-6 py-16 text-center text-muted-foreground">
                  {t("panelNutritionDiscounts.empty")}
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => {
                    const statusBadgeClass = getStatusBadgeClass(item);
                    const statusLabel =
                      item.status === "exhausted"
                        ? t("panelNutritionDiscounts.status.exhausted")
                        : item.status === "manual_inactive"
                          ? t("panelNutritionDiscounts.status.manualInactive")
                          : t("panelNutritionDiscounts.status.active");
                    return (
                      <div key={item.id} className="rounded-[2rem] border border-border/70 bg-background/25 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <CodeText className="font-black">{item.code}</CodeText>
                              <Badge className={statusBadgeClass}>{statusLabel}</Badge>
                              {item.title ? <Badge variant="outline">{item.title}</Badge> : null}
                            </div>
                            <div className="text-sm text-muted-foreground">{item.statusReason}</div>
                          </div>
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <TicketPercent className="h-5 w-5" />
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <div className="rounded-2xl border border-border/70 bg-background/35 p-3">
                            <div className="text-xs text-muted-foreground">{t("panelNutritionDiscounts.card.discountType")}</div>
                            <div className="mt-2 font-black">{item.discountType === "percent" ? t("panelNutritionDiscounts.discountType.percent") : t("panelNutritionDiscounts.discountType.fixed")}</div>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background/35 p-3">
                            <div className="text-xs text-muted-foreground">{t("panelNutritionDiscounts.card.discountValue")}</div>
                            <div className="mt-2 font-black">
                              {item.discountType === "percent" ? format.percent(item.discountValue / 100) : format.currency(item.discountValue)}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background/35 p-3">
                            <div className="text-xs text-muted-foreground">{t("panelNutritionDiscounts.card.usedCount")}</div>
                            <div className="mt-2 font-black">{format.number(item.usedCount)}</div>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background/35 p-3">
                            <div className="text-xs text-muted-foreground">{t("panelNutritionDiscounts.card.maxUses")}</div>
                            <div className="mt-2 font-black">{item.maxUses == null ? t("panelNutritionDiscounts.value.unlimited") : format.number(item.maxUses)}</div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[1.5rem] border border-border/70 bg-background/30 p-4">
                          <div className="flex items-center gap-2 text-sm font-bold">
                            <UserRound className="h-4 w-4 text-primary" />
                            {t("panelNutritionDiscounts.usedBy.title")}
                          </div>
                          {item.usedBy && item.usedBy.length > 0 ? (
                            <div className="mt-4 space-y-3">
                              {item.usedBy.map((used) => (
                                <div key={used.orderId} className="rounded-2xl border border-border/70 bg-background/35 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="font-bold">{used.name || t("panelNutritionDiscounts.usedBy.noName")}</div>
                                    <div className="text-xs text-muted-foreground">{used.mobile ? <PhoneText>{used.mobile}</PhoneText> : t("panelNutritionDiscounts.usedBy.noPhone")}</div>
                                  </div>
                                  <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                                    <div>
                                      <span className="text-muted-foreground">{t("panelNutritionDiscounts.usedBy.package")}:</span>{" "}
                                      <span className="font-medium">{used.packageName || t("panelNutritionDiscounts.value.emptyDash")}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">{t("panelNutritionDiscounts.usedBy.amount")}:</span>{" "}
                                      <span className="font-medium">{format.currency(used.payableAmount)}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">{t("panelNutritionDiscounts.usedBy.date")}:</span>{" "}
                                      <span className="font-medium">{used.paidAt ? format.date(used.paidAt) : t("panelNutritionDiscounts.value.emptyDash")}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-3 text-sm text-muted-foreground">{t("panelNutritionDiscounts.usedBy.empty")}</div>
                          )}
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setEditItem(item);
                              setEditCode(item.code);
                              setEditTitle(item.title ?? "");
                              setEditDiscountType(item.discountType);
                              setEditDiscountValue(String(item.discountValue));
                              setEditMaxUses(item.maxUses === null ? "" : String(item.maxUses));
                              setEditIsActive(item.isActive);
                            }}
                          >
                            <Pencil className="me-2 h-4 w-4" />
                            {t("panelNutritionDiscounts.actions.edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={deletingId === item.id}
                            onClick={async () => {
                              setDeletingId(item.id);
                              const result = await api.nutritionDiscountCodes.delete(item.id);
                              setDeletingId(null);

                              if (!result.success) {
                                toast({ variant: "destructive", title: t("panelNutritionDiscounts.toast.deleteFailed"), description: result.message });
                                return;
                              }

                              toast({ title: t("panelNutritionDiscounts.toast.deleteSuccess"), description: result.message });
                              await loadItems();
                            }}
                          >
                            {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent dir={dir} className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("panelNutritionDiscounts.edit.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("panelNutritionDiscounts.fields.code")}</Label>
              <Input dir="ltr" value={editCode} onChange={(event) => setEditCode(event.target.value.toUpperCase())} className="text-start" />
            </div>
            <div className="space-y-2">
              <Label>{t("panelNutritionDiscounts.fields.title")}</Label>
              <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("panelNutritionDiscounts.fields.discountType")}</Label>
                <select
                  value={editDiscountType}
                  onChange={(event) => setEditDiscountType(event.target.value as "percent" | "fixed")}
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="percent">{t("panelNutritionDiscounts.discountType.percent")}</option>
                  <option value="fixed">{t("panelNutritionDiscounts.discountType.fixed")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("panelNutritionDiscounts.fields.discountValue")}</Label>
                <Input type="number" min="1" value={editDiscountValue} onChange={(event) => setEditDiscountValue(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("panelNutritionDiscounts.fields.maxUses")}</Label>
              <Input type="number" min="1" value={editMaxUses} onChange={(event) => setEditMaxUses(event.target.value)} placeholder={t("panelNutritionDiscounts.placeholders.optional")} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/30 px-4 py-3">
              <div>
                <div className="font-bold">{t("panelNutritionDiscounts.fields.active")}</div>
                <div className="text-xs text-muted-foreground">{t("panelNutritionDiscounts.edit.activeDescription")}</div>
              </div>
              <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
            </div>
            {editItem?.status === "exhausted" ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-sm text-amber-200">
                <XCircle className="mt-0.5 h-4 w-4" />
                {t("panelNutritionDiscounts.edit.exhaustedWarning")}
              </div>
            ) : null}
            {editItem?.status === "active" ? (
              <div className="flex items-start gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
                {t("panelNutritionDiscounts.edit.activeInfo")}
              </div>
            ) : null}
            <Button
              className="w-full"
              disabled={!editItem || !editCode.trim() || Number(editDiscountValue) <= 0 || submitting}
              onClick={async () => {
                if (!editItem) {
                  return;
                }

                setSubmitting(true);
                const result = await api.nutritionDiscountCodes.update(editItem.id, {
                  code: editCode,
                  title: editTitle,
                  discountType: editDiscountType,
                  discountValue: Number(editDiscountValue) || 0,
                  maxUses: editMaxUses.trim() === "" ? null : Number(editMaxUses),
                  isActive: editIsActive,
                });
                setSubmitting(false);

                if (!result.success) {
                  toast({ variant: "destructive", title: t("panelNutritionDiscounts.toast.updateFailed"), description: result.message });
                  return;
                }

                toast({ title: t("panelNutritionDiscounts.toast.updateSuccess"), description: result.message });
                setEditItem(null);
                await loadItems();
              }}
            >
              {t("panelNutritionDiscounts.edit.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
