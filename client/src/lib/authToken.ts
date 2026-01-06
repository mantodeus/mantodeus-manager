export const AUTH_TOKEN_STORAGE_KEY = "mantodeus-access-token";

let inMemoryToken: string | null = null;

export function getAuthToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window === "undefined") return null;

  try {
    const stored = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (stored) {
      inMemoryToken = stored;
      return stored;
    }
  } catch {
    // Ignore storage access errors (e.g. blocked in embedded browsers)
  }

  return null;
}

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
  if (typeof window === "undefined") return;

  try {
    if (token) {
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors (e.g. blocked in embedded browsers)
  }
}
