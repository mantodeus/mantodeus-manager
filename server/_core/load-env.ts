/**
 * Environment loader - MUST be imported FIRST before any other modules.
 * Loads environment variables from a single .env file.
 * 
 * Mantodeus Manager is a production-only system by design.
 * There is ONE .env file, ONE deployment path, ONE environment.
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine project root based on whether we're in dist/ (bundled) or server/_core/ (source)
let projectRoot: string;
if (__dirname.includes("/dist") || __dirname.includes("\\dist") || __dirname.endsWith("dist")) {
  projectRoot = resolve(__dirname, "..");
} else {
  projectRoot = resolve(__dirname, "../..");
}

const cwdRoot = process.cwd();

// Search paths for .env file (in order of preference)
const possiblePaths = [
  resolve(cwdRoot, ".env"),
  resolve(projectRoot, ".env"),
  resolve(__dirname, ".env"),
  resolve(__dirname, "../.env"),
  resolve(__dirname, "../../.env"),
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
    console.log("[dotenv] Variables loaded:", Object.keys(result.parsed).length);
  }
} else {
  console.error("[dotenv] FATAL: .env file not found in any of these locations:");
  possiblePaths.forEach((path, i) => {
    console.error(`  ${i + 1}. ${path}`);
  });
  console.error("[dotenv] Current working directory:", cwdRoot);
  console.error("[dotenv] Project root:", projectRoot);
  process.exit(1);
}
