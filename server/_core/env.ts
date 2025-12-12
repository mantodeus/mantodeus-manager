export const ENV = {
  // Use non-VITE_ prefixed variables for backend (VITE_ is for client-side bundling)
  // Fallback to VITE_ for backward compatibility with existing .env files
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerSupabaseId: process.env.OWNER_SUPABASE_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",

  // Environment awareness: "production" for manager.mantodeus.com, "preview" for preview environment
  // This allows different S3 buckets, logging levels, etc. between environments
  appEnv: (process.env.APP_ENV || process.env.RUNTIME_ENV || "production") as "production" | "preview",
  runtimeEnv: (process.env.APP_ENV || process.env.RUNTIME_ENV || "production") as "production" | "preview",

  // Legacy Manus storage proxy (no longer used for uploads, kept for backwards-compat if needed)
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // Infomaniak S3-compatible storage
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
};

// Debug logging for env var presence (safe - doesn't expose secrets)
// This runs at module load time, so it will log when the server starts
const isDev = process.env.NODE_ENV !== "production";
if (isDev) {
  // In development, log detailed env var presence (consistent with client code)
  console.log("[ENV] Server environment variables check:");
  console.log(`[ENV]   VITE_SUPABASE_URL: ${ENV.supabaseUrl ? "✓ set" : "✗ MISSING"}`);
  console.log(`[ENV]   VITE_SUPABASE_ANON_KEY: ${ENV.supabaseAnonKey ? "✓ set" : "✗ MISSING"}`);
  console.log(`[ENV]   SUPABASE_SERVICE_ROLE_KEY: ${ENV.supabaseServiceRoleKey ? "✓ set" : "✗ MISSING"}`);
  console.log(`[ENV]   JWT_SECRET: ${ENV.cookieSecret ? "✓ set" : "✗ MISSING"}`);
  console.log(`[ENV]   DATABASE_URL: ${ENV.databaseUrl ? "✓ set" : "✗ MISSING"}`);
}

// In both dev and production, warn if critical vars are missing
if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
  console.error("[ENV] ⚠️  WARNING: Critical Supabase env vars are missing!");
  console.error("[ENV]   This will cause authentication to fail.");
  console.error(`[ENV]   VITE_SUPABASE_URL: ${ENV.supabaseUrl ? "✓" : "✗ MISSING"}`);
  console.error(`[ENV]   SUPABASE_SERVICE_ROLE_KEY: ${ENV.supabaseServiceRoleKey ? "✓" : "✗ MISSING"}`);
}