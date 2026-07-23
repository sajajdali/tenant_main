import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useLocale, useT } from "@/i18n/locale";

type SupportExpiredLockProps = {
  businessLabel: string;
  isAdmin?: boolean;
};

export function SupportExpiredLock({ businessLabel, isAdmin = false }: SupportExpiredLockProps) {
  const { dir } = useLocale();
  const t = useT();

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
      <div className="max-w-md w-full text-center space-y-4">
        <ShieldAlert className="w-12 h-12 mx-auto text-destructive" />
        <h1 className="text-xl font-bold">{t("supportExpired.title", { business: businessLabel })}</h1>
        <p className="text-muted-foreground leading-8">
          {t("supportExpired.description", { business: businessLabel })}
        </p>
        <div className="flex justify-center gap-3">
          {isAdmin ? (
            <Link href="/panel/support-renewal">
              <Button>{t("supportExpired.renew")}</Button>
            </Link>
          ) : (
            <Button disabled>{t("supportExpired.renew")}</Button>
          )}
          <Link href="/">
            <Button variant="outline">{t("supportExpired.back")}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
