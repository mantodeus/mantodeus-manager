#!/usr/bin/env tsx
/**
 * Diagnostic script to check DATABASE_URL format
 * Run this on the server to verify the connection string format
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Try to load .env file
const envPath = join(process.cwd(), '.env');
let envContent = '';

try {
  envContent = readFileSync(envPath, 'utf-8');
} catch (error) {
  console.error('❌ Could not read .env file:', envPath);
  process.exit(1);
}

// Extract DATABASE_URL
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!dbUrlMatch) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

const dbUrl = dbUrlMatch[1].trim();
const dbUrlPreview = dbUrl.replace(/:[^:@]+@/, ':****@');

console.log('\n📋 DATABASE_URL Analysis:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Format preview: ${dbUrlPreview.substring(0, 60)}...`);
console.log(`Full length: ${dbUrl.length} characters`);

// Check format
if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
  console.log('✅ Format: PostgreSQL (correct)');
  
  // Extract components
  try {
    const url = new URL(dbUrl);
    console.log(`   Protocol: ${url.protocol}`);
    console.log(`   Host: ${url.hostname}`);
    console.log(`   Port: ${url.port || '5432 (default)'}`);
    console.log(`   Database: ${url.pathname.substring(1)}`);
    console.log('✅ Ready for PostgreSQL/Supabase');
  } catch (e) {
    console.log('⚠️  Could not parse URL (might still work)');
  }
} else if (dbUrl.startsWith('mysql://')) {
  console.error('❌ Format: MySQL (WRONG - needs to be PostgreSQL)');
  console.error('   Please update DATABASE_URL to a PostgreSQL connection string');
  console.error('   Example: postgresql://postgres:password@host:5432/database');
  process.exit(1);
} else {
  console.error('❌ Unknown format - does not start with postgres:// or postgresql://');
  console.error(`   Starts with: ${dbUrl.substring(0, 20)}...`);
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

