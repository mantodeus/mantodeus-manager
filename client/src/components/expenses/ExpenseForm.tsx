/**
 * ExpenseForm Component
 * 
 * Editable form for creating/editing expenses
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { CategorySelect, type ExpenseCategory } from "./CategorySelect";
import { CurrencySelect } from "./CurrencySelect";
import { ReceiptUploadZone } from "./ReceiptUploadZone";
import { ReceiptPreviewList } from "./ReceiptPreviewList";
import { formatCurrency } from "@/lib/currencyFormat";

interface ExpenseFormData {
  description: string | null;
  category: ExpenseCategory | null;
  grossAmountCents: number;
  currency: string;
  businessUsePct: number;
  paid: boolean;
  paidAt: Date | null;
  notes: string | null;
}

interface ReceiptFile {
  id: number;
  filename: string;
  fileKey: string;
  mimeType: string;
  fileSize?: number | null;
  uploadedAt: Date;
  previewUrl?: string | null;
}

interface ExpenseFormProps {
  initialData?: ExpenseFormData;
  receipts?: ReceiptFile[];
  onSave: (data: ExpenseFormData) => void;
  onMarkInOrder?: () => void;
  onVoid?: () => void;
  onDelete?: () => void;
  onReceiptUpload?: (files: File[]) => void;
  onReceiptDelete?: (id: number) => void;
  onReceiptView?: (id: number) => void;
  isSaving?: boolean;
  isMarkingInOrder?: boolean;
  isVoiding?: boolean;
  isDeleting?: boolean;
  isUploadingReceipt?: boolean;
  canMarkInOrder?: boolean;
  canVoid?: boolean;
  canDelete?: boolean;
  showActions?: boolean;
}

export function ExpenseForm({
  initialData,
  receipts = [],
  onSave,
  onMarkInOrder,
  onVoid,
  onDelete,
  onReceiptUpload,
  onReceiptDelete,
  onReceiptView,
  isSaving = false,
  isMarkingInOrder = false,
  isVoiding = false,
  isDeleting = false,
  isUploadingReceipt = false,
  canMarkInOrder = false,
  canVoid = false,
  canDelete = false,
  showActions = true,
}: ExpenseFormProps) {
  const [formData, setFormData] = useState<ExpenseFormData>(() => ({
    description: initialData?.description || null,
    category: initialData?.category || null,
    grossAmountCents: initialData?.grossAmountCents || 0,
    currency: initialData?.currency || "EUR",
    businessUsePct: initialData?.businessUsePct || 100,
    paid: initialData?.paid || false,
    paidAt: initialData?.paidAt || null,
    notes: initialData?.notes || null,
  }));

  const [deletingReceiptId, setDeletingReceiptId] = useState<number | null>(null);
  const [viewingReceiptId, setViewingReceiptId] = useState<number | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const deductibleCents = Math.round(
    (formData.grossAmountCents * formData.businessUsePct) / 100
  );

  const handleSave = () => {
    if (formData.grossAmountCents <= 0) {
      return;
    }
    onSave(formData);
  };

  const handleReceiptUpload = (files: File[]) => {
    if (onReceiptUpload) {
      onReceiptUpload(files);
    }
  };

  const handleReceiptDelete = (id: number) => {
    setDeletingReceiptId(id);
    if (onReceiptDelete) {
      onReceiptDelete(id);
      // Reset after a delay to allow for async operations
      setTimeout(() => setDeletingReceiptId(null), 1000);
    }
  };

  const handleReceiptView = async (id: number) => {
    setViewingReceiptId(id);
    if (onReceiptView) {
      await onReceiptView(id);
      setViewingReceiptId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={formData.description || ""}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value || null })
            }
            placeholder="e.g., Office supplies, Travel expenses..."
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="category">Category</Label>
          <CategorySelect
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="grossAmount">Gross Amount</Label>
            <div className="flex gap-2">
              <Input
                id="grossAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.grossAmountCents / 100}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setFormData({
                    ...formData,
                    grossAmountCents: Math.round(value * 100),
                  });
                }}
                placeholder="0.00"
              />
              <CurrencySelect
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="businessUsePct">Business Use (%)</Label>
            <Input
              id="businessUsePct"
              type="number"
              min="0"
              max="100"
              value={formData.businessUsePct}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                setFormData({
                  ...formData,
                  businessUsePct: Math.min(100, Math.max(0, value)),
                });
              }}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Deductible Amount</Label>
          <div className="text-lg font-medium">
            {formatCurrency(deductibleCents / 100, formData.currency)}
          </div>
          <p className="text-xs text-muted-foreground">
            Calculated as: {formatCurrency(formData.grossAmountCents / 100, formData.currency)} × {formData.businessUsePct}%
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={formData.notes || ""}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value || null })
            }
            placeholder="Additional notes about this expense..."
            rows={3}
          />
        </div>
      </div>

      <Separator />

      {/* Payment Information */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Payment Information</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Informational only — does not affect deductibility
          </p>
          <div className="flex items-center space-x-2">
            <Switch
              id="paid"
              checked={formData.paid}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  paid: checked,
                  paidAt: checked ? new Date() : null,
                })
              }
            />
            <Label htmlFor="paid" className="cursor-pointer">
              Mark as paid
            </Label>
          </div>
        </div>
      </div>

      <Separator />

      {/* Receipts */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Receipts</h3>
          {onReceiptUpload && (
            <ReceiptUploadZone
              onUpload={handleReceiptUpload}
              isUploading={isUploadingReceipt}
            />
          )}
        </div>
        {receipts.length > 0 && (
          <ReceiptPreviewList
            receipts={receipts}
            onDelete={onReceiptDelete ? handleReceiptDelete : undefined}
            onView={onReceiptView ? handleReceiptView : undefined}
            isDeleting={isDeleting}
            deletingId={deletingReceiptId}
            viewingId={viewingReceiptId}
          />
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || formData.grossAmountCents <= 0}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
            {canMarkInOrder && onMarkInOrder && (
              <Button
                variant="outline"
                onClick={onMarkInOrder}
                disabled={isMarkingInOrder}
              >
                {isMarkingInOrder ? "Marking..." : "Mark as In Order"}
              </Button>
            )}
            {canVoid && onVoid && (
              <Button
                variant="outline"
                onClick={onVoid}
                disabled={isVoiding}
              >
                {isVoiding ? "Voiding..." : "Void"}
              </Button>
            )}
            {canDelete && onDelete && (
              <Button
                variant="destructive"
                onClick={onDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

