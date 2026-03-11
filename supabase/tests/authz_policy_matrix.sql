-- SQL authz regression checks.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/authz_policy_matrix.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'organization_settings'
      AND c.relrowsecurity = TRUE
  ) THEN
    RAISE EXCEPTION 'organization_settings must have RLS enabled';
  END IF;
END;
$$;

DO $$
DECLARE
  v_function_def TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_function_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_public_org_share_bundle'
  LIMIT 1;

  IF v_function_def IS NULL THEN
    RAISE EXCEPTION 'get_public_org_share_bundle(text) function definition not found';
  END IF;

  IF position('is_admin' IN lower(v_function_def)) > 0
     OR position('is_manager' IN lower(v_function_def)) > 0
     OR position('is_executive' IN lower(v_function_def)) > 0
     OR position('is_super_admin' IN lower(v_function_def)) > 0
     OR position('is_process_editor' IN lower(v_function_def)) > 0
     OR position('onboarding_completed' IN lower(v_function_def)) > 0
     OR position('employment_status' IN lower(v_function_def)) > 0
     OR position('terminated_at' IN lower(v_function_def)) > 0
     OR position('termination_effective_at' IN lower(v_function_def)) > 0
     OR position('termination_reason' IN lower(v_function_def)) > 0
     OR position('terminated_by' IN lower(v_function_def)) > 0
     OR position('archived_at' IN lower(v_function_def)) > 0 THEN
    RAISE EXCEPTION 'get_public_org_share_bundle must not expose internal role/lifecycle fields';
  END IF;

  IF position('full_name' IN lower(v_function_def)) = 0
     OR position('job_title' IN lower(v_function_def)) = 0
     OR position('manager_id' IN lower(v_function_def)) = 0
     OR position('department_id' IN lower(v_function_def)) = 0 THEN
    RAISE EXCEPTION 'get_public_org_share_bundle must include core public org chart fields';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'has_logged_in'
  ) THEN
    RAISE EXCEPTION 'profiles.has_logged_in column is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'last_sign_in_at'
  ) THEN
    RAISE EXCEPTION 'profiles.last_sign_in_at column is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgname = 'sync_profile_login_status_on_auth_user_update'
      AND t.tgrelid = 'auth.users'::regclass
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'sync_profile_login_status_on_auth_user_update trigger is missing on auth.users';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'process_share_links'
      AND policyname = 'anon_select_process_share_links'
  ) THEN
    RAISE EXCEPTION 'anon_select_process_share_links policy must be removed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'processes'
      AND policyname = 'anon_read_shared_processes'
  ) THEN
    RAISE EXCEPTION 'anon_read_shared_processes policy must be removed';
  END IF;
END;
$$;

DO $$
DECLARE
  v_check TEXT;
BEGIN
  SELECT with_check
  INTO v_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can update their own profile';

  IF v_check IS NULL THEN
    RAISE EXCEPTION 'Users can update their own profile policy is missing';
  END IF;

  IF position('is_super_admin' IN v_check) = 0
     OR position('is_process_editor' IN v_check) = 0
     OR position('employment_status' IN v_check) = 0 THEN
    RAISE EXCEPTION 'Profiles self-update policy is missing hardened lifecycle/role checks';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_public_process_bundle'
      AND p.prosecdef = TRUE
  ) THEN
    RAISE EXCEPTION 'get_public_process_bundle(text) SECURITY DEFINER function is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_public_org_share_bundle'
      AND p.prosecdef = TRUE
  ) THEN
    RAISE EXCEPTION 'get_public_org_share_bundle(text) SECURITY DEFINER function is missing';
  END IF;
END;
$$;

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.terminate_employee(uuid,uuid,uuid,timestamptz,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must NOT have EXECUTE on terminate_employee';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.terminate_employee(uuid,uuid,uuid,timestamptz,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must have EXECUTE on terminate_employee';
  END IF;

  IF NOT has_function_privilege('anon', 'public.get_public_process_bundle(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must have EXECUTE on get_public_process_bundle';
  END IF;

  IF NOT has_function_privilege('anon', 'public.get_public_org_share_bundle(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must have EXECUTE on get_public_org_share_bundle';
  END IF;
END;
$$;

SELECT 'authz policy matrix checks passed' AS result;
