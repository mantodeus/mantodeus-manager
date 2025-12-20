import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, Eye, Edit, Send, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function Invoices() {
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<number | null>(null);
  const [contactFilter, setContactFilter] = useState<string>("");

  const { data: invoices = [], refetch } = trpc.invoices.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  
  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: () => {
      toast.success("Invoice created");
      setCreateDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create invoice");
    },
  });

  const updateMutation = trpc.invoices.update.useMutation({
    onSuccess: () => {
      toast.success("Invoice updated");
      setEditDialogOpen(false);
      setEditingInvoice(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update invoice");
    },
  });

  const issueMutation = trpc.invoices.issue.useMutation({
    onSuccess: () => {
      toast.success("Invoice issued successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to issue invoice");
    },
  });

  const deleteMutation = trpc.invoices.delete.useMutation({
    onSuccess: () => {
      toast.success("Invoice deleted");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete invoice");
    },
  });

  const filteredInvoices = invoices.filter((invoice) => {
    if (contactFilter && invoice.contactId !== parseInt(contactFilter)) return false;
    return true;
  });

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(num);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      issued: "default",
      paid: "secondary",
      cancelled: "destructive",
    };
    return (
      <Badge variant={variants[status] || "default"} className="text-xs">
        {status.toUpperCase()}
      </Badge>
    );
  };

  const handlePreviewPDF = (invoiceId: number) => {
    window.open(`/api/invoices/${invoiceId}/pdf?preview=true`, "_blank");
  };

  const handleIssueInvoice = async (invoiceId: number) => {
    if (!confirm("Are you sure you want to issue this invoice? It will be locked and cannot be edited.")) {
      return;
    }
    await issueMutation.mutateAsync({ id: invoiceId });
  };

  const handleEditInvoice = (invoice: typeof invoices[0]) => {
    if (invoice.status !== "draft") {
      toast.error("Only draft invoices can be edited");
      return;
    }
    setEditingInvoice(invoice.id);
    setEditDialogOpen(true);
  };

  const handleDeleteInvoice = async (invoiceId: number) => {
    if (!confirm("Are you sure you want to delete this invoice?")) {
      return;
    }
    await deleteMutation.mutateAsync({ id: invoiceId });
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <CreateInvoiceForm
              contacts={contacts}
              onSubmit={(data) => {
                createMutation.mutate(data);
              }}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <Label className="mb-2">Filter by Contact</Label>
          <Select value={contactFilter || "all"} onValueChange={(val) => setContactFilter(val === "all" ? "" : val)}>
            <SelectTrigger>
              <SelectValue placeholder="All contacts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All contacts</SelectItem>
              {contacts.map((contact) => (
                <SelectItem key={contact.id} value={String(contact.id)}>
                  {contact.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No invoices found. Create your first invoice to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInvoices.map((invoice) => {
            const linkedContact = contacts.find((c) => c.id === invoice.contactId);
            const items = (invoice.items as InvoiceItem[]) || [];

            return (
              <Card key={invoice.id} className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-accent" />
                      <h3 className="font-regular text-lg">
                        {invoice.invoiceNumber || `Draft #${invoice.id}`}
                      </h3>
                      {getStatusBadge(invoice.status)}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(invoice.invoiceDate)}
                      {invoice.dueDate && ` • Due: ${formatDate(invoice.dueDate)}`}
                    </p>
                  </div>
                  <ItemActionsMenu
                    onAction={(action) => {
                      if (action === "delete") handleDeleteInvoice(invoice.id);
                      else if (action === "edit") handleEditInvoice(invoice);
                    }}
                    actions={invoice.status === "draft" ? ["edit", "delete"] : ["delete"]}
                  />
                </div>

                {linkedContact && (
                  <div className="text-sm text-muted-foreground mb-2">
                    <span className="font-medium">Client:</span> {linkedContact.name}
                  </div>
                )}

                <div className="space-y-1 text-sm mb-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items:</span>
                    <span>{items.length}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Total:</span>
                    <span>{formatCurrency(invoice.total)}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handlePreviewPDF(invoice.id)}
                  >
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
                      Issue
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editingInvoice && (
        <EditInvoiceDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingInvoice(null);
          }}
          invoiceId={editingInvoice}
          contacts={contacts}
          onSuccess={() => {
            setEditDialogOpen(false);
            setEditingInvoice(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function CreateInvoiceForm({
  contacts,
  onSubmit,
  isLoading,
}: {
  contacts: Array<{ id: number; name: string }>;
  onSubmit: (data: {
    contactId?: number;
    items: InvoiceItem[];
    notes?: string;
    dueDate?: Date;
  }) => void;
  isLoading: boolean;
}) {
  const [contactId, setContactId] = useState<string>("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((item) => item.description && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error("Please add at least one invoice item");
      return;
    }
    onSubmit({
      contactId: contactId ? parseInt(contactId) : undefined,
      items: validItems,
      notes: notes || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="contact">Client (optional)</Label>
        <Select value={contactId || "none"} onValueChange={(val) => setContactId(val === "none" ? "" : val)}>
          <SelectTrigger>
            <SelectValue placeholder="Select a client..." />
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

      <div>
        <Label>Invoice Items</Label>
        <div className="space-y-2 mt-2">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(index, "description", e.target.value)}
                />
              </div>
              <div className="w-20">
                <Input
                  type="number"
                  placeholder="Qty"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  placeholder="Price"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="w-24 text-sm text-muted-foreground flex items-center h-10">
                €{item.total.toFixed(2)}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem(index)}
                disabled={items.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItem} className="mt-2">
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input
          id="notes"
          placeholder="Additional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="dueDate">Due Date (optional)</Label>
        <Input
          id="dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          "Create Invoice"
        )}
      </Button>
    </form>
  );
}

function EditInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
  contacts,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: number;
  contacts: Array<{ id: number; name: string }>;
  onSuccess: () => void;
}) {
  const { data: invoice } = trpc.invoices.get.useQuery({ id: invoiceId }, { enabled: open });
  const updateMutation = trpc.invoices.update.useMutation({
    onSuccess: () => {
      toast.success("Invoice updated");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update invoice");
    },
  });

  if (!invoice) return null;

  const items = (invoice.items as InvoiceItem[]) || [];
  const [contactId, setContactId] = useState<string>(invoice.contactId ? String(invoice.contactId) : "");
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>(items);
  const [notes, setNotes] = useState(invoice.notes || "");
  const [dueDate, setDueDate] = useState(
    invoice.dueDate ? new Date(invoice.dueDate).toISOString().split("T")[0] : ""
  );

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...invoiceItems];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }
    setInvoiceItems(newItems);
  };

  const addItem = () => {
    setInvoiceItems([...invoiceItems, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = invoiceItems.filter((item) => item.description && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error("Please add at least one invoice item");
      return;
    }
    updateMutation.mutate({
      id: invoiceId,
      contactId: contactId ? parseInt(contactId) : null,
      items: validItems,
      notes: notes || null,
      dueDate: dueDate ? new Date(dueDate) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="contact">Client</Label>
            <Select value={contactId || "none"} onValueChange={(val) => setContactId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client..." />
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

          <div>
            <Label>Invoice Items</Label>
            <div className="space-y-2 mt-2">
              {invoiceItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      placeholder="Qty"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      placeholder="Price"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-24 text-sm text-muted-foreground flex items-center h-10">
                    €{item.total.toFixed(2)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={invoiceItems.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="mt-2">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
