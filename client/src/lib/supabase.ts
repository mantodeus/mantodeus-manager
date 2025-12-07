import { createClient, type AuthChangeEvent, type Session } from "@supabase/supabase-js";

const devMode = import.meta.env.VITE_DEV_MODE;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

const createMockSupabase = () => {
  const listeners = new Set<AuthListener>();
  const createSession = (): Session => ({
    access_token: "ui-dev-token",
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: "ui-dev-refresh",
    user: {
      id: "ui-dev-user",
      email: "ui.dev@example.com",
      app_metadata: {},
      user_metadata: { name: "UI Dev" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      identities: [],
      phone: "",
      role: "authenticated",
      updated_at: new Date().toISOString(),
    },
  });

  let currentSession: Session | null = createSession();

  const notify = (event: AuthChangeEvent, session: Session | null) => {
    listeners.forEach((listener) => listener(event, session));
  };

  const mockAuth = {
    async signOut() {
      currentSession = null;
      notify("SIGNED_OUT", null);
      return { error: null };
    },
    async signInWithPassword() {
      if (!currentSession) {
        currentSession = createSession();
      }
      notify("SIGNED_IN", currentSession);
      return {
        data: { session: currentSession, user: currentSession?.user ?? null },
        error: null,
      };
    },
    async signUp() {
      return this.signInWithPassword();
    },
    onAuthStateChange(callback: AuthListener) {
      listeners.add(callback);
      callback(currentSession ? "SIGNED_IN" : "SIGNED_OUT", currentSession);
      return {
        data: {
          subscription: {
            unsubscribe() {
              listeners.delete(callback);
            },
          },
        },
        error: null,
      };
    },
  };

  return {
    auth: mockAuth,
  } as unknown as ReturnType<typeof createClient>;
};

const createRealSupabase = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    const missingVars = [];
    if (!supabaseUrl) missingVars.push("VITE_SUPABASE_URL");
    if (!supabaseAnonKey) missingVars.push("VITE_SUPABASE_ANON_KEY");

    const errorMessage =
      `Missing Supabase environment variables: ${missingVars.join(", ")}. ` +
      `Please ensure these are set in your environment configuration. ` +
      `Current values: VITE_SUPABASE_URL=${supabaseUrl ? "set" : "missing"}, ` +
      `VITE_SUPABASE_ANON_KEY=${supabaseAnonKey ? "set" : "missing"}`;

    console.error("[Supabase] Configuration error:", errorMessage);
    throw new Error(errorMessage);
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
};

export const supabase =
  devMode === "ui" ? createMockSupabase() : createRealSupabase();

export default supabase;
