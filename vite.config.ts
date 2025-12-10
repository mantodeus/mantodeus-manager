import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";


const plugins = [react(), tailwindcss(), jsxLocPlugin()];

export default defineConfig(({ mode }) => {
  // Ensure envDir points to project root where .env file is located
  const projectRoot = path.resolve(import.meta.dirname);
  const envDir = projectRoot;
  
  // Debug logging in non-production builds
  if (mode !== 'production') {
    console.log('[Vite] envDir:', envDir);
    console.log('[Vite] VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✓ set' : '✗ missing');
    console.log('[Vite] VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? '✓ set' : '✗ missing');
  }
  
  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(projectRoot, "client", "src"),
        "@shared": path.resolve(projectRoot, "shared"),
        "@assets": path.resolve(projectRoot, "attached_assets"),
      },
    },
    envDir, // Points to project root where .env file should be
    root: path.resolve(projectRoot, "client"),
    publicDir: path.resolve(projectRoot, "client", "public"),
    build: {
      outDir: path.resolve(projectRoot, "dist/public"),
      emptyOutDir: true,
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
