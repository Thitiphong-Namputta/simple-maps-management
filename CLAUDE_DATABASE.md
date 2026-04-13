# CLAUDE_DATABASE.md — Database Reference

ดูภาพรวมโปรเจคที่ [`CLAUDE.md`](./CLAUDE.md)

---

## Stack

- **PostgreSQL 16**
- **PostGIS 3.4**
- **SRID 4326 (WGS84)** — coordinate system หลักสำหรับเก็บและ query ทุกอย่าง

---

## Setup

```sql
-- รันครั้งเดียวต่อ database (ต้องการ superuser)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ตรวจสอบ
SELECT PostGIS_Full_Version();
```

---

## SRID Rules

| SRID | ชื่อ         | ใช้สำหรับ                                         |
| ---- | ------------ | ------------------------------------------------- |
| 4326 | WGS84        | **เก็บข้อมูล, query, serve** — ใช้ทุกที่          |
| 3857 | Web Mercator | Tile rendering เท่านั้น — client reprojects เอง   |

> **ห้ามเก็บ SRID 3857 ใน database** — distance/area calculation จะผิด

---

## Geometry vs Geography

```sql
-- geometry: เร็วกว่า, function มากกว่า, หน่วย = degree (ไม่ถูกต้องสำหรับระยะทาง)
geom geometry(Point, 4326)

-- geography: ช้ากว่าเล็กน้อย, หน่วย = เมตรจริง, แนะนำสำหรับ distance query
geog geography(Point, 4326)
```

**Pattern ที่ดีที่สุด** — เก็บเป็น `geometry` แล้ว cast เป็น `::geography` ตอน query:

```sql
-- distance ในหน่วยเมตร (geography = spheroid = แม่นยำ)
ST_Distance(geom::geography, point::geography)

-- radius search ในหน่วยเมตร
ST_DWithin(geom::geography, point::geography, 1000)
```

---

## Tables

### places — Markers / POI

```sql
CREATE TABLE places (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  UUID         REFERENCES categories(id) ON DELETE SET NULL,
  name         TEXT         NOT NULL,
  description  TEXT,

  -- Typed geometry — SRID บังคับเสมอ
  geom         geometry(Point, 4326) NOT NULL,

  -- Generated columns — คำนวณอัตโนมัติ ไม่ต้อง trigger หรือ app logic
  geog         geography(Point, 4326)
                 GENERATED ALWAYS AS (geom::geography) STORED,
  latitude     DOUBLE PRECISION
                 GENERATED ALWAYS AS (ST_Y(geom)) STORED,
  longitude    DOUBLE PRECISION
                 GENERATED ALWAYS AS (ST_X(geom)) STORED,

  address      TEXT,
  city         TEXT,
  country      VARCHAR(2),
  properties   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  tags         TEXT[]       NOT NULL DEFAULT '{}',
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Spatial indexes (บังคับ — ถ้าไม่มี = Seq Scan ทุก spatial query)
CREATE INDEX idx_places_geom   ON places USING GIST (geom);
CREATE INDEX idx_places_geog   ON places USING GIST (geog);

-- Partial index เฉพาะ active (เล็กกว่า เร็วกว่า)
CREATE INDEX idx_places_active ON places USING GIST (geom)
  WHERE is_active = true;

-- Non-spatial indexes
CREATE INDEX idx_places_props  ON places USING GIN (properties jsonb_path_ops);
CREATE INDEX idx_places_tags   ON places USING GIN (tags);
CREATE INDEX idx_places_cat    ON places (category_id);
```

### routes — เส้นทาง

