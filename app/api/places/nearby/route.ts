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