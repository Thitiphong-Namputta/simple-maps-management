"use client";

import { GeoJSON } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection } from "geojson";

const CATEGORY_COLORS: Record<string, string> = {
  cafe:       "#7F77DD",
  restaurant: "#D85A30",
  park:       "#1D9E75",
  temple:     "#BA7517",
};

function makeDivIcon(category: string) {
  const color = CATEGORY_COLORS[category] ?? "#888780";
  return L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;background:${color};
                border:2.5px solid white;border-radius:50%;
                box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
    iconSize:   [22, 22],
    iconAnchor: [11, 11],
  });
}

export default function MarkersLayer({
  data,
  onMarkerClick,
}: {
  data: FeatureCollection | null;
  onMarkerClick?: (id: string) => void;
}) {
  if (!data) return null;
  return (
    <GeoJSON
      key={JSON.stringify(data)}
      data={data}
      pointToLayer={(feature, latlng) =>
        L.marker(latlng, {
          icon: makeDivIcon(feature.properties?.category),
        })
      }
      onEachFeature={(feature, layer) => {
        const { id, name, category, distance_m } = feature.properties ?? {};
        layer.bindTooltip(name ?? "", { sticky: true, direction: "top" });
        layer.bindPopup(
          `<b>${name}</b><br>
           <span style="color:#888;font-size:12px">
             ${category} · ${Number(distance_m).toFixed(0)}m
           </span>`
        );
        layer.on("click", () => onMarkerClick?.(id));
      }}
    />
  );
}