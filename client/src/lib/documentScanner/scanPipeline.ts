import { loadOpenCV } from "./opencvLoader";

export type Point = { x: number; y: number };

export type ScanResult = {
  blob: Blob;
  previewUrl: string;
  corners: [Point, Point, Point, Point] | null;
  confidence: number; // 0..1
};

const MAX_DIMENSION = 2000;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function orderCorners(points: Point[]): [Point, Point, Point, Point] {
  const sorted = [...points];
  const sum = (p: Point) => p.x + p.y;
  const diff = (p: Point) => p.x - p.y;

  const topLeft = sorted.reduce((a, b) => (sum(a) < sum(b) ? a : b));
  const bottomRight = sorted.reduce((a, b) => (sum(a) > sum(b) ? a : b));
  const topRight = sorted.reduce((a, b) => (diff(a) > diff(b) ? a : b));
  const bottomLeft = sorted.reduce((a, b) => (diff(a) < diff(b) ? a : b));

  return [topLeft, topRight, bottomRight, bottomLeft];
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = dataUrl;
  });
}

async function prepareCanvas(file: File) {
  const img = await fileToImage(file);
  const maxDim = Math.max(img.width, img.height);
  const scale = Math.min(1, MAX_DIMENSION / maxDim);
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context not available");
  }
  ctx.drawImage(img, 0, 0, width, height);

  return { canvas, width, height, scale, originalWidth: img.width, originalHeight: img.height };
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create blob"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

function matToCanvas(cv: any, mat: any): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  cv.imshow(canvas, mat);
  return canvas;
}

function warpAndEnhance(
  cv: any,
  src: any,
  corners: [Point, Point, Point, Point]
): any {
  const [tl, tr, br, bl] = corners;
  const widthA = distance(br, bl);
  const widthB = distance(tr, tl);
  const maxWidth = Math.max(widthA, widthB);

  const heightA = distance(tr, br);
  const heightB = distance(tl, bl);
  const maxHeight = Math.max(heightA, heightB);

  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    tl.x, tl.y,
    tr.x, tr.y,
    br.x, br.y,
    bl.x, bl.y,
  ]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    maxWidth - 1, 0,
    maxWidth - 1, maxHeight - 1,
    0, maxHeight - 1,
  ]);

  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  const dsize = new cv.Size(maxWidth, maxHeight);
  const warped = new cv.Mat();
  cv.warpPerspective(src, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_REPLICATE);

  const gray = new cv.Mat();
  cv.cvtColor(warped, gray, cv.COLOR_RGBA2GRAY);

  const normalized = new cv.Mat();
  cv.normalize(gray, normalized, 0, 255, cv.NORM_MINMAX);

  const thresholded = new cv.Mat();
  cv.adaptiveThreshold(
    normalized,
    thresholded,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY,
    21,
    10
  );

  srcTri.delete();
  dstTri.delete();
  M.delete();
  warped.delete();
  gray.delete();
  normalized.delete();

  return thresholded;
}

function fallbackResult(file: File): ScanResult {
  const previewUrl = URL.createObjectURL(file);
  return {
    blob: file,
    previewUrl,
    corners: null,
    confidence: 0.2,
  };
}

export async function scanDocument(file: File): Promise<ScanResult> {
  const cv = await loadOpenCV();

  try {
    const { canvas, width, height, scale } = await prepareCanvas(file);
    const src = cv.imread(canvas);

    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 75, 200);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let bestQuad: Point[] | null = null;
    let maxArea = 0;

    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);

      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const area = cv.contourArea(approx);
        if (area > maxArea) {
          const points: Point[] = [];
          const data = approx.data32S;
          for (let j = 0; j < 4; j += 1) {
            points.push({ x: data[j * 2], y: data[j * 2 + 1] });
          }
          bestQuad = points;
          maxArea = area;
        }
      }

      approx.delete();
      contour.delete();
    }

    const imageArea = width * height;
    const confidence = bestQuad ? clamp01(maxArea / imageArea) : 0.2;

    let result: ScanResult;
    if (bestQuad) {
      const ordered = orderCorners(bestQuad);
      const processed = warpAndEnhance(cv, src, ordered);
      const outputCanvas = matToCanvas(cv, processed);
      const blob = await canvasToBlob(outputCanvas, 0.85);
      const previewUrl = URL.createObjectURL(blob);
      const scaleFactor = 1 / scale;
      const originalCorners = ordered.map((corner) => ({
        x: corner.x * scaleFactor,
        y: corner.y * scaleFactor,
      })) as [Point, Point, Point, Point];

      result = {
        blob,
        previewUrl,
        corners: originalCorners,
        confidence,
      };

      processed.delete();
    } else {
      result = fallbackResult(file);
    }

    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();

    return result;
  } catch (error) {
    console.error("[scanDocument] Failed to process document:", error);
    return fallbackResult(file);
  }
}

export async function applyManualWarp(
  file: File,
  corners: [Point, Point, Point, Point]
): Promise<ScanResult> {
  const cv = await loadOpenCV();

  try {
    const { canvas, width, height, scale, originalWidth, originalHeight } = await prepareCanvas(file);
    const scaleX = width / originalWidth;
    const scaleY = height / originalHeight;
    const scaledCorners = corners.map((corner) => ({
      x: corner.x * scaleX,
      y: corner.y * scaleY,
    })) as [Point, Point, Point, Point];

    const src = cv.imread(canvas);
    const processed = warpAndEnhance(cv, src, orderCorners(scaledCorners));
    const outputCanvas = matToCanvas(cv, processed);
    const blob = await canvasToBlob(outputCanvas, 0.85);
    const previewUrl = URL.createObjectURL(blob);

    processed.delete();
    src.delete();

    return {
      blob,
      previewUrl,
      corners,
      confidence: clamp01(0.6),
    };
  } catch (error) {
    console.error("[applyManualWarp] Failed to warp document:", error);
    return fallbackResult(file);
  }
}
