import { useEffect, useRef, useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { PanelHelpButton } from "@/components/panel-help-button";
import { PwaEngagementPrompt } from "@/components/pwa-engagement-prompt";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import { LandingCustomerProvider } from "@/lib/landing-auth";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { api } from "@/lib/api";
import { applyAppearance, readCachedAppearance } from "@/lib/appearance";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { subscribeAppointmentBooked, subscribeUserNotificationInboxUpdates } from "@/lib/realtime";
import { DEFAULT_APPOINTMENT_ALERT_SOUND, getAppointmentAlertSound } from "@/lib/appointment-alert-sounds";
import { isAppointmentBookingDisabled } from "@/lib/audience";
import type { Appointment, TenantMeta, UserRole } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { LOCALE_DEFINITIONS } from "@/i18n/registry";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import SettingsPage from "@/pages/settings";
import PanelPage from "@/pages/panel";
import PanelBarbersPage from "@/pages/panel-barbers";
import PanelGeneralPage from "@/pages/panel-general";
import PanelBookingClosurePage from "@/pages/panel-booking-closure";
import PanelBookingClosureDetailPage from "@/pages/panel-booking-closure-detail";
import PanelBulkPage from "@/pages/panel-bulk";
import PanelUsersPage from "@/pages/panel-users";
import PanelSmsCampaignsPage from "@/pages/panel-sms-campaigns";
import PanelSmsSendPage from "@/pages/panel-sms-send";
import PanelNotificationCampaignsPage from "@/pages/panel-notification-campaigns";
import PanelSmsSettingsPage from "@/pages/panel-sms-settings";
import PanelSmsOutboundsPage from "@/pages/panel-sms-outbounds";
import PanelSmsTopUpPage from "@/pages/panel-sms-top-up";
import PanelSmsTopUpResultPage from "@/pages/panel-sms-top-up-result";
import PanelSupportPage from "@/pages/panel-support";
import PanelGalleryPage from "@/pages/panel-gallery";
import GalleryPage from "@/pages/gallery";
import AboutPage from "@/pages/about";
import ContactPage from "@/pages/contact";
import StorePage from "@/pages/store";
import StoreListingPage from "@/pages/store-listing";
import StoreProductPage from "@/pages/store-product";
import StoreCheckoutPage from "@/pages/store-checkout";
import StoreCheckoutPaymentPage from "@/pages/store-checkout-payment";
import StoreCheckoutResultPage from "@/pages/store-checkout-result";
import StoreOrdersPage from "@/pages/store-orders";
import NotificationsPage from "@/pages/notifications";
import AppointmentPublicPage from "@/pages/appointment-public";
import PanelAppearancePage from "@/pages/panel-appearance";
import PanelDailyReportPage from "@/pages/panel-daily-report";
import PanelLatestBookingsPage from "@/pages/panel-latest-bookings";
import PanelSupportRenewalPage from "@/pages/panel-support-renewal";
import PanelSupportRenewalInvoicePage from "@/pages/panel-support-renewal-invoice";
import PanelSupportRenewalHistoryPage from "@/pages/panel-support-renewal-history";
import PanelReferralsPage from "@/pages/panel-referrals";
import PanelCustomLandingPage from "@/pages/panel-custom-landing";
import CustomLandingWelcomePage from "@/pages/custom-landing-welcome";
import PanelAboutPage from "@/pages/panel-about";
import PanelContactPage from "@/pages/panel-contact";
import PanelSpecialFeaturesPage from "@/pages/panel-special-features";
import PanelDomainRenewalPage from "@/pages/panel-domain-renewal";
import PanelSpecializedCoursesPage from "@/pages/panel-specialized-courses";
import PanelSpecializedCourseDetailPage from "@/pages/panel-specialized-course-detail";
import PanelSpecializedCourseCategoryPage from "@/pages/panel-specialized-course-category";
import PanelSpecializedCourseLessonPage from "@/pages/panel-specialized-course-lesson";
import PanelSpecializedCourseCheckoutPage from "@/pages/panel-specialized-course-checkout";
import PanelCustomerClubPage from "@/pages/panel-customer-club";
import PanelCustomerFeedbackPage from "@/pages/panel-customer-feedback";
import PanelCustomerFeedbackReportPage from "@/pages/panel-customer-feedback-report";
import PanelOnlineChatPage from "@/pages/panel-online-chat";
import PanelCookingRecipesPage from "@/pages/panel-cooking-recipes";
import PanelCookingRecipeEditPage from "@/pages/panel-cooking-recipe-edit";
import PanelMessagingBotsPage from "@/pages/panel-messaging-bots";
import PanelStoreSettingsPage from "@/pages/panel-store-settings";
import PanelStoreSettingsHomePage from "@/pages/panel-store-settings-home";
import PanelStoreSettingsFaqPage from "@/pages/panel-store-settings-faq";
import PanelStoreSettingsShippingPage from "@/pages/panel-store-settings-shipping";
import PanelStoreSettingsGeneralPage from "@/pages/panel-store-settings-general";
import PanelStoreSettingsGeneralBasePage from "@/pages/panel-store-settings-general-base";
import PanelStoreSettingsGeneralCorePage from "@/pages/panel-store-settings-general-core";
import PanelStoreCategoriesPage from "@/pages/panel-store-categories";
import PanelStoreProductFormPage from "@/pages/panel-store-product-form";
import PanelStoreProductsPage from "@/pages/panel-store-products";
import PanelStoreOrderDetailPage from "@/pages/panel-store-order-detail";
import PanelStoreReviewsPage from "@/pages/panel-store-reviews";
import PanelStoreOrdersPage from "@/pages/panel-store-orders";
import PanelBrandKitPage from "@/pages/panel-brand-kit";
import PanelFinancePage from "@/pages/panel-finance";
import PanelManualFinancePage from "@/pages/panel-manual-finance";
import PanelCommissionReportPage from "@/pages/panel-commission-report";
import PanelDebtorsPage from "@/pages/panel-debtors";
import PanelFilesPage from "@/pages/panel-files";
import PanelStorageUpgradePage from "@/pages/panel-storage-upgrade";
import PanelHelpPage from "@/pages/panel-help";
import LandingPreviewPage from "@/pages/landing-preview";
import LandingFeaturesPage from "@/pages/landing-features";
import LandingPlansPage from "@/pages/landing-plans";
import LandingAboutPage from "@/pages/landing-about";
import LandingContactPage from "@/pages/landing-contact";
import LandingFaqPage from "@/pages/landing-faq";
import LandingOrdersPage from "@/pages/landing-orders";
import PellehStaticLandingPage from "@/pages/pelleh-static-landing";
import PellehFeatureDetailPage from "@/pages/pelleh-feature-detail";
import PellehPricingPage from "@/pages/pelleh-pricing";
import PellehPlanDurationPage from "@/pages/pelleh-plan-duration";
import CustomerClubPage from "@/pages/customer-club";
import CustomerFeedbackPublicPage from "@/pages/customer-feedback-public";
import SupportChatRoomPage from "@/pages/support-chat-room";
import ArticlesPage from "@/pages/articles";
import ArticleDetailPage from "@/pages/article-detail";
import PanelArticlesPage from "@/pages/panel-articles";
import PanelArticlesSectionPage from "@/pages/panel-articles-section";
import PanelArticlesCategoriesPage from "@/pages/panel-articles-categories";
import PanelArticlesPostsPage from "@/pages/panel-articles-posts";
import PanelArticlesSettingsPage from "@/pages/panel-articles-settings";
import PanelArticlesTagsPage from "@/pages/panel-articles-tags";
import { getNutritionRouteDefs, NutritionEntryRoute } from "@/nutrition/routes";
import PanelNutritionPackageOrdersPage from "@/nutrition/pages/panel-nutrition-package-orders";
import { isNutritionLandingDefaultEnabled } from "@/nutrition/lib/landing-presets";
const USER_ROLES = new Set<UserRole>(["guest", "user", "admin", "barber", "customer"]);

function normalizeUserRole(role?: string | null): UserRole | null {
  return role && USER_ROLES.has(role as UserRole) ? (role as UserRole) : null;
}

function PanelSpecializedCoursesRoute() {
  return <PanelSpecializedCoursesPage />;
}

function PanelSpecializedCoursesDemoRoute() {
  return <PanelSpecializedCoursesPage demoMode />;
}

function PanelCustomLandingRoute() {
  const [location] = useLocation();
  return <PanelCustomLandingPage key={location} />;
}

function extractIsoDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function extractTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/\d{2}:\d{2}/);
  return match ? match[0] : null;
}

