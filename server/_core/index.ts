// IMPORTANT: Load environment variables FIRST before any other imports
import "./load-env.js";

import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { storageGet } from "../storage";
import crypto from "crypto";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track if server has started successfully (for error handling)
let serverStarted = false;

// Set up uncaught exception handler early to catch module-load-time errors
// (e.g., Supabase initialization errors)
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  console.error("Stack:", error.stack);
  
  // Exit with delay to prevent rapid restart loops
  // This gives time for logs to be written
  setTimeout(() => {
    console.error("Exiting due to uncaught exception...");
    process.exit(1);
  }, serverStarted ? 5000 : 2000); // Shorter delay if server hasn't started
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Log but don't exit immediately for unhandled rejections
  // They're often recoverable, but log for debugging
});

async function startServer() {
  // Log environment info for debugging
  if (process.env.NODE_ENV === "production") {
    console.log(`Starting production server from: ${__dirname}`);
  }

  // Initialize database schemas once at startup (not on every query)
  try {
    console.log("[Server] Initializing database schemas...");
    const { 
      ensureProjectsSchema, 
      ensureContactsSchema, 
      ensureFileMetadataSchema,
      ensureImagesSchema,
      ensureNotesSchema 
    } = await import("./schemaGuards");
    
    await Promise.all([
      ensureProjectsSchema(),
      ensureContactsSchema(),
      ensureFileMetadataSchema(),
      ensureImagesSchema(),
      ensureNotesSchema(),
    ]);
    console.log("[Server] ✅ Database schemas initialized");
  } catch (error) {
    console.error("[Server] ⚠️ Schema initialization failed (continuing anyway):", error);
  }

  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Health check endpoint - returns version info to verify deployment
  app.get("/api/health", async (req, res) => {
    let gitCommit = "unknown";
    try {
      const { execSync } = await import("child_process");
      gitCommit = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
    } catch {
      gitCommit = "unavailable";
    }
    
    res.json({
      status: "ok",
      version: gitCommit,
      timestamp: new Date().toISOString(),
      node: process.version,
      uptime: process.uptime(),
      // This identifier will prove the new code is deployed
      buildId: "perf-fix-2024-12-17",
    });
  });

  // Public shareable document endpoint
  app.get("/share/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Import here to avoid circular dependencies
      const { getSharedDocumentByToken } = await import("../db");
      const { storageGet } = await import("../storage");
      
      const sharedDoc = await getSharedDocumentByToken(token);
      
      if (!sharedDoc) {
        return res.status(404).send("Document not found");
      }
      
      // Check if expired
      if (new Date(sharedDoc.expiresAt) < new Date()) {
        return res.status(410).send("This link has expired");
      }
      
      // Fetch PDF from S3
      const { data, contentType } = await storageGet(sharedDoc.s3Key);
      
      // Set headers for PDF viewing
      res.setHeader("Content-Type", contentType || "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="document.pdf"`);
      res.setHeader("Cache-Control", "public, max-age=3600");
      
      res.send(data);
    } catch (error) {
      console.error("Share link error:", error);
      res.status(500).send("Internal server error");
    }
  });

  // Generic file proxy endpoint - for PDFs, documents, etc.
  app.get("/api/file-proxy", async (req, res) => {
    try {
      const fileKey = req.query.key as string;
      const download = req.query.download === "true";
      const filename = req.query.filename as string || "file";

      if (!fileKey) {
        return res.status(400).send("Missing key parameter");
      }

      // Fetch file from S3 using credentials
      const { data, contentType, size } = await storageGet(fileKey);

      // Set headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", size);
      
      if (download) {
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      } else {
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      }
      
      // Cache for 1 hour for frequently accessed files
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(data);
    } catch (error) {
      console.error("File proxy error:", error);
      res.status(500).send("Internal server error");
    }
  });

  // GitHub Webhook endpoint for auto-deployment
  app.post("/api/github-webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
    
    if (!WEBHOOK_SECRET) {
      console.log("[Webhook] No GITHUB_WEBHOOK_SECRET configured, skipping signature verification");
    } else {
      // Verify GitHub signature
      const signature = req.headers["x-hub-signature-256"] as string;
      if (!signature) {
        console.log("[Webhook] Missing signature header");
        return res.status(401).send("Missing signature");
      }

      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
      hmac.update(body);
      const expectedSignature = `sha256=${hmac.digest("hex")}`;

      if (signature !== expectedSignature) {
        console.log("[Webhook] Invalid signature");
        return res.status(401).send("Invalid signature");
      }
    }

    const event = req.headers["x-github-event"] as string;
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const ref = payload.ref;

    console.log(`[Webhook] Received - Event: ${event}, Ref: ${ref}`);

    // Handle ping event
    if (event === "ping") {
      console.log("[Webhook] Ping received successfully");
      return res.status(200).send("Pong!");
    }

    // Only deploy on push to main/master
    if (event === "push" && (ref === "refs/heads/main" || ref === "refs/heads/master")) {
      console.log("[Webhook] Push to main detected, starting deployment...");
      
      // Respond immediately before starting deploy
      res.status(200).send("Deployment started");

      // Run deployment via detached shell script
      // Using nohup ensures the deploy continues even if PM2 restarts this process
      const appPath = process.env.APP_PATH || "/srv/customer/sites/manager.mantodeus.com";
      const deployCmd = `nohup bash infra/deploy/deploy.sh > deploy.log 2>&1 &`;
      
      exec(deployCmd, { cwd: appPath }, (err) => {
        if (err) {
          console.error("[Webhook] Failed to start deploy script:", err.message);
        } else {
          console.log("[Webhook] Deploy script started (detached). Check deploy.log for progress.");
        }
      });
    } else {
      console.log(`[Webhook] Ignoring event: ${event} on ref: ${ref}`);
      res.status(200).send("Event ignored");
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ===== INFOMANIAK-READY PORT FIX =====
  const port = parseInt(process.env.PORT || "3000", 10);

  server.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
    serverStarted = true; // Mark server as started successfully
  });

  // Handle server errors (e.g., port already in use)
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`❌ Port ${port} is already in use.`);
      console.error(`   Kill the process using: netstat -ano | findstr :${port}`);
      console.error(`   Or change PORT in .env.local`);
    } else {
      console.error("❌ Server error:", error);
    }
    process.exit(1);
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

// Improved error handling to prevent restart loops
startServer().catch((error) => {
  console.error("❌ Failed to start server:");
  console.error("Error details:", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  
  // Wait 5 seconds before exiting to prevent rapid restart loops
  // This gives time for logs to be written and prevents hammering the system
  setTimeout(() => {
    console.error("Exiting after startup failure...");
    process.exit(1);
  }, 5000);
});
