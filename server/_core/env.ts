// Load .env BEFORE any process.env access
import "dotenv/config";

export const ENV = {
  // Use VITE_ variables (they're in .env and dotenv loads them for backend too)
  supabaseUrl: process.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY ?? "",
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

  // PDF Service
  pdfExpiryDefaultHours: Number(process.env.PDF_EXPIRY_DEFAULT_HOURS) || 168, // Default 7 days
  defaultVatRate: Number(process.env.DEFAULT_VAT_RATE) || 19,
  
  // App configuration
  appTitle: process.env.VITE_APP_TITLE || "Mantodeus Manager",
  appLogo: process.env.VITE_APP_LOGO || "",
  appUrl: process.env.VITE_APP_URL || process.env.OAUTH_SERVER_URL || "http://localhost:3000",
};

// Debug logging for env var presence (safe - doesn't expose secrets)
console.log("[ENV] Server environment variables check:");
console.log(`[ENV]   VITE_SUPABASE_URL: ${ENV.supabaseUrl ? "✓ set" : "✗ MISSING"}`);
console.log(`[ENV]   VITE_SUPABASE_ANON_KEY: ${ENV.supabaseAnonKey ? "✓ set" : "✗ MISSING"}`);
console.log(`[ENV]   SUPABASE_SERVICE_ROLE_KEY: ${ENV.supabaseServiceRoleKey ? "✓ set" : "✗ MISSING"}`);
console.log(`[ENV]   DATABASE_URL: ${ENV.databaseUrl ? "✓ set" : "✗ MISSING"}`);

// Fail fast if critical vars are missing
if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
  console.error("[ENV] ⚠️  FATAL: Critical Supabase env vars are missing!");
  console.error("[ENV]   Add to .env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}