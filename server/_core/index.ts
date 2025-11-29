import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { storageGet } from "../storage";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Image proxy endpoint - fetches from S3 with credentials
  app.get("/api/image-proxy", async (req, res) => {
    try {
      const fileKey = req.query.key as string;
      if (!fileKey) {
        return res.status(400).send("Missing key parameter");
      }

      // Fetch image from S3 using credentials
      const { data, contentType } = await storageGet(fileKey);

      // Set headers and send image
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000");
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
