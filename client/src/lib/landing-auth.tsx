import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";
import type { LandingCustomer } from "./types";
import { getInitialTenantMeta } from "./bootstrap";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n/locale";

type LandingAuthContextType = {
  customer: LandingCustomer | null;
  isAuthenticated: boolean;
  loading: boolean;
  sendOtp: (mobile: string) => Promise<{ ok: boolean; codeHint?: string | null }>;
  login: (mobile: string, code: string) => Promise<boolean>;
  updateProfile: (payload: {
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
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const LandingAuthContext = createContext<LandingAuthContextType | undefined>(undefined);

export function LandingCustomerProvider({ children }: { children: React.ReactNode }) {
  const meta = getInitialTenantMeta();
  const isLandingDomain = meta?.isLandingDomain === true;
  const { toast } = useToast();
  const t = useT();
  const [customer, setCustomer] = useState<LandingCustomer | null>(null);
  const [loading, setLoading] = useState(isLandingDomain);

  const refresh = async () => {
    if (!isLandingDomain) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const res = await api.landingAuth.me();
    setCustomer(res.success ? res.data : null);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [isLandingDomain]);

  const sendOtp = async (mobile: string) => {
    const res = await api.landingAuth.sendOtp(mobile);
    if (res.success) {
      toast({
        title: t("landingAuth.otpSentTitle"),
        description: res.data?.codeHint
          ? t("auth.toast.demoCodeDescription", { code: res.data.codeHint })
          : t("landingAuth.otpSentDescription"),
      });
      return { ok: true, codeHint: res.data?.codeHint ?? null };
    }

    toast({ variant: "destructive", title: t("common.error"), description: res.message });
    return { ok: false, codeHint: null };
  };

  const login = async (mobile: string, code: string) => {
    const res = await api.landingAuth.login(mobile, code);
    if (res.success) {
      setCustomer(res.data.customer);
      toast({ title: t("landingAuth.loginSuccessTitle"), description: t("landingAuth.loginSuccessDescription") });
      return true;
    }

    toast({ variant: "destructive", title: t("common.error"), description: res.message });
    return false;
  };

  const updateProfile = async (payload: {
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
  }) => {
    const res = await api.landingAuth.updateProfile(payload);
    if (res.success) {
      setCustomer(res.data);
      toast({ title: t("landingAuth.profileSavedTitle"), description: t("landingAuth.profileSavedDescription") });
      return true;
    }

    toast({ variant: "destructive", title: t("common.error"), description: res.message });
    return false;
  };

  const logout = async () => {
    await api.landingAuth.logout();
    setCustomer(null);
    toast({ title: t("landingAuth.logoutSuccessTitle") });
  };

  return (
    <LandingAuthContext.Provider
      value={{
        customer,
        isAuthenticated: !!customer,
        loading,
        sendOtp,
        login,
        updateProfile,
        logout,
        refresh,
      }}
    >
      {children}
    </LandingAuthContext.Provider>
  );
}

export function useLandingAuth() {
  const context = useContext(LandingAuthContext);
  if (!context) {
    throw new Error("useLandingAuth must be used within LandingCustomerProvider");
  }
  return context;
}
