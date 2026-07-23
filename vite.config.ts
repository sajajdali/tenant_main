import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

async function optionalReplitPlugins() {
  if (process.env.NODE_ENV === "production" || process.env.REPL_ID === undefined) {
    return [];
  }

  const [runtimeErrorOverlay, cartographer, devBanner] = await Promise.all([
    import("@replit/vite-plugin-runtime-error-modal")
      .then((m) => m.default())
      .catch(() => null),
    import("@replit/vite-plugin-cartographer")
      .then((m) => m.cartographer())
      .catch(() => null),
    import("@replit/vite-plugin-dev-banner")
      .then((m) => m.devBanner())
      .catch(() => null),
  ]);

  return [runtimeErrorOverlay, cartographer, devBanner].filter(
    (plugin): plugin is PluginOption => Boolean(plugin),
  );
}

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/booking-app/" : "/",
  plugins: [
    react(),
    tailwindcss(),
    metaImagesPlugin(),
    ...(await optionalReplitPlugins()),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
