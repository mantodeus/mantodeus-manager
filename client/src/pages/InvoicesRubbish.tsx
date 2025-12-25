import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Trash2, ArrowLeft, Loader2, FileText } from "lucide-react";
import { useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Link } from "wouter";

interface InvoiceLineItem {
  name: string;
  description?: string | null;
  category?: string | null;
  quantity: number;
  unitPrice: number;
  currency: string;
  lineTotal?: number;
}

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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      sent: "default",
      paid: "secondary",
    };
    return (
      <Badge variant={variants[status] || "default"} className="text-xs">
        {status.toUpperCase()}
      </Badge>
    );
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
      <div className="flex items-center gap-4">
        <Link href="/invoices">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-regular flex items-center gap-3">
            <Trash2 className="h-8 w-8 text-muted-foreground" />
            Rubbish Bin
          </h1>
          <p className="text-muted-foreground text-sm">Deleted invoices. Items here can be restored or permanently deleted.</p>
        </div>
      </div>

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
            const items = (invoice.items as InvoiceLineItem[]) || [];
            const actions: ItemAction[] =
              invoice.status === "draft" ? ["restore", "deletePermanently"] : ["restore"];

            return (
              <Card key={invoice.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-accent" />
                      <h3 className="font-regular text-lg">{invoice.invoiceNumber}</h3>
                      {getStatusBadge(invoice.status)}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {issueDate ? issueDate.toLocaleDateString("de-DE") : "No date"}
                      {invoice.dueDate ? ` • Due: ${new Date(invoice.dueDate).toLocaleDateString("de-DE")}` : ""}
                    </p>
                    {linkedContact && (
                      <p className="text-xs text-muted-foreground mt-1">Client: {linkedContact.name}</p>
                    )}
                  </div>
                  <ItemActionsMenu
                    actions={actions}
                    onAction={(action) => handleItemAction(action, invoice.id, invoice.status)}
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
