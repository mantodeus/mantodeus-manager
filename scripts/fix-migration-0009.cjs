const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");

/**
 * Fix for migration 0009_damp_terrax.sql
 * 
 * This script checks if tables from migration 0009 already exist,
 * and if so, marks the migration as applied in __drizzle_migrations.
 * 
 * Usage: DATABASE_URL=... node scripts/fix-migration-0009.cjs
 */

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const migrationFile = path.resolve("drizzle/0009_damp_terrax.sql");
if (!fs.existsSync(migrationFile)) {
  console.error("Migration file not found: drizzle/0009_damp_terrax.sql");
  process.exit(1);
}

function hashSql(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

// Tables that should exist if migration 0009 was applied
const expectedTables = [
  "inspection_findings",
  "inspection_media",
  "inspection_templates",
  "inspection_units",
  "inspections",
  "invoice_items",
  "user_preferences"
];

async function main() {
  const connection = await mysql.createConnection(databaseUrl);
  try {
    // Ensure migrations table exists
    await connection.execute(
      "CREATE TABLE IF NOT EXISTS __drizzle_migrations (" +
        "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
        "hash VARCHAR(255) NOT NULL," +
        "created_at BIGINT NOT NULL" +
      ")"
    );

    // Check which expected tables exist
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
    );
    const existingTableNames = new Set(tables.map((row) => row.TABLE_NAME));

    const existingTables = expectedTables.filter((name) =>
      existingTableNames.has(name)
    );

    console.log(`Found ${existingTables.length}/${expectedTables.length} expected tables from migration 0009:`);
    existingTables.forEach((name) => console.log(`  ✓ ${name}`));

    // If all or most tables exist, assume migration was applied
    if (existingTables.length === 0) {
      console.log("\nNo tables from migration 0009 found. Migration may not have been applied.");
      console.log("You can safely run the migration normally.");
      return;
    }

    // Read migration file and calculate hash
    const contents = fs.readFileSync(migrationFile, "utf8");
    const hash = hashSql(contents);

    // Check if migration is already marked as applied
    const [existing] = await connection.execute(
      "SELECT id FROM __drizzle_migrations WHERE hash = ?",
      [hash]
    );

    if (existing.length > 0) {
      console.log("\n✓ Migration 0009_damp_terrax.sql is already marked as applied.");
      return;
    }

    // Mark migration as applied
    const createdAt = Date.now();
    await connection.execute(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      [hash, createdAt]
    );

    console.log("\n✓ Migration 0009_damp_terrax.sql has been marked as applied.");
    console.log(`  Hash: ${hash.substring(0, 16)}...`);
    console.log(`  Created at: ${new Date(createdAt).toISOString()}`);
  } catch (error) {
    console.error("Failed to fix migration:", error.message || error);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();

