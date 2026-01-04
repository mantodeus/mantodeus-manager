/**
 * Add Payment Dialog
 * Simple dialog for adding payments to sent invoices
 * v1: Amount only (no date picker, auto-set to now())
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "@/components/ui/Icon";
import { toast } from "sonner";

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: number;
  outstanding: number;
  onSuccess?: () => void;
}

export function AddPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  outstanding,
  onSuccess,
}: AddPaymentDialogProps) {
  const [amount, setAmount] = useState<string>("");

  const utils = trpc.useUtils();
  const addPaymentMutation = trpc.invoices.addInvoicePayment.useMutation({
    onSuccess: () => {
      toast.success("Payment added");
      setAmount("");
      onOpenChange(false);
      utils.invoices.get.invalidate({ id: invoiceId });
      utils.invoices.list.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Failed to add payment: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const paymentAmount = parseFloat(amount);
    
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error("Payment amount must be greater than 0");
      return;
    }

    if (paymentAmount > outstanding) {
      toast.error(`Payment amount cannot exceed outstanding balance (${outstanding.toFixed(2)} €)`);
      return;
    }

    addPaymentMutation.mutate({
      id: invoiceId,
      amount: paymentAmount,
    });
  };

  const handleClose = () => {
    setAmount("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Outstanding</Label>
            <div className="text-lg font-semibold">
              {new Intl.NumberFormat("de-DE", {
                style: "currency",
                currency: "EUR",
              }).format(outstanding)}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (€) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={outstanding}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Payment date will be set to today automatically
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={addPaymentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addPaymentMutation.isPending || !amount || parseFloat(amount) <= 0}
            >
              {addPaymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

