import puppeteer, { type Browser, type Page } from 'puppeteer';
import { ENV } from '../_core/env';

let browserInstance: Browser | null = null;

/**
 * Get or create a singleton browser instance with connection pooling
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    
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
      ],
      ...(executablePath ? { executablePath } : {}),
    });

    // Clean up browser on process exit
    process.on('exit', async () => {
      if (browserInstance) {
        await browserInstance.close();
      }
    });
  }

  return browserInstance;
}

/**
 * Generate PDF from HTML string using Puppeteer
 * @param html - HTML content to convert to PDF
 * @param options - PDF generation options
 * @returns PDF buffer
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
    
    // Set content and wait for any images/fonts to load
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
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
      await page.close();
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

