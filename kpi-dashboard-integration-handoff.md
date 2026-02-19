# KPI Dashboard — Integration Handoff

## What's Changing and Why

The KPI dashboard is being unified with the org-chart app under a single
Supabase project and a shared authentication system. The goal is seamless
SSO across orgchart.aveyo.com and kpi.aveyo.com — users log in once on the
org-chart and are automatically authenticated on the KPI dashboard.

**What stays the same:**
- All MySQL connection logic and KPI calculation code
- All React components, pages, and features
- Next.js framework and Vercel deployment
- The KPI dashboard URL (kpi.aveyo.com)

**What changes:**
- Supabase project (switching to the org-chart's project)
- Auth flow (no more self-contained login form — redirects to org-chart)
- Session storage (cookies instead of localStorage for cross-domain sharing)
- One new admin access check on page load

---

## Step 1 — Install New Dependency

```bash
npm install js-cookie
npm install --save-dev @types/js-cookie
```

---

## Step 2 — Update Environment Variables

Replace the contents of `.env.local` with the following. The Supabase
credentials change entirely — the MySQL credentials stay the same.

```env
# Supabase — NOW POINTING TO ORG-CHART PROJECT
NEXT_PUBLIC_SUPABASE_URL=https://semzdcsumfnmjnhzhtst.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<org-chart anon key>
SUPABASE_SERVICE_ROLE_KEY=<org-chart service role key>

# MySQL — UNCHANGED
DB_HOST=aveyo-podio-do-user-18015130-0.i.db.ondigitalocean.com
DB_PORT=25060
DB_USER=velmkg
DB_PASSWORD=<existing password>
DB_NAME=avyomkng
DB_SSL=true

# Org-chart app URL (used for auth redirects)
NEXT_PUBLIC_ORG_CHART_URL=https://orgchart.aveyo.com
```

The org-chart credentials will be provided separately. Do not commit
`.env.local` to git.

---

## Step 3 — Create Cookie Storage Adapter

Create a new file: `src/lib/cookie-storage.ts`

```typescript
import Cookies from 'js-cookie';

const isProduction =
  typeof window !== 'undefined' &&
  window.location.hostname.includes('aveyo.com');

export const supabaseCookieStorage = {
  getItem: (key: string): string | null =>
    Cookies.get(key) ?? null,

  setItem: (key: string, value: string): void => {
    Cookies.set(key, value, {
      domain: isProduction ? '.aveyo.com' : undefined,
      secure: isProduction,
      sameSite: 'lax',
      expires: 365,
    });
  },

  removeItem: (key: string): void => {
    Cookies.remove(key, {
      domain: isProduction ? '.aveyo.com' : undefined,
    });
  },
};
```

---

## Step 4 — Update `src/lib/supabase.ts`

Add the cookie storage adapter to the Supabase client. The storage key
`'sb-aveyo-auth'` must be identical in both apps — this is what makes
them share the same session cookie.

```typescript
import { createClient } from '@supabase/supabase-js';
import { supabaseCookieStorage } from './cookie-storage';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: supabaseCookieStorage,
    storageKey: 'sb-aveyo-auth',   // must match org-chart app exactly
    autoRefreshToken: true,
    persistSession: true,
  },
});

export const getServiceRoleClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Keep existing type exports (GoalRecord, CustomKPIRecord, etc.) unchanged
```

---

## Step 5 — Replace `src/components/auth-provider.tsx`

Remove the self-contained login form entirely. Replace with a redirect to
the org-chart login for unauthenticated users, and an admin check for
authenticated users.

```typescript
'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { Loader2, ShieldX } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });
export const useAuth = () => useContext(AuthContext);

const ORG_CHART_URL = process.env.NEXT_PUBLIC_ORG_CHART_URL
  ?? 'http://localhost:5173';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        // Not authenticated — redirect to org-chart login
        window.location.href = `${ORG_CHART_URL}/login`;
        return;
      }

      setUser(user);

      // Verify executive access against org-chart profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_executive')
        .eq('id', user.id)
        .single();

      setIsAdmin(profile?.is_executive ?? false);
    } catch {
      window.location.href = `${ORG_CHART_URL}/login`;
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg border border-slate-200 p-8 max-w-md w-full text-center">
          <ShieldX className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Access Restricted
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            The KPI Dashboard is only accessible to executives.
          </p>
          <a
            href={ORG_CHART_URL}
            className="text-sm text-blue-600 hover:underline"
          >
            Return to Org Chart
          </a>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## Step 6 — Update `src/components/header.tsx`

Add a navigation link back to the org-chart. Place it alongside the
existing settings/user menu links.

```typescript
// Add this constant near the top of the file
const ORG_CHART_URL = process.env.NEXT_PUBLIC_ORG_CHART_URL
  ?? 'http://localhost:5173';

// Add this link in the header nav, e.g. next to the Settings link:
<a
  href={ORG_CHART_URL}
  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
>
  ← Org Chart
</a>
```

---

## Step 7 — Export Existing Supabase Data

Before the Supabase switch, export the existing data from the current
Supabase project so it can be loaded into the org-chart Supabase project.

Run these queries in the **current KPI Supabase** SQL editor and save
each result as a CSV or JSON:

```sql
-- Export custom KPIs
SELECT * FROM custom_kpis WHERE is_active = true ORDER BY display_order;

-- Export goals
SELECT * FROM goals ORDER BY kpi_id, period;

-- Export section order
SELECT * FROM section_order ORDER BY display_order;
```

Provide the exported data to the org-chart team. They will load it into
the new Supabase project after the migration tables are created.

---

## Step 8 — Verify Existing Users Exist in Org-Chart Supabase

The KPI dashboard users (executives who currently log in) must exist in
the org-chart Supabase project's `auth.users` table with `is_admin = true`
in the `profiles` table.

Coordinate with the org-chart admin to:
1. Confirm existing KPI users are already in the org-chart (check by email)
2. If not, invite them via the org-chart's Admin Panel
3. Ensure `is_admin = true` is set on each executive's profile

---

## Step 9 — Update Vercel Environment Variables

In the KPI dashboard's Vercel project settings, update all environment
variables to match the new `.env.local` values from Step 2. Specifically:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_ORG_CHART_URL` (set to `https://orgchart.aveyo.com`)

The MySQL variables do not change.

---

## Step 10 — Add Custom Domain in Vercel

In the KPI dashboard's Vercel project:
1. Go to Settings → Domains
2. Add `kpi.aveyo.com`
3. Vercel will provide a CNAME value — add it to your DNS registrar
4. Wait for DNS propagation (usually 5–30 minutes)

---

## Step 11 — Supabase Auth URL Configuration

In the **org-chart Supabase project** dashboard (coordinate with org-chart team):
1. Go to Authentication → URL Configuration
2. Add to **Redirect URLs**:
   - `https://kpi.aveyo.com/**`
   - `https://orgchart.aveyo.com/**`
3. Set **Site URL** to `https://orgchart.aveyo.com`

---

## Testing Checklist

Before going live, verify the following:

- [ ] Visiting `kpi.aveyo.com` while logged out redirects to `orgchart.aveyo.com/login`
- [ ] Logging in on `orgchart.aveyo.com` and then navigating to `kpi.aveyo.com` lands directly on the dashboard (no second login)
- [ ] A non-admin user navigating to `kpi.aveyo.com` sees the Access Restricted screen
- [ ] Logging out on `orgchart.aveyo.com` and then visiting `kpi.aveyo.com` redirects to login
- [ ] All KPI data loads correctly (MySQL connection unchanged)
- [ ] Goals, custom KPIs, and section ordering work (now reading from org-chart Supabase)
- [ ] The "← Org Chart" header link navigates correctly
- [ ] In local dev, unauthenticated access redirects to `localhost:5173/login`

---

## Local Development Notes

In local development, the cookie won't span across `localhost` ports
(the org-chart on `:5173` and the KPI dashboard on `:3000` are treated
as different origins). To test the auth flow locally:

1. Run the org-chart locally and log in — this sets a `localhost` cookie
2. The KPI dashboard will NOT pick this up automatically in local dev
3. To test locally, you can temporarily call `supabase.auth.signInWithPassword()`
   directly in the browser console on the KPI dashboard's localhost port, or
   set up a shared test user and log in separately on each app during development

The shared cookie only works in production on `*.aveyo.com` subdomains.
