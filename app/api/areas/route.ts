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

  try {
    const { rows } = await pool.query(sql, params);
    return NextResponse.json(rows[0].json_build_object, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[areas GET]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { name, geojson, zone_type, fill_color, stroke_color } =
    await req.json();

  if (!name || !geojson)
    return NextResponse.json({ error: "name and geojson required" }, { status: 400 });

  const sql = `
    INSERT INTO areas (name, geom, zone_type, fill_color, stroke_color)
    VALUES ($1,
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($2::text), 4326)),
      $3, $4, $5)
    RETURNING id, name,
      ROUND(area_sq_meters::numeric) AS area_sq_meters,
      ROUND(perimeter_meters::numeric) AS perimeter_meters
  `;

  try {
    const { rows } = await pool.query(sql, [
      name, JSON.stringify(geojson),
      zone_type ?? null,
      fill_color  ?? "#7F77DD40",
      stroke_color ?? "#7F77DD",
    ]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[areas POST]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}