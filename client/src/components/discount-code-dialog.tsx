import { useEffect, useState } from "react";
import { CheckCircle2, Percent, TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type AppliedDiscountCode = {
  code: string;
  discountAmount: number;
  discountType?: string;
  discountValue?: number;
};

type DiscountCodeDialogProps = {
  value?: string;
  applied?: AppliedDiscountCode | null;
  loading?: boolean;
  error?: string | null;
  onApply: (code: string) => Promise<void> | void;
  onClear?: () => void;
};

export function DiscountCodeDialog({ value = "", applied, loading = false, error, onApply, onClear }: DiscountCodeDialogProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(value);
  const t = useT();
  const format = useFormat();
  const { dir } = useLocale();

  useEffect(() => {
    setCode(value);
  }, [value]);

  useEffect(() => {
    if (applied?.code && applied.code === code.trim().toUpperCase()) {
      setOpen(false);
    }
  }, [applied?.code, code]);

  const handleApply = async () => {
    await onApply(code);
  };

  const appliedDiscountLabel = applied
    ? applied.discountType === "percent"
      ? format.percent(Number(applied.discountValue ?? 0) / 100)
      : format.currency(applied.discountAmount)
    : "";

  return (
    <>
      <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TicketPercent className="h-4 w-4 text-primary" />
              {t("discountCode.title")}
            </div>
            <div className="text-xs leading-7 text-muted-foreground">
              {t("discountCode.description")}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-2xl border-primary/30 bg-transparent" onClick={() => setOpen(true)}>
              {applied ? t("discountCode.editButton") : t("discountCode.addButton")}
            </Button>
            {applied && onClear ? (
              <Button type="button" variant="ghost" className="rounded-2xl" onClick={onClear}>
                {t("discountCode.clearButton")}
              </Button>
            ) : null}
          </div>
        </div>

        {applied ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {t("discountCode.appliedCodePrefix")} <CodeText className="font-semibold">{applied.code}</CodeText> {t("discountCode.appliedCodeSuffix")}
              </span>
            </div>
            <div className="mt-1 text-muted-foreground">
              {t("discountCode.appliedDescription", {
                type: applied.discountType === "percent" ? t("discountCode.type.percent") : t("discountCode.type.amount"),
                value: appliedDiscountLabel,
                amount: format.currency(applied.discountAmount),
              })}
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir={dir} className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-start">
              <Percent className="h-5 w-5 text-primary" />
              {t("discountCode.dialogTitle")}
            </DialogTitle>
            <DialogDescription className="text-start">
              {t("discountCode.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              dir="ltr"
              className="text-start"
              placeholder="OFF30"
            />
            {error ? <div className="text-sm text-destructive">{error}</div> : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="button" className="rounded-2xl" disabled={loading || !code.trim()} onClick={handleApply}>
              {loading ? t("discountCode.checking") : t("discountCode.applyButton")}
            </Button>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setOpen(false)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
