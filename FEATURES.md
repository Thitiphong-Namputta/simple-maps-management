# FEATURES.md — Frontend Features

สถานะ feature ทั้งหมดของ Frontend layer  
อ้างอิง stack: Next.js 15 · react-leaflet v5 · Tailwind CSS 4

---

## Legend

| Badge | ความหมาย |
| ----- | --------- |
| `required` | ต้องมีก่อนระบบทำงานได้ |
| `feature` | ควรมี — UX ดีขึ้นอย่างมีนัยสำคัญ |
| `devDep` | dev dependency เท่านั้น |
| `optional` | เพิ่มเมื่อต้องการ feature เฉพาะ |

---

## Map Core

| Feature | Component / API | Status | หมายเหตุ |
| ------- | --------------- | ------ | -------- |
| Map container | `MapContainer` | `required` | props ทุกตัวเป็น immutable หลัง mount |
| Tile layer | `TileLayer` | `required` | URL template `{s}/{z}/{x}/{y}` |
| SSR guard | `next/dynamic + ssr: false` | `required` | ทุก map component ต้องมี — Leaflet เรียก `window` |
| Default icon fix | `leaflet-defaulticon-compatibility` | `required` | import 3 บรรทัดใน Map.tsx |
| Bounds tracker | `useMapEvents` moveend / zoomend | `feature` | ส่ง bounds ขึ้น parent เพื่อ trigger viewport fetch |
| Layer switcher | `LayersControl` `.BaseLayer` / `.Overlay` | `feature` | สลับ tile provider และ toggle overlay layers |
| Fly to position | `useMap().flyTo()` | `feature` | เปลี่ยน view หลัง mount — ห้ามเปลี่ยนผ่าน props |
| Click to locate | `useMapEvents` click + `map.locate()` | `optional` | หา geolocation ของ user |

---

## Markers / POI

| Feature | Component / API | Status | หมายเหตุ |
| ------- | --------------- | ------ | -------- |
| Marker | `<Marker position={...}>` | `required` | ต้องใช้ `eventHandlers` ไม่ใช่ `onClick` |
| Popup | `<Popup>` | `required` | รองรับ JSX ข้างใน — บนแผนที่เมื่อคลิก |
| Tooltip | `<Tooltip>` | `feature` | options: `permanent`, `sticky`, `direction` |
| Custom icon | `L.divIcon({ html, iconSize })` | `feature` | color ต่างกันตาม category |
| Draggable marker | `draggable + eventHandlers.dragend` | `optional` | dragend → `e.target.getLatLng()` |
| Click-to-add | `useMapEvents` click → `useState` | `optional` | คลิกแผนที่ → เพิ่ม marker ใหม่ |

```tsx
// ตัวอย่าง custom icon ตาม category
const COLORS: Record<string, string> = {
  cafe: '#7F77DD', restaurant: '#D85A30',
  park: '#1D9E75', temple:     '#BA7517',
};

const makeDivIcon = (cat: string) =>
  L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50%;
                background:${COLORS[cat] ?? '#888'};
                border:2.5px solid white"></div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  });
```

---

## Vector Layers (Shapes)

| Feature | Component / API | Status | หมายเหตุ |
| ------- | --------------- | ------ | -------- |
| Routes (เส้นทาง) | `<Polyline>` / `RoutesLayer` | `required` | style ตาม `travel_mode` |
| Areas (พื้นที่) | `<Polygon>` / `AreasLayer` | `required` | `fill_color` + `stroke_color` จาก DB |
| Circle | `<Circle radius={meters}>` | `feature` | radius = เมตร ไม่ใช่ pixel |
| Rectangle | `<Rectangle bounds={[[sw],[ne]]}>` | `feature` | bounds = LatLngBounds |
| FeatureGroup | `<FeatureGroup>` | `feature` | group events + `getBounds()` |

```tsx
// RoutesLayer — style ตาม travel_mode
const MODE_STYLE = {
  driving: { color: '#D85A30', weight: 4 },
  walking: { color: '#1D9E75', weight: 3 },
  cycling: { color: '#7F77DD', weight: 3 },
  transit: { color: '#378ADD', weight: 4, dash: '8 4' },
};
```

---

## GeoJSON

| Feature | Component / API | Status | หมายเหตุ |
| ------- | --------------- | ------ | -------- |
| Render FeatureCollection | `<GeoJSON>` | `required` | `key={JSON.stringify(data)}` บังคับ |
| Markers layer | `pointToLayer` → `L.marker` | `required` | custom icon per feature |
| Routes layer | `style` → color per mode | `required` | |
| Areas layer | `style` → fill/stroke จาก properties | `required` | |
| Import UI | file input → `POST /api/layers/import` | `feature` | drag-drop หรือ file picker |
| Layer visibility toggle | `useState` → conditionally render layer | `feature` | เปิด/ปิด geojson_layers แต่ละตัว |
| Export button | `JSON.stringify` → download `.geojson` | `optional` | blob download |