```sql
CREATE TABLE routes (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT              NOT NULL,
  geom             geometry(MultiLineString, 4326) NOT NULL,

  -- Generated
  distance_meters  DOUBLE PRECISION
                     GENERATED ALWAYS AS (ST_Length(geom::geography)) STORED,
  start_point      geometry(Point, 4326)
                     GENERATED ALWAYS AS (
                       ST_StartPoint(ST_GeometryN(geom, 1))
                     ) STORED,
  end_point        geometry(Point, 4326)
                     GENERATED ALWAYS AS (
                       ST_EndPoint(ST_GeometryN(geom, ST_NumGeometries(geom)))
                     ) STORED,

  travel_mode      travel_mode_type  NOT NULL DEFAULT 'driving',
  stroke_color     VARCHAR(7)        NOT NULL DEFAULT '#3388ff',
  stroke_width     REAL              NOT NULL DEFAULT 3.0,
  properties       JSONB             NOT NULL DEFAULT '{}'::jsonb,
  is_active        BOOLEAN           NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX idx_routes_geom  ON routes USING GIST (geom);
CREATE INDEX idx_routes_start ON routes USING GIST (start_point);
CREATE INDEX idx_routes_mode  ON routes (travel_mode);
```

### areas — Polygons / Zones

```sql
CREATE TABLE areas (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT         NOT NULL,
  zone_type        TEXT,
  geom             geometry(MultiPolygon, 4326) NOT NULL,

  -- Generated — ทุก metric คำนวณอัตโนมัติ
  area_sq_meters   DOUBLE PRECISION
                     GENERATED ALWAYS AS (ST_Area(geom::geography)) STORED,
  perimeter_meters DOUBLE PRECISION
                     GENERATED ALWAYS AS (ST_Perimeter(geom::geography)) STORED,
  centroid         geometry(Point, 4326)
                     GENERATED ALWAYS AS (ST_Centroid(geom)) STORED,
  bbox             geometry(Polygon, 4326)
                     GENERATED ALWAYS AS (ST_Envelope(geom)) STORED,

  fill_color       VARCHAR(9)   NOT NULL DEFAULT '#3388ff40',
  stroke_color     VARCHAR(7)   NOT NULL DEFAULT '#3388ff',
  fill_opacity     REAL         NOT NULL DEFAULT 0.3
                     CHECK (fill_opacity BETWEEN 0 AND 1),
  properties       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_areas_geom     ON areas USING GIST (geom);
CREATE INDEX idx_areas_centroid ON areas USING GIST (centroid);
CREATE INDEX idx_areas_bbox     ON areas USING GIST (bbox);
CREATE INDEX idx_areas_active   ON areas USING GIST (geom) WHERE is_active = true;
CREATE INDEX idx_areas_type     ON areas (zone_type);
```

### geojson_layers + geojson_features — Imported GeoJSON

```sql
-- Layer metadata
CREATE TABLE geojson_layers (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT         NOT NULL,
  import_status TEXT         NOT NULL DEFAULT 'pending'
                               CHECK (import_status IN
                                 ('pending','processing','complete','error')),
  feature_count INTEGER      NOT NULL DEFAULT 0,  -- auto-sync via trigger
  bbox          geometry(Polygon, 4326),
  style         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  is_visible    BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Features — แยกรายชิ้น ห้ามเก็บทั้ง FeatureCollection ใน row เดียว
CREATE TABLE geojson_features (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id      UUID         NOT NULL
                               REFERENCES geojson_layers(id) ON DELETE CASCADE,
  geom          geometry(Geometry, 4326) NOT NULL,  -- รับทุก shape
  geometry_type TEXT         GENERATED ALWAYS AS (GeometryType(geom)) STORED,
  properties    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  source_id     TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_gf_geom  ON geojson_features USING GIST (geom);
CREATE INDEX idx_gf_layer ON geojson_features (layer_id);
CREATE INDEX idx_gf_props ON geojson_features USING GIN (properties);
```

---

## Spatial Queries

### KNN Nearest Neighbor — หา POI ใกล้ที่สุด

