#!/usr/bin/env node

/**
 * Mantodeus Manager - Debug Build Script
 * This script has extensive logging to diagnose Infomaniak build failures
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('='.repeat(80));
console.log('🔨 MANTODEUS MANAGER - DEBUG BUILD SCRIPT');
console.log('='.repeat(80));
console.log('');

// Helper function to run commands with full output
function runCommand(cmd, description) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📌 ${description}`);
  console.log(`💻 Command: ${cmd}`);
  console.log(`${'─'.repeat(80)}`);
  
  try {
    const result = spawnSync(cmd, {
      shell: true,
      cwd: __dirname,
      stdio: 'inherit',
      encoding: 'utf-8'
    });
    
    if (result.error) {
      console.error(`❌ Command failed with error:`, result.error);
      return false;
    }
    
    if (result.status !== 0) {
      console.error(`❌ Command exited with code: ${result.status}`);
      return false;
    }
    
    console.log(`✅ ${description} - SUCCESS`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} - FAILED:`, error.message);
    return false;
  }
}

// Helper function to check file/directory
function checkPath(path, type = 'file') {
  const fullPath = join(__dirname, path);
  const exists = existsSync(fullPath);
  
  if (exists) {
    const stats = statSync(fullPath);
    const size = stats.isFile() ? `${(stats.size / 1024).toFixed(2)} KB` : 'directory';
    console.log(`✅ ${type} exists: ${path} (${size})`);
    return true;
  } else {
    console.log(`❌ ${type} NOT FOUND: ${path}`);
    return false;
  }
}

// START BUILD PROCESS
console.log('🔍 STEP 0: Pre-build checks');
console.log('─'.repeat(80));

// Check Node.js version
console.log(`📦 Node.js version: ${process.version}`);
console.log(`📦 Platform: ${process.platform}`);
console.log(`📦 Architecture: ${process.arch}`);
console.log(`📦 Working directory: ${__dirname}`);
console.log('');

// Check if source files exist
console.log('🔍 Checking source files...');
checkPath('server/_core/index.ts', 'file');
checkPath('server/_core', 'directory');
checkPath('client/src', 'directory');
checkPath('package.json', 'file');
checkPath('vite.config.ts', 'file');
console.log('');

// Check if node_modules exists
if (checkPath('node_modules', 'directory')) {
  console.log('🔍 Checking critical dependencies...');
  checkPath('node_modules/vite', 'directory');
  checkPath('node_modules/esbuild', 'directory');
  checkPath('node_modules/esbuild/bin/esbuild', 'file');
} else {
  console.log('⚠️  node_modules not found - dependencies may not be installed');
}
console.log('');

// STEP 1: Clean dist directory
console.log('\n' + '='.repeat(80));
console.log('📁 STEP 1: Clean dist directory');
console.log('='.repeat(80));

if (existsSync(join(__dirname, 'dist'))) {
  console.log('🗑️  Removing existing dist directory...');
  try {
    execSync('rm -rf dist', { cwd: __dirname, stdio: 'inherit' });
    console.log('✅ dist directory removed');
  } catch (error) {
    console.error('❌ Failed to remove dist:', error.message);
  }
} else {
  console.log('ℹ️  No existing dist directory to clean');
}

// Create fresh dist directory
console.log('📁 Creating fresh dist directory...');
try {
  execSync('mkdir -p dist', { cwd: __dirname, stdio: 'inherit' });
  console.log('✅ dist directory created');
} catch (error) {
  console.error('❌ Failed to create dist:', error.message);
  process.exit(1);
}

// STEP 2: Build frontend with Vite
console.log('\n' + '='.repeat(80));
console.log('⚛️  STEP 2: Build frontend with Vite');
console.log('='.repeat(80));

const viteSuccess = runCommand('npx vite build', 'Frontend build (Vite)');

if (!viteSuccess) {
  console.error('\n❌ FATAL: Vite build failed');
  process.exit(1);
}

// Verify frontend output
console.log('\n🔍 Verifying frontend build output...');
if (checkPath('dist/public', 'directory')) {
  console.log('📂 Contents of dist/public:');
  try {
    const files = readdirSync(join(__dirname, 'dist/public'));
    files.forEach(file => {
      const filePath = join('dist/public', file);
      checkPath(filePath);
    });
  } catch (error) {
    console.error('❌ Could not list dist/public:', error.message);
  }
} else {
  console.error('❌ FATAL: Frontend build failed - dist/public not found');
  process.exit(1);
}

// STEP 3: Build backend with esbuild
console.log('\n' + '='.repeat(80));
console.log('🔧 STEP 3: Build backend with esbuild');
console.log('='.repeat(80));

// First, verify esbuild is available
console.log('🔍 Checking esbuild availability...');
try {
  const esbuildVersion = execSync('npx esbuild --version', { 
    cwd: __dirname, 
    encoding: 'utf-8' 
  }).trim();
  console.log(`✅ esbuild version: ${esbuildVersion}`);
} catch (error) {
  console.error('❌ esbuild not found or not executable:', error.message);
  process.exit(1);
}

// Check input file one more time
console.log('\n🔍 Verifying input file before esbuild...');
const inputFile = 'server/_core/index.ts';
if (!checkPath(inputFile, 'file')) {
  console.error(`❌ FATAL: Input file not found: ${inputFile}`);
  process.exit(1);
}

// Run esbuild with verbose logging
console.log('\n🔧 Running esbuild...');
const esbuildCmd = 'npx esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --log-level=info --metafile=dist/meta.json';
const esbuildSuccess = runCommand(esbuildCmd, 'Backend build (esbuild)');

if (!esbuildSuccess) {
  console.error('\n❌ FATAL: esbuild failed');
  
  // Try to provide more info
  console.log('\n🔍 Attempting to get more error details...');
  try {
    execSync('npx esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --log-level=debug', {
      cwd: __dirname,
      stdio: 'inherit'
    });
  } catch (debugError) {
    console.error('Debug run also failed:', debugError.message);
  }
  
  process.exit(1);
}

// STEP 4: Verify backend output
console.log('\n' + '='.repeat(80));
console.log('🔍 STEP 4: Verify backend build output');
console.log('='.repeat(80));

const indexJsPath = 'dist/index.js';
if (checkPath(indexJsPath, 'file')) {
  const stats = statSync(join(__dirname, indexJsPath));
  console.log(`📦 dist/index.js size: ${(stats.size / 1024).toFixed(2)} KB`);
  
  // Show first few lines
  console.log('\n📄 First 10 lines of dist/index.js:');
  try {
    const content = execSync('head -10 dist/index.js', {
      cwd: __dirname,
      encoding: 'utf-8'
    });
    console.log(content);
  } catch (error) {
    console.log('Could not read file content');
  }
} else {
  console.error('\n❌ FATAL: Backend build failed - dist/index.js NOT FOUND');
  console.log('\n🔍 Contents of dist/ directory:');
  try {
    execSync('ls -lah dist/', { cwd: __dirname, stdio: 'inherit' });
  } catch (error) {
    console.error('Could not list dist/ directory');
  }
  process.exit(1);
}

// STEP 5: Final verification
console.log('\n' + '='.repeat(80));
console.log('📊 STEP 5: Build summary');
console.log('='.repeat(80));

console.log('\n📂 Final dist/ structure:');
try {
  execSync('find dist -type f -exec ls -lh {} \\; | head -20', {
    cwd: __dirname,
    stdio: 'inherit'
  });
} catch (error) {
  console.log('Could not show file structure');
}

console.log('\n📊 Disk usage:');
try {
  execSync('du -sh dist/', { cwd: __dirname, stdio: 'inherit' });
} catch (error) {
  console.log('Could not calculate disk usage');
}

// SUCCESS
console.log('\n' + '='.repeat(80));
console.log('✨ BUILD COMPLETED SUCCESSFULLY! ✨');
console.log('='.repeat(80));
console.log('');
console.log('✅ Frontend: dist/public/');
console.log('✅ Backend: dist/index.js');
console.log('');
console.log('🚀 Ready to start with: npm start');
console.log('');
console.log('='.repeat(80));
