#!/usr/bin/env node
/**
 * Quick fix script to add missing sentAt column to invoices table
 * This column was supposed to be added in migration 0015 but failed
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function main() {
  // Load DATABASE_URL from .env file
  const envPath = path.join(process.cwd(), '.env');
  let databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) {
      databaseUrl = match[1].trim();
    }
  }
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment or .env file');
    process.exit(1);
  }
  
  console.log('🔌 Connecting to database...');
  const connection = await mysql.createConnection(databaseUrl);
  
  try {
    // Add sentAt column
    console.log('📝 Adding sentAt column...');
    try {
      await connection.execute(
        'ALTER TABLE `invoices` ADD COLUMN `sentAt` timestamp NULL AFTER `dueDate`'
      );
      console.log('✅ Added sentAt column');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ sentAt column already exists');
      } else {
        throw err;
      }
    }
    
    // Create index
    console.log('📝 Creating index...');
    try {
      await connection.execute(
        'CREATE INDEX `invoices_sentAt_idx` ON `invoices` (`sentAt`)'
      );
      console.log('✅ Created index');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('✅ Index already exists');
      } else {
        throw err;
      }
    }
    
    console.log('');
    console.log('✅ Successfully added sentAt column and index!');
    console.log('🔄 Please restart PM2: npx pm2 restart mantodeus-manager');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('   Code:', error.code);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

