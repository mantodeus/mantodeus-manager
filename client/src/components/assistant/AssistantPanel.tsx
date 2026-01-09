/**
 * Assistant Panel Component
 * 
 * Read-only Help assistant for explaining invoice state and blockers.
 * Mobile: Full-screen dialog
 * Desktop: Full-width workspace panel
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Loader2, X, Send, Info as HelpCircle } from "@/components/ui/Icon";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { toast } from "sonner";

interface AssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: "invoice_detail";
  scopeId: number;
  onAction?: (action: "OPEN_SHARE" | "OPEN_ADD_PAYMENT" | "OPEN_EDIT_DUE_DATE" | "OPEN_REVERT_STATUS") => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AssistantResponse {
  answerMarkdown: string;
  confidence: "low" | "medium" | "high";
  suggestedNextActions: Array<{
    id: string;
    label: string;
    action: "OPEN_SHARE" | "OPEN_ADD_PAYMENT" | "OPEN_EDIT_DUE_DATE" | "OPEN_REVERT_STATUS";
  }>;
}

const DEFAULT_PROMPTS = [
  "Why is this invoice in this state?",
  "What's missing before I can send it?",
  "Why is this action blocked?",
];

export function AssistantPanel({
  open,
  onOpenChange,
  scope,
  scopeId,
  onAction,
}: AssistantPanelProps) {
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<AssistantResponse | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const askMutation = trpc.ai.ask.useMutation({
    onSuccess: (response: AssistantResponse) => {
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: response.answerMarkdown,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setLastResponse(response);
      setIsLoading(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to get assistant response");
      setIsLoading(false);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
      // Focus input when panel opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      await askMutation.mutateAsync({
        scope,
        scopeId,
        message: trimmed,
      });
    } catch (error) {
      // Error already handled in onError
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt);
    // Auto-send after a brief delay
    setTimeout(() => {
      setInputValue(prompt);
      handleSend();
    }, 100);
  };

  const handleActionClick = (action: "OPEN_SHARE" | "OPEN_ADD_PAYMENT" | "OPEN_EDIT_DUE_DATE" | "OPEN_REVERT_STATUS") => {
    if (onAction) {
      onAction(action);
    }
  };

  // Get actions from the last stored response
  const actions = lastResponse?.suggestedNextActions || [];

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Help Assistant</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask me about this invoice's state, blockers, or next steps.
            </p>
            <div className="space-y-2">
              {DEFAULT_PROMPTS.map((prompt, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={() => handleQuickPrompt(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-lg p-3",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              {message.role === "assistant" ? (
                <SimpleMarkdown>{message.content}</SimpleMarkdown>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}

        {/* Suggested Actions */}
        {actions.length > 0 && !isLoading && (
          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium text-muted-foreground">
              Suggested actions:
            </p>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleActionClick(action.action)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t flex-shrink-0">
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
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex flex-col p-0 max-h-[calc(100vh-2rem)] h-[calc(100vh-2rem)]">
          <DialogHeader className="sr-only">
            <DialogTitle>Help Assistant</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  // Desktop: Full-width workspace panel
  return (
    <>
      {open && (
        <div
          className="fixed z-[100] bg-background border shadow-lg rounded-lg"
          style={{
            top: "1.5rem",
            right: "1.5rem",
            left: "1.5rem",
            height: "calc(100vh - 3rem)",
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col h-full overflow-hidden rounded-lg">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
