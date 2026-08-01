import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, CircleHelp, House, Info, LayoutGrid, ListChecks, Menu, Phone, PhoneCall, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { getCitiesByProvince, getCityName, getProvinceName, IRAN_PROVINCES } from "@/lib/iran-location";
import { getLandingHeaderMenuItems, getLandingPath, getLandingSiteSettings } from "@/lib/landing-site";
import { useLandingAuth } from "@/lib/landing-auth";
import { normalizeDigits } from "@/lib/normalize";
import { LandingAuthDialog } from "@/components/landing-auth-dialog";
import { LandingAuthButton } from "@/components/landing-auth-button";
import { CodeText, PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { LandingOrderSummary } from "@/lib/types";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { PellehCheckoutSteps } from "@/components/pelleh-checkout-steps";
import { PellehBrandLogo } from "@/components/pelleh-brand-logo";

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

type CompletionFormState = {
  requestedDomain: string;
  firstName: string;
  lastName: string;
  email: string;
  provinceId: string;
  cityId: string;
  addressLine: string;
  nationalCode: string;
  gender: "male" | "female" | "";
};

export default function LandingOrdersPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const landingSiteSettings = getLandingSiteSettings();
  const bootstrapMeta = getInitialTenantMeta();
  const { customer, refresh } = useLandingAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [orders, setOrders] = useState<LandingOrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionSubmitting, setCompletionSubmitting] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CompletionFormState, string>>>({});
  const [form, setForm] = useState<CompletionFormState>({
    requestedDomain: "",
    firstName: "",
    lastName: "",
    email: "",
    provinceId: "",
    cityId: "",
    addressLine: "",
    nationalCode: "",
    gender: "",
  });
  const [domainCheck, setDomainCheck] = useState<{ loading: boolean; available: boolean | null; message: string }>({ loading: false, available: null, message: "" });
  const [completionOwnDomain, setCompletionOwnDomain] = useState(false);
  const completionRef = useRef<HTMLDivElement | null>(null);
  const completionDetailsRef = useRef<HTMLDivElement | null>(null);

  const iconMap = { home: House, about: Info, features: LayoutGrid, plans: ListChecks, faq: CircleHelp, contact: PhoneCall, orders: ReceiptText } as const;
  const headerMenuItems = getLandingHeaderMenuItems().map((item) => ({ ...item, icon: iconMap[item.key] ?? House }));
  const phoneNumbers = landingSiteSettings.contactPhones;
  const feedbackOrderId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("oid");
  }, []);

  const feedback = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const order = params.get("order");
    const tracking = params.get("tracking");
    const message = params.get("message");

    if (!status && !order) return null;

    return {
      status,
      order,
      tracking,
      message,
    };
  }, []);

  const handlePayOrder = async (orderId: string) => {
    setPayingOrderId(orderId);
    const result = await api.landingOrders.pay(orderId);
    setPayingOrderId(null);

    if (!result.success) {
      setCompletionMessage(result.message || "پرداخت آنلاین برای این سفارش آماده نشد. لطفا دوباره تلاش کنید.");
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
  const completionRequested = useMemo(() => new URLSearchParams(window.location.search).get("complete") === "1", []);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === feedbackOrderId) ?? orders[0] ?? null,
    [feedbackOrderId, orders],
  );
  const usesFixedIrSuffix = !!selectedOrder && !completionOwnDomain && selectedOrder.domainPriceAmount > 0;

  const cities = useMemo(() => {
    const provinceId = Number(normalizeDigits(form.provinceId));
    return provinceId > 0 ? getCitiesByProvince(provinceId) : [];
  }, [form.provinceId]);

  const customerProfileComplete = !!(
    customer?.firstName?.trim() &&
    customer?.lastName?.trim() &&
    customer?.email?.trim() &&
    customer?.nationalCode?.trim() &&
    customer?.gender &&
    customer?.provinceId &&
    customer?.cityId &&
    customer?.addressLine?.trim()
  );

  const requiresDomain = !!selectedOrder && (selectedOrder.usesOwnDomain || selectedOrder.domainPriceAmount > 0);
  const shouldCheckDomain = !!selectedOrder && !completionOwnDomain && selectedOrder.domainPriceAmount > 0;
  const domainStepReady = !requiresDomain || (completionOwnDomain ? form.requestedDomain.trim().length >= 3 : domainCheck.available === true);
  const selectedOrderCompleted = !!selectedOrder && (!requiresDomain || !!selectedOrder.requestedDomain?.trim()) && !!selectedOrder.completionSubmittedAt;
  const shouldShowCompletion = !!customer && !!selectedOrder && (completionOpen || !customerProfileComplete || !selectedOrderCompleted || feedback?.status === "success");

  useEffect(() => {
    document.title = t("landingOrders.documentTitle", { siteTitle: landingSiteSettings.siteTitle });
  }, [landingSiteSettings.siteTitle, t]);

  useEffect(() => {
    if (!customer) {
      setOrders([]);
      return;
    }

    setLoading(true);
    api.landingOrders.list({ page: currentPage, perPage: 10 }).then((res) => {
      if (res.success) {
        setOrders(res.data.items);
        setLastPage(res.data.lastPage || 1);
      } else {
        setOrders([]);
      }
      setLoading(false);
    });
  }, [currentPage, customer?.id]);

  useEffect(() => {
    if (!customer) {
      setForm({
        requestedDomain: "",
        firstName: "",
        lastName: "",
        email: "",
        provinceId: "",
        cityId: "",
        addressLine: "",
        nationalCode: "",
        gender: "",
      });
      return;
    }

    setForm((current) => ({
      requestedDomain: selectedOrder?.requestedDomain
        ? selectedOrder.requestedDomain.replace(/\.ir$/i, "")
        : current.requestedDomain,
      firstName: customer.firstName ?? "",
      lastName: customer.lastName ?? "",
      email: customer.email ?? "",
      provinceId: customer.provinceId ? String(customer.provinceId) : "",
      cityId: customer.cityId ? String(customer.cityId) : "",
      addressLine: customer.addressLine ?? "",
      nationalCode: customer.nationalCode ?? "",
      gender: customer.gender ?? "",
    }));
  }, [customer?.id, customer?.firstName, customer?.lastName, customer?.email, customer?.provinceId, customer?.cityId, customer?.addressLine, customer?.nationalCode, customer?.gender, selectedOrder?.id, selectedOrder?.requestedDomain]);

  useEffect(() => {
    setCompletionOwnDomain(Boolean(selectedOrder?.usesOwnDomain));
  }, [selectedOrder?.id, selectedOrder?.usesOwnDomain]);

  useEffect(() => {
    if (!completionOpen && feedback?.status === "success") {
      setCompletionOpen(true);
    }
  }, [feedback?.status, selectedOrder?.id]);

  const handleDomainCheck = async () => {
    if (!selectedOrder || !shouldCheckDomain) return;
    const name = normalizeDomainInput(form.requestedDomain);
    if (name.length < 3) {
      setDomainCheck({ loading: false, available: false, message: "نام دامنه باید حداقل سه کاراکتر باشد." });
      return;
    }
    setDomainCheck({ loading: true, available: null, message: "در حال بررسی دامنه..." });
    const res = await api.landingOrders.checkDomain(selectedOrder.id, usesFixedIrSuffix ? `${name}.ir` : name);
    if (res.success) setDomainCheck({ loading: false, available: res.data.available, message: res.data.message });
    else setDomainCheck({ loading: false, available: false, message: res.message || "استعلام دامنه انجام نشد؛ دوباره تلاش کنید." });
  };

  useEffect(() => {
    if (!domainStepReady || !completionDetailsRef.current) return;
    const timer = window.setTimeout(() => completionDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 180);
    return () => window.clearTimeout(timer);
  }, [domainStepReady]);

  const scrollToCompletion = () => {
    setCompletionOpen(true);
    window.setTimeout(() => {
      completionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const validateCompletionForm = () => {
    const errors: Partial<Record<keyof CompletionFormState, string>> = {};
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim();
    const addressLine = form.addressLine.trim();
    const nationalCode = normalizeDigits(form.nationalCode).trim();
    const provinceId = Number(normalizeDigits(form.provinceId));
    const cityId = Number(normalizeDigits(form.cityId));

    if (requiresDomain && form.requestedDomain.trim().length < 3) {
      errors.requestedDomain = selectedOrder?.usesOwnDomain ? t("landingOrders.validation.ownDomain") : t("landingOrders.validation.domainName");
    }
    if (requiresDomain && form.requestedDomain.trim() && !/^[a-z0-9.-]+$/i.test(form.requestedDomain.trim())) {
      errors.requestedDomain = "نام دامنه باید فقط با حروف انگلیسی، اعداد، خط تیره و نقطه وارد شود.";
    }
    if (firstName.length < 2) errors.firstName = t("landingOrders.validation.firstName");
    if (lastName.length < 2) errors.lastName = t("landingOrders.validation.lastName");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = t("landingOrders.validation.email");
    if (provinceId <= 0) errors.provinceId = t("landingOrders.validation.province");
    if (cityId <= 0) errors.cityId = t("landingOrders.validation.city");
    if (addressLine.length < 8) errors.addressLine = t("landingOrders.validation.address");
    if (nationalCode.length !== 10) errors.nationalCode = t("landingOrders.validation.nationalCode");
    if (!form.gender) errors.gender = t("landingOrders.validation.gender");

    return errors;
  };

  const normalizeDomainInput = (value: string) =>
    normalizeDigits(value)
      .replace(/\s+/g, "")
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\.(ir|com|net|org|io|co|app|dev).*$/i, "")
      .replace(/\./g, "")
      .replace(/[^a-zA-Z0-9-]/g, "")
      .toLowerCase();

  const handleCompletionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOrder) return;

    const errors = validateCompletionForm();
    if (shouldCheckDomain && domainCheck.available !== true) {
      errors.requestedDomain = domainCheck.loading ? "لطفاً تا پایان بررسی دامنه صبر کنید." : (domainCheck.message || "ابتدا یک دامنه آزاد انتخاب کنید.");
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCompletionSubmitting(true);
    setCompletionMessage(null);
    const provinceId = Number(normalizeDigits(form.provinceId));
    const cityId = Number(normalizeDigits(form.cityId));

    const result = await api.landingOrders.complete(selectedOrder.id, {
      requestedDomain: requiresDomain
        ? (usesFixedIrSuffix ? `${normalizeDomainInput(form.requestedDomain)}.ir` : form.requestedDomain.trim())
        : undefined,
      useOwnDomain: completionOwnDomain,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      provinceId,
      provinceName: getProvinceName(provinceId),
      cityId,
      cityName: getCityName(cityId),
      addressLine: form.addressLine.trim(),
      nationalCode: normalizeDigits(form.nationalCode).trim(),
      gender: form.gender as "male" | "female",
    });
    setCompletionSubmitting(false);

    if (!result.success) {
      setCompletionMessage(result.message || t("landingOrders.completion.failed"));
      return;
    }

    setOrders((current) => current.map((order) => (order.id === result.data.id ? result.data : order)));
    await refresh();
    setCompletionOpen(false);
    setFormErrors({});
    setCompletionMessage(result.message || t("landingOrders.completion.saved"));
    setSuccessModalOpen(true);
  };

  if (bootstrapMeta?.isLandingDomain === true && (feedback?.status === "success" || completionRequested)) {
    const fieldClass = "mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[.025] px-4 text-sm text-white outline-none transition focus:border-[#c9a24a]";
    const error = (key: keyof CompletionFormState) => formErrors[key] ? <p className="mt-1 text-xs text-red-300">{formErrors[key]}</p> : null;
    const domainReady = domainStepReady;
    return <div dir="rtl" className="min-h-screen bg-[#0e0d0b] text-[#f4f2ee] [font-family:Vazirmatn,system-ui,sans-serif]">
      <main className="mx-auto max-w-[900px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        <PellehCheckoutSteps current={3} />

        <section className="mt-9 flex items-center gap-4 rounded-[22px] border border-emerald-400/25 bg-emerald-400/[.07] p-5 sm:mt-12 sm:p-6">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300"><CheckCircle2 className="size-6" /></div>
          <div><h1 className="text-lg font-black text-emerald-300 sm:text-xl">{feedback?.status === "success" ? "سفارش شما با موفقیت پرداخت شد" : "سفارش شما ثبت شده است"}</h1><p className="mt-2 text-xs leading-6 text-[#aaa59b] sm:text-sm">شماره سفارش <b className="text-white" dir="ltr">{feedback?.order || selectedOrder?.orderNumber}</b> — برای تکمیل راه‌اندازی، اطلاعات زیر را کامل کنید.</p></div>
        </section>

        {customer && <section className="mt-4 flex items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-[#15130f] p-5">
          <div className="flex min-w-0 items-center gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#c9a24a]/10 font-black text-[#e0c06e]">{customer.firstName?.charAt(0) || "پ"}</div><div className="min-w-0"><strong className="block truncate">{customer.firstName} {customer.lastName}</strong><span className="mt-1 block text-xs text-[#8f8a80]" dir="ltr">{customer.mobile}</span></div></div>
          <span className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#aaa59b]">حساب کاربری شما</span>
        </section>}

        {!customer ? <section className="mt-5 rounded-[22px] border border-[#c9a24a]/30 bg-[#15130f] p-8 text-center"><p className="text-[#aaa59b]">برای تکمیل سفارش وارد حساب کاربری شوید.</p><button onClick={() => setLoginOpen(true)} className="mt-5 rounded-full bg-[#c9a24a] px-7 py-3 font-black text-[#0e0d0b]">ورود به حساب</button></section> : loading || !selectedOrder ? <div className="py-16 text-center text-[#8f8a80]">در حال دریافت اطلاعات سفارش...</div> : selectedOrderCompleted ? <section className="mt-5 rounded-[24px] border border-emerald-400/30 bg-emerald-400/[.07] p-6 text-center sm:p-10">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><CheckCircle2 className="size-8" /></div>
          <h2 className="mt-5 text-xl font-black text-emerald-300 sm:text-2xl">اطلاعات سفارش شما ثبت شد</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#b5b0a6]">اطلاعات سفارش شما ثبت شد و برای ادامه فرایند ایجاد سیستم بررسی می‌شود.</p>
          <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-emerald-400/20 bg-black/15 p-4"><span className="block text-xs text-[#8f8a80]">کد پیگیری</span><strong className="mt-2 block text-lg tracking-wider text-white" dir="ltr">{selectedOrder.payment?.referenceId || selectedOrder.payment?.invoiceNumber || selectedOrder.orderNumber}</strong></div>
          <span className="mt-5 inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-300">ثبت‌شده و منتظر تأیید</span>
        </section> : <form onSubmit={handleCompletionSubmit} className="mt-5 rounded-[24px] border border-[#c9a24a]/30 bg-[#15130f] p-5 sm:p-8">
          <span className="text-sm font-bold text-[#e0c06e]">تکمیل سفارش</span>
          <h2 className="mt-4 text-xl font-black sm:text-2xl">اطلاعات نهایی راه‌اندازی را ثبت کنید</h2>
          <p className="mt-3 text-xs leading-6 text-[#8f8a80] sm:text-sm">این اطلاعات برای همیشه روی حساب شما ذخیره می‌شود و در سفارش‌های بعدی دوباره پرسیده نخواهد شد.</p>

          <div className="mt-7 space-y-5 [&_button]:w-full [&_button]:rounded-full [&_button]:border-0 [&_button]:bg-[#c9a24a] [&_button]:px-5 [&_button]:py-3.5 [&_button]:text-sm [&_button]:font-black [&_button]:text-[#0e0d0b] [&_button:hover]:bg-[#e0c06e] sm:[&_button]:w-auto sm:[&_button]:min-w-52">
            {!domainReady && <div className="rounded-2xl border border-[#c9a24a]/20 bg-[#c9a24a]/[.05] px-4 py-3 text-xs leading-6 text-[#cfc8b9]">ابتدا دامنه را بررسی کنید یا گزینه «قبلاً دامنه را خودم خریداری کرده‌ام» را انتخاب کنید. پس از تأیید دامنه، ادامه فرم نمایش داده می‌شود.</div>}
            {requiresDomain && <div className="space-y-4"><label className="block text-sm font-bold">{completionOwnDomain ? "نام دامنه‌ای که خریداری کرده‌اید" : "نام دامنه موردنظر"}<div className="relative"><input value={form.requestedDomain} onChange={(event) => { setForm((current) => ({ ...current, requestedDomain: completionOwnDomain ? event.target.value.replace(/\s+/g, "").toLowerCase() : normalizeDomainInput(event.target.value) })); setDomainCheck({ loading: false, available: null, message: "" }); }} dir="ltr" placeholder={completionOwnDomain ? "example.ir" : "brandname"} className={`${fieldClass} ${usesFixedIrSuffix ? "pr-16" : ""} ${domainCheck.available === true ? "!border-emerald-400/60" : domainCheck.available === false ? "!border-red-400/60" : ""}`} />{usesFixedIrSuffix && <span className="absolute right-0 top-2 flex h-12 w-14 items-center justify-center rounded-r-xl bg-[#c9a24a] font-black text-[#0e0d0b]">.ir</span>}</div>{shouldCheckDomain && <button type="button" disabled={domainCheck.loading || form.requestedDomain.trim().length < 3} onClick={() => void handleDomainCheck()} className="mt-3 rounded-full border border-[#c9a24a] px-5 py-2.5 text-xs font-bold text-[#e0c06e] transition hover:bg-[#c9a24a]/10 disabled:cursor-not-allowed disabled:opacity-40">{domainCheck.loading ? "در حال بررسی..." : domainCheck.available === null ? "بررسی وضعیت دامنه" : "بررسی دوباره دامنه"}</button>}{shouldCheckDomain && domainCheck.message && <span className={`mt-2 block text-xs font-normal ${domainCheck.loading ? "text-[#e0c06e]" : domainCheck.available ? "text-emerald-300" : "text-red-300"}`}>{domainCheck.message}</span>}{error("requestedDomain")}<small className="mt-2 block font-normal leading-6 text-[#8f8a80]">{shouldCheckDomain ? "پس از واردکردن نام، وضعیت دامنه را بررسی کنید. فقط دامنه آزاد قابل ثبت است." : "دامنه واردشده به‌عنوان دامنه شخصی شما ثبت می‌شود."}</small></label><label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4"><input type="checkbox" checked={completionOwnDomain} onChange={(event) => { setCompletionOwnDomain(event.target.checked); setForm((current) => ({ ...current, requestedDomain: "" })); setDomainCheck({ loading: false, available: null, message: "" }); }} className="mt-0.5 size-5 accent-[#c9a24a]" /><span><strong className="block text-sm">قبلاً دامنه را خودم خریداری کرده‌ام</strong><small className="mt-1 block font-normal leading-6 text-[#8f8a80]">با فعال‌کردن این گزینه، نام کامل دامنه خریداری‌شده را وارد کنید.</small></span></label></div>}

            {domainReady && <><div ref={completionDetailsRef} className="scroll-mt-5 mt-7 border-t border-white/10 pt-7"><div className="mb-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/[.08] p-4 text-center"><strong className="block text-sm text-emerald-300">دامنه <span dir="ltr" className="inline-block text-white">{completionOwnDomain ? form.requestedDomain : `${form.requestedDomain}.ir`}</span> تأیید شد ✓</strong><span className="mt-1 block text-xs leading-6 text-[#b5b0a6]">حالا اطلاعات زیر را تکمیل کنید تا سفارش شما برای راه‌اندازی ارسال شود.</span><span className="mt-2 inline-block animate-bounce text-emerald-300">↓</span></div><h3 className="mb-5 text-base font-black text-[#e0c06e]">اطلاعات راه‌اندازی</h3><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">نام<input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} className={fieldClass} />{error("firstName")}</label><label className="text-sm font-bold">نام خانوادگی<input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} className={fieldClass} />{error("lastName")}</label></div></div>
            <label className="block text-sm font-bold">آدرس ایمیل<input type="email" dir="ltr" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="you@example.com" className={`${fieldClass} text-left`} />{error("email")}</label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">استان<select value={form.provinceId} onChange={(event) => setForm((current) => ({ ...current, provinceId: event.target.value, cityId: "" }))} className={fieldClass}><option value="">انتخاب استان</option>{IRAN_PROVINCES.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}</select>{error("provinceId")}</label><label className="text-sm font-bold">شهر<select value={form.cityId} onChange={(event) => setForm((current) => ({ ...current, cityId: event.target.value }))} disabled={!form.provinceId} className={fieldClass}><option value="">انتخاب شهر</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select>{error("cityId")}</label></div>
            <label className="block text-sm font-bold">آدرس محل سکونت<textarea rows={4} value={form.addressLine} onChange={(event) => setForm((current) => ({ ...current, addressLine: event.target.value }))} placeholder="خیابان، کوچه، پلاک..." className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-white/[.025] p-4 text-sm outline-none focus:border-[#c9a24a]" />{error("addressLine")}</label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">کد ملی<input inputMode="numeric" dir="ltr" value={form.nationalCode} onChange={(event) => setForm((current) => ({ ...current, nationalCode: normalizeDigits(event.target.value).slice(0, 10) }))} className={`${fieldClass} text-left`} />{error("nationalCode")}</label><label className="text-sm font-bold">جنسیت<select value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value as CompletionFormState["gender"] }))} className={fieldClass}><option value="">انتخاب جنسیت</option><option value="male">مرد</option><option value="female">زن</option></select>{error("gender")}</label></div></>}
          </div>
          {domainReady && <>{completionMessage && <p className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{completionMessage}</p>}<div className="mt-7 flex justify-end"><button disabled={completionSubmitting || domainCheck.loading || (shouldCheckDomain && domainCheck.available !== true)} className="w-full rounded-full bg-[#c9a24a] px-8 py-3.5 font-black text-[#0e0d0b] transition hover:bg-[#e0c06e] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{completionSubmitting ? "در حال ثبت..." : domainCheck.loading ? "در حال بررسی دامنه..." : "ثبت نهایی"}</button></div></>}
        </form>}
      </main>
      <LandingAuthDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>;
  }

  if (bootstrapMeta?.isLandingDomain === true) {
    const toman = (amount: number) => `تومان ${new Intl.NumberFormat("fa-IR").format(Math.round(amount / 10))}`;
    const orderDate = (value?: string | null) => value ? format.date(value) : "—";
    const statusClass = (status: string) => {
      const key = status.toLowerCase();
      if (["paid", "active", "completed"].includes(key)) return "bg-emerald-400/10 text-emerald-300";
      if (["cancelled", "failed", "rejected"].includes(key)) return "bg-red-400/10 text-red-300";
      if (["setup", "processing"].includes(key)) return "bg-blue-400/10 text-blue-300";
      return "bg-[#c9a24a]/10 text-[#e0c06e]";
    };
    const paidStatuses = ["paid", "awaiting_admin_approval", "approved", "provisioning", "provisioned"];
    const closedStatuses = ["cancelled", "failed", "rejected"];
    const isOrderPaid = (order: LandingOrderSummary) => paidStatuses.includes(order.status.toLowerCase()) || Boolean(order.paidAt || order.payment?.paidAt);
    const canPayOrder = (order: LandingOrderSummary) => order.status.toLowerCase() === "pending_payment" && !isOrderPaid(order);
    return <div dir="rtl" className="flex min-h-screen flex-col bg-[#0e0d0b] text-[#f4f2ee] [font-family:Vazirmatn,system-ui,sans-serif]">
      <header className="border-b border-white/10 bg-[#0e0d0b]/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 sm:px-8"><PellehBrandLogo imageClassName="h-14 w-auto max-w-[230px] object-contain sm:h-16 sm:max-w-[280px]" /><a href="/plans" className="rounded-full border border-[#c9a24a] px-4 py-2 text-xs font-bold text-[#e0c06e] sm:px-5 sm:text-sm">شروع خرید پکیج</a></div></header>
      <main className="mx-auto w-full max-w-[900px] flex-1 px-4 pb-16 pt-8 sm:px-8 sm:pt-11">
        <div className="mb-7"><span className="text-xs font-bold tracking-[1px] text-[#e0c06e]">پیگیری خرید</span><h1 className="mt-2 text-2xl font-black sm:text-[26px]">سوابق سفارش‌های من</h1></div>
        {!customer ? <section className="rounded-[20px] border border-white/10 bg-[#171512] p-8 text-center"><p className="text-sm text-[#9c988d]">برای مشاهده سفارش‌ها وارد حساب کاربری شوید.</p><button onClick={() => setLoginOpen(true)} className="mt-5 rounded-full bg-[#c9a24a] px-7 py-3 text-sm font-black text-[#0e0d0b]">ورود به حساب</button></section> : loading ? <div className="py-20 text-center text-sm text-[#9c988d]">در حال دریافت سفارش‌ها...</div> : orders.length === 0 ? <section className="rounded-[20px] border border-dashed border-white/10 py-16 text-center text-sm text-[#9c988d]">هنوز سفارشی ثبت نکرده‌اید.</section> : <div className="space-y-4">{orders.map((order) => { const paid = isOrderPaid(order); const payable = canPayOrder(order); const needsCompletion = paid && !order.completionSubmittedAt; return <article key={order.id} className={`rounded-[18px] border bg-[#171512] p-5 transition sm:p-6 ${needsCompletion || payable ? "border-amber-400/30" : "border-white/10 hover:border-[#c9a24a]/25"}`}><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2.5"><strong className="text-sm" dir="ltr">{order.orderNumber}</strong><span className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusClass(order.status)}`}>{order.statusLabel}</span></div><p className="mt-3 text-xs leading-6 text-[#9c988d]">پلن: <span className="text-[#c7c2b8]">{order.package.name || "—"}</span> — {new Intl.NumberFormat("fa-IR").format(order.package.durationDays)} روزه</p><p className="text-xs leading-6 text-[#9c988d]">دامنه: <span dir="ltr" className="inline-block text-[#c7c2b8]">{order.requestedDomain || (order.usesOwnDomain ? "دامنه شخصی / تعیین نشده" : "—")}</span></p></div>
          <div className="shrink-0 border-t border-white/10 pt-4 text-start sm:border-0 sm:pt-0"><strong className="block whitespace-nowrap text-base text-[#e0c06e] [direction:ltr]">{toman(order.totalAmount)}</strong><span className="mt-1.5 block text-xs text-[#817d74]">{orderDate(order.createdAt)}</span></div>
        </div>{payable && <div className="mt-5 flex flex-col gap-3 border-t border-amber-400/15 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-6 text-amber-200/80">این سفارش هنوز پرداخت نشده است. برای ادامه راه‌اندازی، ابتدا پرداخت آنلاین را انجام دهید.</p><button type="button" disabled={payingOrderId === order.id} onClick={() => handlePayOrder(order.id)} className="shrink-0 rounded-full bg-[#c9a24a] px-5 py-2.5 text-center text-xs font-black text-[#0e0d0b] transition hover:bg-[#e0c06e] disabled:cursor-wait disabled:opacity-60">{payingOrderId === order.id ? "در حال انتقال..." : "پرداخت آنلاین"}</button></div>}{needsCompletion && <div className="mt-5 flex flex-col gap-3 border-t border-amber-400/15 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-6 text-amber-200/80">پرداخت انجام شده، اما اطلاعات موردنیاز برای راه‌اندازی سیستم هنوز تکمیل نشده است.</p><a href={`/orders?complete=1&oid=${encodeURIComponent(order.id)}`} className="shrink-0 rounded-full bg-[#c9a24a] px-5 py-2.5 text-center text-xs font-black text-[#0e0d0b]">تکمیل اطلاعات سفارش</a></div>}{!payable && !needsCompletion && closedStatuses.includes(order.status.toLowerCase()) && <div className="mt-5 border-t border-red-400/10 pt-4"><p className="text-xs leading-6 text-red-200/80">این سفارش قابل پرداخت یا تکمیل نیست.</p></div>}{order.siteUrl && (order.provisionedAt || order.status === "provisioned") && <div className="mt-5 flex flex-col gap-3 border-t border-emerald-400/15 pt-4 sm:flex-row sm:items-center sm:justify-between"><div><strong className="block text-sm text-emerald-300">سایت شما نصب و راه‌اندازی شد ✓</strong><p className="mt-1 text-xs leading-6 text-[#9c988d]">وب‌سایت شما آماده استفاده است و می‌توانید وارد آن شوید.</p></div><a href={order.siteUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-emerald-400 px-5 py-2.5 text-center text-xs font-black text-[#07130c] transition hover:bg-emerald-300">ورود به سایت</a></div>}</article>; })}</div>}
        {lastPage > 1 && <div className="mt-7 flex items-center justify-center gap-3"><button disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)} className="rounded-full border border-white/10 px-4 py-2 text-xs disabled:opacity-40">قبلی</button><span className="text-xs text-[#9c988d]">صفحه {new Intl.NumberFormat("fa-IR").format(currentPage)} از {new Intl.NumberFormat("fa-IR").format(lastPage)}</span><button disabled={currentPage >= lastPage} onClick={() => setCurrentPage((page) => page + 1)} className="rounded-full border border-white/10 px-4 py-2 text-xs disabled:opacity-40">بعدی</button></div>}
      </main>
      <footer className="border-t border-white/10 px-5 py-8 text-center text-xs text-[#817d74]">© استپ — تمامی حقوق محفوظ است.</footer>
      <LandingAuthDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground" dir={dir}>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-card/70 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={landingSiteSettings.logoUrl} alt={landingSiteSettings.siteTitle} className="h-10 w-auto max-w-[170px] object-contain" />
            <div>
              <div className="text-sm text-primary">{landingSiteSettings.headerLabel}</div>
              <h2 className="text-base font-black sm:text-lg">{landingSiteSettings.siteTitle}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl border-border bg-background/40" onClick={() => setPhoneModalOpen(true)}>
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
                      <a onClick={() => setMenuOpen(false)} className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background/35 px-4 py-4 text-sm font-semibold text-foreground transition hover:border-primary/30">
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

      <main className="container mx-auto flex-1 max-w-5xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-primary">{t("landingOrders.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("landingOrders.title")}</h1>
          </div>
          <Link href={getLandingPath("/plans")}>
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40">
              <ArrowLeft className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>

        {feedback ? (
          <Card className={`border ${feedback.status === "success" ? "border-emerald-500/25 bg-emerald-500/10" : "border-red-500/25 bg-red-500/10"}`}>
            <CardContent className="space-y-2 p-5 text-sm">
              <div className="font-black">{feedback.status === "success" ? t("landingOrders.feedback.success") : t("landingOrders.feedback.failed")}</div>
              {feedback.order ? <div>{t("landingOrders.feedback.orderId")} <CodeText className="font-bold text-foreground">{feedback.order}</CodeText></div> : null}
              {feedback.tracking ? <div>{t("landingOrders.feedback.tracking")} <CodeText className="font-bold text-foreground">{feedback.tracking}</CodeText></div> : null}
              {feedback.message ? <div className="text-muted-foreground">{feedback.message}</div> : null}
              {feedback.status === "success" ? (
                <div className="pt-2">
                  <Button className="rounded-2xl" onClick={scrollToCompletion}>{t("landingOrders.feedback.completeCta")}</Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {!customer ? (
          <Card className="border-border/70 bg-card/60">
            <CardContent className="space-y-5 p-6 text-center sm:p-8">
              <div className="text-2xl font-black">{t("landingOrders.loginRequired.title")}</div>
              <p className="text-sm leading-8 text-muted-foreground">{t("landingOrders.loginRequired.description")}</p>
              <Button className="rounded-[20px] px-6" onClick={() => setLoginOpen(true)}>{t("landingOrders.loginRequired.cta")}</Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/70 bg-card/60">
            <CardContent className="space-y-4 p-5">
              <div className="rounded-[20px] border border-border/70 bg-background/35 p-4 text-sm leading-8 text-muted-foreground">
                <div className="mb-1 font-bold text-foreground">{customer.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(" ")}</div>
                <PhoneText>{customer.mobile}</PhoneText>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-2xl border-primary/35 bg-transparent" onClick={scrollToCompletion}>
                    {customerProfileComplete ? t("landingOrders.profile.editCompletion") : t("landingOrders.profile.completeAccount")}
                  </Button>
                </div>
              </div>

              {shouldShowCompletion ? (
                <Card ref={completionRef} className="border-primary/25 bg-primary/5">
                  <CardContent className="space-y-5 p-5">
                    <div className="space-y-1">
                      <div className="text-sm text-primary">{t("landingOrders.completion.eyebrow")}</div>
                      <div className="text-xl font-black">{t("landingOrders.completion.title")}</div>
                      <p className="text-sm leading-7 text-muted-foreground">
                        {t("landingOrders.completion.description")}
                      </p>
                    </div>

                    {selectedOrder ? (
                      <form className="space-y-5" onSubmit={handleCompletionSubmit}>
                        {requiresDomain ? (
                          <div className="space-y-2">
                            <Label htmlFor="landing-order-domain">
                              {selectedOrder.usesOwnDomain ? t("landingOrders.form.ownDomain") : t("landingOrders.form.domainName")}
                            </Label>
                            {usesFixedIrSuffix ? (
                              <div dir="ltr" className="flex items-center overflow-hidden rounded-[18px] border border-input bg-background">
                                <div className="flex-1">
                                  <Input
                                    id="landing-order-domain"
                                    dir="ltr"
                                    className="h-12 border-0 bg-transparent text-start shadow-none focus-visible:ring-0"
                                    placeholder="brandname"
                                    value={form.requestedDomain}
                                    onChange={(event) => setForm((current) => ({ ...current, requestedDomain: normalizeDomainInput(event.target.value) }))}
                                  />
                                </div>
                                <div className="flex h-12 items-center border-s border-border bg-primary px-4 text-sm font-black text-primary-foreground">
                                  .ir
                                </div>
                              </div>
                            ) : (
                              <Input
                                id="landing-order-domain"
                                dir="ltr"
                                className="text-start"
                                placeholder={selectedOrder.usesOwnDomain ? "example.ir" : "brandname.ir"}
                                value={form.requestedDomain}
                                onChange={(event) => setForm((current) => ({ ...current, requestedDomain: event.target.value }))}
                              />
                            )}
                            {!selectedOrder.usesOwnDomain ? (
                              <p className="text-xs leading-7 text-muted-foreground">
                                {t("landingOrders.form.domainHint")}
                              </p>
                            ) : null}
                            {formErrors.requestedDomain ? <div className="text-sm text-destructive">{formErrors.requestedDomain}</div> : null}
                          </div>
                        ) : null}

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="landing-complete-first-name">{t("landingOrders.form.firstName")}</Label>
                            <Input id="landing-complete-first-name" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
                            {formErrors.firstName ? <div className="text-sm text-destructive">{formErrors.firstName}</div> : null}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="landing-complete-last-name">{t("landingOrders.form.lastName")}</Label>
                            <Input id="landing-complete-last-name" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
                            {formErrors.lastName ? <div className="text-sm text-destructive">{formErrors.lastName}</div> : null}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="landing-complete-email">{t("landingOrders.form.email")}</Label>
                          <Input id="landing-complete-email" type="email" dir="ltr" className="text-start" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                          {formErrors.email ? <div className="text-sm text-destructive">{formErrors.email}</div> : null}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="landing-complete-province">{t("landingOrders.form.province")}</Label>
                            <select
                              id="landing-complete-province"
                              value={form.provinceId}
                              onChange={(event) => setForm((current) => ({ ...current, provinceId: event.target.value, cityId: "" }))}
                              className="h-12 w-full rounded-[18px] border border-input bg-background px-3 py-2 text-start"
                            >
                              <option value="">{t("landingOrders.form.provincePlaceholder")}</option>
                              {IRAN_PROVINCES.map((province) => (
                                <option key={province.id} value={province.id}>{province.name}</option>
                              ))}
                            </select>
                            {formErrors.provinceId ? <div className="text-sm text-destructive">{formErrors.provinceId}</div> : null}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="landing-complete-city">{t("landingOrders.form.city")}</Label>
                            <select
                              id="landing-complete-city"
                              value={form.cityId}
                              onChange={(event) => setForm((current) => ({ ...current, cityId: event.target.value }))}
                              disabled={!form.provinceId}
                              className="h-12 w-full rounded-[18px] border border-input bg-background px-3 py-2 text-start disabled:opacity-50"
                            >
                              <option value="">{t("landingOrders.form.cityPlaceholder")}</option>
                              {cities.map((city) => (
                                <option key={city.id} value={city.id}>{city.name}</option>
                              ))}
                            </select>
                            {formErrors.cityId ? <div className="text-sm text-destructive">{formErrors.cityId}</div> : null}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="landing-complete-address">{t("landingOrders.form.address")}</Label>
                          <Textarea id="landing-complete-address" rows={4} value={form.addressLine} onChange={(event) => setForm((current) => ({ ...current, addressLine: event.target.value }))} />
                          {formErrors.addressLine ? <div className="text-sm text-destructive">{formErrors.addressLine}</div> : null}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="landing-complete-national">{t("landingOrders.form.nationalCode")}</Label>
                            <Input
                              id="landing-complete-national"
                              dir="ltr"
                              className="text-start"
                              inputMode="numeric"
                              value={form.nationalCode}
                              onChange={(event) => setForm((current) => ({ ...current, nationalCode: normalizeDigits(event.target.value).slice(0, 10) }))}
                            />
                            {formErrors.nationalCode ? <div className="text-sm text-destructive">{formErrors.nationalCode}</div> : null}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="landing-complete-gender">{t("landingOrders.form.gender")}</Label>
                            <select
                              id="landing-complete-gender"
                              value={form.gender}
                              onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value as "male" | "female" | "" }))}
                              className="h-12 w-full rounded-[18px] border border-input bg-background px-3 py-2 text-start"
                            >
                              <option value="">{t("landingOrders.form.genderPlaceholder")}</option>
                              <option value="male">{t("landingOrders.gender.male")}</option>
                              <option value="female">{t("landingOrders.gender.female")}</option>
                            </select>
                            {formErrors.gender ? <div className="text-sm text-destructive">{formErrors.gender}</div> : null}
                          </div>
                        </div>

                        {completionMessage ? <div className="rounded-xl border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">{completionMessage}</div> : null}

                        <div className="flex flex-wrap gap-3">
                          <Button type="submit" className="rounded-2xl" disabled={completionSubmitting}>
                            {completionSubmitting ? t("landingOrders.form.submitting") : t("landingOrders.form.submit")}
                          </Button>
                          {customerProfileComplete && selectedOrderCompleted ? (
                            <Button type="button" variant="outline" className="rounded-2xl border-primary/35 bg-transparent" onClick={() => setCompletionOpen(false)}>
                              {t("landingOrders.form.close")}
                            </Button>
                          ) : null}
                        </div>
                      </form>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              {loading ? (
                <div className="rounded-[20px] border border-border/70 bg-background/35 p-6 text-sm text-muted-foreground">{t("landingOrders.list.loading")}</div>
              ) : orders.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-border/70 bg-background/35 p-6 text-sm text-muted-foreground">{t("landingOrders.list.empty")}</div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="rounded-[24px] border border-border/70 bg-background/35 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="font-black text-primary">{order.orderNumber}</div>
                        <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{order.statusLabel}</div>
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <div>{t("landingOrders.order.plan")} <span className="font-semibold text-foreground">{order.package.name}</span></div>
                        <div>{t("landingOrders.order.domain")} <span className="font-semibold text-foreground">{order.requestedDomain ? <CodeText>{order.requestedDomain}</CodeText> : t("landingOrders.order.domainMissing")}</span></div>
                        <div>{t("landingOrders.order.total")} <span className="font-semibold text-foreground">{format.currency(order.totalAmount)}</span></div>
                        <div>{t("landingOrders.order.date")} <span className="font-semibold text-foreground">{order.createdAt ? format.date(order.createdAt) : t("landingOrders.valueMissing")}</span></div>
                      </div>
                      {order.payment ? (
                        <div className="mt-3 rounded-[16px] border border-border/70 bg-card/40 p-3 text-sm text-muted-foreground">
                          {t("landingOrders.order.paymentId")} <CodeText className="font-semibold text-foreground">{order.payment.referenceId || order.payment.invoiceNumber}</CodeText>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {lastPage > 1 ? (
                <div className="flex items-center justify-center gap-3 pt-1">
                  <Button variant="outline" className="rounded-[16px] border-border bg-background/40" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1}>{t("common.pagination.previous")}</Button>
                  <div className="text-sm text-muted-foreground">{t("landingOrders.pagination.page", { current: format.number(currentPage), total: format.number(lastPage) })}</div>
                  <Button variant="outline" className="rounded-[16px] border-border bg-background/40" onClick={() => setCurrentPage((page) => Math.min(lastPage, page + 1))} disabled={currentPage >= lastPage}>{t("common.pagination.next")}</Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="border-t border-border/70 bg-card/60">
        <div className="container mx-auto px-4 py-5 text-center text-sm text-muted-foreground">{t("landingOrders.footer")}</div>
      </footer>

      <LandingAuthDialog open={loginOpen} onOpenChange={setLoginOpen} />

      <Dialog open={phoneModalOpen} onOpenChange={setPhoneModalOpen}>
        <DialogContent dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" />
              {t("landingOrders.phoneModal.title")}
            </DialogTitle>
            <DialogDescription>{t("landingOrders.phoneModal.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {phoneNumbers.map((phone) => (
              <a key={phone} href={`tel:${phone.replace(/\s+/g, "")}`} className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/35 px-4 py-3 text-sm font-semibold text-foreground">
                <PhoneText>{phone}</PhoneText>
                <PhoneCall className="h-4 w-4 text-primary" />
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent dir={dir} className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-primary">{t("landingOrders.successModal.title")}</DialogTitle>
            <DialogDescription className="text-sm leading-8 text-muted-foreground">
              {t("landingOrders.successModal.description")}
              <br />
              {t("landingOrders.successModal.thanks")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button className="rounded-2xl" onClick={() => setSuccessModalOpen(false)}>
              {t("landingOrders.successModal.ok")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
