"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { SLOPE_SLOPING, SLOPE_STEEP, type Terrain } from "@/lib/terrain/terrain";

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Erosion-prone slopes and frost-prone low spots on and around the field. */
export default function FieldRiskMap({
  lat,
  lng,
  terrain,
  status,
}: {
  lat: number;
  lng: number;
  terrain: Terrain | null;
  status: "idle" | "loading" | "error" | "done";
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !terrain) return;
    const el = document.createElement("div");
    el.style.width = "100%";
    el.style.height = "100%";
    host.appendChild(el);
    const map = L.map(el, { scrollWheelZoom: false, maxZoom: 17 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      className: "wagro-tiles",
    }).addTo(map);
    L.imageOverlay(terrain.overlay, terrain.bounds).addTo(map);
    L.circle([lat, lng], {
      radius: terrain.radiusM,
      color: "#2e3229",
      weight: 2,
      fill: false,
      dashArray: "6 6",
    }).addTo(map);
    map.fitBounds(terrain.bounds);
    return () => {
      map.remove();
      el.remove();
    };
  }, [lat, lng, terrain]);

  const lines: string[] = [];
  if (terrain) {
    const s = terrain.meanSlopePct;
    lines.push(
      s < 2
        ? `Mostly flat (average slope ${s.toFixed(1)}%). Low erosion risk from slope.`
        : s < SLOPE_SLOPING
          ? `Gentle slopes (average ${s.toFixed(1)}%).`
          : `Sloping field (average ${s.toFixed(1)}%). Rain runs off faster here.`,
    );
    if (terrain.slopingShare >= 0.05)
      lines.push(
        `${pct(terrain.slopingShare)} of the field is steeper than ${SLOPE_SLOPING}%. Keep these parts covered, or plough across the slope.`,
      );
    if (terrain.lowShare >= 0.05)
      lines.push(
        `${pct(terrain.lowShare)} of the field lies in low spots where cold air collects. Frost often comes there first.`,
      );
  }

  return (
    <section className="rounded-[28px] border border-line bg-paper p-6">
      <h2 className="font-display text-3xl">Your field up close</h2>
      <p className="mt-1 text-sm text-muted">
        Where the land is steep or low, from elevation data. The dashed circle
        is your field size around the pin.
      </p>

      {status === "loading" && <div className="mt-4 h-80 animate-pulse rounded-2xl bg-sand" />}
      {status === "error" && (
        <p className="mt-4 text-sm text-clay">Elevation data could not be loaded.</p>
      )}

      {terrain && (
        <>
          <ul className="mt-4 space-y-1 text-sm">
            {lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <div ref={hostRef} className="isolate mt-4 h-80 w-full overflow-hidden rounded-2xl border border-line" />
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
            <Swatch color="rgba(139,111,92,0.75)" label={`Steep (${SLOPE_STEEP}%+): high erosion risk`} />
            <Swatch color="rgba(201,176,143,0.65)" label={`Sloping (${SLOPE_SLOPING}–${SLOPE_STEEP}%)`} />
            <Swatch color="rgba(120,150,170,0.65)" label="Low spot: frost risk" />
          </div>
          <p className="mt-2 text-xs text-muted">
            Elevation {Math.round(terrain.elevMin)}–{Math.round(terrain.elevMax)} m. Source:{" "}
            {terrain.sources.join(", ") || "elevation tiles"} via AWS Terrain Tiles, about
            30 m detail. Walk the field to confirm.
          </p>
        </>
      )}
    </section>
  );
}
