import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import L from "leaflet";
import type { LatLngExpression, LeafletMouseEvent } from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { LtrText } from "@/i18n/ltr-text";
import { useT } from "@/i18n/locale";

type Point = {
  lat: number;
  lng: number;
};

const pinIcon = L.divIcon({
  className: "contact-map-pin",
  html: '<div class="contact-map-pin__inner"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function RecenterMap({ center }: { center: Point }) {
  const map = useMap();

  useEffect(() => {
    // Some pages render the map inside cards/dialog-like layouts; force a resize
    // after mount/update so Leaflet paints tiles reliably.
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      map.setView([center.lat, center.lng], Math.max(map.getZoom(), 13), {
        animate: true,
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [center.lat, center.lng, map]);

  useEffect(() => {
    map.setView([center.lat, center.lng], Math.max(map.getZoom(), 13), {
      animate: true,
    });
  }, [center.lat, center.lng, map]);

  return null;
}

function ClickHandler({
  onPick,
}: {
  onPick?: (point: Point) => void;
}) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onPick?.({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });

  return null;
}

export function ContactLocationMap({
  center,
  marker,
  onPick,
  interactive = true,
  title,
}: {
  center: Point;
  marker?: Point | null;
  onPick?: (point: Point) => void;
  interactive?: boolean;
  title?: string;
}) {
  const t = useT();
  const mapCenter: LatLngExpression = [center.lat, center.lng];
  const markerPosition: LatLngExpression | null = marker ? [marker.lat, marker.lng] : null;
  const resolvedTitle = title?.trim() || t("contactLocationMap.title");

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/40 shadow-sm">
      <MapContainer
        center={mapCenter}
        zoom={13}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        zoomControl={interactive}
        attributionControl={false}
        className="h-[320px] w-full"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <RecenterMap center={center} />
        {interactive && <ClickHandler onPick={onPick} />}
        {markerPosition && <Marker position={markerPosition} icon={pinIcon} />}
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 z-[400] bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.14)),radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_32%)]">
        <div className="absolute end-4 top-4 max-w-[calc(100%-2rem)] rounded-2xl border border-border/70 bg-background/85 px-4 py-2.5 text-start shadow-lg backdrop-blur">
          <div className="text-sm font-bold text-foreground">{resolvedTitle}</div>
          {interactive ? (
            <div className="mt-1 text-xs leading-6 text-muted-foreground">
              {t("contactLocationMap.pickHint")}
            </div>
          ) : null}
        </div>
        {interactive && marker && (
          <div className="absolute bottom-4 start-4 rounded-2xl border border-border/70 bg-background/85 px-3 py-2 text-start shadow-lg backdrop-blur">
            <div className="text-[11px] leading-5 text-muted-foreground">{t("contactLocationMap.coordinates")}</div>
            <LtrText className="text-xs font-medium text-foreground">
              {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}
            </LtrText>
          </div>
        )}
      </div>
    </div>
  );
}
