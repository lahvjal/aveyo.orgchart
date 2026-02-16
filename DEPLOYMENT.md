# Deployment Guide

## Quick Start

### 1. Apply Database Migrations

Follow the steps in `SUPABASE_SETUP.md` to:
- Apply the SQL migrations to your Supabase database
- Configure authentication providers
- Set up storage buckets
- Create your first admin user

### 2. Build the Application

```bash
npm run build
```

The production build will be in the `dist` folder.

### 3. Deploy to Vercel

The easiest way to deploy is with Vercel:

#### Option A: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# For production deployment
vercel --prod
```

#### Option B: Via GitHub

1. Push your code to GitHub
2. Go to https://vercel.com
3. Click "New Project"
4. Import your repository
5. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_URL`
6. Click "Deploy"

Vercel will automatically detect Vite and configure the build settings.

## Other Deployment Options

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

### Cloudflare Pages

1. Push to GitHub
2. Go to Cloudflare Pages dashboard
3. Connect your repository
4. Set build command: `npm run build`
5. Set build output directory: `dist`
6. Add environment variables
7. Deploy

### AWS Amplify

1. Go to AWS Amplify Console
2. Connect your repository
3. Build settings will be auto-detected
4. Add environment variables
5. Deploy

### Docker (Self-Hosted)

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:

```nginx
server {
  listen 80;
  location / {
    root /usr/share/nginx/html;
    index index.html index.htm;
    try_files $uri $uri/ /index.html;
  }
}
```

Build and run:

```bash
docker build -t org-chart-app .
docker run -p 3000:80 org-chart-app
```

## Environment Variables

Make sure to set these in your deployment platform:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=https://your-domain.com
```

## Post-Deployment Checklist

### 1. Configure Supabase Auth Redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:

Add your deployment URL to:
- Site URL: `https://your-domain.com`
- Redirect URLs: `https://your-domain.com/**`

### 2. Test Authentication

1. Visit your deployed app
2. Try signing up with a test account
3. Verify email confirmation (if enabled)
4. Test login/logout

### 3. Create Admin User

In Supabase SQL Editor:

```sql
UPDATE profiles
SET is_admin = TRUE
WHERE email = 'your-admin-email@example.com';
```

### 4. Test Core Features

- Create departments
- Add employees
- Build org chart
- Upload profile photos
- Create share links
- Test permissions (admin vs user)

### 5. Set Up Email Notifications (Optional)

Follow `EMAIL_NOTIFICATIONS.md` to:
- Deploy the Edge Function
- Configure email service
- Set up database webhooks

## Performance Optimization

### Enable Gzip Compression

Most hosting providers enable this by default, but verify:

```nginx
# nginx example
gzip on;
gzip_types text/css application/javascript application/json;
```

### CDN Configuration

For profile photos, configure Supabase Storage with a CDN:
1. Go to Storage settings in Supabase
2. Enable CDN
3. Update your app to use CDN URLs

### Caching Headers

Set appropriate cache headers:

```nginx
location /assets/ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}
```

## Monitoring

### Supabase Dashboard

Monitor:
- Database performance
- API requests
- Storage usage
- Auth activity

### Vercel Analytics (if using Vercel)

Enable in your Vercel dashboard:
- Web Analytics
- Speed Insights
- Log Drains

### Error Tracking

Consider adding Sentry:

```bash
npm install @sentry/react
```

```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 1.0,
});
```

## Troubleshooting

### Build Fails

1. Check Node.js version: `node --version` (requires 20.19+ or 22.12+)
2. Clear cache: `rm -rf node_modules dist && npm install`
3. Check environment variables are set

### Authentication Not Working

1. Verify Supabase URL and keys
2. Check redirect URLs in Supabase dashboard
3. Ensure cookies are enabled
4. Check browser console for errors

### Images Not Loading

1. Check storage bucket is public
2. Verify RLS policies allow public read
3. Ensure correct file paths
4. Check CORS configuration

### Slow Performance

1. Enable React Query devtools to check for unnecessary requests
2. Verify database indexes are created
3. Check network tab for large assets
4. Consider implementing pagination

## Scaling Considerations

### Database

For large organizations (500+ employees):
1. Enable Supabase Pro plan for better performance
2. Add database indexes on frequently queried columns
3. Consider implementing pagination in list views
4. Use connection pooling

### React Flow Performance

For very large org charts:
1. Implement virtual rendering
2. Add zoom-level-based node detail reduction
3. Consider splitting into multiple charts per department
4. Use memoization for expensive calculations

### Storage

For many profile photos:
1. Implement image optimization pipeline
2. Use WebP format
3. Add lazy loading
4. Consider external CDN

## Security Best Practices

1. **Never commit `.env.local`** - It's already in `.gitignore`
2. **Rotate keys regularly** - Update Supabase anon key periodically
3. **Review RLS policies** - Ensure users can only access their data
4. **Enable MFA for admins** - Configure in Supabase Auth
5. **Monitor audit logs** - Check for suspicious activity
6. **Keep dependencies updated** - Run `npm audit` regularly

## Backup Strategy

### Database Backups

Supabase provides automatic backups, but for critical data:

1. Enable Point-in-Time Recovery (Pro plan)
2. Export data regularly:
   ```bash
   supabase db dump --file backup.sql
   ```
3. Store backups off-site

### Storage Backups

For profile photos:
1. Set up automated backups of the storage bucket
2. Use Supabase Storage sync tools
3. Consider S3 replication

## Cost Optimization

### Supabase

- **Free tier limits**:
  - 500 MB database
  - 1 GB storage
  - 2 GB bandwidth
  
- **Pro tier** ($25/mo):
  - 8 GB database
  - 100 GB storage
  - 250 GB bandwidth

### Vercel

- **Free tier limits**:
  - 100 GB bandwidth
  - Unlimited deployments
  
- Monitor usage in dashboard to avoid surprise costs

## Support

For issues:
1. Check application logs
2. Review Supabase logs
3. Check GitHub issues (if open source)
4. Contact your team's admin

## License

MIT - See LICENSE file
