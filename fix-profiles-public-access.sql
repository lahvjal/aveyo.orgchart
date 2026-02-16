-- Allow public read access to profiles for share links to work
DROP POLICY IF EXISTS "Public can view profiles via share links" ON profiles;

CREATE POLICY "Public can view profiles via share links"
  ON profiles FOR SELECT
  USING (
    -- Allow if there's a valid share link that includes this profile's branch
    EXISTS (
      SELECT 1 FROM share_links
      WHERE (expires_at IS NULL OR expires_at > NOW())
    )
  );
