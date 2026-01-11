import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { config } from "dotenv";


export default defineConfig(({ mode }) => {
  const plugins = [react(), tailwindcss()];
  if (mode !== "production") {
    plugins.push(jsxLocPlugin());
  }
  // Ensure envDir points to project root where .env file is located
  const projectRoot = path.resolve(import.meta.dirname);
  const envDir = projectRoot;
  
  // CRITICAL: Load .env file explicitly if it exists
  // This ensures env vars are available even if process.env doesn't have them
  const envPath = path.resolve(envDir, '.env');
  if (fs.existsSync(envPath)) {
    const result = config({ path: envPath });
    if (result.error) {
      console.warn('[Vite Config] Warning: Error loading .env:', result.error.message);
    } else if (result.parsed) {
      console.log('[Vite Config] ✓ Loaded .env file with', Object.keys(result.parsed).length, 'variables');
    }
  } else {
    console.warn('[Vite Config] ⚠️  .env file not found at:', envPath);
    console.warn('[Vite Config]   Relying on process.env variables');
  }
  
  // Also use Vite's loadEnv to get env vars (it reads from .env files and process.env)
  const env = loadEnv(mode, envDir, 'VITE_');
  
  // Get env vars - prefer Vite's loaded env, fallback to process.env
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  
  // Debug logging
  console.log('[Vite Config] Mode:', mode);
  console.log('[Vite Config] envDir:', envDir);
  console.log('[Vite Config] .env path:', envPath);
  console.log('[Vite Config] .env exists:', fs.existsSync(envPath));
  console.log('[Vite Config] VITE_SUPABASE_URL:', supabaseUrl ? `✓ set (${supabaseUrl.substring(0, 30)}...)` : '✗ MISSING');
  console.log('[Vite Config] VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? `✓ set (${supabaseAnonKey.substring(0, 20)}...)` : '✗ MISSING');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Vite Config] ❌ FATAL: Missing required env vars!');
    console.error('[Vite Config]   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗ MISSING');
    console.error('[Vite Config]   VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓' : '✗ MISSING');
    console.error('[Vite Config]   These must be set for the build to work correctly.');
    console.error('[Vite Config]');
    console.error('[Vite Config] To fix this:');
    console.error('[Vite Config]   1. Create or update .env file in the project root');
    console.error('[Vite Config]   2. Add: VITE_SUPABASE_URL=https://your-project.supabase.co');
    console.error('[Vite Config]   3. Add: VITE_SUPABASE_ANON_KEY=your_anon_key_here');
    console.error('[Vite Config]   4. Run the build again');
    console.error('[Vite Config]');
    throw new Error('Missing required Supabase environment variables. Build cannot continue.');
  }
  
  const alias = {
    "@": path.resolve(projectRoot, "client", "src"),
    "@shared": path.resolve(projectRoot, "shared"),
    "@assets": path.resolve(projectRoot, "attached_assets"),
  };

  return {
    plugins,
    resolve: {
      alias,
    },
    envDir, // Points to project root where .env file should be
    root: path.resolve(projectRoot, "client"),
    publicDir: path.resolve(projectRoot, "client", "public"),
    build: {
      outDir: path.resolve(projectRoot, "dist/public"),
      emptyOutDir: true,
      // DEBUG MODE: enable sourcemaps to identify "Cannot access uninitialized variable" source on iOS PWA
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor chunks for better caching
            'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
            'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          },
        },
      },
      // Report chunk sizes
      chunkSizeWarningLimit: 1000, // 1MB
    },
    server: {
      host: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
      hmr: {
        overlay: false, // Disable error overlay to prevent UI blocking
      },
    },
  };
});
