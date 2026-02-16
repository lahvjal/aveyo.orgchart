-- Add nickname/preferred_name field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_name TEXT;
