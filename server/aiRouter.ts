/**
 * AI Assistant Router
 * 
 * AI-powered assistant using Mistral API.
 * Supports invoice-specific and general questions.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import * as db from "./db";
import { callMistralChat, MistralClientError } from "./services/ai/mistralClient";
import { ASSISTANT_V1_SYSTEM_PROMPT, GENERAL_ASSISTANT_SYSTEM_PROMPT } from "./services/ai/prompts/assistant_v1";
import { buildInvoiceContext } from "./services/ai/buildInvoiceContext";

// Simple in-memory rate limiting (per user, per minute)
const rateLimitMap = new Map<number, number[]>();
const RATE_LIMIT_REQUESTS = 10; // Max requests per minute
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(userId: number): void {
  const now = Date.now();
  const requests = rateLimitMap.get(userId) || [];
  
  // Remove requests outside the window
  const recentRequests = requests.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  
  if (recentRequests.length >= RATE_LIMIT_REQUESTS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Please wait a moment before asking again.",
    });
  }
  
  // Add current request
  recentRequests.push(now);
  rateLimitMap.set(userId, recentRequests);
}

/**
 * Get allowed actions for an invoice (server-side computation)
 * Maps to action IDs that the assistant can suggest
 */
function getAllowedActions(invoice: Awaited<ReturnType<typeof db.getInvoiceById>>): string[] {
  if (!invoice) return [];
  
  const actions: string[] = [];
  const needsReview = invoice.needsReview;
  const sentAt = invoice.sentAt;
  const paidAt = invoice.paidAt;
  const amountPaid = Number(invoice.amountPaid || 0);
  const isCancelled = invoice.cancelledAt !== null;
  
  // Determine state
  const isReview = needsReview;
  const isDraft = !sentAt;
  const isSent = sentAt && !paidAt && amountPaid === 0;
  const isPartial = sentAt && !paidAt && amountPaid > 0;
  const isPaid = !!paidAt;
  
  // Map to assistant-suggestable actions
  if (isDraft || isReview) {
    if (!isCancelled) {
      // Can send (which opens share dialog)
      actions.push("OPEN_SHARE");
      // Can add payment (for uploaded invoices)
      if (invoice.source === "uploaded" && !sentAt) {
        actions.push("OPEN_ADD_PAYMENT");
      }
    }
  }
  
  if (isSent || isPartial) {
    // Can add payment
    actions.push("OPEN_ADD_PAYMENT");
    // Can edit due date
    actions.push("OPEN_EDIT_DUE_DATE");
    // Can revert status (if no payments)
    if (amountPaid === 0) {
      actions.push("OPEN_REVERT_STATUS");
    }
  }
  
  if (isPaid) {
    // Can revert status
    actions.push("OPEN_REVERT_STATUS");
  }
  
  return actions;
}

/**
 * Parse assistant response - tries JSON first, falls back to plain text
 */
function parseAssistantResponse(text: string): {
  answerMarkdown: string;
  confidence: "low" | "medium" | "high";
  suggestedNextActions: Array<{
    id: string;
    label: string;
    action: "OPEN_SHARE" | "OPEN_ADD_PAYMENT" | "OPEN_EDIT_DUE_DATE" | "OPEN_REVERT_STATUS";
  }>;
} {
  console.log("[AI] Parsing response, length:", text?.length, "preview:", text?.substring(0, 200));
  
  // If empty response, return fallback
  if (!text || text.trim().length === 0) {
    console.error("[AI] Empty response from Mistral");
    return {
      answerMarkdown: "I received an empty response. Please try again.",
      confidence: "low",
      suggestedNextActions: [],
    };
  }
  
  try {
    // Try to extract JSON from text (in case there's extra text around it)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonText = jsonMatch[0];
      const parsed = JSON.parse(jsonText);
      
      // Check if it has the expected structure
      if (typeof parsed.answerMarkdown === "string") {
        console.log("[AI] Successfully parsed JSON response");
        return {
          answerMarkdown: parsed.answerMarkdown,
          confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "medium",
          suggestedNextActions: Array.isArray(parsed.suggestedNextActions) 
            ? parsed.suggestedNextActions.filter((a: unknown) => 
                a && typeof a === "object" && "action" in a && "label" in a
              )
            : [],
        };
      }
    }
  } catch (error) {
    console.log("[AI] JSON parse failed, using plain text fallback");
  }
  
  // Fallback: treat the entire response as plain markdown text
  // This handles cases where the model doesn't return JSON
  console.log("[AI] Using plain text response");
  return {
    answerMarkdown: text.trim(),
    confidence: "medium",
    suggestedNextActions: [],
  };
}

