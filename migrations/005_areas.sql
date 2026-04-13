-- 005_areas.sql — Table areas + generated metrics

CREATE TABLE IF NOT EXISTS areas (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT         NOT NULL,
  zone_type        TEXT,
  geom             geometry(MultiPolygon, 4326) NOT NULL,

  -- Generated — ทุก metric คำนวณอัตโนมัติ
  area_sq_meters   DOUBLE PRECISION
                     GENERATED ALWAYS AS (ST_Area(geom::geography)) STORED,
  perimeter_meters DOUBLE PRECISION
                     GENERATED ALWAYS AS (ST_Perimeter(geom::geography)) STORED,
  centroid         geometry(Point, 4326)
                     GENERATED ALWAYS AS (ST_Centroid(geom)) STORED,
  bbox             geometry(Polygon, 4326)
                     GENERATED ALWAYS AS (ST_Envelope(geom)) STORED,

  fill_color       VARCHAR(9)   NOT NULL DEFAULT '#3388ff40',
  stroke_color     VARCHAR(7)   NOT NULL DEFAULT '#3388ff',
  fill_opacity     REAL         NOT NULL DEFAULT 0.3
                     CHECK (fill_opacity BETWEEN 0 AND 1),
  properties       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_areas_geom     ON areas USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_areas_centroid ON areas USING GIST (centroid);
CREATE INDEX IF NOT EXISTS idx_areas_bbox     ON areas USING GIST (bbox);
CREATE INDEX IF NOT EXISTS idx_areas_active   ON areas USING GIST (geom) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_areas_type     ON areas (zone_type);