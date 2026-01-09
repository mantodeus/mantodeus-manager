/**
 * Client Matching Service
 * 
 * Matches extracted client names to existing contacts using fuzzy matching.
 * Never auto-locks client - only preselects if confidence is high enough.
 */

import * as db from "../../../db";

/**
 * Normalize string for matching
 * - lowercase
 * - strip legal suffixes (GmbH, UG, Ltd, Inc, etc.)
 * - trim punctuation
 */
function normalizeForMatching(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(gmbh|ug|haftungsbeschränkt|limited|ltd|inc|corp|corporation|llc)\b/gi, "")
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeForMatching(str1);
  const normalized2 = normalizeForMatching(str2);

  if (normalized1 === normalized2) return 1.0;

  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  
  if (maxLength === 0) return 1.0;
  
  return 1 - distance / maxLength;
}

/**
 * Client match result
 */
export interface ClientMatchResult {
  matchedClientId: number | null;
  matchConfidence: number;
  matchedName: string | null;
}

/**
 * Match extracted client name to existing contacts
 * 
 * @param extractedClientName - Client name extracted from document
 * @param userId - User ID to filter contacts
 * @param confidenceThreshold - Minimum confidence to preselect (default 0.85)
 * @returns Match result with client ID and confidence
 */
export async function matchClient(
  extractedClientName: string | null,
  userId: number,
  confidenceThreshold: number = 0.85
): Promise<ClientMatchResult> {
  if (!extractedClientName || extractedClientName.trim().length === 0) {
    return {
      matchedClientId: null,
      matchConfidence: 0,
      matchedName: null,
    };
  }

  // Get all contacts for user
  const contacts = await db.getAllContacts(userId);
  
  if (contacts.length === 0) {
    return {
      matchedClientId: null,
      matchConfidence: 0,
      matchedName: null,
    };
  }

  // Normalize extracted name
  const normalizedExtracted = normalizeForMatching(extractedClientName);

  // Find best match
  let bestMatch: {
    contactId: number;
    name: string;
    similarity: number;
  } | null = null;

  for (const contact of contacts) {
    // Try matching against name and clientName
    const namesToCheck = [
      contact.name,
      contact.clientName,
    ].filter((n): n is string => typeof n === "string" && n.length > 0);

    for (const contactName of namesToCheck) {
      const similarity = calculateSimilarity(normalizedExtracted, contactName);
      
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = {
          contactId: contact.id,
          name: contactName,
          similarity,
        };
      }
    }
  }

  if (!bestMatch || bestMatch.similarity < confidenceThreshold) {
    return {
      matchedClientId: null,
      matchConfidence: bestMatch?.similarity ?? 0,
      matchedName: bestMatch?.name ?? null,
    };
  }

  return {
    matchedClientId: bestMatch.contactId,
    matchConfidence: bestMatch.similarity,
    matchedName: bestMatch.name,
  };
}
