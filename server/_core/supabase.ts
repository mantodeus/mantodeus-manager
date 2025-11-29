import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

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

