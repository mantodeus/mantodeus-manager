/**
 * Floating Bug Button
 * 
 * - Mobile: Floating button bottom-right, above tab bar
 * - Desktop: Floating button bottom-right (triggers left sidebar panel)
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { BugAnt } from "@/components/ui/Icon";
import { AssistantPanel, type AssistantScope } from "./AssistantPanel";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";

/**
 * Detects the current page context
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
  const [bugOpen, setBugOpen] = useState(false);
  const isMobile = useIsMobile();
  const { scope, scopeId, pageName } = usePageContext();

  return (
    <>
      <Button
        onClick={() => setBugOpen(true)}
        size="icon"
        className={cn(
          "fixed rounded-xl",
          "h-11 w-11",
          "bg-primary/10 hover:bg-primary/20",
          "text-primary",
          "border border-primary/20",
          "shadow-lg",
          "transition-all duration-200 ease-out",
          "hover:scale-105",
          isMobile ? "bottom-20 right-4" : "bottom-6 right-6", // Mobile: above tab bar
          bugOpen && "opacity-0 pointer-events-none scale-90"
        )}
        style={{ zIndex: 10001 }}
        aria-label="Open Bug assistant"
      >
        <BugAnt className="h-5 w-5" />
      </Button>

      <AssistantPanel
        open={bugOpen}
        onOpenChange={setBugOpen}
        scope={scope}
        scopeId={scopeId}
        pageName={pageName}
      />
    </>
  );
}
