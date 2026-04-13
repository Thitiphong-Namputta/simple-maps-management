-- 003_places.sql — Table places + indexes + trigger

CREATE TABLE IF NOT EXISTS places (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  UUID         REFERENCES categories(id) ON DELETE SET NULL,
  name         TEXT         NOT NULL,
  description  TEXT,

  -- Typed geometry — SRID บังคับเสมอ
  geom         geometry(Point, 4326) NOT NULL,

  -- Generated columns — คำนวณอัตโนมัติ ไม่ต้อง trigger หรือ app logic
  geog         geography(Point, 4326)
                 GENERATED ALWAYS AS (geom::geography) STORED,
  latitude     DOUBLE PRECISION
                 GENERATED ALWAYS AS (ST_Y(geom)) STORED,
  longitude    DOUBLE PRECISION
                 GENERATED ALWAYS AS (ST_X(geom)) STORED,

  -- category shorthand (denormalized for query speed)
  category     TEXT,

  address      TEXT,
  city         TEXT,
  country      VARCHAR(2),
  properties   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  tags         TEXT[]       NOT NULL DEFAULT '{}',
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Spatial indexes (บังคับ — ถ้าไม่มี = Seq Scan ทุก spatial query)
CREATE INDEX IF NOT EXISTS idx_places_geom   ON places USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_places_geog   ON places USING GIST (geog);

-- Partial index เฉพาะ active (เล็กกว่า เร็วกว่า)
CREATE INDEX IF NOT EXISTS idx_places_active ON places USING GIST (geom)
  WHERE is_active = true;

-- Non-spatial indexes
CREATE INDEX IF NOT EXISTS idx_places_props  ON places USING GIN (properties jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_places_tags   ON places USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_places_cat    ON places (category_id);
CREATE INDEX IF NOT EXISTS idx_places_cat_slug ON places (category);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_places_updated_at ON places;
CREATE TRIGGER trg_places_updated_at
  BEFORE UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();