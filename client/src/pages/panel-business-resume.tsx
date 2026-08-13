import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BriefcaseBusiness, Building2, ExternalLink, ImagePlus, Loader2, Save, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type TemplateType = "personal" | "beauty_salon";
type ResumeState = { templateType: TemplateType | null; published: boolean; sections: Record<string, boolean>; content: Record<string, any>; publicUrl: string };
const empty: ResumeState = { templateType: null, published: false, sections: {}, content: {}, publicUrl: "/resume" };
const linesCount = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean).length;
const personalSample = {
  heroImage: "https://images.unsplash.com/photo-1702865272115-5afdbae975af?w=1200&q=80&auto=format&fit=crop",
  profileImage: "https://images.unsplash.com/photo-1618049049816-43a00d5b0c3d?w=500&q=80&auto=format&fit=crop",
  title: "سالن آرایشگاه 2B STYLE", subtitle: "بابک بشیری · پیرایشگر و استایلیست مو", ctaLabel: "رزرو نوبت آنلاین",
  stats: "۱۲ | سال تجربه\n۴٫۹ | امتیاز مشتریان\n+۳۰۰۰ | نوبت انجام‌شده",
  about: "از سال ۱۳۹۳ در حرفه پیرایش مردانه فعالیت می‌کنم. تمرکزم روی کوتاهی‌های فید، اصلاح ریش با تیغ و طراحی فرم صورت است. هر نوبت با وقت اختصاصی و بدون انتظار انجام می‌شود.",
  specialties: "کوتاهی فید و محو\nاصلاح ریش با تیغ\nرنگ و مش\nکراتینه و احیا\nپاکسازی صورت\nاستایل داماد",
  timeline: "مدیر و استایلیست ارشد — 2B STYLE | ۱۳۹۹ تا امروز · تهران |\nدوره تخصصی باربرینگ اروپایی | ۱۳۹۷ · مدرک بین‌المللی |\nپیرایشگر — سالن رویال | ۱۳۹۳ تا ۱۳۹۹ |",
  gallery: "https://images.unsplash.com/photo-1593702275687-f8b402bf1fb5?w=600&q=80&auto=format&fit=crop | کوتاهی و استایل کلاسیک\nhttps://images.unsplash.com/photo-1630827020718-3433092696e7?w=600&q=80&auto=format&fit=crop | فید و محو حرفه‌ای\nhttps://images.unsplash.com/photo-1635273051839-003bf06a8751?w=600&q=80&auto=format&fit=crop | اصلاح و فرم‌دهی ریش\nhttps://images.unsplash.com/photo-1567894340315-735d7c361db0?w=600&q=80&auto=format&fit=crop | استایل داماد\nhttps://images.unsplash.com/photo-1568339434343-2a640a1a9946?w=600&q=80&auto=format&fit=crop | رنگ و مش مو\nhttps://images.unsplash.com/photo-1578390432942-d323db577792?w=600&q=80&auto=format&fit=crop | پاکسازی و مراقبت صورت",
  services: "کوتاهی مو | ۴۵ دقیقه | ۲۵۰٬۰۰۰ تومان | مشاوره فرم صورت و انتخاب مدل، کوتاهی با قیچی و ماشین، محو کردن خط‌ها و فینیش با حالت‌دهنده مناسب جنس مو. شست‌وشوی مو پیش از کوتاهی هم در همین سرویس انجام می‌شود.\nاصلاح ریش | ۳۰ دقیقه | ۱۵۰٬۰۰۰ تومان | فرم‌دهی ریش با تیغ، حوله گرم و روغن مراقبت پس از اصلاح.\nکوتاهی + ریش | ۷۵ دقیقه | ۳۶۰٬۰۰۰ تومان | پکیج کامل استایل شامل کوتاهی مو، اصلاح و فرم‌دهی ریش و پاکسازی سریع صورت. مناسب مراسم و عکاسی؛ در پایان یک بار آموزش حالت‌دادن مو در خانه هم داده می‌شود.\nرنگ و مش | ۹۰ دقیقه | از ۵۰۰٬۰۰۰ تومان | انتخاب رنگ متناسب با رنگ پوست، مش فویلی یا سایه‌روشن، و ترمیم و مراقبت مو پس از رنگ با ماسک پروتئینه. قیمت بسته به بلندی مو و تعداد رنگ متفاوت است.",
  reviews: "امیر ک. | ★★★★★ | دقیقاً سر ساعت نوبت انجام شد، بدون معطلی. فید تمیز و حرفه‌ای.\nسعید ر. | ★★★★★ | بهترین اصلاح ریشی که تا حالا داشتم. رزرو آنلاین هم خیلی راحته.\nمحمد ط. | ★★★★☆ | محیط تمیز و آرام. فقط پارکینگ نداره ولی کوچه پشتی جا هست.\nرضا ن. | ★★★★★ | برای عروسی برادرم استایل داماد گرفتم، همه پرسیدن کجا رفتی.\nحسین ب. | ★★★★★ | رنگ مو دقیقاً همون شد که خواستم، بدون آسیب به مو.\nعلی ص. | ★★★★☆ | کیفیت کار عالیه. کمی زودتر برسید چون سالن شلوغ می‌شه.\nمهدی ف. | ★★★★★ | سه ساله مشتری ثابتشم. هیچ‌وقت نوبتم جابه‌جا یا کنسل نشده.",
  contact: "تهران، سعادت‌آباد، بلوار دریا، پلاک ۱۲۸، طبقه اول\n021-2233 4455\nشنبه تا پنجشنبه · ۰۹:۰۰ تا ۲۲:۰۰",
};

