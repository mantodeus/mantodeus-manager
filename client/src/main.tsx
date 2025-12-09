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

const queryClient = new QueryClient();

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

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        const headers = new Headers(init?.headers || {});

        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.access_token) {
            headers.set("Authorization", `Bearer ${session.access_token}`);
          }
        } catch (error) {
          console.warn("[TRPC] Failed to get Supabase session for request:", error);
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
