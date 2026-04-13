-- 001_init.sql — PostGIS extensions + enums
-- รันครั้งเดียวต่อ database (ต้องการ superuser)

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ตรวจสอบ
-- SELECT PostGIS_Full_Version();

-- travel mode enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_mode_type') THEN
    CREATE TYPE travel_mode_type AS ENUM ('driving', 'walking', 'cycling', 'transit');
  END IF;
END$$;