const commonSections = [
  ["hero", "معرفی اصلی", "نام، عنوان، تصویر اصلی و وضعیت باز بودن"],
  ["about", "درباره", "معرفی کوتاه و تصویر شخص یا مدیر"],
  ["stats", "آمار برجسته", "سه عدد کوتاه مانند تجربه، امتیاز و تعداد نوبت"],
  ["services", "خدمات", "هر خط: نام | مدت | قیمت | توضیح"],
  ["gallery", "نمونه کارها", "هر خط: آدرس تصویر | عنوان نمونه‌کار؛ با انتخاب عکس، عنوان آن در نمایش بزرگ نشان داده می‌شود."],
  ["reviews", "نظر مشتریان", "هر خط: نام | امتیاز | متن نظر"],
  ["contact", "تماس و آدرس", "تلفن، آدرس، ساعت کاری و لینک مسیریابی"],
] as const;

export default function PanelBusinessResumePage() {
  const { toast } = useToast();
  const [state, setState] = useState<ResumeState>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { api.businessResume.get().then((result) => { if (result.success) setState(result.data); else toast({ variant: "destructive", title: "خطا در دریافت رزومه", description: result.message }); setLoading(false); }); }, [toast]);
  const content = (key: string) => String(state.content[key] ?? "");
  const setContent = (key: string, value: string) => setState((old) => ({ ...old, content: { ...old.content, [key]: value } }));
  const toggle = (key: string, checked: boolean) => setState((old) => ({ ...old, sections: { ...old.sections, [key]: checked } }));
  const upload = async (event: React.ChangeEvent<HTMLInputElement>, target: string, multi = false) => {
    const files = Array.from(event.target.files ?? []); if (!files.length) return;
    setUploading(true); const urls: string[] = [];
    for (const file of files) { const result = await api.businessResume.upload(file); if (result.success) urls.push(result.data.url); else toast({ variant: "destructive", title: "آپلود ناموفق بود", description: result.message }); }
    setUploading(false); if (urls.length) setContent(target, multi ? [content(target), ...urls.map((url, index) => `${url} | نمونه‌کار ${content(target) ? linesCount(content(target)) + index + 1 : index + 1}`)].filter(Boolean).join("\n") : urls[0]);
  };
  const save = async () => { setSaving(true); const result = await api.businessResume.save(state); setSaving(false); if (result.success) { setState(result.data); toast({ title: "رزومه ذخیره شد" }); } else toast({ variant: "destructive", title: "ذخیره انجام نشد", description: result.message }); };
  const selectTemplate = (templateType: TemplateType) => setState((old) => ({ ...old, templateType, sections: old.templateType === templateType ? old.sections : { hero: true, about: true, stats: true, services: true, gallery: true, reviews: true, contact: true, ...(templateType === "personal" ? { timeline: true, specialties: true } : { manager: true, team: true, categories: true }) }, content: old.templateType === null && templateType === "personal" ? personalSample : old.content }));

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  return <div className="min-h-screen bg-background pb-24 text-foreground" dir="rtl"><header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur"><div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><div><h1 className="font-bold">رزومه عمومی</h1><p className="text-xs text-muted-foreground">تمام محتوا دستی است و فقط بخش‌های فعال منتشر می‌شوند.</p></div><Link href="/panel"><Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button></Link></div></header><main className="container mx-auto max-w-6xl space-y-5 px-4 py-5">
    {!state.templateType ? <TemplateSelector onSelect={selectTemplate} /> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4"><div><div className="font-semibold">{state.templateType === "personal" ? "رزومه شخصی" : "رزومه سالن زیبایی"}</div><p className="text-sm text-muted-foreground">انتخاب نوع، ترتیب و چیدمان صفحه عمومی را مشخص می‌کند.</p></div><div className="flex items-center gap-3"><Label htmlFor="publish">انتشار عمومی</Label><Switch id="publish" checked={state.published} onCheckedChange={(value) => setState((old) => ({ ...old, published: value }))} /><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ذخیره</Button></div></div>
      <div className="flex flex-wrap gap-4"><a className="inline-flex items-center gap-2 text-sm text-primary underline" href="/resume?preview=1" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> پیش‌نمایش</a>{state.published ? <a className="inline-flex items-center gap-2 text-sm text-primary underline" href={state.publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> مشاهده رزومه منتشرشده</a> : null}</div>
      <Section title="تصاویر" description="تصویر اصلی، پرتره یا لوگو، نقشه و نمونه‌کارها را اینجا آپلود کنید." enabled={true}><div className="grid gap-3 sm:grid-cols-4"><MediaField label="تصویر اصلی" value={content("heroImage")} onUpload={(e) => upload(e, "heroImage")} /><MediaField label={state.templateType === "personal" ? "پرتره" : "لوگو یا تصویر مدیر"} value={content("profileImage")} onUpload={(e) => upload(e, "profileImage")} /><MediaField label="تصویر نقشه" value={content("mapImage")} onUpload={(e) => upload(e, "mapImage")} /><MediaField label="نمونه‌کارها" value={content("gallery")} onUpload={(e) => upload(e, "gallery", true)} multiple /></div></Section>
      {commonSections.map(([key, title, description]) => <Section key={key} title={title} description={description} enabled={!!state.sections[key]} onToggle={(v) => toggle(key, v)}>{key === "hero" ? <><div className="grid gap-3 sm:grid-cols-2"><Field label="نام یا عنوان اصلی" value={content("title")} onChange={(v) => setContent("title", v)} /><Field label="زیرعنوان" value={content("subtitle")} onChange={(v) => setContent("subtitle", v)} /><Field label="متن دکمه رزرو" value={content("ctaLabel") || "رزرو نوبت آنلاین"} onChange={(v) => setContent("ctaLabel", v)} /></div><p className="mt-3 text-xs text-muted-foreground">وضعیت «باز / بسته» و ساعت آن، به‌صورت خودکار از برنامه کاری سرویس‌های فعال امروز خوانده می‌شود.</p></> : <TextAreaField label={description} value={content(key)} onChange={(v) => setContent(key, v)} />}</Section>)}
      {state.templateType === "personal" ? <><Section title="تخصص‌ها" description="هر خط یک تخصص" enabled={!!state.sections.specialties} onToggle={(v) => toggle("specialties", v)}><TextAreaField label="تخصص‌ها" value={content("specialties")} onChange={(v) => setContent("specialties", v)} /></Section><Section title="سوابق و مدارک" description="هر خط: عنوان | بازه زمانی | توضیح" enabled={!!state.sections.timeline} onToggle={(v) => toggle("timeline", v)}><TextAreaField label="سوابق" value={content("timeline")} onChange={(v) => setContent("timeline", v)} /></Section></> : <><Section title="مدیر سالن" description="نام و معرفی کوتاه مدیر" enabled={!!state.sections.manager} onToggle={(v) => toggle("manager", v)}><TextAreaField label="مدیر" value={content("manager")} onChange={(v) => setContent("manager", v)} /></Section><Section title="تیم متخصصان" description="هر خط: نام | تخصص | آدرس تصویر" enabled={!!state.sections.team} onToggle={(v) => toggle("team", v)}><TextAreaField label="تیم" value={content("team")} onChange={(v) => setContent("team", v)} /></Section><Section title="دسته‌بندی خدمات" description="هر خط یک دسته، مثل مو یا ناخن" enabled={!!state.sections.categories} onToggle={(v) => toggle("categories", v)}><TextAreaField label="دسته‌ها" value={content("categories")} onChange={(v) => setContent("categories", v)} /></Section></>}
    </>}</main>{uploading ? <div className="fixed bottom-5 start-5 rounded bg-foreground px-3 py-2 text-sm text-background">در حال آپلود تصویر...</div> : null}</div>;
}
function TemplateSelector({ onSelect }: { onSelect: (type: TemplateType) => void }) { return <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2"><TemplateCard icon={<UserRound />} title="رزومه شخصی" text="برای یک متخصص و نمونه‌کارها، تخصص‌ها و سوابق شخصی او." onClick={() => onSelect("personal")} /><TemplateCard icon={<Building2 />} title="رزومه سالن زیبایی" text="برای مجموعه دارای مدیر، تیم، دسته‌بندی خدمات و نمونه‌کارهای سالن." onClick={() => onSelect("beauty_salon")} /></div>; }
function TemplateCard({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) { return <button onClick={onClick} className="rounded-lg border bg-card p-6 text-start transition hover:border-primary hover:shadow-sm"><div className="mb-5 text-primary">{icon}</div><div className="font-bold">{title}</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></button>; }
function Section({ title, description, enabled, onToggle, children }: { title: string; description: string; enabled: boolean; onToggle?: (checked: boolean) => void; children: React.ReactNode }) { return <Card className={!enabled ? "opacity-70" : ""}><CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle className="text-base">{title}</CardTitle><CardDescription>{description}</CardDescription></div>{onToggle ? <Switch checked={enabled} onCheckedChange={onToggle} /> : null}</CardHeader>{enabled ? <CardContent>{children}</CardContent> : null}</Card>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="space-y-2"><Label>{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="space-y-2"><Label>{label}</Label><Textarea value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
function MediaField({ label, value, onUpload, multiple }: { label: string; value: string; onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void; multiple?: boolean }) { return <label className="block cursor-pointer rounded border border-dashed p-3"><div className="flex items-center gap-2 text-sm font-medium"><ImagePlus className="h-4 w-4" />{label}</div><p className="mt-2 break-all text-xs text-muted-foreground">{value || "تصویر انتخاب نشده"}</p><input className="sr-only" type="file" accept="image/*" multiple={multiple} onChange={onUpload} /></label>; }
