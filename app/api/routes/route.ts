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

  try {
    const { rows } = await pool.query(sql, params);
    return NextResponse.json(rows[0].json_build_object, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[routes GET]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { name, geojson, travel_mode, stroke_color } = await req.json();

  if (!name || !geojson)
    return NextResponse.json({ error: "name and geojson required" }, { status: 400 });

  const sql = `
    INSERT INTO routes (name, geom, travel_mode, stroke_color)
    VALUES ($1,
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($2::text), 4326)),
      $3, $4)
    RETURNING id, name, ROUND(distance_meters::numeric, 1) AS distance_meters
  `;

  try {
    const { rows } = await pool.query(sql, [
      name, JSON.stringify(geojson),
      travel_mode ?? "driving",
      stroke_color ?? "#3388ff",
    ]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[routes POST]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}