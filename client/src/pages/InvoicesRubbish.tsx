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

export default function InvoicesRubbish() {
  const { data: trashedInvoices = [], isLoading } = trpc.invoices.listTrashed.useQuery();
  const restoreMutation = trpc.invoices.restore.useMutation({
    onSuccess: () => toast.success("Invoice restored"),
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = trpc.invoices.delete.useMutation({
    onSuccess: () => toast.success("Invoice deleted permanently"),
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
        <div className="space-y-3">
          {trashedInvoices.map((invoice) => {
            const actions: ItemAction[] =
              invoice.status === "draft" ? ["restore", "deletePermanently"] : ["restore"];
            return (
              <Card key={invoice.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{invoice.invoiceNumber}</span>
                      {getStatusBadge(invoice.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString("de-DE") : "No date"}
                    </p>
                  </div>
                </div>
                <ItemActionsMenu
                  actions={actions}
                  onAction={(action) => handleItemAction(action, invoice.id, invoice.status)}
                />
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
        description="This action cannot be undone and may affect accounting records for accounting reasons."
        confirmLabel="Delete permanently"
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
