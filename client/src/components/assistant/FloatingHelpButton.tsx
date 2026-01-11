/**
 * Ask Mantodeus Button
 * 
 * - Mobile: Floating button bottom-right, above tab bar, aligned with tools icon
 * - Desktop (inSidebar): Button in sidebar footer next to user profile
 */

import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { BugAnt } from "@/components/ui/Icon";
import { AssistantPanel, type AssistantScope } from "./AssistantPanel";
import { useManto } from "@/contexts/MantoContext";
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

interface FloatingHelpButtonProps {
  inSidebar?: boolean; // If true, renders as a sidebar button (desktop only)
}

export function FloatingHelpButton({ inSidebar = false }: FloatingHelpButtonProps) {
  const { openManto } = useManto();
  const { scope, scopeId, pageName } = usePageContext();

  if (!inSidebar) {
    return null;
  }

  return (
    <>
      <Button
        onClick={openManto}
        size="icon"
        className={cn(
          "rounded-lg",
          "h-9 w-9",
          "bg-primary/10 hover:bg-primary/20",
          "text-primary",
          "border border-primary/20",
          "shadow-lg",
          "transition-colors duration-150",
          "hover:scale-105",
        )}
        aria-label="Ask Mantodeus"
      >
        <BugAnt className="h-4 w-4" />
      </Button>

      <AssistantPanel
        scope={scope}
        scopeId={scopeId}
        pageName={pageName}
      />
    </>
  );
}
