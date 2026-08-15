import { Appointment, Section, User, Barber, ApiResponse, PaymentSettings, TenantMeta, PaginatedAppointments, PaginatedTenantUsers, PaginatedSmsCampaigns, SmsCampaign, SmsCampaignDetails, SmsCampaignFilters, SmsCampaignPreview, PaginatedSupportTickets, SupportTicket, SupportTicketDetails, GalleryAdminPayload, GalleryImage, GalleryPublicPayload, AppearanceSettings, HelpTopic, HelpTopicListPayload, SupportRenewalPackage, SupportRenewalPreview, SupportRenewalPayment, PaginatedSupportRenewalPayments, SupportRenewalSettings, SupportRenewalPublicPackagesPayload, StorageAddonPreview, AppointmentPaymentCheckout, PaymentProvider, PaginatedReferralLeads, ReferralLead, AboutSettings, ContactSettings, FeatureModuleSummary, FeatureModuleActivationPreview, CookingRecipeItem, StoreCheckoutResponse, StoreDashboardPayload, StoreGeneralSettings, StoreHomeSettings, StoreFaqSettings, StoreShippingSettings, StoreCategoryListPayload, StoreCategoryItem, StoreProductItem, StoreProductListPayload, StoreProductReviewItem, StoreProductReviewListPayload, PaginatedStoreAdminOrders, PaginatedStoreOrders, StoreOrderSummary, PaginatedUserNotifications, UserNotificationItem, NotificationCampaignFilters, NotificationCampaignPreview, NotificationCampaign, PaginatedNotificationCampaigns, NotificationCampaignDetails, UserLookupResult, TenantPanelUser, LandingContactSubmissionPayload, LandingCustomer, LandingCheckoutQuote, LandingOrderSummary, PaginatedLandingOrders, LandingOrderPaymentSummary, PaginatedSmsOutbounds, SmsOutboundItem, SmsBulkRecipientInput, PublicAppointmentDetails, SmsTopUpCheckoutResponse, CustomerClubAdminOverview, CustomerClubMePayload, PaginatedCustomerClubMembers, CustomerClubSettings, CustomerClubTier, CustomerClubReward, CustomerClubAccountSummary, CustomerClubRedemption, PanelFinanceDashboardPayload, ManualFinanceDashboardPayload, ManualFinanceEntry, ManualFinanceCategory, ManualFinanceCustomerSummary, ManualFinanceDebtorsPayload, ManualFinanceCommissionReportPayload, CustomerFeedbackSettings, CustomerFeedbackQuestion, CustomerFeedbackPublicPayload, CustomerFeedbackPublicAnswerInput, CustomerFeedbackReportPayload, CustomerFeedbackReportResponseDetail, SpecializedCourseHomePayload, DomainRenewalOverview, PaginatedDomainRenewalPayments, DomainRenewalPayment, TenantFileManagerPayload, TenantFileCategory, NutritionDietTemplateItem, NutritionDietTemplateListPayload, NutritionPackageItem, NutritionPackageListPayload, NutritionProfile, NutritionProfileDashboardPayload, NutritionWeightRecommendation, NutritionDiscountCodeItem, NutritionPackageCheckoutPreview, NutritionPackageOrder, NutritionPackageCheckoutSummaryPayload, NutritionDietRequest, NutritionDietRequestAdminSettings, NutritionDietRequestAdminStats, NutritionTokenDashboardPayload, NutritionTokenHistoryPayload, NutritionLandingSettings, NutritionLandingVariant, NutritionDietPrescription, NutritionAudioGuidanceAsset, NutritionAiPromptPreset, NutritionAdminUserProfilePayload, OnlineChatConversationDetails, OnlineChatAdminDashboardPayload, OnlineChatConversationSummary, NutritionDietFileGroup, NutritionDietFileItem, NutritionSettingsPayload, NutritionExerciseGroup, NutritionExerciseItem, ArticleSectionSettings, ArticleTagItem, ArticleTagListPayload, ArticleCategoryItem, ArticleCategoryListPayload, ArticlePostAdminPayload, ArticlePostItem, ArticlePostPublicListPayload, ArticlePostPublicDetailPayload, NutritionMealPhotoAnalysis, MessagingBotSettings, TelegramWebhookInfo, AppointmentBookingClosurePayload } from "./types";
import type { CookingRecipeDetailPayload, CookingRecipeListPayload, CookingRecipeUpdatePayload } from "./types";
import type { CustomLandingOverview, CustomLandingPartner, CustomLandingPartnerDashboard, CustomLandingSettings } from "./types";
import { getDefaultRegistrationRequirements, UserProfilePayload } from "./membership";
import { normalizeDigits } from "./normalize";
import { v4 as uuidv4 } from "uuid";
import { PAYMENT_GATEWAYS } from "./payment-gateways";
import { DEFAULT_APPOINTMENT_ALERT_SOUND } from "./appointment-alert-sounds";
import { AI_IMAGE_COMPRESSION_OPTIONS, compressFormDataImages, compressImageFile } from "./image-compression";
import { translate, type MessageKey } from "@/i18n/messages";
import { DEFAULT_LOCALE, normalizeLocale } from "@/i18n/registry";

const getCurrentLocale = () => {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  return (
    normalizeLocale(document.documentElement.lang) ||
    normalizeLocale(window.localStorage.getItem("barberbook.locale")) ||
    normalizeLocale(window.__BOOKING_BOOTSTRAP__?.meta?.locale) ||
    DEFAULT_LOCALE
  );
};

const apiMessage = (key: MessageKey) => translate(getCurrentLocale(), key);

const getCookie = (name: string) => {
  const encodedName = `${name}=`;
  const cookies = document.cookie.split(";");

  for (const rawCookie of cookies) {
    const cookie = rawCookie.trim();
    if (cookie.startsWith(encodedName)) {
      return cookie.slice(encodedName.length);
    }
  }

  return "";
};

const getCsrfToken = () => {
  const xsrfCookie = getCookie("XSRF-TOKEN");

  if (xsrfCookie) {
    try {
      return decodeURIComponent(xsrfCookie);
    } catch {
      return xsrfCookie;
    }
  }

  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";
};

const getFirstErrorMessage = (errors: unknown) => {
  if (!errors || typeof errors !== "object") {
    return undefined;
  }

  const firstEntry = Object.values(errors as Record<string, string[]>)[0];
  return Array.isArray(firstEntry) ? firstEntry[0] : undefined;
};

const normalizePayload = (payload: unknown): unknown => {
  if (typeof payload === "string") {
    return normalizeDigits(payload);
  }

  if (Array.isArray(payload)) {
    return payload.map(normalizePayload);
  }

  if (payload && typeof payload === "object") {
    return Object.fromEntries(
      Object.entries(payload as Record<string, unknown>).map(([key, value]) => [key, normalizePayload(value)]),
    );
  }

  return payload;
};

async function postJson<T>(url: string, payload?: unknown): Promise<ApiResponse<T>> {
  return requestJson<T>(url, "POST", payload);
}

async function requestJson<T>(url: string, method: "POST" | "PUT" | "DELETE", payload?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-CSRF-TOKEN": getCsrfToken(),
      "X-XSRF-TOKEN": getCsrfToken(),
      "X-Requested-With": "XMLHttpRequest",
    },
    credentials: "include",
    body: payload ? JSON.stringify(normalizePayload(payload)) : undefined,
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const firstValidationMessage = getFirstErrorMessage(json.errors);

    return {
      success: false,
      data: (json.data ?? {}) as T,
      message: firstValidationMessage || json.message || apiMessage("api.requestFailed"),
      errors: json.errors,
    };
  }

  return {
    success: typeof json.success === "boolean" ? json.success : true,
    data: json.data as T,
    message: json.message,
    errors: json.errors,
  };
}

async function requestFormData<T>(url: string, method: "POST" | "PUT", payload: FormData): Promise<ApiResponse<T>> {
  const compressedPayload = await compressFormDataImages(payload);

  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "X-CSRF-TOKEN": getCsrfToken(),
      "X-XSRF-TOKEN": getCsrfToken(),
      "X-Requested-With": "XMLHttpRequest",
    },
    credentials: "include",
    body: compressedPayload,
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const firstValidationMessage = getFirstErrorMessage(json.errors);

    return {
      success: false,
      data: (json.data ?? {}) as T,
      message: firstValidationMessage || json.message || apiMessage("api.requestFailed"),
      errors: json.errors,
    };
  }

  return {
    success: typeof json.success === "boolean" ? json.success : true,
    data: json.data as T,
    message: json.message,
    errors: json.errors,
  };
}

async function getJson<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    credentials: "include",
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const firstValidationMessage = getFirstErrorMessage(json.errors);

    return {
      success: false,
      data: (json.data ?? {}) as T,
      message: firstValidationMessage || json.message || apiMessage("api.requestFailed"),
      errors: json.errors,
    };
  }

  return {
    success: typeof json.success === "boolean" ? json.success : true,
    data: json.data as T,
    message: json.message,
    errors: json.errors,
  };
}

async function getBlob(
  url: string,
): Promise<ApiResponse<{ blob: Blob; filename: string }>> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    credentials: "include",
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    const firstValidationMessage = getFirstErrorMessage(json.errors);

    return {
      success: false,
      data: { blob: new Blob(), filename: "" },
      message: firstValidationMessage || json.message || apiMessage("api.requestFailed"),
      errors: json.errors,
    };
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
  const filename = filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1].replace(/"/g, "")) : "report.xlsx";

  return {
    success: true,
    data: { blob, filename },
  };
}

const getBookingLeadConfig = (barber?: Barber) => ({
  mode: barber?.bookingLeadMode ?? "today",
  hours: barber?.bookingLeadHours ?? 2,
  days: barber?.bookingLeadDays ?? 1,
});

const getMinimumBookableAt = (barber?: Barber) => {
  const now = new Date();
  const { mode, hours, days } = getBookingLeadConfig(barber);

  if (mode === "days") {
    const minimumDate = new Date(now);
    minimumDate.setHours(0, 0, 0, 0);
    minimumDate.setDate(minimumDate.getDate() + Math.max(days, 1));
    return minimumDate;
  }

  return new Date(now.getTime() + Math.max(hours, 0) * 60 * 60 * 1000);
};

const getBookingHorizonConfig = (barber?: Barber) => ({
  mode: barber?.bookingHorizonMode ?? "days",
  maxDays: barber?.bookingMaxDays ?? 30,
  maxDate: barber?.bookingMaxDate ?? "",
});

const getMaximumBookableDate = (barber?: Barber) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { mode, maxDays, maxDate } = getBookingHorizonConfig(barber);

  if (mode === "date" && maxDate) {
    return maxDate;
  }

  const maximumDate = new Date(today);
  maximumDate.setDate(maximumDate.getDate() + Math.max(maxDays, 0));
  return maximumDate.toISOString().slice(0, 10);
};

// Mock Database
let db = {
  users: [] as User[],
  barbers: [
      { id: "1", name: "علی آقا", isActive: true, createdAt: new Date().toISOString(), activeRanges: [], disabledDates: [], bookingLeadMode: "today", bookingLeadHours: 2, bookingLeadDays: 1, bookingHorizonMode: "days", bookingMaxDays: 30, bookingMaxDate: "" },
      { id: "2", name: "آقا رضا", isActive: true, createdAt: new Date().toISOString(), activeRanges: [], disabledDates: [], bookingLeadMode: "today", bookingLeadHours: 2, bookingLeadDays: 1, bookingHorizonMode: "days", bookingMaxDays: 30, bookingMaxDate: "" }
  ] as Barber[],
  sections: [
    {
      id: "1",
      name: "پیرایش مو",
      barberId: "1",
      startHour: "09:00",
      endHour: "21:00",
      slotDurationMinutes: 30,
      price: 0,
      checkConflicts: true,
      isActive: true,
      workDays: [0, 1, 2, 3, 4, 6],
      disabledDates: [],
      createdAt: new Date().toISOString()
    },
    {
      id: "2",
      name: "کراتینه",
      barberId: "1",
      startHour: "10:00",
      endHour: "18:00",
      slotDurationMinutes: 60,
      price: 0,
      checkConflicts: true,
      isActive: true,
      workDays: [0, 1, 2, 3, 4, 6],
      disabledDates: [],
      createdAt: new Date().toISOString()
    },
     {
      id: "3",
      name: "پیرایش مو",
      barberId: "2",
      startHour: "10:00",
      endHour: "20:00",
      slotDurationMinutes: 45,
      price: 0,
      checkConflicts: false,
      isActive: true,
      disabledDates: [],
      createdAt: new Date().toISOString()
    }
  ] as Section[],
  paymentSettings: {
    enabled: false,
    provider: null,
    sandboxEnabled: false,
    enabledGateways: [],
    gateways: Object.fromEntries(
      PAYMENT_GATEWAYS.map((gateway) => [gateway.key, { enabled: false }]),
    ),
    enamadCode: "",
    siteAnnouncementEnabled: false,
    siteAnnouncementText: "",
    bookingClosedEnabled: false,
    bookingClosedText: "",
    appointmentBookingDisabled: false,
    offQueueBookingEnabled: true,
    serviceFirstBookingEnabled: false,
    customerMobileConfirmationEnabled: false,
    showCountryPrefixInAuthenticationForm: false,
    hourlyBookingLimit: 4,
    customerCancellationCutoffHours: 2,
    apiCodeEnabled: false,
    registrationRequirements: getDefaultRegistrationRequirements(),
    galleryEnabled: false,
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
        adminBooking: { enabled: true, body: "" },
        userBooking: { enabled: true, body: "" },
        cancellation: { enabled: false, body: "" },
        appointmentChange: { enabled: true, body: "" },
        reminder: { enabled: true, body: "" },
        reminderThreeHours: { enabled: true, body: "" },
        loginOtp: { enabled: true, body: "" },
        customerFeedback: { enabled: true, body: "" },
        appointmentReopened: { enabled: true, body: "" },
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
  } as PaymentSettings,
  appointments: [] as Appointment[],
};

const serializeScheduleOverrides = (items?: Section["scheduleOverrides"]) =>
  (items || []).map((item) => ({
    scope: item.scope,
    weekdays: item.weekdays || [],
    dates: item.dates || [],
    start_hour: item.startHour,
    end_hour: item.endHour,
    slot_duration_minutes: item.slotDurationMinutes,
  }));

const serializeQuickBlockedSlots = (items?: Section["quickBlockedSlots"]) =>
  (items || []).map((item) => ({
    id: item.id,
    date: item.date,
    start: item.start,
    end: item.end,
    reason: item.reason || "",
  }));

