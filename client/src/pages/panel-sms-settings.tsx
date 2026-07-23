import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Inbox, Loader2, MessageSquareText, Send, ShoppingCart, Sparkles, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { NutritionSmsTemplateKey, PaymentSettings, SmsTemplateConfig, SmsTemplateKey, StoreGeneralSettings, StoreSmsTemplateKey } from "@/lib/types";
import { getAudienceLabels, isAppointmentBookingDisabled } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type TFunction = ReturnType<typeof useT>;
type Formatters = ReturnType<typeof useFormat>;

const createDefaultSmsSettings = (t: TFunction): PaymentSettings => ({
  enabled: false,
  provider: null,
  gateways: {} as PaymentSettings["gateways"],
  sandboxEnabled: false,
  enabledGateways: [],
  smsEnabled: false,
  smsProvider: null,
  smsApiKey: "",
  smsSender: "",
  smsAvailableSenders: [],
  smsTemplateAdminBooking: "",
  smsTemplateUserBooking: "",
  smsTemplateCancellation: "",
  smsTemplateReminder: "",
  smsTemplatesV2: {
    adminBooking: {
      enabled: true,
      body: t("panelSms.default.booking.adminBooking"),
      approval_status: "pending_review",
      approved_body: "",
      approved_enabled: false,
      rejection_reason: null,
    },
    userBooking: {
      enabled: true,
      body: t("panelSms.default.booking.userBooking"),
      approval_status: "pending_review",
      approved_body: "",
      approved_enabled: false,
      rejection_reason: null,
    },
    cancellation: {
      enabled: false,
      body: t("panelSms.default.booking.cancellation"),
      approval_status: "pending_review",
      approved_body: "",
      approved_enabled: false,
      rejection_reason: null,
    },
    appointmentChange: {
      enabled: true,
      body: t("panelSms.default.booking.appointmentChange"),
      approval_status: "approved",
      approved_body: t("panelSms.default.booking.appointmentChange"),
      approved_enabled: true,
      rejection_reason: null,
    },
    reminder: {
      enabled: true,
      body: t("panelSms.default.booking.reminder"),
      approval_status: "approved",
      approved_body: t("panelSms.default.booking.reminder"),
      approved_enabled: true,
      rejection_reason: null,
    },
    reminderThreeHours: {
      enabled: true,
      body: t("panelSms.default.booking.reminderThreeHours"),
      approval_status: "approved",
      approved_body: t("panelSms.default.booking.reminderThreeHours"),
      approved_enabled: true,
      rejection_reason: null,
    },
    loginOtp: {
      enabled: true,
      body: t("panelSms.default.booking.loginOtp"),
      approval_status: "pending_review",
      approved_body: "",
      approved_enabled: false,
      rejection_reason: null,
    },
    customerFeedback: {
      enabled: true,
      body: t("panelSms.default.booking.customerFeedback"),
      approval_status: "pending_review",
      approved_body: "",
      approved_enabled: false,
      rejection_reason: null,
    },
    appointmentReopened: {
      enabled: true,
      body: t("panelSms.default.booking.appointmentReopened"),
      approval_status: "approved",
      approved_body: t("panelSms.default.booking.appointmentReopened"),
      approved_enabled: true,
      rejection_reason: null,
    },
  },
  nutritionSmsEnabled: true,
  nutritionSmsTemplatesV2: {
    afterAiPrescription: {
      enabled: true,
      body: t("panelSms.default.nutrition.afterAiPrescription"),
      approval_status: "approved",
      approved_body: t("panelSms.default.nutrition.afterAiPrescription"),
      approved_enabled: true,
      rejection_reason: null,
    },
    afterAiApproval: {
      enabled: true,
      body: t("panelSms.default.nutrition.afterAiApproval"),
      approval_status: "approved",
      approved_body: t("panelSms.default.nutrition.afterAiApproval"),
      approved_enabled: true,
      rejection_reason: null,
    },
    dietEndingTomorrow: {
      enabled: true,
      body: t("panelSms.default.nutrition.dietEndingTomorrow"),
      approval_status: "approved",
      approved_body: t("panelSms.default.nutrition.dietEndingTomorrow"),
      approved_enabled: true,
      rejection_reason: null,
    },
    dietEndsToday: {
      enabled: true,
      body: t("panelSms.default.nutrition.dietEndsToday"),
      approval_status: "approved",
      approved_body: t("panelSms.default.nutrition.dietEndsToday"),
      approved_enabled: true,
      rejection_reason: null,
    },
    dietExpiredNoRequestDay1: {
      enabled: true,
      body: t("panelSms.default.nutrition.dietExpiredNoRequestDay1"),
      approval_status: "approved",
      approved_body: t("panelSms.default.nutrition.dietExpiredNoRequestDay1"),
      approved_enabled: true,
      rejection_reason: null,
    },
    packageFinished: {
      enabled: true,
      body: t("panelSms.default.nutrition.packageFinished"),
      approval_status: "approved",
      approved_body: t("panelSms.default.nutrition.packageFinished"),
      approved_enabled: true,
      rejection_reason: null,
    },
    packageFinishedWeek1: {
      enabled: true,
      body: t("panelSms.default.nutrition.packageFinishedWeek1"),
      approval_status: "approved",
      approved_body: t("panelSms.default.nutrition.packageFinishedWeek1"),
      approved_enabled: true,
      rejection_reason: null,
    },
    packageFinishedDay15: {
      enabled: true,
      body: t("panelSms.default.nutrition.packageFinishedDay15"),
      approval_status: "approved",
      approved_body: t("panelSms.default.nutrition.packageFinishedDay15"),
      approved_enabled: true,
      rejection_reason: null,
    },
    afterPackagePurchase: {
      enabled: true,
      body: t("panelSms.default.nutrition.afterPackagePurchase"),
      approval_status: "approved",
      approved_body: t("panelSms.default.nutrition.afterPackagePurchase"),
      approved_enabled: true,
      rejection_reason: null,
    },
  },
  smsStats: {
    totalSent: 0,
    sentToday: 0,
    creditBalance: 0,
  },
  smsPricing: {
    persianPrice: 0,
    englishPrice: 0,
  },
});

type TemplateMeta = {
  key: SmsTemplateKey;
  title: string;
  description: string;
  accentClass: string;
};

type PlaceholderOption = {
  token: string;
  label: string;
  sample: string;
};

const createDefaultStoreSmsTemplates = (t: TFunction): Record<StoreSmsTemplateKey, SmsTemplateConfig> => ({
  afterOrder: {
    enabled: true,
    body: t("panelSms.default.store.afterOrder"),
    approval_status: "pending_review",
    approved_body: "",
    approved_enabled: false,
    rejection_reason: null,
  },
  afterApproval: {
    enabled: true,
    body: t("panelSms.default.store.afterApproval"),
    approval_status: "pending_review",
    approved_body: "",
    approved_enabled: false,
    rejection_reason: null,
  },
  afterShippingCode: {
    enabled: true,
    body: t("panelSms.default.store.afterShippingCode"),
    approval_status: "pending_review",
    approved_body: "",
    approved_enabled: false,
    rejection_reason: null,
  },
  afterRejection: {
    enabled: false,
    body: "",
    approval_status: "draft",
    approved_body: "",
    approved_enabled: false,
    rejection_reason: null,
  },
});

