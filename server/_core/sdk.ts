/**
 * Legacy Manus SDK stub
 * 
 * This file is kept for compatibility but is not actively used.
 * Authentication is now handled by Supabase via oauth.ts
 * 
 * If you need Manus SDK features in the future, restore from git history.
 */

// Empty export to prevent import errors
export const sdk = {
  // Placeholder - not implemented
};

export type SessionPayload = {
  supabaseId: string;
  name: string;
};
