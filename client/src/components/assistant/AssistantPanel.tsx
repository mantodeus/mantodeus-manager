/**
 * Assistant Panel Component
 * 
 * Modern, sleek AI chat widget powered by Mistral.
 * Supports step-by-step guided tours with element highlighting.
 * 
 * Mobile behavior:
 * - Takes bottom 50% of screen (not fullscreen)
 * - Sits above the bottom tab bar (never behind it)
 * - Persists across navigation (doesn't close when switching tabs)
 * - ModuleScroller appears above it
 * - Background doesn't scroll when open
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, X, Send, BugAnt, HelpCircle, ChevronLeft, ChevronRight, CheckCircle2 } from "@/components/ui/Icon";
import { useIsMobile } from "@/hooks/useMobile";
import { useManto } from "@/contexts/MantoContext";
import { cn } from "@/lib/utils";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGuidance, type TourStep, type GuidanceWarning } from "@/contexts/GuidanceContext";

// Bottom tab bar height (h-14 = 56px) - must match BottomTabBar.tsx
const BOTTOM_TAB_BAR_HEIGHT = 56;

export type AssistantScope = "invoice_detail" | "general";

interface AssistantPanelProps {
  scope: AssistantScope;
  scopeId?: number;
  pageName?: string;
  onAction?: (action: "OPEN_SHARE" | "OPEN_ADD_PAYMENT" | "OPEN_EDIT_DUE_DATE" | "OPEN_REVERT_STATUS") => void;
}

// ChatMessage type is now MantoMessage from context
import type { MantoMessage } from "@/contexts/MantoContext";

interface AssistantResponse {
  answerMarkdown: string;
  confidence: "low" | "medium" | "high";
  steps?: TourStep[];
  warnings?: GuidanceWarning[];
}

const INVOICE_PROMPTS = [
  "Why can't I send this?",
  "What's blocking this invoice?",
  "How do I mark it paid?",
];

const GENERAL_PROMPTS = [
  "How do I create an invoice?",
  "How do I add a new project?",
  "How do I scan a receipt?",
];

export function AssistantPanel({
  scope,
  scopeId,
  pageName = "Mantodeus",
  onAction,
}: AssistantPanelProps) {
  const { isOpen, closeManto, messages, addMessage, clearMessages } = useManto();
  const isMobile = useIsMobile();
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultPrompts = scope === "invoice_detail" ? INVOICE_PROMPTS : GENERAL_PROMPTS;
  
  const { 
    startTour,
    cancelTour,
    nextStep,
    previousStep,
    getVisibleElements,
    tourStatus,
    currentStep,
    currentStepIndex,
    totalSteps,
    activeWarnings,
  } = useGuidance();

  const isTourActive = tourStatus === "active";
  const isTourPaused = tourStatus === "paused";
  const isTourComplete = tourStatus === "complete";

  // Mobile: Prevent background scroll when Manto is open
  useEffect(() => {
    if (!isMobile) return;
    
    if (isOpen) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      // Restore body scroll
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    
    return () => {
      // Cleanup on unmount
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [isOpen, isMobile]);

  const askMutation = trpc.ai.ask.useMutation({
    onSuccess: (response: AssistantResponse) => {
      addMessage({
        role: "assistant",
        content: response.answerMarkdown,
      });
      setIsLoading(false);
      
      // Start tour if steps are present
      if (response.steps && response.steps.length > 0) {
        startTour({
          steps: response.steps,
          warnings: response.warnings,
        });
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to get response");
      setIsLoading(false);
    },
  });
  
  // Clear tour when panel closes
  useEffect(() => {
    if (!isOpen) {
      cancelTour();
    }
  }, [isOpen, cancelTour]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    // Cancel any active tour before new question
    cancelTour();

    addMessage({
      role: "user",
      content: trimmed,
    });
    setInputValue("");
    setIsLoading(true);

    try {
      await askMutation.mutateAsync({
        scope,
        scopeId: scopeId ?? undefined,
        message: trimmed,
        visibleElements: getVisibleElements(),
      });
    } catch {
      // Error handled in onError
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt);
    setTimeout(() => {
      // Cancel any active tour
      cancelTour();
      
      addMessage({
        role: "user",
        content: prompt,
      });
      setInputValue("");
      setIsLoading(true);
      askMutation.mutate({
        scope,
        scopeId: scopeId ?? undefined,
        message: prompt,
        visibleElements: getVisibleElements(),
      });
    }, 50);
  };

  const handleCancelTour = () => {
    cancelTour();
  };

  const handleClearAndAskNew = () => {
    cancelTour();
    clearMessages();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Desktop overlay - dims the main content when panel is open */}
      {/* Mobile: No overlay - content is visible above the panel */}
      {!isMobile && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99] animate-in fade-in duration-300"
          onClick={closeManto}
          aria-hidden="true"
        />
      )}

      {/* Chat Panel */}
      <div
        className={cn(
          "fixed flex flex-col",
          "bg-background border border-border",
          isMobile ? [
            "z-[500]", // Below ModuleScroller (1000) and tab bar (9999), but above page content
            "shadow-2xl",
            "animate-in slide-in-from-bottom-4 fade-in duration-200",
            "inset-x-0", // Full width on mobile
            "rounded-t-2xl rounded-b-none", // Rounded top only
            "border-b-0", // No bottom border (sits on tab bar)
          ] : [
            "z-[100]", // Above overlay
            "shadow-xl border-r",
            "animate-in slide-in-from-left fade-in duration-300",
            "left-0 top-0 bottom-0",
            "w-[420px]",
            "rounded-none border-l-0 border-t-0 border-b-0",
          ]
        )}
        style={isMobile ? {
          // Bottom half of screen, sitting directly above the tab bar
          top: '50%',
          bottom: `${BOTTOM_TAB_BAR_HEIGHT}px`,
          boxShadow: "0 -10px 40px -10px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05)",
        } : undefined}
      >
        {/* Mobile drag handle indicator */}
        {isMobile && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-4 border-b border-border/50",
          isMobile ? "py-2" : "py-3"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <BugAnt className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Manto</h2>
                {isTourActive && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-[10px] text-primary font-medium">
                    Step {currentStepIndex + 1}/{totalSteps}
                  </span>
                )}
                {isTourPaused && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-[10px] text-amber-600 font-medium">
                    Paused
                  </span>
                )}
                {isTourComplete && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 text-[10px] text-green-600 font-medium">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Done
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg hover:bg-muted"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-xs z-[10003]">
                <p>Powered by Mistral, a European AI company.</p>
                <p className="mt-1 text-muted-foreground">Your data stays yours - we don't train models on it.</p>
              </TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeManto}
              className="h-7 w-7 rounded-lg hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Tour Step UI - shows when tour is active */}
        {(isTourActive || isTourPaused) && currentStep && (
          <div className="px-4 py-3 border-b border-border/50 bg-primary/5">
            {/* Step description */}
            <p className="text-sm font-medium mb-3">{currentStep.description}</p>
            
            {/* Navigation buttons */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={previousStep}
                disabled={currentStepIndex === 0}
                className="h-8 text-xs gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors",
                      i === currentStepIndex ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              
              <Button
                variant="default"
                size="sm"
                onClick={nextStep}
                className="h-8 text-xs gap-1"
              >
                {currentStepIndex === totalSteps - 1 ? "Finish" : "Next"}
                {currentStepIndex < totalSteps - 1 && <ChevronRight className="h-3.5 w-3.5" />}
              </Button>
            </div>
            
            {/* Cancel link */}
            <div className="mt-2 text-center">
              <button
                onClick={handleCancelTour}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel guide
              </button>
            </div>
          </div>
        )}

        {/* Tour Complete Message */}
        {isTourComplete && (
          <div className="px-4 py-4 border-b border-border/50 bg-green-500/5 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-600">All done!</p>
            <p className="text-xs text-muted-foreground mt-1">Ask another question or close</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAndAskNew}
              className="mt-3 h-7 text-xs"
            >
              Clear & Ask New Question
            </Button>
          </div>
        )}

        {/* Warnings */}
        {activeWarnings && activeWarnings.length > 0 && (isTourActive || isTourPaused) && (
          <div className="px-4 py-2 border-b border-border/50 bg-amber-500/5">
            {activeWarnings.map((warning, i) => (
              <p key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
                <span className="shrink-0">⚠️</span>
                <span>{warning.message}</span>
              </p>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.length === 0 && !isTourActive && !isTourComplete && (
            <div className="space-y-3 py-2">
              <div className="flex items-start gap-2.5">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 shrink-0">
                  <BugAnt className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="space-y-2 pt-0.5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {scope === "invoice_detail" 
                      ? "Ask about this invoice."
                      : "Ask a question."}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {defaultPrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickPrompt(prompt)}
                        className={cn(
                          "px-2.5 py-1.5 text-xs rounded-lg",
                          "bg-muted/50 hover:bg-muted",
                          "text-muted-foreground hover:text-foreground",
                          "border border-border/50 hover:border-border",
                          "transition-all duration-150"
                        )}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2.5",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 shrink-0">
                  <BugAnt className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60"
                )}
              >
                {message.role === "assistant" ? (
                  <div className="text-sm prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                    <SimpleMarkdown>{message.content}</SimpleMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2.5 justify-start">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 shrink-0">
                <BugAnt className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="bg-muted/60 rounded-xl px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input - hidden during active tour */}
        {!isTourActive && !isTourPaused && (
          <div className="px-3 py-3 border-t border-border/50">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything..."
                disabled={isLoading}
                className="flex-1 h-9 text-sm rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                size="icon"
                className="h-9 w-9 rounded-xl shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
