-- Transactional employee termination operation.
-- Reassigns active direct reports and archives the terminated employee profile.

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
  FROM profiles
  WHERE id = p_actor_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not verify requester identity';
  END IF;

  IF NOT (COALESCE(v_actor.is_admin, FALSE) OR COALESCE(v_actor.is_super_admin, FALSE)) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT id, email, full_name, employment_status
  INTO v_target
  FROM profiles
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
  FROM profiles
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
    FROM profiles
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

    -- Prevent successor assignment to anyone in the terminated manager's subtree.
    IF EXISTS (
      WITH RECURSIVE descendants AS (
        SELECT p.id
        FROM profiles p
        WHERE p.manager_id = p_target_user_id

        UNION

        SELECT p.id
        FROM profiles p
        INNER JOIN descendants d ON p.manager_id = d.id
      )
      SELECT 1
      FROM descendants
      WHERE id = p_successor_manager_id
    ) THEN
      RAISE EXCEPTION 'Successor cannot be in the terminated employee''s reporting chain';
    END IF;
  END IF;

  IF v_reassigned_count > 0 THEN
    UPDATE profiles
    SET manager_id = p_successor_manager_id
    WHERE manager_id = p_target_user_id
      AND employment_status = 'active';

    GET DIAGNOSTICS v_reassigned_count = ROW_COUNT;
  END IF;

  UPDATE profiles
  SET employment_status = 'terminated',
      terminated_at = v_now,
      termination_effective_at = v_effective_at,
      termination_reason = v_reason,
      terminated_by = p_actor_user_id,
      archived_at = v_now,
      is_manager = FALSE,
      updated_at = v_now
  WHERE id = p_target_user_id;

  INSERT INTO employee_termination_events (
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
