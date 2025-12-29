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
import { SuggestionBadge } from "./SuggestionBadge";
import { SuggestionControls } from "./SuggestionControls";
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
  suggestions = [],
  onSave,
  onAcceptSuggestion,
  onMarkInOrder,
  onVoid,
  onDelete,
  onReceiptUpload,
  onReceiptDelete,
  onReceiptView,
  isSaving = false,
  isAcceptingSuggestion = false,
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
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [fieldEdited, setFieldEdited] = useState<Set<string>>(new Set());

  const descriptionRef = useRef<HTMLInputElement>(null);
  const grossAmountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      // Reset dismissed suggestions and field edited state when data changes
      setDismissedSuggestions(new Set());
      setFieldEdited(new Set());
    }
  }, [initialData]);

  // Filter visible suggestions (not dismissed, field not manually edited)
  const visibleSuggestions = suggestions.filter(
    (s) => !dismissedSuggestions.has(s.field) && !fieldEdited.has(s.field)
  );

  const handleAcceptSuggestion = (suggestion: ExpenseSuggestion) => {
    if (onAcceptSuggestion) {
      onAcceptSuggestion(suggestion.field, suggestion.value);
    }
    // Remove from dismissed (in case it was dismissed before)
    setDismissedSuggestions((prev) => {
      const next = new Set(prev);
      next.delete(suggestion.field);
      return next;
    });
  };

  const handleDismissSuggestion = (field: string) => {
    setDismissedSuggestions((prev) => new Set(prev).add(field));
  };

  const handleAcceptAllSuggestions = () => {
    visibleSuggestions.forEach((suggestion) => {
      if (onAcceptSuggestion) {
        onAcceptSuggestion(suggestion.field, suggestion.value);
      }
    });
  };

  // Track when fields are manually edited
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
    // When description changes, mark it as edited and trigger refetch
    // (This will be handled by parent component)
    setFormData({ ...formData, description: value });
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
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Input
            ref={descriptionRef}
            id="description"
            value={formData.description || ""}
            onChange={(e) =>
              handleDescriptionChange(e.target.value || null)
            }
            placeholder="e.g., Office supplies, Travel expenses..."
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="category">Category</Label>
            {visibleSuggestions.find((s) => s.field === "category") && (
              <div className="flex items-center gap-2">
                <SuggestionBadge
                  confidence={
                    visibleSuggestions.find((s) => s.field === "category")?.confidence || 0
                  }
                  reason={
                    visibleSuggestions.find((s) => s.field === "category")?.reason || null
                  }
                />
                <SuggestionControls
                  onAccept={() => {
                    const suggestion = visibleSuggestions.find((s) => s.field === "category");
                    if (suggestion) {
                      handleAcceptSuggestion(suggestion);
                    }
                  }}
                  onDismiss={() => handleDismissSuggestion("category")}
                  isAccepting={isAcceptingSuggestion}
                />
              </div>
            )}
          </div>
          <CategorySelect
            value={formData.category}
            onValueChange={handleCategoryChange}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="grossAmount">Gross Amount</Label>
            <div className="flex gap-2">
              <Input
                ref={grossAmountRef}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="businessUsePct">Business Use (%)</Label>
              {visibleSuggestions.find((s) => s.field === "businessUsePct") && (
                <div className="flex items-center gap-2">
                  <SuggestionBadge
                    confidence={
                      visibleSuggestions.find((s) => s.field === "businessUsePct")?.confidence || 0
                    }
                    reason={
                      visibleSuggestions.find((s) => s.field === "businessUsePct")?.reason || null
                    }
                  />
                  <SuggestionControls
                    onAccept={() => {
                      const suggestion = visibleSuggestions.find((s) => s.field === "businessUsePct");
                      if (suggestion) {
                        handleAcceptSuggestion(suggestion);
                      }
                    }}
                    onDismiss={() => handleDismissSuggestion("businessUsePct")}
                    isAccepting={isAcceptingSuggestion}
                  />
                </div>
              )}
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

      {/* Accept All Suggestions */}
      {visibleSuggestions.length >= 2 && (
        <>
          <Separator />
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border border-dashed">
            <div>
              <p className="text-sm font-medium">Multiple suggestions available</p>
              <p className="text-xs text-muted-foreground">
                Accept all suggestions at once
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAcceptAllSuggestions}
              disabled={isAcceptingSuggestion}
            >
              Accept all suggestions
            </Button>
          </div>
        </>
      )}

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

