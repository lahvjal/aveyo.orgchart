-- Extend get_profile_branch to include employment lifecycle columns.

DROP FUNCTION IF EXISTS get_profile_branch(UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_profile_branch(user_id UUID)
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
  is_executive BOOLEAN,
  is_super_admin BOOLEAN,
  is_process_editor BOOLEAN,
  onboarding_completed BOOLEAN,
  employment_status TEXT,
  terminated_at TIMESTAMPTZ,
  termination_effective_at TIMESTAMPTZ,
  termination_reason TEXT,
  terminated_by UUID,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE branch AS (
    -- Start with the requested profile.
    SELECT
      p.id,
      p.email,
      p.full_name,
      p.preferred_name,
      p.job_title,
      p.job_description,
      p.start_date,
      p.profile_photo_url,
      p.phone,
      p.location,
      p.department_id,
      p.manager_id,
      p.social_links,
      p.is_admin,
      p.is_manager,
      p.is_executive,
      p.is_super_admin,
      p.is_process_editor,
      p.onboarding_completed,
      p.employment_status,
      p.terminated_at,
      p.termination_effective_at,
      p.termination_reason,
      p.terminated_by,
      p.archived_at,
      p.created_at,
      p.updated_at
    FROM public.profiles p
    WHERE p.id = user_id

    UNION

    -- Recursively include direct and indirect reports.
    SELECT
      p.id,
      p.email,
      p.full_name,
      p.preferred_name,
      p.job_title,
      p.job_description,
      p.start_date,
      p.profile_photo_url,
      p.phone,
      p.location,
      p.department_id,
      p.manager_id,
      p.social_links,
      p.is_admin,
      p.is_manager,
      p.is_executive,
      p.is_super_admin,
      p.is_process_editor,
      p.onboarding_completed,
      p.employment_status,
      p.terminated_at,
      p.termination_effective_at,
      p.termination_reason,
      p.terminated_by,
      p.archived_at,
      p.created_at,
      p.updated_at
    FROM public.profiles p
    INNER JOIN branch b ON p.manager_id = b.id
  )
  SELECT * FROM branch;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Users can view their branch positions" ON org_chart_positions;

CREATE POLICY "Users can view their branch positions"
  ON org_chart_positions FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM get_profile_branch(auth.uid())
    )
  );
