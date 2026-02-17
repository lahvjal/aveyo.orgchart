-- Allow all authenticated users to view all profiles in the org chart
-- This enables non-admin users to browse and search the complete organization
-- while still maintaining appropriate edit restrictions

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view their branch" ON profiles;

-- Create a new policy that allows all authenticated users to view all profiles
CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  USING (
    -- Any authenticated user can view any profile
    auth.uid() IS NOT NULL
  );

-- Note: Edit permissions remain restricted:
-- - Users can only update their own profile (limited fields)
-- - Admins can update any profile
-- - Only admins can insert new profiles
