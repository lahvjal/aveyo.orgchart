-- Public-share redesign:
-- - Remove broad anon table-read policies.
-- - Expose slug-scoped SECURITY DEFINER RPCs with minimal payloads.
-- - Enforce include_contact_info at server projection time.

-- -----------------------------------------------------------------------------
-- Revoke broad anon table reads
-- -----------------------------------------------------------------------------

REVOKE SELECT ON public.process_share_links FROM anon;
REVOKE SELECT ON public.share_links FROM anon;

DROP POLICY IF EXISTS "anon_select_process_share_links" ON public.process_share_links;
DROP POLICY IF EXISTS "anon_read_shared_processes" ON public.processes;
DROP POLICY IF EXISTS "anon_read_shared_process_nodes" ON public.process_nodes;
DROP POLICY IF EXISTS "anon_read_shared_process_edges" ON public.process_edges;

DROP POLICY IF EXISTS "Anyone can view non-expired share links" ON public.share_links;
DROP POLICY IF EXISTS "Authenticated users can view non-expired share links" ON public.share_links;
CREATE POLICY "Authenticated users can view non-expired share links"
  ON public.share_links FOR SELECT
  TO authenticated
  USING (expires_at IS NULL OR expires_at > NOW());

-- -----------------------------------------------------------------------------
-- Slug-scoped public process payload
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_process_bundle(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.process_share_links%ROWTYPE;
  v_process JSONB;
  v_nodes JSONB;
  v_edges JSONB;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_link
  FROM public.process_share_links
  WHERE slug = p_slug
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(p.*)
  INTO v_process
  FROM public.processes p
  WHERE p.id = v_link.process_id;

  IF v_process IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(n.*) ORDER BY n.created_at), '[]'::jsonb)
  INTO v_nodes
  FROM public.process_nodes n
  WHERE n.process_id = v_link.process_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(e.*) ORDER BY e.created_at), '[]'::jsonb)
  INTO v_edges
  FROM public.process_edges e
  WHERE e.process_id = v_link.process_id;

  RETURN jsonb_build_object(
    'share_link',
    jsonb_build_object(
      'slug', v_link.slug,
      'process_id', v_link.process_id,
      'expires_at', v_link.expires_at,
      'is_active', v_link.is_active
    ),
    'process', v_process,
    'nodes', v_nodes,
    'edges', v_edges
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_process_bundle(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_process_bundle(TEXT) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Slug-scoped public org-chart payload with contact-info projection
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_org_share_bundle(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.share_links%ROWTYPE;
  v_profiles JSONB;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_link
  FROM public.share_links
  WHERE slug = p_slug
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

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
    WHERE p.id = v_link.root_profile_id

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
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'email', CASE WHEN v_link.include_contact_info THEN b.email ELSE '' END,
        'full_name', b.full_name,
        'preferred_name', b.preferred_name,
        'job_title', b.job_title,
        'job_description', b.job_description,
        'start_date', b.start_date,
        'profile_photo_url', b.profile_photo_url,
        'phone', CASE WHEN v_link.include_contact_info THEN b.phone ELSE NULL END,
        'location', CASE WHEN v_link.include_contact_info THEN b.location ELSE NULL END,
        'department_id', b.department_id,
        'manager_id', b.manager_id,
        'social_links', CASE WHEN v_link.include_contact_info THEN COALESCE(b.social_links, '{}'::jsonb) ELSE '{}'::jsonb END,
        'is_admin', b.is_admin,
        'is_manager', b.is_manager,
        'is_executive', b.is_executive,
        'is_super_admin', b.is_super_admin,
        'is_process_editor', b.is_process_editor,
        'onboarding_completed', b.onboarding_completed,
        'employment_status', b.employment_status,
        'terminated_at', b.terminated_at,
        'termination_effective_at', b.termination_effective_at,
        'termination_reason', b.termination_reason,
        'terminated_by', b.terminated_by,
        'archived_at', b.archived_at,
        'created_at', b.created_at,
        'updated_at', b.updated_at,
        'department', (
          SELECT jsonb_build_object(
            'id', d.id,
            'name', d.name,
            'color', d.color,
            'description', d.description,
            'created_at', d.created_at
          )
          FROM public.departments d
          WHERE d.id = b.department_id
        )
      )
      ORDER BY b.created_at
    ),
    '[]'::jsonb
  )
  INTO v_profiles
  FROM branch b;

  RETURN jsonb_build_object(
    'share_link',
    jsonb_build_object(
      'slug', v_link.slug,
      'root_profile_id', v_link.root_profile_id,
      'include_contact_info', v_link.include_contact_info,
      'expires_at', v_link.expires_at
    ),
    'profiles', v_profiles
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_org_share_bundle(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_org_share_bundle(TEXT) TO anon, authenticated, service_role;
