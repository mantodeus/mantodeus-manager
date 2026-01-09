/**
 * Floating Help Button
 * 
 * Context-aware floating help button that appears in the bottom right corner.
 * Only shows on invoice detail pages and opens the Assistant Panel.
 */

import { useState } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Info as HelpCircle } from "@/components/ui/Icon";
import { AssistantPanel } from "./AssistantPanel";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";

export function FloatingHelpButton() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Check if we're on an invoice detail page
  const [matches, params] = useRoute("/invoices/:id");
  const invoiceId = matches && params?.id ? parseInt(params.id) : null;

  // Only show on invoice detail pages
  if (!matches || !invoiceId) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setAssistantOpen(true)}
        size="icon"
        className={cn(
          "fixed z-50 rounded-full shadow-lg",
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90",
          "transition-all duration-200",
          "h-14 w-14", // Large touch target
          isMobile
            ? "bottom-20 right-4" // Above bottom tab bar on mobile
            : "bottom-6 right-6" // Standard position on desktop
        )}
        style={
          isMobile
            ? {
                bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)", // Above tab bar + safe area
              }
            : undefined
        }
        aria-label="Get help with this invoice"
      >
        <HelpCircle className="h-6 w-6" />
      </Button>

      <AssistantPanel
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        scope="invoice_detail"
        scopeId={invoiceId}
        onAction={(action) => {
          // Actions can be handled here if needed
          // For now, the AssistantPanel handles its own actions
        }}
      />
    </>
  );
}
