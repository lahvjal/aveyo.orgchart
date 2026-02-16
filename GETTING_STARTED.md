# Getting Started

Welcome to your Org Chart application! This guide will help you get up and running quickly.

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm or yarn
- Supabase account
- Modern web browser

## Installation

1. **Clone and install dependencies**

```bash
cd org-chart-app
npm install
```

2. **Configure Supabase**

Your Supabase project is already configured with these credentials:
- URL: https://semzdcsumfnmjnhzhtst.supabase.co
- The keys are already in `.env.local`

3. **Set up the database**

Follow the detailed instructions in `SUPABASE_SETUP.md`:
- Go to your Supabase SQL Editor
- Run the migration SQL from `supabase/migrations/001_initial_schema.sql`
- This creates all tables, policies, and functions

4. **Create your first admin user**

```bash
npm run dev
```

- Open http://localhost:5173
- Click "Sign up"
- Fill in your details
- After signing up, run this SQL in Supabase to make yourself admin:

```sql
UPDATE profiles
SET is_admin = TRUE
WHERE email = 'your-email@example.com';
```

5. **Start using the app!**

Log out and log back in to see admin features.

## Quick Tour

### For Admin Users

1. **Admin Panel** - Click "Admin Panel" in the header
   - **Users Tab**: Manage employees, assign managers and departments
   - **Departments Tab**: Create and configure departments with colors
   - **Sharing Tab**: Generate public share links

2. **Org Chart** - The main dashboard
   - Drag nodes to reposition (positions auto-save)
   - Click nodes to view employee details
   - Use search to find specific employees
   - Filter by department

3. **Profile** - Manage your own profile
   - Upload profile photo
   - Update job information
   - Add social media links

### For Regular Users

1. **Org Chart** - View your team
   - See your manager and their chain
   - See your direct and indirect reports
   - Cannot see employees outside your branch

2. **Profile** - Edit your own information
   - Cannot change manager or department
   - Upload your photo
   - Update contact details

## Common Tasks

### Adding Employees

As an admin:
1. Have users sign up via the signup page
2. Go to Admin Panel → Users tab
3. Assign their manager and department
4. Their position in org chart updates automatically

### Creating Departments

1. Go to Admin Panel → Departments tab
2. Click "Add Department"
3. Enter name, choose a color, add description
4. Click "Create"

### Organizing the Org Chart

1. Go to Dashboard (main org chart view)
2. Drag employee nodes to desired positions
3. Positions save automatically
4. The layout starts with an automatic hierarchical arrangement

### Sharing the Org Chart

1. Go to Admin Panel → Sharing tab
2. Click "Create Share Link"
3. Select the root employee (whose branch to show)
4. Choose whether to include contact info
5. Optionally set expiration date
6. Copy the generated link
7. Share with anyone - no login required!

### Uploading Profile Photos

1. Go to your Profile page
2. Click the camera icon on your avatar
3. Select an image (max 5MB)
4. Photo uploads and updates automatically

## Tips & Tricks

### Keyboard Shortcuts

In the org chart:
- Click + Drag = Pan around
- Mouse wheel = Zoom in/out
- Double-click node = View employee details

### Search

- Search by name, job title, or email
- Click department badges to filter
- Click "All" to clear filters

### Department Colors

- Choose contrasting colors for easy differentiation
- Colors appear on:
  - Org chart nodes
  - Department badges
  - Mini-map in org chart

### Branch Visibility (Non-Admin Users)

Non-admin users see:
- Their own profile
- Their entire management chain up to CEO
- All their direct and indirect reports

They cannot see:
- Employees in other departments/branches
- Peers at their level
- Other branches of the organization

## Troubleshooting

### Can't see admin features

Make sure you:
1. Set `is_admin = TRUE` in the database
2. Logged out and back in
3. Check browser console for errors

### Org chart not loading

1. Check that the database migration ran successfully
2. Verify at least one employee exists
3. Check browser console for errors
4. Try refreshing the page

### Photos not uploading

1. Check file size (must be < 5MB)
2. Verify the file is an image (jpg, png, gif, webp)
3. Check Supabase storage bucket exists
4. Verify RLS policies allow uploads

### Search not working

1. Refresh the page
2. Check that employees have been created
3. Verify you have permission to see those employees
4. Try a different search term

## Next Steps

1. **Customize departments** - Add your organization's departments
2. **Add employees** - Have team members sign up
3. **Organize chart** - Arrange nodes for best visualization
4. **Set up notifications** - Follow EMAIL_NOTIFICATIONS.md (optional)
5. **Deploy** - Follow DEPLOYMENT.md when ready for production

## Getting Help

- Check the README.md for technical details
- Review SUPABASE_SETUP.md for database issues
- Read EMAIL_NOTIFICATIONS.md for notification setup
- See DEPLOYMENT.md for deployment help

## Feature Requests

Want a new feature? Consider:
- CSV employee import
- Custom profile fields
- Analytics dashboard
- Mobile app
- Performance review integration
- Vacation/PTO tracking
- Skills and certifications

## Feedback

We'd love to hear how you're using the app! Share feedback on:
- User experience
- Performance
- Feature requests
- Bugs and issues

Happy charting! 🎯
