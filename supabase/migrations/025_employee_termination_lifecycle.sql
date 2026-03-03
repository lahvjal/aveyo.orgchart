-- Employee lifecycle and termination archive support.
-- Adds a soft-termination model to preserve history and avoid destructive cascades.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termination_effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termination_reason TEXT,
  ADD COLUMN IF NOT EXISTS terminated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Enforce valid status values and basic lifecycle consistency.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_employment_status_check'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_employment_status_check
      CHECK (employment_status IN ('active', 'terminated'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_employment_lifecycle_check'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_employment_lifecycle_check
      CHECK (
        (
          employment_status = 'active'
          AND terminated_at IS NULL
          AND archived_at IS NULL
        )
        OR (
          employment_status = 'terminated'
          AND terminated_at IS NOT NULL
          AND archived_at IS NOT NULL
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_employment_status
  ON profiles(employment_status);

CREATE INDEX IF NOT EXISTS idx_profiles_terminated_at
  ON profiles(terminated_at)
  WHERE employment_status = 'terminated';

-- Immutable archive of termination events.
CREATE TABLE IF NOT EXISTS employee_termination_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  terminated_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  terminated_profile_email TEXT NOT NULL,
  terminated_profile_name TEXT NOT NULL,
  terminated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  successor_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  direct_reports_reassigned_count INTEGER NOT NULL DEFAULT 0,
  termination_reason TEXT,
  termination_effective_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_termination_events_terminated_profile_id
  ON employee_termination_events(terminated_profile_id);

CREATE INDEX IF NOT EXISTS idx_employee_termination_events_terminated_at
  ON employee_termination_events(terminated_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_termination_events_successor_manager_id
  ON employee_termination_events(successor_manager_id);

ALTER TABLE employee_termination_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view employee termination events" ON employee_termination_events;

CREATE POLICY "Admins can view employee termination events"
  ON employee_termination_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = TRUE OR profiles.is_super_admin = TRUE)
    )
  );

DROP POLICY IF EXISTS "System can insert employee termination events" ON employee_termination_events;

CREATE POLICY "System can insert employee termination events"
  ON employee_termination_events FOR INSERT
  WITH CHECK (TRUE);
