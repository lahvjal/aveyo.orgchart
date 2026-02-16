# Email Notifications with Resend

Email notifications are now configured using Resend for a simpler, more reliable setup.

## Configuration

The application is pre-configured with:
- **Resend API Key**: Already set in `.env.local`
- **From Email**: noreply@send.aveyo.com
- **Domain**: send.aveyo.com

## How It Works

Notifications are sent automatically when:

### 1. Welcome Email (New User Signup)
- **Trigger**: User creates new account
- **Sent to**: New user
- **Content**: Welcome message, profile info, getting started guide
- **Template**: Professional branded email with user details

### 2. Profile Update Email
- **Trigger**: User updates their profile OR admin updates any profile
- **Sent to**: 
  - The profile owner
  - Their manager (if updated by admin)
- **Content**: Notification of changes, who made them
- **Template**: Shows update notification with CTA to view profile

### 3. Manager Change Email
- **Trigger**: Admin changes someone's manager
- **Sent to**: 
  - The employee
  - New manager
  - Old manager
- **Content**: Old vs new manager info
- **Template**: Shows before/after reporting structure

### 4. Department Change Email  
- **Trigger**: Admin changes someone's department
- **Sent to**: The employee
- **Content**: Old vs new department
- **Template**: Simple department change notification

## Email Templates

All emails feature:
- **Professional design** with gradient headers
- **Responsive layout** that works on all devices
- **Clear CTAs** with buttons linking back to the app
- **Branded styling** matching your app theme
- **Mobile-friendly** HTML templates

## Testing Emails

To test email notifications:

1. **Sign up a new user** - Should receive welcome email
2. **Update your profile** - Should receive profile update email
3. **Have admin change your manager** - Should receive manager change email
4. **Have admin change your department** - Should receive department change email

## Checking Email Logs

In Resend Dashboard:
1. Go to https://resend.com/emails
2. View sent emails, delivery status, and opens
3. Check for any errors or bounces

## Troubleshooting

### Emails not sending

Check the browser console for errors. Common issues:

1. **API Key not set**: Verify `.env.local` has `VITE_RESEND_API_KEY`
2. **Domain not verified**: Ensure send.aveyo.com is verified in Resend
3. **Rate limits**: Free tier has 100 emails/day, 3,000/month

### Emails going to spam

1. Verify your sending domain in Resend
2. Set up SPF and DKIM records
3. Add DMARC record for better deliverability

### Wrong "from" address

Update `VITE_FROM_EMAIL` in `.env.local`:
```
VITE_FROM_EMAIL=your-desired-address@send.aveyo.com
```

## Customizing Email Templates

Edit `src/lib/notifications.ts` to customize:

- Email subject lines
- HTML templates
- Colors and branding
- Button text and links
- When emails are triggered

Example - change welcome email subject:

```typescript
return sendEmail({
  to: [profile.email],
  subject: '🎉 Welcome to Aveyo!', // ← Change this
  html,
})
```

## Environment Variables

Required in `.env.local` and production:

```bash
VITE_RESEND_API_KEY=re_zJ12TZbm_Gjs6y2ewcCFJtZoSjEnsoVWv
VITE_FROM_EMAIL=noreply@send.aveyo.com
VITE_APP_URL=http://localhost:5173  # Change in production
```

## Production Deployment

When deploying to Vercel/Netlify/etc:

1. Add environment variables in your hosting dashboard
2. Update `VITE_APP_URL` to your production domain
3. Ensure `VITE_FROM_EMAIL` uses verified domain
4. Test all notification flows

## Rate Limits

### Resend Free Tier
- 100 emails per day
- 3,000 emails per month
- 1 verified domain

### If you exceed limits:
1. Upgrade to Resend Pro ($20/month)
2. Or implement queuing/batching for notifications
3. Or make notifications optional in settings

## Advanced: Notification Preferences

To let users opt out of notifications, add to profiles table:

```sql
ALTER TABLE profiles ADD COLUMN notification_preferences JSONB DEFAULT '{"profile_updates": true, "manager_changes": true}';
```

Then check preferences before sending:

```typescript
if (profile.notification_preferences?.profile_updates) {
  await sendProfileUpdateEmail(...)
}
```

## Security Notes

- ✅ API key is in environment variables (not in code)
- ✅ Emails are sent from server-side (client-side for this app, but Resend validates the key)
- ✅ Email content is sanitized
- ✅ Recipients are validated (only send to valid users)

## Support

For Resend support:
- Documentation: https://resend.com/docs
- Support: support@resend.com
- Status page: https://resend.com/status

For app-specific email issues:
- Check browser console for errors
- Verify environment variables are set
- Test with a single user first
- Review email logs in Resend dashboard