const getDefaultPaymentSettings = (): PaymentSettings => ({
  enabled: false,
  locale: "fa",
  country: "IR",
  provider: null,
  sandboxEnabled: false,
  cafebazaarEnabled: false,
  cafebazaarPublicKey: "",
  enabledGateways: [],
  gateways: Object.fromEntries(
    PAYMENT_GATEWAYS.map((gateway) => [gateway.key, { enabled: false }]),
  ) as PaymentSettings["gateways"],
  enamadCode: "",
  siteAnnouncementEnabled: false,
  siteAnnouncementText: "",
  bookingClosedEnabled: false,
  bookingClosedText: "",
  appointmentBookingDisabled: false,
  offQueueBookingEnabled: true,
  serviceFirstBookingEnabled: false,
  customerMobileConfirmationEnabled: false,
  showCountryPrefixInAuthenticationForm: false,
  hourlyBookingLimit: 4,
  customerCancellationCutoffHours: 2,
  appointmentAlertSound: DEFAULT_APPOINTMENT_ALERT_SOUND,
  apiCodeEnabled: false,
  customAppSettingsEnabled: false,
  androidAppSettingsEnabled: false,
  androidAppVersion: "",
  androidWebAppUrl: "",
  androidPaymentReturnUrl: "",
  registrationRequirements: getDefaultRegistrationRequirements(),
  galleryEnabled: false,
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
    adminBooking: { enabled: true, body: "" },
    userBooking: { enabled: true, body: "" },
    cancellation: { enabled: false, body: "" },
    appointmentChange: { enabled: true, body: "" },
    reminder: { enabled: true, body: "" },
    reminderThreeHours: { enabled: true, body: "" },
    loginOtp: { enabled: true, body: "" },
    customerFeedback: { enabled: true, body: "" },
    appointmentReopened: { enabled: true, body: "" },
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  meta: {
    get: async (): Promise<ApiResponse<TenantMeta>> => {
      return getJson<TenantMeta>("/api/v1/meta");
    },
  },

  helpTopics: {
    list: async (module?: string, headerOnly = false): Promise<ApiResponse<HelpTopicListPayload>> => {
      const params = new URLSearchParams();

      if (module?.trim()) {
        params.set("module", module.trim());
      }

      if (headerOnly) {
        params.set("header_only", "1");
      }

      const suffix = params.toString() ? `?${params.toString()}` : "";
      return getJson<HelpTopicListPayload>(`/api/v1/help/topics${suffix}`);
    },

    show: async (topicKey: string): Promise<ApiResponse<{ topic: HelpTopic }>> => {
      return getJson<{ topic: HelpTopic }>(`/api/v1/help/topic?key=${encodeURIComponent(topicKey)}`);
    },
  },

  specializedCourses: {
    home: async (discountCode?: string): Promise<ApiResponse<SpecializedCourseHomePayload>> => {
      const params = new URLSearchParams();

      if (discountCode?.trim()) {
        params.set("discount_code", discountCode.trim());
      }

      const suffix = params.toString() ? `?${params.toString()}` : "";
      return getJson<SpecializedCourseHomePayload>(`/api/v1/specialized-courses/home${suffix}`);
    },
  },

  appearance: {
    get: async (): Promise<ApiResponse<AppearanceSettings>> => {
      return getJson<AppearanceSettings>("/api/v1/settings/appearance");
    },

    update: async (payload: {
      storeName: string;
      bookingHeaderTitle?: string;
      bookingTemplate: AppearanceSettings["bookingTemplate"];
      themeMode: "dark" | "light";
      customThemeEnabled: boolean;
      primaryTheme: string;
      accentTheme: string;
      backgroundTheme: string;
      cardTheme: string;
      removeLogo?: boolean;
      removeFavicon?: boolean;
      logo?: File | null;
      favicon?: File | null;
    }): Promise<ApiResponse<AppearanceSettings>> => {
      const formData = new FormData();
      formData.append("storeName", normalizeDigits(payload.storeName));
      formData.append("bookingHeaderTitle", normalizeDigits(payload.bookingHeaderTitle ?? ""));
      formData.append("bookingTemplate", payload.bookingTemplate);
      formData.append("themeMode", payload.themeMode);
      formData.append("customThemeEnabled", payload.customThemeEnabled ? "1" : "0");
      formData.append("primaryTheme", payload.primaryTheme);
      formData.append("accentTheme", payload.accentTheme);
      formData.append("backgroundTheme", payload.backgroundTheme);
      formData.append("cardTheme", payload.cardTheme);
      if (payload.removeLogo) {
        formData.append("removeLogo", "1");
      }
      if (payload.removeFavicon) {
        formData.append("removeFavicon", "1");
      }
      if (payload.logo) {
        formData.append("logo", payload.logo);
      }
      if (payload.favicon) {
        formData.append("favicon", payload.favicon);
      }
      return requestFormData<AppearanceSettings>("/api/v1/settings/appearance", "POST", formData);
    },
  },

  about: {
    get: async (): Promise<ApiResponse<AboutSettings>> => {
      return getJson<AboutSettings>("/api/v1/settings/about");
    },

    update: async (payload: {
      enabled: boolean;
      title: string;
      body: string;
      seoEnabled?: boolean;
      seoTitle?: string;
      seoDescription?: string;
      seoKeywords?: string;
      seoIndexable?: boolean;
      removeImage?: boolean;
      image?: File | null;
    }): Promise<ApiResponse<AboutSettings>> => {
      const formData = new FormData();
      formData.append("enabled", payload.enabled ? "1" : "0");
      formData.append("title", normalizeDigits(payload.title));
      formData.append("body", normalizeDigits(payload.body));
      formData.append("seoEnabled", payload.seoEnabled ? "1" : "0");
      formData.append("seoTitle", normalizeDigits(payload.seoTitle ?? ""));
      formData.append("seoDescription", normalizeDigits(payload.seoDescription ?? ""));
      formData.append("seoKeywords", normalizeDigits(payload.seoKeywords ?? ""));
      formData.append("seoIndexable", payload.seoIndexable === false ? "0" : "1");
      if (payload.removeImage) {
        formData.append("removeImage", "1");
      }
      if (payload.image) {
        formData.append("image", payload.image);
      }
      return requestFormData<AboutSettings>("/api/v1/settings/about", "POST", formData);
    },
  },

  contact: {
    get: async (): Promise<ApiResponse<ContactSettings>> => {
      return getJson<ContactSettings>("/api/v1/settings/contact");
    },

    update: async (payload: ContactSettings): Promise<ApiResponse<ContactSettings>> => {
      return requestJson<ContactSettings>("/api/v1/settings/contact", "POST", payload);
    },
  },

  landingContact: {
    submit: async (payload: LandingContactSubmissionPayload): Promise<ApiResponse<{ id: number }>> => {
      return postJson<{ id: number }>("/landing/contact-submissions", payload);
    },
  },

  articles: {
    settings: async (): Promise<ApiResponse<ArticleSectionSettings>> => {
      return getJson<ArticleSectionSettings>("/api/v1/articles/settings");
    },

    updateSettings: async (payload: ArticleSectionSettings): Promise<ApiResponse<ArticleSectionSettings>> => {
      return requestJson<ArticleSectionSettings>("/api/v1/articles/settings", "PUT", payload);
    },

    publicList: async (params?: { q?: string; category?: string; tag?: string; page?: number; perPage?: number }): Promise<ApiResponse<ArticlePostPublicListPayload>> => {
      const searchParams = new URLSearchParams();

      if (params?.q) {
        searchParams.set("q", params.q);
      }

      if (params?.category) {
        searchParams.set("category", params.category);
      }

      if (params?.tag) {
        searchParams.set("tag", params.tag);
      }

      if (params?.page && params.page > 1) {
        searchParams.set("page", String(params.page));
      }

      if (params?.perPage) {
        searchParams.set("per_page", String(params.perPage));
      }

      const query = searchParams.toString();
      return getJson<ArticlePostPublicListPayload>(`/api/v1/articles/public-posts${query ? `?${query}` : ""}`);
    },

    publicDetail: async (id: string): Promise<ApiResponse<ArticlePostPublicDetailPayload>> => {
      return getJson<ArticlePostPublicDetailPayload>(`/api/v1/articles/public-posts/${encodeURIComponent(id)}`);
    },

    posts: {
      list: async (): Promise<ApiResponse<ArticlePostAdminPayload>> => {
        return getJson<ArticlePostAdminPayload>("/api/v1/articles/posts");
      },

      create: async (payload: {
        articleCategoryId?: string | null;
        title: string;
        slug?: string;
        excerpt?: string;
        content?: string;
        keyPoints?: string[];
        authorName: string;
        image?: File | null;
        sortOrder?: number;
        isActive: boolean;
        isFeatured: boolean;
        showInFeaturedSlider: boolean;
        isImportant: boolean;
        publishedAt?: string | null;
        tagIds: string[];
      }): Promise<ApiResponse<ArticlePostItem>> => {
        const formData = new FormData();
        formData.append("article_category_id", payload.articleCategoryId || "");
        formData.append("title", payload.title);
        formData.append("slug", payload.slug || "");
        formData.append("excerpt", payload.excerpt || "");
        formData.append("content", payload.content || "");
        (payload.keyPoints ?? []).forEach((point) => formData.append("key_points[]", point));
        formData.append("author_name", payload.authorName);
        formData.append("sort_order", String(payload.sortOrder ?? 0));
        formData.append("is_active", payload.isActive ? "1" : "0");
        formData.append("is_featured", payload.isFeatured ? "1" : "0");
        formData.append("show_in_featured_slider", payload.showInFeaturedSlider ? "1" : "0");
        formData.append("is_important", payload.isImportant ? "1" : "0");
        formData.append("published_at", payload.publishedAt || "");
        payload.tagIds.forEach((tagId) => formData.append("tag_ids[]", tagId));
        if (payload.image) {
          formData.append("image", payload.image);
        }
        return requestFormData<ArticlePostItem>("/api/v1/articles/posts", "POST", formData);
      },

      update: async (id: string, payload: {
        articleCategoryId?: string | null;
        title: string;
        slug?: string;
        excerpt?: string;
        content?: string;
        keyPoints?: string[];
        authorName: string;
        image?: File | null;
        removeImage?: boolean;
        sortOrder?: number;
        isActive: boolean;
        isFeatured: boolean;
        showInFeaturedSlider: boolean;
        isImportant: boolean;
        publishedAt?: string | null;
        tagIds: string[];
      }): Promise<ApiResponse<ArticlePostItem>> => {
        const formData = new FormData();
        formData.append("article_category_id", payload.articleCategoryId || "");
        formData.append("title", payload.title);
        formData.append("slug", payload.slug || "");
        formData.append("excerpt", payload.excerpt || "");
        formData.append("content", payload.content || "");
        (payload.keyPoints ?? []).forEach((point) => formData.append("key_points[]", point));
        formData.append("author_name", payload.authorName);
        formData.append("sort_order", String(payload.sortOrder ?? 0));
        formData.append("is_active", payload.isActive ? "1" : "0");
        formData.append("is_featured", payload.isFeatured ? "1" : "0");
        formData.append("show_in_featured_slider", payload.showInFeaturedSlider ? "1" : "0");
        formData.append("is_important", payload.isImportant ? "1" : "0");
        formData.append("published_at", payload.publishedAt || "");
        formData.append("remove_image", payload.removeImage ? "1" : "0");
        formData.append("_method", "PUT");
        payload.tagIds.forEach((tagId) => formData.append("tag_ids[]", tagId));
        if (payload.image) {
          formData.append("image", payload.image);
        }
        return requestFormData<ArticlePostItem>(`/api/v1/articles/posts/${encodeURIComponent(id)}`, "POST", formData);
      },

      remove: async (id: string): Promise<ApiResponse<{ id: string }>> => {
        return requestJson<{ id: string }>(`/api/v1/articles/posts/${encodeURIComponent(id)}`, "DELETE");
      },
    },

    categories: {
      list: async (): Promise<ApiResponse<ArticleCategoryListPayload>> => {
        return getJson<ArticleCategoryListPayload>("/api/v1/articles/categories");
      },

      create: async (payload: { name: string; slug?: string; parentId?: string | null; sortOrder?: number; isActive?: boolean }): Promise<ApiResponse<ArticleCategoryItem>> => {
        return postJson<ArticleCategoryItem>("/api/v1/articles/categories", payload);
      },

      update: async (categoryId: string, payload: { name: string; slug?: string; parentId?: string | null; sortOrder?: number; isActive?: boolean }): Promise<ApiResponse<ArticleCategoryItem>> => {
        return requestJson<ArticleCategoryItem>(`/api/v1/articles/categories/${encodeURIComponent(categoryId)}`, "PUT", payload);
      },

      remove: async (categoryId: string): Promise<ApiResponse<{ id: string }>> => {
        return requestJson<{ id: string }>(`/api/v1/articles/categories/${encodeURIComponent(categoryId)}`, "DELETE");
      },
    },

    tags: {
      list: async (): Promise<ApiResponse<ArticleTagListPayload>> => {
        return getJson<ArticleTagListPayload>("/api/v1/articles/tags");
      },

      create: async (payload: { name: string; slug?: string }): Promise<ApiResponse<ArticleTagItem>> => {
        return postJson<ArticleTagItem>("/api/v1/articles/tags", payload);
      },

      update: async (tagId: string, payload: { name: string; slug?: string }): Promise<ApiResponse<ArticleTagItem>> => {
        return requestJson<ArticleTagItem>(`/api/v1/articles/tags/${encodeURIComponent(tagId)}`, "PUT", payload);
      },

      remove: async (tagId: string): Promise<ApiResponse<{ id: string }>> => {
        return requestJson<{ id: string }>(`/api/v1/articles/tags/${encodeURIComponent(tagId)}`, "DELETE");
      },
    },
  },

  gallery: {
    list: async (): Promise<ApiResponse<GalleryPublicPayload>> => {
      return getJson<GalleryPublicPayload>("/api/v1/gallery-images");
    },

    adminList: async (): Promise<ApiResponse<GalleryAdminPayload>> => {
      return getJson<GalleryAdminPayload>("/api/v1/gallery-images/admin");
    },

    updateSettings: async (enabled: boolean): Promise<ApiResponse<{ enabled: boolean }>> => {
      return requestJson<{ enabled: boolean }>("/api/v1/gallery-images/settings", "PUT", { enabled });
    },

    create: async (payload: {
      image: File;
      title?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    }): Promise<ApiResponse<GalleryImage>> => {
      const formData = new FormData();
      formData.append("image", payload.image);
      formData.append("title", normalizeDigits(payload.title ?? ""));
      formData.append("description", normalizeDigits(payload.description ?? ""));
      formData.append("sort_order", String(payload.sortOrder ?? 0));
      formData.append("is_active", payload.isActive === false ? "0" : "1");
      return requestFormData<GalleryImage>("/api/v1/gallery-images", "POST", formData);
    },

    update: async (galleryId: string, payload: {
      image?: File | null;
      title?: string;
      description?: string;
      sortOrder?: number;
      isActive: boolean;
    }): Promise<ApiResponse<GalleryImage>> => {
      if (payload.image) {
        const formData = new FormData();
        formData.append("_method", "PUT");
        formData.append("image", payload.image);
        formData.append("title", normalizeDigits(payload.title ?? ""));
        formData.append("description", normalizeDigits(payload.description ?? ""));
        formData.append("sort_order", String(payload.sortOrder ?? 0));
        formData.append("is_active", payload.isActive ? "1" : "0");

        return requestFormData<GalleryImage>(`/api/v1/gallery-images/${encodeURIComponent(galleryId)}`, "POST", formData);
      }

      return requestJson<GalleryImage>(`/api/v1/gallery-images/${encodeURIComponent(galleryId)}`, "PUT", {
        title: payload.title ?? "",
        description: payload.description ?? "",
        sort_order: payload.sortOrder ?? 0,
        is_active: payload.isActive,
      });
    },

    remove: async (galleryId: string): Promise<ApiResponse<{}>> => {
      return requestJson<{}>(`/api/v1/gallery-images/${encodeURIComponent(galleryId)}`, "DELETE");
    },
  },

  payment: {
    getSettings: async (): Promise<ApiResponse<PaymentSettings>> => {
      const res = await getJson<Partial<PaymentSettings>>("/api/v1/settings/general");
      if (!res.success) {
        return {
          success: false,
          data: getDefaultPaymentSettings(),
          message: res.message,
          errors: res.errors,
        };
      }

      return {
        ...(() => {
          db.paymentSettings = {
            ...getDefaultPaymentSettings(),
            ...res.data,
          };
          return {};
        })(),
        success: true,
        data: db.paymentSettings,
        message: res.message,
      };
    },

    updateSettings: async (settings: PaymentSettings): Promise<ApiResponse<PaymentSettings>> => {
      const res = await requestJson<Partial<PaymentSettings>>("/api/v1/settings/general", "PUT", settings);
      if (!res.success) {
        return {
          success: false,
          data: settings,
          message: res.message,
          errors: res.errors,
        };
      }

      const nextSettings = {
        ...getDefaultPaymentSettings(),
        ...res.data,
      };
      db.paymentSettings = nextSettings;

      if (typeof window !== "undefined" && window.__BOOKING_BOOTSTRAP__?.meta) {
        const localization = nextSettings.localization ?? {};
        window.__BOOKING_BOOTSTRAP__.meta = {
          ...window.__BOOKING_BOOTSTRAP__.meta,
          ...localization,
          locale: nextSettings.locale ?? localization.locale ?? window.__BOOKING_BOOTSTRAP__.meta.locale,
          country: nextSettings.country ?? localization.country ?? window.__BOOKING_BOOTSTRAP__.meta.country,
          appointmentBookingDisabled: nextSettings.appointmentBookingDisabled === true,
        };
      }

      window.dispatchEvent(new CustomEvent("booking:payment-settings-updated", { detail: nextSettings }));

      return {
        success: true,
        data: nextSettings,
        message: res.message,
      };
    },

    createEnamadVerificationFile: async (filename: string): Promise<ApiResponse<PaymentSettings>> => {
      const res = await requestJson<Partial<PaymentSettings>>("/api/v1/settings/general/enamad-verification-file", "POST", {
        filename,
      });

      if (!res.success) {
        return {
          success: false,
          data: db.paymentSettings,
          message: res.message,
          errors: res.errors,
        };
      }

      const nextSettings = {
        ...getDefaultPaymentSettings(),
        ...db.paymentSettings,
        ...res.data,
      };
      db.paymentSettings = nextSettings;

      window.dispatchEvent(new CustomEvent("booking:payment-settings-updated", { detail: nextSettings }));

      return {
        success: true,
        data: nextSettings,
        message: res.message,
      };
    },

    checkoutAppointment: async (payload: {
      barberId: string;
      sectionId: string;
      date: string;
      startTime: string;
      endTime: string;
      userName: string;
      userPhone: string;
      notes?: string;
      sendSms?: boolean;
      isForSomeoneElse?: boolean;
      gateway?: PaymentProvider;
    }): Promise<ApiResponse<AppointmentPaymentCheckout>> => {
      return postJson<AppointmentPaymentCheckout>("/api/v1/booking-payments/checkout", payload);
    },
  },

  bookingClosure: {
    get: async (closureId?: string | null, historyPage?: number): Promise<ApiResponse<AppointmentBookingClosurePayload>> => {
      const params = new URLSearchParams();
      if (closureId) params.set("closureId", closureId);
      if (historyPage && historyPage > 1) params.set("historyPage", String(historyPage));
      const query = params.toString() ? `?${params.toString()}` : "";
      return getJson<AppointmentBookingClosurePayload>(`/api/v1/booking-closure${query}`);
    },

    publicStatus: async (): Promise<ApiResponse<AppointmentBookingClosurePayload>> => {
      return getJson<AppointmentBookingClosurePayload>("/api/v1/booking-closure/public");
    },

    close: async (payload: { message: string; notifyOptInEnabled: boolean }): Promise<ApiResponse<AppointmentBookingClosurePayload>> => {
      return postJson<AppointmentBookingClosurePayload>("/api/v1/booking-closure/close", payload);
    },

    open: async (): Promise<ApiResponse<AppointmentBookingClosurePayload>> => {
      return postJson<AppointmentBookingClosurePayload>("/api/v1/booking-closure/open", {});
    },

    subscribe: async (): Promise<ApiResponse<AppointmentBookingClosurePayload>> => {
      return postJson<AppointmentBookingClosurePayload>("/api/v1/booking-closure/subscribe", {});
    },

    startNotifications: async (closureId?: string | null): Promise<ApiResponse<AppointmentBookingClosurePayload>> => {
      return postJson<AppointmentBookingClosurePayload>("/api/v1/booking-closure/notifications/start", { closureId });
    },

    pauseNotifications: async (closureId?: string | null): Promise<ApiResponse<AppointmentBookingClosurePayload>> => {
      return postJson<AppointmentBookingClosurePayload>("/api/v1/booking-closure/notifications/pause", { closureId });
    },
  },

  store: {
    dashboard: async (): Promise<ApiResponse<StoreDashboardPayload>> => {
      return getJson<StoreDashboardPayload>("/api/v1/store/dashboard");
    },

    getGeneralSettings: async (): Promise<ApiResponse<StoreGeneralSettings>> => {
      return getJson<StoreGeneralSettings>("/api/v1/store/settings/general");
    },

    updateGeneralSettings: async (payload: StoreGeneralSettings): Promise<ApiResponse<StoreGeneralSettings>> => {
      return requestJson<StoreGeneralSettings>("/api/v1/store/settings/general", "PUT", payload);
    },

    getHomeSettings: async (): Promise<ApiResponse<StoreHomeSettings>> => {
      return getJson<StoreHomeSettings>("/api/v1/store/settings/home");
    },

    updateHomeSettings: async (payload: StoreHomeSettings): Promise<ApiResponse<StoreHomeSettings>> => {
      return requestJson<StoreHomeSettings>("/api/v1/store/settings/home", "PUT", payload);
    },

    updateHomeBanner: async (payload: {
      showBannerOnMainSite?: boolean;
      image?: File | null;
      removeImage?: boolean;
      mainSiteBannerTitle?: string | null;
      mainSiteBannerDescription?: string | null;
      graphicBannerImage?: File | null;
      removeGraphicBannerImage?: boolean;
      graphicBannerBadge?: string | null;
      graphicBannerTitle?: string | null;
      graphicBannerDescription?: string | null;
      graphicBannerButtonLabel?: string | null;
      graphicBannerLink?: string | null;
    }): Promise<ApiResponse<StoreHomeSettings>> => {
      const formData = new FormData();
      if (typeof payload.showBannerOnMainSite === "boolean") {
        formData.append("showBannerOnMainSite", payload.showBannerOnMainSite ? "1" : "0");
      }
      if (typeof payload.removeImage === "boolean") {
        formData.append("removeImage", payload.removeImage ? "1" : "0");
      }
      if (payload.mainSiteBannerTitle !== undefined) {
        formData.append("mainSiteBannerTitle", payload.mainSiteBannerTitle?.trim() || "");
      }
      if (payload.mainSiteBannerDescription !== undefined) {
        formData.append("mainSiteBannerDescription", payload.mainSiteBannerDescription?.trim() || "");
      }
      if (payload.image) {
        formData.append("image", payload.image);
      }
      if (typeof payload.removeGraphicBannerImage === "boolean") {
        formData.append("removeGraphicBannerImage", payload.removeGraphicBannerImage ? "1" : "0");
      }
      if (payload.graphicBannerBadge !== undefined) {
        formData.append("graphicBannerBadge", payload.graphicBannerBadge?.trim() || "");
      }
      if (payload.graphicBannerTitle !== undefined) {
        formData.append("graphicBannerTitle", payload.graphicBannerTitle?.trim() || "");
      }
      if (payload.graphicBannerDescription !== undefined) {
        formData.append("graphicBannerDescription", payload.graphicBannerDescription?.trim() || "");
      }
      if (payload.graphicBannerButtonLabel !== undefined) {
        formData.append("graphicBannerButtonLabel", payload.graphicBannerButtonLabel?.trim() || "");
      }
      if (payload.graphicBannerLink !== undefined) {
        formData.append("graphicBannerLink", payload.graphicBannerLink?.trim() || "");
      }
      if (payload.graphicBannerImage) {
        formData.append("graphicBannerImage", payload.graphicBannerImage);
      }
      return requestFormData<StoreHomeSettings>("/api/v1/store/settings/home/banner", "POST", formData);
    },

    getFaqSettings: async (): Promise<ApiResponse<StoreFaqSettings>> => {
      return getJson<StoreFaqSettings>("/api/v1/store/settings/faq");
    },

    updateFaqSettings: async (payload: StoreFaqSettings): Promise<ApiResponse<StoreFaqSettings>> => {
      return requestJson<StoreFaqSettings>("/api/v1/store/settings/faq", "PUT", payload);
    },

    getShippingSettings: async (): Promise<ApiResponse<StoreShippingSettings>> => {
      return getJson<StoreShippingSettings>("/api/v1/store/settings/shipping");
    },

    updateShippingSettings: async (payload: StoreShippingSettings): Promise<ApiResponse<StoreShippingSettings>> => {
      return requestJson<StoreShippingSettings>("/api/v1/store/settings/shipping", "PUT", payload);
    },

    listCategories: async (): Promise<ApiResponse<StoreCategoryListPayload>> => {
      return getJson<StoreCategoryListPayload>("/api/v1/store/categories");
    },

    listPublicCategories: async (): Promise<ApiResponse<StoreCategoryListPayload>> => {
      return getJson<StoreCategoryListPayload>("/api/v1/store/public-categories");
    },

    createCategory: async (payload: {
      name: string;
      slug?: string;
      sortOrder: number;
      isActive: boolean;
      showOnHome?: boolean;
      image?: File | null;
    }): Promise<ApiResponse<StoreCategoryItem>> => {
      const formData = new FormData();
      formData.append("name", payload.name);
      formData.append("slug", payload.slug || "");
      formData.append("sort_order", String(payload.sortOrder));
      formData.append("is_active", payload.isActive ? "1" : "0");
      formData.append("show_on_home", payload.showOnHome !== false ? "1" : "0");
      if (payload.image) {
        formData.append("image", payload.image);
      }
      return requestFormData<StoreCategoryItem>("/api/v1/store/categories", "POST", formData);
    },

    updateCategory: async (id: string, payload: {
      name: string;
      slug: string;
      sortOrder: number;
      isActive: boolean;
      showOnHome?: boolean;
      image?: File | null;
      removeImage?: boolean;
    }): Promise<ApiResponse<StoreCategoryItem>> => {
      const formData = new FormData();
      formData.append("name", payload.name);
      formData.append("slug", payload.slug);
      formData.append("sort_order", String(payload.sortOrder));
      formData.append("is_active", payload.isActive ? "1" : "0");
      formData.append("show_on_home", payload.showOnHome ? "1" : "0");
      formData.append("remove_image", payload.removeImage ? "1" : "0");
      if (payload.image) {
        formData.append("image", payload.image);
      }
      return requestFormData<StoreCategoryItem>(`/api/v1/store/categories/${id}`, "POST", formData);
    },

    deleteCategory: async (id: string): Promise<ApiResponse<{}>> => {
      return requestJson<{}>(`/api/v1/store/categories/${id}`, "DELETE");
    },

    listProducts: async (): Promise<ApiResponse<StoreProductListPayload>> => {
      return getJson<StoreProductListPayload>("/api/v1/store/products");
    },

    listPublicProducts: async (): Promise<ApiResponse<StoreProductListPayload>> => {
      return getJson<StoreProductListPayload>("/api/v1/store/public-products");
    },

    getPublicProduct: async (id: string): Promise<ApiResponse<StoreProductItem>> => {
      return getJson<StoreProductItem>(`/api/v1/store/public-products/${id}`);
    },

    listPublicProductReviews: async (productId: string): Promise<ApiResponse<StoreProductReviewListPayload>> => {
      return getJson<StoreProductReviewListPayload>(`/api/v1/store/public-products/${encodeURIComponent(productId)}/reviews`);
    },

    createPublicProductReview: async (
      productId: string,
      payload: {
        reviewerName?: string;
        rating: number;
        body: string;
      },
    ): Promise<ApiResponse<StoreProductReviewItem>> => {
      return postJson<StoreProductReviewItem>(`/api/v1/store/public-products/${encodeURIComponent(productId)}/reviews`, {
        reviewer_name: payload.reviewerName?.trim() || "",
        rating: payload.rating,
        body: payload.body,
      });
    },

    listProductReviews: async (productId: string): Promise<ApiResponse<StoreProductReviewListPayload>> => {
      return getJson<StoreProductReviewListPayload>(`/api/v1/store/products/${encodeURIComponent(productId)}/reviews`);
    },

    listAllProductReviews: async (): Promise<ApiResponse<StoreProductReviewListPayload>> => {
      return getJson<StoreProductReviewListPayload>("/api/v1/store/product-reviews");
    },

    moderateProductReview: async (
      reviewId: string,
      payload: {
        isApproved?: boolean;
        adminReply?: string | null;
      },
    ): Promise<ApiResponse<StoreProductReviewItem>> => {
      return postJson<StoreProductReviewItem>(`/api/v1/store/product-reviews/${encodeURIComponent(reviewId)}/moderate`, {
        is_approved: payload.isApproved,
        admin_reply: payload.adminReply ?? "",
      });
    },

    deleteProductReview: async (reviewId: string): Promise<ApiResponse<{}>> => {
      return requestJson<{}>(`/api/v1/store/product-reviews/${encodeURIComponent(reviewId)}`, "DELETE");
    },

    createProduct: async (payload: {
      storeCategoryId?: string | null;
      title: string;
      slug?: string;
      subtitle?: string;
      description?: string;
      priceAmount: number;
      discountedPriceAmount?: number | null;
      cafebazaarProductId?: string | null;
      stockQuantity: number;
      sortOrder: number;
      isActive: boolean;
      isFeatured: boolean;
      isBestseller: boolean;
      isPopular: boolean;
      reviewsEnabled: boolean;
      image?: File | null;
      galleryImages?: File[];
    }): Promise<ApiResponse<StoreProductItem>> => {
      const formData = new FormData();
      formData.append("store_category_id", payload.storeCategoryId || "");
      formData.append("title", payload.title);
      formData.append("slug", payload.slug || "");
      formData.append("subtitle", payload.subtitle || "");
      formData.append("description", payload.description || "");
      formData.append("price_amount", String(payload.priceAmount));
      formData.append("discounted_price_amount", payload.discountedPriceAmount !== null && payload.discountedPriceAmount !== undefined ? String(payload.discountedPriceAmount) : "");
      formData.append("stock_quantity", String(payload.stockQuantity));
      formData.append("sort_order", String(payload.sortOrder));
      formData.append("is_active", payload.isActive ? "1" : "0");
      formData.append("is_featured", payload.isFeatured ? "1" : "0");
      formData.append("is_bestseller", payload.isBestseller ? "1" : "0");
      formData.append("is_popular", payload.isPopular ? "1" : "0");
      formData.append("reviews_enabled", payload.reviewsEnabled ? "1" : "0");
      if (payload.image) {
        formData.append("image", payload.image);
      }
      (payload.galleryImages || []).forEach((file) => formData.append("gallery_images[]", file));
      return requestFormData<StoreProductItem>("/api/v1/store/products", "POST", formData);
    },

    updateProduct: async (id: string, payload: {
      storeCategoryId?: string | null;
      title: string;
      slug: string;
      subtitle?: string;
      description?: string;
      priceAmount: number;
      discountedPriceAmount?: number | null;
      stockQuantity: number;
      sortOrder: number;
      isActive: boolean;
      isFeatured: boolean;
      isBestseller: boolean;
      isPopular: boolean;
      reviewsEnabled: boolean;
      image?: File | null;
      galleryImages?: File[];
      retainedGalleryIds?: string[];
      removeImage?: boolean;
      removeGallery?: boolean;
    }): Promise<ApiResponse<StoreProductItem>> => {
      const formData = new FormData();
      formData.append("store_category_id", payload.storeCategoryId || "");
      formData.append("title", payload.title);
      formData.append("slug", payload.slug);
      formData.append("subtitle", payload.subtitle || "");
      formData.append("description", payload.description || "");
      formData.append("price_amount", String(payload.priceAmount));
      formData.append("discounted_price_amount", payload.discountedPriceAmount !== null && payload.discountedPriceAmount !== undefined ? String(payload.discountedPriceAmount) : "");
      formData.append("stock_quantity", String(payload.stockQuantity));
      formData.append("sort_order", String(payload.sortOrder));
      formData.append("is_active", payload.isActive ? "1" : "0");
      formData.append("is_featured", payload.isFeatured ? "1" : "0");
      formData.append("is_bestseller", payload.isBestseller ? "1" : "0");
      formData.append("is_popular", payload.isPopular ? "1" : "0");
      formData.append("reviews_enabled", payload.reviewsEnabled ? "1" : "0");
      formData.append("remove_image", payload.removeImage ? "1" : "0");
      formData.append("remove_gallery", payload.removeGallery ? "1" : "0");
      if (payload.image) {
        formData.append("image", payload.image);
      }
      (payload.galleryImages || []).forEach((file) => formData.append("gallery_images[]", file));
      (payload.retainedGalleryIds || []).forEach((id) => formData.append("retained_gallery_ids[]", id));
      return requestFormData<StoreProductItem>(`/api/v1/store/products/${id}`, "POST", formData);
    },

    deleteProduct: async (id: string): Promise<ApiResponse<{}>> => {
      return requestJson<{}>(`/api/v1/store/products/${id}`, "DELETE");
    },

    checkout: async (payload: {
      customerName: string;
      customerPhone: string;
      shippingMethod: "courier" | "express" | "pickup";
      paymentMethod: "online" | "card" | "cod";
      gateway?: PaymentProvider;
      notes?: string;
      items: Array<{
        id?: string;
        productId?: string;
        title: string;
        subtitle?: string;
        imageLabel?: string;
        unitAmount: number;
        quantity: number;
      }>;
      address?: {
        title?: string;
        provinceId?: number | null;
        provinceName?: string;
        cityId?: number | null;
        cityName?: string;
        latitude?: number | null;
        longitude?: number | null;
        address?: string;
      } | null;
    }): Promise<ApiResponse<StoreCheckoutResponse>> => {
      return postJson<StoreCheckoutResponse>("/api/v1/store/orders/checkout", payload);
    },

    listMyOrders: async (params?: { page?: number; perPage?: number }): Promise<ApiResponse<PaginatedStoreOrders>> => {
      const search = new URLSearchParams();
      if (params?.page) search.set("page", String(params.page));
      if (params?.perPage) search.set("perPage", String(params.perPage));
      const query = search.toString();
      return getJson<PaginatedStoreOrders>(`/api/v1/store/orders${query ? `?${query}` : ""}`);
    },

    listAdminOrders: async (params?: {
      page?: number;
      perPage?: number;
      q?: string;
      status?: string;
      paymentMethod?: "online" | "card" | "cod" | "";
      shippingMethod?: "courier" | "express" | "pickup" | "";
      onlyNew?: boolean;
    }): Promise<ApiResponse<PaginatedStoreAdminOrders>> => {
      const search = new URLSearchParams();
      if (params?.page) search.set("page", String(params.page));
      if (params?.perPage) search.set("perPage", String(params.perPage));
      if (params?.q) search.set("q", params.q);
      if (params?.status) search.set("status", params.status);
      if (params?.paymentMethod) search.set("paymentMethod", params.paymentMethod);
      if (params?.shippingMethod) search.set("shippingMethod", params.shippingMethod);
      if (params?.onlyNew) search.set("onlyNew", "1");
      const query = search.toString();
      return getJson<PaginatedStoreAdminOrders>(`/api/v1/store/admin-orders${query ? `?${query}` : ""}`);
    },

    updateAdminOrder: async (
      id: string,
      payload: {
        status?: string;
        shippingMethod?: "courier" | "express" | "pickup" | string;
        adminNote?: string;
        comment?: string;
        shippingTrackingCode?: string;
        shippingCarrier?: string;
        items?: Array<{
          id: string;
          title: string;
          subtitle?: string;
          quantity: number;
          unitAmount: number;
        }>;
        sendSms?: boolean;
      },
    ): Promise<ApiResponse<{ order: StoreOrderSummary; sms: { attempted: boolean; sent: boolean; message: string } }>> => {
      return postJson<{ order: StoreOrderSummary; sms: { attempted: boolean; sent: boolean; message: string } }>(
        `/api/v1/store/admin-orders/${id}`,
        payload,
      );
    },

    getAdminOrder: async (id: string): Promise<ApiResponse<StoreOrderSummary>> => {
      return getJson<StoreOrderSummary>(`/api/v1/store/admin-orders/${id}`);
    },

    sendAdminOrderSms: async (
      id: string,
      templateKey: "afterOrder" | "afterApproval" | "afterShippingCode" | "afterRejection",
    ): Promise<ApiResponse<{ order: StoreOrderSummary; sms: { attempted: boolean; sent: boolean; message: string } }>> => {
      return postJson<{ order: StoreOrderSummary; sms: { attempted: boolean; sent: boolean; message: string } }>(
        `/api/v1/store/admin-orders/${id}/send-sms`,
        { templateKey },
      );
    },

    getMyOrder: async (id: string): Promise<ApiResponse<StoreOrderSummary>> => {
      return getJson<StoreOrderSummary>(`/api/v1/store/orders/${id}`);
    },
  },

  auth: {
    sendOtp: async (phone: string): Promise<ApiResponse<{ remainingSeconds: number; codeHint?: string | null }>> => {
      const tenantResult = await postJson<{ remaining_seconds: number; code_hint?: string }>("/api/v1/auth/otp/send", { mobile: phone });

      if (tenantResult.success) {
        return {
          success: true,
          data: {
            remainingSeconds: tenantResult.data.remaining_seconds,
            codeHint: tenantResult.data.code_hint ?? null,
          },
          message: tenantResult.message,
        };
      }

      return {
        success: false,
        data: { remainingSeconds: 0, codeHint: null },
        message: tenantResult.message || apiMessage("api.auth.sendOtpFailed"),
        errors: tenantResult.errors,
      };
    },

    login: async (phone: string, code: string): Promise<ApiResponse<{ user: User; token: string }>> => {
      const tenantResult = await postJson<{ user: User; redirect?: string }>("/api/v1/auth/otp/verify", {
        mobile: phone,
        code,
        remember: true,
      });

      if (tenantResult.success) {
        return {
          success: true,
          data: {
            user: tenantResult.data.user,
            token: "tenant-session",
          },
          message: tenantResult.message,
        };
      }

      return {
        success: false,
        data: {} as any,
        message: tenantResult.message || apiMessage("api.auth.loginFailed"),
        errors: tenantResult.errors,
      };
    },
    
    me: async (): Promise<ApiResponse<User | null>> => {
      const tenantResult = await getJson<{ user: User }>("/api/v1/auth/otp/me");

      if (tenantResult.success) {
        return {
          success: true,
          data: tenantResult.data.user,
        };
      }

      return {
        success: false,
        data: null,
        message: tenantResult.message,
      };
    },

    updateProfile: async (userId: string, payload: UserProfilePayload): Promise<ApiResponse<User>> => {
        const tenantResult = await postJson<{ user: User }>("/api/v1/auth/otp/profile", payload);
        if (tenantResult.success) {
          return {
            success: true,
            data: tenantResult.data.user,
          };
        }

        return {
          success: false,
          data: {} as User,
          message: tenantResult.message || apiMessage("api.auth.profileUpdateFailed"),
          errors: tenantResult.errors,
        };
    },

    logout: async (): Promise<ApiResponse<boolean>> => {
      const tenantResult = await postJson<boolean>("/api/v1/auth/otp/logout");

      if (tenantResult.success) {
        return tenantResult;
      }

      return {
        success: true,
        data: true,
      };
    },
  },

  nutrition: {
    getProfile: async (): Promise<ApiResponse<{ profile: NutritionProfile | null; managerMessage?: string | null }>> => {
      return getJson<{ profile: NutritionProfile | null; managerMessage?: string | null }>("/api/v1/nutrition/profile");
    },

    getProfileDashboard: async (): Promise<ApiResponse<NutritionProfileDashboardPayload>> => {
      return getJson<NutritionProfileDashboardPayload>("/api/v1/nutrition/profile-dashboard");
    },

    saveProfile: async (payload: {
      dietGoal: "lose-weight" | "gain-weight" | "maintain-weight";
      gender: "male" | "female";
      athleteMode: "athlete" | "non-athlete";
      activityLevel: "very-low" | "medium" | "high" | "intense";
      birthDate: string;
      heightCm: number;
      weightKg: string;
    }): Promise<ApiResponse<{ profile: NutritionProfile; recommendation: NutritionWeightRecommendation }>> => {
      const result = await postJson<{
        profile: NutritionProfile;
        recommendation: {
          healthy_min_weight_kg: number;
          healthy_max_weight_kg: number;
          ideal_weight_kg: number;
          recommended_target_weight_kg: number;
        };
      }>("/api/v1/nutrition/profile", payload);

      if (!result.success) {
        return {
          success: false,
          data: {} as { profile: NutritionProfile; recommendation: NutritionWeightRecommendation },
          message: result.message || apiMessage("api.nutrition.profileSaveFailed"),
          errors: result.errors,
        };
      }

      return {
        success: true,
        data: {
          profile: result.data.profile,
          recommendation: {
            healthyMinWeightKg: result.data.recommendation.healthy_min_weight_kg,
            healthyMaxWeightKg: result.data.recommendation.healthy_max_weight_kg,
            idealWeightKg: result.data.recommendation.ideal_weight_kg,
            recommendedTargetWeightKg: result.data.recommendation.recommended_target_weight_kg,
          },
        },
        message: result.message,
      };
    },

    updateTargetWeight: async (targetWeightKg: string, weeklyWeightChangeKg?: number): Promise<ApiResponse<{ profile: NutritionProfile }>> => {
      return postJson<{ profile: NutritionProfile }>("/api/v1/nutrition/profile/target-weight", { targetWeightKg, weeklyWeightChangeKg });
    },

    updateBirthDate: async (birthDate: string): Promise<ApiResponse<{ profile: NutritionProfile }>> => {
      return postJson<{ profile: NutritionProfile }>("/api/v1/nutrition/profile/birth-date", { birthDate });
    },

    savePreferences: async (payload: {
      dislikedFoods?: string;
      foodAllergies?: string;
      medicalConditions?: string;
      medicalConditionsItems?: import("./types").NutritionMedicalConditionItem[];
      medicationsAndSupplements?: string;
    }): Promise<ApiResponse<{ profile: NutritionProfile }>> => {
      return postJson<{ profile: NutritionProfile }>("/api/v1/nutrition/profile/preferences", payload);
    },

    saveMindset: async (answers: {
      reason: string;
      barrier: string;
      stressAppetite: string;
      hardestTime: string;
      planStyle: string;
    }): Promise<ApiResponse<{ profile: NutritionProfile }>> => {
      return postJson<{ profile: NutritionProfile }>("/api/v1/nutrition/profile/mindset", { answers });
    },

    selectPackage: async (nutritionPackageId: string): Promise<ApiResponse<{ profile: NutritionProfile }>> => {
      return postJson<{ profile: NutritionProfile }>("/api/v1/nutrition/profile/package-selection", { nutritionPackageId });
    },
  },

  nutritionTemplates: {
    list: async (): Promise<ApiResponse<NutritionDietTemplateListPayload>> => {
      return getJson<NutritionDietTemplateListPayload>("/api/v1/nutrition/templates");
    },

    listPublic: async (goal?: string): Promise<ApiResponse<{ items: NutritionDietTemplateItem[] }>> => {
      const query = goal ? `?goal=${encodeURIComponent(goal)}` : "";
      return getJson<{ items: NutritionDietTemplateItem[] }>(`/api/v1/nutrition/diet-templates/public${query}`);
    },

    create: async (payload: {
      name: string;
      slug?: string;
      parentId?: string | null;
      image?: File | null;
      dietBasis: string;
      dietLevel?: string;
      applicableGoals: string[];
      mealSlots?: Array<{ key: string; title: string; icon: string; enabled: boolean; description?: string; foodCount: number; sortOrder: number }>;
      prescriptionMode?: "daily_prescription" | "user_choice" | "fixed_text";
      allowFoodReplacement?: boolean;
      suggestDailyReplacements?: boolean;
      showDietExplanations?: boolean;
      dietExplanationPrompt?: string;
      description?: string;
      templateNotes?: string;
      conditionsText?: string;
      durationDays?: number;
      supplementsEnabled?: boolean;
      supplementNotes?: string;
      sortOrder?: number;
      isActive?: boolean;
    }): Promise<ApiResponse<{ item: NutritionDietTemplateItem }>> => {
      const formData = new FormData();
      formData.append("name", payload.name);
      formData.append("slug", payload.slug || "");
      formData.append("parent_id", payload.parentId || "");
      formData.append("diet_basis", payload.dietBasis);
      formData.append("diet_level", payload.dietLevel || "");
      payload.applicableGoals.forEach((goal) => formData.append("applicable_goals[]", goal));
      formData.append("meal_slots", JSON.stringify((payload.mealSlots ?? []).map((item) => ({
        key: item.key,
        title: item.title,
        icon: item.icon,
        enabled: item.enabled,
        description: item.description || "",
        food_count: item.foodCount,
        sort_order: item.sortOrder,
      }))));
      formData.append("prescription_mode", payload.prescriptionMode ?? "daily_prescription");
      formData.append("allow_food_replacement", payload.allowFoodReplacement ? "1" : "0");
      formData.append("suggest_daily_replacements", payload.suggestDailyReplacements ? "1" : "0");
      formData.append("show_diet_explanations", payload.showDietExplanations ? "1" : "0");
      formData.append("diet_explanation_prompt", payload.dietExplanationPrompt || "");
      formData.append("description", payload.description || "");
      formData.append("template_notes", payload.templateNotes || "");
      formData.append("conditions_text", payload.conditionsText || "");
      formData.append("duration_days", String(payload.durationDays ?? 30));
      formData.append("supplements_enabled", payload.supplementsEnabled ? "1" : "0");
      formData.append("supplement_notes", payload.supplementNotes || "");
      formData.append("sort_order", String(payload.sortOrder ?? 0));
      formData.append("is_active", payload.isActive === false ? "0" : "1");
      if (payload.image) {
        formData.append("image", payload.image);
      }
      return requestFormData<{ item: NutritionDietTemplateItem }>("/api/v1/nutrition/templates", "POST", formData);
    },

    update: async (
      id: string,
      payload: {
        name: string;
        slug?: string;
        parentId?: string | null;
        image?: File | null;
        removeImage?: boolean;
        dietBasis: string;
        dietLevel?: string;
        applicableGoals: string[];
        mealSlots?: Array<{ key: string; title: string; icon: string; enabled: boolean; description?: string; foodCount: number; sortOrder: number }>;
        prescriptionMode?: "daily_prescription" | "user_choice" | "fixed_text";
        allowFoodReplacement?: boolean;
        suggestDailyReplacements?: boolean;
        showDietExplanations?: boolean;
        dietExplanationPrompt?: string;
        description?: string;
        templateNotes?: string;
        conditionsText?: string;
        durationDays?: number;
        supplementsEnabled?: boolean;
        supplementNotes?: string;
        sortOrder?: number;
        isActive?: boolean;
      },
    ): Promise<ApiResponse<{ item: NutritionDietTemplateItem }>> => {
      const formData = new FormData();
      formData.append("name", payload.name);
      formData.append("slug", payload.slug || "");
      formData.append("parent_id", payload.parentId || "");
      formData.append("diet_basis", payload.dietBasis);
      formData.append("diet_level", payload.dietLevel || "");
      payload.applicableGoals.forEach((goal) => formData.append("applicable_goals[]", goal));
      formData.append("meal_slots", JSON.stringify((payload.mealSlots ?? []).map((item) => ({
        key: item.key,
        title: item.title,
        icon: item.icon,
        enabled: item.enabled,
        description: item.description || "",
        food_count: item.foodCount,
        sort_order: item.sortOrder,
      }))));
      formData.append("prescription_mode", payload.prescriptionMode ?? "daily_prescription");
      formData.append("allow_food_replacement", payload.allowFoodReplacement ? "1" : "0");
      formData.append("suggest_daily_replacements", payload.suggestDailyReplacements ? "1" : "0");
      formData.append("show_diet_explanations", payload.showDietExplanations ? "1" : "0");
      formData.append("diet_explanation_prompt", payload.dietExplanationPrompt || "");
      formData.append("description", payload.description || "");
      formData.append("template_notes", payload.templateNotes || "");
      formData.append("conditions_text", payload.conditionsText || "");
      formData.append("duration_days", String(payload.durationDays ?? 30));
      formData.append("supplements_enabled", payload.supplementsEnabled ? "1" : "0");
      formData.append("supplement_notes", payload.supplementNotes || "");
      formData.append("sort_order", String(payload.sortOrder ?? 0));
      formData.append("is_active", payload.isActive === false ? "0" : "1");
      formData.append("remove_image", payload.removeImage ? "1" : "0");
      formData.append("_method", "PUT");
      if (payload.image) {
        formData.append("image", payload.image);
      }
      return requestFormData<{ item: NutritionDietTemplateItem }>(`/api/v1/nutrition/templates/${encodeURIComponent(id)}`, "POST", formData);
    },

    delete: async (id: string): Promise<ApiResponse<true>> => {
      return requestJson<true>(`/api/v1/nutrition/templates/${encodeURIComponent(id)}`, "DELETE");
    },
  },

  nutritionPackages: {
    list: async (): Promise<ApiResponse<NutritionPackageListPayload>> => {
      return getJson<NutritionPackageListPayload>("/api/v1/nutrition/packages");
    },

    listPublic: async (goal?: string): Promise<ApiResponse<NutritionPackageListPayload>> => {
      const query = goal ? `?goal=${encodeURIComponent(goal)}` : "";
      return getJson<NutritionPackageListPayload>(`/api/v1/nutrition/public-packages${query}`);
    },

    create: async (payload: {
      name: string;
      shortTitle?: string | null;
      subtitle?: string | null;
      slug?: string;
      description?: string | null;
      features?: Array<{ icon: string; text: string }>;
      image?: File | null;
      parentId?: string | null;
      applicableGoals: string[];
      onlineDietCount: number;
      offlineDietCount: number;
      durationDays: number;
      priceAmount: number;
      discountedPriceAmount?: number | null;
      cafebazaarProductId?: string | null;
      badgeTitle?: string | null;
      isRecommended?: boolean;
      visualStyle?: string;
      actionLabel?: string | null;
      firstDietTemplateMode?: string;
      firstDietTemplateId?: string | null;
      firstDietTemplateIds?: Record<string, string | null>;
      sortOrder?: number;
      isActive?: boolean;
    }): Promise<ApiResponse<NutritionPackageItem>> => {
      const formData = new FormData();
      formData.append("name", payload.name);
      formData.append("short_title", payload.shortTitle ?? "");
      formData.append("subtitle", payload.subtitle ?? "");
      formData.append("slug", payload.slug || "");
      formData.append("description", payload.description ?? "");
      (payload.features ?? []).forEach((feature, index) => {
        formData.append(`features[${index}][icon]`, feature.icon);
        formData.append(`features[${index}][text]`, feature.text);
      });
      formData.append("parent_id", payload.parentId || "");
      payload.applicableGoals.forEach((goal) => formData.append("applicable_goals[]", goal));
      formData.append("online_diet_count", String(payload.onlineDietCount));
      formData.append("offline_diet_count", String(payload.offlineDietCount));
      formData.append("duration_days", String(payload.durationDays));
      formData.append("price_amount", String(payload.priceAmount));
      formData.append("discounted_price_amount", payload.discountedPriceAmount == null ? "" : String(payload.discountedPriceAmount));
      formData.append("cafebazaar_product_id", payload.cafebazaarProductId ?? "");
      formData.append("badge_title", payload.badgeTitle ?? "");
      formData.append("is_recommended", payload.isRecommended ? "1" : "0");
      formData.append("visual_style", payload.visualStyle ?? "normal");
      formData.append("action_label", payload.actionLabel ?? "");
      formData.append("first_diet_template_mode", payload.firstDietTemplateMode ?? "default");
      formData.append("first_diet_template_id", payload.firstDietTemplateId ?? "");
      Object.entries(payload.firstDietTemplateIds ?? {}).forEach(([goal, templateId]) => {
        formData.append(`first_diet_template_ids[${goal}]`, templateId ?? "");
      });
      formData.append("sort_order", String(payload.sortOrder ?? 0));
      formData.append("is_active", payload.isActive === false ? "0" : "1");
      if (payload.image) {
        formData.append("image", payload.image);
      }
      return requestFormData<NutritionPackageItem>("/api/v1/nutrition/packages", "POST", formData);
    },

    update: async (id: string, payload: {
      name: string;
      shortTitle?: string | null;
      subtitle?: string | null;
      slug?: string;
      description?: string | null;
      features?: Array<{ icon: string; text: string }>;
      image?: File | null;
      removeImage?: boolean;
      parentId?: string | null;
      applicableGoals: string[];
      onlineDietCount: number;
      offlineDietCount: number;
      durationDays: number;
      priceAmount: number;
      discountedPriceAmount?: number | null;
      cafebazaarProductId?: string | null;
      badgeTitle?: string | null;
      isRecommended?: boolean;
      visualStyle?: string;
      actionLabel?: string | null;
      firstDietTemplateMode?: string;
      firstDietTemplateId?: string | null;
      firstDietTemplateIds?: Record<string, string | null>;
      sortOrder?: number;
      isActive: boolean;
    }): Promise<ApiResponse<NutritionPackageItem>> => {
      const formData = new FormData();
      formData.append("name", payload.name);
      formData.append("short_title", payload.shortTitle ?? "");
      formData.append("subtitle", payload.subtitle ?? "");
      formData.append("slug", payload.slug || "");
      formData.append("description", payload.description ?? "");
      (payload.features ?? []).forEach((feature, index) => {
        formData.append(`features[${index}][icon]`, feature.icon);
        formData.append(`features[${index}][text]`, feature.text);
      });
      formData.append("parent_id", payload.parentId || "");
      payload.applicableGoals.forEach((goal) => formData.append("applicable_goals[]", goal));
      formData.append("online_diet_count", String(payload.onlineDietCount));
      formData.append("offline_diet_count", String(payload.offlineDietCount));
      formData.append("duration_days", String(payload.durationDays));
      formData.append("price_amount", String(payload.priceAmount));
      formData.append("discounted_price_amount", payload.discountedPriceAmount == null ? "" : String(payload.discountedPriceAmount));
      formData.append("cafebazaar_product_id", payload.cafebazaarProductId ?? "");
      formData.append("badge_title", payload.badgeTitle ?? "");
      formData.append("is_recommended", payload.isRecommended ? "1" : "0");
      formData.append("visual_style", payload.visualStyle ?? "normal");
      formData.append("action_label", payload.actionLabel ?? "");
      formData.append("first_diet_template_mode", payload.firstDietTemplateMode ?? "default");
      formData.append("first_diet_template_id", payload.firstDietTemplateId ?? "");
      Object.entries(payload.firstDietTemplateIds ?? {}).forEach(([goal, templateId]) => {
        formData.append(`first_diet_template_ids[${goal}]`, templateId ?? "");
      });
      formData.append("sort_order", String(payload.sortOrder ?? 0));
      formData.append("is_active", payload.isActive ? "1" : "0");
      formData.append("remove_image", payload.removeImage ? "1" : "0");
      formData.append("_method", "PUT");
      if (payload.image) {
        formData.append("image", payload.image);
      }
      return requestFormData<NutritionPackageItem>(`/api/v1/nutrition/packages/${encodeURIComponent(id)}`, "POST", formData);
    },

    delete: async (id: string): Promise<ApiResponse<{}>> => {
      return requestJson<{}>(`/api/v1/nutrition/packages/${encodeURIComponent(id)}`, "DELETE");
    },
  },

  nutritionDiscountCodes: {
    list: async (): Promise<ApiResponse<{ items: NutritionDiscountCodeItem[] }>> => {
      return getJson<{ items: NutritionDiscountCodeItem[] }>("/api/v1/nutrition/discount-codes");
    },

    create: async (payload: {
      code: string;
      title?: string;
      discountType: "percent" | "fixed";
      discountValue: number;
      maxUses?: number | null;
      isActive?: boolean;
    }): Promise<ApiResponse<{ item: NutritionDiscountCodeItem }>> => {
      return postJson<{ item: NutritionDiscountCodeItem }>("/api/v1/nutrition/discount-codes", {
        code: payload.code,
        title: payload.title,
        discount_type: payload.discountType,
        discount_value: payload.discountValue,
        max_uses: payload.maxUses,
        is_active: payload.isActive ?? true,
      });
    },

    update: async (id: string, payload: {
      code: string;
      title?: string;
      discountType: "percent" | "fixed";
      discountValue: number;
      maxUses?: number | null;
      isActive: boolean;
    }): Promise<ApiResponse<{ item: NutritionDiscountCodeItem }>> => {
      return requestJson<{ item: NutritionDiscountCodeItem }>(`/api/v1/nutrition/discount-codes/${encodeURIComponent(id)}`, "PUT", {
        code: payload.code,
        title: payload.title,
        discount_type: payload.discountType,
        discount_value: payload.discountValue,
        max_uses: payload.maxUses,
        is_active: payload.isActive,
      });
    },

    delete: async (id: string): Promise<ApiResponse<{}>> => {
      return requestJson<{}>(`/api/v1/nutrition/discount-codes/${encodeURIComponent(id)}`, "DELETE");
    },
  },

  nutritionPackageCheckout: {
    preview: async (nutritionPackageId: string, discountCode?: string): Promise<ApiResponse<NutritionPackageCheckoutPreview>> => {
      return postJson<NutritionPackageCheckoutPreview>("/api/v1/nutrition/package-checkout/preview", {
        nutrition_package_id: nutritionPackageId,
        discount_code: discountCode || undefined,
      });
    },

    pay: async (
      nutritionPackageId: string,
      gateway?: string,
      discountCode?: string,
      replaceActiveSubscription?: boolean,
    ): Promise<ApiResponse<{ mode: "free" | "sandbox" | "gateway"; order: NutritionPackageOrder; subscription?: NutritionPackageCheckoutSummaryPayload["subscription"]; redirectForm?: { action: string; method: string; inputs: Record<string, string> }; paymentUrl?: string | null }>> => {
      return postJson<{ mode: "free" | "sandbox" | "gateway"; order: NutritionPackageOrder; subscription?: NutritionPackageCheckoutSummaryPayload["subscription"]; redirectForm?: { action: string; method: string; inputs: Record<string, string> }; paymentUrl?: string | null }>("/api/v1/nutrition/package-checkout/pay", {
        nutrition_package_id: nutritionPackageId,
        gateway: gateway || undefined,
        discount_code: discountCode || undefined,
        replace_active_subscription: replaceActiveSubscription || undefined,
      });
    },

    summary: async (): Promise<ApiResponse<NutritionPackageCheckoutSummaryPayload>> => {
      return getJson<NutritionPackageCheckoutSummaryPayload>("/api/v1/nutrition/package-checkout/summary");
    },

    adminOrders: async (filters?: { q?: string; user?: string; mobile?: string; dateFrom?: string; dateTo?: string; page?: number; perPage?: number }): Promise<ApiResponse<{ items: NutritionPackageOrder[]; page: number; perPage: number; total: number; lastPage: number }>> => {
      const params = new URLSearchParams();
      if (filters?.q) params.set("q", filters.q);
      if (filters?.user) params.set("user", filters.user);
      if (filters?.mobile) params.set("mobile", filters.mobile);
      if (filters?.dateFrom) params.set("date_from", filters.dateFrom);
      if (filters?.dateTo) params.set("date_to", filters.dateTo);
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.perPage) params.set("per_page", String(filters.perPage));
      const query = params.toString();
      return getJson<{ items: NutritionPackageOrder[]; page: number; perPage: number; total: number; lastPage: number }>(`/api/v1/nutrition/package-orders${query ? `?${query}` : ""}`);
    },
  },

  nutritionDietRequests: {
    options: async (): Promise<ApiResponse<{
      flowType: "first_diet" | "follow_up";
      hasDietHistory: boolean;
      requiresFollowUpQuestions: boolean;
      autoFirstDiet: {
        enabled: boolean;
        requiresApproval: boolean;
        templateAvailable: boolean;
      };
      nextStep: string | null;
      modes: Array<{
        key: "ai" | "expert";
        included: boolean;
        total: number;
        used: number;
        remaining: number;
        available: boolean;
        nextStep: string;
      }>;
    }>> => {
      return getJson<{
        flowType: "first_diet" | "follow_up";
        hasDietHistory: boolean;
        requiresFollowUpQuestions: boolean;
        autoFirstDiet: {
          enabled: boolean;
          requiresApproval: boolean;
          templateAvailable: boolean;
        };
        nextStep: string | null;
        modes: Array<{
          key: "ai" | "expert";
          included: boolean;
          total: number;
          used: number;
          remaining: number;
          available: boolean;
          nextStep: string;
        }>;
      }>("/api/v1/nutrition/diet-requests/options");
    },

    create: async (payload: {
      nutritionDietTemplateId?: string;
      requestType: "ai" | "expert";
      expertDescription?: string;
      currentWeightKg?: string;
      repeatDietFeedback?: Record<string, string>;
      repeatDietMedicalNotes?: string;
      repeatDietMedicalConditionsItems?: Array<{ id?: string; title: string; status?: string; startedAt?: string | null; endedAt?: string | null; ongoing?: boolean; notes?: string | null }>;
    }): Promise<ApiResponse<{ request: NutritionDietRequest; subscription: { onlineDietUsed: number; offlineDietUsed: number; onlineDietRemaining: number; offlineDietRemaining: number } }>> => {
      return postJson<{ request: NutritionDietRequest; subscription: { onlineDietUsed: number; offlineDietUsed: number; onlineDietRemaining: number; offlineDietRemaining: number } }>("/api/v1/nutrition/diet-requests", {
        nutrition_diet_template_id: payload.nutritionDietTemplateId || undefined,
        request_type: payload.requestType,
        expert_description: payload.expertDescription || undefined,
        current_weight_kg: payload.currentWeightKg || undefined,
        repeat_diet_feedback: payload.repeatDietFeedback || undefined,
        repeat_diet_medical_notes: payload.repeatDietMedicalNotes || undefined,
        repeat_diet_medical_conditions_items: payload.repeatDietMedicalConditionsItems || undefined,
      });
    },

    listMine: async (): Promise<ApiResponse<{ items: NutritionDietRequest[]; page: number; perPage: number; total: number; lastPage: number }>> => {
      return getJson<{ items: NutritionDietRequest[]; page: number; perPage: number; total: number; lastPage: number }>("/api/v1/nutrition/diet-requests");
    },

    adminList: async (q?: string, page = 1, perPage = 20, quickFilter?: "all" | "ai" | "expert" | "queued_ai" | "processing_ai" | "generated_ai" | "not_generated" | "pending_approval" | "expert_manual_delivery" | "failed_ai"): Promise<ApiResponse<{ stats: NutritionDietRequestAdminStats; filters: { q: string; quickFilter: string }; items: NutritionDietRequest[]; page: number; perPage: number; total: number; lastPage: number }>> => {
      const params = new URLSearchParams();
      if (q?.trim()) {
        params.set("q", q.trim());
      }
      if (quickFilter && quickFilter !== "all") {
        params.set("quick_filter", quickFilter);
      }
      if (page > 1) {
        params.set("page", String(page));
      }
      if (perPage > 0) {
        params.set("per_page", String(perPage));
      }

      return getJson<{ stats: NutritionDietRequestAdminStats; filters: { q: string; quickFilter: string }; items: NutritionDietRequest[]; page: number; perPage: number; total: number; lastPage: number }>(`/api/v1/nutrition/diet-requests/admin${params.toString() ? `?${params.toString()}` : ""}`);
    },

    adminSettings: async (): Promise<ApiResponse<NutritionDietRequestAdminSettings>> => {
      return getJson<NutritionDietRequestAdminSettings>("/api/v1/nutrition/diet-requests/admin/settings");
    },

    updateAdminSettings: async (payload: NutritionDietRequestAdminSettings): Promise<ApiResponse<NutritionDietRequestAdminSettings>> => {
      return requestJson<NutritionDietRequestAdminSettings>("/api/v1/nutrition/diet-requests/admin/settings", "PUT", {
        manualAiApprovalRequired: payload.manualAiApprovalRequired,
      });
    },

    adminShow: async (dietRequestId: string): Promise<ApiResponse<{ item: NutritionDietRequest }>> => {
      return getJson<{ item: NutritionDietRequest }>(`/api/v1/nutrition/diet-requests/admin/${encodeURIComponent(dietRequestId)}`);
    },

    adminUpdateAiUsageLimits: async (dietRequestId: string, payload: {
      mealPhotoAnalysisDietLimit?: number | null;
      mealPhotoAnalysisHourlyLimit?: number | null;
      manualMealNutritionDietLimit?: number | null;
      manualMealNutritionHourlyLimit?: number | null;
      mealReplacementDietLimit?: number | null;
      mealReplacementHourlyLimit?: number | null;
    }): Promise<ApiResponse<{ item: NutritionDietRequest }>> => {
      return requestJson<{ item: NutritionDietRequest }>(`/api/v1/nutrition/diet-requests/admin/${encodeURIComponent(dietRequestId)}/ai-usage-limits`, "PUT", {
        mealPhotoAnalysisDietLimit: payload.mealPhotoAnalysisDietLimit ?? null,
        mealPhotoAnalysisHourlyLimit: payload.mealPhotoAnalysisHourlyLimit ?? null,
        manualMealNutritionDietLimit: payload.manualMealNutritionDietLimit ?? null,
        manualMealNutritionHourlyLimit: payload.manualMealNutritionHourlyLimit ?? null,
        mealReplacementDietLimit: payload.mealReplacementDietLimit ?? null,
        mealReplacementHourlyLimit: payload.mealReplacementHourlyLimit ?? null,
      });
    },

    adminDelete: async (dietRequestId: string, payload?: { refundBalance?: boolean }): Promise<ApiResponse<{ refunded: boolean; requestType: string; userId: number }>> => {
      return requestJson<{ refunded: boolean; requestType: string; userId: number }>(`/api/v1/nutrition/diet-requests/admin/${encodeURIComponent(dietRequestId)}`, "DELETE", {
        refund_balance: payload?.refundBalance ?? false,
      });
    },

    generateAi: async (dietRequestId: string, payload: {
      expertNotes?: string;
      clinicalNotes?: string;
      generationInstructions?: string;
      mustInclude?: string;
      mustAvoid?: string;
    }): Promise<ApiResponse<{ requestId: string; aiGenerationStatus: string }>> => {
      return postJson<{ requestId: string; aiGenerationStatus: string }>(`/api/v1/nutrition/diet-requests/${encodeURIComponent(dietRequestId)}/generate-ai`, payload);
    },

    cancelAi: async (dietRequestId: string): Promise<ApiResponse<{ requestId: string; aiGenerationStatus: string }>> => {
      return postJson<{ requestId: string; aiGenerationStatus: string }>(`/api/v1/nutrition/diet-requests/${encodeURIComponent(dietRequestId)}/cancel-ai`);
    },

    adminManualEdit: async (dietRequestId: string, payload: {
      prescriptionId: number;
      sectionType: "user_choice_option" | "daily_meal" | "daily_replacement" | "fixed_text_section" | "viewer_message";
      slotKey?: string;
      optionIndex?: number;
      dayNumber?: number;
      mealIndex?: number;
      replacementIndex?: number;
      sectionIndex?: number;
      title?: string;
      description?: string;
      quantityText?: string;
      grams?: string;
      calories?: string;
      proteinGrams?: string;
      fatGrams?: string;
      carbohydrateGrams?: string;
      fiberGrams?: string;
      mealText?: string;
      body?: string;
    }): Promise<ApiResponse<{ item: NutritionDietRequest }>> => {
      return postJson<{ item: NutritionDietRequest }>(`/api/v1/nutrition/diet-requests/admin/${encodeURIComponent(dietRequestId)}/manual-edit`, {
        prescription_id: payload.prescriptionId,
        section_type: payload.sectionType,
        slot_key: payload.slotKey,
        option_index: payload.optionIndex,
        day_number: payload.dayNumber,
        meal_index: payload.mealIndex,
        replacement_index: payload.replacementIndex,
        section_index: payload.sectionIndex,
        title: payload.title,
        description: payload.description,
        quantity_text: payload.quantityText,
        grams: payload.grams,
        calories: payload.calories,
        protein_grams: payload.proteinGrams,
        fat_grams: payload.fatGrams,
        carbohydrate_grams: payload.carbohydrateGrams,
        fiber_grams: payload.fiberGrams,
        meal_text: payload.mealText,
        body: payload.body,
      });
    },

    adminUpdatePrescriptionDates: async (dietRequestId: string, prescriptionId: string, payload: {
      startedAt: string;
      endsAt: string;
    }): Promise<ApiResponse<{ item: NutritionDietRequest }>> => {
      return requestJson<{ item: NutritionDietRequest }>(`/api/v1/nutrition/diet-requests/admin/${encodeURIComponent(dietRequestId)}/prescriptions/${encodeURIComponent(prescriptionId)}/dates`, "PUT", {
        started_at: payload.startedAt,
        ends_at: payload.endsAt,
      });
    },

    adminSendExpertFile: async (dietRequestId: string, payload: FormData): Promise<ApiResponse<{ item: NutritionDietRequest }>> => {
      return requestFormData<{ item: NutritionDietRequest }>(`/api/v1/nutrition/diet-requests/admin/${encodeURIComponent(dietRequestId)}/send-expert-file`, "POST", payload);
    },

    adminDeleteExpertFile: async (dietRequestId: string): Promise<ApiResponse<{ item: NutritionDietRequest }>> => {
      return requestJson<{ item: NutritionDietRequest }>(`/api/v1/nutrition/diet-requests/admin/${encodeURIComponent(dietRequestId)}/expert-file`, "DELETE");
    },

    approveDelivery: async (dietRequestId: string): Promise<ApiResponse<{ item: NutritionDietRequest }>> => {
      return postJson<{ item: NutritionDietRequest }>(`/api/v1/nutrition/diet-requests/admin/${encodeURIComponent(dietRequestId)}/approve-delivery`, {
        confirm: true,
      });
    },

    adminGenerateMealReplacementSuggestion: async (dietRequestId: string, payload: {
      prescriptionId: number;
      sourceType: "meal_slot" | "daily_meal";
      mealSlotKey: string;
      slotTitle?: string;
      dayNumber?: number;
      mealIndex?: number;
      promptMode: "tenant" | "default" | "custom";
      customPrompt?: string;
    }): Promise<ApiResponse<{ item: NutritionDietRequest }>> => {
      return postJson<{ item: NutritionDietRequest }>(`/api/v1/nutrition/diet-requests/admin/${encodeURIComponent(dietRequestId)}/meal-replacement-suggestions`, {
        prescription_id: payload.prescriptionId,
        source_type: payload.sourceType,
        meal_slot_key: payload.mealSlotKey,
        slot_title: payload.slotTitle,
        day_number: payload.dayNumber,
        meal_index: payload.mealIndex,
        prompt_mode: payload.promptMode,
        custom_prompt: payload.customPrompt,
      });
    },

    adminRegenerateMealReplacementSuggestion: async (dietRequestId: string, suggestionId: string, payload: {
      promptMode: "tenant" | "default" | "custom";
      customPrompt?: string;
    }): Promise<ApiResponse<{ item: NutritionDietRequest }>> => {
      return postJson<{ item: NutritionDietRequest }>(`/api/v1/nutrition/diet-requests/admin/${encodeURIComponent(dietRequestId)}/meal-replacement-suggestions/${encodeURIComponent(suggestionId)}/regenerate`, {
        prompt_mode: payload.promptMode,
        custom_prompt: payload.customPrompt,
      });
    },

    adminCancelMealReplacementSuggestion: async (dietRequestId: string, suggestionId: string): Promise<ApiResponse<{ item: NutritionDietRequest }>> => {
      return postJson<{ item: NutritionDietRequest }>(`/api/v1/nutrition/diet-requests/admin/${encodeURIComponent(dietRequestId)}/meal-replacement-suggestions/${encodeURIComponent(suggestionId)}/cancel`, {});
    },

    adminDeleteMealReplacementSuggestion: async (dietRequestId: string, suggestionId: string): Promise<ApiResponse<{ item: NutritionDietRequest }>> => {
      return requestJson<{ item: NutritionDietRequest }>(`/api/v1/nutrition/diet-requests/admin/${encodeURIComponent(dietRequestId)}/meal-replacement-suggestions/${encodeURIComponent(suggestionId)}`, "DELETE");
    },

    adminUpdateMealReplacementSuggestionOption: async (dietRequestId: string, suggestionId: string, payload: {
      optionId: string;
      title: string;
      description?: string;
      preparationText?: string;
      quantityText?: string;
      grams?: number;
      calories?: number;
      matchReason?: string;
    }): Promise<ApiResponse<{ item: NutritionDietRequest }>> => {
      return requestJson<{ item: NutritionDietRequest }>(`/api/v1/nutrition/diet-requests/admin/${encodeURIComponent(dietRequestId)}/meal-replacement-suggestions/${encodeURIComponent(suggestionId)}/options`, "PUT", {
        option_id: payload.optionId,
        title: payload.title,
        description: payload.description,
        preparation_text: payload.preparationText,
        quantity_text: payload.quantityText,
        grams: payload.grams,
        calories: payload.calories,
        match_reason: payload.matchReason,
      });
    },
  },

  nutritionSettings: {
    get: async (): Promise<ApiResponse<NutritionSettingsPayload>> => {
      return getJson<NutritionSettingsPayload>("/api/v1/nutrition/settings");
    },

    update: async (payload: {
      manualAiApprovalRequired: boolean;
      holdIncompletePrescriptionsForReview: boolean;
      exerciseLoggingEnabled: boolean;
      outOfPlanMealLoggingEnabled: boolean;
      mealPhotoAnalysisEnabled: boolean;
      mealPhotoAnalysisHourlyLimit?: number | null;
      mealPhotoAnalysisDietLimit?: number | null;
      manualMealNutritionHourlyLimit?: number | null;
      manualMealNutritionDietLimit?: number | null;
      mealReplacementHourlyLimit?: number | null;
      mealReplacementDietLimit?: number | null;
      autoFirstDietEnabled: boolean;
      autoFirstDietTemplateId?: number | string | null;
      autoFirstDietTemplateIds?: Record<string, number | string | null>;
      autoFirstDietRequiresApproval: boolean;
      dietGenerationPrompt?: string;
      promptSettings: {
        general?: string;
        user_choice?: string;
        daily_prescription?: string;
        fixed_text?: string;
        meal_replacement?: string;
        manual_meal_nutrition?: string;
        meal_photo_analysis?: string;
        diet_explanations?: string;
      };
    }): Promise<ApiResponse<NutritionSettingsPayload>> => {
      return requestJson<NutritionSettingsPayload>("/api/v1/nutrition/settings", "PUT", payload);
    },
  },

  nutritionAdminUsers: {
    list: async (page = 1, search = ""): Promise<ApiResponse<{ items: Array<{ id: string; fullName: string; mobile: string; email?: string | null; registeredAt?: string | null; activePackage?: { name: string; endsAt?: string | null } | null; currentDiet?: { summary: string; endsAt?: string | null } | null; weightChangeKg?: number | null }>; currentPage: number; lastPage: number; total: number }>> => {
      const params = new URLSearchParams({ page: String(page), search: normalizeDigits(search).trim() });
      return getJson(`/api/v1/nutrition/admin-users?${params.toString()}`);
    },
    updateUser: async (mobile: string, payload: { fullName: string; email?: string | null }): Promise<ApiResponse<{}>> => requestJson(`/api/v1/nutrition/admin-users/${encodeURIComponent(normalizeDigits(mobile))}`, "PUT", { full_name: payload.fullName, email: payload.email }),

    savePrescribeProfile: async (payload: {
      fullName: string;
      mobile: string;
      dietGoal: "lose-weight" | "gain-weight" | "maintain-weight";
      gender: "male" | "female";
      athleteMode: "athlete" | "non-athlete";
      activityLevel: "very-low" | "medium" | "high" | "intense";
      birthDate: string;
      heightCm: number;
      weightKg: string;
      targetWeightKg: string;
      weeklyWeightChangeKg?: number;
      medicalConditions?: string;
      medicalConditionsItems?: import("./types").NutritionMedicalConditionItem[];
      medicationsAndSupplements?: string;
      foodAllergies?: string;
      dislikedFoods?: string;
      mindsetAnswers: Record<string, string>;
    }): Promise<ApiResponse<{
      user: { id: string; fullName: string; mobile: string };
      profile: NutritionProfile;
    }>> => {
      return postJson(`/api/v1/nutrition/admin-prescribe/profile`, {
        full_name: payload.fullName,
        mobile: payload.mobile,
        diet_goal: payload.dietGoal,
        gender: payload.gender,
        athlete_mode: payload.athleteMode,
        activity_level: payload.activityLevel,
        birth_date: payload.birthDate,
        height_cm: payload.heightCm,
        weight_kg: payload.weightKg,
        target_weight_kg: payload.targetWeightKg,
        weekly_weight_change_kg: payload.weeklyWeightChangeKg,
        medical_conditions: payload.medicalConditions,
        medical_conditions_items: payload.medicalConditionsItems,
        medications_and_supplements: payload.medicationsAndSupplements,
        food_allergies: payload.foodAllergies,
        disliked_foods: payload.dislikedFoods,
        mindset_answers: payload.mindsetAnswers,
      });
    },

    show: async (mobile: string): Promise<ApiResponse<NutritionAdminUserProfilePayload>> => {
      return getJson<NutritionAdminUserProfilePayload>(`/api/v1/nutrition/admin-users/${encodeURIComponent(normalizeDigits(mobile).trim())}`);
    },

    grantPackage: async (mobile: string, nutritionPackageId: string): Promise<ApiResponse<{}>> => {
      return postJson<{}>(`/api/v1/nutrition/admin-users/${encodeURIComponent(normalizeDigits(mobile).trim())}/grant-package`, {
        nutrition_package_id: nutritionPackageId,
      });
    },

    updateSubscriptionDates: async (mobile: string, subscriptionId: string, payload: {
      startsAt: string;
      endsAt: string;
    }): Promise<ApiResponse<{ subscription: NonNullable<NutritionAdminUserProfilePayload["subscription"]> }>> => {
      return requestJson<{ subscription: NonNullable<NutritionAdminUserProfilePayload["subscription"]> }>(`/api/v1/nutrition/admin-users/${encodeURIComponent(normalizeDigits(mobile).trim())}/subscriptions/${encodeURIComponent(subscriptionId)}/dates`, "PUT", {
        starts_at: payload.startsAt,
        ends_at: payload.endsAt,
      });
    },

    adjustSubscriptionCredits: async (mobile: string, subscriptionId: string, payload: {
      onlineDietDelta: number;
      offlineDietDelta: number;
      notes?: string;
    }): Promise<ApiResponse<{ subscription: NonNullable<NutritionAdminUserProfilePayload["subscription"]> }>> => {
      return postJson<{ subscription: NonNullable<NutritionAdminUserProfilePayload["subscription"]> }>(`/api/v1/nutrition/admin-users/${encodeURIComponent(normalizeDigits(mobile).trim())}/subscriptions/${encodeURIComponent(subscriptionId)}/credits`, {
        online_diet_delta: payload.onlineDietDelta,
        offline_diet_delta: payload.offlineDietDelta,
        notes: payload.notes || undefined,
      });
    },

    updateAccess: async (mobile: string, canBook: boolean): Promise<ApiResponse<{ canBook: boolean }>> => {
      return postJson<{ canBook: boolean }>(`/api/v1/nutrition/admin-users/${encodeURIComponent(normalizeDigits(mobile).trim())}/access`, {
        can_book: canBook,
      });
    },

    createDietRequest: async (payload: {
      mobile: string;
      nutritionDietTemplateId?: string;
      requestType: "ai" | "expert";
      expertNotes?: string;
      clinicalNotes?: string;
      generationInstructions?: string;
      mustInclude?: string;
      mustAvoid?: string;
    }): Promise<ApiResponse<{ requestId: string; userId: string }>> => {
      return postJson(`/api/v1/nutrition/admin-prescribe/request`, {
        mobile: payload.mobile,
        nutrition_diet_template_id: payload.nutritionDietTemplateId || undefined,
        request_type: payload.requestType,
        expert_notes: payload.expertNotes,
        clinical_notes: payload.clinicalNotes,
        generation_instructions: payload.generationInstructions,
        must_include: payload.mustInclude,
        must_avoid: payload.mustAvoid,
      });
    },
  },

  nutritionPrescriptions: {
    list: async (): Promise<ApiResponse<{ items: NutritionDietPrescription[] }>> => {
      return getJson<{ items: NutritionDietPrescription[] }>("/api/v1/nutrition/prescriptions");
    },

    current: async (): Promise<ApiResponse<{ prescription: NutritionDietPrescription | null }>> => {
      return getJson<{ prescription: NutritionDietPrescription | null }>("/api/v1/nutrition/prescriptions/current");
    },

    show: async (prescriptionId: string): Promise<ApiResponse<{ prescription: NutritionDietPrescription | null }>> => {
      return getJson<{ prescription: NutritionDietPrescription | null }>(`/api/v1/nutrition/prescriptions/${encodeURIComponent(prescriptionId)}`);
    },

    logMeal: async (payload: {
      consumedDate: string;
      mealSlotKey: string;
      slotTitle?: string;
      foodTitle: string;
      foodDescription?: string;
      quantityText?: string;
      optionCalories?: number | null;
      proteinGrams?: number | null;
      fatGrams?: number | null;
      carbohydrateGrams?: number | null;
      fiberGrams?: number | null;
      notes?: string;
    }): Promise<ApiResponse<{ prescription: NutritionDietPrescription | null }>> => {
      return postJson<{ prescription: NutritionDietPrescription | null }>("/api/v1/nutrition/prescriptions/current/meal-log", {
        consumed_date: payload.consumedDate,
        meal_slot_key: payload.mealSlotKey,
        slot_title: payload.slotTitle,
        food_title: payload.foodTitle,
        food_description: payload.foodDescription,
        quantity_text: payload.quantityText,
        option_calories: payload.optionCalories,
        protein_grams: payload.proteinGrams,
        fat_grams: payload.fatGrams,
        carbohydrate_grams: payload.carbohydrateGrams,
        fiber_grams: payload.fiberGrams,
        notes: payload.notes,
      });
    },

    deleteMeal: async (mealLogId: string): Promise<ApiResponse<{ prescription: NutritionDietPrescription | null }>> => {
      return requestJson<{ prescription: NutritionDietPrescription | null }>(`/api/v1/nutrition/prescriptions/current/meal-log/${encodeURIComponent(mealLogId)}`, "DELETE");
    },

    generateMealReplacementSuggestions: async (payload: {
      sourceType: "meal_slot" | "daily_meal";
      mealSlotKey: string;
      slotTitle?: string;
      dayNumber?: number;
      mealIndex?: number;
    }): Promise<ApiResponse<{ prescription: NutritionDietPrescription | null; suggestion: NonNullable<NutritionDietPrescription["mealReplacementSuggestions"]>[number] | null }>> => {
      return postJson<{ prescription: NutritionDietPrescription | null; suggestion: NonNullable<NutritionDietPrescription["mealReplacementSuggestions"]>[number] | null }>("/api/v1/nutrition/prescriptions/current/meal-replacement-suggestions", {
        source_type: payload.sourceType,
        meal_slot_key: payload.mealSlotKey,
        slot_title: payload.slotTitle,
        day_number: payload.dayNumber,
        meal_index: payload.mealIndex,
      });
    },

    cancelMealReplacementSuggestions: async (suggestionId: string): Promise<ApiResponse<{ prescription: NutritionDietPrescription | null; suggestion: NonNullable<NutritionDietPrescription["mealReplacementSuggestions"]>[number] | null }>> => {
      return postJson<{ prescription: NutritionDietPrescription | null; suggestion: NonNullable<NutritionDietPrescription["mealReplacementSuggestions"]>[number] | null }>(`/api/v1/nutrition/prescriptions/current/meal-replacement-suggestions/${encodeURIComponent(suggestionId)}/cancel`, {});
    },

    logOtherMeal: async (payload: {
      consumedDate: string;
      mealSlotKey: string;
      slotTitle?: string;
      foodTitle: string;
      foodDescription?: string;
      quantityText?: string;
      optionCalories?: number | null;
      proteinGrams?: number | null;
      fatGrams?: number | null;
      carbohydrateGrams?: number | null;
      fiberGrams?: number | null;
      notes?: string;
      manualEntryMethod?: "manual" | "photo";
      image?: File | null;
    }): Promise<ApiResponse<{ prescription: NutritionDietPrescription | null }>> => {
      const formData = new FormData();
      formData.append("consumed_date", payload.consumedDate);
      formData.append("meal_slot_key", payload.mealSlotKey);
      if (payload.slotTitle) {
        formData.append("slot_title", payload.slotTitle);
      }
      formData.append("food_title", payload.foodTitle);
      if (payload.foodDescription) {
        formData.append("food_description", payload.foodDescription);
      }
      if (payload.quantityText) {
        formData.append("quantity_text", payload.quantityText);
      }
      if (payload.optionCalories !== undefined && payload.optionCalories !== null) {
        formData.append("option_calories", String(payload.optionCalories));
      }
      if (payload.proteinGrams !== undefined && payload.proteinGrams !== null) {
        formData.append("protein_grams", String(payload.proteinGrams));
      }
      if (payload.fatGrams !== undefined && payload.fatGrams !== null) {
        formData.append("fat_grams", String(payload.fatGrams));
      }
      if (payload.carbohydrateGrams !== undefined && payload.carbohydrateGrams !== null) {
        formData.append("carbohydrate_grams", String(payload.carbohydrateGrams));
      }
      if (payload.fiberGrams !== undefined && payload.fiberGrams !== null) {
        formData.append("fiber_grams", String(payload.fiberGrams));
      }
      if (payload.notes) {
        formData.append("notes", payload.notes);
      }
      if (payload.manualEntryMethod) {
        formData.append("manual_entry_method", payload.manualEntryMethod);
      }
      if (payload.image) {
        const compressedImage = await compressImageFile(payload.image, AI_IMAGE_COMPRESSION_OPTIONS);
        formData.append("image", compressedImage, compressedImage.name);
      }

      return requestFormData<{ prescription: NutritionDietPrescription | null }>("/api/v1/nutrition/prescriptions/current/other-meal-log", "POST", formData);
    },

    analyzeOtherMealPhoto: async (payload: {
      consumedDate: string;
      mealSlotKey: string;
      slotTitle?: string;
      foodTitle?: string;
      userNote?: string;
      image: File;
    }): Promise<ApiResponse<{ analysis: NutritionMealPhotoAnalysis | null }>> => {
      const compressedImage = await compressImageFile(payload.image, AI_IMAGE_COMPRESSION_OPTIONS);
      const formData = new FormData();
      formData.append("consumed_date", payload.consumedDate);
      formData.append("meal_slot_key", payload.mealSlotKey);
      if (payload.slotTitle) {
        formData.append("slot_title", payload.slotTitle);
      }
      if (payload.foodTitle?.trim()) {
        formData.append("user_food_title", payload.foodTitle.trim());
      }
      if (payload.userNote?.trim()) {
        const userNote = payload.userNote.trim();
        const priorityInstruction = [
          "USER_NOTE_HIGH_PRIORITY:",
          userNote,
          "Instruction: Treat the user's note as high-priority context. If the image appears to conflict with this note, prefer the user's note when identifying the food, ingredients, cooking method, oil/fat amount, portion, and calorie estimate. Explain the recommendation based on both the image and the user's note.",
        ].join("\n");

        formData.append("user_note", userNote);
        formData.append("notes", userNote);
        formData.append("user_description", userNote);
        formData.append("description", userNote);
        formData.append("additional_context", userNote);
        formData.append("analysis_instruction", priorityInstruction);
      }
      formData.append("image", compressedImage, compressedImage.name);

      return requestFormData<{ analysis: NutritionMealPhotoAnalysis | null }>("/api/v1/nutrition/prescriptions/current/other-meal-photo-analysis", "POST", formData);
    },

    deleteOtherMeal: async (mealLogId: string): Promise<ApiResponse<{ prescription: NutritionDietPrescription | null }>> => {
      return requestJson<{ prescription: NutritionDietPrescription | null }>(`/api/v1/nutrition/prescriptions/current/other-meal-log/${encodeURIComponent(mealLogId)}`, "DELETE");
    },

    logWater: async (payload: {
      consumedDate: string;
      glasses: number;
      amountMl?: number;
    }): Promise<ApiResponse<{ prescription: NutritionDietPrescription | null }>> => {
      return postJson<{ prescription: NutritionDietPrescription | null }>("/api/v1/nutrition/prescriptions/current/water-log", {
        consumed_date: payload.consumedDate,
        glasses: payload.glasses,
        amount_ml: payload.amountMl,
      });
    },

    logExercise: async (payload: {
      consumedDate: string;
      exerciseRef: string;
      durationMinutes: number;
      intensity: "light" | "moderate" | "vigorous";
      distanceKm?: number | null;
      speedKmh?: number | null;
      weightKg: number;
      notes?: string;
    }): Promise<ApiResponse<{ prescription: NutritionDietPrescription | null }>> => {
      return postJson<{ prescription: NutritionDietPrescription | null }>("/api/v1/nutrition/prescriptions/current/exercise-log", {
        consumed_date: payload.consumedDate,
        exercise_ref: payload.exerciseRef,
        duration_minutes: payload.durationMinutes,
        intensity: payload.intensity,
        distance_km: payload.distanceKm,
        speed_kmh: payload.speedKmh,
        weight_kg: payload.weightKg,
        notes: payload.notes,
      });
    },

    deleteExercise: async (exerciseLogId: string): Promise<ApiResponse<{ prescription: NutritionDietPrescription | null }>> => {
      return requestJson<{ prescription: NutritionDietPrescription | null }>(`/api/v1/nutrition/prescriptions/current/exercise-log/${encodeURIComponent(exerciseLogId)}`, "DELETE");
    },
  },

  nutritionExercises: {
    list: async (): Promise<ApiResponse<{ groups: NutritionExerciseGroup[] }>> => {
      return getJson<{ groups: NutritionExerciseGroup[] }>("/api/v1/nutrition/exercises");
    },

    adminList: async (): Promise<ApiResponse<{ groups: NutritionExerciseGroup[] }>> => {
      return getJson<{ groups: NutritionExerciseGroup[] }>("/api/v1/nutrition/exercise-library");
    },

    createGroup: async (payload: {
      title: string;
      slug: string;
      description?: string;
      iconKey?: string;
      accentColor?: string;
      softColor?: string;
      sortOrder?: number;
      isActive?: boolean;
    }): Promise<ApiResponse<{ group: NutritionExerciseGroup }>> => {
      return postJson<{ group: NutritionExerciseGroup }>("/api/v1/nutrition/exercise-library/groups", {
        title: payload.title,
        slug: payload.slug,
        description: payload.description,
        icon_key: payload.iconKey,
        accent_color: payload.accentColor,
        soft_color: payload.softColor,
        sort_order: payload.sortOrder ?? 0,
        is_active: payload.isActive ?? true,
      });
    },

    updateGroup: async (groupId: string, payload: {
      title: string;
      slug: string;
      description?: string;
      iconKey?: string;
      accentColor?: string;
      softColor?: string;
      sortOrder?: number;
      isActive?: boolean;
    }): Promise<ApiResponse<{ group: NutritionExerciseGroup }>> => {
      return requestJson<{ group: NutritionExerciseGroup }>(`/api/v1/nutrition/exercise-library/groups/${encodeURIComponent(groupId)}`, "PUT", {
        title: payload.title,
        slug: payload.slug,
        description: payload.description,
        icon_key: payload.iconKey,
        accent_color: payload.accentColor,
        soft_color: payload.softColor,
        sort_order: payload.sortOrder ?? 0,
        is_active: payload.isActive ?? true,
      });
    },

    deleteGroup: async (groupId: string): Promise<ApiResponse<boolean>> => {
      return requestJson<boolean>(`/api/v1/nutrition/exercise-library/groups/${encodeURIComponent(groupId)}`, "DELETE");
    },

    createExercise: async (payload: {
      groupId: string;
      title: string;
      slug: string;
      description?: string;
      iconKey?: string;
      badgeText?: string;
      searchTerms?: string;
      supportsIntensity?: boolean;
      supportsDistance?: boolean;
      supportsSpeed?: boolean;
      defaultIntensity?: "light" | "moderate" | "vigorous";
      metLight?: number | null;
      metModerate?: number | null;
      metVigorous?: number | null;
      sortOrder?: number;
      isActive?: boolean;
    }): Promise<ApiResponse<{ exercise: NutritionExerciseItem }>> => {
      return postJson<{ exercise: NutritionExerciseItem }>("/api/v1/nutrition/exercise-library/items", {
        group_ref: payload.groupId,
        title: payload.title,
        slug: payload.slug,
        description: payload.description,
        icon_key: payload.iconKey,
        badge_text: payload.badgeText,
        search_terms: payload.searchTerms,
        supports_intensity: payload.supportsIntensity ?? true,
        supports_distance: payload.supportsDistance ?? false,
        supports_speed: payload.supportsSpeed ?? false,
        default_intensity: payload.defaultIntensity ?? "moderate",
        met_light: payload.metLight,
        met_moderate: payload.metModerate,
        met_vigorous: payload.metVigorous,
        sort_order: payload.sortOrder ?? 0,
        is_active: payload.isActive ?? true,
      });
    },

    updateExercise: async (exerciseId: string, payload: {
      groupId: string;
      title: string;
      slug: string;
      description?: string;
      iconKey?: string;
      badgeText?: string;
      searchTerms?: string;
      supportsIntensity?: boolean;
      supportsDistance?: boolean;
      supportsSpeed?: boolean;
      defaultIntensity?: "light" | "moderate" | "vigorous";
      metLight?: number | null;
      metModerate?: number | null;
      metVigorous?: number | null;
      sortOrder?: number;
      isActive?: boolean;
    }): Promise<ApiResponse<{ exercise: NutritionExerciseItem }>> => {
      return requestJson<{ exercise: NutritionExerciseItem }>(`/api/v1/nutrition/exercise-library/items/${encodeURIComponent(exerciseId)}`, "PUT", {
        group_ref: payload.groupId,
        title: payload.title,
        slug: payload.slug,
        description: payload.description,
        icon_key: payload.iconKey,
        badge_text: payload.badgeText,
        search_terms: payload.searchTerms,
        supports_intensity: payload.supportsIntensity ?? true,
        supports_distance: payload.supportsDistance ?? false,
        supports_speed: payload.supportsSpeed ?? false,
        default_intensity: payload.defaultIntensity ?? "moderate",
        met_light: payload.metLight,
        met_moderate: payload.metModerate,
        met_vigorous: payload.metVigorous,
        sort_order: payload.sortOrder ?? 0,
        is_active: payload.isActive ?? true,
      });
    },

    deleteExercise: async (exerciseId: string): Promise<ApiResponse<boolean>> => {
      return requestJson<boolean>(`/api/v1/nutrition/exercise-library/items/${encodeURIComponent(exerciseId)}`, "DELETE");
    },
  },

  nutritionDietFiles: {
    list: async (q?: string): Promise<ApiResponse<{ filters: { q: string }; groups: NutritionDietFileGroup[]; items: NutritionDietFileItem[] }>> => {
      const params = new URLSearchParams();
      if (q?.trim()) {
        params.set("q", q.trim());
      }

      return getJson<{ filters: { q: string }; groups: NutritionDietFileGroup[]; items: NutritionDietFileItem[] }>(`/api/v1/nutrition/diet-files${params.toString() ? `?${params.toString()}` : ""}`);
    },

    createGroup: async (payload: { name: string; sortOrder?: number; isActive?: boolean }): Promise<ApiResponse<{ group: NutritionDietFileGroup }>> => {
      return postJson<{ group: NutritionDietFileGroup }>("/api/v1/nutrition/diet-files/groups", {
        name: payload.name,
        sort_order: payload.sortOrder ?? 0,
        is_active: payload.isActive ?? true,
      });
    },

    deleteGroup: async (groupId: string): Promise<ApiResponse<boolean>> => {
      return requestJson<boolean>(`/api/v1/nutrition/diet-files/groups/${encodeURIComponent(groupId)}`, "DELETE");
    },

    create: async (payload: FormData): Promise<ApiResponse<{ item: NutritionDietFileItem }>> => {
      return requestFormData<{ item: NutritionDietFileItem }>("/api/v1/nutrition/diet-files", "POST", payload);
    },

    update: async (dietFileId: string, payload: FormData): Promise<ApiResponse<{ item: NutritionDietFileItem }>> => {
      return requestFormData<{ item: NutritionDietFileItem }>(`/api/v1/nutrition/diet-files/${encodeURIComponent(dietFileId)}`, "POST", payload);
    },

    remove: async (dietFileId: string): Promise<ApiResponse<boolean>> => {
      return requestJson<boolean>(`/api/v1/nutrition/diet-files/${encodeURIComponent(dietFileId)}`, "DELETE");
    },
  },

  nutritionAudioGuidance: {
    list: async (): Promise<ApiResponse<{ templates: Array<{ id: string; name: string; label: string }>; items: NutritionAudioGuidanceAsset[] }>> => {
      return getJson<{ templates: Array<{ id: string; name: string; label: string }>; items: NutritionAudioGuidanceAsset[] }>("/api/v1/nutrition/audio-guidance-assets");
    },

    create: async (formData: FormData): Promise<ApiResponse<{ item: NutritionAudioGuidanceAsset }>> => {
      return requestFormData<{ item: NutritionAudioGuidanceAsset }>("/api/v1/nutrition/audio-guidance-assets", "POST", formData);
    },

    update: async (id: string, formData: FormData): Promise<ApiResponse<{ item: NutritionAudioGuidanceAsset }>> => {
      return requestFormData<{ item: NutritionAudioGuidanceAsset }>(`/api/v1/nutrition/audio-guidance-assets/${encodeURIComponent(id)}`, "POST", formData);
    },

    remove: async (id: string): Promise<ApiResponse<true>> => {
      return requestJson<true>(`/api/v1/nutrition/audio-guidance-assets/${encodeURIComponent(id)}`, "DELETE");
    },
  },

  nutritionAiPromptPresets: {
    list: async (): Promise<ApiResponse<{ items: NutritionAiPromptPreset[] }>> => {
      return getJson<{ items: NutritionAiPromptPreset[] }>("/api/v1/nutrition/ai-prompt-presets");
    },

    create: async (payload: {
      title: string;
      body: string;
      sortOrder?: number;
      isActive?: boolean;
    }): Promise<ApiResponse<{ item: NutritionAiPromptPreset }>> => {
      return postJson<{ item: NutritionAiPromptPreset }>("/api/v1/nutrition/ai-prompt-presets", {
        title: payload.title,
        body: payload.body,
        sort_order: payload.sortOrder ?? 0,
        is_active: payload.isActive ?? true,
      });
    },

    update: async (id: string, payload: {
      title: string;
      body: string;
      sortOrder?: number;
      isActive?: boolean;
    }): Promise<ApiResponse<{ item: NutritionAiPromptPreset }>> => {
      return requestJson<{ item: NutritionAiPromptPreset }>(`/api/v1/nutrition/ai-prompt-presets/${encodeURIComponent(id)}`, "PUT", {
        title: payload.title,
        body: payload.body,
        sort_order: payload.sortOrder ?? 0,
        is_active: payload.isActive ?? true,
      });
    },

    remove: async (id: string): Promise<ApiResponse<{}>> => {
      return requestJson<{}>(`/api/v1/nutrition/ai-prompt-presets/${encodeURIComponent(id)}`, "DELETE");
    },
  },

  nutritionTokens: {
    dashboard: async (q?: string): Promise<ApiResponse<NutritionTokenDashboardPayload>> => {
      const params = new URLSearchParams();
      if (q?.trim()) {
        params.set("q", q.trim());
      }

      return getJson<NutritionTokenDashboardPayload>(`/api/v1/nutrition/tokens/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
    },

    history: async (q?: string, page = 1, perPage = 25): Promise<ApiResponse<NutritionTokenHistoryPayload>> => {
      const params = new URLSearchParams();
      if (q?.trim()) {
        params.set("q", q.trim());
      }
      if (page > 1) {
        params.set("page", String(page));
      }
      if (perPage > 0) {
        params.set("per_page", String(perPage));
      }

      return getJson<NutritionTokenHistoryPayload>(`/api/v1/nutrition/tokens/history${params.toString() ? `?${params.toString()}` : ""}`);
    },

    pay: async (amount: number, gateway?: string): Promise<ApiResponse<{ mode: "sandbox" | "gateway"; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> } | null; payment: { invoiceNumber: string; referenceId?: string | null; paidAt?: string | null; payableAmount?: number; tokensAmount?: number; unitPriceToman?: number }; currentTokens?: number | null }>> => {
      return postJson<{ mode: "sandbox" | "gateway"; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> } | null; payment: { invoiceNumber: string; referenceId?: string | null; paidAt?: string | null; payableAmount?: number; tokensAmount?: number; unitPriceToman?: number }; currentTokens?: number | null }>("/api/v1/nutrition/tokens/pay", {
        amount,
        gateway: gateway || undefined,
      });
    },
  },

  nutritionLanding: {
    getSettings: async (): Promise<ApiResponse<NutritionLandingSettings>> => {
      return getJson<NutritionLandingSettings>("/api/v1/nutrition/landing-settings");
    },

    updateSettings: async (payload: NutritionLandingSettings): Promise<ApiResponse<NutritionLandingSettings>> => {
      return requestJson<NutritionLandingSettings>("/api/v1/nutrition/landing-settings", "PUT", payload);
    },

    updateVariantImage: async (variant: NutritionLandingVariant, payload: {
      image?: File | null;
      removeImage?: boolean;
    }): Promise<ApiResponse<NutritionLandingSettings>> => {
      const formData = new FormData();
      formData.append("removeImage", payload.removeImage ? "1" : "0");

      if (payload.image) {
        formData.append("image", payload.image);
      }

      return requestFormData<NutritionLandingSettings>(`/api/v1/nutrition/landing-settings/${variant}/image`, "POST", formData);
    },

    updateBookingBannerImage: async (payload: {
      image?: File | null;
      removeImage?: boolean;
    }): Promise<ApiResponse<NutritionLandingSettings>> => {
      const formData = new FormData();
      formData.append("removeImage", payload.removeImage ? "1" : "0");

      if (payload.image) {
        formData.append("image", payload.image);
      }

      return requestFormData<NutritionLandingSettings>("/api/v1/nutrition/landing-settings/booking-banner/image", "POST", formData);
    },
  },

  landingAuth: {
    sendOtp: async (mobile: string): Promise<ApiResponse<{ remainingSeconds: number; codeHint?: string | null }>> => {
      const result = await postJson<{ remaining_seconds: number; code_hint?: string }>("/landing-api/v1/auth/otp/send", { mobile });

      if (!result.success) {
        return {
          success: false,
          data: { remainingSeconds: 0, codeHint: null },
          message: result.message || apiMessage("api.auth.sendOtpFailed"),
          errors: result.errors,
        };
      }

      return {
        success: true,
        data: {
          remainingSeconds: result.data.remaining_seconds,
          codeHint: result.data.code_hint ?? null,
        },
        message: result.message,
      };
    },

    login: async (mobile: string, code: string): Promise<ApiResponse<{ customer: LandingCustomer }>> => {
      return postJson<{ customer: LandingCustomer }>("/landing-api/v1/auth/otp/verify", { mobile, code });
    },

    me: async (): Promise<ApiResponse<LandingCustomer | null>> => {
      const result = await getJson<{ customer: LandingCustomer | null }>("/landing-api/v1/auth/otp/me");

      return {
        success: result.success,
        data: result.data?.customer ?? null,
        message: result.message,
        errors: result.errors,
      };
    },

    updateProfile: async (payload: {
      firstName: string;
      lastName: string;
      email?: string;
      gender?: "male" | "female" | "";
      nationalCode?: string;
      birthDate?: string;
      provinceId?: number | null;
      provinceName?: string;
      cityId?: number | null;
      cityName?: string;
      addressLine?: string;
      postalCode?: string;
    }): Promise<ApiResponse<LandingCustomer>> => {
      const result = await postJson<{ customer: LandingCustomer }>("/landing-api/v1/auth/otp/profile", {
        first_name: payload.firstName,
        last_name: payload.lastName,
        email: payload.email,
        gender: payload.gender || undefined,
        national_code: payload.nationalCode,
        birth_date: payload.birthDate,
        province_id: payload.provinceId,
        province_name: payload.provinceName,
        city_id: payload.cityId,
        city_name: payload.cityName,
        address_line: payload.addressLine,
        postal_code: payload.postalCode,
      });

      return {
        success: result.success,
        data: result.data?.customer as LandingCustomer,
        message: result.message,
        errors: result.errors,
      };
    },

    logout: async (): Promise<ApiResponse<boolean>> => {
      return postJson<boolean>("/landing-api/v1/auth/otp/logout");
    },
  },

  landingOrders: {
    preview: async (payload: {
      subscriptionPackageId: string;
      requestedDomain?: string;
      useOwnDomain?: boolean;
      discountCode?: string;
    }): Promise<ApiResponse<LandingCheckoutQuote>> => {
      const params = new URLSearchParams();
      params.set("subscription_package_id", payload.subscriptionPackageId);
      if (payload.requestedDomain) params.set("requested_domain", payload.requestedDomain);
      if (payload.useOwnDomain) params.set("use_own_domain", "1");
      if (payload.discountCode) params.set("discount_code", payload.discountCode);
      const result = await getJson<{ quote: LandingCheckoutQuote }>(`/landing-api/v1/checkout/preview?${params.toString()}`);

      return {
        success: result.success,
        data: result.data?.quote as LandingCheckoutQuote,
        message: result.message,
        errors: result.errors,
      };
    },

    checkout: async (payload: {
      subscriptionPackageId: string;
      requestedDomain?: string;
      useOwnDomain?: boolean;
      notes?: string;
      gateway?: PaymentProvider | "";
      discountCode?: string;
    }): Promise<ApiResponse<{ mode: "sandbox" | "gateway"; order: LandingOrderSummary; payment: LandingOrderPaymentSummary; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> } | null }>> => {
      return postJson<{ mode: "sandbox" | "gateway"; order: LandingOrderSummary; payment: LandingOrderPaymentSummary; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> } | null }>(
        "/landing-api/v1/orders/checkout",
        {
          subscription_package_id: payload.subscriptionPackageId,
          requested_domain: payload.requestedDomain,
          use_own_domain: payload.useOwnDomain ?? false,
          notes: payload.notes,
          gateway: payload.gateway || undefined,
          discount_code: payload.discountCode,
        },
      );
    },

    list: async (params?: { page?: number; perPage?: number }): Promise<ApiResponse<PaginatedLandingOrders>> => {
      const search = new URLSearchParams();
      if (params?.page) search.set("page", String(params.page));
      if (params?.perPage) search.set("perPage", String(params.perPage));
      const query = search.toString();
      return getJson<PaginatedLandingOrders>(`/landing-api/v1/orders${query ? `?${query}` : ""}`);
    },

    get: async (id: string): Promise<ApiResponse<LandingOrderSummary>> => {
      return getJson<LandingOrderSummary>(`/landing-api/v1/orders/${id}`);
    },

    pay: async (id: string, gateway?: PaymentProvider | ""): Promise<ApiResponse<{ mode: "sandbox" | "gateway"; order: LandingOrderSummary; payment: LandingOrderPaymentSummary; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> } | null }>> => {
      return postJson<{ mode: "sandbox" | "gateway"; order: LandingOrderSummary; payment: LandingOrderPaymentSummary; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> } | null }>(
        `/landing-api/v1/orders/${id}/pay`,
        { gateway: gateway || undefined },
      );
    },

    checkDomain: async (id: string, domain: string): Promise<ApiResponse<{ domain: string; available: boolean; status: string; message: string }>> => {
      const search = new URLSearchParams({ domain });
      return getJson<{ domain: string; available: boolean; status: string; message: string }>(`/landing-api/v1/orders/${id}/domain-availability?${search.toString()}`);
    },

    complete: async (id: string, payload: {
      requestedDomain?: string;
      useOwnDomain?: boolean;
      firstName: string;
      lastName: string;
      email: string;
      provinceId: number;
      provinceName: string;
      cityId: number;
      cityName: string;
      addressLine: string;
      nationalCode: string;
      gender: "male" | "female";
    }): Promise<ApiResponse<LandingOrderSummary>> => {
      return postJson<LandingOrderSummary>(`/landing-api/v1/orders/${id}/complete`, {
        requested_domain: payload.requestedDomain,
        use_own_domain: payload.useOwnDomain ?? false,
        first_name: payload.firstName,
        last_name: payload.lastName,
        email: payload.email,
        province_id: payload.provinceId,
        province_name: payload.provinceName,
        city_id: payload.cityId,
        city_name: payload.cityName,
        address_line: payload.addressLine,
        national_code: payload.nationalCode,
        gender: payload.gender,
      });
    },
  },

  barbers: {
      list: async (): Promise<ApiResponse<Barber[]>> => {
          return getJson<Barber[]>("/api/v1/barbers");
      },
      create: async (name: string, mobile: string, sortOrder?: number, apiCode?: string): Promise<ApiResponse<Barber>> => {
          return postJson<Barber>("/api/v1/barbers", {
            name,
            mobile,
            api_code: apiCode,
            sort_order: sortOrder,
            can_access_panel: true,
          });
      },
      update: async (barber: Partial<Barber> & Pick<Barber, "id">): Promise<ApiResponse<Barber>> => {
      return requestJson<Barber>(`/api/v1/barbers/${barber.id}`, "PUT", {
        name: barber.name,
        mobile: barber.mobile,
        api_code: barber.apiCode,
        sort_order: barber.sortOrder,
        is_active: barber.isActive,
        can_access_panel: barber.canAccessPanel,
        activeRanges: barber.activeRanges,
        disabledDates: barber.disabledDates,
        blockedTimeRanges: barber.blockedTimeRanges,
        bookingLeadMode: barber.bookingLeadMode,
        bookingLeadHours: barber.bookingLeadHours,
        bookingLeadDays: barber.bookingLeadDays,
        bookingHorizonMode: barber.bookingHorizonMode,
        bookingMaxDays: barber.bookingMaxDays,
        bookingMaxDate: barber.bookingMaxDate,
      });
      },
      delete: async (id: string): Promise<ApiResponse<boolean>> => {
          return requestJson<boolean>(`/api/v1/barbers/${id}`, "DELETE");
      }
  },

  sections: {
    list: async (barberId?: string): Promise<ApiResponse<Section[]>> => {
      const query = barberId ? `?barber_id=${encodeURIComponent(barberId)}` : "";
      return getJson<Section[]>(`/api/v1/services${query}`);
    },
    create: async (data: Partial<Section>): Promise<ApiResponse<Section>> => {
        return postJson<Section>("/api/v1/services", {
          barber_id: data.barberId,
          name: data.name,
          api_code: data.apiCode,
          sort_order: data.sortOrder ?? 0,
          start_hour: data.startHour || "09:00",
          end_hour: data.endHour || "21:00",
          rest_breaks: data.restBreaks || [],
          vip_breaks: data.vipBreaks || [],
          schedule_overrides: serializeScheduleOverrides(data.scheduleOverrides),
          quick_blocked_slots: serializeQuickBlockedSlots(data.quickBlockedSlots),
          slot_duration_minutes: data.slotDurationMinutes || 30,
          duration_display_text: data.durationDisplayText?.trim() || null,
          price: data.price || 0,
          check_conflicts: data.checkConflicts ?? true,
          is_active: data.isActive ?? true,
          work_days: data.workDays || [0, 1, 2, 3, 4, 6],
          disabled_dates: data.disabledDates || [],
          disabled_date_ranges: data.disabledDateRanges || [],
        });
    },
    update: async (section: Section): Promise<ApiResponse<Section>> => {
      return requestJson<Section>(`/api/v1/services/${section.id}`, "PUT", {
        name: section.name,
        api_code: section.apiCode,
        sort_order: section.sortOrder ?? 0,
        start_hour: section.startHour,
        end_hour: section.endHour,
        rest_breaks: section.restBreaks || [],
        vip_breaks: section.vipBreaks || [],
        schedule_overrides: serializeScheduleOverrides(section.scheduleOverrides),
        quick_blocked_slots: serializeQuickBlockedSlots(section.quickBlockedSlots),
        slot_duration_minutes: section.slotDurationMinutes,
        duration_display_text: section.durationDisplayText?.trim() || null,
        price: section.price || 0,
        check_conflicts: section.checkConflicts,
        is_active: section.isActive,
        work_days: section.workDays || [0, 1, 2, 3, 4, 6],
        disabled_dates: section.disabledDates || [],
        disabled_date_ranges: section.disabledDateRanges || [],
      });
    },
    delete: async (id: string): Promise<ApiResponse<boolean>> => {
        return requestJson<boolean>(`/api/v1/services/${id}`, "DELETE");
    }
  },

  appointments: {
    list: async (date: string, barberId: string): Promise<ApiResponse<Appointment[]>> => {
      return getJson<Appointment[]>(
        `/api/v1/appointments?date=${encodeURIComponent(date)}&barber_id=${encodeURIComponent(barberId)}`
      );
    },

    listByDate: async (date: string, barberId?: string): Promise<ApiResponse<Appointment[]>> => {
      const query = barberId
        ? `?date=${encodeURIComponent(date)}&barber_id=${encodeURIComponent(barberId)}`
        : `?date=${encodeURIComponent(date)}`;
      return getJson<Appointment[]>(`/api/v1/appointments${query}`);
    },

    mine: async (
      scope: "upcoming" | "past" = "upcoming",
      page = 1,
      perPage = 10,
    ): Promise<ApiResponse<PaginatedAppointments>> => {
      return getJson<PaginatedAppointments>(
        `/api/v1/appointments/mine?scope=${encodeURIComponent(scope)}&page=${page}&per_page=${perPage}`,
      );
    },

    recentBookings: async (after?: string): Promise<ApiResponse<Appointment[]>> => {
      const query = after ? `?after=${encodeURIComponent(after)}` : "";
      return getJson<Appointment[]>(`/api/v1/appointments/recent-bookings${query}`);
    },

    latestBookings: async (
      page = 1,
      perPage = 15,
      filters?: { date?: string; name?: string; mobile?: string; status?: string },
    ): Promise<ApiResponse<PaginatedAppointments>> => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });

      if (filters?.date?.trim()) params.set("date", filters.date.trim());
      if (filters?.name?.trim()) params.set("name", filters.name.trim());
      if (filters?.mobile?.trim()) params.set("mobile", filters.mobile.trim());
      if (filters?.status?.trim()) params.set("status", filters.status.trim());

      return getJson<PaginatedAppointments>(
        `/api/v1/appointments/latest-bookings?${params.toString()}`,
      );
    },

    show: async (id: string): Promise<ApiResponse<Appointment>> => {
      return getJson<Appointment>(`/api/v1/appointments/${encodeURIComponent(id)}`);
    },

    transientAlerts: async (
      after?: string,
    ): Promise<ApiResponse<Array<{ id: string; appointment: Appointment; createdAt?: string | null }>>> => {
      const query = after ? `?after=${encodeURIComponent(after)}` : "";
      return getJson<Array<{ id: string; appointment: Appointment; createdAt?: string | null }>>(
        `/api/v1/appointments/transient-alerts${query}`,
      );
    },

    create: async (data: Partial<Appointment>, user?: User | null): Promise<ApiResponse<Appointment>> => {
      return postJson<Appointment>("/api/v1/appointments", {
        ...data,
        userName: data.userName || user?.name || apiMessage("api.userFallbackName"),
        userPhone: data.userPhone || user?.phone,
      });
    },

    getPublic: async (code: string): Promise<ApiResponse<PublicAppointmentDetails>> => {
      return getJson<PublicAppointmentDetails>(`/api/v1/appointments/public/${encodeURIComponent(code)}`);
    },
    
    cancel: async (id: string, userId: string, isAdmin: boolean, sendSms = false): Promise<ApiResponse<boolean>> => {
      return postJson<boolean>(`/api/v1/appointments/${id}/cancel`, {
        userId,
        isAdmin,
        sendSms,
      });
    },

    updateAttendance: async (
      id: string,
      status: "booked" | "completed" | "no_show",
      options?: { blockCustomerBooking?: boolean },
    ): Promise<ApiResponse<Appointment>> => {
      return postJson<Appointment>(`/api/v1/appointments/${id}/attendance`, {
        status,
        block_customer_booking: options?.blockCustomerBooking ?? false,
      });
    },

    changeTime: async (
      id: string,
      startTime: string,
      options?: { date?: string; sendSms?: boolean },
    ): Promise<ApiResponse<Appointment>> => {
      return postJson<Appointment>(`/api/v1/appointments/${encodeURIComponent(id)}/change-time`, {
        startTime,
        date: options?.date,
        sendSms: options?.sendSms ?? false,
      });
    },

    exportDailyReport: async (date: string, barberId: string): Promise<ApiResponse<{ blob: Blob; filename: string }>> => {
      return getBlob(
        `/api/v1/appointments/daily-report/export?date=${encodeURIComponent(date)}&barber_id=${encodeURIComponent(barberId)}`,
      );
    },

    bulkCancel: async (
      ids: string[],
      sendSms = false,
    ): Promise<ApiResponse<{ cancelledCount: number; smsSentCount: number }>> => {
        return postJson<{ cancelledCount: number; smsSentCount: number }>("/api/v1/appointments/bulk-cancel", {
          ids: ids.map((id) => Number(id)),
          sendSms,
        });
    },

    cancelByDates: async (dates: string[]): Promise<ApiResponse<number>> => {
        return { success: true, data: 0 };
    }
  },

  users: {
    lookup: async (mobile: string): Promise<ApiResponse<UserLookupResult>> => {
      return getJson<UserLookupResult>(`/api/v1/users/lookup?mobile=${encodeURIComponent(normalizeDigits(mobile).trim())}`);
    },

    list: async (
      barberId: string,
      page = 1,
      perPage = 10,
      search = "",
    ): Promise<ApiResponse<PaginatedTenantUsers>> => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
        search: normalizeDigits(search).trim(),
      });

      if (barberId === "__all__") {
        params.set("scope", "all");
      } else {
        params.set("barber_id", barberId);
      }

      return getJson<PaginatedTenantUsers>(
        `/api/v1/users?${params.toString()}`,
      );
    },

    appointments: async (
      mobile: string,
      barberId: string,
      scope: "upcoming" | "past" = "upcoming",
      page = 1,
      perPage = 10,
    ): Promise<ApiResponse<PaginatedAppointments>> => {
      return getJson<PaginatedAppointments>(
        `/api/v1/users/${encodeURIComponent(mobile)}/appointments?barber_id=${encodeURIComponent(barberId)}&scope=${encodeURIComponent(scope)}&page=${page}&per_page=${perPage}`,
      );
    },

    updateIdentity: async (
      currentMobile: string,
      barberId: string,
      payload: UserProfilePayload & { mobile: string; nutritionProfileFixedMessage?: string | null },
    ): Promise<ApiResponse<TenantPanelUser>> => {
      return requestJson<TenantPanelUser>(
        `/api/v1/users/${encodeURIComponent(currentMobile)}`,
        "PUT",
        {
          barber_id: barberId,
          name: payload.name,
          mobile: payload.mobile,
          email: payload.email,
          gender: payload.gender,
          nationalCode: payload.nationalCode,
          birthDate: payload.birthDate,
          provinceId: payload.provinceId,
          provinceName: payload.provinceName,
          cityId: payload.cityId,
          cityName: payload.cityName,
          jobTitle: payload.jobTitle,
          nutrition_profile_fixed_message: payload.nutritionProfileFixedMessage,
        },
      );
    },

    updateBookingAccess: async (
      mobile: string,
      barberId: string,
      canBook: boolean,
    ): Promise<ApiResponse<{ mobile: string; canBook: boolean }>> => {
      return requestJson<{ mobile: string; canBook: boolean }>(
        `/api/v1/users/${encodeURIComponent(mobile)}/booking-access`,
        "PUT",
        barberId === "__all__"
          ? { scope: "all", can_book: canBook }
          : { barber_id: barberId, can_book: canBook },
      );
    },

    updateVipAccess: async (
      mobile: string,
      barberId: string,
      isVip: boolean,
    ): Promise<ApiResponse<{ mobile: string; isVip: boolean }>> => {
      return requestJson<{ mobile: string; isVip: boolean }>(
        `/api/v1/users/${encodeURIComponent(mobile)}/vip-access`,
        "PUT",
        barberId === "__all__"
          ? { scope: "all", is_vip: isVip }
          : { barber_id: barberId, is_vip: isVip },
      );
    },

    delete: async (
      mobile: string,
    ): Promise<ApiResponse<{ mobile: string; deletedAppointments: number }>> => {
      return requestJson<{ mobile: string; deletedAppointments: number }>(
        `/api/v1/users/${encodeURIComponent(mobile)}`,
        "DELETE",
      );
    },
  },

  smsCampaigns: {
    preview: async (filters: SmsCampaignFilters): Promise<ApiResponse<SmsCampaignPreview>> => {
      return postJson<SmsCampaignPreview>("/api/v1/sms-campaigns/preview", filters);
    },

    create: async (payload: {
      name: string;
      message: string;
      filters: SmsCampaignFilters;
    }): Promise<ApiResponse<SmsCampaign>> => {
      return postJson<SmsCampaign>("/api/v1/sms-campaigns", {
        name: payload.name,
        message: payload.message,
        ...payload.filters,
      });
    },

    update: async (campaignId: string, payload: {
      name: string;
      message: string;
      filters: SmsCampaignFilters;
    }): Promise<ApiResponse<SmsCampaign>> => {
      return requestJson<SmsCampaign>(`/api/v1/sms-campaigns/${encodeURIComponent(campaignId)}`, "PUT", {
        name: payload.name,
        message: payload.message,
        ...payload.filters,
      });
    },

    list: async (page = 1, perPage = 10): Promise<ApiResponse<PaginatedSmsCampaigns>> => {
      return getJson<PaginatedSmsCampaigns>(`/api/v1/sms-campaigns?page=${page}&per_page=${perPage}`);
    },

    details: async (campaignId: string, page = 1, perPage = 10): Promise<ApiResponse<SmsCampaignDetails>> => {
      return getJson<SmsCampaignDetails>(
        `/api/v1/sms-campaigns/${encodeURIComponent(campaignId)}?page=${page}&per_page=${perPage}`,
      );
    },

    cancel: async (campaignId: string): Promise<ApiResponse<SmsCampaign>> => {
      return postJson<SmsCampaign>(`/api/v1/sms-campaigns/${encodeURIComponent(campaignId)}/cancel`);
    },
  },

  sms: {
    listOutbounds: async (page = 1, perPage = 20, search = ""): Promise<ApiResponse<PaginatedSmsOutbounds>> => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      return getJson<PaginatedSmsOutbounds>(`/api/v1/sms-outbounds?${params.toString()}`);
    },

    sendSingle: async (payload: {
      mobile: string;
      name?: string;
      message: string;
      sender?: string;
    }): Promise<ApiResponse<{ item: SmsOutboundItem | null }>> => {
      return postJson<{ item: SmsOutboundItem | null }>("/api/v1/sms-outbounds/send-single", payload);
    },

    sendBulk: async (payload: {
      recipients: SmsBulkRecipientInput[];
      message: string;
      sender?: string;
    }): Promise<ApiResponse<{ sentCount: number; failedCount: number; items: SmsOutboundItem[] }>> => {
      return postJson<{ sentCount: number; failedCount: number; items: SmsOutboundItem[] }>("/api/v1/sms-outbounds/send-bulk", payload);
    },
  },

  notificationCampaigns: {
    preview: async (filters: NotificationCampaignFilters): Promise<ApiResponse<NotificationCampaignPreview>> => {
      return postJson<NotificationCampaignPreview>("/api/v1/notification-campaigns/preview", filters);
    },

    create: async (payload: {
      name: string;
      title: string;
      message: string;
      filters: NotificationCampaignFilters;
    }): Promise<ApiResponse<NotificationCampaign>> => {
      return postJson<NotificationCampaign>("/api/v1/notification-campaigns", {
        name: payload.name,
        title: payload.title,
        message: payload.message,
        ...payload.filters,
      });
    },

    list: async (page = 1, perPage = 10): Promise<ApiResponse<PaginatedNotificationCampaigns>> => {
      return getJson<PaginatedNotificationCampaigns>(`/api/v1/notification-campaigns?page=${page}&per_page=${perPage}`);
    },

    details: async (campaignId: string, page = 1, perPage = 10): Promise<ApiResponse<NotificationCampaignDetails>> => {
      return getJson<NotificationCampaignDetails>(
        `/api/v1/notification-campaigns/${encodeURIComponent(campaignId)}?page=${page}&per_page=${perPage}`,
      );
    },
  },

  supportTickets: {
    list: async (page = 1, perPage = 10): Promise<ApiResponse<PaginatedSupportTickets>> => {
      return getJson<PaginatedSupportTickets>(`/api/v1/support-tickets?page=${page}&per_page=${perPage}`);
    },

    create: async (payload: { subject: string; body: string; attachments: File[] }): Promise<ApiResponse<SupportTicket>> => {
      const formData = new FormData();
      formData.append("subject", normalizeDigits(payload.subject));
      formData.append("body", normalizeDigits(payload.body));
      payload.attachments.forEach((file) => formData.append("attachments", file));
      return requestFormData<SupportTicket>("/api/v1/support-tickets", "POST", formData);
    },

    details: async (ticketId: string): Promise<ApiResponse<SupportTicketDetails>> => {
      return getJson<SupportTicketDetails>(`/api/v1/support-tickets/${encodeURIComponent(ticketId)}`);
    },

    reply: async (ticketId: string, payload: { body: string; attachments: File[] }): Promise<ApiResponse<SupportTicketDetails>> => {
      const formData = new FormData();
      formData.append("body", normalizeDigits(payload.body));
      payload.attachments.forEach((file) => formData.append("attachments", file));
      return requestFormData<SupportTicketDetails>(`/api/v1/support-tickets/${encodeURIComponent(ticketId)}/reply`, "POST", formData);
    },

    close: async (ticketId: string): Promise<ApiResponse<SupportTicket>> => {
      return postJson<SupportTicket>(`/api/v1/support-tickets/${encodeURIComponent(ticketId)}/close`);
    },

    markSeen: async (ticketId: string): Promise<ApiResponse<SupportTicket>> => {
      return postJson<SupportTicket>(`/api/v1/support-tickets/${encodeURIComponent(ticketId)}/seen`);
    },
  },

  onlineChat: {
    me: async (beforeMessageId?: string | null): Promise<ApiResponse<OnlineChatConversationDetails>> => {
      const query = new URLSearchParams();

      if (beforeMessageId) {
        query.set("before_message_id", beforeMessageId);
      }

      const suffix = query.toString() ? `?${query.toString()}` : "";
      return getJson<OnlineChatConversationDetails>(`/api/v1/online-chat/conversation${suffix}`);
    },

    summary: async (): Promise<ApiResponse<{ conversation: OnlineChatConversationSummary | null }>> => {
      return getJson<{ conversation: OnlineChatConversationSummary | null }>("/api/v1/online-chat/conversation/summary");
    },

    send: async (payload: { body?: string; attachments?: File[] }): Promise<ApiResponse<OnlineChatConversationDetails>> => {
      const formData = new FormData();

      if (payload.body) {
        formData.append("body", normalizeDigits(payload.body));
      }

      (payload.attachments ?? []).forEach((file) => formData.append("attachments[]", file));

      return requestFormData<OnlineChatConversationDetails>("/api/v1/online-chat/messages", "POST", formData);
    },

    markSeen: async (): Promise<ApiResponse<{ conversation: OnlineChatConversationSummary | null }>> => {
      return postJson<{ conversation: OnlineChatConversationSummary | null }>("/api/v1/online-chat/conversation/seen");
    },

    adminList: async (search = ""): Promise<ApiResponse<OnlineChatAdminDashboardPayload>> => {
      const query = new URLSearchParams();

      if (search.trim() !== "") {
        query.set("search", normalizeDigits(search.trim()));
      }

      const suffix = query.toString() ? `?${query.toString()}` : "";
      return getJson<OnlineChatAdminDashboardPayload>(`/api/v1/online-chat/admin/conversations${suffix}`);
    },

    adminDetails: async (conversationId: string, beforeMessageId?: string | null): Promise<ApiResponse<OnlineChatConversationDetails>> => {
      const query = new URLSearchParams();

      if (beforeMessageId) {
        query.set("before_message_id", beforeMessageId);
      }

      const suffix = query.toString() ? `?${query.toString()}` : "";
      return getJson<OnlineChatConversationDetails>(`/api/v1/online-chat/admin/conversations/${encodeURIComponent(conversationId)}${suffix}`);
    },

    adminSend: async (conversationId: string, payload: { body?: string; attachments?: File[] }): Promise<ApiResponse<OnlineChatConversationDetails>> => {
      const formData = new FormData();

      if (payload.body) {
        formData.append("body", normalizeDigits(payload.body));
      }

      (payload.attachments ?? []).forEach((file) => formData.append("attachments[]", file));

      return requestFormData<OnlineChatConversationDetails>(`/api/v1/online-chat/admin/conversations/${encodeURIComponent(conversationId)}/messages`, "POST", formData);
    },

    adminMarkSeen: async (conversationId: string): Promise<ApiResponse<{ conversation: OnlineChatConversationSummary }>> => {
      return postJson<{ conversation: OnlineChatConversationSummary }>(`/api/v1/online-chat/admin/conversations/${encodeURIComponent(conversationId)}/seen`);
    },

    adminClose: async (conversationId: string): Promise<ApiResponse<{ conversation: OnlineChatConversationSummary }>> => {
      return postJson<{ conversation: OnlineChatConversationSummary }>(`/api/v1/online-chat/admin/conversations/${encodeURIComponent(conversationId)}/close`);
    },

    adminReopen: async (conversationId: string): Promise<ApiResponse<{ conversation: OnlineChatConversationSummary }>> => {
      return postJson<{ conversation: OnlineChatConversationSummary }>(`/api/v1/online-chat/admin/conversations/${encodeURIComponent(conversationId)}/reopen`);
    },

    settings: async (): Promise<ApiResponse<{ moduleActive: boolean; showOnBookingPage: boolean; showInMenu: boolean }>> => {
      return getJson<{ moduleActive: boolean; showOnBookingPage: boolean; showInMenu: boolean }>("/api/v1/online-chat/settings");
    },

    updateSettings: async (payload: { showOnBookingPage: boolean; showInMenu: boolean }): Promise<ApiResponse<{ moduleActive: boolean; showOnBookingPage: boolean; showInMenu: boolean }>> => {
      return requestJson<{ moduleActive: boolean; showOnBookingPage: boolean; showInMenu: boolean }>("/api/v1/online-chat/settings", "PUT", {
        show_on_booking_page: payload.showOnBookingPage,
        show_in_menu: payload.showInMenu,
      });
    },
  },

  messagingBots: {
    settings: async (): Promise<ApiResponse<MessagingBotSettings>> => {
      return getJson<MessagingBotSettings>("/api/v1/messaging-bots/settings");
    },

    updateSettings: async (payload: MessagingBotSettings | FormData): Promise<ApiResponse<MessagingBotSettings>> => {
      if (payload instanceof FormData) {
        return requestFormData<MessagingBotSettings>("/api/v1/messaging-bots/settings", "POST", payload);
      }

      return requestJson<MessagingBotSettings>("/api/v1/messaging-bots/settings", "PUT", payload);
    },

    setBotWebhook: async (channel: "telegram" | "bale"): Promise<ApiResponse<TelegramWebhookInfo>> => {
      return postJson<TelegramWebhookInfo>(`/api/v1/messaging-bots/${channel}/set-webhook`);
    },

    botWebhookInfo: async (channel: "telegram" | "bale"): Promise<ApiResponse<TelegramWebhookInfo>> => {
      return getJson<TelegramWebhookInfo>(`/api/v1/messaging-bots/${channel}/webhook-info`);
    },
  },

  notifications: {
    list: async (status: "all" | "unread" = "all", page = 1, perPage = 10): Promise<ApiResponse<PaginatedUserNotifications>> => {
      const query = new URLSearchParams({
        status,
        page: String(page),
        per_page: String(perPage),
      });

      return getJson<PaginatedUserNotifications>(`/api/v1/notifications?${query.toString()}`);
    },

    unreadCount: async (): Promise<ApiResponse<{ count: number }>> => {
      return getJson<{ count: number }>("/api/v1/notifications/unread-count");
    },

    show: async (notificationId: string): Promise<ApiResponse<UserNotificationItem>> => {
      return getJson<UserNotificationItem>(`/api/v1/notifications/${encodeURIComponent(notificationId)}`);
    },

    markRead: async (notificationId: string): Promise<ApiResponse<UserNotificationItem>> => {
      return postJson<UserNotificationItem>(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`);
    },

    markAllRead: async (): Promise<ApiResponse<{ updated: number }>> => {
      return postJson<{ updated: number }>("/api/v1/notifications/read-all");
    },
  },

  supportRenewal: {
    publicPackages: async (): Promise<ApiResponse<SupportRenewalPublicPackagesPayload>> => {
      return getJson<SupportRenewalPublicPackagesPayload>("/api/v1/support-renewal/public-packages");
    },

    packages: async (): Promise<ApiResponse<{ settings: SupportRenewalSettings; packages: SupportRenewalPackage[] }>> => {
      return getJson<{ settings: SupportRenewalSettings; packages: SupportRenewalPackage[] }>("/api/v1/support-renewal/packages");
    },

    preview: async (subscriptionPackageId: string, featureModuleIds?: string[], discountCode?: string): Promise<ApiResponse<SupportRenewalPreview>> => {
      return postJson<SupportRenewalPreview>("/api/v1/support-renewal/preview", {
        subscription_package_id: Number(subscriptionPackageId),
        ...(featureModuleIds ? { feature_module_ids: featureModuleIds.map(Number) } : {}),
        ...(discountCode ? { discount_code: discountCode } : {}),
      });
    },

    pay: async (
      subscriptionPackageId: string,
      featureModuleIds?: string[],
      gateway?: string,
      discountCode?: string,
    ): Promise<ApiResponse<{ mode: "sandbox" | "gateway"; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> }; payment: SupportRenewalPayment }>> => {
      return postJson<{ mode: "sandbox" | "gateway"; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> }; payment: SupportRenewalPayment }>("/api/v1/support-renewal/pay", {
        subscription_package_id: Number(subscriptionPackageId),
        ...(featureModuleIds ? { feature_module_ids: featureModuleIds.map(Number) } : {}),
        ...(gateway ? { gateway } : {}),
        ...(discountCode ? { discount_code: discountCode } : {}),
      });
    },

    storagePreview: async (gb: number): Promise<ApiResponse<StorageAddonPreview>> => {
      return postJson<StorageAddonPreview>("/api/v1/support-renewal/storage/preview", { gb });
    },

    storagePay: async (
      gb: number,
      gateway?: string,
    ): Promise<ApiResponse<{ mode: "sandbox" | "gateway"; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> }; payment: SupportRenewalPayment }>> => {
      return postJson<{ mode: "sandbox" | "gateway"; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> }; payment: SupportRenewalPayment }>("/api/v1/support-renewal/storage/pay", {
        gb,
        ...(gateway ? { gateway } : {}),
      });
    },

    history: async (page = 1, perPage = 10): Promise<ApiResponse<PaginatedSupportRenewalPayments>> => {
      return getJson<PaginatedSupportRenewalPayments>(`/api/v1/support-renewal/history?page=${page}&per_page=${perPage}`);
    },
  },

  files: {
    list: async (params?: {
      q?: string;
      type?: TenantFileCategory | "all";
      page?: number;
      perPage?: number;
    }): Promise<ApiResponse<TenantFileManagerPayload>> => {
      const query = new URLSearchParams();
      if (params?.q) query.set("q", params.q);
      if (params?.type && params.type !== "all") query.set("type", params.type);
      if (params?.page) query.set("page", String(params.page));
      if (params?.perPage) query.set("per_page", String(params.perPage));

      const suffix = query.toString() ? `?${query.toString()}` : "";
      return getJson<TenantFileManagerPayload>(`/api/v1/files${suffix}`);
    },

    delete: async (id: string): Promise<ApiResponse<Pick<TenantFileManagerPayload, "usage">>> => {
      return requestJson<Pick<TenantFileManagerPayload, "usage">>(`/api/v1/files/${encodeURIComponent(id)}`, "DELETE");
    },

    storagePreview: async (gb: number): Promise<ApiResponse<StorageAddonPreview>> => {
      return postJson<StorageAddonPreview>("/api/v1/files/storage/preview", { gb });
    },

    storagePay: async (
      gb: number,
      gateway?: string,
    ): Promise<ApiResponse<{ mode: "sandbox" | "gateway"; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> }; payment: SupportRenewalPayment }>> => {
      return postJson<{ mode: "sandbox" | "gateway"; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> }; payment: SupportRenewalPayment }>("/api/v1/files/storage/pay", {
        gb,
        ...(gateway ? { gateway } : {}),
      });
    },
  },

  domainRenewal: {
    overview: async (): Promise<ApiResponse<DomainRenewalOverview>> => {
      return getJson<DomainRenewalOverview>("/api/v1/domain-renewal");
    },

    pay: async (
      gateway?: string,
    ): Promise<ApiResponse<{ mode: "sandbox" | "gateway"; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> }; payment: DomainRenewalPayment }>> => {
      return postJson<{ mode: "sandbox" | "gateway"; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> }; payment: DomainRenewalPayment }>("/api/v1/domain-renewal/pay", {
        ...(gateway ? { gateway } : {}),
      });
    },

    history: async (page = 1, perPage = 10): Promise<ApiResponse<PaginatedDomainRenewalPayments>> => {
      return getJson<PaginatedDomainRenewalPayments>(`/api/v1/domain-renewal/history?page=${page}&per_page=${perPage}`);
    },
  },

  smsTopUp: {
    pay: async (amount: number, gateway?: string): Promise<ApiResponse<SmsTopUpCheckoutResponse>> => {
      return postJson<SmsTopUpCheckoutResponse>("/api/v1/sms-top-up/pay", {
        amount,
        ...(gateway ? { gateway } : {}),
      });
    },
  },

  referrals: {
    list: async (page = 1, perPage = 10): Promise<ApiResponse<PaginatedReferralLeads>> => {
      return getJson<PaginatedReferralLeads>(`/api/v1/referrals?page=${page}&per_page=${perPage}`);
    },
    create: async (mobile: string): Promise<ApiResponse<ReferralLead>> => {
      return postJson<ReferralLead>("/api/v1/referrals", { mobile });
    },
  },

  featureModules: {
    list: async (): Promise<ApiResponse<{ items: FeatureModuleSummary[] }>> => {
      return getJson<{ items: FeatureModuleSummary[] }>("/api/v1/feature-modules");
    },

    previewActivation: async (featureModuleId: string): Promise<ApiResponse<FeatureModuleActivationPreview>> => {
      return postJson<FeatureModuleActivationPreview>(`/api/v1/feature-modules/${encodeURIComponent(featureModuleId)}/preview-activation`);
    },

    activate: async (featureModuleId: string): Promise<ApiResponse<{ mode: "sandbox" | "gateway"; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> } }>> => {
      return postJson<{ mode: "sandbox" | "gateway"; paymentUrl?: string | null; redirectForm?: { action: string; method: string; inputs: Record<string, string> } }>(`/api/v1/feature-modules/${encodeURIComponent(featureModuleId)}/activate`);
    },
  },

  customLanding: {
    overview: async (): Promise<ApiResponse<CustomLandingOverview>> => getJson<CustomLandingOverview>("/api/v1/custom-landing"),
    settings: async (): Promise<ApiResponse<CustomLandingSettings>> => getJson<CustomLandingSettings>("/api/v1/custom-landing/settings"),
    updateSettings: async (payload: Record<string, unknown>): Promise<ApiResponse<CustomLandingSettings>> => requestJson<CustomLandingSettings>("/api/v1/custom-landing/settings", "PUT", payload),
    issueAppToken: async (): Promise<ApiResponse<{ accessToken: string; tokenType: string; expiresAt: string | null }>> => postJson<{ accessToken: string; tokenType: string; expiresAt: string | null }>("/api/v1/custom-landing/app-token"),
    updateLogo: async (payload: { logo?: File | null; removeLogo?: boolean }): Promise<ApiResponse<CustomLandingSettings>> => {
      const formData = new FormData();
      if (payload.logo) formData.append("logo", payload.logo);
      if (payload.removeLogo) formData.append("remove_logo", "1");
      return requestFormData<CustomLandingSettings>("/api/v1/custom-landing/settings/logo", "POST", formData);
    },
    createPartner: async (payload: Record<string, unknown>): Promise<ApiResponse<CustomLandingPartner>> => postJson<CustomLandingPartner>("/api/v1/custom-landing/partners", payload),
    updatePartner: async (partnerId: string, payload: Record<string, unknown>): Promise<ApiResponse<CustomLandingPartner>> => requestJson<CustomLandingPartner>(`/api/v1/custom-landing/partners/${encodeURIComponent(partnerId)}`, "PUT", payload),
    deletePartner: async (partnerId: string, payload: Record<string, unknown>): Promise<ApiResponse<unknown>> => requestJson(`/api/v1/custom-landing/partners/${encodeURIComponent(partnerId)}`, "DELETE", payload),
    partnerDashboard: async (partnerId: string, search = ""): Promise<ApiResponse<CustomLandingPartnerDashboard>> => getJson<CustomLandingPartnerDashboard>(`/api/v1/custom-landing/partners/${encodeURIComponent(partnerId)}${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    settle: async (partnerId: string, payload: Record<string, unknown>): Promise<ApiResponse<unknown>> => postJson(`/api/v1/custom-landing/partners/${encodeURIComponent(partnerId)}/settlements`, payload),
    deleteCommission: async (commissionId: string, note?: string): Promise<ApiResponse<unknown>> => requestJson(`/api/v1/custom-landing/commissions/${encodeURIComponent(commissionId)}`, "DELETE", { note }),
    deleteSettlement: async (settlementId: string): Promise<ApiResponse<unknown>> => requestJson(`/api/v1/custom-landing/settlements/${encodeURIComponent(settlementId)}`, "DELETE"),
    deleteAttribution: async (attributionId: string): Promise<ApiResponse<unknown>> => requestJson(`/api/v1/custom-landing/attributions/${encodeURIComponent(attributionId)}`, "DELETE"),
  },

  businessResume: {
    get: async (): Promise<ApiResponse<{ templateType: "personal" | "beauty_salon" | null; published: boolean; sections: Record<string, boolean>; content: Record<string, unknown>; publicUrl: string }>> => getJson("/api/v1/business-resume"),
    save: async (payload: { templateType: "personal" | "beauty_salon" | null; published: boolean; sections: Record<string, boolean>; content: Record<string, unknown> }): Promise<ApiResponse<{ templateType: "personal" | "beauty_salon" | null; published: boolean; sections: Record<string, boolean>; content: Record<string, unknown>; publicUrl: string }>> => requestJson("/api/v1/business-resume", "PUT", payload),
    upload: async (image: File): Promise<ApiResponse<{ path: string; url: string }>> => {
      const form = new FormData();
      form.append("image", image);
      return requestFormData("/api/v1/business-resume/upload", "POST", form);
    },
    publicGet: async (): Promise<ApiResponse<{ templateType: "personal" | "beauty_salon"; published: boolean; sections: Record<string, boolean>; content: Record<string, unknown>; publicUrl: string }>> => getJson("/api/v1/business-resume/public"),
  },

  cookingRecipes: {
    publicShow: async (idOrSlug: string): Promise<ApiResponse<CookingRecipeDetailPayload>> => {
      return getJson<CookingRecipeDetailPayload>(`/api/v1/cooking-recipes/${encodeURIComponent(idOrSlug)}`);
    },

    list: async (params: { page?: number; search?: string; status?: "all" | "active" | "inactive"; flag?: string } = {}): Promise<ApiResponse<CookingRecipeListPayload>> => {
      const query = new URLSearchParams();
      if (params.page) query.set("page", String(params.page));
      if (params.search) query.set("search", params.search);
      if (params.status && params.status !== "all") query.set("status", params.status);
      if (params.flag) query.set("flag", params.flag);
      const suffix = query.size > 0 ? `?${query.toString()}` : "";
      return getJson<CookingRecipeListPayload>(`/api/v1/cooking-recipes/admin${suffix}`);
    },

    show: async (id: string): Promise<ApiResponse<CookingRecipeItem>> => {
      return getJson<CookingRecipeItem>(`/api/v1/cooking-recipes/admin/${encodeURIComponent(id)}`);
    },

    update: async (id: string, payload: CookingRecipeUpdatePayload): Promise<ApiResponse<CookingRecipeItem>> => {
      return requestJson<CookingRecipeItem>(`/api/v1/cooking-recipes/admin/${encodeURIComponent(id)}`, "PUT", payload);
    },
  },

  customerFeedback: {
    getSettings: async (): Promise<ApiResponse<CustomerFeedbackSettings>> => {
      return getJson<CustomerFeedbackSettings>("/api/v1/customer-feedback/settings");
    },

    updateSettings: async (payload: Omit<CustomerFeedbackSettings, "moduleActive" | "purchaseUrl" | "smsSettingsUrl" | "professionals" | "questions">): Promise<ApiResponse<CustomerFeedbackSettings>> => {
      return requestJson<CustomerFeedbackSettings>("/api/v1/customer-feedback/settings", "PUT", payload);
    },

    createQuestion: async (payload: Omit<CustomerFeedbackQuestion, "id">): Promise<ApiResponse<CustomerFeedbackQuestion>> => {
      return requestJson<CustomerFeedbackQuestion>("/api/v1/customer-feedback/questions", "POST", payload);
    },

    updateQuestion: async (id: string, payload: Omit<CustomerFeedbackQuestion, "id">): Promise<ApiResponse<CustomerFeedbackQuestion>> => {
      return requestJson<CustomerFeedbackQuestion>(`/api/v1/customer-feedback/questions/${encodeURIComponent(id)}`, "PUT", payload);
    },

    removeQuestion: async (id: string): Promise<ApiResponse<true>> => {
      return requestJson<true>(`/api/v1/customer-feedback/questions/${encodeURIComponent(id)}`, "DELETE");
    },

    getPublic: async (token: string): Promise<ApiResponse<CustomerFeedbackPublicPayload>> => {
      return getJson<CustomerFeedbackPublicPayload>(`/api/v1/customer-feedback/public/${encodeURIComponent(token)}`);
    },

    submitPublic: async (token: string, answers: CustomerFeedbackPublicAnswerInput[]): Promise<ApiResponse<CustomerFeedbackPublicPayload>> => {
      return postJson<CustomerFeedbackPublicPayload>(`/api/v1/customer-feedback/public/${encodeURIComponent(token)}/submit`, { answers });
    },

    getReport: async (): Promise<ApiResponse<CustomerFeedbackReportPayload>> => {
      return getJson<CustomerFeedbackReportPayload>("/api/v1/customer-feedback/report");
    },

    getReportResponse: async (responseId: string): Promise<ApiResponse<CustomerFeedbackReportResponseDetail>> => {
      return getJson<CustomerFeedbackReportResponseDetail>(`/api/v1/customer-feedback/report/responses/${encodeURIComponent(responseId)}`);
    },
  },

  customerClub: {
    adminOverview: async (): Promise<ApiResponse<CustomerClubAdminOverview>> => {
      return getJson<CustomerClubAdminOverview>("/api/v1/customer-club/admin");
    },

    updateSettings: async (payload: Record<string, unknown>): Promise<ApiResponse<CustomerClubSettings>> => {
      return requestJson<CustomerClubSettings>("/api/v1/customer-club/settings", "PUT", payload);
    },

    members: async (page = 1, perPage = 12, search = ""): Promise<ApiResponse<PaginatedCustomerClubMembers>> => {
      const query = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
        ...(search.trim() !== "" ? { search: search.trim() } : {}),
      });

      return getJson<PaginatedCustomerClubMembers>(`/api/v1/customer-club/members?${query.toString()}`);
    },

    adjustMember: async (
      userId: string,
      payload: {
        points_delta: number;
        wallet_delta: number;
        title: string;
        description?: string;
      },
    ): Promise<ApiResponse<CustomerClubAccountSummary>> => {
      return postJson<CustomerClubAccountSummary>(`/api/v1/customer-club/members/${encodeURIComponent(userId)}/adjust`, payload);
    },

    createTier: async (payload: Record<string, unknown>): Promise<ApiResponse<CustomerClubTier>> => {
      return postJson<CustomerClubTier>("/api/v1/customer-club/tiers", payload);
    },

    updateTier: async (tierId: string, payload: Record<string, unknown>): Promise<ApiResponse<CustomerClubTier>> => {
      return requestJson<CustomerClubTier>(`/api/v1/customer-club/tiers/${encodeURIComponent(tierId)}`, "PUT", payload);
    },

    deleteTier: async (tierId: string): Promise<ApiResponse<boolean>> => {
      return requestJson<boolean>(`/api/v1/customer-club/tiers/${encodeURIComponent(tierId)}`, "DELETE");
    },

    createReward: async (payload: Record<string, unknown>): Promise<ApiResponse<CustomerClubReward>> => {
      return postJson<CustomerClubReward>("/api/v1/customer-club/rewards", payload);
    },

    updateReward: async (rewardId: string, payload: Record<string, unknown>): Promise<ApiResponse<CustomerClubReward>> => {
      return requestJson<CustomerClubReward>(`/api/v1/customer-club/rewards/${encodeURIComponent(rewardId)}`, "PUT", payload);
    },

    deleteReward: async (rewardId: string): Promise<ApiResponse<boolean>> => {
      return requestJson<boolean>(`/api/v1/customer-club/rewards/${encodeURIComponent(rewardId)}`, "DELETE");
    },

    me: async (): Promise<ApiResponse<CustomerClubMePayload>> => {
      return getJson<CustomerClubMePayload>("/api/v1/customer-club/me");
    },

    redeemReward: async (rewardId: string): Promise<ApiResponse<{ account: CustomerClubAccountSummary; redemption: CustomerClubRedemption }>> => {
      return postJson<{ account: CustomerClubAccountSummary; redemption: CustomerClubRedemption }>(`/api/v1/customer-club/rewards/${encodeURIComponent(rewardId)}/redeem`);
    },
  },

  finance: {
    dashboard: async (barberId?: string): Promise<ApiResponse<PanelFinanceDashboardPayload>> => {
      const query = new URLSearchParams();
      if (barberId) {
        query.set("barber_id", barberId);
      }

      return getJson<PanelFinanceDashboardPayload>(`/api/v1/finance/dashboard${query.toString() ? `?${query.toString()}` : ""}`);
    },
  },

  manualFinance: {
    dashboard: async (params?: {
      mobile?: string;
      appointmentId?: string;
      professionalId?: string;
      page?: number;
      perPage?: number;
    }): Promise<ApiResponse<ManualFinanceDashboardPayload>> => {
      const query = new URLSearchParams();
      if (params?.mobile) query.set("mobile", normalizeDigits(params.mobile).trim());
      if (params?.appointmentId) query.set("appointment_id", params.appointmentId);
      if (params?.professionalId) query.set("professional_id", params.professionalId);
      if (params?.page) query.set("page", String(params.page));
      if (params?.perPage) query.set("per_page", String(params.perPage));

      return getJson<ManualFinanceDashboardPayload>(`/api/v1/manual-finance/dashboard${query.toString() ? `?${query.toString()}` : ""}`);
    },

    customerSummaries: async (payload: {
      mobiles: string[];
      professionalId?: string | null;
    }): Promise<ApiResponse<{ items: ManualFinanceCustomerSummary[] }>> => {
      return postJson<{ items: ManualFinanceCustomerSummary[] }>("/api/v1/manual-finance/customer-summaries", {
        mobiles: payload.mobiles.map((mobile) => normalizeDigits(mobile).trim()).filter(Boolean),
        professional_id: payload.professionalId || null,
      });
    },

    debtors: async (params?: {
      professionalId?: string | null;
      search?: string;
      page?: number;
      perPage?: number;
    }): Promise<ApiResponse<ManualFinanceDebtorsPayload>> => {
      const query = new URLSearchParams();
      if (params?.professionalId) query.set("professional_id", params.professionalId);
      if (params?.search?.trim()) query.set("search", normalizeDigits(params.search).trim());
      if (params?.page) query.set("page", String(params.page));
      if (params?.perPage) query.set("per_page", String(params.perPage));

      return getJson<ManualFinanceDebtorsPayload>(`/api/v1/manual-finance/debtors${query.toString() ? `?${query.toString()}` : ""}`);
    },

    commissionReport: async (payload: {
      professionalId: string;
      dateFrom: string;
      dateTo: string;
      defaultPercent: number;
      categoryPercents: Record<string, number | null>;
    }): Promise<ApiResponse<ManualFinanceCommissionReportPayload>> => {
      return postJson<ManualFinanceCommissionReportPayload>("/api/v1/manual-finance/commission-report", {
        professional_id: payload.professionalId,
        date_from: payload.dateFrom,
        date_to: payload.dateTo,
        default_percent: payload.defaultPercent,
        category_percents: payload.categoryPercents,
      });
    },

    createEntry: async (payload: {
      appointmentId?: string | null;
      professionalId?: string | null;
      customerName: string;
      customerPhone: string;
      entryDate: string;
      paidAmount: number;
      paymentMethod: "cash" | "card" | "online" | "transfer" | "other";
      items: Array<{ categoryId: string; amount: number; materialCost?: number; sharePercent?: number | null; description?: string | null }>;
      notes?: string | null;
    }): Promise<ApiResponse<ManualFinanceEntry>> => {
      return postJson<ManualFinanceEntry>("/api/v1/manual-finance/entries", {
        appointment_id: payload.appointmentId,
        professional_id: payload.professionalId,
        customer_name: payload.customerName,
        customer_phone: normalizeDigits(payload.customerPhone).trim(),
        entry_date: payload.entryDate,
        paid_amount: payload.paidAmount,
        payment_method: payload.paymentMethod,
        items: payload.items.map((item) => ({
          categoryId: item.categoryId,
          amount: item.amount,
          materialCost: item.materialCost ?? 0,
          sharePercent: item.sharePercent,
          description: item.description,
        })),
        notes: payload.notes,
      });
    },

    deleteEntry: async (id: string): Promise<ApiResponse<boolean>> => {
      return requestJson<boolean>(`/api/v1/manual-finance/entries/${encodeURIComponent(id)}`, "DELETE");
    },

    createCategory: async (payload: { name: string; defaultSharePercent?: number | null; defaultAmount?: number | null }): Promise<ApiResponse<ManualFinanceCategory>> => {
      return postJson<ManualFinanceCategory>("/api/v1/manual-finance/categories", {
        name: payload.name,
        default_share_percent: payload.defaultSharePercent,
        default_amount: payload.defaultAmount,
      });
    },

    updateCategory: async (categoryId: string, payload: { name: string; defaultSharePercent?: number | null; defaultAmount?: number | null }): Promise<ApiResponse<ManualFinanceCategory>> => {
      return requestJson<ManualFinanceCategory>(`/api/v1/manual-finance/categories/${encodeURIComponent(categoryId)}`, "PUT", {
        name: payload.name,
        default_share_percent: payload.defaultSharePercent,
        default_amount: payload.defaultAmount,
      });
    },

    deleteCategory: async (categoryId: string): Promise<ApiResponse<{ id: string }>> => {
      return requestJson<{ id: string }>(`/api/v1/manual-finance/categories/${encodeURIComponent(categoryId)}`, "DELETE");
    },
  },
};
