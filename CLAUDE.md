# Maps System — CLAUDE.md

Project reference for Claude Code. อ่านไฟล์นี้ก่อนทำงานทุกครั้ง

---

## Tech Stack

| Layer    | Technology                        | Version       |
| -------- | --------------------------------- | ------------- |
| Frontend | Next.js App Router                | 15.x          |
| Frontend | react-leaflet                     | 5.x (`@next`) |
| Frontend | Leaflet.js                        | 1.9.x         |
| Frontend | Tailwind CSS                      | 4.x           |
| Backend  | Next.js API Routes + Node.js      | 20+ LTS       |
| Backend  | node-postgres (`pg`)              | 8.x           |
| Database | PostgreSQL                        | 16.x          |
| Database | PostGIS                           | 3.4.x         |
| Database | Coordinate system (SRID)          | 4326 (WGS84)  |

---

## Architecture Overview

```
Browser
  └─ react-leaflet components
       └─ Custom hooks (usePlaces, useMapLayers)
            └─ fetch() → /api/*  (Next.js API Routes)
                 └─ pool.query()  (node-postgres)
                      └─ PostGIS spatial functions
                           └─ GeoJSON FeatureCollection → back to map
```

### Layer responsibilities

- **Frontend** — render เท่านั้น ไม่คำนวณ spatial ใดๆ
- **Backend** — validate params, connection pool, parameterize queries
- **Database** — spatial computation ทั้งหมด (distance, area, containment)

ดูรายละเอียดแต่ละ layer:
- [`CLAUDE_FRONTEND.md`](./CLAUDE_FRONTEND.md)
- [`CLAUDE_BACKEND.md`](./CLAUDE_BACKEND.md)
- [`CLAUDE_DATABASE.md`](./CLAUDE_DATABASE.md)

---

## Project Structure

```
.
├── CLAUDE.md                   ← ไฟล์นี้ — overview
├── CLAUDE_FRONTEND.md          ← Frontend details
├── CLAUDE_BACKEND.md           ← Backend details
├── CLAUDE_DATABASE.md          ← Database details
│
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── api/
│       ├── places/nearby/route.ts
│       ├── places/viewport/route.ts
│       ├── routes/route.ts
│       ├── areas/route.ts
│       └── layers/import/route.ts
│
├── components/
│   ├── Map.tsx
│   ├── MarkersLayer.tsx
│   ├── RoutesLayer.tsx
│   └── AreasLayer.tsx
│
├── hooks/
│   ├── usePlaces.ts
│   └── useMapLayers.ts
│
├── lib/
│   └── db.ts
│
└── migrations/
    ├── 001_init.sql
    ├── 002_categories.sql
    ├── 003_places.sql
    ├── 004_routes.sql
    ├── 005_areas.sql
    ├── 006_geojson.sql
    ├── 007_spatial_queries.sql
    ├── 008_seed_data.sql
    └── 009_performance.sql
```

---

## Environment Variables

```bash
# .env.local
DATABASE_URL=postgresql://user:pass@localhost:5432/mapdb
MAPBOX_TOKEN=pk.eyJ1IjoiLi4uIn0...   # optional — Mapbox routing
```

---

## Common Commands

```bash
# Dev server
npm run dev

# Install all dependencies
npm install react-leaflet@next leaflet leaflet-defaulticon-compatibility pg
npm install -D @types/leaflet @types/pg

# Optional features
npm install react-leaflet-cluster      # marker clustering
npm install leaflet-routing-machine    # routing/navigation

# Run all migrations in order
psql $DATABASE_URL \
  -f migrations/001_init.sql \
  -f migrations/002_categories.sql \
  -f migrations/003_places.sql \
  -f migrations/004_routes.sql \
  -f migrations/005_areas.sql \
  -f migrations/006_geojson.sql \
  -f migrations/007_spatial_queries.sql \
  -f migrations/008_seed_data.sql \
  -f migrations/009_performance.sql
```

---

## Critical Rules (อย่าลืม)

1. **react-leaflet@next ต้องการ React 19** — React 18 ใช้ `react-leaflet@4`
2. **ทุก map component ต้อง `ssr: false`** — Leaflet เรียก `window` ตอน import
3. **GiST index บังคับทุก geometry column** — ถ้าไม่มี = Seq Scan ทุก query
4. **`ST_DWithin` ไม่ใช่ `ST_Distance < X`** — อย่างหลังไม่ใช้ index
5. **Parameterized SQL เสมอ** — ห้าม string concat หรือ template literals ใน query
6. **SRID 4326 ทุกที่** — เก็บ, query, serve ด้วย WGS84 ตลอด
