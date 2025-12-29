const OPENCV_BASE_URL = "https://docs.opencv.org/4.10.0/";
const OPENCV_SCRIPT_URL = `${OPENCV_BASE_URL}opencv.js`;

type OpenCV = typeof globalThis & {
  cv: any;
  Module?: {
    locateFile?: (path: string) => string;
  };
};

let cvPromise: Promise<any> | null = null;

export async function loadOpenCV(): Promise<any> {
  if (cvPromise) return cvPromise;

  cvPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("OpenCV can only be loaded in the browser"));
      return;
    }

    const globalAny = globalThis as OpenCV;

    if (globalAny.cv && globalAny.cv.Mat) {
      resolve(globalAny.cv);
      return;
    }

    globalAny.Module = {
      locateFile: (path: string) => `${OPENCV_BASE_URL}${path}`,
    };

    const script = document.createElement("script");
    script.src = OPENCV_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const cv = globalAny.cv;
      if (!cv) {
        reject(new Error("OpenCV failed to load"));
        return;
      }

      if (cv.Mat) {
        resolve(cv);
        return;
      }

      cv.onRuntimeInitialized = () => resolve(cv);
    };
    script.onerror = () => reject(new Error("Failed to load OpenCV script"));

    document.body.appendChild(script);
  });

  return cvPromise;
}
