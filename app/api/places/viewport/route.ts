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

  try {
    const { rows } = await pool.query(sql, [minLng, minLat, maxLng, maxLat]);
    return NextResponse.json(rows[0].json_build_object, {
      headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=30" },
    });
  } catch (err) {
    console.error("[places/viewport GET]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { name, latitude, longitude, category, properties } =
    await req.json();

  if (!name || latitude == null || longitude == null)
    return NextResponse.json({ error: "name, latitude, longitude required" }, { status: 400 });

  const sql = `
    INSERT INTO places (name, geom, category, properties)
    VALUES ($1, ST_SetSRID(ST_MakePoint($3, $2), 4326), $4, $5)
    RETURNING id, latitude, longitude
  `;

  try {
    const { rows } = await pool.query(sql, [
      name, latitude, longitude, category ?? null,
      JSON.stringify(properties ?? {}),
    ]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[places/viewport POST]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}