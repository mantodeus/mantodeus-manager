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
  let user: User | null = null;

  try {
    user = await supabaseAuth.authenticateRequest(opts.req);
  } catch (err) {
    // Authentication is optional for public procedures
    // Errors are expected for unauthenticated requests
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
