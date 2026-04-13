-- 008_seed_data.sql — ข้อมูลตัวอย่าง Bangkok
-- ⚠ ลบหรือ skip ไฟล์นี้ก่อน production

-- Places — POI กรุงเทพ
INSERT INTO places (name, category, geom, address, city, country) VALUES
  ('วัดพระแก้ว',          'temple',     ST_SetSRID(ST_MakePoint(100.4913, 13.7516), 4326), 'ถนนหน้าพระลาน', 'กรุงเทพฯ', 'TH'),
  ('ร้านกาแฟ Amazon',     'cafe',       ST_SetSRID(ST_MakePoint(100.5220, 13.7400), 4326), 'สีลม', 'กรุงเทพฯ', 'TH'),
  ('สวนลุมพินี',           'park',       ST_SetSRID(ST_MakePoint(100.5418, 13.7310), 4326), 'ถนนพระราม 4', 'กรุงเทพฯ', 'TH'),
  ('โรงพยาบาลจุฬา',       'hospital',   ST_SetSRID(ST_MakePoint(100.5349, 13.7330), 4326), 'ถนนพระราม 4', 'กรุงเทพฯ', 'TH'),
  ('MBK Center',          'shopping',   ST_SetSRID(ST_MakePoint(100.4298, 13.7445), 4326), 'ปทุมวัน', 'กรุงเทพฯ', 'TH'),
  ('Siam Paragon',        'shopping',   ST_SetSRID(ST_MakePoint(100.5340, 13.7467), 4326), 'ถนนพระราม 1', 'กรุงเทพฯ', 'TH'),
  ('ร้านอาหาร Somtum Der','restaurant', ST_SetSRID(ST_MakePoint(100.5500, 13.7280), 4326), 'สาทร', 'กรุงเทพฯ', 'TH'),
  ('วัดอรุณ',              'temple',     ST_SetSRID(ST_MakePoint(100.4887, 13.7438), 4326), 'บางกอกน้อย', 'กรุงเทพฯ', 'TH'),
  ('Chatuchak Weekend Market','shopping',ST_SetSRID(ST_MakePoint(100.5506, 13.8000), 4326), 'จตุจักร', 'กรุงเทพฯ', 'TH'),
  ('The Commons Thonglor', 'cafe',      ST_SetSRID(ST_MakePoint(100.5851, 13.7295), 4326), 'ทองหล่อ', 'กรุงเทพฯ', 'TH')
ON CONFLICT DO NOTHING;

-- Routes — เส้นทางตัวอย่าง
INSERT INTO routes (name, travel_mode, geom) VALUES
  ('สีลม → จตุจักร (MRT)',
   'transit',
   ST_Multi(ST_SetSRID(
     ST_GeomFromText('LINESTRING(100.5220 13.7230, 100.5290 13.7380, 100.5350 13.7467, 100.5400 13.7600, 100.5440 13.7750, 100.5506 13.8000)'),
     4326))
  ),
  ('ลุมพินี → สยาม (เดิน)',
   'walking',
   ST_Multi(ST_SetSRID(
     ST_GeomFromText('LINESTRING(100.5418 13.7310, 100.5380 13.7350, 100.5340 13.7467)'),
     4326))
  )
ON CONFLICT DO NOTHING;

-- Areas — โซนตัวอย่าง
INSERT INTO areas (name, zone_type, fill_color, stroke_color, fill_opacity, geom) VALUES
  ('สีลม CBD',
   'commercial',
   '#378ADD40', '#378ADD', 0.2,
   ST_Multi(ST_SetSRID(
     ST_GeomFromText('POLYGON((100.514 13.720, 100.535 13.720, 100.535 13.740, 100.514 13.740, 100.514 13.720))'),
     4326))
  ),
  ('สวนลุมพินี',
   'park',
   '#1D9E7540', '#1D9E75', 0.3,
   ST_Multi(ST_SetSRID(
     ST_GeomFromText('POLYGON((100.538 13.727, 100.546 13.727, 100.546 13.735, 100.538 13.735, 100.538 13.727))'),
     4326))
  )
ON CONFLICT DO NOTHING;