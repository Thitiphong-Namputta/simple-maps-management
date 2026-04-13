import { NextResponse } from "next/server";

// TODO: receive FeatureCollection, split features by geometry type,
//       insert into geojson_layers + geojson_features in a transaction
export async function POST() {
  return NextResponse.json({ ok: true, imported: 0 });
}
