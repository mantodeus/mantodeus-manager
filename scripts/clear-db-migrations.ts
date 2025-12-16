#!/usr/bin/env tsx
/**
 * Script to clear drizzle migrations table from database
 * This is needed when switching from MySQL to PostgreSQL
 */

import postgres from 'postgres';
import { ENV } from '../server/_core/env';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

if (!connectionString.startsWith('postgres')) {
  console.error('❌ DATABASE_URL is not a PostgreSQL connection string');
  process.exit(1);
}

async function clearMigrationsTable() {
  const sql = postgres(connectionString);
  
  try {
    console.log('🔍 Checking for migrations table...');
    
    // Check if drizzle schema exists
    const schemaExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.schemata 
        WHERE schema_name = 'drizzle'
      );
    `;
    
    if (schemaExists[0].exists) {
      console.log('📋 Found drizzle schema');
      
      // Check if migrations table exists in drizzle schema
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'drizzle' 
          AND table_name = '__drizzle_migrations'
        );
      `;
      
      if (tableExists[0].exists) {
        console.log('🗑️  Dropping __drizzle_migrations table...');
        await sql`DROP TABLE IF EXISTS drizzle.__drizzle_migrations CASCADE;`;
        console.log('✅ Dropped __drizzle_migrations table');
      }
      
      // Check if migrations table exists in public schema (fallback)
      const publicTableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '__drizzle_migrations'
        );
      `;
      
      if (publicTableExists[0].exists) {
        console.log('🗑️  Dropping public.__drizzle_migrations table...');
        await sql`DROP TABLE IF EXISTS public.__drizzle_migrations CASCADE;`;
        console.log('✅ Dropped public.__drizzle_migrations table');
      }
    } else {
      // Check public schema
      const publicTableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '__drizzle_migrations'
        );
      `;
      
      if (publicTableExists[0].exists) {
        console.log('🗑️  Dropping public.__drizzle_migrations table...');
        await sql`DROP TABLE IF EXISTS public.__drizzle_migrations CASCADE;`;
        console.log('✅ Dropped public.__drizzle_migrations table');
      } else {
        console.log('ℹ️  No migrations table found (this is OK for fresh setup)');
      }
    }
    
    console.log('');
    console.log('✅ Database migration tables cleared!');
    console.log('   You can now run: npm run db:push-direct');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

clearMigrationsTable();

