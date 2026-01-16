/**
 * Create Invoice Dialog
 * 
 * Mobile-only dialog for creating invoices.
 * Desktop uses CreateInvoiceWorkspace (full-page workspace).
 */

import { trpc } from "@/lib/trpc";
import { Eye, Loader2 } from "@/components/ui/Icon";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useMobile";
import { InvoiceForm, InvoicePreviewData } from "./InvoiceForm";
import { Button } from "@/components/ui/button";
import { CreateInvoiceWorkspace } from "./CreateInvoiceWorkspace";
import { InvoiceWorkspaceBody, InvoiceWorkspaceHeader } from "./InvoiceWorkspaceLayout";
import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { DocumentPreview } from "@/components/document-preview/DocumentPreview";

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
  const [showInlinePreview, setShowInlinePreview] = useState(false);
  const inlinePreviewRef = useRef<HTMLDivElement>(null);
  const previewGenerationRef = useRef<AbortController | null>(null);
  const getFormDataRef = useRef<(() => InvoicePreviewData | null) | null>(null);
  const getLoadingStateRef = useRef<(() => boolean) | null>(null);
  const handleClose = () => {
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
      setShowInlinePreview(true);
      requestAnimationFrame(() => {
        inlinePreviewRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
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
        <div className="flex min-h-full w-full flex-col">
          <InvoiceWorkspaceHeader
            title="Create Invoice"
            onClose={handleClose}
            actions={
              <Button
                type="submit"
                form="invoice-form"
                className="shrink-0"
                disabled={getLoadingStateRef.current?.() || false}
              >
                {getLoadingStateRef.current?.() ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            }
          />

          <InvoiceWorkspaceBody className="flex flex-col">
            <InvoiceForm
              mode="create"
              contacts={contacts}
              onClose={handleClose}
              onSuccess={handleSuccess}
              getFormDataRef={getFormDataRef}
              getLoadingStateRef={getLoadingStateRef}
              hideFooterSave={true}
              renderBeforeFooter={
                <div className="w-full space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (showInlinePreview) {
                        setShowInlinePreview(false);
                        return;
                      }
                      if (previewUrl) {
                        setShowInlinePreview(true);
                        requestAnimationFrame(() => {
                          inlinePreviewRef.current?.scrollIntoView({ behavior: 'smooth' });
                        });
                        return;
                      }
                      handleUpdatePreview();
                    }}
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
                        {showInlinePreview ? "Hide Preview" : "Preview"}
                      </>
                    )}
                  </Button>
                  {showInlinePreview && previewUrl && (
                    <div
                      ref={inlinePreviewRef}
                      className="w-full border-t bg-muted/30"
                    >
                      <DocumentPreview
                        fileUrl={previewUrl}
                        fileName={previewFileName}
                        mimeType="application/pdf"
                      />
                    </div>
                  )}
                </div>
              }
            />
          </InvoiceWorkspaceBody>
        </div>
      )}
    </>
  );
}
