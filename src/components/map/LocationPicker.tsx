"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

const pin = L.divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:9999px;background:#5f7052;border:3px solid #fbfaf6;box-shadow:0 0 0 6px rgba(95,112,82,0.25)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Click-to-pick map built on plain Leaflet.
 *
 * With Cache Components, Next.js hides pages with React <Activity> instead of
 * unmounting them: effects clean up when the page is hidden and run again
 * when it is shown, while the DOM stays. Leaflet refuses to start twice on the
 * same element, so each mount creates a fresh inner element and removes it on
 * cleanup.
 */
export default function LocationPicker({
  position,
  onPick,
}: {
  position: [number, number] | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  const positionRef = useRef(position);

  useEffect(() => {
    onPickRef.current = onPick;
    positionRef.current = position;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const el = document.createElement("div");
    el.style.width = "100%";
    el.style.height = "100%";
    host.appendChild(el);

    const start = positionRef.current;
    const map = L.map(el, { scrollWheelZoom: true }).setView(
      start ?? [39, 35],
      start ? 9 : 5,
    );
    L.tileLayer(TILES, { attribution: ATTRIBUTION, className: "wagro-tiles" }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) =>
      onPickRef.current(e.latlng.lat, e.latlng.lng),
    );
    mapRef.current = map;

    return () => {
      map.remove();
      el.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Runs after the map effect on every mount, so the pin is always restored.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!position) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) markerRef.current.setLatLng(position);
    else markerRef.current = L.marker(position, { icon: pin }).addTo(map);
  }, [position]);

  return (
    <div
      ref={hostRef}
      className="isolate h-80 w-full overflow-hidden rounded-2xl border border-line"
    />
  );
}
