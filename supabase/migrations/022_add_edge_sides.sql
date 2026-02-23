-- Allow edges to store a manually-chosen connection side for each endpoint.
-- NULL means "auto-detect from relative node positions" (existing behaviour).
-- Allowed values: 'top' | 'right' | 'bottom' | 'left'
ALTER TABLE process_edges
  ADD COLUMN IF NOT EXISTS source_side TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_side TEXT DEFAULT NULL;
