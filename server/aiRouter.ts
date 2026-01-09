/**
 * AI Assistant Router
 * 
 * AI-powered assistant using Mistral API.
 * Supports invoice-specific and general questions.
 * Returns step-by-step tour instructions with UI element highlighting.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import * as db from "./db";
import { callMistralChat, MistralClientError } from "./services/ai/mistralClient";
import { buildSystemPrompt } from "./services/ai/prompts/assistant_v1";
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
 */
function getAllowedActions(invoice: Awaited<ReturnType<typeof db.getInvoiceById>>): string[] {
  if (!invoice) return [];
  
  const actions: string[] = [];
  const sentAt = invoice.sentAt;
  const paidAt = invoice.paidAt;
  const amountPaid = Number(invoice.amountPaid || 0);
  const isCancelled = invoice.cancelledAt !== null;
  
  const isDraft = !sentAt;
  const isSent = sentAt && !paidAt && amountPaid === 0;
  const isPartial = sentAt && !paidAt && amountPaid > 0;
  const isPaid = !!paidAt;
  
  if (isDraft) {
    if (!isCancelled) {
      actions.push("OPEN_SHARE");
      if (invoice.source === "uploaded" && !sentAt) {
        actions.push("OPEN_ADD_PAYMENT");
      }
    }
  }
  
  if (isSent || isPartial) {
    actions.push("OPEN_ADD_PAYMENT");
    actions.push("OPEN_EDIT_DUE_DATE");
    if (amountPaid === 0) {
      actions.push("OPEN_REVERT_STATUS");
    }
  }
  
  if (isPaid) {
    actions.push("OPEN_REVERT_STATUS");
  }
  
  return actions;
}

// Tour step with optional element binding
interface TourStep {
  order: number;
  description: string;
  elementId?: string;
  action?: "highlight" | "pulse" | "spotlight";
  tooltip?: string;
}

// Warning
interface GuidanceWarning {
  elementId?: string;
  message: string;
}

// Response type
interface AIResponse {
  answerMarkdown: string;
  confidence: "low" | "medium" | "high";
  steps?: TourStep[];
  warnings?: GuidanceWarning[];
}

/**
 * Parse assistant response with step-by-step tour support
 */
function parseAssistantResponse(text: string): AIResponse {
  console.log("[AI] Parsing response, length:", text?.length, "preview:", text?.substring(0, 200));
  
  if (!text || text.trim().length === 0) {
    console.error("[AI] Empty response from Mistral");
    return {
      answerMarkdown: "I received an empty response. Please try again.",
      confidence: "low",
    };
  }
  
  try {
    // Try to extract JSON from text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonText = jsonMatch[0];
      const parsed = JSON.parse(jsonText);
      
      if (typeof parsed.answerMarkdown === "string") {
        console.log("[AI] Successfully parsed JSON response");
        
        const response: AIResponse = {
          answerMarkdown: parsed.answerMarkdown,
          confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "medium",
        };
        
        // Parse steps with element binding
        if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          response.steps = parsed.steps
            .filter((s: unknown) => {
              if (!s || typeof s !== "object") return false;
              const obj = s as Record<string, unknown>;
              return typeof obj.order === "number" && typeof obj.description === "string";
            })
            .map((s: Record<string, unknown>) => {
              const step: TourStep = {
                order: s.order as number,
                description: s.description as string,
              };
              
              // Optional element binding
              if (typeof s.elementId === "string" && s.elementId.length > 0) {
                step.elementId = s.elementId;
                step.action = ["highlight", "pulse", "spotlight"].includes(s.action as string)
                  ? (s.action as "highlight" | "pulse" | "spotlight")
                  : "pulse"; // Default to pulse for buttons
                if (typeof s.tooltip === "string") {
                  step.tooltip = s.tooltip;
                }
              }
              
              return step;
            })
            .sort((a, b) => a.order - b.order);
          
          console.log("[AI] Parsed", response.steps.length, "steps");
        }
        
        // Parse warnings
        if (Array.isArray(parsed.warnings) && parsed.warnings.length > 0) {
          response.warnings = parsed.warnings
            .filter((w: unknown) => {
              if (!w || typeof w !== "object") return false;
              const obj = w as Record<string, unknown>;
              return typeof obj.message === "string";
            })
            .map((w: Record<string, unknown>) => ({
              elementId: typeof w.elementId === "string" ? w.elementId : undefined,
              message: w.message as string,
            }));
        }
        
        return response;
      }
    }
  } catch (error) {
    console.log("[AI] JSON parse failed, using plain text fallback");
  }
  
  // Fallback: treat as plain markdown
  console.log("[AI] Using plain text response");
  return {
    answerMarkdown: text.trim(),
    confidence: "medium",
  };
}

// Visible element schema for input
const visibleElementSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
});

export const aiRouter = router({
  ask: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["invoice_detail", "general"]),
        scopeId: z.number().optional(),
        message: z.string().min(1).max(1000),
        visibleElements: z.array(visibleElementSchema).optional(),
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
      
      // Build system prompt with visible elements
      const systemPrompt = buildSystemPrompt(input.scope, input.visibleElements);
      
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
        
        const userMessage = `Invoice Context:
${JSON.stringify(context, null, 2)}

User Question: ${input.message}

Respond with JSON format as specified in your instructions. Include steps with elementId if pointing to UI elements.`;

        try {
          console.log("[AI] Calling Mistral for invoice_detail, model:", ENV.aiAssistantModel);
          
          const response = await callMistralChat({
            model: ENV.aiAssistantModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            temperature: 0.7,
            maxTokens: 2000,
          });
          
          console.log("[AI] Mistral response received, parsing...");
          return parseAssistantResponse(response);
        } catch (error) {
          if (error instanceof MistralClientError) {
            console.error("[AI] Mistral client error:", error.message, "statusCode:", error.statusCode);
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
          
          const userMessage = `${input.message}

Respond with JSON format as specified in your instructions. Include steps with elementId if pointing to UI elements.`;
          
          const response = await callMistralChat({
            model: ENV.aiAssistantModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            temperature: 0.7,
            maxTokens: 2000,
          });
          
          console.log("[AI] Mistral response received for general scope, parsing...");
          return parseAssistantResponse(response);
        } catch (error) {
          if (error instanceof MistralClientError) {
            console.error("[AI] Mistral client error:", error.message, "statusCode:", error.statusCode);
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
