import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, Eye, Loader2, Archive, ArrowLeft } from "lucide-react";
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

export default function InvoicesArchived() {
  const { data: archivedInvoices = [], isLoading } = trpc.invoices.listArchived.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const [previewingInvoice, setPreviewingInvoice] = useState<number | null>(null);
  const [moveToRubbishDialogOpen, setMoveToRubbishDialogOpen] = useState(false);
  const [moveToRubbishTargetId, setMoveToRubbishTargetId] = useState<number | null>(null);

  const restoreMutation = trpc.invoices.restore.useMutation({
    onSuccess: () => toast.success("Invoice restored"),
    onError: (error) => toast.error(error.message),
  });

  const moveToTrashMutation = trpc.invoices.moveToTrash.useMutation({
    onSuccess: () => toast.success("Invoice moved to the Rubbish bin"),
    onError: (error) => toast.error(error.message),
  });

  const handlePreviewPDF = async (invoiceId: number) => {
    setPreviewingInvoice(invoiceId);
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
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("Preview error:", error);
      toast.error("Failed to open preview");
    } finally {
      setPreviewingInvoice(null);
    }
  };

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
      <div className="flex items-center gap-4">
        <Link href="/invoices">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-regular flex items-center gap-3">
            <Archive className="h-8 w-8 text-muted-foreground" />
            Archived Invoices
          </h1>
          <p className="text-muted-foreground text-sm">Invoices you've archived. You can restore them anytime.</p>
        </div>
      </div>

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
            const items = (invoice.items as InvoiceLineItem[]) || [];
            const actions: ItemAction[] =
              invoice.status === "draft" ? ["restore", "duplicate", "moveToTrash"] : ["restore", "duplicate"];

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
        title="Move to Rubbish bin"
        description="Move this draft invoice to the Rubbish bin? You can restore it later if needed."
        confirmLabel="Move to Rubbish bin"
        isDeleting={moveToTrashMutation.isPending}
      />
    </div>
  );
}
