import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface MarkAsSentWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber?: string | null;
  onConfirm: () => void;
  isProcessing: boolean;
}

export function MarkAsSentWarningDialog({
  open,
  onOpenChange,
  invoiceNumber,
  onConfirm,
  isProcessing,
}: MarkAsSentWarningDialogProps) {
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

  const canConfirm = acknowledged && !isProcessing;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark invoice as sent?</AlertDialogTitle>
          <AlertDialogDescription className="pt-2 space-y-3">
            This invoice has already been sent. Marking it as sent again will update the sent timestamp.
            <br /><br />
            This is useful for fixing mistakes or correcting the sent date.
            
            {/* Invoice details */}
            {invoiceNumber && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Number:</span>
                  <span className="font-medium">{invoiceNumber}</span>
                </div>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-md border border-border p-4">
            <Checkbox
              id="mark-sent-ack"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
              className="mt-0.5"
            />
            <Label htmlFor="mark-sent-ack" className="text-sm text-foreground cursor-pointer flex-1 leading-relaxed">
              I understand the consequences.
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
            className="border border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-600 hover:bg-blue-500/10 dark:hover:bg-blue-600/20"
          >
            {isProcessing ? "Processing..." : "Mark as Sent"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

