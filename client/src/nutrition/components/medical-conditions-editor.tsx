import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, ClipboardPlus, Trash2 } from "lucide-react";
import DatePicker, { DateObject } from "react-multi-date-picker";
import arabic from "react-date-object/calendars/arabic";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";
import arabic_ar from "react-date-object/locales/arabic_ar";
import gregorian_en from "react-date-object/locales/gregorian_en";
import persian_fa from "react-date-object/locales/persian_fa";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { NutritionMedicalConditionItem } from "@/nutrition/lib/nutrition-form-state";
import {
  createEmptyMedicalConditionItem,
  formatMedicalConditionTimeline,
  MEDICAL_CONDITION_STATUS_OPTIONS,
} from "@/nutrition/lib/medical-conditions";
import { cn } from "@/lib/utils";

interface MedicalConditionsEditorProps {
  items: NutritionMedicalConditionItem[];
  onChange: (items: NutritionMedicalConditionItem[]) => void;
  accentClassName?: string;
  usePersianDatePicker?: boolean;
  variant?: "default" | "membership";
}

function toSafeGregorianDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

export function MedicalConditionsEditor({
  items,
  onChange,
  accentClassName = "bg-cyan-400/12 text-cyan-300",
  usePersianDatePicker = false,
  variant = "default",
}: MedicalConditionsEditorProps) {
  const { calendar, dir, isRtl, locale } = useLocale();
  const t = useT();
  const formatters = useFormat();
  const normalizedItems = items;
  const isMembership = variant === "membership";
  const pickerCalendar = calendar === "hijri" ? arabic : calendar === "jalali" ? persian : gregorian;
  const pickerLocale = calendar === "hijri" ? arabic_ar : locale === "fa" ? persian_fa : gregorian_en;
  const calendarPosition = isRtl ? "bottom-right" : "bottom-left";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftItem, setDraftItem] = useState<NutritionMedicalConditionItem | null>(null);
  const [timingExpanded, setTimingExpanded] = useState(false);

  const normalizePatchedItem = (item: NutritionMedicalConditionItem, patch: Partial<NutritionMedicalConditionItem>) => {
    const nextItem = {
      ...item,
      ...patch,
    };

    if (nextItem.status === "past") {
      nextItem.ongoing = false;
    } else if (nextItem.status === "current") {
      nextItem.ongoing = true;
    }

    if (nextItem.status !== "past") {
      nextItem.endedAt = "";
    }

    if (nextItem.ongoing) {
      nextItem.endedAt = "";
    }

    return nextItem;
  };

  const handleDraftChange = (patch: Partial<NutritionMedicalConditionItem>) => {
    setDraftItem((current) => (current ? normalizePatchedItem(current, patch) : current));
  };

  const handleRemove = (id: string) => {
    onChange(normalizedItems.filter((item) => item.id !== id));
  };

  const openAddDialog = () => {
    const nextItem = createEmptyMedicalConditionItem();
    setDraftItem(nextItem);
    setTimingExpanded(false);
    setDialogOpen(true);
  };

  const openEditDialog = (item: NutritionMedicalConditionItem) => {
    setDraftItem({ ...item });
    setTimingExpanded(Boolean(item.startedAt || item.endedAt));
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setDraftItem(null);
      setTimingExpanded(false);
    }
  };

  const handleSaveDraft = () => {
    if (!draftItem || !draftItem.title.trim()) {
      return;
    }

    const savedItem = {
      ...draftItem,
      title: draftItem.title.trim(),
      notes: String(draftItem.notes ?? "").trim(),
    };
    const existingItem = normalizedItems.some((item) => item.id === savedItem.id);

    onChange(existingItem
      ? normalizedItems.map((item) => (item.id === savedItem.id ? savedItem : item))
      : [...normalizedItems, savedItem]);
    handleDialogOpenChange(false);
  };

  return (
    <div className={cn(isMembership ? "space-y-3.5" : "space-y-4")}>
      {normalizedItems.length === 0 ? (
        <div
          className={cn(
            "text-center",
            isMembership
              ? "rounded-[24px] border border-white/10 bg-[#050a12]/72 px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              : "rounded-[28px] border border-white/10 bg-slate-950/18 px-5 py-7",
          )}
        >
          {!isMembership ? (
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/[0.05] text-slate-400">
              <ClipboardPlus className="h-7 w-7" />
            </div>
          ) : null}
          {!isMembership ? (
            <div className="mt-5 text-lg font-black text-white">{t("medicalConditionsEditor.emptyTitle")}</div>
          ) : null}
          {!isMembership ? (
            <p className="mx-auto mt-2 max-w-xs text-sm font-bold leading-7 text-slate-400">
              {t("medicalConditionsEditor.emptyDefault")}
            </p>
          ) : null}
          <button
            type="button"
            onClick={openAddDialog}
            className={cn(
              "flex w-full items-center justify-center gap-3 border border-dashed border-amber-300/65 text-amber-300 transition hover:bg-amber-400/15",
              isMembership
                ? "h-[52px] rounded-[16px] bg-transparent text-[14px] font-black"
                : "mt-6 h-14 rounded-[20px] bg-amber-400/10 text-base font-black",
            )}
          >
            <ClipboardPlus className={isMembership ? "h-4 w-4" : "h-5 w-5"} />
            {t("medicalConditionsEditor.add")}
          </button>
        </div>
      ) : null}

      {normalizedItems.map((item, index) => {
        const statusLabel = t(MEDICAL_CONDITION_STATUS_OPTIONS.find((option) => option.value === item.status)?.labelKey ?? "medicalConditionsEditor.status.current");
        const timeline = formatMedicalConditionTimeline(item, { date: (value) => formatters.date(value), t });

        return (
          <div
            key={item.id}
            id={`medical-condition-${item.id}`}
            className={cn(
              "scroll-mt-24 border border-white/10 bg-slate-950/18 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.8)]",
              isMembership ? "rounded-[22px] p-2" : "rounded-[28px] p-3",
            )}
          >
            <div className={cn("flex items-center justify-between gap-3 bg-white/[0.04]", isMembership ? "rounded-[17px] p-2.5" : "rounded-[22px] p-3")}>
              <div className={cn("flex min-w-0 items-center text-start", isMembership ? "gap-2.5" : "gap-3")}>
                <div className={cn(`flex shrink-0 items-center justify-center ${accentClassName}`, isMembership ? "h-10 w-10 rounded-[14px]" : "h-12 w-12 rounded-[18px]")}>
                  <ClipboardPlus className={isMembership ? "h-5 w-5" : "h-6 w-6"} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={cn("font-black text-white", isMembership ? "text-[12.5px]" : "text-base")}>{item.title || t("medicalConditionsEditor.fallbackTitle", { number: formatters.number(index + 1) })}</div>
                    <span className={cn("rounded-full bg-amber-400/12 font-black text-amber-200", isMembership ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs")}>{statusLabel}</span>
                  </div>
                  <div className={cn("mt-1 truncate text-slate-400", isMembership ? "text-[10.5px]" : "text-xs")}>{timeline || t("medicalConditionsEditor.itemHint")}</div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditDialog(item)}
                  className={cn("border border-white/10 bg-white/[0.04] font-black text-slate-300 transition hover:border-amber-300/35 hover:bg-amber-400/10 hover:text-amber-200", isMembership ? "h-8 rounded-[11px] px-2.5 text-[10.5px]" : "h-10 rounded-[14px] px-3 text-xs")}
                >
                  {t("medicalConditionsEditor.edit")}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className={cn("flex items-center justify-center border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-200", isMembership ? "h-8 w-8 rounded-[11px]" : "h-10 w-10 rounded-[14px]")}
                  aria-label={t("medicalConditionsEditor.delete")}
                >
                  <Trash2 className={isMembership ? "h-3 w-3" : "h-3.5 w-3.5"} />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {normalizedItems.length > 0 ? (
        <button
          type="button"
          onClick={openAddDialog}
          className={cn(
            "flex w-full items-center justify-center gap-3 border border-dashed border-amber-300/65 text-amber-300 transition hover:bg-amber-400/15",
            isMembership ? "h-[52px] rounded-[16px] bg-transparent text-[14px] font-black" : "h-14 rounded-[20px] bg-amber-400/10 text-base font-black",
          )}
        >
          <ClipboardPlus className={isMembership ? "h-4 w-4" : "h-5 w-5"} />
          {t("medicalConditionsEditor.add")}
        </button>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className={cn(
            "max-h-[90vh] overflow-y-auto border-white/10 bg-[#1e2335] text-white shadow-[0_30px_90px_-35px_rgba(0,0,0,0.95)]",
            isMembership
              ? "w-[calc(100%-34px)] max-w-[350px] gap-0 rounded-[24px] border-[#263247] bg-[#101a2a] p-0 [&>button.absolute]:start-5 [&>button.absolute]:end-auto [&>button.absolute]:top-6 [&>button.absolute]:flex [&>button.absolute]:h-[36px] [&>button.absolute]:w-[36px] [&>button.absolute]:items-center [&>button.absolute]:justify-center [&>button.absolute]:rounded-[12px] [&>button.absolute]:border [&>button.absolute]:border-white/10 [&>button.absolute]:bg-white/[0.04] [&>button.absolute]:text-slate-300 [&>button.absolute]:opacity-100 [&>button.absolute]:ring-0 [&>button.absolute]:ring-offset-0 [&>button.absolute_svg]:h-4 [&>button.absolute_svg]:w-4"
              : "max-w-[min(92vw,440px)] rounded-[28px] p-5",
          )}
          dir={dir}
        >
          <DialogHeader className={cn("text-start", isMembership ? "relative min-h-[96px] space-y-0 border-b border-white/10 px-5 pb-5 pt-7" : "space-y-3")}>
            <div className={cn("flex items-start gap-3", isMembership ? "block ps-[50px] pe-[48px]" : "")}>
              <div className={cn(`flex shrink-0 items-center justify-center ${accentClassName}`, isMembership ? "absolute start-5 top-7 h-[40px] w-[40px] rounded-[13px] border border-amber-300/20 bg-amber-400/10" : "h-12 w-12 rounded-[18px]")}>
                <ClipboardPlus className={isMembership ? "h-5 w-5" : "h-6 w-6"} />
              </div>
              <div>
                <DialogTitle className={cn("font-black text-white", isMembership ? "text-[18px] leading-8" : "text-xl")}>
                  {normalizedItems.some((item) => item.id === draftItem?.id) ? t("medicalConditionsEditor.dialog.editTitle") : t("medicalConditionsEditor.dialog.addTitle")}
                </DialogTitle>
                {!isMembership ? (
                  <DialogDescription className="mt-1 text-sm font-bold leading-6 text-slate-400">
                    {t("medicalConditionsEditor.dialog.description")}
                  </DialogDescription>
                ) : null}
              </div>
            </div>
          </DialogHeader>

          {draftItem ? (
            <div className={cn("grid", isMembership ? "gap-4 px-5 py-4" : "gap-4")}>
              <div className={cn("grid", isMembership ? "gap-2" : "gap-2")}>
                <Label className={cn("font-black text-slate-200", isMembership ? "text-start text-[12.5px]" : "text-sm text-slate-300")}>{t("medicalConditionsEditor.nameLabel")}</Label>
                <Input
                  value={draftItem.title}
                  onChange={(event) => handleDraftChange({ title: event.target.value })}
                  placeholder={t("medicalConditionsEditor.namePlaceholder")}
                  className={cn(
                    "border-white/10 bg-white/[0.06] font-black text-white placeholder:text-slate-500 focus-visible:ring-amber-400",
                    isMembership ? "h-[46px] rounded-[15px] border-amber-400 bg-[#070c14] text-start text-[12.5px]" : "h-14 rounded-[20px] text-center text-base",
                  )}
                />
              </div>

              <div className={cn("grid", isMembership ? "gap-2" : "gap-2")}>
                <Label className={cn("font-black text-slate-200", isMembership ? "text-start text-[12.5px]" : "text-sm text-slate-300")}>{t("medicalConditionsEditor.statusLabel")}</Label>
                <div
                  className={cn("grid grid-cols-3 gap-1 bg-white/[0.04] p-1", isMembership ? "rounded-[16px] border border-white/5" : "rounded-[20px]")}
                >
                  {MEDICAL_CONDITION_STATUS_OPTIONS.map((option) => {
                    const active = draftItem.status === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleDraftChange({ status: option.value })}
                        className={cn(
                          "font-black transition",
                          isMembership ? "h-[38px] rounded-[11px] text-[11px]" : "h-12 rounded-[16px] text-sm",
                          active
                            ? "bg-white text-slate-950 shadow-[0_14px_34px_-24px_rgba(255,255,255,0.95)]"
                            : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200",
                        )}
                      >
                        {t(option.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={cn("border border-white/10 bg-white/[0.035]", isMembership ? "rounded-[14px] p-3" : "rounded-[22px] p-4")}>
                <button
                  type="button"
                  onClick={() => setTimingExpanded((current) => !current)}
                  className="block w-full text-start"
                >
                  <div>
                    <div className={cn("font-black text-white", isMembership ? "text-start text-[11.5px]" : "text-sm")}>{t("medicalConditionsEditor.timing.title")}</div>
                    <div className={cn("mt-0.5 text-slate-400", isMembership ? "text-[9.5px] leading-5" : "text-xs leading-6")}>
                      {t("medicalConditionsEditor.timing.description")}
                    </div>
                  </div>

                  <div className={cn("mt-2.5 flex w-full items-center justify-center gap-1.5 border border-amber-300/35 bg-amber-400/10 px-3 font-black text-amber-200 shadow-[0_18px_40px_-28px_rgba(251,191,36,0.55)]", isMembership ? "h-[34px] rounded-[11px] text-[10.5px]" : "h-12 rounded-[18px] text-sm")}>
                    {timingExpanded ? (
                      <ChevronUp className={isMembership ? "h-3.5 w-3.5" : "h-4 w-4"} />
                    ) : (
                      <ChevronDown className={isMembership ? "h-3.5 w-3.5" : "h-4 w-4"} />
                    )}
                    {timingExpanded ? t("medicalConditionsEditor.timing.close") : t("medicalConditionsEditor.timing.open")}
                  </div>
                </button>

                {timingExpanded ? (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className={cn("grid", isMembership ? "gap-1.5" : "gap-2")}>
                      <Label className={cn("font-black text-slate-300", isMembership ? "text-[11px]" : "text-sm")}>{t("medicalConditionsEditor.startedAt")}</Label>
                      {usePersianDatePicker ? (
                        <DatePicker
                          value={draftItem.startedAt ? toSafeGregorianDate(draftItem.startedAt) : undefined}
                          onChange={(value) => {
                            const date = value as DateObject | null;
                            handleDraftChange({ startedAt: date ? format(date.toDate(), "yyyy-MM-dd") : "" });
                          }}
                          calendar={pickerCalendar}
                          locale={pickerLocale}
                          format="YYYY/MM/DD"
                          portal
                          fixMainPosition
                          calendarPosition={calendarPosition}
                          offsetY={8}
                          zIndex={9999}
                          className="bg-card w-full"
                          inputClass={isMembership
                            ? "bg-white/[0.06] border border-white/10 rounded-[12px] px-3 py-2 w-full text-center text-white text-[11px] font-bold placeholder:text-slate-500"
                            : "bg-white/[0.06] border border-white/10 rounded-[18px] p-3 w-full text-center text-white font-bold placeholder:text-slate-500"}
                          placeholder={t("medicalConditionsEditor.selectDate")}
                        />
                      ) : (
                        <div className="relative">
                          <Input
                            type="date"
                            value={draftItem.startedAt ?? ""}
                            onChange={(event) => handleDraftChange({ startedAt: event.target.value })}
                            className={cn("border-white/10 bg-white/[0.06] text-white", isMembership ? "h-9 rounded-[12px] text-[11px]" : "h-12 rounded-[18px]")}
                          />
                          <CalendarDays className={cn("pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-slate-400", isMembership ? "h-3.5 w-3.5" : "h-4 w-4")} />
                        </div>
                      )}
                    </div>

                    {draftItem.status === "past" ? (
                      <div className={cn("grid", isMembership ? "gap-1.5" : "gap-2")}>
                        <Label className={cn("font-black text-slate-300", isMembership ? "text-[11px]" : "text-sm")}>{t("medicalConditionsEditor.endedAt")}</Label>
                        {usePersianDatePicker ? (
                          <DatePicker
                            value={draftItem.endedAt ? toSafeGregorianDate(draftItem.endedAt) : undefined}
                            onChange={(value) => {
                              const date = value as DateObject | null;
                              handleDraftChange({ endedAt: date ? format(date.toDate(), "yyyy-MM-dd") : "" });
                            }}
                            calendar={pickerCalendar}
                            locale={pickerLocale}
                            format="YYYY/MM/DD"
                            portal
                            fixMainPosition
                            calendarPosition={calendarPosition}
                            offsetY={8}
                            zIndex={9999}
                            className="bg-card w-full"
                            inputClass={isMembership
                              ? "bg-white/[0.06] border border-white/10 rounded-[12px] px-3 py-2 w-full text-center text-white text-[11px] font-bold placeholder:text-slate-500"
                              : "bg-white/[0.06] border border-white/10 rounded-[18px] p-3 w-full text-center text-white font-bold placeholder:text-slate-500"}
                            placeholder={t("medicalConditionsEditor.selectDate")}
                          />
                        ) : (
                          <div className="relative">
                            <Input
                              type="date"
                              value={draftItem.endedAt ?? ""}
                              onChange={(event) => handleDraftChange({ endedAt: event.target.value })}
                              className={cn("border-white/10 bg-white/[0.06] text-white", isMembership ? "h-9 rounded-[12px] text-[11px]" : "h-12 rounded-[18px]")}
                            />
                            <CalendarDays className={cn("pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-slate-400", isMembership ? "h-3.5 w-3.5" : "h-4 w-4")} />
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {draftItem.status === "temporary" ? (
                <label className={cn("flex items-center gap-3 border border-white/10 bg-white/[0.04] px-4 py-3", isMembership ? "rounded-[16px]" : "rounded-[18px]")}>
                  <Checkbox
                    checked={Boolean(draftItem.ongoing)}
                    onCheckedChange={(checked) => handleDraftChange({ ongoing: Boolean(checked), endedAt: checked ? "" : draftItem.endedAt ?? "" })}
                  />
                  <div className={cn("font-medium text-slate-200", isMembership ? "text-[12.5px]" : "text-sm")}>{t("medicalConditionsEditor.ongoing")}</div>
                </label>
              ) : null}

              <div className="grid gap-2">
                <Label className={cn("font-black text-slate-200", isMembership ? "text-start text-[12.5px]" : "text-sm text-slate-300")}>{t("medicalConditionsEditor.notesLabel")}</Label>
                <Textarea
                  value={draftItem.notes ?? ""}
                  onChange={(event) => handleDraftChange({ notes: event.target.value })}
                  placeholder={t("medicalConditionsEditor.notesPlaceholder")}
                  className={cn("border-white/10 bg-white/[0.06] text-start text-white placeholder:text-slate-500 focus-visible:ring-amber-400", isMembership ? "min-h-[74px] rounded-[14px] bg-[#070c14] text-[12px]" : "min-h-[88px] rounded-[18px]")}
                />
              </div>
            </div>
          ) : null}

          <div className={cn("grid grid-cols-2 gap-3", isMembership ? "border-t border-white/10 px-5 py-4" : "pt-1")}>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={!draftItem?.title.trim()}
              className={cn("bg-gradient-to-l from-amber-500 to-amber-300 px-5 font-black text-slate-950 transition hover:from-amber-400 hover:to-amber-300 disabled:cursor-not-allowed disabled:from-white/10 disabled:to-white/10 disabled:text-slate-500", isMembership ? "h-[46px] rounded-[14px] text-[13px]" : "h-14 rounded-[18px] text-base")}
            >
              {t("medicalConditionsEditor.save")}
            </button>
            <button
              type="button"
              onClick={() => handleDialogOpenChange(false)}
              className={cn("bg-white/[0.06] px-5 font-black text-slate-300 transition hover:bg-white/[0.09]", isMembership ? "h-[46px] rounded-[14px] text-[13px]" : "h-14 rounded-[18px] text-base")}
            >
              {t("common.cancel")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
