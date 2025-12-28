/**
 * VoidExpenseDialog Component
 * 
 * Dialog for voiding an expense with reason input
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

interface VoidExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isVoiding?: boolean;
}

export function VoidExpenseDialog({
  open,
  onOpenChange,
  onConfirm,
  isVoiding = false,
}: VoidExpenseDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) {
      return;
    }
    onConfirm(reason.trim());
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <DialogTitle>Void Expense</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Voiding an expense marks it as non-deductible. This action can be reversed later.
            Please provide a reason for voiding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="void-reason">Reason *</Label>
            <Textarea
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Personal expense, duplicate entry, incorrect amount..."
              rows={4}
              disabled={isVoiding}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isVoiding}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!reason.trim() || isVoiding}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isVoiding ? "Voiding..." : "Void Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

