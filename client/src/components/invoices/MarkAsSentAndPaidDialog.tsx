import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface MarkAsSentAndPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (paidAt: Date) => void;
  isProcessing: boolean;
}

export function MarkAsSentAndPaidDialog({
  open,
  onOpenChange,
  onConfirm,
  isProcessing,
}: MarkAsSentAndPaidDialogProps) {
  // Default to today's date
  const today = new Date().toISOString().split("T")[0];
  const [paidAtDate, setPaidAtDate] = useState(today);

  // Reset to today when dialog opens
  useEffect(() => {
    if (open) {
      setPaidAtDate(new Date().toISOString().split("T")[0]);
    }
  }, [open]);

  const handleConfirm = () => {
    const date = new Date(paidAtDate);
    // Set time to start of day to avoid timezone issues
    date.setHours(0, 0, 0, 0);
    onConfirm(date);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark as Sent and Paid?</AlertDialogTitle>
          <AlertDialogDescription className="pt-2 space-y-4">
            <p>
              This invoice has not been sent yet. Do you want to mark this invoice as sent and paid?
              <br /><br />
              <strong>Note:</strong> This is useful for historical invoices that were sent and paid in the past.
              Make sure all invoice details (client, dates, amounts) are correct before proceeding.
            </p>
            <div className="space-y-2">
              <Label htmlFor="paidAtDate">Payment Date *</Label>
              <Input
                id="paidAtDate"
                type="date"
                value={paidAtDate}
                onChange={(e) => setPaidAtDate(e.target.value)}
                required
                disabled={isProcessing}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                This date determines which year/quarter the income is counted in for accounting purposes.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isProcessing || !paidAtDate}
            onClick={handleConfirm}
          >
            {isProcessing ? "Processing..." : "Mark as Sent and Paid"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

