-- Single-editor process locking.
-- Policy choice: no automatic lock expiry. Editors can explicitly take over.

CREATE TABLE IF NOT EXISTS process_edit_locks (
  process_id      UUID PRIMARY KEY REFERENCES processes(id) ON DELETE CASCADE,
  locked_by       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  locked_by_name  TEXT NOT NULL,
  locked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_edit_locks_locked_by
  ON process_edit_locks(locked_by);

ALTER TABLE process_edit_locks ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON process_edit_locks TO authenticated;

CREATE POLICY "Authenticated can read process edit locks"
  ON process_edit_locks FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.can_edit_process_for_lock(
  p_process_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM processes p
    WHERE p.id = p_process_id
      AND (
        p.created_by = p_user_id
        OR EXISTS (
          SELECT 1
          FROM profiles pr
          WHERE pr.id = p_user_id
            AND (
              pr.is_admin = true
              OR pr.is_process_editor = true
            )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.acquire_process_edit_lock(
  p_process_id UUID
)
RETURNS TABLE (
  acquired BOOLEAN,
  process_id UUID,
  locked_by UUID,
  locked_by_name TEXT,
  locked_at TIMESTAMPTZ,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_name TEXT;
  v_lock process_edit_locks%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT can_edit_process_for_lock(p_process_id, v_user_id) THEN
    RAISE EXCEPTION 'Not allowed to edit this process';
  END IF;

  SELECT p.full_name INTO v_name
  FROM profiles p
  WHERE p.id = v_user_id;

  v_name := COALESCE(v_name, 'Unknown editor');

  BEGIN
    INSERT INTO process_edit_locks (process_id, locked_by, locked_by_name, locked_at)
    VALUES (p_process_id, v_user_id, v_name, NOW())
    RETURNING * INTO v_lock;

    RETURN QUERY
    SELECT TRUE, v_lock.process_id, v_lock.locked_by, v_lock.locked_by_name, v_lock.locked_at, 'lock_acquired'::TEXT;
    RETURN;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_lock
    FROM process_edit_locks
    WHERE process_edit_locks.process_id = p_process_id;

    IF v_lock.locked_by = v_user_id THEN
      UPDATE process_edit_locks
      SET locked_by_name = v_name
      WHERE process_edit_locks.process_id = p_process_id
      RETURNING * INTO v_lock;

      RETURN QUERY
      SELECT TRUE, v_lock.process_id, v_lock.locked_by, v_lock.locked_by_name, v_lock.locked_at, 'already_owner'::TEXT;
      RETURN;
    END IF;

    RETURN QUERY
    SELECT FALSE, v_lock.process_id, v_lock.locked_by, v_lock.locked_by_name, v_lock.locked_at, 'locked_by_other'::TEXT;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.force_takeover_process_edit_lock(
  p_process_id UUID
)
RETURNS TABLE (
  acquired BOOLEAN,
  process_id UUID,
  locked_by UUID,
  locked_by_name TEXT,
  locked_at TIMESTAMPTZ,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_name TEXT;
  v_lock process_edit_locks%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT can_edit_process_for_lock(p_process_id, v_user_id) THEN
    RAISE EXCEPTION 'Not allowed to edit this process';
  END IF;

  SELECT p.full_name INTO v_name
  FROM profiles p
  WHERE p.id = v_user_id;

  v_name := COALESCE(v_name, 'Unknown editor');

  INSERT INTO process_edit_locks (process_id, locked_by, locked_by_name, locked_at)
  VALUES (p_process_id, v_user_id, v_name, NOW())
  ON CONFLICT (process_id)
  DO UPDATE
  SET locked_by = EXCLUDED.locked_by,
      locked_by_name = EXCLUDED.locked_by_name,
      locked_at = NOW()
  RETURNING * INTO v_lock;

  RETURN QUERY
  SELECT TRUE, v_lock.process_id, v_lock.locked_by, v_lock.locked_by_name, v_lock.locked_at, 'lock_taken_over'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_process_edit_lock(
  p_process_id UUID
)
RETURNS TABLE (
  released BOOLEAN,
  process_id UUID,
  locked_by UUID,
  locked_by_name TEXT,
  locked_at TIMESTAMPTZ,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_lock process_edit_locks%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM process_edit_locks
  WHERE process_edit_locks.process_id = p_process_id
    AND process_edit_locks.locked_by = v_user_id
  RETURNING * INTO v_lock;

  IF FOUND THEN
    RETURN QUERY
    SELECT TRUE, p_process_id, v_user_id, NULL::TEXT, NOW(), 'lock_released'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_lock
  FROM process_edit_locks
  WHERE process_edit_locks.process_id = p_process_id;

  IF v_lock.process_id IS NULL THEN
    RETURN QUERY
    SELECT FALSE, p_process_id, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ, 'lock_not_found'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT FALSE, v_lock.process_id, v_lock.locked_by, v_lock.locked_by_name, v_lock.locked_at, 'not_lock_owner'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_edit_process_for_lock(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_process_edit_lock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_takeover_process_edit_lock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_process_edit_lock(UUID) TO authenticated;