```sql
-- ✅ ถูก — <-> operator ใช้ GiST index โดยตรง (index-assisted KNN)
SELECT id, name,
  ST_Distance(geog,
    ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography
  ) AS dist_m
FROM places
WHERE is_active = true
ORDER BY geom <-> ST_SetSRID(ST_MakePoint($lng, $lat), 4326)
LIMIT 10;

-- ⚠ ด้านหนึ่งของ <-> ต้องเป็น literal geometry จึงจะใช้ index
```

### Radius Search — หาใน radius กี่เมตร

```sql
-- ✅ ถูก — ST_DWithin ใช้ spatial index
WHERE ST_DWithin(
  geog,
  ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography,
  $radius_meters
)

-- ❌ ผิด — ไม่ใช้ index = Full Seq Scan
-- WHERE ST_Distance(geog, point) < $radius_meters
```

### Viewport Query — load features ใน map view

```sql
-- && = bounding box overlap (เร็วที่สุด ใช้ GiST index)
WHERE geom && ST_MakeEnvelope($minLng, $minLat, $maxLng, $maxLat, 4326)
```

### Point-in-Polygon — POI ใน zone ไหน

```sql
-- หา POI ทั้งหมดในพื้นที่
SELECT p.id, p.name
FROM places p
JOIN areas a ON ST_Within(p.geom, a.geom)
WHERE a.id = $area_id AND p.is_active = true;

-- Reverse — จุดอยู่ใน zone ไหน
SELECT id, name, zone_type
FROM areas
WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($lng, $lat), 4326))
  AND is_active = true;
```

### Export GeoJSON

```sql
-- ST_AsGeoJSON(geom, 6) — 6 decimal places = ~11cm, เพียงพอสำหรับ web maps
SELECT json_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(json_agg(
    json_build_object(
      'type',      'Feature',
      'id',         id,
      'geometry',   ST_AsGeoJSON(geom, 6)::json,
      'properties', json_build_object('name', name, 'category', category)
    )
  ), '[]'::json)
)
FROM places
WHERE is_active = true;
```

### Import GeoJSON

```sql
-- Single feature
INSERT INTO places (name, geom)
VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2::text), 4326));

-- From FeatureCollection (bulk)
INSERT INTO geojson_features (layer_id, geom, properties)
SELECT $layer_id,
  ST_SetSRID(ST_GeomFromGeoJSON(feat->'geometry'), 4326),
  feat->'properties'
FROM jsonb_array_elements($fc->'features') AS feat;
```

---

## Spatial Index Strategy

| Index Type | ใช้สำหรับ                           | เมื่อไหร่ควรสร้าง                              |
| ---------- | ----------------------------------- | ----------------------------------------------- |
| **GiST**   | geometry / geography column         | **บังคับทุกตัว** — `&&`, `<->`, `ST_DWithin`   |
| **GIN**    | JSONB `properties`, `tags[]`        | ทุก table ที่ query ด้วย `@>`, `?`               |
| **B-tree** | `category_id`, `travel_mode`, FK    | equality + range queries บน regular columns     |
| **Partial**| `WHERE is_active = true`            | query ที่ filter is_active บ่อย                  |
| **BRIN**   | GPS tracks, time-series > 100M rows | data insert ตาม spatial order เท่านั้น           |

```sql
-- สร้าง index แบบ non-blocking (ไม่ต้อง downtime)
CREATE INDEX CONCURRENTLY idx_places_geom ON places USING GIST (geom);

-- ตรวจสอบว่า index ถูกใช้
EXPLAIN ANALYZE
SELECT * FROM places WHERE ST_DWithin(geog, point::geography, 1000);
-- มองหา "Index Scan" ไม่ใช่ "Seq Scan"
```

---

## Migrations

รันตามลำดับ:

