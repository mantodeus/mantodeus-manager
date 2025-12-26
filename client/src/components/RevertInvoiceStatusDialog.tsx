import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface RevertInvoiceStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: "open" | "paid";
  targetStatus: "draft" | "open";
  onConfirm: () => void;
  isReverting: boolean;
}

export function RevertInvoiceStatusDialog({
  open,
  onOpenChange,
  currentStatus,
  targetStatus,
  onConfirm,
  isReverting,
}: RevertInvoiceStatusDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

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

  const getMessage = () => {
    if (currentStatus === "open") {
      return "This invoice has already been sent. Reverting it may affect records and client communication for accounting reasons. Only do this if the invoice was sent in error.";
    }
    return "This invoice is marked as paid. Reverting it may affect accounting records for accounting reasons. Only proceed if the payment was recorded incorrectly.";
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revert invoice status?</AlertDialogTitle>
          <AlertDialogDescription className="pt-2">
            {getMessage()}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
          <Checkbox
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(Boolean(checked))}
            id="revert-ack"
          />
          <label htmlFor="revert-ack" className="text-muted-foreground cursor-pointer">
            I understand the consequences.
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setAcknowledged(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!acknowledged || isReverting}
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
