import type { RouteComponentProps } from "wouter";
import SettingsPage from "@/pages/settings";

export default function PanelGeneralPage(_: RouteComponentProps) {
  return <SettingsPage forcedTab="payment" />;
}
