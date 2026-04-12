"use client";

import { GeoJSON } from "react-leaflet";
import type { FeatureCollection, Feature } from "geojson";

const MODE_STYLE: Record<string, { color: string; weight: number; dash?: string }> = {
  driving:  { color: "#D85A30", weight: 4 },
  walking:  { color: "#1D9E75", weight: 3 },
  cycling:  { color: "#7F77DD", weight: 3 },
  transit:  { color: "#378ADD", weight: 4, dash: "8 4" },
};

export default function RoutesLayer({ data }: { data: FeatureCollection | null }) {
  if (!data) return null;
  return (
    <GeoJSON
      key={JSON.stringify(data)}
      data={data}
      style={(feature?: Feature) => {
        const mode = feature?.properties?.travel_mode ?? "driving";
        const s = MODE_STYLE[mode] ?? MODE_STYLE.driving;
        return { color: s.color, weight: s.weight, dashArray: s.dash, opacity: 0.85 };
      }}
      onEachFeature={(feature, layer) => {
        const { name, travel_mode, distance_meters } = feature.properties ?? {};
        layer.bindPopup(
          `<b>${name}</b><br>${travel_mode} · ${(distance_meters / 1000).toFixed(2)} km`
        );
      }}
    />
  );
}