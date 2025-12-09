// This file MUST be imported FIRST before any other modules
// It loads environment variables from .env.local or .env

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

// Get the project root directory (two levels up from this file: server/_core/load-env.ts -> server/_core -> server -> root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "../..");

const isProduction = process.env.NODE_ENV === "production";

if (!isProduction) {
  // In development, load .env.local first, then .env as fallback
  const envLocalPath = resolve(projectRoot, ".env.local");
  if (existsSync(envLocalPath)) {
    const result = config({ path: envLocalPath });
    if (result.error) {
      console.warn("[dotenv] Error loading .env.local:", result.error.message);
    } else if (result.parsed) {
      console.log("[dotenv] Loaded .env.local with", Object.keys(result.parsed).length, "variables");
      // Debug: Show if Supabase vars are loaded
      if (result.parsed.VITE_SUPABASE_URL) {
        console.log("[dotenv] ✓ VITE_SUPABASE_URL is set");
      }
      if (result.parsed.SUPABASE_SERVICE_ROLE_KEY) {
        console.log("[dotenv] ✓ SUPABASE_SERVICE_ROLE_KEY is set");
      }
    }
  } else {
    console.warn("[dotenv] .env.local not found at:", envLocalPath);
  }
  // Also try .env as fallback
  const envPath = resolve(projectRoot, ".env");
  if (existsSync(envPath)) {
    config({ path: envPath });
  }
} else {
  // In production, only load .env
  const envPath = resolve(projectRoot, ".env");
  if (existsSync(envPath)) {
    config({ path: envPath });
  }
}

