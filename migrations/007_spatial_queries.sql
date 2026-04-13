-- 007_spatial_queries.sql — Stored functions: fn_nearby_places, fn_viewport_geojson

-- fn_nearby_places — หา POI ใกล้จุดที่กำหนด
CREATE OR REPLACE FUNCTION fn_nearby_places(
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION,
  p_radius   DOUBLE PRECISION DEFAULT 1000,
  p_category TEXT             DEFAULT NULL,
  p_limit    INTEGER          DEFAULT 50
)
RETURNS JSON AS $$
DECLARE
  v_point geometry := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326);
BEGIN
  RETURN (
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(feat ORDER BY dist_m), '[]'::json)
    )
    FROM (
      SELECT json_build_object(
        'type',      'Feature',
        'id',         id,
        'geometry',   ST_AsGeoJSON(geom, 6)::json,
        'properties', json_build_object(
          'name',       name,
          'category',   category,
          'distance_m', ROUND(dist_m::numeric, 1),
          'latitude',   latitude,
          'longitude',  longitude
        )
      ) AS feat, dist_m
      FROM (
        SELECT *,
          ST_Distance(geog, v_point::geography) AS dist_m
        FROM places
        WHERE ST_DWithin(geog, v_point::geography, p_radius)
          AND is_active = true
          AND (p_category IS NULL OR category = p_category)
        ORDER BY geom <-> v_point
        LIMIT p_limit
      ) t
    ) sub
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- fn_viewport_geojson — โหลด places ใน bounding box
CREATE OR REPLACE FUNCTION fn_viewport_geojson(
  p_min_lng DOUBLE PRECISION,
  p_min_lat DOUBLE PRECISION,
  p_max_lng DOUBLE PRECISION,
  p_max_lat DOUBLE PRECISION
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type',      'Feature',
          'id',         id,
          'geometry',   ST_AsGeoJSON(geom, 6)::json,
          'properties', json_build_object(
            'name',      name,
            'category',  category,
            'latitude',  latitude,
            'longitude', longitude,
            'properties', properties
          )
        )
      ), '[]'::json)
    )
    FROM places
    WHERE geom && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
      AND is_active = true
    LIMIT 500
  );
END;
$$ LANGUAGE plpgsql STABLE;