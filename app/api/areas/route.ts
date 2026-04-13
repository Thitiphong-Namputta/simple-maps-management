import { NextResponse } from "next/server";

// TODO: replace with real DB query (table: areas, geometry: MultiPolygon)
export async function GET() {
  return NextResponse.json(
    { type: "FeatureCollection", features: [] },
    { headers: { "Cache-Control": "s-maxage=30" } }
  );
}

// TODO: insert MultiPolygon from GeoJSON body — area_sq_meters is generated
export async function POST() {
  return NextResponse.json({ ok: true });
}