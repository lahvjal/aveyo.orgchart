-- Add waypoints column to process_edges for custom edge routing.
-- Stored as a JSONB array of {x, y} objects in flow coordinates.
ALTER TABLE process_edges
  ADD COLUMN IF NOT EXISTS waypoints jsonb DEFAULT NULL;
