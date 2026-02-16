# Supabase Setup Guide

## Step 1: Apply Database Migrations

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `semzdcsumfnmjnhzhtst`
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the entire contents of `supabase/migrations/001_initial_schema.sql`
6. Click **Run** to execute the migration

This will create:
- All tables (profiles, departments, org_chart_positions, share_links, audit_logs)
- Row Level Security policies
- Database functions for recursive queries
- Triggers for auto-updating timestamps
- Storage bucket for profile photos
- Indexes for performance

## Step 2: Enable Email Auth

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. Configure email templates (optional):
   - Go to **Authentication** → **Email Templates**
   - Customize welcome email, password reset, etc.

## Step 3: Configure Storage

1. Go to **Storage** in the Supabase Dashboard
2. The `profile-photos` bucket should be created automatically by the migration
3. Verify it's set to **Public** access
4. If not created, manually create it:
   - Click **New bucket**
   - Name: `profile-photos`
   - Public: **Yes**

## Step 4: Create Your First Admin User

1. Go to **Authentication** → **Users**
2. Click **Add user**
3. Enter email and temporary password
4. After creating, go to **SQL Editor** and run:

```sql
-- Update the user's profile to be an admin
UPDATE profiles
SET 
  full_name = 'Your Name',
  job_title = 'CEO',
  department_id = 'd1000000-0000-0000-0000-000000000001',
  is_admin = TRUE,
  start_date = CURRENT_DATE
WHERE email = 'your-email@example.com';
```

## Step 5: (Optional) Seed Departments

The migration already includes departments. To verify:

```sql
SELECT * FROM departments;
```

You should see:
- Executive (#6366f1)
- Engineering (#0ea5e9)
- Product (#8b5cf6)
- Marketing (#ec4899)
- Sales (#f59e0b)
- HR (#10b981)

## Verification

Run these queries to verify the setup:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check your admin profile
SELECT * FROM profiles WHERE is_admin = TRUE;
```

## Common Issues

### Issue: RLS blocks all access

**Solution**: Make sure you're logged in with a valid user account. RLS policies require authentication.

### Issue: Can't upload photos

**Solution**: Check that the `profile-photos` bucket exists and is public. Check storage policies in SQL Editor.

### Issue: Branch visibility not working

**Solution**: Make sure the `get_profile_branch` function was created successfully. Run:

```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'get_profile_branch';
```

## Next Steps

After completing this setup:
1. Start the development server: `npm run dev`
2. Sign in with your admin user
3. Create additional test users
4. Build out your org chart!
