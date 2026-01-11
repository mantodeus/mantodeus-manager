/**
 * Create Invoice Workspace
 * 
 * Full-page workspace for creating invoices on desktop.
 * Split layout: Preview (left) + Form (right)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { DocumentCurrencyEuro, X, Eye, Loader2 } from "@/components/ui/Icon";
import { toast } from "sonner";
import { InvoiceForm, InvoicePreviewData } from "./InvoiceForm";
import { supabase } from "@/lib/supabase";
import { useIsMobile } from "@/hooks/useMobile";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CreateInvoiceWorkspaceProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateInvoiceWorkspace({ open, onClose, onSuccess }: CreateInvoiceWorkspaceProps) {
  // Required: Return null if not open (replaces Dialog behavior)
  if (!open) return null;

  console.log("CreateInvoiceWorkspace mounted");
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  
  // Note: We don't prevent body scrolling - the background page should remain scrollable
  // The workspace dialog handles its own internal scrolling
  
  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("invoice.pdf");
  const [lastValidPreviewUrl, setLastValidPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewGenerationRef = useRef<AbortController | null>(null);
  const getFormDataRef = useRef<(() => InvoicePreviewData | null) | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const autoFitDoneRef = useRef(false);
  const previewFrameUrl = previewUrl
    ? previewUrl.includes("#")
      ? previewUrl
      : `${previewUrl}#page=1&zoom=page-fit`
    : null;
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

  // Open preview dialog on mobile when preview is generated
  useEffect(() => {
    if (isMobile && previewUrl && !previewDialogOpen) {
      setPreviewDialogOpen(true);
    }
  }, [isMobile, previewUrl, previewDialogOpen]);

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

  // Reset zoom when preview changes
  useEffect(() => {
    if (!previewUrl) {
      setPreviewZoom(1);
    }
  }, [previewUrl]);

  // Calculate initial zoom to fit PDF in viewport (both desktop and mobile)
  useEffect(() => {
    if (!previewDialogOpen || !previewUrl) {
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
      // Account for padding (p-2 on mobile = 8px, p-4 on desktop = 16px)
      const padding = isMobile ? 16 : 20;
      const widthZoom = (containerWidth - padding) / pdfWidth;
      const heightZoom = (containerHeight - padding) / pdfHeight;
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

  // Add mouse wheel, trackpad, and touch zoom support for preview iframe
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || !previewUrl || isMobile) return;

    // Track initial touch distance for pinch zoom
    let initialDistance = 0;
    let initialZoom = 1;

    const handleWheel = (e: WheelEvent) => {
      // Trackpad pinch zoom: Ctrl/Cmd + wheel (macOS/Windows trackpad gesture)
      // macOS trackpad pinch sends wheel events with ctrlKey=true
      // Windows trackpad pinch may also send ctrlKey=true
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        // Use deltaY for zoom direction (negative = zoom in, positive = zoom out)
        // Trackpad pinch typically has larger deltaY values, so scale accordingly
        // Use a more sensitive multiplier for smoother zoom
        const zoomSensitivity = 0.005; // Fine-tuned for trackpad
        const delta = e.deltaY > 0 ? -zoomSensitivity * Math.abs(e.deltaY) : zoomSensitivity * Math.abs(e.deltaY);
        setPreviewZoom((prev) => {
          const newZoom = prev + delta;
          return Math.max(0.5, Math.min(3, newZoom));
        });
        return;
      }
    };

    // Touch pinch-to-zoom handler
    let isPinching = false;
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

    // Listen on both container and iframe wrapper to catch all events
    const iframeWrapper = container.querySelector('[data-iframe-wrapper]') as HTMLElement;
    
    // Use capture phase to catch events before they reach the iframe
    const options = { passive: false, capture: true };
    
    container.addEventListener('wheel', handleWheel, options);
    container.addEventListener('touchstart', handleTouchStart, options);
    container.addEventListener('touchmove', handleTouchMove, options);
    container.addEventListener('touchend', handleTouchEnd, options);
    container.addEventListener('touchcancel', handleTouchEnd, options);
    
    if (iframeWrapper) {
      iframeWrapper.addEventListener('wheel', handleWheel, options);
      iframeWrapper.addEventListener('touchstart', handleTouchStart, options);
      iframeWrapper.addEventListener('touchmove', handleTouchMove, options);
      iframeWrapper.addEventListener('touchend', handleTouchEnd, options);
      iframeWrapper.addEventListener('touchcancel', handleTouchEnd, options);
    }
    
    // Also listen on document to catch events that might escape
    document.addEventListener('touchmove', handleTouchMove, options);
    
    // Also listen on the iframe itself (though it may not receive events)
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.addEventListener('wheel', handleWheel, options);
    }
    
    return () => {
      container.removeEventListener('wheel', handleWheel, options);
      container.removeEventListener('touchstart', handleTouchStart, options);
      container.removeEventListener('touchmove', handleTouchMove, options);
      container.removeEventListener('touchend', handleTouchEnd, options);
      container.removeEventListener('touchcancel', handleTouchEnd, options);
      if (iframeWrapper) {
        iframeWrapper.removeEventListener('wheel', handleWheel, options);
        iframeWrapper.removeEventListener('touchstart', handleTouchStart, options);
        iframeWrapper.removeEventListener('touchmove', handleTouchMove, options);
        iframeWrapper.removeEventListener('touchend', handleTouchEnd, options);
        iframeWrapper.removeEventListener('touchcancel', handleTouchEnd, options);
      }
      if (iframe) {
        iframe.removeEventListener('wheel', handleWheel, options);
      }
      document.removeEventListener('touchmove', handleTouchMove, options);
    };
  }, [previewUrl, previewZoom]);

  return (
    <>
      {/* Backdrop overlay - matches edit invoice dialog */}
      {createPortal(
        <div 
          className="fixed z-[100] bg-black/50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={(e) => {
            if (previewDialogOpen) {
              e.preventDefault();
              return;
            }
            onClose();
          }}
          onWheel={(e) => {
            // Allow zoom on preview container
            const target = e.target as HTMLElement;
            if (target?.closest('[data-preview-container]')) {
              return; // Don't prevent if inside preview container
            }
            e.preventDefault();
          }}
          onTouchMove={(e) => e.preventDefault()}
          onScroll={(e) => e.preventDefault()}
          style={{ 
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            minHeight: '100vh',
            pointerEvents: 'auto',
            overflow: 'hidden',
            touchAction: 'none',
          }}
          aria-hidden="true"
        />,
        document.body
      )}
      
      {/* Preview Panel - Left side on desktop - matches edit invoice dialog */}
      {!isMobile && (
        <div
          ref={previewPanelRef}
          className="fixed z-[110] bg-background border-r shadow-lg rounded-lg"
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
                  data-iframe-wrapper
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
      )}

      {/* Mobile Preview Dialog - matches invoice dialog size */}
      {isMobile && (
        <Dialog 
          open={previewDialogOpen} 
          onOpenChange={(open) => {
            // Only close preview dialog
            if (!open) {
              setPreviewDialogOpen(false);
            }
          }}
        >
          <DialogContent
            className={cn(
              "flex flex-col p-0",
              // Match invoice dialog size on mobile
              "max-h-[calc(100vh-var(--bottom-safe-area,0px)-2rem)] mb-[calc(var(--bottom-safe-area,0px)+1rem)]"
            )}
            style={{
              // Match invoice dialog positioning on mobile
              maxHeight: 'calc(100vh - var(--bottom-safe-area, 0px) - 2rem)',
              marginBottom: 'calc(var(--bottom-safe-area, 0px) + 1rem)',
            } as React.CSSProperties}
            showCloseButton={true}
            zIndex={60}
            onInteractOutside={(e) => {
              // Prevent closing workspace when clicking outside preview
              e.preventDefault();
            }}
            onPointerDownOutside={(e) => {
              // Prevent closing workspace when clicking outside preview
              e.preventDefault();
            }}
            onEscapeKeyDown={(e) => {
              // Only close preview dialog
              setPreviewDialogOpen(false);
              e.preventDefault();
            }}
          >
            <div className="flex flex-col h-full overflow-hidden">
              {/* Preview Header */}
              <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                <h2 className="text-lg font-semibold">Preview</h2>
                {isGeneratingPreview && (
                  <div className="text-sm text-muted-foreground">Generating...</div>
                )}
              </div>
              {/* Preview Content - zoomable */}
              <div 
                ref={previewContainerRef}
                data-preview-container
                className="flex-1 bg-background relative min-h-0 overflow-auto"
                style={{ 
                  touchAction: 'pan-x pan-y pinch-zoom',
                }}
              >
                {previewFrameUrl ? (
                  <div className="flex items-center justify-center min-h-full p-2">
                    <div
                      data-iframe-wrapper
                      style={{
                        transform: `scale(${previewZoom})`,
                        transformOrigin: 'center center',
                        width: '794px',
                        height: '1123px',
                        transition: 'transform 0.1s ease-out',
                        flexShrink: 0,
                      }}
                    >
                      <iframe
                        src={previewFrameUrl}
                        className="w-full h-full border-0"
                        title={previewFileName}
                        style={{ 
                          pointerEvents: 'auto',
                          display: 'block',
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>Preview will appear here when you update it</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Form Panel - Right side - matches edit invoice dialog */}
      <div
        ref={formPanelRef}
        className="fixed z-[110] bg-background shadow-lg rounded-lg flex flex-col overflow-hidden"
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

