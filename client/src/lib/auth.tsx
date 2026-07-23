import React, { createContext, useContext, useState, useEffect } from "react";
import { User, ApiResponse } from "./types";
import { api } from "./api";
import { UserProfilePayload } from "./membership";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n/locale";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
  isBarber: boolean;
  login: (phone: string, code: string) => Promise<boolean>;
  sendOtp: (phone: string) => Promise<{ ok: boolean; codeHint?: string | null }>;
  updateProfile: (payload: UserProfilePayload) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const savedUser = localStorage.getItem("barber_user");

    if (!savedUser) {
      return null;
    }

    try {
      return JSON.parse(savedUser) as User;
    } catch {
      localStorage.removeItem("barber_user");
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const t = useT();

  useEffect(() => {
    api.auth.me().then((res) => {
      if (res.success && res.data) {
        setUser(res.data);
        localStorage.setItem("barber_user", JSON.stringify(res.data));
        setIsLoading(false);
        return;
      }

      setUser(null);
      localStorage.removeItem("barber_user");
      setIsLoading(false);
    }).catch(() => {
      setUser(null);
      localStorage.removeItem("barber_user");
      setIsLoading(false);
    });
  }, []);

  const sendOtp = async (phone: string) => {
    const res = await api.auth.sendOtp(phone);
    if (res.success) {
      toast({
        title: t("auth.toast.otpSentTitle"),
        description: res.data?.codeHint
          ? t("auth.toast.demoCodeDescription", { code: res.data.codeHint })
          : t("auth.toast.otpSentDescription"),
      });
      return { ok: true, codeHint: res.data?.codeHint ?? null };
    }
    toast({ variant: "destructive", title: t("common.error"), description: res.message });
    return { ok: false, codeHint: null };
  };

  const login = async (phone: string, code: string) => {
    const res = await api.auth.login(phone, code);
    if (res.success) {
      setUser(res.data.user);
      localStorage.setItem("barber_user", JSON.stringify(res.data.user));
      toast({
        title: t("auth.toast.welcomeTitle"),
        description: res.data.user.role === "admin"
          ? t("auth.toast.adminLoginDescription")
          : t("auth.toast.userLoginDescription"),
      });
      return true;
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return false;
    }
  };
  
  const updateProfile = async (payload: UserProfilePayload) => {
      if(!user) return false;
      const res = await api.auth.updateProfile(user.id, payload);
      if (res.success) {
          setUser(res.data);
          localStorage.setItem("barber_user", JSON.stringify(res.data));
          return true;
      }
      return false;
  }

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
    localStorage.removeItem("barber_user");
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        isPrimaryAdmin: user?.role === "admin" && user?.isPrimaryAdmin === true,
        isBarber: user?.role === "barber",
        login,
        sendOtp,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
