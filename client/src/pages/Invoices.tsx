import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, Eye, Send, Loader2, PencilLine, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ItemActionsMenu } from "@/components/ItemActionsMenu";
import { Switch } from "@/components/ui/switch";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ScrollRevealFooter } from "@/components/ScrollRevealFooter";
import { Checkbox } from "@/components/ui/checkbox";
import { RevertInvoiceStatusDialog } from "@/components/RevertInvoiceStatusDialog";
import { useIsMobile } from "@/hooks/useMobile";

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
  const isMobile = useIsMobile();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<number | null>(null);
  const [previewingInvoice, setPreviewingInvoice] = useState<number | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);
  const [moveToRubbishDialogOpen, setMoveToRubbishDialogOpen] = useState(false);
  const [moveToRubbishTargetId, setMoveToRubbishTargetId] = useState<number | null>(null);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState<{ id: number; targetStatus: "draft" | "open"; currentStatus: "open" | "paid" } | null>(null);

  const { data: invoices = [], refetch } = trpc.invoices.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const issueMutation = trpc.invoices.issue.useMutation({
    onSuccess: () => {
      toast.success("Invoice sent");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const markAsPaidMutation = trpc.invoices.markAsPaid.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as paid");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const archiveMutation = trpc.invoices.archive.useMutation({
    onSuccess: () => {
      toast.success("Invoice archived");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const moveToTrashMutation = trpc.invoices.moveToTrash.useMutation({
    onSuccess: () => {
      toast.success("Invoice deleted");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const revertMutation = trpc.invoices.revertStatus.useMutation({
    onSuccess: () => {
      toast.success("Invoice status reverted");
      refetch();
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
          <DialogContent 
            className="!fixed !inset-y-0 !right-0 !left-0 lg:!left-[var(--sidebar-width)] !m-0 !p-0 !w-auto !max-w-none !h-auto !translate-x-0 !translate-y-0 !top-0 !rounded-none border-l border-border bg-background shadow-xl flex flex-col data-[state=open]:!zoom-in-100"
            style={{ left: isMobile ? 0 : 'var(--sidebar-width)' }}
            showCloseButton={false}
          >
            <div className="flex h-full flex-col">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-4">
                <DialogTitle className="text-lg font-semibold">Create Invoice</DialogTitle>
                <DialogClose className="ring-offset-background focus:ring-ring rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-5xl p-6">
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
                </div>
              </div>
            </div>
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
            const isPaid = Boolean(invoice.paidAt);
            const isOpen = Boolean(invoice.sentAt) && !invoice.paidAt;
            const isDraft = !invoice.sentAt && !invoice.paidAt && invoice.status === "draft";
            const availableActions = isDraft
              ? ["edit", "duplicate", "archive", "moveToTrash"]
              : isOpen
              ? ["view", "markAsPaid", "archive", "revertToDraft", "duplicate"]
              : isPaid
              ? ["view", "archive", "revertToSent", "duplicate"]
              : ["view", "archive", "duplicate"];

            return (
              <Card key={invoice.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-accent" />
                      <h3 className="font-regular text-lg">{invoice.invoiceNumber}</h3>
                      {getStatusBadge(invoice)}
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
                  />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ScrollRevealFooter basePath="/invoices" />

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
    <form onSubmit={handleSave} className="space-y-8 max-w-full overflow-x-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="lg:col-span-4 space-y-4 rounded-lg border bg-muted/30 p-4">
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
        <div className="space-y-2">
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 lg:px-2 text-xs font-medium text-muted-foreground">
            <div className="lg:col-span-5">Item</div>
            <div className="lg:col-span-2">Category</div>
            <div className="lg:col-span-1 text-right">Qty</div>
            <div className="lg:col-span-2 text-right">Unit Price</div>
            <div className="lg:col-span-1 text-right">Total</div>
            <div className="lg:col-span-1 text-right">Actions</div>
          </div>
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border bg-background p-3 lg:grid lg:grid-cols-12 lg:items-center lg:gap-4 lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b lg:px-2 lg:py-3"
            >
              <div className="lg:col-span-5 min-w-0 space-y-1">
                <p className="font-medium break-words">{item.name || "Untitled"}</p>
                {item.description && <p className="text-sm text-muted-foreground break-words">{item.description}</p>}
                <p className="text-xs text-muted-foreground lg:hidden">
                  {item.quantity} x {formatCurrency(item.unitPrice)}
                </p>
              </div>
              <div className="lg:col-span-2 mt-2 lg:mt-0">
                {item.category ? (
                  <Badge variant="outline">{item.category}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
              <div className="lg:col-span-1 mt-2 text-right text-sm lg:mt-0 lg:text-base">
                {item.quantity}
              </div>
              <div className="lg:col-span-2 mt-1 text-right text-sm text-muted-foreground lg:mt-0 lg:text-base">
                {formatCurrency(item.unitPrice)}
              </div>
              <div className="lg:col-span-1 mt-1 text-right font-medium lg:mt-0">
                {formatCurrency(item.quantity * item.unitPrice)}
              </div>
              <div className="lg:col-span-1 mt-2 flex justify-end gap-1 lg:mt-0">
                {isDraft && (
                  <>
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
                  </>
                )}
              </div>
            </div>
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
        <div className="flex justify-between text-lg">
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
            <span className="text-lg">{formatCurrency(lineTotal)}</span>
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

