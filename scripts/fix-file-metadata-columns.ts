#!/usr/bin/env npx tsx
/**
 * Diagnostic script to check and fix file_metadata column name typos
 * 
 * This script checks if the file_metadata table has columns named 'projectld' and 'jobld'
 * instead of 'projectId' and 'jobId', and fixes them if needed.
 * 
 * Run with: npx tsx scripts/fix-file-metadata-columns.ts
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function checkAndFixColumns() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // Parse connection string (format: mysql://user:password@host:port/database)
  const url = new URL(connectionString);
  const config = {
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1), // Remove leading /
  };

  const connection = await mysql.createConnection(config);

  try {
    console.log("Checking file_metadata table structure...");

    // Get current column names
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'file_metadata'
      ORDER BY ORDINAL_POSITION
    `, [config.database]);

    const columnNames = (columns as any[]).map((col: any) => col.COLUMN_NAME);
    console.log("Current columns:", columnNames.join(", "));

    // Check for typos
    const hasProjectldTypo = columnNames.includes("projectld");
    const hasJobldTypo = columnNames.includes("jobld");
    const hasCorrectProjectId = columnNames.includes("projectId");
    const hasCorrectJobId = columnNames.includes("jobId");

    if (!hasProjectldTypo && !hasJobldTypo) {
      console.log("✅ Column names are correct. No fixes needed.");
      return;
    }

    console.log("\n⚠️  Found column name typos. Fixing...");

    // Fix projectld -> projectId
    if (hasProjectldTypo && !hasCorrectProjectId) {
      console.log("Renaming 'projectld' to 'projectId'...");
      await connection.execute(`
        ALTER TABLE \`file_metadata\` 
        CHANGE COLUMN \`projectld\` \`projectId\` INT NOT NULL
      `);
      console.log("✅ Fixed projectld -> projectId");
    } else if (hasProjectldTypo && hasCorrectProjectId) {
      console.log("⚠️  Both 'projectld' and 'projectId' exist. Manual intervention needed.");
    }

    // Fix jobld -> jobId
    if (hasJobldTypo && !hasCorrectJobId) {
      console.log("Renaming 'jobld' to 'jobId'...");
      await connection.execute(`
        ALTER TABLE \`file_metadata\` 
        CHANGE COLUMN \`jobld\` \`jobId\` INT NULL
      `);
      console.log("✅ Fixed jobld -> jobId");
    } else if (hasJobldTypo && hasCorrectJobId) {
      console.log("⚠️  Both 'jobld' and 'jobId' exist. Manual intervention needed.");
    }

    // Verify the fix
    const [updatedColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'file_metadata'
      ORDER BY ORDINAL_POSITION
    `, [config.database]);

    const updatedColumnNames = (updatedColumns as any[]).map((col: any) => col.COLUMN_NAME);
    console.log("\n✅ Updated columns:", updatedColumnNames.join(", "));
    console.log("\n✅ Column names fixed successfully!");

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

checkAndFixColumns().catch(console.error);
