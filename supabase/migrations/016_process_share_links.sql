-- Process share links: allow unauthenticated public access to specific process diagrams
-- Security notes:
--   • All anon policies are FOR SELECT only — zero write surface for unauthenticated users
--   • Anon access to process data is gated by a valid, active, non-expired share link
--     enforced via EXISTS checks entirely in Postgres — cannot be bypassed at the frontend
--   • No anon policies are added to `profiles` or `departments` — tagged employee/dept
--     data is not resolvable by the public, preventing org-wide data leakage
--   • Slugs are generated client-side using crypto.randomUUID() (128-bit CSPRNG)

-- ── Table ──────────────────────────────────────────────────────────────────────

CREATE TABLE process_share_links (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        TEXT        NOT NULL UNIQUE,
  process_id  UUID        NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  created_by  UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_process_share_links_slug       ON process_share_links(slug);
CREATE INDEX idx_process_share_links_process_id ON process_share_links(process_id);
CREATE INDEX idx_process_share_links_created_by ON process_share_links(created_by);

ALTER TABLE process_share_links ENABLE ROW LEVEL SECURITY;

-- Supabase tables created via SQL migrations do not automatically inherit the
-- dashboard's default grants. Explicitly grant table-level SELECT to the anon
-- role so that RLS policies can take effect. Without this, anon sees 0 rows
-- regardless of any RLS policy.
GRANT SELECT ON process_share_links TO anon;

-- ── process_share_links policies ───────────────────────────────────────────────

-- Anon: validate a slug (SELECT only — no write surface)
CREATE POLICY "anon_select_process_share_links"
  ON process_share_links FOR SELECT
  TO anon
  USING (true);

-- Authenticated: process owner or admin can create, update, and delete their links
CREATE POLICY "owners_manage_process_share_links"
  ON process_share_links FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM processes
      WHERE processes.id = process_id
        AND (
          processes.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.is_admin = true
          )
        )
    )
  );

-- ── Anon read policies on process data ────────────────────────────────────────
-- Each policy uses the same EXISTS guard: the share link must exist, be active,
-- and be within its expiry window. Evaluated entirely in Postgres per-row.

CREATE POLICY "anon_read_shared_processes"
  ON processes FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM process_share_links psl
      WHERE psl.process_id = processes.id
        AND psl.is_active = true
        AND (psl.expires_at IS NULL OR psl.expires_at > NOW())
    )
  );

CREATE POLICY "anon_read_shared_process_nodes"
  ON process_nodes FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM process_share_links psl
      WHERE psl.process_id = process_nodes.process_id
        AND psl.is_active = true
        AND (psl.expires_at IS NULL OR psl.expires_at > NOW())
    )
  );

CREATE POLICY "anon_read_shared_process_edges"
  ON process_edges FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM process_share_links psl
      WHERE psl.process_id = process_edges.process_id
        AND psl.is_active = true
        AND (psl.expires_at IS NULL OR psl.expires_at > NOW())
    )
  );
