import mysql from "mysql2/promise";
import { ENV } from "./env";

let fileMetadataSchemaPromise: Promise<void> | null = null;
let projectsSchemaPromise: Promise<void> | null = null;
let imagesSchemaPromise: Promise<void> | null = null;
let contactsSchemaPromise: Promise<void> | null = null;
let notesSchemaPromise: Promise<void> | null = null;

type ColumnRow = {
  COLUMN_NAME: string;
};

type IndexRow = {
  INDEX_NAME: string;
};

type ConstraintRow = {
  CONSTRAINT_NAME: string;
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

async function fetchColumnNames(
  connection: mysql.Connection,
  database: string,
  tableName: string
): Promise<string[]> {
  const [rows] = await connection.execute(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `,
    [database, tableName]
  );

  return (rows as ColumnRow[]).map((row) => row.COLUMN_NAME);
}

async function fetchIndexNames(
  connection: mysql.Connection,
  database: string,
  tableName: string
): Promise<string[]> {
  const [rows] = await connection.execute(
    `
      SELECT DISTINCT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
    `,
    [database, tableName]
  );

  return (rows as IndexRow[]).map((row) => row.INDEX_NAME);
}

async function fetchForeignKeyNames(
  connection: mysql.Connection,
  database: string,
  tableName: string
): Promise<string[]> {
  const [rows] = await connection.execute(
    `
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ?
        AND TABLE_NAME = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    `,
    [database, tableName]
  );

  return (rows as ConstraintRow[]).map((row) => row.CONSTRAINT_NAME);
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
      const columnNames = await fetchColumnNames(connection, config.database, "file_metadata");
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

      if (!columnNames.includes("trashedAt")) {
        statements.push({
          description: "Adding file_metadata.trashedAt column",
          sql: "ALTER TABLE `file_metadata` ADD COLUMN `trashedAt` DATETIME NULL AFTER `imageMetadata`",
        });
      }

      const indexNames = await fetchIndexNames(connection, config.database, "file_metadata");
      if (!indexNames.includes("file_metadata_trashedAt_idx")) {
        statements.push({
          description: "Adding file_metadata_trashedAt_idx index",
          sql: "CREATE INDEX `file_metadata_trashedAt_idx` ON `file_metadata` (`trashedAt`)",
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

export async function ensureProjectsSchema(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    return;
  }

  if (projectsSchemaPromise) {
    return projectsSchemaPromise;
  }

  projectsSchemaPromise = (async () => {
    const config = parseConnectionConfig(databaseUrl);
    if (!config.database) {
      console.warn("[Database] Unable to verify projects schema: missing database name");
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
      const columnNames = await fetchColumnNames(connection, config.database, "projects");
      if (columnNames.length === 0) {
        console.warn("[Database] projects table not found while validating schema");
        return;
      }

      const statements: Array<{ description: string; sql: string }> = [];

      const hasClientId = columnNames.includes("clientId");
      const hasClientld = columnNames.includes("clientld");

      if (!hasClientId && hasClientld) {
        statements.push({
          description: "Renaming projects.clientld → clientId",
          sql: "ALTER TABLE `projects` CHANGE COLUMN `clientld` `clientId` INT NULL",
        });
      } else if (!hasClientId) {
        statements.push({
          description: "Adding projects.clientId column",
          sql: "ALTER TABLE `projects` ADD COLUMN `clientId` INT NULL AFTER `client`",
        });
      }

      if (!columnNames.includes("scheduledDates")) {
        statements.push({
          description: "Adding projects.scheduledDates column",
          sql: "ALTER TABLE `projects` ADD COLUMN `scheduledDates` JSON NULL AFTER `geo`",
        });
      }

      if (!columnNames.includes("archivedAt")) {
        statements.push({
          description: "Adding projects.archivedAt column",
          sql: "ALTER TABLE `projects` ADD COLUMN `archivedAt` DATETIME NULL AFTER `status`",
        });
      }

      if (!columnNames.includes("trashedAt")) {
        statements.push({
          description: "Adding projects.trashedAt column",
          sql: "ALTER TABLE `projects` ADD COLUMN `trashedAt` DATETIME NULL AFTER `archivedAt`",
        });
      }

      const indexNames = await fetchIndexNames(connection, config.database, "projects");
      const hasClientIdIndex = indexNames.includes("projects_clientId_idx");
      const hasLegacyClientIndex = indexNames.includes("projects_clientld_idx");
      if (!hasClientIdIndex) {
        if (hasLegacyClientIndex) {
          statements.push({
            description: "Dropping legacy projects_clientld_idx index",
            sql: "DROP INDEX `projects_clientld_idx` ON `projects`",
          });
        }
        statements.push({
          description: "Adding projects_clientId_idx index",
          sql: "CREATE INDEX `projects_clientId_idx` ON `projects` (`clientId`)",
        });
      }

      const hasArchivedAtIndex = indexNames.includes("projects_archivedAt_idx");
      if (!hasArchivedAtIndex) {
        statements.push({
          description: "Adding projects_archivedAt_idx index",
          sql: "CREATE INDEX `projects_archivedAt_idx` ON `projects` (`archivedAt`)",
        });
      }

      const hasTrashedAtIndex = indexNames.includes("projects_trashedAt_idx");
      if (!hasTrashedAtIndex) {
        statements.push({
          description: "Adding projects_trashedAt_idx index",
          sql: "CREATE INDEX `projects_trashedAt_idx` ON `projects` (`trashedAt`)",
        });
      }

      const foreignKeys = await fetchForeignKeyNames(connection, config.database, "projects");
      const hasClientIdFk = foreignKeys.includes("projects_clientId_contacts_id_fk");
      const hasLegacyClientFk = foreignKeys.includes("projects_clientld_contacts_id_fk");
      if (!hasClientIdFk) {
        if (hasLegacyClientFk) {
          statements.push({
            description: "Dropping legacy projects_clientld_contacts_id_fk foreign key",
            sql: "ALTER TABLE `projects` DROP FOREIGN KEY `projects_clientld_contacts_id_fk`",
          });
        }
        statements.push({
          description: "Adding projects.clientId → contacts.id foreign key",
          sql: "ALTER TABLE `projects` ADD CONSTRAINT `projects_clientId_contacts_id_fk` FOREIGN KEY (`clientId`) REFERENCES `contacts`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION",
        });
      }

      if (statements.length === 0) {
        // Still run legacy backfill when schema is already correct.
        // (Older builds used projects.status = 'archived' as a soft-delete flag.)
        if (columnNames.includes("archivedAt") && columnNames.includes("status")) {
          try {
            await connection.execute(
              "UPDATE `projects` SET `archivedAt` = COALESCE(`archivedAt`, `updatedAt`, `createdAt`, NOW()) WHERE `status` = 'archived' AND `archivedAt` IS NULL"
            );
          } catch (error) {
            console.warn("[Database] Legacy archive backfill failed:", error);
          }
        }
        return;
      }

      console.log(`[Database] Fixing projects schema (${statements.length} change${statements.length > 1 ? "s" : ""})`);
      for (const statement of statements) {
        console.log(`[Database] ${statement.description}`);
        await connection.execute(statement.sql);
      }

      // Backfill legacy archived projects into the new lifecycle fields.
      if (columnNames.includes("status")) {
        try {
          await connection.execute(
            "UPDATE `projects` SET `archivedAt` = COALESCE(`archivedAt`, `updatedAt`, `createdAt`, NOW()) WHERE `status` = 'archived' AND `archivedAt` IS NULL"
          );
        } catch (error) {
          console.warn("[Database] Legacy archive backfill failed:", error);
        }
      }
      console.log("[Database] projects schema verified");
    } finally {
      await connection.end();
    }
  })().catch((error) => {
    projectsSchemaPromise = null;
    console.error("[Database] Projects schema validation failed:", error);
    throw error;
  });

  return projectsSchemaPromise;
}

export async function ensureImagesSchema(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    return;
  }

  if (imagesSchemaPromise) {
    return imagesSchemaPromise;
  }

  imagesSchemaPromise = (async () => {
    const config = parseConnectionConfig(databaseUrl);
    if (!config.database) {
      console.warn("[Database] Unable to verify images schema: missing database name");
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
      const columnNames = await fetchColumnNames(connection, config.database, "images");
      if (columnNames.length === 0) {
        // images table may not exist in some environments; ignore.
        return;
      }

      const statements: Array<{ description: string; sql: string }> = [];

      // Legacy DBs might not have images.projectId yet.
      if (!columnNames.includes("projectId")) {
        statements.push({
          description: "Adding images.projectId column",
          sql: "ALTER TABLE `images` ADD COLUMN `projectId` INT NULL AFTER `taskId`",
        });
      }

      const indexNames = await fetchIndexNames(connection, config.database, "images");
      const hasProjectIdIndex = indexNames.includes("images_projectId_idx");
      if (!hasProjectIdIndex) {
        statements.push({
          description: "Adding images_projectId_idx index",
          sql: "CREATE INDEX `images_projectId_idx` ON `images` (`projectId`)",
        });
      }

      const foreignKeys = await fetchForeignKeyNames(connection, config.database, "images");
      const hasProjectIdFk = foreignKeys.includes("images_projectId_projects_id_fk");
      if (!hasProjectIdFk) {
        statements.push({
          description: "Adding images.projectId → projects.id foreign key",
          sql: "ALTER TABLE `images` ADD CONSTRAINT `images_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION",
        });
      }

      if (statements.length === 0) {
        return;
      }

      console.log(`[Database] Fixing images schema (${statements.length} change${statements.length > 1 ? "s" : ""})`);
      for (const statement of statements) {
        console.log(`[Database] ${statement.description}`);
        await connection.execute(statement.sql);
      }
      console.log("[Database] images schema verified");
    } finally {
      await connection.end();
    }
  })().catch((error) => {
    imagesSchemaPromise = null;
    console.error("[Database] Images schema validation failed:", error);
    throw error;
  });

  return imagesSchemaPromise;
}

