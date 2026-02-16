#!/bin/bash

echo "🚀 Setting up Edge Functions for Email Invitations"
echo ""

# Check if supabase CLI is logged in
echo "Step 1: Checking Supabase CLI authentication..."
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase CLI"
    echo "Please run: supabase login"
    exit 1
fi
echo "✅ Authenticated"

# Link project
echo ""
echo "Step 2: Linking to Supabase project..."
supabase link --project-ref semzdcsumfnmjnhzhtst
if [ $? -ne 0 ]; then
    echo "❌ Failed to link project"
    exit 1
fi
echo "✅ Project linked"

# Set secrets
echo ""
echo "Step 3: Setting environment secrets..."
supabase secrets set RESEND_API_KEY=re_zJ12TZbm_Gjs6y2ewcCFJtZoSjEnsoVWv
supabase secrets set FROM_EMAIL=noreply@send.aveyo.com
if [ $? -ne 0 ]; then
    echo "❌ Failed to set secrets"
    exit 1
fi
echo "✅ Secrets configured"

# Deploy function
echo ""
echo "Step 4: Deploying Edge Function..."
supabase functions deploy send-invitation-email --no-verify-jwt
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy function"
    exit 1
fi
echo "✅ Function deployed"

echo ""
echo "🎉 Setup complete! You can now invite employees from the admin panel."
echo ""
echo "Function URL: https://semzdcsumfnmjnhzhtst.supabase.co/functions/v1/send-invitation-email"
