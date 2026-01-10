/**
 * Manto Assistant Button
 * 
 * - Mobile: Floating button bottom-right, above tab bar, aligned with tools icon
 * - Desktop (inSidebar): Button in sidebar footer next to user profile
 */

import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { BugAnt } from "@/components/ui/Icon";
import { AssistantPanel, type AssistantScope } from "./AssistantPanel";
import { useIsMobile } from "@/hooks/useMobile";
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
  const { isOpen, openManto } = useManto();
  const isMobile = useIsMobile();
  const { scope, scopeId, pageName } = usePageContext();

  // Get current theme for mobile button styling
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'green-mantis';
  const isLightMode = currentTheme === 'orchid-mantis';

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
        onClick={openManto}
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
            // Mobile floating button - solid background, large ant icon
            "fixed rounded-xl",
            "h-12 w-12",
            "shadow-lg",
            "transition-all duration-200 ease-out",
            "hover:scale-105 active:scale-95",
            "right-4 bottom-[4.5rem]", // Positioned above tab bar, aligned with tools icon
            isOpen && "opacity-0 pointer-events-none scale-90",
            // Solid green for dark mode, solid pink for light mode
            isLightMode 
              ? "bg-[#FF69B4] hover:bg-[#FF1493] text-white border-0"
              : "bg-primary hover:bg-primary/90 text-primary-foreground border-0",
          ]
        )}
        style={inSidebar ? undefined : { zIndex: 9998 }} // Below tab bar (9999)
        aria-label="Open Manto assistant"
      >
        <BugAnt className={inSidebar ? "h-4 w-4" : "h-7 w-7"} strokeWidth={2} />
      </Button>

      <AssistantPanel
        scope={scope}
        scopeId={scopeId}
        pageName={pageName}
      />
    </>
  );
}
