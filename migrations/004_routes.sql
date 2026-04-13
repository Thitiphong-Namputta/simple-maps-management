-- 004_routes.sql — Table routes + generated columns

CREATE TABLE IF NOT EXISTS routes (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT              NOT NULL,
  geom             geometry(MultiLineString, 4326) NOT NULL,

  -- Generated columns — คำนวณอัตโนมัติ
  distance_meters  DOUBLE PRECISION
                     GENERATED ALWAYS AS (ST_Length(geom::geography)) STORED,
  start_point      geometry(Point, 4326)
                     GENERATED ALWAYS AS (
                       ST_StartPoint(ST_GeometryN(geom, 1))
                     ) STORED,
  end_point        geometry(Point, 4326)
                     GENERATED ALWAYS AS (
                       ST_EndPoint(ST_GeometryN(geom, ST_NumGeometries(geom)))
                     ) STORED,

  travel_mode      travel_mode_type  NOT NULL DEFAULT 'driving',
  stroke_color     VARCHAR(7)        NOT NULL DEFAULT '#3388ff',
  stroke_width     REAL              NOT NULL DEFAULT 3.0,
  properties       JSONB             NOT NULL DEFAULT '{}'::jsonb,
  is_active        BOOLEAN           NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routes_geom  ON routes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_routes_start ON routes USING GIST (start_point);
CREATE INDEX IF NOT EXISTS idx_routes_mode  ON routes (travel_mode);