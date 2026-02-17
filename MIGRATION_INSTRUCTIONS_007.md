# Migration 007: Allow All Users to View Complete Org Chart

## Overview
This migration updates the Row Level Security (RLS) policies to allow all authenticated users to view the complete organization chart, not just their reporting branch.

## Changes Made

### Database (Migration Required)
- **File**: `supabase/migrations/007_allow_all_users_view_profiles.sql`
- **Purpose**: Removes the restrictive "Users can view their branch" policy and replaces it with a policy that allows all authenticated users to view all profiles

### Frontend Changes (Already Applied)
1. **Dashboard.tsx**: 
   - All users now fetch `allProfiles` instead of just admin users
   - Updated UI text from "Viewing your team" to "Browse and search X employees across all departments"
   - Passes user's department ID to components for default filtering

2. **EmployeeSearch.tsx**:
   - Accepts `currentUserDepartmentId` prop
   - Defaults to showing the user's department filter on page load
   - Added "Filter by Department" label for clarity

3. **OrgChartCanvas.tsx**:
   - Accepts `currentUserDepartmentId` prop
   - Automatically focuses the view on the user's department nodes when the page loads
   - Users can still zoom out and navigate to see other departments

## How to Apply the Migration

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/semzdcsumfnmjnhzhtst
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the following SQL:

```sql
-- Allow all authenticated users to view all profiles in the org chart
-- This enables non-admin users to browse and search the complete organization
-- while still maintaining appropriate edit restrictions

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view their branch" ON profiles;

-- Create a new policy that allows all authenticated users to view all profiles
CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  USING (
    -- Any authenticated user can view any profile
    auth.uid() IS NOT NULL
  );

-- Note: Edit permissions remain restricted:
-- - Users can only update their own profile (limited fields)
-- - Admins can update any profile
-- - Only admins can insert new profiles
```

5. Click **Run** to execute the SQL

### Option 2: Using Supabase CLI (Alternative)
If you have the Supabase CLI configured and authenticated:

```bash
# Navigate to project directory
cd /Users/vel/Documents/Aveyo/org-chart-app

# Manually execute the SQL file using psql or another tool
# The file is located at: supabase/migrations/007_allow_all_users_view_profiles.sql
```

## Testing the Changes

After applying the migration:

1. **Test with a non-admin user**: 
   - Log in as a regular employee (not an admin)
   - Navigate to the Org Chart page
   - Verify that you can see all employees across all departments
   - Verify that the search panel shows all employees
   - Verify that department filtering works correctly

2. **Default view behavior**:
   - The org chart should initially focus on your department
   - You can use the department filter badges to switch between departments
   - You can zoom out and navigate to see the entire organization

3. **Permissions verification**:
   - Non-admin users should NOT be able to edit other profiles
   - Non-admin users can only edit their own profile (limited fields)
   - Admin users retain all their existing permissions

## Rollback Instructions

If you need to revert this change:

```sql
-- Drop the new policy
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;

-- Restore the old restrictive policy
CREATE POLICY "Users can view their branch"
  ON profiles FOR SELECT
  USING (
    -- Users can always see their own profile
    auth.uid() = id 
    OR
    -- Admins can see all profiles
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
    OR
    -- Users can see profiles in their branch (reports and managers)
    id IN (
      SELECT get_profile_branch.id 
      FROM get_profile_branch(auth.uid())
    )
  );
```

## Security Notes

- **Read Access**: All authenticated users can view all profiles (SELECT)
- **Write Access**: Still restricted to:
  - Users can only UPDATE their own profile (limited fields: full_name, phone, location, profile_photo_url, social_links, preferred_name)
  - Admins can UPDATE any profile
  - Only admins can INSERT new profiles
  - Only admins can DELETE profiles

This ensures that while everyone can see the org chart, only appropriate users can make changes.
