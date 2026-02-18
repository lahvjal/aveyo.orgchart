-- Add tagged employee IDs directly to process_nodes as a UUID array.
-- This avoids a separate junction table; profiles are resolved at query time
-- from the existing profiles table.
ALTER TABLE process_nodes
  ADD COLUMN IF NOT EXISTS tagged_profile_ids UUID[] NOT NULL DEFAULT '{}';
