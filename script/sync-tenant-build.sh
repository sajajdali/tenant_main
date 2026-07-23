#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/public"
TENANT_ASSET_DIR="$ROOT_DIR/laravel-app/public/booking-app/assets"
PUBLIC_DIR="$ROOT_DIR/laravel-app/public"
TENANT_DIR="$ROOT_DIR/laravel-app/public/booking-app"

mkdir -p "$TENANT_ASSET_DIR"

find "$TENANT_ASSET_DIR" -type f -delete
find "$PUBLIC_DIR" -maxdepth 1 -type f \( -name 'sw.js' -o -name 'workbox-*.js' -o -name 'manifest.webmanifest' -o -name 'registerSW.js' -o -name 'pwa-*.js' \) -delete

cp "$DIST_DIR/index.html" "$TENANT_DIR/index.html"
cp -R "$DIST_DIR/assets/." "$TENANT_ASSET_DIR/"

for file in manifest.webmanifest sw.js registerSW.js; do
  if [ -f "$DIST_DIR/$file" ]; then
    cp "$DIST_DIR/$file" "$PUBLIC_DIR/$file"
  fi
done

find "$DIST_DIR" -maxdepth 1 -type f \( -name 'workbox-*.js' -o -name 'pwa-*.js' \) -exec cp {} "$PUBLIC_DIR/" \;

for icon in apple-touch-icon.png icon-192.png icon-512.png favicon.png; do
  if [ -f "$DIST_DIR/$icon" ]; then
    cp "$DIST_DIR/$icon" "$PUBLIC_DIR/$icon"
  elif [ -f "$ROOT_DIR/client/public/$icon" ]; then
    cp "$ROOT_DIR/client/public/$icon" "$PUBLIC_DIR/$icon"
  fi
done

if [ -f "$DIST_DIR/opengraph.jpg" ]; then
  cp "$DIST_DIR/opengraph.jpg" "$TENANT_DIR/opengraph.jpg"
elif [ -f "$ROOT_DIR/client/public/opengraph.jpg" ]; then
  cp "$ROOT_DIR/client/public/opengraph.jpg" "$TENANT_DIR/opengraph.jpg"
fi

if [ -f "$DIST_DIR/nutrition-hero.jpg" ]; then
  cp "$DIST_DIR/nutrition-hero.jpg" "$TENANT_DIR/nutrition-hero.jpg"
elif [ -f "$ROOT_DIR/client/public/nutrition-hero.jpg" ]; then
  cp "$ROOT_DIR/client/public/nutrition-hero.jpg" "$TENANT_DIR/nutrition-hero.jpg"
fi
