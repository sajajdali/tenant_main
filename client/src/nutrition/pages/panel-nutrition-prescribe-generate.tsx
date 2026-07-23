import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BrainCircuit, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useLocation } from "wouter";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { getPanelNutritionPrescribeState } from "@/nutrition/lib/panel-nutrition-prescribe-state";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { NutritionAiPromptPicker } from "@/nutrition/components/nutrition-ai-prompt-picker";
import { PhoneText } from "@/i18n/ltr-text";
import { useLocale, useT } from "@/i18n/locale";

export default function PanelNutritionPrescribeGeneratePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const { dir, isRtl } = useLocale();
  const state = useMemo(() => getPanelNutritionPrescribeState(), []);
  const [submitting, setSubmitting] = useState(false);
  const [expertNotes, setExpertNotes] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [generationInstructions, setGenerationInstructions] = useState("");
  const [mustInclude, setMustInclude] = useState("");
  const [mustAvoid, setMustAvoid] = useState("");
  const [promptPickerOpen, setPromptPickerOpen] = useState(false);

  useEffect(() => {
    if (!state.mobile || !state.selectedNutritionPackageId || !state.selectedDietTemplateId) {
      setLocation("/panel/nutrition/prescribe/review");
    }
  }, [setLocation, state.mobile, state.selectedDietTemplateId, state.selectedNutritionPackageId]);

  if (!state.mobile || !state.selectedNutritionPackageId || !state.selectedDietTemplateId) {
    return null;
  }

  const handleGenerate = async () => {
    setSubmitting(true);
    const result = await api.nutritionAdminUsers.createDietRequest({
      mobile: state.mobile!,
      nutritionDietTemplateId: state.selectedDietTemplateId!,
      requestType: "ai",
      expertNotes,
      clinicalNotes,
      generationInstructions,
      mustInclude,
      mustAvoid,
    });

    if (result.success) {
      toast({
        title: t("panelNutritionPrescribeGenerate.toast.created"),
        description: t("panelNutritionPrescribeGenerate.toast.createdDescription"),
      });
      setLocation(`/panel/nutrition/requests/${result.data.requestId}`);
    } else {
      toast({
        variant: "destructive",
        title: t("panelNutritionPrescribeGenerate.toast.createFailed"),
        description: result.message,
      });
    }

    setSubmitting(false);
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] px-4 py-8 pb-24 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_22%),linear-gradient(180deg,rgba(6,19,29,0.97),rgba(4,10,17,1))]" />
      <div className="relative z-10 mx-auto max-w-3xl space-y-5">
        <NutritionTopbar backHref="/panel/nutrition/prescribe/templates" title={t("panelNutritionPrescribeGenerate.topbarTitle")} description={t("panelNutritionPrescribeGenerate.topbarDescription")} />

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-amber-400/12 text-amber-300">
              <Wand2 className="h-8 w-8" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-300">{t("panelNutritionPrescribeGenerate.stepLabel")}</div>
              <h1 className="mt-1 text-3xl font-black">{t("panelNutritionPrescribeGenerate.title")}</h1>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs text-slate-400">{t("panelNutritionPrescribeGenerate.summary.user")}</div>
              <div className="mt-2 font-black">{state.fullName || t("common.valueMissing")}</div>
              <div className="mt-1 text-sm text-slate-300"><PhoneText>{state.mobile}</PhoneText></div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs text-slate-400">{t("panelNutritionPrescribeGenerate.summary.package")}</div>
              <div className="mt-2 font-black">{state.selectedNutritionPackageName || t("common.valueMissing")}</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs text-slate-400">{t("panelNutritionPrescribeGenerate.summary.template")}</div>
              <div className="mt-2 font-black">{state.selectedDietTemplateName || t("common.valueMissing")}</div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-6">
          <div className="flex items-center gap-2 text-lg font-black">
            <BrainCircuit className="h-5 w-5 text-amber-300" />
            {t("panelNutritionPrescribeGenerate.expertInputTitle")}
          </div>
          <div className="mt-1 text-sm leading-7 text-slate-300">
            {t("panelNutritionPrescribeGenerate.expertInputDescription")}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-bold">{t("panelNutritionPrescribeGenerate.field.expertNotes")}</div>
              <Textarea value={expertNotes} onChange={(event) => setExpertNotes(event.target.value)} className="min-h-[170px] rounded-[22px] border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-bold">{t("panelNutritionPrescribeGenerate.field.clinicalNotes")}</div>
              <Textarea value={clinicalNotes} onChange={(event) => setClinicalNotes(event.target.value)} className="min-h-[170px] rounded-[22px] border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="text-sm font-bold">{t("panelNutritionPrescribeGenerate.field.generationInstructions")}</div>
              <div className="flex justify-start">
                <Button type="button" variant="outline" className="rounded-[14px] border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => setPromptPickerOpen(true)}>
                  {t("panelNutritionPrescribeGenerate.useReadyPrompt")}
                </Button>
              </div>
              <Textarea value={generationInstructions} onChange={(event) => setGenerationInstructions(event.target.value)} className="min-h-[170px] rounded-[22px] border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-bold">{t("panelNutritionPrescribeGenerate.field.mustInclude")}</div>
              <Textarea value={mustInclude} onChange={(event) => setMustInclude(event.target.value)} className="min-h-[150px] rounded-[22px] border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-bold">{t("panelNutritionPrescribeGenerate.field.mustAvoid")}</div>
              <Textarea value={mustAvoid} onChange={(event) => setMustAvoid(event.target.value)} className="min-h-[150px] rounded-[22px] border-white/10 bg-white/5 text-white" />
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm leading-7 text-cyan-100">
            <div className="flex items-center gap-2 font-black">
              <Sparkles className="h-4 w-4" />
              {t("panelNutritionPrescribeGenerate.afterSubmitTitle")}
            </div>
            <div className="mt-2">
              {t("panelNutritionPrescribeGenerate.afterSubmitDescription")}
            </div>
          </div>

          <Button type="button" disabled={submitting} onClick={() => void handleGenerate()} className="mt-5 h-14 w-full rounded-[18px] bg-amber-400 font-black text-slate-950">
            {submitting ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <Wand2 className="me-2 h-5 w-5" />}
            {t("panelNutritionPrescribeGenerate.submit")}
            <ArrowLeft className={`ms-2 h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
          </Button>
        </section>
      </div>

      <NutritionAiPromptPicker
        open={promptPickerOpen}
        onOpenChange={setPromptPickerOpen}
        onSelect={(preset) => {
          setGenerationInstructions(preset.body);
        }}
      />
    </div>
  );
}
