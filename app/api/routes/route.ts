import { NextResponse } from "next/server";

// TODO: replace with real DB query (table: routes, geometry: MultiLineString)
export async function GET() {
  return NextResponse.json(
    { type: "FeatureCollection", features: [] },
    { headers: { "Cache-Control": "s-maxage=30" } }
  );
}

// TODO: insert MultiLineString from GeoJSON body
export async function POST() {
  return NextResponse.json({ ok: true });
}