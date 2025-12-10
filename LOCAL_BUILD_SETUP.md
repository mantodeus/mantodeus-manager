# Local Build Setup - Mantodeus Manager

## ✅ Setup Complete

The local build environment has been configured with proper environment variable validation.

## 📋 What Was Done

1. **Created `.env` file** with placeholder values:
   - `VITE_SUPABASE_URL` - Set to your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Currently `REPLACE_ME` (must be filled)
   - `SUPABASE_SERVICE_ROLE_KEY` - Currently `REPLACE_ME` (must be filled)
   - Other required variables with sensible defaults

2. **Updated `build-debug.js`** to:
   - ✅ Detect missing `.env` file
   - ✅ Detect placeholder values (`REPLACE_ME`)
   - ✅ Detect empty or whitespace-only values
   - ✅ Provide clear error messages with fix instructions
   - ✅ Verify Supabase variables are embedded in build output
   - ✅ Check both frontend (Vite) and backend (runtime) variables

3. **Improved `load-env.ts`** to:
   - ✅ Load `.env` file during development (fallback from `.env.local`)
   - ✅ Provide better logging when environment variables are loaded
   - ✅ Show which Supabase variables are set

## 🔧 Next Steps

### 1. Fill in Your Supabase Keys

Open `.env` and replace `REPLACE_ME` with your actual keys:

```bash
# Get these from: https://supabase.com/dashboard/project/_/settings/api
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (your actual anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (your actual service role key)
```

### 2. Run the Build

```bash
pnpm run build
```

The build will:
- ✅ Load `.env` file
- ✅ Validate all required variables are set and not placeholders
- ✅ Embed `VITE_*` variables into the frontend build (Vite handles this)
- ✅ Verify variables are embedded in the built JS files
- ✅ Build backend with `load-env.ts` that will load `SUPABASE_SERVICE_ROLE_KEY` at runtime

### 3. Verify the Build

After a successful build, check:

1. **Frontend variables embedded:**
   ```bash
   # Check that Supabase URL is in the built JS
   grep -r "uwdkafekyrqjnstbywqw.supabase.co" dist/public/assets/*.js
   ```

2. **Backend runtime variables:**
   - The backend will load `SUPABASE_SERVICE_ROLE_KEY` from `.env` at runtime via `load-env.ts`
   - This happens when you run `npm start` or `node dist/index.js`

## 🎯 How It Works

### Build Time (Vite)
- Vite reads `VITE_*` variables from `.env` during `pnpm run build`
- These are embedded into the frontend JavaScript bundles
- **Critical:** Variables must be set at build time, not runtime

### Runtime (Backend)
- `load-env.ts` loads `.env` when the server starts
- `SUPABASE_SERVICE_ROLE_KEY` is loaded from `.env` at runtime
- This allows the backend to connect to Supabase

## ✅ Verification Checklist

After filling in your keys and building:

- [ ] Build completes without errors
- [ ] Build script shows: "✅ All required Vite environment variables are set and valid"
- [ ] Build script shows: "✅ Supabase variables confirmed embedded in JS bundle"
- [ ] `dist/public/assets/*.js` contains your Supabase URL
- [ ] `dist/index.js` exists (backend bundle)
- [ ] Running `node dist/index.js` loads `SUPABASE_SERVICE_ROLE_KEY` correctly

## 🚨 Common Issues

### "PLACEHOLDER_VALUE" Error
- **Fix:** Replace `REPLACE_ME` in `.env` with your actual Supabase keys

### "MISSING" Error
- **Fix:** Ensure `.env` file exists in project root
- **Fix:** Check variable names match exactly (case-sensitive)

### "EMPTY_OR_WHITESPACE" Error
- **Fix:** Remove any spaces around the `=` sign in `.env`
- **Fix:** Ensure values are on the same line as the variable name

### Variables Not Embedded in Build
- **Fix:** Ensure variables start with `VITE_` prefix
- **Fix:** Rebuild after updating `.env` (Vite caches)

## 📝 Notes

- `.env` is gitignored (not committed to repository)
- Production server uses its own `.env` file
- Local development uses `.env` (or `.env.local` if it exists)
- Never commit real keys to the repository