export async function ensureContactsSchema(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    return;
  }

  if (contactsSchemaPromise) {
    return contactsSchemaPromise;
  }

  contactsSchemaPromise = (async () => {
    const config = parseConnectionConfig(databaseUrl);
    if (!config.database) {
      console.warn("[Database] Unable to verify contacts schema: missing database name");
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
      const columnNames = await fetchColumnNames(connection, config.database, "contacts");
      if (columnNames.length === 0) {
        // contacts table may not exist in some environments; ignore.
        return;
      }

      const statements: Array<{ description: string; sql: string }> = [];

      if (!columnNames.includes("archivedAt")) {
        statements.push({
          description: "Adding contacts.archivedAt column",
          sql: "ALTER TABLE `contacts` ADD COLUMN `archivedAt` DATETIME NULL AFTER `notes`",
        });
      }

      if (!columnNames.includes("trashedAt")) {
        statements.push({
          description: "Adding contacts.trashedAt column",
          sql: "ALTER TABLE `contacts` ADD COLUMN `trashedAt` DATETIME NULL AFTER `archivedAt`",
        });
      }

      const indexNames = await fetchIndexNames(connection, config.database, "contacts");
      if (!indexNames.includes("contacts_archivedAt_idx")) {
        statements.push({
          description: "Adding contacts_archivedAt_idx index",
          sql: "CREATE INDEX `contacts_archivedAt_idx` ON `contacts` (`archivedAt`)",
        });
      }
      if (!indexNames.includes("contacts_trashedAt_idx")) {
        statements.push({
          description: "Adding contacts_trashedAt_idx index",
          sql: "CREATE INDEX `contacts_trashedAt_idx` ON `contacts` (`trashedAt`)",
        });
      }

      if (statements.length === 0) {
        return;
      }

      console.log(`[Database] Fixing contacts schema (${statements.length} change${statements.length > 1 ? "s" : ""})`);
      for (const statement of statements) {
        console.log(`[Database] ${statement.description}`);
        await connection.execute(statement.sql);
      }
      console.log("[Database] contacts schema verified");
    } finally {
      await connection.end();
    }
  })().catch((error) => {
    contactsSchemaPromise = null;
    console.error("[Database] Contacts schema validation failed:", error);
    throw error;
  });

  return contactsSchemaPromise;
}

