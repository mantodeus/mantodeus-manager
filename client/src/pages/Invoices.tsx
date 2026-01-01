import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, Eye, Send, Loader2, X, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ItemActionsMenu } from "@/components/ItemActionsMenu";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ScrollRevealFooter } from "@/components/ScrollRevealFooter";
import { PageHeader } from "@/components/PageHeader";
import { RevertInvoiceStatusDialog } from "@/components/RevertInvoiceStatusDialog";
import { InvoiceUploadReviewDialog } from "@/components/InvoiceUploadReviewDialog";
import { useIsMobile } from "@/hooks/useMobile";
import { InvoiceForm, type InvoiceLineItem } from "@/components/invoices/InvoiceForm";
import { Link } from "wouter";

function formatCurrency(amount: number | string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(num || 0);
}

export default function Invoices() {
  const isMobile = useIsMobile();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<number | null>(null);
  const [previewingInvoice, setPreviewingInvoice] = useState<number | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);
  const [moveToRubbishDialogOpen, setMoveToRubbishDialogOpen] = useState(false);
  const [moveToRubbishTargetId, setMoveToRubbishTargetId] = useState<number | null>(null);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState<{ id: number; targetStatus: "draft" | "open"; currentStatus: "open" | "paid" } | null>(null);
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);
  const [cancellationTarget, setCancellationTarget] = useState<{ id: number; invoiceNumber: string } | null>(null);
  const [needsReviewDeleteTarget, setNeedsReviewDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [uploadReviewDialogOpen, setUploadReviewDialogOpen] = useState(false);
  const [uploadedInvoiceId, setUploadedInvoiceId] = useState<number | null>(null);
  const [uploadedParsedData, setUploadedParsedData] = useState<{
    clientName: string | null;
    invoiceDate: Date | null;
    totalAmount: string | null;
    invoiceNumber: string | null;
  } | null>(null);

  const { data: invoices = [], refetch } = trpc.invoices.list.useQuery();
  const { data: needsReviewInvoices = [], refetch: refetchNeedsReview } = trpc.invoices.listNeedsReview.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const issueMutation = trpc.invoices.issue.useMutation({
    onSuccess: () => {
      toast.success("Invoice sent");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });
  const markAsPaidMutation = trpc.invoices.markAsPaid.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as paid");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });
  const createCancellationMutation = trpc.invoices.createCancellation.useMutation({
    onSuccess: (data) => {
      toast.success("Cancellation invoice created.");
      refetch();
      refetchNeedsReview();
      setCancellationDialogOpen(false);
      setCancellationTarget(null);
      setEditingInvoice(data.cancellationInvoiceId);
      setEditDialogOpen(true);
    },
    onError: (err) => toast.error(err.message),
  });
  const archiveMutation = trpc.invoices.archive.useMutation({
    onSuccess: () => {
      toast.success("Invoice archived");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });
  const moveToTrashMutation = trpc.invoices.moveToTrash.useMutation({
    onSuccess: () => {
      toast.success("Invoice deleted");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });
  const revertMutation = trpc.invoices.revertStatus.useMutation({
    onSuccess: () => {
      toast.success("Invoice status reverted");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });
  const uploadInvoiceMutation = trpc.invoices.uploadInvoice.useMutation({
    onSuccess: (data) => {
      setUploadedInvoiceId(data.invoice.id);
      setUploadedParsedData(data.parsedData);
      setUploadReviewDialogOpen(true);
    },
    onError: (err) => {
      toast.error("Failed to upload invoice: " + err.message);
    },
  });
  const needsReviewDeleteMutation = trpc.invoices.cancelUploadedInvoice.useMutation({
    onSuccess: () => {
      toast.success("Invoice deleted");
      setNeedsReviewDeleteTarget(null);
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePreviewPDF = async (invoiceId: number) => {
    setPreviewingInvoice(invoiceId);
    try {
      // Get the session token from Supabase
      const { data: { session } } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());

      if (!session?.access_token) {
        toast.error("Please log in to preview invoices");
        return;
      }

      // Fetch the PDF with credentials
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

      // Create a blob URL and open it in a new tab
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");

      // Clean up the blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to open preview');
    } finally {
      setPreviewingInvoice(null);
    }
  };

  const handleIssueInvoice = async (invoiceId: number) => {
    if (!confirm("Send this invoice? This locks the invoice number.")) return;
    await issueMutation.mutateAsync({ id: invoiceId });
  };

  const handleArchiveInvoice = (invoiceId: number) => {
    setArchiveTargetId(invoiceId);
    setArchiveDialogOpen(true);
  };

  const handleMoveToRubbish = (invoiceId: number) => {
    setMoveToRubbishTargetId(invoiceId);
    setMoveToRubbishDialogOpen(true);
  };

  const handleRevertStatus = (invoiceId: number, currentStatus: "open" | "paid") => {
    const targetStatus = currentStatus === "open" ? "draft" : "open";
    setRevertTarget({ id: invoiceId, targetStatus, currentStatus });
    setRevertDialogOpen(true);
  };

  const handleCreateCancellation = (invoice: { id: number; invoiceNumber: string }) => {
    setCancellationTarget({ id: invoice.id, invoiceNumber: invoice.invoiceNumber });
    setCancellationDialogOpen(true);
  };

  const getStatusBadge = (invoice: any) => {
    const { status, sentAt, paidAt } = invoice;

    if (paidAt) {
      return <Badge variant="secondary" className="text-xs">PAID</Badge>;
    }

    if (sentAt) {
      return <Badge variant="default" className="text-xs">OPEN</Badge>;
    }

    if (status === 'draft') {
      return <Badge variant="outline" className="text-xs">DRAFT</Badge>;
    }

    return <Badge variant="outline" className="text-xs">OPEN</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Create, edit, and manage invoices"
      />

      {/* Top-of-Page Action Row */}
      <div className="flex items-center justify-end gap-2 pb-2 border-b">
        <input
          type="file"
          accept=".pdf,application/pdf"
          id="invoice-upload-input"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (!file.type.includes("pdf")) {
              toast.error("Please select a PDF file");
              return;
            }

            try {
              // Convert to base64
              const reader = new FileReader();
              reader.onload = async () => {
                const result = reader.result as string;
                const base64Data = result.split(",")[1];

                await uploadInvoiceMutation.mutateAsync({
                  filename: file.name,
                  base64Data,
                  mimeType: file.type,
                });
              };
              reader.onerror = () => {
                toast.error("Failed to read file");
              };
              reader.readAsDataURL(file);
            } catch (error) {
              console.error(error);
              toast.error("Failed to upload invoice");
            }

            // Reset input
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          onClick={() => {
            document.getElementById("invoice-upload-input")?.click();
          }}
          disabled={uploadInvoiceMutation.isPending}
          className="h-10 whitespace-nowrap"
        >
          {uploadInvoiceMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          Upload
        </Button>
        <Button asChild className="h-10 whitespace-nowrap">
          <Link href="/invoices/new">
            <Plus className="w-4 h-4 mr-2" />
            Create
          </Link>
        </Button>
      </div>

      {needsReviewInvoices.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Needs Review</h2>
            <Badge variant="secondary" className="text-xs">
              {needsReviewInvoices.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {needsReviewInvoices.map((invoice) => {
              const uploadDate = invoice.uploadedAt || invoice.uploadDate || invoice.createdAt;
              const uploadDateLabel = uploadDate ? new Date(uploadDate).toLocaleDateString("de-DE") : "Unknown date";
              const displayName =
                invoice.invoiceName ||
                (invoice.filename ? invoice.filename.replace(/\.[^/.]+$/, "") : null) ||
                "Untitled invoice";
              return (
                <Card key={`needs-review-${invoice.id}`} className="p-4 flex flex-col gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-regular text-lg break-words">{displayName}</h3>
                        <Badge variant="outline" className="text-xs">NEEDS REVIEW</Badge>
                        <Badge variant="secondary" className="text-xs">UPLOADED</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Uploaded {uploadDateLabel}</p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setUploadedInvoiceId(invoice.id);
                          setUploadedParsedData(null);
                          setUploadReviewDialogOpen(true);
                        }}
                      >
                        Review
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => setNeedsReviewDeleteTarget({ id: invoice.id, name: displayName })}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No invoices found. Create your first invoice to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {invoices.map((invoice) => {
            const linkedContact = contacts.find(
              (contact: { id: number }) => contact.id === invoice.clientId || contact.id === invoice.contactId
            );
            const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : null;
            const items = (invoice.items as InvoiceLineItem[]) || [];
            const isPaid = Boolean(invoice.paidAt);
            const isOpen = Boolean(invoice.sentAt) && !invoice.paidAt;
            const isDraft = !invoice.sentAt && !invoice.paidAt && invoice.status === "draft";
            const isStandard = invoice.type !== "cancellation";
            const hasInvoiceNumber = Boolean(invoice.invoiceNumber);
            const canCancel = isStandard && hasInvoiceNumber && invoice.source !== "uploaded" && !invoice.hasCancellation && (isOpen || isPaid);
            const displayName = invoice.invoiceName || invoice.invoiceNumber || "Untitled invoice";
            const availableActions = isDraft
              ? ["edit", "duplicate", "archive", "moveToTrash"]
              : isOpen
              ? ["view", "markAsPaid", "archive", "revertToDraft", "duplicate"]
              : isPaid
              ? ["view", "archive", "revertToSent", "duplicate"]
              : ["view", "archive", "duplicate"];
            if (canCancel) {
              availableActions.push("createCancellation");
            }
            const originalInvoice = invoice.cancelledInvoiceId
              ? invoices.find((entry) => entry.id === invoice.cancelledInvoiceId)
              : null;
            const cancellationInvoice = invoice.cancellationInvoiceId
              ? invoices.find((entry) => entry.id === invoice.cancellationInvoiceId)
              : null;

            return (
              <Card key={invoice.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-accent" />
                      <h3 className="font-regular text-lg">{displayName}</h3>
                      {getStatusBadge(invoice)}
                      {invoice.type === "cancellation" && (
                        <Badge variant="outline" className="text-xs">STORNO</Badge>
                      )}
                    </div>
                    {invoice.type === "cancellation" && (
                      <p className="text-xs text-muted-foreground">
                        Cancellation of invoice {invoice.cancellationOfInvoiceNumber ?? "(unknown)"}
                      </p>
                    )}
                    {invoice.type === "standard" && invoice.hasCancellation && invoice.cancellationInvoiceId && (
                      <Button
                        variant="link"
                        size="sm"
                        className="px-0 text-xs"
                        onClick={() => {
                          if (cancellationInvoice) {
                            setEditingInvoice(cancellationInvoice.id);
                            setEditDialogOpen(true);
                          }
                        }}
                        disabled={!cancellationInvoice}
                      >
                        View cancellation invoice
                      </Button>
                    )}
                    <p className="text-muted-foreground text-xs">
                      {issueDate ? issueDate.toLocaleDateString("de-DE") : "No date"}
                      {invoice.dueDate ? ` • Due: ${new Date(invoice.dueDate).toLocaleDateString("de-DE")}` : ""}
                    </p>
                    {linkedContact && (
                      <p className="text-xs text-muted-foreground mt-1">Client: {linkedContact.name}</p>
                    )}
                  </div>
                  <ItemActionsMenu
                    actions={availableActions}
                    onAction={(action) => {
                      if (action === "view") handlePreviewPDF(invoice.id);
                      if (action === "duplicate") {
                        toast.info("Duplicate is coming soon.");
                      }
                      if (action === "archive") {
                        handleArchiveInvoice(invoice.id);
                      }
                      if (action === "moveToTrash") {
                        handleMoveToRubbish(invoice.id);
                      }
                      if (action === "markAsPaid" && isOpen) {
                        markAsPaidMutation.mutate({ id: invoice.id });
                      }
                      if (action === "revertToDraft" && isOpen) {
                        handleRevertStatus(invoice.id, "open");
                      }
                      if (action === "revertToSent" && isPaid) {
                        handleRevertStatus(invoice.id, "paid");
                      }
                      if (action === "createCancellation" && canCancel) {
                        handleCreateCancellation(invoice);
                      }
                      if (action === "edit" && isDraft) {
                        setEditingInvoice(invoice.id);
                        setEditDialogOpen(true);
                      }
                    }}
                  />
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items:</span>
                    <span>{items.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span>{formatCurrency(invoice.total)}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handlePreviewPDF(invoice.id)}
                    disabled={previewingInvoice === invoice.id}
                  >
                    {previewingInvoice === invoice.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4 mr-2" />
                    )}
                    Preview
                  </Button>
                  {invoice.status === "draft" && (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleIssueInvoice(invoice.id)}
                      disabled={issueMutation.isPending}
                    >
                      {issueMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Send
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editingInvoice && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent 
            className="!fixed !inset-y-0 !right-0 !left-0 lg:!left-[var(--sidebar-width)] !m-0 !p-0 !w-auto !max-w-none !h-auto !translate-x-0 !translate-y-0 !top-0 !rounded-none border-l border-border bg-background shadow-xl flex flex-col data-[state=open]:!zoom-in-100"
            style={{ left: isMobile ? 0 : 'var(--sidebar-width)' }}
            showCloseButton={false}
          >
            <div className="flex h-full flex-col">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-4">
                <DialogTitle className="text-lg font-semibold">Edit Invoice</DialogTitle>
                <DialogClose className="ring-offset-background focus:ring-ring rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-5xl p-6">
                  <InvoiceForm
                    mode="edit"
                    invoiceId={editingInvoice}
                    contacts={contacts}
                    onClose={() => {
                      setEditDialogOpen(false);
                      setEditingInvoice(null);
                    }}
                    onSuccess={() => {
                      toast.success("Invoice updated");
                      setEditDialogOpen(false);
                      setEditingInvoice(null);
                      refetch();
                    }}
                    onOpenInvoice={(invoiceId) => {
                      setEditingInvoice(invoiceId);
                      setEditDialogOpen(true);
                    }}
                  />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ScrollRevealFooter basePath="/invoices" />

      <InvoiceUploadReviewDialog
        open={uploadReviewDialogOpen}
        onOpenChange={(open) => {
          setUploadReviewDialogOpen(open);
          if (!open) {
            setUploadedInvoiceId(null);
            setUploadedParsedData(null);
          }
        }}
        invoiceId={uploadedInvoiceId}
        parsedData={uploadedParsedData}
        onSuccess={() => {
          refetch();
          refetchNeedsReview();
        }}
      />

      <DeleteConfirmDialog
        open={Boolean(needsReviewDeleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setNeedsReviewDeleteTarget(null);
          }
        }}
        onConfirm={() => {
          if (!needsReviewDeleteTarget) return;
          needsReviewDeleteMutation.mutate({ id: needsReviewDeleteTarget.id });
        }}
        title="Delete uploaded invoice"
        description={`Delete "${needsReviewDeleteTarget?.name ?? "this invoice"}"? This will remove the file and cannot be undone.`}
        confirmLabel="Delete"
        isDeleting={needsReviewDeleteMutation.isPending}
      />

      <DeleteConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={(open) => {
          setArchiveDialogOpen(open);
          if (!open) {
            setArchiveTargetId(null);
          }
        }}
        onConfirm={() => {
          if (!archiveTargetId) return;
          archiveMutation.mutate({ id: archiveTargetId });
        }}
        title="Archive invoice"
        description="Archive this invoice? You can restore it later from the archived view."
        confirmLabel="Archive"
        isDeleting={archiveMutation.isPending}
      />

      <DeleteConfirmDialog
        open={moveToRubbishDialogOpen}
        onOpenChange={(open) => {
          setMoveToRubbishDialogOpen(open);
          if (!open) {
            setMoveToRubbishTargetId(null);
          }
        }}
        onConfirm={() => {
          if (!moveToRubbishTargetId) return;
          moveToTrashMutation.mutate({ id: moveToRubbishTargetId });
        }}
        title="Delete invoice"
        description="Delete this draft invoice? You can restore it later from the Rubbish bin."
        confirmLabel="Delete"
        isDeleting={moveToTrashMutation.isPending}
      />

      <RevertInvoiceStatusDialog
        open={revertDialogOpen}
        onOpenChange={setRevertDialogOpen}
        currentStatus={revertTarget?.currentStatus || "open"}
        targetStatus={revertTarget?.targetStatus || "draft"}
        onConfirm={() => {
          if (!revertTarget) return;
          revertMutation.mutate({
            id: revertTarget.id,
            targetStatus: revertTarget.targetStatus,
            confirmed: true,
          });
          setRevertDialogOpen(false);
        }}
        isReverting={revertMutation.isPending}
      />

      <DeleteConfirmDialog
        open={cancellationDialogOpen}
        onOpenChange={(open) => {
          setCancellationDialogOpen(open);
          if (!open) {
            setCancellationTarget(null);
          }
        }}
        onConfirm={() => {
          if (!cancellationTarget) return;
          createCancellationMutation.mutate({ invoiceId: cancellationTarget.id });
        }}
        title="Create cancellation invoice?"
        description={`This will create a new cancellation invoice that reverses invoice ${cancellationTarget?.invoiceNumber ?? ""}. The original invoice will remain unchanged.`}
        confirmLabel="Create cancellation invoice"
        isDeleting={createCancellationMutation.isPending}
      />
    </div>
  );
}
