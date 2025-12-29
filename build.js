#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
// Vite will also read these, but we want to verify they exist before building
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log('✅ Loaded environment variables from .env\n');
} else {
  console.log('⚠️  No .env file found - using environment variables from system\n');
}

// Verify critical environment variables for build
const envExamplePath = join(__dirname, '.env.example');
const requiredViteVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const placeholderValues = ['REPLACE_ME', 'replace_me', 'YOUR_KEY_HERE', 'your_key_here', ''];

const placeholderPatterns = [
  /your-|your_/i,
  /replace/i,
  /changeme/i,
  /example/i,
  /generate/i,
  /_here$/i,
  /user:password@host/i
];

function isPlaceholderValue(value) {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (placeholderValues.includes(trimmed)) return true;
  return placeholderPatterns.some(pattern => pattern.test(trimmed));
}

function isExamplePlaceholder(value) {
  if (!value) return false;
  return placeholderPatterns.some(pattern => pattern.test(value));
}

// Actually required variables (matching server/_core/env.ts validation)
// Variables with defaults or not used are excluded
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

// Variables that have defaults or are optional (don't require them)
const OPTIONAL_VARS = [
  'OAUTH_SERVER_URL',           // Has fallback: process.env.VITE_APP_URL || process.env.OAUTH_SERVER_URL || "https://manager.mantodeus.com"
  'VITE_OAUTH_PORTAL_URL',      // Not used in codebase
  'VITE_APP_ID',                // Not used in codebase
  'VITE_APP_URL',               // Has fallback: process.env.VITE_APP_URL || process.env.OAUTH_SERVER_URL || "https://manager.mantodeus.com"
  'VITE_APP_TITLE',             // Has default: "Mantodeus Manager"
  'VITE_APP_LOGO',              // Optional
  'PORT',                       // Has default: 3000
  'S3_REGION',                  // Has default: us-east-1
  'PDF_SERVICE_URL',            // Has default
  'PDF_SERVICE_SECRET',         // Optional
  'PDF_EXPIRY_DEFAULT_HOURS',   // Has default: 168
  'DEFAULT_VAT_RATE',           // Has default: 19
  'WEBHOOK_SECRET',             // Optional
  'WEBHOOK_PORT',               // Has default: 9000
  'APP_PATH',                   // Has default
  'AXIOM_DATASET',              // Optional
  'AXIOM_TOKEN',                // Optional
  'LOG_LEVEL',                  // Optional
  'NODE_ENV',                   // Has default: "development"
];

function parseRequiredEnvFromExample() {
  // Start with the hardcoded list of actually required variables
  const requiredMap = new Map();
  ACTUALLY_REQUIRED_VARS.forEach(key => {
    requiredMap.set(key, { key, exampleValue: '' });
  });

  // If .env.example exists, update with example values (but keep all required vars)
  if (existsSync(envExamplePath)) {
    const content = readFileSync(envExamplePath, 'utf-8');
    const lines = content.split(/\r?\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      
      // Only include variables that are actually required (not optional)
      if (key && ACTUALLY_REQUIRED_VARS.includes(key)) {
        requiredMap.set(key, { key, exampleValue: value });
      }
    }
  } else {
    console.warn('[env] WARNING: .env.example not found; using hardcoded required vars list.');
  }

  return Array.from(requiredMap.values());
}

const requiredEnvVars = parseRequiredEnvFromExample();
const invalidEnvVars = [];

requiredEnvVars.forEach(({ key, exampleValue }) => {
  const value = process.env[key];
  if (!value || !value.trim()) {
    invalidEnvVars.push({ name: key, issue: 'MISSING', value: value || '(empty)' });
    return;
  }

  const examplePlaceholder = isExamplePlaceholder(exampleValue);
  const isPlaceholder = isPlaceholderValue(value) || (examplePlaceholder && value === exampleValue);
  if (isPlaceholder) {
    invalidEnvVars.push({ name: key, issue: 'PLACEHOLDER_VALUE', value });
  }
});

if (invalidEnvVars.length > 0) {
  console.error('\n[env] FATAL: Invalid or missing required environment variables:');
  invalidEnvVars.forEach(({ name, issue, value }) => {
    console.error(`   - ${name}: ${issue}`);
    if (issue === 'PLACEHOLDER_VALUE') {
      console.error(`     Current value: "${value}" (placeholder - must be replaced)`);
    }
  });
  console.error('\nFix these in your .env file before building.');
  console.error('See .env.example for the required variables and format.\n');
  process.exit(1);
}

