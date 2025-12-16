/**
 * Generate Invoice Dialog
 * 
 * Dialog for generating invoices as PDFs with line items.
 * Includes shareable link generation.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Receipt, Copy, Check, ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface GenerateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: number;
  jobId?: number;
  contactId?: number;
}

export function GenerateInvoiceDialog({
  open,
  onOpenChange,
  projectId,
  jobId,
  contactId,
}: GenerateInvoiceDialogProps) {
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [copied, setCopied] = useState(false);

  const { data: project } = trpc.projects.getById.useQuery(
    { id: projectId! },
    { enabled: !!projectId }
  );
  const { data: contacts } = trpc.contacts.list.useQuery();

  const generateMutation = trpc.pdf.generateInvoice.useMutation({
    onSuccess: () => {
      toast.success("Invoice generated successfully");
    },
    onError: (error) => {
      toast.error("Failed to generate invoice: " + error.message);
    },
  });


  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleGenerate = async () => {
    const validItems = items.filter(
      (item) => item.description.trim() && item.quantity > 0 && item.unitPrice >= 0
    );

    if (validItems.length === 0) {
      toast.error("Please add at least one invoice item");
      return;
    }

    await generateMutation.mutateAsync({
      clientId: contactId || undefined,
      dueDate: new Date(dueDate),
      items: validItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      notes: notes.trim() || undefined,
    });
  };


  const handleCopyLink = async () => {
    if (!generateMutation.data?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(generateMutation.data.shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleOpenLink = () => {
    if (!generateMutation.data?.shareUrl) return;
    window.open(generateMutation.data.shareUrl, "_blank");
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Generate Invoice
          </DialogTitle>
          <DialogDescription>
            Create a PDF invoice for this project. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date *</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Invoice number will be auto-generated based on your settings
            </p>
          </div>

          {contactId && (
            <div className="space-y-2">
              <Label>Client</Label>
              <Input
                value={contacts?.find((c) => c.id === contactId)?.name || "Selected client"}
                readOnly
                disabled
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for the invoice..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Invoice Items *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-start p-3 rounded-lg border">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) =>
                        handleItemChange(index, "description", e.target.value)
                      }
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)
                        }
                        className="w-20"
                      />
                      <Input
                        type="number"
                        placeholder="Unit Price"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleItemChange(index, "unitPrice", parseFloat(e.target.value) || 0)
                        }
                        className="flex-1"
                      />
                      <div className="flex items-center px-3 text-sm text-muted-foreground min-w-[60px]">
                        €{(item.quantity * item.unitPrice).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2 border-t">
              <div className="text-sm">
                <span className="text-muted-foreground">Subtotal: </span>
                <span className="font-medium">€{subtotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="w-full gap-2"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Receipt className="h-4 w-4" />
                Generate Invoice
              </>
            )}
          </Button>

          {generateMutation.data?.shareUrl && (
            <div className="border-t pt-4 space-y-2">
              <Label>Shareable Link</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={generateMutation.data.shareUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  onClick={handleCopyLink}
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={handleOpenLink}
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Invoice number: {generateMutation.data.invoiceNumber}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

