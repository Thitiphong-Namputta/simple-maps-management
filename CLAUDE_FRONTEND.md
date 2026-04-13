# CLAUDE_FRONTEND.md — Frontend Reference

ดูภาพรวมโปรเจคที่ [`CLAUDE.md`](./CLAUDE.md)

---

## Stack

- **Next.js 15** App Router
- **react-leaflet v5** (`@next`) — React 19 required
- **Leaflet.js 1.9.x**
- **Tailwind CSS 4.x**
- **TypeScript**

---

## Packages

```bash
# Required
npm install react-leaflet@next leaflet leaflet-defaulticon-compatibility
npm install -D @types/leaflet

# Optional
npm install react-leaflet-cluster        # clustering สำหรับ marker จำนวนมาก
npm install leaflet-routing-machine      # routing / นำทาง
```

---

## SSR Setup — สำคัญที่สุด

Leaflet เรียก `window` และ `document` ตอน import ทันที ซึ่ง Next.js server ไม่มี
ต้องทำ 2 ขั้นตอนเสมอ:

**ขั้นตอนที่ 1 — Map component ต้องเป็น Client Component**

```tsx
// components/Map.tsx
"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";

export default function Map() {
  return (
    <MapContainer center={[13.7563, 100.5018]} zoom={13} className="h-full w-full">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    </MapContainer>
  );
}
```

**ขั้นตอนที่ 2 — Page ใช้ `next/dynamic` + `ssr: false`**

```tsx
// app/page.tsx
import dynamic from "next/dynamic";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="h-150 w-full bg-gray-100 animate-pulse rounded-xl
                    flex items-center justify-center">
      <p className="text-gray-400 text-sm">กำลังโหลดแผนที่...</p>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="p-8">
      <div className="h-150 w-full rounded-xl overflow-hidden shadow-lg">
        <Map />
      </div>
    </main>
  );
}
```

---

## Components

### Map.tsx — MapContainer หลัก

```tsx
"use client";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import type { LatLngBounds } from "leaflet";

// BoundsTracker — ส่ง bounds ขึ้นไป parent เมื่อ map ขยับ
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
}: {
  center?: [number, number];
  zoom?: number;
  onBoundsChange?: (b: LatLngBounds) => void;
}) {
  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />
      {onBoundsChange && <BoundsTracker onChange={onBoundsChange} />}
    </MapContainer>
  );
}
```

### MarkersLayer.tsx — POI markers จาก GeoJSON

```tsx
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
    // key บังคับ — GeoJSON data เป็น immutable prop
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
```

### RoutesLayer.tsx — เส้นทาง

```tsx
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
```

### AreasLayer.tsx — Polygons / Zones

```tsx
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
```

---

## Hooks

### usePlaces.ts — fetch nearby POI พร้อม debounce

```typescript
// hooks/usePlaces.ts
import { useState, useEffect, useRef, useCallback } from "react";
import type { FeatureCollection } from "geojson";

interface Options {
  lat: number;
  lng: number;
  radius?: number;
  category?: string;
  enabled?: boolean;
}

export function usePlaces({
  lat, lng, radius = 1000, category, enabled = true,
}: Options) {
  const [data, setData]       = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const abortRef              = useRef<AbortController>();
  const timerRef              = useRef<ReturnType<typeof setTimeout>>();

  const fetch_ = useCallback(async () => {
    if (!enabled) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams({
      lat: String(lat), lng: String(lng), radius: String(radius),
      ...(category && { category }),
    });
    try {
      const res = await fetch(`/api/places/nearby?${qs}`, {
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radius, category, enabled]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fetch_, 300); // debounce 300ms
    return () => clearTimeout(timerRef.current);
  }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}
```

### useMapLayers.ts — fetch ทุก layer ใน viewport

```typescript
// hooks/useMapLayers.ts
import { useState, useEffect, useRef } from "react";
import type { FeatureCollection } from "geojson";
import type { LatLngBounds } from "leaflet";

export function useMapLayers(bounds: LatLngBounds | null) {
  const [places, setPlaces]   = useState<FeatureCollection | null>(null);
  const [routes, setRoutes]   = useState<FeatureCollection | null>(null);
  const [areas,  setAreas]    = useState<FeatureCollection | null>(null);
  const prevKey               = useRef("");

  useEffect(() => {
    if (!bounds) return;
    const key = bounds.toBBoxString();
    if (key === prevKey.current) return; // skip ถ้า bounds เดิม
    prevKey.current = key;

    const [w, s, e, n] = [
      bounds.getWest(), bounds.getSouth(),
      bounds.getEast(), bounds.getNorth(),
    ];
    const qs = `minLng=${w}&minLat=${s}&maxLng=${e}&maxLat=${n}`;

    Promise.all([
      fetch(`/api/places/viewport?${qs}`).then((r) => r.json()),
      fetch(`/api/routes?${qs}`).then((r) => r.json()),
      fetch(`/api/areas?${qs}`).then((r) => r.json()),
    ]).then(([p, r, a]) => {
      setPlaces(p);
      setRoutes(r);
      setAreas(a);
    });
  }, [bounds]);

  return { places, routes, areas };
}
```

