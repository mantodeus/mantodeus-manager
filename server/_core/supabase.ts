import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// Validate Supabase configuration
if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
  console.error("[Supabase] Missing configuration:");
  console.error("  VITE_SUPABASE_URL:", ENV.supabaseUrl ? "✓" : "✗");
  console.error("  SUPABASE_SERVICE_ROLE_KEY:", ENV.supabaseServiceRoleKey ? "✓" : "✗");
  console.error("");
  console.error("[Supabase] To fix this:");
  console.error("  1. Create or update .env file in the project root");
  console.error("  2. Add the following variables:");
  console.error("     VITE_SUPABASE_URL=https://your-project.supabase.co");
  console.error("     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key");
  console.error("  3. Restart the server");
  console.error("");
  console.error("  See docs/INFOMANIAK_ENVIRONMENTS.md for full environment variable documentation");
  throw new Error("Supabase configuration is missing. Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables in .env file.");
}

// Create Supabase client for server-side operations
export const supabaseAdmin = createClient(
  ENV.supabaseUrl,
  ENV.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Create Supabase client for client-side operations (public)
export function createSupabaseClient(accessToken?: string) {
  const client = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    },
  });
  return client;
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
    
    if (process.env.NODE_ENV === "development") {
      const url = typeof globalThis !== "undefined" && globalThis.process?.env ? "" : "";
      // Only log for auth.me requests
      if (cookieHeader.includes(COOKIE_NAME) || cookieHeader.length > 0) {
        console.log(`[Auth] Parsing cookie header (length: ${cookieHeader.length})`);
      }
    }
    
    const parsed = parseCookieHeader(cookieHeader);
    const cookieMap = new Map(Object.entries(parsed));
    
    if (process.env.NODE_ENV === "development") {
      if (cookieMap.size > 0) {
        console.log(`[Auth] Parsed ${cookieMap.size} cookies`);
        console.log(`[Auth] Cookie keys:`, Array.from(cookieMap.keys()));
        console.log(`[Auth] Looking for: ${COOKIE_NAME}`);
        console.log(`[Auth] Found ${COOKIE_NAME}:`, cookieMap.has(COOKIE_NAME));
      }
    }
    
    return cookieMap;
  }

  /**
   * Get the access token from the request cookies
   */
  private getAccessToken(req: Request): string | null {
    const cookieHeader = req.headers.cookie;
    const cookies = this.parseCookies(cookieHeader);
    
    if (process.env.NODE_ENV === "development") {
      const url = req.url || req.originalUrl || "";
      if (url.includes("auth.me")) {
        console.log(`[Auth] ===== getAccessToken called =====`);
        console.log(`[Auth] Cookie header raw:`, cookieHeader || "NONE");
        console.log(`[Auth] Cookie name looking for: ${COOKIE_NAME}`);
        console.log(`[Auth] Parsed cookies map size:`, cookies.size);
        console.log(`[Auth] All parsed cookie keys:`, Array.from(cookies.keys()));
      }
    }
    
    let token = cookies.get(COOKIE_NAME) || null;

    // Fallback to Authorization header (Bearer token) if cookie missing
    // This is IMPORTANT - tRPC client sends this header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice("Bearer ".length).trim() || null;
        if (process.env.NODE_ENV === "development") {
          const url = req.url || req.originalUrl || "";
          if (url.includes("auth.me") || url.includes("auth/debug")) {
            console.log(`[Auth] ✅ Using Authorization header fallback (cookie was missing)`);
            console.log(`[Auth] Token from header (length: ${token?.length || 0})`);
          }
        }
      } else if (process.env.NODE_ENV === "development") {
        const url = req.url || req.originalUrl || "";
        if (url.includes("auth.me") || url.includes("auth/debug")) {
          console.log(`[Auth] Authorization header not present or doesn't start with 'Bearer '`);
        }
      }
    }

    // Another fallback: custom header for debugging
    if (!token) {
      const headerToken = req.headers["x-supabase-token"];
      if (typeof headerToken === "string" && headerToken.length > 0) {
        token = headerToken;
        if (process.env.NODE_ENV === "development") {
          const url = req.url || req.originalUrl || "";
          if (url.includes("auth.me")) {
            console.log(`[Auth] Using x-supabase-token header fallback`);
          }
        }
      }
    }
    
    if (process.env.NODE_ENV === "development") {
      const url = req.url || req.originalUrl || "";
      if (url.includes("auth.me") || url.includes("auth/debug")) {
        if (!token) {
          console.log(`[Auth] ❌ No token found after all checks`);
          console.log(`[Auth] Cookie header:`, cookieHeader || "none");
          console.log(`[Auth] Authorization header:`, req.headers.authorization || "none");
          console.log(`[Auth] x-supabase-token header:`, req.headers["x-supabase-token"] || "none");
        } else {
          console.log(`[Auth] ✅ Found access token (length: ${token.length})`);
          console.log(`[Auth] Token source: ${cookieHeader?.includes(COOKIE_NAME) ? "cookie" : req.headers.authorization ? "Authorization header" : "x-supabase-token header"}`);
        }
      }
    }
    
    return token;
  }

  /**
   * Verify the Supabase session and get user info
   */
  async verifySession(accessToken: string | null): Promise<SessionPayload | null> {
    if (!accessToken) {
      if (process.env.NODE_ENV === "development") {
        console.log("[Auth] verifySession called with null token");
      }
      return null;
    }

    try {
      if (process.env.NODE_ENV === "development") {
        console.log(`[Auth] Verifying token with Supabase (length: ${accessToken.length})`);
      }
      
      // Verify the token with Supabase
      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(accessToken);

      if (error) {
        console.error("[Auth] ❌ Supabase token verification error:", error.message);
        console.error("[Auth] Error code:", error.status);
        console.error("[Auth] Full error:", error);
        return null;
      }

      if (!user) {
        console.error("[Auth] ❌ Supabase returned no user (but no error)");
        return null;
      }

      if (process.env.NODE_ENV === "development") {
        console.log(`[Auth] ✅ Token verified, user ID: ${user.id}`);
      }

      return {
        userId: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.user_metadata?.full_name || undefined,
      };
    } catch (error) {
      console.error("[Auth] ❌ Exception during token verification:", error);
      if (error instanceof Error) {
        console.error("[Auth] Error message:", error.message);
        console.error("[Auth] Error stack:", error.stack);
      }
      return null;
    }
  }

  /**
   * Authenticate a request and return the user
   */
  async authenticateRequest(req: Request): Promise<User> {
    const accessToken = this.getAccessToken(req);
    
    if (!accessToken) {
      console.error("[Auth] ❌ No access token found in request");
      console.error("[Auth] This should not happen if cookie/header is set correctly");
      throw ForbiddenError("Invalid or missing session");
    }
    
    console.log(`[Auth] Token found, verifying with Supabase...`);
    const session = await this.verifySession(accessToken);

    if (!session) {
      console.error("[Auth] ❌ Session verification returned null");
      console.error("[Auth] This means Supabase token verification failed");
      throw ForbiddenError("Invalid or missing session");
    }

    console.log(`[Auth] ✅ Session verified, user ID: ${session.userId}`);
    const signedInAt = new Date();
    
    // Get or create user in our database
    console.log(`[Auth] Looking up user in database: ${session.userId}`);
    let user = await db.getUserBySupabaseId(session.userId);

    // If user doesn't exist in our DB, create them
    if (!user) {
      console.log(`[Auth] Creating new user in database: ${session.userId}`);
      try {
        await db.upsertUser({
          supabaseId: session.userId,
          name: session.name || null,
          email: session.email || null,
          lastSignedIn: signedInAt,
        });
        user = await db.getUserBySupabaseId(session.userId);
        
        if (!user) {
          console.error("[Auth] User was created but getUserBySupabaseId returned null!");
          console.error("[Auth] This might be a database connection issue");
          throw ForbiddenError("User account creation failed - user not found after creation");
        }
        
        console.log(`[Auth] User created successfully: ${user.id}`);
      } catch (error) {
        console.error("[Auth] Failed to create user in database:", error);
        if (error instanceof Error && error.message.includes("Failed to create user account")) {
          throw error; // Re-throw ForbiddenError
        }
        // Log full error details
        console.error("[Auth] Database error details:", error);
        throw ForbiddenError(`Failed to create user account: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      // Update last signed in time
      try {
        await db.upsertUser({
          supabaseId: session.userId,
          name: session.name || user.name,
          email: session.email || user.email,
          lastSignedIn: signedInAt,
        });
        user = await db.getUserBySupabaseId(session.userId);
      } catch (error) {
        console.error("[Auth] Failed to update user in database:", error);
        // Continue with existing user data if update fails
      }
    }

    if (!user) {
      console.error("[Auth] User not found after upsert:", session.userId);
      throw ForbiddenError("User not found");
    }
    
    console.log(`[Auth] User authenticated successfully: ${user.id} (${user.name || user.email || "no name"})`);

    return user;
  }

  /**
   * Get user info from Supabase
   */
  async getUserInfo(accessToken: string) {
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

