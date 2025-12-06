import mysql from "mysql2/promise";
import { ENV } from "./env";

let fileMetadataSchemaPromise: Promise<void> | null = null;

type ColumnRow = {
  COLUMN_NAME: string;
};

function resolveDatabaseUrl(): string | null {
  return ENV.databaseUrl || process.env.DATABASE_URL || null;
}

function parseConnectionConfig(databaseUrl: string) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  };
}

async function fetchColumnNames(connection: mysql.Connection, database: string): Promise<string[]> {
  const [rows] = await connection.execute(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'file_metadata'
      ORDER BY ORDINAL_POSITION
    `,
    [database]
  );

  return (rows as ColumnRow[]).map((row) => row.COLUMN_NAME);
}

export async function ensureFileMetadataSchema(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    return;
  }

  if (fileMetadataSchemaPromise) {
    return fileMetadataSchemaPromise;
  }

  fileMetadataSchemaPromise = (async () => {
    const config = parseConnectionConfig(databaseUrl);
    if (!config.database) {
      console.warn("[Database] Unable to verify file_metadata schema: missing database name");
      return;
    }

    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
    });

    try {
      const columnNames = await fetchColumnNames(connection, config.database);
      if (columnNames.length === 0) {
        console.warn("[Database] file_metadata table not found while validating schema");
        return;
      }

      const statements: Array<{ description: string; sql: string }> = [];

      const hasProjectId = columnNames.includes("projectId");
      const hasProjectld = columnNames.includes("projectld");
      if (!hasProjectId && hasProjectld) {
        statements.push({
          description: "Renaming file_metadata.projectld → projectId",
          sql: "ALTER TABLE `file_metadata` CHANGE COLUMN `projectld` `projectId` INT NOT NULL",
        });
      }

      const hasJobId = columnNames.includes("jobId");
      const hasJobld = columnNames.includes("jobld");
      if (!hasJobId && hasJobld) {
        statements.push({
          description: "Renaming file_metadata.jobld → jobId",
          sql: "ALTER TABLE `file_metadata` CHANGE COLUMN `jobld` `jobId` INT NULL",
        });
      }

      const hasImageMetadata = columnNames.includes("imageMetadata");
      if (!hasImageMetadata) {
        statements.push({
          description: "Adding file_metadata.imageMetadata column",
          sql: "ALTER TABLE `file_metadata` ADD COLUMN `imageMetadata` JSON NULL AFTER `uploadedAt`",
        });
      }

      if (statements.length === 0) {
        return;
      }

      console.log(`[Database] Fixing file_metadata schema (${statements.length} change${statements.length > 1 ? "s" : ""})`);
      for (const statement of statements) {
        console.log(`[Database] ${statement.description}`);
        await connection.execute(statement.sql);
      }
      console.log("[Database] file_metadata schema verified");
    } finally {
      await connection.end();
    }
  })().catch((error) => {
    fileMetadataSchemaPromise = null;
    console.error("[Database] File metadata schema validation failed:", error);
    throw error;
  });

  return fileMetadataSchemaPromise;
}
