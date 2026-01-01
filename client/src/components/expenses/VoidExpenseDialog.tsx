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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle } from "@/components/ui/Icon";

type VoidReason = "duplicate" | "personal" | "mistake" | "wrong_document" | "other";

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
  const [voidReason, setVoidReason] = useState<VoidReason | "">("");
  const [voidNote, setVoidNote] = useState("");

  const handleConfirm = () => {
    if (!voidReason || voidReason === "") {
      return;
    }
    // Pass voidReason as the reason (backend expects enum)
    onConfirm(voidReason);
    setVoidReason("");
    setVoidNote("");
  };

  const handleClose = () => {
    setVoidReason("");
    setVoidNote("");
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
          <div className="grid gap-3">
            <Label>Reason *</Label>
            <RadioGroup
              value={voidReason}
              onValueChange={(value) => setVoidReason(value as VoidReason)}
              disabled={isVoiding}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="duplicate" id="reason-duplicate" />
                <Label htmlFor="reason-duplicate" className="font-normal cursor-pointer">
                  Duplicate
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="personal" id="reason-personal" />
                <Label htmlFor="reason-personal" className="font-normal cursor-pointer">
                  Personal expense
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mistake" id="reason-mistake" />
                <Label htmlFor="reason-mistake" className="font-normal cursor-pointer">
                  Mistake
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="wrong_document" id="reason-wrong-document" />
                <Label htmlFor="reason-wrong-document" className="font-normal cursor-pointer">
                  Wrong document
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="reason-other" />
                <Label htmlFor="reason-other" className="font-normal cursor-pointer">
                  Other
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="void-note">Additional note (optional)</Label>
            <Textarea
              id="void-note"
              value={voidNote}
              onChange={(e) => setVoidNote(e.target.value)}
              placeholder="Additional details..."
              rows={3}
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
            disabled={!voidReason || isVoiding}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isVoiding ? "Voiding..." : "Void Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

