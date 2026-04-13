"use client";

import { useState } from "react";
import type { LatLngBounds } from "leaflet";
import { useMapLayers } from "@/hooks/useMapLayers";
import Map from "@/components/Map";
import MarkersLayer from "@/components/MarkersLayer";
import RoutesLayer from "@/components/RoutesLayer";
import AreasLayer from "@/components/AreasLayer";

type LayerKey = "places" | "routes" | "areas";

const LAYERS: { key: LayerKey; label: string; activeClass: string }[] = [
  { key: "places", label: "POI",      activeClass: "bg-[#7F77DD]" },
  { key: "routes", label: "เส้นทาง", activeClass: "bg-[#D85A30]" },
  { key: "areas",  label: "พื้นที่",  activeClass: "bg-[#1D9E75]" },
];

export default function MapView({
  center,
  zoom,
}: {
  center?: [number, number];
  zoom?: number;
}) {
  const [bounds, setBounds]       = useState<LatLngBounds | null>(null);
  const [visible, setVisible]     = useState<Record<LayerKey, boolean>>({
    places: true,
    routes: true,
    areas:  true,
  });
  const { places, routes, areas } = useMapLayers(bounds);

  const toggle = (key: LayerKey) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));

  return (
    <div className="relative h-full w-full">
      {/* Layer visibility panel — bottom-left, above attribution */}
      <div className="absolute bottom-8 left-2 z-[1000] flex flex-col gap-1 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow border border-gray-200 text-xs">
        {LAYERS.map(({ key, label, activeClass }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className="flex items-center gap-2 font-medium"
          >
            <span
              className={`w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/10 ${
                visible[key] ? activeClass : "bg-gray-300"
              }`}
            />
            <span className={visible[key] ? "text-gray-700" : "text-gray-400"}>
              {label}
            </span>
          </button>
        ))}
      </div>

      <Map center={center} zoom={zoom} onBoundsChange={setBounds}>
        {visible.places && <MarkersLayer data={places} />}
        {visible.routes && <RoutesLayer data={routes} />}
        {visible.areas  && <AreasLayer  data={areas}  />}
      </Map>
    </div>
  );
}