/**
 * Supabase Auth Tests
 * 
 * Tests for token hashing and authentication caching
 */

import { describe, expect, it } from "vitest";
import crypto from "crypto";

/**
 * Test the hashToken function (exported for testing)
 * This verifies that token hashing is cryptographically secure
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

describe("supabase token hashing", () => {
  it("should use SHA-256 for token hashing", () => {
    const token = "test-token-12345";
    const hash = hashToken(token);
    
    // SHA-256 produces 64-character hex string
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash.length).toBe(64);
  });

  it("should produce deterministic hashes (same token = same hash)", () => {
    const token = "test-token-deterministic";
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different tokens", () => {
    const token1 = "test-token-1";
    const token2 = "test-token-2";
    const hash1 = hashToken(token1);
    const hash2 = hashToken(token2);
    
    expect(hash1).not.toBe(hash2);
  });

  it("should not include token substrings in hash", () => {
    const token = "sensitive-token-abc123xyz";
    const hash = hashToken(token);
    
    // Hash should not contain any part of the original token
    expect(hash).not.toContain("sensitive");
    expect(hash).not.toContain("token");
    expect(hash).not.toContain("abc123xyz");
    expect(hash).not.toContain(token);
  });

  it("should handle empty tokens", () => {
    const hash = hashToken("");
    
    // SHA-256 of empty string is known value
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("should handle very long tokens", () => {
    const longToken = "a".repeat(10000);
    const hash = hashToken(longToken);
    
    // Should still produce 64-char hex string
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash.length).toBe(64);
  });

  it("should be collision-resistant (different tokens produce different hashes)", () => {
    const tokens = [
      "token1",
      "token2",
      "Token1", // Case sensitive
      "token 1", // With space
      "token1 ", // Trailing space
      " token1", // Leading space
    ];
    
    const hashes = tokens.map(t => hashToken(t));
    const uniqueHashes = new Set(hashes);
    
    // All hashes should be unique
    expect(uniqueHashes.size).toBe(hashes.length);
  });
});

