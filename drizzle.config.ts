import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// Debug: Log connection string format (without password)
const connectionPreview = connectionString.replace(/:[^:@]+@/, ":****@");
console.log(`[Drizzle Config] Connection string format: ${connectionPreview.substring(0, 30)}...`);

// Ensure DATABASE_URL is PostgreSQL format
if (!connectionString.startsWith("postgres://") && !connectionString.startsWith("postgresql://")) {
  console.error("❌ ERROR: DATABASE_URL does not appear to be a PostgreSQL connection string");
  console.error(`   Current format: ${connectionString.substring(0, 20)}...`);
  console.error("   Expected format: postgresql://user:password@host:port/database");
  console.error("   Or: postgres://user:password@host:port/database");
  throw new Error("DATABASE_URL must be a PostgreSQL connection string (starts with postgres:// or postgresql://)");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
