import express from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { join } from "path";

const execFileAsync = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.PDF_SERVICE_SECRET;

app.use(express.json({ limit: "5mb" }));

app.post("/render", async (req, res) => {
  const tempId = randomUUID();
  const htmlPath = join("/tmp", `${tempId}.html`);
  const pdfPath = join("/tmp", `${tempId}.pdf`);

  try {
    const auth = req.headers.authorization || "";
    if (!SECRET || auth !== `Bearer ${SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { html, options = {} } = req.body;
    if (!html) {
      return res.status(400).json({ error: "Missing html" });
    }

    await writeFile(htmlPath, html, "utf-8");

    const format = options.format || "A4";
    const marginTop = options.margin?.top || "10mm";
    const marginRight = options.margin?.right || "10mm";
    const marginBottom = options.margin?.bottom || "10mm";
    const marginLeft = options.margin?.left || "10mm";
    const printBackground = options.printBackground !== false;

    const wkhtmltopdfArgs = [
      "--page-size", format,
      "--margin-top", marginTop,
      "--margin-right", marginRight,
      "--margin-bottom", marginBottom,
      "--margin-left", marginLeft,
      "--encoding", "UTF-8",
      "--disable-smart-shrinking",
      "--quiet"
    ];

    if (printBackground) {
      wkhtmltopdfArgs.push("--enable-local-file-access");
    }

    wkhtmltopdfArgs.push(htmlPath, pdfPath);

    await execFileAsync("xvfb-run", [
      "-a",
      "--server-args=-screen 0 1024x768x24",
      "wkhtmltopdf",
      ...wkhtmltopdfArgs
    ]);

    const pdfBuffer = await readFile(pdfPath);

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF ERROR:", err);
    const errorMessage = err?.message || String(err) || "Unknown error";
    res.status(500).json({
      error: "PDF generation failed",
      message: errorMessage
    });
  } finally {
    try {
      await unlink(htmlPath).catch(() => {});
      await unlink(pdfPath).catch(() => {});
    } catch {}
  }
});

app.get("/health", (_, res) => {
  res.send("ok");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PDF service running on ${PORT}`);
});
