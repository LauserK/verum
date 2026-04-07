-- Create join table for Users and Organizations
CREATE TABLE IF NOT EXISTS profile_organizations (
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    role_id uuid REFERENCES custom_roles(id) ON DELETE SET NULL, -- Optional: role per org
    is_default boolean default false,
    created_at timestamp with time zone default now(),
    PRIMARY KEY (profile_id, organization_id)
);

-- Migrate existing data from profiles.organization_id
INSERT INTO profile_organizations (profile_id, organization_id, is_default)
SELECT id, organization_id, true FROM profiles 
WHERE organization_id IS NOT NULL
ON CONFLICT DO NOTHING;
