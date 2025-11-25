export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "Mantodeus Manager";

export const APP_LOGO = "/mantodeus-logo.png";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL || "https://portal.manus.im";
  const appId = import.meta.env.VITE_APP_ID || "";
  
  // Validate OAuth configuration
  if (!oauthPortalUrl) {
    console.error("VITE_OAUTH_PORTAL_URL is not configured");
    throw new Error("OAuth configuration is missing. Please set VITE_OAUTH_PORTAL_URL environment variable.");
  }
  
  if (!appId) {
    console.error("VITE_APP_ID is not configured");
    throw new Error("OAuth configuration is missing. Please set VITE_APP_ID environment variable.");
  }
  
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  try {
    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch (error) {
    console.error("Failed to construct OAuth URL:", error);
    console.error("VITE_OAUTH_PORTAL_URL:", oauthPortalUrl);
    console.error("VITE_APP_ID:", appId);
    throw new Error(`Invalid OAuth configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
};
