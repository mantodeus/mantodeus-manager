import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Trash2, ArrowLeft, Loader2, FileText } from "lucide-react";
import { useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { Link } from "wouter";

function formatCurrency(amount: number | string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(num || 0);
}

export default function InvoicesRubbish() {
  const { data: trashedInvoices = [], isLoading } = trpc.invoices.listTrashed.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const utils = trpc.useUtils();
  const restoreMutation = trpc.invoices.restore.useMutation({
    onSuccess: () => {
      toast.success("Invoice restored");
      utils.invoices.listTrashed.invalidate();
      utils.invoices.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = trpc.invoices.delete.useMutation({
    onSuccess: () => {
      toast.success("Invoice deleted permanently");
      utils.invoices.listTrashed.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

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

  const handleItemAction = (action: ItemAction, invoiceId: number, status: string) => {
    switch (action) {
      case "restore":
        restoreMutation.mutate({ id: invoiceId });
        break;
      case "deletePermanently":
        if (status !== "draft") return;
        setDeleteTargetId(invoiceId);
        setDeleteDialogOpen(true);
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
            <Trash2 className="h-8 w-8 text-muted-foreground" />
            Rubbish Bin
          </span>
        }
        subtitle="Deleted invoices. Items here can be restored or permanently deleted."
        leading={
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
      />

      {trashedInvoices.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Rubbish bin is empty.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trashedInvoices.map((invoice) => {
            const linkedContact = contacts.find(
              (contact: { id: number }) => contact.id === invoice.clientId || contact.id === invoice.contactId
            );
            const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : null;
            const displayName = invoice.invoiceName || invoice.invoiceNumber || "Untitled invoice";
            const displayTotal = formatCurrency(invoice.total);
            const actions: ItemAction[] =
              invoice.status === "draft" ? ["restore", "deletePermanently"] : ["restore"];

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
                      onAction={(action) => handleItemAction(action, invoice.id, invoice.status)}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteTargetId(null);
          }
        }}
        onConfirm={() => {
          if (!deleteTargetId) return;
          deleteMutation.mutate({ id: deleteTargetId });
        }}
        title="Delete permanently"
        description="This action is PERMANENT and cannot be undone. The invoice will be deleted forever."
        confirmLabel="Delete permanently"
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
