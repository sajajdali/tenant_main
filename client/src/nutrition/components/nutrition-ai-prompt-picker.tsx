import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import type { NutritionAiPromptPreset } from "@/lib/types";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n/locale";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (preset: NutritionAiPromptPreset) => void;
};

export function NutritionAiPromptPicker({ open, onOpenChange, onSelect }: Props) {
  const t = useT();
  const { dir } = useLocale();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<NutritionAiPromptPreset[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLoading(true);
    api.nutritionAiPromptPresets.list().then((result) => {
      if (result.success) {
        setItems(result.data.items ?? []);
      }

      setLoading(false);
    });
  }, [open]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return items.filter((item) => item.isActive);
    }

    return items.filter((item) => item.isActive && (`${item.title} ${item.body}`).toLowerCase().includes(keyword));
  }, [items, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="border-white/10 bg-[#101b2b] text-white sm:max-w-3xl">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2 text-start">
            <Sparkles className="h-5 w-5 text-amber-300" />
            {t("nutritionAiPromptPicker.title")}
          </DialogTitle>
          <DialogDescription className="text-start leading-7 text-slate-300">
            {t("nutritionAiPromptPicker.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("nutritionAiPromptPicker.searchPlaceholder")}
            className="border-white/10 bg-white/[0.04] ps-10 text-white"
          />
        </div>

        <div className="pretty-scrollbar max-h-[60vh] space-y-3 overflow-y-auto ps-1">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center text-sm text-slate-300">
              {t("nutritionAiPromptPicker.loading")}
            </div>
          ) : filteredItems.length ? filteredItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="font-black text-white">{item.title}</div>
              <div className="mt-2 line-clamp-4 text-sm leading-7 text-slate-300 whitespace-pre-wrap">{item.body}</div>
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  className="rounded-[16px] bg-amber-400 text-slate-950 hover:bg-amber-300"
                  onClick={() => {
                    onSelect(item);
                    onOpenChange(false);
                  }}
                >
                  {t("nutritionAiPromptPicker.use")}
                </Button>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
              {t("nutritionAiPromptPicker.empty")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
