import { Headphones, Mic2, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormat, useT } from "@/i18n/locale";

export type NutritionAudioTrack = {
  id: string;
  title: string;
  description: string;
  duration: string;
  url: string;
};

interface NutritionAudioGuidanceProps {
  title?: string;
  description?: string;
  tracks: NutritionAudioTrack[];
  accent?: "amber" | "cyan" | "violet";
}

const accentStyles = {
  amber: {
    section: "border-amber-400/20 bg-[linear-gradient(160deg,rgba(251,191,36,0.12),rgba(255,255,255,0.03))] shadow-[0_28px_70px_-48px_rgba(251,191,36,0.45)]",
    badge: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    icon: "text-amber-300",
  },
  cyan: {
    section: "border-cyan-400/20 bg-cyan-400/10 shadow-[0_28px_70px_-48px_rgba(34,211,238,0.65)]",
    badge: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    icon: "text-cyan-300",
  },
  violet: {
    section: "border-violet-400/20 bg-violet-400/10 shadow-[0_28px_70px_-48px_rgba(167,139,250,0.5)]",
    badge: "border-violet-300/20 bg-violet-300/10 text-violet-100",
    icon: "text-violet-300",
  },
};

export function NutritionAudioGuidance({
  title,
  description,
  tracks,
  accent = "amber",
}: NutritionAudioGuidanceProps) {
  const styles = accentStyles[accent];
  const t = useT();
  const format = useFormat();
  const displayTitle = title ?? t("nutritionAudioGuidance.title");
  const displayDescription = description ?? t("nutritionAudioGuidance.description");

  return (
    <section className={cn("rounded-[28px] border p-4", styles.section)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <Headphones className={cn("h-5 w-5", styles.icon)} />
            {displayTitle}
          </div>
          <div className="mt-2 text-sm leading-7 text-white/80">{displayDescription}</div>
        </div>
        <div className={cn("rounded-[18px] border px-3 py-2 text-center", styles.badge)}>
          <div className="text-[11px] font-bold">{t("nutritionAudioGuidance.trackCount")}</div>
          <div className="mt-1 text-lg font-black">{format.number(tracks.length)}</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {tracks.map((track) => (
          <div key={track.id} className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-black text-white">
                  <Mic2 className={cn("h-4 w-4", styles.icon)} />
                  {track.title}
                </div>
                <div className="text-xs leading-6 text-slate-300">{track.description}</div>
              </div>
              <div className={cn("rounded-full border px-3 py-1 text-[11px] font-black", styles.badge)}>
                {track.duration}
              </div>
            </div>

            <div className="mt-3 rounded-[18px] border border-white/10 bg-[#08111a]/70 px-3 py-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-slate-400">
                <PlayCircle className={cn("h-3.5 w-3.5", styles.icon)} />
                {t("nutritionAudioGuidance.play")}
              </div>
              <audio controls preload="none" className="w-full">
                <source src={track.url} />
              </audio>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
