/**
 * Floating Help Button
 * 
 * Modern floating AI assistant button that appears on every page.
 * Opens a sleek chat widget powered by Mistral.
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
          "fixed rounded-full",
          "h-12 w-12",
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90 hover:scale-105",
          "shadow-lg shadow-primary/25",
          "transition-all duration-200 ease-out",
          "group",
          isMobile
            ? "bottom-20 right-4"
            : "bottom-6 right-6",
          assistantOpen && "opacity-0 pointer-events-none scale-90"
        )}
        style={{
          zIndex: 10001,
          ...(isMobile && {
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)",
          }),
        }}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="h-5 w-5 group-hover:rotate-12 transition-transform duration-200" />
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
