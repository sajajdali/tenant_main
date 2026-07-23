import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, ChefHat, Loader2, Save, Settings2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import type { CookingRecipeFlag, CookingRecipeItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocale, useT } from "@/i18n/locale";

const FLAGS: CookingRecipeFlag[] = ["important", "popular", "frequent", "low_calorie", "vegan", "affordable"];

function toLines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function prettyJson(value: unknown) {
  return value ? JSON.stringify(value, null, 2) : "";
}

export default function PanelCookingRecipeEditPage() {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/panel/cooking-recipes/:recipeId/edit");
  const recipeId = params?.recipeId ?? "";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [recipe, setRecipe] = useState<CookingRecipeItem | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("1");
  const [sortOrder, setSortOrder] = useState("0");
  const [ingredients, setIngredients] = useState("");
  const [instructions, setInstructions] = useState("");
  const [nutrition, setNutrition] = useState("");
  const [micronutrients, setMicronutrients] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isPublished, setIsPublished] = useState(true);
  const [flags, setFlags] = useState<CookingRecipeFlag[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.cookingRecipes.show(recipeId).then((res) => {
      if (cancelled) return;
      if (!res.success) {
        setNotFound(true);
        return;
      }
      const item = res.data;
      setRecipe(item);
      setTitle(item.title);
      setDescription(item.description || "");
      setServings(String(item.servings));
      setSortOrder(String(item.sortOrder));
      setIngredients(item.ingredientsJson.join("\n"));
      setInstructions(item.instructionsJson.join("\n"));
      setNutrition(prettyJson(item.nutrition));
      setMicronutrients(prettyJson(item.micronutrients));
      setIsActive(item.isActive);
      setIsPublished(item.isPublished);
      setFlags(item.flags);
    }).catch(() => setNotFound(true)).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [recipeId]);

  const toggleFlag = (flag: CookingRecipeFlag, checked: boolean) => {
    setFlags((current) => checked ? Array.from(new Set(current.concat(flag))) : current.filter((item) => item !== flag));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ingredientsJson = toLines(ingredients);
    const instructionsJson = toLines(instructions);
    if (!title.trim() || ingredientsJson.length === 0 || instructionsJson.length === 0) {
      toast({ variant: "destructive", title: t("common.error"), description: t("panelCookingRecipeEdit.validation.required") });
      return;
    }

    let nutritionJson: CookingRecipeItem["nutrition"] = null;
    let micronutrientsJson: Record<string, number> | null = null;
    try {
      nutritionJson = nutrition.trim() ? JSON.parse(nutrition) : null;
      micronutrientsJson = micronutrients.trim() ? JSON.parse(micronutrients) : null;
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("panelCookingRecipeEdit.validation.invalidJson") });
      return;
    }

    setSaving(true);
    const res = await api.cookingRecipes.update(recipeId, {
      title: title.trim(),
      description: description.trim() || null,
      servings: Math.max(1, Number(servings) || 1),
      sortOrder: Math.max(0, Number(sortOrder) || 0),
      ingredientsJson,
      instructionsJson,
      nutrition: nutritionJson,
      micronutrients: micronutrientsJson,
      isActive,
      isPublished,
      flags,
    });
    setSaving(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelCookingRecipeEdit.toast.failed") });
      return;
    }

    toast({ title: t("panelCookingRecipeEdit.toast.saved") });
    setLocation("/panel/cooking-recipes");
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center gap-2 bg-background" dir={dir}><Loader2 className="h-5 w-5 animate-spin" />{t("panelCookingRecipeEdit.loading")}</div>;
  }

  if (notFound || !recipe) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8" dir={dir}>
        <Card className="mx-auto max-w-xl"><CardContent className="flex flex-col items-center gap-4 py-14 text-center"><ChefHat className="h-10 w-10 text-muted-foreground" /><h1 className="text-xl font-bold">{t("panelCookingRecipeEdit.notFound")}</h1><Button asChild><Link href="/panel/cooking-recipes">{t("common.back")}</Link></Button></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/[0.04] via-background to-background p-4 md:p-8" dir={dir}>
      <form onSubmit={submit} className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Button asChild variant="ghost" className="mb-3 w-fit gap-2 px-0"><Link href="/panel/cooking-recipes"><BackIcon className="h-4 w-4" />{t("panelCookingRecipeEdit.back")}</Link></Button>
            <h1 className="text-2xl font-black md:text-3xl">{t("panelCookingRecipeEdit.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("panelCookingRecipeEdit.description")}</p>
          </div>
          <Button type="submit" disabled={saving} className="min-w-36 gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t("panelCookingRecipeEdit.save")}</Button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
          <div className="space-y-6">
            <Card className="border-border/70 shadow-sm">
              <CardHeader><CardTitle>{t("panelCookingRecipeEdit.sections.basic")}</CardTitle><CardDescription>{t("panelCookingRecipeEdit.sections.basicDescription")}</CardDescription></CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="recipe-title">{t("panelCookingRecipeEdit.fields.title")}</Label><Input id="recipe-title" value={title} onChange={(event) => setTitle(event.target.value)} className="h-11" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="recipe-description">{t("panelCookingRecipeEdit.fields.description")}</Label><Textarea id="recipe-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} dir={dir} className="[direction:inherit] text-start" /></div>
                <div className="space-y-2"><Label htmlFor="recipe-servings">{t("panelCookingRecipeEdit.fields.servings")}</Label><Input id="recipe-servings" type="number" min={1} value={servings} onChange={(event) => setServings(event.target.value)} dir="ltr" className="h-11 text-start" /></div>
                <div className="space-y-2"><Label htmlFor="recipe-order">{t("panelCookingRecipeEdit.fields.sortOrder")}</Label><Input id="recipe-order" type="number" min={0} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} dir="ltr" className="h-11 text-start" /></div>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader><CardTitle>{t("panelCookingRecipeEdit.sections.content")}</CardTitle><CardDescription>{t("panelCookingRecipeEdit.sections.contentDescription")}</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2"><Label htmlFor="recipe-ingredients">{t("panelCookingRecipeEdit.fields.ingredients")}</Label><Textarea id="recipe-ingredients" value={ingredients} onChange={(event) => setIngredients(event.target.value)} rows={10} dir={dir} className="[direction:inherit] text-start leading-7" /><p className="text-xs text-muted-foreground">{t("panelCookingRecipeEdit.hints.onePerLine")}</p></div>
                <div className="space-y-2"><Label htmlFor="recipe-instructions">{t("panelCookingRecipeEdit.fields.instructions")}</Label><Textarea id="recipe-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={12} dir={dir} className="[direction:inherit] text-start leading-7" /><p className="text-xs text-muted-foreground">{t("panelCookingRecipeEdit.hints.steps")}</p></div>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" />{t("panelCookingRecipeEdit.sections.nutrition")}</CardTitle><CardDescription>{t("panelCookingRecipeEdit.sections.nutritionDescription")}</CardDescription></CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="recipe-nutrition">{t("panelCookingRecipeEdit.fields.nutrition")}</Label><Textarea id="recipe-nutrition" value={nutrition} onChange={(event) => setNutrition(event.target.value)} rows={14} dir="ltr" className="[direction:ltr] text-start font-mono text-xs" /></div>
                <div className="space-y-2"><Label htmlFor="recipe-micronutrients">{t("panelCookingRecipeEdit.fields.micronutrients")}</Label><Textarea id="recipe-micronutrients" value={micronutrients} onChange={(event) => setMicronutrients(event.target.value)} rows={14} dir="ltr" className="[direction:ltr] text-start font-mono text-xs" /></div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <Card className="border-border/70 shadow-sm">
              <CardHeader><CardTitle>{t("panelCookingRecipeEdit.sections.visibility")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-xl border p-3"><div><Label htmlFor="recipe-active" className="font-bold">{t("panelCookingRecipeEdit.fields.active")}</Label><p className="mt-1 text-xs text-muted-foreground">{t("panelCookingRecipeEdit.hints.active")}</p></div><Switch id="recipe-active" checked={isActive} onCheckedChange={setIsActive} /></div>
                <div className="flex items-center justify-between gap-4 rounded-xl border p-3"><div><Label htmlFor="recipe-published" className="font-bold">{t("panelCookingRecipeEdit.fields.published")}</Label><p className="mt-1 text-xs text-muted-foreground">{t("panelCookingRecipeEdit.hints.published")}</p></div><Switch id="recipe-published" checked={isPublished} onCheckedChange={setIsPublished} /></div>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" />{t("panelCookingRecipeEdit.sections.flags")}</CardTitle><CardDescription>{t("panelCookingRecipeEdit.sections.flagsDescription")}</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {FLAGS.map((flag) => (
                  <label key={flag} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:bg-muted/50">
                    <Checkbox checked={flags.includes(flag)} onCheckedChange={(checked) => toggleFlag(flag, checked === true)} />
                    <span className="text-sm font-semibold">{t(`panelCookingRecipes.flags.${flag}`)}</span>
                  </label>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end"><Button type="submit" disabled={saving} className="min-w-40 gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t("panelCookingRecipeEdit.save")}</Button></div>
      </form>
    </div>
  );
}
