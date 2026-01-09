import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { Eye, Loader2, PencilLine, Plus, X, Send, CheckCircle2, AlertCircle } from "@/components/ui/Icon";
import { useEffect, useMemo, useState, useRef } from "react";
import { toast } from "sonner";
import { getInvoiceState, getDerivedValues, formatCurrency as formatCurrencyUtil } from "@/lib/invoiceState";
import { AddPaymentDialog } from "./AddPaymentDialog";
import { ShareInvoiceDialog } from "./ShareInvoiceDialog";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { InvoiceCategorySelect } from "./InvoiceCategorySelect";

export type InvoiceLineItem = {
  name: string;
  description?: string | null;
  category?: string | null;
  quantity: number;
  unitPrice: number;
  currency: string;
  lineTotal?: number;
};

type InvoiceFormState = {
  invoiceNumber: string;
  clientId?: string;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  terms?: string;
  servicePeriodStart?: string;
  servicePeriodEnd?: string;
  referenceNumber?: string;
  partialInvoice: boolean;
};

const defaultLineItem: InvoiceLineItem = {
  name: "",
  description: "",
  category: "services",
  quantity: 1,
  unitPrice: 0,
  currency: "EUR",
};

// Use formatCurrency from invoiceState utils
const formatCurrency = formatCurrencyUtil;

// Helper to normalize empty strings to undefined (required for Radix Select)
function normalizeSelectValue(value: string | undefined | null): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export type InvoicePreviewData = {
  invoiceNumber: string;
  clientId?: string;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  terms?: string;
  servicePeriodStart?: string;
  servicePeriodEnd?: string;
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    currency: string;
  }>;
};

