import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, ImageIcon, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { applyAppearance, readCachedAppearance } from "@/lib/appearance";
import type { AppearanceSettings, GalleryImage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocale, useT } from "@/i18n/locale";

export default function GalleryPage() {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<GalleryImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [appearance, setAppearance] = useState<AppearanceSettings | null>(() => readCachedAppearance());
  const activeBookingTemplate =
    appearance?.bookingTemplate === "pink" ||
    appearance?.bookingTemplate === "blue" ||
    appearance?.bookingTemplate === "green" ||
    appearance?.bookingTemplate === "red" ||
    appearance?.bookingTemplate === "purple" ||
    appearance?.bookingTemplate === "yellow" ||
    appearance?.bookingTemplate === "olive"
      ? appearance.bookingTemplate
      : null;

  useEffect(() => {
    Promise.all([api.gallery.list(), api.appearance.get()]).then(([galleryRes, appearanceRes]) => {
      if (galleryRes.success) {
        setEnabled(galleryRes.data.enabled);
        setItems(galleryRes.data.items);
      }

      if (appearanceRes.success) {
        setAppearance(appearanceRes.data);
        applyAppearance(appearanceRes.data);
      }

      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (activeBookingTemplate) {
      document.body.dataset.bookingTemplate = activeBookingTemplate;
    } else {
      delete document.body.dataset.bookingTemplate;
    }

    return () => {
      delete document.body.dataset.bookingTemplate;
    };
  }, [activeBookingTemplate]);

  useEffect(() => {
    document.title = t("galleryPage.documentTitle");
  }, [t]);

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const imageAlt = t("galleryPage.imageAlt");

  return (
    <div className={`gallery-page min-h-screen bg-background pb-12 text-foreground ${activeBookingTemplate ? `gallery-template-${activeBookingTemplate}` : ""}`} dir={dir}>
      <header className="gallery-header sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("galleryPage.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("galleryPage.description")}</p>
          </div>
          <Link href="/">
            <Button
              variant="outline"
              size="icon"
              title={t("common.back")}
              className="gallery-back-button h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            >
              <BackIcon className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-6">
        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("galleryPage.loading")}
          </div>
        ) : !enabled ? (
          <div className="gallery-empty-state flex min-h-[50vh] flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/70 bg-card/30 px-6 text-center">
            <ImageIcon className="mb-4 h-14 w-14 text-primary/70" />
            <h2 className="text-2xl font-bold">{t("galleryPage.disabled.title")}</h2>
            <p className="mt-3 max-w-xl text-sm leading-8 text-muted-foreground">
              {t("galleryPage.disabled.description")}
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="gallery-empty-state flex min-h-[50vh] flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/70 bg-card/30 px-6 text-center">
            <ImageIcon className="mb-4 h-14 w-14 text-primary/70" />
            <h2 className="text-2xl font-bold">{t("galleryPage.empty.title")}</h2>
            <p className="mt-3 max-w-xl text-sm leading-8 text-muted-foreground">
              {t("galleryPage.empty.description")}
            </p>
          </div>
        ) : (
          <>
            <div className="gallery-intro mb-6 rounded-[2rem] border border-border/70 bg-card/40 p-6">
              <h2 className="text-2xl font-bold">{t("galleryPage.intro.title")}</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {t("galleryPage.intro.description")}
              </p>
            </div>

            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedImage(item)}
                  className="gallery-card group mb-4 w-full break-inside-avoid overflow-hidden rounded-[2rem] border border-border/60 bg-card/60 text-start shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-black/10"
                >
                  <div className="relative overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title || imageAlt}
                      className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="gallery-card-overlay absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/35 to-transparent p-4 pt-12">
                      {item.title && <div className="text-base font-bold text-foreground">{item.title}</div>}
                      {item.description && (
                        <div className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground">{item.description}</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="gallery-dialog max-w-5xl overflow-hidden border-border bg-card p-0" dir={dir}>
          {selectedImage && (
            <div className="grid md:grid-cols-[minmax(0,1fr)_320px]">
              <div className="bg-black/30">
                <img src={selectedImage.imageUrl} alt={selectedImage.title || imageAlt} className="max-h-[80vh] w-full object-contain" />
              </div>
              <div className="flex flex-col justify-between p-6">
                <div className="space-y-4">
                  <DialogHeader className="text-start">
                    <DialogTitle className="text-2xl">{selectedImage.title || imageAlt}</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm leading-8 text-muted-foreground whitespace-pre-wrap">
                    {selectedImage.description?.trim() || t("galleryPage.dialog.descriptionMissing")}
                  </p>
                </div>
                <div className="pt-6">
                  <Button className="w-full" onClick={() => setSelectedImage(null)}>{t("common.close")}</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
