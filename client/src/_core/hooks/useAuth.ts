import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UNAUTHED_ERR_MSG } from "@shared/const";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();
  
  // Track if we should stop showing loading after timeout
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    // Retry once on initial load to handle race condition with session restoration
    retry: (failureCount, error) => {
      // Only retry once, and only if it's an auth error (might be session not ready yet)
      if (failureCount >= 1) return false;
      // Retry if it's an unauthorized error (session might not be restored yet)
      if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) {
        return true;
      }
      return false;
    },
    retryDelay: 1000, // Wait 1 second before retry to allow session restoration
    refetchOnWindowFocus: false,
    // User info rarely changes - keep it fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
    networkMode: "online",
  });

  // Set a timeout to stop showing loading after 8 seconds
  // This prevents infinite loading screen if the server isn't responding
  useEffect(() => {
    if (meQuery.isLoading && !loadingTimeout) {
      const timer = setTimeout(() => {
        console.warn("[Auth] Query taking too long, stopping loading state");
        setLoadingTimeout(true);
      }, 8000); // 8 second timeout

      return () => clearTimeout(timer);
    } else if (!meQuery.isLoading) {
      // Reset timeout flag when query completes
      setLoadingTimeout(false);
    }
  }, [meQuery.isLoading, loadingTimeout]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      // Sign out from Supabase
      await supabase.auth.signOut();
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      // Sign out from Supabase first
      await supabase.auth.signOut();
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    // Stop showing loading if timeout is reached, even if query is still pending
    const isLoading = (meQuery.isLoading && !loadingTimeout) || logoutMutation.isPending;
    
    return {
      user: meQuery.data ?? null,
      loading: isLoading,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
    loadingTimeout,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
