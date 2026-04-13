import { NextResponse } from "next/server";

// TODO: replace with real DB query (007_spatial_queries.sql — fn_nearby_places)
export async function GET() {
  return NextResponse.json(
    { type: "FeatureCollection", features: [] },
    { headers: { "Cache-Control": "s-maxage=30" } }
  );
}