import { InvoiceForm, type InvoicePreviewData } from "@/components/invoices/InvoiceForm";
import { ShareInvoiceDialog } from "@/components/invoices/ShareInvoiceDialog";
import { InvoiceStatusActionsDropdown } from "@/components/invoices/InvoiceStatusActionsDropdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, X, DocumentCurrencyEuro, Eye } from "@/components/ui/Icon";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { InvoiceUploadReviewDialog } from "@/components/InvoiceUploadReviewDialog";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { PDFPreviewModal } from "@/components/PDFPreviewModal";
import { useIsMobile } from "@/hooks/useMobile";
import { getInvoiceState } from "@/lib/invoiceState";

export default function InvoiceDetail() {
  const [, params] = useRoute("/invoices/:id");
  const [, navigate] = useLocation();
  const invoiceId = params?.id ? parseInt(params.id) : null;
  const isMobile = useIsMobile();
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("invoice.pdf");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: invoice, isLoading } = trpc.invoices.get.useQuery(
    { id: invoiceId! },
    { enabled: !!invoiceId }
  );
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Preview state for "Update Preview" button (unsaved preview)
  const getFormDataRef = useRef<(() => InvoicePreviewData | null) | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewPanelRef = useRef<HTMLDivElement>(null);
  const formPanelRef = useRef<HTMLDivElement>(null);

  // Redirect ALL uploaded invoices to review dialog (never show full InvoiceForm)
  useEffect(() => {
    if (invoice && invoice.source === "uploaded") {
      setReviewDialogOpen(true);
    }
  }, [invoice]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handlePreviewPDF = async () => {
    if (!invoiceId || !invoice) return;
    
    // For uploaded invoices, use the original PDF from S3
    if (invoice.source === "uploaded" && invoice.originalPdfS3Key) {
      const fileName = invoice.invoiceName || invoice.originalFileName || invoice.invoiceNumber || "invoice.pdf";
      setPreviewFileName(fileName);
      setPreviewModalOpen(true);
      // PDFPreviewModal will use fileKey to fetch via file-proxy
      return;
    }
    
    // For created invoices, generate PDF and open in preview modal
    try {
      const { data: { session } } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());
      if (!session?.access_token) {
        toast.error("Please log in to preview invoices");
        return;
      }
      const response = await fetch(`/api/invoices/${invoiceId}/pdf?preview=true`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(errorData.error || 'Failed to generate preview');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(url);
      setPreviewFileName(invoice?.invoiceName || invoice?.invoiceNumber || "invoice.pdf");
      setPreviewModalOpen(true);
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to open preview');
    }
  };

  // Handle "Update Preview" button - generates preview from unsaved form data
  const handleUpdatePreview = useCallback(async () => {
    if (!getFormDataRef.current) {
      toast.error("Form not ready");
      return;
    }

    const formData = getFormDataRef.current();
    if (!formData) {
      toast.error("Please fill in invoice number and at least one item");
      return;
    }

    setIsGeneratingPreview(true);
    try {
      const { data: { session } } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());
      if (!session?.access_token) {
        toast.error("Please log in to preview invoices");
        return;
      }

      const response = await fetch("/api/invoices/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: "include",
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        toast.error(errorData.error || "Failed to generate preview");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPreviewFileName(`INVOICE_PREVIEW_${formData.invoiceNumber}_UNSAVED.pdf`);
      // On desktop, preview shows in left panel (don't open modal)
      // On mobile, open preview modal
      if (isMobile) {
        setPreviewModalOpen(true);
      }
    } catch (error) {
      console.error("Preview generation error:", error);
      toast.error("Failed to generate preview");
    } finally {
      setIsGeneratingPreview(false);
    }
  }, []);

  if (!invoiceId || Number.isNaN(invoiceId)) {
    navigate("/invoices");
    return null;
  }

  if (isLoading && !invoice) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // For ALL uploaded invoices, show review dialog instead (never show full InvoiceForm)
  if (invoice && invoice.source === "uploaded") {
    return (
      <>
        <InvoiceUploadReviewDialog
          open={reviewDialogOpen}
          onOpenChange={(open) => {
            setReviewDialogOpen(open);
            if (!open) {
              navigate("/invoices");
            }
          }}
          invoiceId={invoiceId}
          parsedData={null}
          onSuccess={async () => {
            await utils.invoices.list.invalidate();
            await utils.invoices.listNeedsReview.invalidate();
            navigate("/invoices");
          }}
        />
        <PDFPreviewModal
          isOpen={previewModalOpen}
          onClose={() => {
            setPreviewModalOpen(false);
            if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl(null);
          }}
          fileUrl={previewUrl ?? undefined}
          fileName={previewFileName}
          fullScreen={isMobile}
        />
      </>
    );
  }

  const title = invoice?.invoiceName || invoice?.invoiceNumber || "Invoice";
  const invoiceState = invoice ? getInvoiceState(invoice) : null;
  const isDraft = invoiceState === 'DRAFT';

  // Desktop: Show split layout for draft invoices (like CreateInvoiceWorkspace)
  // Mobile: Always show single-column layout
  if (!isMobile && invoice && invoice.source === "created" && isDraft) {
    return (
      <>
        {/* Backdrop overlay */}
        {createPortal(
          <div
            className="fixed z-[100] bg-black/50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            onClick={() => navigate("/invoices")}
            onWheel={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
            onScroll={(e) => e.preventDefault()}
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: "100%",
              height: "100%",
              minHeight: "100vh",
              pointerEvents: "auto",
              overflow: "hidden",
              touchAction: "none",
            }}
            aria-hidden="true"
          />,
          document.body
        )}

        {/* Preview Panel - Left side */}
        <div
          ref={previewPanelRef}
          className="fixed z-[110] bg-background border-r shadow-lg rounded-lg"
          style={{
            top: "1.5rem",
            left: "1.5rem",
            width: "calc(40vw - 2rem)",
            height: "calc(100vh - 3rem)",
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
              style={{ touchAction: "pan-x pan-y pinch-zoom" }}
            >
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title={previewFileName}
                  style={{ pointerEvents: "auto" }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Preview will appear here when you update it</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Form Panel - Right side */}
        <div
          ref={formPanelRef}
          className="fixed z-[110] bg-background shadow-lg rounded-lg flex flex-col overflow-hidden"
          style={{
            top: "1.5rem",
            right: "1.5rem",
            bottom: "1.5rem",
            left: "calc(0.5rem + 40vw)",
            width: "calc(60vw - 2rem)",
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
                      {title}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-3">
                      View and edit invoice details
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/invoices")}
                    className="h-10 w-10"
                    aria-label="Close"
                  >
                    <X className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pb-2 border-b">
                <InvoiceStatusActionsDropdown
                  invoice={{
                    id: invoice.id,
                    invoiceNumber: invoice.invoiceNumber || "",
                    needsReview: invoice.needsReview || false,
                    sentAt: invoice.sentAt,
                    paidAt: invoice.paidAt,
                    amountPaid: invoice.amountPaid,
                    total: invoice.total,
                    dueDate: invoice.dueDate,
                    cancelledAt: invoice.cancelledAt,
                    source: invoice.source,
                    type: invoice.type,
                  }}
                  onActionComplete={async () => {
                    await utils.invoices.get.invalidate({ id: invoiceId! });
                    await utils.invoices.list.invalidate();
                  }}
                  onSend={() => {
                    setShareDialogOpen(true);
                  }}
                  onAddPayment={() => {
                    toast.info("Add Payment - use the Payments section in the form");
                  }}
                />
              </div>

              {/* Form */}
              <InvoiceForm
                mode="edit"
                invoiceId={invoiceId}
                contacts={contacts}
                onClose={() => navigate("/invoices")}
                onSuccess={async () => {
                  toast.success("Invoice updated");
                  await utils.invoices.list.invalidate();
                  await utils.invoices.listNeedsReview.invalidate();
                }}
                onOpenInvoice={(nextId) => navigate(`/invoices/${nextId}`)}
                onPreview={handlePreviewPDF}
                showPreview={false}
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

        {/* Share Invoice Dialog */}
        {invoiceId && (
          <ShareInvoiceDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            invoiceId={invoiceId}
            onSuccess={async () => {
              await utils.invoices.get.invalidate({ id: invoiceId });
              await utils.invoices.list.invalidate();
            }}
          />
        )}
      </>
    );
  }

  // Mobile or non-draft: Show single-column layout
  return (
    <div className="space-y-6">
      <PageHeader />
      
      {/* PageHeader-like structure matching Invoices page */}
      <div style={{ marginBottom: 'var(--space-page-gap, 24px)' }}>
        {/* TitleRow */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <h1 className="text-4xl md:text-3xl font-light flex items-center gap-2">
                <DocumentCurrencyEuro className="h-6 w-6 text-primary" />
                {title}
              </h1>
            </div>
          </div>
          
          {/* Icon Cluster - Status badge where Create would be, X button where settings would be */}
          <div className="flex items-center shrink-0 gap-3 sm:gap-2">
            {/* Status badge */}
            {invoice && invoice.source === "created" && (
              <InvoiceStatusActionsDropdown
                invoice={{
                  id: invoice.id,
                  invoiceNumber: invoice.invoiceNumber || "",
                  needsReview: invoice.needsReview || false,
                  sentAt: invoice.sentAt,
                  paidAt: invoice.paidAt,
                  amountPaid: invoice.amountPaid,
                  total: invoice.total,
                  dueDate: invoice.dueDate,
                  cancelledAt: invoice.cancelledAt,
                  source: invoice.source,
                  type: invoice.type,
                }}
                onActionComplete={async () => {
                  await utils.invoices.get.invalidate({ id: invoiceId! });
                  await utils.invoices.list.invalidate();
                }}
                onSend={() => {
                  setShareDialogOpen(true);
                }}
                onAddPayment={() => {
                  toast.info("Add Payment - use the Payments section in the form");
                }}
              />
            )}
            <Link href="/invoices">
              <Button
                variant="icon"
                size="icon"
                className="size-9 [&_svg]:size-8 hover:bg-muted/50"
                aria-label="Close"
              >
                <X />
              </Button>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Fade-out separator */}
      <div className="separator-fade" />

      <Card className="w-full border-0 shadow-none">
        <CardContent className="pt-6">
          {/* Only show InvoiceForm for created invoices - uploaded invoices use review dialog */}
          {invoice && invoice.source === "created" ? (
            <InvoiceForm
              mode="edit"
              invoiceId={invoiceId}
              contacts={contacts}
              onClose={() => navigate("/invoices")}
              onSuccess={async () => {
                toast.success("Invoice updated");
                await utils.invoices.list.invalidate();
                await utils.invoices.listNeedsReview.invalidate();
              }}
              onOpenInvoice={(nextId) => navigate(`/invoices/${nextId}`)}
              onPreview={handlePreviewPDF}
              showPreview={invoice && invoice.status !== "draft"}
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
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>This invoice is being edited in the review dialog.</p>
              <Button
                variant="outline"
                onClick={() => setReviewDialogOpen(true)}
                className="mt-4"
              >
                Open Review Dialog
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <PDFPreviewModal
        isOpen={previewModalOpen}
        onClose={() => {
          setPreviewModalOpen(false);
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
          setPreviewUrl(null);
        }}
        fileUrl={previewUrl ?? undefined}
        fileKey={invoice?.source === "uploaded" ? invoice.originalPdfS3Key ?? undefined : undefined}
        fileName={previewFileName}
        fullScreen={isMobile}
      />

      {/* Share Invoice Dialog for created invoices */}
      {invoice && invoice.source === "created" && invoiceId && (
        <ShareInvoiceDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          invoiceId={invoiceId}
          onSuccess={async () => {
            await utils.invoices.get.invalidate({ id: invoiceId });
            await utils.invoices.list.invalidate();
          }}
        />
      )}
    </div>
  );
}
