ALTER TABLE profiles
  ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_profiles_is_super_admin ON profiles(is_super_admin);

COMMENT ON COLUMN profiles.is_super_admin IS
  'Developer-only super admin role. Set manually in Supabase. Grants full access to all features including KPI Dashboard.';
