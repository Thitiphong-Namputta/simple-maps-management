-- 006_geojson.sql — geojson_layers + geojson_features + trigger

-- Layer metadata
CREATE TABLE IF NOT EXISTS geojson_layers (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT         NOT NULL,
  description   TEXT,
  import_status TEXT         NOT NULL DEFAULT 'pending'
                               CHECK (import_status IN
                                 ('pending','processing','complete','error')),
  feature_count INTEGER      NOT NULL DEFAULT 0,
  bbox          geometry(Polygon, 4326),
  style         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  is_visible    BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Features — แยกรายชิ้น ห้ามเก็บทั้ง FeatureCollection ใน row เดียว
CREATE TABLE IF NOT EXISTS geojson_features (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id      UUID         NOT NULL
                               REFERENCES geojson_layers(id) ON DELETE CASCADE,
  geom          geometry(Geometry, 4326) NOT NULL,
  geometry_type TEXT         GENERATED ALWAYS AS (GeometryType(geom)) STORED,
  properties    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  source_id     TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gf_geom  ON geojson_features USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_gf_layer ON geojson_features (layer_id);
CREATE INDEX IF NOT EXISTS idx_gf_props ON geojson_features USING GIN (properties);

-- Auto-sync feature_count
CREATE OR REPLACE FUNCTION fn_sync_layer_feature_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE geojson_layers SET feature_count = feature_count + 1 WHERE id = NEW.layer_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE geojson_layers SET feature_count = feature_count - 1 WHERE id = OLD.layer_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gf_count ON geojson_features;
CREATE TRIGGER trg_gf_count
  AFTER INSERT OR DELETE ON geojson_features
  FOR EACH ROW EXECUTE FUNCTION fn_sync_layer_feature_count();