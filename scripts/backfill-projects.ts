#!/usr/bin/env npx tsx
/**
 * Backfill Script: Migrate Legacy Jobs/Tasks to Projects Structure
 * 
 * This script migrates data from the legacy jobs/tasks tables to the new
 * projects/project_jobs tables.
 * 
 * Migration Strategy:
 * - Each legacy job becomes a project
 * - Each legacy task becomes a project_job under its parent project
 * - Status values are mapped to new enums
 * - Original IDs are preserved in legacyId for tracking
 * 
 * Usage:
 *   npx tsx scripts/backfill-projects.ts --dry-run    # Preview changes
 *   npx tsx scripts/backfill-projects.ts              # Execute migration
 *   npx tsx scripts/backfill-projects.ts --help       # Show help
 * 
 * IMPORTANT: Always backup your database before running!
 *   mysqldump -u <user> -p <database> > backup-$(date +%Y%m%d-%H%M%S).sql
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq, sql, and, isNull } from "drizzle-orm";
import * as schema from "../drizzle/schema";

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const showHelp = args.includes("--help") || args.includes("-h");

if (showHelp) {
  console.log(`
Backfill Script: Migrate Legacy Jobs/Tasks to Projects Structure

Usage:
  npx tsx scripts/backfill-projects.ts [options]

Options:
  --dry-run    Preview changes without modifying the database
  --help, -h   Show this help message

Examples:
  npx tsx scripts/backfill-projects.ts --dry-run    # Preview changes
  npx tsx scripts/backfill-projects.ts              # Execute migration

IMPORTANT: Always backup your database before running!
  mysqldump -u <user> -p <database> > backup-$(date +%Y%m%d-%H%M%S).sql
`);
  process.exit(0);
}

// Status mapping from legacy to new
const JOB_STATUS_MAP: Record<string, "planned" | "active" | "completed" | "archived"> = {
  planning: "planned",
  active: "active",
  on_hold: "active", // Map on_hold to active
  completed: "completed",
  cancelled: "archived", // Map cancelled to archived
};

const TASK_STATUS_MAP: Record<string, "pending" | "in_progress" | "done" | "cancelled"> = {
  todo: "pending",
  in_progress: "in_progress",
  review: "in_progress", // Map review to in_progress
  completed: "done",
};

interface MigrationStats {
  projectsCreated: number;
  projectsSkipped: number;
  jobsCreated: number;
  jobsSkipped: number;
  errors: string[];
}

async function main() {
  console.log("=".repeat(60));
  console.log("Backfill Script: Migrate Legacy Jobs/Tasks to Projects");
  console.log("=".repeat(60));
  
  if (isDryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes will be made to the database\n");
  } else {
    console.log("\n⚠️  LIVE MODE - Changes will be written to the database\n");
    console.log("IMPORTANT: Make sure you have a backup!");
    console.log("Run: mysqldump -u <user> -p <database> > backup.sql\n");
    
    // Wait 3 seconds for user to abort if needed
    console.log("Starting in 3 seconds... (Ctrl+C to abort)");
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error("❌ ERROR: DATABASE_URL environment variable is not set");
    console.error("Set it with: export DATABASE_URL='mysql://user:pass@host:port/database'");
    process.exit(1);
  }

  // Connect to database
  console.log("📡 Connecting to database...");
  const db = drizzle(process.env.DATABASE_URL);

  const stats: MigrationStats = {
    projectsCreated: 0,
    projectsSkipped: 0,
    jobsCreated: 0,
    jobsSkipped: 0,
    errors: [],
  };

  try {
    // Step 1: Get all legacy jobs
    console.log("\n📋 Fetching legacy jobs...");
    const legacyJobs = await db.select().from(schema.jobs).orderBy(schema.jobs.id);
    console.log(`   Found ${legacyJobs.length} legacy jobs`);

    // Step 2: Check for existing projects (idempotency)
    console.log("\n🔍 Checking for existing projects...");
    const existingProjects = await db.select().from(schema.projects);
    const existingProjectNames = new Set(existingProjects.map(p => p.name));
    console.log(`   Found ${existingProjects.length} existing projects`);

    // Step 3: Migrate each legacy job to a project
    console.log("\n📦 Migrating legacy jobs to projects...\n");
    
    const projectIdMap: Record<number, number> = {}; // legacyJobId -> newProjectId

    for (const legacyJob of legacyJobs) {
      const projectName = `[Migrated] ${legacyJob.title}`;
      
      // Check if already migrated
      if (existingProjectNames.has(projectName)) {
        console.log(`   ⏭️  Skipping "${legacyJob.title}" (already exists)`);
        stats.projectsSkipped++;
        
        // Find the existing project for task migration
        const existing = existingProjects.find(p => p.name === projectName);
        if (existing) {
          projectIdMap[legacyJob.id] = existing.id;
        }
        continue;
      }

      // Map status
      const newStatus = JOB_STATUS_MAP[legacyJob.status] || "planned";

      // Prepare project data
      const projectData = {
        name: projectName,
        client: null as string | null,
        description: legacyJob.description,
        address: legacyJob.location,
        geo: legacyJob.latitude && legacyJob.longitude 
          ? { lat: parseFloat(legacyJob.latitude), lng: parseFloat(legacyJob.longitude) }
          : null,
        status: newStatus,
        startDate: legacyJob.startDate,
        endDate: legacyJob.endDate,
        createdBy: legacyJob.createdBy,
      };

      if (isDryRun) {
        console.log(`   📄 Would create project: "${projectName}"`);
        console.log(`      Status: ${legacyJob.status} → ${newStatus}`);
        console.log(`      CreatedBy: ${legacyJob.createdBy}`);
        stats.projectsCreated++;
        // Use a placeholder for dry run
        projectIdMap[legacyJob.id] = -legacyJob.id;
      } else {
        try {
          const result = await db.insert(schema.projects).values(projectData);
          const newProjectId = result[0].insertId;
          projectIdMap[legacyJob.id] = newProjectId;
          console.log(`   ✅ Created project: "${projectName}" (ID: ${newProjectId})`);
          stats.projectsCreated++;
        } catch (error) {
          const errMsg = `Failed to create project "${projectName}": ${error}`;
          console.error(`   ❌ ${errMsg}`);
          stats.errors.push(errMsg);
        }
      }
    }

    // Step 4: Get all legacy tasks
    console.log("\n📋 Fetching legacy tasks...");
    const legacyTasks = await db.select().from(schema.tasks).orderBy(schema.tasks.id);
    console.log(`   Found ${legacyTasks.length} legacy tasks`);

    // Step 5: Check for existing project_jobs (idempotency)
    console.log("\n🔍 Checking for existing project jobs...");
    const existingJobs = await db.select().from(schema.projectJobs);
    // Create a set of "projectId:title" for deduplication
    const existingJobKeys = new Set(existingJobs.map(j => `${j.projectId}:${j.title}`));
    console.log(`   Found ${existingJobs.length} existing project jobs`);

    // Step 6: Migrate each legacy task to a project_job
    console.log("\n📦 Migrating legacy tasks to project jobs...\n");

    for (const legacyTask of legacyTasks) {
      const projectId = projectIdMap[legacyTask.jobId];
      
      if (!projectId) {
        const errMsg = `Task "${legacyTask.title}" references non-existent job ID ${legacyTask.jobId}`;
        console.error(`   ⚠️  ${errMsg}`);
        stats.errors.push(errMsg);
        continue;
      }

      const jobTitle = `[Migrated] ${legacyTask.title}`;
      const jobKey = `${projectId}:${jobTitle}`;

      // Check if already migrated
      if (existingJobKeys.has(jobKey)) {
        console.log(`   ⏭️  Skipping task "${legacyTask.title}" (already exists)`);
        stats.jobsSkipped++;
        continue;
      }

      // Map status
      const newStatus = TASK_STATUS_MAP[legacyTask.status] || "pending";

      // Prepare job data
      const jobData = {
        projectId: projectId > 0 ? projectId : 1, // Use 1 for dry run placeholder
        title: jobTitle,
        category: legacyTask.priority, // Use priority as category
        description: legacyTask.description,
        assignedUsers: legacyTask.assignedTo ? [legacyTask.assignedTo] : null,
        status: newStatus,
        startTime: null as Date | null,
        endTime: legacyTask.dueDate,
      };

      if (isDryRun) {
        console.log(`   📄 Would create job: "${jobTitle}"`);
        console.log(`      Under project ID: ${projectId} (from job ID ${legacyTask.jobId})`);
        console.log(`      Status: ${legacyTask.status} → ${newStatus}`);
        stats.jobsCreated++;
      } else {
        try {
          const result = await db.insert(schema.projectJobs).values(jobData);
          console.log(`   ✅ Created job: "${jobTitle}" (ID: ${result[0].insertId})`);
          stats.jobsCreated++;
        } catch (error) {
          const errMsg = `Failed to create job "${jobTitle}": ${error}`;
          console.error(`   ❌ ${errMsg}`);
          stats.errors.push(errMsg);
        }
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("Migration Summary");
    console.log("=".repeat(60));
    console.log(`\n📊 Results:`);
    console.log(`   Projects created: ${stats.projectsCreated}`);
    console.log(`   Projects skipped (already exist): ${stats.projectsSkipped}`);
    console.log(`   Jobs created: ${stats.jobsCreated}`);
    console.log(`   Jobs skipped (already exist): ${stats.jobsSkipped}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors (${stats.errors.length}):`);
      stats.errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
    } else {
      console.log(`\n✅ No errors`);
    }

    if (isDryRun) {
      console.log("\n🔍 This was a DRY RUN. No changes were made.");
      console.log("Run without --dry-run to execute the migration.");
    } else {
      console.log("\n✅ Migration complete!");
      console.log("\nNote: Legacy tables (jobs, tasks) have NOT been dropped.");
      console.log("After verifying the migration, you can manually drop them:");
      console.log("  DROP TABLE tasks;");
      console.log("  DROP TABLE jobs;");
    }

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
