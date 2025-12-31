#!/usr/bin/env node

/**
 * Mantodeus Manager - Debug Build Script
 * This script has extensive logging to diagnose Infomaniak build failures
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
const envPath = join(__dirname, '.env');
const envFileExists = existsSync(envPath);
if (envFileExists) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('❌ Error loading .env file:', result.error.message);
  } else {
    console.log('✅ Loaded environment variables from .env');
  }
} else {
  console.error('\n❌ FATAL: .env file not found!');
  console.error(`   Expected location: ${envPath}`);
  console.error('\n💡 Create a .env file in the project root with:');
  console.error('   - VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('   - VITE_SUPABASE_ANON_KEY=your_anon_key_here');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here');
  console.error('\n💡 See docs/INFOMANIAK_ENVIRONMENTS.md for a complete template.\n');
  process.exit(1);
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
// This list is NOT used - kept for documentation only
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
    const lines = content.split(/\r?\n/);

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

function isValidValue(value) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (placeholderValues.includes(trimmed)) return false;
  if (isPlaceholderValue(trimmed)) return false;
  return true;
}

const invalidVars = [];
requiredViteVars.forEach(varName => {
  const value = process.env[varName];
  if (!isValidValue(value)) {
    invalidVars.push({
      name: varName,
      value: value || '(empty)',
      issue: !value ? 'MISSING' : (placeholderValues.includes(value.trim()) ? 'PLACEHOLDER_VALUE' : 'EMPTY_OR_WHITESPACE')
    });
  }
});

if (invalidVars.length > 0) {
  console.error('\n❌ FATAL: Invalid or missing required environment variables for client build:');
  invalidVars.forEach(({ name, value, issue }) => {
    console.error(`   - ${name}: ${issue}`);
    if (issue === 'PLACEHOLDER_VALUE') {
      console.error(`     Current value: "${value}" (placeholder - must be replaced with real key)`);
    } else if (issue === 'EMPTY_OR_WHITESPACE') {
      console.error(`     Current value: "${value}" (empty or whitespace only)`);
    }
  });
  console.error('\n💡 These variables must be available during the build process.');
  console.error('💡 Vite embeds environment variables at BUILD TIME, not runtime.');
  console.error('\n💡 To fix:');
  console.error('   1. Open .env file in the project root');
  console.error('   2. Replace REPLACE_ME with your actual Supabase keys');
  console.error('   3. Get keys from: https://supabase.com/dashboard/project/_/settings/api');
  console.error('   4. Run "pnpm run build" again');
  console.error('\n💡 The .env file should contain:');
  console.error('   VITE_SUPABASE_URL=https://uwdkafekyrqjnstbywqw.supabase.co');
  console.error('   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (your actual key)');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (your actual key)');
  console.error('\n');
  process.exit(1);
} else {
  console.log('✅ All required Vite environment variables are set and valid');
  console.log(`   VITE_SUPABASE_URL: ✓ (${process.env.VITE_SUPABASE_URL.substring(0, 30)}...)`);
  console.log(`   VITE_SUPABASE_ANON_KEY: ✓ (${process.env.VITE_SUPABASE_ANON_KEY.substring(0, 30)}...)`);
  
  // Also verify SUPABASE_SERVICE_ROLE_KEY for runtime (backend)
  if (!isValidValue(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.warn('\n⚠️  WARNING: SUPABASE_SERVICE_ROLE_KEY is missing or invalid');
    console.warn('   This will cause the backend server to fail at runtime.');
    console.warn('   Add SUPABASE_SERVICE_ROLE_KEY to your .env file.');
  } else {
    console.log(`   SUPABASE_SERVICE_ROLE_KEY: ✓ (for backend runtime)`);
  }
}

console.log('='.repeat(80));
console.log('🔨 MANTODEUS MANAGER - DEBUG BUILD SCRIPT');
console.log('='.repeat(80));
console.log('');

// Helper function to run commands with full output
function runCommand(cmd, description, customEnv = null) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📌 ${description}`);
  console.log(`💻 Command: ${cmd}`);
  console.log(`${'─'.repeat(80)}`);
  
  try {
    const result = spawnSync(cmd, {
      shell: true,
      cwd: __dirname,
      stdio: 'inherit',
      encoding: 'utf-8',
      env: customEnv || process.env // Explicitly pass env vars
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

const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  console.log('🗑️  Removing existing dist directory...');
  try {
    rmSync(distPath, { recursive: true, force: true });
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
  mkdirSync(distPath, { recursive: true });
  console.log('✅ dist directory created');
} catch (error) {
  console.error('❌ Failed to create dist:', error.message);
  process.exit(1);
}

// STEP 2: Build frontend with Vite
console.log('\n' + '='.repeat(80));
console.log('⚛️  STEP 2: Build frontend with Vite');
console.log('='.repeat(80));

// CRITICAL: Verify env vars are in process.env before Vite build
// Vite reads from process.env.VITE_* variables at build time
console.log('\n🔍 Pre-build env verification:');
console.log(`   VITE_SUPABASE_URL: ${process.env.VITE_SUPABASE_URL ? '✓ set' : '✗ MISSING'}`);
console.log(`   VITE_SUPABASE_ANON_KEY: ${process.env.VITE_SUPABASE_ANON_KEY ? '✓ set' : '✗ MISSING'}`);
if (process.env.VITE_SUPABASE_URL) {
  console.log(`   VITE_SUPABASE_URL value: ${process.env.VITE_SUPABASE_URL.substring(0, 40)}...`);
}
if (process.env.VITE_SUPABASE_ANON_KEY) {
  console.log(`   VITE_SUPABASE_ANON_KEY prefix: ${process.env.VITE_SUPABASE_ANON_KEY.substring(0, 20)}...`);
}

// Ensure env vars are explicitly passed to Vite build process
// Vite reads from both .env files AND process.env.VITE_* variables
// We ensure both are available
const viteEnv = {
  ...process.env,
  // Explicitly ensure VITE_ vars are available (redundant but safe)
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
};

if (!viteEnv.VITE_SUPABASE_URL || !viteEnv.VITE_SUPABASE_ANON_KEY) {
  console.error('\n❌ FATAL: VITE env vars not available for Vite build!');
  console.error('   This means dotenv.config() did not load them correctly.');
  console.error('   Check that .env file exists and contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Build Vite command with explicit env vars and increased memory limit
// Increase Node.js heap size to prevent OOM errors during Vite build
// Use node directly with vite binary to ensure NODE_OPTIONS is properly applied
const viteBinPath = join(__dirname, 'node_modules', '.bin', 'vite');
const viteBinExists = existsSync(viteBinPath);

const defaultMaxOldSpace = 4096;
let nodeOptions = process.env.NODE_OPTIONS || '';
const hasMaxOldSpace = /--max-old-space-size=\d+/.test(nodeOptions);

if (!hasMaxOldSpace) {
  const envMax = process.env.BUILD_MAX_OLD_SPACE || process.env.VITE_BUILD_MAX_OLD_SPACE;
  const parsed = envMax ? Number(envMax) : NaN;
  const maxOldSpace = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultMaxOldSpace;
  nodeOptions = `${nodeOptions} --max-old-space-size=${maxOldSpace}`.trim();
}

// Extract the max-old-space-size value for direct node command
const maxOldSpaceMatch = nodeOptions.match(/--max-old-space-size=(\d+)/);
const maxOldSpaceValue = maxOldSpaceMatch ? maxOldSpaceMatch[1] : defaultMaxOldSpace.toString();

// Use node directly with vite binary if available, otherwise fall back to npx
// This ensures NODE_OPTIONS is properly applied to the vite process
// Direct node execution is more reliable than npx for memory settings
const viteCmd = viteBinExists 
  ? `node --max-old-space-size=${maxOldSpaceValue} "${viteBinPath}" build`
  : `NODE_OPTIONS="${nodeOptions}" npx vite build`;

const viteEnvWithMemory = {
  ...viteEnv,
  NODE_OPTIONS: nodeOptions,
};

console.log(`\n🔧 Using NODE_OPTIONS for Vite: ${nodeOptions || '(none)'}`);
console.log(`🔧 Vite command: ${viteCmd}`);
if (viteBinExists) {
  console.log(`🔧 Using direct node execution with ${maxOldSpaceValue}MB memory limit`);
}

const viteSuccess = runCommand(viteCmd, 'Frontend build (Vite)', viteEnvWithMemory);

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
  
  // Verify Supabase variables are embedded in the build
  console.log('\n🔍 Verifying Supabase variables are embedded in build...');
  try {
    const indexPath = join(__dirname, 'dist/public/index.html');
    if (existsSync(indexPath)) {
      const indexContent = readFileSync(indexPath, 'utf-8');
      const hasSupabaseUrl = indexContent.includes(process.env.VITE_SUPABASE_URL || '');
      const hasAnonKey = indexContent.includes(process.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) || '');
      
      if (hasSupabaseUrl && hasAnonKey) {
        console.log('✅ Supabase variables found embedded in index.html');
      } else {
        console.warn('⚠️  Supabase variables may not be embedded correctly');
        console.warn('   This is normal if variables are in JS bundles, not HTML');
      }
    }
    
    // Check JS bundles for embedded variables
    const jsFiles = readdirSync(join(__dirname, 'dist/public/assets')).filter(f => f.endsWith('.js'));
    if (jsFiles.length > 0) {
      // Check all JS files, not just the first one
      let foundUrl = false;
      let foundAnonKey = false;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
      
      // Try multiple patterns to find the anon key
      const anonKeyPatterns = [];
      if (anonKey) {
        // Full key
        anonKeyPatterns.push(anonKey);
        // First 30 chars (common prefix)
        if (anonKey.length > 30) {
          anonKeyPatterns.push(anonKey.substring(0, 30));
        }
        // First 20 chars
        if (anonKey.length > 20) {
          anonKeyPatterns.push(anonKey.substring(0, 20));
        }
        // Check for "pk_" prefix (anon key format)
        if (anonKey.startsWith('pk_')) {
          anonKeyPatterns.push('pk_');
        }
        // Check for "eyJ" prefix (JWT format)
        if (anonKey.startsWith('eyJ')) {
          anonKeyPatterns.push(anonKey.substring(0, 20));
        }
      }
      
      console.log(`\n🔍 Searching ${jsFiles.length} JS files for embedded variables...`);
      console.log(`   Looking for URL: ${supabaseUrl ? supabaseUrl.substring(0, 40) + '...' : 'MISSING'}`);
      console.log(`   Looking for anon key patterns: ${anonKeyPatterns.length > 0 ? anonKeyPatterns.map(p => p.substring(0, 10) + '...').join(', ') : 'NONE'}`);
      
      for (const jsFile of jsFiles) {
        const jsFilePath = join(__dirname, 'dist/public/assets', jsFile);
        const jsContent = readFileSync(jsFilePath, 'utf-8');
        
        if (supabaseUrl && jsContent.includes(supabaseUrl)) {
          foundUrl = true;
          console.log(`   ✓ Found URL in: ${jsFile}`);
        }
        
        // Check for anon key using all patterns
        for (const pattern of anonKeyPatterns) {
          if (jsContent.includes(pattern)) {
            foundAnonKey = true;
            console.log(`   ✓ Found anon key (pattern: ${pattern.substring(0, 15)}...) in: ${jsFile}`);
            break;
          }
        }
      }
      
      if (foundUrl && foundAnonKey) {
        console.log('\n✅ Supabase variables confirmed embedded in JS bundle');
        console.log(`   VITE_SUPABASE_URL: ✓ (embedded)`);
        console.log(`   VITE_SUPABASE_ANON_KEY: ✓ (embedded)`);
      } else {
        console.error('\n❌ Supabase variables NOT found in JS bundle!');
        console.error(`   VITE_SUPABASE_URL: ${foundUrl ? '✓' : '✗ NOT FOUND'}`);
        console.error(`   VITE_SUPABASE_ANON_KEY: ${foundAnonKey ? '✓' : '✗ NOT FOUND'}`);
        console.error('\n   This means Vite did not embed the variables correctly.');
        console.error('   Possible causes:');
        console.error('     1. .env file missing or not readable');
        console.error('     2. Variables not in process.env when Vite runs');
        console.error('     3. Vite config not loading .env correctly');
        console.error('     4. Variables have wrong prefix (must start with VITE_)');
        console.error('\n   Debug info:');
        console.error(`     VITE_SUPABASE_URL in process.env: ${process.env.VITE_SUPABASE_URL ? 'YES' : 'NO'}`);
        console.error(`     VITE_SUPABASE_ANON_KEY in process.env: ${process.env.VITE_SUPABASE_ANON_KEY ? 'YES' : 'NO'}`);
        if (process.env.VITE_SUPABASE_ANON_KEY) {
          console.error(`     Anon key length: ${process.env.VITE_SUPABASE_ANON_KEY.length}`);
          console.error(`     Anon key starts with: ${process.env.VITE_SUPABASE_ANON_KEY.substring(0, 5)}`);
        }
        process.exit(1);
      }
    }
  } catch (error) {
    console.warn('⚠️  Could not verify embedded variables:', error.message);
    console.warn('   This is okay - variables may be in a different location');
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
