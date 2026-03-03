-- Auth hardening migration:
-- - Fix stale profile self-update constraints
-- - Fix manager team update policy bug
-- - Enable RLS on organization_settings
-- - Harden SECURITY DEFINER functions and EXECUTE grants

-- -----------------------------------------------------------------------------
-- SECURITY DEFINER function hardening
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_profile_branch(user_id UUID)
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE branch AS (
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
$$;

CREATE OR REPLACE FUNCTION public.get_manager_team(p_manager_id UUID)
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE team AS (
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
      p.onboarding_completed,
      p.created_at,
      p.updated_at
    FROM public.profiles p
    WHERE p.manager_id = p_manager_id

    UNION

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
      p.onboarding_completed,
      p.created_at,
      p.updated_at
    FROM public.profiles p
    INNER JOIN team t ON p.manager_id = t.id
  )
  SELECT * FROM team;
END;
$$;

CREATE OR REPLACE FUNCTION public.terminate_employee(
  p_actor_user_id UUID,
  p_target_user_id UUID,
  p_successor_manager_id UUID DEFAULT NULL,
  p_termination_effective_at TIMESTAMPTZ DEFAULT NULL,
  p_termination_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  reassigned_count INTEGER,
  target_user_id UUID,
  successor_manager_id UUID,
  terminated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor RECORD;
  v_target RECORD;
  v_successor RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_effective_at TIMESTAMPTZ := COALESCE(p_termination_effective_at, NOW());
  v_reassigned_count INTEGER := 0;
  v_reason TEXT := NULLIF(TRIM(p_termination_reason), '');
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Requester is required';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target employee is required';
  END IF;

  IF p_actor_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'You cannot terminate your own account';
  END IF;

  SELECT id, is_admin, is_super_admin
  INTO v_actor
  FROM public.profiles
  WHERE id = p_actor_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not verify requester identity';
  END IF;

  IF NOT (COALESCE(v_actor.is_admin, FALSE) OR COALESCE(v_actor.is_super_admin, FALSE)) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT id, email, full_name, employment_status
  INTO v_target
  FROM public.profiles
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target employee not found';
  END IF;

  IF v_target.employment_status = 'terminated' THEN
    RAISE EXCEPTION 'Employee is already terminated';
  END IF;

  SELECT COUNT(*)
  INTO v_reassigned_count
  FROM public.profiles
  WHERE manager_id = p_target_user_id
    AND employment_status = 'active';

  IF v_reassigned_count > 0 AND p_successor_manager_id IS NULL THEN
    RAISE EXCEPTION 'successor_manager_id is required when the employee has active direct reports';
  END IF;

  IF p_successor_manager_id IS NOT NULL THEN
    IF p_successor_manager_id = p_target_user_id THEN
      RAISE EXCEPTION 'successor_manager_id cannot match the terminated employee';
    END IF;

    SELECT id, is_manager, employment_status
    INTO v_successor
    FROM public.profiles
    WHERE id = p_successor_manager_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Successor manager not found';
    END IF;

    IF v_successor.employment_status <> 'active' THEN
      RAISE EXCEPTION 'Successor manager must be active';
    END IF;

    IF COALESCE(v_successor.is_manager, FALSE) = FALSE THEN
      RAISE EXCEPTION 'Successor must have manager role';
    END IF;

    IF EXISTS (
      WITH RECURSIVE descendants AS (
        SELECT p.id
        FROM public.profiles p
        WHERE p.manager_id = p_target_user_id

        UNION

        SELECT p.id
        FROM public.profiles p
        INNER JOIN descendants d ON p.manager_id = d.id
      )
      SELECT 1
      FROM descendants
      WHERE id = p_successor_manager_id
    ) THEN
      RAISE EXCEPTION 'Successor cannot be in the terminated employee''s reporting chain';
    END IF;
  END IF;

  -- Expose actor id so auth.uid() in downstream triggers/policies is traceable.
  PERFORM set_config('request.jwt.claim.sub', p_actor_user_id::text, true);

  IF v_reassigned_count > 0 THEN
    UPDATE public.profiles
    SET manager_id = p_successor_manager_id
    WHERE manager_id = p_target_user_id
      AND employment_status = 'active';

    GET DIAGNOSTICS v_reassigned_count = ROW_COUNT;
  END IF;

  UPDATE public.profiles
  SET employment_status = 'terminated',
      terminated_at = v_now,
      termination_effective_at = v_effective_at,
      termination_reason = v_reason,
      terminated_by = p_actor_user_id,
      archived_at = v_now,
      is_manager = FALSE,
      updated_at = v_now
  WHERE id = p_target_user_id;

  INSERT INTO public.employee_termination_events (
    terminated_profile_id,
    terminated_profile_email,
    terminated_profile_name,
    terminated_by,
    successor_manager_id,
    direct_reports_reassigned_count,
    termination_reason,
    termination_effective_at,
    terminated_at
  ) VALUES (
    p_target_user_id,
    v_target.email,
    v_target.full_name,
    p_actor_user_id,
    p_successor_manager_id,
    v_reassigned_count,
    v_reason,
    v_effective_at,
    v_now
  );

  RETURN QUERY
  SELECT TRUE, v_reassigned_count, p_target_user_id, p_successor_manager_id, v_now;
END;
$$;

-- -----------------------------------------------------------------------------
-- Profiles policy hardening
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers can update their team" ON public.profiles;

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND EXISTS (
      SELECT 1
      FROM public.profiles existing
      WHERE existing.id = public.profiles.id
        AND public.profiles.is_admin IS NOT DISTINCT FROM existing.is_admin
        AND public.profiles.is_manager IS NOT DISTINCT FROM existing.is_manager
        AND public.profiles.is_executive IS NOT DISTINCT FROM existing.is_executive
        AND public.profiles.is_super_admin IS NOT DISTINCT FROM existing.is_super_admin
        AND public.profiles.is_process_editor IS NOT DISTINCT FROM existing.is_process_editor
        AND public.profiles.manager_id IS NOT DISTINCT FROM existing.manager_id
        AND public.profiles.department_id IS NOT DISTINCT FROM existing.department_id
        AND public.profiles.employment_status IS NOT DISTINCT FROM existing.employment_status
        AND public.profiles.terminated_at IS NOT DISTINCT FROM existing.terminated_at
        AND public.profiles.termination_effective_at IS NOT DISTINCT FROM existing.termination_effective_at
        AND public.profiles.termination_reason IS NOT DISTINCT FROM existing.termination_reason
        AND public.profiles.terminated_by IS NOT DISTINCT FROM existing.terminated_by
        AND public.profiles.archived_at IS NOT DISTINCT FROM existing.archived_at
    )
  );

CREATE POLICY "Managers can update their team"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles actor
      WHERE actor.id = auth.uid()
        AND actor.is_manager = TRUE
    )
    AND public.profiles.id IN (SELECT id FROM public.get_manager_team(auth.uid()))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles actor
      WHERE actor.id = auth.uid()
        AND actor.is_manager = TRUE
    )
    AND public.profiles.id IN (SELECT id FROM public.get_manager_team(auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.profiles existing
      WHERE existing.id = public.profiles.id
        AND public.profiles.is_admin IS NOT DISTINCT FROM existing.is_admin
        AND public.profiles.is_manager IS NOT DISTINCT FROM existing.is_manager
        AND public.profiles.is_executive IS NOT DISTINCT FROM existing.is_executive
        AND public.profiles.is_super_admin IS NOT DISTINCT FROM existing.is_super_admin
        AND public.profiles.is_process_editor IS NOT DISTINCT FROM existing.is_process_editor
        AND public.profiles.employment_status IS NOT DISTINCT FROM existing.employment_status
        AND public.profiles.terminated_at IS NOT DISTINCT FROM existing.terminated_at
        AND public.profiles.termination_effective_at IS NOT DISTINCT FROM existing.termination_effective_at
        AND public.profiles.termination_reason IS NOT DISTINCT FROM existing.termination_reason
        AND public.profiles.terminated_by IS NOT DISTINCT FROM existing.terminated_by
        AND public.profiles.archived_at IS NOT DISTINCT FROM existing.archived_at
        AND (
          public.profiles.manager_id IS NULL
          OR public.profiles.manager_id = auth.uid()
          OR public.profiles.manager_id IS NOT DISTINCT FROM existing.manager_id
        )
    )
  );

-- -----------------------------------------------------------------------------
-- organization_settings RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Restrict termination event inserts to authenticated actor identity
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "System can insert employee termination events" ON public.employee_termination_events;

CREATE POLICY "System can insert employee termination events"
  ON public.employee_termination_events FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND terminated_by = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- EXECUTE grants / revokes
-- -----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.get_profile_branch(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_branch(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_manager_team(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_team(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.terminate_employee(UUID, UUID, UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.terminate_employee(UUID, UUID, UUID, TIMESTAMPTZ, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.can_edit_process_for_lock(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.acquire_process_edit_lock(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.force_takeover_process_edit_lock(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.release_process_edit_lock(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_edit_process_for_lock(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acquire_process_edit_lock(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.force_takeover_process_edit_lock(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_process_edit_lock(UUID) TO authenticated, service_role;
