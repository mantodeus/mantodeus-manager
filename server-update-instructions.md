# Server Update Instructions

## Problem
The server's git repository is behind the remote. You just pushed the fix from your local machine, but the server hasn't pulled it yet.

## Solution

Run these commands on your server:

```bash
# 1. Pull the latest code (includes the build-debug.js fix)
git fetch origin
git reset --hard origin/main

# 2. Now run the build (it should only complain about OWNER_SUPABASE_ID)
npm run build

# 3. If build still fails with OWNER_SUPABASE_ID missing, add it to .env:
nano .env
# Add this line:
# OWNER_SUPABASE_ID=your_actual_supabase_user_id

# 4. After fixing .env, rebuild and restart:
npm run build
pm2 restart mantodeus-manager
```

## OR Use the Automated Deploy Script

Instead of manual steps, just run:

```bash
cd /srv/customer/sites/manager.mantodeus.com
bash infra/deploy/deploy.sh
```

This script will:
- Pull latest code
- Install dependencies
- Build the project
- Restart PM2

## Getting your OWNER_SUPABASE_ID

If you don't know your OWNER_SUPABASE_ID, you can find it by:

1. **From Supabase Dashboard:**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Go to Authentication → Users
   - Find your user and copy the ID

2. **From Database:**
   ```sql
   SELECT id FROM auth.users WHERE email = 'your@email.com';
   ```

3. **From Your App (after logging in):**
   - Check browser console: `localStorage` or session data
   - The auth token contains the user ID
