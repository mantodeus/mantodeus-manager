export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "Mantodeus Manager";

export const APP_LOGO = "/mantodeus-logo.png";

// Return login page URL for Supabase authentication
export const getLoginUrl = () => {
  return "/login";
};
