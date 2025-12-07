const DEV_MODE = process.env.DEV_MODE === "ui" ? "ui" : "full";

export const ENV = {
  supabaseUrl: process.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerSupabaseId: process.env.OWNER_SUPABASE_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",

  // Legacy Manus storage proxy (no longer used for uploads, kept for backwards-compat if needed)
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // Infomaniak S3-compatible storage
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  devMode: DEV_MODE,
  isUiDevMode: DEV_MODE === "ui",
};
