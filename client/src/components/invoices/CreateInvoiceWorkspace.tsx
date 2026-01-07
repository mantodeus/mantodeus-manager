/**
 * Create Invoice Workspace
 * 
 * Full-page workspace for creating invoices on desktop.
 * Split layout: Preview (left) + Form (right)
 */

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { DocumentCurrencyEuro, X } from "@/components/ui/Icon";
import { toast } from "sonner";
import { InvoiceForm, InvoicePreviewData } from "./InvoiceForm";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";

interface CreateInvoiceWorkspaceProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateInvoiceWorkspace({ open, onClose, onSuccess }: CreateInvoiceWorkspaceProps) {
  const [, navigate] = useLocation();
  
  // Required: Return null if not open (replaces Dialog behavior)
  if (!open) return null;

  console.log("CreateInvoiceWorkspace mounted");
  const utils = trpc.useUtils();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  
  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("invoice.pdf");
  const [lastValidPreviewUrl, setLastValidPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewGenerationRef = useRef<AbortController | null>(null);

  const handleSuccess = async () => {
    toast.success("Invoice created");
    await utils.invoices.list.invalidate();
    onClose();
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
    <div className="fixed inset-0 z-50 bg-background">
      <div className="flex h-svh w-full">
      {/* LEFT: Preview */}
      <div className="w-[40vw] border-r bg-muted/20 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">Preview</h2>
          {isGeneratingPreview && (
            <div className="text-sm text-muted-foreground">Generating...</div>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          {previewUrl ? (
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              title={previewFileName}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Preview will appear here as you fill in the form</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Form */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
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
            onFormChange={generatePreview}
          />
        </div>
      </div>
      </div>
    </div>
  );
}

