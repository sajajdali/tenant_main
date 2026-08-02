import { useState } from "react";
import {
  CircleHelp,
  House,
  Info,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  Phone,
  PhoneCall,
  ReceiptText,
  UserRound,
  X,
} from "lucide-react";
import { LandingAuthDialog } from "@/components/landing-auth-dialog";
import { PellehBrandLogo } from "@/components/pelleh-brand-logo";
import { useLandingAuth } from "@/lib/landing-auth";
import { getLandingHeaderMenuItems, getLandingSiteSettings } from "@/lib/landing-site";

const iconMap = {
  home: House,
  about: Info,
  features: LayoutGrid,
  plans: ListChecks,
  faq: CircleHelp,
  contact: PhoneCall,
  orders: ReceiptText,
} as const;

type PellehLandingHeaderProps = {
  className?: string;
};

export function PellehLandingHeader({ className = "" }: PellehLandingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const { customer, loading: authLoading, logout } = useLandingAuth();
  const siteSettings = getLandingSiteSettings();
  const contactPhone = siteSettings.contactPhones[0] || "";
  const headerMenuItems = getLandingHeaderMenuItems().map((item) => ({ ...item, icon: iconMap[item.key] ?? House }));
  const tel = contactPhone.replace(/[^0-9+]/g, "");

  return (
    <>
      <header className={`sticky top-0 z-40 border-b border-white/10 bg-[#0e0d0bd9] backdrop-blur-xl ${className}`}>
        <div className="relative mx-auto flex max-w-[1200px] items-center justify-between gap-2.5 px-4 py-3.5 sm:gap-4 sm:px-[clamp(20px,4vw,32px)] sm:py-[clamp(14px,2.5vw,20px)]">
          <PellehBrandLogo imageClassName="h-10 w-auto max-w-[128px] object-contain sm:h-16 sm:max-w-[280px]" />

          <div className="flex shrink-0 items-center gap-2 [direction:ltr] sm:gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "بستن منو" : "منو"}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white transition hover:border-[#c9a24a]/60 sm:size-11"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            {contactPhone ? (
              <a href={`tel:${tel}`} className="flex min-w-0 flex-row items-center gap-1.5 whitespace-nowrap text-[#e0c06e] sm:gap-2.5">
                <Phone className="size-4 shrink-0 sm:size-5" />
                <span className="flex min-w-0 flex-col items-start">
                  <b className="whitespace-nowrap text-[11px] leading-4 text-white sm:text-sm" dir="ltr">{contactPhone}</b>
                  <small className="mt-0.5 whitespace-nowrap rounded-full bg-[#c9a24a]/15 px-1.5 py-0.5 text-[9px] font-black leading-4 text-[#e0c06e] sm:px-2 sm:text-[11px]">مشاوره رایگان</small>
                </span>
              </a>
            ) : null}
          </div>

          {menuOpen ? (
            <>
              <button type="button" aria-label="بستن منو" onClick={() => setMenuOpen(false)} className="fixed inset-0 top-full z-[-1] bg-black/20" />
              <div className="absolute left-[clamp(20px,4vw,32px)] top-[calc(100%+8px)] z-50 w-[min(290px,calc(100vw-40px))] rounded-2xl border border-white/10 bg-[#171512] p-2 shadow-2xl">
                {authLoading ? (
                  <div className="m-2 h-10 animate-pulse rounded-xl bg-white/5" />
                ) : customer ? (
                  <div className="mb-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[.06] p-3">
                    <div className="flex items-center gap-2 text-xs text-emerald-300"><span className="size-2 rounded-full bg-emerald-400" /> وارد شده‌اید</div>
                    <strong className="mt-1 block truncate text-sm">{customer.firstName || customer.mobile}</strong>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setMenuOpen(false); setLoginOpen(true); }} className="mb-2 flex w-full items-center justify-between rounded-xl bg-[#c9a24a] px-4 py-3 text-sm font-bold text-[#0e0d0b]">
                    <span>ورود به حساب</span>
                    <UserRound className="size-4" />
                  </button>
                )}

                {headerMenuItems.map((item) => (
                  <a key={item.key} href={item.href} onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm hover:bg-white/5">
                    <span>{item.label}</span>
                    <item.icon className="size-4 text-[#e0c06e]" />
                  </a>
                ))}

                {customer ? (
                  <>
                    <a href="/orders" onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold text-[#e0c06e] hover:bg-white/5">
                      <span>سفارش‌های من</span>
                      <ReceiptText className="size-4" />
                    </a>
                    <button type="button" onClick={() => { setMenuOpen(false); void logout(); }} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-start text-sm text-red-300 hover:bg-red-500/5">
                      <span>خروج از حساب</span>
                      <LogOut className="size-4" />
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </header>

      <LandingAuthDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}
