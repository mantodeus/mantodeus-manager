/**
 * Image Storage Utilities
 * 
 * Stores image blobs in IndexedDB for offline persistence.
 * Used for inspection media (original and annotated images).
 */

const DB_NAME = "mantodeus-images";
const DB_VERSION = 1;
const STORE_NAME = "images";

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Store an image blob and return a local path/key
 */
export async function storeImageBlob(blob: Blob): Promise<string> {
  const key = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    if (typeof indexedDB !== "undefined") {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.put(blob, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return key;
    }
  } catch (error) {
    console.warn("[ImageStorage] IndexedDB failed, falling back to object URL:", error);
  }

  // Fallback: create object URL (less persistent but works)
  const url = URL.createObjectURL(blob);
  return url;
}

/**
 * Retrieve an image blob by key
 */
export async function getImageBlob(key: string): Promise<Blob | null> {
  try {
    if (typeof indexedDB !== "undefined") {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? (result as Blob) : null);
        };
        request.onerror = () => reject(request.error);
      });
    }
  } catch (error) {
    console.warn("[ImageStorage] IndexedDB failed:", error);
  }

  // Fallback: if key is an object URL, try to fetch it
  if (key.startsWith("blob:") || key.startsWith("http")) {
    try {
      const response = await fetch(key);
      return await response.blob();
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Get object URL for an image (for display)
 */
export async function getImageUrl(key: string): Promise<string | null> {
  const blob = await getImageBlob(key);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

/**
 * Delete an image by key
 */
export async function deleteImage(key: string): Promise<void> {
  try {
    if (typeof indexedDB !== "undefined" && key.startsWith("img_")) {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } else if (key.startsWith("blob:")) {
      // Revoke object URL
      URL.revokeObjectURL(key);
    }
  } catch (error) {
    console.warn("[ImageStorage] Failed to delete image:", error);
  }
}

