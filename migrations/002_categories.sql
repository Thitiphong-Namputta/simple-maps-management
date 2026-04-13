-- 002_categories.sql — Table categories + seed 13 หมวดหมู่

CREATE TABLE IF NOT EXISTS categories (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT  NOT NULL UNIQUE,
  name_th     TEXT  NOT NULL,
  name_en     TEXT  NOT NULL,
  icon        TEXT,
  color       VARCHAR(7) NOT NULL DEFAULT '#888780',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed 13 หมวดหมู่
INSERT INTO categories (slug, name_th, name_en, icon, color) VALUES
  ('cafe',        'คาเฟ่',           'Cafe',           '☕', '#7F77DD'),
  ('restaurant',  'ร้านอาหาร',       'Restaurant',     '🍜', '#D85A30'),
  ('park',        'สวนสาธารณะ',      'Park',           '🌳', '#1D9E75'),
  ('temple',      'วัด',             'Temple',         '🛕', '#BA7517'),
  ('hospital',    'โรงพยาบาล',      'Hospital',       '🏥', '#E05C8A'),
  ('school',      'โรงเรียน',        'School',         '🏫', '#378ADD'),
  ('hotel',       'โรงแรม',          'Hotel',          '🏨', '#6B5B95'),
  ('bank',        'ธนาคาร',          'Bank',           '🏦', '#45818E'),
  ('gas_station', 'ปั๊มน้ำมัน',      'Gas Station',    '⛽', '#CC4125'),
  ('shopping',    'ห้างสรรพสินค้า',  'Shopping',       '🛍', '#EA4335'),
  ('pharmacy',    'ร้านขายยา',       'Pharmacy',       '💊', '#34A853'),
  ('atm',         'ตู้ ATM',         'ATM',            '🏧', '#FBBC04'),
  ('other',       'อื่นๆ',           'Other',          '📍', '#888780')
ON CONFLICT (slug) DO NOTHING;