-- Allow unauthenticated users to read organization_settings so the company
-- logo can be displayed on public process share pages.
-- organization_settings only stores: logo_url (a public storage URL) + timestamps.
-- Nothing sensitive is exposed.

GRANT SELECT ON organization_settings TO anon;

CREATE POLICY "anon_read_organization_settings"
  ON organization_settings FOR SELECT
  TO anon
  USING (true);
