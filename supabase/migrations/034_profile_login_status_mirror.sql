-- Mirror auth login status onto profiles for RLS-safe reads in the app.
-- This removes the need for admin-only auth.users lookups for "pending invite" badges.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_logged_in BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_has_logged_in ON public.profiles(has_logged_in);

-- Backfill from auth.users so existing accounts have consistent values.
UPDATE public.profiles p
SET
  has_logged_in = (u.last_sign_in_at IS NOT NULL),
  last_sign_in_at = u.last_sign_in_at
FROM auth.users u
WHERE u.id = p.id
  AND (
    p.has_logged_in IS DISTINCT FROM (u.last_sign_in_at IS NOT NULL)
    OR p.last_sign_in_at IS DISTINCT FROM u.last_sign_in_at
  );

CREATE OR REPLACE FUNCTION public.sync_profile_login_status_from_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    has_logged_in = (NEW.last_sign_in_at IS NOT NULL),
    last_sign_in_at = NEW.last_sign_in_at
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_login_status_on_auth_user_insert ON auth.users;
CREATE TRIGGER sync_profile_login_status_on_auth_user_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_login_status_from_auth_user();

DROP TRIGGER IF EXISTS sync_profile_login_status_on_auth_user_update ON auth.users;
CREATE TRIGGER sync_profile_login_status_on_auth_user_update
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.sync_profile_login_status_from_auth_user();
