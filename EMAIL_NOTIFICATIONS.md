# Email Notifications Setup

This guide explains how to set up email notifications for profile updates.

## Overview

The application includes a Supabase Edge Function that sends email notifications when:
- A new employee profile is created
- An employee profile is updated
- A manager assignment changes

## Prerequisites

1. Supabase CLI installed
2. Email service provider account (Resend, SendGrid, or similar)

## Setup Steps

### 1. Choose an Email Service

We recommend **Resend** for its simplicity:
- Sign up at https://resend.com
- Get your API key
- Verify your domain (or use their test domain for development)

Alternatively, you can use:
- SendGrid
- AWS SES
- Postmark
- Any service with an HTTP API

### 2. Deploy the Edge Function

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref semzdcsumfnmjnhzhtst

# Set environment variables
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set APP_URL=https://your-app-url.com

# Deploy the function
supabase functions deploy notify-profile-update
```

### 3. Configure the Email Service

Edit `supabase/functions/notify-profile-update/index.ts` and uncomment the email sending code:

```typescript
// Uncomment this section:
const resendApiKey = Deno.env.get('RESEND_API_KEY')

for (const recipient of emailRecipients) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: 'noreply@yourcompany.com', // Update this
      to: recipient,
      subject: emailSubject,
      html: emailBody,
    }),
  })
}
```

### 4. Create Database Webhook

In Supabase Dashboard:

1. Go to **Database** → **Webhooks**
2. Click **Create a new hook**
3. Configure:
   - **Name**: Profile Update Notifications
   - **Table**: profiles
   - **Events**: UPDATE, INSERT
   - **Type**: HTTP Request
   - **Method**: POST
   - **URL**: `https://your-project-ref.supabase.co/functions/v1/notify-profile-update`
   - **Headers**:
     ```
     Authorization: Bearer YOUR_ANON_KEY
     Content-Type: application/json
     ```

### 5. Test the Notifications

1. Update a profile in the admin panel
2. Check the Edge Function logs:
   ```bash
   supabase functions serve notify-profile-update --env-file .env.local
   ```
3. Verify emails are sent

## Email Templates

You can customize the email templates in the Edge Function:

### Welcome Email
Sent when a new employee is created
- Subject: "Welcome to the team!"
- Includes: Name, job title, manager, profile link

### Profile Update Email
Sent when profile is modified
- Subject: "Your profile has been updated"
- Includes: Changed fields, who made the change

### Manager Change Email
Sent when reporting structure changes
- Subject: "Reporting structure updated"
- Includes: New manager information

## Customization

### Adding More Notification Types

1. Add new type to `NotificationPayload` interface
2. Add case in the switch statement
3. Define email content
4. Update database trigger if needed

### Conditional Notifications

You can add conditions to only send emails for certain changes:

```typescript
// Example: Only notify for significant changes
const significantFields = ['job_title', 'department_id', 'manager_id']
const hasSignificantChange = Object.keys(payload.changes || {}).some(
  field => significantFields.includes(field)
)

if (!hasSignificantChange) {
  return // Don't send notification
}
```

### Notification Preferences

To add user preferences:

1. Add a `notification_preferences` column to profiles table (JSONB)
2. Check preferences before sending:
   ```typescript
   if (!profile.notification_preferences?.profile_updates) {
     return // User opted out
   }
   ```

## Troubleshooting

### Emails not sending

1. Check Edge Function logs:
   ```bash
   supabase functions logs notify-profile-update
   ```

2. Verify webhook is triggered:
   - Go to Database → Webhooks
   - Check webhook logs

3. Test email service API key:
   ```bash
   curl https://api.resend.com/emails \
     -H "Authorization: Bearer YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"from": "onboarding@resend.dev", "to": "test@example.com", "subject": "Test", "html": "<p>Test</p>"}'
   ```

### Rate limiting

Email services have rate limits. For high volume:
1. Use a queue (like Supabase Queue or BullMQ)
2. Batch notifications
3. Add delay between sends

## Cost Considerations

- **Resend**: Free tier includes 3,000 emails/month
- **SendGrid**: Free tier includes 100 emails/day
- **Supabase Edge Functions**: Free tier includes 500K invocations/month

For production, monitor your usage and upgrade plans as needed.

## Security Notes

- Never expose API keys in client code
- Use environment variables for all secrets
- Verify webhook signatures if available
- Rate limit notification triggers
- Sanitize email content to prevent injection

## Alternative: Client-Side Notifications

If you prefer not to use Edge Functions, you can send notifications client-side:

1. Use a service like EmailJS (client-side email sending)
2. Call after successful mutations
3. Less secure but simpler setup

Example:
```typescript
const updateProfile = useUpdateProfile()

const handleSave = async (data) => {
  await updateProfile.mutateAsync(data)
  
  // Send notification via EmailJS
  await emailjs.send(
    'service_id',
    'template_id',
    { to_email: user.email, ... }
  )
}
```
