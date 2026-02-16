#!/bin/bash

echo "🚀 Deploying Supabase Edge Function for Email Invitations"
echo "=========================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Not in project root directory${NC}"
    echo "Please run this from /Users/vel/Documents/Aveyo/org-chart-app"
    exit 1
fi

# Step 1: Check login status
echo -e "${YELLOW}Step 1: Checking Supabase CLI login...${NC}"
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Supabase CLI${NC}"
    echo ""
    echo "Please login first by running:"
    echo "  supabase login"
    echo ""
    echo "This will open your browser for authentication."
    echo "After logging in, run this script again."
    exit 1
fi
echo -e "${GREEN}✅ Already logged in${NC}"
echo ""

# Step 2: Link project
echo -e "${YELLOW}Step 2: Linking to Supabase project...${NC}"
if ! supabase link --project-ref semzdcsumfnmjnhzhtst 2>&1 | grep -q "already linked"; then
    if ! supabase link --project-ref semzdcsumfnmjnhzhtst; then
        echo -e "${RED}❌ Failed to link project${NC}"
        echo ""
        echo "You may need to enter your database password."
        echo "Get it from: Supabase Dashboard → Settings → Database"
        exit 1
    fi
fi
echo -e "${GREEN}✅ Project linked${NC}"
echo ""

# Step 3: Set secrets
echo -e "${YELLOW}Step 3: Setting environment secrets...${NC}"
echo "Setting RESEND_API_KEY..."
if ! supabase secrets set RESEND_API_KEY=re_zJ12TZbm_Gjs6y2ewcCFJtZoSjEnsoVWv; then
    echo -e "${RED}❌ Failed to set RESEND_API_KEY${NC}"
    exit 1
fi

echo "Setting FROM_EMAIL..."
if ! supabase secrets set FROM_EMAIL=noreply@send.aveyo.com; then
    echo -e "${RED}❌ Failed to set FROM_EMAIL${NC}"
    exit 1
fi

echo "Setting SUPABASE_URL..."
if ! supabase secrets set SUPABASE_URL=https://semzdcsumfnmjnhzhtst.supabase.co; then
    echo -e "${RED}❌ Failed to set SUPABASE_URL${NC}"
    exit 1
fi

echo "Setting SUPABASE_ANON_KEY..."
if ! supabase secrets set SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbXpkY3N1bWZubWpuaHpodHN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjEwNzcsImV4cCI6MjA4NjgzNzA3N30.9VHLVSe7CtVPAcJNxUDxVVuvaciYTVWasauutrJeugA; then
    echo -e "${RED}❌ Failed to set SUPABASE_ANON_KEY${NC}"
    exit 1
fi

echo "Setting SUPABASE_SERVICE_ROLE_KEY..."
if ! supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbXpkY3N1bWZubWpuaHpodHN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI2MTA3NywiZXhwIjoyMDg2ODM3MDc3fQ.TroLuYJ-6ovI7x3IckDlN3OVRnQhxdHH1sydf218UGQ; then
    echo -e "${RED}❌ Failed to set SUPABASE_SERVICE_ROLE_KEY${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All secrets configured${NC}"
echo ""

# Step 4: Deploy function
echo -e "${YELLOW}Step 4: Deploying Edge Function...${NC}"
if ! supabase functions deploy send-invitation-email --no-verify-jwt; then
    echo -e "${RED}❌ Failed to deploy function${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Function deployed successfully!${NC}"
echo ""

# Step 5: Verify deployment
echo -e "${YELLOW}Step 5: Verifying deployment...${NC}"
echo ""
supabase functions list
echo ""

echo -e "${GREEN}=========================================================="
echo "🎉 Setup Complete!"
echo "==========================================================${NC}"
echo ""
echo "Function URL:"
echo "  https://semzdcsumfnmjnhzhtst.supabase.co/functions/v1/send-invitation-email"
echo ""
echo "Next steps:"
echo "  1. Try inviting or resending an invitation"
echo "  2. Check your email for the invitation"
echo "  3. View function logs: supabase functions logs send-invitation-email"
echo ""
echo "If you encounter issues, check the logs for detailed error messages."
echo ""
