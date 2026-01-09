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
import { DocumentCurrencyEuro, X, Eye, Loader2 } from "@/components/ui/Icon";
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
  const previewGenerationRef = useRef<AbortController | null>(null);
  const getFormDataRef = useRef<(() => InvoicePreviewData | null) | null>(null);

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

  // Calculate initial zoom to fit PDF in viewport on mobile when preview opens
  useEffect(() => {
    if (isMobile && previewDialogOpen && previewUrl && previewContainerRef.current) {
      // Wait for iframe to load, then calculate fit-to-viewport zoom
      const container = previewContainerRef.current;
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      
      if (iframe) {
        const calculateFitZoom = () => {
          try {
            // Get iframe content dimensions (PDF typically renders at A4 size: 210mm x 297mm)
            // A4 at 96 DPI ≈ 794px x 1123px
            // We'll use a more conservative approach: check container size and set initial zoom
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            // Standard A4 PDF dimensions at 96 DPI
            const pdfWidth = 794;
            const pdfHeight = 1123;
            
            // Calculate zoom to fit width and height, use the smaller one to ensure it fits
            const widthZoom = containerWidth / pdfWidth;
            const heightZoom = containerHeight / pdfHeight;
            const fitZoom = Math.min(widthZoom, heightZoom, 1); // Don't zoom in beyond 1x
            
            // Set initial zoom to fit, but allow user to zoom in
            setPreviewZoom(Math.max(0.3, fitZoom)); // Minimum 0.3x zoom
          } catch (error) {
            // Fallback to 0.5x if calculation fails
            setPreviewZoom(0.5);
          }
        };
        
        // Try to calculate after iframe loads
        iframe.onload = () => {
          setTimeout(calculateFitZoom, 100);
        };
        
        // Also try immediately (in case iframe already loaded)
        setTimeout(calculateFitZoom, 200);
      } else {
        // Fallback: set a reasonable initial zoom
        setPreviewZoom(0.5);
      }
    }
  }, [isMobile, previewDialogOpen, previewUrl]);

  // Add touch zoom support for preview iframe
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || !previewUrl || !previewDialogOpen) return;

    // Track initial touch distance for pinch zoom
    let initialDistance = 0;
    let initialZoom = 1;
    let isPinching = false;

    // Touch pinch-to-zoom handler
    const handleTouchStart = (e: TouchEvent) => {
      // Only handle pinch zoom (2 touches), allow single touch for scrolling
      if (e.touches.length === 2) {
        isPinching = true;
        e.preventDefault();
        e.stopPropagation();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        initialZoom = previewZoom;
      } else {
        isPinching = false;
      }
      // Single touch - allow normal scrolling, don't prevent default
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Only prevent default for pinch zoom (2 touches)
      if (e.touches.length === 2 && isPinching) {
        e.preventDefault();
        e.stopPropagation();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        
        if (initialDistance > 0) {
          const scale = currentDistance / initialDistance;
          const newZoom = initialZoom * scale;
          // Allow zoom from 0.3x to 3x
          setPreviewZoom(Math.max(0.3, Math.min(3, newZoom)));
        }
      }
      // Single touch - allow normal scrolling, don't prevent default
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Only reset if we're no longer pinching
      if (e.touches.length < 2) {
        initialDistance = 0;
        isPinching = false;
      }
    };

    // Use capture phase to ensure we catch events before they bubble
    container.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: false, capture: true });
    
    const iframeWrapper = container.querySelector('[data-iframe-wrapper]') as HTMLElement;
    if (iframeWrapper) {
      iframeWrapper.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
      iframeWrapper.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
      iframeWrapper.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });
      iframeWrapper.addEventListener('touchcancel', handleTouchEnd, { passive: false, capture: true });
    }
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart, { capture: true });
      container.removeEventListener('touchmove', handleTouchMove, { capture: true });
      container.removeEventListener('touchend', handleTouchEnd, { capture: true });
      container.removeEventListener('touchcancel', handleTouchEnd, { capture: true });
      if (iframeWrapper) {
        iframeWrapper.removeEventListener('touchstart', handleTouchStart, { capture: true });
        iframeWrapper.removeEventListener('touchmove', handleTouchMove, { capture: true });
        iframeWrapper.removeEventListener('touchend', handleTouchEnd, { capture: true });
        iframeWrapper.removeEventListener('touchcancel', handleTouchEnd, { capture: true });
      }
    };
  }, [previewUrl, previewDialogOpen, previewZoom]);

  return (
    <>
      {!isMobile ? (
        <CreateInvoiceWorkspace
          open={open}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "flex flex-col p-0",
          "max-h-[calc(100vh-var(--bottom-safe-area,0px)-2rem)] mb-[calc(var(--bottom-safe-area,0px)+1rem)]"
        )}
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
          "px-6 pt-4 flex-1 min-h-0 flex flex-col",
          "pb-0"
        )}>
          <InvoiceForm
            mode="create"
            contacts={contacts}
            onClose={() => onOpenChange(false)}
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
      </DialogContent>
    </Dialog>
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
                className="flex-1 overflow-auto bg-background relative min-h-0"
                style={{ 
                  touchAction: 'pan-x pan-y pinch-zoom',
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain'
                }}
              >
                {previewUrl ? (
                  <div
                    data-iframe-wrapper
                    style={{
                      transform: `scale(${previewZoom})`,
                      transformOrigin: 'top left',
                      width: `${100 / previewZoom}%`,
                      height: `${100 / previewZoom}%`,
                      transition: previewZoom === 1 ? 'none' : 'transform 0.1s ease-out',
                      minHeight: '100%',
                    }}
                  >
                    <iframe
                      src={previewUrl}
                      className="w-full h-full border-0"
                      title={previewFileName}
                      style={{ 
                        pointerEvents: 'auto',
                        display: 'block',
                      }}
                    />
                  </div>
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

