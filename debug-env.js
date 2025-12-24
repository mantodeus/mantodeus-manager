#!/usr/bin/env node
import { config } from 'dotenv';
import { existsSync } from 'fs';

const envPath = '.env';
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log('\n.env file loaded\n');
} else {
  console.log('\n.env file NOT FOUND\n');
}

const ACTUALLY_REQUIRED_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'JWT_SECRET',
  'OWNER_SUPABASE_ID',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
];

console.log('Checking ACTUALLY_REQUIRED_VARS:\n');
ACTUALLY_REQUIRED_VARS.forEach(key => {
  const value = process.env[key];
  const status = value ? '✓ SET' : '✗ MISSING';
  const preview = value ? `(${value.substring(0, 20)}...)` : '';
  console.log(`${status} ${key} ${preview}`);
});

console.log('\n\nChecking OAuth vars (should be optional):\n');
const optionalVars = ['OAUTH_SERVER_URL', 'VITE_OAUTH_PORTAL_URL', 'VITE_APP_ID', 'VITE_APP_URL'];
optionalVars.forEach(key => {
  const value = process.env[key];
  const status = value ? '✓ SET' : '○ NOT SET (OK)';
  const preview = value ? `(${value.substring(0, 20)}...)` : '';
  console.log(`${status} ${key} ${preview}`);
});
