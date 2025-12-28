const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");

/**
 * Fix for migration 0010_giant_boom_boom.sql
 *
 * This script checks if tables/columns from migration 0010 already exist,
 * and if so, marks the migration as applied in __drizzle_migrations.
 *
 * Usage: DATABASE_URL=... node scripts/fix-migration-0010.cjs
 */

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const migrationFile = path.resolve("drizzle/0010_giant_boom_boom.sql");
if (!fs.existsSync(migrationFile)) {
  console.error("Migration file not found: drizzle/0010_giant_boom_boom.sql");
  process.exit(1);
}

function hashSql(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

const expectedTables = [
  "inspection_findings",
  "inspection_media",
  "inspection_templates",
  "inspection_units",
  "inspections",
  "invoice_items",
  "user_preferences",
];

const expectedColumns = {
  company_settings: [
    "streetName",
    "streetNumber",
    "postalCode",
    "city",
    "country",
    "invoiceNumberFormat",
    "logoS3Key",
    "logoUrl",
    "logoWidth",
    "logoHeight",
  ],
  invoices: [
    "userId",
    "clientId",
    "invoiceNumber",
    "invoiceYear",
    "invoiceCounter",
    "status",
    "issueDate",
    "dueDate",
    "sentAt",
    "paidAt",
    "notes",
    "servicePeriodStart",
    "servicePeriodEnd",
    "referenceNumber",
    "partialInvoice",
    "subtotal",
    "vatAmount",
    "total",
    "archivedAt",
    "trashedAt",
    "pdfFileKey",
    "updatedAt",
  ],
};

async function fetchColumnNames(connection, tableName) {
  const [rows] = await connection.execute(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `,
    [tableName]
  );
  return rows.map((row) => row.COLUMN_NAME);
}

async function main() {
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await connection.execute(
      "CREATE TABLE IF NOT EXISTS __drizzle_migrations (" +
        "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
        "hash VARCHAR(255) NOT NULL," +
        "created_at BIGINT NOT NULL" +
      ")"
    );

    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
    );
    const existingTableNames = new Set(tables.map((row) => row.TABLE_NAME));

    const existingTables = expectedTables.filter((name) =>
      existingTableNames.has(name)
    );

    console.log(
      `Found ${existingTables.length}/${expectedTables.length} expected tables from migration 0010:`
    );
    existingTables.forEach((name) => console.log(`  - ${name}`));

    if (existingTables.length === 0) {
      console.log("\nNo tables from migration 0010 found. Migration may not have been applied.");
      console.log("You can safely run the migration normally.");
      return;
    }

    const missingColumns = [];
    for (const [tableName, columns] of Object.entries(expectedColumns)) {
      if (!existingTableNames.has(tableName)) {
        missingColumns.push(`${tableName} (table missing)`);
        continue;
      }
      const existingColumns = new Set(await fetchColumnNames(connection, tableName));
      const missing = columns.filter((col) => !existingColumns.has(col));
      missing.forEach((col) => missingColumns.push(`${tableName}.${col}`));
    }

    if (missingColumns.length > 0) {
      console.log("\nMissing required columns from migration 0010:");
      missingColumns.forEach((col) => console.log(`  - ${col}`));
      console.log("\nRun the migration normally (or add the missing columns) before seeding.");
      process.exit(1);
    }

    const contents = fs.readFileSync(migrationFile, "utf8");
    const hash = hashSql(contents);

    const [existing] = await connection.execute(
      "SELECT id FROM __drizzle_migrations WHERE hash = ?",
      [hash]
    );

    if (existing.length > 0) {
      console.log("\nMigration 0010_giant_boom_boom.sql is already marked as applied.");
      return;
    }

    const createdAt = Date.now();
    await connection.execute(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      [hash, createdAt]
    );

    console.log("\nMigration 0010_giant_boom_boom.sql has been marked as applied.");
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