export function InvoiceForm({
  mode,
  invoiceId,
  contacts,
  onClose,
  onSuccess,
  onOpenInvoice,
  onPreview,
  showPreview = false,
  onFormChange,
  getFormDataRef,
  renderBeforeFooter,
}: {
  mode: "create" | "edit";
  invoiceId?: number;
  contacts: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
  onOpenInvoice?: (invoiceId: number) => void;
  onPreview?: () => void;
  showPreview?: boolean;
  onFormChange?: (formData: InvoicePreviewData) => void;
  getFormDataRef?: React.MutableRefObject<(() => InvoicePreviewData | null) | null>;
  renderBeforeFooter?: React.ReactNode;
}) {
  const isCreate = mode === "create";
  const [formState, setFormState] = useState<InvoiceFormState>(() => ({
    invoiceNumber: "",
    clientId: undefined,
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: undefined,
    notes: "",
    terms: "",
    servicePeriodStart: undefined,
    servicePeriodEnd: undefined,
    referenceNumber: "",
    partialInvoice: false,
  }));
  const [items, setItems] = useState<InvoiceLineItem[]>(() => isCreate ? [] : [defaultLineItem]);
  const [itemEditor, setItemEditor] = useState<{ open: boolean; index: number | null }>({
    open: false,
    index: null,
  });

  const nextNumberQuery = trpc.invoices.nextNumber.useQuery(
    { issueDate: new Date(formState.issueDate) },
    { enabled: isCreate }
  );
  const getInvoiceQuery = trpc.invoices.get.useQuery(
    { id: invoiceId! },
    { enabled: !isCreate && !!invoiceId }
  );
  const preferencesQuery = trpc.settings.preferences.get.useQuery();
  const language = (preferencesQuery.data?.language || "en") as "en" | "de";

  useEffect(() => {
    if (isCreate && nextNumberQuery.data?.invoiceNumber) {
      setFormState((prev) => ({ ...prev, invoiceNumber: nextNumberQuery.data!.invoiceNumber }));
    }
  }, [isCreate, nextNumberQuery.data]);

  useEffect(() => {
    if (!isCreate && getInvoiceQuery.data) {
      const invoice = getInvoiceQuery.data;
      const normalizedClientId = invoice.clientId
        ? String(invoice.clientId)
        : invoice.contactId
        ? String(invoice.contactId)
        : undefined;

      // Always update form state from invoice data to ensure consistency
      // The dueDate should always come from the database invoice
      setFormState((prev) => ({
        invoiceNumber: invoice.invoiceNumber,
        clientId: normalizeSelectValue(normalizedClientId),
        issueDate: invoice.issueDate
          ? new Date(invoice.issueDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        // Preserve dueDate from invoice - it should always be saved before sending
        dueDate: invoice.dueDate
          ? new Date(invoice.dueDate).toISOString().split("T")[0]
          : prev.dueDate || undefined, // Fallback to previous value if invoice doesn't have it
        notes: invoice.notes || "",
        terms: invoice.terms || "",
        servicePeriodStart: invoice.servicePeriodStart
          ? new Date(invoice.servicePeriodStart).toISOString().split("T")[0]
          : undefined,
        servicePeriodEnd: invoice.servicePeriodEnd
          ? new Date(invoice.servicePeriodEnd).toISOString().split("T")[0]
          : undefined,
        referenceNumber: invoice.referenceNumber || "",
        partialInvoice: Boolean(invoice.partialInvoice),
      }));
      const normalizedItems = (invoice.items as InvoiceLineItem[]).map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        currency: item.currency || "EUR",
        category: item.category || "services",
      }));
      setItems(normalizedItems.length ? normalizedItems : [defaultLineItem]);
    }
  }, [getInvoiceQuery.data, isCreate]);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0
    );
    return {
      subtotal,
      vat: 0,
      total: subtotal,
    };
  }, [items]);

  // Expose function to get current form data (for manual preview updates)
  useEffect(() => {
    if (getFormDataRef) {
      getFormDataRef.current = () => {
        // Validate minimum form data
        if (!formState.invoiceNumber || items.length === 0 || items.every(item => !item.name)) {
          return null;
        }
        
        return {
          invoiceNumber: formState.invoiceNumber,
          clientId: formState.clientId,
          issueDate: formState.issueDate,
          dueDate: formState.dueDate,
          notes: formState.notes,
          terms: formState.terms,
          servicePeriodStart: formState.servicePeriodStart,
          servicePeriodEnd: formState.servicePeriodEnd,
          items: items.map(item => ({
            name: item.name,
            description: item.description || undefined,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            currency: item.currency || "EUR",
          })),
        };
      };
    }
    
    return () => {
      if (getFormDataRef) {
        getFormDataRef.current = null;
      }
    };
  }, [formState, items, getFormDataRef]);

  const createMutation = trpc.invoices.create.useMutation({
    onSuccess,
    onError: (err) => toast.error(err.message || "Failed to save invoice"),
  });

  const updateMutation = trpc.invoices.update.useMutation({
    onSuccess,
    onError: (err) => toast.error(err.message || "Failed to save invoice"),
  });

  // NOTE: Lifecycle action mutations removed - all lifecycle actions are now handled
  // via the InvoiceStatusActionsDropdown component in InvoiceDetail page
  const utils = trpc.useUtils();
  const moveToTrashMutation = trpc.invoices.moveToTrash.useMutation({
    onSuccess: () => {
      toast.success("Invoice moved to Rubbish");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });
  const archiveMutation = trpc.invoices.archive.useMutation({
    onSuccess: () => {
      toast.success("Invoice archived");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });
  const markAsNotCancelledMutation = trpc.invoices.markAsNotCancelled.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as not cancelled");
      utils.invoices.get.invalidate({ id: invoiceId! });
    },
    onError: (err) => toast.error(err.message),
  });

  const invoice = getInvoiceQuery.data ?? null;
  const isMobile = useIsMobile();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  if (!isCreate && !invoice) {
    return <div className="text-sm text-muted-foreground">Loading invoice...</div>;
  }

  // Get invoice state using timestamp-based logic
  const invoiceState = invoice ? getInvoiceState(invoice) : (isCreate ? 'DRAFT' : null);
  const derivedValues = invoice ? getDerivedValues(invoice) : { outstanding: 0, isPaid: false, isPartial: false, isOverdue: false };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const isCancellation = invoice?.type === "cancellation";
  const isCancelledOriginal = Boolean(invoice?.isCancelled);
  
  // Use state-based logic instead of status field
  const isDraft = invoiceState === 'DRAFT' || isCreate;
  const isReview = invoiceState === 'REVIEW';
  const isSent = invoiceState === 'SENT' || invoiceState === 'PARTIAL';
  const isPaid = invoiceState === 'PAID';
  const isCancelled = invoice?.cancelledAt !== null && invoice?.cancelledAt !== undefined;
  const isReadOnly = isSent || isPaid || isCancelled; // Cancelled invoices are also read-only

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
      terms: formState.terms?.trim() || undefined,
      servicePeriodStart: formState.servicePeriodStart
        ? new Date(formState.servicePeriodStart)
        : undefined,
      servicePeriodEnd: formState.servicePeriodEnd
        ? new Date(formState.servicePeriodEnd)
        : undefined,
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

  const openItemEditor = (index: number | null = null) => {
    setItemEditor({ open: true, index });
  };
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

  const handleSend = async () => {
    if (!invoice || !invoiceId) return;
    // Check if invoice is cancelled - must be marked as not cancelled before sending
    if (isCancelled) {
      toast.error("Cancelled invoices cannot be sent. Please mark the invoice as not cancelled first.");
      return;
    }
    // Validate before sending
    if (!formState.dueDate) {
      toast.error("Invoice must have a due date before it can be sent");
      return;
    }
    const total = totals.total;
    if (total <= 0) {
      toast.error("Invoice total must be greater than 0");
      return;
    }
    
    // Save the invoice first to ensure dueDate is persisted before sending
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
      terms: formState.terms?.trim() || undefined,
      servicePeriodStart: formState.servicePeriodStart
        ? new Date(formState.servicePeriodStart)
        : undefined,
      servicePeriodEnd: formState.servicePeriodEnd
        ? new Date(formState.servicePeriodEnd)
        : undefined,
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

    try {
      // Save invoice first to ensure dueDate is persisted
      await updateMutation.mutateAsync({ id: invoiceId, ...payload });
      // Then open share dialog
      setShareDialogOpen(true);
    } catch (error) {
      // Error is already handled by mutation
    }
  };

  // Lifecycle action handlers removed - all actions now handled via InvoiceStatusActionsDropdown

  return (
    <div className="flex flex-col h-full w-full overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Header buttons removed - now handled by parent page (InvoiceDetail) */}

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
      {/* Warning banners */}
      {invoice && (
        <>
          {!invoice.sentAt && !invoice.needsReview && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This invoice has not been sent yet.
              </AlertDescription>
            </Alert>
          )}
          {invoice.sentAt && !invoice.paidAt && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This invoice has been sent but not paid yet.
              </AlertDescription>
            </Alert>
          )}
          {derivedValues.isOverdue && invoice.dueDate && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This invoice is overdue by {Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))} day{Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)) !== 1 ? 's' : ''}.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Payments section - only shown when sent */}
      {invoice && isSent && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Payments</h3>
            {!isPaid && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPaymentDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Payment
              </Button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Total</div>
              <div className="font-semibold">{formatCurrency(invoice.total)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Paid</div>
              <div className="font-semibold">{formatCurrency(invoice.amountPaid || 0)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Outstanding</div>
              <div className="font-semibold">{formatCurrency(derivedValues.outstanding)}</div>
            </div>
          </div>
        </div>
      )}

      <form id="invoice-form" onSubmit={handleSave} className="space-y-8">
      {isCancellation && (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Cancellation invoice</h2>
            <Badge variant="outline" className="text-xs">
              STORNO
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Cancellation of invoice {invoice?.cancellationOfInvoiceNumber ?? "(unknown)"}
          </p>
          {invoice?.cancelledInvoiceId && onOpenInvoice && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0 text-xs"
              onClick={() => onOpenInvoice(invoice.cancelledInvoiceId as number)}
            >
              View original invoice
            </Button>
          )}
        </div>
      )}
      {isCancelledOriginal && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          Cancelled by invoice {invoice?.cancelledByInvoiceNumber ?? "(unknown)"}
        </div>
      )}
      <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input
                value={formState.invoiceNumber}
                onChange={(e) => setFormState((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                placeholder="RE-2025-0007"
                disabled={isReadOnly || isCancelled}
              />
              <p className="text-xs text-muted-foreground">
                Invoice numbers must be unique and sequential (German tax requirement).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={formState.clientId && formState.clientId.trim() !== "" ? formState.clientId : "none"}
                onValueChange={(val) => {
                  const normalized = normalizeSelectValue(val);
                  setFormState((prev) => ({
                    ...prev,
                    clientId: normalized === undefined || val === "none" ? undefined : normalized,
                  }));
                }}
                disabled={isReadOnly || isCancelled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent align="start" className="z-[120]">
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
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-1 sm:gap-2 items-end">
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={formState.issueDate}
                  onChange={(e) => setFormState((prev) => ({ ...prev, issueDate: e.target.value }))}
                  disabled={isReadOnly || isCancelled}
                  className="w-full"
                />
              </div>
              <div className="w-2 sm:w-4"></div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formState.dueDate ?? ""}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, dueDate: e.target.value || undefined }))
                  }
                  disabled={isReadOnly || isCancelled}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-1 sm:gap-2 items-end">
              <div className="space-y-2">
                <Label>Service Period</Label>
                <Input
                  type="date"
                  value={formState.servicePeriodStart ?? ""}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, servicePeriodStart: e.target.value || undefined }))
                  }
                  disabled={isReadOnly || isCancelled}
                  className="w-full"
                />
              </div>
              <div className="flex items-center justify-center self-end" style={{ marginBottom: '18px' }}>
                <span className="text-muted-foreground text-sm shrink-0">→</span>
              </div>
              <div className="space-y-2">
                <div className="h-[14px]"></div>
                <Input
                  type="date"
                  value={formState.servicePeriodEnd ?? ""}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, servicePeriodEnd: e.target.value || undefined }))
                  }
                  disabled={isReadOnly || isCancelled}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Label>Line Items</Label>
            <p className="text-xs text-muted-foreground break-words">Add services or products via the dedicated modal.</p>
          </div>
          {!isReadOnly && !isCancelled && (
            <Button type="button" onClick={() => openItemEditor(null)} className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-3 lg:px-2 text-xs font-medium text-muted-foreground">
            <div className="lg:col-span-3">Item</div>
            <div className="lg:col-span-2">Category</div>
            <div className="lg:col-span-1 text-right">Qty</div>
            <div className="lg:col-span-2 text-right">Unit Price</div>
            <div className="lg:col-span-2 text-right">Total</div>
            <div className="lg:col-span-2 text-center">Delete</div>
          </div>
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border bg-background p-3 lg:grid lg:grid-cols-12 lg:items-center lg:gap-3 lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b lg:px-2 lg:py-3"
            >
              <div className="lg:col-span-3 min-w-0 space-y-1">
                <p className="font-medium break-words text-sm">{item.name || "Untitled"}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground break-words line-clamp-1">{item.description}</p>
                )}
                <p className="text-xs text-muted-foreground lg:hidden">
                  {item.quantity} x {formatCurrency(item.unitPrice)}
                </p>
              </div>
              <div className="lg:col-span-2 mt-2 lg:mt-0">
                {item.category ? (
                  <Badge variant="outline" className="text-xs">{item.category}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
              <div className="lg:col-span-1 mt-2 text-right text-sm lg:mt-0">
                {item.quantity}
              </div>
              <div className="lg:col-span-2 mt-1 text-right text-sm text-muted-foreground lg:mt-0">
                {formatCurrency(item.unitPrice)}
              </div>
              <div className="lg:col-span-2 mt-1 text-right font-medium text-sm lg:mt-0">
                {formatCurrency(item.quantity * item.unitPrice)}
              </div>
              <div className="lg:col-span-2 mt-2 flex justify-center gap-1 lg:mt-0">
                {!isReadOnly && (
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

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label>Partial Invoice</Label>
          <p className="text-xs text-muted-foreground">Flag invoice as partial (future use).</p>
        </div>
        <Switch
          checked={formState.partialInvoice}
          onCheckedChange={(val) => setFormState((prev) => ({ ...prev, partialInvoice: val }))}
          disabled={!isDraft}
          className="data-[state=unchecked]:bg-muted dark:data-[state=unchecked]:bg-muted/60"
        />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Anmerkungen</Label>
          <Textarea
            value={formState.notes ?? ""}
            onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Optional notes (appears on invoice if filled)"
            disabled={!isDraft}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Bedingungen</Label>
          <Textarea
            value={formState.terms ?? ""}
            onChange={(e) => setFormState((prev) => ({ ...prev, terms: e.target.value }))}
            placeholder="Optional terms and conditions (appears on invoice if filled)"
            disabled={!isDraft}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Order / Reference Number</Label>
          <Input
            value={formState.referenceNumber ?? ""}
            onChange={(e) => setFormState((prev) => ({ ...prev, referenceNumber: e.target.value }))}
            placeholder="Optional reference"
            disabled={isReadOnly || isCancelled}
          />
        </div>
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

      </form>

      {/* Footer buttons - part of scrollable content */}
      <div className="flex flex-col gap-2 pt-4 border-t">
        {/* Custom content before footer buttons (e.g., Update Preview button) */}
        {renderBeforeFooter}
        
        {/* Send button - only for non-cancelled draft invoices */}
        {!isCreate && invoice && invoiceState === 'DRAFT' && !isCancelled && (
          <Button
            type="button"
            onClick={handleSend}
            disabled={isLoading || !formState.dueDate || totals.total <= 0}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        )}
        
        {/* Delete and Update buttons - lifecycle actions are now in status badge dropdown */}
        <div className="flex gap-2 pt-2 border-t">
          {!isCreate && invoice && (
            <Button 
              type="button" 
              variant="destructive" 
              className="flex-1" 
              onClick={() => {
                if (isDraft || isReview) {
                  moveToTrashMutation.mutate({ id: invoiceId! });
                } else {
                  archiveMutation.mutate({ id: invoiceId! });
                }
              }}
              disabled={isLoading || moveToTrashMutation.isPending || archiveMutation.isPending}
            >
              {(moveToTrashMutation.isPending || archiveMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          )}
          <Button 
            type="submit" 
            form="invoice-form" 
            className={!isCreate && invoice ? "flex-1" : "flex-1"} 
            disabled={isLoading || isReadOnly || isCancelled}
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
        </div>
        
        {/* Mark as Not Cancelled button - only for cancelled invoices, at bottom */}
        {!isCreate && invoice && isCancelled && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              markAsNotCancelledMutation.mutate({ id: invoiceId! });
            }}
            disabled={isLoading || markAsNotCancelledMutation.isPending}
            className="w-full bg-transparent hover:bg-red-500 hover:text-white hover:border-red-500"
          >
            {markAsNotCancelledMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Mark as Not Cancelled
          </Button>
        )}
      </div>
      </div>

      {/* Dialogs */}
      {invoiceId && (
        <>
          <ShareInvoiceDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            invoiceId={invoiceId}
            onSuccess={() => {
              utils.invoices.get.invalidate({ id: invoiceId });
              onSuccess?.();
            }}
          />
          <AddPaymentDialog
            open={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            invoiceId={invoiceId}
            outstanding={derivedValues.outstanding}
            onSuccess={() => {
              utils.invoices.get.invalidate({ id: invoiceId });
              onSuccess?.();
            }}
          />
        </>
      )}

      <LineItemModal
        open={itemEditor.open}
        onOpenChange={(open) => (open ? openItemEditor(itemEditor.index) : closeItemEditor())}
        item={editingItem}
        onSave={handleSaveItem}
        language={language}
      />
    </div>
  );
}

function LineItemModal({
  open,
  onOpenChange,
  item,
  onSave,
  language,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InvoiceLineItem;
  onSave: (item: InvoiceLineItem) => void;
  language: "en" | "de";
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

  const isMobile = useIsMobile();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "flex flex-col p-0",
          "max-h-[calc(100vh-var(--bottom-safe-area,0px)-2rem)] mb-[calc(var(--bottom-safe-area,0px)+1rem)]"
        )}
        showCloseButton={false}
        zIndex={120}
      >
        {/* PageHeader-like structure */}
        <div className="flex-shrink-0 p-6 pb-2 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="flex-1 min-w-0 flex flex-col">
                <h1 className="text-3xl font-regular">
                  Add Line Item
                </h1>
                <p className="text-muted-foreground text-sm mt-3">
                  Add a new item to the invoice
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-10 w-10"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Fade-out separator */}
        <div className="separator-fade" />

        <div className={cn(
          "px-6 pt-4 overflow-y-auto flex-1 min-h-0",
          "pb-[calc(var(--bottom-safe-area,0px)+1rem)]"
        )}>
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Item Name</Label>
            <Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Item Description</Label>
            <Textarea
              value={draft.description ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <InvoiceCategorySelect
              value={draft.category || "services"}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, category: value }))}
              language={language}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Unit Price</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={draft.unitPrice}
                onChange={(e) => setDraft((prev) => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
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
          <div className="space-y-2">
            <Label>Currency</Label>
            <Input value={draft.currency} disabled />
          </div>
          <div className="flex justify-between items-center p-3 bg-muted rounded-md">
            <span className="text-sm text-muted-foreground">Line Total</span>
            <span className="text-lg">{formatCurrency(lineTotal)}</span>
          </div>
          <div className="flex gap-2 pt-4 border-t">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save Item
            </Button>
          </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
