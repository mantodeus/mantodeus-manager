import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, Archive, ArrowLeft, Loader2 } from "@/components/ui/Icon";
import { useEffect, useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { PDFPreviewModal } from "@/components/PDFPreviewModal";
import { useIsMobile } from "@/hooks/useMobile";
import { Link } from "wouter";

function formatCurrency(amount: number | string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(num || 0);
}

export default function InvoicesArchived() {
  const isMobile = useIsMobile();
  const { data: archivedInvoices = [], isLoading } = trpc.invoices.listArchived.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const utils = trpc.useUtils();
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("invoice.pdf");
  const [moveToRubbishDialogOpen, setMoveToRubbishDialogOpen] = useState(false);
  const [moveToRubbishTargetId, setMoveToRubbishTargetId] = useState<number | null>(null);

  const restoreMutation = trpc.invoices.restore.useMutation({
    onSuccess: () => {
      toast.success("Invoice restored");
      utils.invoices.listArchived.invalidate();
      utils.invoices.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const moveToTrashMutation = trpc.invoices.moveToTrash.useMutation({
    onSuccess: () => {
      toast.success("Invoice deleted");
      utils.invoices.listArchived.invalidate();
      utils.invoices.listTrashed.invalidate();
    },
    onError: (error) => toast.error(error.message),
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
      const { data: { session } } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());

      if (!session?.access_token) {
        toast.error("Please log in to preview invoices");
        return;
      }

      const response = await fetch(`/api/invoices/${invoiceId}/pdf?preview=true`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        toast.error(errorData.error || "Failed to generate preview");
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
      console.error("Preview error:", error);
      toast.error("Failed to open preview");
    }
  };

  const getStatusBadge = (invoice: any) => {
    const { status, sentAt, paidAt, dueDate } = invoice;

    if (status === 'paid') {
      return <Badge variant="secondary" className="text-xs">PAID</Badge>;
    }

    if (status === 'open' && sentAt) {
      if (dueDate && new Date(dueDate) < new Date() && !paidAt) {
        return <Badge variant="destructive" className="text-xs">OVERDUE</Badge>;
      }
      return <Badge variant="default" className="text-xs">SENT</Badge>;
    }

    if (status === 'open' && !sentAt) {
      return <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">NOT SENT</Badge>;
    }

    return <Badge variant="outline" className="text-xs">DRAFT</Badge>;
  };

  const handleItemAction = (action: ItemAction, invoiceId: number, status: string, fileName: string) => {
    switch (action) {
      case "view":
        handlePreviewPDF(invoiceId, fileName);
        break;
      case "restore":
        restoreMutation.mutate({ id: invoiceId });
        break;
      case "duplicate":
        toast.info("Duplicate is coming soon.");
        break;
      case "moveToTrash":
        if (status !== "draft") return;
        setMoveToRubbishTargetId(invoiceId);
        setMoveToRubbishDialogOpen(true);
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Archive className="h-8 w-8 text-muted-foreground" />
            Archived Invoices
          </span>
        }
        subtitle="Invoices you've archived. You can restore them anytime."
        leading={
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
      />

      {archivedInvoices.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No archived invoices.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {archivedInvoices.map((invoice) => {
            const linkedContact = contacts.find(
              (contact: { id: number }) => contact.id === invoice.clientId || contact.id === invoice.contactId
            );
            const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : null;
            const displayName = invoice.invoiceName || invoice.invoiceNumber || "Untitled invoice";
            const displayTotal = formatCurrency(invoice.total);
            const actions: ItemAction[] =
              invoice.status === "draft" ? ["view", "restore", "moveToTrash"] : ["view", "restore"];

            return (
              <Card key={invoice.id} className="p-3 sm:p-4 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-base leading-tight break-words">{displayName}</div>
                      {linkedContact && (
                        <div className="text-xs text-muted-foreground truncate">{linkedContact.name}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {issueDate ? issueDate.toLocaleDateString("de-DE") : "No date"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="text-sm font-semibold">{displayTotal}</div>
                    {getStatusBadge(invoice)}
                    <ItemActionsMenu
                      actions={actions}
                      onAction={(action) => handleItemAction(action, invoice.id, invoice.status, `${displayName}.pdf`)}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

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
