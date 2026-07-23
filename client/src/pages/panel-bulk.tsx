import type { RouteComponentProps } from "wouter";
import SettingsPage from "@/pages/settings";

export default function PanelBulkPage(_: RouteComponentProps) {
  return <SettingsPage forcedTab="bulk" />;
}
