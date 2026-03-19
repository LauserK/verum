-- backend/migrations/020_drop_profile_role_constraint.sql

-- Drop the old constraint that restricted roles to only 'admin' or 'staff'
-- so that custom roles can be assigned to users in the profiles table.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;