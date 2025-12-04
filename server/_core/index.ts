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
import sharp from "sharp";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Image proxy endpoint - fetches from S3 with credentials and optional resizing
  // Supports ?w=width and/or ?h=height for on-demand thumbnails
  app.get("/api/image-proxy", async (req, res) => {
    try {
      const fileKey = req.query.key as string;
      const width = req.query.w ? parseInt(req.query.w as string, 10) : undefined;
      const height = req.query.h ? parseInt(req.query.h as string, 10) : undefined;
      const quality = req.query.q ? parseInt(req.query.q as string, 10) : 85;

      if (!fileKey) {
        return res.status(400).send("Missing key parameter");
      }

      // Fetch image from S3 using credentials
      const { data, contentType } = await storageGet(fileKey);

      // If resize requested and it's an image that can be processed
      if ((width || height) && contentType.startsWith("image/") && !contentType.includes("gif")) {
        try {
          let sharpInstance = sharp(data);
          
          // Resize while maintaining aspect ratio
          sharpInstance = sharpInstance.resize(width || null, height || null, {
            fit: "inside",
            withoutEnlargement: true,
          });

          // Output as WebP for best compression (falls back to JPEG for wide compatibility)
          const acceptHeader = req.headers.accept || "";
          if (acceptHeader.includes("image/webp")) {
            const resizedBuffer = await sharpInstance.webp({ quality }).toBuffer();
            res.setHeader("Content-Type", "image/webp");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            res.setHeader("Vary", "Accept");
            return res.send(resizedBuffer);
          } else {
            const resizedBuffer = await sharpInstance.jpeg({ quality, mozjpeg: true }).toBuffer();
            res.setHeader("Content-Type", "image/jpeg");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            res.setHeader("Vary", "Accept");
            return res.send(resizedBuffer);
          }
        } catch (resizeError) {
          console.error("Image resize error, serving original:", resizeError);
          // Fall through to serve original if resize fails
        }
      }

      // Serve original image
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(data);
    } catch (error) {
      console.error("Image proxy error:", error);
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
  });
}

startServer().catch(console.error);
