import express from "express";
import puppeteer from "puppeteer";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.PDF_SERVICE_SECRET;

// Auth middleware for internal service-to-service communication
const internalAuthMiddleware = (req, res, next) => {
  const auth = req.headers.authorization || "";
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

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

// Serve fonts as static assets
app.use("/fonts", express.static(path.join(process.cwd(), "fonts")));

app.post("/render", internalAuthMiddleware, async (req, res) => {
  try {
    const { html, options } = req.body;

    // Get browser instance (reused across requests)
    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Wait for fonts to load before rendering PDF
    await page.evaluateHandle("document.fonts.ready");

    // Wait for layout stabilization
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if (document.readyState === 'complete') {
          setTimeout(resolve, 100);
        } else {
          window.addEventListener('load', () => setTimeout(resolve, 100));
        }
      });
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      ...options,
    });

    await page.close();

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": pdfBuffer.length,
      "Content-Disposition": 'inline; filename="test.pdf"',
      "Cache-Control": "no-store",
    });

    res.end(pdfBuffer); // ✅ THIS IS CRITICAL
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF render failed" });
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
