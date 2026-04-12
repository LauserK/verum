-- backend/migrations/026_super_admin_fields.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_superadmin boolean DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
