/**
 * DeleteConfirmDialog Component
 * 
 * A reusable confirmation dialog for destructive delete operations.
 * Provides stronger safeguards than simple confirm() dialogs.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  /** Additional warning text (e.g., file counts) */
  warning?: string;
  /** Whether to require typing the item name to confirm */
  requireTypeToConfirm?: string;
  /** Current typed value for confirmation */
  confirmValue?: string;
  onConfirmValueChange?: (value: string) => void;
  /** Label for the confirm button */
  confirmLabel?: string;
  /** Whether the delete operation is in progress */
  isDeleting?: boolean;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  warning,
  requireTypeToConfirm,
  confirmValue = "",
  onConfirmValueChange,
  confirmLabel = "Delete",
  isDeleting = false,
}: DeleteConfirmDialogProps) {
  const canConfirm = requireTypeToConfirm
    ? confirmValue === requireTypeToConfirm
    : true;

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm();
      onOpenChange(false);
      if (onConfirmValueChange) {
        onConfirmValueChange("");
      }
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {description}
            {warning && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm font-medium text-destructive">{warning}</p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {requireTypeToConfirm && (
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Type <span className="font-mono font-bold">{requireTypeToConfirm}</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmValue}
              onChange={(e) => onConfirmValueChange?.(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder={requireTypeToConfirm}
              autoFocus
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm || isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
