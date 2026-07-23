export const PWA_INSTALL_GATE_EVENT = "barberbook:pwa-install-gate";

const PWA_INSTALL_GATE_DATASET_KEY = "pwaInstallAllowed";

export function getPwaInstallPromptAllowed(defaultAllowed = true) {
  if (typeof document === "undefined") {
    return defaultAllowed;
  }

  const value = document.documentElement.dataset[PWA_INSTALL_GATE_DATASET_KEY];
  return value === undefined ? defaultAllowed : value === "true";
}

export function setPwaInstallPromptAllowed(allowed: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  document.documentElement.dataset[PWA_INSTALL_GATE_DATASET_KEY] = allowed ? "true" : "false";
  window.dispatchEvent(new CustomEvent(PWA_INSTALL_GATE_EVENT, {
    detail: { allowed },
  }));
}

export function isStandalonePwa() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
