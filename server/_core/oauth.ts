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
  // Debug endpoint to check cookie status and test auth
  app.get("/api/auth/debug", async (req: Request, res: Response) => {
    const cookieHeader = req.headers.cookie;
    console.log("[Auth Debug] ===== Cookie Debug ===== ");
    console.log("[Auth Debug] Cookie header:", cookieHeader || "NONE");
    console.log("[Auth Debug] Cookie name looking for:", COOKIE_NAME);
    
    const hasCookie = cookieHeader?.includes(COOKIE_NAME);
    
    // Try to authenticate using the same method as auth.me
    let authResult = "not attempted";
    let authError: unknown = null;
    let authErrorDetails: { message: string; name: string; stack?: string } | null = null;
    try {
      const { supabaseAuth } = await import("./supabase");
      console.log("[Auth Debug] ===== Attempting authentication =====");
      console.log("[Auth Debug] Request URL:", req.url);
      console.log("[Auth Debug] Request method:", req.method);
      
      const user = await supabaseAuth.authenticateRequest(req).catch((err: unknown) => {
        authError = err;
        authErrorDetails = {
          message: err instanceof Error ? err.message : String(err),
          name: err instanceof Error ? err.name : typeof err,
          stack: err instanceof Error ? err.stack : undefined,
        };
        console.error("[Auth Debug] ❌ Authentication threw error:", err);
        if (err instanceof Error) {
          console.error("[Auth Debug] Error message:", err.message);
          console.error("[Auth Debug] Error name:", err.name);
        }
        return null;
      });
      
      if (user) {
        authResult = `success: ${user.id}`;
        console.log("[Auth Debug] ✅ Authentication succeeded:", user.id);
      } else {
        authResult = `failed: returned null`;
        console.error("[Auth Debug] ❌ Authentication returned null");
        if (authError) {
          console.error("[Auth Debug] Error was:", authError);
        }
      }
    } catch (error: unknown) {
      authResult = `error: ${error instanceof Error ? error.message : String(error)}`;
      authErrorDetails = {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
      };
      console.error("[Auth Debug] ❌ Exception during authentication:", error);
    }
    
    res.json({
      hasCookie,
      cookieName: COOKIE_NAME,
      rawCookieHeader: cookieHeader || "none",
      hostname: req.hostname,
      protocol: req.protocol,
      authResult,
      authorizationHeader: req.headers.authorization ? "present" : "none",
      authError: authError ? (authError instanceof Error ? authError.message : String(authError)) : null,
      authErrorDetails,
      // Include full cookie value for debugging (first 50 chars only for security)
      cookieValuePreview: cookieHeader?.includes(COOKIE_NAME) 
        ? cookieHeader.split(COOKIE_NAME + "=")[1]?.split(";")[0]?.substring(0, 50) + "..."
        : "not found",
    });
  });

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
      console.log("[Auth] Request info:", {
        hostname: req.hostname,
        protocol: req.protocol,
        originalUrl: req.originalUrl,
      });
      console.log("[Auth] Setting cookie with options:", {
        httpOnly: cookieOptions.httpOnly,
        path: cookieOptions.path,
        sameSite: cookieOptions.sameSite,
        secure: cookieOptions.secure,
        maxAge: "1 year",
      });
      
      res.cookie(COOKIE_NAME, access_token, {
        ...cookieOptions,
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      });

      console.log("[Auth] Cookie set successfully");
      const setCookieHeader = res.getHeader("Set-Cookie");
      console.log("[Auth] Set-Cookie header:", setCookieHeader);
      
      // Verify cookie was actually set
      if (!setCookieHeader) {
        console.error("[Auth] WARNING: Set-Cookie header is missing!");
      } else {
        const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : String(setCookieHeader);
        if (!cookieStr.includes(COOKIE_NAME)) {
          console.error("[Auth] WARNING: Cookie name not found in Set-Cookie header!");
        } else {
          console.log("[Auth] ✅ Cookie confirmed in Set-Cookie header");
        }
      }
      
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
