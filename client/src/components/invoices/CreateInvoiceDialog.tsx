/**
 * Create Invoice Dialog
 * 
 * Mobile-only dialog for creating invoices.
 * Desktop uses CreateInvoiceWorkspace (full-page workspace).
 */

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { DocumentCurrencyEuro, ArrowLeft, Eye, Loader2 } from "@/components/ui/Icon";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { InvoiceForm, InvoicePreviewData } from "./InvoiceForm";
import { Button } from "@/components/ui/button";
import { CreateInvoiceWorkspace } from "./CreateInvoiceWorkspace";
import { useState, useRef, useCallback, useEffect } from "react";
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
  
  // Preview state for mobile
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("invoice.pdf");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const autoFitDoneRef = useRef(false);
  const previewGenerationRef = useRef<AbortController | null>(null);
  const getFormDataRef = useRef<(() => InvoicePreviewData | null) | null>(null);
  const previewFrameUrl = previewUrl
    ? previewUrl.includes("#")
      ? previewUrl
      : `${previewUrl}#page=1&zoom=page-fit`
    : null;
  const handleClose = () => {
    if (previewDialogOpen) {
      setPreviewDialogOpen(false);
      return;
    }
    onOpenChange(false);
  };

  const handleSuccess = async () => {
    toast.success("Invoice created");
    await utils.invoices.list.invalidate();
    onOpenChange(false);
    onSuccess?.();
  };

  // Generate preview from form data
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
          return; // Rate limited
        }
        throw new Error(`Preview generation failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      setPreviewUrl(url);
      setPreviewFileName(`INVOICE_PREVIEW_${formData.invoiceNumber}_UNSAVED.pdf`);
      setPreviewDialogOpen(true);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return; // Request was cancelled
      }
      
      console.error("Preview generation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate preview";
      toast.error(errorMessage);
    } finally {
      setIsGeneratingPreview(false);
      previewGenerationRef.current = null;
    }
  }, []);

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
      if (previewGenerationRef.current) {
        previewGenerationRef.current.abort();
        previewGenerationRef.current = null;
      }
      
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Reset zoom when preview changes
  useEffect(() => {
    if (!previewUrl) {
      setPreviewZoom(1);
    }
  }, [previewUrl]);

  // Calculate initial zoom to fit PDF in viewport on desktop preview panel
  useEffect(() => {
    if (isMobile || !previewDialogOpen || !previewUrl) {
      autoFitDoneRef.current = false;
      return;
    }

    autoFitDoneRef.current = false;
    const container = previewContainerRef.current;
    if (!container) return;

    const calculateFitZoom = () => {
      if (autoFitDoneRef.current) return;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      if (!containerWidth || !containerHeight) return;

      const pdfWidth = 794;
      const pdfHeight = 1123;
      const widthZoom = (containerWidth - 20) / pdfWidth;
      const heightZoom = (containerHeight - 20) / pdfHeight;
      const fitZoom = Math.min(widthZoom, heightZoom, 1);
      const calculatedZoom = Math.max(0.3, fitZoom);

      setPreviewZoom(calculatedZoom);
      autoFitDoneRef.current = true;
    };

    const rafId = requestAnimationFrame(calculateFitZoom);
    const resizeObserver = new ResizeObserver(() => calculateFitZoom());
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [isMobile, previewDialogOpen, previewUrl]);

  // Add touch zoom support for preview iframe
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || !previewUrl || !previewDialogOpen || isMobile) return;

    // Track initial touch distance for pinch zoom
    let initialDistance = 0;
    let initialZoom = 1;
    let isPinching = false;
    let lastTouchTime = 0;

    // Touch pinch-to-zoom handler
    const handleTouchStart = (e: TouchEvent) => {
      // Only handle pinch zoom (2 touches), allow single touch for scrolling
      if (e.touches.length === 2) {
        isPinching = true;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        initialZoom = previewZoom;
        lastTouchTime = Date.now();
      } else {
        isPinching = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Only prevent default for pinch zoom (2 touches)
      if (e.touches.length === 2 && isPinching && initialDistance > 0) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        
        const scale = currentDistance / initialDistance;
        const newZoom = initialZoom * scale;
        // Allow zoom from 0.3x to 3x
        setPreviewZoom(Math.max(0.3, Math.min(3, newZoom)));
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Only reset if we're no longer pinching
      if (e.touches.length < 2) {
        initialDistance = 0;
        isPinching = false;
      }
    };

    // Use capture phase to ensure we catch events before they bubble
    // Also use non-passive to allow preventDefault
    const options = { passive: false, capture: true };
    
    container.addEventListener('touchstart', handleTouchStart, options);
    container.addEventListener('touchmove', handleTouchMove, options);
    container.addEventListener('touchend', handleTouchEnd, options);
    container.addEventListener('touchcancel', handleTouchEnd, options);
    
    const iframeWrapper = container.querySelector('[data-iframe-wrapper]') as HTMLElement;
    if (iframeWrapper) {
      iframeWrapper.addEventListener('touchstart', handleTouchStart, options);
      iframeWrapper.addEventListener('touchmove', handleTouchMove, options);
      iframeWrapper.addEventListener('touchend', handleTouchEnd, options);
      iframeWrapper.addEventListener('touchcancel', handleTouchEnd, options);
    }
    
    // Also listen on document to catch events that might escape
    document.addEventListener('touchmove', handleTouchMove, options);
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart, options);
      container.removeEventListener('touchmove', handleTouchMove, options);
      container.removeEventListener('touchend', handleTouchEnd, options);
      container.removeEventListener('touchcancel', handleTouchEnd, options);
      if (iframeWrapper) {
        iframeWrapper.removeEventListener('touchstart', handleTouchStart, options);
        iframeWrapper.removeEventListener('touchmove', handleTouchMove, options);
        iframeWrapper.removeEventListener('touchend', handleTouchEnd, options);
        iframeWrapper.removeEventListener('touchcancel', handleTouchEnd, options);
      }
      document.removeEventListener('touchmove', handleTouchMove, options);
    };
  }, [previewUrl, previewDialogOpen, previewZoom]);

  if (!open) return null;

  return (
    <>
      {!isMobile ? (
        <CreateInvoiceWorkspace
          open={open}
          onClose={handleClose}
          onSuccess={onSuccess}
        />
      ) : (
        <div className="flex flex-col">
          {/* PageHeader-like structure matching Invoices page */}
          <div className="flex-shrink-0" style={{ marginBottom: 'var(--space-page-gap, 24px)' }}>
            {/* TitleRow */}
            <div className="flex items-center gap-3 px-4" style={{ paddingTop: isMobile ? 'calc(1rem + env(safe-area-inset-top, 0px))' : '1rem' }}>
              {/* Arrow button on left */}
              <Button
                variant="icon"
                size="icon"
                onClick={handleClose}
                className="size-9 [&_svg]:size-8 hover:bg-muted/50 shrink-0"
                aria-label="Close"
              >
                <ArrowLeft />
              </Button>
              
              {/* Title with icon */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <DocumentCurrencyEuro className="h-6 w-6 text-primary shrink-0" />
                <h1 className="text-2xl md:text-3xl font-light">Create Invoice</h1>
              </div>
            </div>
          </div>

          {/* Fade-out separator */}
          <div className="separator-fade" />

          <div className={cn(
            "px-6 pt-4 flex-1 min-h-0 flex flex-col",
            "pb-0"
          )}>
            <InvoiceForm
              mode="create"
              contacts={contacts}
              onClose={handleClose}
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
                      Preview
                    </>
                  )}
                </Button>
              }
            />
          </div>
        </div>
      )}

      {/* Mobile Preview Dialog - matches invoice dialog size */}
      {isMobile && (
        <Dialog 
          open={previewDialogOpen && !!previewUrl} 
          onOpenChange={(open) => {
            // Only close preview dialog, don't affect parent dialog
            if (!open) {
              setPreviewDialogOpen(false);
            }
          }}
        >
          <DialogContent
            className={cn(
              "flex flex-col p-0",
              // Match invoice dialog size on mobile
              "max-h-[calc(100vh-var(--bottom-safe-area,0px)-2rem)] mb-[calc(var(--bottom-safe-area,0px)+1rem)]",
              // Ensure dialog has minimum height and appears above overlay
              "min-h-[400px]",
              // Ensure content is visible and above overlay
              "bg-background z-[71]"
            )}
            style={{
              // Match invoice dialog positioning on mobile
              maxHeight: 'calc(100vh - var(--bottom-safe-area, 0px) - 2rem)',
              marginBottom: 'calc(var(--bottom-safe-area, 0px) + 1rem)',
              height: 'calc(100vh - var(--bottom-safe-area, 0px) - 2rem)',
            } as React.CSSProperties}
            showCloseButton={true}
            zIndex={70}
            onInteractOutside={(e) => {
              // Prevent closing parent dialog when clicking outside preview
              e.preventDefault();
            }}
            onPointerDownOutside={(e) => {
              // Prevent closing parent dialog when clicking outside preview
              e.preventDefault();
            }}
            onEscapeKeyDown={(e) => {
              // Only close preview dialog, not parent
              setPreviewDialogOpen(false);
              e.preventDefault();
            }}
          >
            <div className="flex flex-col h-full overflow-hidden min-h-0">
              {/* Preview Header */}
              <div className="flex items-center justify-between p-4 border-b flex-shrink-0 bg-background">
                <h2 className="text-lg font-semibold">Preview</h2>
              </div>
              {/* Preview Content - zoomable */}
              <div 
                ref={previewContainerRef}
                data-preview-container
                className="flex-1 bg-background relative min-h-0 overflow-hidden"
                style={{ 
                  touchAction: 'auto',
                }}
              >
                {previewFrameUrl ? (
                  <iframe
                    src={previewFrameUrl}
                    className="w-full h-full border-0"
                    title={previewFileName}
                    style={{ 
                      pointerEvents: 'auto',
                      display: 'block',
                      width: '100%',
                      height: '100%',
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>Loading preview...</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

