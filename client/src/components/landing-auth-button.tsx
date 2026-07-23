import { Button } from "@/components/ui/button";
import { LogIn, LogOut } from "lucide-react";
import { useLandingAuth } from "@/lib/landing-auth";
import { useT } from "@/i18n/locale";

interface LandingAuthButtonProps {
  onLoginClick: () => void;
}

export function LandingAuthButton({ onLoginClick }: LandingAuthButtonProps) {
  const { customer, logout } = useLandingAuth();
  const t = useT();

  if (customer) {
    return (
      <Button
        variant="outline"
        className="h-10 rounded-2xl border-border bg-background/40 px-3 text-xs sm:text-sm"
        onClick={() => void logout()}
      >
        <LogOut className="me-2 h-4 w-4" />
        {t("auth.logout")}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      className="h-10 rounded-2xl border-border bg-background/40 px-3 text-xs sm:text-sm"
      onClick={onLoginClick}
    >
      <LogIn className="me-2 h-4 w-4" />
      {t("auth.login")}
    </Button>
  );
}
