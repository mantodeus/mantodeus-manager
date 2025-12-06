# Required Environment Variables for Infomaniak

## 🔴 CRITICAL: Missing Environment Variables

The "Invalid URL" error you're seeing is caused by **missing environment variables** on Infomaniak.

### Error Details
```
TypeError: Invalid URL
```

This happens when `VITE_OAUTH_PORTAL_URL` or `VITE_APP_ID` are not set, causing `new URL()` to fail.

---

## ✅ Required Environment Variables

You MUST set these in your Infomaniak dashboard:

### 0. Supabase Auth (REQUIRED FOR SERVER STARTUP)

These values come from your Supabase project. Without them the backend
throws an error before it even starts, which is exactly what Infomaniak
reports as the "starting error".

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
OWNER_SUPABASE_ID=the_supabase_uuid_of_the_owner_account
```

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required for the web
  app build, so you likely already have them set.
- `SUPABASE_SERVICE_ROLE_KEY` is **server-only** and missing it makes
  `server/_core/supabase.ts` throw, which stops the process on Infomaniak.
- `OWNER_SUPABASE_ID` is used for elevated admin actions (set it to the UUID
  of the owner user inside Supabase; find it under Supabase → Auth → Users).
- You can copy the **Service Role secret** inside Supabase →
  **Project Settings → API**. Treat it like a password.

### 1. OAuth Configuration (REQUIRED)

```bash
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=your_actual_app_id_here
```

**⚠️ IMPORTANT**: Replace `your_actual_app_id_here` with your real Manus App ID

### 2. Backend OAuth Configuration (REQUIRED)

```bash
OAUTH_SERVER_URL=https://api.manus.im
```

### 3. Database Configuration (REQUIRED)

```bash
DATABASE_URL=mysql://username:password@host:port/database_name
```

**Example**:
```bash
DATABASE_URL=mysql://mantodeus:your_password@localhost:3306/mantodeus_manager
```

### 4. JWT Secret (REQUIRED)

```bash
JWT_SECRET=your_random_secret_key_here
```

Generate a random string (at least 32 characters). Example:
```bash
JWT_SECRET=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

### 5. Application Configuration (OPTIONAL)

```bash
VITE_APP_TITLE=Mantodeus Manager
VITE_APP_LOGO=/mantodeus-logo.png
PORT=3000
NODE_ENV=production
```

### 6. Owner Configuration (OPTIONAL)

```bash
OWNER_OPEN_ID=your_owner_open_id
OWNER_NAME=Your Name
```

### 7. S3 Storage (OPTIONAL - for file uploads)

```bash
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=mantodeus-manager-files
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
```

---

## 🚀 How to Set Environment Variables on Infomaniak

### Step 1: Go to Environment Variables

1. Log into Infomaniak dashboard
2. Navigate to your Node.js hosting: `manager.mantodeus.com`
3. Go to **Configuration** or **Environment Variables** section

### Step 2: Add Each Variable

For each variable above, add:
- **Name**: (e.g., `VITE_OAUTH_PORTAL_URL`)
- **Value**: (e.g., `https://portal.manus.im`)

### Step 3: Save and Restart

1. **Save** all environment variables
2. **Restart** the application or trigger a new deployment

---

## 🔍 Priority Order

Set these in order of importance:

### Priority 1 (CRITICAL - App won't work without these):
1. ✅ `VITE_SUPABASE_URL=https://your-project.supabase.co`
2. ✅ `VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`
3. ✅ `SUPABASE_SERVICE_ROLE_KEY=service_role_secret`
4. ✅ `VITE_OAUTH_PORTAL_URL=https://portal.manus.im`
5. ✅ `VITE_APP_ID=your_actual_app_id`
6. ✅ `OAUTH_SERVER_URL=https://api.manus.im`
7. ✅ `DATABASE_URL=mysql://...`
8. ✅ `JWT_SECRET=your_random_secret`

