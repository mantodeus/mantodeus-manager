import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail-fast: Required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push("VITE_SUPABASE_URL");
  if (!supabaseAnonKey) missingVars.push("VITE_SUPABASE_ANON_KEY");

  const errorMessage =
    `Missing Supabase environment variables: ${missingVars.join(", ")}. ` +
    `Ensure these are set in your .env file before building.`;

  console.error("[Supabase] Configuration error:", errorMessage);
  throw new Error(errorMessage);
}

// Validate API key format
if (!supabaseAnonKey.startsWith("eyJ") && !supabaseAnonKey.startsWith("pk_")) {
  console.warn(
    "[Supabase] Warning: API key format may be incorrect. Expected JWT token starting with 'eyJ' or 'pk_'"
  );
}

// Create a singleton instance
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "mantodeus-supabase-auth",
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });
  }
  return supabaseInstance;
})();
