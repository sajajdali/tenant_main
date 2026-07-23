import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { User } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { PhoneText } from "@/i18n/ltr-text";

export type MobileSiteMenuItem = {
  key: string;
  title: string;
  icon: LucideIcon;
  onSelect: () => void | Promise<void>;
  badge?: number | null;
};

interface MobileSiteMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  user?: User | null;
  accountLabel?: string;
  accountExtra?: ReactNode;
  items: MobileSiteMenuItem[];
  loginAction?: {
    label: string;
    icon: LucideIcon;
    onSelect: () => void | Promise<void>;
  } | null;
  logoutAction?: (() => void | Promise<void>) | null;
}

export function MobileSiteMenu({
  open,
  onOpenChange,
  title,
  user = null,
  accountLabel,
  accountExtra,
  items,
  loginAction = null,
  logoutAction = null,
}: MobileSiteMenuProps) {
  const t = useT();
  const formatValue = useFormat();
  const { dir, isRtl } = useLocale();
  const resolvedTitle = title ?? t("common.menu");
  const resolvedAccountLabel = accountLabel ?? t("auth.accountLabel");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRtl ? "right" : "left"}
        closeClassName="end-5 start-auto top-5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-primary/35 bg-primary/10 p-0 opacity-100 ring-0 hover:bg-primary/18 [&>svg]:h-4 [&>svg]:w-4"
        className="w-[82vw] max-w-[20rem] border-border bg-card/98 p-0"
        dir={dir}
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="items-end border-b border-border px-5 py-5 text-start sm:text-start">
            <SheetTitle className="w-full pe-14 ps-2 text-start text-2xl font-black leading-8">{resolvedTitle}</SheetTitle>
          </SheetHeader>

          <div className="pretty-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {user ? (
              <div className="rounded-[1.2rem] border border-border/70 bg-background/35 px-4 py-3.5 text-start">
                <div className="text-xs font-bold text-muted-foreground">{resolvedAccountLabel}</div>
                <div className="mt-2 font-bold text-start">{user.name || <PhoneText>{user.phone}</PhoneText>}</div>
                {user.name ? (
                  <div className="mt-1 text-sm text-muted-foreground">
                    <PhoneText>{user.phone}</PhoneText>
                  </div>
                ) : null}
                {accountExtra ? <div className="mt-3">{accountExtra}</div> : null}
              </div>
            ) : null}

            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => void item.onSelect()}
                  className="flex w-full items-center gap-3 rounded-[1rem] border border-border/70 bg-background/30 px-3.5 py-2.5 text-start transition hover:border-primary/35 hover:bg-background/45"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.95rem] bg-primary/12 text-primary">
                    <item.icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1 text-start">
                    <div className="truncate text-[14px] font-black text-foreground">{item.title}</div>
                  </div>
                  {item.badge ? (
                    <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                      {formatValue.number(item.badge)}
                    </span>
                  ) : null}
                </button>
              ))}

              {!user && loginAction ? (
                <button
                  type="button"
                  onClick={() => void loginAction.onSelect()}
                  className="flex w-full items-center gap-3 rounded-[1rem] bg-primary px-3.5 py-2.5 text-start text-primary-foreground shadow-lg shadow-primary/15 transition hover:opacity-95"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.95rem] bg-black/10 text-primary-foreground">
                    <loginAction.icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1 text-start">
                    <div className="truncate text-[14px] font-black">{loginAction.label}</div>
                  </div>
                </button>
              ) : null}
            </div>
          </div>

          {user && logoutAction ? (
            <div className="shrink-0 border-t border-border bg-card/98 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              <Button
                type="button"
                className="h-12 w-full justify-between rounded-[1rem] border border-red-400/40 bg-red-500 px-4 text-[15px] font-black text-white shadow-[0_18px_40px_-24px_rgba(239,68,68,0.9)] hover:bg-red-600"
                onClick={() => void logoutAction()}
              >
                <span>{t("auth.logout")}</span>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
