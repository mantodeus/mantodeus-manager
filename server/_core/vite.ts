import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get directory path for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  // Load vite config dynamically
  let viteConfig: any = {};
  try {
    const configModule = await import("../../vite.config.js");
    viteConfig = configModule.default || configModule;
  } catch (error) {
    console.warn("[Vite] Could not load vite.config, using defaults:", error);
  }

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  // Wrap Vite middleware to catch URI errors
  app.use((req, res, next) => {
    try {
      // Validate URL before passing to Vite
      const url = req.url || req.originalUrl || "/";
      if (url && url !== "/") {
        try {
          decodeURIComponent(url);
        } catch (e) {
          console.warn(`[Vite] Malformed URL detected: ${url}`);
          return res.status(400).send("Bad Request: Invalid URL");
        }
      }
    } catch (error) {
      console.error("[Vite] URL validation error:", error);
      return res.status(400).send("Bad Request: Invalid URL");
    }
    // Pass to Vite middleware
    vite.middlewares(req, res, next);
  });

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl || req.url || "/";

    // Validate URL to prevent URI malformed errors
    try {
      // Try to decode the URL to check if it's valid
      if (url && url !== "/") {
        decodeURIComponent(url);
      }
    } catch (e) {
      // If URL is malformed, return 400 Bad Request
      console.warn(`[Vite] Malformed URL: ${url}`);
      return res.status(400).send("Bad Request: Invalid URL");
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      // Log the error for debugging
      console.error("[Vite] Error transforming HTML:", e);
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Use process.cwd() which is the project root (where package.json is)
  // Frontend build is at dist/public/ from project root
  const distPath = path.resolve(process.cwd(), "dist", "public");
  
  console.log(`[Static] Serving static files from: ${distPath}`);
  console.log(`[Static] Current working directory: ${process.cwd()}`);
  
  if (!fs.existsSync(distPath)) {
    console.error(
      `[Static] ERROR: Could not find the build directory: ${distPath}`
    );
    console.error(`[Static] Make sure to run 'npm run build' first`);
    console.error(`[Static] Checking if dist/ exists: ${fs.existsSync(path.resolve(process.cwd(), "dist"))}`);
    
    // Don't serve static files if they don't exist - return 404 instead
    app.use("*", (_req, res) => {
      res.status(500).send(`
        <h1>Build Error</h1>
        <p>Frontend build not found at: ${distPath}</p>
        <p>Please run 'npm run build' on the server.</p>
      `);
    });
    return;
  }

  // Check if index.html exists
  const indexPath = path.resolve(distPath, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error(`[Static] ERROR: index.html not found at: ${indexPath}`);
    app.use("*", (_req, res) => {
      res.status(500).send(`
        <h1>Build Error</h1>
        <p>index.html not found at: ${indexPath}</p>
        <p>Please run 'npm run build' on the server.</p>
      `);
    });
    return;
  }

  console.log(`[Static] ✓ Found build files, serving from: ${distPath}`);
  app.use(express.static(distPath));

  // fall through to index.html for SPA routing
  app.use("*", (req, res) => {
    res.sendFile(indexPath);
  });
}
