import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { supabaseAuth } from "./supabase";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Create tRPC context for each request
 * 
 * PERFORMANCE: Authentication is cached in supabaseAuth service
 * to avoid hitting Supabase API on every request
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  console.error('[TRACE] createContext START');
  let user: User | null = null;

  try {
    console.error('[TRACE] createContext - calling supabaseAuth.authenticateRequest');
    user = await supabaseAuth.authenticateRequest(opts.req);
    console.error('[TRACE] createContext - authenticateRequest completed, user:', user ? { id: user.id, email: user.email } : null);
  } catch (err) {
    // Authentication is optional for public procedures
    // Errors are expected for unauthenticated requests
    console.error('[TRACE] createContext - authenticateRequest error (expected for public routes):', err instanceof Error ? err.message : String(err));
    user = null;
  }

  console.error('[TRACE] createContext - returning context, user exists:', !!user);
  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
