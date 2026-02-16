-- Add onboarding_completed field to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Set existing users as onboarded (they're already using the system)
UPDATE profiles 
SET onboarding_completed = TRUE 
WHERE onboarding_completed IS NULL OR onboarding_completed = FALSE;
