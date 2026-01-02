/**
 * ExpenseForm Component
 * 
 * Editable form for creating/editing expenses
 */

import { useState, useEffect, useRef } from "react";
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
import { Sparkles } from "@/components/ui/Icon";

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

interface ExpenseFile {
  id: number;
  filename: string;
  fileKey: string;
  mimeType: string;
  fileSize?: number | null;
  uploadedAt: Date;
  previewUrl?: string | null;
}

interface ExpenseSuggestion {
  field: "category" | "vatMode" | "businessUsePct";
  value: string | number;
  confidence: number;
  reason?: string | null;
}

interface ExpenseFormProps {
  initialData?: ExpenseFormData;
  files?: ExpenseFile[];
  suggestions?: ExpenseSuggestion[];
  autofilledFields?: string[]; // Fields that were autofilled (for UI indicators)
  onSave: (data: ExpenseFormData) => void;
  onAcceptSuggestion?: (field: string, value: string | number) => void;
  onMarkInOrder?: () => void;
  onVoid?: () => void;
  onDelete?: () => void;
  onReceiptUpload?: (files: File[]) => void;
  onReceiptDelete?: (id: number) => void;
  onReceiptView?: (id: number) => void;
  isSaving?: boolean;
  isAcceptingSuggestion?: boolean;
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
  files = [],
  autofilledFields = [],
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
  const [fieldEdited, setFieldEdited] = useState<Set<string>>(new Set());

  const descriptionRef = useRef<HTMLInputElement>(null);
  const grossAmountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setFieldEdited(new Set());
    }
  }, [initialData]);

  // Track when fields are manually edited (removes autofill indicator)
  const handleCategoryChange = (value: ExpenseCategory) => {
    setFieldEdited((prev) => new Set(prev).add("category"));
    setFormData({ ...formData, category: value });
  };

  const handleBusinessUsePctChange = (value: number) => {
    setFieldEdited((prev) => new Set(prev).add("businessUsePct"));
    setFormData({
      ...formData,
      businessUsePct: Math.min(100, Math.max(0, value)),
    });
  };

  const handleDescriptionChange = (value: string | null) => {
    setFieldEdited((prev) => new Set(prev).add("description"));
    // When description changes, mark it as edited and trigger refetch
    // (This will be handled by parent component)
    setFormData({ ...formData, description: value });
  };

  const handleGrossAmountChange = (value: number) => {
    setFieldEdited((prev) => new Set(prev).add("grossAmountCents"));
    setFormData({
      ...formData,
      grossAmountCents: Math.round(value * 100),
    });
  };

  // Check if field is autofilled and not manually edited
  const isAutofilled = (fieldName: string): boolean => {
    return autofilledFields.includes(fieldName) && !fieldEdited.has(fieldName);
  };

  const AutofillIndicator = ({ fieldName }: { fieldName: string }) => {
    if (!isAutofilled(fieldName)) return null;

    return (
      <Sparkles className="h-3.5 w-3.5 text-muted-foreground" aria-label="Autofilled" />
    );
  };

  // Autofocus first missing required field
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      // Focus grossAmount if it's 0 or empty (required field)
      if (formData.grossAmountCents === 0 && grossAmountRef.current) {
        grossAmountRef.current.focus();
        return;
      }
      // Otherwise focus description if empty
      if (!formData.description && descriptionRef.current) {
        descriptionRef.current.focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []); // Only on mount

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
    <div className="px-4 pt-4 pb-24 max-w-[640px] mx-auto w-full space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="description" className="break-words">
              Description
            </Label>
            <AutofillIndicator fieldName="description" />
          </div>
          <Input
            ref={descriptionRef}
            id="description"
            value={formData.description || ""}
            onChange={(e) =>
              handleDescriptionChange(e.target.value || null)
            }
            placeholder="e.g., Office supplies, Travel expenses..."
            className="w-full"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="category" className="break-words">
              Category
            </Label>
            <AutofillIndicator fieldName="category" />
          </div>
          <CategorySelect
            value={formData.category}
            onValueChange={handleCategoryChange}
          />
        </div>

        <div className="space-y-4">
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="grossAmount" className="break-words">
                Gross Amount
              </Label>
              <AutofillIndicator fieldName="grossAmountCents" />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0">
              <Input
                ref={grossAmountRef}
                id="grossAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.grossAmountCents / 100}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  handleGrossAmountChange(value);
                }}
                placeholder="0.00"
                className="w-full min-w-0"
              />
              <div className="w-full sm:w-36">
                <CurrencySelect
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="businessUsePct" className="break-words">
                Business Use (%)
              </Label>
              <AutofillIndicator fieldName="businessUsePct" />
            </div>
            <Input
              id="businessUsePct"
              type="number"
              min="0"
              max="100"
              value={formData.businessUsePct}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                handleBusinessUsePctChange(value);
              }}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label className="break-words">Deductible Amount</Label>
          <div className="text-lg font-medium">
            {formatCurrency(deductibleCents / 100, formData.currency)}
          </div>
          <p className="text-xs text-muted-foreground">
            Calculated as: {formatCurrency(formData.grossAmountCents / 100, formData.currency)} × {formData.businessUsePct}%
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes" className="break-words">
            Notes (Optional)
          </Label>
          <Textarea
            id="notes"
            value={formData.notes || ""}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value || null })
            }
            placeholder="Additional notes about this expense..."
            rows={3}
            className="w-full"
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
            <Label htmlFor="paid" className="cursor-pointer break-words">
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
        {files.length > 0 && (
          <ReceiptPreviewList
            files={files}
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
          <div className="sticky bottom-0 z-10 -mx-4 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] bg-background/95 backdrop-blur border-t md:static md:mx-0 md:px-0 md:pt-0 md:pb-0 md:border-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
          </div>
        </>
      )}
    </div>
  );
}

