import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, Eye, Edit, Send, Trash2, Loader2, PencilLine, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ItemActionsMenu } from "@/components/ItemActionsMenu";
import { Switch } from "@/components/ui/switch";

interface InvoiceLineItem {
  name: string;
  description?: string | null;
  category?: string | null;
  quantity: number;
  unitPrice: number;
  currency: string;
  lineTotal?: number;
}

interface InvoiceFormState {
  invoiceNumber: string;
  clientId?: string;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  servicePeriodStart?: string;
  servicePeriodEnd?: string;
  referenceNumber?: string;
  partialInvoice: boolean;
}

const defaultLineItem: InvoiceLineItem = {
  name: "",
  description: "",
  category: "",
  quantity: 1,
  unitPrice: 0,
  currency: "EUR",
};

function formatCurrency(amount: number | string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(num || 0);
}

export default function Invoices() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<number | null>(null);

  const { data: invoices = [], refetch } = trpc.invoices.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const issueMutation = trpc.invoices.issue.useMutation({
    onSuccess: () => {
      toast.success("Invoice sent");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.invoices.delete.useMutation({
    onSuccess: () => {
      toast.success("Invoice deleted");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePreviewPDF = (invoiceId: number) => {
    window.open(`/api/invoices/${invoiceId}/pdf?preview=true`, "_blank");
  };

  const handleIssueInvoice = async (invoiceId: number) => {
    if (!confirm("Send this invoice? This locks the invoice number.")) return;
    await issueMutation.mutateAsync({ id: invoiceId });
  };

  const handleDeleteInvoice = async (invoiceId: number) => {
    if (!confirm("Are you sure you want to delete this draft invoice?")) return;
    await deleteMutation.mutateAsync({ id: invoiceId });
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-regular">Invoices</h1>
          <p className="text-muted-foreground text-sm">Create, edit, and manage invoices</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[min(1100px,95vw)] max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <InvoiceForm
              mode="create"
              contacts={contacts}
              onClose={() => setCreateDialogOpen(false)}
              onSuccess={() => {
                toast.success("Invoice created");
                setCreateDialogOpen(false);
                refetch();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

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
                    actions={invoice.status === "draft" ? ["edit", "delete"] : ["delete"]}
                    onAction={(action) => {
                      if (action === "delete") handleDeleteInvoice(invoice.id);
                      if (action === "edit" && invoice.status === "draft") {
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
                  <div className="flex justify-between font-medium">
                    <span>Total:</span>
                    <span>{formatCurrency(invoice.total)}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-auto">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handlePreviewPDF(invoice.id)}>
                    <Eye className="w-4 h-4 mr-2" />
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
          <DialogContent className="w-[min(1100px,95vw)] max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Invoice</DialogTitle>
            </DialogHeader>
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
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function InvoiceForm({
  mode,
  invoiceId,
  contacts,
  onClose,
  onSuccess,
}: {
  mode: "create" | "edit";
  invoiceId?: number;
  contacts: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isCreate = mode === "create";
  const [formState, setFormState] = useState<InvoiceFormState>(() => ({
    invoiceNumber: "",
    clientId: undefined,
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: undefined,
    notes: "",
    servicePeriodStart: undefined,
    servicePeriodEnd: undefined,
    referenceNumber: "",
    partialInvoice: false,
  }));
  const [items, setItems] = useState<InvoiceLineItem[]>([defaultLineItem]);
  const [itemEditor, setItemEditor] = useState<{ open: boolean; index: number | null }>({ open: false, index: null });

  const nextNumberQuery = trpc.invoices.nextNumber.useQuery({ issueDate: new Date(formState.issueDate) }, { enabled: isCreate });
  const getInvoiceQuery = trpc.invoices.get.useQuery({ id: invoiceId! }, { enabled: !isCreate && !!invoiceId });

  useEffect(() => {
    if (isCreate && nextNumberQuery.data?.invoiceNumber) {
      setFormState((prev) => ({ ...prev, invoiceNumber: nextNumberQuery.data!.invoiceNumber }));
    }
  }, [isCreate, nextNumberQuery.data]);

  useEffect(() => {
    if (!isCreate && getInvoiceQuery.data) {
      const invoice = getInvoiceQuery.data;
      setFormState({
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId ? String(invoice.clientId) : invoice.contactId ? String(invoice.contactId) : undefined,
        issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split("T")[0] : undefined,
        notes: invoice.notes || "",
        servicePeriodStart: invoice.servicePeriodStart
          ? new Date(invoice.servicePeriodStart).toISOString().split("T")[0]
          : undefined,
        servicePeriodEnd: invoice.servicePeriodEnd
          ? new Date(invoice.servicePeriodEnd).toISOString().split("T")[0]
          : undefined,
        referenceNumber: invoice.referenceNumber || "",
        partialInvoice: Boolean(invoice.partialInvoice),
      });
      const normalizedItems = (invoice.items as InvoiceLineItem[]).map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        currency: item.currency || "EUR",
      }));
      setItems(normalizedItems.length ? normalizedItems : [defaultLineItem]);
    }
  }, [getInvoiceQuery.data, isCreate]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
    return {
      subtotal,
      vat: 0,
      total: subtotal,
    };
  }, [items]);

  const createMutation = trpc.invoices.create.useMutation({
    onSuccess,
    onError: (err) => toast.error(err.message || "Failed to save invoice"),
  });

  const updateMutation = trpc.invoices.update.useMutation({
    onSuccess,
    onError: (err) => toast.error(err.message || "Failed to save invoice"),
  });

  const invoice = getInvoiceQuery.data ?? null;

  if (!isCreate && !invoice) {
    return <div className="text-sm text-muted-foreground">Loading invoice...</div>;
  }

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const isDraft = isCreate || invoice?.status === "draft";

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.invoiceNumber.trim()) {
      toast.error("Invoice number is required");
      return;
    }
    const validItems = items.filter((item) => item.name && item.quantity > 0);
    if (!validItems.length) {
      toast.error("Add at least one line item");
      return;
    }

    const payload = {
      invoiceNumber: formState.invoiceNumber.trim(),
      clientId: formState.clientId ? parseInt(formState.clientId) : undefined,
      issueDate: new Date(formState.issueDate),
      dueDate: formState.dueDate ? new Date(formState.dueDate) : undefined,
      notes: formState.notes?.trim() || undefined,
      servicePeriodStart: formState.servicePeriodStart ? new Date(formState.servicePeriodStart) : undefined,
      servicePeriodEnd: formState.servicePeriodEnd ? new Date(formState.servicePeriodEnd) : undefined,
      referenceNumber: formState.referenceNumber?.trim() || undefined,
      partialInvoice: formState.partialInvoice,
      items: validItems.map((item) => ({
        name: item.name,
        description: item.description || undefined,
        category: item.category || undefined,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        currency: item.currency || "EUR",
      })),
    };

    if (isCreate) {
      createMutation.mutate(payload);
    } else if (invoiceId) {
      updateMutation.mutate({ id: invoiceId, ...payload });
    }
  };

  const openItemEditor = (index: number | null = null) => setItemEditor({ open: true, index });
  const closeItemEditor = () => setItemEditor({ open: false, index: null });

  const handleSaveItem = (item: InvoiceLineItem) => {
    if (itemEditor.index === null) {
      setItems((prev) => [...prev, item]);
    } else {
      setItems((prev) => prev.map((existing, idx) => (idx === itemEditor.index ? item : existing)));
    }
    closeItemEditor();
  };

  const editingItem = itemEditor.index !== null ? items[itemEditor.index] : defaultLineItem;

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input
                value={formState.invoiceNumber}
                onChange={(e) => setFormState((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                placeholder="RE-2025-0007"
                disabled={!isDraft}
              />
              <p className="text-xs text-muted-foreground">
                Invoice numbers must be unique and sequential (German tax requirement).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Client (optional)</Label>
              <Select
                value={formState.clientId ?? "none"}
                onValueChange={(val) => setFormState((prev) => ({ ...prev, clientId: val === "none" ? undefined : val }))}
                disabled={!isDraft}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={String(contact.id)}>
                      {contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <Input
                type="date"
                value={formState.issueDate}
                onChange={(e) => setFormState((prev) => ({ ...prev, issueDate: e.target.value }))}
                disabled={!isDraft}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={formState.dueDate ?? ""}
                onChange={(e) => setFormState((prev) => ({ ...prev, dueDate: e.target.value || undefined }))}
                disabled={!isDraft}
              />
            </div>
            <div className="space-y-2">
              <Label>Order / Reference Number</Label>
              <Input
                value={formState.referenceNumber ?? ""}
                onChange={(e) => setFormState((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                placeholder="Optional reference"
                disabled={!isDraft}
              />
            </div>
          </div>
        </div>
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div>
            <div className="flex items-center justify-between">
              <Label>Service Period</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <Input
                type="date"
                value={formState.servicePeriodStart ?? ""}
                onChange={(e) => setFormState((prev) => ({ ...prev, servicePeriodStart: e.target.value || undefined }))}
                disabled={!isDraft}
              />
              <Input
                type="date"
                value={formState.servicePeriodEnd ?? ""}
                onChange={(e) => setFormState((prev) => ({ ...prev, servicePeriodEnd: e.target.value || undefined }))}
                disabled={!isDraft}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Partial Invoice</Label>
              <p className="text-xs text-muted-foreground">Flag invoice as partial (future use).</p>
            </div>
            <Switch
              checked={formState.partialInvoice}
              onCheckedChange={(val) => setFormState((prev) => ({ ...prev, partialInvoice: val }))}
              disabled={!isDraft}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Line Items</Label>
            <p className="text-xs text-muted-foreground">Add services or products via the dedicated modal.</p>
          </div>
          {isDraft && (
            <Button type="button" variant="outline" onClick={() => openItemEditor(null)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Line Item
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((item, index) => (
            <Card key={index} className="p-3 flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{item.name || "Untitled"}</p>
                  {item.category && <Badge variant="outline">{item.category}</Badge>}
                </div>
                {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                <p className="text-sm text-muted-foreground">
                  {item.quantity} × {formatCurrency(item.unitPrice)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{formatCurrency(item.quantity * item.unitPrice)}</p>
                {isDraft && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openItemEditor(index)}>
                      <PencilLine className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      disabled={items.length === 1}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Notes (optional)</Label>
        <Textarea
          value={formState.notes ?? ""}
          onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional notes or terms"
          disabled={!isDraft}
        />
      </div>

      <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{formatCurrency(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>VAT (pending)</span>
          <span>{formatCurrency(totals.vat)}</span>
        </div>
        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{formatCurrency(totals.total)}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading || !isDraft}>
          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {isCreate ? "Save Invoice (Draft)" : "Save Changes"}
        </Button>
      </div>

      <LineItemModal
        open={itemEditor.open}
        onOpenChange={(open) => (open ? openItemEditor(itemEditor.index) : closeItemEditor())}
        item={editingItem}
        onSave={handleSaveItem}
      />
    </form>
  );
}

function LineItemModal({
  open,
  onOpenChange,
  item,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InvoiceLineItem;
  onSave: (item: InvoiceLineItem) => void;
}) {
  const [draft, setDraft] = useState<InvoiceLineItem>(item);

  useEffect(() => {
    setDraft(item);
  }, [item]);

  const lineTotal = useMemo(() => Number(draft.quantity || 0) * Number(draft.unitPrice || 0), [draft]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    onSave({ ...draft, lineTotal });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Line Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Item Name</Label>
            <Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div>
            <Label>Item Description (optional)</Label>
            <Textarea
              value={draft.description ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              rows={2}
            />
          </div>
          <div>
            <Label>Category (optional)</Label>
            <Input
              value={draft.category ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="Consulting, Materials, ..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unit Price</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={draft.unitPrice}
                onChange={(e) => setDraft((prev) => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={draft.quantity}
                onChange={(e) => setDraft((prev) => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div>
            <Label>Currency</Label>
            <Input value={draft.currency} disabled />
          </div>
          <div className="flex justify-between items-center p-3 bg-muted rounded-md">
            <span className="text-sm text-muted-foreground">Line Total</span>
            <span className="text-lg font-semibold">{formatCurrency(lineTotal)}</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save Item
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
