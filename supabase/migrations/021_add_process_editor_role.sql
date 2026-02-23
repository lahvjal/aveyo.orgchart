-- Add process_editor role to profiles.
-- Process Editors can create and edit ANY process (same process scope as Admin)
-- but have no other administrative privileges.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_process_editor BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_process_editor
  ON profiles (is_process_editor);

-- RLS: Process Editors can manage ALL processes (create, update, delete)
CREATE POLICY "Process Editors can manage all processes"
  ON processes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_process_editor = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_process_editor = true
    )
  );

-- RLS: Process Editors can manage all process nodes
CREATE POLICY "Process Editors can manage all process nodes"
  ON process_nodes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_process_editor = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_process_editor = true
    )
  );

-- RLS: Process Editors can manage all process edges
CREATE POLICY "Process Editors can manage all process edges"
  ON process_edges FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_process_editor = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_process_editor = true
    )
  );
