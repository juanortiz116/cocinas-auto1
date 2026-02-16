-- Run this in Supabase SQL Editor to set up the Admin Backend

CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'base', 'wall', 'tall'
  width INTEGER NOT NULL, -- mm
  height INTEGER NOT NULL, -- mm
  depth INTEGER NOT NULL, -- mm
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS design_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL UNIQUE,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL, -- 'mm', 'cm', 'px'
  priority TEXT DEFAULT 'Medium', -- High, Medium, Low
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_rules ENABLE ROW LEVEL SECURITY;

-- ⚠️ IMPORTANT: Public Access Policies (Modify for production!)
-- Allows anyone to read/write catalog and rules. 
-- For strict security, change 'TO PUBLIC' to specific roles or authenticated users.

CREATE POLICY "Public read catalog" ON catalog_items FOR SELECT USING (true);
CREATE POLICY "Public write catalog" ON catalog_items FOR ALL USING (true);

CREATE POLICY "Public read rules" ON design_rules FOR SELECT USING (true);
CREATE POLICY "Public write rules" ON design_rules FOR ALL USING (true);

-- Insert some default rules
INSERT INTO design_rules (rule_name, value, unit) VALUES
('MinPassageWidth', 900, 'mm'),
('CounterHeight', 900, 'mm'),
('WallUnitHeight', 1500, 'mm')
ON CONFLICT (rule_name) DO NOTHING;