---

## react-leaflet v5 — API Quick Reference

### Built-in components

| Component         | Required Props          | Mutable Props                      | หมายเหตุ                              |
| ----------------- | ----------------------- | ---------------------------------- | ------------------------------------- |
| `MapContainer`    | `center`, `zoom`        | ไม่มี (ทุก prop เป็น immutable)    | ใช้ `useMap().flyTo()` เพื่อเปลี่ยน view |
| `TileLayer`       | `url`                   | `url`, `opacity`, `zIndex`         | `{s}/{z}/{x}/{y}` template           |
| `Marker`          | `position`              | `position`, `icon`, `draggable`    | `eventHandlers={{ click, dragend }}`  |
| `Popup`           | —                       | `position`, `children`             | รองรับ JSX ข้างใน                      |
| `Tooltip`         | —                       | `children`                         | options: `permanent`, `sticky`        |
| `GeoJSON`         | `data`                  | ไม่มี — ใช้ `key` เพื่อ re-render  | `pointToLayer`, `onEachFeature`       |
| `Circle`          | `center`, `radius`      | `center`, `radius`, `pathOptions`  | radius = เมตร (ไม่ใช่ pixel)           |
| `Polyline`        | `positions`             | `positions`, `pathOptions`         |                                       |
| `Polygon`         | `positions`             | `positions`, `pathOptions`         | ปิดอัตโนมัติ                           |
| `LayersControl`   | —                       | —                                  | `.BaseLayer` vs `.Overlay`            |
| `FeatureGroup`    | —                       | `pathOptions`                      | รองรับ group events + `getBounds()`   |

### Hooks

```tsx
// useMap — เข้าถึง Leaflet Map instance
const map = useMap();
map.flyTo([lat, lng], zoom);
map.getBounds();

// useMapEvents — ฟัง events
useMapEvents({
  click:    (e) => console.log(e.latlng),
  moveend:  (e) => console.log(e.target.getCenter()),
  zoomend:  (e) => console.log(e.target.getZoom()),
});

// useMapEvent — ฟัง single event
useMapEvent("click", (e) => setPos(e.latlng));
```

> **⚠ hooks ทำงานได้เฉพาะใน child ของ `MapContainer` เท่านั้น**

### Event handlers pattern

```tsx
// ✅ ถูก — ใช้ eventHandlers prop
<Marker
  position={pos}
  eventHandlers={{
    click:     (e) => handleClick(e.latlng),
    dragend:   (e) => handleDrag(e.target.getLatLng()),
    mouseover: (e) => e.target.openPopup(),
  }}
/>

// ❌ ผิด — ไม่มี onClick prop ใน react-leaflet
<Marker position={pos} onClick={handleClick} />
```

---

## Tile Providers

```tsx
// OpenStreetMap (free, no key)
url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
attribution="© OpenStreetMap contributors"

// CartoDB Light (free, no key)
url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"

// CartoDB Dark (free, no key)
url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"

// Mapbox (requires token)
url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
```

---

## CSS — Import order สำคัญ

```css
/* globals.css — ต้อง import ก่อน Tailwind เสมอ */
@import "leaflet/dist/leaflet.css";
@import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
@tailwind base;
@tailwind components;
@tailwind utilities;

/* แก้ z-index conflict ถ้าจำเป็น */
.leaflet-bottom,
.leaflet-control,
.leaflet-pane,
.leaflet-top {
  z-index: 0 !important;
}
```

---

## Known Gotchas

| ปัญหา | วิธีแก้ |
| ----- | ------- |
| `window is not defined` | `next/dynamic` + `ssr: false` |
| Marker icon หาย | Import `leaflet-defaulticon-compatibility` |
| Map ไม่แสดง (สูง 0px) | กำหนด `height` ที่ parent `div` เช่น `h-[500px]` |
| GeoJSON ไม่ update | ใส่ `key={JSON.stringify(data)}` บน `<GeoJSON>` |
| `useMap()` error | Hook ต้องอยู่ใน child ของ `MapContainer` เท่านั้น |
| MapContainer props ไม่เปลี่ยน | Props เป็น immutable — ใช้ `useMap().setView()` แทน |
| react-leaflet@next + React 18 | ใช้ `react-leaflet@4` แทน — v5 ต้องการ React 19 |
