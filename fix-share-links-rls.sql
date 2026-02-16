-- Re-enable RLS on share_links table for public share links to work
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Recreate the public access policy if it doesn't exist
DROP POLICY IF EXISTS "Anyone can view non-expired share links" ON share_links;

CREATE POLICY "Anyone can view non-expired share links"
  ON share_links FOR SELECT
  USING (expires_at IS NULL OR expires_at > NOW());

-- Ensure admin policy exists
DROP POLICY IF EXISTS "Admins can manage share links" ON share_links;

CREATE POLICY "Admins can manage share links"
  ON share_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
