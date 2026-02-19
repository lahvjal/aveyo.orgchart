ALTER TABLE profiles
  ADD COLUMN is_executive BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_profiles_is_executive ON profiles(is_executive);

COMMENT ON COLUMN profiles.is_executive IS
  'Grants access to the KPI Dashboard. Typically combined with is_manager.';
