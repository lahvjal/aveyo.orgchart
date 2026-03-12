-- Allow process nodes to store attached document links (e.g., Google Drive URLs).
ALTER TABLE public.process_nodes
ADD COLUMN IF NOT EXISTS document_links TEXT[] NOT NULL DEFAULT '{}';
