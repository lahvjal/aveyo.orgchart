-- Add organization settings table for white-labeling
-- This allows admins to customize branding (logo, etc.)

-- Create organization_settings table
CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  logo_url TEXT,
  updated_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a single row constraint (only one settings record)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_settings_single ON organization_settings((1));

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_organization_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_settings_updated_at();

-- RLS Policies
-- Anyone authenticated can view settings (for displaying logo)
CREATE POLICY "Anyone authenticated can view organization settings"
  ON organization_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can update settings
CREATE POLICY "Admins can update organization settings"
  ON organization_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- Only admins can insert settings
CREATE POLICY "Admins can insert organization settings"
  ON organization_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- Storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for organization logos
-- Admins can upload logos
CREATE POLICY "Admins can upload organization logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'organization-logos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- Admins can update logos
CREATE POLICY "Admins can update organization logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'organization-logos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- Admins can delete logos
CREATE POLICY "Admins can delete organization logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'organization-logos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- Anyone can view logos (public bucket)
CREATE POLICY "Anyone can view organization logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'organization-logos');
