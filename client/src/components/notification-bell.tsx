import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnreadNotificationsCount } from "@/lib/notifications";
import { useAuth } from "@/lib/auth";
import { useFormat, useT } from "@/i18n/locale";

export function NotificationBell({
  onClick,
  variant = "outline",
  className = "",
}: {
  onClick: () => void;
  variant?: "outline" | "ghost";
  className?: string;
}) {
  const { user } = useAuth();
  const { count } = useUnreadNotificationsCount(!!user, user?.id);
  const t = useT();
  const format = useFormat();

  if (!user) {
    return null;
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <Button type="button" onClick={onClick} variant={variant} size="icon" className="rounded-2xl" aria-label={t("notifications.bellAria")}>
        <Bell className="h-5 w-5" />
      </Button>
      {count > 0 ? (
        <span className="pointer-events-none absolute -end-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">
          {count > 99 ? t("notifications.countMoreThan99") : format.number(count)}
        </span>
      ) : null}
    </div>
  );
}
