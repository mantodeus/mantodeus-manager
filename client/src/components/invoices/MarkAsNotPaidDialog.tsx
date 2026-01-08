import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MarkAsNotPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (target: "sent" | "draft") => void;
  isProcessing: boolean;
  hasPayments: boolean;
}

export function MarkAsNotPaidDialog({
  open,
  onOpenChange,
  onConfirm,
  isProcessing,
  hasPayments,
}: MarkAsNotPaidDialogProps) {
  const [target, setTarget] = useState<"sent" | "draft">("sent");

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTarget("sent");
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    onConfirm(target);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark as Not Paid</AlertDialogTitle>
          <AlertDialogDescription className="pt-2 space-y-3">
            <p>
              This invoice is currently marked as paid. Choose how you want to revert it:
            </p>
            
            <RadioGroup value={target} onValueChange={(value) => setTarget(value as "sent" | "draft")}>
              <div className="flex items-start space-x-2 rounded-md border p-3">
                <RadioGroupItem value="sent" id="revert-sent" className="mt-1" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="revert-sent" className="cursor-pointer font-medium">
                    Mark as Not Paid
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Keep the invoice as sent but remove the paid status. This is useful if the payment was recorded incorrectly.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-2 rounded-md border p-3">
                <RadioGroupItem 
                  value="draft" 
                  id="revert-draft" 
                  className="mt-1"
                  disabled={hasPayments}
                />
                <div className="flex-1 space-y-1">
                  <Label 
                    htmlFor="revert-draft" 
                    className={cn(
                      "cursor-pointer font-medium",
                      hasPayments && "text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    Revert to Draft
                  </Label>
                  <p className={cn(
                    "text-sm",
                    hasPayments ? "text-muted-foreground" : "text-muted-foreground"
                  )}>
                    {hasPayments 
                      ? "Cannot revert to draft: invoice has received payments."
                      : "Revert the invoice to draft status. This will invalidate any share links."
                    }
                  </p>
                </div>
              </div>
            </RadioGroup>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isProcessing || (target === "draft" && hasPayments)}
            onClick={handleConfirm}
          >
            {isProcessing ? "Processing..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

