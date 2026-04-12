"use client";

import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet-defaulticon-compatibility";
import type { LatLngBounds } from "leaflet";

function BoundsTracker({ onChange }: { onChange: (b: LatLngBounds) => void }) {
  useMapEvents({
    moveend: (e) => onChange(e.target.getBounds()),
    zoomend: (e) => onChange(e.target.getBounds()),
  });
  return null;
}

export default function Map({
  center = [13.7563, 100.5018] as [number, number],
  zoom = 13,
  onBoundsChange,
  children,
}: {
  center?: [number, number];
  zoom?: number;
  onBoundsChange?: (b: LatLngBounds) => void;
  children?: React.ReactNode;
}) {
  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />
      {onBoundsChange && <BoundsTracker onChange={onBoundsChange} />}
      {children}
    </MapContainer>
  );
}
