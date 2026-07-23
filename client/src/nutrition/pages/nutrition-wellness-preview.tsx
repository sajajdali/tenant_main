import { useMemo, useState } from "react";
import { BadgeCheck, BookOpenText, CalendarHeart, Download, HeartPulse, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { NutritionAudioGuidance, type NutritionAudioTrack } from "@/nutrition/components/nutrition-audio-guidance";
import { cn } from "@/lib/utils";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type WellnessPage = {
  id: string;
  titleKey: MessageKey;
  subtitleKey: MessageKey;
  noteKey: MessageKey;
  paragraphKeys: MessageKey[];
  checklistKeys: MessageKey[];
  audioTrackDefs: Array<{
    id: string;
    titleKey: MessageKey;
    descriptionKey: MessageKey;
    duration: string;
    url: string;
  }>;
};

const WELLNESS_PAGES: WellnessPage[] = [
  {
    id: "page-1",
    titleKey: "nutritionWellnessPreview.pages.1.title",
    subtitleKey: "nutritionWellnessPreview.pages.1.subtitle",
    noteKey: "nutritionWellnessPreview.pages.1.note",
    paragraphKeys: ["nutritionWellnessPreview.pages.1.paragraph.1", "nutritionWellnessPreview.pages.1.paragraph.2"],
    checklistKeys: ["nutritionWellnessPreview.pages.1.checklist.1", "nutritionWellnessPreview.pages.1.checklist.2", "nutritionWellnessPreview.pages.1.checklist.3"],
    audioTrackDefs: [
      { id: "w1-a1", titleKey: "nutritionWellnessPreview.audio.w1a1.title", descriptionKey: "nutritionWellnessPreview.audio.w1a1.description", duration: "02:10", url: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3" },
      { id: "w1-a2", titleKey: "nutritionWellnessPreview.audio.w1a2.title", descriptionKey: "nutritionWellnessPreview.audio.w1a2.description", duration: "01:45", url: "https://samplelib.com/lib/preview/mp3/sample-6s.mp3" },
    ],
  },
  {
    id: "page-2",
    titleKey: "nutritionWellnessPreview.pages.2.title",
    subtitleKey: "nutritionWellnessPreview.pages.2.subtitle",
    noteKey: "nutritionWellnessPreview.pages.2.note",
    paragraphKeys: ["nutritionWellnessPreview.pages.2.paragraph.1", "nutritionWellnessPreview.pages.2.paragraph.2"],
    checklistKeys: ["nutritionWellnessPreview.pages.2.checklist.1", "nutritionWellnessPreview.pages.2.checklist.2", "nutritionWellnessPreview.pages.2.checklist.3"],
    audioTrackDefs: [
      { id: "w2-a1", titleKey: "nutritionWellnessPreview.audio.w2a1.title", descriptionKey: "nutritionWellnessPreview.audio.w2a1.description", duration: "02:00", url: "https://samplelib.com/lib/preview/mp3/sample-9s.mp3" },
    ],
  },
  {
    id: "page-3",
    titleKey: "nutritionWellnessPreview.pages.3.title",
    subtitleKey: "nutritionWellnessPreview.pages.3.subtitle",
    noteKey: "nutritionWellnessPreview.pages.3.note",
    paragraphKeys: ["nutritionWellnessPreview.pages.3.paragraph.1", "nutritionWellnessPreview.pages.3.paragraph.2"],
    checklistKeys: ["nutritionWellnessPreview.pages.3.checklist.1", "nutritionWellnessPreview.pages.3.checklist.2", "nutritionWellnessPreview.pages.3.checklist.3"],
    audioTrackDefs: [
      { id: "w3-a1", titleKey: "nutritionWellnessPreview.audio.w3a1.title", descriptionKey: "nutritionWellnessPreview.audio.w3a1.description", duration: "01:30", url: "https://samplelib.com/lib/preview/mp3/sample-12s.mp3" },
      { id: "w3-a2", titleKey: "nutritionWellnessPreview.audio.w3a2.title", descriptionKey: "nutritionWellnessPreview.audio.w3a2.description", duration: "02:20", url: "https://samplelib.com/lib/preview/mp3/sample-15s.mp3" },
    ],
  },
  {
    id: "page-4",
    titleKey: "nutritionWellnessPreview.pages.4.title",
    subtitleKey: "nutritionWellnessPreview.pages.4.subtitle",
    noteKey: "nutritionWellnessPreview.pages.4.note",
    paragraphKeys: ["nutritionWellnessPreview.pages.4.paragraph.1", "nutritionWellnessPreview.pages.4.paragraph.2"],
    checklistKeys: ["nutritionWellnessPreview.pages.4.checklist.1", "nutritionWellnessPreview.pages.4.checklist.2", "nutritionWellnessPreview.pages.4.checklist.3"],
    audioTrackDefs: [
      { id: "w4-a1", titleKey: "nutritionWellnessPreview.audio.w4a1.title", descriptionKey: "nutritionWellnessPreview.audio.w4a1.description", duration: "01:55", url: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3" },
    ],
  },
  {
    id: "page-5",
    titleKey: "nutritionWellnessPreview.pages.5.title",
    subtitleKey: "nutritionWellnessPreview.pages.5.subtitle",
    noteKey: "nutritionWellnessPreview.pages.5.note",
    paragraphKeys: ["nutritionWellnessPreview.pages.5.paragraph.1", "nutritionWellnessPreview.pages.5.paragraph.2"],
    checklistKeys: ["nutritionWellnessPreview.pages.5.checklist.1", "nutritionWellnessPreview.pages.5.checklist.2", "nutritionWellnessPreview.pages.5.checklist.3"],
    audioTrackDefs: [
      { id: "w5-a1", titleKey: "nutritionWellnessPreview.audio.w5a1.title", descriptionKey: "nutritionWellnessPreview.audio.w5a1.description", duration: "02:05", url: "https://samplelib.com/lib/preview/mp3/sample-6s.mp3" },
    ],
  },
  {
    id: "page-6",
    titleKey: "nutritionWellnessPreview.pages.6.title",
    subtitleKey: "nutritionWellnessPreview.pages.6.subtitle",
    noteKey: "nutritionWellnessPreview.pages.6.note",
    paragraphKeys: ["nutritionWellnessPreview.pages.6.paragraph.1", "nutritionWellnessPreview.pages.6.paragraph.2"],
    checklistKeys: ["nutritionWellnessPreview.pages.6.checklist.1", "nutritionWellnessPreview.pages.6.checklist.2", "nutritionWellnessPreview.pages.6.checklist.3"],
    audioTrackDefs: [
      { id: "w6-a1", titleKey: "nutritionWellnessPreview.audio.w6a1.title", descriptionKey: "nutritionWellnessPreview.audio.w6a1.description", duration: "02:15", url: "https://samplelib.com/lib/preview/mp3/sample-9s.mp3" },
      { id: "w6-a2", titleKey: "nutritionWellnessPreview.audio.w6a2.title", descriptionKey: "nutritionWellnessPreview.audio.w6a2.description", duration: "01:50", url: "https://samplelib.com/lib/preview/mp3/sample-12s.mp3" },
    ],
  },
];

const GENERAL_AUDIO_DEFS: WellnessPage["audioTrackDefs"] = [
  { id: "wellness-general-1", titleKey: "nutritionWellnessPreview.audio.general1.title", descriptionKey: "nutritionWellnessPreview.audio.general1.description", duration: "01:40", url: "https://samplelib.com/lib/preview/mp3/sample-15s.mp3" },
  { id: "wellness-general-2", titleKey: "nutritionWellnessPreview.audio.general2.title", descriptionKey: "nutritionWellnessPreview.audio.general2.description", duration: "02:10", url: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3" },
];

function buildAudioTracks(defs: WellnessPage["audioTrackDefs"], t: ReturnType<typeof useT>): NutritionAudioTrack[] {
  return defs.map((track) => ({
    id: track.id,
    title: t(track.titleKey),
    description: t(track.descriptionKey),
    duration: track.duration,
    url: track.url,
  }));
}

export default function NutritionWellnessPreviewPage() {
  const t = useT();
  const format = useFormat();
  const { dir } = useLocale();
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const selectedPage = WELLNESS_PAGES[selectedPageIndex];
  const progressLabel = useMemo(
    () => t("nutritionWellnessPreview.progress", {
      current: format.number(selectedPageIndex + 1),
      total: format.number(WELLNESS_PAGES.length),
    }),
    [format, selectedPageIndex, t],
  );
  const selectedAudioTracks = useMemo(() => buildAudioTracks(selectedPage.audioTrackDefs, t), [selectedPage.audioTrackDefs, t]);
  const generalAudioTracks = useMemo(() => buildAudioTracks(GENERAL_AUDIO_DEFS, t), [t]);

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] px-4 py-8 pb-28 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.15),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_28%),linear-gradient(180deg,rgba(6,19,29,0.97),rgba(4,10,17,1))]" />
      <div className="fixed end-[-18%] top-14 -z-10 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="fixed bottom-10 start-[-20%] -z-10 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-md space-y-5">
        <NutritionTopbar backHref="/nutrition/profile" title={t("nutritionWellnessPreview.topbarTitle")} description={t("nutritionWellnessPreview.topbarDescription")} />

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(165deg,rgba(16,29,45,0.96),rgba(9,18,30,0.92))] p-4 shadow-[0_35px_90px_-52px_rgba(0,0,0,0.95)]">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/80">
                <HeartPulse className="h-3.5 w-3.5 text-emerald-300" />
                {t("nutritionWellnessPreview.badge")}
              </div>
              <h1 className="text-[28px] font-black leading-tight">{t("nutritionWellnessPreview.title")}</h1>
              <p className="text-sm leading-7 text-slate-300">
                {t("nutritionWellnessPreview.description")}
              </p>
            </div>

            <div className="rounded-[22px] border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-center">
              <div className="text-[11px] font-bold text-emerald-200">{t("nutritionWellnessPreview.contentStructure")}</div>
              <div className="mt-1 text-lg font-black text-emerald-300">{format.number(WELLNESS_PAGES.length)}</div>
              <div className="text-[10px] text-emerald-100/80">{t("nutritionWellnessPreview.recommendationPage")}</div>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-emerald-300/20 bg-emerald-300/10 p-3">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-100">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              {t("nutritionWellnessPreview.intent")}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="text-[10px] font-bold text-slate-400">{t("nutritionWellnessPreview.stats.pageCount")}</div>
              <div className="mt-2 text-sm font-black">{format.number(WELLNESS_PAGES.length)}</div>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="text-[10px] font-bold text-slate-400">{t("nutritionWellnessPreview.stats.format")}</div>
              <div className="mt-2 text-[11px] font-black leading-5">{t("nutritionWellnessPreview.stats.formatValue")}</div>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="text-[10px] font-bold text-slate-400">{t("nutritionWellnessPreview.stats.useCase")}</div>
              <div className="mt-2 text-[11px] font-black leading-5">{t("nutritionWellnessPreview.stats.useCaseValue")}</div>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold text-slate-400">{t("nutritionWellnessPreview.selectPage")}</div>
                <div className="mt-1 text-sm font-bold text-white">{t(selectedPage.titleKey)}</div>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-slate-300">
                <BookOpenText className="h-3.5 w-3.5 text-emerald-300" />
                {progressLabel}
              </div>
            </div>

            <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {WELLNESS_PAGES.map((item, index) => {
                const active = index === selectedPageIndex;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedPageIndex(index)}
                    className={cn(
                      "min-w-[86px] rounded-[20px] border px-3 py-3 text-center transition",
                      active
                        ? "border-emerald-300/40 bg-[linear-gradient(180deg,rgba(16,185,129,0.22),rgba(16,185,129,0.1))] text-white shadow-[0_18px_45px_-28px_rgba(16,185,129,0.85)]"
                        : "border-white/10 bg-white/[0.03] text-slate-300",
                    )}
                  >
                    <div className="text-[10px] font-bold text-slate-400">{t("nutritionWellnessPreview.pageLabel")}</div>
                    <div className="mt-1 text-base font-black">{format.number(index + 1)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-cyan-400/20 bg-cyan-400/10 p-4 shadow-[0_28px_70px_-48px_rgba(34,211,238,0.65)]">
          <div className="flex items-center gap-2 text-sm font-black text-cyan-100">
            <CalendarHeart className="h-5 w-5 text-cyan-300" />
            {t(selectedPage.subtitleKey)}
          </div>
          <div className="mt-3 text-sm leading-7 text-cyan-50/90">{t(selectedPage.noteKey)}</div>
        </section>

        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-4 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.9)]">
          <div className="flex items-center gap-2 text-base font-black text-white">
            <BookOpenText className="h-5 w-5 text-emerald-300" />
            {t(selectedPage.titleKey)}
          </div>

          <div className="mt-4 space-y-3">
            {selectedPage.paragraphKeys.map((paragraphKey) => (
              <div key={paragraphKey} className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-8 text-slate-100">
                {t(paragraphKey)}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[24px] border border-emerald-300/15 bg-emerald-300/10 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-100">
              <BadgeCheck className="h-4 w-4 text-emerald-300" />
              {t("nutritionWellnessPreview.pageTips")}
            </div>
            <div className="mt-3 space-y-2">
              {selectedPage.checklistKeys.map((itemKey) => (
                <div key={itemKey} className="rounded-[18px] border border-white/10 bg-white/[0.05] px-3 py-3 text-sm leading-7 text-white">
                  {t(itemKey)}
                </div>
              ))}
            </div>
          </div>
        </section>

        <NutritionAudioGuidance
          title={t("nutritionWellnessPreview.pageAudioTitle", { page: format.number(selectedPageIndex + 1) })}
          description={t("nutritionWellnessPreview.pageAudioDescription")}
          tracks={selectedAudioTracks}
          accent="cyan"
        />

        <NutritionAudioGuidance
          title={t("nutritionWellnessPreview.generalAudioTitle")}
          description={t("nutritionWellnessPreview.generalAudioDescription")}
          tracks={generalAudioTracks}
          accent="violet"
        />

        <Button
          type="button"
          className="h-14 w-full rounded-[20px] bg-[linear-gradient(135deg,#10b981,#34d399)] font-black text-slate-950 shadow-[0_25px_60px_-28px_rgba(16,185,129,0.92)] hover:opacity-95"
        >
          {t("nutritionWellnessPreview.downloadPdf")}
          <Download className="ms-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
