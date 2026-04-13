import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import type { FeatureCollection } from "geojson";

export async function POST(req: NextRequest) {
  const { name, description, geojson } = (await req.json()) as {
    name: string;
    description?: string;
    geojson: FeatureCollection;
  };

  if (!name || !geojson?.features)
    return NextResponse.json(
      { error: "name and geojson (FeatureCollection) required" },
      { status: 400 }
    );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. สร้าง layer record
    const {
      rows: [layer],
    } = await client.query(
      `INSERT INTO geojson_layers (name, description, import_status)
       VALUES ($1, $2, 'processing') RETURNING id`,
      [name, description ?? null]
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
      { layerId: layer.id, imported: geojson.features.length },
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