# CLAUDE_BACKEND.md — Backend Reference

ดูภาพรวมโปรเจคที่ [`CLAUDE.md`](./CLAUDE.md)

---

## Stack

- **Next.js 15** App Router — API Routes
- **Node.js** 20+ LTS
- **node-postgres (`pg`)** 8.x

---

## Packages

```bash
npm install pg
npm install -D @types/pg
```

---

## lib/db.ts — Singleton Connection Pool

```typescript
// lib/db.ts
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

// Singleton — ป้องกัน new Pool() ซ้ำใน Next.js hot-reload
export const pool =
  globalThis._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis._pgPool = pool;
}

// Typed query helper
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}
```

---

## API Routes

### GET /api/places/nearby

รับ lat, lng, radius (เมตร), category, limit — คืน GeoJSON FeatureCollection ของ POI ใกล้เคียง

```typescript
// app/api/places/nearby/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams;
  const lat      = parseFloat(sp.get("lat")    ?? "13.7563");
  const lng      = parseFloat(sp.get("lng")    ?? "100.5018");
  const radius   = Math.min(parseFloat(sp.get("radius") ?? "1000"), 50_000);
  const category = sp.get("category") || null;
  const limit    = Math.min(parseInt(sp.get("limit") ?? "50"), 200);

  if (isNaN(lat) || isNaN(lng))
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });

  const sql = `
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(feat ORDER BY dist_m), '[]'::json)
    ) AS geojson
    FROM (
      SELECT json_build_object(
        'type',      'Feature',
        'id',         id,
        'geometry',   ST_AsGeoJSON(geom, 6)::json,
        'properties', json_build_object(
          'name',       name,
          'category',   category,
          'distance_m', ROUND(dist_m::numeric, 1),
          'latitude',   latitude,
          'longitude',  longitude
        )
      ) AS feat, dist_m
      FROM (
        SELECT *,
          ST_Distance(geog,
            ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
          ) AS dist_m
        FROM places
        WHERE ST_DWithin(geog,
            ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
          AND is_active = true
          AND ($4::text IS NULL OR category = $4)
        ORDER BY geom <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)
        LIMIT $5
      ) t
    ) sub
  `;

  try {
    const { rows } = await pool.query(sql, [lat, lng, radius, category, limit]);
    return NextResponse.json(rows[0].geojson, {
      headers: {
        "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[places/nearby]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

### GET+POST /api/places/viewport

GET รับ bounding box — POST เพิ่ม POI ใหม่

```typescript
// app/api/places/viewport/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const [minLng, minLat, maxLng, maxLat] =
    ["minLng", "minLat", "maxLng", "maxLat"].map((k) =>
      parseFloat(sp.get(k) ?? "0")
    );

  const sql = `
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type',      'Feature',
          'id',         id,
          'geometry',   ST_AsGeoJSON(geom, 6)::json,
          'properties', json_build_object(
            'name',      name,
            'category',  category,
            'latitude',  latitude,
            'longitude', longitude,
            'properties', properties
          )
        )
      ), '[]'::json)
    )
    FROM places
    WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      AND is_active = true
    LIMIT 500
  `;

  const { rows } = await pool.query(sql, [minLng, minLat, maxLng, maxLat]);
  return NextResponse.json(rows[0].json_build_object, {
    headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=30" },
  });
}

export async function POST(req: NextRequest) {
  const { name, latitude, longitude, category, properties } =
    await req.json();

  const sql = `
    INSERT INTO places (name, geom, category, properties)
    VALUES ($1, ST_SetSRID(ST_MakePoint($3, $2), 4326), $4, $5)
    RETURNING id, latitude, longitude
  `;

  const { rows } = await pool.query(sql, [
    name, latitude, longitude, category,
    JSON.stringify(properties ?? {}),
  ]);
  return NextResponse.json(rows[0], { status: 201 });
}
```

### GET+POST /api/routes

```typescript
// app/api/routes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const params = ["minLng", "minLat", "maxLng", "maxLat"].map((k) =>
    parseFloat(sp.get(k) ?? "0")
  );

  const sql = `
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type',      'Feature',
          'id',         id,
          'geometry',   ST_AsGeoJSON(geom, 6)::json,
          'properties', json_build_object(
            'name',            name,
            'travel_mode',     travel_mode,
            'distance_meters', ROUND(distance_meters::numeric, 1),
            'stroke_color',    stroke_color,
            'stroke_width',    stroke_width
          )
        )
      ), '[]'::json)
    )
    FROM routes
    WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      AND is_active = true
  `;

  const { rows } = await pool.query(sql, params);
  return NextResponse.json(rows[0].json_build_object);
}

