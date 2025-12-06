#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
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

// Verify critical environment variables for client build
const requiredViteVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
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
  execSync('npx vite build', { cwd: __dirname, stdio: 'inherit' });
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
