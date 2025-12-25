/**
 * Offline Storage Utilities
 * 
 * Provides local-first persistence for inspection data.
 * Uses IndexedDB when available, falls back to localStorage.
 * 
 * All operations are synchronous for immediate writes.
 */

const DB_NAME = "mantodeus-inspections";
const DB_VERSION = 1;
const STORE_NAMES = {
  inspections: "inspections",
  units: "units",
  findings: "findings",
  media: "media",
} as const;

type StoreName = typeof STORE_NAMES[keyof typeof STORE_NAMES];

interface StoredEntity {
  id?: number;
  localId?: string;
  syncStatus?: "pending" | "syncing" | "synced" | "error";
  [key: string]: unknown;
}

// =============================================================================
// INDEXEDDB SETUP
// =============================================================================

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

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORE_NAMES.inspections)) {
        const inspectionStore = db.createObjectStore(STORE_NAMES.inspections, { keyPath: "localId", autoIncrement: false });
        inspectionStore.createIndex("projectId", "projectId", { unique: false });
        inspectionStore.createIndex("id", "id", { unique: true });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.units)) {
        const unitStore = db.createObjectStore(STORE_NAMES.units, { keyPath: "localId", autoIncrement: false });
        unitStore.createIndex("inspectionId", "inspectionId", { unique: false });
        unitStore.createIndex("id", "id", { unique: true });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.findings)) {
        const findingStore = db.createObjectStore(STORE_NAMES.findings, { keyPath: "localId", autoIncrement: false });
        findingStore.createIndex("inspectionUnitId", "inspectionUnitId", { unique: false });
        findingStore.createIndex("id", "id", { unique: true });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.media)) {
        const mediaStore = db.createObjectStore(STORE_NAMES.media, { keyPath: "localId", autoIncrement: false });
        mediaStore.createIndex("inspectionFindingId", "inspectionFindingId", { unique: false });
        mediaStore.createIndex("id", "id", { unique: true });
      }
    };
  });
}

// =============================================================================
// GENERIC STORAGE OPERATIONS
// =============================================================================

function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function saveToLocal<T extends StoredEntity>(
  storeName: StoreName,
  entity: T
): Promise<T & { localId: string }> {
  // Ensure localId exists
  const entityWithLocalId = {
    ...entity,
    localId: entity.localId || generateLocalId(),
    syncStatus: entity.syncStatus || "pending",
  };

  try {
    // Try IndexedDB first
    if (typeof indexedDB !== "undefined") {
      const db = await openDB();
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.put(entityWithLocalId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return entityWithLocalId;
    }
  } catch (error) {
    console.warn("[OfflineStorage] IndexedDB failed, falling back to localStorage:", error);
  }

  // Fallback to localStorage
  const key = `${DB_NAME}_${storeName}_${entityWithLocalId.localId}`;
  localStorage.setItem(key, JSON.stringify(entityWithLocalId));
  return entityWithLocalId;
}

export async function getFromLocal<T extends StoredEntity>(
  storeName: StoreName,
  localId: string
): Promise<T | null> {
  try {
    if (typeof indexedDB !== "undefined") {
      const db = await openDB();
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.get(localId);
        request.onsuccess = () => resolve((request.result as T) || null);
        request.onerror = () => reject(request.error);
      });
    }
  } catch (error) {
    console.warn("[OfflineStorage] IndexedDB failed, falling back to localStorage:", error);
  }

  // Fallback to localStorage
  const key = `${DB_NAME}_${storeName}_${localId}`;
  const item = localStorage.getItem(key);
  return item ? (JSON.parse(item) as T) : null;
}

export async function getAllFromLocal<T extends StoredEntity>(
  storeName: StoreName,
  indexName?: string,
  indexValue?: unknown
): Promise<T[]> {
  try {
    if (typeof indexedDB !== "undefined") {
      const db = await openDB();
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        let request: IDBRequest;

        if (indexName && indexValue !== undefined && indexValue !== null) {
          const index = store.index(indexName);
          request = index.getAll(indexValue as IDBValidKey);
        } else {
          request = store.getAll();
        }

        request.onsuccess = () => resolve((request.result as T[]) || []);
        request.onerror = () => reject(request.error);
      });
    }
  } catch (error) {
    console.warn("[OfflineStorage] IndexedDB failed, falling back to localStorage:", error);
  }

  // Fallback to localStorage - scan all keys
  const results: T[] = [];
  const prefix = `${DB_NAME}_${storeName}_`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const item = localStorage.getItem(key);
      if (item) {
        const entity = JSON.parse(item) as T;
        if (!indexName || entity[indexName] === indexValue) {
          results.push(entity);
        }
      }
    }
  }
  return results;
}

export async function deleteFromLocal(storeName: StoreName, localId: string): Promise<void> {
  try {
    if (typeof indexedDB !== "undefined") {
      const db = await openDB();
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(localId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      return;
    }
  } catch (error) {
    console.warn("[OfflineStorage] IndexedDB failed, falling back to localStorage:", error);
  }

  // Fallback to localStorage
  const key = `${DB_NAME}_${storeName}_${localId}`;
  localStorage.removeItem(key);
}

// =============================================================================
// INSPECTION-SPECIFIC HELPERS
// =============================================================================

export const inspectionStorage = {
  save: (entity: StoredEntity) => saveToLocal(STORE_NAMES.inspections, entity),
  get: (localId: string) => getFromLocal(STORE_NAMES.inspections, localId),
  getAll: (projectId?: number) => {
    if (projectId !== undefined) {
      return getAllFromLocal(STORE_NAMES.inspections, "projectId", projectId);
    }
    return getAllFromLocal(STORE_NAMES.inspections);
  },
  delete: (localId: string) => deleteFromLocal(STORE_NAMES.inspections, localId),
};

export const unitStorage = {
  save: (entity: StoredEntity) => saveToLocal(STORE_NAMES.units, entity),
  get: (localId: string) => getFromLocal(STORE_NAMES.units, localId),
  getAll: (inspectionId?: number) => {
    if (inspectionId !== undefined) {
      return getAllFromLocal(STORE_NAMES.units, "inspectionId", inspectionId);
    }
    return getAllFromLocal(STORE_NAMES.units);
  },
  delete: (localId: string) => deleteFromLocal(STORE_NAMES.units, localId),
};

export const findingStorage = {
  save: (entity: StoredEntity) => saveToLocal(STORE_NAMES.findings, entity),
  get: (localId: string) => getFromLocal(STORE_NAMES.findings, localId),
  getAll: (unitId?: number) => {
    if (unitId !== undefined) {
      return getAllFromLocal(STORE_NAMES.findings, "inspectionUnitId", unitId).then(findings =>
        findings.filter(f => !f.deletedAt)
      );
    }
    return getAllFromLocal(STORE_NAMES.findings).then(findings =>
      findings.filter(f => !f.deletedAt)
    );
  },
  delete: (localId: string) => deleteFromLocal(STORE_NAMES.findings, localId),
};

export const mediaStorage = {
  save: (entity: StoredEntity) => saveToLocal(STORE_NAMES.media, entity),
  get: (localId: string) => getFromLocal(STORE_NAMES.media, localId),
  getAll: async (findingId?: number | string) => {
    let media: StoredEntity[];
    if (findingId !== undefined) {
      media = await getAllFromLocal(STORE_NAMES.media, "inspectionFindingId", findingId);
    } else {
      media = await getAllFromLocal(STORE_NAMES.media);
    }
    return media.filter(m => !m.deletedAt);
  },
  delete: (localId: string) => deleteFromLocal(STORE_NAMES.media, localId),
};

