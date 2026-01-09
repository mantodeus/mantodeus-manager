/**
 * Mistral AI Client
 * 
 * Simple HTTPS fetch-based client for Mistral chat completions.
 * No SDK lock-in. Returns assistant text only.
 */

import { ENV } from "../../_core/env";

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

export interface MistralMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface MistralChatOptions {
  model: string;
  messages: MistralMessage[];
  temperature?: number;
  maxTokens?: number;
}

export class MistralClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly providerError?: unknown
  ) {
    super(message);
    this.name = "MistralClientError";
  }
}

/**
 * Call Mistral chat completions API
 * 
 * @throws {MistralClientError} On API errors or timeout
 */
export async function callMistralChat(
  options: MistralChatOptions
): Promise<string> {
  const apiKey = ENV.mistralApiKey;
  if (!apiKey) {
    throw new MistralClientError("MISTRAL_API_KEY not configured");
  }

  const timeoutMs = ENV.aiAssistantTimeoutMs;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `Mistral API error: ${response.status} ${response.statusText}`;
      try {
        const parsed = JSON.parse(errorBody);
        errorMessage = parsed.error?.message || errorMessage;
      } catch {
        // Use default error message
      }
      throw new MistralClientError(
        errorMessage,
        response.status,
        errorBody
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage || typeof assistantMessage !== "string") {
      throw new MistralClientError(
        "Invalid response format from Mistral API",
        response.status,
        data
      );
    }

    return assistantMessage;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof MistralClientError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new MistralClientError(
        `Request timeout after ${timeoutMs}ms`,
        408,
        error
      );
    }

    throw new MistralClientError(
      error instanceof Error ? error.message : "Unknown error",
      undefined,
      error
    );
  }
}
