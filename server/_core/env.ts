// Load .env BEFORE any process.env access
import "dotenv/config";

/**
 * Production-only environment configuration.
 * Mantodeus Manager is a single-environment system by design.
 * All variables are REQUIRED - app fails fast if anything is missing.
 */
export const ENV = {
  // Environment
  nodeEnv: process.env.NODE_ENV || "development",
  isDevelopment: process.env.NODE_ENV !== "production",
  isProduction: process.env.NODE_ENV === "production",

  // Supabase (REQUIRED)
  supabaseUrl: process.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  // Core (REQUIRED)
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerSupabaseId: process.env.OWNER_SUPABASE_ID ?? "",
  port: parseInt(process.env.PORT || "3000", 10),

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

  // Webhook (OPTIONAL - for auto-deployment)
  webhookSecret: process.env.WEBHOOK_SECRET || process.env.GITHUB_WEBHOOK_SECRET || "",
  webhookPort: parseInt(process.env.WEBHOOK_PORT || "9000", 10),
  appPath: process.env.APP_PATH || "/srv/customer/sites/manager.mantodeus.com",

  // Logging (OPTIONAL - for Axiom integration)
  axiomDataset: process.env.AXIOM_DATASET || "",
  axiomToken: process.env.AXIOM_TOKEN || "",
  logLevel: process.env.LOG_LEVEL || "",

  // App configuration
  appTitle: process.env.VITE_APP_TITLE || "Mantodeus Manager",
  appLogo: process.env.VITE_APP_LOGO || "",
  appUrl: process.env.VITE_APP_URL || process.env.OAUTH_SERVER_URL || "https://manager.mantodeus.com",
};

// =============================================================================
// FAIL-FAST: Required environment variables check
// =============================================================================

interface EnvValidation {
  key: string;
  value: string | number;
  required: boolean;
  minLength?: number;
  description?: string;
}

const ENV_VALIDATIONS: EnvValidation[] = [
  // Supabase
  {
    key: "VITE_SUPABASE_URL",
    value: ENV.supabaseUrl,
    required: true,
    description: "Supabase project URL",
  },
  {
    key: "VITE_SUPABASE_ANON_KEY",
    value: ENV.supabaseAnonKey,
    required: true,
    minLength: 32,
    description: "Supabase anonymous/public key",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    value: ENV.supabaseServiceRoleKey,
    required: true,
    minLength: 32,
    description: "Supabase service role key (admin access)",
  },

  // Core
  {
    key: "DATABASE_URL",
    value: ENV.databaseUrl,
    required: true,
    description: "MySQL database connection string",
  },
  {
    key: "JWT_SECRET",
    value: ENV.cookieSecret,
    required: true,
    minLength: 32,
    description: "Secret for JWT token signing (use openssl rand -hex 32)",
  },
  {
    key: "OWNER_SUPABASE_ID",
    value: ENV.ownerSupabaseId,
    required: true,
    description: "Supabase user ID of the application owner",
  },

  // S3 Storage
  {
    key: "S3_ENDPOINT",
    value: ENV.s3Endpoint,
    required: true,
    description: "S3-compatible storage endpoint",
  },
  {
    key: "S3_BUCKET",
    value: ENV.s3Bucket,
    required: true,
    description: "S3 bucket name for file storage",
  },
  {
    key: "S3_ACCESS_KEY_ID",
    value: ENV.s3AccessKeyId,
    required: true,
    description: "S3 access key ID",
  },
  {
    key: "S3_SECRET_ACCESS_KEY",
    value: ENV.s3SecretAccessKey,
    required: true,
    minLength: 16,
    description: "S3 secret access key",
  },
];

// Validate required variables
const errors: string[] = [];

for (const validation of ENV_VALIDATIONS) {
  if (!validation.required) continue;

  const stringValue = String(validation.value);

  // Check if missing
  if (!stringValue || stringValue.trim() === "") {
    errors.push(
      `  ❌ ${validation.key}: MISSING${validation.description ? ` - ${validation.description}` : ""}`
    );
    continue;
  }

  // Check minimum length for secrets
  if (validation.minLength && stringValue.length < validation.minLength) {
    errors.push(
      `  ⚠️  ${validation.key}: TOO SHORT (${stringValue.length} chars, need ${validation.minLength}+)`
    );
  }
}

// Validate secret strength for production
if (ENV.isProduction) {
  // Check JWT_SECRET is not a placeholder
  if (
    ENV.cookieSecret.includes("generate") ||
    ENV.cookieSecret.includes("example") ||
    ENV.cookieSecret.includes("your_") ||
    ENV.cookieSecret === "secret"
  ) {
    errors.push(
      "  ⚠️  JWT_SECRET: Appears to be a placeholder, generate a strong secret with: openssl rand -hex 32"
    );
  }

  // Warn if webhook secret is missing in production
  if (!ENV.webhookSecret && ENV.isProduction) {
    console.warn(
      "\n⚠️  WARNING: WEBHOOK_SECRET not set. Auto-deployment disabled."
    );
    console.warn(
      "   Generate one with: openssl rand -hex 32\n"
    );
  }
}

// Report errors and exit if any validation failed
if (errors.length > 0) {
  console.error("\n" + "=".repeat(70));
  console.error("🚨 ENVIRONMENT CONFIGURATION ERRORS");
  console.error("=".repeat(70));
  console.error("\nThe following environment variables have issues:\n");
  errors.forEach((error) => console.error(error));
  console.error("\n" + "=".repeat(70));
  console.error("📝 Fix these in your .env file and restart the server.");
  console.error("📖 See .env.example for reference.");
  console.error("=".repeat(70) + "\n");
  process.exit(1);
}

// Success message
console.log("✅ [ENV] All required environment variables validated");

// Log optional feature status
if (ENV.axiomDataset && ENV.axiomToken) {
  console.log("📊 [ENV] Axiom log aggregation: ENABLED");
}
if (ENV.webhookSecret) {
  console.log("🔄 [ENV] Webhook auto-deployment: ENABLED");
}
