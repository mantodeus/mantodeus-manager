/**
 * Manto Assistant Button
 * 
 * - Mobile: Floating button bottom-right, above tab bar
 * - Desktop (inSidebar): Button in sidebar footer next to user profile
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

interface FloatingHelpButtonProps {
  inSidebar?: boolean; // If true, renders as a sidebar button (desktop only)
}

export function FloatingHelpButton({ inSidebar = false }: FloatingHelpButtonProps) {
  const [mantoOpen, setMantoOpen] = useState(false);
  const isMobile = useIsMobile();
  const { scope, scopeId, pageName } = usePageContext();

  // If in sidebar mode, only show on desktop
  if (inSidebar && isMobile) {
    return null;
  }

  // If not in sidebar mode, only show on mobile
  if (!inSidebar && !isMobile) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setMantoOpen(true)}
        size="icon"
        className={cn(
          inSidebar ? [
            // Sidebar button style (desktop)
            "rounded-lg",
            "h-9 w-9",
            "bg-primary/10 hover:bg-primary/20",
            "text-primary",
            "border border-primary/20",
            "transition-colors",
          ] : [
            // Floating button style (mobile)
            "fixed rounded-xl",
            "h-11 w-11",
            "bg-primary/10 hover:bg-primary/20",
            "text-primary",
            "border border-primary/20",
            "shadow-lg",
            "transition-all duration-200 ease-out",
            "hover:scale-105",
            "bottom-20 right-4", // Mobile: above tab bar
            mantoOpen && "opacity-0 pointer-events-none scale-90",
          ]
        )}
        style={inSidebar ? undefined : { zIndex: 10001 }}
        aria-label="Open Manto assistant"
      >
        <BugAnt className={inSidebar ? "h-4 w-4" : "h-5 w-5"} />
      </Button>

      <AssistantPanel
        open={mantoOpen}
        onOpenChange={setMantoOpen}
        scope={scope}
        scopeId={scopeId}
        pageName={pageName}
      />
    </>
  );
}
