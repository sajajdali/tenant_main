import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Calculator, ClipboardList, Home, LayoutDashboard, LogIn, Menu, Package2, Plus, Settings, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileSiteMenu } from "@/components/mobile-site-menu";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "@/components/notification-bell";
import { isAppointmentBookingDisabled } from "@/lib/audience";
import { usePublicSiteMenuItems } from "@/hooks/use-public-site-menu-items";
import { useLocale, useT } from "@/i18n/locale";

interface NutritionTopbarProps {
  backHref?: string;
  title?: string;
  description?: string;
  onRequireLogin?: () => void;
  variant?: "default" | "hero";
  compact?: boolean;
  hideBack?: boolean;
}

export function NutritionTopbar({
  backHref = "/booking",
  title,
  onRequireLogin,
  variant = "default",
  compact = false,
  hideBack = false,
}: NutritionTopbarProps) {
  const t = useT();
  const { isRtl } = useLocale();
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "barber";
  const [menuOpen, setMenuOpen] = useState(false);
  const { tenantMeta, publicMenuItems } = usePublicSiteMenuItems({
    includeBooking: true,
    includeNutrition: false,
    showCustomerClub: !!user && !isManager,
  });
  const bookingDisabled = isAppointmentBookingDisabled(tenantMeta);
  const shouldShowBackButton = !hideBack && !(bookingDisabled && backHref === "/booking");
  const backLabel = backHref === "/booking" ? t("nutritionTopbar.backToBooking") : t("common.back");
  const menuTitle = title ?? t("nutritionTopbar.menuTitle");
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const nutritionMenuItems = user && !isManager ? [
    { key: "nutrition-home", title: t("nutritionProfileHome.menu.home"), icon: Home, href: "/nutrition/profile" },
    { key: "nutrition-diets", title: t("nutritionProfileHome.menu.diets"), icon: ClipboardList, href: "/nutrition/my-diets" },
    { key: "nutrition-new-diet", title: t("nutritionProfileHome.menu.newDiet"), icon: Plus, href: "/nutrition/diet-type" },
    { key: "nutrition-edit-profile", title: t("nutritionProfileHome.menu.editProfile"), icon: UserRound, href: "/nutrition/membership/review?edit_only=1&from=profile_home" },
    { key: "nutrition-packages", title: t("nutritionProfileHome.menu.packages"), icon: Package2, href: "/nutrition/membership/my-package" },
    { key: "nutrition-bmi", title: t("nutritionProfileHome.menu.bmi"), icon: Calculator, href: "/nutrition/bmi" },
  ] : [];

  const navigate = (href: string) => {
    setMenuOpen(false);
    setLocation(href);
  };

  const isHero = variant === "hero";
  const backButton = shouldShowBackButton ? (
    <Button
      type="button"
      variant="outline"
      onClick={() => setLocation(backHref)}
      className={
        isHero
          ? compact
            ? "h-[44px] gap-3 rounded-[17px] border-white/10 bg-zinc-900/78 px-3.5 text-[13px] font-black text-white shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md hover:bg-zinc-800/80 max-[400px]:h-[40px] max-[400px]:gap-2.5 max-[400px]:rounded-[15px] max-[400px]:px-3 max-[400px]:text-[12px]"
            : "h-[50px] rounded-[21px] border-white/10 bg-zinc-900/78 px-4 text-[15px] font-black text-white shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md hover:bg-zinc-800/80 max-[400px]:h-[44px] max-[400px]:rounded-[18px] max-[400px]:px-3 max-[400px]:text-[13px]"
          : "h-11 rounded-2xl border-white/15 bg-white/5 px-3 text-white hover:bg-white/10"
      }
    >
      {isHero ? (
        <BackIcon className={compact ? "h-4 w-4 shrink-0 text-amber-300" : "me-2 h-5 w-5 text-amber-300 max-[400px]:me-1.5 max-[400px]:h-4 max-[400px]:w-4"} />
      ) : <BackIcon className="me-2 h-4 w-4" />}
      {backLabel}
    </Button>
  ) : null;
  const actionButtons = (
    <div className="flex items-center gap-2">
      {user ? <NotificationBell onClick={() => setLocation("/notifications")} className={compact ? "text-white [&_button]:h-[44px] [&_button]:w-[44px] [&_button]:rounded-[17px] [&_svg]:h-4 [&_svg]:w-4 max-[400px]:[&_button]:h-[40px] max-[400px]:[&_button]:w-[40px] max-[400px]:[&_button]:rounded-[15px]" : "text-white [&_button]:h-[50px] [&_button]:w-[50px] [&_button]:rounded-[19px] [&_svg]:h-5 [&_svg]:w-5 max-[400px]:[&_button]:h-[44px] max-[400px]:[&_button]:w-[44px] max-[400px]:[&_button]:rounded-[17px] max-[400px]:[&_svg]:h-4 max-[400px]:[&_svg]:w-4"} /> : null}
      {isManager ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          title={t("nutritionTopbar.settingsTitle")}
          onClick={() => setLocation("/panel")}
          className={
            isHero
              ? compact
                ? "h-[44px] w-[44px] rounded-[17px] border-white/10 bg-zinc-900/78 text-white shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md hover:bg-zinc-800/80 max-[400px]:h-[40px] max-[400px]:w-[40px] max-[400px]:rounded-[15px]"
                : "h-[50px] w-[50px] rounded-[19px] border-white/10 bg-zinc-900/78 text-white shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md hover:bg-zinc-800/80 max-[400px]:h-[44px] max-[400px]:w-[44px] max-[400px]:rounded-[17px]"
              : "rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
          }
        >
          <Settings className="h-5 w-5 max-[400px]:h-4 max-[400px]:w-4" />
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="icon"
        title={t("common.menu")}
        onClick={() => setMenuOpen(true)}
        className={
          isHero
            ? compact
              ? "h-[44px] w-[44px] rounded-[17px] border-white/10 bg-zinc-900/78 text-white shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md hover:bg-zinc-800/80 max-[400px]:h-[40px] max-[400px]:w-[40px] max-[400px]:rounded-[15px]"
              : "h-[50px] w-[50px] rounded-[19px] border-white/10 bg-zinc-900/78 text-white shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md hover:bg-zinc-800/80 max-[400px]:h-[44px] max-[400px]:w-[44px] max-[400px]:rounded-[17px]"
            : "rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
        }
      >
        <Menu className={isHero ? compact ? "h-5 w-5 max-[400px]:h-4 max-[400px]:w-4" : "h-6 w-6 max-[400px]:h-5 max-[400px]:w-5" : "h-5 w-5"} />
      </Button>
    </div>
  );

  return (
    <>
      <div className={isHero ? "flex items-center justify-between gap-3 max-[400px]:gap-2" : "mb-4 flex items-center justify-between"}>
        {isHero ? actionButtons : backButton}
        {isHero ? backButton : actionButtons}
      </div>

      <MobileSiteMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={menuTitle}
        user={user}
        items={[
          ...nutritionMenuItems.map((item) => ({
            key: item.key,
            title: item.title,
            icon: item.icon,
            onSelect: () => navigate(item.href),
          })),
          ...publicMenuItems.map((item) => ({
            key: item.key,
            title: item.title,
            icon: item.icon,
            onSelect: () => navigate(item.href),
          })),
          ...(isManager ? [
            {
              key: "panel",
              title: t("nutritionTopbar.panelTitle"),
              icon: LayoutDashboard,
              onSelect: () => navigate("/panel"),
            },
            {
              key: "settings",
              title: t("nutritionTopbar.settingsTitle"),
              icon: Settings,
              onSelect: () => navigate("/settings"),
            },
          ] : []),
        ]}
        loginAction={!user ? {
          label: t("nutritionTopbar.login"),
          icon: LogIn,
          onSelect: () => {
            setMenuOpen(false);
            onRequireLogin?.();
          },
        } : null}
        logoutAction={user ? async () => {
          setMenuOpen(false);
          await logout();
          setLocation("/nutrition");
        } : null}
      />
    </>
  );
}
