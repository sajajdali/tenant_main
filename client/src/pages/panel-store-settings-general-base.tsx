import { useEffect } from "react";
import { useLocation } from "wouter";

export default function PanelStoreSettingsGeneralBasePage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/panel/store-settings/general/base/core", { replace: true });
  }, [setLocation]);

  return null;
}
