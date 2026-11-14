"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

const pin = L.divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:9999px;background:#8b7355;border:3px solid #fbfaf6;box-shadow:0 0 0 6px rgba(184,72,31,0.25)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPicker({
  position,
  onPick,
}: {
  position: [number, number] | null;
  onPick: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer
      center={position ?? [39, 35]}
      zoom={position ? 9 : 5}
      scrollWheelZoom
      className="isolate h-80 w-full rounded-2xl border border-line"
    >
      <TileLayer
        className="wagro-tiles"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      {position && <Marker position={position} icon={pin} />}
    </MapContainer>
  );
}