"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { GIBS_LAYERS, monthBefore, tileUrl, type GibsLayerId } from "@/lib/nasa/gibs";

const MONTHS_BACK = 59;

const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const pin = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:9999px;background:#2e3229;border:3px solid #fbfaf6"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/**
 * NASA satellite layers over the area around the field, with a month slider.
 * Plain Leaflet with a fresh element per mount (see LocationPicker).
 */
export default function SatelliteMap({ lat, lng }: { lat: number; lng: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.TileLayer | null>(null);
  const [layerId, setLayerId] = useState<GibsLayerId>("ndvi");
  const [back, setBack] = useState(0);

  const layer = GIBS_LAYERS.find((l) => l.id === layerId)!;
  // Show the same calendar month a few years back when the slider moves left.
  const month = monthBefore(layer.latest, back);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const el = document.createElement("div");
    el.style.width = "100%";
    el.style.height = "100%";
    host.appendChild(el);
    const map = L.map(el, { scrollWheelZoom: false, minZoom: 3, maxZoom: 10 }).setView([lat, lng], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      className: "wagro-tiles",
    }).addTo(map);
    L.marker([lat, lng], { icon: pin, interactive: false }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      el.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, [lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    overlayRef.current?.remove();
    overlayRef.current = L.tileLayer(tileUrl(layer, month), {
      maxNativeZoom: layer.maxZoom,
      maxZoom: 10,
      opacity: 0.75,
      attribution: "NASA GIBS",
    }).addTo(map);
  }, [layer, month]);

  return (
    <section className="rounded-[28px] border border-line bg-paper p-6">
      <h2 className="font-display text-3xl">Your area from space</h2>
      <p className="mt-1 text-sm text-muted">NASA satellite maps. The dark dot is your field.</p>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-paper p-1 sm:grid-cols-4">
        {GIBS_LAYERS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => {
              setLayerId(l.id);
              setBack(0);
            }}
            className={`h-10 rounded-xl text-sm transition-colors ${
              l.id === layerId ? "bg-sage font-medium text-espresso" : "text-muted hover:text-espresso"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div ref={hostRef} className="isolate mt-4 h-80 w-full overflow-hidden rounded-2xl border border-line" />

      <label className="mt-4 block">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Month</span>
          <span className="tabular-nums text-olive">{monthLabel(month)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={MONTHS_BACK}
          value={MONTHS_BACK - back}
          onChange={(e) => setBack(MONTHS_BACK - Number(e.target.value))}
          className="mt-2 w-full accent-accent"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>{monthLabel(monthBefore(layer.latest, MONTHS_BACK))}</span>
          <span>{monthLabel(layer.latest)}</span>
        </div>
      </label>

      <p className="mt-4 text-sm">{layer.reading}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={layer.legend} alt={`${layer.label} colour scale`} className="mt-2 h-14 max-w-full" />
      <p className="mt-2 text-xs text-muted">Source: NASA {layer.product}, via NASA GIBS.</p>
    </section>
  );
}
