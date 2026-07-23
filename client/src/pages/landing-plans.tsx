import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { BadgeCheck, Check, CircleHelp, House, Info, LayoutGrid, ListChecks, Menu, Phone, PhoneCall, ReceiptText, SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { LandingCheckoutQuote, SupportRenewalPackage } from "@/lib/types";
import { getLandingHeaderMenuItems, getLandingPath, getLandingSiteSettings } from "@/lib/landing-site";
import { useLandingAuth } from "@/lib/landing-auth";
import { LandingAuthDialog } from "@/components/landing-auth-dialog";
import { LandingAuthButton } from "@/components/landing-auth-button";
import { DiscountCodeDialog } from "@/components/discount-code-dialog";
import { CodeText, PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { PellehCheckoutSteps } from "@/components/pelleh-checkout-steps";

const submitGatewayForm = (redirectForm: { action: string; method: string; inputs: Record<string, string> }) => {
  const form = document.createElement("form");
  form.action = redirectForm.action;
  form.method = (redirectForm.method || "POST").toUpperCase();
  form.style.display = "none";

  Object.entries(redirectForm.inputs || {}).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
};

const userLimitKey = (value?: number | null) => (value == null ? "unlimited" : String(value));

export default function LandingPlansPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const bootstrapMeta = getInitialTenantMeta();
  const landingSiteSettings = getLandingSiteSettings();
  const { customer } = useLandingAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [packages, setPackages] = useState<SupportRenewalPackage[]>([]);
  const [unitLabel, setUnitLabel] = useState(() => t("landingPlans.defaultUnit"));
  const [selectedUserLimitKey, setSelectedUserLimitKey] = useState<string>("");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [showAllPackagesMatrix, setShowAllPackagesMatrix] = useState(false);
  const [loading, setLoading] = useState(true);
  const [useOwnDomain, setUseOwnDomain] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState<string | null>(null);
  const [quote, setQuote] = useState<LandingCheckoutQuote | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const durationStepRef = useRef<HTMLElement | null>(null);
  const summaryStepRef = useRef<HTMLElement | null>(null);

  const iconMap = { home: House, about: Info, features: LayoutGrid, plans: ListChecks, faq: CircleHelp, contact: PhoneCall, orders: ReceiptText } as const;
  const headerMenuItems = getLandingHeaderMenuItems().map((item) => ({ ...item, icon: iconMap[item.key] ?? House }));
  const phoneNumbers = landingSiteSettings.contactPhones;
  const pageSettings = (bootstrapMeta?.landingPages?.plans?.settings ?? {}) as Record<string, unknown>;

  const userLimitOptions = useMemo(() => {
    const map = new Map<string, { key: string; userLimit: number | null; label: string }>();
    for (const item of packages) {
      const key = userLimitKey(item.userLimit ?? null);
      if (map.has(key)) continue;
      map.set(key, {
        key,
        userLimit: item.userLimit ?? null,
        label:
          item.userLimitLabel || (item.userLimit == null ? t("landingPlans.unlimited") : format.number(item.userLimit)),
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.userLimit == null) return 1;
      if (b.userLimit == null) return -1;
      return (a.userLimit ?? 0) - (b.userLimit ?? 0);
    });
  }, [format, packages, t]);

  const packagesForSelectedLimit = useMemo(
    () =>
      packages
        .filter((item) => userLimitKey(item.userLimit ?? null) === selectedUserLimitKey)
        .sort((a, b) => a.durationDays - b.durationDays),
    [packages, selectedUserLimitKey],
  );

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === selectedPackageId) ?? null,
    [packages, selectedPackageId],
  );
  const profileCompleted = !!customer?.firstName?.trim() && !!customer?.lastName?.trim();

  const matrixDurations = useMemo(() => {
    const set = new Set<number>();
    for (const item of packages) {
      set.add(item.durationDays);
    }
    return Array.from(set.values()).sort((a, b) => a - b);
  }, [packages]);

  const matrixPrice = (durationDays: number, limitKey: string) => {
    const found = packages.find(
      (pkg) => pkg.durationDays === durationDays && userLimitKey(pkg.userLimit ?? null) === limitKey,
    );
    if (!found) return null;
    return found.payableAmount;
  };

  const formatMoney = (amount?: number | null) => amount == null ? t("landingPlans.valueMissing") : format.currency(amount);
  const formatDurationDays = (days: number) => t("landingPlans.durationDays", { count: format.number(days) });
  const formatUserLimitLabel = (label?: string | null) => label || t("landingPlans.unlimited");

  const dynamicTexts = useMemo(() => ({
    badgeText: typeof pageSettings.badgeText === "string" && pageSettings.badgeText.trim() !== "" ? pageSettings.badgeText : t("landingPlans.badge"),
    pageTitle: typeof pageSettings.pageTitle === "string" && pageSettings.pageTitle.trim() !== "" ? pageSettings.pageTitle : t("landingPlans.title", { unit: unitLabel }),
    introLines: Array.isArray(pageSettings.introLines)
      ? pageSettings.introLines.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, 5)
      : [
          t("landingPlans.intro.1", { unit: unitLabel }),
          t("landingPlans.intro.2"),
          t("landingPlans.intro.3"),
          t("landingPlans.intro.4"),
          t("landingPlans.intro.5"),
        ],
    stepOneTitle: typeof pageSettings.stepOneTitle === "string" && pageSettings.stepOneTitle.trim() !== "" ? pageSettings.stepOneTitle : t("landingPlans.stepOne.title", { unit: unitLabel }),
    stepOneDescription: typeof pageSettings.stepOneDescription === "string" && pageSettings.stepOneDescription.trim() !== "" ? pageSettings.stepOneDescription : t("landingPlans.stepOne.description"),
    stepTwoTitle: typeof pageSettings.stepTwoTitle === "string" && pageSettings.stepTwoTitle.trim() !== "" ? pageSettings.stepTwoTitle : t("landingPlans.stepTwo.title"),
    stepTwoDescription: typeof pageSettings.stepTwoDescription === "string" && pageSettings.stepTwoDescription.trim() !== "" ? pageSettings.stepTwoDescription : t("landingPlans.stepTwo.description"),
    summaryTitle: typeof pageSettings.summaryTitle === "string" && pageSettings.summaryTitle.trim() !== "" ? pageSettings.summaryTitle : t("landingPlans.summary.title"),
    matrixOpenLabel: typeof pageSettings.matrixOpenLabel === "string" && pageSettings.matrixOpenLabel.trim() !== "" ? pageSettings.matrixOpenLabel : t("landingPlans.matrix.open"),
    matrixCloseLabel: typeof pageSettings.matrixCloseLabel === "string" && pageSettings.matrixCloseLabel.trim() !== "" ? pageSettings.matrixCloseLabel : t("landingPlans.matrix.close"),
    ctaTitle: typeof pageSettings.ctaTitle === "string" && pageSettings.ctaTitle.trim() !== "" ? pageSettings.ctaTitle : t("landingPlans.cta.title"),
    ctaDescription: typeof pageSettings.ctaDescription === "string" && pageSettings.ctaDescription.trim() !== "" ? pageSettings.ctaDescription : t("landingPlans.cta.description", { unit: unitLabel }),
    ctaPrimaryText: typeof pageSettings.ctaPrimaryText === "string" && pageSettings.ctaPrimaryText.trim() !== "" ? pageSettings.ctaPrimaryText : t("landingPlans.cta.primary"),
    ctaSecondaryText: typeof pageSettings.ctaSecondaryText === "string" && pageSettings.ctaSecondaryText.trim() !== "" ? pageSettings.ctaSecondaryText : t("landingPlans.cta.secondary"),
    phoneModalTitle: typeof pageSettings.phoneModalTitle === "string" && pageSettings.phoneModalTitle.trim() !== "" ? pageSettings.phoneModalTitle : t("landingPlans.phoneModal.title"),
    phoneModalDescription: typeof pageSettings.phoneModalDescription === "string" && pageSettings.phoneModalDescription.trim() !== "" ? pageSettings.phoneModalDescription : t("landingPlans.phoneModal.description"),
    footerText: typeof pageSettings.footerText === "string" && pageSettings.footerText.trim() !== "" ? pageSettings.footerText : t("landingPlans.footer"),
    loadingText: typeof pageSettings.loadingText === "string" && pageSettings.loadingText.trim() !== "" ? pageSettings.loadingText : t("landingPlans.loading"),
  }), [pageSettings, t, unitLabel]);

  useEffect(() => {
    document.title = t("landingPlans.documentTitle", { siteTitle: landingSiteSettings.siteTitle });

    let descriptionTag = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.setAttribute("name", "description");
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute(
      "content",
      t("landingPlans.metaDescription"),
    );

    if (bootstrapMeta?.isLandingDomain && bootstrapMeta.landingPackages) {
      const nextPackages = bootstrapMeta.landingPackages;
      setPackages(nextPackages);
      const pluralLabel = bootstrapMeta.audience?.pluralLabel?.trim();
      if (pluralLabel) {
        setUnitLabel(pluralLabel);
      }
      const searchParams = new URLSearchParams(window.location.search);
      const userLimitParam = searchParams.get("users");
      const durationParam = Number(searchParams.get("duration") || "0");
      if (userLimitParam) {
        setSelectedUserLimitKey(userLimitParam);

        if (durationParam > 0) {
          const matchedPackage = nextPackages.find(
            (item) =>
              userLimitKey(item.userLimit ?? null) === userLimitParam &&
              item.durationDays === durationParam,
          );

          if (matchedPackage) {
            setSelectedPackageId(matchedPackage.id);
          }
        }
      }
      setLoading(false);
      return;
    }

    api.supportRenewal.publicPackages().then((res) => {
      if (!res.success) {
        setLoading(false);
        return;
      }

      const nextPackages = res.data.packages;
      setPackages(nextPackages);
      const pluralLabel = res.data.audience?.pluralLabel?.trim();
      if (pluralLabel) {
        setUnitLabel(pluralLabel);
      }
      const searchParams = new URLSearchParams(window.location.search);
      const userLimitParam = searchParams.get("users");
      const durationParam = Number(searchParams.get("duration") || "0");
      if (userLimitParam) {
        setSelectedUserLimitKey(userLimitParam);

        if (durationParam > 0) {
          const matchedPackage = nextPackages.find(
            (item) =>
              userLimitKey(item.userLimit ?? null) === userLimitParam &&
              item.durationDays === durationParam,
          );

          if (matchedPackage) {
            setSelectedPackageId(matchedPackage.id);
          }
        }
      }
      setLoading(false);
    });
  }, [bootstrapMeta, landingSiteSettings.siteTitle, t]);

  useEffect(() => {
    if (!selectedUserLimitKey || !durationStepRef.current) return;
    durationStepRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedUserLimitKey]);

  useEffect(() => {
    if (!selectedPackageId || !summaryStepRef.current) return;
    summaryStepRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedPackageId]);

  useEffect(() => {
    setQuote(null);
    setQuoteMessage(null);
    setDiscountError(null);
  }, [selectedPackageId, useOwnDomain, customer?.id, customer?.firstName, customer?.lastName]);

  useEffect(() => {
    if (!selectedPackage || !customer || !profileCompleted) {
      return;
    }

    setQuoteLoading(true);
    api.landingOrders.preview({
      subscriptionPackageId: selectedPackage.id,
      useOwnDomain,
      discountCode: discountCode || undefined,
    }).then((res) => {
      if (res.success) {
        setQuote(res.data);
        setQuoteMessage(null);
        setDiscountError(null);
      } else {
        setQuote(null);
        setQuoteMessage(res.message || t("landingPlans.quote.failed"));
        setDiscountError(discountCode ? (res.message || t("landingPlans.discount.invalid")) : null);
      }
      setQuoteLoading(false);
    });
  }, [customer, profileCompleted, selectedPackage, useOwnDomain]);

  const handleApplyDiscountCode = async (nextCode: string) => {
    const normalized = nextCode.trim().toUpperCase();
    setDiscountLoading(true);
    setDiscountError(null);

    if (!selectedPackage || !customer || !profileCompleted) {
      setDiscountLoading(false);
      return;
    }

    const res = await api.landingOrders.preview({
      subscriptionPackageId: selectedPackage.id,
      useOwnDomain,
      discountCode: normalized,
    });

    if (res.success) {
      setQuote(res.data);
      setQuoteMessage(null);
      setDiscountCode(normalized);
    } else {
      setDiscountError(res.message || t("landingPlans.discount.invalid"));
      setQuoteMessage(res.message || t("landingPlans.quote.failed"));
      setDiscountCode("");
    }

    setDiscountLoading(false);
  };

  const handleClearDiscountCode = async () => {
    setDiscountCode("");
    setDiscountError(null);

    if (!selectedPackage || !customer || !profileCompleted) {
      return;
    }

    const res = await api.landingOrders.preview({
      subscriptionPackageId: selectedPackage.id,
      useOwnDomain,
    });

    if (res.success) {
      setQuote(res.data);
      setQuoteMessage(null);
    }
  };

  const handleSelectUserLimit = (key: string) => {
    setSelectedUserLimitKey(key);
    setSelectedPackageId("");
  };

  const handleSelectPackage = (packageId: string) => {
    setSelectedPackageId(packageId);
  };

  const handleCheckout = async () => {
    if (!selectedPackage) return;
    if (!customer) {
      setLoginOpen(true);
      return;
    }
    if (!profileCompleted) {
      setLoginOpen(true);
      return;
    }
    setCheckoutLoading(true);
    const result = await api.landingOrders.checkout({
      subscriptionPackageId: selectedPackage.id,
      useOwnDomain,
      discountCode: discountCode || undefined,
    });
    setCheckoutLoading(false);

    if (!result.success) {
      setQuoteMessage(result.message || t("landingPlans.checkout.failed"));
      return;
    }

    if (result.data.mode === "gateway" && result.data.redirectForm) {
      submitGatewayForm(result.data.redirectForm);
      return;
    }

    if (result.data.mode === "gateway" && result.data.paymentUrl) {
      window.location.assign(result.data.paymentUrl);
      return;
    }

    window.location.assign(`${getLandingPath("/orders")}?status=success&order=${encodeURIComponent(result.data.order.orderNumber)}&oid=${encodeURIComponent(result.data.order.id)}&tracking=${encodeURIComponent(result.data.payment.referenceId || result.data.payment.invoiceNumber)}`);
  };

  if (bootstrapMeta?.primaryDomain === "barber44.test" && selectedPackage) {
    const total = quote?.totalAmount ?? selectedPackage.payableAmount;
    const formatToman = (amount?: number | null) => `تومان ${new Intl.NumberFormat("fa-IR").format(Math.round((amount ?? 0) / 10))}`;
    const amountClass = "shrink-0 whitespace-nowrap text-left [direction:ltr]";
    const setupFeeLabel = quote?.setupFee.label && /[A-Za-z\u0600-\u06FF]/.test(quote.setupFee.label)
      ? quote.setupFee.label
      : "هزینه نصب و راه‌اندازی";
    return <div dir="rtl" className="min-h-screen bg-[#0e0d0b] text-[#f4f2ee] [font-family:Vazirmatn,system-ui,sans-serif]">
      <div className="border-t border-white/10" />
      <main className="mx-auto max-w-[1050px] px-4 pb-14 pt-8 sm:px-6 sm:pt-12">
        <PellehCheckoutSteps current={2} />
        <div className="mb-8 mt-9 text-center sm:mb-10 sm:mt-12">
          <h1 className="text-2xl font-black sm:text-3xl">خلاصه انتخاب شما</h1>
          <p className="mt-3 text-sm text-[#8f8a80]">پیش از پرداخت، جزئیات سفارش خود را بررسی کنید.</p>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.05fr]">
          <section className="order-2 overflow-hidden rounded-[22px] border border-[#c9a24a]/35 bg-[#15130f] lg:order-1 lg:sticky lg:top-5">
            <div className="flex items-center justify-between border-b border-[#c9a24a]/25 bg-[#c9a24a]/10 px-5 py-4"><strong className="text-[#e0c06e]">پیش‌فاکتور</strong><ReceiptText className="size-5 text-[#e0c06e]" /></div>
            <div className="space-y-4 p-5 text-sm sm:p-6">
              <div className="flex justify-between gap-4 border-b border-dashed border-white/10 pb-4"><span className="text-[#9c988d]">اشتراک {selectedPackage.name}</span><strong className={amountClass}>{formatToman(quote?.package.payableAmount ?? selectedPackage.payableAmount)}</strong></div>
              <div className="flex justify-between gap-4 border-b border-dashed border-white/10 pb-4"><span className="text-[#9c988d]">{setupFeeLabel}</span><strong className={amountClass}>{formatToman(quote?.setupFee.amount)}</strong></div>
              {!useOwnDomain && <div className="flex justify-between gap-4 border-b border-dashed border-white/10 pb-4"><span className="text-[#9c988d]">هزینه ثبت دامنه</span><strong className={amountClass}>{formatToman(quote?.domain.amount)}</strong></div>}
              {quote?.discountCode && <div className="flex justify-between gap-4 text-emerald-300"><span>تخفیف {quote.discountCode.code}</span><strong className={amountClass}>− {formatToman(quote.discountCode.discountAmount)}</strong></div>}
              <div className="flex items-end justify-between gap-4 pt-1"><strong>مبلغ قابل پرداخت</strong><strong className={`${amountClass} text-xl text-[#e0c06e] sm:text-2xl`}>{formatToman(total)}</strong></div>
              <button type="button" onClick={() => void handleCheckout()} disabled={checkoutLoading || quoteLoading} className="mt-2 w-full rounded-full bg-[#c9a24a] px-5 py-3.5 font-black text-[#0e0d0b] transition hover:bg-[#e0c06e] disabled:opacity-60">{checkoutLoading ? "در حال اتصال..." : customer && profileCompleted ? "پرداخت آنلاین" : "ورود و ادامه خرید"}</button>
              <a href="/contact" className="block w-full rounded-full border border-white/10 px-5 py-3 text-center font-bold transition hover:border-[#c9a24a]/50">تماس با مشاور</a>
              <p className="text-center text-xs text-[#777269]">پرداخت امن از طریق درگاه بانکی</p>
              {quoteMessage && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">{quoteMessage}</p>}
            </div>
          </section>

          <div className="order-1 space-y-4 lg:order-2">
            <section className="rounded-[22px] border border-white/10 bg-[#15130f] p-5 sm:p-6">
              <h2 className="mb-5 font-black">مشخصات اشتراک</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><span className="text-xs text-[#8f8a80]">پلن انتخابی</span><strong className="mt-2 block text-sm">{selectedPackage.name}</strong></div>
                <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><span className="text-xs text-[#8f8a80]">تعداد {unitLabel}</span><strong className="mt-2 block text-sm">{formatUserLimitLabel(selectedPackage.userLimitLabel)}</strong></div>
                <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><span className="text-xs text-[#8f8a80]">مدت اشتراک</span><strong className="mt-2 block text-sm">{formatDurationDays(selectedPackage.durationDays)}</strong></div>
                <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><span className="text-xs text-[#8f8a80]">تخفیف اعمال‌شده</span><strong className="mt-2 block whitespace-nowrap text-left text-sm text-[#e0c06e] [direction:ltr]">{quote?.discountCode ? formatToman(quote.discountCode.discountAmount) : "—"}</strong></div>
              </div>
            </section>

            <label className="flex cursor-pointer items-start gap-3 rounded-[22px] border border-white/10 bg-[#15130f] p-5 sm:p-6">
              <input type="checkbox" checked={useOwnDomain} onChange={(event) => setUseOwnDomain(event.target.checked)} className="mt-1 size-5 accent-[#c9a24a]" />
              <span><strong className="block text-sm">من دامنه دارم و از دامنه خودم استفاده می‌کنم</strong><small className="mt-2 block leading-6 text-[#8f8a80]">اگر قبلاً دامنه خریده‌اید، این گزینه را فعال کنید تا هزینه ثبت دامنه حذف شود.</small></span>
            </label>

            <section className="rounded-[22px] border border-white/10 bg-[#15130f] p-5 sm:p-6">
              <h2 className="font-black">کد تخفیف دارید؟</h2>
              <p className="mt-2 text-xs leading-6 text-[#8f8a80]">کد را وارد کنید تا مبلغ نهایی دوباره محاسبه شود.</p>
              <div className="mt-4 flex gap-2"><input value={discountCode} onChange={(event) => setDiscountCode(event.target.value)} placeholder="مثلاً PELLEH10" dir="ltr" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.025] px-4 py-3 text-sm outline-none focus:border-[#c9a24a]" /><button type="button" disabled={discountLoading || quoteLoading} onClick={() => void handleApplyDiscountCode(discountCode)} className="rounded-xl border border-[#c9a24a] px-4 text-sm font-bold text-[#e0c06e] disabled:opacity-50">اعمال کد</button></div>
              {discountError && <p className="mt-2 text-xs text-red-300">{discountError}</p>}
            </section>
          </div>
        </div>
        <p className="mt-12 text-center text-xs text-[#777269]">© پله — تمامی حقوق محفوظ است.</p>
      </main>
      <LandingAuthDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground" dir={dir}>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-card/70 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={landingSiteSettings.logoUrl} alt={landingSiteSettings.siteTitle} className="h-10 w-10 rounded-xl border border-border/70 object-cover" />
            <div>
              <div className="text-sm text-primary">{landingSiteSettings.headerLabel}</div>
              <h2 className="text-base font-black sm:text-lg">{landingSiteSettings.siteTitle}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-2xl border-border bg-background/40"
              onClick={() => setPhoneModalOpen(true)}
            >
              <Phone className="h-5 w-5" />
            </Button>

            <LandingAuthButton onLoginClick={() => setLoginOpen(true)} />

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl border-border bg-background/40">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side={isRtl ? "right" : "left"} className="border-border bg-card/95 pt-12" closeClassName="end-4 start-auto" dir={dir}>
                <div className="grid gap-2 pt-2">
                  {headerMenuItems.map((item) => (
                    <Link key={item.label} href={item.href}>
                      <a
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between rounded-xl border border-border/70 bg-background/35 px-4 py-4 text-sm font-semibold text-foreground transition hover:border-primary/30 w-full block"
                      >
                        <span>{item.label}</span>
                        <item.icon className="h-4 w-4 text-primary" />
                      </a>
                    </Link>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl flex-1 space-y-6 px-4 py-8">
        <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-[#0f1b38] via-[#0d1a35] to-[#12224a] p-6 sm:p-8">
          <Badge className="rounded-full bg-primary/90 px-4 py-1 text-sm text-primary-foreground">{dynamicTexts.badgeText}</Badge>
          <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{dynamicTexts.pageTitle}</h1>
          <div className="mt-4 space-y-1 text-sm leading-8 text-slate-300 sm:text-base">
            {dynamicTexts.introLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{dynamicTexts.stepOneTitle}</CardTitle>
            <CardDescription>{dynamicTexts.stepOneDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {userLimitOptions.map((option) => {
              const isSelected = selectedUserLimitKey === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleSelectUserLimit(option.key)}
                  className={`rounded-2xl border p-4 text-start transition-all ${isSelected ? "border-primary bg-primary/10 shadow-sm shadow-primary/10" : "border-border/70 bg-background/40 hover:border-primary/30"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-bold">
                      {option.userLimit == null ? t("landingPlans.unlimitedUnit", { unit: unitLabel }) : t("landingPlans.unitCount", { count: option.label, unit: unitLabel })}
                    </div>
                    {isSelected ? <BadgeCheck className="h-5 w-5 text-primary" /> : null}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {selectedUserLimitKey ? (
          <section ref={durationStepRef}>
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base">{dynamicTexts.stepTwoTitle}</CardTitle>
                <CardDescription>{dynamicTexts.stepTwoDescription}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {packagesForSelectedLimit.map((pkg) => {
                  const isSelected = selectedPackageId === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => handleSelectPackage(pkg.id)}
                      className={`rounded-2xl border p-4 text-start transition-all ${isSelected ? "border-primary bg-primary/10 shadow-sm shadow-primary/10" : "border-border/70 bg-background/40 hover:border-primary/30"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold">{formatDurationDays(pkg.durationDays)}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{pkg.name}</div>
                        </div>
                        {isSelected ? <BadgeCheck className="h-5 w-5 text-primary" /> : null}
                      </div>
                      <div className="mt-4 space-y-1">
                        <div className={`text-sm ${pkg.discountAmount > 0 ? "line-through text-muted-foreground" : "font-semibold"}`}>
                          {formatMoney(pkg.priceAmount)}
                        </div>
                        <div className="text-lg font-bold text-primary">{formatMoney(pkg.payableAmount)}</div>
                      </div>
                    </button>
                  );
                })}
                {packagesForSelectedLimit.length === 0 ? (
                  <div className="rounded-xl border border-border/70 bg-background/35 p-4 text-sm text-muted-foreground">
                    {t("landingPlans.emptyForUnit", { unit: unitLabel })}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </section>
        ) : null}

        {selectedPackage ? (
          <section ref={summaryStepRef}>
            <Card className="border-primary/30 bg-primary/10">
              <CardHeader>
                <CardTitle className="text-base">{dynamicTexts.summaryTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                    <div className="text-xs text-muted-foreground">{t("landingPlans.summary.userCount", { unit: unitLabel })}</div>
                    <div className="mt-1 font-bold">{formatUserLimitLabel(selectedPackage.userLimitLabel)}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                    <div className="text-xs text-muted-foreground">{t("landingPlans.summary.duration")}</div>
                    <div className="mt-1 font-bold">{t("landingPlans.durationPlain", { count: format.number(selectedPackage.durationDays) })}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                    <div className="text-xs text-muted-foreground">{t("landingPlans.summary.finalAmount")}</div>
                    <div className="mt-1 font-bold text-primary">{formatMoney(selectedPackage.payableAmount)}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                    <div className="text-xs text-muted-foreground">{t("landingPlans.summary.discount")}</div>
                    <div className="mt-1 font-bold">{formatMoney(selectedPackage.discountAmount)}</div>
                  </div>
                </div>
                {!customer ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/35 p-4 text-sm text-muted-foreground">
                    {t("landingPlans.loginRequired.description")}
                    <div className="mt-3">
                      <Button className="rounded-2xl" onClick={() => setLoginOpen(true)}>{t("landingPlans.loginRequired.cta")}</Button>
                    </div>
                  </div>
                ) : !profileCompleted ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/35 p-4 text-sm text-muted-foreground">
                    {t("landingPlans.profileRequired.description")}
                    <div className="mt-3">
                      <Button className="rounded-2xl" onClick={() => setLoginOpen(true)}>{t("landingPlans.profileRequired.cta")}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-2xl border border-border/70 bg-background/35 p-4">
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                          <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={useOwnDomain}
                              onChange={(event) => setUseOwnDomain(event.target.checked)}
                              className="h-4 w-4 rounded border-border"
                            />
                            {t("landingPlans.ownDomain.label")}
                          </label>
                          <div className="mt-2 text-xs leading-7 text-muted-foreground">
                            {t("landingPlans.ownDomain.hint")}
                          </div>
                        </div>

                        {quoteMessage ? (
                          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{quoteMessage}</div>
                        ) : null}
                        <DiscountCodeDialog
                          value={discountCode}
                          applied={quote?.discountCode ? {
                            code: quote.discountCode.code,
                            discountAmount: quote.discountCode.discountAmount,
                            discountType: quote.discountCode.discountType,
                            discountValue: quote.discountCode.discountValue,
                          } : null}
                          loading={discountLoading || quoteLoading}
                          error={discountError}
                          onApply={handleApplyDiscountCode}
                          onClear={handleClearDiscountCode}
                        />
                      </div>

                      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                        <div className="mb-3 text-sm font-bold text-foreground">{t("landingPlans.invoice.title")}</div>
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">{t("landingPlans.invoice.subscription", { name: selectedPackage.name })}</span>
                            <span className="font-semibold">{formatMoney(quote?.package.payableAmount ?? selectedPackage.payableAmount)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">{quote?.setupFee.label ?? t("landingPlans.invoice.setupFee")}</span>
                            <span className="font-semibold">{formatMoney(quote?.setupFee.amount)}</span>
                          </div>
                          {!useOwnDomain ? (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">{t("landingPlans.invoice.domainIr")}</span>
                              <span className="font-semibold">{formatMoney(quote?.domain.amount)}</span>
                            </div>
                          ) : null}
                          {quote?.discountCode ? (
                            <div className="flex items-center justify-between gap-3 text-emerald-300">
                              <span>
                                {t("landingPlans.invoice.discountCode")} <CodeText>{quote.discountCode.code}</CodeText>
                                {" • "}
                                {quote.discountCode.discountType === "percent"
                                  ? format.percent(Number(quote.discountCode.discountValue) / 100)
                                  : formatMoney(Number(quote.discountCode.discountValue))}
                              </span>
                              <span className="font-semibold">{formatMoney(quote.discountCode.discountAmount)}</span>
                            </div>
                          ) : null}
                          <div className="border-t border-border/70 pt-3">
                            <div className="flex items-center justify-between gap-3 text-base font-black">
                              <span>{t("landingPlans.invoice.total")}</span>
                              <span className="text-primary">{formatMoney(quote?.totalAmount ?? selectedPackage.payableAmount)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button className="rounded-2xl" onClick={() => void handleCheckout()} disabled={checkoutLoading || quoteLoading}>
                        <Check className="me-2 h-4 w-4" />
                        {checkoutLoading ? t("landingPlans.checkout.connecting") : t("landingPlans.checkout.payOnline")}
                      </Button>
                      <Link href={getLandingPath("/contact")}>
                        <Button variant="outline" className="rounded-2xl border-primary/35 bg-transparent">
                          {t("landingPlans.cta.secondary")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {!customer ? (
                    <Button variant="outline" className="rounded-2xl border-primary/35 bg-transparent" onClick={() => setLoginOpen(true)}>
                      {t("landingPlans.loginRequired.orderCta")}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl border-primary/35 bg-transparent"
            onClick={() => setShowAllPackagesMatrix((prev) => !prev)}
          >
            {showAllPackagesMatrix ? dynamicTexts.matrixCloseLabel : dynamicTexts.matrixOpenLabel}
          </Button>

          {showAllPackagesMatrix ? (
            <section className="overflow-hidden rounded-3xl border border-border/70 bg-card/60">
              <div className="pretty-scrollbar pretty-scrollbar-x overflow-x-auto pb-2">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="border-b border-border/70 bg-background/40">
                    <tr>
                      <th className="px-4 py-3 text-start font-bold">{t("landingPlans.matrix.durationCapacity")}</th>
                      {userLimitOptions.map((option) => (
                        <th key={`head-${option.key}`} className="px-4 py-3 text-center font-bold">
                          {option.userLimit == null ? t("landingPlans.unlimitedUnit", { unit: unitLabel }) : t("landingPlans.unitCount", { count: option.label, unit: unitLabel })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixDurations.map((duration) => (
                      <tr key={`duration-${duration}`} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-3 font-semibold">{formatDurationDays(duration)}</td>
                        {userLimitOptions.map((option) => {
                          const price = matrixPrice(duration, option.key);
                          return (
                            <td key={`price-${duration}-${option.key}`} className="px-4 py-3 text-center">
                              {price == null ? (
                                <span className="text-muted-foreground/60">—</span>
                              ) : (
                                <span className="font-semibold">{formatMoney(price)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </section>

        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black">{dynamicTexts.ctaTitle}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{dynamicTexts.ctaDescription}</p>
            </div>
            <div className="flex gap-2">
              <Button className="rounded-2xl" onClick={() => summaryStepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                <Check className="me-2 h-4 w-4" />
                {dynamicTexts.ctaPrimaryText}
              </Button>
              <Link href={getLandingPath("/contact")}>
                <Button variant="outline" className="rounded-2xl border-primary/35 bg-transparent">{dynamicTexts.ctaSecondaryText}</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-card/70 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
            <SmilePlus className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">{dynamicTexts.footerText}</span>
          </div>
        </div>
      </footer>

      <Dialog open={phoneModalOpen} onOpenChange={setPhoneModalOpen}>
        <DialogContent className="max-w-md border-border/70 bg-card/95" dir={dir}>
          <DialogHeader>
            <DialogTitle>{dynamicTexts.phoneModalTitle}</DialogTitle>
            <DialogDescription>{dynamicTexts.phoneModalDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {phoneNumbers.map((phone) => (
              <a
                key={phone}
                href={`tel:${phone.replace(/-/g, "")}`}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-background/35 px-4 py-3 transition hover:border-primary/30"
              >
                <PhoneText className="font-semibold">{phone}</PhoneText>
                <Phone className="h-4 w-4 text-primary" />
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <LandingAuthDialog open={loginOpen} onOpenChange={setLoginOpen} />

      {loading ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
          <div className="rounded-2xl border border-border/70 bg-card/90 px-4 py-3 text-sm">{dynamicTexts.loadingText}</div>
        </div>
      ) : null}
    </div>
  );
}
