import { useMemo, useState } from "react";
import { ArrowLeft, Phone, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeDigits } from "@/lib/normalize";
import {
  getPanelNutritionPrescribeState,
  updatePanelNutritionPrescribeState,
} from "@/nutrition/lib/panel-nutrition-prescribe-state";
import { useLocale, useT } from "@/i18n/locale";

export default function PanelNutritionPrescribeUserPage() {
  const [, setLocation] = useLocation();
  const t = useT();
  const { dir, isRtl } = useLocale();
  const initialState = useMemo(() => getPanelNutritionPrescribeState(), []);
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isEditMode = search.get("edit") === "1";
  const [fullName, setFullName] = useState(initialState.fullName ?? initialState.selectedUser?.fullName ?? "");
  const [mobile, setMobile] = useState(initialState.mobile ?? initialState.selectedUser?.mobile ?? "");

  const isValid = fullName.trim() !== "" && /^09\d{9}$/.test(normalizeDigits(mobile));

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] px-4 py-8 pb-24 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_22%),linear-gradient(180deg,rgba(6,19,29,0.97),rgba(4,10,17,1))]" />
      <div className="relative z-10 mx-auto max-w-md space-y-5">
        <NutritionTopbar backHref="/panel/nutrition/prescribe" title={t("panelNutritionPrescribeUser.topbarTitle")} description={t("panelNutritionPrescribeUser.topbarDescription")} />

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-5">
          <div className="space-y-2 text-center">
            <div className="text-sm font-bold text-amber-300">{t("panelNutritionPrescribeUser.stepLabel")}</div>
            <h1 className="text-3xl font-black">{t("panelNutritionPrescribeUser.title")}</h1>
            <p className="text-sm leading-7 text-slate-300">{t("panelNutritionPrescribeUser.description")}</p>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <label className="text-sm font-bold text-white">{t("panelNutritionPrescribeUser.fullNameLabel")}</label>
              <div className="relative mt-2">
                <Input value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-14 rounded-[18px] border-white/10 bg-white/5 ps-11 text-white" />
                <UserRound className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <label className="text-sm font-bold text-white">{t("panelNutritionPrescribeUser.mobileLabel")}</label>
              <div className="relative mt-2" dir="ltr">
                <Input
                  value={mobile}
                  onChange={(event) => setMobile(normalizeDigits(event.target.value).replace(/\D/g, "").slice(0, 11))}
                  inputMode="numeric"
                  dir="ltr"
                  className="h-14 rounded-[18px] border-white/10 bg-white/5 pe-4 ps-11 text-white"
                />
                <Phone className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          <Button
            type="button"
            disabled={!isValid}
            onClick={() => {
              updatePanelNutritionPrescribeState({
                fullName: fullName.trim(),
                mobile: normalizeDigits(mobile),
                selectedUser: initialState.selectedUser
                  ? {
                      ...initialState.selectedUser,
                      fullName: fullName.trim(),
                      mobile: normalizeDigits(mobile),
                    }
                  : undefined,
              });
              setLocation(isEditMode ? "/panel/nutrition/prescribe/review" : "/panel/nutrition/prescribe/goal");
            }}
            className="mt-5 h-14 w-full rounded-[18px] bg-amber-400 font-black text-slate-950"
          >
            {isEditMode ? t("panelNutritionPrescribeUser.saveAndBack") : t("panelNutritionPrescribeUser.continue")}
            <ArrowLeft className={`ms-2 h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
          </Button>
        </section>
      </div>
    </div>
  );
}