export async function POST(req: NextRequest) {
  const { name, geojson, travel_mode, stroke_color } = await req.json();

  const sql = `
    INSERT INTO routes (name, geom, travel_mode, stroke_color)
    VALUES ($1,
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($2::text), 4326)),
      $3, $4)
    RETURNING id, name, ROUND(distance_meters::numeric, 1) AS distance_meters
  `;

  const { rows } = await pool.query(sql, [
    name, JSON.stringify(geojson),
    travel_mode ?? "driving",
    stroke_color ?? "#3388ff",
  ]);
  return NextResponse.json(rows[0], { status: 201 });
}
```

### GET+POST /api/areas

```typescript
// app/api/areas/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const params = ["minLng", "minLat", "maxLng", "maxLat"].map((k) =>
    parseFloat(sp.get(k) ?? "0")
  );

  const sql = `
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type',      'Feature',
          'id',         id,
          'geometry',   ST_AsGeoJSON(geom, 6)::json,
          'properties', json_build_object(
            'name',           name,
            'zone_type',      zone_type,
            'area_sq_meters', ROUND(area_sq_meters::numeric),
            'fill_color',     fill_color,
            'stroke_color',   stroke_color,
            'fill_opacity',   fill_opacity
          )
        )
      ), '[]'::json)
    )
    FROM areas
    WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      AND is_active = true
  `;

  const { rows } = await pool.query(sql, params);
  return NextResponse.json(rows[0].json_build_object);
}

export async function POST(req: NextRequest) {
  const { name, geojson, zone_type, fill_color, stroke_color } =
    await req.json();

  const sql = `
    INSERT INTO areas (name, geom, zone_type, fill_color, stroke_color)
    VALUES ($1,
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($2::text), 4326)),
      $3, $4, $5)
    RETURNING id, name,
      ROUND(area_sq_meters::numeric) AS area_sq_meters,
      ROUND(perimeter_meters::numeric) AS perimeter_meters
  `;

  const { rows } = await pool.query(sql, [
    name, JSON.stringify(geojson),
    zone_type,
    fill_color  ?? "#7F77DD40",
    stroke_color ?? "#7F77DD",
  ]);
  return NextResponse.json(rows[0], { status: 201 });
}
```

### POST /api/layers/import — Bulk GeoJSON import

```typescript
// app/api/layers/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import type { FeatureCollection } from "geojson";

export async function POST(req: NextRequest) {
  const { name, description, geojson } = (await req.json()) as {
    name: string;
    description?: string;
    geojson: FeatureCollection;
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. สร้าง layer record
    const {
      rows: [layer],
    } = await client.query(
      `INSERT INTO geojson_layers (name, description, import_status)
       VALUES ($1, $2, 'processing') RETURNING id`,
      [name, description]
    );

    // 2. Bulk insert features
    if (geojson.features.length > 0) {
      const values: unknown[] = [];
      const placeholders = geojson.features.map((feat, i) => {
        const b = i * 3;
        values.push(
          layer.id,
          JSON.stringify(feat.geometry),
          JSON.stringify(feat.properties ?? {})
        );
        return `($${b + 1}, ST_SetSRID(ST_GeomFromGeoJSON($${b + 2}::text), 4326), $${b + 3})`;
      });
      await client.query(
        `INSERT INTO geojson_features (layer_id, geom, properties)
         VALUES ${placeholders.join(",")}`,
        values
      );
    }

    // 3. อัปเดต bbox + status
    await client.query(
      `UPDATE geojson_layers SET
         import_status = 'complete',
         bbox = (SELECT ST_Envelope(ST_Collect(geom))
                 FROM geojson_features WHERE layer_id = $1)
       WHERE id = $1`,
      [layer.id]
    );

    await client.query("COMMIT");
    return NextResponse.json(
      { layerId: layer.id, count: geojson.features.length },
      { status: 201 }
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[layers/import]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
```

---

## API Reference Summary

| Method | Endpoint               | Params / Body                                  | PostGIS                     | Cache        |
| ------ | ---------------------- | ---------------------------------------------- | --------------------------- | ------------ |
| GET    | /api/places/nearby     | lat, lng, radius, category, limit              | ST_DWithin + `<->` KNN      | s-maxage=30  |
| GET    | /api/places/viewport   | minLng, minLat, maxLng, maxLat                 | `&&` ST_MakeEnvelope        | s-maxage=15  |
| POST   | /api/places/viewport   | { name, latitude, longitude, category }        | ST_MakePoint                | no-cache     |
| GET    | /api/routes            | minLng, minLat, maxLng, maxLat                 | `&&` bbox                   | s-maxage=30  |
| POST   | /api/routes            | { name, geojson, travel_mode, stroke_color }   | ST_Multi + ST_GeomFromGeoJSON | no-cache   |
| GET    | /api/areas             | minLng, minLat, maxLng, maxLat                 | `&&` bbox                   | s-maxage=30  |
| POST   | /api/areas             | { name, geojson, zone_type, fill_color }       | ST_Multi + ST_GeomFromGeoJSON | no-cache   |
| POST   | /api/layers/import     | { name, description, geojson (FeatureCollection) } | bulk ST_GeomFromGeoJSON  | no-cache     |

---

## Rules

- **Parameterized SQL เสมอ** — ใช้ `$1, $2, ...` ห้าม string concat
- **Validate ก่อน query** — `parseFloat`, `Math.min`, null check ทุก param
- **Pool ไม่ใช่ Client** — ใช้ `pool.query()` สำหรับ single query / ใช้ `pool.connect()` + `client.release()` เฉพาะ transaction
- **Error handling ทุก route** — try/catch + log + คืน JSON error ที่เหมาะสม
- **Transaction สำหรับ bulk insert** — `BEGIN` / `COMMIT` / `ROLLBACK` พร้อม `client.release()` ใน `finally`
