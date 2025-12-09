// This file MUST be imported FIRST before any other modules
// It loads environment variables from .env.local or .env

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

// Get the project root directory
// In source: server/_core/load-env.ts -> go up 2 levels
// In bundled dist/index.js: go up 1 level to project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to detect if we're in dist/ (bundled) or server/_core/ (source)
// If __dirname ends with 'dist', we're bundled, so go up 1 level
// Otherwise, we're in source, so go up 2 levels
let projectRoot: string;
// More robust detection: check if 'dist' is in the path
if (__dirname.includes('/dist') || __dirname.includes('\\dist') || __dirname.endsWith('dist')) {
  projectRoot = resolve(__dirname, "..");
} else {
  projectRoot = resolve(__dirname, "../..");
}

// Fallback: if .env not found, try current working directory
const cwdRoot = process.cwd();

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
  // Try multiple locations in order of preference
  const possiblePaths = [
    resolve(cwdRoot, ".env"),           // 1. Current working directory (most reliable)
    resolve(projectRoot, ".env"),        // 2. Project root (based on __dirname)
    resolve(__dirname, ".env"),         // 3. Same directory as this file
    resolve(__dirname, "../.env"),      // 4. One level up
    resolve(__dirname, "../../.env"),   // 5. Two levels up
  ];
  
  let envPath: string | null = null;
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      envPath = path;
      break;
    }
  }
  
  if (envPath) {
    const result = config({ path: envPath });
    if (result.error) {
      console.error("[dotenv] Error loading .env:", result.error.message);
    } else if (result.parsed) {
      console.log("[dotenv] Loaded .env from:", envPath);
      console.log("[dotenv] Loaded", Object.keys(result.parsed).length, "variables");
      // Debug: Show if Supabase vars are loaded
      if (result.parsed.VITE_SUPABASE_URL) {
        console.log("[dotenv] ✓ VITE_SUPABASE_URL is set");
      } else {
        console.warn("[dotenv] ✗ VITE_SUPABASE_URL is missing");
      }
      if (result.parsed.SUPABASE_SERVICE_ROLE_KEY) {
        console.log("[dotenv] ✓ SUPABASE_SERVICE_ROLE_KEY is set");
      } else {
        console.warn("[dotenv] ✗ SUPABASE_SERVICE_ROLE_KEY is missing");
      }
    }
  } else {
    console.error("[dotenv] .env not found in any of these locations:");
    possiblePaths.forEach((path, i) => {
      console.error(`  ${i + 1}. ${path}`);
    });
    console.error("[dotenv] Current working directory:", cwdRoot);
    console.error("[dotenv] __dirname:", __dirname);
    console.error("[dotenv] projectRoot:", projectRoot);
  }
}

