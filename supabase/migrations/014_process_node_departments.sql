-- Add tagged department IDs to process_nodes as a UUID array,
-- matching the same pattern as tagged_profile_ids.
ALTER TABLE process_nodes
  ADD COLUMN IF NOT EXISTS tagged_department_ids UUID[] NOT NULL DEFAULT '{}';
