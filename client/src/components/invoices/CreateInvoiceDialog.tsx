/**
 * Create Invoice Dialog
 * 
 * Dialog for creating a new invoice with the same style as the edit invoice dialog.
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { DocumentCurrencyEuro, X } from "@/components/ui/Icon";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { InvoiceForm, InvoicePreviewData } from "./InvoiceForm";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateInvoiceDialogProps) {
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  
  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFileName, setPreviewFileName] = useState("invoice.pdf");
  const [lastValidPreviewUrl, setLastValidPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewGenerationRef = useRef<AbortController | null>(null);

  const handleSuccess = async () => {
    toast.success("Invoice created");
    await utils.invoices.list.invalidate();
    onOpenChange(false);
    onSuccess?.();
  };

  // Generate preview from form data
  const generatePreview = async (formData: InvoicePreviewData) => {
    // Cancel any in-flight request
    if (previewGenerationRef.current) {
      previewGenerationRef.current.abort();
    }
    
    const controller = new AbortController();
    previewGenerationRef.current = controller;
    setIsGeneratingPreview(true);

    try {
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Call preview endpoint
      const response = await fetch("/api/invoices/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          invoiceNumber: formData.invoiceNumber,
          clientId: formData.clientId ? parseInt(formData.clientId) : undefined,
          issueDate: formData.issueDate,
          dueDate: formData.dueDate,
          notes: formData.notes,
          items: formData.items,
        }),
      });

      if (controller.signal.aborted) {
        return; // Request was cancelled
      }

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - keep showing last valid preview
          return;
        }
        throw new Error(`Preview generation failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Update preview URL and store as last valid
      setPreviewUrl(url);
      setLastValidPreviewUrl(url);
      setPreviewFileName(`INVOICE_PREVIEW_${formData.invoiceNumber}_UNSAVED.pdf`);
      
      // Auto-open preview on desktop
      if (!isMobile) {
        setPreviewOpen(true);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Request was cancelled, ignore
        return;
      }
      
      console.error("Preview generation error:", error);
      // On error, keep showing last valid preview (don't blank it)
      if (lastValidPreviewUrl) {
        setPreviewUrl(lastValidPreviewUrl);
      }
      // Silently fail - preview just won't update
    } finally {
      setIsGeneratingPreview(false);
      previewGenerationRef.current = null;
    }
  };

  // Auto-open preview on desktop when dialog opens
  useEffect(() => {
    if (!isMobile && open && previewUrl && !previewOpen) {
      setPreviewOpen(true);
    }
  }, [open, previewUrl, isMobile, previewOpen]);

  // Clean up preview URL on unmount or when dialog closes
  useEffect(() => {
    if (!open) {
      // Cancel any in-flight preview generation
      if (previewGenerationRef.current) {
        previewGenerationRef.current.abort();
        previewGenerationRef.current = null;
      }
      
      // Clean up blob URLs
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      if (lastValidPreviewUrl && lastValidPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(lastValidPreviewUrl);
      }
      
      setPreviewUrl(null);
      setLastValidPreviewUrl(null);
      setPreviewOpen(false);
    }
  }, [open, previewUrl, lastValidPreviewUrl]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      if (lastValidPreviewUrl && lastValidPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(lastValidPreviewUrl);
      }
    };
  }, [previewUrl, lastValidPreviewUrl]);

  return (
    <>
      {/* Preview Panel - Left side on desktop */}
      {!isMobile && previewOpen && previewUrl && (
        <div
          data-preview-panel
          className="fixed z-[60] bg-background border-r shadow-lg rounded-lg"
          style={{
            top: '1.5rem',
            left: '1.5rem',
            width: 'calc(40vw - 2rem)', // 40% width with margins for blurred border
            height: 'calc(100vh - 3rem)', // Full height with margins
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col h-full overflow-hidden rounded-lg">
            {/* Preview Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Preview</h2>
              {isGeneratingPreview && (
                <div className="text-sm text-muted-foreground">Generating...</div>
              )}
            </div>
            {/* Preview Content */}
            <div className="flex-1 overflow-hidden rounded-b-lg">
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={previewFileName}
              />
            </div>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
        className={cn(
          "flex flex-col p-0",
          // Desktop: right side with margins, showing blurred background border
          "sm:!top-[1.5rem] sm:!bottom-[1.5rem] sm:!translate-x-0 sm:!translate-y-0 sm:!max-w-none sm:!h-auto sm:max-h-[calc(100vh-3rem)]",
          // Mobile: fullscreen with safe margins
          isMobile && "max-h-[calc(100vh-var(--bottom-safe-area,0px)-2rem)] mb-[calc(var(--bottom-safe-area,0px)+1rem)]"
        )}
        style={{
          // Desktop: right side, 60% width with margins for blurred border
          // Mobile: normal dialog behavior
          left: isMobile ? undefined : "calc(40vw + 0.5rem)", // Start after preview + small gap
          right: isMobile ? undefined : "1.5rem",
          top: isMobile ? undefined : "1.5rem",
          bottom: isMobile ? undefined : "1.5rem",
          width: isMobile ? undefined : "calc(60vw - 2rem)", // 60% width with margins
          height: isMobile ? undefined : "calc(100vh - 3rem)",
          maxHeight: isMobile ? undefined : "calc(100vh - 3rem)",
        } as React.CSSProperties}
        showCloseButton={false}
      >
        {/* PageHeader-like structure */}
        <div className="flex-shrink-0 p-6 pb-2 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="flex-1 min-w-0 flex flex-col">
                <h1 className="text-3xl font-regular flex items-center gap-2">
                  <DocumentCurrencyEuro className="h-6 w-6 text-primary" />
                  Create Invoice
                </h1>
                <p className="text-muted-foreground text-sm mt-3">
                  Create a new invoice
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-10 w-10"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Fade-out separator */}
        <div className="separator-fade" />

        <div className={cn(
          "px-6 pt-4 overflow-y-auto flex-1",
          isMobile ? "pb-[calc(var(--bottom-safe-area,0px)+1rem)]" : "pb-6"
        )}>
          <InvoiceForm
            mode="create"
            contacts={contacts}
            onClose={() => onOpenChange(false)}
            onSuccess={handleSuccess}
            onFormChange={generatePreview}
          />
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

