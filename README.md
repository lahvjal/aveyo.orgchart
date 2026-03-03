# Org Chart Application

A modern, interactive organizational chart application built with React, Supabase, and React Flow.

## Features

- **Interactive Org Chart**: Drag-and-drop org chart builder with React Flow
- **Employee Profiles**: Comprehensive profile management with photos, job details, and social links
- **Admin Employee Invitations**: Invite new employees via email with magic link setup
- **Image Compression**: Automatic compression for profile photos > 5MB (targets ~4.5MB)
- **Role-Based Access**: Admin and user roles with different permissions
- **Branch Visibility**: Users see their management chain and direct reports
- **Department Management**: Color-coded departments for visual organization
- **Employee Search**: Real-time search with department and title filters
- **Public Sharing**: Generate shareable links for specific org chart branches
- **Email Notifications**: Automated notifications for profile updates
- **Audit Logging**: Track all changes to profiles and org structure

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Org Chart**: React Flow
- **Backend**: Supabase (Auth + PostgreSQL + Storage)
- **State Management**: React Query + Zustand
- **Routing**: React Router v6

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- Supabase account and project

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy the environment variables:

```bash
cp .env.example .env.local
```

3. Update `.env.local` with client-safe Supabase credentials:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:5173
```

**Important**: Do not place service role or email-provider secrets in `VITE_` variables.
Set privileged values as Supabase Edge Function secrets instead:

```bash
supabase secrets set RESEND_API_KEY=...
supabase secrets set FROM_EMAIL=noreply@send.yourdomain.com
supabase secrets set APP_URL=https://orgchart.aveyo.com
```

### Database Setup

1. Install Supabase CLI:

```bash
npm install -g supabase
```

2. Link to your Supabase project:

```bash
supabase link --project-ref your-project-ref
```

3. Run the migrations:

```bash
supabase db push
```

Or manually run the SQL in `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor.

4. (Optional) Seed test data:

```bash
supabase db reset --db-url your-database-url
```

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Database Schema

- **profiles**: Employee profiles linked to auth users
- **departments**: Organization departments with colors
- **org_chart_positions**: X/Y positions for org chart nodes
- **share_links**: Public share links for org chart branches
- **audit_logs**: Change history for compliance

## User Roles

### Admin Users
- Full access to org chart editing (drag & drop)
- Can edit any employee profile
- Manage departments and colors
- Create public share links
- View audit logs
- Assign managers and departments

### Regular Users
- View their branch of the org chart
- Edit their own profile (except manager/department)
- Search employees within their branch
- Cannot access admin features

## Project Structure

```
src/
├── components/       # React components
│   ├── ui/          # shadcn/ui components
│   ├── org-chart/   # Org chart components
│   ├── profile/     # Profile components
│   ├── admin/       # Admin panel components
│   ├── search/      # Search components
│   └── layout/      # Layout components
├── pages/           # Page components
├── hooks/           # Custom React hooks
├── lib/             # Utilities and Supabase client
└── types/           # TypeScript type definitions
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy!

Vercel will automatically detect Vite and configure the build settings.

### Other Platforms

The app builds to static files and can be deployed anywhere:

```bash
npm run build
```

Deploy the `dist` folder to your hosting provider.

## Environment Variables

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `VITE_APP_URL`: Your application URL (for email links)
- `RESEND_API_KEY` (Edge secret): Resend API key, never client-side
- `FROM_EMAIL` (Edge secret): Verified sender address

## License

MIT
