import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push("VITE_SUPABASE_URL");
  if (!supabaseAnonKey) missingVars.push("VITE_SUPABASE_ANON_KEY");
  
  const errorMessage = `Missing Supabase environment variables: ${missingVars.join(", ")}. ` +
    `Please ensure these are set in your environment configuration. ` +
    `Current values: VITE_SUPABASE_URL=${supabaseUrl ? "set" : "missing"}, ` +
    `VITE_SUPABASE_ANON_KEY=${supabaseAnonKey ? "set" : "missing"}`;
  
  console.error("[Supabase] Configuration error:", errorMessage);
  throw new Error(errorMessage);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
