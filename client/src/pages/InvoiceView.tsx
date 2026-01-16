import { InvoiceForm, type InvoicePreviewData } from "@/components/invoices/InvoiceForm";
import { ShareInvoiceDialog } from "@/components/invoices/ShareInvoiceDialog";
import { InvoiceStatusActionsDropdown } from "@/components/invoices/InvoiceStatusActionsDropdown";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Eye } from "@/components/ui/Icon";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { InvoiceUploadReviewDialog } from "@/components/InvoiceUploadReviewDialog";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePortalRoot } from "@/hooks/usePortalRoot";
import { PDFPreviewModal } from "@/components/PDFPreviewModal";
import { useIsMobile } from "@/hooks/useMobile";
import { formatCurrency, getInvoiceState } from "@/lib/invoiceState";
import {
  InvoiceWorkspaceBody,
  InvoiceWorkspaceHeader,
} from "@/components/invoices/InvoiceWorkspaceLayout";
import { Card } from "@/components/ui/card";

export default function InvoiceView() {
  const [, params] = useRoute("/invoices/:id");
  const [, navigate] = useLocation();
  const invoiceId = params?.id ? parseInt(params.id) : null;
  const isMobile = useIsMobile();
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("invoice.pdf");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const portalRoot = usePortalRoot();

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

  useEffect(() => {
    setIsEditing(false);
  }, [invoiceId]);

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
      <div className="min-h-full w-full">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // For ALL uploaded invoices, show review dialog instead (never show full InvoiceForm)
  if (invoice && invoice.source === "uploaded") {
    return (
      <div className="min-h-full w-full">
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
      </div>
    );
  }

  const invoiceState = invoice ? getInvoiceState(invoice) : null;
  const isDraft = invoiceState === 'DRAFT';
  const headerTitle = isMobile && isEditing ? "Edit Invoice" : "View Invoice";

  const statusActions = invoice && invoice.source === "created" ? (
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
  ) : null;

  const showDesktopDraftSplit = !isMobile && invoice && invoice.source === "created" && isDraft;
  const showDesktopWindowed = !isMobile && invoice && invoice.source === "created";
  const showMobileSummary = isMobile && !isEditing && invoice && invoice.source === "created";

  const clientName =
    invoice &&
    contacts.find(
      (contact: { id: number }) =>
        contact.id === invoice.clientId || contact.id === invoice.contactId
    )?.name;

  const formatDate = (value?: string | Date | null) => {
    if (!value) return "—";
    const date = typeof value === "string" ? new Date(value) : value;
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("de-DE");
  };

  if (showDesktopWindowed) {
    return (
      <>
        {/* Backdrop overlay */}
        {createPortal(
          <div
            className="fixed z-[100] bg-black/40 backdrop-blur-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            onClick={() => navigate("/invoices")}
            onWheel={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
            onScroll={(e) => e.preventDefault()}
            style={{
              inset: 0,
              width: "100vw",
              height: "100vh",
              pointerEvents: "auto",
              overflow: "hidden",
              touchAction: "none",
            }}
            aria-hidden="true"
          />,
          portalRoot || document.body
        )}

        {createPortal(
          <>
            {/* Preview Panel - Left side */}
            <div
              ref={previewPanelRef}
              className="fixed z-[110] bg-background border border-border shadow-xl rounded-lg"
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
              className="fixed z-[110] bg-background border border-border shadow-xl rounded-lg flex flex-col overflow-hidden"
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
              <div className="flex h-full flex-col">
                <InvoiceWorkspaceHeader
                  title={headerTitle}
                  onClose={() => navigate("/invoices")}
                  actions={statusActions}
                />

                <InvoiceWorkspaceBody>
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
                </InvoiceWorkspaceBody>
              </div>
            </div>
          </>,
          portalRoot || document.body
        )}

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

  return (
    <div className="flex min-h-full w-full flex-col">
      <InvoiceWorkspaceHeader
        title={headerTitle}
        onClose={() => navigate("/invoices")}
        actions={
          <>
            {statusActions}
            {isMobile && isEditing && (
              <Button
                type="button"
                variant="outline"
                className="rounded-full px-3"
                onClick={() => setIsEditing(false)}
              >
                Done
              </Button>
            )}
          </>
        }
      />

      <InvoiceWorkspaceBody>
        {showDesktopDraftSplit ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start min-h-[calc(100vh-12rem)]">
            <div className="w-full min-h-[calc(100vh-12rem)] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b">
                <h2 className="text-lg font-semibold">Preview</h2>
                {isGeneratingPreview && (
                  <div className="text-sm text-muted-foreground">Generating...</div>
                )}
              </div>
              <div
                ref={previewContainerRef}
                data-preview-container
                className="flex-1 overflow-auto"
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
            <div className="w-full">
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
            </div>
          </div>
        ) : showMobileSummary ? (
          <div className="w-full space-y-4">
            <Card className="p-4">
              <div className="space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Invoice
                  </div>
                  <div className="text-2xl font-light">
                    {invoice?.invoiceNumber || "Draft"}
                  </div>
                </div>
                {clientName && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Client
                    </div>
                    <div className="text-sm">{clientName}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Total
                  </div>
                  <div className="text-2xl font-light tabular-nums">
                    {formatCurrency(invoice?.total || 0)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Issue Date</div>
                    <div className="text-sm">{formatDate(invoice?.issueDate)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Due Date</div>
                    <div className="text-sm">{formatDate(invoice?.dueDate)}</div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                onClick={handlePreviewPDF}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full">
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
          </div>
        )}
      </InvoiceWorkspaceBody>

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
