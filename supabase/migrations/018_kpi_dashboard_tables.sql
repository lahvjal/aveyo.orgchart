-- Migration: KPI Dashboard Tables
-- Adds custom_kpis, goals, and section_order tables to the org-chart Supabase project
-- so both orgchart.aveyo.com and kpi.aveyo.com share a single Supabase project.
--
-- Note: the `profiles` table with `is_admin` already exists from earlier migrations.
-- Run this after importing existing KPI data from the old Supabase project.

-- ============================================================
-- HELPER: update_updated_at_column trigger function
-- (may already exist from other tables — safe to re-create)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: custom_kpis
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_kpis (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_id            text        UNIQUE NOT NULL,
  name              text        NOT NULL,
  description       text,
  format            text        NOT NULL CHECK (format IN ('number', 'currency', 'percentage', 'days')),
  formula_type      text        NOT NULL CHECK (formula_type IN ('sql', 'expression')),
  formula           text        NOT NULL,
  field_mappings    jsonb       DEFAULT '{}'::jsonb,
  available_periods text[]      NOT NULL DEFAULT ARRAY['current_week', 'previous_week', 'mtd', 'ytd']::text[],
  section_id        text        NOT NULL,
  is_active         boolean     DEFAULT true,
  is_original       boolean     DEFAULT false,
  is_hidden         boolean     DEFAULT false,
  show_goal         boolean     DEFAULT false,
  display_order     integer     DEFAULT 0,
  secondary_formula text,
  secondary_format  text        CHECK (secondary_format IN ('count', 'breakdown', 'text')),
  created_by        uuid        REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE custom_kpis ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all KPIs (including hidden, for admin panel)
CREATE POLICY "Authenticated can read all KPIs"
  ON custom_kpis FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can insert KPIs"
  ON custom_kpis FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update KPIs"
  ON custom_kpis FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete KPIs"
  ON custom_kpis FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE INDEX IF NOT EXISTS custom_kpis_kpi_id_idx       ON custom_kpis(kpi_id);
CREATE INDEX IF NOT EXISTS custom_kpis_section_id_idx   ON custom_kpis(section_id);
CREATE INDEX IF NOT EXISTS custom_kpis_is_active_idx    ON custom_kpis(is_active);
CREATE INDEX IF NOT EXISTS custom_kpis_display_order_idx ON custom_kpis(section_id, display_order);

CREATE TRIGGER update_custom_kpis_updated_at
  BEFORE UPDATE ON custom_kpis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: goals
-- ============================================================
CREATE TABLE IF NOT EXISTS goals (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kpi_id     text        NOT NULL REFERENCES custom_kpis(kpi_id) ON DELETE CASCADE,
  period     text        NOT NULL,
  value      numeric     NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (kpi_id, period)
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read goals"
  ON goals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert goals"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update goals"
  ON goals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete goals"
  ON goals FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE INDEX IF NOT EXISTS goals_kpi_id_idx ON goals(kpi_id);
CREATE INDEX IF NOT EXISTS goals_period_idx ON goals(period);

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: section_order
-- ============================================================
CREATE TABLE IF NOT EXISTS section_order (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id    text        UNIQUE NOT NULL,
  display_order integer     NOT NULL,
  is_active     boolean     DEFAULT true,
  updated_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE section_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read section order"
  ON section_order FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert section order"
  ON section_order FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update section order"
  ON section_order FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete section order"
  ON section_order FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE INDEX IF NOT EXISTS section_order_display_order_idx ON section_order(display_order);

CREATE TRIGGER update_section_order_updated_at
  BEFORE UPDATE ON section_order
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Default section order (import will overwrite if data exists)
INSERT INTO section_order (section_id, display_order, is_active) VALUES
  ('sales_stats',            1, true),
  ('operations_stats',       2, true),
  ('cycle_times',            3, true),
  ('residential_financials', 4, true),
  ('active_pipeline',        5, true),
  ('finance',                6, true),
  ('commercial',             7, true)
ON CONFLICT (section_id) DO NOTHING;
