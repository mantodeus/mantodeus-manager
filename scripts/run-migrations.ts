#!/usr/bin/env tsx
/**
 * Production Migration Runner
 *
 * Runs all pending Drizzle migrations against the production database.
 * Called automatically during deployment.
 *
 * Usage:
 *   tsx scripts/run-migrations.ts
 *   npm run db:migrate:prod
 */

import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  console.error("   Make sure .env file exists and contains DATABASE_URL");
  process.exit(1);
}

async function runMigrations() {
  console.log("================================================================================");
  console.log("🔄 DATABASE MIGRATION RUNNER");
  console.log("================================================================================");
  console.log("");
  console.log("📅 Started at:", new Date().toISOString());
  console.log("🗄️  Database:", DATABASE_URL.substring(0, 30) + "...");
  console.log("");

  let connection: mysql.Connection | null = null;

  try {
    // Create database connection
    console.log("🔌 Connecting to database...");
    connection = await mysql.createConnection(DATABASE_URL);
    console.log("✅ Connected to database");
    console.log("");

    // Create drizzle instance
    const db = drizzle(connection);

    // Run migrations
    console.log("🚀 Running migrations from ./drizzle folder...");
    console.log("   This will apply any pending SQL migrations");
    console.log("");

    await migrate(db, { migrationsFolder: "./drizzle" });

    console.log("");
    console.log("✅ All migrations completed successfully");
    console.log("");

  } catch (error) {
    console.error("");
    console.error("❌ Migration failed:");
    console.error("");

    if (error instanceof Error) {
      console.error("Error:", error.message);
      if (error.stack) {
        console.error("");
        console.error("Stack trace:");
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }

    console.error("");
    console.error("Possible causes:");
    console.error("  - Database connection failed (check DATABASE_URL)");
    console.error("  - Invalid SQL in migration file");
    console.error("  - Database permissions issue");
    console.error("  - Migration already applied (check __drizzle_migrations table)");
    console.error("");

    process.exit(1);
  } finally {
    // Close connection
    if (connection) {
      try {
        await connection.end();
        console.log("🔌 Database connection closed");
      } catch (error) {
        console.error("⚠️  Error closing database connection:", error);
      }
    }
  }

  console.log("");
  console.log("================================================================================");
  console.log("✨ MIGRATION COMPLETE");
  console.log("================================================================================");
  console.log("");
}

// Run migrations
runMigrations().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