const createTemplateMeta = (t: TFunction): TemplateMeta[] => [
  {
    key: "adminBooking",
    title: t("panelSms.template.adminBooking.title"),
    description: t("panelSms.template.adminBooking.description"),
    accentClass: "border-primary/20 bg-primary/5",
  },
  {
    key: "userBooking",
    title: t("panelSms.template.userBooking.title"),
    description: t("panelSms.template.userBooking.description"),
    accentClass: "border-emerald-500/20 bg-emerald-500/10",
  },
  {
    key: "cancellation",
    title: t("panelSms.template.cancellation.title"),
    description: t("panelSms.template.cancellation.description"),
    accentClass: "border-rose-500/20 bg-rose-500/10",
  },
  {
    key: "appointmentChange",
    title: t("panelSms.template.appointmentChange.title"),
    description: t("panelSms.template.appointmentChange.description"),
    accentClass: "border-cyan-500/20 bg-cyan-500/10",
  },
  {
    key: "reminder",
    title: t("panelSms.template.reminder.title"),
    description: t("panelSms.template.reminder.description"),
    accentClass: "border-amber-500/20 bg-amber-500/10",
  },
  {
    key: "reminderThreeHours",
    title: t("panelSms.template.reminderThreeHours.title"),
    description: t("panelSms.template.reminderThreeHours.description"),
    accentClass: "border-orange-500/20 bg-orange-500/10",
  },
  {
    key: "loginOtp",
    title: t("panelSms.template.loginOtp.title"),
    description: t("panelSms.template.loginOtp.description"),
    accentClass: "border-violet-500/20 bg-violet-500/10",
  },
  {
    key: "customerFeedback",
    title: t("panelSms.template.customerFeedback.title"),
    description: t("panelSms.template.customerFeedback.description"),
    accentClass: "border-sky-500/20 bg-sky-500/10",
  },
  {
    key: "appointmentReopened",
    title: t("panelSms.template.appointmentReopened.title"),
    description: t("panelSms.template.appointmentReopened.description"),
    accentClass: "border-teal-500/20 bg-teal-500/10",
  },
];

const createStoreTemplateMeta = (t: TFunction): Array<{
  key: StoreSmsTemplateKey;
  title: string;
  description: string;
  placeholder: string;
}> => [
  {
    key: "afterOrder",
    title: t("panelSms.storeTemplate.afterOrder.title"),
    description: t("panelSms.storeTemplate.afterOrder.description"),
    placeholder: t("panelSms.storeTemplate.afterOrder.placeholder"),
  },
  {
    key: "afterApproval",
    title: t("panelSms.storeTemplate.afterApproval.title"),
    description: t("panelSms.storeTemplate.afterApproval.description"),
    placeholder: t("panelSms.storeTemplate.afterApproval.placeholder"),
  },
  {
    key: "afterShippingCode",
    title: t("panelSms.storeTemplate.afterShippingCode.title"),
    description: t("panelSms.storeTemplate.afterShippingCode.description"),
    placeholder: t("panelSms.storeTemplate.afterShippingCode.placeholder"),
  },
  {
    key: "afterRejection",
    title: t("panelSms.storeTemplate.afterRejection.title"),
    description: t("panelSms.storeTemplate.afterRejection.description"),
    placeholder: t("panelSms.storeTemplate.afterRejection.placeholder"),
  },
];

const createNutritionTemplateMeta = (t: TFunction): Array<{
  key: NutritionSmsTemplateKey;
  title: string;
  description: string;
  placeholder: string;
}> => [
  {
    key: "afterAiPrescription",
    title: t("panelSms.nutritionTemplate.afterAiPrescription.title"),
    description: t("panelSms.nutritionTemplate.afterAiPrescription.description"),
    placeholder: t("panelSms.nutritionTemplate.afterAiPrescription.placeholder"),
  },
  {
    key: "afterAiApproval",
    title: t("panelSms.nutritionTemplate.afterAiApproval.title"),
    description: t("panelSms.nutritionTemplate.afterAiApproval.description"),
    placeholder: t("panelSms.nutritionTemplate.afterAiApproval.placeholder"),
  },
  {
    key: "dietEndingTomorrow",
    title: t("panelSms.nutritionTemplate.dietEndingTomorrow.title"),
    description: t("panelSms.nutritionTemplate.dietEndingTomorrow.description"),
    placeholder: t("panelSms.nutritionTemplate.dietEndingTomorrow.placeholder"),
  },
  {
    key: "dietEndsToday",
    title: t("panelSms.nutritionTemplate.dietEndsToday.title"),
    description: t("panelSms.nutritionTemplate.dietEndsToday.description"),
    placeholder: t("panelSms.nutritionTemplate.dietEndsToday.placeholder"),
  },
  {
    key: "dietExpiredNoRequestDay1",
    title: t("panelSms.nutritionTemplate.dietExpiredNoRequestDay1.title"),
    description: t("panelSms.nutritionTemplate.dietExpiredNoRequestDay1.description"),
    placeholder: t("panelSms.nutritionTemplate.dietExpiredNoRequestDay1.placeholder"),
  },
  {
    key: "packageFinished",
    title: t("panelSms.nutritionTemplate.packageFinished.title"),
    description: t("panelSms.nutritionTemplate.packageFinished.description"),
    placeholder: t("panelSms.nutritionTemplate.packageFinished.placeholder"),
  },
  {
    key: "packageFinishedWeek1",
    title: t("panelSms.nutritionTemplate.packageFinishedWeek1.title"),
    description: t("panelSms.nutritionTemplate.packageFinishedWeek1.description"),
    placeholder: t("panelSms.nutritionTemplate.packageFinishedWeek1.placeholder"),
  },
  {
    key: "packageFinishedDay15",
    title: t("panelSms.nutritionTemplate.packageFinishedDay15.title"),
    description: t("panelSms.nutritionTemplate.packageFinishedDay15.description"),
    placeholder: t("panelSms.nutritionTemplate.packageFinishedDay15.placeholder"),
  },
  {
    key: "afterPackagePurchase",
    title: t("panelSms.nutritionTemplate.afterPackagePurchase.title"),
    description: t("panelSms.nutritionTemplate.afterPackagePurchase.description"),
    placeholder: t("panelSms.nutritionTemplate.afterPackagePurchase.placeholder"),
  },
];

const normalizeStoreSmsTemplates = (
  defaults: Record<StoreSmsTemplateKey, SmsTemplateConfig>,
  value?: StoreGeneralSettings["smsTemplatesV2"],
): Record<StoreSmsTemplateKey, SmsTemplateConfig> => ({
  afterOrder: value?.afterOrder ?? defaults.afterOrder,
  afterApproval: value?.afterApproval ?? defaults.afterApproval,
  afterShippingCode: value?.afterShippingCode ?? defaults.afterShippingCode,
  afterRejection: value?.afterRejection ?? defaults.afterRejection,
});

const normalizeSmsTemplates = (
  defaults: PaymentSettings,
  value?: PaymentSettings["smsTemplatesV2"],
): NonNullable<PaymentSettings["smsTemplatesV2"]> => ({
  adminBooking: value?.adminBooking ?? defaults.smsTemplatesV2!.adminBooking,
  userBooking: value?.userBooking ?? defaults.smsTemplatesV2!.userBooking,
  cancellation: value?.cancellation ?? defaults.smsTemplatesV2!.cancellation,
  appointmentChange: value?.appointmentChange ?? defaults.smsTemplatesV2!.appointmentChange,
  reminder: value?.reminder ?? defaults.smsTemplatesV2!.reminder,
  reminderThreeHours: value?.reminderThreeHours ?? defaults.smsTemplatesV2!.reminderThreeHours,
  loginOtp: value?.loginOtp ?? defaults.smsTemplatesV2!.loginOtp,
  customerFeedback: value?.customerFeedback ?? defaults.smsTemplatesV2!.customerFeedback,
  appointmentReopened: value?.appointmentReopened ?? defaults.smsTemplatesV2!.appointmentReopened,
});

const normalizeNutritionSmsTemplates = (
  defaults: PaymentSettings,
  value?: PaymentSettings["nutritionSmsTemplatesV2"],
): NonNullable<PaymentSettings["nutritionSmsTemplatesV2"]> => ({
  afterAiPrescription: value?.afterAiPrescription ?? defaults.nutritionSmsTemplatesV2!.afterAiPrescription,
  afterAiApproval: value?.afterAiApproval ?? defaults.nutritionSmsTemplatesV2!.afterAiApproval,
  dietEndingTomorrow: value?.dietEndingTomorrow ?? defaults.nutritionSmsTemplatesV2!.dietEndingTomorrow,
  dietEndsToday: value?.dietEndsToday ?? defaults.nutritionSmsTemplatesV2!.dietEndsToday,
  dietExpiredNoRequestDay1: value?.dietExpiredNoRequestDay1 ?? defaults.nutritionSmsTemplatesV2!.dietExpiredNoRequestDay1,
  packageFinished: value?.packageFinished ?? defaults.nutritionSmsTemplatesV2!.packageFinished,
  packageFinishedWeek1: value?.packageFinishedWeek1 ?? defaults.nutritionSmsTemplatesV2!.packageFinishedWeek1,
  packageFinishedDay15: value?.packageFinishedDay15 ?? defaults.nutritionSmsTemplatesV2!.packageFinishedDay15,
  afterPackagePurchase: value?.afterPackagePurchase ?? defaults.nutritionSmsTemplatesV2!.afterPackagePurchase,
});