const missingVars = requiredViteVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ FATAL: Missing required environment variables for client build:');
  missingVars.forEach(varName => {
    const value = process.env[varName];
    console.error(`   - ${varName}: ${value ? `set (${value.substring(0, 10)}...)` : 'MISSING'}`);
  });
  console.error('\n💡 These variables must be available during the build process.');
  console.error('💡 Vite embeds environment variables at BUILD TIME, not runtime.');
  console.error('💡 Options:');
  console.error('   1. Ensure .env file exists in project root with these variables');
  console.error('   2. Set them as environment variables before running npm run build');
  console.error('   3. Check your deployment configuration\n');
  process.exit(1);
} else {
  console.log('✅ All required Vite environment variables are set');
  console.log(`   VITE_SUPABASE_URL: ${process.env.VITE_SUPABASE_URL ? '✓' : '✗'}`);
  console.log(`   VITE_SUPABASE_ANON_KEY: ${process.env.VITE_SUPABASE_ANON_KEY ? '✓' : '✗'}\n`);
}

console.log('🔨 Starting Mantodeus Manager build process...\n');

// Step 1: Clean dist directory
console.log('📁 Step 1: Cleaning dist directory...');
try {
  execSync('rm -rf dist', { cwd: __dirname, stdio: 'inherit' });
  console.log('✅ dist directory cleaned\n');
} catch (error) {
  console.log('⚠️  No dist directory to clean\n');
}

// Step 2: Create dist directory
console.log('📁 Step 2: Creating dist directory...');
try {
  mkdirSync(join(__dirname, 'dist'), { recursive: true });
  console.log('✅ dist directory created\n');
} catch (error) {
  console.error('❌ Failed to create dist directory:', error.message);
  process.exit(1);
}

// Step 3: Build frontend with Vite
console.log('⚛️  Step 3: Building frontend with Vite...');
try {
  // Increase Node.js heap size to prevent OOM errors during Vite build
  execSync('NODE_OPTIONS=--max-old-space-size=4096 npx vite build', { cwd: __dirname, stdio: 'inherit' });
  console.log('✅ Frontend build completed\n');
} catch (error) {
  console.error('❌ Vite build failed:', error.message);
  process.exit(1);
}

// Step 4: Verify frontend build output
console.log('🔍 Step 4: Verifying frontend build...');
const publicDir = join(__dirname, 'dist', 'public');
if (!existsSync(publicDir)) {
  console.error('❌ Frontend build failed: dist/public directory not found');
  process.exit(1);
}
console.log('✅ Frontend assets verified in dist/public\n');

// Step 5: Build backend with esbuild
console.log('🔧 Step 5: Building backend with esbuild...');
try {
  const esbuildCmd = 'npx esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --log-level=info';
  console.log(`Running: ${esbuildCmd}`);
  execSync(esbuildCmd, { cwd: __dirname, stdio: 'inherit' });
  console.log('✅ Backend build completed\n');
} catch (error) {
  console.error('❌ esbuild failed:', error.message);
  console.error('Error details:', error);
  process.exit(1);
}

// Step 6: Verify backend build output
console.log('🔍 Step 6: Verifying backend build...');
const indexPath = join(__dirname, 'dist', 'index.js');
if (!existsSync(indexPath)) {
  console.error('❌ Backend build failed: dist/index.js not found');
  console.error('Expected path:', indexPath);
  console.error('Current directory contents:');
  try {
    execSync('ls -lah dist/', { cwd: __dirname, stdio: 'inherit' });
  } catch (e) {
    console.error('Could not list dist/ directory');
  }
  process.exit(1);
}
console.log('✅ Backend bundle verified: dist/index.js exists\n');

// Step 7: Show build summary
console.log('📊 Build Summary:');
try {
  execSync('ls -lh dist/', { cwd: __dirname, stdio: 'inherit' });
  console.log('');
  execSync('du -sh dist/', { cwd: __dirname, stdio: 'inherit' });
} catch (error) {
  console.log('Could not show build summary');
}

console.log('\n✨ Build completed successfully! ✨');
console.log('📦 Output: dist/index.js');
console.log('🚀 Ready to start with: npm start\n');
