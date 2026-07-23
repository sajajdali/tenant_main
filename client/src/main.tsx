import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/booking-templates.css";
import { registerServiceWorker } from "@/lib/pwa";
import { LocaleProvider } from "@/i18n/locale";

registerServiceWorker();
createRoot(document.getElementById("root")!).render(
  <LocaleProvider>
    <App />
  </LocaleProvider>,
);

const hideBootLoader = () => {
  document.getElementById("boot-loader")?.classList.add("is-hidden");
};

window.addEventListener("barberbook:appearance-ready", hideBootLoader, { once: true });
window.setTimeout(hideBootLoader, 2500);
