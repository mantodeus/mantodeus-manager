const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");

const migrationsDir = path.resolve("drizzle");
const forceRaw = process.env.DRIZZLE_FORCE_MIGRATIONS || "";
const forceSet = new Set(
  forceRaw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/\.sql$/, ""))
);

if (!fs.existsSync(migrationsDir)) {
  console.error("drizzle/ folder not found. Cannot seed migrations.");
  process.exit(1);
}

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (migrationFiles.length === 0) {
  console.error("No migration files found in drizzle/.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required to seed migrations.");
  process.exit(1);
}

function hashSql(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
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

    const [rows] = await connection.execute(
      "SELECT COUNT(*) as count FROM __drizzle_migrations"
    );
    const count = Number(rows[0]?.count || 0);
    if (count > 0) {
      console.log("Drizzle migrations table already seeded.");
      return;
    }

    let createdAt = Date.now();

    for (const file of migrationFiles) {
      const tag = file.replace(/\.sql$/, "");
      if (forceSet.has(tag)) {
        console.log(`Skipping seed for ${tag} (forced to apply)`);
        createdAt += 1;
        continue;
      }
      const contents = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      const hash = hashSql(contents);
      await connection.execute(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        [hash, createdAt]
      );
      createdAt += 1;
    }

    console.log("Seeded __drizzle_migrations for existing migrations.");
  } catch (error) {
    console.error("Failed to seed drizzle migrations:", error.message || error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();