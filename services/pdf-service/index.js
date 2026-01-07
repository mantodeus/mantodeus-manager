import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.PDF_SERVICE_SECRET;
const IS_DEV = process.env.NODE_ENV !== "production";

// CRITICAL: Browser instance reuse pattern
// Launch browser once on service startup, create pages per request
let browser = null;
let browserLaunchPromise = null;

async function getBrowser() {
  if (browser && browser.isConnected()) {
    return browser;
  }

  // If browser is launching, wait for it
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  // Launch new browser
  browserLaunchPromise = puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // Reduces memory usage
      '--disable-gpu',
    ],
  }).then((b) => {
    browser = b;
    browserLaunchPromise = null;
    
    // Handle browser crashes
    b.on('disconnected', () => {
      console.log('Browser disconnected, will restart on next request');
      browser = null;
      browserLaunchPromise = null;
    });
    
    return b;
  }).catch((err) => {
    console.error('Failed to launch browser:', err);
    browserLaunchPromise = null;
    throw err;
  });

  return browserLaunchPromise;
}

// Puppeteer accepts margin values in the same format (mm, cm, in, px)
// No conversion needed - pass through as-is

app.use(express.json({ limit: "5mb" }));

app.post("/render", async (req, res) => {
  let page = null;

  try {
    // Skip auth in DEV mode for faster validation
    if (!IS_DEV) {
      const auth = req.headers.authorization || "";
      if (!SECRET || auth !== `Bearer ${SECRET}`) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const { html, options = {} } = req.body;
    if (!html) {
      return res.status(400).json({ error: "Missing html" });
    }

    // Get browser instance (reused across requests)
    const browserInstance = await getBrowser();
    
    // Create new page per request
    page = await browserInstance.newPage();

    // Set content
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Parse options
    const format = options.format || "A4";
    const marginTop = options.margin?.top || "10mm";
    const marginRight = options.margin?.right || "10mm";
    const marginBottom = options.margin?.bottom || "10mm";
    const marginLeft = options.margin?.left || "10mm";
    const printBackground = options.printBackground !== false;

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: format,
      margin: {
        top: marginTop,
        right: marginRight,
        bottom: marginBottom,
        left: marginLeft,
      },
      printBackground: printBackground,
      preferCSSPageSize: false,
    });

    // Close page after PDF generation
    await page.close();
    page = null;

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF ERROR:", err);
    
    // Clean up page on error
    if (page) {
      try {
        await page.close();
      } catch (closeErr) {
        console.error("Error closing page:", closeErr);
      }
    }
    
    const errorMessage = err?.message || String(err) || "Unknown error";
    res.status(500).json({
      error: "PDF generation failed",
      message: errorMessage
    });
  }
});

app.get("/health", async (_, res) => {
  try {
    // Check if browser is available
    const browserInstance = await getBrowser();
    if (browserInstance && browserInstance.isConnected()) {
      res.send("ok");
    } else {
      res.status(503).send("browser not ready");
    }
  } catch (err) {
    res.status(503).json({ error: "service unavailable", message: err.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing browser...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PDF service running on ${PORT}`);
});
