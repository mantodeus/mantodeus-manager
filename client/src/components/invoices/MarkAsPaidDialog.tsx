import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface MarkAsPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (paidAt: Date) => void;
  isProcessing: boolean;
  invoiceNumber?: string;
}

export function MarkAsPaidDialog({
  open,
  onOpenChange,
  onConfirm,
  isProcessing,
  invoiceNumber,
}: MarkAsPaidDialogProps) {
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
          <AlertDialogTitle>Mark as Paid</AlertDialogTitle>
          <AlertDialogDescription className="pt-2 space-y-4">
            {invoiceNumber && (
              <p>
                Mark invoice <strong>{invoiceNumber}</strong> as paid?
              </p>
            )}
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
            {isProcessing ? "Processing..." : "Mark as Paid"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

