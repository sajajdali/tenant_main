import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const distDirectory = path.join(rootDirectory, "dist", "public");
const laravelPublicDirectory = path.join(rootDirectory, "laravel-app", "public");
const tenantDirectory = path.join(laravelPublicDirectory, "booking-app");
const tenantAssetDirectory = path.join(tenantDirectory, "assets");

async function copyIfPresent(source, destination) {
  if (!existsSync(source)) {
    return false;
  }

  await cp(source, destination, { force: true, recursive: true });
  return true;
}

await rm(tenantAssetDirectory, { force: true, recursive: true });
await mkdir(tenantAssetDirectory, { recursive: true });

const publicFiles = await readdir(laravelPublicDirectory, { withFileTypes: true });
await Promise.all(
  publicFiles
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name === "sw.js" ||
          entry.name === "manifest.webmanifest" ||
          entry.name === "registerSW.js" ||
          /^workbox-.*\.js$/.test(entry.name) ||
          /^pwa-.*\.js$/.test(entry.name)),
    )
    .map((entry) => rm(path.join(laravelPublicDirectory, entry.name), { force: true })),
);

await mkdir(tenantDirectory, { recursive: true });
await cp(path.join(distDirectory, "index.html"), path.join(tenantDirectory, "index.html"), { force: true });
await cp(path.join(distDirectory, "assets"), tenantAssetDirectory, { force: true, recursive: true });

for (const filename of ["manifest.webmanifest", "sw.js", "registerSW.js"]) {
  await copyIfPresent(path.join(distDirectory, filename), path.join(laravelPublicDirectory, filename));
}

const distFiles = await readdir(distDirectory, { withFileTypes: true });
for (const entry of distFiles) {
  if (entry.isFile() && (/^workbox-.*\.js$/.test(entry.name) || /^pwa-.*\.js$/.test(entry.name))) {
    await cp(path.join(distDirectory, entry.name), path.join(laravelPublicDirectory, entry.name), { force: true });
  }
}

for (const filename of ["apple-touch-icon.png", "icon-192.png", "icon-512.png", "favicon.png"]) {
  const copiedFromBuild = await copyIfPresent(
    path.join(distDirectory, filename),
    path.join(laravelPublicDirectory, filename),
  );

  if (!copiedFromBuild) {
    await copyIfPresent(
      path.join(rootDirectory, "client", "public", filename),
      path.join(laravelPublicDirectory, filename),
    );
  }
}

for (const filename of ["opengraph.jpg", "nutrition-hero.jpg"]) {
  const copiedFromBuild = await copyIfPresent(
    path.join(distDirectory, filename),
    path.join(tenantDirectory, filename),
  );

  if (!copiedFromBuild) {
    await copyIfPresent(
      path.join(rootDirectory, "client", "public", filename),
      path.join(tenantDirectory, filename),
    );
  }
}

console.log("Tenant assets synced to laravel-app/public/booking-app.");
