-- Unify admin/super-admin semantics across SQL policies.

CREATE OR REPLACE FUNCTION public.is_admin_like(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND (COALESCE(p.is_admin, FALSE) OR COALESCE(p.is_super_admin, FALSE))
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_like(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_like(UUID) TO authenticated, anon, service_role;

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
    FROM public.processes p
    WHERE p.id = p_process_id
      AND (
        p.created_by = p_user_id
        OR EXISTS (
          SELECT 1
          FROM public.profiles pr
          WHERE pr.id = p_user_id
            AND (
              pr.is_admin = TRUE
              OR pr.is_super_admin = TRUE
              OR pr.is_process_editor = TRUE
            )
        )
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Core org-chart / profile policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "Admins can manage departments"
  ON public.departments FOR ALL
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage positions" ON public.org_chart_positions;
CREATE POLICY "Admins can manage positions"
  ON public.org_chart_positions FOR ALL
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage share links" ON public.share_links;
CREATE POLICY "Admins can manage share links"
  ON public.share_links FOR ALL
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin_like(auth.uid()));

-- -----------------------------------------------------------------------------
-- Organization settings + storage policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can update organization settings" ON public.organization_settings;
CREATE POLICY "Admins can update organization settings"
  ON public.organization_settings FOR UPDATE
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert organization settings" ON public.organization_settings;
CREATE POLICY "Admins can insert organization settings"
  ON public.organization_settings FOR INSERT
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can upload any photo" ON storage.objects;
CREATE POLICY "Admins can upload any photo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND public.is_admin_like(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can upload organization logos" ON storage.objects;
CREATE POLICY "Admins can upload organization logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'organization-logos'
    AND public.is_admin_like(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update organization logos" ON storage.objects;
CREATE POLICY "Admins can update organization logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'organization-logos'
    AND public.is_admin_like(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete organization logos" ON storage.objects;
CREATE POLICY "Admins can delete organization logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'organization-logos'
    AND public.is_admin_like(auth.uid())
  );

-- -----------------------------------------------------------------------------
-- Process policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can manage all processes" ON public.processes;
CREATE POLICY "Admins can manage all processes"
  ON public.processes FOR ALL
  TO authenticated
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all process nodes" ON public.process_nodes;
CREATE POLICY "Admins can manage all process nodes"
  ON public.process_nodes FOR ALL
  TO authenticated
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all process edges" ON public.process_edges;
CREATE POLICY "Admins can manage all process edges"
  ON public.process_edges FOR ALL
  TO authenticated
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "owners_manage_process_share_links" ON public.process_share_links;
CREATE POLICY "owners_manage_process_share_links"
  ON public.process_share_links FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin_like(auth.uid())
  )
  WITH CHECK (
    (created_by = auth.uid() OR public.is_admin_like(auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.processes
      WHERE public.processes.id = public.process_share_links.process_id
        AND (
          public.processes.created_by = auth.uid()
          OR public.is_admin_like(auth.uid())
        )
    )
  );

-- -----------------------------------------------------------------------------
-- KPI policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can insert KPIs" ON public.custom_kpis;
CREATE POLICY "Admins can insert KPIs"
  ON public.custom_kpis FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can update KPIs" ON public.custom_kpis;
CREATE POLICY "Admins can update KPIs"
  ON public.custom_kpis FOR UPDATE
  TO authenticated
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete KPIs" ON public.custom_kpis;
CREATE POLICY "Admins can delete KPIs"
  ON public.custom_kpis FOR DELETE
  TO authenticated
  USING (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert goals" ON public.goals;
CREATE POLICY "Admins can insert goals"
  ON public.goals FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can update goals" ON public.goals;
CREATE POLICY "Admins can update goals"
  ON public.goals FOR UPDATE
  TO authenticated
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete goals" ON public.goals;
CREATE POLICY "Admins can delete goals"
  ON public.goals FOR DELETE
  TO authenticated
  USING (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert section order" ON public.section_order;
CREATE POLICY "Admins can insert section order"
  ON public.section_order FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can update section order" ON public.section_order;
CREATE POLICY "Admins can update section order"
  ON public.section_order FOR UPDATE
  TO authenticated
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete section order" ON public.section_order;
CREATE POLICY "Admins can delete section order"
  ON public.section_order FOR DELETE
  TO authenticated
  USING (public.is_admin_like(auth.uid()));
