import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { supabase } from "./lib/supabase";
import "./index.css";

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

let cachedAccessToken: string | null = null;

// Listen for auth state changes and cache the token
supabase.auth.onAuthStateChange((event, session) => {
  cachedAccessToken = session?.access_token ?? null;
  
  // On sign out, clear query cache to prevent stale data
  if (event === 'SIGNED_OUT') {
    queryClient.clear();
  }
  
  // On sign in, invalidate auth query to update user state
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    queryClient.invalidateQueries({ queryKey: [['auth', 'me']] });
  }
});

// Initialize the cached token on startup (async, but only once)
supabase.auth.getSession().then(({ data: { session } }) => {
  cachedAccessToken = session?.access_token ?? null;
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      // Use synchronous fetch with cached token - no more async getSession() per request!
      fetch(input, init) {
        const headers = new Headers(init?.headers || {});

        // Use cached token - this is synchronous and fast
        if (cachedAccessToken) {
          headers.set("Authorization", `Bearer ${cachedAccessToken}`);
        }

        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
      },
    }),
  ],
});

// Ensure DOM is ready before rendering
const initializeApp = () => {
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
};

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  // DOM is already ready
  initializeApp();
}

// Service Worker - only in production, simplified for development
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    // Production: register service worker
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    });
  } else {
    // Development: just unregister, no page reload
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach(r => r.unregister());
    });
  }
}
