# Email Notifications - Quick Start

## ✅ Already Configured!

Email notifications are fully set up and ready to use with Resend.

## What's Working

When you use the app, emails are automatically sent for:

### 1. Welcome Email
- **Sent when**: New user signs up
- **Sent to**: New user
- **Contains**: Welcome message, job info, profile link

### 2. Profile Update Email  
- **Sent when**: User or admin updates a profile
- **Sent to**: Profile owner (and manager if admin updated)
- **Contains**: Update notification, who made changes

### 3. Manager Change Email
- **Sent when**: Admin changes someone's manager
- **Sent to**: Employee, new manager, old manager
- **Contains**: Before/after reporting structure

### 4. Department Change Email
- **Sent when**: Admin changes someone's department  
- **Sent to**: Employee
- **Contains**: Old and new department names

## Testing

To see emails in action:

1. **Sign up** - Create a new account, check email
2. **Update profile** - Edit your info, check email
3. **Have admin change manager** - Check email
4. **Have admin change department** - Check email

## Viewing Sent Emails

Go to [Resend Dashboard](https://resend.com/emails) to see:
- All sent emails
- Delivery status
- Open rates
- Any errors

## Configuration

Everything is pre-configured:
- ✅ Resend API key set
- ✅ Sending domain: send.aveyo.com
- ✅ From email: noreply@send.aveyo.com
- ✅ Professional HTML templates
- ✅ Automatic triggers

## Customization

To customize email content, edit `src/lib/notifications.ts`:

```typescript
// Change subject line
subject: 'Welcome to Our Team!' 

// Modify HTML template
html: `<h1>Custom message...</h1>`

// Change when emails are sent
if (shouldSendEmail) {
  await sendWelcomeEmail(profile)
}
```

## Production Deployment

Configure server-side edge secrets (not client env vars):

```bash
supabase secrets set RESEND_API_KEY=...
supabase secrets set FROM_EMAIL=noreply@send.yourdomain.com
supabase secrets set APP_URL=https://your-domain.com
```

## Troubleshooting

### Emails not arriving
1. Check spam folder
2. Verify Resend dashboard shows delivery
3. Check browser console for errors

### Wrong from address
Update edge-function secret and redeploy:
```bash
supabase secrets set FROM_EMAIL=custom@send.aveyo.com
```

### Want to disable notifications
Comment out the notification calls in:
- `src/pages/Signup.tsx` (welcome email)
- `src/hooks/useProfile.ts` (profile updates)

## Rate Limits

Resend free tier:
- 100 emails/day
- 3,000 emails/month

If you need more, upgrade to Pro ($20/month).

## Support

- Resend docs: https://resend.com/docs
- Customization: Edit `src/lib/notifications.ts`
- Questions: Check `RESEND_SETUP.md` for detailed info

That's it! Emails are working and ready to go. 🎉