### Priority 2 (RECOMMENDED):
9. ✅ `OWNER_SUPABASE_ID=owner_supabase_uuid`
10. ✅ `NODE_ENV=production`
11. ✅ `PORT=3000`
12. ✅ `VITE_APP_TITLE=Mantodeus Manager`

### Priority 3 (OPTIONAL):
13. ⚪ `OWNER_OPEN_ID=...`
14. ⚪ `OWNER_NAME=...`
15. ⚪ S3 variables (only if you need file uploads)

---

## 🎯 Quick Copy-Paste Template

Copy this and fill in your actual values:

```bash
# CRITICAL - Replace with your actual values
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
OWNER_SUPABASE_ID=YOUR_OWNER_SUPABASE_UUID
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=YOUR_ACTUAL_APP_ID_HERE
OAUTH_SERVER_URL=https://api.manus.im
DATABASE_URL=mysql://username:password@host:port/database_name
JWT_SECRET=YOUR_RANDOM_SECRET_KEY_HERE

# RECOMMENDED
NODE_ENV=production
PORT=3000
VITE_APP_TITLE=Mantodeus Manager
VITE_APP_LOGO=/mantodeus-logo.png

# OPTIONAL
OWNER_OPEN_ID=your_owner_open_id
OWNER_NAME=Your Name

# OPTIONAL - S3 Storage (for file uploads)
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=mantodeus-manager-files
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
```

---

## ⚠️ Common Mistakes

### Mistake 0: Missing Supabase service role key
```
❌ SUPABASE_SERVICE_ROLE_KEY=   (left blank)
✅ SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
*Symptom*: Infomaniak shows "Starting..." then "Error" because the
backend crashes immediately. Check `server/_core/supabase.ts` for the
exact error message.

### Mistake 1: Not Setting VITE_APP_ID
```
❌ VITE_APP_ID=your_app_id
✅ VITE_APP_ID=abc123def456  (your actual App ID)
```

### Mistake 2: Wrong DATABASE_URL Format
```
❌ DATABASE_URL=localhost:3306
✅ DATABASE_URL=mysql://user:pass@localhost:3306/dbname
```

### Mistake 3: Spaces in Values
```
❌ JWT_SECRET= my secret key
✅ JWT_SECRET=mysecretkey
```

### Mistake 4: Missing Protocol in URLs
```
❌ VITE_OAUTH_PORTAL_URL=portal.manus.im
✅ VITE_OAUTH_PORTAL_URL=https://portal.manus.im
```

---

## 🔧 After Setting Environment Variables

1. **Save** all variables in Infomaniak dashboard
2. **Restart** the application:
   - Either click "Restart" button
   - Or trigger a new deployment
3. **Clear browser cache** and reload https://manager.mantodeus.com
4. The "Invalid URL" error should be gone! ✅

---

## 🆘 Still Getting Errors?

### Check Browser Console

1. Open https://manager.mantodeus.com
2. Press F12 to open Developer Tools
3. Go to **Console** tab
4. Look for error messages

You should see one of these:

**If VITE_APP_ID is missing**:
```
Error: OAuth configuration is missing. Please set VITE_APP_ID environment variable.
```

**If VITE_OAUTH_PORTAL_URL is missing**:
```
Error: OAuth configuration is missing. Please set VITE_OAUTH_PORTAL_URL environment variable.
```

**If both are set correctly**:
```
No errors! The app should work.
```

---

## ✨ Summary

The "Invalid URL" error is caused by missing environment variables. 

**Quick Fix**:
1. Set `VITE_OAUTH_PORTAL_URL=https://portal.manus.im`
2. Set `VITE_APP_ID=your_actual_app_id`
3. Set `OAUTH_SERVER_URL=https://api.manus.im`
4. Set `DATABASE_URL=mysql://...`
5. Set `JWT_SECRET=random_secret`
6. Restart the application
7. Reload the website

**The error will be fixed!** 🎉

---

**Need your Manus App ID?** Check your Manus account settings or contact Manus support.
