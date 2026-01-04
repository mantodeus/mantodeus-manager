// =============================================================================
// CRITICAL: Set up global error handlers FIRST before any other code
// =============================================================================
// This catches errors during module evaluation and prevents blocking errors
if (typeof window !== "undefined") {
  // Hide Vite error overlay if it exists (it can block the UI)
  const hideViteErrorOverlay = () => {
    const overlay = document.querySelector('vite-error-overlay');
    if (overlay) {
      (overlay as any).close?.();
      overlay.remove();
    }
    // Also check for other common error overlay selectors
    const errorOverlays = document.querySelectorAll('[data-vite-error-overlay], .vite-error-overlay');
    errorOverlays.forEach(el => el.remove());
  };

  // Try to hide immediately
  hideViteErrorOverlay();
  
  // Watch for error overlays being added
  const observer = new MutationObserver(() => {
    hideViteErrorOverlay();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Catch unhandled errors and log them instead of blocking
  window.addEventListener("error", (event) => {
    console.error("[Global Error Handler]", event.error || event.message, event.filename, event.lineno);
    hideViteErrorOverlay();
    // Don't prevent default - let it be handled by ErrorBoundary if possible
    // But log it so we can debug
  }, true); // Use capture phase to catch earlier

  // Catch unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[Unhandled Promise Rejection]", event.reason);
    hideViteErrorOverlay();
    // Prevent default error handling that might block
    event.preventDefault();
  }, true); // Use capture phase
}

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
  
  // On sign in, token refresh, or initial session restore, ensure backend session cookie is set
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
    if (session?.access_token) {
      try {
        const response = await fetch("/api/auth/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            access_token: session.access_token,
          }),
        });
        if (!response.ok) {
          console.warn("[Auth] Failed to sync backend session:", response.statusText);
        }
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    
    // Show user-friendly error message with dismiss option
    const rootElement = document.getElementById("root");
    if (rootElement) {
      // Escape HTML to prevent XSS
      const escapeHtml = (text: string) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };
      
      rootElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #f3f4f6;">
          <div style="text-align: center; max-width: 600px; background: #1a1a1a; padding: 2rem; border-radius: 0.5rem; border: 1px solid #333;">
            <h1 style="font-size: 1.5rem; margin-bottom: 1rem; color: #ef4444;">Failed to Load App</h1>
            <p style="margin-bottom: 1rem; color: #9ca3af;">An error occurred while initializing the application.</p>
            <div style="background: #111; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; text-align: left; font-size: 0.875rem; max-height: 200px; overflow: auto;">
              <div style="color: #ef4444; margin-bottom: 0.5rem; font-weight: 600;">Error:</div>
              <pre style="color: #f3f4f6; white-space: pre-wrap; word-break: break-word; margin: 0;">${escapeHtml(errorMessage)}</pre>
              ${errorStack ? `<pre style="color: #6b7280; white-space: pre-wrap; word-break: break-word; margin-top: 0.5rem; margin-bottom: 0; font-size: 0.75rem;">${escapeHtml(errorStack)}</pre>` : ''}
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
              <button onclick="this.parentElement.parentElement.parentElement.innerHTML=''; window.location.reload();" style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-size: 1rem; font-weight: 500;">Reload Page</button>
              <button onclick="this.parentElement.parentElement.parentElement.innerHTML='<div style=\\'display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #f3f4f6;\\'><div style=\\'text-align: center; max-width: 600px;\\'><h1 style=\\'font-size: 1.5rem; margin-bottom: 1rem; color: #ef4444;\\'>App Dismissed</h1><p style=\\'margin-bottom: 1rem; color: #9ca3af;\\'>The error has been dismissed. Please check the browser console for details.</p><button onclick=\\'window.location.reload()\\' style=\\'background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-size: 1rem;\\'>Reload Page</button></div></div>';" style="background: #4b5563; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-size: 1rem;">Dismiss</button>
            </div>
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