| ไฟล์ | สิ่งที่ทำ | Required |
| ---- | --------- | -------- |
| `001_init.sql` | PostGIS extensions + `travel_mode_type` enum | ✅ |
| `002_categories.sql` | Table `categories` + seed 13 หมวดหมู่ | ✅ |
| `003_places.sql` | Table `places` + indexes + trigger | ✅ |
| `004_routes.sql` | Table `routes` + generated columns | ✅ |
| `005_areas.sql` | Table `areas` + generated metrics | ✅ |
| `006_geojson.sql` | `geojson_layers` + `geojson_features` + trigger | ✅ |
| `007_spatial_queries.sql` | Functions: `fn_nearby_places`, `fn_viewport_geojson` | ✅ |
| `008_seed_data.sql` | ข้อมูลตัวอย่าง Bangkok (optional) | ⬜ |
| `009_performance.sql` | `areas_subdivided`, simplified geom, materialized view | ⬜ |

> **008** ลบทิ้งก่อน production
> **009** รันหลังจากมีข้อมูลจริงเข้ามาแล้วเท่านั้น

---

## Performance

### ST_Subdivide — ผล 4-60x speedup สำหรับ complex polygon

```sql
-- แบ่ง polygon ใหญ่ → bounding box แคบลง → index มีประสิทธิภาพมากขึ้น
CREATE TABLE areas_subdivided AS
SELECT id AS area_id, name, ST_Subdivide(geom, 255) AS geom
FROM areas WHERE is_active = true;

CREATE INDEX ON areas_subdivided USING GIST (geom);
```

### Pre-simplified geometry ตาม zoom level

```sql
ALTER TABLE areas
  ADD COLUMN geom_z0_6   geometry,
  ADD COLUMN geom_z7_10  geometry,
  ADD COLUMN geom_z11_14 geometry;

UPDATE areas SET
  geom_z0_6   = ST_SimplifyPreserveTopology(geom, 0.05),
  geom_z7_10  = ST_SimplifyPreserveTopology(geom, 0.005),
  geom_z11_14 = ST_SimplifyPreserveTopology(geom, 0.0005);
```

> ใช้ `ST_SimplifyPreserveTopology` เสมอ — `ST_Simplify` อาจสร้าง self-intersecting polygon

### Materialized view

```sql
CREATE MATERIALIZED VIEW mv_area_stats AS
SELECT a.id, a.name, a.zone_type, a.geom_z7_10 AS geom,
  ROUND((a.area_sq_meters / 1e6)::numeric, 4) AS area_km2,
  COUNT(p.id) AS poi_count
FROM areas a
LEFT JOIN places p ON ST_Within(p.geom, a.geom) AND p.is_active = true
WHERE a.is_active = true
GROUP BY a.id, a.name, a.zone_type, a.geom_z7_10, a.area_sq_meters;

CREATE UNIQUE INDEX ON mv_area_stats (id);
CREATE INDEX ON mv_area_stats USING GIST (geom);

-- Refresh (run via cron หรือหลัง bulk update)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_area_stats;
```

### หลัง bulk insert — บังคับเสมอ

```sql
VACUUM ANALYZE places;
VACUUM ANALYZE routes;
VACUUM ANALYZE areas;
```

---

## Gotchas

| สถานการณ์ | วิธีแก้ |
| --------- | ------- |
| Spatial query ช้า (Seq Scan) | สร้าง GiST index — ตรวจด้วย `EXPLAIN ANALYZE` |
| `ST_Distance` คืน degree ไม่ใช่เมตร | Cast เป็น `::geography` — `ST_Distance(geog, pt::geography)` |
| Polygon area ผิด | ใช้ `ST_Area(geom::geography)` ไม่ใช่ `ST_Area(geom)` |
| Import GeoJSON แล้ว SRID ผิด | ใส่ `ST_SetSRID(..., 4326)` ทุกครั้ง |
| Marker icon หายหลัง import | ตรวจ `geometry_type` — อาจเป็น MULTIPOINT แทน POINT |
| `ST_Simplify` ทำ polygon เสีย | ใช้ `ST_SimplifyPreserveTopology` แทน |
| GeoJSON ไม่ update บนแผนที่ | ปัญหาอยู่ที่ frontend — ใส่ `key` บน `<GeoJSON>` |
