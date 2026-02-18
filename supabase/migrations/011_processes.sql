-- Create process node type enum
CREATE TYPE process_node_type AS ENUM (
  'start',
  'end',
  'task',
  'decision',
  'document',
  'approval',
  'notification'
);

-- Create processes table
CREATE TABLE processes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create process_nodes table
CREATE TABLE process_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  node_type process_node_type NOT NULL DEFAULT 'task',
  label TEXT NOT NULL DEFAULT 'New Step',
  description TEXT,
  x_position FLOAT NOT NULL DEFAULT 0,
  y_position FLOAT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create process_edges table
CREATE TABLE process_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_processes_created_by ON processes(created_by);
CREATE INDEX idx_process_nodes_process_id ON process_nodes(process_id);
CREATE INDEX idx_process_edges_process_id ON process_edges(process_id);
CREATE INDEX idx_process_edges_source ON process_edges(source_node_id);
CREATE INDEX idx_process_edges_target ON process_edges(target_node_id);

-- Auto-update updated_at on processes
CREATE TRIGGER update_processes_updated_at
  BEFORE UPDATE ON processes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_edges ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated users can view processes
CREATE POLICY "Authenticated users can view processes"
  ON processes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view process nodes"
  ON process_nodes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view process edges"
  ON process_edges FOR SELECT
  TO authenticated
  USING (true);

-- RLS: Admins can insert/update/delete any process
CREATE POLICY "Admins can manage all processes"
  ON processes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- RLS: Managers can manage their own processes
CREATE POLICY "Managers can manage own processes"
  ON processes FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_manager = true
    )
  )
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_manager = true
    )
  );

-- RLS: Admins can manage all process nodes
CREATE POLICY "Admins can manage all process nodes"
  ON process_nodes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- RLS: Managers can manage nodes in their own processes
CREATE POLICY "Managers can manage nodes in own processes"
  ON process_nodes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processes
      WHERE processes.id = process_nodes.process_id
        AND processes.created_by = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_manager = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM processes
      WHERE processes.id = process_nodes.process_id
        AND processes.created_by = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_manager = true
    )
  );

-- RLS: Admins can manage all process edges
CREATE POLICY "Admins can manage all process edges"
  ON process_edges FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- RLS: Managers can manage edges in their own processes
CREATE POLICY "Managers can manage edges in own processes"
  ON process_edges FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processes
      WHERE processes.id = process_edges.process_id
        AND processes.created_by = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_manager = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM processes
      WHERE processes.id = process_edges.process_id
        AND processes.created_by = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_manager = true
    )
  );