// Additional error handlers (redundant but safe)
// The main handlers are at the top of the file to catch module-level errors

// Service Worker registration with aggressive update handling and recovery mechanism
if ('serviceWorker' in navigator) {
  // Recovery function: unregister service worker and clear all caches
  const emergencyRecovery = async () => {
    console.warn('[SW] Emergency recovery: Unregistering service worker and clearing caches');
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('[SW] All service workers unregistered');
      
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[SW] All caches cleared');
      
      // Reload to get fresh content
      window.location.reload();
    } catch (err) {
      console.error('[SW] Recovery failed:', err);
    }
  };

  // Health check: DISABLED - was causing false positives and refresh loops
  // Only use emergency recovery manually if needed

  // Register service worker with cache-busting
  let isReloading = false; // Prevent multiple reloads
  let lastSWVersion: string | null = null;
  
  const registerSW = () => {
    // Add version and timestamp to force fresh fetch of service worker file
    const swUrl = `/sw.js?v=3.2.0&t=${Date.now()}`;
    
    navigator.serviceWorker.register(swUrl, { 
      updateViaCache: 'none', // Never use cache when checking for updates
      scope: '/' 
    })
      .then((registration) => {
        console.log('[SW] Service Worker registered:', registration.scope);
        
        // Get current service worker version if available
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' });
        }
        
        // Listen for updates - but don't auto-reload, just log
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller && !isReloading) {
                  // New service worker available, but don't auto-reload
                  // Let user continue working, they can reload manually if needed
                  console.log('[SW] New service worker available (will activate on next page load)');
                  // DON'T auto-reload - this was causing the refresh loop
                } else {
                  // First install, no reload needed
                  console.log('[SW] Service worker installed for the first time');
                }
              }
            });
          }
        });
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'FORCE_RELOAD' && !isReloading) {
            console.log('[SW] Force reload requested, version:', event.data.version);
            isReloading = true;
            // Only reload if we're not already reloading
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
          
          if (event.data && event.data.version) {
            lastSWVersion = event.data.version;
          }
        });
        
        // Check for updates periodically (every 10 minutes, not 5)
        setInterval(() => {
          if (!isReloading) {
            registration.update();
          }
        }, 10 * 60 * 1000);
        
        // Check for updates when page becomes visible (user returns to app)
        // But only if we're not already reloading
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden && !isReloading) {
            registration.update();
          }
        });
      })
      .catch((error) => {
        console.error('[SW] Service Worker registration failed:', error);
        // If service worker fails, clear all caches to prevent stale content
        caches.keys().then((cacheNames) => {
          return Promise.all(cacheNames.map((name) => caches.delete(name)));
        });
      });
  };

  // Delay service worker registration until after app loads
  // This prevents the service worker from blocking the initial app load
  const delayedSWRegistration = () => {
    // Wait for app to be fully loaded before registering service worker
    // Increased delay to 5 seconds to ensure app is fully initialized
    if (document.readyState === 'complete') {
      // App already loaded, wait a bit more to ensure React has mounted
      setTimeout(() => {
        initializeServiceWorker();
      }, 5000);
    } else {
      window.addEventListener('load', () => {
        // Wait 5 seconds after page load to ensure app is fully initialized
        setTimeout(() => {
          initializeServiceWorker();
        }, 5000);
      });
    }
  };

  const initializeServiceWorker = () => {
    // Don't unregister existing service workers on every load - this was causing issues
    // Only register if not already registered, or let the update mechanism handle it
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length === 0) {
        // No service worker registered, register fresh
        console.log('[SW] No existing service worker, registering...');
        registerSW();
      } else {
        // Service worker already exists, just check for updates
        console.log(`[SW] Found ${registrations.length} existing service worker(s), checking for updates...`);
        registrations.forEach(reg => {
          reg.update();
        });
      }
    }).catch((error) => {
      console.error('[SW] Registration check failed, attempting registration:', error);
      registerSW();
    });
  };

  // Start delayed registration
  delayedSWRegistration();
}
