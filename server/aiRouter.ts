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
 * Parse and validate assistant response JSON
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
  try {
    // Try to extract JSON from text (in case there's extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : text;
    const parsed = JSON.parse(jsonText);
    
    // Validate structure
    if (typeof parsed.answerMarkdown !== "string") {
      throw new Error("Missing or invalid answerMarkdown");
    }
    if (!["low", "medium", "high"].includes(parsed.confidence)) {
      throw new Error("Invalid confidence value");
    }
    if (!Array.isArray(parsed.suggestedNextActions)) {
      throw new Error("Missing or invalid suggestedNextActions");
    }
    
    // Validate actions
    const validActions = ["OPEN_SHARE", "OPEN_ADD_PAYMENT", "OPEN_EDIT_DUE_DATE", "OPEN_REVERT_STATUS"];
    for (const action of parsed.suggestedNextActions) {
      if (typeof action.id !== "string" || typeof action.label !== "string") {
        throw new Error("Invalid action structure");
      }
      if (!validActions.includes(action.action)) {
        throw new Error(`Invalid action: ${action.action}`);
      }
    }
    
    return {
      answerMarkdown: parsed.answerMarkdown,
      confidence: parsed.confidence,
      suggestedNextActions: parsed.suggestedNextActions,
    };
  } catch (error) {
    // Return safe fallback
    return {
      answerMarkdown: "I apologize, but I encountered an error processing your question. Please try rephrasing it or contact support if the issue persists.",
      confidence: "low",
      suggestedNextActions: [],
    };
  }
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
          
          // Parse and validate response
          const parsed = parseAssistantResponse(response);
          
          return parsed;
        } catch (error) {
          if (error instanceof MistralClientError) {
            console.error("[AI] Mistral client error:", error.message);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "AI service temporarily unavailable. Please try again later.",
            });
          }
          throw error;
        }
      }
      
      // Handle general scope
      if (input.scope === "general") {
        try {
          const response = await callMistralChat({
            model: ENV.aiAssistantModel,
            messages: [
              { role: "system", content: GENERAL_ASSISTANT_SYSTEM_PROMPT },
              { role: "user", content: input.message },
            ],
            temperature: 0.7,
            maxTokens: 2000,
          });
          
          // Parse and validate response
          const parsed = parseAssistantResponse(response);
          
          return parsed;
        } catch (error) {
          if (error instanceof MistralClientError) {
            console.error("[AI] Mistral client error:", error.message);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "AI service temporarily unavailable. Please try again later.",
            });
          }
          throw error;
        }
      }
      
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unsupported scope: ${input.scope}`,
      });
    }),
});