export async function ensureNotesSchema(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    return;
  }

  if (notesSchemaPromise) {
    return notesSchemaPromise;
  }

  notesSchemaPromise = (async () => {
    const config = parseConnectionConfig(databaseUrl);
    if (!config.database) {
      console.warn("[Database] Unable to verify notes schema: missing database name");
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
      const columnNames = await fetchColumnNames(connection, config.database, "notes");
      if (columnNames.length === 0) {
        // notes table may not exist in some environments; ignore.
        return;
      }

      const statements: Array<{ description: string; sql: string }> = [];

      if (!columnNames.includes("archivedAt")) {
        statements.push({
          description: "Adding notes.archivedAt column",
          sql: "ALTER TABLE `notes` ADD COLUMN `archivedAt` DATETIME NULL AFTER `contactId`",
        });
      }

      if (!columnNames.includes("trashedAt")) {
        statements.push({
          description: "Adding notes.trashedAt column",
          sql: "ALTER TABLE `notes` ADD COLUMN `trashedAt` DATETIME NULL AFTER `archivedAt`",
        });
      }

      const indexNames = await fetchIndexNames(connection, config.database, "notes");
      if (!indexNames.includes("notes_archivedAt_idx")) {
        statements.push({
          description: "Adding notes_archivedAt_idx index",
          sql: "CREATE INDEX `notes_archivedAt_idx` ON `notes` (`archivedAt`)",
        });
      }
      if (!indexNames.includes("notes_trashedAt_idx")) {
        statements.push({
          description: "Adding notes_trashedAt_idx index",
          sql: "CREATE INDEX `notes_trashedAt_idx` ON `notes` (`trashedAt`)",
        });
      }

      if (statements.length === 0) {
        return;
      }

      console.log(`[Database] Fixing notes schema (${statements.length} change${statements.length > 1 ? "s" : ""})`);
      for (const statement of statements) {
        console.log(`[Database] ${statement.description}`);
        await connection.execute(statement.sql);
      }
      console.log("[Database] notes schema verified");
    } finally {
      await connection.end();
    }
  })().catch((error) => {
    notesSchemaPromise = null;
    console.error("[Database] Notes schema validation failed:", error);
    throw error;
  });

  return notesSchemaPromise;
}
