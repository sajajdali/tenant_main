import { HelpCircle, LayoutDashboard, SlidersHorizontal, Truck } from "lucide-react";
import { PanelStoreSettingsShell } from "@/components/panel-store-settings-shell";

const cards = [
  {
    key: "home",
    titleKey: "panelStore.general.cards.home.title",
    descriptionKey: "panelStore.general.cards.home.description",
    href: "/panel/store-settings/home",
    icon: LayoutDashboard,
    accent: "from-primary/20 via-card to-card",
  },
  {
    key: "faq",
    titleKey: "panelStore.general.cards.faq.title",
    descriptionKey: "panelStore.general.cards.faq.description",
    href: "/panel/store-settings/faq",
    icon: HelpCircle,
    accent: "from-sky-500/15 via-card to-card",
  },
  {
    key: "shipping",
    titleKey: "panelStore.general.cards.shipping.title",
    descriptionKey: "panelStore.general.cards.shipping.description",
    href: "/panel/store-settings/shipping",
    icon: Truck,
    accent: "from-amber-500/15 via-card to-card",
  },
  {
    key: "base",
    titleKey: "panelStore.general.cards.base.title",
    descriptionKey: "panelStore.general.cards.base.description",
    href: "/panel/store-settings/general/base/core",
    icon: SlidersHorizontal,
    accent: "from-emerald-500/15 via-card to-card",
  },
] as const;

export default function PanelStoreSettingsGeneralPage() {
  return (
    <PanelStoreSettingsShell
      eyebrowKey="panelStore.general.eyebrow"
      titleKey="panelStore.general.title"
      descriptionKey="panelStore.general.description"
      cards={cards}
    />
  );
}
