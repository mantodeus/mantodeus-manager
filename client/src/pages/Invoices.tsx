import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, Loader2, Upload, DocumentCurrencyEuro, DocumentCurrencyPound } from "@/components/ui/Icon";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ScrollRevealFooter } from "@/components/ScrollRevealFooter";
import { PageHeader } from "@/components/PageHeader";
import { RevertInvoiceStatusDialog } from "@/components/RevertInvoiceStatusDialog";
import { InvoiceUploadReviewDialog } from "@/components/InvoiceUploadReviewDialog";
import { useIsMobile } from "@/hooks/useMobile";
import { PDFPreviewModal } from "@/components/PDFPreviewModal";
import { Link, useLocation } from "wouter";
import { MultiSelectBar, createArchiveAction, createDeleteAction } from "@/components/MultiSelectBar";
import { BulkInvoiceUploadDialog } from "@/components/invoices/BulkInvoiceUploadDialog";

function formatCurrency(amount: number | string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(num || 0);
}

export default function Invoices() {
  const isMobile = useIsMobile();
  const [, navigate] = useLocation();
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("invoice.pdf");
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
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: invoices = [], refetch } = trpc.invoices.list.useQuery();
  const { data: needsReviewInvoices = [], refetch: refetchNeedsReview } = trpc.invoices.listNeedsReview.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: companySettings } = trpc.settings.get.useQuery();
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
      navigate(`/invoices/${data.cancellationInvoiceId}`);
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
  const duplicateInvoiceMutation = trpc.invoices.duplicate.useMutation({
    onSuccess: () => {
      toast.success("Invoice duplicated");
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
  const bulkUploadMutation = trpc.invoices.uploadInvoicesBulk.useMutation({
    onSuccess: (data) => {
      const successCount = data.success;
      const errorCount = data.errors?.length || 0;
      if (errorCount === 0) {
        toast.success(`Successfully uploaded ${successCount} invoice${successCount !== 1 ? "s" : ""}`);
      } else {
        toast.warning(
          `Uploaded ${successCount} invoice${successCount !== 1 ? "s" : ""}, ${errorCount} failed`
        );
        if (data.errors) {
          data.errors.forEach((err) => {
            toast.error(`${err.filename}: ${err.error}`);
          });
        }
      }
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => {
      toast.error("Failed to upload invoices: " + err.message);
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

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handlePreviewPDF = async (invoiceId: number, fileName: string) => {
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

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (isMobile) {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(url);
        setPreviewFileName(fileName);
        setPreviewModalOpen(true);
      } else {
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to open preview');
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

  const toggleSelection = (invoiceId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(invoices.map(i => i.id)));
  };

  const handleBatchArchive = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      archiveMutation.mutate({ id });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBatchDuplicate = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      duplicateInvoiceMutation.mutate({ id });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      moveToTrashMutation.mutate({ id });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBulkUpload = async (files: File[]) => {
    try {
      // Convert files to base64
      const fileData = await Promise.all(
        files.map(async (file) => {
          const reader = new FileReader();
          return new Promise<{
            filename: string;
            mimeType: string;
            fileSize: number;
            base64Data: string;
          }>((resolve, reject) => {
            reader.onload = () => {
              const base64 = reader.result as string;
              const base64Data = base64.split(",")[1];
              resolve({
                filename: file.name,
                mimeType: file.type,
                fileSize: file.size,
                base64Data,
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      bulkUploadMutation.mutate({ files: fileData });
    } catch (error) {
      toast.error("Failed to process files");
    }
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

  const getInvoiceIcon = () => {
    const country = companySettings?.country?.toLowerCase() || "";
    if (country === "united kingdom" || country === "uk" || country === "great britain") {
      return DocumentCurrencyPound;
    }
    // Default to Euro (Germany or any other country)
    return DocumentCurrencyEuro;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Create, edit, and manage invoices"
      />

      {/* Top-of-Page Action Row */}
      <div className="flex items-center justify-end gap-2 pb-2 border-b">
        <Button
          variant="outline"
          onClick={() => setBulkUploadOpen(true)}
          disabled={bulkUploadMutation.isPending}
          className="h-10 whitespace-nowrap"
        >
          {bulkUploadMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          Upload
        </Button>
        <Button asChild className="h-10 whitespace-nowrap">
          <Link href="/invoices/new">
            <Plus className="w-4 h-4 mr-1" />
            New
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
          <div className="grid grid-cols-1 gap-3">
            {needsReviewInvoices.map((invoice) => {
              const uploadDate = invoice.uploadedAt || invoice.uploadDate || invoice.createdAt;
              const uploadDateLabel = uploadDate ? new Date(uploadDate).toLocaleDateString("de-DE") : "Unknown date";
              const displayName =
                invoice.invoiceName ||
                (invoice.filename ? invoice.filename.replace(/\.[^/.]+$/, "") : null) ||
                "Untitled invoice";
              const displayTotal = formatCurrency(invoice.total);
              return (
                <Card key={`needs-review-${invoice.id}`} className="p-3 sm:p-4 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {(() => {
                        const InvoiceIcon = getInvoiceIcon();
                        return <InvoiceIcon className="w-5 h-5 text-accent mt-0.5 shrink-0" />;
                      })()}
                      <div className="min-w-0">
                        <div className="font-light text-base leading-tight break-words">{displayName}</div>
                        <div className="text-xs text-muted-foreground">Uploaded {uploadDateLabel}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="text-sm font-light">{displayTotal}</div>
                      <Badge variant="outline" className="text-xs">NEEDS REVIEW</Badge>
                      <Badge variant="secondary" className="text-xs">UPLOADED</Badge>
                      <ItemActionsMenu
                        actions={["edit", "duplicate", "select", "archive", "delete"]}
                        onAction={(action) => {
                          if (action === "edit") {
                            // "Edit" maps to "review" for needs-review invoices
                            setUploadedInvoiceId(invoice.id);
                            setUploadedParsedData(null);
                            setUploadReviewDialogOpen(true);
                          }
                          if (action === "duplicate") {
                            toast.info("Duplicate is coming soon.");
                          }
                          if (action === "select") {
                            toast.info("Selection mode is coming soon.");
                          }
                          if (action === "archive") {
                            toast.info("Archive is coming soon.");
                          }
                          if (action === "delete") {
                            setNeedsReviewDeleteTarget({ id: invoice.id, name: displayName });
                          }
                        }}
                      />
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
            const isPaid = Boolean(invoice.paidAt);
            const isOpen = Boolean(invoice.sentAt) && !invoice.paidAt;
            const isDraft = !invoice.sentAt && !invoice.paidAt && invoice.status === "draft";
            const isStandard = invoice.type !== "cancellation";
            const hasInvoiceNumber = Boolean(invoice.invoiceNumber);
            const canCancel = isStandard && hasInvoiceNumber && invoice.source !== "uploaded" && !invoice.hasCancellation && (isOpen || isPaid);
            const displayName = invoice.invoiceName || invoice.invoiceNumber || "Untitled invoice";
            const displayTotal = formatCurrency(invoice.total);
            // Use standard menu actions - map invoice-specific actions to standard ones
            const availableActions: ItemAction[] = ["edit", "duplicate", "select", "archive", "delete"];

            const handleCardClick = () => {
              if (isMultiSelectMode) {
                toggleSelection(invoice.id);
              } else {
                // For uploaded invoices that have been saved once (draft mode), open review dialog
                if (invoice.source === "uploaded" && invoice.status === "draft") {
                  setUploadedInvoiceId(invoice.id);
                  setUploadedParsedData(null);
                  setUploadReviewDialogOpen(true);
                } else {
                  navigate(`/invoices/${invoice.id}`);
                }
              }
            };

            return (
              <div
                key={invoice.id}
                onClick={handleCardClick}
                className={`${isMultiSelectMode ? "cursor-pointer" : ""} ${selectedIds.has(invoice.id) ? "item-selected rounded-lg" : ""}`}
              >
                <Card className="p-3 sm:p-4 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {(() => {
                        const InvoiceIcon = getInvoiceIcon();
                        return <InvoiceIcon className="w-5 h-5 text-accent mt-0.5 shrink-0" />;
                      })()}
                      <div className="min-w-0">
                        <div className="font-light text-base leading-tight break-words">{displayName}</div>
                        {linkedContact && (
                          <div className="text-xs text-muted-foreground truncate">{linkedContact.name}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {issueDate ? issueDate.toLocaleDateString("de-DE") : "No date"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="text-sm font-light">{displayTotal}</div>
                      {getStatusBadge(invoice)}
                      {invoice.type === "cancellation" && (
                        <Badge variant="outline" className="text-xs">STORNO</Badge>
                      )}
                      {!isMultiSelectMode && (
                        <ItemActionsMenu
                          actions={availableActions}
                          onAction={(action) => {
                            if (action === "edit") {
                              // "Edit" navigates to invoice detail page
                              navigate(`/invoices/${invoice.id}`);
                            }
                            if (action === "duplicate") {
                              duplicateInvoiceMutation.mutate({ id: invoice.id });
                            }
                            if (action === "select") {
                              setIsMultiSelectMode(true);
                              setSelectedIds(new Set([invoice.id]));
                            }
                            if (action === "archive") {
                              handleArchiveInvoice(invoice.id);
                            }
                            if (action === "delete") {
                              // "Delete" maps to "moveToTrash" for invoices
                              if (isDraft) {
                                handleMoveToRubbish(invoice.id);
                              } else {
                                toast.info("Only draft invoices can be deleted. Use Archive for sent invoices.");
                              }
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Multi-select bar */}
      {isMultiSelectMode && (
        <MultiSelectBar
          selectedCount={selectedIds.size}
          totalCount={invoices.length}
          onSelectAll={handleSelectAll}
          onDuplicate={handleBatchDuplicate}
          onArchive={handleBatchArchive}
          onDelete={handleBatchDelete}
          onCancel={() => {
            setIsMultiSelectMode(false);
            setSelectedIds(new Set());
          }}
        />
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
        description="Delete this draft invoice? You can restore it later from the Rubbish."
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

      {/* Bulk Upload Dialog */}
      <BulkInvoiceUploadDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onUpload={handleBulkUpload}
        isUploading={bulkUploadMutation.isPending}
      />
    </div>
  );
}
