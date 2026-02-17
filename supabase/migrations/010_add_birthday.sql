-- Add birthday column to profiles (optional, for celebrations / team culture)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS birthday DATE;