const normalizeSmsStats = (defaults: PaymentSettings, value?: PaymentSettings["smsStats"]): NonNullable<PaymentSettings["smsStats"]> => ({
  totalSent: value?.totalSent ?? defaults.smsStats!.totalSent,
  sentToday: value?.sentToday ?? defaults.smsStats!.sentToday,
  creditBalance: value?.creditBalance ?? defaults.smsStats!.creditBalance,
});

function estimateSmsParts(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const characters = normalized.length;

  if (characters === 0) {
    return { characters: 0, parts: 0 };
  }

  const isLatinOnly = /^[\x00-\x7F]*$/.test(normalized);
  const singlePartLimit = isLatinOnly ? 160 : 70;
  const multipartLimit = isLatinOnly ? 153 : 67;
  const parts = characters <= singlePartLimit ? 1 : Math.ceil(characters / multipartLimit);

  return { characters, parts };
}

function estimateTextBlock(text: string, t: TFunction, format: Formatters) {
  const estimate = estimateSmsParts(text);

  if (!estimate.characters) {
    return null;
  }

  return (
    <div className="mt-4 rounded-[18px] border border-border/70 bg-background/60 p-3 text-xs leading-6 text-muted-foreground">
      <div>
        {t("panelSms.estimate.summary", { parts: format.number(estimate.parts), characters: format.number(estimate.characters) })}
      </div>
      <div className="mt-1">{t("panelSms.estimate.hint")}</div>
    </div>
  );
}

function approvalLabel(status: SmsTemplateConfig["approval_status"] | undefined, t: TFunction) {
  const keyByStatus: Record<NonNullable<SmsTemplateConfig["approval_status"]>, MessageKey> = {
    approved: "panelSms.approval.approved",
    rejected: "panelSms.approval.rejected",
    pending_review: "panelSms.approval.pendingReview",
    draft: "panelSms.approval.draft",
  };

  return t(keyByStatus[status ?? "draft"]);
}

function approvalTone(status?: SmsTemplateConfig["approval_status"]) {
  switch (status) {
    case "rejected":
      return "destructive" as const;
    case "approved":
      return "default" as const;
    default:
      return "secondary" as const;
  }
}

