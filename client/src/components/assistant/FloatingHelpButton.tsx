/**
 * Floating Help Button
 * 
 * Context-aware floating help button that appears on every page.
 * Opens the AI Assistant Panel (powered by Mistral).
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sparkles } from "@/components/ui/Icon";
import { AssistantPanel, type AssistantScope } from "./AssistantPanel";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";

/**
 * Detects the current page context and returns the appropriate scope/ID
 */
function usePageContext(): { scope: AssistantScope; scopeId?: number; pageName: string } {
  const [location] = useLocation();
  
  // Invoice detail page: /invoices/:id
  const invoiceMatch = location.match(/^\/invoices\/(\d+)(?:\?|#|$)/);
  if (invoiceMatch) {
    return { 
      scope: "invoice_detail", 
      scopeId: parseInt(invoiceMatch[1], 10),
      pageName: "Invoice"
    };
  }
  
  // Project detail page: /projects/:id
  const projectMatch = location.match(/^\/projects\/(\d+)(?:\?|#|$)/);
  if (projectMatch) {
    return { 
      scope: "general", 
      scopeId: parseInt(projectMatch[1], 10),
      pageName: "Project"
    };
  }
  
  // Default: general scope
  const pageNames: Record<string, string> = {
    "/projects": "Projects",
    "/invoices": "Invoices",
    "/contacts": "Contacts",
    "/notes": "Notes",
    "/calendar": "Calendar",
    "/gallery": "Gallery",
    "/maps": "Maps",
    "/settings": "Settings",
    "/expenses": "Expenses",
    "/reports": "Reports",
  };
  
  const pageName = Object.entries(pageNames).find(([path]) => location.startsWith(path))?.[1] || "Mantodeus";
  
  return { scope: "general", pageName };
}

export function FloatingHelpButton() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const isMobile = useIsMobile();
  const { scope, scopeId, pageName } = usePageContext();

  return (
    <>
      <Button
        onClick={() => setAssistantOpen(true)}
        size="icon"
        className={cn(
          "fixed rounded-full shadow-lg",
          "h-14 w-14", // Large touch target
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90",
          "transition-all duration-200",
          isMobile
            ? "bottom-20 right-4" // Above bottom tab bar on mobile
            : "bottom-6 right-6" // Standard position on desktop
        )}
        style={{
          zIndex: 10001, // Above bottom tab bar (9999) and dialogs (typically 50-100)
          ...(isMobile && {
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)", // Above tab bar + safe area
          }),
        }}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      <AssistantPanel
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        scope={scope}
        scopeId={scopeId}
        pageName={pageName}
        onAction={(action) => {
          // Actions are handled by the panel itself
        }}
      />
    </>
  );
}