export const aiRouter = router({
  ask: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["invoice_detail", "general"]),
        scopeId: z.number().optional(),
        message: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if AI assistant is enabled
      if (!ENV.aiAssistantEnabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "AI Assistant is disabled",
        });
      }
      
      // Check rate limit
      checkRateLimit(ctx.user.id);
      
      // Handle invoice_detail scope
      if (input.scope === "invoice_detail") {
        if (!input.scopeId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "scopeId is required for invoice_detail scope",
          });
        }
        
        const invoice = await db.getInvoiceById(input.scopeId);
        if (!invoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invoice not found",
          });
        }
        if (invoice.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this invoice",
          });
        }
        
        // Build context
        const allowedActions = getAllowedActions(invoice);
        const context = buildInvoiceContext(invoice, allowedActions);
        
        // Build prompt
        const userMessage = `Invoice Context:
${JSON.stringify(context, null, 2)}

User Question: ${input.message}

Please explain the invoice state, any blockers, and suggest valid next steps based on the allowedActions list.`;

        try {
          console.log("[AI] Calling Mistral for invoice_detail, model:", ENV.aiAssistantModel);
          
          // Call Mistral
          const response = await callMistralChat({
            model: ENV.aiAssistantModel,
            messages: [
              { role: "system", content: ASSISTANT_V1_SYSTEM_PROMPT },
              { role: "user", content: userMessage },
            ],
            temperature: 0.7,
            maxTokens: 2000,
          });
          
          console.log("[AI] Mistral response received, parsing...");
          
          // Parse and validate response
          const parsed = parseAssistantResponse(response);
          
          return parsed;
        } catch (error) {
          if (error instanceof MistralClientError) {
            console.error("[AI] Mistral client error:", error.message, "statusCode:", error.statusCode, "details:", error.providerError);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "AI service temporarily unavailable. Please try again later.",
            });
          }
          console.error("[AI] Unexpected error:", error);
          throw error;
        }
      }
      
      // Handle general scope
      if (input.scope === "general") {
        try {
          console.log("[AI] Calling Mistral for general scope, model:", ENV.aiAssistantModel);
          console.log("[AI] API key configured:", !!ENV.mistralApiKey, "length:", ENV.mistralApiKey?.length || 0);
          
          const response = await callMistralChat({
            model: ENV.aiAssistantModel,
            messages: [
              { role: "system", content: GENERAL_ASSISTANT_SYSTEM_PROMPT },
              { role: "user", content: input.message },
            ],
            temperature: 0.7,
            maxTokens: 2000,
          });
          
          console.log("[AI] Mistral response received for general scope, parsing...");
          
          // Parse and validate response
          const parsed = parseAssistantResponse(response);
          
          return parsed;
        } catch (error) {
          if (error instanceof MistralClientError) {
            console.error("[AI] Mistral client error:", error.message, "statusCode:", error.statusCode, "details:", error.providerError);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "AI service temporarily unavailable. Please try again later.",
            });
          }
          console.error("[AI] Unexpected error:", error);
          throw error;
        }
      }
      
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unsupported scope: ${input.scope}`,
      });
    }),
});
