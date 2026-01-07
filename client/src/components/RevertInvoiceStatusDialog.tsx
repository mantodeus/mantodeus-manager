import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface RevertInvoiceStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: "open" | "paid";
  targetStatus: "draft" | "open";
  invoiceNumber?: string | null;
  invoiceAmount?: number | string | null;
  onConfirm: () => void;
  isReverting: boolean;
  // Batch mode support
  isBatch?: boolean;
  batchCount?: number;
  skippedCount?: number;
}

export function RevertInvoiceStatusDialog({
  open,
  onOpenChange,
  currentStatus,
  targetStatus,
  invoiceNumber,
  invoiceAmount,
  onConfirm,
  isReverting,
  isBatch = false,
  batchCount = 0,
  skippedCount = 0,
}: RevertInvoiceStatusDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  // Reset checkbox when dialog opens (both single and batch)
  useEffect(() => {
    if (open) {
      setAcknowledged(false);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setAcknowledged(false);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    if (!acknowledged) return;
    onConfirm();
  };

  const formatAmount = (amount: number | string | null) => {
    if (!amount) return "N/A";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(num || 0);
  };

  const getMessage = () => {
    if (isBatch) {
      // Batch mode: always use plural grammar ("these invoices", "they", "them")
      const baseMessage = `This will change the status of these invoices and may invalidate share links.`;
      const skippedMessage = skippedCount > 0 
        ? ` ${skippedCount} ${skippedCount === 1 ? 'invoice will be' : 'invoices will be'} skipped because they are not eligible for this action.`
        : "";
      return `${baseMessage}${skippedMessage}`;
    } else {
      // Single invoice mode
      return "This will change the status and may invalidate share links.";
    }
  };

  const canConfirm = acknowledged && !isReverting;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBatch 
              ? `Revert ${batchCount} ${batchCount === 1 ? 'invoice' : 'invoices'} to ${targetStatus === "draft" ? "draft" : "sent"}?`
              : `Revert invoice to ${targetStatus === "draft" ? "draft" : "sent"}?`
            }
          </AlertDialogTitle>
          <AlertDialogDescription className="pt-2">
            <div className="space-y-4">
              <p className="mb-0">{getMessage()}</p>
              
              {/* Invoice details - only show for single invoice mode */}
              {!isBatch && (invoiceNumber || invoiceAmount) && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm mt-4">
                  {invoiceNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoice Number:</span>
                      <span className="font-medium">{invoiceNumber}</span>
                    </div>
                  )}
                  {invoiceAmount && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-medium">{formatAmount(invoiceAmount)}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Batch summary - show counts */}
              {isBatch && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm mt-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoices to revert:</span>
                    <span className="font-medium">{batchCount}</span>
                  </div>
                  {skippedCount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoices skipped:</span>
                      <span className="font-medium text-orange-600">{skippedCount}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-md border border-border p-4">
            <Checkbox
              id="revert-ack"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
              className="mt-0.5"
            />
            <Label htmlFor="revert-ack" className="text-sm text-foreground cursor-pointer flex-1 leading-relaxed">
              {isBatch
                ? `I understand this will revert these invoices and cannot be undone.`
                : "I understand this will revert the invoice and cannot be undone."}
            </Label>
          </div>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => {
            setAcknowledged(false);
          }}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isReverting 
              ? (isBatch ? `Reverting ${batchCount} ${batchCount === 1 ? 'invoice' : 'invoices'}...` : "Reverting...")
              : (isBatch ? `Revert ${batchCount} ${batchCount === 1 ? 'Invoice' : 'Invoices'}` : "Revert Status")
            }
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