function formatAppointmentToastDate(
  format: ReturnType<typeof useFormat>,
  date?: string | null,
  time?: string | null,
) {
  const safeDate = extractIsoDate(date);
  const safeTime = extractTime(time) ?? extractTime(date);

  if (!safeDate) {
    return safeTime ?? "";
  }

  return [format.date(safeDate, { weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" }), safeTime].filter(Boolean).join(" | ");
}

function SettingsRoute() {
  return <SettingsPage />;
}

function Router() {
  const [bootstrapMeta, setBootstrapMeta] = useState(() => getInitialTenantMeta());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleSettingsUpdated = () => {
      setBootstrapMeta(getInitialTenantMeta());
    };

    window.addEventListener("booking:payment-settings-updated", handleSettingsUpdated);

    return () => {
      window.removeEventListener("booking:payment-settings-updated", handleSettingsUpdated);
    };
  }, []);

  const isLandingDomain = bootstrapMeta?.isLandingDomain === true;
  const isNutritionAudience = ["nutritionists", "nutrition-doctors"].includes(bootstrapMeta?.audience?.slug || "");
  const appointmentBookingDisabled = isAppointmentBookingDisabled(bootstrapMeta);
  const useNutritionLandingAsDefault = isNutritionAudience && isNutritionLandingDefaultEnabled(bootstrapMeta);
  const useCustomLandingAsDefault = bootstrapMeta?.customLandingSettings?.redirectHomeEnabled === true;
  const nutritionRoutesEnabled = isNutritionAudience || true;

  if (isLandingDomain) {
    return (
      <Switch>
        <Route path="/" component={PellehStaticLandingPage} />
        <Route path="/barbers" component={LandingPreviewPage} />
        <Route path="/features/:slug" component={PellehFeatureDetailPage} />
        <Route path="/features" component={PellehFeatureDetailPage} />
        <Route path="/plans" component={PellehPricingPage} />
        <Route path="/plans/duration" component={PellehPlanDurationPage} />
        <Route path="/about" component={LandingAboutPage} />
        <Route path="/contact" component={LandingContactPage} />
        <Route path="/faq" component={LandingFaqPage} />
        <Route path="/orders" component={LandingOrdersPage} />
        <Route path="/landing-preview" component={LandingPreviewPage} />
        <Route path="/landing-preview/barbers" component={LandingPreviewPage} />
        <Route path="/landing-preview/features" component={LandingFeaturesPage} />
        <Route path="/landing-preview/plans" component={LandingPlansPage} />
        <Route path="/landing-preview/about" component={LandingAboutPage} />
        <Route path="/landing-preview/contact" component={LandingContactPage} />
        <Route path="/landing-preview/faq" component={LandingFaqPage} />
        <Route path="/landing-preview/orders" component={LandingOrdersPage} />
        <Route component={LandingPreviewPage} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={useCustomLandingAsDefault ? CustomLandingWelcomePage : useNutritionLandingAsDefault || appointmentBookingDisabled ? NutritionEntryRoute : Home} />
      <Route path="/admin_login" component={useNutritionLandingAsDefault || appointmentBookingDisabled ? NutritionEntryRoute : Home} />
      <Route path="/s/:code" component={AppointmentPublicPage} />
      <Route path="/f/:token" component={CustomerFeedbackPublicPage} />
      <Route path="/booking" component={appointmentBookingDisabled ? NutritionEntryRoute : Home} />
      <Route path="/gallery" component={GalleryPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/store" component={StorePage} />
      <Route path="/store/bestsellers" component={StoreListingPage} />
      <Route path="/store/popular" component={StoreListingPage} />
      <Route path="/store/latest" component={StoreListingPage} />
      <Route path="/store/search" component={StoreListingPage} />
      <Route path="/store/product/:id" component={StoreProductPage} />
      <Route path="/store/checkout" component={StoreCheckoutPage} />
      <Route path="/store/checkout/payment" component={StoreCheckoutPaymentPage} />
      <Route path="/store/checkout/result" component={StoreCheckoutResultPage} />
      <Route path="/store/orders" component={StoreOrdersPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/club" component={CustomerClubPage} />
      <Route path="/support/chat" component={SupportChatRoomPage} />
      <Route path="/articles" component={ArticlesPage} />
      <Route path="/articles/:id" component={ArticleDetailPage} />
      <Route path="/feedback/:token" component={CustomerFeedbackPublicPage} />
      <Route path="/join/:token" component={CustomLandingWelcomePage} />
      <Route path="/store/collection/:slug" component={StoreListingPage} />
      <Route path="/landing-preview" component={LandingPreviewPage} />
      <Route path="/landing-preview/barbers" component={LandingPreviewPage} />
      <Route path="/landing-preview/features" component={LandingFeaturesPage} />
      <Route path="/landing-preview/plans" component={LandingPlansPage} />
      <Route path="/landing-preview/about" component={LandingAboutPage} />
      <Route path="/landing-preview/contact" component={LandingContactPage} />
      <Route path="/landing-preview/faq" component={LandingFaqPage} />
      <Route path="/landing-preview/orders" component={LandingOrdersPage} />
      <Route path="/panel/nutrition/package-orders" component={PanelNutritionPackageOrdersPage} />
      {getNutritionRouteDefs(nutritionRoutesEnabled)}
      <Route path="/panel/gallery" component={PanelGalleryPage} />
      <Route path="/panel/about" component={PanelAboutPage} />
      <Route path="/panel/contact" component={PanelContactPage} />
      <Route path="/panel/special-features/:slug" component={PanelSpecialFeaturesPage} />
      <Route path="/panel/special-features" component={PanelSpecialFeaturesPage} />
      <Route path="/panel/domain-renewal" component={PanelDomainRenewalPage} />
      <Route path="/panel/specialized-courses-demo" component={PanelSpecializedCoursesDemoRoute} />
      <Route path="/panel/specialized-courses" component={PanelSpecializedCoursesRoute} />
      <Route path="/panel/specialized-courses/category/:categoryId" component={PanelSpecializedCourseCategoryPage} />
      <Route path="/panel/specialized-courses/:courseId/checkout" component={PanelSpecializedCourseCheckoutPage} />
      <Route path="/panel/specialized-courses/:courseId/lessons/:lessonId" component={PanelSpecializedCourseLessonPage} />
      <Route path="/panel/specialized-courses/:courseId" component={PanelSpecializedCourseDetailPage} />
      <Route path="/panel/customer-club" component={PanelCustomerClubPage} />
      <Route path="/panel/customer-feedback" component={PanelCustomerFeedbackPage} />
      <Route path="/panel/customer-feedback/report" component={PanelCustomerFeedbackReportPage} />
      <Route path="/panel/online-chat" component={PanelOnlineChatPage} />
      <Route path="/panel/cooking-recipes" component={PanelCookingRecipesPage} />
      <Route path="/panel/cooking-recipes/:recipeId/edit" component={PanelCookingRecipeEditPage} />
      <Route path="/panel/messaging-bots" component={PanelMessagingBotsPage} />
      <Route path="/panel/articles" component={PanelArticlesPage} />
      <Route path="/panel/articles/posts" component={PanelArticlesPostsPage} />
      <Route path="/panel/articles/settings" component={PanelArticlesSettingsPage} />
      <Route path="/panel/articles/categories" component={PanelArticlesCategoriesPage} />
      <Route path="/panel/articles/tags" component={PanelArticlesTagsPage} />
      <Route path="/panel/store-settings" component={PanelStoreSettingsPage} />
      <Route path="/panel/store-settings/home" component={PanelStoreSettingsHomePage} />
      <Route path="/panel/store-settings/faq" component={PanelStoreSettingsFaqPage} />
      <Route path="/panel/store-settings/shipping" component={PanelStoreSettingsShippingPage} />
      <Route path="/panel/store-settings/categories" component={PanelStoreCategoriesPage} />
      <Route path="/panel/store-settings/products/new" component={PanelStoreProductFormPage} />
      <Route path="/panel/store-settings/products/:productId/edit" component={PanelStoreProductFormPage} />
      <Route path="/panel/store-settings/products" component={PanelStoreProductsPage} />
      <Route path="/panel/store-settings/orders/:orderId" component={PanelStoreOrderDetailPage} />
      <Route path="/panel/store-settings/orders" component={PanelStoreOrdersPage} />
      <Route path="/panel/store-settings/reviews" component={PanelStoreReviewsPage} />
      <Route path="/panel/store-settings/general" component={PanelStoreSettingsGeneralPage} />
      <Route path="/panel/store-settings/general/base" component={PanelStoreSettingsGeneralBasePage} />
      <Route path="/panel/store-settings/general/base/core" component={PanelStoreSettingsGeneralCorePage} />
      <Route path="/panel/brand-kit" component={PanelBrandKitPage} />
      <Route path="/panel/finance" component={PanelFinancePage} />
      <Route path="/panel/manual-finance" component={PanelManualFinancePage} />
      <Route path="/panel/commission-report" component={PanelCommissionReportPage} />
      <Route path="/panel/users/debtors" component={PanelDebtorsPage} />
      <Route path="/panel/files/upgrade" component={PanelStorageUpgradePage} />
      <Route path="/panel/files" component={PanelFilesPage} />
      <Route path="/panel/help" component={PanelHelpPage} />
      <Route path="/panel/appearance" component={PanelAppearancePage} />
      <Route path="/panel/support-renewal" component={PanelSupportRenewalPage} />
      <Route path="/panel/support-renewal/invoice" component={PanelSupportRenewalInvoicePage} />
      <Route path="/panel/support-renewal/history" component={PanelSupportRenewalHistoryPage} />
      <Route path="/panel/referrals" component={PanelReferralsPage} />
      <Route path={/^\/panel\/custom-landing(?:\/.*)?$/} component={PanelCustomLandingRoute} />
      <Route path="/panel/latest-bookings" component={appointmentBookingDisabled ? PanelPage : PanelLatestBookingsPage} />
      <Route path="/panel/daily-report" component={appointmentBookingDisabled ? PanelPage : PanelDailyReportPage} />
      <Route path="/panel/professionals" component={PanelBarbersPage} />
      <Route path="/panel/barbers" component={PanelBarbersPage} />
      <Route path="/panel/users" component={PanelUsersPage} />
      <Route path="/panel/campaigns/sms" component={PanelSmsCampaignsPage} />
      <Route path="/panel/sms-send" component={PanelSmsSendPage} />
      <Route path="/panel/sms-settings" component={PanelSmsSettingsPage} />
      <Route path="/panel/sms-settings/booking" component={appointmentBookingDisabled ? PanelPage : PanelSmsSettingsPage} />
      <Route path="/panel/sms-settings/nutrition" component={PanelSmsSettingsPage} />
      <Route path="/panel/sms-settings/store" component={PanelSmsSettingsPage} />
      <Route path="/panel/sms-settings/feedback" component={PanelSmsSettingsPage} />
      <Route path="/panel/sms-settings/outbounds" component={PanelSmsOutboundsPage} />
      <Route path="/panel/sms-settings/top-up" component={PanelSmsTopUpPage} />
      <Route path="/panel/sms-settings/top-up/result" component={PanelSmsTopUpResultPage} />
      <Route path="/panel/campaigns/notifications" component={PanelNotificationCampaignsPage} />
      <Route path="/panel/support" component={PanelSupportPage} />
      <Route path="/panel/general" component={PanelGeneralPage} />
      <Route path="/panel/booking-closure/:closureId" component={PanelBookingClosureDetailPage} />
      <Route path="/panel/booking-closure" component={PanelBookingClosurePage} />
      <Route path="/panel/bulk" component={appointmentBookingDisabled ? PanelPage : PanelBulkPage} />
      <Route path="/panel" component={PanelPage} />
      <Route path="/settings" component={SettingsRoute} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PanelRealtimeNotifier() {
  const [location] = useLocation();
  const { user, isAdmin, isBarber, isLoading } = useAuth();
  const { barbers } = useStore();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioPrimedRef = useRef(false);
  const seenAppointmentIdsRef = useRef<Set<string>>(new Set());
  const [appointmentAlertSound, setAppointmentAlertSound] = useState(DEFAULT_APPOINTMENT_ALERT_SOUND);
  const shownDietNotificationIdsRef = useRef<Set<string>>(new Set());
  const appointmentBookingDisabled = isAppointmentBookingDisabled(getInitialTenantMeta());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const selectedSound = getAppointmentAlertSound(appointmentAlertSound);
    const audio = new Audio(selectedSound.file || "");
    audio.preload = "auto";
    audio.volume = 1;
    alertAudioRef.current = audio;

    const primeAudio = () => {
      if (audioPrimedRef.current || !alertAudioRef.current) {
        return;
      }

      audioPrimedRef.current = true;
      const currentAudio = alertAudioRef.current;
      currentAudio.muted = true;

      currentAudio.play()
        .then(() => {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        })
        .catch(() => undefined)
        .finally(() => {
          currentAudio.muted = false;
        });
    };

    window.addEventListener("pointerdown", primeAudio, { passive: true });
    window.addEventListener("keydown", primeAudio);

    return () => {
      window.removeEventListener("pointerdown", primeAudio);
      window.removeEventListener("keydown", primeAudio);
      alertAudioRef.current?.pause();
      alertAudioRef.current = null;
      audioPrimedRef.current = false;
    };
  }, [appointmentAlertSound]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    api.payment.getSettings().then((res) => {
      if (res.success) {
        setAppointmentAlertSound(res.data.appointmentAlertSound || DEFAULT_APPOINTMENT_ALERT_SOUND);
      }
    });

    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ appointmentAlertSound?: string }>).detail;
      setAppointmentAlertSound((detail?.appointmentAlertSound as typeof appointmentAlertSound) || DEFAULT_APPOINTMENT_ALERT_SOUND);
    };

    window.addEventListener("booking:payment-settings-updated", handleSettingsUpdated as EventListener);

    return () => {
      window.removeEventListener("booking:payment-settings-updated", handleSettingsUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    if (isLoading || appointmentBookingDisabled) {
      return;
    }

    const isStaffScreen =
      location.startsWith("/panel") ||
      location === "/" ||
      location.startsWith("/?") ||
      location.startsWith("/booking");

    if (!isStaffScreen) {
      return;
    }

    if (!isAdmin && !isBarber) {
      return;
    }

    const actorBarber = isBarber && user ? barbers.find((barber) => barber.userId === user.id) : null;

    const playAlertSound = () => {
      if (appointmentAlertSound === "silent") {
        return;
      }

      const audio = alertAudioRef.current;
      if (!audio) {
        return;
      }

      const playOnce = () => {
        audio.currentTime = 0;
        return audio.play().catch(() => undefined);
      };

      playOnce();
      window.setTimeout(() => {
        playOnce();
      }, 700);

      if ("vibrate" in navigator) {
        navigator.vibrate?.([180, 120, 180]);
      }
    };

    const handleIncomingAppointment = (appointment: Appointment) => {
      if (seenAppointmentIdsRef.current.has(appointment.id)) {
        return;
      }

      if (isBarber && actorBarber && appointment.barberId !== actorBarber.id) {
        return;
      }

      if (isBarber && !actorBarber) {
        return;
      }

      if (appointment.bookedByRole === "admin" || appointment.bookedByRole === "barber") {
        return;
      }

      seenAppointmentIdsRef.current.add(appointment.id);

      const customerName = appointment.userName || t("app.realtime.customerFallback");
      const customerPhone = appointment.userPhone || "";
      const appointmentMoment = formatAppointmentToastDate(format, appointment.date, appointment.startTime);
      const description = t("app.realtime.appointmentBookedDescription", {
        customer: customerName,
        phone: customerPhone ? ` - ${customerPhone}` : "",
        professional: appointment.barberName || "",
        time: appointmentMoment || "",
      });

      toast({
        duration: 10000,
        title: t("app.realtime.appointmentBookedTitle"),
        description,
      });

      playAlertSound();

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const notification = new Notification(t("app.realtime.appointmentBookedTitle"), {
          body: description,
          tag: `appointment-booked-${appointment.id}`,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          silent: appointmentAlertSound === "silent",
        });

        notification.onclick = () => {
          window.focus();
          window.location.href = "/panel/daily-report";
        };
      }
    };

    const normalizeRealtimeAppointment = (appointment: {
      id: string;
      barberId: string;
      barberName: string;
      barberUserId?: string | null;
      bookedByUserId?: string | null;
      bookedByRole?: string | null;
      sectionId: string;
      sectionName: string;
      date: string;
      startTime: string;
      endTime: string;
      customerName: string;
      customerPhone: string;
      createdAt?: string | null;
    }): Appointment => ({
      id: appointment.id,
      userId: "",
      userPhone: appointment.customerPhone,
      userName: appointment.customerName,
      bookedByUserId: appointment.bookedByUserId ?? null,
      bookedByPhone: null,
      bookedByName: null,
      bookedByRole: normalizeUserRole(appointment.bookedByRole),
      barberId: appointment.barberId,
      barberName: appointment.barberName,
      sectionId: appointment.sectionId,
      sectionName: appointment.sectionName,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: "booked",
      sendSms: false,
      createdAt: appointment.createdAt ?? new Date().toISOString(),
      isForSomeoneElse: false,
      isOffQueue: false,
    });

    const unsubscribe = subscribeAppointmentBooked(({ appointment }) => {
      handleIncomingAppointment(normalizeRealtimeAppointment(appointment));
    });

    return () => {
      unsubscribe?.();
    };
  }, [appointmentAlertSound, appointmentBookingDisabled, barbers, format, isAdmin, isBarber, isLoading, location, t, toast, user]);

  useEffect(() => {
    if (isLoading || !isAdmin || !user || !location.startsWith("/panel")) {
      return;
    }

    let cancelled = false;
    const storageKey = `panel_nutrition_diet_notifications_${user.id}`;

    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(storageKey) || "[]");
      shownDietNotificationIdsRef.current = new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      shownDietNotificationIdsRef.current = new Set();
    }

    const showUnreadDietNotifications = async () => {
      const res = await api.notifications.list("unread", 1, 10);
      if (!res.success || cancelled) {
        return;
      }

      const nextShown = new Set(shownDietNotificationIdsRef.current);
      const pending = res.data.items.filter((item) => item.targetType === "nutrition_diet" && !nextShown.has(item.id));

      pending.forEach((item) => {
        toast({
          title: item.title || t("app.realtime.dietNotificationFallbackTitle"),
          description: item.message,
        });
        nextShown.add(item.id);
      });

      shownDietNotificationIdsRef.current = nextShown;
      window.sessionStorage.setItem(storageKey, JSON.stringify(Array.from(nextShown).slice(-30)));
    };

    void showUnreadDietNotifications();

    const unsubscribe = subscribeUserNotificationInboxUpdates(user.id, () => {
      void showUnreadDietNotifications();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isAdmin, isLoading, location, t, toast, user]);

  return null;
}

function ProtectedRouteBootstrap() {
  const [location] = useLocation();
  const { isLoading } = useAuth();
  const t = useT();
  const { dir } = useLocale();

  const isProtectedPath = location.startsWith("/panel") || location.startsWith("/settings");

  if (!isProtectedPath || !isLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
      <div className="max-w-md w-full rounded-[28px] border border-border/70 bg-card/60 p-8 text-center shadow-sm">
        <div className="text-lg font-bold">{t("app.protected.loadingTitle")}</div>
        <div className="mt-3 text-sm leading-7 text-muted-foreground">
          {t("app.protected.loadingDescription")}
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const [location] = useLocation();
  const { isLoading } = useAuth();
  const { locale } = useLocale();
  const tenantMeta = getInitialTenantMeta();
  const demoBar = tenantMeta?.demoBar;

  const isProtectedPath = location.startsWith("/panel") || location.startsWith("/settings");
  const panelDir = LOCALE_DEFINITIONS[locale].dir;
  const showDemoBar = !isProtectedPath && demoBar?.enabled === true;

  useEffect(() => {
    const cachedAppearance = readCachedAppearance();
    if (cachedAppearance) {
      applyAppearance(cachedAppearance);
    }
  }, [location]);

  useEffect(() => {
    if (!isProtectedPath) {
      delete document.body.dataset.tenantPanel;
      return;
    }

    document.body.dataset.tenantPanel = "true";

    return () => {
      delete document.body.dataset.tenantPanel;
    };
  }, [isProtectedPath]);

  useEffect(() => {
    if (!isProtectedPath && showDemoBar) {
      document.body.dataset.tenantDemoBar = "true";
      return () => {
        delete document.body.dataset.tenantDemoBar;
      };
    }

    delete document.body.dataset.tenantDemoBar;
  }, [isProtectedPath, showDemoBar]);

  if (isProtectedPath && isLoading) {
    return <ProtectedRouteBootstrap />;
  }

  return (
    <div
      className={isProtectedPath ? "tenant-panel-shell" : showDemoBar ? "tenant-public-shell has-demo-bar" : "tenant-public-shell"}
      dir={isProtectedPath ? panelDir : undefined}
      style={!isProtectedPath && showDemoBar ? { paddingTop: "55px" } : undefined}
    >
      {showDemoBar ? <DemoPurchaseBar demoBar={demoBar} /> : null}
      <PanelRealtimeNotifier />
      <PanelHelpButton />
      <Router />
      <PwaEngagementPrompt />
      <Toaster />
    </div>
  );
}

function DemoPurchaseBar({ demoBar }: { demoBar: NonNullable<TenantMeta["demoBar"]> }) {
  return (
    <div className="demo-purchase-bar fixed inset-x-0 top-0 z-[90] h-[55px] border-b border-[#5c430d] bg-[#1f1807] px-4 text-[#ffbf45] shadow-[0_4px_14px_rgba(0,0,0,.16)]" dir="rtl">
      <div className="mx-auto flex h-full w-full max-w-[640px] items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center justify-start gap-2 text-right text-[11px] font-black leading-[15px] sm:text-xs">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#ffad1f] shadow-[0_0_0_3px_rgba(255,173,31,.16),0_0_10px_rgba(255,173,31,.75)]" aria-hidden="true" />
          <span className="demo-purchase-message">{demoBar.message}</span>
        </div>
        {demoBar.url ? (
          <a
            href={demoBar.url}
            target={demoBar.openNewTab === false ? undefined : "_blank"}
            rel={demoBar.openNewTab === false ? undefined : "noopener noreferrer"}
            className="order-last inline-flex h-8 min-w-24 shrink-0 items-center justify-center rounded-xl bg-[#ffad1f] px-4 text-[11px] font-black text-[#121006] transition hover:bg-[#ffc04d] sm:order-first sm:min-w-32 sm:text-xs"
          >
            {demoBar.ctaLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function App() {
  const [appearance, setAppearance] = useState(() => readCachedAppearance());
  const activeBookingTemplate =
    appearance?.bookingTemplate === "pink" ||
    appearance?.bookingTemplate === "blue" ||
    appearance?.bookingTemplate === "green" ||
    appearance?.bookingTemplate === "red" ||
    appearance?.bookingTemplate === "purple" ||
    appearance?.bookingTemplate === "yellow" ||
    appearance?.bookingTemplate === "olive"
      ? appearance.bookingTemplate
      : null;
  const bookingTemplateClass = activeBookingTemplate ? `site-template-${activeBookingTemplate}` : undefined;

  useEffect(() => {
    api.appearance
      .get()
      .then((res) => {
        if (res.success) {
          setAppearance(res.data);
          applyAppearance(res.data);
        }
      })
      .finally(() => {
        window.dispatchEvent(new Event("barberbook:appearance-ready"));
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LandingCustomerProvider>
          <StoreProvider>
            <div className={bookingTemplateClass}>
              <AppShell />
            </div>
          </StoreProvider>
        </LandingCustomerProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
