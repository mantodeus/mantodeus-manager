#!/usr/bin/env node
/**
 * Quick fix script to add missing sentAt and paidAt columns to invoices table
 * These columns were supposed to be added in migration 0015 but failed
 * because MySQL doesn't support "IF NOT EXISTS" for ADD COLUMN
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
    
    // Add paidAt column
    console.log('📝 Adding paidAt column...');
    try {
      await connection.execute(
        'ALTER TABLE `invoices` ADD COLUMN `paidAt` timestamp NULL AFTER `sentAt`'
      );
      console.log('✅ Added paidAt column');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ paidAt column already exists');
      } else {
        throw err;
      }
    }
    
    // Create sentAt index
    console.log('📝 Creating sentAt index...');
    try {
      await connection.execute(
        'CREATE INDEX `invoices_sentAt_idx` ON `invoices` (`sentAt`)'
      );
      console.log('✅ Created sentAt index');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('✅ sentAt index already exists');
      } else {
        throw err;
      }
    }
    
    // Create paidAt index
    console.log('📝 Creating paidAt index...');
    try {
      await connection.execute(
        'CREATE INDEX `invoices_paidAt_idx` ON `invoices` (`paidAt`)'
      );
      console.log('✅ Created paidAt index');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('✅ paidAt index already exists');
      } else {
        throw err;
      }
    }
    
    console.log('');
    console.log('✅ Successfully added sentAt and paidAt columns with indexes!');
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

