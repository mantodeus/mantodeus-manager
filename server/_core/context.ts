import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { supabaseAuth } from "./supabase";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Log incoming request cookies for debugging
  if (process.env.NODE_ENV === "development") {
    const url = opts.req.url || opts.req.originalUrl || "unknown";
    if (url.includes("auth.me")) {
      console.log(`[Context] ===== auth.me request =====`);
      console.log(`[Context] URL:`, url);
      console.log(`[Context] Cookie header:`, opts.req.headers.cookie || "NONE");
      console.log(`[Context] Authorization header:`, opts.req.headers.authorization ? "PRESENT" : "NONE");
      console.log(`[Context] x-supabase-token header:`, opts.req.headers["x-supabase-token"] ? "PRESENT" : "NONE");
    }
  }

  try {
    user = await supabaseAuth.authenticateRequest(opts.req);
    if (user) {
      // Only log in development to avoid spam
      if (process.env.NODE_ENV === "development") {
        const url = opts.req.url || opts.req.originalUrl || "unknown";
        if (url.includes("auth.me")) {
          console.log(`[Auth] ✅ Authenticated user: ${user.id} (${user.name || user.email || "no name"})`);
        }
      }
    } else {
      if (process.env.NODE_ENV === "development") {
        const url = opts.req.url || opts.req.originalUrl || "unknown";
        if (url.includes("auth.me")) {
          console.log(`[Auth] ❌ authenticateRequest returned null (no user)`);
        }
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    if (process.env.NODE_ENV === "development") {
      const url = opts.req.url || opts.req.originalUrl || "unknown";
      if (url.includes("auth.me")) {
        console.log(`[Auth] ❌ Authentication failed:`, error instanceof Error ? error.message : String(error));
        console.log(`[Auth] Error stack:`, error instanceof Error ? error.stack : "N/A");
      }
    }
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