export default function PanelSmsSettingsPage() {
  const { isPrimaryAdmin, isAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [location] = useLocation();
  const tenantMeta = getInitialTenantMeta();
  const labels = getAudienceLabels(tenantMeta);
  const isNutritionAudience = ["nutritionists", "nutrition-doctors"].includes(tenantMeta?.audience?.slug ?? "");
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const defaultSmsSettings = useMemo(() => createDefaultSmsSettings(t), [t]);
  const defaultStoreSmsTemplates = useMemo(() => createDefaultStoreSmsTemplates(t), [t]);
  const templateMeta = useMemo(() => createTemplateMeta(t), [t]);
  const storeTemplateMeta = useMemo(() => createStoreTemplateMeta(t), [t]);
  const nutritionTemplateMeta = useMemo(() => createNutritionTemplateMeta(t), [t]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PaymentSettings>(defaultSmsSettings);
  const [storeSmsSettings, setStoreSmsSettings] = useState<StoreGeneralSettings>({
    enabled: true,
    storeModuleActive: false,
    smsEnabled: false,
    smsTemplateAfterOrder: "",
    smsTemplateAfterApproval: "",
    smsTemplateAfterShippingCode: "",
    smsTemplateAfterRejection: "",
    smsTemplatesV2: normalizeStoreSmsTemplates(defaultStoreSmsTemplates, undefined),
  });

  const bookingPlaceholderOptions = useMemo<PlaceholderOption[]>(
    () => [
      { token: "{{customer_name}}", label: t("panelSms.placeholder.customerName"), sample: t("panelSms.sample.customerName") },
      { token: "{{appointment_date}}", label: t("panelSms.placeholder.appointmentDate"), sample: format.date("2026-04-14") },
      { token: "{{appointment_time}}", label: t("panelSms.placeholder.appointmentTime"), sample: format.time("2026-04-14T18:30:00") },
      { token: "{{appointment_url}}", label: t("panelSms.placeholder.appointmentUrl"), sample: "https://example.com/appointments/384" },
      { token: "{{service_name}}", label: t("panelSms.placeholder.serviceName"), sample: t("panelSms.sample.serviceName") },
      { token: "{{business_name}}", label: t("panelSms.placeholder.businessName"), sample: t("panelSms.sample.businessName") },
      { token: "{{business_phone}}", label: t("panelSms.placeholder.businessPhone"), sample: "02144444444" },
      { token: "{{tracking_code}}", label: t("panelSms.placeholder.trackingCode"), sample: "A-1842" },
      { token: "{{professional_name}}", label: t("panelSms.placeholder.professionalName", { professional: labels.singular }), sample: t("panelSms.sample.professionalName", { professional: labels.singular }) },
      { token: "{{code}}", label: t("panelSms.placeholder.code"), sample: "1234" },
      { token: "{{feedback_url}}", label: t("panelSms.placeholder.feedbackUrl"), sample: "https://example.com/feedback/abc123" },
    ],
    [format, labels.singular, t],
  );

  const storePlaceholderOptions = useMemo<PlaceholderOption[]>(
    () => [
      { token: "{{customer_name}}", label: t("panelSms.placeholder.customerName"), sample: t("panelSms.sample.customerName") },
      { token: "{{order_number}}", label: t("panelSms.placeholder.orderNumber"), sample: format.number(1024) },
      { token: "{{order_total}}", label: t("panelSms.placeholder.orderTotal"), sample: format.currency(890000) },
      { token: "{{tracking_code}}", label: t("panelSms.placeholder.trackingCode"), sample: "3939393939" },
      { token: "{{order_url}}", label: t("panelSms.placeholder.orderUrl"), sample: "https://example.com/store/orders/1024" },
      { token: "{{business_name}}", label: t("panelSms.placeholder.businessName"), sample: t("panelSms.sample.businessName") },
      { token: "{{business_phone}}", label: t("panelSms.placeholder.businessPhone"), sample: "02144444444" },
    ],
    [format, t],
  );

  useEffect(() => {
    let active = true;

    Promise.all([api.payment.getSettings(), api.store.getGeneralSettings()]).then(([generalRes, storeRes]) => {
      if (!active) {
        return;
      }

      if (generalRes.success) {
        setSettings({
          ...defaultSmsSettings,
          ...generalRes.data,
          smsTemplatesV2: normalizeSmsTemplates(defaultSmsSettings, generalRes.data.smsTemplatesV2),
          nutritionSmsTemplatesV2: normalizeNutritionSmsTemplates(defaultSmsSettings, generalRes.data.nutritionSmsTemplatesV2),
          smsStats: normalizeSmsStats(defaultSmsSettings, generalRes.data.smsStats),
        });
      }

      if (storeRes.success) {
        setStoreSmsSettings({
          ...storeRes.data,
          smsTemplatesV2: normalizeStoreSmsTemplates(defaultStoreSmsTemplates, storeRes.data.smsTemplatesV2),
        });
      }

      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [defaultSmsSettings, defaultStoreSmsTemplates]);

  const storeModuleActive = storeSmsSettings.storeModuleActive ?? (tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-store") ?? false);
  const storeHasSavedSmsContent = [
    storeSmsSettings.smsTemplateAfterOrder,
    storeSmsSettings.smsTemplateAfterApproval,
    storeSmsSettings.smsTemplateAfterShippingCode,
    storeSmsSettings.smsTemplateAfterRejection,
    ...Object.values(normalizeStoreSmsTemplates(defaultStoreSmsTemplates, storeSmsSettings.smsTemplatesV2)).map((item) => item.body),
  ].some((value) => Boolean(value?.trim()));
  const showStoreSmsSection =
    storeModuleActive ||
    tenantMeta?.storeEnabled !== false ||
    storeSmsSettings.enabled === true ||
    storeSmsSettings.smsEnabled === true ||
    storeHasSavedSmsContent;
  const appointmentBookingDisabled = isAppointmentBookingDisabled(tenantMeta);

  const requestedMode = location.endsWith("/store") ? "store" : location.endsWith("/booking") ? "booking" : location.endsWith("/feedback") ? "feedback" : location.endsWith("/nutrition") ? "nutrition" : "hub";
  const currentMode = requestedMode === "booking" && appointmentBookingDisabled
    ? "hub"
    : requestedMode === "hub" && !showStoreSmsSection && !appointmentBookingDisabled
      ? "booking"
      : requestedMode;

  const smsTemplates = normalizeSmsTemplates(defaultSmsSettings, settings.smsTemplatesV2);
  const smsStats = normalizeSmsStats(defaultSmsSettings, settings.smsStats);
  const bookingTemplateMeta = templateMeta.filter((item) => item.key !== "customerFeedback");
  const feedbackTemplateMeta = templateMeta.filter((item) => item.key === "customerFeedback");
  const bookingActiveCount = bookingTemplateMeta.filter((item) => smsTemplates[item.key].enabled).length;
  const feedbackActiveCount = feedbackTemplateMeta.filter((item) => smsTemplates[item.key].enabled).length;
  const storeTemplates = normalizeStoreSmsTemplates(defaultStoreSmsTemplates, storeSmsSettings.smsTemplatesV2);
  const storeFilledCount = storeTemplateMeta.filter((item) => Boolean(storeTemplates[item.key]?.body?.trim())).length;
  const nutritionTemplates = normalizeNutritionSmsTemplates(defaultSmsSettings, settings.nutritionSmsTemplatesV2);
  const nutritionActiveCount = nutritionTemplateMeta.filter((item) => nutritionTemplates[item.key].enabled).length;
  const nutritionFilledCount = nutritionTemplateMeta.filter((item) => Boolean(nutritionTemplates[item.key]?.body?.trim())).length;

  const saveSettings = async () => {
    const loginOtpBody = (normalizeSmsTemplates(defaultSmsSettings, settings.smsTemplatesV2).loginOtp.body ?? "").trim();

    if (!loginOtpBody.includes("{{code}}")) {
      toast({
        variant: "destructive",
        title: t("panelSms.toast.saveFailedTitle"),
        description: t("panelSms.toast.loginOtpCodeRequired"),
      });
      return;
    }

    setSaving(true);
    const [res, storeRes] = await Promise.all([
      api.payment.updateSettings(settings),
      api.store.updateGeneralSettings({
        ...storeSmsSettings,
        smsTemplatesV2: normalizeStoreSmsTemplates(defaultStoreSmsTemplates, storeSmsSettings.smsTemplatesV2),
      }),
    ]);
    setSaving(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("panelSms.toast.saveFailedTitle"),
        description: res.message || t("panelSms.toast.smsSaveFailedDescription"),
      });
      return;
    }

    if (!storeRes.success) {
      toast({
        variant: "destructive",
        title: t("panelSms.toast.partialSaveFailedTitle"),
        description: storeRes.message || t("panelSms.toast.storeSaveFailedDescription"),
      });
      return;
    }

    setSettings({
      ...defaultSmsSettings,
      ...res.data,
      smsTemplatesV2: normalizeSmsTemplates(defaultSmsSettings, res.data.smsTemplatesV2 ?? settings.smsTemplatesV2),
      nutritionSmsTemplatesV2: normalizeNutritionSmsTemplates(defaultSmsSettings, res.data.nutritionSmsTemplatesV2 ?? settings.nutritionSmsTemplatesV2),
      smsStats: normalizeSmsStats(defaultSmsSettings, res.data.smsStats ?? settings.smsStats),
    });
    setStoreSmsSettings({
      ...storeRes.data,
      smsTemplatesV2: normalizeStoreSmsTemplates(defaultStoreSmsTemplates, storeRes.data.smsTemplatesV2),
    });

    toast({
      title: t("panelSms.toast.savedTitle"),
      description: t("panelSms.toast.savedDescription"),
    });
  };

  const updateTemplate = (key: SmsTemplateKey, patch: { enabled?: boolean; body?: string }) => {
    setSettings((current) => ({
      ...current,
      smsTemplatesV2: {
        ...normalizeSmsTemplates(defaultSmsSettings, current.smsTemplatesV2),
        [key]: {
          ...(current.smsTemplatesV2?.[key] ?? defaultSmsSettings.smsTemplatesV2![key]),
          ...patch,
        },
      },
    }));
  };

  const insertBookingPlaceholder = (key: SmsTemplateKey, token: string) => {
    const currentBody = settings.smsTemplatesV2?.[key]?.body ?? "";
    updateTemplate(key, {
      body: `${currentBody}${currentBody.trim() ? " " : ""}${token}`,
    });
  };

  const updateStoreTemplate = (key: StoreSmsTemplateKey, patch: { enabled?: boolean; body?: string }) => {
    setStoreSmsSettings((current) => ({
      ...current,
      smsTemplatesV2: {
        ...normalizeStoreSmsTemplates(defaultStoreSmsTemplates, current.smsTemplatesV2),
        [key]: {
          ...(current.smsTemplatesV2?.[key] ?? defaultStoreSmsTemplates[key]),
          ...patch,
        },
      },
    }));
  };

  const insertStorePlaceholder = (field: StoreSmsTemplateKey, token: string) => {
    const currentBody = normalizeStoreSmsTemplates(defaultStoreSmsTemplates, storeSmsSettings.smsTemplatesV2)[field]?.body ?? "";
    setStoreSmsSettings((current) => ({
      ...current,
      smsTemplatesV2: {
        ...normalizeStoreSmsTemplates(defaultStoreSmsTemplates, current.smsTemplatesV2),
        [field]: {
          ...(current.smsTemplatesV2?.[field] ?? defaultStoreSmsTemplates[field]),
          body: `${currentBody}${currentBody.trim() ? " " : ""}${token}`,
        },
      },
    }));
  };

  const nutritionPlaceholderOptions = useMemo<PlaceholderOption[]>(
    () => [
      { token: "{{customer_name}}", label: t("panelSms.placeholder.userName"), sample: t("panelSms.sample.userName") },
      { token: "{{business_name}}", label: t("panelSms.placeholder.businessName"), sample: t("panelSms.sample.nutritionBusinessName") },
      { token: "{{purchase_url}}", label: t("panelSms.placeholder.purchaseUrl"), sample: "https://example.com/nutrition/packages" },
      { token: "{{diet_title}}", label: t("panelSms.placeholder.dietTitle"), sample: t("panelSms.sample.dietTitle") },
      { token: "{{package_name}}", label: t("panelSms.placeholder.packageName"), sample: t("panelSms.sample.packageName") },
      { token: "{{days_after_end}}", label: t("panelSms.placeholder.daysAfterEnd"), sample: format.number(15) },
      { token: "{{days_remaining}}", label: t("panelSms.placeholder.daysRemaining"), sample: format.number(1) },
      { token: "{{panel_url}}", label: t("panelSms.placeholder.panelUrl"), sample: "https://example.com/nutrition" },
    ],
    [format, t],
  );

  const updateNutritionTemplate = (key: NutritionSmsTemplateKey, patch: { enabled?: boolean; body?: string }) => {
    setSettings((current) => ({
      ...current,
      nutritionSmsTemplatesV2: {
        ...normalizeNutritionSmsTemplates(defaultSmsSettings, current.nutritionSmsTemplatesV2),
        [key]: {
          ...(current.nutritionSmsTemplatesV2?.[key] ?? defaultSmsSettings.nutritionSmsTemplatesV2![key]),
          ...patch,
        },
      },
    }));
  };

  const insertNutritionPlaceholder = (field: NutritionSmsTemplateKey, token: string) => {
    const currentBody = normalizeNutritionSmsTemplates(defaultSmsSettings, settings.nutritionSmsTemplatesV2)[field]?.body ?? "";
    setSettings((current) => ({
      ...current,
      nutritionSmsTemplatesV2: {
        ...normalizeNutritionSmsTemplates(defaultSmsSettings, current.nutritionSmsTemplatesV2),
        [field]: {
          ...(current.nutritionSmsTemplatesV2?.[field] ?? defaultSmsSettings.nutritionSmsTemplatesV2![field]),
          body: `${currentBody}${currentBody.trim() ? " " : ""}${token}`,
        },
      },
    }));
  };

  const previewText = (body: string, placeholders: PlaceholderOption[]) =>
    placeholders.reduce((result, item) => result.replaceAll(item.token, item.sample), body || "");

  const pageTitle =
    currentMode === "store" ? t("panelSms.title.store") : currentMode === "booking" ? t("panelSms.title.booking") : currentMode === "feedback" ? t("panelSms.title.feedback") : currentMode === "nutrition" ? t("panelSms.title.nutrition") : t("panelSms.title.hub");
  const backHref = currentMode === "hub" ? "/panel" : showStoreSmsSection ? "/panel/sms-settings" : "/panel";

  if (!isPrimaryAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <MessageSquareText className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelSms.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelSms.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelSms.action.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  return (
    <div className="panel-sms-settings-page relative min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="panel-sms-settings-glow pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-gradient-to-b from-primary/15 via-primary/5 to-transparent" />

      <header className="panel-sms-settings-header sticky top-0 z-10 border-b border-border/70 bg-card/85 backdrop-blur-md">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black">{pageTitle}</h1>
          </div>

          <Link href={backHref}>
            <Button variant="outline" size="icon" title={t("panelSms.action.back")} className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-5 px-4 py-6">
        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-[30px] border border-border/70 bg-card/50 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelSms.loading")}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-primary/20 bg-card/90 shadow-lg shadow-primary/5">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-foreground">{t("panelSms.stats.totalSent")}</div>
                    <Send className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-3xl font-black text-foreground">{format.number(smsStats.totalSent)}</div>
                  <div className="text-xs font-medium leading-6 text-muted-foreground">{t("panelSms.stats.totalSentHint")}</div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-card/90 shadow-lg shadow-primary/5">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-foreground">{t("panelSms.stats.sentToday")}</div>
                    <MessageSquareText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-3xl font-black text-foreground">{format.number(smsStats.sentToday)}</div>
                  <div className="text-xs font-medium leading-6 text-muted-foreground">{t("panelSms.stats.sentTodayHint")}</div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-card/90 shadow-lg shadow-primary/5">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-foreground">{t("panelSms.stats.creditBalance")}</div>
                    <WalletCards className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-3xl font-black text-foreground">
                    {format.currency(smsStats.creditBalance)}
                  </div>
                  <Link href="/panel/sms-settings/top-up">
                    <Button className="w-full rounded-2xl font-black shadow-sm">
                      {t("panelSms.action.topUp")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/70 bg-card/60">
              <CardContent className="space-y-6 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-black">{t("panelSms.master.title")}</h2>
                      <p className="max-w-2xl text-sm leading-8 text-muted-foreground">
                        {t("panelSms.master.description")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-[24px] border border-border/70 bg-background/35 px-4 py-3">
                    <div className="text-sm font-bold">{settings.smsEnabled ? t("panelSms.status.enabled") : t("panelSms.status.disabled")}</div>
                    <Switch checked={settings.smsEnabled ?? false} onCheckedChange={(checked) => setSettings((current) => ({ ...current, smsEnabled: checked }))} />
                  </div>
                </div>

                <div className={`rounded-[26px] border p-5 ${settings.smsEnabled ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10"}`}>
                  <div className="mb-2 font-bold">{settings.smsEnabled ? t("panelSms.master.enabledTitle") : t("panelSms.master.disabledTitle")}</div>
                  <div className="text-sm leading-7 text-muted-foreground">
                    {settings.smsEnabled
                      ? t("panelSms.master.enabledDescription")
                      : t("panelSms.master.disabledDescription")}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("panelSms.sender.label")}</Label>
                    <select
                      value={settings.smsSender ?? ""}
                      onChange={(event) => setSettings((current) => ({ ...current, smsSender: event.target.value }))}
                      className="w-full rounded-2xl border border-border bg-background/50 px-3 py-2 text-sm"
                      dir={dir}
                    >
                      <option value="">{t("panelSms.sender.placeholder")}</option>
                      {(settings.smsAvailableSenders ?? []).map((sender) => (
                        <option key={sender.number} value={sender.number}>
                          {sender.label?.trim() ? `${sender.label} - ${sender.number}` : sender.number}
                        </option>
                      ))}
                    </select>

                    <Button onClick={saveSettings} disabled={saving} className="mt-3 min-w-[180px] rounded-2xl">
                      {saving ? (
                        <>
                          <Loader2 className="me-2 h-4 w-4 animate-spin" />
                          {t("common.saving")}
                        </>
                      ) : (
                        t("panelSms.action.saveSettings")
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("panelSms.outbounds.label")}</Label>
                    <Link href="/panel/sms-settings/outbounds">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-[24px] border border-primary/20 bg-gradient-to-l from-primary/15 via-primary/10 to-background/40 px-4 py-3 text-start transition hover:border-primary/40 hover:from-primary/20 hover:via-primary/15"
                      >
                        <div className="space-y-1">
                          <div className="font-bold">{t("panelSms.outbounds.title")}</div>
                          <div className="text-xs leading-6 text-muted-foreground">{t("panelSms.outbounds.description")}</div>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                          <Inbox className="h-5 w-5" />
                        </div>
                      </button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {currentMode === "hub" ? (
              <section className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {!appointmentBookingDisabled ? (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="space-y-5 p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black">{t("panelSms.hub.booking.title")}</h2>
                            <Badge variant={bookingActiveCount > 0 ? "default" : "secondary"}>{t("panelSms.value.activeScenarios", { count: format.number(bookingActiveCount) })}</Badge>
                          </div>
                          <p className="text-sm leading-7 text-muted-foreground">
                            {t("panelSms.hub.booking.description")}
                          </p>
                        </div>
                        <MessageSquareText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="rounded-[20px] border border-border/70 bg-background/50 p-4 text-sm leading-7 text-muted-foreground">
                        {t("panelSms.hub.booking.hint")}
                      </div>
                      <Link href="/panel/sms-settings/booking">
                        <Button className="w-full rounded-2xl">{t("panelSms.hub.booking.action")}</Button>
                      </Link>
                    </CardContent>
                  </Card>
                  ) : null}

                  <Card className="border-emerald-500/20 bg-emerald-500/10">
                    <CardContent className="space-y-5 p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black">{t("panelSms.hub.feedback.title")}</h2>
                            <Badge variant={feedbackActiveCount > 0 ? "default" : "secondary"}>{t("panelSms.value.activeScenarios", { count: format.number(feedbackActiveCount) })}</Badge>
                          </div>
                          <p className="text-sm leading-7 text-muted-foreground">
                            {t("panelSms.hub.feedback.description")}
                          </p>
                        </div>
                        <Sparkles className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div className="rounded-[20px] border border-border/70 bg-background/50 p-4 text-sm leading-7 text-muted-foreground">
                        {t("panelSms.hub.feedback.hint")}
                      </div>
                      <Link href="/panel/sms-settings/feedback">
                        <Button className="w-full rounded-2xl bg-emerald-500 text-white hover:bg-emerald-400">{t("panelSms.hub.feedback.action")}</Button>
                      </Link>
                    </CardContent>
                  </Card>

                  {showStoreSmsSection ? (
                    <Card className="border-sky-500/20 bg-sky-500/10">
                      <CardContent className="space-y-5 p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h2 className="text-lg font-black">{t("panelSms.hub.store.title")}</h2>
                              <Badge variant={storeSmsSettings.smsEnabled ? "default" : "secondary"}>
                                {storeSmsSettings.smsEnabled ? t("panelSms.status.enabled") : t("panelSms.status.disabled")}
                              </Badge>
                            </div>
                            <p className="text-sm leading-7 text-muted-foreground">
                              {t("panelSms.hub.store.description")}
                            </p>
                          </div>
                          <ShoppingCart className="h-6 w-6 text-sky-600" />
                        </div>
                        <div className="rounded-[20px] border border-border/70 bg-background/50 p-4 text-sm leading-7 text-muted-foreground">
                          {t("panelSms.hub.store.hint", { count: format.number(storeFilledCount) })}
                        </div>
                        <Link href="/panel/sms-settings/store">
                          <Button className="w-full rounded-2xl bg-sky-500 text-white hover:bg-sky-400">{t("panelSms.hub.store.action")}</Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ) : null}

                  {isNutritionAudience ? (
                    <Card className="border-teal-500/20 bg-teal-500/10">
                      <CardContent className="space-y-5 p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h2 className="text-lg font-black">{t("panelSms.hub.nutrition.title")}</h2>
                              <Badge variant={settings.nutritionSmsEnabled ? "default" : "secondary"}>
                                {t("panelSms.value.activeScenarios", { count: format.number(nutritionActiveCount) })}
                              </Badge>
                            </div>
                            <p className="text-sm leading-7 text-muted-foreground">
                              {t("panelSms.hub.nutrition.description")}
                            </p>
                          </div>
                          <Sparkles className="h-6 w-6 text-teal-600" />
                        </div>
                        <div className="rounded-[20px] border border-border/70 bg-background/50 p-4 text-sm leading-7 text-muted-foreground">
                          {t("panelSms.hub.nutrition.hint", { count: format.number(nutritionFilledCount) })}
                        </div>
                        <Link href="/panel/sms-settings/nutrition">
                          <Button className="w-full rounded-2xl bg-teal-500 text-white hover:bg-teal-400">{t("panelSms.hub.nutrition.action")}</Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </section>
            ) : null}

            {currentMode === "booking" ? (
              <section className="space-y-5">
                {showStoreSmsSection ? (
                  <div className="flex flex-wrap gap-2">
                    <Link href="/panel/sms-settings">
                      <Button variant="outline" className="rounded-2xl">{t("panelSms.nav.backToSections")}</Button>
                    </Link>
                    <Link href="/panel/sms-settings/store">
                      <Button variant="outline" className="rounded-2xl">{t("panelSms.nav.goToStore")}</Button>
                    </Link>
                    <Link href="/panel/sms-settings/feedback">
                      <Button variant="outline" className="rounded-2xl">{t("panelSms.nav.goToFeedback")}</Button>
                    </Link>
                  </div>
                ) : null}

                {!settings.smsEnabled ? (
                  <Card className="border-dashed border-primary/20 bg-primary/5">
                    <CardContent className="p-8 text-center">
                      <MessageSquareText className="mx-auto mb-4 h-10 w-10 text-primary" />
                      <h2 className="text-xl font-black">{t("panelSms.disabled.masterFirstTitle")}</h2>
                      <p className="mt-3 leading-8 text-muted-foreground">
                        {t("panelSms.disabled.bookingMasterFirstDescription")}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {bookingTemplateMeta.map((template) => {
                      const templateState = smsTemplates[template.key];
                      const preview = previewText(templateState.body, bookingPlaceholderOptions);

                      return (
                        <Card key={template.key} className={`border ${template.accentClass}`}>
                          <CardContent className="space-y-5 p-5 sm:p-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-lg font-black">{template.title}</h3>
                                  <Badge variant={templateState.enabled ? "default" : "secondary"}>
                                    {templateState.enabled ? t("panelSms.status.enabled") : t("panelSms.status.disabled")}
                                  </Badge>
                                  <Badge variant={approvalTone(templateState.approval_status)}>
                                    {approvalLabel(templateState.approval_status, t)}
                                  </Badge>
                                </div>
                                <p className="text-sm leading-7 text-muted-foreground">{template.description}</p>
                              </div>

                              <div className="flex items-center gap-3 rounded-[24px] border border-border/70 bg-background/35 px-4 py-3">
                                <div className="text-sm font-bold">{t("panelSms.form.enableSection")}</div>
                                <Switch checked={templateState.enabled} onCheckedChange={(checked) => updateTemplate(template.key, { enabled: checked })} />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>{t("panelSms.form.smsText")}</Label>
                              <Textarea
                                rows={5}
                                value={templateState.body}
                                onChange={(event) => updateTemplate(template.key, { body: event.target.value })}
                                placeholder={t("panelSms.form.smsTextPlaceholder")}
                                className="leading-8"
                                disabled={!templateState.enabled}
                              />
                            </div>

                            {templateState.rejection_reason ? (
                              <div className="rounded-[18px] border border-destructive/30 bg-destructive/10 p-4 text-sm leading-7 text-destructive">
                                <div className="mb-1 font-bold">{t("panelSms.form.rejectionReason")}</div>
                                <div>{templateState.rejection_reason}</div>
                              </div>
                            ) : null}

                            {templateState.approved_body ? (
                              <div className="rounded-[18px] border border-emerald-600/25 bg-emerald-50/80 p-4 text-sm leading-7 text-emerald-950/75">
                                <div className="mb-1 font-black text-emerald-800">{t("panelSms.form.approvedBody")}</div>
                                <div className="whitespace-pre-wrap">{templateState.approved_body}</div>
                              </div>
                            ) : null}

                            <div className="space-y-3">
                              <div className="text-sm font-bold">{t("panelSms.form.bookingPlaceholders")}</div>
                              <div className="flex flex-wrap gap-2">
                                {bookingPlaceholderOptions.map((item) => (
                                  <button
                                    key={`${template.key}-${item.token}`}
                                    type="button"
                                    onClick={() => insertBookingPlaceholder(template.key, item.token)}
                                    className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/10 disabled:opacity-50"
                                    disabled={!templateState.enabled}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-[22px] border border-dashed border-primary/20 bg-background/45 p-4">
                              <div className="mb-2 text-sm font-bold text-primary">{t("panelSms.form.preview")}</div>
                              <p className="whitespace-pre-wrap text-sm leading-8 text-muted-foreground">
                                {preview || t("panelSms.form.emptyPreview")}
                              </p>
                              {estimateTextBlock(preview, t, format)}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </>
                )}
              </section>
            ) : null}

            {currentMode === "store" ? (
              <section className="space-y-5">
                {showStoreSmsSection ? (
                  <div className="flex flex-wrap gap-2">
                    <Link href="/panel/sms-settings">
                      <Button variant="outline" className="rounded-2xl">{t("panelSms.nav.backToSections")}</Button>
                    </Link>
                    {!appointmentBookingDisabled ? (
                      <Link href="/panel/sms-settings/booking">
                        <Button variant="outline" className="rounded-2xl">{t("panelSms.nav.goToBooking")}</Button>
                      </Link>
                    ) : null}
                    <Link href="/panel/sms-settings/feedback">
                      <Button variant="outline" className="rounded-2xl">{t("panelSms.nav.goToFeedback")}</Button>
                    </Link>
                  </div>
                ) : null}

                {!showStoreSmsSection ? (
                  <Card className="border-dashed border-sky-500/20 bg-sky-500/10">
                    <CardContent className="p-8 text-center">
                      <ShoppingCart className="mx-auto mb-4 h-10 w-10 text-sky-600" />
                      <h2 className="text-xl font-black">{t("panelSms.storeUnavailable.title")}</h2>
                      <p className="mt-3 leading-8 text-muted-foreground">
                        {t("panelSms.storeUnavailable.description")}
                      </p>
                    </CardContent>
                  </Card>
                ) : !storeModuleActive ? (
                  <Card className="border-dashed border-sky-500/20 bg-sky-500/10">
                    <CardContent className="p-8 text-center">
                      <ShoppingCart className="mx-auto mb-4 h-10 w-10 text-sky-600" />
                      <h2 className="text-xl font-black">{t("panelSms.storeInactive.title")}</h2>
                      <p className="mt-3 leading-8 text-muted-foreground">
                        {t("panelSms.storeInactive.description")}
                      </p>
                      <div className="mt-5">
                        <Link href="/panel/special-features/online-store">
                          <Button className="rounded-2xl bg-sky-500 text-white hover:bg-sky-400">{t("panelSms.storeInactive.action")}</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ) : !settings.smsEnabled ? (
                  <Card className="border-dashed border-sky-500/20 bg-sky-500/10">
                    <CardContent className="p-8 text-center">
                      <ShoppingCart className="mx-auto mb-4 h-10 w-10 text-sky-600" />
                      <h2 className="text-xl font-black">{t("panelSms.disabled.masterFirstTitle")}</h2>
                      <p className="mt-3 leading-8 text-muted-foreground">
                        {t("panelSms.disabled.storeMasterFirstDescription")}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-sky-500/20 bg-sky-500/10">
                    <CardContent className="space-y-5 p-5 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black">{t("panelSms.store.title")}</h2>
                            <Badge variant={storeSmsSettings.smsEnabled ? "default" : "secondary"}>
                              {storeSmsSettings.smsEnabled ? t("panelSms.status.enabled") : t("panelSms.status.disabled")}
                            </Badge>
                          </div>
                          <p className="text-sm leading-7 text-muted-foreground">
                            {t("panelSms.store.description")}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 rounded-[24px] border border-border/70 bg-background/35 px-4 py-3">
                          <div className="text-sm font-bold">{t("panelSms.form.enableSection")}</div>
                          <Switch
                            checked={storeSmsSettings.smsEnabled}
                            onCheckedChange={(checked) =>
                              setStoreSmsSettings((current) => ({
                                ...current,
                                smsEnabled: checked,
                              }))
                            }
                          />
                        </div>
                      </div>

                      {storeSmsSettings.smsEnabled ? (
                        <div className="space-y-4">
                          {storeTemplateMeta.map((item) => {
                            const templateState = storeTemplates[item.key];
                            const body = templateState.body || "";
                            const preview = previewText(body, storePlaceholderOptions);

                            return (
                              <Card key={item.key} className="border-border/70 bg-background/50">
                                <CardContent className="space-y-5 p-5">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-lg font-black">{item.title}</h3>
                                        <Badge variant={approvalTone(templateState.approval_status)}>
                                          {approvalLabel(templateState.approval_status, t)}
                                        </Badge>
                                        <Badge variant={templateState.enabled ? "default" : "secondary"}>
                                          {templateState.enabled ? t("panelSms.status.enabled") : t("panelSms.status.disabled")}
                                        </Badge>
                                      </div>
                                      <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
                                    </div>

                                    <div className="flex items-center gap-3 rounded-[20px] border border-border/70 bg-background/35 px-4 py-3">
                                      <div className="text-sm font-bold">{t("panelSms.form.sendThisSms")}</div>
                                      <Switch checked={templateState.enabled} onCheckedChange={(checked) => updateStoreTemplate(item.key, { enabled: checked })} />
                                    </div>
                                  </div>

                                  {templateState.rejection_reason ? (
                                    <div className="rounded-[18px] border border-destructive/30 bg-destructive/10 p-4 text-sm leading-7 text-destructive">
                                      <div className="font-bold">{t("panelSms.form.rejectionReason")}</div>
                                      <div className="mt-1 whitespace-pre-wrap">{templateState.rejection_reason}</div>
                                    </div>
                                  ) : null}

                                  {templateState.approved_body ? (
                                    <div className="rounded-[18px] border border-emerald-600/25 bg-emerald-50/80 p-4 text-sm leading-7 text-emerald-950/75">
                                      <div className="mb-2 font-black text-emerald-800">{t("panelSms.form.approvedBody")}</div>
                                      <div className="whitespace-pre-wrap">{templateState.approved_body}</div>
                                    </div>
                                  ) : null}

                                  <div className="space-y-2">
                                    <Label>{t("panelSms.form.smsText")}</Label>
                                    <Textarea
                                      rows={5}
                                      value={body}
                                      onChange={(event) => updateStoreTemplate(item.key, { body: event.target.value })}
                                      placeholder={item.placeholder}
                                      className="leading-8"
                                    />
                                  </div>

                                  <div className="space-y-3">
                                    <div className="text-sm font-bold">{t("panelSms.form.storePlaceholders")}</div>
                                    <div className="flex flex-wrap gap-2">
                                      {storePlaceholderOptions.map((placeholder) => (
                                        <button
                                          key={`${item.key}-${placeholder.token}`}
                                          type="button"
                                          onClick={() => insertStorePlaceholder(item.key, placeholder.token)}
                                          className="rounded-full border border-sky-600/25 bg-sky-50/80 px-3 py-1.5 text-xs font-bold text-sky-800 transition hover:bg-sky-100"
                                        >
                                          {placeholder.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="rounded-[22px] border border-dashed border-sky-500/20 bg-background/45 p-4">
                                    <div className="mb-2 text-sm font-black text-sky-800">{t("panelSms.form.preview")}</div>
                                    <p className="whitespace-pre-wrap text-sm leading-8 text-muted-foreground">
                                      {preview || t("panelSms.form.emptyPreview")}
                                    </p>
                                    {estimateTextBlock(preview, t, format)}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-sky-500/20 bg-background/45 p-4 text-sm leading-7 text-muted-foreground">
                          {t("panelSms.store.disabledHint")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </section>
            ) : null}

            {currentMode === "nutrition" && isNutritionAudience ? (
              <section className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Link href="/panel/sms-settings">
                    <Button variant="outline" className="rounded-2xl">{t("panelSms.nav.backToSections")}</Button>
                  </Link>
                  {!appointmentBookingDisabled ? (
                    <Link href="/panel/sms-settings/booking">
                      <Button variant="outline" className="rounded-2xl">{t("panelSms.nav.goToBooking")}</Button>
                    </Link>
                  ) : null}
                  <Link href="/panel/sms-settings/feedback">
                    <Button variant="outline" className="rounded-2xl">{t("panelSms.nav.goToFeedback")}</Button>
                  </Link>
                  {showStoreSmsSection ? (
                    <Link href="/panel/sms-settings/store">
                      <Button variant="outline" className="rounded-2xl">{t("panelSms.nav.goToStore")}</Button>
                    </Link>
                  ) : null}
                </div>

                {!settings.smsEnabled ? (
                  <Card className="border-dashed border-teal-500/20 bg-teal-500/10">
                    <CardContent className="p-8 text-center">
                      <Sparkles className="mx-auto mb-4 h-10 w-10 text-teal-600" />
                      <h2 className="text-xl font-black">{t("panelSms.disabled.masterFirstTitle")}</h2>
                      <p className="mt-3 leading-8 text-muted-foreground">
                        {t("panelSms.disabled.nutritionMasterFirstDescription")}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-teal-500/20 bg-teal-500/10">
                    <CardContent className="space-y-5 p-5 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black">{t("panelSms.nutrition.title")}</h2>
                            <Badge variant={settings.nutritionSmsEnabled ? "default" : "secondary"}>
                              {settings.nutritionSmsEnabled ? t("panelSms.status.enabled") : t("panelSms.status.disabled")}
                            </Badge>
                          </div>
                          <p className="text-sm leading-7 text-muted-foreground">
                            {t("panelSms.nutrition.description")}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 rounded-[24px] border border-border/70 bg-background/35 px-4 py-3">
                          <div className="text-sm font-bold">{t("panelSms.form.enableSection")}</div>
                          <Switch
                            checked={settings.nutritionSmsEnabled ?? false}
                            onCheckedChange={(checked) => setSettings((current) => ({ ...current, nutritionSmsEnabled: checked }))}
                          />
                        </div>
                      </div>

                      {settings.nutritionSmsEnabled ? (
                        <div className="space-y-4">
                          {nutritionTemplateMeta.map((item) => {
                            const templateState = nutritionTemplates[item.key];
                            const body = templateState.body || "";
                            const preview = previewText(body, nutritionPlaceholderOptions);

                            return (
                              <Card key={item.key} className="border-border/70 bg-background/50">
                                <CardContent className="space-y-5 p-5">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-lg font-black">{item.title}</h3>
                                        <Badge variant={approvalTone(templateState.approval_status)}>
                                          {approvalLabel(templateState.approval_status, t)}
                                        </Badge>
                                        <Badge variant={templateState.enabled ? "default" : "secondary"}>
                                          {templateState.enabled ? t("panelSms.status.enabled") : t("panelSms.status.disabled")}
                                        </Badge>
                                      </div>
                                      <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
                                    </div>

                                    <div className="flex items-center gap-3 rounded-[20px] border border-border/70 bg-background/35 px-4 py-3">
                                      <div className="text-sm font-bold">{t("panelSms.form.sendThisSms")}</div>
                                      <Switch checked={templateState.enabled} onCheckedChange={(checked) => updateNutritionTemplate(item.key, { enabled: checked })} />
                                    </div>
                                  </div>

                                  {templateState.approved_body ? (
                                    <div className="rounded-[18px] border border-emerald-600/25 bg-emerald-50/80 p-4 text-sm leading-7 text-emerald-950/75">
                                      <div className="mb-2 font-black text-emerald-800">{t("panelSms.form.approvedBody")}</div>
                                      <div className="whitespace-pre-wrap">{templateState.approved_body}</div>
                                    </div>
                                  ) : null}

                                  <div className="space-y-2">
                                    <Label>{t("panelSms.form.smsText")}</Label>
                                    <Textarea
                                      rows={5}
                                      value={body}
                                      onChange={(event) => updateNutritionTemplate(item.key, { body: event.target.value })}
                                      placeholder={item.placeholder}
                                      className="leading-8"
                                    />
                                  </div>

                                  <div className="space-y-3">
                                    <div className="text-sm font-bold">{t("panelSms.form.nutritionPlaceholders")}</div>
                                    <div className="flex flex-wrap gap-2">
                                      {nutritionPlaceholderOptions.map((placeholder) => (
                                        <button
                                          key={`${item.key}-${placeholder.token}`}
                                          type="button"
                                          onClick={() => insertNutritionPlaceholder(item.key, placeholder.token)}
                                          className="rounded-full border border-teal-600/25 bg-teal-50/80 px-3 py-1.5 text-xs font-bold text-teal-800 transition hover:bg-teal-100"
                                        >
                                          {placeholder.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="rounded-[22px] border border-dashed border-teal-500/20 bg-background/45 p-4">
                                    <div className="mb-2 text-sm font-black text-teal-800">{t("panelSms.form.preview")}</div>
                                    <p className="whitespace-pre-wrap text-sm leading-8 text-muted-foreground">
                                      {preview || t("panelSms.form.emptyPreview")}
                                    </p>
                                    {estimateTextBlock(preview, t, format)}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-teal-500/20 bg-background/45 p-4 text-sm leading-7 text-muted-foreground">
                          {t("panelSms.nutrition.disabledHint")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </section>
            ) : null}

            {currentMode === "feedback" ? (
              <section className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Link href="/panel/sms-settings">
                    <Button variant="outline" className="rounded-2xl">{t("panelSms.nav.backToSections")}</Button>
                  </Link>
                  {!appointmentBookingDisabled ? (
                    <Link href="/panel/sms-settings/booking">
                      <Button variant="outline" className="rounded-2xl">{t("panelSms.nav.goToBooking")}</Button>
                    </Link>
                  ) : null}
                  {showStoreSmsSection ? (
                    <Link href="/panel/sms-settings/store">
                      <Button variant="outline" className="rounded-2xl">{t("panelSms.nav.goToStore")}</Button>
                    </Link>
                  ) : null}
                </div>

                {!settings.smsEnabled ? (
                  <Card className="border-dashed border-emerald-500/20 bg-emerald-500/10">
                    <CardContent className="p-8 text-center">
                      <Sparkles className="mx-auto mb-4 h-10 w-10 text-emerald-600" />
                      <h2 className="text-xl font-black">{t("panelSms.disabled.masterFirstTitle")}</h2>
                      <p className="mt-3 leading-8 text-muted-foreground">
                        {t("panelSms.disabled.feedbackMasterFirstDescription")}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  feedbackTemplateMeta.map((template) => {
                    const templateState = smsTemplates[template.key];
                    const preview = previewText(templateState.body, bookingPlaceholderOptions);

                    return (
                      <Card key={template.key} className={`border ${template.accentClass}`}>
                        <CardContent className="space-y-5 p-5 sm:p-6">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black">{template.title}</h3>
                                <Badge variant={templateState.enabled ? "default" : "secondary"}>
                                  {templateState.enabled ? t("panelSms.status.enabled") : t("panelSms.status.disabled")}
                                </Badge>
                                <Badge variant={approvalTone(templateState.approval_status)}>
                                  {approvalLabel(templateState.approval_status, t)}
                                </Badge>
                              </div>
                              <p className="text-sm leading-7 text-muted-foreground">{template.description}</p>
                            </div>

                            <div className="flex items-center gap-3 rounded-[24px] border border-border/70 bg-background/35 px-4 py-3">
                              <div className="text-sm font-bold">{t("panelSms.form.enableSection")}</div>
                              <Switch checked={templateState.enabled} onCheckedChange={(checked) => updateTemplate(template.key, { enabled: checked })} />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>{t("panelSms.form.smsText")}</Label>
                            <Textarea
                              rows={5}
                              value={templateState.body}
                              onChange={(event) => updateTemplate(template.key, { body: event.target.value })}
                              placeholder={t("panelSms.form.feedbackSmsTextPlaceholder")}
                              className="leading-8"
                              disabled={!templateState.enabled}
                            />
                          </div>

                          {templateState.rejection_reason ? (
                            <div className="rounded-[18px] border border-destructive/30 bg-destructive/10 p-4 text-sm leading-7 text-destructive">
                              <div className="mb-1 font-bold">{t("panelSms.form.rejectionReason")}</div>
                              <div>{templateState.rejection_reason}</div>
                            </div>
                          ) : null}

                          {templateState.approved_body ? (
                            <div className="rounded-[18px] border border-emerald-600/25 bg-emerald-50/80 p-4 text-sm leading-7 text-emerald-950/75">
                              <div className="mb-1 font-black text-emerald-800">{t("panelSms.form.approvedBody")}</div>
                              <div className="whitespace-pre-wrap">{templateState.approved_body}</div>
                            </div>
                          ) : null}

                          <div className="space-y-3">
                            <div className="text-sm font-bold">{t("panelSms.form.feedbackPlaceholders")}</div>
                            <div className="flex flex-wrap gap-2">
                              {bookingPlaceholderOptions
                                .filter((item) => ["{{customer_name}}", "{{appointment_date}}", "{{appointment_time}}", "{{professional_name}}", "{{service_name}}", "{{business_name}}", "{{feedback_url}}"].includes(item.token))
                                .map((item) => (
                                  <button
                                    key={`${template.key}-${item.token}`}
                                    type="button"
                                    onClick={() => insertBookingPlaceholder(template.key, item.token)}
                                    className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/10 disabled:opacity-50"
                                    disabled={!templateState.enabled}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                            </div>
                          </div>

                          <div className="rounded-[22px] border border-dashed border-primary/20 bg-background/45 p-4">
                            <div className="mb-2 text-sm font-bold text-primary">{t("panelSms.form.preview")}</div>
                            <p className="whitespace-pre-wrap text-sm leading-8 text-muted-foreground">
                              {preview || t("panelSms.form.emptyPreview")}
                            </p>
                            {estimateTextBlock(preview, t, format)}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </section>
            ) : null}

            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={saving} className="min-w-[180px] rounded-2xl">
                {saving ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t("common.saving")}
                  </>
                ) : (
                  t("panelSms.action.saveSettings")
                )}
              </Button>
            </div>

          </>
        )}
      </main>
    </div>
  );
}
