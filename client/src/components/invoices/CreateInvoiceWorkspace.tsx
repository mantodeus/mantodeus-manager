/**
 * Create Invoice Workspace
 * 
 * Full-page workspace for creating invoices on desktop.
 * Split layout: Preview (left) + Form (right)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { DocumentCurrencyEuro, X, Eye, Loader2 } from "@/components/ui/Icon";
import { toast } from "sonner";
import { InvoiceForm, InvoicePreviewData } from "./InvoiceForm";
import { supabase } from "@/lib/supabase";

interface CreateInvoiceWorkspaceProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateInvoiceWorkspace({ open, onClose, onSuccess }: CreateInvoiceWorkspaceProps) {
  // Required: Return null if not open (replaces Dialog behavior)
  if (!open) return null;

  console.log("CreateInvoiceWorkspace mounted");
  const utils = trpc.useUtils();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  
  // Prevent body scrolling when workspace is open
  useEffect(() => {
    if (!open) return; // Only prevent scrolling when workspace is open

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyWidth = document.body.style.width;
    const originalBodyTop = document.body.style.top;
    const scrollY = window.scrollY;

    // Lock body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;

    return () => {
      // Restore original body styles
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.width = originalBodyWidth;
      document.body.style.top = originalBodyTop;
      window.scrollTo(0, scrollY);
    };
  }, [open]);
  
  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("invoice.pdf");
  const [lastValidPreviewUrl, setLastValidPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewGenerationRef = useRef<AbortController | null>(null);
  const getFormDataRef = useRef<(() => InvoicePreviewData | null) | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const formPanelRef = useRef<HTMLDivElement>(null);
  const previewPanelRef = useRef<HTMLDivElement>(null);

  const handleSuccess = useCallback(async () => {
    toast.success("Invoice created");
    await utils.invoices.list.invalidate();
    onClose();
    onSuccess?.();
  }, [utils, onClose, onSuccess]);

  // Generate preview from form data - memoized to prevent infinite re-renders
  const generatePreview = useCallback(async (formData: InvoicePreviewData | null) => {
    if (!formData) {
      toast.error("Please fill in invoice number and at least one item");
      return;
    }
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
          terms: formData.terms,
          servicePeriodStart: formData.servicePeriodStart,
          servicePeriodEnd: formData.servicePeriodEnd,
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
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Request was cancelled, ignore
        return;
      }
      
      console.error("Preview generation error:", error);
      // Show error to user
      const errorMessage = error instanceof Error ? error.message : "Failed to generate preview";
      toast.error(errorMessage);
      // On error, keep showing last valid preview (don't blank it)
      if (lastValidPreviewUrl) {
        setPreviewUrl(lastValidPreviewUrl);
      } else {
        // If no previous preview, clear the URL to show the placeholder
        setPreviewUrl(null);
      }
    } finally {
      setIsGeneratingPreview(false);
      previewGenerationRef.current = null;
    }
  }, [lastValidPreviewUrl]);

  // Manual preview update handler
  const handleUpdatePreview = useCallback(async () => {
    if (!getFormDataRef.current) {
      toast.error("Form not ready");
      return;
    }
    
    const formData = getFormDataRef.current();
    await generatePreview(formData);
  }, [generatePreview]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
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
    };
  }, [previewUrl, lastValidPreviewUrl]);

  return (
    <>
      {/* Backdrop overlay - matches edit invoice dialog */}
      <div 
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        onClick={onClose}
        onWheel={(e) => e.preventDefault()}
        onTouchMove={(e) => e.preventDefault()}
        onScroll={(e) => e.preventDefault()}
        style={{ 
          pointerEvents: 'auto',
          overflow: 'hidden',
          touchAction: 'none',
        }}
        aria-hidden="true"
      />
      
      {/* Preview Panel - Left side - matches edit invoice dialog */}
      <div
        ref={previewPanelRef}
        className="fixed z-[60] bg-background border-r shadow-lg rounded-lg"
        style={{
          top: '1.5rem',
          left: '1.5rem',
          width: 'calc(40vw - 2rem)',
          height: 'calc(100vh - 3rem)',
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full overflow-hidden rounded-lg">
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <h2 className="text-lg font-semibold">Preview</h2>
            {isGeneratingPreview && (
              <div className="text-sm text-muted-foreground">Generating...</div>
            )}
          </div>
          <div 
            ref={previewContainerRef}
            data-preview-container
            className="flex-1 overflow-auto rounded-b-lg"
            style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
          >
            {previewUrl ? (
              <div
                style={{
                  transform: `scale(${previewZoom})`,
                  transformOrigin: 'top left',
                  width: `${100 / previewZoom}%`,
                  height: `${100 / previewZoom}%`,
                  transition: 'transform 0.1s ease-out',
                }}
              >
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title={previewFileName}
                  style={{ pointerEvents: 'auto' }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Preview will appear here when you update it</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form Panel - Right side - matches edit invoice dialog */}
      <div
        ref={formPanelRef}
        className="fixed z-[60] bg-background shadow-lg rounded-lg flex flex-col overflow-hidden"
        style={{
          top: '1.5rem',
          right: '1.5rem',
          bottom: '1.5rem',
          left: 'calc(0.5rem + 40vw)',
          width: 'calc(60vw - 2rem)',
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6 space-y-6">
          {/* Header */}
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
                onClick={onClose}
                className="h-10 w-10"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>

            {/* Fade-out separator */}
            <div className="separator-fade" />

            {/* Form */}
            <InvoiceForm
              mode="create"
              contacts={contacts}
              onClose={onClose}
              onSuccess={handleSuccess}
              getFormDataRef={getFormDataRef}
              renderBeforeFooter={
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUpdatePreview}
                  disabled={isGeneratingPreview}
                  className="w-full"
                >
                  {isGeneratingPreview ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Update Preview
                    </>
                  )}
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}

