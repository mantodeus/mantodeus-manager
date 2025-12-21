// Load .env BEFORE any process.env access
import "dotenv/config";

/**
 * Production-only environment configuration.
 * Mantodeus Manager is a single-environment system by design.
 * All variables are REQUIRED - app fails fast if anything is missing.
 */
export const ENV = {
  // Supabase (REQUIRED)
  supabaseUrl: process.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  // Core (REQUIRED)
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerSupabaseId: process.env.OWNER_SUPABASE_ID ?? "",

  // S3 Storage (REQUIRED for file uploads)
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",

  // PDF Service
  pdfServiceUrl: process.env.PDF_SERVICE_URL || "https://pdf-service-withered-star-4195.fly.dev/render",
  pdfServiceSecret: process.env.PDF_SERVICE_SECRET || "",
  pdfExpiryDefaultHours: Number(process.env.PDF_EXPIRY_DEFAULT_HOURS) || 168,
  defaultVatRate: Number(process.env.DEFAULT_VAT_RATE) || 19,

  // App configuration
  appTitle: process.env.VITE_APP_TITLE || "Mantodeus Manager",
  appLogo: process.env.VITE_APP_LOGO || "",
  appUrl: process.env.VITE_APP_URL || process.env.OAUTH_SERVER_URL || "https://manager.mantodeus.com",
};

// =============================================================================
// FAIL-FAST: Required environment variables check
// =============================================================================
const REQUIRED_VARS = [
  { key: "VITE_SUPABASE_URL", value: ENV.supabaseUrl },
  { key: "VITE_SUPABASE_ANON_KEY", value: ENV.supabaseAnonKey },
  { key: "SUPABASE_SERVICE_ROLE_KEY", value: ENV.supabaseServiceRoleKey },
  { key: "DATABASE_URL", value: ENV.databaseUrl },
  { key: "JWT_SECRET", value: ENV.cookieSecret },
  { key: "S3_ENDPOINT", value: ENV.s3Endpoint },
  { key: "S3_BUCKET", value: ENV.s3Bucket },
  { key: "S3_ACCESS_KEY_ID", value: ENV.s3AccessKeyId },
  { key: "S3_SECRET_ACCESS_KEY", value: ENV.s3SecretAccessKey },
];

const missingVars = REQUIRED_VARS.filter((v) => !v.value).map((v) => v.key);

if (missingVars.length > 0) {
  console.error("=".repeat(60));
  console.error("FATAL: Missing required environment variables:");
  missingVars.forEach((v) => console.error(`  - ${v}`));
  console.error("=".repeat(60));
  console.error("Add these to your .env file and restart the server.");
  process.exit(1);
}

console.log("[ENV] All required environment variables loaded ✓");
