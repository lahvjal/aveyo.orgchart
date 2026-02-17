# Manager Role Setup Guide

## Step 1: Mark Users as Managers

To enable the Manager Panel for a user, you need to set their `is_manager` field to `TRUE` in the database.

### Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to **Table Editor** → **profiles**
3. Find the user you want to make a manager
4. Click on their row to edit
5. Set `is_manager` to `TRUE`
6. Save the changes

### Using SQL Editor

Run this SQL query in the Supabase SQL Editor:

```sql
-- Make a specific user a manager (replace with their email)
UPDATE profiles
SET is_manager = TRUE
WHERE email = 'manager@example.com';

-- Or make a user a manager by their ID
UPDATE profiles
SET is_manager = TRUE
WHERE id = 'user-uuid-here';
```

### Make Multiple Users Managers

```sql
-- Make multiple users managers at once
UPDATE profiles
SET is_manager = TRUE
WHERE email IN ('manager1@example.com', 'manager2@example.com');
```

## Step 2: Verify Manager Status

After marking users as managers:

1. **Log out and log back in** (or refresh the page) - the user's session needs to refresh to pick up the new `is_manager` status
2. Check that the **"Manager Panel"** link appears in the navigation bar
3. Click on **"Manager Panel"** to verify it loads

## Step 3: Test Manager Features

### Test Team Management

1. **View Team Members**: 
   - Go to Manager Panel
   - You should see only employees who report to you (direct and indirect reports)
   - If you have no team members yet, you'll see a message saying "You don't have any team members yet"

2. **Edit Team Member**:
   - Click the edit icon next to a team member
   - Verify you can edit: Job Title, Department, Job Description
   - Verify the Manager field is **locked** and shows your name
   - Save changes

3. **Invite Team Member**:
   - Click "Invite Team Member" button
   - Fill out the form (Email, First Name, Last Name, Job Title, Start Date)
   - Verify the Manager field is **auto-filled** with your name and **disabled**
   - Verify Department is auto-filled from your department (but can be changed)
   - Send invitation
   - The new employee should appear in your team list after they accept

### Test Permissions

1. **Verify Scope**: 
   - Managers should only see their team members
   - Managers should NOT see employees outside their team
   - Managers should NOT see the Admin Panel (unless they're also admins)

2. **Verify Restrictions**:
   - Managers cannot change a team member's manager
   - Managers cannot make team members admins
   - Managers cannot access Departments or Sharing tabs

## Step 4: Test Admin vs Manager

If a user is both an admin AND a manager:

- They should see both "Manager Panel" and "Admin Panel" links
- Admin Panel gives full access to all users
- Manager Panel shows only their team members
- They can use either panel as needed

## Troubleshooting

### Manager Panel Link Not Appearing

1. Verify `is_manager = TRUE` in the database
2. Log out and log back in (session refresh needed)
3. Check browser console for errors
4. Verify the user has at least one direct report (or the panel will be empty but should still appear)

### Can't See Team Members

1. Verify the user has employees with `manager_id` pointing to them
2. Check that the employee's `manager_id` matches the manager's `id`
3. Verify RLS policies are working (check Supabase logs)

### Can't Invite Team Members

1. Verify `VITE_SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
2. Check browser console for errors
3. Verify the manager has permission (check `is_manager = TRUE`)

## Example: Setting Up a Test Manager

```sql
-- 1. Find a user to make a manager
SELECT id, email, full_name FROM profiles WHERE email = 'test@example.com';

-- 2. Make them a manager
UPDATE profiles SET is_manager = TRUE WHERE email = 'test@example.com';

-- 3. Assign some employees to them (if needed)
UPDATE profiles 
SET manager_id = (SELECT id FROM profiles WHERE email = 'test@example.com')
WHERE email IN ('employee1@example.com', 'employee2@example.com');

-- 4. Verify setup
SELECT 
  p1.full_name as manager,
  p2.full_name as employee,
  p2.is_manager
FROM profiles p1
LEFT JOIN profiles p2 ON p2.manager_id = p1.id
WHERE p1.email = 'test@example.com';
```
