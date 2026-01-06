import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface MarkAsSentAndPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

export function MarkAsSentAndPaidDialog({
  open,
  onOpenChange,
  onConfirm,
  isProcessing,
}: MarkAsSentAndPaidDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark as Sent and Paid?</AlertDialogTitle>
          <AlertDialogDescription className="pt-2">
            This invoice has not been sent yet. Do you want to mark this invoice as sent and paid?
            <br /><br />
            This is useful for historical invoices that were sent and paid in the past.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isProcessing}
            onClick={onConfirm}
          >
            {isProcessing ? "Processing..." : "Mark as Sent and Paid"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

