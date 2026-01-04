import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { supabase } from "./lib/supabase";
import { initializeLogos } from "./lib/logo";
import "./index.css";
import "./theme-fixes.css";

// Don't auto-sync auth on state changes - let Login component handle it
// This prevents duplicate calls and race conditions

// =============================================================================
// PERFORMANCE FIX: QueryClient with proper caching
// =============================================================================
// Without staleTime, React Query refetches on every component mount
// This causes slow loading and excessive API calls
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 30 seconds - prevents refetching on every mount
      staleTime: 30 * 1000,
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Don't refetch on window focus (can be annoying)
      refetchOnWindowFocus: false,
      // Retry failed requests once with delay
      retry: 1,
      retryDelay: 1000,
    },
    mutations: {
      // Retry mutations once on network errors
      retry: 1,
      retryDelay: 1000,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Prevent redirect loops - don't redirect if we're already on login or just logged in
  const currentPath = window.location.pathname;
  if (currentPath === "/login" || currentPath.startsWith("/login")) {
    return;
  }

  // Add a small delay to prevent rapid redirects
  console.log("[Auth] Unauthorized error detected, redirecting to login...");
  setTimeout(() => {
    if (window.location.pathname !== "/login") {
      window.location.href = getLoginUrl();
    }
  }, 100);
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// =============================================================================
// PERFORMANCE FIX: Cache the access token to avoid async getSession() on every request
// =============================================================================
// The old code called supabase.auth.getSession() on EVERY tRPC request
// This is a slow async operation that blocks the request
// Instead, we cache the token and update it on auth state changes

// Initialize immediately to avoid "cannot access uninitialized variable" errors
let cachedAccessToken: string | null = null;

// Listen for auth state changes and cache the token
supabase.auth.onAuthStateChange(async (event, session) => {
  cachedAccessToken = session?.access_token ?? null;
  
  // On sign out, clear query cache to prevent stale data
  if (event === 'SIGNED_OUT') {
    queryClient.clear();
  }
  
  // On sign in or token refresh, ensure backend session cookie is set
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
    if (session?.access_token) {
      try {
        await fetch("/api/auth/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            access_token: session.access_token,
          }),
        });
      } catch (error) {
        console.warn("[Auth] Failed to sync backend session:", error);
      }
    }
    // Invalidate auth query to update user state
    queryClient.invalidateQueries({ queryKey: [['auth', 'me']] });
  }
});

// Initialize the cached token on startup and restore backend session
supabase.auth.getSession().then(async ({ data: { session } }) => {
  cachedAccessToken = session?.access_token ?? null;
  
  // If we have a Supabase session, ensure the backend session cookie is set
  if (session?.access_token) {
    try {
      await fetch("/api/auth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          access_token: session.access_token,
        }),
      });
    } catch (error) {
      console.warn("[Auth] Failed to restore backend session:", error);
    }
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      // Use synchronous fetch with cached token - no more async getSession() per request!
      fetch(input, init) {
        try {
          const headers = new Headers(init?.headers || {});

          // Use cached token - this is synchronous and fast
          // Safely access cachedAccessToken (it's initialized to null at module level)
          const token = cachedAccessToken;
          if (token) {
            headers.set("Authorization", `Bearer ${token}`);
          }

          return globalThis.fetch(input, {
            ...(init ?? {}),
            headers,
            credentials: "include",
          });
        } catch (error) {
          console.error("[tRPC Fetch] Error in fetch function:", error);
          // Fallback to basic fetch if there's an error
          return globalThis.fetch(input, init ?? {});
        }
      },
    }),
  ],
});

// Ensure DOM is ready before rendering
const initializeApp = () => {
  try {
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      throw new Error("Root element not found");
    }

    // Create root and render
    const root = createRoot(rootElement);
    root.render(
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </trpc.Provider>
    );
  } catch (error) {
    console.error("[App] Failed to initialize:", error);
    // Show user-friendly error message
    const rootElement = document.getElementById("root");
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; font-family: system-ui, -apple-system, sans-serif;">
          <div style="text-align: center; max-width: 600px;">
            <h1 style="font-size: 1.5rem; margin-bottom: 1rem; color: #ef4444;">Failed to Load App</h1>
            <p style="margin-bottom: 1rem; color: #6b7280;">An error occurred while initializing the application.</p>
            <pre style="background: #1f2937; color: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow: auto; margin-bottom: 1rem; text-align: left; font-size: 0.875rem;">${error instanceof Error ? error.message : String(error)}</pre>
            <button onclick="window.location.reload()" style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-size: 1rem;">Reload Page</button>
          </div>
        </div>
      `;
    }
  }
};

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    try {
      initializeApp();
      initializeLogos();
    } catch (error) {
      console.error("[App] Failed to initialize on DOMContentLoaded:", error);
    }
  });
} else {
  // DOM is already ready
  try {
    initializeApp();
    initializeLogos();
  } catch (error) {
    console.error("[App] Failed to initialize:", error);
  }
}

// Global error handlers to prevent blocking errors
if (typeof window !== "undefined") {
  // Catch unhandled errors and log them instead of blocking
  window.addEventListener("error", (event) => {
    console.error("[Global Error Handler]", event.error || event.message);
    // Prevent default error handling that might block the UI
    event.preventDefault();
  });

  // Catch unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[Unhandled Promise Rejection]", event.reason);
    // Prevent default error handling
    event.preventDefault();
  });
}

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}
