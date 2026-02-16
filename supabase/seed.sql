-- Seed data for testing org chart application

-- Insert departments
INSERT INTO departments (id, name, color, description) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'Executive', '#6366f1', 'Executive leadership team'),
  ('d1000000-0000-0000-0000-000000000002', 'Engineering', '#0ea5e9', 'Software development and infrastructure'),
  ('d1000000-0000-0000-0000-000000000003', 'Product', '#8b5cf6', 'Product management and design'),
  ('d1000000-0000-0000-0000-000000000004', 'Marketing', '#ec4899', 'Marketing and communications'),
  ('d1000000-0000-0000-0000-000000000005', 'Sales', '#f59e0b', 'Sales and business development'),
  ('d1000000-0000-0000-0000-000000000006', 'HR', '#10b981', 'Human resources and people operations');

-- Note: To create actual test users, you need to sign up through the Supabase auth
-- The profiles will be automatically created via the trigger
-- Below is example data structure for reference

-- Example profile data (will be created automatically when users sign up):
-- CEO (Admin)
-- - CTO (Manager of Engineering)
--   - Engineering Manager 1
--     - Senior Engineer 1
--     - Senior Engineer 2
--   - Engineering Manager 2
--     - Senior Engineer 3
--     - Junior Engineer 1
-- - CPO (Manager of Product)
--   - Product Manager 1
--   - Product Designer 1
-- - CMO (Manager of Marketing)
--   - Marketing Manager 1
-- - VP Sales (Manager of Sales)
--   - Sales Manager 1
-- - CHRO (Manager of HR)
--   - HR Manager 1

-- After creating users through Supabase Auth, you can update their profiles with this pattern:
-- UPDATE profiles SET
--   full_name = 'Jane Doe',
--   job_title = 'CEO',
--   department_id = 'd1000000-0000-0000-0000-000000000001',
--   is_admin = TRUE,
--   manager_id = NULL
-- WHERE email = 'jane@example.com';
