import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug logging (safe - doesn't expose secrets)
const isDev = import.meta.env.DEV || import.meta.env.MODE === "development";
if (isDev) {
  console.log("[Supabase] Client initialization - env check:", {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 30) + "..." : "missing",
    keyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + "..." : "missing",
  });
}

// Enhanced error checking with diagnostics
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push("VITE_SUPABASE_URL");
  if (!supabaseAnonKey) missingVars.push("VITE_SUPABASE_ANON_KEY");
  
  const errorMessage = `Missing Supabase environment variables: ${missingVars.join(", ")}. ` +
    `Please ensure these are set in your environment configuration. ` +
    `Current values: VITE_SUPABASE_URL=${supabaseUrl ? "set" : "missing"}, ` +
    `VITE_SUPABASE_ANON_KEY=${supabaseAnonKey ? "set" : "missing"}`;
  
  console.error("[Supabase] Configuration error:", errorMessage);
  console.error("[Supabase] This usually means the build process did not embed the env vars.");
  console.error("[Supabase] Check that:");
  console.error("[Supabase]   1. .env file exists in project root");
  console.error("[Supabase]   2. Variables start with VITE_ prefix");
  console.error("[Supabase]   3. Build script loads .env before running Vite");
  throw new Error(errorMessage);
}

// Validate API key format - anon keys can start with "pk_" or "eyJ" depending on Supabase version
if (supabaseAnonKey && !supabaseAnonKey.startsWith("eyJ") && !supabaseAnonKey.startsWith("pk_")) {
  console.warn("[Supabase] Warning: API key format may be incorrect. Expected JWT token starting with 'eyJ' or 'pk_'");
}

// Log configuration (without exposing full key)
if (isDev) {
  console.log("[Supabase] Initializing client:", {
    url: supabaseUrl,
    keyPrefix: supabaseAnonKey?.substring(0, 20) + "...",
    keyLength: supabaseAnonKey?.length
  });
}

// Create a singleton instance to prevent multiple instances warning
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "mantodeus-supabase-auth", // Use a unique storage key
      },
    });
  }
  return supabaseInstance;
})();
