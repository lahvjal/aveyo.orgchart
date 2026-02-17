-- Add manager role and RLS policies for managers
-- This allows users with is_manager = TRUE to manage their team members

-- Add is_manager column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_manager BOOLEAN DEFAULT FALSE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_manager ON profiles(is_manager);

-- Function to get all direct and indirect reports of a manager
-- Note: Parameter is named p_manager_id to avoid conflict with the manager_id column in RETURNS TABLE
CREATE OR REPLACE FUNCTION get_manager_team(p_manager_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  preferred_name TEXT,
  job_title TEXT,
  job_description TEXT,
  start_date DATE,
  profile_photo_url TEXT,
  phone TEXT,
  location TEXT,
  department_id UUID,
  manager_id UUID,
  social_links JSONB,
  is_admin BOOLEAN,
  is_manager BOOLEAN,
  onboarding_completed BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE team AS (
    -- Start with direct reports
    SELECT 
      p.id, p.email, p.full_name, p.preferred_name, p.job_title, p.job_description,
      p.start_date, p.profile_photo_url, p.phone, p.location,
      p.department_id, p.manager_id, p.social_links, p.is_admin, p.is_manager, p.onboarding_completed,
      p.created_at, p.updated_at
    FROM public.profiles p
    WHERE p.manager_id = p_manager_id
    
    UNION
    
    -- Recursively get all indirect reports
    SELECT 
      p.id, p.email, p.full_name, p.preferred_name, p.job_title, p.job_description,
      p.start_date, p.profile_photo_url, p.phone, p.location,
      p.department_id, p.manager_id, p.social_links, p.is_admin, p.is_manager, p.onboarding_completed,
      p.created_at, p.updated_at
    FROM public.profiles p
    INNER JOIN team t ON p.manager_id = t.id
  )
  SELECT * FROM team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for Managers

-- Note: SELECT policy is already permissive (all authenticated users can view all profiles)
-- from migration 007. We only need UPDATE policy for managers.

-- Managers can update their team members (but not change manager_id to someone else)
CREATE POLICY "Managers can update their team"
  ON profiles FOR UPDATE
  USING (
    -- Admins can update all (existing policy covers this)
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
    OR
    -- Managers can update their team members
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_manager = TRUE
      )
      AND id IN (SELECT id FROM get_manager_team(auth.uid()))
    )
  )
  WITH CHECK (
    -- Admins can update all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
    OR
    -- Managers can update team members but:
    -- 1. Cannot change manager_id to someone other than themselves
    -- 2. Cannot change is_admin or is_manager flags
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_manager = TRUE
      )
      AND id IN (SELECT id FROM get_manager_team(auth.uid()))
      AND (
        -- If manager_id is being set, it must be the current manager
        manager_id IS NULL 
        OR manager_id = auth.uid()
        OR manager_id = (SELECT manager_id FROM profiles WHERE id = id)
      )
      AND is_admin = (SELECT is_admin FROM profiles WHERE id = id)
      AND is_manager = (SELECT is_manager FROM profiles WHERE id = id)
    )
  );

-- Note: Profile insertion is handled by the handle_new_user trigger
-- Managers will need to use the admin client (via invitation hook) to create profiles
-- The invitation hook validates permissions before allowing profile creation
