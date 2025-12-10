#!/usr/bin/env node
/**
 * Diagnostic script to check Supabase configuration
 * Helps identify which environment file is being used and if credentials are valid
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname);

console.log('🔍 Checking Supabase Configuration...\n');

// Check which environment files exist
const envFiles = {
  '.env': resolve(projectRoot, '.env'),
  '.env.local': resolve(projectRoot, '.env.local'),
};

const foundFiles = {};
for (const [name, path] of Object.entries(envFiles)) {
  if (existsSync(path)) {
    foundFiles[name] = path;
    console.log(`✓ Found ${name}`);
  } else {
    console.log(`✗ ${name} not found`);
  }
}

console.log('\n📋 Environment Variable Values:\n');

// Parse .env files
for (const [name, path] of Object.entries(foundFiles)) {
  console.log(`\n--- ${name} ---`);
  try {
    const content = readFileSync(path, 'utf-8');
    const lines = content.split('\n');
    
    let supabaseUrl = null;
    let supabaseKey = null;
    
    for (const line of lines) {
      if (line.startsWith('VITE_SUPABASE_URL=')) {
        supabaseUrl = line.split('=')[1]?.trim();
        console.log(`VITE_SUPABASE_URL: ${supabaseUrl || 'empty'}`);
      }
      if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
        supabaseKey = line.split('=')[1]?.trim();
        const keyPreview = supabaseKey 
          ? `${supabaseKey.substring(0, 20)}... (length: ${supabaseKey.length})`
          : 'empty';
        console.log(`VITE_SUPABASE_ANON_KEY: ${keyPreview}`);
      }
    }
    
    // Validate format
    if (supabaseUrl && supabaseKey) {
      if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
        console.log('⚠️  WARNING: URL format may be incorrect');
      }
      if (!supabaseKey.startsWith('eyJ')) {
        console.log('⚠️  WARNING: API key format may be incorrect (should start with "eyJ")');
      }
      if (supabaseKey.length < 100) {
        console.log('⚠️  WARNING: API key seems too short (expected ~200+ characters)');
      }
    } else {
      console.log('⚠️  WARNING: Missing Supabase configuration');
    }
  } catch (error) {
    console.error(`Error reading ${name}:`, error.message);
  }
}

console.log('\n📝 Priority Order:');
console.log('  Development: .env.local (if exists) → .env');
console.log('  Production build: .env only');
console.log('\n💡 To fix "Invalid API key" error:');
console.log('  1. Verify your Supabase project URL and anon key in Supabase dashboard');
console.log('  2. Update the correct .env file (.env.local for dev, .env for production)');
console.log('  3. Rebuild the client: npm run build:frontend');
console.log('  4. Restart the development server or redeploy');


