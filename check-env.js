#!/usr/bin/env node

/**
 * Environment Variable Diagnostic Script
 * Checks if required environment variables are available for build
 */

import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Environment Variable Diagnostic\n');
console.log('='.repeat(60));

// Check for .env file
const envPath = join(__dirname, '.env');
const envExists = existsSync(envPath);
console.log(`\n📄 .env file: ${envExists ? '✅ Found' : '❌ Not found'}`);
console.log(`   Path: ${envPath}`);

// Load .env if it exists
if (envExists) {
  config({ path: envPath });
  console.log('   ✅ Loaded .env file');
} else {
  console.log('   ⚠️  No .env file found - using system environment variables');
}

// Required variables for client build
const requiredViteVars = {
  'VITE_SUPABASE_URL': 'Supabase project URL',
  'VITE_SUPABASE_ANON_KEY': 'Supabase anonymous key',
};

// Server-only variables (for reference)
const serverVars = {
  'SUPABASE_SERVICE_ROLE_KEY': 'Supabase service role key',
  'DATABASE_URL': 'Database connection string',
  'JWT_SECRET': 'JWT secret for cookies',
};

console.log('\n📋 Required Vite Environment Variables (for client build):');
console.log('-'.repeat(60));
let allViteVarsPresent = true;
for (const [varName, description] of Object.entries(requiredViteVars)) {
  const value = process.env[varName];
  const isSet = !!value;
  const displayValue = value 
    ? `${value.substring(0, 20)}...${value.substring(value.length - 4)}` 
    : 'NOT SET';
  
  console.log(`${isSet ? '✅' : '❌'} ${varName}`);
  console.log(`   Description: ${description}`);
  console.log(`   Value: ${isSet ? displayValue : 'MISSING'}`);
  console.log('');
  
  if (!isSet) {
    allViteVarsPresent = false;
  }
}

console.log('\n📋 Server Environment Variables (for reference):');
console.log('-'.repeat(60));
for (const [varName, description] of Object.entries(serverVars)) {
  const value = process.env[varName];
  const isSet = !!value;
  console.log(`${isSet ? '✅' : '⚠️ '} ${varName}: ${isSet ? 'set' : 'not set'}`);
}

console.log('\n' + '='.repeat(60));

if (allViteVarsPresent) {
  console.log('\n✅ All required Vite environment variables are set!');
  console.log('   The build should succeed.\n');
  process.exit(0);
} else {
  console.log('\n❌ Missing required Vite environment variables!');
  console.log('\n💡 To fix this:');
  console.log('   1. Create/update .env file in project root');
  console.log('   2. Add the missing variables:');
  Object.entries(requiredViteVars).forEach(([varName, description]) => {
    if (!process.env[varName]) {
      console.log(`      ${varName}=your_value_here  # ${description}`);
    }
  });
  console.log('   3. Or set them as system environment variables');
  console.log('   4. Then run: npm run build\n');
  process.exit(1);
}
