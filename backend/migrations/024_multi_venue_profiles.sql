-- backend/migrations/024_multi_venue_profiles.sql

CREATE TABLE IF NOT EXISTS profile_venues (
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    venue_id uuid REFERENCES venues(id) ON DELETE CASCADE,
    created_at timestamp with time zone default now(),
    PRIMARY KEY (profile_id, venue_id)
);

-- Migrate existing data
INSERT INTO profile_venues (profile_id, venue_id)
SELECT id, venue_id FROM profiles WHERE venue_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE profile_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own venue links"
ON profile_venues FOR SELECT TO authenticated USING (profile_id = auth.uid());

CREATE POLICY "Admins can manage profile venues"
ON profile_venues FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
