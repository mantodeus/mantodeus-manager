import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { UI_DEV_USER } from "../dev/mockData";

const isUiDevMode = ENV.isUiDevMode;

type SupabaseServerClient = ReturnType<typeof createClient>;

function createRealSupabaseAdmin(): SupabaseServerClient {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
    console.error("[Supabase] Missing configuration:");
    console.error("  VITE_SUPABASE_URL:", ENV.supabaseUrl ? "✓" : "✗");
    console.error(
      "  SUPABASE_SERVICE_ROLE_KEY:",
      ENV.supabaseServiceRoleKey ? "✓" : "✗"
    );
    throw new Error(
      "Supabase configuration is missing. Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createMockSupabaseAdmin(): SupabaseServerClient {
  return {
    auth: {
      async getUser() {
        return {
          data: {
            user: {
              id: UI_DEV_USER.supabaseId,
              email: UI_DEV_USER.email,
              user_metadata: {
                name: UI_DEV_USER.name,
                full_name: UI_DEV_USER.name,
              },
            },
          },
          error: null,
        };
      },
    },
  } as unknown as SupabaseServerClient;
}

export const supabaseAdmin = isUiDevMode
  ? createMockSupabaseAdmin()
  : createRealSupabaseAdmin();

export function createSupabaseClient(accessToken?: string) {
  if (isUiDevMode) {
    return {
      auth: {
        async signOut() {
          return { error: null };
        },
        async signInWithPassword() {
          return { data: { session: null }, error: null };
        },
        async signUp() {
          return { data: { user: null }, error: null };
        },
      },
    } as unknown as SupabaseServerClient;
  }

  return createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    },
  });
}

export type SessionPayload = {
  userId: string; // Supabase user ID (UUID)
  email?: string;
  name?: string;
};

class SupabaseAuthService {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  /**
   * Get the access token from the request cookies
   */
  private getAccessToken(req: Request): string | null {
    const cookies = this.parseCookies(req.headers.cookie);
    return cookies.get(COOKIE_NAME) || null;
  }

  /**
   * Verify the Supabase session and get user info
   */
  async verifySession(accessToken: string | null): Promise<SessionPayload | null> {
    if (isUiDevMode) {
      return {
        userId: UI_DEV_USER.supabaseId,
        email: UI_DEV_USER.email ?? undefined,
        name: UI_DEV_USER.name ?? undefined,
      };
    }

    if (!accessToken) {
      return null;
    }

    try {
      // Verify the token with Supabase
      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(accessToken);

      if (error || !user) {
        console.warn("[Auth] Supabase session verification failed:", error?.message);
        return null;
      }

      return {
        userId: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.user_metadata?.full_name || undefined,
      };
    } catch (error) {
      console.warn("[Auth] Session verification error:", error);
      return null;
    }
  }

  /**
   * Authenticate a request and return the user
   */
  async authenticateRequest(req: Request): Promise<User> {
    if (isUiDevMode) {
      return UI_DEV_USER;
    }

    const accessToken = this.getAccessToken(req);
    const session = await this.verifySession(accessToken);

    if (!session) {
      throw ForbiddenError("Invalid or missing session");
    }

    const signedInAt = new Date();
    
    // Get or create user in our database
    let user = await db.getUserBySupabaseId(session.userId);

    // If user doesn't exist in our DB, create them
    if (!user) {
      await db.upsertUser({
        supabaseId: session.userId,
        name: session.name || null,
        email: session.email || null,
        lastSignedIn: signedInAt,
      });
      user = await db.getUserBySupabaseId(session.userId);
    } else {
      // Update last signed in time
      await db.upsertUser({
        supabaseId: session.userId,
        name: session.name || user.name,
        email: session.email || user.email,
        lastSignedIn: signedInAt,
      });
      user = await db.getUserBySupabaseId(session.userId);
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    return user;
  }

  /**
   * Get user info from Supabase
   */
  async getUserInfo(accessToken: string) {
    if (isUiDevMode) {
      return {
        id: UI_DEV_USER.supabaseId,
        email: UI_DEV_USER.email,
        name: UI_DEV_USER.name,
      };
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      throw new Error(error?.message || "Failed to get user info");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.user_metadata?.full_name || null,
    };
  }
}

export const supabaseAuth = new SupabaseAuthService();

