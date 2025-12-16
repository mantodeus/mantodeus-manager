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
  console.error("[Supabase] ❌ Missing configuration - check .env file");
  throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}

// Log configuration (masked)
const keyPreview = ENV.supabaseServiceRoleKey.length > 20 
  ? `${ENV.supabaseServiceRoleKey.slice(0, 20)}...${ENV.supabaseServiceRoleKey.slice(-10)}` 
  : "[invalid]";
console.log(`[Supabase] URL: ${ENV.supabaseUrl}`);
console.log(`[Supabase] Key: ${keyPreview} (${ENV.supabaseServiceRoleKey.length} chars)`);

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

// =============================================================================
// SESSION CACHE - Prevents hitting Supabase/DB on every request
// =============================================================================

interface CachedSession {
  user: User;
  verifiedAt: number;
}

// In-memory cache: token hash -> cached session
const sessionCache = new Map<string, CachedSession>();

// How long to trust a cached session (5 minutes)
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  sessionCache.forEach((session, key) => {
    if (now - session.verifiedAt > SESSION_CACHE_TTL_MS * 2) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => sessionCache.delete(key));
}, 60 * 1000); // Clean every minute

// Simple hash for cache key (avoid storing raw tokens)
function hashToken(token: string): string {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  // Include token length and last chars for uniqueness
  return `${hash}_${token.length}_${token.slice(-8)}`;
}

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
    
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  /**
   * Get the access token from the request cookies or headers
   */
  private getAccessToken(req: Request): string | null {
    const cookieHeader = req.headers.cookie;
    const cookies = this.parseCookies(cookieHeader);
    
    // Try cookie first
    let token = cookies.get(COOKIE_NAME) || null;

    // Fallback to Authorization header (Bearer token) if cookie missing
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice("Bearer ".length).trim() || null;
      }
    }

    // Fallback: custom header for debugging/testing
    if (!token) {
      const headerToken = req.headers["x-supabase-token"];
      if (typeof headerToken === "string" && headerToken.length > 0) {
        token = headerToken;
      }
    }
    
    return token;
  }

  /**
   * Verify the Supabase session and get user info
   * NOTE: This makes an HTTP call to Supabase - should be cached at higher level
   */
  async verifySession(accessToken: string | null): Promise<SessionPayload | null> {
    if (!accessToken) {
      return null;
    }

    try {
      // Verify the token with Supabase (network call)
      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(accessToken);

      if (error) {
        // Only log actual errors, not expired tokens
        if (error.status !== 401) {
          console.error("[Auth] Supabase verification error:", error.message);
        }
        return null;
      }

      if (!user) {
        return null;
      }

      return {
        userId: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.user_metadata?.full_name || undefined,
      };
    } catch (error) {
      console.error("[Auth] Exception during token verification:", error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Authenticate a request and return the user
   * 
   * PERFORMANCE OPTIMIZATION:
   * - Uses in-memory cache to avoid hitting Supabase API on every request
   * - Only verifies with Supabase when cache is expired
   * - Does NOT update lastSignedIn on every request (only on cache miss)
   */
  async authenticateRequest(req: Request): Promise<User> {
    const accessToken = this.getAccessToken(req);
    
    if (!accessToken) {
      // Don't spam logs - this is common for unauthenticated requests
      throw ForbiddenError("Invalid or missing session");
    }
    
    // Check cache first - this avoids Supabase API call and DB queries
    const cacheKey = hashToken(accessToken);
    const cached = sessionCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.verifiedAt) < SESSION_CACHE_TTL_MS) {
      // Cache hit - return immediately without any network/DB calls
      return cached.user;
    }
    
    // Cache miss or expired - need to verify with Supabase
    const session = await this.verifySession(accessToken);

    if (!session) {
      // Invalid token - remove from cache if present
      sessionCache.delete(cacheKey);
      throw ForbiddenError("Invalid or missing session");
    }

    // Get or create user in our database
    let user = await db.getUserBySupabaseId(session.userId);

    // If user doesn't exist in our DB, create them
    if (!user) {
      console.log(`[Auth] Creating new user in database: ${session.userId}`);
      try {
        await db.upsertUser({
          supabaseId: session.userId,
          name: session.name || null,
          email: session.email || null,
          lastSignedIn: new Date(),
        });
        user = await db.getUserBySupabaseId(session.userId);
        
        if (!user) {
          console.error("[Auth] User was created but getUserBySupabaseId returned null!");
          throw ForbiddenError("User account creation failed - user not found after creation");
        }
      } catch (error) {
        console.error("[Auth] Failed to create user in database:", error);
        if (error instanceof Error && error.message.includes("Failed to create user account")) {
          throw error;
        }
        throw ForbiddenError(`Failed to create user account: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    // NOTE: We no longer update lastSignedIn on every request - only on new user creation
    // This eliminates a DB write on every single request

    if (!user) {
      throw ForbiddenError("User not found");
    }
    
    // Cache the successful authentication
    sessionCache.set(cacheKey, {
      user,
      verifiedAt: now,
    });

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

