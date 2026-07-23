import type { RouteComponentProps } from "wouter";
import SettingsPage from "@/pages/settings";

export default function PanelBarbersPage(_: RouteComponentProps) {
  return <SettingsPage forcedTab="barbers" />;
}
