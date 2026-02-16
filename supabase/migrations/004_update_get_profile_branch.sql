-- Drop function with CASCADE to remove dependent policies
DROP FUNCTION IF EXISTS get_profile_branch(UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_profile_branch(user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  preferred_name TEXT,
  job_title TEXT,
  job_description TEXT,
  bio TEXT,
  start_date DATE,
  profile_photo_url TEXT,
  phone TEXT,
  location TEXT,
  department_id UUID,
  manager_id UUID,
  social_links JSONB,
  is_admin BOOLEAN,
  onboarding_completed BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE branch AS (
    -- Start with the user's profile
    SELECT 
      p.id, p.email, p.full_name, p.preferred_name, p.job_title, p.job_description, p.bio,
      p.start_date, p.profile_photo_url, p.phone, p.location,
      p.department_id, p.manager_id, p.social_links, p.is_admin, p.onboarding_completed,
      p.created_at, p.updated_at
    FROM public.profiles p
    WHERE p.id = user_id
    
    UNION
    
    -- Recursively get all direct and indirect reports
    SELECT 
      p.id, p.email, p.full_name, p.preferred_name, p.job_title, p.job_description, p.bio,
      p.start_date, p.profile_photo_url, p.phone, p.location,
      p.department_id, p.manager_id, p.social_links, p.is_admin, p.onboarding_completed,
      p.created_at, p.updated_at
    FROM public.profiles p
    INNER JOIN branch b ON p.manager_id = b.id
  )
  SELECT * FROM branch;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the policy that depends on this function
DROP POLICY IF EXISTS "Users can view their branch positions" ON org_chart_positions;

CREATE POLICY "Users can view their branch positions"
  ON org_chart_positions FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM get_profile_branch(auth.uid())
    )
  );
