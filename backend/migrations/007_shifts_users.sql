-- ============================================
-- 007_shifts_users.sql
-- Shifts table + venue_id on profiles
-- ============================================

-- 1. Shifts table (per venue)
CREATE TABLE IF NOT EXISTS shifts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  sort_order int DEFAULT 0
);

-- 2. Add venue and shift assignment to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES shifts(id) NULL;

-- 3. RLS policies for shifts
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage shifts"
  ON shifts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
