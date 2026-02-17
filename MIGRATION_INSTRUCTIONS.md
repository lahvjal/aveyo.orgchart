# Migration Fix Required: RLS Policy Issue

## Problem
The magic link invitation is failing because migration `004_update_get_profile_branch.sql` dropped the RLS policies on the `profiles` table without recreating them, causing 400 errors when new users try to access their profiles.

## Solution
Apply the new migration file: `supabase/migrations/005_fix_profile_rls_policies.sql`

## How to Apply

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/semzdcsumfnmjnhzhtst
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase/migrations/005_fix_profile_rls_policies.sql`
5. Click **Run** to execute

### Option 2: Using Supabase CLI
```bash
# Link to your project (you'll need your database password)
supabase link --project-ref semzdcsumfnmjnhzhtst

# Apply all pending migrations
supabase db push
```

### Option 3: Using psql (if you have direct database access)
```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.semzdcsumfnmjnhzhtst.supabase.co:5432/postgres" \
  -f supabase/migrations/005_fix_profile_rls_policies.sql
```

## Verification
After applying the migration, test by:
1. Sending a new invite email
2. Clicking the magic link
3. Verifying the onboarding wizard appears (not a blank page with errors)

## What This Migration Does
- Drops and recreates the "Users can view their branch" RLS policy on the `profiles` table
- Ensures users can always see their own profile
- Allows admins to see all profiles
- Allows users to see profiles in their management branch (managers and reports)
