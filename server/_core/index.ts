import "dotenv/config";
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
import { ENV } from "./env";

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

  if (ENV.isUiDevMode) {
    process.env.VITE_DEV_MODE = process.env.VITE_DEV_MODE ?? "ui";
    console.log("[DEV_MODE] UI mock mode enabled");
  }

  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

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
      
      // Respond immediately
      res.status(200).send("Deployment started");

      // Run deployment asynchronously
      const appPath = process.env.APP_PATH || "/srv/customer/sites/manager.mantodeus.com";
      const pm2Name = process.env.PM2_APP_NAME || "mantodeus-manager";
      
      const deployCmd = `cd ${appPath} && git pull && npm install && npm run build && npx pm2 restart ${pm2Name}`;
      
      exec(deployCmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          console.error("[Webhook] Deployment failed:", err.message);
          console.error("[Webhook] stderr:", stderr);
        } else {
          console.log("[Webhook] Deployment successful!");
          console.log("[Webhook] stdout:", stdout);
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
  const port = parseInt(process.env.PORT || "3000");

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    serverStarted = true; // Mark server as started successfully
  });

  // Handle server errors (e.g., port already in use)
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Please stop the other process or use a different port.`);
    } else {
      console.error("Server error:", error);
    }
    // Don't exit immediately - let the error handlers manage it
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
  console.error("Failed to start server:", error);
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
