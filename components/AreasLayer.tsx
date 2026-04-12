"use client";

import { GeoJSON } from "react-leaflet";
import type { FeatureCollection, Feature } from "geojson";

export default function AreasLayer({ data }: { data: FeatureCollection | null }) {
  if (!data) return null;
  return (
    <GeoJSON
      key={JSON.stringify(data)}
      data={data}
      style={(feature?: Feature) => ({
        fillColor:   feature?.properties?.fill_color   ?? "#7F77DD",
        color:       feature?.properties?.stroke_color ?? "#534AB7",
        fillOpacity: feature?.properties?.fill_opacity ?? 0.25,
        weight:      1.5,
        opacity:     0.8,
      })}
      onEachFeature={(feature, layer) => {
        const { name, zone_type, area_sq_meters } = feature.properties ?? {};
        const km2 = (area_sq_meters / 1e6).toFixed(3);
        layer.bindPopup(`<b>${name}</b><br>${zone_type} · ${km2} km²`);
      }}
    />
  );
}