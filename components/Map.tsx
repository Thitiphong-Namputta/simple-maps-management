"use client";

import { MapContainer, TileLayer, LayersControl, useMapEvents } from "react-leaflet";
import "leaflet-defaulticon-compatibility";
import type { LatLngBounds, LeafletMouseEvent } from "leaflet";

const { BaseLayer } = LayersControl;

function BoundsTracker({ onChange }: { onChange: (b: LatLngBounds) => void }) {
  useMapEvents({
    moveend: (e) => onChange(e.target.getBounds()),
    zoomend: (e) => onChange(e.target.getBounds()),
  });
  return null;
}

function ClickHandler({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick });
  return null;
}

export default function Map({
  center = [13.7563, 100.5018] as [number, number],
  zoom = 13,
  onBoundsChange,
  onClick,
  children,
}: {
  center?: [number, number];
  zoom?: number;
  onBoundsChange?: (b: LatLngBounds) => void;
  onClick?: (e: LeafletMouseEvent) => void;
  children?: React.ReactNode;
}) {
  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full">
      <LayersControl position="topright">
        <BaseLayer checked name="OpenStreetMap">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />
        </BaseLayer>
        <BaseLayer name="CartoDB Light">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution="© CartoDB"
          />
        </BaseLayer>
        <BaseLayer name="CartoDB Dark">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="© CartoDB"
          />
        </BaseLayer>
      </LayersControl>
      {onBoundsChange && <BoundsTracker onChange={onBoundsChange} />}
      {onClick && <ClickHandler onClick={onClick} />}
      {children}
    </MapContainer>
  );
}