import { COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import { getSessionCookieOptions } from "./cookies";
import { supabaseAdmin } from "./supabase";
import { ENV } from "./env";

/**
 * Supabase auth callback handler
 * This endpoint receives the Supabase session token and sets it as a cookie
 */
export function registerOAuthRoutes(app: Express) {
  app.post("/api/auth/callback", async (req: Request, res: Response) => {
    try {
      const { access_token } = req.body;

      // Log for debugging
      console.log("[Auth] Callback received");
      console.log("[Auth] Has access_token:", !!access_token);
      console.log("[Auth] Supabase URL configured:", !!ENV.supabaseUrl);
      console.log("[Auth] Service role key configured:", !!ENV.supabaseServiceRoleKey);

      if (!access_token) {
        console.error("[Auth] Missing access_token in request body");
        res.status(400).json({ error: "access_token is required" });
        return;
      }

      // Check if Supabase is configured
      if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
        console.error("[Auth] Supabase not configured. URL:", !!ENV.supabaseUrl, "Key:", !!ENV.supabaseServiceRoleKey);
        console.error("[Auth] ENV.supabaseUrl value:", ENV.supabaseUrl ? `${ENV.supabaseUrl.substring(0, 20)}...` : "empty");
        console.error("[Auth] ENV.supabaseServiceRoleKey value:", ENV.supabaseServiceRoleKey ? "set (hidden)" : "empty");
        res.status(500).json({ error: "Supabase not configured on server" });
        return;
      }

      // Verify the token with Supabase
      console.log("[Auth] Verifying token with Supabase...");
      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(access_token);

      if (error) {
        console.error("[Auth] Supabase token verification error:", error.message);
        res.status(401).json({ error: "Invalid access token", details: error.message });
        return;
      }

      if (!user) {
        console.error("[Auth] No user returned from Supabase");
        res.status(401).json({ error: "Invalid access token" });
        return;
      }

      console.log("[Auth] Token verified successfully, user ID:", user.id);

      // Set the access token as a cookie for subsequent requests
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, access_token, {
        ...cookieOptions,
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      });

      console.log("[Auth] Cookie set successfully");
      res.json({ success: true, userId: user.id });
    } catch (error) {
      console.error("[Auth] Callback failed with exception:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ 
        error: "Auth callback failed", 
        details: errorMessage 
      });
    }
  });
}
