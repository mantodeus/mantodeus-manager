export const AUTH_TOKEN_STORAGE_KEY = "mantodeus-access-token";

let inMemoryToken: string | null = null;

function readFromStorage(storage: Storage): string | null {
  try {
    return storage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window === "undefined") return null;

  const localToken = readFromStorage(window.localStorage);
  if (localToken) {
    inMemoryToken = localToken;
    return localToken;
  }

  const sessionToken = readFromStorage(window.sessionStorage);
  if (sessionToken) {
    inMemoryToken = sessionToken;
    return sessionToken;
  }

  return null;
}

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
  if (typeof window === "undefined") return;

  try {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors (e.g. blocked in embedded browsers)
  }

  try {
    if (token) {
      window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors (e.g. blocked in embedded browsers)
  }
}