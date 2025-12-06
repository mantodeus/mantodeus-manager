# Required Environment Variables for Infomaniak

## 🔴 Why the server never gets past “Starting…”
When `server/_core/supabase.ts` loads it immediately checks for Supabase
credentials. If `VITE_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is
missing you’ll see this log and the process exits **before the port ever
opens**:

```
Supabase configuration is missing. Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
```

On Infomaniak that shows up as “starting error”. Fix the environment
variables and the app boots normally—no extra restarts needed.

---

## ✅ Variables you must configure on Infomaniak

### 1. Supabase Authentication (REQUIRED)
These come directly from your Supabase dashboard (`Project Settings → API`).
Missing any of them crashes the server at boot.

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OWNER_SUPABASE_ID=the_supabase_uuid_of_the_owner_account
```

- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are embedded into the
  frontend bundle when you run `npm run build`.
- `SUPABASE_SERVICE_ROLE_KEY` is used by the backend when verifying
  sessions. If it’s missing you’ll get the fatal error above.
- `OWNER_SUPABASE_ID` is the Supabase user ID (UUID) that should be
  treated as the owner/admin.

### 2. Database & JWT (REQUIRED)
```bash
DATABASE_URL=mysql://username:password@host:3306/database_name
JWT_SECRET=your_random_secret_key_here
```
Generate at least a 32‑char random string for `JWT_SECRET`.

### 3. Runtime Settings (RECOMMENDED)
```bash
NODE_ENV=production
PORT=3000
VITE_APP_TITLE=Mantodeus Manager
VITE_APP_LOGO=/mantodeus-logo.png
```

### 4. File Storage (OPTIONAL, for uploads)
```bash
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=mantodeus-manager-files
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
```

---

## 🚀 How to add variables in Infomaniak
1. Open the Infomaniak manager → Node.js hosting (`manager.mantodeus.com`).
2. Go to **Configuration → Environment variables**.
3. Add every key/value from the lists above (copy/paste works fine).
4. Click **Save**, then redeploy or restart the Node.js app so the new
   values are picked up.

---

## 🔍 Priority order
1. `VITE_SUPABASE_URL`
2. `VITE_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `OWNER_SUPABASE_ID`
5. `DATABASE_URL`
6. `JWT_SECRET`
7. `NODE_ENV`, `PORT`, `VITE_APP_TITLE`, `VITE_APP_LOGO`
8. S3 credentials (only if you need uploads)

The server literally refuses to start until items 1–6 exist.

---

## 📝 Copy/paste template
```
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
OWNER_SUPABASE_ID=YOUR_OWNER_SUPABASE_UUID

# Database & JWT
DATABASE_URL=mysql://username:password@host:3306/database_name
JWT_SECRET=YOUR_RANDOM_SECRET_KEY_HERE

# Runtime
NODE_ENV=production
PORT=3000
VITE_APP_TITLE=Mantodeus Manager
VITE_APP_LOGO=/mantodeus-logo.png

# Optional file storage
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=mantodeus-manager-files
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
```

---

## ⚠️ Common mistakes
- **Missing service role key** → Startup log says “Supabase configuration
  is missing…”. Copy the Service Role secret from Supabase.
- **VITE vars not present during build** → `npm run build` embeds whatever
  is in the environment at build time. Re-run the build after adding
  variables.
- **Bad DATABASE_URL format** → Use the full MySQL URI with username,
  password, host, port, and database name.
- **Forgetting to restart** → Infomaniak only loads new variables after you
  redeploy or restart the Node.js hosting app.

---

## 🔁 After updating environment variables
1. Save the values in the Infomaniak dashboard.
2. Trigger a new build (check “Delete node_modules” + “Delete cache”).
3. Watch the logs—look for the Supabase configuration check and `Server
   running on port 3000`.
4. Refresh https://manager.mantodeus.com once the build says “SUCCESS”.

That’s it—only the Supabase, database, and (optionally) S3 variables are
needed for a successful deploy.
