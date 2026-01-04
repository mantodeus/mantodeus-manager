/**
 * Auth Cache Utilities
 * 
 * Functions to clear authentication-related cache and storage
 * to fix login issues on browsers with stale data.
 */

import { supabase } from "./supabase";

/**
 * Clears all authentication-related cache and storage
 * This includes:
 * - Supabase auth session in localStorage
 * - Session cookies
 * - React Query cache
 * - Any other auth-related storage
 */
export async function clearAuthCache() {
  try {
    // 1. Sign out from Supabase (clears Supabase session)
    await supabase.auth.signOut();
    
    // 2. Clear Supabase storage key from localStorage
    const supabaseStorageKey = "mantodeus-supabase-auth";
    if (typeof window !== "undefined") {
      localStorage.removeItem(supabaseStorageKey);
      
      // Also try to clear any other Supabase-related keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes("supabase") || key.includes("auth"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear sessionStorage as well
      sessionStorage.clear();
    }
    
    // 3. Clear cookies manually (for browsers that support it)
    if (typeof document !== "undefined") {
      // Clear the session cookie (known cookie name from backend)
      const sessionCookieName = "app_session_id";
      
      // Clear with various path and domain combinations to ensure it's removed
      const hostname = window.location.hostname;
      const domain = hostname.includes(".") ? `.${hostname.split(".").slice(-2).join(".")}` : hostname;
      
      const cookieOptions = [
        `${sessionCookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`,
        `${sessionCookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${domain}`,
        `${sessionCookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${hostname}`,
      ];
      
      cookieOptions.forEach(opt => {
        document.cookie = opt;
      });
      
      // Also clear any other auth-related cookies
      document.cookie.split(";").forEach((cookie) => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        // Clear any cookie that might be auth-related
        if (name.includes("session") || name.includes("auth") || name.includes("token")) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${domain}`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${hostname}`;
        }
      });
    }
    
    console.log("[Auth Cache] Auth cache cleared successfully");
    return true;
  } catch (error) {
    console.error("[Auth Cache] Error clearing auth cache:", error);
    return false;
  }
}

/**
 * Checks if there's any stale auth data that might interfere with login
 */
export function hasStaleAuthData(): boolean {
  if (typeof window === "undefined") return false;
  
  // Check for Supabase auth data
  const supabaseStorageKey = "mantodeus-supabase-auth";
  const hasSupabaseData = localStorage.getItem(supabaseStorageKey) !== null;
  
  // Check for any auth-related cookies
  const hasAuthCookies = document.cookie.split(";").some((cookie) => {
    const name = cookie.split("=")[0].trim();
    return name.includes("session") || name.includes("auth") || name.includes("token");
  });
  
  return hasSupabaseData || hasAuthCookies;
}

