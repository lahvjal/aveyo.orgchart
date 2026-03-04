-- Minimize public org-share payload to least privilege.
-- Keep only fields required for public chart rendering and contact toggle behavior.

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
      p.job_title,
      p.profile_photo_url,
      p.phone,
      p.location,
      p.social_links,
      p.department_id,
      p.manager_id,
      p.created_at
    FROM public.profiles p
    WHERE p.id = v_link.root_profile_id

    UNION

    SELECT
      p.id,
      p.email,
      p.full_name,
      p.job_title,
      p.profile_photo_url,
      p.phone,
      p.location,
      p.social_links,
      p.department_id,
      p.manager_id,
      p.created_at
    FROM public.profiles p
    INNER JOIN branch b ON p.manager_id = b.id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'email', CASE WHEN v_link.include_contact_info THEN b.email ELSE '' END,
        'full_name', b.full_name,
        'job_title', b.job_title,
        'profile_photo_url', b.profile_photo_url,
        'phone', CASE WHEN v_link.include_contact_info THEN b.phone ELSE NULL END,
        'location', CASE WHEN v_link.include_contact_info THEN b.location ELSE NULL END,
        'social_links', CASE
          WHEN v_link.include_contact_info THEN COALESCE(b.social_links, '{}'::jsonb)
          ELSE '{}'::jsonb
        END,
        'department_id', b.department_id,
        'manager_id', b.manager_id,
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
