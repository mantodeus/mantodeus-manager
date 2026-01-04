import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
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
}: RevertInvoiceStatusDialogProps) {
  const [revertText, setRevertText] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setRevertText("");
      setAcknowledged(false);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    if (revertText !== "REVERT" || !acknowledged) return;
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
    if (currentStatus === "open") {
      return "This invoice has already been sent. Reverting it may affect records and client communication for accounting reasons. Only do this if the invoice was sent in error.";
    }
    return "This invoice is marked as paid. Reverting it may affect accounting records for accounting reasons. Only proceed if the payment was recorded incorrectly.";
  };

  const canConfirm = revertText === "REVERT" && acknowledged && !isReverting;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revert invoice status?</AlertDialogTitle>
          <AlertDialogDescription className="pt-2 space-y-3">
            {getMessage()}
            
            {/* Invoice details */}
            {(invoiceNumber || invoiceAmount) && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
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
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
            <input
              type="checkbox"
              id="revert-ack"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <label htmlFor="revert-ack" className="text-muted-foreground cursor-pointer flex-1">
              I understand the consequences.
            </label>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="revert-text" className="text-sm">
              Type <span className="font-mono font-semibold">REVERT</span> to confirm:
            </Label>
            <Input
              id="revert-text"
              value={revertText}
              onChange={(e) => setRevertText(e.target.value.toUpperCase())}
              placeholder="REVERT"
              className="font-mono"
              autoFocus
            />
          </div>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => {
            setRevertText("");
            setAcknowledged(false);
          }}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isReverting ? "Reverting..." : "Revert Status"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
