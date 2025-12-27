// IMPORTANT: Load environment variables FIRST before any other imports
import "./load-env.js";
import { ENV } from "./env.js";

import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { storageGet } from "../storage";
import { supabaseAuth } from "./supabase";
import crypto from "crypto";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import pinoHttp from "pino-http";
import { logger, generateRequestId } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track if server has started successfully (for error handling)
let serverStarted = false;

// Set up uncaught exception handler early to catch module-load-time errors
// (e.g., Supabase initialization errors)
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught Exception");

  // Exit with delay to prevent rapid restart loops
  // This gives time for logs to be written
  setTimeout(() => {
    logger.fatal("Exiting due to uncaught exception");
    process.exit(1);
  }, serverStarted ? 5000 : 2000); // Shorter delay if server hasn't started
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled Rejection");
  // Log but don't exit immediately for unhandled rejections
  // They're often recoverable, but log for debugging
});

async function startServer() {
  logger.info({ dirname: __dirname }, "Starting server");

  // Initialize database schemas once at startup (not on every query)
  try {
    logger.info("Initializing database schemas");
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
    logger.info("Database schemas initialized successfully");
  } catch (error) {
    logger.warn({ err: error }, "Schema initialization failed (continuing anyway)");
  }

  const app = express();
  const server = createServer(app);

  // Add request logging middleware (before routes)
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.headers['x-request-id']?.toString() || generateRequestId(),
      customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessMessage: (req, res) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
      },
      customErrorMessage: (req, res, err) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${err?.message}`;
      },
      autoLogging: {
        ignore: (req) => {
          // Don't log health check requests to reduce noise
          return req.url === '/api/health';
        },
      },
    })
  );

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

  // PDF endpoints - require authentication
  app.get("/api/invoices/:id/pdf", async (req, res) => {
    try {
      const user = await supabaseAuth.authenticateRequest(req);

      // The authenticateRequest function throws on failure, but we add a check for clarity
      if (!user || !user.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const invoiceId = parseInt(req.params.id, 10);
      const isPreview = req.query.preview === "true";
      
      if (isNaN(invoiceId)) {
        return res.status(400).json({ error: "Invalid invoice ID" });
      }

      const { getInvoiceById, getCompanySettingsByUserId, getContactById } = await import("../db");
      const { generateInvoiceHTML } = await import("../templates/invoice");
      const { renderPDF } = await import("../services/pdfService");

      const invoice = await getInvoiceById(invoiceId);
      if (!invoice || invoice.userId !== user.id) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const companySettings = await getCompanySettingsByUserId(user.id);
      if (!companySettings) {
        return res.status(500).json({ error: "Company settings not found" });
      }

      // Get invoice items (new structure uses lineItems table)
      const { getInvoiceItemsByInvoiceId } = await import("../db");
      const lineItems = await getInvoiceItemsByInvoiceId(invoiceId);
      
      // Convert lineItems to legacy format for PDF template
      const itemsForPDF = lineItems.length > 0
        ? lineItems.map((item) => ({
            description: item.name + (item.description ? ` - ${item.description}` : ""),
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            total: Number(item.lineTotal),
          }))
        : (invoice.items as Array<{
            description: string;
            quantity: number;
            unitPrice: number;
            total: number;
          }>) || [];

      // Get client contact if linked
      let client = null;
      if (invoice.contactId || invoice.clientId) {
        const contact = await getContactById(invoice.contactId || invoice.clientId);
        if (contact) {
          client = {
            name: contact.name,
            address: contact.address,
          };
        }
      }

      // Use draft invoice number or generate preview number
      const invoiceNumber = invoice.invoiceNumber || (isPreview ? `DRAFT-${invoiceId}` : `PREVIEW-${invoiceId}`);

      const html = generateInvoiceHTML({
        invoiceNumber,
        invoiceDate: invoice.issueDate ?? new Date(),
        dueDate: invoice.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        company: companySettings,
        client,
        items: itemsForPDF,
        subtotal: Number(invoice.subtotal ?? 0),
        vatAmount: Number(invoice.vatAmount ?? 0),
        total: Number(invoice.total ?? 0),
        notes: invoice.notes || undefined,
        logoUrl: "",
      });

      const pdfBuffer = await renderPDF(html);
      const filename = `invoice-${invoiceNumber}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", isPreview ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid or missing session")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      req.log.error({ err: error }, "Invoice PDF generation failed");
      res.status(500).json({
        error: "Failed to generate PDF",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/invoices/:id/issue", async (req, res) => {
    try {
      const user = await supabaseAuth.authenticateRequest(req);
      const invoiceId = parseInt(req.params.id, 10);
      
      if (isNaN(invoiceId)) {
        return res.status(400).json({ error: "Invalid invoice ID" });
      }

      // Import required modules
      const db = await import("../db");
      const { generateInvoiceHTML } = await import("../templates/invoice");
      const { renderPDF } = await import("../services/pdfService");
      const { storagePut, generateFileKey } = await import("../storage");

      // Get invoice
      const invoice = await db.getInvoiceById(invoiceId);
      if (!invoice || invoice.userId !== user.id) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      if (invoice.status !== "draft") {
        return res.status(400).json({ error: "Only draft invoices can be issued" });
      }

      // Get company settings
      const companySettings = await db.getCompanySettingsByUserId(user.id);
      if (!companySettings) {
        return res.status(500).json({ error: "Company settings not found" });
      }

      const issueDate = invoice.issueDate ?? new Date();
      const { invoiceNumber, invoiceCounter, invoiceYear } = await db.generateInvoiceNumber(
        user.id,
        issueDate,
        companySettings.invoiceNumberFormat ?? null,
        companySettings.invoicePrefix ?? "RE"
      );
      await db.ensureUniqueInvoiceNumber(user.id, invoiceNumber, invoice.id);

      // Get client contact if linked
      let client = null;
      if (invoice.contactId || invoice.clientId) {
        const contact = await db.getContactById(invoice.contactId || invoice.clientId);
        if (contact) {
          client = {
            name: contact.name,
            address: contact.address,
          };
        }
      }

      const items = (invoice.items as Array<any>).map((item) => ({
        description: item.name || item.description || "",
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.lineTotal ?? item.total ?? 0),
      }));

      // Generate PDF
      const html = generateInvoiceHTML({
        invoiceNumber,
        invoiceDate: issueDate,
        dueDate: invoice.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        company: companySettings,
        client,
        items,
        subtotal: Number(invoice.subtotal ?? 0),
        vatAmount: Number(invoice.vatAmount ?? 0),
        total: Number(invoice.total ?? 0),
        notes: invoice.notes || undefined,
        logoUrl: "",
      });

      const pdfBuffer = await renderPDF(html);

      // Upload PDF to S3
      const timestamp = Date.now();
      const fileKey = generateFileKey("pdfs", user.id, `invoice-${invoiceNumber}-${timestamp}.pdf`);
      await storagePut(fileKey, pdfBuffer, "application/pdf");

      // Update invoice: set status, number, PDF reference, issued date
      const updated = await db.updateInvoice(invoiceId, {
        status: "sent",
        invoiceNumber,
        invoiceCounter,
        invoiceYear,
        pdfFileKey: fileKey,
        issueDate,
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid or missing session")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      req.log.error({ err: error }, "Issue invoice error");
      res.status(500).json({
        error: "Failed to issue invoice",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/projects/:id/pdf", async (req, res) => {
    try {
      const user = await supabaseAuth.authenticateRequest(req);
      const projectId = parseInt(req.params.id, 10);
      
      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Invalid project ID" });
      }

      const { getProjectById, getProjectJobsByProjectId, getFilesByProjectId, getContactById, getCompanySettingsByUserId } = await import("../db");
      const { generateProjectReportHTML } = await import("../templates/projectReport");
      const { renderPDF } = await import("../services/pdfService");
      const { createPresignedReadUrl } = await import("../storage");

      const project = await getProjectById(projectId);
      if (!project || project.userId !== user.id) {
        return res.status(404).json({ error: "Project not found" });
      }

      let clientContact = null;
      if (project.clientId) {
        const contact = await getContactById(project.clientId);
        if (contact) {
          clientContact = {
            name: contact.name,
            address: contact.address,
          };
        }
      }

      const jobs = await getProjectJobsByProjectId(projectId);
      const files = await getFilesByProjectId(projectId);
      
      const filesWithUrls = await Promise.all(
        files
          .filter((f: typeof files[0]) => f.mimeType?.startsWith('image/'))
          .slice(0, 10)
          .map(async (file: typeof files[0]) => {
            try {
              const signedUrl = await createPresignedReadUrl(file.s3Key, 3600);
              return { ...file, signedUrl };
            } catch {
              return file;
            }
          })
      );

      const companySettings = await getCompanySettingsByUserId(user.id);
      const companyName = companySettings?.companyName || 'Mantodeus Manager';

      const html = generateProjectReportHTML({
        project: {
          ...project,
          clientContact,
        },
        jobs,
        files: filesWithUrls,
        logoUrl: "",
        companyName,
      });

      const pdfBuffer = await renderPDF(html);
      const filename = `project-${projectId}-report.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid or missing session")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      req.log.error({ err: error }, "Project PDF error");
      res.status(500).json({
        error: "Failed to generate PDF",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
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
      logger.error({ err: error }, "Share link error");
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
      logger.error({ err: error }, "File proxy error");
      res.status(500).send("Internal server error");
    }
  });

  // GitHub Webhook endpoint for auto-deployment
  app.post("/api/github-webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const WEBHOOK_SECRET = ENV.webhookSecret;

    if (!WEBHOOK_SECRET) {
      logger.warn("No WEBHOOK_SECRET configured, skipping signature verification");
    } else {
      // Verify GitHub signature
      const signature = req.headers["x-hub-signature-256"] as string;
      if (!signature) {
        logger.warn("Webhook missing signature header");
        return res.status(401).send("Missing signature");
      }

      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
      hmac.update(body);
      const expectedSignature = `sha256=${hmac.digest("hex")}`;

      if (signature !== expectedSignature) {
        logger.warn("Webhook invalid signature");
        return res.status(401).send("Invalid signature");
      }
    }

    const event = req.headers["x-github-event"] as string;
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const ref = payload.ref;

    logger.info({ event, ref }, "Webhook received");

    // Handle ping event
    if (event === "ping") {
      logger.info("Webhook ping received successfully");
      return res.status(200).send("Pong!");
    }

    // Only deploy on push to main/master
    if (event === "push" && (ref === "refs/heads/main" || ref === "refs/heads/master")) {
      logger.info({ ref }, "Push to main detected, starting deployment");

      // Respond immediately before starting deploy
      res.status(200).send("Deployment started");

      // Run deployment via detached shell script
      // Using nohup ensures the deploy continues even if PM2 restarts this process
      const appPath = ENV.appPath;
      const deployCmd = `nohup bash infra/deploy/deploy.sh > deploy.log 2>&1 &`;

      exec(deployCmd, { cwd: appPath }, (err) => {
        if (err) {
          logger.error({ err: err.message }, "Failed to start deploy script");
        } else {
          logger.info("Deploy script started (detached). Check deploy.log for progress");
        }
      });
    } else {
      logger.info({ event, ref }, "Webhook event ignored");
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

  // Serve static files (production-only system)
  serveStatic(app);

  // ===== INFOMANIAK-READY PORT FIX =====
  const port = ENV.port;

  server.listen(port, () => {
    logger.info({ port }, "Server running");
    serverStarted = true; // Mark server as started successfully
  });

  // Handle server errors (e.g., port already in use)
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      logger.fatal({ port }, `Port ${port} is already in use. Kill the process or change PORT in .env`);
    } else {
      logger.fatal({ err: error }, "Server error");
    }
    process.exit(1);
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down gracefully");
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

// Improved error handling to prevent restart loops
startServer().catch((error) => {
  logger.fatal(
    {
      err: error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    "Failed to start server"
  );

  // Wait 5 seconds before exiting to prevent rapid restart loops
  // This gives time for logs to be written and prevents hammering the system
  setTimeout(() => {
    logger.fatal("Exiting after startup failure");
    process.exit(1);
  }, 5000);
});
