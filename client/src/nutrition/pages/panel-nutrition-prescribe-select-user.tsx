import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Search, UserPlus, Users } from "lucide-react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { TenantPanelUser } from "@/lib/types";
import { normalizeDigits } from "@/lib/normalize";
import {
  clearPanelNutritionPrescribeState,
  updatePanelNutritionPrescribeState,
} from "@/nutrition/lib/panel-nutrition-prescribe-state";
import { PhoneText } from "@/i18n/ltr-text";
import { useLocale, useT } from "@/i18n/locale";

export default function PanelNutritionPrescribeSelectUserPage() {
  const [, setLocation] = useLocation();
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TenantPanelUser[]>([]);

  useEffect(() => {
    clearPanelNutritionPrescribeState();
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.users.list("__all__", 1, 20, search).then((result) => {
      if (!mounted) {
        return;
      }
      if (result.success) {
        setItems(result.data.items ?? []);
      } else {
        setItems([]);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [search]);

  const filteredItems = useMemo(() => items.slice(0, 12), [items]);
  const normalizedSearchMobile = normalizeDigits(search).replace(/\D/g, "").slice(0, 11);

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] pb-24 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_22%),linear-gradient(180deg,rgba(6,19,29,0.97),rgba(4,10,17,1))]" />
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("panelNutritionPrescribeSelectUser.headerTitle")}</h1>
          </div>
          <Button
            variant="outline"
            size="icon"
            title={t("common.back")}
            className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            onClick={() => setLocation("/panel")}
          >
            <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-md space-y-5 px-4 py-6">
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-amber-400/12 text-amber-300">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <div className="text-xl font-black">{t("panelNutritionPrescribeSelectUser.title")}</div>
              <div className="mt-1 text-sm leading-7 text-slate-300">
                {t("panelNutritionPrescribeSelectUser.description")}
              </div>
            </div>
          </div>

          <div className="relative mt-5">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("panelNutritionPrescribeSelectUser.searchPlaceholder")}
              className="h-14 rounded-[20px] border-white/10 bg-white/5 ps-12 text-white placeholder:text-slate-500"
            />
            <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          <Button
            type="button"
            onClick={() => {
              updatePanelNutritionPrescribeState({
                isNewUser: true,
                selectedUser: null,
                fullName: "",
                mobile: normalizedSearchMobile,
              });
              setLocation("/panel/nutrition/prescribe/user");
            }}
            className="mt-4 h-14 w-full rounded-[20px] bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] font-black text-slate-950"
          >
            <UserPlus className="me-2 h-5 w-5" />
            {t("panelNutritionPrescribeSelectUser.newUser")}
          </Button>
        </section>

        <section className="space-y-3">
          {loading ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 text-center text-slate-300">{t("panelNutritionPrescribeSelectUser.loading")}</div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 text-center text-slate-300">{t("panelNutritionPrescribeSelectUser.empty")}</div>
          ) : (
            filteredItems.map((item, index) => (
              <button
                key={`${item.mobile}-${index}`}
                type="button"
                onClick={() => {
                  updatePanelNutritionPrescribeState({
                    isNewUser: false,
                    selectedUser: {
                      id: item.id ?? null,
                      fullName: item.fullName,
                      mobile: item.mobile,
                      gender: item.gender ?? null,
                      birthDate: item.birthDate ?? null,
                    },
                    fullName: item.fullName,
                    mobile: item.mobile,
                    gender: item.gender ?? undefined,
                    birthDate: item.birthDate ?? undefined,
                  });
                  setLocation(`/panel/nutrition/prescribe/users/${encodeURIComponent(item.mobile)}`);
                }}
                className="w-full rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-4 text-start"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-white">{item.fullName || t("panelNutritionPrescribeSelectUser.unnamedUser")}</div>
                    <div className="mt-1 text-sm text-slate-300"><PhoneText>{item.mobile}</PhoneText></div>
                    <div className="mt-2 text-xs text-slate-400">{t("panelNutritionPrescribeSelectUser.selectHint")}</div>
                  </div>
                  <ArrowLeft className={`h-4 w-4 text-amber-300 ${isRtl ? "" : "rotate-180"}`} />
                </div>
              </button>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
