import { NextResponse } from "next/server";

// TODO: replace with real DB query using ST_MakeEnvelope + && operator
export async function GET() {
  return NextResponse.json(
    { type: "FeatureCollection", features: [] },
    { headers: { "Cache-Control": "s-maxage=30" } }
  );
}