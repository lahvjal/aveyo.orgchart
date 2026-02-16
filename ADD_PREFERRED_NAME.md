# Database Migration: Add Preferred Name Field

Since the Supabase CLI isn't linked yet, please run this SQL manually in your Supabase dashboard:

## Step 1: Go to Supabase SQL Editor

1. Open your Supabase project: https://supabase.com/dashboard/project/semzdcsumfnmjnhzhtst
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"

## Step 2: Run This SQL

```sql
-- Add preferred_name field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_name TEXT;
```

## Step 3: Click "Run"

That's it! The `preferred_name` column will be added to your profiles table.

---

## What This Enables

- Users can now set a nickname/preferred name in their profile
- This field is optional
- If set, it can be used to display their preferred name instead of their full name
- The field appears in the profile editor between "Full Name" and "Job Title"

## Test It

1. Go to your profile page
2. You should see a new field: "Nickname / Preferred Name"
3. Enter your preferred name (optional)
4. Save your profile
5. The preferred name is now stored in the database!
