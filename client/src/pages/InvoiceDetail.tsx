import { InvoiceForm } from "@/components/invoices/InvoiceForm";
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
import { useState, useEffect } from "react";
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

  return (
    <div className="space-y-6">
      <PageHeader />
      
      {/* PageHeader-like structure matching invoices page */}
      <div className="space-y-4">
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
            <Link href="/invoices">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Action buttons below header - Preview and Status Badge Dropdown */}
        {invoice && invoice.source === "created" && (
          <div className="flex items-center justify-start md:justify-end gap-2 pb-2 border-b">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreviewPDF}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            {/* Status badge with dropdown - single control surface for all lifecycle actions */}
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
                // Open ShareInvoiceDialog when "send" action is triggered
                setShareDialogOpen(true);
              }}
              onAddPayment={() => {
                // This will be handled by InvoiceForm's payment dialog
                // For now, we'll need to expose this from InvoiceForm
                toast.info("Add Payment - use the Payments section in the form");
              }}
            />
          </div>
        )}
      </div>

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
