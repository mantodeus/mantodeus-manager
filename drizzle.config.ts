// Load .env BEFORE any process.env access
import { config } from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";
import * as drizzleKit from "drizzle-kit";

// Try to load .env file explicitly
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const result = config({ path: envPath });
  if (result.error) {
    console.warn("[drizzle.config] Warning: Failed to load .env file:", result.error.message);
  }
} else {
  console.warn("[drizzle.config] Warning: .env file not found at:", envPath);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    `DATABASE_URL is required to run drizzle commands. ` +
    `Current working directory: ${process.cwd()}, ` +
    `Checked .env path: ${envPath}`
  );
}

export default drizzleKit.defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
