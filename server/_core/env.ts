export const ENV = {
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
};
