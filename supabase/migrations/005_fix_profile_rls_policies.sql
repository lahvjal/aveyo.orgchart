-- Fix RLS policies on profiles table that were dropped by CASCADE in migration 004
-- These policies depend on get_profile_branch function

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their branch" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Recreate the profile SELECT policy for non-admins
CREATE POLICY "Users can view their branch"
  ON profiles FOR SELECT
  USING (
    -- Users can always see their own profile
    auth.uid() = id 
    OR
    -- Admins can see all profiles
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
    OR
    -- Users can see profiles in their branch (reports and managers)
    id IN (
      SELECT get_profile_branch.id 
      FROM get_profile_branch(auth.uid())
    )
  );

-- Note: We combine both admin and user logic into one policy to avoid policy conflicts