```tsx
// key บังคับ — GeoJSON data เป็น immutable prop ของ react-leaflet
<GeoJSON
  key={JSON.stringify(data)}   // ← ขาดไม่ได้
  data={data}
  pointToLayer={(feature, latlng) =>
    L.marker(latlng, { icon: makeDivIcon(feature.properties?.category) })
  }
  onEachFeature={(feature, layer) => {
    layer.bindPopup(feature.properties?.name ?? '');
  }}
/>
```

---

## Hooks / Data Fetching

| Hook | ไฟล์ | Status | หมายเหตุ |
| ---- | ---- | ------ | -------- |
| `usePlaces` | `hooks/usePlaces.ts` | `required` | debounce 300ms + AbortController |
| `useMapLayers` | `hooks/useMapLayers.ts` | `required` | skip ถ้า bounds เดิม |
| `useMap` | react-leaflet built-in | `feature` | imperative map control |
| `useMapEvents` | react-leaflet built-in | `feature` | click, moveend, zoomend |

```tsx
// usePlaces — debounce + cancel
export function usePlaces({ lat, lng, radius = 1000, category, enabled = true }) {
  const abortRef = useRef<AbortController>();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const fetch_ = useCallback(async () => {
    if (!enabled) return;
    abortRef.current?.abort();                     // cancel previous
    abortRef.current = new AbortController();
    // ... fetch /api/places/nearby
  }, [lat, lng, radius, category, enabled]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fetch_, 300);    // debounce
    return () => clearTimeout(timerRef.current);
  }, [fetch_]);

  return { data, loading, error };
}
```

---

## Optional / Advanced

| Feature | Package | Status | หมายเหตุ |
| ------- | ------- | ------ | -------- |
| Marker clustering | `react-leaflet-cluster` v3 | `optional` | v3 รองรับ react-leaflet v5 + React 19 |
| Heatmap | `leaflet.heat` + `useMap` wrapper | `optional` | return `null` — imperative Leaflet API |
| Routing / นำทาง | `leaflet-routing-machine` | `optional` | OSRM public server ใช้ไม่ได้ — ต้องใช้ ORS หรือ host เอง |
| Interactive draw | `react-leaflet-draw-next` | `optional` | fork ที่รองรับ React 19 / ต้องอยู่ใน `<FeatureGroup>` |
| Geocoding search | custom input + Nominatim API | `optional` | `map.flyTo([lat, lng], 15)` หลังได้ผลลัพธ์ |

```tsx
// Clustering — ใช้ MarkerClusterGroup ครอบ Marker ทั้งหมด
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';

<MarkerClusterGroup chunkedLoading showCoverageOnHover={false}>
  {places.map((p) => (
    <Marker key={p.id} position={[p.latitude, p.longitude]} />
  ))}
</MarkerClusterGroup>
```

```tsx
// Heatmap — wrapper component ที่ return null
function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    const heat = (L as any).heatLayer(points, { radius: 25, blur: 15 }).addTo(map);
    return () => { map.removeLayer(heat); };
  }, [map, points]);
  return null;
}
```

---

## Packages

```bash
# Required
npm install react-leaflet@next leaflet leaflet-defaulticon-compatibility

# devDependency
npm install -D @types/leaflet

# Optional
npm install react-leaflet-cluster        # clustering
npm install leaflet-routing-machine      # routing
npm install leaflet.heat                 # heatmap
```

---

## Gotchas

| ปัญหา | วิธีแก้ |
| ----- | ------- |
| `window is not defined` | `next/dynamic` + `ssr: false` |
| Marker icon หาย | import `leaflet-defaulticon-compatibility` ใน Map.tsx |
| Map ไม่แสดง (สูง 0px) | กำหนด height ที่ parent `div` เช่น `h-[500px]` |
| GeoJSON ไม่ update | ใส่ `key={JSON.stringify(data)}` บน `<GeoJSON>` |
| MapContainer props ไม่เปลี่ยน | ใช้ `useMap().flyTo()` / `setView()` แทนการเปลี่ยน props |
| `useMap()` ทำงานไม่ได้ | hook ต้องอยู่ใน child ของ `MapContainer` เท่านั้น |
| react-leaflet v5 + React 18 | ใช้ `react-leaflet@4` แทน — v5 ต้องการ React 19 |
| Leaflet CSS เพี้ยน | import `leaflet.css` ก่อน `@tailwind base` ใน globals.css |
| Routing ไม่ทำงาน | OSRM public server ตาย — ใช้ OpenRouteService (2,000 req/day free) |

---

## CSS Import Order

```css
/* globals.css — ลำดับนี้สำคัญ */
@import 'leaflet/dist/leaflet.css';
@import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```
