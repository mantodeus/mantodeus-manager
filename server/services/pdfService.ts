import puppeteer, { type Browser, type Page } from 'puppeteer';
import { ENV } from '../_core/env';

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

/**
 * Get or create a singleton browser instance with connection pooling
 * Uses a launch promise to prevent multiple concurrent launches
 */
async function getBrowser(): Promise<Browser> {
  // Return existing browser if available and connected
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  
  // If already launching, wait for that promise
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }
  
  // Launch new browser instance
  browserLaunchPromise = (async () => {
    const executablePath = ENV.puppeteerExecutablePath || undefined;
    
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--single-process', // Reduces resource usage
      ],
      ...(executablePath ? { executablePath } : {}),
    });

    // Clean up browser on process exit
    process.on('exit', () => {
      if (browserInstance) {
        browserInstance.close().catch(() => {});
      }
    });
    
    return browserInstance;
  })();
  
  try {
    const browser = await browserLaunchPromise;
    return browser;
  } finally {
    browserLaunchPromise = null;
  }
}

/**
 * Generate PDF from HTML string using Puppeteer
 * @param html - HTML content to convert to PDF
 * @param options - PDF generation options
 * @returns PDF buffer
 * 
 * PERFORMANCE: Uses 'domcontentloaded' instead of 'networkidle0' 
 * since we're generating HTML locally without external resources
 */
export async function generatePDF(
  html: string,
  options: {
    format?: 'A4' | 'Letter';
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    printBackground?: boolean;
  } = {}
): Promise<Buffer> {
  const browser = await getBrowser();
  let page: Page | null = null;

  try {
    page = await browser.newPage();
    
    // Set content - use 'domcontentloaded' for faster processing
    // Our HTML is self-contained with inline styles, no external resources
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 15000, // Reduced timeout since we don't wait for network
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      margin: options.margin || {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      printBackground: options.printBackground !== false,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * Close the browser instance (useful for cleanup in tests or shutdown)
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

