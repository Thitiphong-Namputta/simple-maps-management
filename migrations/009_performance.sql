-- 009_performance.sql — ST_Subdivide, simplified geom, materialized view
-- ⚠ รันหลังจากมีข้อมูลจริงเข้ามาแล้วเท่านั้น

-- ST_Subdivide — ผล 4-60x speedup สำหรับ complex polygon
CREATE TABLE IF NOT EXISTS areas_subdivided AS
SELECT id AS area_id, name, ST_Subdivide(geom, 255) AS geom
FROM areas WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_areas_sub_geom ON areas_subdivided USING GIST (geom);

-- Pre-simplified geometry ตาม zoom level
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS geom_z0_6   geometry,
  ADD COLUMN IF NOT EXISTS geom_z7_10  geometry,
  ADD COLUMN IF NOT EXISTS geom_z11_14 geometry;

UPDATE areas SET
  geom_z0_6   = ST_SimplifyPreserveTopology(geom, 0.05),
  geom_z7_10  = ST_SimplifyPreserveTopology(geom, 0.005),
  geom_z11_14 = ST_SimplifyPreserveTopology(geom, 0.0005);

-- Materialized view — area stats + POI count
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_area_stats AS
SELECT a.id, a.name, a.zone_type, a.geom_z7_10 AS geom,
  ROUND((a.area_sq_meters / 1e6)::numeric, 4) AS area_km2,
  COUNT(p.id) AS poi_count
FROM areas a
LEFT JOIN places p ON ST_Within(p.geom, a.geom) AND p.is_active = true
WHERE a.is_active = true
GROUP BY a.id, a.name, a.zone_type, a.geom_z7_10, a.area_sq_meters;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_area_stats_id   ON mv_area_stats (id);
CREATE INDEX        IF NOT EXISTS idx_mv_area_stats_geom ON mv_area_stats USING GIST (geom);

-- Refresh (run via cron หรือหลัง bulk update)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_area_stats;

-- หลัง bulk insert — บังคับเสมอ
VACUUM ANALYZE places;
VACUUM ANALYZE routes;
VACUUM ANALYZE areas;